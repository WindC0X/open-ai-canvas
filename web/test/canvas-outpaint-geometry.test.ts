import { describe, expect, test } from "bun:test";

import {
    describeOutpaintSize,
    resolveOutpaintPadding,
    resolveOutpaintTargetPx,
    resolveOutpaintPaddingForRatio,
    type OutpaintPadding,
} from "../src/lib/canvas/canvas-outpaint-geometry";

const NO_PADDING: OutpaintPadding = { left: 0, top: 0, right: 0, bottom: 0 };

describe("canvas-outpaint-geometry", () => {
    test("clamps shrink drags into zero padding (frame never smaller than node)", () => {
        const left = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "left",
            dx: 50, // 向右拖左边手柄 = 收缩
            dy: 0,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: null,
        });
        expect(left).toEqual(NO_PADDING);

        const top = resolveOutpaintPadding({
            padding: { left: 0, top: 30, right: 0, bottom: 0 },
            edge: "top",
            dx: 0,
            dy: 80, // 向下压顶边手柄 = 收缩 80 → 30 - 80 clamp 到 0
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: null,
        });
        expect(top).toEqual(NO_PADDING);
    });

    test("applies free drag to the matching edges and rounds", () => {
        const left = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "left",
            dx: -80.4,
            dy: 0,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: null,
        });
        expect(left).toEqual({ left: 80, top: 0, right: 0, bottom: 0 });

        const corner = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "topRight",
            dx: 30,
            dy: -20,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: null,
        });
        expect(corner).toEqual({ left: 0, top: 20, right: 30, bottom: 0 });
    });

    test("ratio-locked horizontal drag scales the outpaint area proportionally (anchor = opposite edge)", () => {
        const result = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "right",
            dx: 260,
            dy: 0,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 16 / 9,
        });
        // 右边意图 260 → frameW=1260 → frameH=709 < 原图高 → 触底回推 frameW = 16/9×1000
        const frameW = 1000 + result.left + result.right;
        const frameH = 1000 + result.top + result.bottom;
        expect(frameW / frameH).toBeCloseTo(16 / 9, 2);
        expect(result.left).toBe(0); // 对边锚定不动
        expect(result.right).toBeCloseTo((16 / 9) * 1000 - 1000, 0);
        expect(frameH).toBe(1000); // 触底：上下无外扩
    });

    test("ratio-locked vertical drag keeps the opposite edge anchored and grows symmetrically", () => {
        const result = resolveOutpaintPadding({
            padding: { left: 0, right: 900, top: 0, bottom: 0 },
            edge: "bottom",
            dx: 0,
            dy: 200,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 1,
        });
        const frameW = 1000 + result.left + result.right;
        const frameH = 1000 + result.top + result.bottom;
        // bottom 意图 200 → frameH=1200 → frameW=1200 → 水平外扩总量 200，dH=-900（图片贴左）→ left=0、right=200
        expect(result.right).toBe(200); // 1:1 锁定下水平外扩量由 frameH 决定，图片方位保持（贴左）
        expect(result.left).toBe(0);
        expect(result.bottom).toBe(200);
        expect(result.top).toBe(0);
        expect(frameW / frameH).toBeCloseTo(1, 2);

        // 无既有外扩时拖垂直边 → 水平对称生长
        const plain = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "bottom",
            dx: 0,
            dy: 200,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 9 / 16,
        });
        // frameH=1200 → frameW=675 < 1000 触底 → frameW=1000、frameH=16000/9 → bottom=778
        expect(plain.left).toBe(0);
        expect(plain.right).toBe(0);
        expect(1000 / (1000 + plain.top + plain.bottom)).toBeCloseTo(9 / 16, 2);
    });

    test("corner drag keeps ratio and anchors the opposite corner (dominant axis ignored on the other)", () => {
        const horizontal = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "topLeft",
            dx: -100,
            dy: -40,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 1.5,
        });
        // |dx|>|dy| → 水平主导：left 意图 100 → frameW=1100 → frameH=733 < 1000 触底 →
        // frameW=1500、left=500、top/bottom=0
        expect(horizontal.left).toBe(500);
        expect(horizontal.right).toBe(0);
        expect(horizontal.top).toBe(0);
        expect(horizontal.bottom).toBe(0);
        expect((1000 + horizontal.left + horizontal.right) / 1000).toBeCloseTo(1.5, 2);

        const square = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "topLeft",
            dx: -100,
            dy: -40,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 1,
        });
        // frameW=1100 → frameH=1100 → 垂直增量 100 对称 → top=50、bottom=50；left=100、right=0
        expect(square.left).toBe(100);
        expect(square.right).toBe(0);
        expect(square.top).toBe(50);
        expect(square.bottom).toBe(50);
        expect((1000 + square.left + square.right) / (1000 + square.top + square.bottom)).toBeCloseTo(1, 2);
    });

    test("scales the whole target down when the long edge exceeds the cap", () => {
        const result = resolveOutpaintTargetPx({
            contentWidth: 1000,
            contentHeight: 1000,
            nodeWidth: 1000,
            nodeHeight: 1000,
            padding: { left: 2000, top: 1000, right: 2000, bottom: 1000 },
        });
        // 框 5000 × 3000 → factor = 4096/5000
        expect(result.width).toBe(4096);
        expect(result.height).toBe(2458);
        expect(result.paddingPx.left).toBe(1638);
        expect(result.paddingPx.top).toBe(819);
    });

    test("keeps target untouched below the long edge cap", () => {
        const result = resolveOutpaintTargetPx({
            contentWidth: 1000,
            contentHeight: 1000,
            nodeWidth: 1000,
            nodeHeight: 1000,
            padding: { left: 500, top: 0, right: 500, bottom: 0 },
        });
        expect(result.width).toBe(2000);
        expect(result.height).toBe(1000);
        expect(result.paddingPx).toEqual({ left: 500, top: 0, right: 500, bottom: 0 });
    });

    test("converts world padding into source pixels via content/node scale", () => {
        const result = resolveOutpaintTargetPx({
            contentWidth: 2000,
            contentHeight: 1000,
            nodeWidth: 1000,
            nodeHeight: 500,
            padding: { left: 100, top: 50, right: 100, bottom: 50 },
        });
        expect(result.width).toBe(2400);
        expect(result.height).toBe(1200);
        expect(result.paddingPx).toEqual({ left: 200, top: 100, right: 200, bottom: 100 });

        // scale 换算一致性：paddingPx ≈ padding × scale（无长边 clamp 时）
        const scale = 2000 / 1000;
        expect(result.paddingPx.left).toBeCloseTo(100 * scale, 6);
        expect(result.paddingPx.bottom).toBeCloseTo(50 * scale, 6);
    });

    test("describes the padded frame size", () => {
        expect(describeOutpaintSize(NO_PADDING, 1000, 1000)).toBe("1000 × 1000");
        expect(describeOutpaintSize({ left: 250, top: 0, right: 250, bottom: 152 }, 1000, 1000, 2)).toBe("3000 × 2304");
    });

    test("returns safe values for invalid input without NaN or Infinity", () => {
        expect(
            resolveOutpaintTargetPx({
                contentWidth: 0,
                contentHeight: 1000,
                nodeWidth: 1000,
                nodeHeight: 1000,
                padding: NO_PADDING,
            }),
        ).toEqual({ width: 0, height: 0, paddingPx: NO_PADDING });
        expect(
            resolveOutpaintTargetPx({
                contentWidth: 2000,
                contentHeight: -100,
                nodeWidth: 1000,
                nodeHeight: 0,
                padding: { left: NaN, top: Infinity, right: 10, bottom: 10 },
            }),
        ).toEqual({ width: 0, height: 0, paddingPx: NO_PADDING });

        const freeFallback = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "left",
            dx: -40,
            dy: NaN,
            nodeWidth: 0,
            nodeHeight: -5,
            ratio: NaN,
        });
        expect(freeFallback).toEqual({ left: 40, top: 0, right: 0, bottom: 0 });

        const invalidNode = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "right",
            dx: 10,
            dy: 0,
            nodeWidth: 0,
            nodeHeight: 1000,
            ratio: 1,
        });
        expect(invalidNode).toEqual({ left: 0, top: 0, right: 10, bottom: 0 });

        for (const value of Object.values(freeFallback)) {
            expect(Number.isFinite(value)).toBe(true);
        }

        expect(describeOutpaintSize(NO_PADDING, 0, 1000)).toBe("0 × 0");
        expect(describeOutpaintSize({ left: NaN, top: 0, right: 0, bottom: 0 }, 1000, Number.NaN)).toBe("0 × 0");
        expect(describeOutpaintSize({ left: NaN, top: 0, right: 0, bottom: 0 }, 1000, 1000, Number.NaN)).toBe("1000 × 1000");
    });
});

describe("resolveOutpaintPaddingForRatio", () => {
    const frameRatio = (padding: OutpaintPadding, w: number, h: number) => (w + padding.left + padding.right) / (h + padding.top + padding.bottom);

    test("locks exact ratio from a wide frame (user case 2688x1152 → 2:3)", () => {
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 2 / 3, basePadding: { left: 576, right: 576, top: 64, bottom: 64 } });
        expect(frameRatio(padding, 1536, 1024)).toBeCloseTo(2 / 3, 2);
    });

    test("keeps image off-center placement (bottom-left anchored)", () => {
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 2 / 3, basePadding: { left: 1000, right: 152, top: 0, bottom: 128 } });
        expect(padding.left - padding.right).toBeGreaterThanOrEqual(800);
        expect(padding.bottom - padding.top).toBeGreaterThanOrEqual(100);
        expect(frameRatio(padding, 1536, 1024)).toBeCloseTo(2 / 3, 2);
    });

    test("never shrinks the dominant axis when re-ratioing", () => {
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 3 / 2, basePadding: { left: 576, right: 576, top: 64, bottom: 64 } });
        expect(padding.left + padding.right).toBeGreaterThanOrEqual(1152 - 1);
        expect(frameRatio(padding, 1536, 1024)).toBeCloseTo(3 / 2, 2);
    });

    test("falls back to minimal uniform expansion when anchor would break the ratio", () => {
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 800, nodeHeight: 600, ratio: 3 / 2, basePadding: { left: 48, right: 48, top: 48, bottom: 48 } });
        expect(frameRatio(padding, 800, 600)).toBeCloseTo(3 / 2, 2);
    });

    test("safe fallbacks for invalid input", () => {
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 0, nodeHeight: 0, ratio: Number.NaN, basePadding: { left: 10, right: 10, top: 10, bottom: 10 } });
        expect(padding).toEqual({ left: 10, right: 10, top: 10, bottom: 10 });
    });
});
