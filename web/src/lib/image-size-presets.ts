import { buildImageResolutionOptions, imageRatioForSize, type ImageResolutionOption, type ImageResolutionTier } from "./image-resolution-tiers";
import type { ImageCapabilityConfig } from "./model-capabilities";

export const IMAGE_RESOLUTIONS: ImageResolutionTier[] = ["1k", "2k", "4k"];
export const IMAGE_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];
const standardSizes: Record<string, string[]> = {
    "1:1": ["1024x1024", "2048x2048", "2880x2880"],
    "16:9": ["1824x1024", "2752x1536", "3840x2160"],
    "9:16": ["1024x1824", "1536x2752", "2160x3840"],
    "4:3": ["1360x1024", "2304x1728", "3264x2448"],
    "3:4": ["1024x1360", "1728x2304", "2448x3264"],
    "3:2": ["1536x1024", "2496x1664", "3504x2336"],
    "2:3": ["1024x1536", "1664x2496", "2336x3504"],
    "4:5": ["1024x1280", "1792x2240", "2560x3200"],
    "5:4": ["1280x1024", "2240x1792", "3200x2560"],
    "21:9": ["2048x878", "3136x1344", "3808x1632"],
};

export function imagePresetForRatio(tier: ImageResolutionTier, input: string): ImageResolutionOption {
    const match = input.trim().match(/^(\d{1,5})\s*[:：]\s*(\d{1,5})$/);
    if (!match) throw new Error("请输入宽高比，例如 16:9");
    let w = Number(match[1]),
        h = Number(match[2]);
    if (!w || !h || Math.max(w, h) / Math.min(w, h) > 3) throw new Error("宽高比必须为正数，且不超过 3:1");
    let a = w,
        b = h;
    while (b) [a, b] = [b, a % b];
    w /= a;
    h /= a;
    const ratio =
        Object.keys(standardSizes).find((value) => {
            const [width, height] = value.split(":").map(Number);
            return width * h === height * w;
        }) || `${w}:${h}`;
    const index = IMAGE_RESOLUTIONS.indexOf(tier);
    if (index < 0) throw new Error("分辨率仅支持 1K、2K、4K");
    const standard = standardSizes[ratio]?.[index];
    const pixels = [1_048_576, 4_194_304, 8_294_400][index];
    let width = Math.round(Math.sqrt((pixels * w) / h) / 16) * 16;
    let height = Math.round((width * h) / w / 16) * 16;
    while (width * height > pixels || Math.max(width, height) > 3840) {
        if (width >= height) {
            width -= 16;
            height = Math.round((width * h) / w / 16) * 16;
        } else {
            height -= 16;
            width = Math.round((height * w) / h / 16) * 16;
        }
    }
    if (standard) [width, height] = standard.split("x").map(Number);
    return { tier, ratio, width, height, size: `${width}x${height}` };
}

export function imageQualityForTier(profile: ImageCapabilityConfig, tier: ImageResolutionTier) {
    const aliases = { "1k": ["1k", "low"], "2k": ["2k", "medium"], "4k": ["4k", "high"] }[tier];
    return profile.quality.supported ? profile.quality.values.find((value) => aliases.includes(value.toLowerCase())) : undefined;
}

export function imageResolutionUsesQuality(profile: ImageCapabilityConfig) {
    if (profile.size.parameter !== "aspect_ratio") return false;
    // quality.values 有档位映射(1k/2k/4k 或 low/medium/high)即由 quality 承载分辨率档;
    // 或后台"按分辨率配置可用画幅"存了 size.presets(含 tier 分组)——quality 漏配档位时
    // 分辨率组仍按 presets tiers 显示(用户纪律: 比例+分辨率两组必须显示)。
    return IMAGE_RESOLUTIONS.some((tier) => imageQualityForTier(profile, tier)) || new Set(profile.size.presets?.map((preset) => preset.tier) || []).size > 0;
}

export function imageTierAvailable(profile: ImageCapabilityConfig, tier: ImageResolutionTier) {
    // 质量参数能映射档位时按上游质量裁剪；管理员尺寸预设存在时再取交集，避免默认 low/medium/high 把未启用的 1K 显示出来。
    if (profile.size.parameter !== "aspect_ratio") return profile.size.parameter !== "none";
    const configuredTiers = new Set(profile.size.presets?.map((preset) => preset.tier));
    if (imageResolutionUsesQuality(profile)) {
        // quality 承载档时优先按 quality 映射裁剪; quality 漏配档位(1533f0ae presets tier 分支场景)
        // 不能把 presets 明确配置的 tier 也判死 — 否则管理员配置的 4K 在面板消失(断言漂移回归)。
        if (configuredTiers.size) return configuredTiers.has(tier);
        return Boolean(imageQualityForTier(profile, tier));
    }
    if (configuredTiers.size) return configuredTiers.has(tier);
    // 无质量映射且无预设时,后端 filterImageSizePresets 会返回全部预设或空;
    // 前端不应硬编码 1k 兜底,避免产生后端不认可的幻影选项。
    return false;
}

/** tier 生效时的请求质量值：quality 映射优先；quality 漏配而管理员 presets 明确配置该档时发 tier 名
 * （上游 LOOSE 形态，请求端直接消费 tier 名，用户 2026-09-12 裁决）。 */
export function imageTierRequestQuality(profile: ImageCapabilityConfig, tier: ImageResolutionTier): string | undefined {
    return imageQualityForTier(profile, tier) || (imageTierAvailable(profile, tier) ? tier : undefined);
}

export function imageQualityForSelection(profile: ImageCapabilityConfig, tier: ImageResolutionTier) {
    const mapped = imageQualityForTier(profile, tier);
    if (mapped) return mapped;
    const presetsCarried = profile.size.presets?.some((preset) => preset.tier === tier) ?? false;
    return imageTierAvailable(profile, tier) && (!imageResolutionUsesQuality(profile) || presetsCarried) ? tier : undefined;
}

export function imageSizePresets(profile: ImageCapabilityConfig): ImageResolutionOption[] {
    if (profile.size.parameter === "none") return [];
    if (profile.size.presets) return profile.size.presets;
    const pixels = buildImageResolutionOptions(profile.size.values);
    const tiers = profile.size.parameter === "aspect_ratio" ? IMAGE_RESOLUTIONS.filter((tier) => imageQualityForTier(profile, tier)) : [];
    const ratios = tiers.flatMap((tier) =>
        profile.size.values.flatMap((ratio) => {
            try {
                const preset = imagePresetForRatio(tier, ratio);
                return pixels.some((pixel) => pixel.ratio === preset.ratio) ? [] : [preset];
            } catch {
                return [];
            }
        }),
    );
    return [...pixels, ...ratios];
}

export function imagePresetValue(profile: ImageCapabilityConfig, preset: ImageResolutionOption) {
    if (!profile.size.presets && !profile.size.allowCustom && preset.tier === "1k" && profile.size.values.includes(preset.ratio) && !profile.size.values.includes(preset.size)) return preset.ratio;
    return profile.size.parameter === "aspect_ratio" ? preset.ratio : preset.size;
}

export function imageSizeConfigWithPresets(profile: ImageCapabilityConfig, presets: ImageResolutionOption[]): ImageCapabilityConfig["size"] {
    const values = [...new Set(presets.map((preset) => (profile.size.parameter === "aspect_ratio" ? preset.ratio : preset.size)))];
    if (profile.size.values.includes("auto")) values.unshift("auto");
    if (!values.length) values.push("auto");
    return { ...profile.size, presets, values, default: values.includes(profile.size.default) ? profile.size.default : values[0] || "auto" };
}

// ===== O-03 层1：电商直出预设 + 画质档位词汇表 =====
// 纪律（控制线 2026-09-27）：本文件只造词汇表，不造价格表——不出现价格数字/价格常量；
// 档位 id（economy/standard/flagship）供后续计价展示按同名 id 从 PriceTier 动态对接。

export type ImageQualityTier = "economy" | "standard" | "flagship";

export const IMAGE_QUALITY_TIERS: ReadonlyArray<{ id: ImageQualityTier; label: string; targetResolution: ImageResolutionTier }> = [
    { id: "economy", label: "经济", targetResolution: "1k" },
    { id: "standard", label: "标准", targetResolution: "2k" },
    { id: "flagship", label: "旗舰", targetResolution: "4k" },
];

export function parseImageQualityTier(value: unknown): ImageQualityTier | null {
    return typeof value === "string" && IMAGE_QUALITY_TIERS.some((tier) => tier.id === value) ? (value as ImageQualityTier) : null;
}

export function imageQualityTierTarget(tier: ImageQualityTier): ImageResolutionTier {
    return IMAGE_QUALITY_TIERS.find((item) => item.id === tier)?.targetResolution || "1k";
}

export type EcomChannelPreset = {
    id: "amazon-main" | "detail-3x4" | "douyin-vertical";
    label: string;
    shortLabel: string;
    aspect: string;
    minPixels: { width: number; height: number; note: string };
    /** 名义目标档（控制线 2026-09-27 批）；与实得档的差异 = 层2 superResolve 触发条件（本枝只存字段，不接超分链）。 */
    desiredResolution: ImageResolutionTier;
    hint: string;
};

export const ECOM_CHANNEL_PRESETS: EcomChannelPreset[] = [
    {
        id: "amazon-main",
        label: "Amazon 主图",
        shortLabel: "Amazon",
        aspect: "1:1",
        minPixels: { width: 1600, height: 1600, note: "主图放大下限" },
        desiredResolution: "4k",
        hint: "白底主图，品牌/文字向",
    },
    {
        id: "detail-3x4",
        label: "详情长图",
        shortLabel: "详情",
        aspect: "3:4",
        minPixels: { width: 1440, height: 1920, note: "详情高清下限" },
        desiredResolution: "2k",
        hint: "详情页竖图，信息密度高",
    },
    {
        id: "douyin-vertical",
        label: "抖音竖版",
        shortLabel: "抖音",
        aspect: "9:16",
        minPixels: { width: 1080, height: 1920, note: "竖版全屏基准" },
        desiredResolution: "2k",
        hint: "竖屏内容/视频封面",
    },
];

/** 价目档选择器的最小结构（PublicLogicalModelPriceTier 子集；结构化类型避免跨模块值依赖）。 */
export type ImagePriceSelectorTier = { selector?: Record<string, string> | null };

/** 面板块/计划共用的价目档一致性口径：无价目数据不约束；两者都传时需同档命中（通配 *）。 */
export function hasPriceTierForImageSelection(tiers: readonly ImagePriceSelectorTier[], quality: string | undefined, size: string | undefined): boolean {
    if (!tiers.length) return true;
    const normalizedQuality = (quality || "").toLowerCase();
    const normalizedSize = (size || "").toLowerCase();
    return tiers.some((tier) => {
        const selector = tier.selector || {};
        return (!selector.quality || selector.quality === "*" || selector.quality === normalizedQuality) && (!selector.size || selector.size === "*" || selector.size === normalizedSize);
    });
}

const RESOLUTION_DESCENT: ImageResolutionTier[] = ["4k", "2k", "1k"];

function resolutionDescent(target: ImageResolutionTier): ImageResolutionTier[] {
    return RESOLUTION_DESCENT.slice(Math.max(0, RESOLUTION_DESCENT.indexOf(target)));
}

/** 模型当前可用的分辨率档集合：管理员 presets 分组 ∪ 比例协议的 quality 映射 / 尺寸模型的像素值解析。 */
export function imageAvailableTiers(profile: ImageCapabilityConfig): ImageResolutionTier[] {
    const tiers = new Set<ImageResolutionTier>();
    profile.size.presets?.forEach((preset) => tiers.add(preset.tier));
    if (profile.size.parameter === "aspect_ratio") {
        IMAGE_RESOLUTIONS.forEach((tier) => {
            if (imageTierAvailable(profile, tier)) tiers.add(tier);
        });
    } else if (profile.size.parameter === "size") {
        buildImageResolutionOptions(profile.size.values).forEach((option) => tiers.add(option.tier));
    }
    return IMAGE_RESOLUTIONS.filter((tier) => tiers.has(tier));
}

function preferredPresetRatio(profile: ImageCapabilityConfig, aspect?: string): string {
    if (aspect) return aspect;
    const fallback = String(profile.size.default || "").trim();
    if (!fallback || fallback === "auto") return "1:1";
    return imageRatioForSize(fallback) || fallback;
}

/** 单档取参：比例模型 = 比例 + quality 承载档（imageTierRequestQuality）；尺寸模型 = 该档精确像素成员，缺成员按标准换算兜底。 */
export function imageTierSelection(profile: ImageCapabilityConfig, tier: ImageResolutionTier, aspect?: string): { size: string; quality?: string } {
    const ratio = preferredPresetRatio(profile, aspect);
    if (profile.size.parameter === "aspect_ratio") {
        return { size: ratio, quality: imageTierRequestQuality(profile, tier) };
    }
    const options = [...(profile.size.presets || []), ...buildImageResolutionOptions(profile.size.values)];
    const member = options.find((option) => option.tier === tier && option.ratio === ratio);
    if (member) return { size: member.size };
    return { size: imagePresetForRatio(tier, ratio).size };
}

/** 档位降级链（目标档 → 1K）：逐级取可用且价目一致的档；全部不可得返回 null（调用方降级不应用）。 */
export function resolveTierPlan(profile: ImageCapabilityConfig, target: ImageResolutionTier, options?: { priceTiers?: readonly ImagePriceSelectorTier[]; aspect?: string }): { tier: ImageResolutionTier; size: string; quality?: string } | null {
    const available = new Set(imageAvailableTiers(profile));
    for (const tier of resolutionDescent(target)) {
        if (!available.has(tier)) continue;
        const selection = imageTierSelection(profile, tier, options?.aspect);
        if (!hasPriceTierForImageSelection(options?.priceTiers || [], selection.quality, selection.size)) continue;
        return { tier, ...selection };
    }
    return null;
}

export type EcomPresetPlan =
    | { status: "unconstrained"; size: string; note: string }
    | { status: "full"; size: string; quality?: string; tier: ImageResolutionTier }
    | { status: "capped"; size: string; quality?: string; tier: ImageResolutionTier; badge: string }
    | { status: "short"; size: string; quality?: string; tier: ImageResolutionTier; gap: string; suggestModelIds: string[] };

export type EcomPresetCatalogEntry = { id: string; profile?: ImageCapabilityConfig };

/** 预设 × 能力交集四态（O-03 R6）：能力未知不约束；其余走降级链后按平台下限判 full/capped/short，绝不静默。 */
export function planEcomPresetApplication(input: { profile?: ImageCapabilityConfig; preset: EcomChannelPreset; priceTiers?: readonly ImagePriceSelectorTier[]; catalog?: readonly EcomPresetCatalogEntry[] }): EcomPresetPlan {
    const { profile, preset } = input;
    if (!profile || profile.size.parameter === "none" || (!profile.size.values.length && !profile.size.presets?.length)) {
        return { status: "unconstrained", size: preset.aspect, note: "当前模型未提供尺寸能力信息，仅按比例应用" };
    }
    const resolved = resolveTierPlan(profile, preset.desiredResolution, { priceTiers: input.priceTiers, aspect: preset.aspect });
    if (!resolved) {
        return { status: "unconstrained", size: preset.aspect, note: "当前模型无可用分辨率档位，仅按比例应用" };
    }
    const pixels = imagePresetForRatio(resolved.tier, preset.aspect);
    const meetsMinimum = pixels.width >= preset.minPixels.width && pixels.height >= preset.minPixels.height;
    if (resolved.tier === preset.desiredResolution && meetsMinimum) {
        return { status: "full", size: resolved.size, quality: resolved.quality, tier: resolved.tier };
    }
    if (meetsMinimum) {
        return {
            status: "capped",
            size: resolved.size,
            quality: resolved.quality,
            tier: resolved.tier,
            badge: `当前模型上限 ${resolved.tier.toUpperCase()}，已满足 ≥${preset.minPixels.width}×${preset.minPixels.height}px`,
        };
    }
    return {
        status: "short",
        size: resolved.size,
        quality: resolved.quality,
        tier: resolved.tier,
        gap: `当前模型最高 ${resolved.tier.toUpperCase()}（${pixels.width}×${pixels.height}），低于平台下限 ${preset.minPixels.width}×${preset.minPixels.height}px`,
        suggestModelIds: suggestModelIdsForPreset(input.catalog, preset),
    };
}

/** 不达标态换模型建议：目录内该比例可达平台下限的模型，按最高可达档排序（4K 优先）。 */
function suggestModelIdsForPreset(catalog: readonly EcomPresetCatalogEntry[] | undefined, preset: EcomChannelPreset): string[] {
    if (!catalog?.length) return [];
    const ranked = catalog
        .map((entry) => {
            const profile = entry.profile;
            if (!profile || profile.size.parameter === "none") return null;
            const available = new Set(imageAvailableTiers(profile));
            const best = resolutionDescent(preset.desiredResolution).find((tier) => {
                if (!available.has(tier)) return false;
                const pixels = imagePresetForRatio(tier, preset.aspect);
                return pixels.width >= preset.minPixels.width && pixels.height >= preset.minPixels.height;
            });
            return best ? { id: entry.id, rank: RESOLUTION_DESCENT.indexOf(best) } : null;
        })
        .filter((item): item is { id: string; rank: number } => Boolean(item))
        .sort((left, right) => left.rank - right.rank);
    const seen = new Set<string>();
    return ranked.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true))).map((item) => item.id);
}
