import type { CSSProperties, ReactNode } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

/**
 * 画布节点壳(DESIGN.md 归属面契约:Node body owns primary content)。
 *
 * 状态轴契约(yingce-floraization state-matrix;轴相互独立,不是单一枚举):
 * - phase: empty / ready / running / generated / error(存在轴,本原语只管壳的视觉呈现)
 * - selection: idle / hover / selected(选中轴,与 phase 正交)
 *
 * 禁止(负面约束):在壳内渲染常驻参数表单堆;生成完成后残留生成表单。
 * 阴影/描边对齐 DESIGN.md 表面补录实测值(0 4px 12px rgba(0,0,0,.30))。
 */
export type NodeSurfaceProps = {
    phase: "empty" | "ready" | "running" | "generated" | "error";
    selection: "idle" | "hover" | "selected";
    children: ReactNode;
    /** 作品/编辑面之上的覆盖层(悬停工具条由外部渲染,不进壳) */
    className?: string;
    style?: CSSProperties;
    width?: number | string;
    aspectRatio?: string;
    "data-node-phase"?: string;
};

export function NodeSurface({ phase, selection, children, className, style, width, aspectRatio, ...rest }: NodeSurfaceProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const hovered = selection !== "idle";
    const selected = selection === "selected";

    const shellStyle: CSSProperties = {
        width,
        aspectRatio,
        background: theme.node.fill,
        border: `1px solid ${selected ? theme.node.activeStroke : theme.node.stroke}`,
        borderRadius: 12,
        boxShadow: hovered ? theme.node.hoverShadow : theme.node.shadow,
        overflow: "hidden",
        position: "relative",
        transition: "box-shadow var(--motion-dur-fast) var(--motion-ease-out), border-color var(--motion-dur-fast) var(--motion-ease-out)",
        ...style,
    };

    return (
        <div className={className} style={shellStyle} data-node-phase={phase} data-node-selection={selection} {...rest}>
            {children}
        </div>
    );
}
