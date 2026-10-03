/**
 * F-08 圈选改图 —— 兜底路径：标注转蒙版（降级走既有 mask 通道）。
 *
 * 任务书 §7 风险 1 兜底路线（控制线裁定：必须真实验证一次，非纸面备胎）：
 * 当模型/渠道对「标注截图 + 指令」的遵循度不可用时，把结构化标注转成
 * maskEditImageNode 认识的蒙版——标注区 = 透明（模型据此重绘），其余 = 白。
 *
 * 与 mask 弹窗的 `buildEditMask` 同构：白色底 + 标注区清空 alpha，
 * 因为 mask 通道的语义是「透明区域 = 要修改的区域」。
 */
import type { AnnotateEditAnnotation } from "@/lib/canvas/annotate-edit-geometry";
import { annotationPixelBounds } from "@/lib/canvas/annotate-edit-geometry";
import { drawBrushStroke, type BrushStroke } from "@/lib/canvas/annotate-edit-render";

/** 蒙版涂抹区（像素空间矩形，left/top 对齐 canvas fillRect）。 */
export type AnnotateMaskStroke = { left: number; top: number; width: number; height: number };

/**
 * 计算降级蒙版的涂抹区（像素空间矩形列表）。
 *
 * region 直接取矩形；arrow 取线段包围盒并按笔刷宽度外扩——箭头是「指向」语义，
 * 降级通道没有方向概念，只能把指向的落点附近一起纳入重绘范围。
 */
export function annotationMaskStrokes(annotations: AnnotateEditAnnotation[], imageWidth: number, imageHeight: number, brushPadding = 24): AnnotateMaskStroke[] {
    return annotations.map((annotation) => {
        const bounds = annotationPixelBounds(annotation, imageWidth, imageHeight);
        if (annotation.shape !== "arrow") return bounds;
        return {
            left: Math.max(0, bounds.left - brushPadding),
            top: Math.max(0, bounds.top - brushPadding),
            width: Math.min(imageWidth, bounds.width + brushPadding * 2) || brushPadding * 2,
            height: Math.min(imageHeight, bounds.height + brushPadding * 2) || brushPadding * 2,
        };
    });
}

/**
 * 合成降级蒙版 dataUrl（白底 + 标注区透明）。
 *
 * 输出为 PNG dataUrl，直接可作 `runBackendCanvasGenerationTask` 的 `mask` 字段
 * （与 maskEditImageNode 的 `payload.maskDataUrl` 同形）。
 */
export function composeAnnotationMaskDataUrl(annotations: AnnotateEditAnnotation[], imageWidth: number, imageHeight: number): string {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imageWidth));
    canvas.height = Math.max(1, Math.round(imageHeight));
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // 标注区透明：globalCompositeOperation destination-out 与画笔擦除同语义。
    context.globalCompositeOperation = "destination-out";
    for (const stroke of annotationMaskStrokes(annotations, canvas.width, canvas.height)) {
        context.fillRect(stroke.left, stroke.top, stroke.width, stroke.height);
    }
    context.globalCompositeOperation = "source-over";
    return canvas.toDataURL("image/png");
}

/**
 * 降级提示词：标注文字合并为修改要求（mask 通道没有标注截图，只有文字）。
 *
 * 与 `buildAnnotateEditPrompt` 的差别：不声明两图协议、不提标注截图，
 * 改为声明「白色区域保持不变、透明区域按文字修改」——这正是 maskEdit 的语义。
 */
export function buildAnnotateMaskFallbackPrompt(annotations: AnnotateEditAnnotation[]): string {
    const notes = annotations.map((annotation) => annotation.note.trim()).filter(Boolean);
    const requirement = notes.length > 0 ? notes.join("；") : "按标注区域修改内容";
    return `只修改蒙版透明区域，其他区域保持不变。${requirement}`;
}

/**
 * 画笔笔迹转蒙版 dataUrl（白底 + 涂抹区透明）。
 *
 * 画笔与结构化标注同属「标记要修改的区域」，故降级语义一致；
 * 擦除笔迹（erase）恢复为不修改，即回填白色。
 */
export function composeBrushMaskDataUrl(strokes: BrushStroke[], imageWidth: number, imageHeight: number): string {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imageWidth));
    canvas.height = Math.max(1, Math.round(imageHeight));
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
        if (stroke.erase) {
            // 擦除笔迹 = 恢复为「不修改」：把该段填回白色。
            context.save();
            context.globalCompositeOperation = "source-over";
            drawBrushStroke(context, { ...stroke, color: "#fff", erase: false });
            context.restore();
            continue;
        }
        context.save();
        context.globalCompositeOperation = "destination-out";
        drawBrushStroke(context, { ...stroke, color: "#000", erase: false });
        context.restore();
    }
    return canvas.toDataURL("image/png");
}
