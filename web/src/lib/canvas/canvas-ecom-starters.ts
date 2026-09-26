import { modelOptionName, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";

/**
 * S1 电商 starter 卡（Agent 面板新对话态）。
 * 点击 = 走 3b3fe456 自增 id prefill 命令通道立即执行（不另造发送路径）；
 * 副标题 = 动作 · 相对成本档；价格类数字一律运行时计算，本文件不存价格。
 */

export type EcomStarterIcon = "image" | "detail" | "batch" | "scene";

export type EcomStarterCard = {
    id: string;
    title: string;
    /** 副标题前半：动作。 */
    action: string;
    /** 副标题后半：相对成本档（不含价格数字）。 */
    cost: string;
    prompt: string;
    icon: EcomStarterIcon;
};

/** 控制线 2026-09-27 已批：4 张（三种内容形态 + 一个批量文本）；文案逐字锁定，勿改。 */
export const ECOM_STARTER_CARDS: EcomStarterCard[] = [
    {
        id: "white-product",
        title: "白底产品图",
        action: "生成主图",
        cost: "约消耗 1 张图档",
        prompt: "帮我做一张电商白底产品主图：1:1 构图、纯白背景、主体居中，保留商品原有细节。我会提供商品素材。",
        icon: "image",
    },
    {
        id: "detail-3x4",
        title: "3:4 详情图",
        action: "生成详情图",
        cost: "约消耗 1 张图档",
        prompt: "帮我做一张 3:4 电商详情竖图：构图清晰、信息层级分明、适合详情页展示。我会提供商品素材。",
        icon: "detail",
    },
    {
        id: "batch-prompts",
        title: "批量优化提示词",
        action: "批量调优",
        cost: "纯文本 · 小额",
        prompt: "帮我批量优化一批商品图生成提示词：统一风格与规格描述，逐条给出优化结果。你可以粘贴或让我从画布读取现有提示词。",
        icon: "batch",
    },
    {
        id: "scene",
        title: "商品场景图",
        action: "生成场景图",
        cost: "约消耗 1 张图档",
        prompt: "帮我把商品放进真实使用场景：生成一张生活方式场景图，突出商品与环境的关系。我会提供商品素材与场景方向。",
        icon: "scene",
    },
];

/** 副标题合成：免费通道（运行时判定）时成本段替换为「免费体验」。 */
export function ecomStarterSubtitle(card: EcomStarterCard, freeExperience = false): string {
    return `${card.action} · ${freeExperience ? "免费体验" : card.cost}`;
}

export type StarterRunDecision = "submit" | "busy-toast" | "ignore";

/**
 * 点击裁决（控制线 2026-09-27 裁决 2b）：
 * 空值 → ignore；busy/running → busy-toast（守卫拒绝必须可见，禁止静默吞）；
 * pending（submit 内部幂等守卫已在途，同 tick 二次命令会静默挡下）→ 同样走 busy-toast；
 * 否则 → submit（复用现有 submit 发送路径）。
 */
export function resolveStarterRunDecision(input: { value: string; busy: boolean; running: boolean; pending?: boolean }): StarterRunDecision {
    if (!input.value.trim()) return "ignore";
    if (input.busy || input.running || input.pending) return "busy-toast";
    return "submit";
}

const zeroPrice = (value: number | undefined) => value === 0;

/**
 * 免费体验判定（运行时）：默认模型解析到的渠道价目全为 0 → true。
 * 只覆盖「免费」语义；「低价」细分不在本判定内（后续按需扩展）。
 */
export function isFreeExperienceModel(config: AiConfig, modelOptionValue: string): boolean {
    const channel = resolveModelChannel(config, modelOptionValue);
    const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(modelOptionValue));
    if (!cost) return false;
    const tiers = cost.logicalPriceTiers || [];
    if (tiers.length) {
        return tiers.every((tier) =>
            tier.billingMode === "token"
                ? zeroPrice(tier.inputTokenPriceMicrocredits) && zeroPrice(tier.outputTokenPriceMicrocredits) && zeroPrice(tier.cachedTokenPriceMicrocredits)
                : zeroPrice(tier.unitPriceMicrocredits),
        );
    }
    if (cost.billingMode === "token") {
        return zeroPrice(cost.inputTokenPriceMicrocredits) && zeroPrice(cost.outputTokenPriceMicrocredits) && zeroPrice(cost.cachedTokenPriceMicrocredits);
    }
    return zeroPrice(cost.unitPriceMicrocredits);
}
