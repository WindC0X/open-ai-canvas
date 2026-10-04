/**
 * F-08 圈选改图 —— 提交构造（纯函数，供执行链与结构断言测试共用）。
 *
 * 从弹窗 payload 构造三件提交物：提示词 / 参考图对 / 元数据。
 * 抽成纯函数的目的：执行链（editAnnotatedImageNode）只做编排，
 * 「提交了什么」由本模块单点决定且可被结构断言直接测试
 * （教训：不要用源码字符串断言验证行为）。
 */
import type { ReferenceImage } from "@/types/image";
import { buildAnnotateEditPrompt, type AnnotateEditAction, type AnnotateEditPromptNote } from "@/lib/canvas/annotate-edit-prompt";
import type { AnnotateEditAnnotation } from "@/lib/canvas/annotate-edit-geometry";

export type AnnotateEditSubmissionInput = {
    /** 源图节点 id（metadata.sourceNodeId 与标注图 id 前缀）。 */
    nodeId: string;
    /** 源图参考（nodeReferenceImage(node) 的产物）。 */
    source: ReferenceImage;
    /** 标注图 dataUrl（结构化=裁剪合成版；画笔=整图合成版）。 */
    annotatedDataUrl: string;
    /**
     * ★ R1 修复（B-2）：标注图的物化 storageKey。
     *
     * 为什么必需：`buildImageGenerationMetadata` 的 `referenceUrl` 对纯 dataUrl 返回
     * undefined（只留 storageKey/url）→ 标注图被过滤出 `metadata.references` →
     * 重试链 `resolveMetadataReferences` 只能恢复原图单图，而 prompt 仍宣称
     * 「第二张图是带标注的截图」→ 模型按单图理解，标注语义静默丢失。
     *
     * 缺省（上传失败/未传）时退化为旧行为（仅当前提交带 dataUrl 两图）。
     */
    annotatedStorageKey?: string;
    /** 编辑意图。 */
    actionHint: AnnotateEditAction;
    /** 结构化标注数（画笔模式为 0）。 */
    annotationCount: number;
    /** 画笔笔数（结构化模式为 0）。 */
    strokeCount: number;
    /** 导出截图尺寸（Cowart 元数据行）。 */
    exportWidth: number;
    exportHeight: number;
    /**
     * ★ P1 修复（通道 b）：结构化标注（含 note），按序号进提示词。
     *
     * 画笔模式为空数组（无文字输入）。
     * ★ R1 修复（B-3）：逐条标注明细**同时写入元数据**（兑现本字段早先注释里
     * 「保留完整标注供审计」的承诺 —— 此前注释承诺但函数体未落）。
     */
    annotations?: AnnotateEditAnnotation[];
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
            /**
             * ★ R1 修复（B-3）：逐条标注明细（形状 + 修改要求），供审计/重试定位。
             *
             * 兑现注释承诺（此前声称「保留完整标注供审计」但未落字段）。
             * 画笔模式无此字段（无结构化标注）。
             */
            annotations?: Array<{ shape: AnnotateEditAnnotation["shape"]; note: string }>;
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
        // ★ R1 修复（B-2）：物化 storageKey 带上 —— 否则 referenceUrl 过滤后重试链
        // 只能恢复原图单图（详见 AnnotateEditSubmissionInput.annotatedStorageKey 注释）。
        ...(input.annotatedStorageKey ? { storageKey: input.annotatedStorageKey } : {}),
    };
    // ★ P1 修复（通道 b）：结构化标注的修改要求按序号进提示词（与截图徽标一一对应）。
    const notes: AnnotateEditPromptNote[] = (input.annotations ?? [])
        .map((annotation, index) => ({ label: index + 1, shape: annotation.shape, note: annotation.note }))
        .filter((item) => item.note.trim().length > 0);
    // ★ R1 修复（B-3）：逐条标注明细进元数据（兑现「保留完整标注供审计」承诺）。
    const annotationDetails = (input.annotations ?? []).map((annotation) => ({ shape: annotation.shape, note: annotation.note }));
    return {
        prompt: buildAnnotateEditPrompt({
            // 画笔模式的「标注数」= 笔数（提示词元数据行对用户语义一致：截图上标了多少处）。
            annotationCount: input.annotationCount > 0 ? input.annotationCount : input.strokeCount,
            exportWidth: input.exportWidth,
            exportHeight: input.exportHeight,
            actionHint: input.actionHint,
            notes,
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
                ...(annotationDetails.length ? { annotations: annotationDetails } : {}),
            },
        },
    };
}
