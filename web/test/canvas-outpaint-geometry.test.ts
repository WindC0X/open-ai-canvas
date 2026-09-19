import { describe, expect, test } from "bun:test";

import {
    describeOutpaintSize,
    relocateOutpaintPadding,
    snapOutpaintTargetSize,
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

describe("relocateOutpaintPadding", () => {
    test("moves padding between edges without resizing the frame", () => {
        const moved = relocateOutpaintPadding({ left: 48, top: 48, right: 48, bottom: 48 }, 30, -20, false);
        expect(moved.left).toBe(78);
        expect(moved.right).toBe(18);
        expect(moved.top).toBe(28);
        expect(moved.bottom).toBe(68);
        expect(moved.left + moved.right).toBe(96);
        expect(moved.top + moved.bottom).toBe(96);
    });

    test("keeps the frame static when the image is dragged past an edge (conservation)", () => {
        // 第十三轮语义：拖图到框边 = 图片贴边停住，框永不被顶着移动（总量守恒）。
        const moved = relocateOutpaintPadding({ left: 48, top: 48, right: 48, bottom: 48 }, 100, 0, false);
        expect(moved.left).toBe(96);
        expect(moved.right).toBe(0);
        expect(moved.left + moved.right).toBe(96);
        const opposite = relocateOutpaintPadding({ left: 48, top: 48, right: 48, bottom: 48 }, -100, 0, false);
        expect(opposite.left).toBe(0);
        expect(opposite.right).toBe(96);
        expect(opposite.left + opposite.right).toBe(96);
    });

    test("keeps the total expansion constant when ratio is locked", () => {
        const moved = relocateOutpaintPadding({ left: 48, top: 48, right: 48, bottom: 48 }, 100, -60, true);
        expect(moved.left).toBe(96);
        expect(moved.right).toBe(0);
        expect(moved.top).toBe(0);
        expect(moved.bottom).toBe(96);
        expect(moved.left + moved.right).toBe(96);
        expect(moved.top + moved.bottom).toBe(96);
    });
});


describe("snapOutpaintTargetSize", () => {
    const presets43 = [
        { width: 1024, height: 768 },
        { width: 2048, height: 1536 },
        { width: 4096, height: 3072 },
    ];

    test("snaps a scale-derived target to the nearest tier pixel and rescales padding", () => {
        const snapped = snapOutpaintTargetSize({
            targetWidth: 2045,
            targetHeight: 1534,
            paddingPx: { left: 190, top: 47, right: 452, bottom: 366 },
            presets: presets43,
        });
        // 最近量级 = 2K（2048×1536）；paddingPx 同比例缩放到 preset 域（原图可缩放，扩空间非像素）。
        expect(snapped?.width).toBe(2048);
        expect(snapped?.height).toBe(1536);
        // paddingPx 经 roundPadding 整数化：190×(2048/2045)=190.28 → 190。
        expect(snapped?.paddingPx.left).toBe(190);
        expect(snapped?.paddingPx.top).toBe(47);
    });

    test("allows presets smaller than the source image (expansion is about space, not pixel size)", () => {
        // 用户语义第十三轮：2K 图也可用 1K 档生成（原图合成时缩放），档位不再受原图尺寸约束。
        const snapped = snapOutpaintTargetSize({
            targetWidth: 1024,
            targetHeight: 768,
            paddingPx: { left: 100, top: 50, right: 100, bottom: 50 },
            presets: presets43,
        });
        expect(snapped?.width).toBe(1024);
        expect(snapped?.height).toBe(768);
        expect(snapped?.paddingPx.left).toBeCloseTo(100 * (1024 / 1024), 2);
        const exceeded = snapOutpaintTargetSize({
            targetWidth: 8000,
            targetHeight: 6000,
            paddingPx: { left: 0, top: 0, right: 0, bottom: 0 },
            presets: presets43,
        });
        // 目标 8000×6000 超过全部 preset → 就近取域内最大档（4096×3072），提交恒落模型域。
        expect(exceeded?.width).toBe(4096);
        expect(exceeded?.height).toBe(3072);
    });

    test("ratio-aware snap for AUTO tier (1K model, 3:2 frame → 1536x1024 not 1024x1024)", () => {
        const presets1k = [
            { width: 1024, height: 1024 },
            { width: 1536, height: 1024 },
            { width: 1024, height: 1536 },
        ];
        const snapped = snapOutpaintTargetSize({
            targetWidth: 3283,
            targetHeight: 2189,
            paddingPx: { left: 100, top: 60, right: 100, bottom: 60 },
            presets: presets1k,
            targetRatio: 3283 / 2189,
        });
        // 比例距离占优：3:2 框 snap 到 1536×1024（同比例），面积距离次之。
        expect(snapped?.width).toBe(1536);
        expect(snapped?.height).toBe(1024);
        const k = 1536 / 3283;
        expect(snapped?.paddingPx.left).toBe(Math.round(100 * k));
    });
});

describe("resolveOutpaintPaddingForRatio", () => {
    const frameRatio = (padding: OutpaintPadding, w: number, h: number) => (w + padding.left + padding.right) / (h + padding.top + padding.bottom);

    test("locks exact ratio from a wide frame (user case 2688x1152 → 2:3)", () => {
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 2 / 3, basePadding: { left: 576, right: 576, top: 64, bottom: 64 } });
        expect(frameRatio(padding, 1536, 1024)).toBeCloseTo(2 / 3, 2);
    });

    test("axis-collapse yields the offset to the minimal legal frame (vertical bias preserved)", () => {
        // 宽框翻 2:3 时横轴塌缩到 0（框=图宽，偏移无保留空间，物理必然）；纵轴偏移在
        // [0, sh] 内保留（dB=-128 → top<bottom，图片保持略偏下）。
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 2 / 3, basePadding: { left: 1000, right: 152, top: 0, bottom: 128 } });
        expect(frameRatio(padding, 1536, 1024)).toBeCloseTo(2 / 3, 2);
        expect(padding.left).toBe(0);
        expect(padding.right).toBe(0);
        expect(padding.bottom).toBeGreaterThan(padding.top);
    });

    test("keeps image off-center placement when the axis has room (same-axis anchor)", () => {
        // 锚定轴有保留空间时方位保持：3:2 → 4:3（近距），横轴只增不减、dL 半和分配。
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 4 / 3, basePadding: { left: 1000, right: 152, top: 64, bottom: 64 } });
        expect(frameRatio(padding, 1536, 1024)).toBeCloseTo(4 / 3, 2);
        expect(padding.left).toBeGreaterThan(padding.right);
    });

    test("flipping a large 3:2 frame to 2:3 transposes magnitude (sum conservation, user case 3283x2189)", () => {
        // 用户实测第十六/十七轮：比例切换既不能巨量放大（恒锚横轴爆炸）也不能超级加倍
        // （面积最近候选滚雪球）。裁定语义 = 外扩总量守恒的重排：3283×2189 翻 2:3 → 2189×3283。
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 2 / 3, basePadding: { left: 874, right: 873, top: 583, bottom: 582 } });
        expect(frameRatio(padding, 1536, 1024)).toBeCloseTo(2 / 3, 2);
        const frameW = 1536 + padding.left + padding.right;
        const frameH = 1024 + padding.top + padding.bottom;
        expect(frameW).toBe(2189);
        expect(frameH).toBe(3283);
        // 总外扩守恒：1747+1165 = 2912。
        expect(padding.left + padding.right + padding.top + padding.bottom).toBe(1747 + 1165);
    });

    test("clicking through the ratio list never snowballs (super-doubling regression)", () => {
        let base = { left: 874, right: 873, top: 583, bottom: 582 };
        const initialTotal = 1747 + 1165;
        let maxArea = 0;
        for (const ratio of [1, 16 / 9, 9 / 16, 4 / 3, 3 / 4, 3 / 2, 2 / 3, 1, 21 / 9, 1]) {
            base = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio, basePadding: base });
            const total = base.left + base.right + base.top + base.bottom;
            expect(total).toBeLessThanOrEqual(initialTotal + 2);
            maxArea = Math.max(maxArea, (1536 + base.left + base.right) * (1024 + base.top + base.bottom));
        }
        // 面积始终 ~S 守恒量级（≤1.25 倍初始），绝不滚雪球。
        expect(maxArea).toBeLessThan((1536 + 874 + 873) * (1024 + 583 + 582) * 1.25);
    });

    test("same-ratio re-selection keeps the frame (closest-solution tie goes to larger expansion)", () => {
        const base = { left: 874, right: 873, top: 583, bottom: 582 };
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 3 / 2, basePadding: base });
        // 3:2 重选 3:2：两解同距（都是当前框），取外扩更大者 = 保持当前框。
        expect(frameRatio(padding, 1536, 1024)).toBeCloseTo(3 / 2, 2);
        expect(padding.left).toBeGreaterThanOrEqual(873);
        expect(padding.top).toBeGreaterThanOrEqual(582);
    });

    test("re-ratioing conserves the outpaint total (magnitude follows user drags, not ratio switches)", () => {
        const padding = resolveOutpaintPaddingForRatio({ nodeWidth: 1536, nodeHeight: 1024, ratio: 3 / 2, basePadding: { left: 576, right: 576, top: 64, bottom: 64 } });
        expect(padding.left + padding.right + padding.top + padding.bottom).toBe(1152 + 128);
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
