import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 回归：T5（2026-09-24 三模型复核）——.script-column-picker 布局规则在 W4 样式拆分时丢失
// （基线 globals:7439），分镜脚本弹窗列选择器排版塌陷。
const globals = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8");

test("分镜脚本列选择器布局规则在位（T5）", () => {
    expect(globals).toMatch(/\.script-column-picker\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/);
});
