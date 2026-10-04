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

/**
 * 标注文字（note）渲染样式 —— ★ P1 修复通道 (a)。
 *
 * 蓝本语义（Cowart ANNOTATION_EDIT_PROMPT:158）：截图必须包含「标注箭头**和标注文字**」——
 * 用户填写的修改要求必须可见于交给模型的截图，否则模型只能靠猜。
 *
 * ★ 可读性底线（控制线裁定）：最小字号 + 高对比底标 + 随 imageWidth 缩放，
 * 且**同一函数**同时服务弹窗实时画布与导出截图（所见即模型所见）。
 */
export const annotateNoteColor = "#ffffff";
export const annotateNoteBackgroundColor = "rgba(15, 23, 42, .88)";
/** 字号随图宽缩放：1024px 图 → 约 30px；下限 18px 保证小图可读。 */
const noteFontSize = (imageWidth: number) => Math.max(18, Math.round(imageWidth / 34));
/** 文字行高倍数。 */
const NOTE_LINE_HEIGHT = 1.3;
/** 文字框内边距（按字号比例）。 */
const notePadding = (fontSize: number) => Math.round(fontSize * 0.45);
/** 单行最大字符数（超出折行，避免文字框横穿整图）。 */
const NOTE_MAX_CHARS_PER_LINE = 22;
/** 最多渲染行数（超出截断，防止超长文字淹没画面）。 */
const NOTE_MAX_LINES = 6;

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
        drawLabelBadge(context, label, left, top, imageWidth, imageHeight);
        drawAnnotationNote(context, annotation.note, left + width, top, imageWidth, imageHeight);
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
    drawLabelBadge(context, label, fromX, fromY, imageWidth, imageHeight);
    drawAnnotationNote(context, annotation.note, toX, toY, imageWidth, imageHeight);
}

/**
 * ★ P1 修复（通道 a）：把用户填写的修改要求（note）画进截图。
 *
 * 蓝本依据：Cowart 语义要求截图包含标注文字，模型据此理解修改意图。
 * 无 note 时不绘制（画笔模式与空 note 兼容）。
 *
 * 布局：文字框紧贴标注锚点（region 右上角 / arrow 终点），越界时自动回退到内侧，
 * 保证文字框完整落在画布内（导出截图会裁到 bounds，文字必须在界内才可见）。
 */
export function drawAnnotationNote(context: CanvasRenderingContext2D, note: string | undefined, anchorX: number, anchorY: number, imageWidth: number, imageHeight: number) {
    const text = (note ?? "").trim();
    if (!text) return;
    const fontSize = noteFontSize(imageWidth);
    const padding = notePadding(fontSize);
    const lineHeight = Math.round(fontSize * NOTE_LINE_HEIGHT);
    const lines = wrapNoteText(text, NOTE_MAX_CHARS_PER_LINE, NOTE_MAX_LINES);

    context.save();
    context.font = `600 ${fontSize}px sans-serif`;
    const textWidth = Math.max(...lines.map((line) => context.measureText(line).width));
    const boxWidth = textWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;

    // 锚点偏移：默认贴右侧；右侧越界则回退到锚点左侧；上下同理。
    let boxX = anchorX + padding;
    if (boxX + boxWidth > imageWidth) boxX = anchorX - padding - boxWidth;
    boxX = Math.min(Math.max(0, boxX), Math.max(0, imageWidth - boxWidth));
    let boxY = anchorY - boxHeight / 2;
    boxY = Math.min(Math.max(0, boxY), Math.max(0, imageHeight - boxHeight));

    // 高对比底标（保证任意画面上文字可读）。
    context.fillStyle = annotateNoteBackgroundColor;
    context.beginPath();
    const radius = Math.round(fontSize * 0.3);
    context.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
    context.fill();

    context.fillStyle = annotateNoteColor;
    context.textAlign = "left";
    context.textBaseline = "top";
    lines.forEach((line, index) => {
        context.fillText(line, boxX + padding, boxY + padding + index * lineHeight);
    });
    context.restore();
}

/** 按字符数折行（中文优先按字断行；英文单词整体不拆）。超出 maxLines 时末行加省略号。 */
function wrapNoteText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
    const lines: string[] = [];
    let current = "";
    // 以「非空格字符簇」为单位推进：中文单字成簇，英文单词整体成簇。
    const tokens = text.match(/[A-Za-z0-9_.]+|\s+|./gu) ?? [];
    for (const token of tokens) {
        if (lines.length >= maxLines) break;
        const candidate = current + token;
        if (visibleLength(candidate) > maxCharsPerLine && current.trim()) {
            lines.push(current.trimEnd());
            current = token.trimStart();
            continue;
        }
        current = candidate;
    }
    if (lines.length < maxLines && current.trim()) lines.push(current.trimEnd());
    if (lines.length === maxLines && visibleLength(text) > lines.join("").length) {
        lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+$/, "")}…`;
    }
    return lines.length > 0 ? lines : [text.slice(0, maxCharsPerLine)];
}

/** 可见字符数（CJK 与 ASCII 同权，用于折行估算）。 */
function visibleLength(text: string): number {
    return text.length;
}

/**
 * 序号徽标（白色数字圆点，钉在标注起点）。
 *
 * ★ R1 修复（B-1）：clamp 必须用**原图像素空间**（imageWidth/imageHeight），
 * 不能用 `context.canvas` 尺寸 —— 导出路径先 scale+translate 再绘制
 * （annotate-edit-export.ts），canvas 尺寸是**裁剪后的导出画布**，与原图坐标空间不同。
 * 原实现按 canvas 尺寸 clamp，会把超出导出画布的锚点拉到 [radius, canvas.width-radius]，
 * 再经 translate(-bounds.left) 变成负坐标 → 徽标整体跑出画布左侧，且多条重合
 * （评审线实测：正确落点 [32,1432]，实际 [-354,-654]）。
 */
function drawLabelBadge(context: CanvasRenderingContext2D, label: number, x: number, y: number, imageWidth: number, imageHeight: number) {
    const radius = Math.max(10, imageWidth / 80);
    const { x: centerX, y: centerY } = badgeCenter(x, y, imageWidth, imageHeight, radius);
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

/**
 * 徽标圆心 clamp（★ R1 修复 B-1 的**真接缝**，导出供接线级测试直接断言）。
 *
 * 坐标系 = **原图像素空间**（与 drawAnnotationShape 的绘制坐标一致）。
 * 用 imageWidth/imageHeight 而非 `context.canvas` 尺寸 —— 后者在导出路径是
 * 裁剪后的画布尺寸，坐标系错位会让徽标跑到画布外（评审线实测）。
 */
export function badgeCenter(x: number, y: number, imageWidth: number, imageHeight: number, radius: number) {
    return {
        x: Math.min(Math.max(x, radius), Math.max(radius, imageWidth - radius)),
        y: Math.min(Math.max(y, radius), Math.max(radius, imageHeight - radius)),
    };
}
