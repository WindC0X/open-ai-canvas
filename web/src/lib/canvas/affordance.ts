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
    /** 同节点的另一供给被悬停: 指针在节点与本供给之间的间隙时保持 micro, 避免闪隐(旧 220ms timer 的语义等价物) */
    siblingHover?: boolean;
    /** 本节点的参数设置气泡(份数/图像/视频/音频)处于打开态: composer 恒 full,
        与工具栏 toolbarMenuOpenId 钉 full 对称(否则指针回节点时底栏在气泡脚下变暗)。 */
    settingsBubbleOpen?: boolean;
};

export type ToolbarGuardInput = {
    nodeDragging: boolean;
    selectionBoxActive: boolean;
    /** 参数面板(320px, 从 composer 底栏弹出)与节点上方工具栏无几何重叠, 不再让位 */
    settingsOpen?: boolean;
};

export type ComposerGuardInput = {
    nodeDragging: boolean;
    selectionBoxActive: boolean;
};

function deriveLevel(
    { nodeId, hoveredNodeId, dialogNodeId, selfHover, siblingHover, settingsBubbleOpen }: AffordanceInput,
    guarded: boolean,
): AffordanceLevel {
    if (guarded) return "hidden";
    if (dialogNodeId === nodeId) return "full";
    if (selfHover || settingsBubbleOpen) return "full";
    if (hoveredNodeId === nodeId || siblingHover) return "micro";
    return "hidden";
}

/** 工具栏存在感:拖拽/框选/设置气泡开启时强制隐藏。 */
export function deriveToolbarAffordance(input: AffordanceInput, guards: ToolbarGuardInput): AffordanceLevel {
    return deriveLevel(input, guards.nodeDragging || guards.selectionBoxActive || Boolean(guards.settingsOpen));
}

/** composer 存在感:拖拽不抑制(拖拽替换引用 96e0051a 需要 composer 可接受投放),设置气泡是其自身一部分不抑制。 */
export function deriveComposerAffordance(input: AffordanceInput, guards: ComposerGuardInput): AffordanceLevel {
    return deriveLevel(input, guards.selectionBoxActive);
}
