import { describe, expect, test } from "bun:test";
import {
    CUTOUT_WHITE_BACKGROUND_PRESET_ID,
    aspectFromLabel,
    planWhiteBackground,
} from "../src/lib/media-conversion/cutout-white-background";

describe("白底合成几何", () => {
    test("Amazon 主图档位常量指向既有电商预设", () => {
        expect(CUTOUT_WHITE_BACKGROUND_PRESET_ID).toBe("amazon-main");
    });

    test("1:1 输入产出正方形，且不低于 1600 下限", () => {
        const plan = planWhiteBackground({ width: 2000, height: 2000 });
        expect(plan.width).toBe(plan.height);
        expect(plan.width).toBeGreaterThanOrEqual(1600);
        expect(plan.upscaled).toBe(false);
    });

    test("横图补上下白边，主体居中且保持原比例", () => {
        const plan = planWhiteBackground({ width: 1600, height: 800 });
        expect(plan.width).toBe(plan.height);
        expect(plan.drawWidth).toBeGreaterThan(plan.drawHeight);
        // 主体等比：宽高比与源图一致（允许取整误差）。
        expect(Math.abs(plan.drawWidth / plan.drawHeight - 2)).toBeLessThan(0.02);
        // 居中：左右/上下留白相差不超过 1px（整数像素取整允许的偏差）。
        expect(Math.abs(plan.drawX - (plan.width - plan.drawWidth - plan.drawX))).toBeLessThanOrEqual(1);
        expect(Math.abs(plan.drawY - (plan.height - plan.drawHeight - plan.drawY))).toBeLessThanOrEqual(1);
        // 主体不超出画布。
        expect(plan.drawX).toBeGreaterThanOrEqual(0);
        expect(plan.drawY).toBeGreaterThanOrEqual(0);
        expect(plan.drawX + plan.drawWidth).toBeLessThanOrEqual(plan.width);
        expect(plan.drawY + plan.drawHeight).toBeLessThanOrEqual(plan.height);
    });

    test("竖图补左右白边", () => {
        const plan = planWhiteBackground({ width: 800, height: 1600 });
        expect(plan.width).toBe(plan.height);
        expect(plan.drawHeight).toBeGreaterThan(plan.drawWidth);
        expect(plan.drawY).toBeGreaterThan(0);
    });

    test("小图被抬到渠道下限并标记放大", () => {
        const plan = planWhiteBackground({ width: 400, height: 400 });
        expect(plan.width).toBeGreaterThanOrEqual(1600);
        expect(plan.height).toBeGreaterThanOrEqual(1600);
        expect(plan.upscaled).toBe(true);
    });

    test("极小图不产出零尺寸画布", () => {
        const plan = planWhiteBackground({ width: 1, height: 1 });
        expect(plan.width).toBeGreaterThan(0);
        expect(plan.height).toBeGreaterThan(0);
        expect(plan.drawWidth).toBeGreaterThan(0);
        expect(plan.drawHeight).toBeGreaterThan(0);
    });

    test("主体占比不超过留白比例上限", () => {
        const plan = planWhiteBackground({ width: 1600, height: 1600 });
        expect(plan.drawWidth / plan.width).toBeLessThanOrEqual(0.93);
        expect(plan.drawHeight / plan.height).toBeLessThanOrEqual(0.93);
    });

    test("可覆盖目标比例与下限（非 Amazon 渠道复用）", () => {
        const plan = planWhiteBackground({ width: 1000, height: 1000 }, { aspect: 3 / 4, minPixels: 800 });
        expect(Math.abs(plan.width / plan.height - 3 / 4)).toBeLessThan(0.02);
        expect(Math.min(plan.width, plan.height)).toBeGreaterThanOrEqual(800);
    });

    test("比例字符串解析：合法值按比例，非法值退回 1", () => {
        expect(aspectFromLabel("1:1")).toBe(1);
        expect(aspectFromLabel("3:4")).toBeCloseTo(0.75, 5);
        expect(aspectFromLabel("16:9")).toBeCloseTo(16 / 9, 5);
        expect(aspectFromLabel("")).toBe(1);
        expect(aspectFromLabel("abc")).toBe(1);
        expect(aspectFromLabel("0:1")).toBe(1);
        expect(aspectFromLabel("1:0")).toBe(1);
    });
});
