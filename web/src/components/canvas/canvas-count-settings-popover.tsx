import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button } from "antd";
import { usePopoverExit } from "./use-popover-exit";
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
    value: number;
    onChange: (value: number) => void;
    max?: number;
    /** 量词：文本"份"、图像"张"、视频/音频"个";参与 aria 标签与触发器摘要。 */
    label?: string;
    placement?: "topLeft" | "topRight" | "top" | "bottom";
    buttonClassName?: string;
};

/**
 * 份数独立气泡(A 形态,用户拍板): 快捷档 pill 行 + 竖滚列表 + 自定义输入行。
 * 文本/图像/视频/音频模式共用,量词随调用方(张/个/份)。
 */
export function CanvasCountSettingsPopover({ value, onChange, max = COUNT_MAX, label = "份", placement = "topLeft", buttonClassName }: CanvasCountSettingsPopoverProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const { shouldRender, closing } = usePopoverExit(open);
    const count = Math.max(1, Math.min(max, normalizeCount(value)));

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

    const panel = shouldRender && buttonRect ? <CountSettingsPortal buttonRect={buttonRect} panelRef={panelRef} placement={placement} theme={theme} value={count} max={max} label={label} onChange={onChange} closing={closing} /> : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0">
                <Button size="small" type="text" className={`canvas-generation-settings-trigger ${buttonClassName || "!h-8 !max-w-[168px] !justify-start !rounded-full !px-2.5"}`} style={{ background: theme.node.fill, color: theme.node.text }} icon={<Settings2 className="size-3.5" />} aria-expanded={open} aria-label={`生成份数：${count} ${label}`} title={`生成份数 · ${count} ${label}`} onClick={() => setOpen(!open)}>
                    <span className="truncate">{count} {label}</span>
                </Button>
            </span>
            {panel}
        </>
    );
}

const ROW = 36;
const PANEL_WIDTH = 168;
const QUICK_TIERS = [1, 2, 3, 4];

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
}) {
    const gap = 8;
    const margin = 12;
    const listMax = Math.min(9, max) * ROW + 8;
    const alignRight = placement?.endsWith("Right");
    const alignCenter = placement === "top" || placement === "bottom";
    const left = alignCenter ? buttonRect.left + buttonRect.width / 2 - PANEL_WIDTH / 2 : alignRight ? buttonRect.right - PANEL_WIDTH : buttonRect.left;
    const topPlacement = placement?.startsWith("top");
    const style = {
        position: "fixed",
        zIndex: "var(--z-dialog-popover)",
        width: PANEL_WIDTH,
        left: Math.max(margin, Math.min(window.innerWidth - PANEL_WIDTH - margin, left)),
        ...(topPlacement ? { bottom: window.innerHeight - buttonRect.top + gap, maxHeight: Math.max(200, buttonRect.top - margin * 2) } : { top: buttonRect.bottom + gap, maxHeight: Math.max(200, window.innerHeight - buttonRect.bottom - margin * 2) }),
        background: theme.canvas.background,
        border: `1px solid ${theme.toolbar.border}`,
        borderRadius: "var(--r-lg)",
        padding: 5,
        color: theme.node.text,
    } as const;
    const counts = Array.from({ length: max }, (_, index) => index + 1);
    const quickTiers = QUICK_TIERS.filter((tier) => tier <= max);
    const listRef = useRef<HTMLDivElement>(null);
    const [customOpen, setCustomOpen] = useState(false);
    const [customDraft, setCustomDraft] = useState("");
    const customInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // 打开时滚动到当前值可见
        const row = listRef.current?.querySelector(`[data-count="${value}"]`);
        row?.scrollIntoView({ block: "nearest" });
    }, [value]);

    const openCustom = () => {
        setCustomDraft(String(value));
        setCustomOpen(true);
        requestAnimationFrame(() => customInputRef.current?.select());
    };
    const commitCustom = () => {
        const parsed = normalizeCount(customDraft);
        onChange(Math.max(1, Math.min(max, parsed)));
        setCustomOpen(false);
    };

    return createPortal(
        <div
            ref={panelRef}
            className={`canvas-count-settings-popover aceternity-floating-panel backdrop-blur-2xl${closing ? " canvas-settings-popover-closing" : ""}`}
            style={{ ...style, overflowY: "auto" }}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            {quickTiers.length > 1 ? (
                <div className="mb-1 flex gap-1">
                    {quickTiers.map((tier) => (
                        <button
                            key={tier}
                            type="button"
                            aria-pressed={value === tier}
                            aria-label={`${tier} ${label}`}
                            className="canvas-settings-option h-7 flex-1 !rounded-[10px] text-[13px] font-medium tabular-nums"
                            style={{
                                background: value === tier ? theme.toolbar.activeBg : theme.node.panel,
                                borderColor: value === tier ? theme.node.activeStroke : "transparent",
                                color: theme.node.text,
                            }}
                            onClick={() => onChange(tier)}
                        >
                            {tier}
                        </button>
                    ))}
                </div>
            ) : null}
            <div ref={listRef} className="flex flex-col" style={{ maxHeight: listMax, overflowY: "auto" }}>
                {counts.map((count) => (
                    <button
                        key={count}
                        type="button"
                        data-count={count}
                        aria-pressed={value === count}
                        aria-label={`${count} ${label}`}
                        className="canvas-settings-option canvas-settings-roll-row"
                        style={{
                            background: value === count ? theme.toolbar.activeBg : "transparent",
                            borderColor: value === count ? theme.node.activeStroke : "transparent",
                            color: theme.node.text,
                        }}
                        onClick={() => onChange(count)}
                    >
                        {count}
                    </button>
                ))}
            </div>
            {customOpen ? (
                <input
                    ref={customInputRef}
                    autoFocus
                    inputMode="numeric"
                    className="canvas-count-custom-input mt-1 h-8 w-full rounded-[10px] px-2 text-center text-[13px] tabular-nums outline-none"
                    style={{ background: theme.node.panel, border: `1px solid ${theme.toolbar.border}`, color: theme.node.text }}
                    value={customDraft}
                    aria-label={`自定义份数(1-${max} ${label})`}
                    onChange={(event) => setCustomDraft(event.target.value.replace(/[^\d]/g, ""))}
                    onBlur={commitCustom}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") commitCustom();
                        if (event.key === "Escape") setCustomOpen(false);
                    }}
                />
            ) : (
                <button type="button" className="canvas-settings-option canvas-settings-roll-row mt-1 !text-[12px]" style={{ background: "transparent", borderColor: "transparent", color: theme.node.muted }} onClick={openCustom}>
                    自定义…
                </button>
            )}
        </div>,
        document.body,
    );
}
