/**
 * F-08 圈选改图 —— 标注渲染共享函数。
 *
 * 弹窗预览（canvas-node-annotate-edit-dialog）与导出合成（annotate-edit-export）
 * 必须渲染同一套视觉——单源在此，两处 import，防两套画法漂移。
 *
 * 坐标系：调用方负责设置变换，本模块按「原图像素空间」绘制。
 */
import { clampUnit, normalizeRect, type AnnotateEditAnnotation } from "@/lib/canvas/annotate-edit-geometry";

export const annotateRegionFillColor = "rgba(37, 99, 235, .28)";
export const annotateRegionBorderColor = "rgba(37, 99, 235, .85)";
export const annotateArrowColor = "rgba(37, 99, 235, .95)";
export const annotateLabelColor = "rgba(255, 255, 255, .95)";

/** 自由笔刷笔画（弹窗预览与导出合成共用）。 */
export type BrushStroke = { color: string; size: number; erase: boolean; points: Array<{ x: number; y: number }> };

/** 在 context 上绘制一条笔刷笔画（原图像素空间）。 */
export function drawBrushStroke(context: CanvasRenderingContext2D, stroke: BrushStroke) {
    if (!stroke.points.length) return;
    context.save();
    context.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    const first = stroke.points[0];
    if (stroke.points.length === 1) {
        context.beginPath();
        context.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2);
        context.fill();
    } else {
        context.beginPath();
        context.moveTo(first.x, first.y);
        stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.stroke();
    }
    context.restore();
}

/** 在 context 上绘制一条标注（原图像素空间，调用方负责变换与清屏）。 */
export function drawAnnotationShape(context: CanvasRenderingContext2D, annotation: AnnotateEditAnnotation, imageWidth: number, imageHeight: number, label: number) {
    if (annotation.shape === "region") {
        const rect = normalizeRect(annotation);
        const left = rect.x * imageWidth;
        const top = rect.y * imageHeight;
        const width = rect.width * imageWidth;
        const height = rect.height * imageHeight;
        context.fillStyle = annotateRegionFillColor;
        context.fillRect(left, top, width, height);
        context.strokeStyle = annotateRegionBorderColor;
        context.lineWidth = Math.max(1, imageWidth / 400);
        context.setLineDash([8, 6]);
        context.strokeRect(left, top, width, height);
        context.setLineDash([]);
        drawLabelBadge(context, label, left, top, imageWidth);
        return;
    }

    const fromX = clampUnit(annotation.x) * imageWidth;
    const fromY = clampUnit(annotation.y) * imageHeight;
    const toX = clampUnit(annotation.endX ?? annotation.x) * imageWidth;
    const toY = clampUnit(annotation.endY ?? annotation.y) * imageHeight;
    context.strokeStyle = annotateArrowColor;
    context.fillStyle = annotateArrowColor;
    context.lineWidth = Math.max(2, imageWidth / 300);
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();
    // 箭头头部：终点回折 ±30° 两条短线。
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLength = Math.max(10, imageWidth / 60);
    for (const offset of [Math.PI / 6, -Math.PI / 6]) {
        context.beginPath();
        context.moveTo(toX, toY);
        context.lineTo(toX - headLength * Math.cos(angle + offset), toY - headLength * Math.sin(angle + offset));
        context.stroke();
    }
    drawLabelBadge(context, label, fromX, fromY, imageWidth);
}

/** 序号徽标（白色数字圆点，钉在标注起点）。 */
function drawLabelBadge(context: CanvasRenderingContext2D, label: number, x: number, y: number, imageWidth: number) {
    const radius = Math.max(10, imageWidth / 80);
    const centerX = Math.min(Math.max(x, radius), context.canvas.width - radius);
    const centerY = Math.min(Math.max(y, radius), context.canvas.height - radius);
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = annotateArrowColor;
    context.fill();
    context.fillStyle = annotateLabelColor;
    context.font = `600 ${Math.round(radius * 1.2)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(label), centerX, centerY);
}
