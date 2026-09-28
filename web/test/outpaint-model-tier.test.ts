import { describe, expect, test } from "bun:test";

import { applyOutpaintTierSeed, defaultImageCapabilityConfig, isOutpaintEligible, outpaintTierBadge, outpaintTierRank } from "../src/lib/model-capabilities";

describe("扩图档位白名单", () => {
    test("isOutpaintEligible：仅推荐/可用通过", () => {
        expect(isOutpaintEligible({ outpaintTier: "recommended" })).toBe(true);
        expect(isOutpaintEligible({ outpaintTier: "capable" })).toBe(true);
        expect(isOutpaintEligible({ outpaintTier: "uncertified" })).toBe(false);
        expect(isOutpaintEligible({})).toBe(false);
        expect(isOutpaintEligible(null)).toBe(false);
        expect(isOutpaintEligible(undefined)).toBe(false);
    });

    test("播种：nano 族缺省推荐；其他模型保持未认证", () => {
        expect(defaultImageCapabilityConfig("openai-image", "nano-banana-2").outpaintTier).toBe("recommended");
        expect(defaultImageCapabilityConfig("gemini-image", "nano-banana2").outpaintTier).toBe("recommended");
        expect(defaultImageCapabilityConfig("gemini-image", "gemini-3.1-flash-image-preview").outpaintTier).toBe("recommended");
        expect(defaultImageCapabilityConfig("openai-image", "gpt-image-2.5").outpaintTier).toBeUndefined();
        expect(defaultImageCapabilityConfig("openai-image", "gpt-image-2.5-sunburst").outpaintTier).toBeUndefined();
    });

    test("显式档位不覆写（降档/升档钉住）", () => {
        const base = defaultImageCapabilityConfig("openai-image", "gpt-image-2.5");
        expect(applyOutpaintTierSeed({ ...base, outpaintTier: "capable" }, "nano-banana-2").outpaintTier).toBe("capable");
        expect(applyOutpaintTierSeed({ ...base, outpaintTier: "uncertified" }, "nano-banana-2").outpaintTier).toBe("uncertified");
        expect(applyOutpaintTierSeed({ ...base }, "nano-banana-2").outpaintTier).toBe("recommended");
    });
});

describe("档位徽章与排序（2026-09-28 用户反馈）", () => {
    test("outpaintTierBadge：推荐/可用有徽章，未认证无", () => {
        expect(outpaintTierBadge("recommended")).toEqual({ label: "推荐", tone: "accent", title: "扩图推荐档" });
        expect(outpaintTierBadge("capable")).toEqual({ label: "可用", tone: "muted", title: "扩图可用档：未验证扩图效果" });
        expect(outpaintTierBadge("uncertified")).toBeNull();
        expect(outpaintTierBadge(undefined)).toBeNull();
    });

    test("outpaintTierRank：推荐 < 可用 < 未认证（默认选中推荐优先）", () => {
        expect(outpaintTierRank("recommended")).toBe(0);
        expect(outpaintTierRank("capable")).toBe(1);
        expect(outpaintTierRank("uncertified")).toBe(2);
        expect(outpaintTierRank(undefined)).toBe(2);
    });
});
