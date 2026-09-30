import { describe, expect, mock, test } from "bun:test";

import type { GenerationTask } from "@/services/api/task-center";
import { fitNodeSize } from "@/lib/canvas/canvas-node-size";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

// bun test 同进程共享模块注册表：mock 必须保留真实模块的全部导出，且消费方经动态 import 在
// mock 之后加载（沿用 canvas-video-batch-executor 防泄漏惯例）。
const actualImageStorage = await import("@/services/image-storage");
void mock.module("@/services/image-storage", () => ({
    ...actualImageStorage,
    resolveImageUrl: async (_storageKey?: string, fallback = "") => fallback || "blob:outpaint-test",
    uploadImage: async () => ({ url: "blob:outpaint-test", storageKey: "image:outpaint-test", width: 896, height: 1200, bytes: 1, mimeType: "image/png" }),
}));
const { buildGenerationTaskNodeResult } = await import("@/lib/canvas/canvas-generation-task-sync");

// 2026-09-29 用户真机抽验复现（twin 画布 6_Jr-mME-BD-1oLBtVB5T）：源图 816×1088 → 扩图提交
// 1003×1275（nano-banana-2 · a6api）→ 实返 896×1200，log 域漂移 0.0522（>0.02 角标亮）。
// 裁决②a 修订：mismatch 命中时提交框合同让位"结果即事实"，节点按实返图比例重算。
function outpaintNode(metadata: Partial<CanvasNodeData["metadata"]> = {}): CanvasNodeData {
    return {
        id: "node-1",
        type: CanvasNodeType.Image,
        title: "扩图",
        position: { x: 0, y: 0 },
        width: 1003,
        height: 1275,
        metadata: { generationType: "edit", manualSize: true, status: "generating", prompt: "扩图", ...metadata },
    };
}

function outpaintTask(size: string, image: { width: number; height: number }): GenerationTask {
    return {
        id: "task-1",
        type: "canvas_image",
        status: "succeeded",
        prompt: "扩图",
        attempts: 1,
        createdAt: "",
        updatedAt: "",
        inputJson: JSON.stringify({ mode: "image", metadata: { nodeId: "node-1", edit: "outpaint" }, config: { size } }),
        resultJson: JSON.stringify({ mode: "image", images: [{ dataUrl: "data:image/png;base64,iVBORw0KGgo=", storageKey: "image:outpaint-result", width: image.width, height: image.height }] }),
    };
}

describe("扩图画幅偏差节点尺寸（2026-09-29 裁决②a 修订）", () => {
    test("偏差场景：mismatch 命中时节点按实返图比例重算（结果即事实），角标写入", async () => {
        const node = outpaintNode();
        const updated = await buildGenerationTaskNodeResult(node, outpaintTask("1003x1275", { width: 896, height: 1200 }), [node]);
        const expected = fitNodeSize(896, 1200);
        expect(updated.width).toBe(expected.width);
        expect(updated.height).toBe(expected.height);
        expect(Math.abs(updated.width / updated.height - 896 / 1200)).toBeLessThan(0.002);
        expect(updated.metadata?.outpaintSizeMismatch).toEqual({ submitted: "1003x1275", actual: "896x1200" });
    });

    test("非偏差：manualSize 提交框保留行为回归（零改动）", async () => {
        const node = outpaintNode();
        const updated = await buildGenerationTaskNodeResult(node, outpaintTask("1003x1275", { width: 1003, height: 1275 }), [node]);
        expect(updated.width).toBe(1003);
        expect(updated.height).toBe(1275);
        expect(updated.metadata?.outpaintSizeMismatch).toBeUndefined();
    });

    test("人工尺寸保护：userResized + 偏差仍保持现框（让位的只有提交框合同）", async () => {
        const node = outpaintNode({ userResized: true });
        const updated = await buildGenerationTaskNodeResult(node, outpaintTask("1003x1275", { width: 896, height: 1200 }), [node]);
        expect(updated.width).toBe(1003);
        expect(updated.height).toBe(1275);
        expect(updated.metadata?.outpaintSizeMismatch).toEqual({ submitted: "1003x1275", actual: "896x1200" });
    });
});
