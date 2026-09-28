import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// flora-tokens 皮肤层契约（W3 令牌外置 · feat/flora-tokens）:
// 1) 加载序 = application.tsx 样式链末端（同名变量后加载覆盖，级联后胜）;
// 2) 外置完成态 = globals.css 不再持有 fork 皮肤值（值面回归上游），flora-tokens.css 持有;
// 3) Rider① 焦点环（batch-11 实测覆盖不全：composer 拖柄仅微亮、后续 Tab 不可见）
//    与 Rider② 侧栏 offer 截断修复在位。
const appSource = readFileSync(resolve(import.meta.dir, "../src/application.tsx"), "utf8");
const globals = readFileSync(resolve(import.meta.dir, "../src/styles/globals.css"), "utf8");
const flora = readFileSync(resolve(import.meta.dir, "../src/styles/flora-tokens.css"), "utf8");

describe("flora-tokens 皮肤层契约", () => {
    test("加载序: flora-tokens.css 在 globals 与 shared/* 全部之后（样式链末端）", () => {
        const iFlora = appSource.indexOf('import "./styles/flora-tokens.css";');
        expect(iFlora).toBeGreaterThan(-1);
        for (const prev of ["globals.css", "shared/model-picker.css", "shared/overlays.css", "shared/scrollbars.css"]) {
            const iPrev = appSource.indexOf(`import "./styles/${prev}";`);
            expect(iPrev).toBeGreaterThan(-1);
            expect(iFlora).toBeGreaterThan(iPrev);
        }
    });

    test("外置完成态: fork 皮肤值只在本层（globals 值面回归上游）", () => {
        expect(globals).not.toContain("--node-radius: 20px");
        expect(globals).not.toContain("--elevation-overlay: 0 8px 24px");
        expect(globals).not.toContain("--affordance-micro-opacity");
        expect(globals).not.toContain("--canvas-model-badge-bg");
        expect(globals).not.toContain("--canvas-model-badge-fg");
        expect(globals).not.toContain("--workspace-foreground: var(--foreground);");
        expect(globals).not.toContain("--canvas-composer-settings-max-width: 168px");
        expect(globals).toContain("--node-radius: var(--r-lg);");
        expect(globals).toContain("--elevation-overlay: 0 24px 60px rgba(0, 0, 0, 0.2), 0 3px 10px rgba(0, 0, 0, 0.09);");
        expect(globals).toContain("--elevation-overlay: 0 28px 72px rgba(0, 0, 0, 0.62), 0 4px 14px rgba(0, 0, 0, 0.4);");
        expect(globals).toContain("--canvas-composer-settings-width: 138px;");
        expect(globals).toContain("max-width: var(--canvas-composer-settings-max-width) !important;");
        expect(flora).toContain("--elevation-overlay: 0 8px 24px rgba(0, 0, 0, 0.14)");
        expect(flora).toContain("--elevation-overlay: 0 8px 24px rgba(0, 0, 0, 0.4)");
        expect(flora).toContain("--affordance-micro-opacity: 0.45;");
        expect(flora).toContain("--affordance-micro-saturate: 0.8;");
        expect(flora).toContain("--workspace-foreground: var(--foreground);");
        expect(flora).toContain("--node-radius: 20px;");
        expect(flora).toContain("--canvas-composer-settings-max-width: 168px;");
        expect(flora).toContain("--canvas-model-badge-bg: rgba(17, 24, 39, .06);");
        expect(flora).toContain("--canvas-model-badge-bg: rgba(255, 255, 255, .10);");
        expect(flora).toContain("--canvas-model-badge-fg: rgba(255, 255, 255, .72);");
        expect(flora).toContain("--background: oklch(0.145 0 0);");
        expect(flora).toContain("--foreground: oklch(0.985 0 0);");
        expect(flora).toContain("--border: oklch(1 0 0 / 10%);");
    });

    test("Rider① 焦点环: 语义 token + 全局兜底 + 上游原生杀点消解", () => {
        expect(flora).toContain("--focus-ring-visible: 2px solid var(--ring);");
        expect(flora).toContain('role="separator"');
        expect(flora).toContain("outline: var(--focus-ring-visible);");
        expect(flora).toContain(".canvas-node-composer-resize-handle:focus-visible");
        expect(flora).toContain(".canvas-node-composer-camera-tools-trigger:focus-visible");
    });

    test("Rider② 侧栏 offer 截断修复: 文案列加宽到位", () => {
        expect(globals).toContain("padding: 10px 8px 10px 12px;");
        expect(globals).toContain("gap: 6px;");
    });
});
