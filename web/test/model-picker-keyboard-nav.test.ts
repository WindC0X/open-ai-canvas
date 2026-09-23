import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 回归：F6（2026-09-24，两模型独立命中的合并缺陷）——键盘导航选择器与 DOM 属性必须配对：
// 合并曾把上游的 [data-model-picker-item] 查询嫁接在我方无该属性的行按钮上，导致方向键/Home/End
// 完全失效。本测试锁定两侧契约（查询 ≥2 处 + 行按钮携带属性）。
const picker = readFileSync(new URL("../src/components/model-picker.tsx", import.meta.url), "utf8");

test("模型行按钮携带 data-model-picker-item（键盘导航命中目标）", () => {
    expect(picker).toContain('data-model-picker-item="true"');
    expect(picker).toMatch(/data-model-picker-item="true"\s+aria-selected=/);
});

test("菜单键盘导航查询 [data-model-picker-item] 且与行按钮配对（F6）", () => {
    const queryCount = (picker.match(/\[data-model-picker-item\]/g) || []).length;
    expect(queryCount).toBeGreaterThanOrEqual(2);
    expect(picker).toContain('"Home"');
    expect(picker).toContain('"End"');
});
