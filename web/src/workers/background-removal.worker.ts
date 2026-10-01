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
export type CutoutProgressPhase = "download" | "segment" | "encode";

export type CutoutRequest = {
    id: number;
    /** 源图 data URL；worker 内自行解码，避免把 ImageBitmap 的转移语义扩散到调用方。 */
    sourceUrl: string;
};

export type CutoutResponse =
    | { id: number; kind: "progress"; phase: CutoutProgressPhase; ratio?: number; loaded?: number; total?: number }
    | { id: number; kind: "done"; blob: Blob; width: number; height: number }
    | { id: number; kind: "error"; message: string; errorCode: string };

/** 模型在 public 下的相对路径；与 scripts/fetch-cutout-models.sh 的落点一致。 */
const MODEL_ID = "birefnet-lite-512";
const MODEL_BASE_PATH = "/models/";

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
        // 官方管道：prepareImages → 分段 → 蒙版 resize 回原图尺寸 → putAlpha。
        const output = await pipe(sourceBlob);
        const cutout = Array.isArray(output) ? output[0] : output;
        if (!cutout) throw new Error("本地抠图没有返回结果");

        post({ id, kind: "progress", phase: "encode" });
        const blob = await rawImageToPngBlob(cutout);

        post({ id, kind: "done", blob, width: cutout.width || sourceWidth, height: cutout.height || sourceHeight });
    } catch (error) {
        const message = error instanceof Error ? error.message : "本地抠图失败";
        // 模型缺失是最常见的失败：文案要能直接告诉用户去跑 fetch 脚本。
        const errorCode = /not found|404|fetch|load/i.test(message) ? "model_missing" : "cutout_failed";
        post({ id, kind: "error", message, errorCode });
    }
};

export {};
