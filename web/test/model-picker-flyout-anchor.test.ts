import { expect, test } from "bun:test";

// 收口A2（2026-09-24）：L2 飞层左翻必须用实测宽度贴住 L1——
// 固定 384 常量在 max-content（实测 260）场景会留下 ~124px 悬空缝（实测 126px）。
test("飞层定位使用实测宽度（无固定 384 常量残留）", async () => {
    const component = await Bun.file(new URL("../src/components/model-picker.tsx", import.meta.url)).text();
    expect(component).not.toMatch(/\+ 384 > window\.innerWidth/);
    expect(component).not.toMatch(/mr\.left - 384 - 2/);
    expect(component).toContain("flyoutRef.current?.offsetWidth || 384");
    expect(component).toContain("el.offsetWidth || 384");
});
