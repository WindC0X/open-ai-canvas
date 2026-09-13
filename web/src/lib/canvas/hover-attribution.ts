/**
 * hover 归属单一权威(2026-09-13 微供给审计裁决):
 * 指针坐标 + 节点矩形(带 z 序) + 供给矩形(kind) → 归属节点与命中面。
 * 事件层只喂坐标与边界时机, 不直接写 hover 语义状态;
 * 归属函数每帧现算, 遮挡归属由 stackRank 比较免费获得(症状1: 指针在上层节点
 * 本体 → 归上层节点), 供给(浮层 z 恒高于节点层)优先于节点本体(规则①)。
 */

export type HoverSurface = "node" | "toolbar" | "composer" | "bridge" | "sense-band" | "outside";

export type HoverAttribution = {
    nodeId: string | null;
    surface: HoverSurface;
};

export type NodeHit = {
    id: string;
    rect: { left: number; top: number; right: number; bottom: number };
    /** 渲染栈序(越大越靠上)。重叠时归属最上层命中节点。 */
    stackRank: number;
};

export type SupplyKind = "toolbar" | "composer" | "bridge" | "sense-band";

export type SupplyHit = {
    nodeId: string;
    kind: SupplyKind;
    rect: { left: number; top: number; right: number; bottom: number };
    /** 供给当前存在感级别(2026-09-13 修订原 M2):
     *  - hidden: 不参与归属;
     *  - micro: 参与归属但 pe:none(点击穿透) — 微态面板是可见面(0.45), 排除会让指针越过
     *    20px 感应带直落主体时归属空、面板退场(升级大面积失败);
     *  - full: 参与归属且可交互。 */
    level: "hidden" | "micro" | "full";
    /** 所属节点绘制序: 不同节点的同 kind 供给矩形重叠时, 归属视觉上层节点(与节点本体遮挡规则一致)。 */
    stackRank: number;
};

type Rect = NodeHit["rect"];

function rectContains(rect: Rect, x: number, y: number): boolean {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function attributeHover(nodes: NodeHit[], supplies: SupplyHit[], x: number, y: number): HoverAttribution {
    // 规则①: 供给优先(浮层层 z-node-toolbar/panel 恒高于节点层, 与 DOM 命中一致)。
    // micro composer 面板本体进候选(2026-09-13 用户复验): 面板微态是可见面(0.45 半透明),
    // 不是"inset-0 隐形 wrapper"那种视觉空白域 — 排除它会导致指针越过 20px 感应带直落
    // 主体时归属空、面板退场, 升级只能靠慢速滑动碰窄带(大部分触发失败)。主体仍 pe:none
    // (点击穿透), 但 mousemove 采样按矩形归属 → 指针到达主体即升级 full, 几何域与
    // full 态点击域一致。多供给重叠时按 kind 优先级。
    const kindPriority: Record<SupplyKind, number> = { toolbar: 3, "sense-band": 2, bridge: 1, composer: 0 };
    let best: { nodeId: string; surface: HoverSurface; priority: number; stackRank: number } | null = null;
    for (const supply of supplies) {
        if (supply.level === "hidden") continue;
        if (!rectContains(supply.rect, x, y)) continue;
        const priority = kindPriority[supply.kind];
        // 同 kind 的不同节点供给重叠时(DOM 序与视觉序无关), 归属绘制序更高的节点
        if (!best || priority > best.priority || (priority === best.priority && supply.stackRank > best.stackRank)) {
            best = { nodeId: supply.nodeId, surface: supply.kind, priority, stackRank: supply.stackRank };
        }
    }
    if (best) return { nodeId: best.nodeId, surface: best.surface };

    // 节点间按 stackRank 取最上层命中(遮挡免费获得)
    let top: NodeHit | null = null;
    for (const node of nodes) {
        if (!rectContains(node.rect, x, y)) continue;
        if (!top || node.stackRank > top.stackRank) top = node;
    }
    if (top) return { nodeId: top.id, surface: "node" };
    return { nodeId: null, surface: "outside" };
}
