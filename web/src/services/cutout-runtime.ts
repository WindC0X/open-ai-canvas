/**
 * 抠图 worker 的调用侧封装。
 *
 * 与 canvas-face-detection.ts 同构：单例 worker、按 id 配对在途请求、
 * AbortSignal 支持、worker 崩溃时拒绝全部在途请求并允许重建。
 */

import type { CutoutProgressPhase, CutoutRequest, CutoutResponse, CutoutStrategy } from "../workers/background-removal.worker";

export type { CutoutProgressPhase, CutoutStrategy };

export type CutoutResult = {
    blob: Blob;
    width: number;
    height: number;
    /**
     * 主体检出置信度（0-1）：direct 为全图覆盖率，region 为命中窗口覆盖率。
     * 低于阈值说明模型未识别到显著主体，调用方据此给可操作提示而不是哑失败。
     */
    coverage: number;
    /** 实际生效的抠图策略（控制线 R-4 分层管线）。 */
    strategy: CutoutStrategy;
};

/** 抠图失败时携带机器可读原因，调用方据此决定节点状态与文案。 */
export class CutoutRuntimeError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = "CutoutRuntimeError";
        this.code = code;
    }
}

export type RunBrowserCutoutOptions = {
    signal?: AbortSignal;
    onProgress?: (progress: CutoutProgress) => void;
};

/** 进度事件：阶段 + 下载字节（下载阶段才有字节数）。 */
export type CutoutProgress = {
    phase: CutoutProgressPhase;
    /** 已下载字节；仅下载阶段有值。 */
    loaded?: number;
    /** 总字节；仅下载阶段有值。 */
    total?: number;
    /** 仅 locate 阶段：当前扫描窗口序号。 */
    attempt?: number;
    /** 仅 locate 阶段：扫描窗口总数。 */
    attempts?: number;
};

type PendingRequest = {
    resolve: (result: CutoutResult) => void;
    reject: (error: Error) => void;
    cleanup: () => void;
    /** 进度回调随请求一起存放和清理，避免 id 复用时串到别的请求上。 */
    onProgress?: (progress: CutoutProgress) => void;
};

let cutoutWorker: Worker | null = null;
let requestSequence = 0;
const pendingRequests = new Map<number, PendingRequest>();

export async function runBrowserCutout(sourceUrl: string, options: RunBrowserCutoutOptions = {}): Promise<CutoutResult> {
    const { signal, onProgress } = options;
    if (signal?.aborted) throw new DOMException("抠图已取消", "AbortError");

    const worker = getCutoutWorker();
    const id = ++requestSequence;

    return new Promise<CutoutResult>((resolve, reject) => {
        const abort = () => {
            const request = pendingRequests.get(id);
            if (!request) return;
            pendingRequests.delete(id);
            request.cleanup();
            reject(new DOMException("抠图已取消", "AbortError"));
        };
        const cleanup = () => signal?.removeEventListener("abort", abort);
        pendingRequests.set(id, { resolve, reject, cleanup, onProgress });
        signal?.addEventListener("abort", abort, { once: true });
        worker.postMessage({ id, sourceUrl } satisfies CutoutRequest);
    });
}

/** 预热 worker：进面板时先起线程，省掉首次点击的启动延迟。 */
export function preloadCutoutWorker() {
    getCutoutWorker();
}

function getCutoutWorker() {
    if (cutoutWorker) return cutoutWorker;
    const worker = new Worker(new URL("../workers/background-removal.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<CutoutResponse>) => {
        const { id } = event.data;
        const request = pendingRequests.get(id);
        if (!request) return;
        if (event.data.kind === "progress") {
            request.onProgress?.({
                phase: event.data.phase,
                loaded: event.data.loaded,
                total: event.data.total,
                attempt: event.data.attempt,
                attempts: event.data.attempts,
            });
            return;
        }
        pendingRequests.delete(id);
        request.cleanup();
        if (event.data.kind === "error") {
            request.reject(new CutoutRuntimeError(event.data.errorCode, event.data.message));
            return;
        }
        request.resolve({
            blob: event.data.blob,
            width: event.data.width,
            height: event.data.height,
            coverage: event.data.coverage,
            strategy: event.data.strategy,
        });
    };
    worker.onerror = (event) => {
        const error = new Error(event.message || "本地抠图服务初始化失败");
        pendingRequests.forEach((request) => {
            request.cleanup();
            request.reject(error);
        });
        pendingRequests.clear();
        worker.terminate();
        cutoutWorker = null;
    };
    cutoutWorker = worker;
    return worker;
}
