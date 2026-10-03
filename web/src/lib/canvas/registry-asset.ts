/**
 * 注册表资产层 —— 统一 schema + 资产形态枚举（能力组织层架构方案 §2/§3）。
 *
 * ★ 定位：把「能力条目」（capability-entries.ts，可执行工具）与「预设/配方资产」
 * （风格、光照、机位、模板…）归一到一个可索引、可下发的数据结构上。
 * 本文件是**前端消费侧**的统一 schema；真值源在服务端（seed + 管理端 CRUD，
 * 见架构方案 §3.2 裁定）。
 *
 * ★ 落枚举纪律（架构方案 §2.1，控制线 2026-10-03 审查约束）：
 * AssetKind 全集 15 值是**规格**，但枚举**分批落**，防「定义了但没人用」反模式。
 * 本枝（R25m 片 1-2）落：capability 2 值 + 收编清单用到的 9 值 + asset/image
 * 与 asset/video（**实码既有值**，O-03 时就在，保留是兼容非新增）。
 * 留槽不落：asset/audio、model/checkpoint —— 有真实消费者再进枚举。
 */

/**
 * 资产形态 —— 统一 schema 的归类标签。
 *
 * 注意：这是**形状标签不是用户概念**（架构方案 §2.2 原则 1），用户永远看不到
 * `preset/lighting` 这类串；它只用于归类、检索、下发。
 */
export type AssetKind =
    // ── 能力域（可执行工具）──
    /** 可执行工具（超分、圈选改图、抠图…） */
    | "capability/tool"
    /** 多步编排（未来 F-12 成套商拍） */
    | "capability/workflow"
    // ── 资产域（内容素材）──
    // 注：asset/image 与 asset/video 是实码既有值（capability-entries.ts O-03 基线），
    // 保留以兼容；asset/audio 为纯留槽，未落。
    /** 图片素材 */
    | "asset/image"
    /** 视频素材 */
    | "asset/video"
    // ── 预设域（参数类）──
    /** 风格预置 */
    | "preset/style"
    /** 光照预置 */
    | "preset/lighting"
    /** 机位/机身预置 */
    | "preset/camera"
    /** 镜头预置 */
    | "preset/lens"
    /** 运镜预置（★ 视频域，用户面窗口标注见架构方案 §6.2） */
    | "preset/motion"
    /** 渠道规格（Amazon 主图 / 详情长图 / 抖音竖版） */
    | "preset/channel-spec"
    // ── 模板域 ──
    /** 画布快照模板 */
    | "template/canvas"
    // ── 规格域 ──
    /** 提示词模板 */
    | "spec/prompt-template"
    /** 生成规格 */
    | "spec/generation";

/** 资产作用域（抄 skills 的 scope 四态，架构方案 §3.3）。 */
export type AssetScope = "public" | "favorites" | "custom";

/**
 * 统一资产记录 —— 前端消费面。
 *
 * 字段来源见架构方案 §3.3 映射契约：服务端 `ToolSummary`（已 snake→camel）
 * 与前端 legacy 常量（CanvasStylePreset 等）各有一个适配器产出本结构。
 */
export type RegistryAsset = {
    /** 资产 id（服务端为数字 id；legacy 侧为字符串 id） */
    assetId: string | number;
    /** 资产形态（归类标签） */
    assetKind: AssetKind;
    /** 稳定英文标识（服务端 label_en / legacy 的 id）—— 用于 routeSlug 与防撞 */
    slug: string;
    /** 用户可见标题（服务端 label / legacy 的 title） */
    title: string;
    /** 分组（服务端 tag / legacy 的 category） */
    group: string;
    /** 模型面提示词 */
    prompt: string;
    /** 描述（可选：motion/nine_grid 有，style 无） */
    description?: string;
    /** 封面图 */
    coverUrl?: string;
    /** 参考图集（可选：仅 style 有 extra_info） */
    referenceImages?: string[];
    /** 宽高比（可选：仅 nine_grid 有 ratio） */
    aspect?: string;
    /** 作用域 */
    scope?: AssetScope;
    /** 是否启用 */
    enabled?: boolean;
    /**
     * 数据来源标记 —— 区分「服务端下发」与「本地离线降级」。
     * ★ 架构方案 §3.2 纪律：降级态必须标注，不得静默。
     */
    origin: "server" | "local-fallback";
};

/**
 * 资产清单结果 —— 带降级标记的读取结果。
 *
 * ★ 纪律（架构方案 §3.2 + 本仓「本地缓存 ≠ 服务端已保存」既有约定）：
 * 降级时 UI **必须**明示，不能把 fallback 当正常态。
 */
export type RegistryAssetListResult = {
    assets: RegistryAsset[];
    /** 是否处于离线降级态（true 时 UI 须明示） */
    degraded: boolean;
    /** 降级原因（供 UI 提示与日志） */
    degradedReason?: string;
};

/** 渠道规格 AssetKind 归属判定 —— 供适配器复用。 */
export const PRESET_ASSET_KINDS: ReadonlyArray<AssetKind> = [
    "preset/style",
    "preset/lighting",
    "preset/camera",
    "preset/lens",
    "preset/motion",
    "preset/channel-spec",
    "template/canvas",
    "spec/prompt-template",
    "spec/generation",
];

/** 能力域 AssetKind（可执行工具）。 */
export const CAPABILITY_ASSET_KINDS: ReadonlyArray<AssetKind> = ["capability/tool", "capability/workflow"];

/**
 * 服务端工具类型（`ToolType`）→ AssetKind 的派生规则（架构方案 §3.3「assetKind 由前端派生」）。
 *
 * 未知类型回落到 `preset/style` 之外的中性值 —— 返回 undefined 让调用方决定，
 * 避免静默归错类。
 */
export function assetKindFromToolType(toolType: string): AssetKind | undefined {
    switch (toolType) {
        case "style":
            return "preset/style";
        case "motion":
            return "preset/motion";
        case "nine_grid":
            return "template/canvas";
        default:
            return undefined;
    }
}

/**
 * 资产是否可在用户面展示。
 *
 * ★ 视频域窗口标注（架构方案 §6.2）：`preset/motion` 数据结构照收编，
 * 但**用户面不下发**（视频线启动批放开）。本函数是窗口标注的判定入口。
 */
export function isAssetVisibleToUser(asset: RegistryAsset, options: { videoLineEnabled?: boolean } = {}): boolean {
    if (asset.enabled === false) return false;
    if (asset.assetKind === "preset/motion" && !options.videoLineEnabled) return false;
    return true;
}
