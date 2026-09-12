export type CanvasNodeToolbarGapBridgeProps = {
    nodeId: string;
    gapPx: number;
    /** 桥相对锚点的延伸方向: 工具栏在节点上方(桥向下补间隙), 面板在节点下方(桥向上补间隙) */
    direction?: "down" | "up";
    onEnter: (nodeId: string) => void;
};

export const CANVAS_NODE_TOOLBAR_GAP_BUFFER_PX = 2;

/**
 * 节点与微供给(工具栏/composer)之间的物理间隙桥(og-canvas 同构方案):
 * 一个 pointer-events-auto 的真实 DOM 覆盖间隙, 指针穿过间隙时 hover 的是桥,
 * onEnter 把 hover 归还源节点 —— 间隙期 hover 不丢(时间宽限的结构化对偶),
 * 且桥处于供给顶层, 重叠节点的底层节点收不到 enter, 不会发生 hover 切换。
 */
export function CanvasNodeToolbarGapBridge({ nodeId, gapPx, direction = "down", onEnter }: CanvasNodeToolbarGapBridgeProps) {
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
                width: "100%",
            }}
            onMouseEnter={(event) => {
                event.stopPropagation();
                onEnter(nodeId);
            }}
        />
    );
}
