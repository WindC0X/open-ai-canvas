import { CANVAS_SHORTCUTS } from "./canvas-shortcuts";
import type { ToolHoverInfo } from "./tool-registry/tool-definition";

/**
 * S2.1 · hover 说明卡渲染数据（flora 四层配方）。
 * 快捷键在数据层解析成键位数组，卡片组件不依赖快捷键模块；未知 id 直接跳过。
 */

/** 节点类预览的 11 种 SVG mockup 变体（B 侧菜单节点项；kind = 注册表命令 id） */
export const NODE_PREVIEW_KINDS = [
    "text",
    "drawing",
    "script",
    "frame",
    "folder",
    "image",
    "video",
    "batch-table",
    "media-conversion",
    "director",
    "audio",
] as const;

export type NodePreviewKind = (typeof NODE_PREVIEW_KINDS)[number];

export function isNodePreviewKind(value: string): value is NodePreviewKind {
    return (NODE_PREVIEW_KINDS as readonly string[]).includes(value);
}

/** 预览模式：工具类 = 48px 大图标；节点类 = 矢量 mockup（不用位图资产） */
export type ToolHoverCardPreview = { mode: "icon" } | { mode: "node"; kind: NodePreviewKind };

export type ToolHoverCardData = {
    /** 动作定性短句（头部第二行，必填；≤10 字） */
    tagline: string;
    /** 场景 + 防误触长句（正文） */
    description: string;
    /** 预览模式（工具类/节点类） */
    preview: ToolHoverCardPreview;
    /** 快捷键键位：多组 = 备选组合，每组 = 一个组合的按键序列 */
    shortcutKeys?: string[][];
};

/**
 * 将定义侧 hover 数据解析为渲染数据；快捷键 id 从 CANVAS_SHORTCUTS 实时取键位。
 * itemId 用于节点类预览判型：仅当声明 preview:"node" 且 id ∈ NODE_PREVIEW_KINDS 时启用 mockup。
 */
export function resolveToolHoverCardData(hover?: ToolHoverInfo, itemId?: string): ToolHoverCardData | undefined {
    if (!hover) return undefined;
    const shortcutKeys = hover.shortcuts?.flatMap((id) => {
        const shortcut = CANVAS_SHORTCUTS.find((item) => item.id === id);
        return shortcut ? shortcut.keys.map((combination) => [...combination]) : [];
    });
    const preview: ToolHoverCardPreview = hover.preview === "node" && itemId && isNodePreviewKind(itemId) ? { mode: "node", kind: itemId } : { mode: "icon" };
    return {
        tagline: hover.tagline,
        description: hover.description,
        preview,
        shortcutKeys: shortcutKeys?.length ? shortcutKeys : undefined,
    };
}
