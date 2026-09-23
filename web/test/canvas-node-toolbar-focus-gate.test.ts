import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 回归：T3（2026-09-24 三模型复核 + 现场复现）——工具栏焦点通道（M3）此前对任何焦点来源
// 升级供给等级：鼠标点击按钮后焦点残留在工具栏上，指针离开仍被钉在 full（「没 hover 就全显」）。
// 闸门 = 仅 :focus-visible（键盘来源）才升级；鼠标点击焦点不算 hover 供给。
const toolbar = readFileSync(new URL("../src/components/canvas/canvas-node-toolbar.tsx", import.meta.url), "utf8");

test("焦点升级带 :focus-visible 闸门（T3）", () => {
    expect(toolbar).toContain('matches?.(":focus-visible")');
});

test("不再存在无闸门的焦点升级调用（T3）", () => {
    expect(toolbar).not.toContain("onFocusCapture={() => onFocusChange?.(node.id, true)}");
});

test("失焦清理通道保留（T3）", () => {
    expect(toolbar).toContain("onFocusChange?.(node.id, false)");
});
