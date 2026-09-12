/**
 * 节点微供给(工具栏/composer)存在感状态机(2026-09-12 用户拍板契约):
 *
 * | 状态               | 工具栏  | composer |
 * |--------------------|---------|----------|
 * | idle               | hidden  | hidden   |
 * | hover 节点         | micro   | micro    |
 * | hover 到某供给     | 该供给 full,另一个保持 micro |
 * | selected           | full    | full     |
 *
 * 纯推导,无副作用;guard(拖拽/框选)优先级最高,选中次之。
 * 微→全显的过渡由 AffordanceSurface 原语实现(只动 opacity/filter)。
 */

export type AffordanceLevel = "hidden" | "micro" | "full";

export type AffordanceInput = {
    nodeId: string;
    /** 画布层当前悬停节点(project 层 use-canvas-selection-controller 维护) */
    hoveredNodeId: string | null;
    /** 打开 composer 的节点(null=无) */
    dialogNodeId: string | null;
    /** 本供给自身被悬停(hover 到它本身就是升级 full 的入山路径) */
    selfHover: boolean;
};

export type ToolbarGuardInput = {
    nodeDragging: boolean;
    selectionBoxActive: boolean;
    /** 图像设置气泡开启时工具栏必须让位(避免重叠) */
    settingsOpen: boolean;
};

export type ComposerGuardInput = {
    nodeDragging: boolean;
    selectionBoxActive: boolean;
};

function deriveLevel(
    { nodeId, hoveredNodeId, dialogNodeId, selfHover }: AffordanceInput,
    guarded: boolean,
): AffordanceLevel {
    if (guarded) return "hidden";
    if (dialogNodeId === nodeId) return "full";
    if (hoveredNodeId !== nodeId) return "hidden";
    if (selfHover) return "full";
    return "micro";
}

/** 工具栏存在感:拖拽/框选/设置气泡开启时强制隐藏。 */
export function deriveToolbarAffordance(input: AffordanceInput, guards: ToolbarGuardInput): AffordanceLevel {
    return deriveLevel(input, guards.nodeDragging || guards.selectionBoxActive || guards.settingsOpen);
}

/** composer 存在感:拖拽不抑制(拖拽替换引用 96e0051a 需要 composer 可接受投放),设置气泡是其自身一部分不抑制。 */
export function deriveComposerAffordance(input: AffordanceInput, guards: ComposerGuardInput): AffordanceLevel {
    return deriveLevel(input, guards.selectionBoxActive);
}
