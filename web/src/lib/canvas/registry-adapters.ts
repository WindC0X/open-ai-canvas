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
import { assetKindFromToolType, type AssetKind, type RegistryAsset } from "./registry-asset";
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
