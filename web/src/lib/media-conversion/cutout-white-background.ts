/**
 * 抠图结果的白底合成 —— 几何计算与绘制分离。
 *
 * 几何部分是纯函数（不碰 DOM），单测直接覆盖补边/裁切/下限抬升三类边界；
 * 绘制只在浏览器里跑，逻辑简单到不需要模拟 Canvas。
 */

import { ECOM_CHANNEL_PRESETS, type EcomChannelPreset } from "@/lib/image-size-presets";

/** Amazon 主图档：1:1、白底、放大下限 1600。 */
export const CUTOUT_WHITE_BACKGROUND_PRESET_ID = "amazon-main" as const;

export type WhiteBackgroundPlan = {
    /** 输出画布尺寸（像素）。 */
    width: number;
    height: number;
    /** 主体在输出画布上的落位。 */
    drawX: number;
    drawY: number;
    drawWidth: number;
    drawHeight: number;
    /** 输出像素是否被放大到渠道下限之上（供 UI 提示用）。 */
    upscaled: boolean;
};

export type WhiteBackgroundOptions = {
    /** 目标宽高比；默认取预设的 1:1。 */
    aspect?: number;
    /** 输出边长下限；默认取预设的 1600。 */
    minPixels?: number;
    /** 主体在画布中的占比上限（留白比例），默认 0.92。 */
    fillRatio?: number;
};

function presetOrDefault(): EcomChannelPreset {
    return ECOM_CHANNEL_PRESETS.find((preset) => preset.id === CUTOUT_WHITE_BACKGROUND_PRESET_ID) ?? ECOM_CHANNEL_PRESETS[0];
}

/** 从 "1:1" / "3:4" 这类字符串解析宽高比；解析不出来时退回 1。 */
export function aspectFromLabel(label: string): number {
    const [rawWidth, rawHeight] = label.split(":");
    const width = Number(rawWidth);
    const height = Number(rawHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
    return width / height;
}

/**
 * 规划白底输出：先按目标比例确定画布，再把主体等比缩放居中放进去。
 *
 * 输出尺寸至少满足渠道下限（Amazon 主图 1600），所以小图会被放大——
 * 这是渠道硬要求，不是可选优化。
 */
export function planWhiteBackground(
    source: { width: number; height: number },
    options: WhiteBackgroundOptions = {},
): WhiteBackgroundPlan {
    const preset = presetOrDefault();
    const aspect = options.aspect ?? aspectFromLabel(preset.aspect);
    const minPixels = options.minPixels ?? preset.minPixels.width;
    const fillRatio = options.fillRatio ?? 0.92;

    const sourceWidth = Math.max(1, Math.round(source.width));
    const sourceHeight = Math.max(1, Math.round(source.height));

    // 先按主体长边贴住画布（再乘留白比例），得到候选画布尺寸。
    const sourceAspect = sourceWidth / sourceHeight;
    let canvasWidth: number;
    let canvasHeight: number;
    if (sourceAspect > aspect) {
        canvasWidth = sourceWidth / fillRatio;
        canvasHeight = canvasWidth / aspect;
    } else {
        canvasHeight = sourceHeight / fillRatio;
        canvasWidth = canvasHeight * aspect;
    }

    // 抬到渠道下限：取两边所需倍率的最大值，保持比例不破。
    const scaleToMin = Math.max(minPixels / canvasWidth, minPixels / canvasHeight, 1);
    canvasWidth = Math.round(canvasWidth * scaleToMin);
    canvasHeight = Math.round(canvasHeight * scaleToMin);

    // 主体等比缩放到画布内，居中放置。
    const drawScale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight) * fillRatio;
    const drawWidth = Math.round(sourceWidth * drawScale);
    const drawHeight = Math.round(sourceHeight * drawScale);
    const drawX = Math.round((canvasWidth - drawWidth) / 2);
    const drawY = Math.round((canvasHeight - drawHeight) / 2);

    return {
        width: canvasWidth,
        height: canvasHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
        upscaled: scaleToMin > 1,
    };
}

/**
 * 把抠图结果画到纯白底上并导出 PNG。
 *
 * 白底是渠道要求（Amazon 主图不允许透明），所以这里显式铺满白色再叠主体。
 */
export async function composeWhiteBackground(transparent: Blob, plan: WhiteBackgroundPlan): Promise<Blob> {
    const bitmap = await createImageBitmap(transparent);
    try {
        const canvas = new OffscreenCanvas(plan.width, plan.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("无法创建绘图上下文");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, plan.width, plan.height);
        context.drawImage(bitmap, plan.drawX, plan.drawY, plan.drawWidth, plan.drawHeight);
        return await canvas.convertToBlob({ type: "image/png" });
    } finally {
        bitmap.close();
    }
}
