import { getResourceBlob } from "@/services/api/resources";
import type { GenerationTask } from "@/services/api/task-center";
import { useAssetStore } from "@/stores/use-asset-store";
import { taskDeliverableOutput } from "@/lib/task-deliverable-state";

// 纯判据的单一来源是零依赖模块（供任务面组件直接使用，不拖入 asset store）。
export { taskDeliverableOutput, taskDeliverableState, type TaskDeliverableState } from "@/lib/task-deliverable-state";

/**
 * 统一任务面交付步 —— 下载合规成品（设计卡 §5.3 硬验收③）。
 *
 * 纪律：
 * - 下载的是**合规成品**（原始分辨率/完整文件），不是缩略图或中间产物
 * - 优先取任务输出的**素材记录**（`outputs[].materializedAssetId`）的 storageKey ——
 *   那是落盘后的原始文件；仅当素材不可解析时才回退任务自带的 previewUrl
 *   （previewUrl 是后端从结果 JSON 提取的展示用地址，可能是缩略图）
 *
 * 与既有下载一致：blob → object URL → 临时 `<a download>` → 立即回收 URL。
 */

const EXTENSION_BY_MIME: Array<[string, string]> = [
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["video/mp4", "mp4"],
    ["video/webm", "webm"],
    ["audio/mpeg", "mp3"],
    ["audio/wav", "wav"],
];

export function downloadFileName(task: GenerationTask, extension: string): string {
    const base = (task.prompt || task.operation || task.type || "生成结果")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[\\/:*?"<>|]/g, "")
        .trim()
        .slice(0, 60);
    return `${base || "生成结果"}-${task.id.slice(0, 8)}.${extension}`;
}

function extensionFor(mimeType: string, kind: string): string {
    for (const [mime, extension] of EXTENSION_BY_MIME) {
        if (mimeType.includes(mime.split("/")[1])) return extension;
    }
    return kind === "video" ? "mp4" : "png";
}

/** 任务的首个可下载产物（按输出序号）。 */
/**
 * 下载任务产物。返回实际使用的文件名（供调用方提示），失败时抛错由调用方提示。
 *
 * ★ 合规成品优先：素材记录的 storageKey → getResourceBlob（原始文件字节）。
 */
export async function downloadGenerationTaskResult(task: GenerationTask): Promise<string> {
    const output = taskDeliverableOutput(task);
    const asset = output?.materializedAssetId
        ? useAssetStore.getState().assets.find((candidate) => candidate.id === output.materializedAssetId)
        : undefined;
    const storageKey = asset && "storageKey" in asset.data ? asset.data.storageKey : undefined;

    let blob: Blob | null = null;
    let kind = task.previewKind === "video" ? "video" : "image";
    if (storageKey) {
        blob = await getResourceBlob(storageKey);
        kind = asset?.kind === "video" ? "video" : asset?.kind === "audio" ? "audio" : "image";
    }
    if (!blob) {
        // 回退：素材记录不可解析时用任务自带地址（后端提取的展示地址）。
        const fallbackUrl = task.previewUrl;
        if (!fallbackUrl) throw new Error("任务产物不可下载：没有可用的素材记录");
        const response = await fetch(fallbackUrl, { credentials: "include" });
        if (!response.ok) throw new Error(`产物下载失败（${response.status}）`);
        blob = await response.blob();
    }

    const assetMimeType = asset && "mimeType" in asset.data ? asset.data.mimeType : "";
    const mimeType = blob.type || assetMimeType || "";
    const fileName = downloadFileName(task, extensionFor(mimeType, kind));
    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
    } finally {
        URL.revokeObjectURL(url);
    }
    return fileName;
}
