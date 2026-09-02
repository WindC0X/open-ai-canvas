import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

/**
 * 画布悬停工具条(DESIGN.md 归属面契约:Top floating toolbar)。
 *
 * 四态语义(yingce-floraization state-matrix,不得合并计量):
 * - hover-only:瞬态;pointer 离开即进入关闭动效(可配 graceMs,默认即离即收)
 * - selected:节点保持选中期间常驻
 * - edit-focus:内联编辑面(composer 等)持有焦点期间常驻
 * - dropdown-safe-close:菜单/popover 开启时的安全桥接宽限,不与 hover-only 关闭延时混用
 *
 * 只动 transform/opacity(合成器属性);可打断;reduced-motion 由 CSS 侧降级。
 */
export type ToolbarPersistence = "hover-only" | "selected" | "edit-focus" | "dropdown-open";

export type HoverToolbarProps = {
    persistence: ToolbarPersistence;
    children: ReactNode;
    /** hover-only 离开后的关闭宽限(ms);仅 hover-only 态消费 */
    leaveGraceMs?: number;
    /** 工具条定位:由调用方给出锚点坐标(相对画布视口) */
    anchor: { x: number; y: number };
    className?: string;
    style?: CSSProperties;
    /** 内容变化时保持可见(例如菜单从工具条内部弹出) */
    onDropdownToggle?: (open: boolean) => void;
};

export function HoverToolbar({ persistence, children, leaveGraceMs = 0, anchor, className, style, onDropdownToggle }: HoverToolbarProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [visible, setVisible] = useState(persistence !== "hover-only");
    const closeTimer = useRef<number | null>(null);
    const lastPersistence = useRef(persistence);

    useEffect(() => {
        // 首次挂载即 hover-only 时保持不可见,等待 pointer 进入;切换到其它态则常驻
        if (persistence === "hover-only") {
            if (lastPersistence.current !== "hover-only") setVisible(true);
            return;
        }
        if (lastPersistence.current === "hover-only") setVisible(true);
        lastPersistence.current = persistence;
    }, [persistence]);

    useEffect(() => {
        onDropdownToggle?.(persistence === "dropdown-open");
    }, [persistence, onDropdownToggle]);

    const scheduleClose = () => {
        if (persistence !== "hover-only") return;
        if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => setVisible(false), leaveGraceMs);
    };

    const cancelClose = () => {
        if (closeTimer.current !== null) {
            window.clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    useEffect(() => () => cancelClose(), []);

    // 安静化(DESIGN.md):alpha 表面 + 细边框,无投影
    const panelStyle: CSSProperties = {
        position: "absolute",
        left: anchor.x,
        top: anchor.y,
        background: theme.toolbar.panel,
        border: `1px solid ${theme.toolbar.border}`,
        borderRadius: 10,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-4px)",
        transition: "opacity var(--motion-dur-fast) var(--motion-ease-out), transform var(--motion-dur-fast) var(--motion-ease-out)",
        pointerEvents: visible ? "auto" : "none",
        ...style,
    };

    return (
        <div
            className={className}
            style={panelStyle}
            data-toolbar-persistence={persistence}
            data-toolbar-visible={visible}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
            role="toolbar"
        >
            {children}
        </div>
    );
}
