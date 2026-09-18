import { describe, expect, test } from "bun:test";

import {
    describeOutpaintSize,
    resolveOutpaintPadding,
    resolveOutpaintTargetPx,
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

    test("keeps frame ratio when dragging a horizontal edge (width dominates)", () => {
        const result = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "right",
            dx: 260,
            dy: 0,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 16 / 9,
        });
        expect(result.right).toBe(260);
        // frameH = 1000 → frameW = 16/9 × 1000 → left = 1777.78 - 1000 - 260 = 517.78 → 518
        expect(result.left).toBeCloseTo((16 / 9) * 1000 - 1000 - 260, 0);
        const frameW = 1000 + result.left + result.right;
        const frameH = 1000 + result.top + result.bottom;
        expect(frameW / frameH).toBeCloseTo(16 / 9, 2);
    });

    test("keeps frame ratio when dragging a vertical edge (height dominates)", () => {
        const result = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "bottom",
            dx: 0,
            dy: 200,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 9 / 16,
        });
        expect(result.bottom).toBe(200);
        // frameW = 1000 → frameH = 1000 ÷ (9/16) → top = 1777.78 - 1000 - 200 = 577.78 → 578
        expect(result.top).toBeCloseTo(1000 / (9 / 16) - 1000 - 200, 0);
        const frameW = 1000 + result.left + result.right;
        const frameH = 1000 + result.top + result.bottom;
        expect(frameW / frameH).toBeCloseTo(9 / 16, 2);
    });

    test("corner drag picks the dominant axis and resolves the opposite edge", () => {
        const horizontal = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "topLeft",
            dx: -100,
            dy: -40,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 1.5,
        });
        expect(horizontal.left).toBe(100);
        expect(horizontal.top).toBe(40);
        // frameH = 1040 → frameW = 1560 → right = 1560 - 1000 - 100 = 460
        expect(horizontal.right).toBe(460);
        expect((1000 + horizontal.left + horizontal.right) / (1000 + horizontal.top + horizontal.bottom)).toBeCloseTo(1.5, 2);

        const vertical = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "bottomRight",
            dx: 20,
            dy: 80,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 0.8,
        });
        expect(vertical.right).toBe(20);
        expect(vertical.bottom).toBe(80);
        // frameW = 1020 → frameH = 1020 ÷ 0.8 = 1275 → top = 1275 - 1000 - 80 = 195
        expect(vertical.top).toBe(195);
        expect((1000 + vertical.left + vertical.right) / (1000 + vertical.top + vertical.bottom)).toBeCloseTo(0.8, 2);
    });

    test("ratio lock yields to non-negative padding when constraints conflict", () => {
        const result = resolveOutpaintPadding({
            padding: NO_PADDING,
            edge: "topLeft",
            dx: -100,
            dy: -40,
            nodeWidth: 1000,
            nodeHeight: 1000,
            ratio: 1, // frameW = frameH = 1040 需要 right = -60，不可满足 → right clamp 0
        });
        expect(result.left).toBe(100);
        expect(result.top).toBe(40);
        expect(result.right).toBe(0);
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
