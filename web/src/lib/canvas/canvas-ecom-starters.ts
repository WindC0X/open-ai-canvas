import { Image, LayoutPanelTop, ListChecks, Mountain, type LucideIcon } from "lucide-react";

/**
 * S1 电商 starter 卡数据（Agent 面板）。
 * 控制线 2026-09-27 v5「面板归零」后为**休眠件**：卡面入口（欢迎卡/场景卡区）已整体下架，
 * 本文件仅保留卡片数据与 findEcomStarterCardByPrompt 反查（供渲染层 chip 化复用），
 * 为未来 slash 指令 / 对话内推荐入口留底——入口重建时沿用同一数据与匹配语义即可。
 *
 * 卡片文案存档语义（控制线 2026-09-27 退回重构）：点击 = 自增 id 命令通道发送「意图 + 澄清指令」
 * 复合 prompt，Agent 首轮单轮选择题式澄清（三分支等权，无图直出不得降格）；
 * 副标题 = 动作 · 相对成本档；价格类数字一律运行时计算，本文件不存价格。
 */

export type EcomStarterIcon = "image" | "detail" | "batch" | "scene";

/** starter 卡图标（chip 渲染共用）。 */
export const ECOM_STARTER_ICONS: Record<EcomStarterIcon, LucideIcon> = {
    image: Image,
    detail: LayoutPanelTop,
    batch: ListChecks,
    scene: Mountain,
};

export type EcomStarterCard = {
    id: string;
    title: string;
    /** 副标题前半：动作（历史卡面用，数据留档）。 */
    action: string;
    /** 副标题后半：相对成本档（不含价格数字，历史卡面用，数据留档）。 */
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
