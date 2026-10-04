/**
 * F-08 圈选改图 —— 导出合成。
 *
 * 把「原图（按联合 bounds 裁剪）+ 标注层」合成为一张 dataUrl，作为模型输入。
 * 不走 mask 通道（Cowart 视觉指示编辑路线）；不用 DOM 截图库（自绘 canvas 2D）。
 *
 * 双模式统一出口：
 * - shape：按联合 bounds 裁剪 + 4096/16M 钳制（弹窗已预检，此处为二次防线）
 * - brush：整图叠加笔画（沿用既有 annotationEdit 链语义）
 *
 * 几何来源：annotate-edit-geometry；绘制来源：annotate-edit-render（单源防漂移）。
 */
import { annotationExportSize, annotationUnionBounds, ANNOTATE_MAX_LONG_EDGE, type AnnotateEditAnnotation } from "@/lib/canvas/annotate-edit-geometry";
import { drawAnnotationShape, drawBrushStroke, type BrushStroke } from "@/lib/canvas/annotate-edit-render";

export type ComposeAnnotateEditExportInput =
    | {
          mode: "shape";
          /** 源图（弹窗内已解码的 Image 元素）。 */
          image: HTMLImageElement;
          annotations: AnnotateEditAnnotation[];
      }
    | {
          mode: "brush";
          image: HTMLImageElement;
          strokes: BrushStroke[];
      };

export type ComposeAnnotateEditExportResult = {
    /** 合成图 dataUrl（png）。 */
    dataUrl: string;
    /** 合成像素尺寸（shape=裁剪后尺寸；brush=原图尺寸）。 */
    width: number;
    height: number;
};

/**
 * 合成导出图。
 *
 * shape 模式超钳制时抛错（弹窗侧应先以 annotationExportSize 预检并给用户提示）。
 */
export function composeAnnotateEditExport(input: ComposeAnnotateEditExportInput): ComposeAnnotateEditExportResult {
    const imageWidth = input.image.naturalWidth;
    const imageHeight = input.image.naturalHeight;

    if (input.mode === "brush") {
        const canvas = document.createElement("canvas");
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("无法创建导出画布");
        context.drawImage(input.image, 0, 0, canvas.width, canvas.height);
        input.strokes.forEach((stroke) => drawBrushStroke(context, stroke));
        return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
    }

    const bounds = annotationUnionBounds(input.annotations, imageWidth, imageHeight);
    if (!bounds) throw new Error("没有可导出的标注");
    const exportSize = annotationExportSize(bounds);
    if (exportSize.tooLarge) {
        throw new Error(`标注范围导出尺寸 ${exportSize.width} × ${exportSize.height} 超过上限。请将标注移近，或先把图片长边缩到不超过 ${ANNOTATE_MAX_LONG_EDGE}px`);
    }

    const canvas = document.createElement("canvas");
    canvas.width = exportSize.width;
    canvas.height = exportSize.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建导出画布");
    // 白底：标注截图交模型时透明区域语义不确定，统一垫白底。
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // 原图按 bounds 裁剪 → 缩放到导出画布。
    context.drawImage(input.image, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, canvas.width, canvas.height);
    // 标注层：按原图像素空间绘制，先缩放到导出空间再画（与预览视觉一致）。
    context.save();
    context.scale(canvas.width / bounds.width, canvas.height / bounds.height);
    context.translate(-bounds.left, -bounds.top);
    input.annotations.forEach((annotation, index) => drawAnnotationShape(context, annotation, imageWidth, imageHeight, index + 1));
    context.restore();

    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}
