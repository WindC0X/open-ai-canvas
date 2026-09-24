import { expect, test } from "bun:test";

// 收口A2（2026-09-24）：修复上游 531019b3 静默并入的空判分支——
// 系统渠道（cpa-test/ddcat 等）模型行的「第二行描述」必须恢复 fork 兜底显示
// （logicalCost.description → logicalSpec → videoProfile → meta.description）。
test("模型行描述保留 fork 兜底（无 isDirectSystemModel 空判）", async () => {
    const component = await Bun.file(new URL("../src/components/model-picker.tsx", import.meta.url)).text();
    expect(component).not.toContain('isDirectSystemModel(config, model) ? "" :');
    expect(component).toContain("(logicalSpec ? logicalCapabilitySummary(logicalSpec) : videoProfile ?");
    expect(component).toContain(": meta.description);");
});
