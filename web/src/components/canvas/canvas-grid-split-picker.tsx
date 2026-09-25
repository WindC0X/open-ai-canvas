import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import { CANVAS_GRID_SPLIT_MAX, CANVAS_GRID_SPLIT_PRESETS, clampGridSplitSize, isValidGridSplit } from "@/lib/canvas/canvas-grid-split";
import type { ImageSplitParams } from "@/lib/canvas/canvas-image-data";

import "./canvas-grid-split-picker.css";

function MiniGridIcon({ n }: { n: number }) {
    return (
        <span className="canvas-grid-split-mini" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
            {Array.from({ length: n * n }, (_, index) => <span key={index} />)}
        </span>
    );
}

export function CanvasGridSplitPicker({ onPick, anchorSelector, supplyNodeId, onHoverLeave }: { onPick: (params: ImageSplitParams) => void; anchorSelector?: string; supplyNodeId?: string; onHoverLeave?: () => void }) {
    const [customOpen, setCustomOpen] = useState(false);
    const [hoverRows, setHoverRows] = useState(2);
    const [hoverCols, setHoverCols] = useState(2);
    const rootRef = useRef<HTMLDivElement | null>(null);
    // [2026-09-25 用户拍板] L3「自定义」悬停展开: 与 L2 同款 150ms 意图延迟, 点击仍可切换;
    // 指针离开行/棋盘时收起(140ms 宽限供行→棋盘 1px 缝穿越); 指针仍在棋盘上则不收。
    const customOpenTimerRef = useRef<number | null>(null);
    const customCloseTimerRef = useRef<number | null>(null);
    const cancelCustomTimers = () => {
        if (customOpenTimerRef.current !== null) {
            window.clearTimeout(customOpenTimerRef.current);
            customOpenTimerRef.current = null;
        }
        if (customCloseTimerRef.current !== null) {
            window.clearTimeout(customCloseTimerRef.current);
            customCloseTimerRef.current = null;
        }
    };
    const cancelCustomClose = () => {
        if (customCloseTimerRef.current !== null) {
            window.clearTimeout(customCloseTimerRef.current);
            customCloseTimerRef.current = null;
        }
    };
    const scheduleCustomOpen = () => {
        cancelCustomTimers();
        if (customOpen) return;
        customOpenTimerRef.current = window.setTimeout(() => {
            customOpenTimerRef.current = null;
            setCustomOpen(true);
        }, 150);
    };
    const scheduleCustomClose = () => {
        if (customOpenTimerRef.current !== null) {
            window.clearTimeout(customOpenTimerRef.current);
            customOpenTimerRef.current = null;
        }
        if (customCloseTimerRef.current !== null) return;
        customCloseTimerRef.current = window.setTimeout(() => {
            customCloseTimerRef.current = null;
            // :hover 在 querySelector 中可用(与工具栏菜单同款判定); 指针仍在棋盘上则不收
            if (document.querySelector(".canvas-grid-split-custom:hover")) return;
            setCustomOpen(false);
        }, 140);
    };
    useEffect(() => cancelCustomTimers, []);

    // [2026-09-24] 顶部对齐触发行 + 贴菜单右缘 2px：rc-trigger 重测会使弹层宽度抖动，
    // 故打开后用实测 rect 差值写 inline top/left（与模型菜单 flyout 的锚定同思路）；
    // 锚点/栈缺失时保留 CSS 兑底值（top:0 / 100%+2px）。
    useLayoutEffect(() => {
        const el = rootRef.current;
        const wrap = el?.parentElement;
        if (!el || !wrap) return;
        const apply = () => {
            const wrapRect = wrap.getBoundingClientRect();
            const btn = parseFloat(getComputedStyle(wrap).borderTopWidth) || 0;
            const bleft = parseFloat(getComputedStyle(wrap).borderLeftWidth) || 0;
            const anchor = anchorSelector ? wrap.querySelector<HTMLElement>(anchorSelector) : null;
            if (anchor) {
                const rowRect = anchor.getBoundingClientRect();
                el.style.top = `${Math.round(rowRect.top - wrapRect.top - btn)}px`;
            }
            const stack = wrap.querySelector<HTMLElement>(".canvas-node-toolbar-menu-stack");
            if (stack) {
                el.style.left = `${Math.round(stack.getBoundingClientRect().right - wrapRect.left - bleft + 2)}px`;
            }
        };
        apply();
        const raf = requestAnimationFrame(() => {
            apply();
            requestAnimationFrame(apply);
        });
        return () => cancelAnimationFrame(raf);
    }, [anchorSelector]);

    const pick = (rows: number, columns: number) => {
        const params = { rows: clampGridSplitSize(rows), columns: clampGridSplitSize(columns) };
        if (!isValidGridSplit(params)) return;
        onPick(params);
    };

    return (
        <div
            ref={rootRef}
            className="canvas-grid-split-picker"
            data-supply-node={supplyNodeId}
            data-affordance="full"
            data-canvas-no-zoom
            role="dialog"
            aria-label="宫格切分"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onMouseLeave={onHoverLeave}
        >
            <div className="canvas-grid-split-presets">
                {CANVAS_GRID_SPLIT_PRESETS.map((preset) => (
                    <button key={preset.label} type="button" className="canvas-grid-split-item" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(preset.rows, preset.columns)}>
                        <span className="canvas-grid-split-icon"><MiniGridIcon n={preset.rows} /></span>
                        <span className="canvas-grid-split-item-label">{preset.label}</span>
                    </button>
                ))}
                <button
                    type="button"
                    className={`canvas-grid-split-item${customOpen ? " is-active" : ""}`}
                    aria-expanded={customOpen}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={scheduleCustomOpen}
                    onMouseLeave={scheduleCustomClose}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setCustomOpen((current) => !current);
                    }}
                >
                    <span className="canvas-grid-split-icon"><MiniGridIcon n={3} /></span>
                    <span className="canvas-grid-split-item-label">自定义</span>
                    <ChevronRight className="canvas-grid-split-chevron" strokeWidth={2} />
                </button>
            </div>
            {customOpen ? (
                <div className="canvas-grid-split-custom" onMouseEnter={cancelCustomClose} onMouseLeave={scheduleCustomClose}>
                    <div className="canvas-grid-split-custom-head">
                        <span>自定义宫格</span>
                        <span className="canvas-grid-split-custom-size">{hoverCols} × {hoverRows}</span>
                    </div>
                    <div
                        className="canvas-grid-split-board"
                        style={{ gridTemplateColumns: `repeat(${CANVAS_GRID_SPLIT_MAX}, minmax(0, 1fr))` }}
                        onPointerLeave={() => {
                            setHoverRows(2);
                            setHoverCols(2);
                        }}
                    >
                        {Array.from({ length: CANVAS_GRID_SPLIT_MAX * CANVAS_GRID_SPLIT_MAX }, (_, index) => {
                            const row = Math.floor(index / CANVAS_GRID_SPLIT_MAX) + 1;
                            const col = (index % CANVAS_GRID_SPLIT_MAX) + 1;
                            const active = row <= hoverRows && col <= hoverCols;
                            return (
                                <button
                                    key={`${row}-${col}`}
                                    type="button"
                                    className={`canvas-grid-split-cell${active ? " is-active" : ""}`}
                                    aria-label={`${col} × ${row}`}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onPointerEnter={() => {
                                        setHoverRows(row);
                                        setHoverCols(col);
                                    }}
                                    onClick={() => pick(row, col)}
                                />
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
