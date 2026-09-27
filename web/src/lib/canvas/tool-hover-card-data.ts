import { CANVAS_SHORTCUTS } from "./canvas-shortcuts";
import type { ToolHoverInfo } from "./tool-registry/tool-definition";

/**
 * S2 · hover 说明卡渲染数据。
 * 快捷键在数据层解析成键位数组，卡片组件不依赖快捷键模块；未知 id 直接跳过。
 */
export type ToolHoverCardData = {
    /** 一句话职责（卡片正文） */
    description: string;
    /** 预览图（public 根路径，可选；缺省降级纯文字卡） */
    preview?: string;
    /** 快捷键键位：多组 = 备选组合，每组 = 一个组合的按键序列 */
    shortcutKeys?: string[][];
};

/** 将定义侧 hover 数据解析为渲染数据；快捷键 id 从 CANVAS_SHORTCUTS 实时取键位。 */
export function resolveToolHoverCardData(hover?: ToolHoverInfo): ToolHoverCardData | undefined {
    if (!hover) return undefined;
    const shortcutKeys = hover.shortcuts?.flatMap((id) => {
        const shortcut = CANVAS_SHORTCUTS.find((item) => item.id === id);
        return shortcut ? shortcut.keys.map((combination) => [...combination]) : [];
    });
    return {
        description: hover.description,
        preview: hover.preview,
        shortcutKeys: shortcutKeys?.length ? shortcutKeys : undefined,
    };
}
