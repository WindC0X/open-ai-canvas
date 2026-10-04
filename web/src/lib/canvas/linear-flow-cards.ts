/**
 * 直线入口卡 —— 数据层 + 纯函数（W5 直线入口设计卡 §3.1 梯度 0）。
 *
 * ★ 为什么需要这一层：
 * `/create` 页现有卡（`creationEmptySuggestions` / `creationFeaturedWorks`）点击后**只回填
 * 提示词**，用户仍需自己走 Agent 对话或画布 —— 没有「点卡出图」闭环（设计卡缺口 D1）。
 * 本模块把**休眠的电商 starter 卡**（`ECOM_STARTER_CARDS`）唤醒为**可执行卡**：
 * 每张卡自带直线流程所需的步骤序列、澄清问题与提示词模板，由 `linear-flow-runner` 执行。
 *
 * ★ 命名纪律（设计卡 §3.1 控制线输入清单）：
 * 卡名**按任务不按能力**（「白底主图」而不是「抠图」；「场景图」而不是「图像合成」）。
 * 与 DESIGN.md 命名分流红线同源 —— 能力词留给工具面，任务词留给入口面。
 *
 * ★ 数量纪律（控制线 2026-10-04 裁定）：
 * 首批可执行卡 **≤8 张**（防「网格堆卡」稀释完成率数据）。本轮实际 4 张 ——
 * 4 张存量 ecom-starters 全收，**不新造卡数据**（控制线裁定②：8 是上限不是配额）。
 * 换背景/九宫格移出本批（存量无卡数据，前者挂 W5-W6 缝隙批，后者挂 W8 四档入口盘点）。
 *
 * ★ 与场景库 / R25m 5 源的关系（控制线裁定③）：
 * 场景库 10 条（`SCENE_PRESETS`）与 R25m 收编的 5 源（光照 8 / 机位 8 / 镜头 8 / 场景 10 /
 * 渠道规格）是**卡流程内的参数面**（用户选完卡后调参、或被 ≤3 问带出），**不是卡列表来源**。
 * 卡列表只来自 ecom-starters 4 张存量。
 */
import { ECOM_STARTER_CARDS, ECOM_STARTER_ICONS, type EcomStarterCard, type EcomStarterIcon } from "@/lib/canvas/canvas-ecom-starters";
import { findScenePreset } from "@/lib/canvas/scene-presets";

/**
 * 直线流程步骤（设计卡 §3.1 梯度 0 的固定序列）。
 *
 * ★ 交付步（`deliver`）必须在卡流程内（硬验收③）—— 不能把用户推去画布或任务中心取结果。
 */
export type LinearFlowStepId = "pick" | "upload" | "clarify" | "generate" | "deliver";

export type LinearFlowStep = {
    id: LinearFlowStepId;
    title: string;
    /** 该步在直线流程内的门控态（设计卡 §3.2）。 */
    gate: "allowed" | "locked" | "hidden";
};

/**
 * 澄清问题（≤3 问，设计卡 §3.1「≤3 问澄清」）。
 *
 * ★ 为什么是「问」而不是「表单」：卡流程面向小白，选择题式澄清是 starter 卡文案存档
 * 语义的延续（`canvas-ecom-starters.ts` 头部注释：「Agent 首轮单轮选择题式澄清」）。
 * 自由文本问（`kind: "text"`）用于商品描述这类无法枚举的输入 —— 一问一答，不堆字段。
 */
export type LinearFlowQuestionKind = "select" | "text";

export type LinearFlowQuestion = {
    id: string;
    kind: LinearFlowQuestionKind;
    /** 问题文本（用户面中文）。 */
    question: string;
    /** 自由文本问的占位提示（`kind === "text"` 时使用）。 */
    placeholder?: string;
    /** 选择题选项（`kind === "select"` 时使用）；第一项为默认推荐。 */
    options?: Array<{ value: string; label: string; hint?: string }>;
    /** 是否必答（默认 true；批量优化提示词等可选输入场景设 false）。 */
    required?: boolean;
};

/**
 * 可执行卡（直线流程的起点）。
 *
 * ★ 与 `EcomStarterCard` 的关系：`starter` 是**来源数据**（休眠件，prompt 为 Agent 对话
 * 文案），本类型是**可执行化后的卡**（自带步骤/问题/参数面）。两者不合并 ——
 * starter 保留其 Agent 路径语义（chip 反查仍在用），本类型只服务直线流程。
 */
export type LinearFlowCard = {
    id: string;
    /** 卡名 —— 按任务不按能力。 */
    title: string;
    /** 一句话说明（用户面）。 */
    hint: string;
    icon: EcomStarterIcon;
    /** 来源 starter 卡 id（可追溯；直线流程卡与休眠卡一一对应，不新造数据）。 */
    starterId: string;
    /** 直线流程的提示词模板（`{{...}}` 占位符由 `buildLinearFlowPrompt` 按答案填充）。 */
    promptTemplate: string;
    /** 澄清问题（≤3）。 */
    questions: LinearFlowQuestion[];
    /**
     * 场景预设 id —— 仅场景图类卡携带（默认值；用户实际选择见 `resolveLinearFlowScenePresetId`）。
     *
     * ★ 这是债一（`scenePresetId` 显式传递）的载体：卡作为链路起点**直接写入**
     * 节点/任务元数据，执行器零反查（见 `scene-execution.ts` 的标记优先路径）。
     * 非场景卡为 undefined，生成链路的场景改写器完全不介入。
     */
    scenePresetId?: string;
    /** 是否支持参考图上传（白底主图/场景图/详情图需要商品实拍图；纯文本卡不需要）。 */
    acceptsReference: boolean;
    /** 生成模式：image = 出图；text = 纯文本（批量优化提示词）。 */
    mode: "image" | "text";
};

/** 直线流程的固定步骤序列（设计卡 §3.1）。 */
export const LINEAR_FLOW_STEPS: LinearFlowStep[] = [
    { id: "pick", title: "选卡", gate: "allowed" },
    { id: "upload", title: "传图", gate: "allowed" },
    { id: "clarify", title: "确认", gate: "allowed" },
    { id: "generate", title: "出图", gate: "allowed" },
    { id: "deliver", title: "交付", gate: "allowed" },
];

/**
 * 首批可执行卡（4 张，全部来自休眠的 ecom-starters）。
 *
 * ★ 逐张对齐关系（不新造数据，只做「可执行化」改造）：
 *   white-product → 白底主图      （1:1 纯白背景主图）
 *   scene         → 场景图        （带 scenePresetId，走 F-02 场景执行链）
 *   detail-3x4    → 3:4 详情图    （详情页竖图）
 *   batch-prompts → 批量优化提示词（纯文本，无出图步）
 */
export const LINEAR_FLOW_CARDS: LinearFlowCard[] = [
    {
        id: "white-background-main",
        title: "白底主图",
        hint: "1:1 纯白背景 · 电商主图标准",
        icon: "image",
        starterId: "white-product",
        mode: "image",
        promptTemplate: "电商白底产品主图，{{product}}，纯白背景（#FFFFFF），商品居中，{{angle}}，柔和均匀布光，无阴影残留，1:1 方形构图，高清商品摄影",
        questions: [
            { id: "product", kind: "text", question: "商品是什么？", placeholder: "例如：白色陶瓷马克杯，带金色把手" },
            {
                id: "angle",
                kind: "select",
                question: "商品角度？",
                options: [
                    { value: "正面平视", label: "正面平视", hint: "最标准的电商主图角度" },
                    { value: "45 度俯视", label: "45 度俯视", hint: "更有立体感" },
                    { value: "正俯视", label: "正俯视", hint: "适合扁平类商品" },
                ],
            },
        ],
        acceptsReference: true,
    },
    {
        id: "scene-shot",
        title: "场景图",
        hint: "把商品放进真实使用场景",
        icon: "scene",
        starterId: "scene",
        mode: "image",
        promptTemplate: "{{product}} 的商品场景图，{{sceneBrief}}",
        questions: [
            {
                id: "scenePreset",
                kind: "select",
                question: "想要什么场景？",
                options: [
                    { value: "kitchen-morning", label: "晨光厨房", hint: "原木台面 · 暖光侧照" },
                    { value: "cafe-table", label: "咖啡店桌台", hint: "大理石桌面 · 侧窗光" },
                    { value: "studio-gradient", label: "影棚渐变底", hint: "无缝背景 · 柔光箱" },
                    { value: "outdoor-picnic", label: "户外野餐", hint: "草地格纹布 · 日光" },
                ],
            },
            { id: "product", kind: "text", question: "商品是什么？", placeholder: "例如：白色陶瓷马克杯，带金色把手" },
        ],
        // ★ 债一载体：卡直接携带场景预设 id，链路显式写入元数据（默认首项，用户选择见 resolveLinearFlowScenePresetId）。
        scenePresetId: "kitchen-morning",
        acceptsReference: true,
    },
    {
        id: "detail-3x4",
        title: "3:4 详情图",
        hint: "详情页竖图 · 信息层级清晰",
        icon: "detail",
        starterId: "detail-3x4",
        mode: "image",
        promptTemplate: "电商详情页竖图，{{product}}，3:4 竖版构图，信息层级清晰，{{style}}，高清商品摄影",
        questions: [
            { id: "product", kind: "text", question: "商品是什么？", placeholder: "例如：白色陶瓷马克杯，带金色把手" },
            {
                id: "style",
                kind: "select",
                question: "风格倾向？",
                options: [
                    { value: "简洁棚拍", label: "简洁棚拍", hint: "纯色背景，突出商品" },
                    { value: "生活场景", label: "生活场景", hint: "带环境与道具" },
                    { value: "材质特写", label: "材质特写", hint: "强调质感细节" },
                ],
            },
        ],
        acceptsReference: true,
    },
    {
        id: "batch-prompt-tune",
        title: "批量优化提示词",
        hint: "统一风格与规格描述 · 纯文本",
        icon: "batch",
        starterId: "batch-prompts",
        mode: "text",
        promptTemplate: "帮我批量优化以下商品图提示词，统一风格与规格描述（比例/背景/光线），保持单条原意：\n{{prompts}}",
        questions: [
            { id: "prompts", kind: "text", question: "把要优化的提示词粘进来（每行一条）", placeholder: "每行一条提示词…" },
        ],
        acceptsReference: false,
    },
];

/**
 * 首批卡数量上限（控制线 2026-10-04 裁定：≤8）。
 *
 * ★ 8 是**上限不是配额** —— 控制线裁定②明确「宁少勿造」。本常量用于测试断言，
 * 防后续批次无意识堆卡稀释完成率数据。
 */
export const LINEAR_FLOW_CARD_LIMIT = 8;

/** 按 id 查卡。 */
export function findLinearFlowCard(id: string): LinearFlowCard | undefined {
    return LINEAR_FLOW_CARDS.find((card) => card.id === id);
}

/** 卡对应的休眠 starter 数据（可追溯性：卡不新造数据，只做可执行化改造）。 */
export function starterForLinearFlowCard(card: LinearFlowCard): EcomStarterCard | undefined {
    return ECOM_STARTER_CARDS.find((starter) => starter.id === card.starterId);
}

/** 卡图标（复用 starter 图标表，不新增图标资产）。 */
export function linearFlowCardIcon(card: LinearFlowCard) {
    return ECOM_STARTER_ICONS[card.icon];
}

/**
 * 场景预设 id 的显式解析（债一核心）。
 *
 * ★ 优先级：用户答案 > 卡默认值 > undefined（非场景卡）。
 * 返回非空值时，调用方**必须**把它写进生成元数据（`metadata.scenePresetId`），
 * 执行器据此走标记路径，**零文本反查**（`detectScenePresetFromPrompt` 仅作 Agent 路径兜底）。
 */
export function resolveLinearFlowScenePresetId(card: LinearFlowCard, answers: Record<string, string> = {}): string | undefined {
    if (!card.scenePresetId) return undefined;
    const picked = String(answers.scenePreset || "").trim();
    return picked || card.scenePresetId;
}

/** 卡的问题列表（≤3 断言用；控制线「≤3 问」硬约束）。 */
export const LINEAR_FLOW_QUESTION_LIMIT = 3;

/**
 * 按答案填充提示词模板（纯函数，零 IO）。
 *
 * ★ 场景卡的 `{{sceneBrief}}` 取自场景库的用户面中文描述（`ScenePreset.brief`）——
 * 与 `scene-preset-chips.tsx` 的 `scenePresetBrief` 同源纪律：模型面英文（`variables`）
 * 不进中文 brief，避免「把商品放进a sunlit minimalist kitchen」这类中英夹杂。
 */
export function buildLinearFlowPrompt(card: LinearFlowCard, answers: Record<string, string> = {}): string {
    const scenePresetId = resolveLinearFlowScenePresetId(card, answers);
    const sceneBrief = scenePresetId ? findScenePreset(scenePresetId)?.brief || "" : "";
    const values: Record<string, string> = {
        ...answers,
        sceneBrief,
        scenePresetId: scenePresetId || "",
    };
    return card.promptTemplate.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(values[key] ?? "").trim());
}

/** 答案是否满足卡的必答要求（runner 的「下一步」门控）。 */
export function linearFlowAnswersComplete(card: LinearFlowCard, answers: Record<string, string> = {}): boolean {
    return card.questions.every((question) => {
        if (question.required === false) return true;
        return String(answers[question.id] || "").trim().length > 0;
    });
}

/**
 * 直线流程的任务/节点元数据（★ 债一显式传递的落点）。
 *
 * ★ 与 Agent 路径的根本差异：卡是链路起点，**不经 Agent 对话**，故可直接把
 * `scenePresetId` 写进元数据 —— 不需要 `detectScenePresetFromPrompt` 的句式反查。
 * Agent 路径（入口与执行器不同组件树 + 后端 patch 创建节点）仍走文本兜底，本函数不参与。
 */
export function buildLinearFlowMetadata(card: LinearFlowCard, answers: Record<string, string> = {}): Record<string, unknown> {
    const scenePresetId = resolveLinearFlowScenePresetId(card, answers);
    return {
        source: "linear-flow",
        linearFlowCardId: card.id,
        ...(scenePresetId ? { scenePresetId } : {}),
    };
}
