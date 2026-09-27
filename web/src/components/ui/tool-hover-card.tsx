import { useCallback, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

import type { ToolHoverCardData } from "@/lib/canvas/tool-hover-card-data";

import { NodePreviewMockup } from "./tool-hover-card-mockups";
import "./tool-hover-card.css";

/** hover 后到出卡的延迟（ms）——对齐既有浮层手感，避免掠过时闪烁 */
export const TOOL_HOVER_CARD_SHOW_DELAY = 200;
/** 离开触发器/卡片后的宽限（ms）——供指针移入卡片，不闪断 */
export const TOOL_HOVER_CARD_LEAVE_GRACE = 140;
/** 卡片与触发器的间距（px），同时保证卡片不遮挡触发器 */
const CARD_TRIGGER_GAP = 8;
/** 卡片与视口边缘的最小留白（px） */
const CARD_EDGE_MARGIN = 8;

/* ---------------------------------------------------------------------------
 * 交互状态机：独立纯函数，供自动化断言 a11y 关键路径（键盘聚焦触发 / 指针移入卡片 / Esc 关闭）
 * ------------------------------------------------------------------------- */

export type ToolHoverCardState = {
    hovered: boolean;
    focused: boolean;
    cardHovered: boolean;
    dismissed: boolean;
};

export type ToolHoverCardEvent = "trigger-enter" | "trigger-leave" | "trigger-focus" | "trigger-blur" | "card-enter" | "card-leave" | "escape";

export const initialToolHoverCardState: ToolHoverCardState = { hovered: false, focused: false, cardHovered: false, dismissed: false };

export function reduceToolHoverCardState(state: ToolHoverCardState, event: ToolHoverCardEvent): ToolHoverCardState {
    switch (event) {
        case "trigger-enter":
            return { ...state, hovered: true, dismissed: false };
        case "trigger-leave":
            return { ...state, hovered: false };
        case "trigger-focus":
            return { ...state, focused: true, dismissed: false };
        case "trigger-blur":
            return { ...state, focused: false };
        case "card-enter":
            return { ...state, cardHovered: true };
        case "card-leave":
            return { ...state, cardHovered: false };
        case "escape":
            // Esc 关闭后不因指针仍悬停而重开，直到下一次 enter/focus 重新武装。
            return { ...state, dismissed: true };
    }
}

export function isToolHoverCardOpen(state: ToolHoverCardState) {
    return !state.dismissed && (state.hovered || state.focused || state.cardHovered);
}

/* ---------------------------------------------------------------------------
 * 定位：上方优先、不足翻下；翻下仍出界则整体上移夹进视口；水平居中并夹紧。
 * 高卡（400px+）必须纵向 clamp——矮卡时代的"翻下即结束"会在视口底部截断。
 * ------------------------------------------------------------------------- */

export type ToolHoverCardPosition = { top: number; left: number; placement: "above" | "below" };

export function computeToolHoverCardPosition(
    anchor: { top: number; bottom: number; left: number; width: number },
    card: { width: number; height: number },
    viewport: { width: number; height: number },
): ToolHoverCardPosition {
    // 视图装不下整卡时按 max-height 折算（CSS 同款兜底：max-height: calc(100vh - 16px)）
    const maxHeight = Math.max(viewport.height - CARD_EDGE_MARGIN * 2, 0);
    const cardHeight = Math.min(card.height, maxHeight);
    const cardWidth = Math.min(card.width, Math.max(viewport.width - CARD_EDGE_MARGIN * 2, 0));

    const maxLeft = Math.max(CARD_EDGE_MARGIN, viewport.width - CARD_EDGE_MARGIN - cardWidth);
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - cardWidth / 2, CARD_EDGE_MARGIN), maxLeft);

    const aboveTop = anchor.top - CARD_TRIGGER_GAP - cardHeight;
    if (aboveTop >= CARD_EDGE_MARGIN) {
        return { top: aboveTop, left, placement: "above" };
    }
    const belowTop = anchor.bottom + CARD_TRIGGER_GAP;
    if (belowTop + cardHeight <= viewport.height - CARD_EDGE_MARGIN) {
        return { top: belowTop, left, placement: "below" };
    }
    // 翻下仍出界：整体上移夹进视口（贴底对齐视口下缘留白）。
    const clampedTop = Math.min(Math.max(belowTop, CARD_EDGE_MARGIN), Math.max(viewport.height - CARD_EDGE_MARGIN - cardHeight, CARD_EDGE_MARGIN));
    return { top: clampedTop, left, placement: "below" };
}

/* ---------------------------------------------------------------------------
 * 卡片内容（flora 四层结构，纯展示、SSR 可测）：
 * L1 头部（图标块 + 标题 + tagline） / L2 长句 / L3 预览（工具类大图标 · 节点类 mockup） / L4 footer 引导行
 * ------------------------------------------------------------------------- */

export type ToolHoverCardContentProps = {
    data: ToolHoverCardData;
    label: string;
    icon?: ReactNode;
    ref?: Ref<HTMLDivElement>;
} & HTMLAttributes<HTMLDivElement>;

export function ToolHoverCardContent({ data, label, icon, ref, className, ...rest }: ToolHoverCardContentProps) {
    const primaryCombo = data.shortcutKeys?.[0];

    return (
        <div ref={ref} role="tooltip" data-preview-mode={data.preview.mode} className={`tool-hover-card ${className ?? ""}`} {...rest}>
            {/* L1 头部：32×32 图标块 + 标题/tagline 双行 */}
            <div className="tool-hover-card-header">
                {icon ? (
                    <span className="tool-hover-card-icon" aria-hidden="true">
                        {icon}
                    </span>
                ) : null}
                <span className="tool-hover-card-headings">
                    <span className="tool-hover-card-title">{label}</span>
                    <span className="tool-hover-card-tagline">{data.tagline}</span>
                </span>
            </div>

            {/* L2 正文长句 */}
            <p className="tool-hover-card-description">{data.description}</p>

            {/* L3 预览：工具类 = 48px 大图标；节点类 = 标题 + 矢量 mockup */}
            {data.preview.mode === "node" ? (
                <div className="tool-hover-card-preview-section">
                    <span className="tool-hover-card-preview-label">节点预览</span>
                    <div className="tool-hover-card-preview">
                        <NodePreviewMockup kind={data.preview.kind} />
                    </div>
                </div>
            ) : (
                <div className="tool-hover-card-preview">
                    <span className="tool-hover-card-preview-icon" aria-hidden="true">
                        {icon}
                    </span>
                </div>
            )}

            {/* L4 footer 引导行：有键位才渲染；句式「按 <kbd>…</kbd> {tagline}」 */}
            {primaryCombo ? (
                <div className="tool-hover-card-footer">
                    <HelpCircle className="tool-hover-card-footer-help" aria-hidden="true" />
                    <span>按</span>
                    <span className="tool-hover-card-footer-keys">
                        {primaryCombo.map((key, keyIndex) => (
                            <span key={`${key}-${keyIndex}`} className="tool-hover-card-footer-key">
                                {keyIndex ? <span className="tool-hover-card-footer-sep">+</span> : null}
                                <kbd className="tool-hover-card-kbd">{key}</kbd>
                            </span>
                        ))}
                    </span>
                    <span>{data.tagline}</span>
                </div>
            ) : null}
        </div>
    );
}

/* ---------------------------------------------------------------------------
 * 卡片容器：portal 到 body、跟随触发器定位、Esc 关闭、指针可移入
 * ------------------------------------------------------------------------- */

type ToolHoverCardProps = {
    open: boolean;
    anchorEl: HTMLElement | null;
    data: ToolHoverCardData;
    label: string;
    icon?: ReactNode;
    onCardEnter: () => void;
    onCardLeave: () => void;
    onEscape: () => void;
};

export function ToolHoverCard({ open, anchorEl, data, label, icon, onCardEnter, onCardLeave, onEscape }: ToolHoverCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<ToolHoverCardPosition | null>(null);
    const [entered, setEntered] = useState(false);

    // 每次开卡重新进入"进场中"态：will-change 仅覆盖动画窗口，进场后清除。
    useEffect(() => {
        if (open) setEntered(false);
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !anchorEl) return;
        const update = () => {
            const cardEl = cardRef.current;
            if (!cardEl) return;
            const anchorRect = anchorEl.getBoundingClientRect();
            // offsetWidth/Height 不吃 transform（进场 scale 中途量尺寸会把宽高缩成 0.96x）
            setPosition(
                computeToolHoverCardPosition(
                    { top: anchorRect.top, bottom: anchorRect.bottom, left: anchorRect.left, width: anchorRect.width },
                    { width: cardEl.offsetWidth, height: cardEl.offsetHeight },
                    { width: window.innerWidth, height: window.innerHeight },
                ),
            );
        };
        update();
        // mockup/文案换行会改变卡片高度，跟随重排。
        const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
        if (observer && cardRef.current) observer.observe(cardRef.current);
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open, anchorEl, data]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            onEscape();
        };
        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [open, onEscape]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <ToolHoverCardContent
            ref={cardRef}
            data={data}
            label={label}
            icon={icon}
            style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
            data-placement={position?.placement ?? "above"}
            data-entering={entered ? "false" : "true"}
            onAnimationEnd={() => setEntered(true)}
            onPointerEnter={onCardEnter}
            onPointerLeave={onCardLeave}
        />,
        document.body,
    );
}

/* ---------------------------------------------------------------------------
 * 消费 hook：触发器事件 → 状态机（含出卡延迟与移入宽限），产出卡片节点
 * ------------------------------------------------------------------------- */

export function useToolHoverCard({ data, label, icon }: { data?: ToolHoverCardData; label: string; icon?: ReactNode }) {
    const [state, setState] = useState(initialToolHoverCardState);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cardLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback((ref: { current: ReturnType<typeof setTimeout> | null }) => {
        if (ref.current) {
            clearTimeout(ref.current);
            ref.current = null;
        }
    }, []);

    const onEnter = useCallback(() => {
        clearTimer(leaveTimerRef);
        clearTimer(cardLeaveTimerRef);
        if (showTimerRef.current) return;
        showTimerRef.current = setTimeout(() => {
            showTimerRef.current = null;
            setState((current) => reduceToolHoverCardState(current, "trigger-enter"));
        }, TOOL_HOVER_CARD_SHOW_DELAY);
    }, [clearTimer]);

    const onLeave = useCallback(() => {
        clearTimer(showTimerRef);
        clearTimer(leaveTimerRef);
        leaveTimerRef.current = setTimeout(() => {
            leaveTimerRef.current = null;
            setState((current) => reduceToolHoverCardState(current, "trigger-leave"));
        }, TOOL_HOVER_CARD_LEAVE_GRACE);
    }, [clearTimer]);

    const onFocus = useCallback(() => {
        clearTimer(showTimerRef);
        clearTimer(leaveTimerRef);
        clearTimer(cardLeaveTimerRef);
        setState((current) => reduceToolHoverCardState(current, "trigger-focus"));
    }, [clearTimer]);

    const onBlur = useCallback(() => {
        setState((current) => reduceToolHoverCardState(current, "trigger-blur"));
    }, []);

    const onCardEnter = useCallback(() => {
        clearTimer(leaveTimerRef);
        clearTimer(cardLeaveTimerRef);
        setState((current) => reduceToolHoverCardState(current, "card-enter"));
    }, [clearTimer]);

    const onCardLeave = useCallback(() => {
        clearTimer(cardLeaveTimerRef);
        cardLeaveTimerRef.current = setTimeout(() => {
            cardLeaveTimerRef.current = null;
            setState((current) => reduceToolHoverCardState(current, "card-leave"));
        }, TOOL_HOVER_CARD_LEAVE_GRACE);
    }, [clearTimer]);

    const onEscape = useCallback(() => {
        clearTimer(showTimerRef);
        clearTimer(leaveTimerRef);
        clearTimer(cardLeaveTimerRef);
        setState((current) => reduceToolHoverCardState(current, "escape"));
    }, [clearTimer]);

    useEffect(
        () => () => {
            clearTimer(showTimerRef);
            clearTimer(leaveTimerRef);
            clearTimer(cardLeaveTimerRef);
        },
        [clearTimer],
    );

    const open = Boolean(data) && Boolean(anchorEl) && isToolHoverCardOpen(state);

    return {
        enabled: Boolean(data),
        setAnchor: setAnchorEl,
        onEnter,
        onLeave,
        onFocus,
        onBlur,
        card: data ? <ToolHoverCard open={open} anchorEl={anchorEl} data={data} label={label} icon={icon} onCardEnter={onCardEnter} onCardLeave={onCardLeave} onEscape={onEscape} /> : null,
    };
}
