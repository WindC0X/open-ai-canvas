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

import { AutoModel, AutoProcessor, RawImage, env } from "@huggingface/transformers";
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
    model: Awaited<ReturnType<typeof AutoModel.from_pretrained>>;
    processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
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
            const model = await AutoModel.from_pretrained(MODEL_ID, {
                dtype: "fp16",
                device: webgpu ? "webgpu" : "wasm",
                progress_callback: (info: { status?: string; loaded?: number; total?: number }) => {
                    // transformers.js 的 progress_total 带累计字节（readResponse 逐块上报）；
                    // 只转发下载阶段，后续 init/done 不占用「正在下载模型」文案。
                    if (info.status === "progress_total") {
                        onDownloadProgress?.(info.loaded ?? 0, info.total ?? 0);
                    }
                },
            });
            const processor = await AutoProcessor.from_pretrained(MODEL_ID);
            return { model, processor };
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
 * 把 sigmoid 后的 alpha 马特与原图按原分辨率合成，返回透明 PNG。
 *
 * Q-4 口径：模型只在 512 上推理（超出会 OOM），但合成回到原图尺寸——
 * 主体保真不受损，边缘精度受模型 512 输入限制。
 */
async function composeTransparentPng(
    sourceBlob: Blob,
    width: number,
    height: number,
    mask: { data: Uint8ClampedArray; width: number; height: number },
): Promise<Blob> {
    const image = await createImageBitmap(sourceBlob);
    try {
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("无法创建绘图上下文");

        context.drawImage(image, 0, 0, width, height);

        const maskCanvas = new OffscreenCanvas(mask.width, mask.height);
        const maskContext = maskCanvas.getContext("2d");
        if (!maskContext) throw new Error("无法创建蒙版上下文");
        const maskImage = maskContext.createImageData(mask.width, mask.height);
        // 蒙版只有单通道 alpha；RGB 填 0，alpha 用灰度值。
        for (let index = 0; index < mask.width * mask.height; index += 1) {
            const value = mask.data[index];
            maskImage.data[index * 4] = 0;
            maskImage.data[index * 4 + 1] = 0;
            maskImage.data[index * 4 + 2] = 0;
            maskImage.data[index * 4 + 3] = value;
        }
        maskContext.putImageData(maskImage, 0, 0);

        // destination-in：保留原图中蒙版 alpha 非零的像素。
        context.globalCompositeOperation = "destination-in";
        context.drawImage(maskCanvas, 0, 0, mask.width, mask.height, 0, 0, width, height);
        context.globalCompositeOperation = "source-over";

        return await canvas.convertToBlob({ type: "image/png" });
    } finally {
        image.close();
    }
}

/** 把 logits 张量转成 0-255 的 alpha 蒙版。 */
function logitsToMask(
    logits: { data: Float32Array | Uint8Array; dims: number[] },
): { data: Uint8ClampedArray; width: number; height: number } {
    // 输出维度可能是 [1, 1, H, W]、[1, H, W] 或 [H, W]，统一取末两维。
    const dims = logits.dims;
    const height = dims[dims.length - 2];
    const width = dims[dims.length - 1];
    const size = width * height;
    const data = new Uint8ClampedArray(size);
    const source = logits.data;
    const offset = source.length - size;
    for (let index = 0; index < size; index += 1) {
        const logit = Number(source[offset + index]);
        // sigmoid 得到 [0,1] 的 alpha，再映射到 0-255。
        const alpha = 1 / (1 + Math.exp(-logit));
        data[index] = Math.round(alpha * 255);
    }
    return { data, width, height };
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
        // 处理器只认 RawImage（它才有 .size）；传 ImageBitmap 会在 preprocess 里
        // 以 undefined is not iterable 炸掉。原图尺寸从 RawImage 上取。
        const image = await RawImage.fromBlob(sourceBlob);
        const sourceWidth = image.width;
        const sourceHeight = image.height;

        post({ id, kind: "progress", phase: "download" });
        const { model, processor } = await getSegmenter((loaded, total) => {
            // 字节级进度：覆盖层显示「37.2MB / 94MB」而不是只转圈。
            post({ id, kind: "progress", phase: "download", loaded, total });
        });

        post({ id, kind: "progress", phase: "segment" });
        // 处理器按模型原生尺寸（512）缩放；原图尺寸留给合成阶段。
        const prepared = await processor(image);
        const output = await model({ input_image: prepared.pixel_values });
        const logits = output.logits ?? output.output_image ?? Object.values(output)[0];

        post({ id, kind: "progress", phase: "encode" });
        const mask = logitsToMask(logits as { data: Float32Array; dims: number[] });
        const blob = await composeTransparentPng(sourceBlob, sourceWidth, sourceHeight, mask);

        post({ id, kind: "done", blob, width: sourceWidth, height: sourceHeight });
    } catch (error) {
        const message = error instanceof Error ? error.message : "本地抠图失败";
        // 模型缺失是最常见的失败：文案要能直接告诉用户去跑 fetch 脚本。
        const errorCode = /not found|404|fetch|load/i.test(message) ? "model_missing" : "cutout_failed";
        post({ id, kind: "error", message, errorCode });
    }
};

export {};
