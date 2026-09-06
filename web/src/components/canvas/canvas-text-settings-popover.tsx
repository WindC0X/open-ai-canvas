import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button } from "antd";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasTheme } from "@/lib/canvas-theme";

export const TEXT_COUNT_MAX = 15;

/** 份数归一：1..TEXT_COUNT_MAX 的整数,非法输入回落 1(与旧 InputNumber 行为一致)。 */
export function normalizeTextCount(value: number | string | null | undefined): number {
    const parsed = Math.floor(Math.abs(Number(value) || 0));
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.min(TEXT_COUNT_MAX, parsed);
}

type CanvasTextSettingsPopoverProps = {
    value: number;
    onChange: (value: number) => void;
    placement?: "topLeft" | "topRight" | "top" | "bottom";
    buttonClassName?: string;
};

export function CanvasTextSettingsPopover({ value, onChange, placement = "topLeft", buttonClassName }: CanvasTextSettingsPopoverProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const count = normalizeTextCount(value);

    useEffect(() => {
        if (!open) return;
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
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
        };
    }, [open]);

    const panel = open && buttonRect ? <TextSettingsPortal buttonRect={buttonRect} panelRef={panelRef} placement={placement} theme={theme} value={count} onChange={onChange} /> : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0">
                <Button size="small" type="text" className={`canvas-generation-settings-trigger ${buttonClassName || "!h-8 !justify-start !rounded-full !px-2.5"}`} style={{ background: theme.node.fill, color: theme.node.text }} icon={<Settings2 className="size-3.5" />} aria-expanded={open} aria-label={`文本设置：${count} 份`} title={`文本设置 · ${count} 份`} onClick={() => setOpen(!open)}>
                    <span className="truncate">{count} 份</span>
                </Button>
            </span>
            {panel}
        </>
    );
}

function TextSettingsPortal({
    buttonRect,
    panelRef,
    placement,
    theme,
    value,
    onChange,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasTextSettingsPopoverProps["placement"];
    theme: CanvasTheme;
    value: number;
    onChange: (value: number) => void;
}) {
    const gap = 8;
    const margin = 12;
    const width = 240;
    const alignRight = placement?.endsWith("Right");
    const alignCenter = placement === "top" || placement === "bottom";
    const left = alignCenter ? buttonRect.left + buttonRect.width / 2 - width / 2 : alignRight ? buttonRect.right - width : buttonRect.left;
    const topPlacement = placement?.startsWith("top");
    const style = {
        position: "fixed",
        zIndex: "var(--z-dialog-popover)",
        width,
        left: Math.max(margin, Math.min(window.innerWidth - width - margin, left)),
        ...(topPlacement ? { bottom: window.innerHeight - buttonRect.top + gap, maxHeight: Math.max(220, buttonRect.top - margin * 2) } : { top: buttonRect.bottom + gap, maxHeight: Math.max(220, window.innerHeight - buttonRect.bottom - margin * 2) }),
        background: theme.canvas.background,
        border: `1px solid ${theme.toolbar.border}`,
        borderRadius: "var(--r-lg)",
        padding: 12,
        overflowY: "auto",
        color: theme.node.text,
    } as const;

    return createPortal(
        <div
            ref={panelRef}
            className="canvas-text-settings-popover aceternity-floating-panel backdrop-blur-2xl"
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <div className="space-y-2">
                <div className="text-[var(--fs-tiny)] font-medium opacity-60">生成份数</div>
                <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((pill) => (
                        <button
                            key={pill}
                            type="button"
                            aria-label={`${pill} 份`}
                            aria-pressed={value === pill}
                            className="h-8 rounded-full text-xs transition-colors"
                            style={{
                                background: value === pill ? theme.accent.primary : theme.toolbar.itemHover,
                                color: value === pill ? theme.accent.onPrimary : theme.node.text,
                            }}
                            onClick={() => onChange(pill)}
                        >
                            {pill}
                        </button>
                    ))}
                    <TextCountInput value={value} max={TEXT_COUNT_MAX} theme={theme} onChange={onChange} />
                </div>
                <div className="text-[var(--fs-tiny)] opacity-50">同一提示词独立生成多份结果</div>
            </div>
        </div>,
        document.body,
    );
}

function TextCountInput({ value, max, theme, onChange }: { value: number; max: number; theme: CanvasTheme; onChange: (value: number) => void }) {
    const isCustom = value > 4;
    const commit = (input: HTMLInputElement) => {
        const next = normalizeTextCount(input.value);
        input.value = String(next);
        onChange(next);
    };
    return (
        <label className="flex h-8 overflow-hidden rounded-full text-xs" style={{ background: theme.toolbar.itemHover ?? "rgba(127,127,127,.16)", color: theme.node.text }}>
            <input
                key={isCustom ? `custom-${value}` : "quick"}
                type="number"
                min={1}
                max={max}
                aria-label="自定义生成份数"
                placeholder="输入"
                className="min-w-0 flex-1 bg-transparent px-2 text-center outline-none placeholder:text-current placeholder:opacity-55 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{ color: theme.node.text, WebkitTextFillColor: theme.node.text }}
                defaultValue={isCustom ? value : ""}
                onBlur={(event) => commit(event.currentTarget)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
            />
        </label>
    );
}
