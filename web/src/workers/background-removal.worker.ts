/// <reference lib="webworker" />

/**
 * 浏览器抠图 worker —— BiRefNet-lite-512 本地推理。
 *
 * 结构与 canvas-face-detector.worker.ts 同构（本仓既有 WASM worker 写法）：
 * 模块 worker + 单例懒加载 + 消息按 id 配对 + 失败只回传不抛。
 *
 * 权重自托管：env.allowRemoteModels = false + localModelPath 指向本站 /models/，
 * 运行期绝不直连 HuggingFace（控制线 Q-3 裁定的「模型分发国内可达」硬约束）。
 */

import { RawImage, env, pipeline } from "@huggingface/transformers";
export type CutoutProgressPhase = "download" | "segment" | "encode" | "locate";

export type CutoutRequest = {
    id: number;
    /** 源图 data URL；worker 内自行解码，避免把 ImageBitmap 的转移语义扩散到调用方。 */
    sourceUrl: string;
};

/**
 * 抠图策略（控制线 R-4 分层管线终裁 2026-10-02）：
 * - direct：L0 全图单遍即检出主体（正常图路径，零额外成本）
 * - region：L0 无显著主体 → L1 弱 logits 定位 + 窗口扫描 + 区域精修贴回
 *
 * L1 全部窗口未达标时**不返回结果**，而是以 errorCode="no_subject" 走错误通道——
 * 控制线 L3 口径是「不留黑图哑失败」，空白透明图本身就是用户看到的黑图。
 */
export type CutoutStrategy = "direct" | "region";

export type CutoutResponse =
    | {
          id: number;
          kind: "progress";
          phase: CutoutProgressPhase;
          ratio?: number;
          loaded?: number;
          total?: number;
          /** 仅 locate 阶段：当前窗口序号与窗口总数（覆盖层显示「自动定位 (2/4)」）。 */
          attempt?: number;
          attempts?: number;
      }
    | {
          id: number;
          kind: "done";
          blob: Blob;
          width: number;
          height: number;
          /** 主体检出置信度（0-1）：direct 为全图覆盖率，region 为命中窗口的覆盖率。 */
          coverage: number;
          strategy: CutoutStrategy;
      }
    | { id: number; kind: "error"; message: string; errorCode: string };

/** 模型在 public 下的相对路径；与 scripts/fetch-cutout-models.sh 的落点一致。 */
const MODEL_ID = "birefnet-lite-512";
const MODEL_BASE_PATH = "/models/";

/**
 * 主体覆盖率阈值（0-1）——L0 全图单遍的「直接出图」门槛。
 *
 * 实测依据（2026-10-02，6 图矩阵）：失败侧恒为 0.00%，成功侧最小 7.1%。
 */
const MIN_SUBJECT_COVERAGE = 0.05;

/**
 * L1 接受门槛（绝对覆盖率 = 窗口内主体像素 / 原图总像素）。
 *
 * 为什么不是「窗口内占比」：窗内占比会结构性奖励小窗口——15% 窗里只要有一片
 * 花瓣就 >5% 立即早停，而覆盖主体需要更大窗口（实测真实失败图产出花瓣碎片）。
 * 为什么不是固定绝对阈值：小主体图真值本身仅占原图 ~0.8%，任何 ≥1% 的固定
 * 阈值都会把它们全部误判为失败。
 *
 * 语义：L1 必须「找到东西」（≥0.5%，噪声地板实测 0.21%）且「不丢 L0 已有的」
 * （≥ L0×0.8）。
 */
const L1_MIN_COVERAGE = 0.005;
const L1_MIN_COVERAGE_RATIO = 0.8;

/**
 * 小主体路径扫描窗口序列（占原图短边比例，升序）。
 * 主体占满窗时，窗宽变化对绝对覆盖影响很小（实测比值 1.06-1.20）。
 */
const SCAN_WINDOWS = [0.15, 0.2, 0.25, 0.35];

/**
 * 大构图路径网格参数：4×4 网格、窗宽 = 短边 50%。
 *
 * 为什么是 4×4@50%：实测成本-召回拐点（t1 37.04% / t2 25.38%，优于 3×3@50%
 * 的 30.77%/23.36%，而 5×5@40% 只多 +4.5pp/-2.6pp 却 +56% 成本）。
 * 为什么必须无空隙：覆盖要求 g×side ≥ max(W,H)，否则窗口之间漏掉条带
 * （3×3@40% 在 1024×1536 上会留下 308px 竖向空隙）。
 */
const GRID_SIZE = 4;
const GRID_WINDOW = 0.5;

/**
 * 路由判别器：同窗心不同窗宽的绝对覆盖率比值。
 *
 * 为什么需要：L0 覆盖 <5% 时，大构图与小主体的 L0 值可能同为 0.00%
 * （实测 t1/t2 都是 0%），无法用 L0 分流。
 * 判别依据：小主体主体占满窗 → 窗宽变化影响小（实测比值 1.06-1.20）；
 * 大构图主体分散 → 窗宽变化影响大（实测 0.00 / 4.45）。分离度无重叠。
 */
const ROUTE_SMALL_WINDOW = 0.15;
const ROUTE_LARGE_WINDOW = 0.3;
const ROUTE_RATIO_HIGH = 1.3;
const ROUTE_RATIO_LOW = 0.7;

/**
 * 弱 logits 质心取样比例（top 0.1%）。
 * 实测该比例在 4 张有地面真值的用例上质心全部落入主体 bbox（含多主体分散用例）。
 */
const LOCATE_PERCENTILE = 0.001;

type Segmenter = {
    /**
     * 官方 background-removal 管道。
     *
     * 为什么不用手搓的 logitsToMask + destination-in：官方 _call 只有 9 行，
     * 蒙版在 ImageSegmentationPipeline 内部按「从原图捕获的尺寸」resize 后再
     * 贴回同一张原图克隆，对齐是构造性保证的；手搓段自己解析 dims、自己布局
     * ImageData、自己做合成，每个环节都是一次坐标数学的机会（用户真机抽验
     * 2026-10-01 的「结果错位/全黑」就活在被它替代的那一段）。
     */
    pipe: Awaited<ReturnType<typeof pipeline<"background-removal">>>;
};

let segmenterPromise: Promise<Segmenter> | null = null;

// 权重只从本站取；禁掉远端回退，否则失败时会静默去连 HuggingFace。
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = MODEL_BASE_PATH;

// onnxruntime-web 的 WASM 运行时必须显式自托管。
//
// transformers.js 在 wasmPaths 未设置时会把 ORT 运行时指向 jsDelivr CDN
// （其 dist 里 `https://cdn.jsdelivr.net/npm/onnxruntime-web@${...}/dist/`），
// 条件只排除了 ServiceWorkerGlobalScope；DedicatedWorker 与主线程都不满足该
// 排除条件，所以**任何我们用到的环境都会走 jsDelivr**（实测生产 preview 与 dev
// 均拉取该 CDN 的 .mjs/.wasm，违 F-01「运行期零第三方直连 / 国内可达」硬约束）。
//
// 用 ?url 让 Vite 解析成实际资源 URL（dev 给可服务路径，生产给 /assets/ 哈希产物），
// 再显式写入 wasmPaths。注意不能用 public/ 下的副本：Vite 明确拒绝 import
// public/ 目录里的文件（"This file is in /public ... should not be imported from
// source code"），会在 dev 下直接报 no available backend found。
import ortWasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url";
import ortMjsUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url";

const ortWasm = (env as { backends?: { onnx?: { wasm?: { wasmPaths?: unknown } } } }).backends?.onnx?.wasm;
if (ortWasm) {
    ortWasm.wasmPaths = { mjs: ortMjsUrl, wasm: ortWasmUrl };
}

/**
 * WebGPU 可用性探测。失败不抛错——探测本身只是选档依据，
 * 拿不到 adapter 就按 WASM 走（Q-2：两档共用同一份 fp16 权重）。
 */
async function detectWebGPU(): Promise<boolean> {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } }).gpu;
    if (!gpu?.requestAdapter) return false;
    try {
        return Boolean(await gpu.requestAdapter());
    } catch {
        return false;
    }
}

function getSegmenter(onDownloadProgress?: (loaded: number, total: number) => void): Promise<Segmenter> {
    if (!segmenterPromise) {
        segmenterPromise = (async () => {
            const webgpu = await detectWebGPU();
            // 工厂函数直接接受 progress_callback，字节级进度能力不丢（实测 520 个
            // progress_total 事件 / 93.9MB）。
            const pipe = await pipeline("background-removal", MODEL_ID, {
                dtype: "fp16",
                device: webgpu ? "webgpu" : "wasm",
                progress_callback: (info: { status?: string; loaded?: number; total?: number }) => {
                    // transformers.js 的 progress_total 带累计字节（readResponse 逐块上报）；
                    // 只转发下载阶段，后续 init/done 不占用「正在加载模型」文案。
                    if (info.status === "progress_total") {
                        onDownloadProgress?.(info.loaded ?? 0, info.total ?? 0);
                    }
                },
            });
            return { pipe };
        })();
        // 初始化失败要允许下次重试，否则 worker 会永久卡在 rejected promise 上。
        segmenterPromise.catch(() => {
            segmenterPromise = null;
        });
    }
    return segmenterPromise;
}

function post(response: CutoutResponse) {
    self.postMessage(response);
}

/**
 * 蒙版非零像素占比（0-1）。
 *
 * BiRefNet 是显著性检测：主体过小时会判「无显著主体」并返回全零蒙版，
 * 结果是整图 alpha=0 的黑图。这不是执行失败，调用方必须能区分它并给出可操作提示
 * （用户真机终验 2026-10-01 R-4：不留黑图哑失败）。
 */
function alphaCoverage(image: { data: Uint8ClampedArray; width: number; height: number }): number {
    const total = image.width * image.height;
    if (!total) return 0;
    let opaque = 0;
    // 只看 alpha 通道（RGBA 布局，步长 4）。
    for (let index = 3; index < image.data.length; index += 4) {
        if (image.data[index] > 0) opaque += 1;
    }
    return opaque / total;
}

/**
 * 把官方 pipeline 的输出（RawImage：RGBA + alpha）转成 PNG Blob。
 *
 * 对齐由 pipeline 保证：ImageSegmentationPipeline 把蒙版 resize 到「从原图捕获的
 * 尺寸」再贴到原图克隆上（putAlpha），这里不再做任何坐标数学。
 */
async function rawImageToPngBlob(image: { data: Uint8ClampedArray; width: number; height: number }): Promise<Blob> {
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建绘图上下文");
    const pixels = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
    context.putImageData(pixels, 0, 0);
    return await canvas.convertToBlob({ type: "image/png" });
}

type LogitsTensor = { data: ArrayLike<number>; dims: number[] };

/** 官方管道实例上可复用的内部件（L1 定位需要原始 logits，官方 _call 不暴露）。 */
type RawPipelineInternals = {
    model?: {
        (inputs: Record<string, unknown>): Promise<Record<string, LogitsTensor>>;
        sessions?: Record<string, { inputNames?: string[]; outputNames?: string[] }>;
    };
    processor?: (image: unknown) => Promise<Record<string, unknown>>;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

/**
 * 取模型原始 logits（复用已加载的 model/processor，不重新加载权重）。
 *
 * 只在 L0 判定「无显著主体」后才调用——正常图不付这次推理成本。
 * 入参与输出名解析逐行对齐官方 ImageSegmentationPipeline._call，避免自己发明
 * 喂数据形状（单图 vs 数组、输入名重映射）导致定位结果与正式推理不一致。
 */
async function readWeakLogits(pipe: Segmenter["pipe"], image: unknown): Promise<LogitsTensor | null> {
    const internals = pipe as unknown as RawPipelineInternals;
    const session = internals.model?.sessions?.["model"];
    if (!internals.model || !internals.processor || !session) return null;
    // 官方把 preparedImages 数组整体交给 processor。
    const inputs = await internals.processor([image]);
    const inputNames = session.inputNames ?? [];
    if (!inputNames.includes("pixel_values") && inputNames.length === 1 && !(inputNames[0] in inputs)) {
        inputs[inputNames[0]] = inputs.pixel_values;
    }
    const output = await internals.model(inputs);
    const name = session.outputNames?.[0];
    return (name ? output[name] : undefined) ?? Object.values(output)[0] ?? null;
}

/** 弱 logits 的 top 分位质心（返回 logits 空间坐标）。 */
function weakCentroid(logits: LogitsTensor, side: number): { x: number; y: number } | null {
    const total = logits.data.length;
    if (!total || !side) return null;
    const sorted = Array.from(logits.data, Number).sort((a, b) => b - a);
    const threshold = sorted[Math.max(0, Math.floor(total * LOCATE_PERCENTILE) - 1)];
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let index = 0; index < total; index += 1) {
        if (Number(logits.data[index]) >= threshold) {
            sumX += index % side;
            sumY += Math.floor(index / side);
            count += 1;
        }
    }
    if (!count) return null;
    return { x: sumX / count, y: sumY / count };
}

async function cropToBlob(bitmap: ImageBitmap, x: number, y: number, width: number, height: number): Promise<Blob> {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建绘图上下文");
    context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
    return await canvas.convertToBlob({ type: "image/png" });
}

/**
 * 区域精修结果贴回：窗口内取裁剪推理的 alpha，窗口外 alpha=0。
 *
 * 原位原比例：裁剪窗口按原图坐标放置，不缩放、不居中——所见即所得。
 */
async function composeRegion(
    bitmap: ImageBitmap,
    cutout: { data: Uint8ClampedArray; width: number; height: number },
    x: number,
    y: number,
    width: number,
    height: number,
): Promise<Blob> {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建绘图上下文");
    context.drawImage(bitmap, 0, 0);
    const frame = context.getImageData(0, 0, width, height);
    // 窗口外不保留原图像素：源图（尤其 JPEG）自带不透明底，不清零会让「抠图」看起来没生效。
    for (let index = 3; index < frame.data.length; index += 4) frame.data[index] = 0;
    for (let row = 0; row < cutout.height; row += 1) {
        const targetY = y + row;
        if (targetY < 0 || targetY >= height) continue;
        for (let column = 0; column < cutout.width; column += 1) {
            const targetX = x + column;
            if (targetX < 0 || targetX >= width) continue;
            frame.data[(targetY * width + targetX) * 4 + 3] = cutout.data[(row * cutout.width + column) * 4 + 3];
        }
    }
    context.putImageData(frame, 0, 0);
    return await canvas.convertToBlob({ type: "image/png" });
}

/**
 * L1 自动定位：弱 logits 质心作窗心，升序窗口扫描，首个覆盖率达标窗口即停。
 * 全部窗口不达标返回 null（调用方给 L3 提示）。
 */
/**
 * 单窗推理：裁剪指定窗口，跑官方管道，返回蒙版与绝对覆盖率。
 * 绝对覆盖率 = 窗内主体像素 / 原图总像素（用于跨窗比较，见 L1_MIN_COVERAGE）。
 */
async function inferWindow(
    pipe: Segmenter["pipe"],
    bitmap: ImageBitmap,
    x: number,
    y: number,
    side: number,
    sourceWidth: number,
    sourceHeight: number,
): Promise<{ cutout: { data: Uint8ClampedArray; width: number; height: number }; coverage: number } | null> {
    const cropBlob = await cropToBlob(bitmap, x, y, side, side);
    // 裁剪后仍走官方管道：主体占满 512 输入，边缘精度同步提升。
    const output = await pipe(cropBlob);
    const cutout = Array.isArray(output) ? output[0] : output;
    if (!cutout) return null;
    return { cutout, coverage: alphaCoverage(cutout) * ((side * side) / (sourceWidth * sourceHeight)) };
}

/** 窗口左下角（窗心居中，钳到图内）。 */
function windowOrigin(center: number, side: number, limit: number) {
    return clamp(Math.round(center - side / 2), 0, Math.max(0, limit - side));
}

/**
 * L1 接受门槛（绝对覆盖率）。
 *
 * 下限防噪声假阳（实测噪声地板 0.21%），比例项防合并退化（不丢 L0 已有的）。
 */
function l1Threshold(l0Coverage: number) {
    return Math.max(l0Coverage * L1_MIN_COVERAGE_RATIO, L1_MIN_COVERAGE);
}

/**
 * 路由判别：大构图 vs 小主体。
 *
 * 同窗心、两个窗宽的绝对覆盖率比值。小主体窗宽变化影响小（实测 1.06-1.20），
 * 大构图影响大（实测 0.00-4.45）。返回 true = 走大构图网格。
 */
async function shouldUseGrid(
    pipe: Segmenter["pipe"],
    bitmap: ImageBitmap,
    sourceWidth: number,
    sourceHeight: number,
    centerX: number,
    centerY: number,
): Promise<boolean> {
    const shortSide = Math.min(sourceWidth, sourceHeight);
    const smallSide = Math.round(shortSide * ROUTE_SMALL_WINDOW);
    const largeSide = Math.round(shortSide * ROUTE_LARGE_WINDOW);
    if (smallSide < 1 || largeSide < 1) return false;
    const small = await inferWindow(
        pipe, bitmap,
        windowOrigin(centerX, smallSide, sourceWidth), windowOrigin(centerY, smallSide, sourceHeight),
        smallSide, sourceWidth, sourceHeight,
    );
    const large = await inferWindow(
        pipe, bitmap,
        windowOrigin(centerX, largeSide, sourceWidth), windowOrigin(centerY, largeSide, sourceHeight),
        largeSide, sourceWidth, sourceHeight,
    );
    const smallCoverage = small?.coverage ?? 0;
    const largeCoverage = large?.coverage ?? 0;
    // 小窗本来就空 → 无从比较，按小主体路径处理（继续扫描更便宜）。
    if (smallCoverage <= 0) return false;
    const ratio = largeCoverage / smallCoverage;
    return ratio > ROUTE_RATIO_HIGH || ratio < ROUTE_RATIO_LOW;
}

/**
 * 小主体路径：弱 logits 质心作窗心，升序窗口扫描，首个达标窗口即停。
 */
async function scanWindows(
    pipe: Segmenter["pipe"],
    bitmap: ImageBitmap,
    sourceWidth: number,
    sourceHeight: number,
    centerX: number,
    centerY: number,
    threshold: number,
    report: (attempt: number, attempts: number) => void,
): Promise<{ blob: Blob; coverage: number } | null> {
    const shortSide = Math.min(sourceWidth, sourceHeight);
    for (let index = 0; index < SCAN_WINDOWS.length; index += 1) {
        report(index + 1, SCAN_WINDOWS.length);
        const side = Math.round(shortSide * SCAN_WINDOWS[index]);
        if (side < 1) continue;
        const x = windowOrigin(centerX, side, sourceWidth);
        const y = windowOrigin(centerY, side, sourceHeight);
        const result = await inferWindow(pipe, bitmap, x, y, side, sourceWidth, sourceHeight);
        if (!result || result.coverage < threshold) continue;
        const blob = await composeRegion(bitmap, result.cutout, x, y, sourceWidth, sourceHeight);
        return { blob, coverage: result.coverage };
    }
    return null;
}

/**
 * 大构图路径：GRID_SIZE×GRID_SIZE 网格收集，逐像素 max 合并。
 *
 * 网格均匀铺满（步长 (dim-side)/(g-1)），保证 g×side ≥ max(W,H) 无空隙——
 * 否则相邻窗之间会漏掉条带，产出硬矩形切割的碎片图。
 */
async function collectGrid(
    pipe: Segmenter["pipe"],
    bitmap: ImageBitmap,
    sourceWidth: number,
    sourceHeight: number,
    threshold: number,
    report: (attempt: number, attempts: number) => void,
): Promise<{ blob: Blob; coverage: number } | null> {
    const side = Math.round(Math.min(sourceWidth, sourceHeight) * GRID_WINDOW);
    if (side < 1) return null;
    const positions = (limit: number) => {
        if (GRID_SIZE <= 1) return [Math.round((limit - side) / 2)];
        const step = (limit - side) / (GRID_SIZE - 1);
        return Array.from({ length: GRID_SIZE }, (_, index) => Math.round(index * step));
    };
    const xs = positions(sourceWidth);
    const ys = positions(sourceHeight);
    const total = xs.length * ys.length;

    const canvas = new OffscreenCanvas(sourceWidth, sourceHeight);
    const context = canvas.getContext("2d");
    if (!context) return null;
    // 先把原图铺上，逐窗只写 alpha（窗口内取裁剪推理的 alpha，窗口外保持 0）。
    context.drawImage(bitmap, 0, 0);
    const frame = context.getImageData(0, 0, sourceWidth, sourceHeight);
    for (let index = 3; index < frame.data.length; index += 4) frame.data[index] = 0;

    let attempt = 0;
    let best: { cutout: { data: Uint8ClampedArray; width: number; height: number }; x: number; y: number } | null = null;
    let bestCoverage = 0;
    for (const y of ys) {
        for (const x of xs) {
            attempt += 1;
            report(attempt, total);
            const result = await inferWindow(pipe, bitmap, x, y, side, sourceWidth, sourceHeight);
            if (!result || result.coverage <= 0) continue;
            if (result.coverage > bestCoverage) {
                bestCoverage = result.coverage;
                best = { cutout: result.cutout, x, y };
            }
            for (let row = 0; row < side; row += 1) {
                const targetY = y + row;
                if (targetY < 0 || targetY >= sourceHeight) continue;
                for (let column = 0; column < side; column += 1) {
                    const targetX = x + column;
                    if (targetX < 0 || targetX >= sourceWidth) continue;
                    const alpha = result.cutout.data[(row * side + column) * 4 + 3];
                    const offset = (targetY * sourceWidth + targetX) * 4 + 3;
                    if (alpha > frame.data[offset]) frame.data[offset] = alpha;
                }
            }
        }
    }
    if (!best) return null;
    context.putImageData(frame, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    // 合并后的绝对覆盖率要按整图重算（逐窗值不等于并集）。
    let opaque = 0;
    for (let index = 3; index < frame.data.length; index += 4) if (frame.data[index] > 0) opaque += 1;
    const coverage = opaque / (sourceWidth * sourceHeight);
    if (coverage < threshold) return null;
    return { blob, coverage };
}

self.onmessage = async (event: MessageEvent<CutoutRequest>) => {
    const { id, sourceUrl } = event.data;
    try {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
            post({ id, kind: "error", message: "无法读取源图片，请重新选择后再试", errorCode: "source_unreadable" });
            return;
        }
        const sourceBlob = await response.blob();
        // 原图尺寸在 pipeline 内部捕获（prepareImages），这里只用于回传元数据。
        const source = await RawImage.fromBlob(sourceBlob);
        const sourceWidth = source.width;
        const sourceHeight = source.height;

        post({ id, kind: "progress", phase: "download" });
        const { pipe } = await getSegmenter((loaded, total) => {
            // 字节级进度：覆盖层显示「37.2MB / 94MB」而不是只转圈。
            post({ id, kind: "progress", phase: "download", loaded, total });
        });

        post({ id, kind: "progress", phase: "segment" });
        // L0 基线：官方管道全图单遍（prepareImages → 分段 → 蒙版 resize 回原图尺寸 → putAlpha）。
        const output = await pipe(sourceBlob);
        const cutout = Array.isArray(output) ? output[0] : output;
        if (!cutout) throw new Error("本地抠图没有返回结果");

        const directCoverage = alphaCoverage(cutout);
        if (directCoverage >= MIN_SUBJECT_COVERAGE) {
            post({ id, kind: "progress", phase: "encode" });
            const blob = await rawImageToPngBlob(cutout);
            post({
                id,
                kind: "done",
                blob,
                width: cutout.width || sourceWidth,
                height: cutout.height || sourceHeight,
                coverage: directCoverage,
                strategy: "direct",
            });
            return;
        }

        // L1：全图无显著主体（多主体构图 / 主体过小）。
        //
        // 分流依据不能用 L0 覆盖率：实测大构图（t1/t2）与小主体（t3-t6）的 L0 同为 0.00%，
        // 同值无法区分。改用弱 logits 质心处的「窗口稳定性」判别（见 shouldUseGrid）。
        post({ id, kind: "progress", phase: "locate" });
        const logits = await readWeakLogits(pipe, source).catch(() => null);
        const logitsSide = logits?.dims?.[logits.dims.length - 1] ?? 0;
        const centroid = logits && logitsSide ? weakCentroid(logits, logitsSide) : null;
        if (!centroid) {
            // 拿不到弱 logits（官方管道内部件不可达）时退化为全图网格：
            // 大构图是更坏的情形（小主体至少还有 L0 结果可交付），优先救它。
            const bitmap = await createImageBitmap(sourceBlob);
            try {
                const grid = await collectGrid(pipe, bitmap, sourceWidth, sourceHeight, l1Threshold(directCoverage), (attempt, attempts) => {
                    post({ id, kind: "progress", phase: "locate", attempt, attempts });
                });
                post({ id, kind: "progress", phase: "encode" });
                if (grid) {
                    post({ id, kind: "done", blob: grid.blob, width: sourceWidth, height: sourceHeight, coverage: grid.coverage, strategy: "region" });
                    return;
                }
            } finally {
                bitmap.close();
            }
            post({ id, kind: "error", errorCode: "no_subject", message: "未识别到主体，建议框选主体区域重试，或用 AI 重新去除（云端）" });
            return;
        }

        const centerX = (centroid.x / logitsSide) * sourceWidth;
        const centerY = (centroid.y / logitsSide) * sourceHeight;
        const threshold = l1Threshold(directCoverage);
        const report = (attempt: number, attempts: number) => {
            post({ id, kind: "progress", phase: "locate", attempt, attempts });
        };

        const bitmap = await createImageBitmap(sourceBlob);
        let region: { blob: Blob; coverage: number } | null = null;
        try {
            // 判别器先花 2 次推理（15% + 30% 同窗心），再走对应路径。
            const useGrid = await shouldUseGrid(pipe, bitmap, sourceWidth, sourceHeight, centerX, centerY);
            region = useGrid
                ? await collectGrid(pipe, bitmap, sourceWidth, sourceHeight, threshold, report)
                : await scanWindows(pipe, bitmap, sourceWidth, sourceHeight, centerX, centerY, threshold, report);
        } finally {
            bitmap.close();
        }

        post({ id, kind: "progress", phase: "encode" });
        if (!region) {
            // L3：连探测都不中（<64px 级物理极限）。绝不回传空白透明图——那正是用户看到的黑图；
            // 用独立 errorCode 让调用方给可操作出口（框选重试 / 云端）。
            post({
                id,
                kind: "error",
                errorCode: "no_subject",
                message: "未识别到主体，建议框选主体区域重试，或用 AI 重新去除（云端）",
            });
            return;
        }
        post({
            id,
            kind: "done",
            blob: region.blob,
            width: sourceWidth,
            height: sourceHeight,
            coverage: region.coverage,
            strategy: "region",
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "本地抠图失败";
        // 模型缺失是最常见的失败：文案要能直接告诉用户去跑 fetch 脚本。
        const errorCode = /not found|404|fetch|load/i.test(message) ? "model_missing" : "cutout_failed";
        post({ id, kind: "error", message, errorCode });
    }
};

export {};
