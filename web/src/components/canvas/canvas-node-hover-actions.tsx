import { Copy, Download, Maximize2, RefreshCw, Star, Trash2 } from "lucide-react";

import { HoverToolbar } from "./primitives/hover-toolbar";
import type { CanvasTheme } from "./canvas-node";
import type { CanvasNodeData } from "@/types/canvas";

/**
 * 媒体节点悬浮动作条(DESIGN.md 归属面契约:Top floating toolbar owns compact quick actions)。
 *
 * 四态 persistence 由父级推导:
 * - selected → selected persistent
 * - dropdown(Tools/版本菜单)打开 → dropdown-open
 * - 其余 → hover-only(瞬态,即离即收)
 * edit-focus 属于内联编辑面,媒体节点不涉及。
 *
 * 视觉走原语(alpha 表面+细边框,无投影);按钮沿用既有 canvas-node-tool-button 词汇。
 */
type NodeHoverActionsProps = {
    node: CanvasNodeData;
    theme: CanvasTheme;
    scale: number;
    persistence: "hover-only" | "selected" | "dropdown-open";
    hovered: boolean;
    batchPrimary?: boolean;
    onHoverChange: (hovered: boolean) => void;
    onDownload?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onViewImage?: () => void;
    onSetPrimary?: () => void;
    onRetry?: () => void;
};

export function NodeHoverActions({ node, theme, scale, persistence, hovered, batchPrimary, onHoverChange, onDownload, onDuplicate, onDelete, onViewImage, onSetPrimary, onRetry }: NodeHoverActionsProps) {
    if (scale < 0.35) return null;
    const isError = node.metadata?.status === "error";
    const hasContent = Boolean(node.metadata?.content);
    if (!hasContent && !isError) return null;

    const inverseScale = 1 / Math.max(scale, 0.05);
    const buttons: Array<{ key: string; label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; active?: boolean }> = [];
    if (hasContent && node.type === "image") buttons.push({ key: "view", label: "查看大图", icon: <Maximize2 className="size-3.5" />, onClick: () => onViewImage?.() });
    if (hasContent) buttons.push({ key: "download", label: "下载", icon: <Download className="size-3.5" />, onClick: () => onDownload?.() });
    if (hasContent && node.type === "image") buttons.push({ key: "duplicate", label: "创建副本", icon: <Copy className="size-3.5" />, onClick: () => onDuplicate?.() });
    if (hasContent && node.type === "image") buttons.push({ key: "primary", label: batchPrimary ? "当前主图" : "设为主图", icon: <Star className={`size-3.5 ${batchPrimary ? "fill-current" : ""}`} style={{ color: batchPrimary ? theme.accent.primary : undefined }} />, onClick: () => onSetPrimary?.(), active: batchPrimary });
    if (isError) buttons.push({ key: "retry", label: "重新生成", icon: <RefreshCw className="size-3.5" />, onClick: () => onRetry?.() });
    buttons.push({ key: "delete", label: "删除", icon: <Trash2 className="size-3.5" />, onClick: () => onDelete?.(), danger: true });

    return (
        <div
            className="absolute bottom-full left-0 z-[var(--node-z-overlay)] mb-1"
            style={{ transform: `scale(${inverseScale})`, transformOrigin: "left bottom" }}
            onPointerEnter={(event) => { event.stopPropagation(); onHoverChange(true); }}
            onPointerLeave={(event) => { event.stopPropagation(); onHoverChange(false); }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <HoverToolbar
                persistence={persistence}
                anchor={{ x: 0, y: 0 }}
                className="node-hover-actions"
                style={{ position: "relative", left: 0, top: 0, display: "flex", gap: 2, padding: 4 }}
                data-hovered={hovered}
            >
                {buttons.map((b) => (
                    <button
                        key={b.key}
                        type="button"
                        aria-label={b.label}
                        title={b.label}
                        className="canvas-node-tool-button inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[var(--fs-tiny)] font-medium backdrop-blur-md"
                        style={{
                            background: b.active ? theme.accent.primarySoft : "transparent",
                            borderColor: b.active ? theme.accent.primary : "transparent",
                            color: b.danger ? theme.accent.danger : b.active ? theme.accent.primary : theme.node.text,
                        }}
                        onClick={(event) => { event.stopPropagation(); b.onClick(); }}
                    >
                        {b.icon}
                    </button>
                ))}
            </HoverToolbar>
        </div>
    );
}
