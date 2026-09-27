import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defaultImageCapabilityConfig, defaultModelCapabilityConfig, type ImageCapabilityConfig } from "../src/lib/model-capabilities";
import {
    ECOM_CHANNEL_PRESETS,
    hasPriceTierForImageSelection,
    IMAGE_QUALITY_TIERS,
    imageAvailableTiers,
    imageQualityTierTarget,
    imageTierSelection,
    parseImageQualityTier,
    planEcomPresetApplication,
    resolveTierPlan,
    type ImagePriceSelectorTier,
} from "../src/lib/image-size-presets";
import { defaultImageParamsForModel, imagePriceTiersForModel } from "../src/lib/model-selection";
import { defaultConfig, type AiConfig, type ModelChannel } from "../src/stores/use-config-store";
import { useCreationPreferencesStore } from "../src/stores/use-creation-preferences-store";

const AMAZON = ECOM_CHANNEL_PRESETS.find((preset) => preset.id === "amazon-main")!;
const DETAIL = ECOM_CHANNEL_PRESETS.find((preset) => preset.id === "detail-3x4")!;
const DOUYIN = ECOM_CHANNEL_PRESETS.find((preset) => preset.id === "douyin-vertical")!;

/** Agnes 系：size 像素模型，1K/2K/4K 档成员齐备。 */
function agnesProfile(): ImageCapabilityConfig {
    const profile = defaultImageCapabilityConfig(undefined, "agnes");
    profile.quality = { supported: false, values: [], default: "auto" };
    profile.size = {
        parameter: "size",
        values: ["1024x1024", "2048x2048", "2880x2880", "1024x1360", "1728x2304", "2448x3264", "1024x1824", "1536x2752", "2160x3840"],
        default: "1024x1024",
        allowCustom: false,
    };
    return profile;
}

/** Grok2Api 系：比例模型，quality 承载 1K/2K。 */
function grokProfile(): ImageCapabilityConfig {
    return defaultImageCapabilityConfig("grok-image", "grok-imagine-image-2.0");
}

/** 1K 封顶的 size 像素模型（gpt-image 基础档形态）。 */
function cappedProfile(): ImageCapabilityConfig {
    const profile = defaultImageCapabilityConfig(undefined, "gpt-image-2");
    profile.quality = { supported: true, values: ["auto", "low", "medium", "high"], default: "medium" };
    profile.size = { parameter: "size", values: ["1024x1024", "1024x1360", "1024x1824"], default: "1024x1024", allowCustom: false };
    return profile;
}

function aiConfig(entries: Array<{ model: string; profile: ImageCapabilityConfig; tiers?: Array<{ selector: Record<string, string>; unitPriceMicrocredits: number }> }>): AiConfig {
    const channel: ModelChannel = {
        id: "relay",
        name: "中转渠道",
        baseUrl: "https://api.example.com",
        apiKey: "test-key",
        apiFormat: "openai",
        models: entries.map((entry) => entry.model),
        modelCosts: entries.map((entry) => {
            const capabilityConfig = defaultModelCapabilityConfig(undefined, entry.model);
            capabilityConfig.image = entry.profile;
            return {
                model: entry.model,
                capability: "image" as const,
                billingMode: "fixed_request" as const,
                unitPriceMicrocredits: 1,
                capabilityConfig,
                logicalPriceTiers: entry.tiers?.map((tier) => ({ selector: tier.selector, resolution: "", videoSeconds: 0, billingMode: "fixed_request" as const, unitPriceMicrocredits: tier.unitPriceMicrocredits, inputTokenPriceMicrocredits: 0, outputTokenPriceMicrocredits: 0, cachedTokenPriceMicrocredits: 0 })),
            };
        }),
    };
    const models = entries.map((entry) => `relay::${entry.model}`);
    return { ...defaultConfig, channels: [channel], models, imageModels: models, model: models[0] };
}

describe("电商预设数据与画质档位词汇表", () => {
    test("三预设参数（控制线 2026-09-27 批）", () => {
        expect(ECOM_CHANNEL_PRESETS.map((preset) => preset.id)).toEqual(["amazon-main", "detail-3x4", "douyin-vertical"]);
        expect(AMAZON).toMatchObject({ aspect: "1:1", desiredResolution: "4k", shortLabel: "Amazon" });
        expect(AMAZON.minPixels).toMatchObject({ width: 1600, height: 1600 });
        expect(DETAIL).toMatchObject({ aspect: "3:4", desiredResolution: "2k" });
        expect(DETAIL.minPixels).toMatchObject({ width: 1440, height: 1920 });
        expect(DOUYIN).toMatchObject({ aspect: "9:16", desiredResolution: "2k" });
        expect(DOUYIN.minPixels).toMatchObject({ width: 1080, height: 1920 });
        for (const preset of ECOM_CHANNEL_PRESETS) expect(preset.hint.length).toBeGreaterThan(0);
    });

    test("档位词汇表：经济/标准/旗舰 → 1K/2K/4K；解析非法值回落 null", () => {
        expect(IMAGE_QUALITY_TIERS.map((tier) => tier.id)).toEqual(["economy", "standard", "flagship"]);
        expect(IMAGE_QUALITY_TIERS.map((tier) => tier.label)).toEqual(["经济", "标准", "旗舰"]);
        expect(imageQualityTierTarget("economy")).toBe("1k");
        expect(imageQualityTierTarget("standard")).toBe("2k");
        expect(imageQualityTierTarget("flagship")).toBe("4k");
        expect(parseImageQualityTier("flagship")).toBe("flagship");
        expect(parseImageQualityTier("4k")).toBeNull();
        expect(parseImageQualityTier(undefined)).toBeNull();
        expect(parseImageQualityTier(7)).toBeNull();
    });

    test("静态护栏：预设/档位文件无价格数字（前端只造词汇表，不造价格表）", () => {
        const source = readFileSync(resolve(import.meta.dir, "../src/lib/image-size-presets.ts"), "utf8");
        expect(source.match(/[¥￥]/g)).toBeNull();
        expect(source).not.toContain("unitPriceMicrocredits");
        expect(source).not.toMatch(/\d+\s*积分/);
        expect(source).not.toMatch(/\bprice\b/i);
    });

    test("价目档一致性口径：无档不约束；通配与精确匹配", () => {
        expect(hasPriceTierForImageSelection([], "2k", "1:1")).toBe(true);
        const tiers: ImagePriceSelectorTier[] = [{ selector: { quality: "2k", size: "*" } }, { selector: { size: "1024x1024" } }];
        expect(hasPriceTierForImageSelection(tiers, "2k", "1:1")).toBe(true);
        expect(hasPriceTierForImageSelection(tiers, "4k", "1024x1024")).toBe(true); // 第二个选择器只在 size 上约束
        expect(hasPriceTierForImageSelection(tiers, "4k", "1:1")).toBe(false);
    });
});

describe("预设 × 能力交集四态（planEcomPresetApplication）", () => {
    test("full：能力足 → 目标档完整应用", () => {
        const plan = planEcomPresetApplication({ profile: agnesProfile(), preset: AMAZON });
        expect(plan).toMatchObject({ status: "full", tier: "4k", size: "2880x2880" });
        const grokPlan = planEcomPresetApplication({ profile: grokProfile(), preset: DOUYIN });
        expect(grokPlan).toMatchObject({ status: "full", tier: "2k", size: "9:16", quality: "2k" });
    });

    test("capped：部分足 → 顶格应用 + 徽标说明", () => {
        const plan = planEcomPresetApplication({ profile: grokProfile(), preset: AMAZON });
        expect(plan).toMatchObject({ status: "capped", tier: "2k", size: "1:1", quality: "2k" });
        if (plan.status === "capped") {
            expect(plan.badge).toContain("当前模型上限 2K");
            expect(plan.badge).toContain("1600×1600");
        }
    });

    test("short：不达标 → 应用可达部分 + 缺口 + 换模型建议（绝不静默）", () => {
        const plan = planEcomPresetApplication({
            profile: cappedProfile(),
            preset: AMAZON,
            catalog: [
                { id: "relay::grok-imagine-image-2.0", profile: grokProfile() },
                { id: "relay::agnes-image-2.5-flash", profile: agnesProfile() },
            ],
        });
        expect(plan).toMatchObject({ status: "short", tier: "1k", size: "1024x1024" });
        if (plan.status === "short") {
            expect(plan.gap).toContain("1024×1024");
            expect(plan.gap).toContain("1600×1600");
            // 建议按可达档排序：4K 的 Agnes 在 2K 的 Grok 之前。
            expect(plan.suggestModelIds).toEqual(["relay::agnes-image-2.5-flash", "relay::grok-imagine-image-2.0"]);
        }
        const detailPlan = planEcomPresetApplication({ profile: cappedProfile(), preset: DETAIL });
        expect(detailPlan.status).toBe("short");
        if (detailPlan.status === "short") expect(detailPlan.gap).toContain("1440×1920");
    });

    test("unconstrained：能力未知/无档位 → 不约束，仅按比例", () => {
        const unknown = planEcomPresetApplication({ preset: AMAZON });
        expect(unknown).toMatchObject({ status: "unconstrained", size: "1:1" });
        const empty = planEcomPresetApplication({ profile: { ...cappedProfile(), size: { parameter: "size", values: [], default: "auto", allowCustom: false } }, preset: DETAIL });
        expect(empty).toMatchObject({ status: "unconstrained", size: "3:4" });
        const none = planEcomPresetApplication({ profile: { ...cappedProfile(), size: { parameter: "none", values: [], default: "auto", allowCustom: false } }, preset: DOUYIN });
        expect(none.status).toBe("unconstrained");
    });

    test("价目档降级：价目档更高的档不可得时降档重算", () => {
        const downgraded = planEcomPresetApplication({ profile: agnesProfile(), preset: AMAZON, priceTiers: [{ selector: { size: "2048x2048" } }] });
        expect(downgraded).toMatchObject({ status: "capped", tier: "2k", size: "2048x2048" });
        const full = planEcomPresetApplication({ profile: agnesProfile(), preset: AMAZON, priceTiers: [{ selector: { size: "2880x2880" } }] });
        expect(full).toMatchObject({ status: "full", tier: "4k", size: "2880x2880" });
    });
});

describe("档位降级链（resolveTierPlan，供画质档位吸附复用）", () => {
    test("economy/standard/flagship → 1K/2K/4K 逐级取可用档", () => {
        const agnes = agnesProfile();
        expect(resolveTierPlan(agnes, "4k")).toMatchObject({ tier: "4k", size: "2880x2880" });
        expect(resolveTierPlan(agnes, "2k")).toMatchObject({ tier: "2k", size: "2048x2048" });
        expect(resolveTierPlan(agnes, "1k")).toMatchObject({ tier: "1k", size: "1024x1024" });
        const grok = grokProfile();
        expect(resolveTierPlan(grok, "4k")).toMatchObject({ tier: "2k", size: "1:1", quality: "2k" });
        expect(resolveTierPlan(grok, "1k")).toMatchObject({ tier: "1k", quality: "1k" });
    });

    test("不可得（无档位/价目不一致）→ null，调用方降级不应用", () => {
        expect(resolveTierPlan(cappedProfile(), "4k", { priceTiers: [{ selector: { quality: "4k" } }] })).toBeNull();
        const empty = { ...cappedProfile(), size: { parameter: "size" as const, values: [], default: "auto", allowCustom: false } };
        expect(resolveTierPlan(empty, "1k")).toBeNull();
    });

    test("imageAvailableTiers 双范式：size 像素解析 + 比例 quality 映射", () => {
        expect(imageAvailableTiers(agnesProfile())).toEqual(["1k", "2k", "4k"]);
        expect(imageAvailableTiers(grokProfile())).toEqual(["1k", "2k"]);
        expect(imageAvailableTiers(cappedProfile())).toEqual(["1k"]);
    });

    test("imageTierSelection：比例模型发比例+档位 quality；尺寸模型取精确成员", () => {
        expect(imageTierSelection(grokProfile(), "2k", "3:4")).toEqual({ size: "3:4", quality: "2k" });
        expect(imageTierSelection(agnesProfile(), "4k", "3:4")).toEqual({ size: "2448x3264" });
    });
});

describe("画质档位吸附（defaultImageParamsForModel 吸收点）", () => {
    test("档位未设置 → 行为与现状一致（零变化）", () => {
        useCreationPreferencesStore.setState({ preferences: {} });
        const config = aiConfig([{ model: "agnes-image-2.5-flash", profile: agnesProfile() }]);
        expect(defaultImageParamsForModel(config, "relay::agnes-image-2.5-flash")).toEqual({ size: "1024x1024", quality: "auto", transparentBackground: "false" });
    });

    test("档位设置后按 min(档位, 能力) 吸附", () => {
        const config = aiConfig([{ model: "grok-imagine-image-2.0", profile: grokProfile() }]);
        useCreationPreferencesStore.setState({ preferences: { image: { qualityTier: "flagship" } } });
        expect(defaultImageParamsForModel(config, "relay::grok-imagine-image-2.0")).toMatchObject({ size: "1:1", quality: "2k" });
        useCreationPreferencesStore.setState({ preferences: { image: { qualityTier: "economy" } } });
        expect(defaultImageParamsForModel(config, "relay::grok-imagine-image-2.0")).toMatchObject({ size: "1:1", quality: "1k" });
    });

    test("吸附不可行（价目档不一致）→ 不应用，保持模型默认", () => {
        const config = aiConfig([{ model: "agnes-image-2.5-flash", profile: agnesProfile(), tiers: [{ selector: { quality: "4k" }, unitPriceMicrocredits: 9 }] }]);
        useCreationPreferencesStore.setState({ preferences: { image: { qualityTier: "flagship" } } });
        // 首个候选 4K 的 selection.quality 为 undefined，与 quality 选择器不匹配 → 逐级降档全部失败 → 回模型默认。
        expect(defaultImageParamsForModel(config, "relay::agnes-image-2.5-flash")).toEqual({ size: "1024x1024", quality: "auto", transparentBackground: "false" });
        useCreationPreferencesStore.setState({ preferences: {} });
    });

    test("imagePriceTiersForModel：命中返回档位，缺配置返回空数组", () => {
        const config = aiConfig([{ model: "agnes-image-2.5-flash", profile: agnesProfile(), tiers: [{ selector: { size: "2880x2880" }, unitPriceMicrocredits: 9 }] }]);
        expect(imagePriceTiersForModel(config, "relay::agnes-image-2.5-flash")).toHaveLength(1);
        expect(imagePriceTiersForModel(config, "relay::missing")).toEqual([]);
    });
});
