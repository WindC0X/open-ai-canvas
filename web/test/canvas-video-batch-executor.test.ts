import { describe, expect, mock, test } from "bun:test";

import type { CanvasNodeData } from "@/types/canvas";
import { CanvasNodeType } from "@/types/canvas";

type Behavior = "success" | "fail" | "cancel";
// 行为表在 executor submit 完成后（首个任务启动前）由用例填充；stub 启动时读取。
const childBehavior = new Map<string, Behavior>();

// bun test 同进程共享模块注册表：mock 必须保留真实模块的全部导出，否则泄漏给
// 之后加载的其他测试文件（如 canvas-model-policy 依赖 resolveCanvasGenerationModel）。
const actualGeneration = await import("@/lib/canvas/canvas-project-generation");
const actualSubmission = await import("@/lib/canvas/canvas-generation-submission");
void mock.module("@/lib/canvas/canvas-project-generation", () => ({
    ...actualGeneration,
    runCanvasGenerationTaskToConsumer: async (input: { nodeId: string }, dependencies: { consumeTask: (task: never) => Promise<void> | void }) => {
        // executor 在 Promise.all 的 map 回调里同步启动任务；让出微任务，
        // 保证测试用例在 submit 同步段之后注册的行为表先于 stub 读表落地。
        await Promise.resolve();
        const behavior = childBehavior.get(input.nodeId) || "success";
        if (behavior === "cancel") {
            const error = new Error("canceled");
            (error as { name: string }).name = "GenerationCanceled";
            throw error;
        }
        if (behavior === "fail") throw new Error("上游失败");
        // 真实链路：任务成功后经 consumeTask 落位节点内容。
        await dependencies.consumeTask({ id: input.nodeId } as never);
        return undefined;
    },
    isGenerationCanceled: (error: unknown) => Boolean(error && typeof error === "object" && (error as { name?: string }).name === "GenerationCanceled"),
    buildVideoGenerationMetadata: () => ({}),
    buildAudioGenerationMetadata: () => ({}),
    generationReferenceUrls: () => [],
}));

void mock.module("@/lib/canvas/canvas-generation-submission", () => ({
    ...actualSubmission,
}));

void mock.module("@/stores/canvas/use-canvas-store", () => ({
    useCanvasStore: { getState: () => ({ updateProject: () => {} }) },
}));

const { executeVideoGeneration, stripNonVideoBatchFields } = await import("@/pages/canvas/canvas-media-generation-executors");

function sourceNode(metadata: CanvasNodeData["metadata"]): CanvasNodeData {
    return { id: "src", type: CanvasNodeType.Video, title: "t", position: { x: 0, y: 0 }, width: 480, height: 270, metadata };
}

async function runBatch(sourceMetadata: CanvasNodeData["metadata"], options: { abort?: boolean; sourceWidth?: number; behaviors?: (childIds: string[]) => void } = {}) {
    childBehavior.clear();
    let nodes: CanvasNodeData[] = [sourceNode(sourceMetadata)];
    if (options.sourceWidth) nodes[0] = { ...nodes[0], width: options.sourceWidth };
    const setNodes = (updater: (current: CanvasNodeData[]) => CanvasNodeData[]) => {
        nodes = updater(nodes);
    };
    const controller = new AbortController();
    if (options.abort) controller.abort();
    const execution = {
        nodeId: "src",
        sourceNode: nodes[0],
        canvasNodes: nodes,
        canvasConnections: [],
        prompt: "p",
        effectivePrompt: "p",
        generationConfig: { count: "3", model: "m", size: "16:9", videoSeconds: "5" },
        generationContext: { referenceImages: [], referenceVideos: [], referenceAudios: [], textCount: 0, imageCount: 0, videoCount: 0, audioCount: 0 },
        controller,
        projectId: undefined,
        setNodes,
        setConnections: (updater: (current: never[]) => never[]) => updater([]),
        setSelectedNodeIds: () => {},
        setSelectedConnectionId: () => {},
        setDialogNodeId: () => {},
        startGenerationRequest: () => {},
        finishGenerationRequest: () => {},
        bindGenerationTask: () => {},
        applyGenerationTaskResult: (nodeId: string) => {
            setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, content: `file://${nodeId}`, status: "success" } } : node)));
        },
        registerPendingNodeIds: () => {},
        styleMetadata: {},
        skillMetadata: {},
        editingTextNode: false,
        taskContext: {},
        retryContext: undefined,
        showError: () => {},
    };
    // executor 的 submit 序列在首个 await 前同步完成：先启动编排，取回 childIds 再填行为表。
    let childIds: string[] = [];
    const runner = executeVideoGeneration(execution as never);
    const rootAfterSubmit = nodes.find((node) => node.id === "src")!;
    childIds = (rootAfterSubmit.metadata?.batchChildIds || []).filter((id) => nodes.some((node) => node.id === id));
    options.behaviors?.(childIds);
    await runner;
    return { nodes, root: nodes.find((node) => node.id === "src")!, childIds };
}

describe("executeVideoGeneration 批量编排", () => {
    test("空视频节点就地 batch：childNodes 必须进入节点集（回归：漏加致消费找不到节点）", async () => {
        const { nodes, root, childIds } = await runBatch({ videoGenerationCount: 3 });
        expect(childIds).toHaveLength(3);
        for (const id of childIds) expect(nodes.some((node) => node.id === id)).toBe(true);
        // 就地复用：root 保持源节点 id 与几何。
        expect(root.id).toBe("src");
        expect(root.width).toBe(480);
    });

    test("全部成功：首个成功子节点提升为 root 主内容且 primary 只提升一次", async () => {
        const { root, childIds } = await runBatch({ videoGenerationCount: 3 }, { behaviors: (ids) => ids.forEach((id) => childBehavior.set(id, "success")) });
        expect(root.metadata?.status).toBe("success");
        expect(childIds).toContain(root.metadata?.primaryVideoId);
        expect(root.metadata?.content).toBe(`file://${root.metadata?.primaryVideoId}`);
    });

    test("部分失败：单失败不拖垮整批，失败计数=1，root 仍 success", async () => {
        const { root, childIds } = await runBatch({
            videoGenerationCount: 3,
        }, { behaviors: (ids) => { childBehavior.set(ids[0], "fail"); childBehavior.set(ids[1], "success"); childBehavior.set(ids[2], "success"); } });
        expect(root.metadata?.status).toBe("success");
        expect(root.metadata?.batchFailedCount).toBe(1);
        expect(root.metadata?.primaryVideoId).toBeDefined();
    });

    test("abort 收缩：无内容子节点被清理，root 摘批量语义回到 idle", async () => {
        const { nodes, root, childIds } = await runBatch({ videoGenerationCount: 3 }, { abort: true, behaviors: (ids) => ids.forEach((id) => childBehavior.set(id, "cancel")) });
        // 全部取消 → children 移除，batch 语义收缩。
        for (const id of childIds) expect(nodes.some((node) => node.id === id)).toBe(false);
        expect(root.metadata?.isBatchRoot).toBeUndefined();
        expect(root.metadata?.batchChildIds).toBeUndefined();
        expect(root.metadata?.status).toBe("idle");
    });

    test("宽源节点就地 batch：首列偏移按源宽度而非 spec，子节点不与 root 重叠", async () => {
        // 源 900 宽 > spec 480：旧实现用 spec.width 偏移，首列 x = 0+480+24 会落进 root 体内。
        const { nodes, root, childIds } = await runBatch(
            { videoGenerationCount: 3 },
            { sourceWidth: 900, behaviors: (ids) => ids.forEach((id) => childBehavior.set(id, "cancel")) },
        );
        const firstChild = nodes.find((node) => node.id === childIds[0])!;
        expect(root.width).toBe(900);
        expect(firstChild.position.x).toBeGreaterThan(root.position.x + root.width);
    });

    test("count>1 继承清理：版本族与图像批量字段不进入 batch root", async () => {
        const { root } = await runBatch({ videoGenerationCount: 3, versionOfNodeId: "vroot", versionLabel: "B", versionPrimary: true, imageBatchExpanded: true, primaryImageId: "img1" });
        expect(root.metadata?.versionOfNodeId).toBeUndefined();
        expect(root.metadata?.versionLabel).toBeUndefined();
        expect(root.metadata?.versionPrimary).toBeUndefined();
        expect(root.metadata?.imageBatchExpanded).toBeUndefined();
        expect(root.metadata?.primaryImageId).toBeUndefined();
        expect(root.metadata?.isBatchRoot).toBe(true);
    });
});

describe("stripNonVideoBatchFields", () => {
    test("摘除版本族与图像批量遗留字段，保留其余元数据", () => {
        const metadata = stripNonVideoBatchFields({
            versionOfNodeId: "vroot",
            versionLabel: "B",
            versionPrimary: true,
            imageBatchExpanded: true,
            primaryImageId: "img1",
            batchFailedCount: 2,
            batchRootId: "old-parent",
            prompt: "keep",
            model: "keep-model",
        });
        expect(metadata?.versionOfNodeId).toBeUndefined();
        expect(metadata?.versionLabel).toBeUndefined();
        expect(metadata?.versionPrimary).toBeUndefined();
        expect(metadata?.imageBatchExpanded).toBeUndefined();
        expect(metadata?.primaryImageId).toBeUndefined();
        expect(metadata?.batchFailedCount).toBeUndefined();
        expect(metadata?.batchRootId).toBeUndefined();
        expect(metadata?.prompt).toBe("keep");
        expect(metadata?.model).toBe("keep-model");
    });
});
