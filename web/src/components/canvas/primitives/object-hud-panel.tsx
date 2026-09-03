import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Maximize2 } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

/**
 * Object HUD 事实面板(B-lite-1;DESIGN.md 归属面契约:Object HUD owns selected-object facts)。
 *
 * 浮层式:锚定屏幕右缘,不占布局、不缩画布、不随节点飞。
 * 出现条件:选中"有内容"的媒体节点;取消选中即收;切换节点内容原地换(80ms debounce 合并,不收不闪)。
 * 动效:入场 250ms 滑入 12px(base);退场 150ms(fast);揭示行错峰 30ms;全程可打断,reduced-motion 降级。
 * 只读:唯一动作"查看大图";零参数编辑(负面约束)。
 */
export type ObjectHudPanelProps = {
    node: CanvasNodeData | null;
    onViewImage?: (node: CanvasNodeData) => void;
    onClose?: () => void;
    className?: string;
};

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveFormat(node: CanvasNodeData): string | null {
    if (node.type === CanvasNodeType.Image) return "PNG";
    if (node.type === CanvasNodeType.Video) return "MP4";
    if (node.type === CanvasNodeType.Audio) return "MP3";
    if (node.type === CanvasNodeType.Text) return "TXT";
    return null;
}

function hasContent(node: CanvasNodeData): boolean {
    return (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) && Boolean(node.metadata?.content);
}

export function useObjectHudSelection(selectedNode: CanvasNodeData | null): CanvasNodeData | null {
    // 切换节点不收不闪:保留上一节点 80ms 合并快速连选;内容节点才显示
    const [hudNode, setHudNode] = useState<CanvasNodeData | null>(null);
    const timer = useRef<number | null>(null);
    useEffect(() => {
        const next = selectedNode && hasContent(selectedNode) ? selectedNode : null;
        if (timer.current !== null) window.clearTimeout(timer.current);
        if (next || !hudNode) {
            setHudNode(next);
        } else {
            timer.current = window.setTimeout(() => setHudNode(null), 80);
        }
        return () => {
            if (timer.current !== null) window.clearTimeout(timer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedNode?.id, selectedNode?.metadata?.content]);
    return hudNode;
}

export function ObjectHudPanel({ node, onViewImage, onClose, className }: ObjectHudPanelProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const mountedRef = useRef(false);
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        if (!node) {
            mountedRef.current = false;
            setRevealed(false);
            return;
        }
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
            mountedRef.current = true;
            setRevealed(true);
            return;
        }
        // 不用 rAF:后台标签页 rAF 不触发会导致面板永久透明;setTimeout 前后台都会走
        const timer = window.setTimeout(() => {
            mountedRef.current = true;
            setRevealed(true);
        }, 16);
        return () => window.clearTimeout(timer);
    }, [node?.id]);

    if (!node) return null;

    const width = node.metadata?.naturalWidth;
    const height = node.metadata?.naturalHeight;
    const resolution = Number.isFinite(width) && Number.isFinite(height) && width && height ? `${Math.round(width)} × ${Math.round(height)}` : null;
    const format = node.type === CanvasNodeType.Image ? "PNG" : node.type === CanvasNodeType.Video ? "MP4" : null;
    const bytes = node.metadata?.content?.startsWith("data:") ? Math.round(node.metadata.content.length * 0.75) : null;
    const createdAt = node.createdAt ? new Date(node.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
    const facts: Array<[string, string | null]> = [
        ["模型", node.metadata?.model ?? null],
        ["格式", format],
        ["大小", bytes === null ? null : formatBytes(bytes)],
        ["分辨率", resolution],
        ["创建", createdAt],
    ];
    const visibleFacts = facts.filter(([, v]) => v);

    const shellStyle: CSSProperties = {
        position: "fixed",
        right: 16,
        top: 88,
        width: 280,
        maxHeight: "calc(100vh - 176px)",
        overflowY: "auto",
        background: theme.toolbar.panel,
        border: `1px solid ${theme.toolbar.border}`,
        borderRadius: 12,
        zIndex: "var(--z-modal-overlay)" as unknown as number,
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateX(0)" : "translateX(12px)",
        transition: revealed
            ? "opacity var(--motion-dur-base) var(--motion-ease-out), transform var(--motion-dur-base) var(--motion-ease-out)"
            : "opacity var(--motion-dur-fast) var(--motion-ease-in), transform var(--motion-dur-fast) var(--motion-ease-in)",
        pointerEvents: revealed ? "auto" : "none",
    };

    return (
        <aside className={className} style={shellStyle} data-object-hud-panel="" aria-label="对象信息面板" onKeyDown={(event) => { if (event.key === "Escape") onClose?.(); }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px", borderBottom: `1px solid ${theme.toolbar.border}` }}>
                <span style={{ color: theme.node.muted, fontSize: 11, fontWeight: 500 }}>对象信息</span>
                {hasContent(node) && node.type === CanvasNodeType.Image && onViewImage ? (
                    <button
                        type="button"
                        aria-label="查看大图"
                        title="查看大图"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", color: theme.toolbar.item, fontSize: 11, padding: "2px 4px", borderRadius: 6 }}
                        onClick={(event) => { event.stopPropagation(); onViewImage(node); }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <Maximize2 className="size-3" />
                        大图
                    </button>
                ) : null}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-3 py-2.5" style={{ margin: 0 }}>
                {visibleFacts.map(([label, value], index) => (
                    <div key={label} className="contents">
                        <dt
                            style={{
                                color: theme.node.faint,
                                fontSize: 11,
                                lineHeight: "18px",
                                opacity: revealed ? 1 : 0,
                                transform: revealed ? "translateY(0)" : "translateY(4px)",
                                transition: `opacity var(--motion-dur-fast) var(--motion-ease-out) ${index * 30}ms, transform var(--motion-dur-fast) var(--motion-ease-out) ${index * 30}ms`,
                            }}
                        >
                            {label}
                        </dt>
                        <dd
                            style={{
                                margin: 0,
                                color: theme.node.text,
                                fontSize: 11,
                                lineHeight: "18px",
                                fontVariantNumeric: "tabular-nums",
                                opacity: revealed ? 1 : 0,
                                transform: revealed ? "translateY(0)" : "translateY(4px)",
                                transition: `opacity var(--motion-dur-fast) var(--motion-ease-out) ${index * 30 + 20}ms, transform var(--motion-dur-fast) var(--motion-ease-out) ${index * 30 + 20}ms`,
                            }}
                        >
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
        </aside>
    );
}
