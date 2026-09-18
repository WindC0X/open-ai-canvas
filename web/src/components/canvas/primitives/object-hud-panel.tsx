import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Maximize2 } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import { modelDisplayName, type AiConfig } from "@/stores/use-config-store";
import { formatCredits } from "@/constant/credits";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

/**
 * Object HUD 事实面板(B-lite-1;DESIGN.md 归属面契约:Object HUD owns selected-object facts + concise actions)。
 *
 * 浮层式:锚定画布右缘(assistant 面板打开时自动让位,复用 2197 行避让公式),不占布局、不缩画布。
 * 出现条件:选中"有内容"的媒体节点;取消选中即收;切换节点内容原地换(80ms 合并)。
 * 只读 + 简洁动作(flora 语法:Inspector 持有 concise actions;完整动作仍在右键/工具条,不迁移不删减)。
 */
export type ObjectHudAction = {
    label: string;
    icon: ReactNode;
    onClick: () => void;
};

export type ObjectHudPanelProps = {
    node: CanvasNodeData | null;
    /** 生效配置(解析模型显示名:区分后端渠道/前台模型两种情况) */
    config?: AiConfig | null;
    /** 该节点关联生成任务的计费文案(冻结/已结算);无关联任务时不显示 */
    /** Agent 等右侧停靠面打开时的让位 CSS right 值;缺省 16px */
    rightInset?: string;
    /** 顶部让位 CSS 值;缺省 88px。生成任务面板出现时宿主传入其下方位置,避免同锚重叠 */
    topInset?: string | number;
    actions?: ObjectHudAction[];
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

function hasContent(node: CanvasNodeData): boolean {
    return (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) && Boolean(node.metadata?.content);
}

export function ObjectHudPanel({ node, config, rightInset, topInset = 88, actions = [], onViewImage, onClose, className }: ObjectHudPanelProps) {
    // 画布外观通道统一走 useActiveTheme(W1-C 迁移漏项): HUD 是画布浮层, 亮色画布下必须亮色——
    // 直连工作台 useThemeStore 会拿错主题(用户截图: 亮色画布 HUD 恒黑)。
    const theme = canvasThemes[useActiveTheme()];
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
    const storedBytes = node.metadata?.bytes;
    const bytes = Number.isFinite(storedBytes) && storedBytes ? storedBytes : node.metadata?.content?.startsWith("data:") ? Math.round(node.metadata.content.length * 0.75) : null;
    const createdAt = node.createdAt ? new Date(node.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
    // 负面约束:不显示渠道内部 ID;modelDisplayName 区分后端渠道(displayName/系统模型)与前台模型两种情况
    const friendlyModel = node.metadata?.model ? (config ? modelDisplayName(config, node.metadata.model) : node.metadata.model.split("::").pop() || null) : null;
    const facts: Array<[string, string | null]> = [
        ["模型", friendlyModel],
        ["格式", format],
        ["大小", bytes === null ? null : formatBytes(bytes)],
        ["分辨率", resolution],
        ["创建", createdAt],
        ["消耗", node.metadata?.taskBilling ? `${formatCredits(node.metadata.taskBilling.amountMicrocredits)} 积分${node.metadata.taskBilling.status === "settled" ? "" : " · 冻结中"}` : null],
    ];
    const visibleFacts = facts.filter(([, v]) => v);

    const shellStyle: CSSProperties = {
        position: "fixed",
        right: rightInset ?? 16,
        top: topInset,
        width: 288,
        maxHeight: "calc(100vh - 176px)",
        overflowY: "auto",
        background: theme.toolbar.panel,
        border: `1px solid ${theme.toolbar.border}`,
        borderRadius: 14,
        zIndex: "var(--z-modal-overlay)" as unknown as number,
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateX(0)" : "translateX(12px)",
        transition: revealed
            ? "opacity var(--motion-dur-base) var(--motion-ease-out), transform var(--motion-dur-base) var(--motion-ease-out)"
            : "opacity var(--motion-dur-fast) var(--motion-ease-in), transform var(--motion-dur-fast) var(--motion-ease-in)",
        pointerEvents: revealed ? "auto" : "none",
    };

    const rowStyle = (index: number): CSSProperties => ({
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(4px)",
        transition: `opacity var(--motion-dur-fast) var(--motion-ease-out) ${index * 30}ms, transform var(--motion-dur-fast) var(--motion-ease-out) ${index * 30}ms`,
    });

    return (
        <aside className={className} style={shellStyle} data-object-hud-panel="" aria-label="对象信息面板" onKeyDown={(event) => { if (event.key === "Escape") onClose?.(); }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 14px 10px" }}>
                <span style={{ color: theme.node.text, fontSize: 14, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.title}</span>
                {hasContent(node) && node.type === CanvasNodeType.Image && onViewImage ? (
                    <button
                        type="button"
                        aria-label="查看大图"
                        title="查看大图"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", color: theme.toolbar.item, fontSize: 11, padding: "2px 4px", borderRadius: 6 }}
                        onClick={(event) => { event.stopPropagation(); onViewImage(node); }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <Maximize2 className="size-3" />
                    </button>
                ) : null}
            </div>
            <dl className="grid gap-y-1.5 px-3.5 pb-3" style={{ margin: 0 }}>
                {visibleFacts.map(([label, value], index) => (
                    <div
                        key={label}
                        className="flex items-baseline justify-between gap-3"
                        style={{ ...rowStyle(index), borderBottom: index < visibleFacts.length - 1 ? `1px solid ${theme.toolbar.border}` : "none", padding: "3px 0" }}
                    >
                        <dt style={{ color: theme.node.faint, fontSize: 11 }}>{label}</dt>
                        <dd style={{ margin: 0, color: theme.node.text, fontSize: 11, fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}>{value}</dd>
                    </div>
                ))}
            </dl>
            {actions.length ? (
                <div
                    className="flex items-center gap-1 px-3 pb-3"
                    style={{ ...rowStyle(visibleFacts.length), borderTop: `1px solid ${theme.toolbar.border}`, paddingTop: 8 }}
                    role="toolbar"
                    aria-label="对象快捷操作"
                >
                    {actions.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            aria-label={action.label}
                            title={action.label}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                border: "none",
                                cursor: "pointer",
                                background: "transparent",
                                color: theme.node.text,
                            }}
                            onClick={(event) => { event.stopPropagation(); action.onClick(); }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            {action.icon}
                        </button>
                    ))}
                </div>
            ) : null}
        </aside>
    );
}
