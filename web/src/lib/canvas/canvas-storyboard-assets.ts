import { CanvasNodeType, type CanvasNodeData, type StoryboardAssetBinding, type StoryboardAssetRole, type StoryboardRow } from "@/types/canvas";

export type StoryboardAssetCatalogItem = {
    id: string;
    title: string;
    type: "image" | "video" | "audio" | "character";
    category?: string;
    tags: string[];
    prompt: string;
    characterAssetId?: string;
    characterVersionId?: string;
};

const OUTPUT_WORKFLOW_KINDS = new Set(["shot", "action_board", "final"]);
const STORYBOARD_ASSET_ROLES = new Set<StoryboardAssetRole>(["character", "environment", "wardrobe", "prop", "weapon", "style", "motion", "audio"]);

export function buildStoryboardAssetCatalog(nodes: CanvasNodeData[]): StoryboardAssetCatalogItem[] {
    return nodes.flatMap((node): StoryboardAssetCatalogItem[] => {
        const type = storyboardAssetType(node);
        if (!type || OUTPUT_WORKFLOW_KINDS.has(node.metadata?.workflowKind || "")) return [];
        if (!node.metadata?.content && !node.metadata?.storageKey && !node.metadata?.assetId && type !== "character") return [];
        const prompt = compactStoryboardAssetText(node.metadata?.prompt || node.metadata?.workflowDescription || node.metadata?.characterPrompt || "");
        return [{
            id: node.id,
            title: compactStoryboardAssetText(node.title, 120) || "未命名资产",
            type,
            category: node.metadata?.assetCategory,
            tags: Array.from(new Set((node.metadata?.assetTags || []).map((tag) => compactStoryboardAssetText(tag, 64)).filter(Boolean))).slice(0, 12),
            prompt,
            characterAssetId: node.metadata?.characterAssetId,
            characterVersionId: node.metadata?.characterVersionId,
        }];
    }).slice(0, 60);
}

export function storyboardAssetRoleForNode(node: CanvasNodeData): StoryboardAssetRole | null {
    if (node.metadata?.workflowKind === "character" || node.metadata?.assetCategory === "character") return "character";
    if (node.type === CanvasNodeType.Audio) return "audio";
    if (node.type === CanvasNodeType.Video) return "motion";
    const category = node.metadata?.assetCategory;
    if (category === "environment" || category === "prop") return category;
    if (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Drawing) return "style";
    return null;
}

export function normalizeStoryboardAssetBindings(bindings: StoryboardAssetBinding[] | undefined, nodes?: CanvasNodeData[]) {
    const nodeIds = nodes ? new Set(nodes.map((node) => node.id)) : null;
    const seen = new Set<string>();
    return (bindings || []).flatMap((binding): StoryboardAssetBinding[] => {
        const nodeId = String(binding?.nodeId || "").trim();
        if (!nodeId || seen.has(nodeId) || !STORYBOARD_ASSET_ROLES.has(binding.role) || (nodeIds && !nodeIds.has(nodeId))) return [];
        seen.add(nodeId);
        return [{ nodeId, role: binding.role, priority: Math.max(0, Math.min(100, Math.round(Number(binding.priority) || 0))) }];
    }).sort((left, right) => right.priority - left.priority);
}

export function storyboardAssetBindingPriority(role: StoryboardAssetRole) {
    if (role === "character") return 100;
    if (role === "environment") return 90;
    if (role === "prop" || role === "weapon" || role === "wardrobe") return 80;
    if (role === "motion" || role === "audio") return 70;
    return 60;
}

/** 每行资产绑定上限(flora 语料无上限证据, 参照 batch-table MAX_BATCH_REFERENCE_COLUMNS=6 的先例自行设计)。 */
export const MAX_ROW_ASSET_BINDINGS = 8;

/**
 * 分镜行资产绑定的纯函数 patch(2026-09-18 族3 S1): chip 增删的唯一数据入口。
 * - add: 按 storyboardAssetRoleForNode 推断 role, 去重(同 nodeId 幂等);
 *   character 类同步 row.characters[](characterName/characterAssetId/characterImageNodeId),
 *   供 getConnectedStoryboardRows 的文本注入与 storyboardRowReferenceNodeIds 的参考图集消费。
 * - remove: 反向剔除 binding 与对应 characters 项; 未命中时返回 null(调用方跳过 setNodes)。
 * 纯函数不落盘, 持久化由 onUpdateRow -> updateScriptRow -> setNodes 链承担。
 */
export function storyboardRowAssetBindingPatch(
    row: StoryboardRow,
    nodeId: string,
    mode: "add" | "remove",
    nodeById: Map<string, CanvasNodeData>,
): Partial<Pick<StoryboardRow, "assetBindings" | "characters">> | null {
    const bindings = row.assetBindings || [];
    if (mode === "add") {
        if (bindings.some((binding) => binding.nodeId === nodeId)) return null;
        if (bindings.length >= MAX_ROW_ASSET_BINDINGS) return null;
        const source = nodeById.get(nodeId);
        if (!source) return null;
        const role = storyboardAssetRoleForNode(source) || "prop";
        const nextBindings = [...bindings, { nodeId, role, priority: storyboardAssetBindingPriority(role) }];
        let characters = row.characters || [];
        if (role === "character") {
            const characterAssetId = source.metadata?.characterAssetId?.trim() || undefined;
            const alreadyLinked = characters.some(
                (item) => item.characterImageNodeId === nodeId || (characterAssetId && item.characterAssetId === characterAssetId),
            );
            if (!alreadyLinked) {
                characters = [...characters, {
                    characterName: source.metadata?.characterName?.trim() || source.title || "角色",
                    characterAssetId,
                    characterDescription: source.metadata?.characterPrompt?.trim() || undefined,
                    characterImageNodeId: nodeId,
                }];
            }
        }
        return { assetBindings: nextBindings, characters };
    }
    const nextBindings = bindings.filter((binding) => binding.nodeId !== nodeId);
    if (nextBindings.length === bindings.length) return null;
    const removed = nodeById.get(nodeId);
    const removedAssetId = removed?.metadata?.characterAssetId?.trim();
    const characters = (row.characters || []).filter(
        (item) => item.characterImageNodeId !== nodeId && (!removedAssetId || item.characterAssetId !== removedAssetId),
    );
    return { assetBindings: nextBindings, characters };
}

function storyboardAssetType(node: CanvasNodeData): StoryboardAssetCatalogItem["type"] | null {
    if (node.metadata?.workflowKind === "character" && node.metadata.characterAssetId && node.metadata.characterVersionId) return "character";
    if (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Drawing) return "image";
    if (node.type === CanvasNodeType.Video) return "video";
    if (node.type === CanvasNodeType.Audio) return "audio";
    return null;
}

function compactStoryboardAssetText(value: string, limit = 600) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}
