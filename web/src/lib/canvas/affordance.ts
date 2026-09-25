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
    /** 本节点已在单选集合中(mousedown 即真, 不等 mouseup 的 dialog 打开): 供给立即 full。
        否则按下瞬间节点本体描边已 selected 而供给仍 micro, 被感知为供给"慢半拍"
        (2026-09-14 用户复验)。拖拽由 guard 接管 hidden, 语义不冲突。 */
    selected?: boolean;
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
    { nodeId, hoveredNodeId, dialogNodeId, selfHover, siblingHover, settingsBubbleOpen, selected }: AffordanceInput,
    guarded: boolean,
): AffordanceLevel {
    if (guarded) return "hidden";
    if (dialogNodeId === nodeId) return "full";
    if (selected || selfHover || settingsBubbleOpen) return "full";
    if (hoveredNodeId === nodeId || siblingHover) return "micro";
    return "hidden";
}

/** 工具栏存在感:拖拽/框选/设置气泡开启时强制隐藏。 */
export function deriveToolbarAffordance(input: AffordanceInput, guards: ToolbarGuardInput): AffordanceLevel {
    return deriveLevel(input, guards.nodeDragging || guards.selectionBoxActive || Boolean(guards.settingsOpen));
}

/** composer 存在感: 节点拖拽/框选时隐藏。
 * [2026-09-26 用户拍板「拖动时工具栏/composer 的关闭与展开必须对齐」] 此前拖拽靠
 * selectedPanelNode 直接卸载(无退场)；现与工具栏同走 hidden 级别——同一套 160ms 朝节点收拢
 * 退场 + 180ms 回位显场（见 globals.css .canvas-node-panel-affordance 规则）。
 * 设置气泡是其自身一部分不抑制。挂件化后仅 selected 槽位挂载(selected→full)。 */
export function deriveComposerAffordance(input: AffordanceInput, guards: ComposerGuardInput): AffordanceLevel {
    return deriveLevel(input, guards.nodeDragging || guards.selectionBoxActive);
}
