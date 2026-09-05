import { describe, expect, test } from "bun:test";
import { fitNodeSize } from "@/lib/canvas/canvas-node-size";

/**
 * fitToImage 同比例保持守卫（canvas-node-content.tsx ImageContent）的判定逻辑。
 * 与组件保持同步的纯函数复算：媒体宽高比与节点框比一致（±2%）时保持现尺寸，
 * 否则按全局边界 fitNodeSize 校正。此文件锁定边界的数值行为。
 */
function fitToImageDecision(natural: { w: number; h: number }, box: { w: number; h: number }) {
    const naturalRatio = natural.w / natural.h;
    const boxRatio = box.w / box.h;
    if (Math.abs(naturalRatio - boxRatio) / naturalRatio < 0.02) {
        return { keep: true, size: { width: box.w, height: box.h } };
    }
    return { keep: false, size: fitNodeSize(natural.w, natural.h) };
}

describe("fitToImage 同比例保持守卫(S05)", () => {
    test("1:1 任务 960×960 + 1:1 框 420×420 → 保持 420(修复前被全局边界撑到 520)", () => {
        const r = fitToImageDecision({ w: 960, h: 960 }, { w: 420, h: 420 });
        expect(r.keep).toBe(true);
        expect(r.size).toEqual({ width: 420, height: 420 });
    });

    test("16:9 任务 + 16:9 框(720×405) → 保持", () => {
        const r = fitToImageDecision({ w: 1920, h: 1080 }, { w: 720, h: 405 });
        expect(r.keep).toBe(true);
        expect(r.size).toEqual({ width: 720, height: 405 });
    });

    test("比例不同(竖图落宽框) → 仍按全局边界校正(上传路径自适应不回归)", () => {
        const r = fitToImageDecision({ w: 720, h: 1280 }, { w: 720, h: 405 });
        expect(r.keep).toBe(false);
        const expected = fitNodeSize(720, 1280);
        expect(r.size).toEqual(expected);
    });

    test("容差边界: 比例差恰好 1.9% 保持, 3% 校正", () => {
        // 1.9%: 1000/1000 vs 框比 1000/(1000*1.019)
        const within = fitToImageDecision({ w: 1000, h: 1000 }, { w: 1000, h: Math.round(1000 * 1.019) });
        expect(within.keep).toBe(true);
        const outside = fitToImageDecision({ w: 1000, h: 1000 }, { w: 1000, h: Math.round(1000 * 1.03) });
        expect(outside.keep).toBe(false);
    });

    test("极小框不小于最小可读尺寸(经 fitNodeSize 钳制路径)", () => {
        // 非同比例时走 fitNodeSize: 超小图被抬到最小 420×236
        const r = fitToImageDecision({ w: 100, h: 50 }, { w: 300, h: 300 });
        expect(r.keep).toBe(false);
        expect(r.size.width).toBeGreaterThanOrEqual(420);
        expect(r.size.height).toBeGreaterThanOrEqual(236);
    });
});
