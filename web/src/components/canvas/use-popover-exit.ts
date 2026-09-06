import { useEffect, useState } from "react";

/**
 * 画布 portal 气泡的开合动画挂载器:open=false 后延迟卸载(等 exit 动画播完),
 * 期间返回 closing=true 供挂 `.canvas-settings-popover-closing`。
 * 与 antd Popover(自带开合动效)对齐,四个设置气泡共用。
 */
export function usePopoverExit(open: boolean, exitMs = 150): { shouldRender: boolean; closing: boolean } {
    const [shouldRender, setShouldRender] = useState(open);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (open) {
            setShouldRender(true);
            setClosing(false);
            return;
        }
        if (!shouldRender) return;
        setClosing(true);
        const timer = window.setTimeout(() => {
            setShouldRender(false);
            setClosing(false);
        }, exitMs);
        return () => window.clearTimeout(timer);
    }, [open, exitMs, shouldRender]);

    return { shouldRender, closing };
}
