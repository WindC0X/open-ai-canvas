import { useCallback, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";

import { Kbd } from "@/components/ui/base/kbd";
import type { ToolHoverCardData } from "@/lib/canvas/tool-hover-card-data";

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
 * 定位：触发器上方优先，空间不足翻到下方；水平居中并夹在视口内
 * ------------------------------------------------------------------------- */

export type ToolHoverCardPosition = { top: number; left: number; placement: "above" | "below" };

export function computeToolHoverCardPosition(
    anchor: { top: number; bottom: number; left: number; width: number },
    card: { width: number; height: number },
    viewport: { width: number; height: number },
): ToolHoverCardPosition {
    const fitsAbove = anchor.top - CARD_TRIGGER_GAP - card.height >= CARD_EDGE_MARGIN;
    const top = fitsAbove ? anchor.top - CARD_TRIGGER_GAP - card.height : anchor.bottom + CARD_TRIGGER_GAP;
    const maxLeft = Math.max(CARD_EDGE_MARGIN, viewport.width - CARD_EDGE_MARGIN - card.width);
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - card.width / 2, CARD_EDGE_MARGIN), maxLeft);
    return { top, left, placement: fitsAbove ? "above" : "below" };
}

/* ---------------------------------------------------------------------------
 * 卡片内容：图标 + 名称/职责 + 快捷键徽章 + 可选预览图（纯展示，SSR 可测）
 * ------------------------------------------------------------------------- */

export type ToolHoverCardContentProps = {
    data: ToolHoverCardData;
    label: string;
    icon?: ReactNode;
    ref?: Ref<HTMLDivElement>;
} & HTMLAttributes<HTMLDivElement>;

export function ToolHoverCardContent({ data, label, icon, ref, className, ...rest }: ToolHoverCardContentProps) {
    const [previewFailed, setPreviewFailed] = useState(false);
    useEffect(() => setPreviewFailed(false), [data.preview]);
    const shortcutKeys = data.shortcutKeys ?? [];

    return (
        <div
            ref={ref}
            role="tooltip"
            className={`tool-hover-card fixed flex w-max max-w-[260px] flex-col gap-1.5 rounded-md border border-border bg-surface-strong px-2.5 py-2 text-foreground shadow-md ${className ?? ""}`}
            {...rest}
        >
            <span className="flex items-start gap-2">
                {icon ? <span className="grid size-5 shrink-0 place-items-center [&_svg]:size-4">{icon}</span> : null}
                <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-tiny font-semibold leading-none">{label}</span>
                    <span className="text-tiny leading-snug opacity-70">{data.description}</span>
                </span>
            </span>
            {shortcutKeys.length ? (
                <span className="flex flex-wrap items-center gap-1.5" aria-label={shortcutKeys.map((combination) => combination.join(" 加 ")).join(" 或 ")}>
                    {shortcutKeys.map((combination, combinationIndex) => (
                        <span key={combination.join("-")} className="inline-flex items-center gap-0.5">
                            {combinationIndex ? <em className="text-tiny not-italic opacity-50">或</em> : null}
                            {combination.map((key, keyIndex) => (
                                <span key={`${key}-${keyIndex}`} className="inline-flex items-center gap-0.5">
                                    {keyIndex ? <i className="text-tiny not-italic opacity-50">+</i> : null}
                                    <Kbd>{key}</Kbd>
                                </span>
                            ))}
                        </span>
                    ))}
                </span>
            ) : null}
            {data.preview && !previewFailed ? <img className="block max-h-[120px] w-full rounded-sm object-cover" src={data.preview} alt="" loading="lazy" onError={() => setPreviewFailed(true)} /> : null}
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

    useLayoutEffect(() => {
        if (!open || !anchorEl) return;
        const update = () => {
            const cardEl = cardRef.current;
            if (!cardEl) return;
            const anchorRect = anchorEl.getBoundingClientRect();
            const cardRect = cardEl.getBoundingClientRect();
            setPosition(
                computeToolHoverCardPosition(
                    { top: anchorRect.top, bottom: anchorRect.bottom, left: anchorRect.left, width: anchorRect.width },
                    { width: cardRect.width, height: cardRect.height },
                    { width: window.innerWidth, height: window.innerHeight },
                ),
            );
        };
        update();
        // 预览图加载/文案换行会改变卡片高度，跟随重排。
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
