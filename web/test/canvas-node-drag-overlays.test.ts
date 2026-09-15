import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

const projectSource = readFileSync(resolve(import.meta.dir, "../src/pages/canvas/project.tsx"), "utf8");
const selectionControllerSource = readFileSync(resolve(import.meta.dir, "../src/pages/canvas/use-canvas-selection-controller.ts"), "utf8");

describe("canvas node drag overlays", () => {
    test("hides floating editors and selection controls for the whole drag preview", () => {
        expect(projectSource).toContain("const isCanvasNodeMoving = isNodeDragging || Boolean(dragPreview?.nodeIds.size);");
        // 拖拽时隐藏浮层编辑器的核心语义; 微供给重构后目标节点为 displayPanelNode(dialog 优先/hover 回落), 断言锁移动门控与 Drawing 排除。
        expect(projectSource).toContain("!isCanvasNodeMoving");
        expect(projectSource).toContain("type !== CanvasNodeType.Drawing");
        expect(projectSource).not.toContain("angleNode?.metadata?.content && !isCanvasNodeMoving");
        expect(projectSource).toContain("emotionNode?.metadata?.content && !isCanvasNodeMoving");
        expect(projectSource).toContain("selectedNodeBounds && !selectionBox && !isCanvasNodeMoving");
        // 微供给重构: 工具栏由 level 驱动显隐(node 仅 emotion 时置 null 强制隐藏), 拖拽/设置气泡开为 guard 输入。
        expect(projectSource).toContain("node={emotionNodeId ? null : instance.node}");
        // 挂件化(09-15 任务): composer 槽位仅 selected; 工具栏双实例(selected+hover)保留。
        expect(projectSource).toContain("{ node: hoverToolbarNode, level: hoverToolbarLevel }");
        // settingsOpen 工具栏 guard 已退役(9fbcdf4d): 参数气泡开由 settingsBubbleOpen 供 composer selfHover。
        expect(projectSource).toContain("settingsBubbleOpen: settingsBubbleNodeId === selectedPanelNode.id");
        expect(projectSource).toContain("onNodeDragEnd: handleNodeDragEnd");
        expect(projectSource).toContain("setDialogNodeId(node.id);");
        expect(selectionControllerSource).toContain("if (clickedNodeId) onNodeDragEnd?.(clickedNodeId);");
    });
});
