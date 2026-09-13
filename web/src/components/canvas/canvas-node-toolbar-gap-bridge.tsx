export type CanvasNodeToolbarGapBridgeProps = {
    nodeId: string;
    gapPx: number;
    /** 桥相对锚点的延伸方向: 工具栏在节点上方(桥向下补间隙), 面板在节点下方(桥向上补间隙) */
    direction?: "down" | "up";
};

export const CANVAS_NODE_TOOLBAR_GAP_BUFFER_PX = 2;

/**
 * 节点与微供给(工具栏/composer)之间的物理间隙桥(og-canvas 同构方案):
 * pointer-events-auto 的真实 DOM 覆盖间隙, 指针穿过间隙时 hover 的是桥(pe:auto 防穿透误触画布)。
 * hover 归属由 useCanvasHoverAttribution 状态机按桥矩形判定(bridge 是供给 kind 之一),
 * 桥不再承担事件回调(2026-09-13 审计第 4 步: 事件链退役, 归属纯几何)。
 */
export function CanvasNodeToolbarGapBridge({ nodeId, gapPx, direction = "down" }: CanvasNodeToolbarGapBridgeProps) {
    if (gapPx <= 0) return null;

    return (
        <div
            data-node-toolbar-gap-bridge="true"
            data-node-toolbar-gap-role="node-gap"
            data-node-toolbar-gap-source={nodeId}
            data-node-toolbar-gap-px={String(gapPx)}
            aria-hidden="true"
            className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 ${direction === "down" ? "top-full" : "bottom-full"}`}
            style={{
                height: gapPx + CANVAS_NODE_TOOLBAR_GAP_BUFFER_PX,
                // 宽度收窄(审计 M4/裁决): 桥不越出节点宽度 — 满宽桥会盖住相邻节点本体,
                // 指针在邻居可视区被判为源节点供给(层级抢夺残留路径 #2)。
                width: "min(100%, var(--bridge-node-width, 100%))",
            }}
        />
    );
}
