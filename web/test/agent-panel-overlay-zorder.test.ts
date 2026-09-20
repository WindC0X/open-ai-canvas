import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Agent 浮窗层级修复契约: Agent 必须接入画布浮层"最后交互置顶"体系(useCanvasOverlayLayer),
// 否则固定 z-modal-overlay(110) 会被交互后置顶(150)的节点面板永久压住(用户实测遮挡 Agent 输入区)。
// 本测试验证接线存在性(仓库既有源码断言风格); DOM 合成轮转由真机验证承担。
const source = readFileSync(resolve(import.meta.dir, "../src/components/canvas/canvas-cloud-agent-panel.tsx"), "utf8");
const overlayLayerSource = readFileSync(resolve(import.meta.dir, "../src/components/canvas/canvas-overlay-layer.tsx"), "utf8");

describe("Agent 浮窗层级接线契约", () => {
    test("面板注册为画布浮层参与者: useCanvasOverlayLayer(agent-panel)", () => {
        expect(source).toContain('useCanvasOverlayLayer("agent-panel"');
        expect(source).toContain('"var(--z-modal-overlay)"');
    });

    test("pointerdown 与 focus capture 都触发 bringToFront(点击与键盘聚焦两入口)", () => {
        expect(source).toContain("bringAgentToFront();\n            panelLayout.pointerHandlers.onPointerDown(event);");
        expect(source).toContain("onFocusCapture={bringAgentToFront}");
    });

    test("置顶 zIndex 并入面板 style 且替代写死的 z-modal-overlay className", () => {
        expect(source).toContain("zIndex: agentZIndex");
        expect(source).not.toContain('canvas-agent-panel fixed z-[var(--z-modal-overlay)]');
    });

    test("拖拽 handler 链保留: 包装版仍转发 panelLayout.pointerHandlers 原签名", () => {
        expect(source).toContain("{...agentPointerHandlers}");
        expect(source).toContain("panelLayout.pointerHandlers.onPointerDown(event);");
    });

    test("置顶机制单值槽语义: overlay-layer 同一时间只有一个 active", () => {
        expect(overlayLayerSource).toContain("activeOverlayId");
        expect(overlayLayerSource).toContain('current === overlayId ? current : overlayId');
        expect(overlayLayerSource).toContain('"var(--z-canvas-overlay-active)"');
    });
});
