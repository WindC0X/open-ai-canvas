import { expect, test } from "bun:test";
import { ECOM_STARTER_CARDS, findEcomStarterCardByPrompt } from "../src/lib/canvas/canvas-ecom-starters";

// S1 v5（控制线 2026-09-27「面板归零」）：卡面入口下架后，本文件仅守护休眠保留件——
// 卡片数据（chip 匹配键）与 findEcomStarterCardByPrompt 反查。

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

test("意图卡文案：单轮选择题式澄清 + 不直接生成/不再追问（控制线 2026-09-27 退回重构 2.1，文案存档冻结）", () => {
    for (const card of ECOM_STARTER_CARDS) {
        expect(card.prompt).toMatch(/先不要直接(生成|开始)/);
        expect(card.prompt).toContain("①");
        expect(card.prompt).toContain("不用再追问");
        // 旧的「半句话」模板（等用户补素材）不得残留
        expect(card.prompt).not.toContain("我会提供商品素材");
    }
    expect(ECOM_STARTER_CARDS.find((card) => card.id === "white-product")!.prompt).toContain("② 无图直出");
    expect(ECOM_STARTER_CARDS.find((card) => card.id === "detail-3x4")!.prompt).toContain("③ 风格/竞品参考");
    expect(ECOM_STARTER_CARDS.find((card) => card.id === "batch-prompts")!.prompt).toContain("② 你从当前画布读取已有提示词");
    expect(ECOM_STARTER_CARDS.find((card) => card.id === "scene")!.prompt).toContain("③ 参考图混合");
});

test("findEcomStarterCardByPrompt：命中卡片原文返回卡；其余文本不命中（S1.1 chip 判定，v5 休眠保留）", () => {
    for (const card of ECOM_STARTER_CARDS) {
        expect(findEcomStarterCardByPrompt(card.prompt)?.id).toBe(card.id);
        expect(findEcomStarterCardByPrompt(`  ${card.prompt}  `)?.id).toBe(card.id);
    }
    expect(findEcomStarterCardByPrompt("普通消息")).toBeUndefined();
    expect(findEcomStarterCardByPrompt("")).toBeUndefined();
    // 只做完整原文匹配，不做片段匹配
    expect(findEcomStarterCardByPrompt(ECOM_STARTER_CARDS[0].prompt.slice(0, 20))).toBeUndefined();
});
