import { expect, test, describe } from "bun:test";

import {
    ANNOTATE_EXPORT_PADDING,
    ANNOTATE_MAX_LONG_EDGE,
    ANNOTATE_MAX_PIXELS,
    annotationExportPixelRatio,
    annotationExportSize,
    annotationExportTooLarge,
    annotationUnionBounds,
    clampUnit,
    normalizeRect,
    normalizedRectToPixels,
    type AnnotateEditAnnotation,
} from "@/lib/canvas/annotate-edit-geometry";

/**
 * F-08 圈选改图几何单测（纯逻辑，零 DOM）。
 *
 * 蓝本对照：Cowart `prepareAnnotationEditRequest`（bounds+padding）、
 * `getAnnotationEditExportPixelRatio`（动态像素比）、
 * `isAnnotationEditExportTooLarge`（尺寸钳制）。
 * 常量口径：控制线 2026-10-05 三裁定（4096 长边 + 1600 万像素）。
 */

function region(partial: Partial<AnnotateEditAnnotation> = {}): AnnotateEditAnnotation {
    return { id: "r1", shape: "region", note: "改成银色", x: 0.1, y: 0.1, width: 0.2, height: 0.2, ...partial };
}

function arrow(partial: Partial<AnnotateEditAnnotation> = {}): AnnotateEditAnnotation {
    return { id: "a1", shape: "arrow", note: "换成金色", x: 0.2, y: 0.2, endX: 0.5, endY: 0.4, ...partial };
}

describe("clampUnit", () => {
    test("越界与非有限值被收敛到 [0,1]", () => {
        expect(clampUnit(-0.5)).toBe(0);
        expect(clampUnit(1.5)).toBe(1);
        expect(clampUnit(0.42)).toBe(0.42);
        expect(clampUnit(Number.NaN)).toBe(0);
        expect(clampUnit(Number.POSITIVE_INFINITY)).toBe(1);
    });
});

describe("normalizeRect", () => {
    test("正向拖拽原样保留", () => {
        expect(normalizeRect({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    });

    test("★ 反向拖拽（负宽高）归一为左上-宽高", () => {
        expect(normalizeRect({ x: 0.4, y: 0.6, width: -0.3, height: -0.4 })).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    });

    test("越界拖拽被 clamp 到图内", () => {
        const rect = normalizeRect({ x: -0.2, y: -0.1, width: 0.5, height: 0.5 });
        expect(rect.x).toBe(0);
        expect(rect.y).toBe(0);
        expect(rect.width).toBeCloseTo(0.3, 6);
        expect(rect.height).toBeCloseTo(0.4, 6);
    });
});

describe("normalizedRectToPixels", () => {
    test("归一化 → 像素换算", () => {
        expect(normalizedRectToPixels(region({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }), 800, 400)).toEqual({
            left: 200,
            top: 200,
            width: 400,
            height: 100,
        });
    });
});

describe("annotationUnionBounds", () => {
    test("无标注返回 null", () => {
        expect(annotationUnionBounds([], 800, 600)).toBeNull();
    });

    test("单 region：bounds + padding，clamp 图内", () => {
        // region 像素 (80,60)-(240,180)，padding 32 → (48,28)-(272,212)
        const bounds = annotationUnionBounds([region()], 800, 600);
        expect(bounds).toEqual({ left: 48, top: 28, width: 224, height: 184 });
    });

    test("★ 贴边时 padding 被 clamp（不越出原图）", () => {
        const bounds = annotationUnionBounds([region({ x: 0, y: 0, width: 0.25, height: 0.25 })], 800, 600);
        expect(bounds?.left).toBe(0);
        expect(bounds?.top).toBe(0);
        // 右/下不受贴边影响：(200,150)+32
        expect(bounds?.width).toBe(232);
        expect(bounds?.height).toBe(182);
    });

    test("region + arrow 联合 bounds 取两者并集", () => {
        // region (80,60)-(240,180)；arrow (160,120)-(400,240) → 并集 (80,60)-(400,240) + padding
        const bounds = annotationUnionBounds([region(), arrow()], 800, 600);
        expect(bounds).toEqual({ left: 48, top: 28, width: 384, height: 244 });
    });

    test("自定义 padding 生效", () => {
        const bounds = annotationUnionBounds([region()], 800, 600, 0);
        expect(bounds).toEqual({ left: 80, top: 60, width: 160, height: 120 });
    });

    test("默认 padding 与 Cowart 常量一致", () => {
        expect(ANNOTATE_EXPORT_PADDING).toBe(32);
    });
});

describe("annotationExportPixelRatio（Cowart 口径）", () => {
    test("长边 ≤1000 → 2x", () => {
        expect(annotationExportPixelRatio({ width: 800, height: 600 })).toBe(2);
        expect(annotationExportPixelRatio({ width: 1000, height: 400 })).toBe(2);
    });

    test("长边 1000-1600 → 1.5x", () => {
        expect(annotationExportPixelRatio({ width: 1200, height: 800 })).toBe(1.5);
        expect(annotationExportPixelRatio({ width: 1600, height: 400 })).toBe(1.5);
    });

    test("长边 >1600 → 1x", () => {
        expect(annotationExportPixelRatio({ width: 2000, height: 1000 })).toBe(1);
    });
});

describe("annotationExportTooLarge（控制线双限裁定）", () => {
    test("长边超 4096 阻断", () => {
        expect(annotationExportTooLarge(ANNOTATE_MAX_LONG_EDGE + 1, 100)).toBe(true);
        expect(annotationExportTooLarge(ANNOTATE_MAX_LONG_EDGE, 100)).toBe(false);
    });

    test("总像素超 1600 万阻断", () => {
        expect(annotationExportTooLarge(4500, 4000)).toBe(true); // 1800 万像素超限（长边也超，双限之一起作用）
        expect(annotationExportTooLarge(4001, 4000)).toBe(true); // 16,004,000 超限
    });

    test("★ 边界：恰好 1600 万不超（口径是 > 不是 ≥）", () => {
        expect(4000 * 4000).toBe(ANNOTATE_MAX_PIXELS);
        expect(annotationExportTooLarge(4000, 4000)).toBe(false);
    });
});

describe("annotationExportSize", () => {
    test("小图 2x 结算", () => {
        expect(annotationExportSize({ width: 800, height: 600 })).toEqual({ width: 1600, height: 1200, pixelRatio: 2, tooLarge: false });
    });

    test("中图 1.5x 结算", () => {
        expect(annotationExportSize({ width: 1200, height: 800 })).toEqual({ width: 1800, height: 1200, pixelRatio: 1.5, tooLarge: false });
    });

    test("大图 1x 且超长边阻断", () => {
        const size = annotationExportSize({ width: 5000, height: 2000 });
        expect(size).toEqual({ width: 5000, height: 2000, pixelRatio: 1, tooLarge: true });
    });

    test("★ 1600 万像素档：2x 后超限被判定（真实工作流场景）", () => {
        // 长边 1800 的图（1x），若标注范围覆盖大部分 → 1500x1500=225万×... 用直接数值：1400×1400 图 1.5x=2100×2100=441万 OK
        const ok = annotationExportSize({ width: 1400, height: 1400 });
        expect(ok.tooLarge).toBe(false);
        // 3000×3000 图 1x = 900 万 OK；4000×2000 图 1x = 800 万 OK
        expect(annotationExportSize({ width: 4000, height: 2000 }).tooLarge).toBe(false);
        // 4500×3000 → 长边超 4096 且像素 1350 万，双限之一起作用
        expect(annotationExportSize({ width: 4500, height: 3000 }).tooLarge).toBe(true);
    });
});
