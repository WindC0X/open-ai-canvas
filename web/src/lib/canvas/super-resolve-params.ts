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

/**
 * 超分提示词语义（mode → promptFragment）。
 *
 * ★ 为什么需要：超分原先的 prompt 只是标题字符串（「AI 超分 · 4K · 保真放大」），
 * 对模型没有任何语义约束 —— 而 faithful 的承诺（只重建细节、不改画面内容）
 * 必须靠提示词表达，不能只靠弹窗文案。
 *
 * ★ faithful 逐项枚举不变量（2026-10-04 控制线追加）：测试线实测仅靠「保持画面不变」
 * 这类概括措辞不够（像素相关 0.6087 / 差异 6.7%），需把不变量逐项写死：
 * 构图 / 取景 / 色调 / 元素位置 / 数量。
 *
 * ★ 诚实边界：即使逐项枚举，模型仍有物理上限（生成式重建不是无损放大）。
 * 若实测仍 >5% 漂移，弹窗文案需降格为「细节尽量保持」——文案与实际能力对齐。
 */
export const SUPER_RESOLVE_PROMPT_FRAGMENTS: Record<SuperResolveMode, string> = {
    faithful: "仅重建细节、提升清晰度。严格保持以下全部不变：画面构图、取景范围与裁切、色调与白平衡、所有元素的位置、数量与形状、光影方向。不得新增或删除任何元素，不得改变天空、背景或物体颜色。",
    enhance: "在提升清晰度的同时，允许重绘细节质感与纹理（如皮肤、布料、材质颗粒），但保持画面构图、取景范围与元素数量不变。",
};

/** 超分提示词片段（mode → 语义约束）。 */
export function superResolvePromptFragment(mode: SuperResolveMode): string {
    return SUPER_RESOLVE_PROMPT_FRAGMENTS[mode] ?? SUPER_RESOLVE_PROMPT_FRAGMENTS.faithful;
}

/**
 * 构造超分提交用的 size（不继承源节点 metadata）。
 *
 * ★ 为什么必须重新构造（2026-10-04 控制线追加，测试线实测）：
 * 超分原先走 `buildGenerationConfig(config, node, "image")`，该函数会
 * `node.metadata.size ?? config.size` —— 源节点若携带历史生成尺寸
 * （如 960×960 的源节点 metadata 残留 "1360x1024"），超分会提交那个历史尺寸，
 * 使对话框承诺的「长边对齐 2K/4K」落空（实测 1445×1088，长边 < 2048）。
 *
 * ⇒ 超分的 size 必须由「目标档 longEdge + 源图实际比例」独立计算：
 * 长边对齐 target.longEdge，短边按源图比例等比缩放。
 *
 * @param sourceWidth 源图实际像素宽（来自已加载的图片，不是节点 metadata）
 * @param sourceHeight 源图实际像素高
 */
export function superResolveSize(sourceWidth: number, sourceHeight: number, targetResolution: SuperResolveParams["targetResolution"]): string {
    const target = SUPER_RESOLVE_TARGETS.find((item) => item.value === targetResolution) ?? SUPER_RESOLVE_TARGETS[0];
    const width = Math.max(1, Math.round(sourceWidth));
    const height = Math.max(1, Math.round(sourceHeight));
    const longEdge = Math.max(width, height);
    const scale = target.longEdge / longEdge;
    // 与 resolveUpscaleSize 同口径：长边对齐 target，短边等比（四舍五入到整数像素）。
    const nextWidth = Math.max(1, Math.round(width * scale));
    const nextHeight = Math.max(1, Math.round(height * scale));
    return `${nextWidth}x${nextHeight}`;
}

/**
 * 超分 size 的**真接缝**：把「源图实际像素 + 目标档」写进生成配置的 size 字段。
 *
 * ★ 为什么单独抽函数（F-3 修复，评审线 R1）：原实现内联在 `use-canvas-media-tools.ts`
 * 的 `superResolveImageNode` 里（`generationConfig.size = superResolveSize(...)`），
 * 而当时的测试只断言 `prepareBackendGenerationTask` 收到**测试自己算好的** size ——
 * 即测试复刻了接缝表达式，从未执行真实赋值行。接线一断（如有人删掉该行、
 * 或改回继承 node.metadata.size），测试仍绿。
 *
 * 本函数把赋值行为固定下来，接线处只调用它，测试可直接断言返回值 ——
 * 验证形态与被验证对象（「size 是否按源图重算」）匹配。
 *
 * ★ 不变量：
 *   1. 源图尺寸有效（宽高 > 0）时，size = 按目标档 longEdge 等比缩放的结果；
 *   2. 源图尺寸无效时**不改写** size（返回 undefined，调用方保留 buildGenerationConfig 的结果）——
 *      不硬造值；
 *   3. 不读取 node.metadata.size（这正是缺陷根因：源节点历史尺寸不得透传）。
 *
 * @param baseSize buildGenerationConfig 产出的 size（可能来自 node.metadata.size，**不得继承**）
 * @param sourceWidth 源图实际像素宽（naturalWidth / node.width）
 * @param sourceHeight 源图实际像素高（naturalHeight / node.height）
 * @param targetResolution 目标档（2k / 4k）
 * @returns 重算后的 size；源图尺寸无效时 undefined（表示「保持 baseSize 不变」）
 */
export function resolveSuperResolveConfigSize(
    baseSize: string | undefined,
    sourceWidth: number,
    sourceHeight: number,
    targetResolution: SuperResolveParams["targetResolution"],
): string | undefined {
    void baseSize; // 显式声明「不参与计算」：size 必须由源图与目标档独立决定。
    if (!(sourceWidth > 0) || !(sourceHeight > 0)) return undefined;
    return superResolveSize(sourceWidth, sourceHeight, targetResolution);
}
