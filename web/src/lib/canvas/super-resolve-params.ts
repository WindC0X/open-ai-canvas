/**
 * AI 超分参数面（O-03 层2）。
 *
 * ★ 命名分流红线（MASTER-PLAN L399）：
 * `upscale`（插值，免费，见 canvas-image-data.ts）与 `superResolve`（AI 超分，云端计费）
 * 是两件事，必须严格分开，禁用模糊词（红线原文见 MASTER-PLAN L399）。本模块只承载 superResolve 侧。
 *
 * 内分两档：
 * - `faithful`（保真放大，**默认**）：只重建细节，不改变画面内容
 * - `enhance`（AI 增强，**需勾选确认**）：允许模型改写细节质感
 */
import type { ImageResolutionTier } from "@/lib/image-resolution-tiers";

export type SuperResolveMode = "faithful" | "enhance";

export type SuperResolveParams = {
    /** 目标档（超分只跑一次，见 MASTER-PLAN L399 的 F-06 衔接口径）。 */
    targetResolution: Extract<ImageResolutionTier, "2k" | "4k">;
    mode: SuperResolveMode;
};

/** 默认档：保真放大 + 2K（红线要求保真为默认）。 */
export const DEFAULT_SUPER_RESOLVE_PARAMS: SuperResolveParams = {
    targetResolution: "2k",
    mode: "faithful",
};

export const SUPER_RESOLVE_MODES: Array<{ value: SuperResolveMode; title: string; description: string; confirm: boolean }> = [
    {
        value: "faithful",
        title: "保真放大",
        description: "只重建细节，不改画面内容",
        confirm: false,
    },
    {
        value: "enhance",
        title: "AI 增强",
        description: "允许模型改写细节质感，结果可能与原图有差异",
        // 红线原文：「AI 增强（勾选确认）」—— 需用户显式确认。
        confirm: true,
    },
];

export const SUPER_RESOLVE_TARGETS: Array<{ value: SuperResolveParams["targetResolution"]; label: string; longEdge: number }> = [
    { value: "2k", label: "2K", longEdge: 2048 },
    { value: "4k", label: "4K", longEdge: 4096 },
];

/** 是否满足「保真档默认」的红线契约。 */
export function isFaithfulDefault(params: SuperResolveParams): boolean {
    return params.mode === DEFAULT_SUPER_RESOLVE_PARAMS.mode;
}
