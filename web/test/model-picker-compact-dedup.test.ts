import { expect, test } from "bun:test";

// 收口A2（2026-09-24）：上游 shared 紧凑块曾以 unlayered 压过 fork 分层权威值
// （行 43px/标签 10px vs 53px/12px）。守卫：共享文件不得再含这些 compact 覆写。
// G7（2026-09-24 完成）：fork 权威规则已全量迁入 shared；globals 不再承载该家族。
test("creation 模型菜单行样式保 fork 权威（共享文件无 compact 覆写）", async () => {
    const [shared, globals] = await Promise.all([
        Bun.file(new URL("../src/styles/shared/model-picker.css", import.meta.url)).text(),
        Bun.file(new URL("../src/styles/globals.css", import.meta.url)).text(),
    ]);
    // 共享文件：不得再现 creation 菜单行/标签的 compact 覆写
    expect(shared).not.toMatch(/\.creation-model-picker-menu \.canvas-model-picker-option \{\n\s*min-height: (?:43|52)px/);
    expect(shared).not.toMatch(/\.creation-model-picker-menu \.canvas-model-picker-option \{ min-height: 43px/);
    expect(shared).not.toContain(".creation-model-picker-menu .canvas-model-picker-group-label { padding: 6px 7px 5px");
    expect(shared).not.toContain("width: 26px; height: 26px;");
    // G7 后：fork 权威值在单一源（shared）
    expect(shared).toContain("min-height: 53px;");
    expect(shared).toContain("padding: 10px 10px 6px;");
    // 且 globals 不得再含该家族（防第三次双源复发）
    expect(globals).not.toContain("canvas-model-picker");
});
