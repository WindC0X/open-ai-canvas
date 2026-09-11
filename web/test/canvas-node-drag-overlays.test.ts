import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

const projectSource = readFileSync(resolve(import.meta.dir, "../src/pages/canvas/project.tsx"), "utf8");
const selectionControllerSource = readFileSync(resolve(import.meta.dir, "../src/pages/canvas/use-canvas-selection-controller.ts"), "utf8");

describe("canvas node drag overlays", () => {
    test("hides floating editors and selection controls for the whole drag preview", () => {
        expect(projectSource).toContain("const isCanvasNodeMoving = isNodeDragging || Boolean(dragPreview?.nodeIds.size);");
        // 拖拽时隐藏浮层编辑器的核心语义; 上游新增 fileUpload/Script/Panorama 排除项, 断言只锁 Drawing 排除与移动门控。
        expect(projectSource).toContain("dialogNode.type !== CanvasNodeType.Drawing");
        expect(projectSource).toContain("!selectionBox && !isCanvasNodeMoving");
        expect(projectSource).not.toContain("angleNode?.metadata?.content && !isCanvasNodeMoving");
        expect(projectSource).toContain("emotionNode?.metadata?.content && !isCanvasNodeMoving");
        expect(projectSource).toContain("selectedNodeBounds && !selectionBox && !isCanvasNodeMoving");
        expect(projectSource).toContain("node={isCanvasNodeMoving || nodeImageSettingsOpen || emotionNodeId ? null : toolbarNode}");
        expect(projectSource).toContain("onNodeDragEnd: handleNodeDragEnd");
        expect(projectSource).toContain("setDialogNodeId(node.id);");
        expect(selectionControllerSource).toContain("if (clickedNodeId) onNodeDragEnd?.(clickedNodeId);");
    });
});
