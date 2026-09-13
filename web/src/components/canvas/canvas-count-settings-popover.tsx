import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "antd";
import { usePopoverExit } from "./use-popover-exit";
import { useExclusiveSettings } from "./use-exclusive-settings";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasTheme } from "@/lib/canvas-theme";

export const COUNT_MAX = 15;

/** 份数归一：1..COUNT_MAX 的整数,非法输入回落 1(与旧 InputNumber 行为一致)。 */
export function normalizeCount(value: number | string | null | undefined): number {
    const parsed = Math.floor(Math.abs(Number(value) || 0));
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.min(COUNT_MAX, parsed);
}

type CanvasCountSettingsPopoverProps = {
    /** 归属供给标注: 打开的气泡面板纳入 hover 归属域(面板/触发器双标), 指针在面板上时
        composer 归属不判空, 防面板连着 composer 一起退场(2026-09-13 报告 P2-4 根修)。 */
    supplyNodeId?: string;
    value: number;
    onChange: (value: number) => void;
    max?: number;
    /** 量词：文本"份"、图像"张"、视频/音频"个";参与 aria 标签与触发器摘要。 */
    label?: string;
    placement?: "topLeft" | "topRight" | "top" | "bottom";
    buttonClassName?: string;
};

/**
 * 份数独立气泡(用户三轮拍板 2026-09-11): 纯竖滚列表(1..max, 限高 4 行, 其余滚动)。
 * 快捷档行与自定义行均已删(重复/冗余)。文本/图像/视频/音频模式共用,量词随调用方(张/个/份)。
 */
export function CanvasCountSettingsPopover({ supplyNodeId, value, onChange, max = COUNT_MAX, label = "份", placement = "topLeft", buttonClassName }: CanvasCountSettingsPopoverProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    useExclusiveSettings("count-settings", open, setOpen, supplyNodeId);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const { shouldRender, closing } = usePopoverExit(open);
    const count = Math.max(1, Math.min(max, normalizeCount(value)));
    // 选中即关(用户反馈): 列表点选完成选择后收起面板。
    const handleSelect = (next: number) => {
        onChange(next);
        setOpen(false);
    };

    useEffect(() => {
        if (!shouldRender) return;
        const syncPosition = () => setButtonRect(buttonRef.current?.getBoundingClientRect() || null);
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            setOpen(false);
        };

        syncPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        // 画布 wheel 缩放/平移使触发器位移, fixed 浮层不跟随 —— 手势打断直接关(修漂移)。
        const closeOnCanvasWheel = (event: WheelEvent) => {
            if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
            setOpen(false);
        };
        window.addEventListener("wheel", closeOnCanvasWheel, { capture: true, passive: true });
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
            window.removeEventListener("wheel", closeOnCanvasWheel, { capture: true });
        };
    }, [shouldRender]);

    const panel = shouldRender && buttonRect ? <CountSettingsPortal supplyNodeId={supplyNodeId} buttonRect={buttonRect} panelRef={panelRef} placement={placement} theme={theme} value={count} max={max} label={label} onChange={handleSelect} closing={closing} /> : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0">
                <Button size="small" type="text" className={`canvas-generation-settings-trigger ${buttonClassName || "!h-8 !max-w-[168px] !justify-start !rounded-full !px-2.5"}`} style={{ color: theme.node.text }} aria-expanded={open} aria-label={`生成份数：${count} ${label}`} title={`生成份数 · ${count} ${label}`} onClick={() => setOpen(!open)}>
                    <span className="truncate tabular-nums">{`x${count}`}</span>
                    <ChevronDown className="canvas-composer-trigger-chevron size-3 shrink-0 opacity-50" aria-hidden="true" />
                </Button>
            </span>
            {panel}
        </>
    );
}

const ROW = 32;
const PANEL_WIDTH = 168;
/** 列表最多可见行数(用户拍板: 限 4 行, 其余滚动查看); 面板自然高 ≈ 5+4*32+8 ≈ 141px。 */
const LIST_VISIBLE_ROWS = 4;

function CountSettingsPortal({
    buttonRect,
    panelRef,
    placement,
    theme,
    value,
    max,
    label,
    onChange,
    closing,
    supplyNodeId,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasCountSettingsPopoverProps["placement"];
    theme: CanvasTheme;
    value: number;
    max: number;
    label: string;
    onChange: (value: number) => void;
    closing: boolean;
    supplyNodeId?: string;
}) {
    const gap = 8;
    const margin = 12;
    const listMax = Math.min(LIST_VISIBLE_ROWS, Math.max(1, max)) * ROW + 8;
    const alignRight = placement?.endsWith("Right");
    const alignCenter = placement === "top" || placement === "bottom";
    const left = alignCenter ? buttonRect.left + buttonRect.width / 2 - PANEL_WIDTH / 2 : alignRight ? buttonRect.right - PANEL_WIDTH : buttonRect.left;
    // 节点在画布顶部时向上展开空间不足(用户实测: 压出第二条滚动条) → 自动翻转向下。
    const desiredTop = placement?.startsWith("top");
    const panelNaturalHeight = 10 + listMax;
    const topPlacement = desiredTop ? buttonRect.top - margin * 2 >= panelNaturalHeight : false;
    const style = {
        position: "fixed",
        // 开合锚触发器(emil): 从触发器方向缩放; 向上翻转后锚点换 top。
        "--panel-float-y": topPlacement ? "6px" : "-6px",
        zIndex: "var(--z-dialog-popover)",
        width: PANEL_WIDTH,
        left: Math.max(margin, Math.min(window.innerWidth - PANEL_WIDTH - margin, left)),
        ...(topPlacement ? { bottom: window.innerHeight - buttonRect.top + gap, maxHeight: Math.max(200, buttonRect.top - margin * 2) } : { top: buttonRect.bottom + gap, maxHeight: Math.max(200, window.innerHeight - buttonRect.bottom - margin * 2) }),
        // 面板根不内滚(内滚只留给列表), 避免双滚动条。
        padding: 5,
        color: theme.node.text,
    } as const;
    const listStart = 1;
    const counts = Array.from({ length: max }, (_, index) => listStart + index);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 打开/切换值时把当前值滚进可视区; 直接算 scrollTop(行高恒定),
        // 不用 scrollIntoView —— 它会连带滚动画布等所有可滚祖先。
        const list = listRef.current;
        if (!list) return;
        list.scrollTop = (value - listStart) * ROW;
    }, [value, listStart]);

    return createPortal(
        <div
            ref={panelRef}
            data-supply-node={supplyNodeId}
            data-affordance="full"
            className={`canvas-count-settings-popover aceternity-floating-panel${closing ? " canvas-settings-popover-closing" : ""}`}
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <div ref={listRef} className="canvas-settings-scroll flex flex-col" style={{ maxHeight: listMax, overflowY: "auto" }}>
                {counts.map((count) => (
                    <button
                        key={count}
                        type="button"
                        data-count={count}
                        aria-pressed={value === count}
                        aria-label={`${count} ${label}`}
                        className="canvas-settings-option canvas-settings-roll-row"
                        style={{ outlineColor: theme.node.muted }}
                        onClick={() => onChange(count)}
                    >
                        {count}
                    </button>
                ))}
            </div>
        </div>,
        document.body,
    );
}
