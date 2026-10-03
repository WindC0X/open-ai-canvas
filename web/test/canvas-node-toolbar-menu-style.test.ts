import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 回归：T4（2026-09-24 三模型复核 + 现场复现）——rc-motion 过渡态全局 pe:none 防线（防幽灵浮层）
// 会把画布节点工具栏菜单（九宫格/宫格切分/样式）一并钉死；wrapper 必须携带 pointer-events:auto
// 反制，否则失焦节流（rAF 数秒/帧）下菜单长时间不可点，点击穿透被判外部点击自动关闭。
const globals = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8");
// W4（2026-10-03）：fork 组件覆写外置到 flora-overrides.css，T4 反制随迁。
// 断言跨两文件成立即可（规则存在性不变），不锁死物理位置——否则每次外置都要改测试。
const overrides = readFileSync(new URL("../src/styles/flora-overrides.css", import.meta.url), "utf8");
const styles = globals + "\n" + overrides;

test("画布节点工具栏菜单保留 pointer-events:auto 反制（T4）", () => {
    expect(styles).toMatch(/\.canvas-node-toolbar-menu\s*\{[^}]*pointer-events:\s*auto;/);
});

test("菜单 class 载体（工具栏下拉 + 九宫格 picker）仍在位（T4）", () => {
    const toolbar = readFileSync(new URL("../src/components/canvas/canvas-node-toolbar.tsx", import.meta.url), "utf8");
    const nineGrid = readFileSync(new URL("../src/components/canvas/canvas-nine-grid-picker.tsx", import.meta.url), "utf8");
    expect(toolbar).toContain("canvas-node-toolbar-menu");
    expect(nineGrid).toContain("canvas-node-toolbar-menu");
});
