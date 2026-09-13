/**
 * hover 归属状态机(2026-09-13 微供给审计裁决): 单一写入者。
 * 事件层只喂指针坐标(rAF 合帧)与边界时机(节点增删/viewport 变化);
 * 每帧 attributeHover 现算归属, diff 后驱动 reducer:
 *   idle → active(owner) → leaving(owner, 380ms grace) → exiting(owner, 160ms hidden) → idle
 * grace 期归属回到 owner(任意供给面)即取消 leaving; 归属换节点直接换 owner。
 * 输出 hoveredNodeId/exitingNodeId 与旧消费面(derive 函数与双实例渲染)兼容。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { attributeHover, type NodeHit, type SupplyHit } from "@/lib/canvas/hover-attribution";
import type { CanvasNodeData } from "@/types/canvas";

export type HoverAttributionState = {
    /** 机器输出: 当前归属节点(null=无)。消费面: render model、derive 函数、world layers。 */
    hoveredNodeId: string | null;
    /** 380ms grace 到点后进入 160ms hidden 渲染窗的节点(退场动画) */
    exitingNodeId: string | null;
    /** 供 derive* 派生 selfHover/siblingHover */
    hoverSurface: ReturnType<typeof attributeHover>["surface"];
};

type Phase =
    | { kind: "idle" }
    | { kind: "active"; ownerId: string; surface: HoverAttributionState["hoverSurface"] }
    | { kind: "leaving"; ownerId: string; since: number }
    | { kind: "exiting"; ownerId: string; since: number };

type Action =
    | { type: "attribute"; nodeId: string | null; surface: HoverAttributionState["hoverSurface"] }
    | { type: "graceExpired" }
    | { type: "exitDone" }
    | { type: "reset" };

export function reducer(state: Phase, action: Action): Phase {
    switch (action.type) {
        case "attribute": {
            if (action.nodeId) {
                if (state.kind === "active" && state.ownerId === action.nodeId) {
                    return state.surface === action.surface ? state : { kind: "active", ownerId: action.nodeId, surface: action.surface };
                }
                // grace 期回到 owner → 取消 leaving; 换节点 → 直接换 owner
                return { kind: "active", ownerId: action.nodeId, surface: action.surface };
            }
            if (state.kind === "active") return { kind: "leaving", ownerId: state.ownerId, since: Date.now() };
            return state;
        }
        case "graceExpired":
            return state.kind === "leaving" ? { kind: "exiting", ownerId: state.ownerId, since: Date.now() } : state;
        case "exitDone":
            return state.kind === "exiting" ? { kind: "idle" } : state;
        case "reset":
            return { kind: "idle" };
    }
}

export const NODE_TOOLBAR_HOVER_SAFE_CLOSE_MS = 380;
export const EXIT_HIDDEN_MS = 160;

export function useCanvasHoverAttribution(options: {
    visibleNodes: CanvasNodeData[];
    stackRankOf: (nodeId: string) => number;
    /** 已挂载供给实例登记表(ref 由渲染层填充): 结构上排除 inset-0 wrapper */
    getSupplies: () => SupplyHit[];
    enabled: boolean;
}) {
    const { visibleNodes, stackRankOf, getSupplies, enabled } = options;
    const [phase, dispatch] = useReducer(reducer, { kind: "idle" } as Phase);
    const pointerRef = useRef<{ x: number; y: number } | null>(null);
    const rafRef = useRef<number | null>(null);
    const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const phaseRef = useRef(phase);
    phaseRef.current = phase;
    // 可变引用避免每帧重跑 effect(visibleNodes 数组每次渲染都是新引用)
    const depsRef = useRef({ visibleNodes, stackRankOf, getSupplies, enabled });
    depsRef.current = { visibleNodes, stackRankOf, getSupplies, enabled };

    const clearTimers = useCallback(() => {
        if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
    }, []);

    const sample = useCallback(() => {
        rafRef.current = null;
        const { visibleNodes: nodes, stackRankOf: rank, getSupplies: supplies, enabled: on } = depsRef.current;
        const pointer = pointerRef.current;
        if (!on || !pointer) return;
        const nodeHits: NodeHit[] = [];
        for (const node of nodes) {
            const el = document.querySelector('[data-node-id="' + window.CSS.escape(node.id) + '"]');
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            nodeHits.push({ id: node.id, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, stackRank: rank(node.id) });
        }
        const attribution = attributeHover(nodeHits, supplies(), pointer.x, pointer.y);
        const current = phaseRef.current;
        if (attribution.nodeId) {
            // 同 owner 但 phase 不在 active(leaving grace 期回 owner / exiting 退场期回 owner):
            // 必须显式 dispatch 让 reducer 把相推回 active — 否则 leaving 卡死到 grace 到点,
            // 面板在指针已经回到供给的情况下仍被退场卸载(2026-09-13 用户复验的"升级失败"真根因)。
            if (current.kind !== "active" || current.ownerId !== attribution.nodeId || current.surface !== attribution.surface) {
                clearTimers();
                dispatch({ type: "attribute", nodeId: attribution.nodeId, surface: attribution.surface });
            }
            return;
        }
        // timer 冻结/后台节流兜底: 指针回归时若 leaving/exiting 已超期, 直接按应到的 phase 结算
        if (current.kind === "leaving" && Date.now() - current.since >= NODE_TOOLBAR_HOVER_SAFE_CLOSE_MS + EXIT_HIDDEN_MS) {
            dispatch({ type: "graceExpired" });
            dispatch({ type: "exitDone" });
            return;
        }
        if (current.kind === "exiting" && Date.now() - current.since >= EXIT_HIDDEN_MS) {
            dispatch({ type: "exitDone" });
            return;
        }
        // 归属为空: active → leaving(启动 grace)
        if (current.kind === "active") {
            dispatch({ type: "attribute", nodeId: null, surface: "outside" });
            if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
            graceTimerRef.current = setTimeout(() => {
                graceTimerRef.current = null;
                dispatch({ type: "graceExpired" });
                if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
                exitTimerRef.current = setTimeout(() => dispatch({ type: "exitDone" }), EXIT_HIDDEN_MS);
            }, NODE_TOOLBAR_HOVER_SAFE_CLOSE_MS);
        }
    }, [clearTimers]);

    useEffect(() => {
        // rAF 合帧为主; rAF 停发时(标签不可见: 后台/遮挡/最小化, Chrome 对 hidden 直接停发,
        // debugger 附着无关)退化为 16ms 时间戳节流的同步采样,
        // 保证归属链路在任何环境下都有前进(否则 hover 生命周期在采样停摆时永久冻结)。
        let lastSync = 0;
        const runSample = () => {
            const now = performance.now();
            if (now - lastSync < 16) return;
            lastSync = now;
            sample();
        };
        const onMove = (event: MouseEvent) => {
            pointerRef.current = { x: event.clientX, y: event.clientY };
            if (rafRef.current === null) {
                let fired = false;
                rafRef.current = requestAnimationFrame(() => {
                    fired = true;
                    rafRef.current = null;
                    lastSync = performance.now();
                    sample();
                });
                // rAF 停发兜底(hidden 标签): 33ms 内 rAF 未触发则取消并直接同步采样,
                // 否则归属链在采样停摆期间整体冻结(hover 不进不退)
                setTimeout(() => {
                    if (!fired && rafRef.current !== null) {
                        cancelAnimationFrame(rafRef.current);
                        rafRef.current = null;
                        lastSync = performance.now();
                        sample();
                    }
                }, 33);
            }
            if (rafRef.current === null) runSample();
        };
        const onLeaveWindow = () => {
            // 指针离开浏览器窗口: 等价归属为空(甩出窗口的兜底)
            pointerRef.current = null;
            if (rafRef.current === null) rafRef.current = requestAnimationFrame(sample);
        };
        window.addEventListener("mousemove", onMove, { passive: true });
        document.documentElement.addEventListener("mouseleave", onLeaveWindow);
        return () => {
            window.removeEventListener("mousemove", onMove);
            document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            clearTimers();
        };
    }, [sample, clearTimers]);

    // 边界时机: 节点集变化时若 owner 已被删除, 立即结算(grace 到点走 exiting)
    useEffect(() => {
        const current = phaseRef.current;
        if (current.kind !== "idle" && !visibleNodes.some((node) => node.id === current.ownerId)) {
            dispatch({ type: "reset" });
        }
    }, [visibleNodes]);

    const state: HoverAttributionState = useMemo(() => {
        switch (phase.kind) {
            case "idle":
                return { hoveredNodeId: null, exitingNodeId: null, hoverSurface: "outside" };
            case "active":
                return { hoveredNodeId: phase.ownerId, exitingNodeId: null, hoverSurface: phase.surface };
            case "leaving":
                return { hoveredNodeId: phase.ownerId, exitingNodeId: null, hoverSurface: "outside" };
            case "exiting":
                return { hoveredNodeId: null, exitingNodeId: phase.ownerId, hoverSurface: "outside" };
        }
    }, [phase]);

    // 边界重置: mirror(hoveredNodeId 等)被渲染层在反选/交互开始等时机直打 null 时,
    // 状态机必须同步复位——否则状态机停留 active 且归属采样不再变化, 单向 mirror
    // effect 永不重跑, hover 在指针原地(未离节点)时卡死无法重建。
    const resetBoundary = useCallback(() => {
        clearTimers();
        pointerRef.current = null;
        dispatch({ type: "reset" });
    }, [clearTimers]);

    return { state, resetBoundary };
}
