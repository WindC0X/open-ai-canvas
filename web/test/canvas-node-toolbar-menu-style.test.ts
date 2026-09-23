import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 回归：T4（2026-09-24 三模型复核 + 现场复现）——rc-motion 过渡态全局 pe:none 防线（防幽灵浮层）
// 会把画布节点工具栏菜单（九宫格/宫格切分/样式）一并钉死；wrapper 必须携带 pointer-events:auto
// 反制，否则失焦节流（rAF 数秒/帧）下菜单长时间不可点，点击穿透被判外部点击自动关闭。
const globals = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8");

test("画布节点工具栏菜单保留 pointer-events:auto 反制（T4）", () => {
    expect(globals).toMatch(/\.canvas-node-toolbar-menu\s*\{[^}]*pointer-events:\s*auto;/);
});

test("菜单 class 载体（工具栏下拉 + 九宫格 picker）仍在位（T4）", () => {
    const toolbar = readFileSync(new URL("../src/components/canvas/canvas-node-toolbar.tsx", import.meta.url), "utf8");
    const nineGrid = readFileSync(new URL("../src/components/canvas/canvas-nine-grid-picker.tsx", import.meta.url), "utf8");
    expect(toolbar).toContain("canvas-node-toolbar-menu");
    expect(nineGrid).toContain("canvas-node-toolbar-menu");
});
