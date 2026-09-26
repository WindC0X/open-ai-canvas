import { expect, test } from "bun:test";
import { ECOM_STARTER_CARDS, ecomStarterSubtitle, isFreeExperienceModel, resolveStarterRunDecision } from "../src/lib/canvas/canvas-ecom-starters";
import type { AiConfig } from "../src/stores/use-config-store";

test("电商 starter 卡数据：4 张、字段齐、无价格数字", () => {
    expect(ECOM_STARTER_CARDS).toHaveLength(4);
    const ids = new Set(ECOM_STARTER_CARDS.map((card) => card.id));
    expect(ids.size).toBe(4);
    // 价格类数字禁止硬编码（「1 张图」是相对数量不是价格）；出现 ¥/元/积分 成本即失败。
    const pricePattern = /[¥￥$]|\d+\s*(元|积分|分)/;
    for (const card of ECOM_STARTER_CARDS) {
        expect(card.title.length).toBeGreaterThan(0);
        expect(card.action.length).toBeGreaterThan(0);
        expect(card.cost.length).toBeGreaterThan(0);
        expect(card.prompt.length).toBeGreaterThan(0);
        expect(card.title).not.toMatch(pricePattern);
        expect(card.cost).not.toMatch(pricePattern);
        expect(card.prompt).not.toMatch(pricePattern);
    }
});

test("副标题合成：默认相对档位；免费通道替换「免费体验」", () => {
    const [white, detail, batch, scene] = ECOM_STARTER_CARDS;
    expect(ecomStarterSubtitle(white)).toBe("生成主图 · 约消耗 1 张图档");
    expect(ecomStarterSubtitle(detail)).toBe("生成详情图 · 约消耗 1 张图档");
    expect(ecomStarterSubtitle(batch)).toBe("批量调优 · 纯文本 · 小额");
    expect(ecomStarterSubtitle(scene)).toBe("生成场景图 · 约消耗 1 张图档");
    expect(ecomStarterSubtitle(white, true)).toBe("生成主图 · 免费体验");
});

test("resolveStarterRunDecision：空值 ignore / 忙态 toast / 空闲 submit", () => {
    expect(resolveStarterRunDecision({ value: "  ", busy: false, running: false })).toBe("ignore");
    expect(resolveStarterRunDecision({ value: "hi", busy: true, running: false })).toBe("busy-toast");
    expect(resolveStarterRunDecision({ value: "hi", busy: false, running: true })).toBe("busy-toast");
    expect(resolveStarterRunDecision({ value: "hi", busy: false, running: false, pending: true })).toBe("busy-toast");
    expect(resolveStarterRunDecision({ value: "hi", busy: false, running: false })).toBe("submit");
});

test("isFreeExperienceModel：全零价 → 免费体验；缺价或非零价 → 否", () => {
    const makeConfig = (cost: Record<string, unknown>) =>
        ({
            channels: [{ id: "cpa-test", name: "cpa-test", models: ["test-model"], modelCosts: [{ model: "test-model", ...cost }] }],
            model: "test-model",
        }) as unknown as AiConfig;
    expect(isFreeExperienceModel(makeConfig({ billingMode: "token", unitPriceMicrocredits: 0, inputTokenPriceMicrocredits: 0, outputTokenPriceMicrocredits: 0, cachedTokenPriceMicrocredits: 0 }), "test-model")).toBe(true);
    expect(isFreeExperienceModel(makeConfig({ billingMode: "token", unitPriceMicrocredits: 0, inputTokenPriceMicrocredits: 5, outputTokenPriceMicrocredits: 5, cachedTokenPriceMicrocredits: 0 }), "test-model")).toBe(false);
    expect(isFreeExperienceModel(makeConfig({ billingMode: "fixed_request", unitPriceMicrocredits: 20 }), "test-model")).toBe(false);
    expect(isFreeExperienceModel(makeConfig({ billingMode: "fixed_request", unitPriceMicrocredits: 0 }), "test-model")).toBe(true);
    expect(isFreeExperienceModel(makeConfig({ billingMode: "fixed_request", unitPriceMicrocredits: 0 }), "missing-model")).toBe(false);
});
