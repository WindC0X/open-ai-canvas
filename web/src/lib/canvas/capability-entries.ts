/**
 * 能力登记处 seed —— 注册表条目层（能力组织层方案 §2.1）。
 *
 * ★ 为什么独立成文件（控制线 2026-10-03 裁定）：
 * 能力条目元数据与「按钮」定义分离。既有 `tool-registry` 注册的单元是**按钮**
 * （icon + handler），没有「能力」概念 —— F-01 抠图因此挂 4 处手工接线。本文件
 * 是「能力」层的登记位：一个能力一条记录，**禁止**把元数据塞进按钮定义的字段
 * 或注释里（升格枝要按记录消费，按档位生成各入口）。
 *
 * 本枝（O-03 层2）只落**档 1**（画布内弹窗）的实际入口；其余档位（⌘K 条目、
 * /create 预设卡、`/canvas/:id/:tool` 子路径、工具页 routeSlug）的生成留待
 * 注册表升格枝（W5 R25m 前后）。
 *
 * 字段口径依据：`/mnt/f/CODE/Project/canvas/能力组织层方案-2026-10-03.md` §2.1 + §4。
 */

import type { AssetKind } from "./registry-asset";

/** 目标界面档位（能力组织层方案 §4 的四档）。 */
export type CapabilityEntryTier =
    /** 档 0：点卡出图（/create 卡网格），端到端不见画布 */
    | 0
    /** 档 1：画布内弹窗 */
    | 1
    /** 档 2：独立工具页 */
    | 2
    /** 档 3：自由画布 */
    | 3;

/**
 * 上下文要求谓词 —— 声明该能力需要什么画布上下文才能执行。
 *
 * 来源：能力组织层方案 §9 W4 交付硬清单①（2026-10-03 三模型审查采纳）。
 * 解耦命令协议：入口按此谓词过滤（不满足时不渲染或禁用），
 * 使能力条目与具体按钮/页面解耦。
 */
export type CapabilityContextRequirement =
    /** 无上下文要求（可脱离画布执行） */
    | "none"
    /** 需要恰好一张图片节点作为输入 */
    | "single_image"
    /** 需要选区（多节点或框选区域） */
    | "selection";

/**
 * 入口登记 —— 该能力在 UI 上暴露的入口点（架构方案 §1.4 待建字段）。
 *
 * ★ 为什么需要（架构方案 §1.4）：实码此前**没有入口登记** —— O-03 的工具栏条目
 * 是手工接线（`canvas-image-toolbar-tools.tsx` 里独立写了一份 id），能力条目与
 * 按钮层只有注释层面的约定，没有机器可校验的关联。补本字段后，升格枝可校验
 * 「每个已声明入口都真实存在」。
 */
export type CapabilityEntryPoint = {
    /** 入口形态 */
    kind: "node-toolbar" | "selection-toolbar" | "main-toolbar" | "command-palette" | "create-card" | "canvas-route";
    /** 入口在对应层里的 id（须与真实定义一致，守卫测试校验） */
    target: string;
};

/** 能力条目 —— 注册表条目层的单元。 */
export type CapabilityEntry = {
    /** 能力 id（`能力域.动作` 形态，与按钮层 id 区分）。 */
    id: string;
    /** 用户可见名称。 */
    name: string;
    /** 目标界面档位（§4 四档的具体落点）。 */
    tier: CapabilityEntryTier;
    /**
     * 上下文要求谓词（§9 硬清单①）。
     * 解耦命令协议：入口按此谓词过滤，不满足时不渲染/禁用。
     */
    contextRequirement: CapabilityContextRequirement;
    /**
     * 所属资产形态（元数据，不是用户概念）。
     * 类型引用统一 schema（registry-asset.ts 的 AssetKind，架构方案 §2.1）。
     */
    assetKind: AssetKind;
    /**
     * 参数面引用：该能力的可调参数清单。
     * `field` 对应参数面的字段名，`options` 为可选取值（空数组 = 自由输入）。
     */
    parameterSurface: Array<{
        field: string;
        label: string;
        options: string[];
        /** 默认值（零参数预设之外的默认档）。 */
        default?: string;
    }>;
    /** 执行链引用：前端执行函数名 + 执行位置说明。 */
    executionChain: {
        /** 前端执行函数（生成链路入口）。 */
        handler: string;
        /** 执行位置：云端任务链 / 本地。 */
        location: "cloud" | "local";
        /** 实测主力渠道（无则显式写「暂无」）。 */
        primaryChannel: string;
        /**
         * 本能力要求的计价操作（operation）。
         *
         * ★ 为什么需要（2026-10-04 控制线追加）：计价是**按 operation 匹配价格档**的
         * （后端 `model_router.go` 的 `skuSelectorForIntent` → `channelModelPriceTierForIntent`）。
         * 若渠道没有该 operation 的精确档，请求会**静默落通配档**（step 0 探针实测：
         * 无 `image_upscale` 档时落 `T_DEFAULT`，价 100 而非 777，且不报错）。
         * 声明后，模型选择器/门控层可以据此过滤掉不支持的渠道。
         *
         * ★ 本批只做**声明侧**：过滤消费留给门控批。
         * 无计价要求的能力写空数组（不得省略字段）。
         */
        requiredOperations: string[];
    };
    /**
     * 零参数预设引用：进卡片时的默认值。
     * 显式写「暂无」—— 控制线裁定不许缺字段。
     */
    zeroParameterPreset: string;
    /**
     * 入口登记（架构方案 §1.4 待建字段，R25m 落）。
     * 每个入口的 target 须指向真实存在的按钮/命令 id —— 由守卫测试校验。
     */
    entryPoints: CapabilityEntryPoint[];
    /**
     * 注册表版本锚点（架构方案 §1.4 待建字段，R25m 落）。
     * 回滚策略（§5）与跨文件收编需要能判断「这条记录属于哪次收编」。
     */
    registryVersion: number;
};

/**
 * 能力登记表。
 *
 * 首批原生条目：O-03 层2 超分（F-01/F-02 为手工接线，未登记）。
 */
export const CAPABILITY_ENTRIES: CapabilityEntry[] = [
    {
        id: "image.superResolve",
        name: "AI 超分",
        // 档 1：能力组织层方案 §4 表明确列「超分W5」为画布内弹窗档。
        tier: 1,
        // 超分作用于单张源图（输入固定 1 张，输出固定 1 张）。
        contextRequirement: "single_image",
        assetKind: "capability/tool",
        parameterSurface: [
            {
                field: "targetResolution",
                label: "目标档",
                options: ["2k", "4k"],
                default: "2k",
            },
            {
                // 命名分流红线（MASTER-PLAN L399）：保真放大为默认，AI 增强需勾选确认。
                field: "mode",
                label: "放大方式",
                options: ["faithful", "enhance"],
                default: "faithful",
            },
        ],
        executionChain: {
            handler: "superResolveImageNode",
            location: "cloud",
            // F-02 渠道实测门同源结论（见 docs/artifacts/f02-scene-task-book.md §10.3）。
            primaryChannel: "a6api · nano-banana-2",
            // 超分走独立计价操作（O-03 层2）：渠道未配该档时会静默落通配档（step 0 探针实测）。
            requiredOperations: ["image_upscale"],
        },
        zeroParameterPreset: "暂无",
        // O-03 实际入口：图片工具栏（手工接线层 canvas-image-toolbar-tools.tsx 的 id）。
        entryPoints: [{ kind: "node-toolbar", target: "superResolve" }],
        registryVersion: 1,
    },
    {
        id: "image.annotateEdit",
        name: "圈选改图",
        // 档 1：能力组织层方案 §4 表明确列「圈选改图W5」为画布内弹窗档。
        tier: 1,
        // F-08 控制线裁定（2026-10-05）：圈选是弹窗内交互，入口前提只需单图。
        contextRequirement: "single_image",
        assetKind: "capability/tool",
        parameterSurface: [
            {
                field: "actionHint",
                label: "编辑意图",
                options: ["modify", "replace", "remove"],
                default: "modify",
            },
        ],
        executionChain: {
            handler: "editAnnotatedImageNode",
            location: "cloud",
            // F-08 渠道实测门同源结论（a6api · nano-banana-2 实测两样本，见任务书验收节）。
            primaryChannel: "a6api · nano-banana-2",
            // 圈选改图是普通图片编辑，按图生图计价（无独立 operation）。
            requiredOperations: [],
        },
        zeroParameterPreset: "暂无",
        // F-08 实际入口：图片工具栏「圈选改图」（手工接线层 canvas-image-toolbar-tools.tsx 的 id）。
        entryPoints: [{ kind: "node-toolbar", target: "annotationEdit" }],
        registryVersion: 1,
    },
];

/** 按 id 查能力条目。 */
export function findCapabilityEntry(id: string): CapabilityEntry | undefined {
    return CAPABILITY_ENTRIES.find((entry) => entry.id === id);
}

/** 按目标档位筛选能力条目（升格枝按档位生成入口时使用）。 */
export function capabilityEntriesByTier(tier: CapabilityEntryTier): CapabilityEntry[] {
    return CAPABILITY_ENTRIES.filter((entry) => entry.tier === tier);
}

/**
 * 上下文是否满足能力要求（解耦命令协议的判定入口）。
 *
 * @param entry 能力条目
 * @param context 当前画布上下文
 */
export function capabilityContextSatisfied(
    entry: CapabilityEntry,
    context: { imageCount: number; hasSelection: boolean },
): boolean {
    switch (entry.contextRequirement) {
        case "none":
            return true;
        case "single_image":
            return context.imageCount === 1;
        case "selection":
            return context.hasSelection;
    }
}
