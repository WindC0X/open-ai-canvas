import { describe, expect, test } from "bun:test";

import { canvasThemes } from "../src/lib/canvas-theme";

describe("canvas visual contrast", () => {
    test("keeps the canvas substrate distinct from node surfaces in both themes", () => {
        for (const theme of Object.values(canvasThemes)) {
            expect(theme.canvas.background).not.toBe(theme.node.fill);
            expect(theme.node.panel).not.toBe(theme.canvas.background);
        }
    });

    test("changes only the canvas substrate while node surfaces stay flora-quieted", () => {
        // flora/quiet 安静化（DESIGN.md 表面补录）：阴影收敛到常规档、工具面板 alpha 降低；
        // 画布底与节点填充保持原值，substrate ≠ surface 的对比意图不变。
        expect(canvasThemes.light.canvas.background).toBe("#f0f0f0");
        expect(canvasThemes.light.node.fill).toBe("#ffffff");
        expect(canvasThemes.light.node.edge).toBe("rgba(15,23,42,.16)");
        expect(canvasThemes.light.node.shadow).toBe("0 4px 12px rgba(15,23,42,.07)");
        expect(canvasThemes.light.node.hoverShadow).toBe("0 6px 16px rgba(15,23,42,.10)");
        expect(canvasThemes.light.toolbar.panel).toBe("rgba(255,255,255,.92)");
        expect(canvasThemes.light.spatial.elevated).toBe("rgba(255,255,255,.94)");

        expect(canvasThemes.dark.canvas.background).toBe("#000000");
        expect(canvasThemes.dark.node.fill).toBe("#181818");
        expect(canvasThemes.dark.node.edge).toBe("rgba(255,255,255,.18)");
        expect(canvasThemes.dark.node.shadow).toBe("0 4px 12px rgba(0,0,0,.30)");
        expect(canvasThemes.dark.node.hoverShadow).toBe("0 6px 16px rgba(0,0,0,.38)");
        expect(canvasThemes.dark.toolbar.panel).toBe("rgba(20,20,20,.92)");
        expect(canvasThemes.dark.toolbar.border).toBe("rgba(255,255,255,.10)");
        expect(canvasThemes.dark.spatial.elevated).toBe("rgba(15,15,15,.97)");
    });

    test("pins intentional grid tokens while retaining canvas grid opacity", async () => {
        expect(canvasThemes.light.canvas.dot).toBe("rgba(0,0,0,.80)");
        expect(canvasThemes.light.canvas.line).toBe("rgba(0,0,0,.80)");
        expect(canvasThemes.dark.canvas.dot).toBe("rgba(175,175,175,.80)");
        expect(canvasThemes.dark.canvas.line).toBe("rgba(175,175,175,.80)");

        const source = await Bun.file(new URL("../src/components/canvas/infinite-canvas.tsx", import.meta.url)).text();
        expect(source).toContain('opacity: mode === "dots" ? 0.34 : 0.46');
    });

    test("standard nodes use fixed-width theme stroke and generating blank yields to the rotating ring", async () => {
        // flora 语义（原语对齐）：选中以描边表达，边框宽度恒为 1px（避免宽度变化造成跳动）；
        // 首次空白生成边框归零，让位给 .node-generating-border 旋转渐变环（S04 同源条件）。
        const source = await Bun.file(new URL("../src/components/canvas/canvas-node.tsx", import.meta.url)).text();

        expect(source).toContain('border: isComposerNode || (isGenerating && !hasImageContent && !hasVideoContent) ? "0" : `1px solid ${isSelected ? theme.node.activeStroke : theme.node.stroke}`');
        expect(source).not.toContain('border: isComposerNode ? "0" : "1px solid transparent"');
        expect(source).toContain('node-generating-border');
    });
});
