import { describe, expect, test } from "bun:test";
import { canFrameContain, canFolderContain, getCollapsedParentFrame, isNodeHiddenByCollapsedFrame, resolveFrameConnection } from "@/lib/canvas/canvas-frame";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/types/canvas";

function frame(id: string, collapsed: boolean, folder = false): CanvasNodeData {
    return {
        id, type: CanvasNodeType.Frame, title: id,
        position: { x: 0, y: 0 }, width: 800, height: 600,
        metadata: {
            frame: { collapsed, expandedWidth: 800, expandedHeight: 600 },
            ...(folder ? { folder: { style: "glass" as const, createdAt: "2026-08-20T00:00:00.000Z" } } : {}),
        },
    };
}
function node(id: string, type: CanvasNodeType, parentId?: string): CanvasNodeData {
    return { id, type, title: id, position: { x: 10, y: 10 }, width: 100, height: 100,
             metadata: { content: "data:image/png;base64,AA==" }, ...(parentId ? { parentId } : {}) };
}
function conn(from: string, to: string): CanvasConnection {
    return { id: `c-${from}-${to}`, fromNodeId: from, toNodeId: to };
}

describe("F-2 可行性探针：Frame 容纳 Config + 跨边界连线", () => {
    test("① canFrameContain 容纳 Config（F-09 三期已扩判定）", () => {
        const config = node("cfg", CanvasNodeType.Config);
        // ★ F-09 三期改动：此前为 false，扩判定后为 true（爆款复刻模板需生成节点进 Frame）
        expect(canFrameContain(config)).toBe(true);
        const img = node("img", CanvasNodeType.Image);
        expect(canFrameContain(img)).toBe(true);
        // 反向：Frame 自身仍不可被容纳（防止容器套容器）
        expect(canFrameContain(node("f", CanvasNodeType.Frame))).toBe(false);
    });

    test("② canFolderContain 已容纳 Config（folder 无需改动）", () => {
        expect(canFolderContain(node("cfg", CanvasNodeType.Config))).toBe(true);
        expect(canFolderContain(node("f", CanvasNodeType.Frame))).toBe(false); // 仅排除 Frame
    });

    test("③ 展开 Frame 内的 Config：连线【不】被重定向（无副作用）", () => {
        const f = frame("frame-1", false);          // collapsed: false
        const img = node("img", CanvasNodeType.Image, f.id);
        const cfg = node("cfg", CanvasNodeType.Config, f.id);
        const outside = node("out", CanvasNodeType.Image);
        const nodes = [f, img, cfg, outside];

        // 内部连线：img → cfg
        const inner = resolveFrameConnection(conn(img.id, cfg.id), nodes);
        expect(inner).toEqual({ from: img, to: cfg });   // 直接渲染，不重定向

        // 跨边界连线：cfg → outside
        const cross = resolveFrameConnection(conn(cfg.id, outside.id), nodes);
        expect(cross).toEqual({ from: cfg, to: outside });  // ✓ 正常渲染

        // 无节点被折叠 Frame 隐藏
        expect(isNodeHiddenByCollapsedFrame(cfg, nodes)).toBe(false);
        expect(getCollapsedParentFrame(cfg, nodes)).toBeNull();
    });

    test("★ ④ 折叠 Frame 时：Config 的跨边界连线【被重定向到 Frame】（副作用确认）", () => {
        const f = frame("frame-1", true);           // collapsed: true
        const cfg = node("cfg", CanvasNodeType.Config, f.id);
        const outside = node("out", CanvasNodeType.Image);
        const nodes = [f, cfg, outside];

        expect(isNodeHiddenByCollapsedFrame(cfg, nodes)).toBe(true);
        // 跨边界连线被重定向：cfg → Frame
        const cross = resolveFrameConnection(conn(cfg.id, outside.id), nodes);
        expect(cross).toEqual({ from: f, to: outside });  // ★ 重定向到 Frame
        // 内部连线：两端都在同一折叠 Frame 内 ⇒ 返回 null（不渲染）
        const inner = resolveFrameConnection(conn(cfg.id, "x"), nodes);
        expect(inner).toBeNull();
    });

    test("⑤ folder（Frame 变体）折叠时：子节点【不】被隐藏（豁免）", () => {
        const fold = frame("folder-1", true, true);  // folder + collapsed
        const cfg = node("cfg", CanvasNodeType.Config, fold.id);
        const nodes = [fold, cfg];
        // folder 的 collapsed 是「收起为卡片」，子节点不参与画布渲染，但语义不同于 Frame 折叠
        expect(isNodeHiddenByCollapsedFrame(cfg, nodes)).toBe(true);
    });
});
