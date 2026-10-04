/**
 * 注册表适配器 —— 把两条数据源归一到统一 schema（架构方案 §3.3 映射契约）。
 *
 * 两个适配器对应本枝（R25m 片 1-2）的两个最小切片：
 *   ① 服务端下发：`ToolSummary`（tools.json seed 87 项，片 1 取 style 45）
 *   ② 本地 legacy：`CanvasStylePreset`（canvas-style-picker-modal.tsx，片 2 的 18 条）
 *
 * ★ 纪律（架构方案 §3.2）：
 * 服务端是唯一真值源；本地 legacy 只作**离线降级**，且必须带 `origin: "local-fallback"`
 * 标记 —— UI 据此明示「离线预设」，不得静默当成正常态。
 */

import type { CanvasStylePreset } from "./canvas-style-system";
import type { CameraProfile, LensProfile } from "./camera-prompt-library";
import type { EcomChannelPreset } from "@/lib/image-size-presets";
import type { CreationInspiration } from "@/pages/create/creation-inspirations";
import type { LegacyLightingPreset } from "./legacy-lighting-presets";
import { assetKindFromToolType, type AssetKind, type AssetSource, type RegistryAsset } from "./registry-asset";
import type { SkillPreset } from "@/services/api/skills";
import type { ToolItem, ToolSummary } from "@/services/api/tools";

/**
 * 服务端 `ToolSummary` → 统一资产记录。
 *
 * 映射契约见架构方案 §3.3（服务端为真值源，字段名以后端为准）。
 * 未知 toolType 返回 undefined —— 不静默归错类（调用方决定跳过还是兜底）。
 */
export function registryAssetFromToolSummary(tool: ToolSummary | ToolItem): RegistryAsset | undefined {
    const assetKind = assetKindFromToolType(String(tool.type));
    if (!assetKind) return undefined;

    // 列表摘要（ToolSummary）不含 prompt 大字段，详情（ToolItem）才有 ——
    // 列表场景 prompt 留空是预期，需要 prompt 的消费侧走详情接口。
    const prompt = "prompt" in tool ? tool.prompt : "";

    return {
        assetId: tool.id,
        assetKind,
        // 服务端 labelEn 是稳定英文标识（如 period_idol），用作 slug
        slug: tool.labelEn,
        title: tool.label,
        // 服务端 tag 是分组（style 用 period/… ，motion 用 basic/…）
        group: tool.tag,
        prompt: prompt ?? "",
        description: tool.desc || undefined,
        coverUrl: tool.cover || undefined,
        aspect: tool.ratio || undefined,
        scope: mapToolScope(tool.visibility, tool.favorited),
        enabled: tool.enabled,
        origin: "server",
    };
}

/** 服务端 visibility/favorited → 统一 scope（架构方案 §3.3 语义映射）。 */
function mapToolScope(visibility: string, favorited: boolean): RegistryAsset["scope"] {
    if (favorited) return "favorites";
    // 实测 tools.json 87 条 visibility 全为 "public"；private 是用户自建工具的可见性
    return visibility === "private" ? "custom" : "public";
}

/**
 * 本地 legacy 风格预设 → 统一资产记录（片 2 的离线降级源）。
 *
 * ★ 与片 1 的关键差异：这些记录**不是**服务端下发，origin 固定为 `local-fallback`。
 * 它们作为 API 不可达时的兜底，UI 必须标注降级态。
 */
export function registryAssetFromLegacyStylePreset(preset: CanvasStylePreset): RegistryAsset {
    return {
        assetId: preset.id,
        assetKind: "preset/style",
        slug: preset.id,
        title: preset.title,
        // legacy 用 category（真人实拍/…）对应服务端的 tag
        group: preset.category,
        prompt: preset.prompt,
        description: preset.description || undefined,
        coverUrl: preset.imageUrl || undefined,
        // legacy 的 tags 是题材标签，无对应服务端字段 —— 并入 description 之外的
        // 语义留给检索层；此处不塞进 group（group 语义 = 分类）
        enabled: true,
        origin: "local-fallback",
    };
}

/**
 * 本地光照预设 → 统一资产记录（片 3 的离线降级源）。
 *
 * 与片 2 同构：这些记录不是服务端下发，origin 固定 `local-fallback`。
 */
export function registryAssetFromLegacyLightingPreset(preset: LegacyLightingPreset): RegistryAsset {
    return {
        assetId: preset.id,
        assetKind: "preset/lighting",
        slug: preset.id,
        title: preset.name,
        // 光照预设无分类维度（dialog 是单层网格）—— group 留空串，
        // 不塞入假分类（架构方案 §2.2 原则 1：AssetKind 是形状标签不是用户概念）
        group: "",
        prompt: preset.prompt,
        coverUrl: preset.image || undefined,
        enabled: true,
        origin: "local-fallback",
    };
}

/**
 * 本地机位预设 → 统一资产记录（片 4 的离线降级源）。
 *
 * ★ 提示词取 `profilePrompt`（模型面），不是 `description`（人面）——
 * 架构方案 §3.3 契约：prompt 字段承载模型面文本。
 */
export function registryAssetFromCameraProfile(profile: CameraProfile): RegistryAsset {
    return {
        assetId: profile.id,
        assetKind: "preset/camera",
        slug: profile.id,
        // 用户面标题优先中文名（zhName），回落 label
        title: profile.zhName || profile.label,
        // useCase 是机位的使用场景（剧情长片/奢华广告…）—— 作分组
        group: profile.useCase,
        prompt: profile.profilePrompt,
        description: profile.description || undefined,
        enabled: true,
        origin: "local-fallback",
    };
}

/**
 * 本地镜头预设 → 统一资产记录（片 4 的离线降级源）。
 */
export function registryAssetFromLensProfile(profile: LensProfile): RegistryAsset {
    return {
        assetId: profile.id,
        assetKind: "preset/lens",
        slug: profile.id,
        title: profile.zhName || profile.label,
        group: profile.useCase,
        prompt: profile.profilePrompt,
        description: profile.description || undefined,
        enabled: true,
        origin: "local-fallback",
    };
}

/**
 * 服务端技能场景预设 → 统一资产记录（片 5）。
 *
 * 与片 1 同为**服务端源**（`GET /api/skills/presets`），origin 固定 `server`。
 *
 * ★ 形状差异（架构方案 §2.4「三组字段高度同构」的对照面）：
 * 本源的记录形状与 tools.json 三组**不同构** —— 它是「场景组合」（skillIds 数组 +
 * rationale 依据 + evidence 证据等级 + upgrade 升级路径），不是单条提示词预设。
 * 因此映射时：
 *   - `prompt` 留空（本源无模型面提示词；rationale 是**人面**说明，不得冒充 prompt）
 *   - 语义细节（skillIds / evidence / upgrade）并入 description，不丢信息
 */
export function registryAssetFromSkillPreset(preset: SkillPreset): RegistryAsset {
    // rationale 是人面说明；skillIds/evidence/upgrade 是结构化元数据 ——
    // 全部保留在 description（本源的语义密度高，不丢信息）
    const details = [
        preset.rationale,
        preset.skillIds.length ? `技能组合：${preset.skillIds.length} 项` : "",
        preset.evidence ? `证据等级：${preset.evidence}` : "",
        preset.upgrade ? `升级路径：${preset.upgrade}` : "",
    ].filter(Boolean);

    return {
        assetId: preset.presetId,
        assetKind: "spec/prompt-template",
        slug: preset.presetId,
        title: preset.name,
        // scene 是场景分组（drama/…）—— 对应服务端 tools 的 tag 语义
        group: preset.scene,
        // ★ 本源无模型面提示词 —— 留空而非拿 rationale 冒充（架构方案 §3.3：
        // prompt 字段承载模型面文本；混入人面说明会污染提示词链路）
        prompt: "",
        description: details.join(" · ") || undefined,
        enabled: true,
        origin: "server",
    };
}

/**
 * 本地灵感卡 → 统一资产记录（片 6）。
 *
 * ★ 来源标注：这 22 条含 8 条 CC0 改编文本模板（awesome-chatgpt-prompts rev
 * f78a1c51）—— 架构方案 §3.4 要求外部来源资产**必须带来源字段**。
 * 单条 `source` 字段（Storyteller/Screenwriter/…）是角色名，不是仓库来源；
 * 仓库级来源在 `inspirationSource` 常量，由调用方**显式注入**
 * （同 `loadStyleAssets` 的 localFallback 注入纪律：便于测试注入与调用方控制）。
 *
 * ★ 附来源判据（控制线 2026-10-05 A1 裁定）：单条 `source` 字符串存在 ——
 * 实测恰 8 条，与 CC0 改编清单一致；附结构化 `AssetSource`（§3.4 四字段），
 * 其余 14 条不带。不注入描述符即不附（宁缺勿错标）。
 */
export function registryAssetFromCreationInspiration(
    inspiration: CreationInspiration,
    index: number,
    source?: AssetSource,
): RegistryAsset {
    // 标题含中文与符号，不适宜直接作 slug —— 用索引 + 模式构造稳定标识
    const slug = `creation-${inspiration.mode}-${String(index + 1).padStart(2, "0")}`;

    return {
        assetId: slug,
        assetKind: "spec/generation",
        slug,
        title: inspiration.title,
        // mode（video/image/text）是创作模式 —— 作分组
        group: inspiration.mode,
        // prompt 是模型面提示词（灵感卡的正文）
        prompt: inspiration.prompt,
        description: inspiration.description || undefined,
        coverUrl: inspiration.image || undefined,
        // ★ §3.4：外部来源条目必带来源声明（判据 = 角色名字段存在，恰 8 条 CC0 改编）
        ...(inspiration.source && source ? { source } : {}),
        enabled: true,
        origin: "local-fallback",
    };
}

/**
 * 本地渠道规格 → 统一资产记录（片 9）。
 *
 * ★ 形状差异：本源的 `minPixels` 是结构化对象（宽/高/说明），统一 schema 无对应字段 ——
 * 并入 description（不丢信息），`aspect` 走 aspect 字段。
 */
export function registryAssetFromEcomChannelPreset(preset: EcomChannelPreset): RegistryAsset {
    const details = [
        preset.hint,
        `最小像素：${preset.minPixels.width}×${preset.minPixels.height}（${preset.minPixels.note}）`,
        `目标档：${preset.desiredResolution.toUpperCase()}`,
    ].filter(Boolean);

    return {
        assetId: preset.id,
        assetKind: "preset/channel-spec",
        slug: preset.id,
        title: preset.label,
        // 渠道规格无分类维度（3 条平铺）—— group 留空串，不塞假分类
        group: "",
        // 本源无模型面提示词 —— 留空（同片 5 纪律：不拿人面说明冒充）
        prompt: "",
        description: details.join(" · "),
        aspect: preset.aspect,
        enabled: true,
        origin: "local-fallback",
    };
}

/**
 * 批量适配服务端工具列表（过滤未知类型）。
 */
export function registryAssetsFromToolSummaries(tools: (ToolSummary | ToolItem)[]): RegistryAsset[] {
    const assets: RegistryAsset[] = [];
    for (const tool of tools) {
        const asset = registryAssetFromToolSummary(tool);
        if (asset) assets.push(asset);
    }
    return assets;
}

/** 资产形态断言辅助（供消费侧按需分流）。 */
export function isStyleAsset(asset: RegistryAsset): boolean {
    return asset.assetKind === "preset/style";
}

/** AssetKind 的中文标签（UI 分组展示用；不是用户概念的直接映射，仅调试/管理面）。 */
export const ASSET_KIND_LABELS: Partial<Record<AssetKind, string>> = {
    "capability/tool": "能力工具",
    "capability/workflow": "能力编排",
    "asset/image": "图片素材",
    "asset/video": "视频素材",
    "preset/style": "风格预设",
    "preset/lighting": "光照预设",
    "preset/camera": "机位预设",
    "preset/lens": "镜头预设",
    "preset/motion": "运镜预设",
    "preset/channel-spec": "渠道规格",
    "template/canvas": "画布模板",
    "spec/prompt-template": "提示词模板",
    "spec/generation": "生成规格",
};
