import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeCount, CanvasCountSettingsPopover } from "@/components/canvas/canvas-count-settings-popover";
import { normalizeTextCount, CanvasTextSettingsPopover } from "@/components/canvas/canvas-text-settings-popover";

describe("normalizeTextCount（文本设置气泡份数归一）", () => {
    test("常规值透传", () => {
        expect(normalizeTextCount(1)).toBe(1);
        expect(normalizeTextCount(4)).toBe(4);
        expect(normalizeTextCount(15)).toBe(15);
    });

    test("越界收敛到 [1,15];负数按旧行为取绝对值后收敛", () => {
        expect(normalizeTextCount(0)).toBe(1);
        expect(normalizeTextCount(-3)).toBe(3);
        expect(normalizeTextCount(-99)).toBe(15);
        expect(normalizeTextCount(16)).toBe(15);
        expect(normalizeTextCount(999)).toBe(15);
    });

    test("小数取整、非法输入回落 1", () => {
        expect(normalizeTextCount(2.7)).toBe(2);
        expect(normalizeTextCount("5")).toBe(5);
        expect(normalizeTextCount("abc")).toBe(1);
        expect(normalizeTextCount(null)).toBe(1);
        expect(normalizeTextCount(undefined)).toBe(1);
        expect(normalizeTextCount(Number.NaN)).toBe(1);
    });
});

describe("normalizeCount（通用份数归一）", () => {
    test("带 max 收敛: 越界夹回 [1, max]", () => {
        expect(normalizeCount(5)).toBe(5);
        expect(normalizeCount(0)).toBe(1);
        expect(normalizeCount(-2)).toBe(2);
        expect(normalizeCount(2.9)).toBe(2);
        expect(normalizeCount("3")).toBe(3);
        expect(normalizeCount("abc")).toBe(1);
        expect(normalizeCount(null)).toBe(1);
    });
});

describe("CanvasTextSettingsPopover 触发器（SSR）", () => {
    test("渲染圆角 pill 摘要与 aria 标签", () => {
        const html = renderToStaticMarkup(<CanvasTextSettingsPopover value={3} onChange={() => {}} />);
        expect(html.includes("3 份")).toBe(true);
        expect(html.includes(`aria-label="生成份数：3 份"`)).toBe(true);
        expect(html.includes("canvas-generation-settings-trigger")).toBe(true);
    });

    test("未打开时不渲染 portal 面板", () => {
        const html = renderToStaticMarkup(<CanvasTextSettingsPopover value={1} onChange={() => {}} />);
        expect(html.includes("canvas-count-settings-popover")).toBe(false);
    });
});

describe("CanvasCountSettingsPopover 图像份数（SSR）", () => {
    test("label 张: 触发器摘要与 aria 使用张", () => {
        const html = renderToStaticMarkup(<CanvasCountSettingsPopover value={2} max={4} label="张" onChange={() => {}} />);
        expect(html.includes("2 张")).toBe(true);
        expect(html.includes(`aria-label="生成份数：2 张"`)).toBe(true);
    });

    test("value 越过 max 时触发器摘要夹回 max", () => {
        const html = renderToStaticMarkup(<CanvasCountSettingsPopover value={9} max={4} label="张" onChange={() => {}} />);
        expect(html.includes("4 张")).toBe(true);
        expect(html.includes("9 张")).toBe(false);
    });

    test("normalizeTextCount 兼容导出与 normalizeCount 同值", () => {
        expect(normalizeTextCount(16)).toBe(normalizeCount(16));
        expect(normalizeTextCount(-3)).toBe(3);
    });
});
