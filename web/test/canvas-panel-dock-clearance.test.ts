import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// 控制线 2026-09-28 rider-2 令：撤回 4dc8c251 的 dock-clamp 让位（与 2026-09-25「纯贴附」裁决冲突，
// 用户真机实证孤儿面板——节点滚出屏幕时挂件被拎回钉在 dock 上方）。恢复纯贴附原语义：
// 挂件随节点滑出、被画布容器自然裁切；dock 可点性改由 z 梯级（--z-global-tools）保证。
describe("纯贴附回归：挂件不被 dock 拣回（2026-09-25 裁决恢复）", () => {
    const src = readFileSync(resolve(import.meta.dir, "../src/components/canvas/canvas-workspace-overlays.tsx"), "utf8");

    test("源级：定位路径无 dock clamp / 无拣回接线", () => {
        expect(src).not.toContain("clampPanelTopAboveDock");
        expect(src).not.toContain("resolvePanelDockClearBottom");
        expect(src).not.toContain("canvas-dock-popover-offset");
        expect(src).not.toContain("DOCK_BAND");
    });

    test("贴附几何来源：节点底缘直连，transform 直用贴附 top", () => {
        expect(src).toContain("getAttachedNodePanelPosition(nodeElement, container, nextWidth)");
        expect(src).toContain("panel.style.transform = `translate3d(${position.left}px, ${position.top}px, 0) translateX(-50%)`");
        expect(src).toContain("纯贴附");
    });
});

describe("z 梯级（rider-2：dock 提层 + hover 卡提层）", () => {
    test("--z-global-tools 高于画布浮层激活值（150）；dock 带消费该层", () => {
        const globals = readFileSync(resolve(import.meta.dir, "../src/styles/globals.css"), "utf8");
        const valueOf = (name: string) => {
            const match = globals.match(new RegExp(`${name}:\\s*(\\d+)`));
            return match ? Number(match[1]) : Number.NaN;
        };
        expect(valueOf("--z-global-tools")).toBeGreaterThan(valueOf("--z-canvas-overlay-active"));
        expect(valueOf("--z-canvas-overlay-active")).toBeGreaterThan(valueOf("--z-toolbar"));
        // dock z 挂点：主工具栏带 fallback 提至全局工具带（激活值 150 时挂件回落 110，两态均在其上）
        const toolbar = readFileSync(resolve(import.meta.dir, "../src/components/canvas/canvas-toolbar.tsx"), "utf8");
        expect(toolbar).toContain('useCanvasOverlayLayer("main-toolbar", "var(--z-global-tools)")');
    });

    test("hover 卡 z 默认值 ≥ tooltip 层；mini 卡 1150 不动", () => {
        const css = readFileSync(resolve(import.meta.dir, "../src/components/ui/tool-hover-card.css"), "utf8");
        expect(css).toContain("z-index: var(--tool-hover-card-z, var(--z-tooltip))");
        expect(css).toContain("z-index: var(--tool-hover-card-mini-z, 1150)");
        const globals = readFileSync(resolve(import.meta.dir, "../src/styles/globals.css"), "utf8");
        const tooltip = globals.match(/--z-tooltip:\s*(\d+)/);
        expect(tooltip ? Number(tooltip[1]) : Number.NaN).toBeGreaterThan(150);
    });
});
