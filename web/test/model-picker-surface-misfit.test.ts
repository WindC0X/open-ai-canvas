import { expect, test } from "bun:test";

// 2026-09-24 复发修复（重放 c86b1bc8）：上游 `.creation-model-picker-surface` 错位块
// 曾在合并中被两次带入 —— 其 `option > span:first-child > span:first-child`（上游 DOM 里是
// 32×32 图标方块）在我们结构里命中 ModelLabel 根（整行内容容器），bg !important 把整行
// 涂成深灰胶囊并把副标题裁在半路（用户截图实证）。守卫：surface 作用域不得再现该族规则。
test("模型菜单不得再有 surface 错位块（整行深灰胶囊复发锁定）", async () => {
    const [shared, globals] = await Promise.all([
        Bun.file(new URL("../src/styles/shared/model-picker.css", import.meta.url)).text(),
        Bun.file(new URL("../src/styles/globals.css", import.meta.url)).text(),
    ]);
    for (const css of [shared, globals]) {
        expect(css).not.toContain(".creation-model-picker-surface .canvas-model-picker-option > span:first-child");
        expect(css).not.toContain(".creation-model-picker-surface .canvas-model-picker-option { min-height: 55px");
    }
    // 我们侧权威行高仍在（source of truth 未被打断）
    expect(globals).toContain("min-height: 53px;");
});
