import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { fitNodeSize, MEDIA_NODE_MAX_SIZE, nodeSizeFromRatio, videoCompletionSize, VIDEO_NODE_MAX_SIZE } from "@/lib/canvas/canvas-node-size";
import { commitCanvasGenerationResult } from "@/lib/canvas/canvas-generation-result";
import { compositeEmotionImage } from "@/lib/canvas/canvas-emotion";
import { storeGeneratedAudio } from "@/services/api/audio";
import { storeGeneratedVideo } from "@/services/api/video";
import { parseBackendGenerationResult } from "@/services/api/generation-task";
import type { GenerationTask, GenerationTaskOutput } from "@/services/api/task-center";
import { resolveMediaUrl, type UploadedFile } from "@/services/file-storage";
import { resolveImageUrl, uploadImage, type UploadedImage } from "@/services/image-storage";
import { getCachedResourceBlob } from "@/services/resource-blob-cache";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useAssetStore } from "@/stores/use-asset-store";
import { applyGenerationConsumerEffect, generationEffectApplied } from "@/services/generation-consumer-dedupe";
import { commitProducedModel } from "@/lib/canvas/produced-model";
import { CanvasNodeType, type CanvasGenerationMode, type CanvasNodeData, type CanvasNodeMetadata } from "@/types/canvas";

export function generationTaskInput(task: GenerationTask) {
    if (!task.inputJson) return null;
    try {
        return JSON.parse(task.inputJson) as {
            mode?: CanvasGenerationMode;
            metadata?: { nodeId?: string; sourceNodeId?: string; domainProjectId?: string };
            prompt?: string;
            config?: { size?: string };
        };
    } catch {
        return null;
    }
}

export function generationTaskNodeId(task: GenerationTask) {
    return task.clientContext?.nodeId || generationTaskInput(task)?.metadata?.nodeId || "";
}

export function generationTaskMode(task: GenerationTask, fallback?: CanvasGenerationMode): CanvasGenerationMode {
    const inputMode = generationTaskInput(task)?.mode;
    if (inputMode === "text" || inputMode === "image" || inputMode === "video" || inputMode === "audio") return inputMode;
    if (task.type === "canvas_text") return "text";
    if (task.type === "canvas_video") return "video";
    if (task.type === "canvas_audio") return "audio";
    if (task.type === "canvas_image") return "image";
    return fallback || "image";
}

export function generationTaskCanReloadResource(task: GenerationTask) {
    const mode = generationTaskMode(task);
    return task.status === "succeeded" && (mode === "image" || mode === "video" || mode === "audio") && (Boolean(task.resultJson) || Boolean(task.outputs?.length));
}

export function imageMetadata(image: UploadedImage): CanvasNodeMetadata {
    return {
        content: image.url,
        storageKey: image.storageKey,
        status: "success",
        naturalWidth: image.width,
        naturalHeight: image.height,
        bytes: image.bytes,
        mimeType: image.mimeType,
        errorDetails: undefined,
        generationErrorCode: undefined,
        resourceReloadAvailable: undefined,
        failedPromptFingerprint: undefined,
    };
}

export function videoMetadata(video: UploadedFile): CanvasNodeMetadata {
    return {
        content: video.url,
        storageKey: video.storageKey,
        status: "success",
        naturalWidth: video.width,
        naturalHeight: video.height,
        bytes: video.bytes,
        mimeType: video.mimeType || "video/mp4",
        durationMs: video.durationMs,
        hasAudio: video.hasAudio,
        videoPreview: video.preview ? {
            content: video.preview.url,
            storageKey: video.preview.storageKey,
            width: video.preview.width,
            height: video.preview.height,
            bytes: video.preview.bytes,
            mimeType: video.preview.mimeType,
        } : undefined,
        errorDetails: undefined,
        generationErrorCode: undefined,
        resourceReloadAvailable: undefined,
        failedPromptFingerprint: undefined,
    };
}

export function audioMetadata(audio: UploadedFile): CanvasNodeMetadata {
    return {
        content: audio.url,
        storageKey: audio.storageKey,
        status: "success",
        bytes: audio.bytes,
        mimeType: audio.mimeType || "audio/mpeg",
        durationMs: audio.durationMs,
        errorDetails: undefined,
        generationErrorCode: undefined,
        resourceReloadAvailable: undefined,
        failedPromptFingerprint: undefined,
    };
}

function workflowMetadataForResultNode(): Partial<CanvasNodeMetadata> {
    return {
        workflowProvider: undefined,
        runningHubWorkflowId: undefined,
        runningHubWorkflowKind: undefined,
        workflowParameters: undefined,
    };
}

// 原地重生会换 storageKey 但继承旧 assetId，形成「旧素材 + 新资源」配对，云端校验会永久拒绝。
// 新媒体结果必须清掉旧绑定，交给入库/修复路径按新资源重绑。
export function applyGeneratedMediaResultMetadata(node: CanvasNodeData, media: CanvasNodeMetadata, extra: Partial<CanvasNodeMetadata> = {}, fallbackModel?: string): CanvasNodeMetadata {
    return commitProducedModel({
        ...node.metadata,
        ...workflowMetadataForResultNode(),
        ...media,
        ...extra,
        errorDetails: undefined,
        assetId: undefined,
    }, fallbackModel);
}

export async function buildGenerationTaskNodeResult(node: CanvasNodeData, task: GenerationTask, nodes: CanvasNodeData[] = [node], outputIndex = 0): Promise<CanvasNodeData> {
    const mode = generationTaskMode(task, node.type === CanvasNodeType.Text ? "text" : node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : "image");
    const prompt = node.metadata?.prompt || task.prompt;
    const result = parseBackendGenerationResult(task);

    if (mode === "image") {
        const image = result.images?.[outputIndex];
        if (!image?.dataUrl) throw new Error("后端任务没有返回图片");
        let resultDataUrl = image.dataUrl;
        const emotionEdit = node.metadata?.emotionEdit;
        if (emotionEdit) {
            if (!emotionEdit.editRegion) throw new Error("情绪编辑任务缺少局部合成区域，已拒绝使用整图重绘结果");
            const sourceNode = nodes.find((item) => item.id === emotionEdit.sourceNodeId);
            if (!sourceNode?.metadata?.content) throw new Error("情绪编辑源图片已删除，无法恢复局部合成结果");
            const sourceDataUrl = await resolveImageUrl(sourceNode.metadata.storageKey, sourceNode.metadata.content);
            if (!sourceDataUrl) throw new Error("无法读取情绪编辑源图片，未使用整图重绘结果");
            resultDataUrl = await compositeEmotionImage(sourceDataUrl, image.dataUrl, emotionEdit.editRegion, emotionEdit.faceBox);
        }
        const uploaded =
            image.storageKey && !emotionEdit
                ? { url: await resolveImageUrl(image.storageKey, image.dataUrl), storageKey: image.storageKey, width: image.width || 1024, height: image.height || 1024, bytes: image.bytes || 0, mimeType: image.mimeType || "image/png" }
                : await uploadImage(resultDataUrl);
        const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
        // 比例基准 = 媒体标准盒（非 16:9 默认盒）：显式 1:1 的目标框是 520×520，与扩图占位/
        // 上传链同尺寸（用户实测 2026-09-21：同 1:1 占位 520，生成结果被默认盒 405 高钳到 420）。
        const requestedImageSize = nodeSizeFromRatio(node.metadata?.size || "auto", MEDIA_NODE_MAX_SIZE.width, MEDIA_NODE_MAX_SIZE.height);
        const hasReportedImageSize = Boolean(image.width && image.width > 0 && image.height && image.height > 0);
        const resultWidth = image.storageKey && !hasReportedImageSize && requestedImageSize ? requestedImageSize.width : uploaded.width;
        const resultHeight = image.storageKey && !hasReportedImageSize && requestedImageSize ? requestedImageSize.height : uploaded.height;
        const normalizedImage = resultWidth === uploaded.width && resultHeight === uploaded.height ? uploaded : { ...uploaded, width: resultWidth, height: resultHeight };
        // 扩图合同（manualSize）回写链一律重算画幅偏差角标：此前只在直连成功路径计算，
        // hydrate/任务中心重试回写后角标静默丢失（review 2026-09-21 P3）。提交尺寸取任务
        // input.config.size（WxH 串）；解析失败或非扩图节点不写角标。
        const submittedSize = (() => {
            if (!(node.metadata?.generationType === "edit" && node.metadata?.manualSize)) return undefined;
            const raw = generationTaskInput(task)?.config?.size;
            if (!raw) return undefined;
            const [w, h] = raw.split("x").map(Number);
            return w > 0 && h > 0 ? { width: w, height: h } : undefined;
        })();
        const ratioDrift = submittedSize ? Math.abs(Math.log((uploaded.width / uploaded.height) / (submittedSize.width / submittedSize.height))) : 0;
        const sizeMismatch = submittedSize && ratioDrift > 0.02 ? { submitted: `${submittedSize.width}x${submittedSize.height}`, actual: `${uploaded.width}x${uploaded.height}` } : undefined;
        // 尺寸合同链（任一命中就沿用现框，不改写）：扩图占位 manualSize（上游不按提交像素出图是
        // 常态，偏差走 outpaintSizeMismatch 角标，用户实测 2026-09-20）；用户拉过的框
        // userResized/manualSize 与自由比例 freeResize（与 hydrate 定尺寸守卫同源，尊重人工尺寸）；
        // edit+auto 沿用现框（提交框已是按比例建立的几何）。
        // 其余（生成结果无人工尺寸）按【全局媒体标准】fitNodeSize 回写：不传边界盒 = 720×520 上限
        // + 420×236 地板，与扩图占位/上传/hydrate 同一条规则——同比例同一尺寸（用户实测 2026-09-21）。
        // 偏差场景 = 结果即事实（2026-09-29 裁决②a 修订）：mismatch（漂移 >0.02，角标亮）时
        // 提交框合同让位，节点按实返图比例重算，避免 object-contain 两侧空缺；人工尺寸
        // （userResized/freeResize）仍受保护；非偏差路径零改动。
        const mismatchRefit = sizeMismatch && !node.metadata?.userResized && !node.metadata?.freeResize;
        const imageSize = mismatchRefit
            ? fitNodeSize(uploaded.width, uploaded.height)
            : node.metadata?.manualSize || node.metadata?.freeResize || node.metadata?.userResized
              || (node.metadata?.generationType === "edit" && !requestedImageSize)
                ? { width: node.width || imageConfig.width, height: node.height || imageConfig.height }
                : fitNodeSize(resultWidth, resultHeight);
        return {
            ...node,
            type: CanvasNodeType.Image,
            width: imageSize.width,
            height: imageSize.height,
            position: { x: node.position.x + node.width / 2 - imageSize.width / 2, y: node.position.y + node.height / 2 - imageSize.height / 2 },
            // 合并口径（2026-10-04 sync #2）：fork 的 outpaintSizeMismatch（扩图尺寸偏差角标）
            // 与上游的 generationOutputCount（Midjourney 多图堆叠）是不同字段，并存。
            metadata: applyGeneratedMediaResultMetadata(node, imageMetadata(normalizedImage), { prompt, ...completedTaskMetadata(task), ...(sizeMismatch ? { outpaintSizeMismatch: sizeMismatch } : { outpaintSizeMismatch: undefined }), generationOutputCount: 1 }, task.model),
        };
    }

    if (mode === "video") {
        if (!result.video?.storageKey && !result.video?.dataUrl) throw new Error("后端任务没有返回视频");
        const video = result.video.storageKey
            ? await cacheGeneratedRemoteVideo({ ...result.video, storageKey: result.video.storageKey })
            : await storeGeneratedVideo({ url: result.video.dataUrl, mimeType: result.video.mimeType || "video/mp4" });
        // S07 同比例守卫：媒体与现框比例一致时保持现框（flora 原位显现），位置不动；
        // 仅比例真不同才 refit（对齐 S05 图片 fitToImage 守卫语义，locked 分支不受影响）。
        const videoSize = videoCompletionSize(node, video, VIDEO_NODE_MAX_SIZE);
        const geometry = node.metadata?.locked
            ? {}
            : {
                  width: videoSize.width,
                  height: videoSize.height,
                  position: videoSize.keepPosition
                      ? { x: node.position.x, y: node.position.y }
                      : { x: node.position.x + node.width / 2 - videoSize.width / 2, y: node.position.y + node.height / 2 - videoSize.height / 2 },
              };
        return {
            ...node,
            type: CanvasNodeType.Video,
            ...geometry,
            metadata: applyGeneratedMediaResultMetadata(node, videoMetadata(video), { prompt, ...completedTaskMetadata(task) }, task.model),
        };
    }

    if (mode === "audio") {
        if (!result.audio?.dataUrl) throw new Error("后端任务没有返回音频");
        const audio = result.audio.storageKey
            ? { url: await resolveMediaUrl(result.audio.storageKey, result.audio.dataUrl), storageKey: result.audio.storageKey, durationMs: result.audio.durationMs, bytes: result.audio.bytes || 0, mimeType: result.audio.mimeType || "audio/mpeg" }
            : await storeGeneratedAudio(await (await fetch(result.audio.dataUrl)).blob(), result.audio.format || "mp3");
        return { ...node, type: CanvasNodeType.Audio, metadata: applyGeneratedMediaResultMetadata(node, audioMetadata(audio), { prompt, ...completedTaskMetadata(task) }, task.model) };
    }

    if (!result.text) throw new Error("后端任务没有返回文本");
    return {
        ...node,
        type: CanvasNodeType.Text,
        metadata: { ...node.metadata, content: result.text, richText: undefined, prompt, ...completedTaskMetadata(task), status: "success", errorDetails: undefined, generationErrorCode: undefined, resourceReloadAvailable: undefined, failedPromptFingerprint: undefined },
    };
}

type GeneratedVideoResult = {
    dataUrl: string;
    storageKey?: string;
    width?: number;
    height?: number;
    durationMs?: number;
    bytes?: number;
    mimeType?: string;
};

/**
 * 生成任务的远程视频只有在浏览器已拿到可复用的 Blob 后才进入成功态。
 * 节点仍保存稳定的资源文件地址，Blob 只作为本地缓存和后续字节处理的加速层。
 */
async function cacheGeneratedRemoteVideo(result: GeneratedVideoResult & { storageKey: string }): Promise<UploadedFile> {
    const blob = await getCachedResourceBlob(result.storageKey);
    if (!blob) throw new Error("生成视频资源缓存失败，未标记为成功");
    const url = await resolveMediaUrl(result.storageKey, result.dataUrl || "");
    if (!url) throw new Error("生成视频资源地址为空，未标记为成功");
    return {
        url,
        storageKey: result.storageKey,
        width: result.width,
        height: result.height,
        durationMs: result.durationMs,
        bytes: result.bytes || blob.size,
        mimeType: result.mimeType || blob.type || "video/mp4",
    };
}

export async function applyGenerationTaskResultToNodes(nodes: CanvasNodeData[], task: GenerationTask, targetNodeId?: string) {
    const node = findGenerationTaskNode(nodes, task, targetNodeId);
    if (!node) return { nodes, updated: false, nodeId: "", node: null };
    const { node: updatedNode, additionalNodes } = await buildGenerationTaskNodeResults(node, task, nodes);
    return {
        nodes: commitCanvasGenerationResult(nodes, node, updatedNode, task.id, additionalNodes),
        updated: true,
        nodeId: node.id,
        node: updatedNode,
        additionalNodes,
    };
}

export async function applyMaterializedGenerationTaskResultToNodes(nodes: CanvasNodeData[], task: GenerationTask, output: GenerationTaskOutput, effectKey: string, targetNodeId?: string) {
    const node = findGenerationTaskNode(nodes, task, targetNodeId);
    if (!node) return { nodes, updated: false, nodeId: "", node: null };
    if (generationEffectApplied(node.metadata || {}, effectKey) && generationTaskOutputsApplied(node, task)) {
        return { nodes, updated: true, nodeId: node.id, node, additionalNodes: [] };
    }
    const asset = useAssetStore.getState().assets.find((candidate) => candidate.id === output.materializedAssetId);
    if (!asset) throw new Error("生成任务输出素材不存在");
    const result = parseBackendGenerationResult(task);
    if (asset.kind === "image") {
        const images = [...(result.images || [])];
        // materialize 已保存整个任务；画布按真实输出序号接收每张图及其素材绑定。
        for (const item of task.outputs?.length ? task.outputs : [output]) {
            const imageAsset = useAssetStore.getState().assets.find((candidate) => candidate.id === item.materializedAssetId);
            if (!imageAsset || imageAsset.kind !== "image") throw new Error("生成任务图片输出素材不存在");
            images[item.outputIndex] = {
                dataUrl: imageAsset.data.dataUrl || imageAsset.coverUrl,
                storageKey: imageAsset.data.storageKey,
                width: imageAsset.data.width,
                height: imageAsset.data.height,
                bytes: imageAsset.data.bytes,
                mimeType: imageAsset.data.mimeType,
            };
        }
        result.images = images;
    } else if (asset.kind === "video") {
        result.video = { dataUrl: asset.data.url, ...asset.data };
    } else if (asset.kind === "audio") {
        result.audio = { dataUrl: asset.data.url, ...asset.data };
    } else {
        throw new Error("生成任务输出素材类型不支持画布节点");
    }
    const { node: updatedNode, additionalNodes } = await buildGenerationTaskNodeResults(node, { ...task, resultJson: JSON.stringify(result) }, nodes);
    const stamp = (item: CanvasNodeData) => ({ ...item, metadata: applyGenerationConsumerEffect(item.metadata || {}, effectKey, (metadata) => metadata).value });
    const durableNode = stamp({ ...updatedNode, metadata: { ...updatedNode.metadata, assetId: updatedNode.metadata?.assetId || asset.id } });
    const durableChildren = additionalNodes.map(stamp);
    return {
        nodes: commitCanvasGenerationResult(nodes, node, durableNode, task.id, durableChildren),
        updated: true,
        nodeId: node.id,
        node: durableNode,
        additionalNodes: durableChildren,
    };
}

export function generationTaskOutputsApplied(node: CanvasNodeData, task: GenerationTask) {
    if (node.metadata?.taskId !== task.id || node.metadata.status !== "success" || !node.metadata.content) return false;
    if (generationTaskMode(task) !== "image") return true;
    const count = parseBackendGenerationResult(task).images?.length || 1;
    return node.metadata.generationOutputCount === count || (count > 1 && (node.metadata.batchChildIds?.length || 0) >= count);
}

export function shouldRecoverCanvasImageOutputs(node: CanvasNodeData) {
    return node.type === CanvasNodeType.Image && node.metadata?.status === "success" && Boolean(node.metadata.taskId)
        && node.metadata.generationOutputCount === undefined && !node.metadata.isBatchRoot && !node.metadata.batchRootId
        && /(?:midjourney|(?:^|::)mj-)/i.test(node.metadata.producedModel || node.metadata.model || "");
}

async function buildGenerationTaskNodeResults(node: CanvasNodeData, task: GenerationTask, nodes: CanvasNodeData[]) {
    const resultNode = await buildGenerationTaskNodeResult(node, task, nodes);
    const images = generationTaskMode(task) === "image" ? parseBackendGenerationResult(task).images || [] : [];
    if (images.length <= 1) return { node: resultNode, additionalNodes: [] as CanvasNodeData[] };
    const children: CanvasNodeData[] = [];
    for (let index = 0; index < images.length; index += 1) {
        const id = `${node.id}:task:${task.id}:image:${index}`;
        const existing = nodes.find((item) => item.id === id);
        if (existing) { children.push(existing); continue; }
        const child = await buildGenerationTaskNodeResult({ ...node, id, title: `${node.title} · ${index + 1}`, parentId: undefined }, task, nodes, index);
        children.push({
            ...child,
            position: imageGenerationChildPosition(resultNode.position, resultNode.width, child, index),
            metadata: {
                ...child.metadata,
                assetId: task.outputs?.find((output) => output.outputIndex === index)?.materializedAssetId,
                isBatchRoot: undefined, batchChildIds: undefined, primaryImageId: undefined, imageBatchExpanded: undefined,
                batchRootId: node.id, versionOfNodeId: undefined, versionLabel: undefined, versionPrimary: undefined,
                agentGenerationContinuation: undefined,
            },
        });
    }
    const primary = children.find((child) => child.id === node.metadata?.primaryImageId) || children[0];
    return {
        node: {
            ...resultNode,
            metadata: {
                ...resultNode.metadata,
                ...imageMetadata({
                    url: primary.metadata!.content!, storageKey: primary.metadata!.storageKey!,
                    width: primary.metadata!.naturalWidth!, height: primary.metadata!.naturalHeight!,
                    bytes: primary.metadata!.bytes || 0, mimeType: primary.metadata!.mimeType || "image/png",
                }),
                assetId: primary.metadata?.assetId,
                isBatchRoot: true,
                batchChildIds: children.map((child) => child.id),
                primaryImageId: primary.id,
                imageBatchExpanded: node.metadata?.imageBatchExpanded ?? false,
                generationOutputCount: images.length,
            },
        },
        additionalNodes: children,
    };
}

export async function syncGenerationTaskToCanvasStore(task: GenerationTask) {
    if (task.status !== "succeeded" || !task.projectId) return false;
    // 短剧任务使用业务项目 ID，不能拿它请求同名的画布项目。
    const domainProjectId = task.clientContext?.domainProjectId || generationTaskInput(task)?.metadata?.domainProjectId;
    if (domainProjectId === task.projectId || !generationTaskNodeId(task)) return false;
    const { loadCanvasProjectForEditing } = await import("@/services/user-data-sync");
    const project = await loadCanvasProjectForEditing(task.projectId);
    if (!project) return false;
    const node = findGenerationTaskNode(project.nodes, task);
    if (!node) return false;
    if (generationTaskOutputsApplied(node, task)) return false;
    const { node: updatedNode, additionalNodes } = await buildGenerationTaskNodeResults(node, task, project.nodes);
    const latest = useCanvasStore.getState().projects.find((item) => item.id === project.id);
    if (!latest?.nodes.some((item) => item.id === node.id)) return false;
    useCanvasStore.getState().updateProject(project.id, { nodes: commitCanvasGenerationResult(latest.nodes, node, updatedNode, task.id, additionalNodes) });
    return true;
}

function findGenerationTaskNode(nodes: CanvasNodeData[], task: GenerationTask, targetNodeId?: string) {
    const nodeId = targetNodeId || generationTaskNodeId(task);
    return nodeId ? nodes.find((node) => node.id === nodeId) : nodes.find((node) => node.metadata?.taskId === task.id);
}

function completedTaskMetadata(task: GenerationTask): CanvasNodeMetadata {
    return {
        taskId: task.id,
        taskStatus: task.status,
        taskProgress: typeof task.progress === "number" && Number.isFinite(task.progress) ? Math.max(0, Math.min(100, Math.round(task.progress))) : 100,
        taskStage: task.stage,
        taskMediaStage: task.mediaStage,
        taskCanRecoverMedia: task.canRecoverMedia,
        taskStartedAt: task.startedAt,
        taskCompletedAt: task.completedAt,
        taskDurationMs: task.startedAt && task.completedAt ? Math.max(0, Date.parse(task.completedAt) - Date.parse(task.startedAt)) : undefined,
        taskCreatedAt: task.createdAt || task.created_at,
        taskUpdatedAt: task.updatedAt || task.updated_at,
        taskBilling: task.billing ? { amountMicrocredits: task.billing.amountMicrocredits, status: task.billing.status } : undefined,
        errorDetails: undefined,
        generationErrorCode: undefined,
        failedPromptFingerprint: undefined,
    };
}
