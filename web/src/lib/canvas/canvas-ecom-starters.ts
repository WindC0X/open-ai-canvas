import { modelOptionName, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";
import { Image, LayoutPanelTop, ListChecks, Mountain, type LucideIcon } from "lucide-react";

/**
 * S1 电商 starter 卡（Agent 面板新对话态）。
 * 点击 = 走 3b3fe456 自增 id prefill 命令通道立即执行（不另造发送路径）；
 * 卡片语义 =「意图卡」（控制线 2026-09-27 退回重构）：发送「意图 + 澄清指令」复合 prompt，
 * Agent 首轮必须做单轮选择题式澄清（三分支等权，无图直出不得降格），用户任意回复即进入生成。
 * 副标题 = 动作 · 相对成本档；价格类数字一律运行时计算，本文件不存价格。
 */

export type EcomStarterIcon = "image" | "detail" | "batch" | "scene";

/** starter 卡图标（欢迎卡与聊天 chip 共用）。 */
export const ECOM_STARTER_ICONS: Record<EcomStarterIcon, LucideIcon> = {
    image: Image,
    detail: LayoutPanelTop,
    batch: ListChecks,
    scene: Mountain,
};

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

/**
 * 控制线 2026-09-27 已批 4 张（三种内容形态 + 一个批量文本）；同日退回重构：
 * prompt = 「意图 + 澄清指令」复合文案（单轮选择题式澄清、规格默认值确认、禁止直接生成/多轮追问/强制附图）。
 */
export const ECOM_STARTER_CARDS: EcomStarterCard[] = [
    {
        id: "white-product",
        title: "白底产品图",
        action: "生成主图",
        cost: "约消耗 1 张图档",
        prompt: "帮我做电商白底产品主图（1:1、纯白背景）。先不要直接生成，请先用一条消息、选择题式地和我确认制作方式：① 用商品实拍图——画布里已有商品图的话，告诉我怎么用 @ 引用它；没有就让我上传；② 无图直出——我给出商品名称或类目，你凭描述直接生成；③ 风格/竞品参考——我提供参考图和描述，由你生成商品本体。同时确认：比例默认 1:1、纯白背景，可以吗？我回复后不用再追问，先复述方案，再开始生成。",
        icon: "image",
    },
    {
        id: "detail-3x4",
        title: "3:4 详情图",
        action: "生成详情图",
        cost: "约消耗 1 张图档",
        prompt: "帮我做 3:4 电商详情竖图（适合详情页展示、信息层级清晰）。先不要直接生成，请先用一条消息、选择题式地和我确认制作方式：① 用商品实拍图——画布里已有商品图的话，告诉我怎么用 @ 引用它；没有就让我上传；② 无图直出——我给出商品名称或类目，你凭描述直接生成；③ 风格/竞品参考——我提供参考图和描述，由你生成。同时确认：比例默认 3:4，可以吗？我回复后不用再追问，先复述方案，再开始生成。",
        icon: "detail",
    },
    {
        id: "batch-prompts",
        title: "批量优化提示词",
        action: "批量调优",
        cost: "纯文本 · 小额",
        prompt: "帮我批量优化一批商品图生成提示词（统一风格与规格描述，逐条给出优化结果）。先不要直接开始，请先用一条消息、选择题式地和我确认素材来源：① 我把现有提示词粘贴给你；② 你从当前画布读取已有提示词。同时确认：优化目标默认是「统一风格 + 补全规格（比例/背景/光线），保持单条原意」，可以吗？我回复后不用再追问，先复述方案，再开始优化。",
        icon: "batch",
    },
    {
        id: "scene",
        title: "商品场景图",
        action: "生成场景图",
        cost: "约消耗 1 张图档",
        prompt: "帮我把商品放进真实使用场景，生成一张生活方式场景图（突出商品与环境的关系）。先不要直接生成，请先用一条消息、选择题式地和我确认制作方式：① 用商品实拍图——画布里已有商品图的话，告诉我怎么用 @ 引用它；没有就让我上传；② 无图直出——我给出商品名称或类目和想要的场景，你凭描述直接生成；③ 参考图混合——我提供风格/竞品参考图加文字描述，由你生成。同时确认：画面默认走自然生活场景，比例默认 1:1，可以吗？我回复后不用再追问，先复述方案，再开始生成。",
        icon: "scene",
    },
];

/**
 * 反查（S1.1 控制线 P0）：用户消息内容命中 starter 卡原文时返回对应卡，供渲染层 chip 化。
 * 纯内容匹配：数据层/导出/历史零改动，刷新/历史恢复后同样命中。
 */
export function findEcomStarterCardByPrompt(content: string): EcomStarterCard | undefined {
    const trimmed = content.trim();
    return ECOM_STARTER_CARDS.find((card) => card.prompt === trimmed);
}

/**
 * S1 v3.2（控制线 2026-09-27）：场景钻取卡区数据——广告电商复用四张 starter 卡；
 * 其余场景返回 null（不渲染卡区，无假空态）。
 */
export function resolveSceneStarterCards(sceneKey: string): EcomStarterCard[] | null {
    return sceneKey === "ecommerce" ? ECOM_STARTER_CARDS : null;
}

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
