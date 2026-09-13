import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

/** 微供给存在感级别(2026-09-12 契约): hidden=idle 不可见 / micro=hover 节点的低存在感 / full=全显 */
export type AffordanceLevel = "hidden" | "micro" | "full";

export type AffordanceSurfaceProps = {
    level: AffordanceLevel;
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    role?: string;
    ariaLabel?: string;
} & Pick<HTMLAttributes<HTMLDivElement>, "onMouseEnter" | "onMouseLeave" | "onFocus" | "onBlur" | "onFocusCapture" | "onBlurCapture" | "onMouseDown" | "onPointerDown" | "onKeyDown">;

/**
 * 微供给容器:节点工具栏/composer 共用的存在感外壳。
 *
 * - 常挂载不卸载:保住 antd Dropdown/Tooltip 内部状态,避免重挂闪烁;
 * - 只动 opacity/filter(合成器属性,可打断);micro 数值取 :root 的
 *   --affordance-micro-opacity / --affordance-micro-saturate(明暗同源);
 * - micro 态保持可交互——hover 到自身即升级 full 正是微供给的入山路径;
 *   hidden 关闭命中并 aria-hidden;
 * - prefers-reduced-motion 由 CSS 侧降级(globals.css 对 [data-affordance] 关 transition)。
 */
export function AffordanceSurface({ level, children, className, style, role, ariaLabel, ...rest }: AffordanceSurfaceProps) {
    const surfaceStyle: CSSProperties = {
        opacity: level === "hidden" ? 0 : level === "micro" ? "var(--affordance-micro-opacity)" : 1,
        filter: level === "micro" ? "saturate(var(--affordance-micro-saturate))" : undefined,
        pointerEvents: level === "hidden" ? "none" : "auto",
        // micro↔full 的确认感与 canvas-panel-in(150ms)同速: base 250ms 在 hover→selected
        // 的确认瞬间被感知为"慢半拍"(真机采样 op 0.45→1.0 实测 ~300ms 才到位)。
        transition: "opacity var(--motion-dur-fast) var(--motion-ease-out), filter var(--motion-dur-fast) var(--motion-ease-out)",
        ...style,
    };
    return (
        <div
            className={className}
            role={role}
            aria-label={ariaLabel}
            aria-hidden={level === "hidden" || undefined}
            data-affordance={level}
            style={surfaceStyle}
            {...rest}
        >
            {children}
        </div>
    );
}
