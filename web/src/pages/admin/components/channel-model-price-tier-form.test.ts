import assert from "node:assert/strict";
import test from "node:test";

import type { ChannelModel, ChannelModelPriceTier } from "@/services/api/wallet";

// Node 原生 TypeScript 测试运行器要求保留扩展名，项目编译器不允许该写法。
// @ts-expect-error -- Node 原生 TypeScript 测试运行器需要保留扩展名。
import { defaultPriceTier, finiteMicrocredits, legacyPriceTierToForm, priceTierPayloadFromForm, priceTierToForm } from "./channel-model-price-tier-form.ts";

test("编辑无价格档的旧模型时不再把顶层上游键固化进统一价格档", () => {
    const legacy: ChannelModel = {
        id: "model-1",
        modelKey: "deepseek-v4.1-flash",
        providerModelKey: "deepseek-v4.1-flash",
        billingMode: "fixed_request",
        unitPriceMicrocredits: 10,
        priceConfigured: true,
        enabled: true,
    } as unknown as ChannelModel;

    const tier = legacyPriceTierToForm(legacy);

    assert.equal(tier.providerModelKey, "");
    assert.equal(tier.matchMode, "default");
});

test("已存档位键在回显时保持原值，清除与否交给管理端告警处理", () => {
    const tier = priceTierToForm({
        selector: {},
        resolution: "*",
        videoSeconds: 0,
        providerModelKey: "sku-preview",
        billingMode: "fixed_request",
        unitPriceMicrocredits: 10,
        inputTokenPriceMicrocredits: 0,
        outputTokenPriceMicrocredits: 0,
        cachedTokenPriceMicrocredits: 0,
        priceConfigured: true,
        enabled: true,
    } as unknown as ChannelModelPriceTier);

    assert.equal(tier.providerModelKey, "sku-preview");
    assert.equal(tier.matchMode, "default");
});

test("新建默认价格档不携带上游键", () => {
    assert.equal(defaultPriceTier().providerModelKey, "");
    assert.equal(defaultPriceTier("advanced").providerModelKey, "");
});

// ★ F 组（评审线 R1）：NaN/Infinity 穿透 `|| 0` 守卫导致隐性账单偏差。
// 实测：`Infinity || 0` = Infinity（truthy 短路）→ Math.round(Infinity * 1e6) = Infinity
// → JSON.stringify 得 null（不是 NaNxNaN）→ 后端收到 null 而非拒绝。
test("finiteMicrocredits 拦下非有限值（Infinity/NaN/-Infinity）", () => {
    assert.equal(finiteMicrocredits(Infinity), 0);
    assert.equal(finiteMicrocredits(-Infinity), 0);
    assert.equal(finiteMicrocredits(NaN), 0);
    assert.equal(finiteMicrocredits(undefined), 0);
    assert.equal(finiteMicrocredits(null), 0);
    // 正常值不受影响
    assert.equal(finiteMicrocredits(0.1), 100_000);
    assert.equal(finiteMicrocredits(0), 0);
    assert.equal(finiteMicrocredits(1_000_000), 1_000_000_000_000);
});

test("★ F 组回归：payload 中价格字段不得出现非有限值（序列化后不为 null）", () => {
    const payload = priceTierPayloadFromForm(
        "image",
        {
            providerModelKey: "sku-x",
            matchMode: "default",
            billingMode: "fixed_request",
            unitPrice: Infinity,
            inputTokenPrice: Infinity,
            outputTokenPrice: -Infinity,
            cachedTokenPrice: NaN,
            costConfigured: true,
            costUnitPrice: Infinity,
            costInputTokenPrice: NaN,
            costOutputTokenPrice: Infinity,
            costCachedTokenPrice: -Infinity,
            priceConfigured: true,
            enabled: true,
        } as never,
        "upstream-x",
    );
    // 全部落到 0（有限值），不是 Infinity/NaN
    assert.equal(payload.unitPriceMicrocredits, 0);
    assert.equal(payload.inputTokenPriceMicrocredits, 0);
    assert.equal(payload.outputTokenPriceMicrocredits, 0);
    assert.equal(payload.cachedTokenPriceMicrocredits, 0);
    assert.equal(payload.costPricing.unitPriceMicrocredits, 0);
    assert.equal(payload.costPricing.inputTokenPriceMicrocredits, 0);
    assert.equal(payload.costPricing.outputTokenPriceMicrocredits, 0);
    assert.equal(payload.costPricing.cachedTokenPriceMicrocredits, 0);
    // ★ 决定性断言：序列化后不得出现 null（Infinity 的 JSON 形态）
    const serialized = JSON.stringify(payload);
    assert.ok(!serialized.includes(":null"), `payload must not serialize non-finite prices: ${serialized}`);
    // 且解析回来仍是数字
    const parsed = JSON.parse(serialized) as { unitPriceMicrocredits: number };
    assert.equal(typeof parsed.unitPriceMicrocredits, "number");
});

test("★ F 组回归：正常价格仍正确转换为微积分", () => {
    const payload = priceTierPayloadFromForm(
        "image",
        {
            providerModelKey: "sku-y",
            matchMode: "default",
            billingMode: "fixed_request",
            unitPrice: 0.1,
            inputTokenPrice: 0.5,
            outputTokenPrice: 1.25,
            cachedTokenPrice: 0.05,
            costConfigured: true,
            costUnitPrice: 0.02,
            costInputTokenPrice: 0.03,
            costOutputTokenPrice: 0.04,
            costCachedTokenPrice: 0.01,
            priceConfigured: true,
            enabled: true,
        } as never,
        "upstream-y",
    );
    assert.equal(payload.unitPriceMicrocredits, 100_000);
    assert.equal(payload.inputTokenPriceMicrocredits, 500_000);
    assert.equal(payload.outputTokenPriceMicrocredits, 1_250_000);
    assert.equal(payload.cachedTokenPriceMicrocredits, 50_000);
    assert.equal(payload.costPricing.unitPriceMicrocredits, 20_000);
});
