import { nanoid } from "nanoid";

import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { canGenerateMediaInPlace, imageGenerationChildPosition } from "@/lib/canvas/canvas-generation-layout";
import { nodeSizeFromRatio } from "@/lib/canvas/canvas-node-size";
import { nextCanvasVersionLabel } from "@/lib/canvas/canvas-layout";
import { buildAudioGenerationMetadata, buildVideoGenerationMetadata, generationReferenceUrls, isGenerationCanceled, runCanvasGenerationTaskToConsumer } from "@/lib/canvas/canvas-project-generation";
import { canvasGenerationPromptMetadata } from "@/lib/canvas/canvas-generation-submission";
import { CONTENT_MODERATION_ERROR_CODE, generationFailureMetadata, type GenerationFailureMetadata } from "@/lib/generation-error";
import { CanvasNodeType, type CanvasNodeData, type Position } from "@/types/canvas";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

import type { CanvasGenerationExecution } from "./canvas-generation-executor-types";

const NODE_STATUS_LOADING = "loading" as const;
const NODE_STATUS_SUCCESS = "success" as const;
const NODE_STATUS_ERROR = "error" as const;
const NODE_STATUS_IDLE = "idle" as const;

/** 视频批量份数解析: 缺省/非法值一律回退 1，0 与负数不参与批量。 */
export function videoGenerationCountOf(sourceNode: CanvasNodeData | null | undefined): number {
    const raw = Number(sourceNode?.metadata?.videoGenerationCount);
    return Number.isFinite(raw) && raw > 1 ? Math.floor(raw) : 1;
}

/** 视频批量子节点两列网格定位(与图像 batch 同构，独立导出便于单测)。 */
export function videoBatchChildPositions(rootPosition: Position, rootWidth: number, childWidth: number, childHeight: number, count: number): Position[] {
    return Array.from({ length: Math.max(0, count) }, (_, index) => imageGenerationChildPosition(rootPosition, rootWidth, { width: childWidth, height: childHeight }, index));
}

/**
 * 视频 batch root 就地复用时排除与批量语义互斥/异族的字段：
 * 版本族字段（count>1 与版本族互斥，绝不入 batch root）、图像批量的遗留字段（复制粘贴来源可能携带）。
 */
export function stripNonVideoBatchFields(metadata: CanvasNodeData["metadata"]): CanvasNodeData["metadata"] {
    if (!metadata) return metadata;
    const next = { ...metadata };
    delete next.versionOfNodeId;
    delete next.versionLabel;
    delete next.versionPrimary;
    delete next.imageBatchExpanded;
    delete next.primaryImageId;
    delete next.batchFailedCount;
    // 失败/空置的旧 batch child 被选为新就地源时，悬挂的 batchRootId 会让 isHiddenBatchChild 把新 root 误判为隐藏。
    delete next.batchRootId;
    return next;
}

export async function executeVideoGeneration({
    nodeId,
    sourceNode,
    canvasNodes,
    canvasConnections,
    prompt,
    effectivePrompt,
    generationConfig,
    generationContext,
    controller,
    projectId,
    setNodes,
    setConnections,
    setSelectedNodeIds,
    setSelectedConnectionId,
    setDialogNodeId,
    startGenerationRequest,
    finishGenerationRequest,
    bindGenerationTask,
    applyGenerationTaskResult,
    registerPendingNodeIds,
    styleMetadata,
    skillMetadata,
    taskContext,
    retryContext,
    showError,
}: CanvasGenerationExecution) {
    const spec = nodeSizeFromRatio(generationConfig.size, NODE_DEFAULT_SIZE[CanvasNodeType.Video].width, NODE_DEFAULT_SIZE[CanvasNodeType.Video].height) || NODE_DEFAULT_SIZE[CanvasNodeType.Video];
    const batchCount = videoGenerationCountOf(sourceNode);
    if (batchCount > 1) {
        await executeVideoBatchGeneration({ batchCount, spec, nodeId, sourceNode, canvasConnections, prompt, effectivePrompt, generationConfig, generationContext, controller, projectId, setNodes, setConnections, setSelectedNodeIds, setSelectedConnectionId, setDialogNodeId, startGenerationRequest, finishGenerationRequest, bindGenerationTask, applyGenerationTaskResult, registerPendingNodeIds, styleMetadata, skillMetadata, editingTextNode: false, taskContext, retryContext, showError });
        return;
    }
    const reuseSourceNode = canGenerateMediaInPlace(sourceNode, CanvasNodeType.Video);
    const isExistingVideoNode = sourceNode?.type === CanvasNodeType.Video && Boolean(sourceNode.metadata?.content) && !reuseSourceNode;
    const videoId = reuseSourceNode ? nodeId : nanoid();
    const versionRootId = isExistingVideoNode && sourceNode ? sourceNode.metadata?.versionOfNodeId || sourceNode.id : undefined;
    const parent = sourceNode?.position || { x: 0, y: 0 };
    const videoGenerationMetadata = buildVideoGenerationMetadata(sourceNode, generationContext, generationConfig);
    const videoNode: CanvasNodeData = {
        id: videoId,
        type: CanvasNodeType.Video,
        title: effectivePrompt.slice(0, 32) || "Generated Video",
        position: reuseSourceNode ? sourceNode!.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y },
        width: reuseSourceNode ? sourceNode!.width : spec.width,
        height: reuseSourceNode ? sourceNode!.height : spec.height,
        metadata: {
            ...(reuseSourceNode ? sourceNode?.metadata || {} : {}),
            ...canvasGenerationPromptMetadata(prompt, effectivePrompt),
            status: NODE_STATUS_LOADING,
            errorDetails: undefined,
            generationErrorCode: undefined,
            resourceReloadAvailable: undefined,
            failedPromptFingerprint: undefined,
            model: generationConfig.model,
            size: generationConfig.size,
            seconds: generationConfig.videoSeconds,
            vquality: generationConfig.vquality,
            generateAudio: generationConfig.videoGenerateAudio,
            watermark: generationConfig.videoWatermark,
            references: generationReferenceUrls(generationContext),
            ...videoGenerationMetadata,
            ...styleMetadata,
            ...skillMetadata,
        },
    };
    registerPendingNodeIds([videoId]);
    // 待生成版本先加入版本族，但只有成功结果才能替换当前主版本。
    setNodes((current) => {
        if (reuseSourceNode) return current.map((node) => (node.id === nodeId ? { ...node, ...videoNode } : node));
        if (!isExistingVideoNode || !sourceNode) return [...current.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } } : node)), videoNode];
        const rootId = versionRootId!;
        const nextLabel = nextCanvasVersionLabel(rootId, current);
        const hasPrimaryVersion = current.some((node) => (node.metadata?.versionOfNodeId || node.id) === rootId && node.metadata?.versionPrimary);
        return [
            ...current.map((node) => {
                if ((node.metadata?.versionOfNodeId || node.id) !== rootId) return node;
                return { ...node, metadata: { ...node.metadata, versionOfNodeId: rootId, versionLabel: node.metadata?.versionLabel || "A", versionPrimary: node.metadata?.versionPrimary || (!hasPrimaryVersion && node.id === sourceNode.id), status: node.id === nodeId ? NODE_STATUS_SUCCESS : node.metadata?.status } };
            }),
            { ...videoNode, metadata: { ...videoNode.metadata, versionOfNodeId: rootId, versionLabel: nextLabel, versionPrimary: false } },
        ];
    });
    // 重新生成已有视频时，新节点继承源视频的上游连接，与源视频保持并行关系，而不是作为其下游子节点。
    if (!reuseSourceNode) {
        setConnections((current) => {
            if (!isExistingVideoNode) return [...current, { id: nanoid(), fromNodeId: nodeId, toNodeId: videoId }];
            return [...current, ...canvasConnections.filter((connection) => connection.toNodeId === nodeId).map((connection) => ({ ...connection, id: nanoid(), toNodeId: videoId }))];
        });
    }

    startGenerationRequest(videoId, nodeId, nodeId, controller);
    try {
        await runCanvasGenerationTaskToConsumer(
            {
                projectId,
                nodeId: videoId,
                ...retryContext,
                mode: "video",
                prompt: effectivePrompt,
                config: generationConfig,
                referenceImages: generationContext.referenceImages,
                referenceVideos: generationContext.referenceVideos,
                referenceAudios: generationContext.referenceAudios,
                signal: controller.signal,
                metadata: {
                    sourceNodeId: nodeId,
                    ...taskContext,
                    resolvedCharacterVersions: generationContext.resolvedCharacterVersions,
                    resolvedCharacterVoices: generationContext.resolvedCharacterVoices,
                    promptTemplateOperation: sourceNode?.metadata?.promptTemplateOperation,
                    promptTemplateVariables: sourceNode?.metadata?.promptTemplateVariables,
                    ...videoGenerationMetadata,
                    ...styleMetadata,
                    ...skillMetadata,
                },
            },
            {
                bindTask: (task) => bindGenerationTask(videoId, task),
                consumeTask: (task) => applyGenerationTaskResult(videoId, task),
            },
        );
    } finally {
        finishGenerationRequest(videoId, controller);
    }
}

/**
 * 视频份数>1 批量提交：与图像 batch 同构（root+子节点+并行任务+失败计数），但有三处视频特有约束：
 * 1) 与版本族互斥——count>1 时不写 versionOfNodeId/versionLabel/versionPrimary，也不做 count=1 的版本提升；
 * 2) 首个成功子节点提升为 root 主内容时 root 保持自身尺寸不 refit（视频几何由 S07 比例守卫管）；
 * 3) root 就地复用（空视频节点）时继承源节点上游不存在，新 root 建在源右侧。
 */
async function executeVideoBatchGeneration({
    batchCount,
    spec,
    nodeId,
    sourceNode,
    canvasConnections,
    prompt,
    effectivePrompt,
    generationConfig,
    generationContext,
    controller,
    projectId,
    setNodes,
    setConnections,
    setSelectedNodeIds,
    setSelectedConnectionId,
    setDialogNodeId,
    startGenerationRequest,
    finishGenerationRequest,
    bindGenerationTask,
    applyGenerationTaskResult,
    registerPendingNodeIds,
    styleMetadata,
    skillMetadata,
    taskContext,
    retryContext,
    showError,
}: Omit<CanvasGenerationExecution, "canvasNodes"> & { batchCount: number; spec: { width: number; height: number } }) {
    const videoGenerationMetadata = buildVideoGenerationMetadata(sourceNode, generationContext, generationConfig);
    const parent = sourceNode?.position || { x: 0, y: 0 };
    const isEmptyVideoNode = Boolean(sourceNode && sourceNode.type === CanvasNodeType.Video && !sourceNode.metadata?.content);
    const rootId = isEmptyVideoNode ? nodeId! : nanoid();
    const childIds = Array.from({ length: batchCount }, () => nanoid());
    const rootPosition = isEmptyVideoNode && sourceNode ? sourceNode.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y };
    // 子节点列偏移必须用 root 实际宽度：in-place 时 root 沿用源节点几何，宽于/窄于 spec 时用 spec 会让首列与 root 重叠或脱节。
    const childPositions = videoBatchChildPositions(rootPosition, isEmptyVideoNode && sourceNode ? sourceNode.width : spec.width, spec.width, spec.height, batchCount);
    const sharedGenerationMetadata = {
        ...canvasGenerationPromptMetadata(prompt, effectivePrompt),
        model: generationConfig.model,
        size: generationConfig.size,
        seconds: generationConfig.videoSeconds,
        vquality: generationConfig.vquality,
        generateAudio: generationConfig.videoGenerateAudio,
        watermark: generationConfig.videoWatermark,
        references: generationReferenceUrls(generationContext),
        ...videoGenerationMetadata,
        ...styleMetadata,
        ...skillMetadata,
        generationErrorCode: undefined,
        resourceReloadAvailable: undefined,
        failedPromptFingerprint: undefined,
    };
    const rootNode: CanvasNodeData = {
        id: rootId,
        type: CanvasNodeType.Video,
        title: effectivePrompt.slice(0, 32) || "Generated Video",
        position: rootPosition,
        width: isEmptyVideoNode && sourceNode ? sourceNode.width : spec.width,
        height: isEmptyVideoNode && sourceNode ? sourceNode.height : spec.height,
        metadata: {
            // 就地复用继承源节点元数据，但必须摘除与批量语义互斥/异族的字段：
            // 版本族（count>1 与版本族互斥）、图像批量的遗留字段（复制粘贴来源可能携带）。
            ...stripNonVideoBatchFields(isEmptyVideoNode ? sourceNode?.metadata || {} : {}),
            ...sharedGenerationMetadata,
            status: NODE_STATUS_LOADING,
            errorDetails: undefined,
            isBatchRoot: true,
            batchChildIds: childIds,
            batchFailedCount: 0,
            batchExpanded: true,
            primaryVideoId: undefined,
            content: isEmptyVideoNode ? "" : undefined,
        },
    };
    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
        id,
        type: CanvasNodeType.Video,
        title: effectivePrompt.slice(0, 32) || "Generated Video",
        position: childPositions[index],
        width: spec.width,
        height: spec.height,
        metadata: {
            ...sharedGenerationMetadata,
            status: NODE_STATUS_LOADING,
            errorDetails: undefined,
            batchRootId: rootId,
        },
    }));
    const batchConnections = [
        ...(isEmptyVideoNode ? [] : [{ id: nanoid(), fromNodeId: nodeId!, toNodeId: rootId }]),
        ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: rootId, toNodeId: childId })),
    ];
    registerPendingNodeIds(isEmptyVideoNode ? childIds : [rootId, ...childIds]);
    // 空视频节点就地转为 batch root（沿用源节点几何）；已有内容源节点保留原内容不动（是来源不是目标）。
    // 就地分支同样必须追加 childNodes：root 复用原节点 id，但批量子节点是新实体，漏加会让任务消费链找不到节点。
    setNodes((current) => {
        const rooted = current.map((node) => (node.id === rootId ? rootNode : node));
        // in-place 时 rootNode 复用原节点（已在 rooted 中）；非 in-place 时 rootNode 是新实体需追加。
        const withRoot = isEmptyVideoNode ? rooted : [...rooted, rootNode];
        return [...withRoot, ...childNodes];
    });
    setConnections((current) => {
        // 非空已有视频源：root 继承源节点的上游连线（与 count=1 的版本并行语义同构）。
        const inherited = isEmptyVideoNode
            ? []
            : canvasConnections.filter((connection) => connection.toNodeId === nodeId).map((connection) => ({ ...connection, id: nanoid(), toNodeId: rootId }));
        return [...current, ...inherited, ...batchConnections];
    });
    if (!isEmptyVideoNode) {
        setSelectedNodeIds(new Set([rootId]));
        setSelectedConnectionId(null);
        setDialogNodeId(rootId);
    }
    childIds.forEach((targetId) => startGenerationRequest(targetId, nodeId!, nodeId!, controller));
    startGenerationRequest(rootId, nodeId!, nodeId!, controller);
    let hasSuccess = false;
    let hasFailure = false;
    let failureCount = 0;
    let representativeFailure: GenerationFailureMetadata | undefined;
    await Promise.all(
        childIds.map(async (targetId) => {
            try {
                await runCanvasGenerationTaskToConsumer(
                    {
                        projectId,
                        nodeId: targetId,
                        ...retryContext,
                        mode: "video",
                        prompt: effectivePrompt,
                        config: generationConfig,
                        referenceImages: generationContext.referenceImages,
                        referenceVideos: generationContext.referenceVideos,
                        referenceAudios: generationContext.referenceAudios,
                        signal: controller.signal,
                        metadata: {
                            sourceNodeId: nodeId,
                            ...taskContext,
                            resolvedCharacterVersions: generationContext.resolvedCharacterVersions,
                            resolvedCharacterVoices: generationContext.resolvedCharacterVoices,
                            promptTemplateOperation: sourceNode?.metadata?.promptTemplateOperation,
                            promptTemplateVariables: sourceNode?.metadata?.promptTemplateVariables,
                            ...videoGenerationMetadata,
                            ...styleMetadata,
                            ...skillMetadata,
                        },
                    },
                    {
                        bindTask: (task) => bindGenerationTask(targetId, task),
                        consumeTask: (task) => applyGenerationTaskResult(targetId, task),
                    },
                );
                setNodes((current) => {
                    const child = current.find((node) => node.id === targetId);
                    const root = current.find((node) => node.id === rootId);
                    if (!child?.metadata?.content || !root || root.metadata?.primaryVideoId) return current;
                    // root 不 refit 尺寸：视频比例由 S07 几何守卫管，批量提升只接内容。
                    const updated = current.map((node) =>
                        node.id === rootId
                            ? {
                                  ...node,
                                  metadata: {
                                      ...node.metadata,
                                      content: child.metadata?.content,
                                      storageKey: child.metadata?.storageKey,
                                      mimeType: child.metadata?.mimeType,
                                      bytes: child.metadata?.bytes,
                                      naturalWidth: child.metadata?.naturalWidth,
                                      naturalHeight: child.metadata?.naturalHeight,
                                      hasAudio: child.metadata?.hasAudio,
                                      assetId: child.metadata?.assetId,
                                      primaryVideoId: targetId,
                                      status: NODE_STATUS_SUCCESS,
                                  },
                              }
                            : node,
                    );
                    if (projectId) useCanvasStore.getState().updateProject(projectId, { nodes: updated });
                    return updated;
                });
                hasSuccess = true;
                return true;
            } catch (error) {
                if (isGenerationCanceled(error)) return false;
                const failure = generationFailureMetadata(error, effectivePrompt);
                if (!representativeFailure || failure.generationErrorCode === CONTENT_MODERATION_ERROR_CODE) representativeFailure = failure;
                hasFailure = true;
                failureCount += 1;
                setNodes((current) => {
                    const next = current.map((node) => (node.id === targetId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, ...failure } } : node));
                    if (projectId) useCanvasStore.getState().updateProject(projectId, { nodes: next });
                    return next;
                });
                return false;
            } finally {
                finishGenerationRequest(targetId, controller);
            }
        }),
    );
    finishGenerationRequest(rootId, controller);
    if (controller.signal.aborted) {
        setNodes((current) => {
            const removedIds = current.filter((node) => childIds.includes(node.id) && !node.metadata?.content).map((node) => node.id);
            const removed = new Set(removedIds);
            const next = current
                .filter((node) => !removed.has(node.id))
                .map((node) => {
                    if (node.id !== rootId) return node;
                    const remaining = (node.metadata?.batchChildIds || []).filter((id) => {
                        if (removed.has(id)) return false;
                        const child = current.find((item) => item.id === id);
                        return Boolean(child?.metadata?.content);
                    });
                    const hasContent = Boolean(node.metadata?.content);
                    const metadata = { ...node.metadata };
                    if (remaining.length > 1) {
                        metadata.batchChildIds = remaining;
                        metadata.batchFailedCount = remaining.filter((id) => current.find((item) => item.id === id)?.metadata?.status === NODE_STATUS_ERROR).length;
                    } else {
                        // 仅剩单子节点时批量语义收缩，保留内容子节点为独立节点。
                        delete metadata.isBatchRoot;
                        delete metadata.batchChildIds;
                        delete metadata.batchFailedCount;
                        delete metadata.batchExpanded;
                        if (!hasContent) {
                            const survivor = current.find((item) => item.id === remaining[0]);
                            if (survivor?.metadata?.content) {
                                // 与 primary 提升路径字段对齐，避免缺尺寸/字节数导致素材层拒绝。
                                metadata.content = survivor.metadata.content;
                                metadata.storageKey = survivor.metadata.storageKey;
                                metadata.mimeType = survivor.metadata.mimeType;
                                metadata.bytes = survivor.metadata.bytes;
                                metadata.naturalWidth = survivor.metadata.naturalWidth;
                                metadata.naturalHeight = survivor.metadata.naturalHeight;
                                metadata.hasAudio = survivor.metadata.hasAudio;
                                metadata.primaryVideoId = undefined;
                                metadata.status = NODE_STATUS_SUCCESS;
                            }
                        }
                    }
                    if (!hasContent && !remaining.length) metadata.status = NODE_STATUS_IDLE;
                    return { ...node, metadata };
                })
                .map((node) => {
                    if (!removedIds.length || !childIds.includes(node.id) || !removed.has(node.id)) return node;
                    const metadata = { ...node.metadata };
                    delete metadata.batchRootId;
                    return { ...node, metadata };
                });
            if (projectId) useCanvasStore.getState().updateProject(projectId, { nodes: next });
            return next;
        });
        return;
    }
    if (hasFailure) showError(hasSuccess ? "部分视频生成失败" : "全部视频生成失败");
    setNodes((current) => {
        const next = current.map((node) => {
            if (node.id !== rootId) return node;
            return {
                ...node,
                metadata: {
                    ...node.metadata,
                    status: hasSuccess ? NODE_STATUS_SUCCESS : NODE_STATUS_ERROR,
                    batchFailedCount: failureCount,
                    ...(hasSuccess ? { errorDetails: undefined, generationErrorCode: undefined, failedPromptFingerprint: undefined } : representativeFailure || { errorDetails: "全部视频生成失败" }),
                },
            };
        });
        if (projectId) useCanvasStore.getState().updateProject(projectId, { nodes: next });
        return next;
    });
}

export async function executeAudioGeneration({
    nodeId,
    sourceNode,
    prompt,
    effectivePrompt,
    generationConfig,
    generationContext,
    controller,
    projectId,
    setNodes,
    setConnections,
    startGenerationRequest,
    finishGenerationRequest,
    bindGenerationTask,
    applyGenerationTaskResult,
    registerPendingNodeIds,
    taskContext,
    skillMetadata,
    retryContext,
}: CanvasGenerationExecution) {
    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
    const isEmptyAudioNode = sourceNode?.type === CanvasNodeType.Audio && !sourceNode.metadata?.content;
    const isExistingAudioNode = sourceNode?.type === CanvasNodeType.Audio && Boolean(sourceNode.metadata?.content);
    const audioId = isEmptyAudioNode ? nodeId : nanoid();
    const parent = sourceNode?.position || { x: 0, y: 0 };
    const audioNode: CanvasNodeData = {
        id: audioId,
        type: CanvasNodeType.Audio,
        title: effectivePrompt.slice(0, 32) || "Generated Audio",
        position: isEmptyAudioNode ? sourceNode.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y + ((sourceNode?.height || spec.height) - spec.height) / 2 },
        width: isEmptyAudioNode ? sourceNode.width : spec.width,
        height: isEmptyAudioNode ? sourceNode.height : spec.height,
        metadata: { ...canvasGenerationPromptMetadata(prompt, effectivePrompt), status: NODE_STATUS_LOADING, ...buildAudioGenerationMetadata(generationConfig), ...skillMetadata },
    };
    registerPendingNodeIds([audioId]);
    setNodes((current) =>
        isEmptyAudioNode ? current.map((node) => (node.id === nodeId ? { ...node, ...audioNode } : node)) : [...current.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } } : node)), audioNode],
    );
    if (!isEmptyAudioNode && !isExistingAudioNode) setConnections((current) => [...current, { id: nanoid(), fromNodeId: nodeId, toNodeId: audioId }]);

    startGenerationRequest(audioId, nodeId, nodeId, controller);
    try {
        await runCanvasGenerationTaskToConsumer(
            {
                projectId,
                nodeId: audioId,
                ...retryContext,
                mode: "audio",
                prompt: effectivePrompt,
                config: generationConfig,
                signal: controller.signal,
                metadata: { sourceNodeId: nodeId, ...taskContext, resolvedCharacterVersions: generationContext.resolvedCharacterVersions, resolvedCharacterVoiceKey: generationContext.resolvedCharacterVoices[0]?.voiceKey, ...skillMetadata },
            },
            {
                bindTask: (task) => bindGenerationTask(audioId, task),
                consumeTask: (task) => applyGenerationTaskResult(audioId, task),
            },
        );
    } finally {
        finishGenerationRequest(audioId, controller);
    }
}
