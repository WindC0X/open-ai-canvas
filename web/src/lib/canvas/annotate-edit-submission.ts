/**
 * F-08 圈选改图 —— 提交构造（纯函数，供执行链与结构断言测试共用）。
 *
 * 从弹窗 payload 构造三件提交物：提示词 / 参考图对 / 元数据。
 * 抽成纯函数的目的：执行链（editAnnotatedImageNode）只做编排，
 * 「提交了什么」由本模块单点决定且可被结构断言直接测试
 * （教训：不要用源码字符串断言验证行为）。
 */
import type { ReferenceImage } from "@/types/image";
import { buildAnnotateEditPrompt, type AnnotateEditAction } from "@/lib/canvas/annotate-edit-prompt";

export type AnnotateEditSubmissionInput = {
    /** 源图节点 id（metadata.sourceNodeId 与标注图 id 前缀）。 */
    nodeId: string;
    /** 源图参考（nodeReferenceImage(node) 的产物）。 */
    source: ReferenceImage;
    /** 标注图 dataUrl（结构化=裁剪合成版；画笔=整图合成版）。 */
    annotatedDataUrl: string;
    /** 编辑意图。 */
    actionHint: AnnotateEditAction;
    /** 结构化标注数（画笔模式为 0）。 */
    annotationCount: number;
    /** 画笔笔数（结构化模式为 0）。 */
    strokeCount: number;
    /** 导出截图尺寸（Cowart 元数据行）。 */
    exportWidth: number;
    exportHeight: number;
};

export type AnnotateEditSubmission = {
    prompt: string;
    /** [原图, 标注图] 两图协议。 */
    referenceImages: [ReferenceImage, ReferenceImage];
    metadata: {
        sourceNodeId: string;
        edit: "annotation";
        annotateEdit: {
            actionHint: AnnotateEditAction;
            annotationCount: number;
            strokeCount: number;
            exportWidth: number;
            exportHeight: number;
        };
    };
};

/**
 * 执行路线裁决（纯函数）：标注截图协议 vs 蒙版降级。
 *
 * 标注截图路线需要 [原图, 标注图] 两张参考图；模型参考图上限不足时，
 * 若它支持蒙版则降级走既有 mask 通道（任务书 §7-1 兜底路线），
 * 否则返回 unsupported 由调用方给明确报错。
 */
export type AnnotateEditRoute = "annotation" | "mask" | "unsupported";

export function resolveAnnotateEditRoute(input: { maxReferenceImages: number; maskSupported: boolean }): AnnotateEditRoute {
    if (input.maxReferenceImages >= 2) return "annotation";
    if (input.maskSupported) return "mask";
    return "unsupported";
}

export type AnnotateMaskSubmissionInput = {
    nodeId: string;
    /** 源图参考（nodeReferenceImage(node) 的产物）。 */
    source: ReferenceImage;
    /** 已合成的蒙版 dataUrl（白底 + 标注区透明）。 */
    maskDataUrl: string;
    /** 降级提示词（标注文字合并版）。 */
    prompt: string;
    actionHint: AnnotateEditAction;
    annotationCount: number;
    strokeCount: number;
};

export type AnnotateMaskSubmission = {
    prompt: string;
    /** 单图 + 蒙版：mask 通道不接受标注截图。 */
    referenceImages: [ReferenceImage];
    mask: ReferenceImage;
    metadata: {
        sourceNodeId: string;
        edit: "annotation";
        annotateEdit: {
            actionHint: AnnotateEditAction;
            annotationCount: number;
            strokeCount: number;
            /** 降级标记：重试/审计据此区分走了哪条通道。 */
            fallback: "mask";
        };
    };
};

/** 构造蒙版降级路线的提交物（提示词 + 单图 + 蒙版 + 元数据）。 */
export function buildAnnotateMaskSubmission(input: AnnotateMaskSubmissionInput): AnnotateMaskSubmission {
    return {
        prompt: input.prompt,
        referenceImages: [input.source],
        mask: { id: `${input.nodeId}-annotation-mask`, name: "annotation-mask.png", type: "image/png", dataUrl: input.maskDataUrl },
        metadata: {
            sourceNodeId: input.nodeId,
            edit: "annotation",
            annotateEdit: {
                actionHint: input.actionHint,
                annotationCount: input.annotationCount,
                strokeCount: input.strokeCount,
                fallback: "mask",
            },
        },
    };
}

/** 构造圈选改图的提交物（提示词 + 两图参考 + 元数据）。 */
export function buildAnnotateEditSubmission(input: AnnotateEditSubmissionInput): AnnotateEditSubmission {
    const annotatedReference: ReferenceImage = {
        id: `${input.nodeId}-annotation`,
        name: "annotation.png",
        type: "image/png",
        dataUrl: input.annotatedDataUrl,
    };
    return {
        prompt: buildAnnotateEditPrompt({
            // 画笔模式的「标注数」= 笔数（提示词元数据行对用户语义一致：截图上标了多少处）。
            annotationCount: input.annotationCount > 0 ? input.annotationCount : input.strokeCount,
            exportWidth: input.exportWidth,
            exportHeight: input.exportHeight,
            actionHint: input.actionHint,
        }),
        referenceImages: [input.source, annotatedReference],
        metadata: {
            sourceNodeId: input.nodeId,
            edit: "annotation",
            annotateEdit: {
                actionHint: input.actionHint,
                annotationCount: input.annotationCount,
                strokeCount: input.strokeCount,
                exportWidth: input.exportWidth,
                exportHeight: input.exportHeight,
            },
        },
    };
}
