import { useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

/**
 * Object HUD(DESIGN.md 归属面契约:选中对象事实,折叠式,不重复 prompt 编辑)。
 *
 * flora T1 实测语法:事实组(模型/格式/尺寸/分辨率/创建时间)默认收起,
 * 悬停/展开显示;无 provider/protocol 内部(负面约束)。
 * 视觉走画布原语词汇(alpha 表面+细边框);归属:选中对象的 concise facts。
 */
export type ObjectHudProps = {
    node: CanvasNodeData;
    className?: string;
    style?: CSSProperties;
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

export function ObjectHud({ node, className, style }: ObjectHudProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [expanded, setExpanded] = useState(false);

    const width = node.metadata?.naturalWidth;
    const height = node.metadata?.naturalHeight;
    const resolution = Number.isFinite(width) && Number.isFinite(height) && width && height ? `${Math.round(width)} × ${Math.round(height)}` : null;
    const format = resolveFormat(node);
    const model = node.metadata?.model ?? null;
    const createdAt = node.createdAt ? new Date(node.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
    // 内容 data URL 的真实字节数(base64 膨胀校正);对象存储引用时显示 "—" 由 storageKey 场景另行接管
    const bytes = node.metadata?.content?.startsWith("data:") ? Math.round(node.metadata.content.length * 0.75) : null;

    const facts: Array<[string, string | null]> = [
        ["模型", model],
        ["格式", format],
        ["大小", bytes === null ? null : formatBytes(bytes)],
        ["分辨率", resolution],
        ["创建", createdAt],
    ];
    const visibleFacts = facts.filter(([, v]) => v);
    if (visibleFacts.length === 0) return null;

    const shellStyle: CSSProperties = {
        background: theme.toolbar.panel,
        border: `1px solid ${theme.toolbar.border}`,
        borderRadius: 10,
        overflow: "hidden",
        ...style,
    };

    return (
        <div className={className} style={shellStyle} data-object-hud="" data-expanded={expanded}>
            <button
                type="button"
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: theme.node.muted, fontSize: 11, fontWeight: 500 }}
                onClick={(event) => { event.stopPropagation(); setExpanded((current) => !current); }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <span>对象信息</span>
                <ChevronDown className="size-3" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform var(--motion-dur-fast) var(--motion-ease-out)" }} />
            </button>
            {expanded ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2.5 pb-2" style={{ margin: 0 }}>
                    {visibleFacts.map(([label, value]) => (
                        <div key={label} className="contents">
                            <dt style={{ color: theme.node.faint, fontSize: 11, lineHeight: "18px" }}>{label}</dt>
                            <dd style={{ margin: 0, color: theme.node.text, fontSize: 11, lineHeight: "18px", fontVariantNumeric: "tabular-nums" }}>{value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
        </div>
    );
}
