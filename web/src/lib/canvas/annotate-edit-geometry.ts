/**
 * F-08 圈选改图 —— 标注几何纯函数。
 *
 * 蓝本：Cowart `buildAnnotationEditPrompt` / `prepareAnnotationEditRequest`
 * （App.jsx:1206/:1279，一手验证）。本模块只做纯数学，不做生成：
 * 归一化坐标 ↔ 像素、联合 bounds + padding、动态像素比、导出尺寸钳制。
 *
 * 常量口径（控制线 2026-10-05 三裁定）：
 * - 长边 4096 硬顶（与 F-06 对齐）
 * - 总像素 1600 万上限（Cowart `ANNOTATION_EDIT_MAX_EXPORT_PIXELS` 沿用）
 * - 动态像素比照 Cowart `getAnnotationEditExportPixelRatio`（≤1000→2x / ≤1600→1.5x / >1600→1x）
 */

/** 标注形状：矩形区域 / 箭头（v1 只做这两种，freehand 不做）。 */
export type AnnotateEditShape = "region" | "arrow";

/**
 * 标注（归一化坐标 0-1，相对原图）。
 *
 * 与 og-canvas `visualIntentAnnotations` 同构（仅形状与坐标可参考，其转写提示词禁用），
 * 为 F-11 文字层检测框留 `type` 扩展位。
 */
export type AnnotateEditAnnotation = {
    id: string;
    shape: AnnotateEditShape;
    /** 用户文字要求（提交校验要求非空）。 */
    note: string;
    /** 起点（region 左上角 / arrow 箭尾），归一化 0-1。 */
    x: number;
    y: number;
    /** region 宽高（归一化）；arrow 不用。 */
    width?: number;
    height?: number;
    /** arrow 终点（归一化）；region 不用。 */
    endX?: number;
    endY?: number;
};

/** 像素空间矩形（原图像素坐标）。 */
export type PixelRect = { left: number; top: number; width: number; height: number };

/** 导出尺寸结算结果。 */
export type AnnotateExportSize = {
    width: number;
    height: number;
    pixelRatio: number;
    /** 是否超钳制（true 时调用方必须阻断并提示）。 */
    tooLarge: boolean;
};

/** 导出范围 padding（照 Cowart `ANNOTATION_EDIT_EXPORT_PADDING`）。 */
export const ANNOTATE_EXPORT_PADDING = 32;

/** 长边硬顶（控制线裁定：与 F-06 对齐 4096）。 */
export const ANNOTATE_MAX_LONG_EDGE = 4096;

/** 总像素上限（控制线裁定：Cowart 1600 万沿用）。 */
export const ANNOTATE_MAX_PIXELS = 16_000_000;

/** 归一化值 clamp 到 [0,1]（拖拽越界防护）。NaN → 0；±Infinity → 0/1。 */
export function clampUnit(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

/** 把矩形归一化坐标整理成合法的左上-宽高形态（拖拽方向任意时归一）。保留 6 位小数消除浮点噪声。 */
export function normalizeRect(annotation: Pick<AnnotateEditAnnotation, "x" | "y" | "width" | "height">): { x: number; y: number; width: number; height: number } {
    const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
    const x1 = clampUnit(annotation.x);
    const y1 = clampUnit(annotation.y);
    const x2 = clampUnit(annotation.x + (annotation.width ?? 0));
    const y2 = clampUnit(annotation.y + (annotation.height ?? 0));
    return {
        x: round6(Math.min(x1, x2)),
        y: round6(Math.min(y1, y2)),
        width: round6(Math.abs(x2 - x1)),
        height: round6(Math.abs(y2 - y1)),
    };
}

/** 归一化矩形 → 像素矩形（像素取整，消除浮点噪声）。 */
export function normalizedRectToPixels(annotation: AnnotateEditAnnotation, imageWidth: number, imageHeight: number): PixelRect {
    const rect = normalizeRect(annotation);
    return {
        left: Math.round(rect.x * imageWidth),
        top: Math.round(rect.y * imageHeight),
        width: Math.round(rect.width * imageWidth),
        height: Math.round(rect.height * imageHeight),
    };
}

/**
 * 全标注联合 bounds（像素空间）+ padding，clamp 到原图内。
 *
 * arrow 计入箭尾与终点；region 计入矩形四角。无标注返回 null。
 */
export function annotationUnionBounds(annotations: AnnotateEditAnnotation[], imageWidth: number, imageHeight: number, padding: number = ANNOTATE_EXPORT_PADDING): PixelRect | null {
    if (annotations.length === 0) return null;
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const annotation of annotations) {
        const points: Array<[number, number]> = annotation.shape === "arrow"
            ? [
                  [Math.round(clampUnit(annotation.x) * imageWidth), Math.round(clampUnit(annotation.y) * imageHeight)],
                  [Math.round(clampUnit(annotation.endX ?? annotation.x) * imageWidth), Math.round(clampUnit(annotation.endY ?? annotation.y) * imageHeight)],
              ]
            : (() => {
                  const rect = normalizedRectToPixels(annotation, imageWidth, imageHeight);
                  return [
                      [rect.left, rect.top],
                      [rect.left + rect.width, rect.top + rect.height],
                  ] as Array<[number, number]>;
              })();
        for (const [px, py] of points) {
            left = Math.min(left, px);
            top = Math.min(top, py);
            right = Math.max(right, px);
            bottom = Math.max(bottom, py);
        }
    }

    const paddedLeft = Math.max(0, left - padding);
    const paddedTop = Math.max(0, top - padding);
    const paddedRight = Math.min(imageWidth, right + padding);
    const paddedBottom = Math.min(imageHeight, bottom + padding);
    return {
        left: paddedLeft,
        top: paddedTop,
        width: Math.max(1, paddedRight - paddedLeft),
        height: Math.max(1, paddedBottom - paddedTop),
    };
}

/** 动态像素比（照 Cowart 口径：长边 >1600 → 1x，>1000 → 1.5x，否则 2x）。 */
export function annotationExportPixelRatio(bounds: Pick<PixelRect, "width" | "height">): number {
    const maxDimension = Math.max(bounds.width, bounds.height);
    if (maxDimension > 1600) return 1;
    if (maxDimension > 1000) return 1.5;
    return 2;
}

/** 尺寸钳制判定：长边 4096 硬顶 + 总像素 1600 万双限。 */
export function annotationExportTooLarge(width: number, height: number): boolean {
    return Math.max(width, height) > ANNOTATE_MAX_LONG_EDGE || width * height > ANNOTATE_MAX_PIXELS;
}

/** 导出尺寸结算（bounds × 动态像素比 + 钳制判定）。 */
export function annotationExportSize(bounds: Pick<PixelRect, "width" | "height">): AnnotateExportSize {
    const pixelRatio = annotationExportPixelRatio(bounds);
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));
    return { width, height, pixelRatio, tooLarge: annotationExportTooLarge(width, height) };
}
