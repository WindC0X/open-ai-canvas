/**
 * F-08 圈选改图 —— 兜底路径（标注转 mask 降级）测试。
 *
 * 任务书 §7-1 兜底路线：模型参考图上限不足时，把标注转成蒙版走既有 mask 通道。
 * 本文件只测纯函数（路线裁决 / 蒙版涂抹区几何 / 降级提示词 / 提交构造），
 * canvas 合成与真机链路走实测（见任务卡验收证据）。
 */
import { describe, expect, test } from "bun:test";

import { annotationMaskStrokes, buildAnnotateMaskFallbackPrompt } from "@/lib/canvas/annotate-edit-mask";
import { buildAnnotateMaskSubmission, resolveAnnotateEditRoute } from "@/lib/canvas/annotate-edit-submission";
import type { AnnotateEditAnnotation } from "@/lib/canvas/annotate-edit-geometry";

const region = (overrides: Partial<AnnotateEditAnnotation> = {}): AnnotateEditAnnotation => ({
    id: "a1",
    shape: "region",
    note: "改成金属材质",
    x: 0.25,
    y: 0.25,
    width: 0.25,
    height: 0.25,
    ...overrides,
});

const arrow = (overrides: Partial<AnnotateEditAnnotation> = {}): AnnotateEditAnnotation => ({
    id: "a2",
    shape: "arrow",
    note: "把这里替换成蓝色",
    x: 0.1,
    y: 0.1,
    endX: 0.3,
    endY: 0.3,
    ...overrides,
});

describe("resolveAnnotateEditRoute（路线裁决）", () => {
    test("★ 参考图上限 ≥2 走标注截图路线", () => {
        expect(resolveAnnotateEditRoute({ maxReferenceImages: 2, maskSupported: false })).toBe("annotation");
        expect(resolveAnnotateEditRoute({ maxReferenceImages: 16, maskSupported: true })).toBe("annotation");
    });

    test("★ 参考图上限 <2 且支持蒙版 → 降级走 mask 通道", () => {
        expect(resolveAnnotateEditRoute({ maxReferenceImages: 1, maskSupported: true })).toBe("mask");
        expect(resolveAnnotateEditRoute({ maxReferenceImages: 0, maskSupported: true })).toBe("mask");
    });

    test("★ 两者都不满足 → unsupported（能力不可用，调用方须报错而非静默）", () => {
        expect(resolveAnnotateEditRoute({ maxReferenceImages: 1, maskSupported: false })).toBe("unsupported");
        expect(resolveAnnotateEditRoute({ maxReferenceImages: 0, maskSupported: false })).toBe("unsupported");
    });
});

describe("annotationMaskStrokes（蒙版涂抹区几何）", () => {
    test("region 取矩形像素包围盒（归一化 0.25-0.5 × 800×600 → 200,150,200,150）", () => {
        expect(annotationMaskStrokes([region()], 800, 600)).toEqual([{ left: 200, top: 150, width: 200, height: 150 }]);
    });

    test("arrow 取线段包围盒并按笔刷宽度外扩", () => {
        const strokes = annotationMaskStrokes([arrow()], 1000, 1000, 24);
        // 线段 100,100 → 300,300，外扩 24 → 76,76 尺寸 248×248
        expect(strokes).toEqual([{ left: 76, top: 76, width: 248, height: 248 }]);
    });

    test("arrow 外扩被原图边界 clamp（不越界）", () => {
        const strokes = annotationMaskStrokes([arrow({ x: 0, y: 0, endX: 0, endY: 0 })], 500, 500, 24);
        expect(strokes[0].left).toBe(0);
        expect(strokes[0].top).toBe(0);
    });

    test("多标注逐条返回", () => {
        expect(annotationMaskStrokes([region(), arrow()], 800, 600)).toHaveLength(2);
    });

    test("空标注返回空数组（调用方据 annotationCount 分支）", () => {
        expect(annotationMaskStrokes([], 800, 600)).toEqual([]);
    });
});

describe("buildAnnotateMaskFallbackPrompt（降级提示词）", () => {
    test("★ 声明蒙版语义（透明区修改）而非两图协议", () => {
        const prompt = buildAnnotateMaskFallbackPrompt([region()]);
        expect(prompt).toContain("只修改蒙版透明区域");
        expect(prompt).not.toContain("第二张图是带标注的截图");
    });

    test("标注文字合并为修改要求", () => {
        const prompt = buildAnnotateMaskFallbackPrompt([region(), arrow()]);
        expect(prompt).toContain("改成金属材质");
        expect(prompt).toContain("把这里替换成蓝色");
    });

    test("空 note 被过滤；全空时给兜底要求", () => {
        expect(buildAnnotateMaskFallbackPrompt([region({ note: "  " })])).toContain("按标注区域修改内容");
    });
});

describe("buildAnnotateMaskSubmission（降级提交构造）", () => {
    const input = {
        nodeId: "node-1",
        source: { id: "node-1", name: "source.png", type: "image/png", dataUrl: "data:image/png;base64,AAAA" },
        maskDataUrl: "data:image/png;base64,BBBB",
        prompt: "只修改蒙版透明区域，其他区域保持不变。改成金属材质",
        actionHint: "modify" as const,
        annotationCount: 1,
        strokeCount: 0,
    };

    test("★ 单图 + 蒙版（不带标注截图参考）", () => {
        const submission = buildAnnotateMaskSubmission(input);
        expect(submission.referenceImages).toHaveLength(1);
        expect(submission.referenceImages[0].id).toBe("node-1");
        expect(submission.mask.dataUrl).toBe("data:image/png;base64,BBBB");
        expect(submission.mask.name).toBe("annotation-mask.png");
    });

    test("★ 元数据带 fallback 标记（审计/重试可区分通道）", () => {
        const submission = buildAnnotateMaskSubmission(input);
        expect(submission.metadata).toEqual({
            sourceNodeId: "node-1",
            edit: "annotation",
            annotateEdit: { actionHint: "modify", annotationCount: 1, strokeCount: 0, fallback: "mask" },
        });
    });
});
