import { useEffect } from "react";

/**
 * 生成参数气泡互斥(实证: 份数气泡与图像设置面板同开时互相遮挡, 模型菜单已有 sibling-close 而设置气泡没有)。
 * 任一气泡打开时广播; 其余实例收到他人广播即收起。同一时刻画布上至多展开一个参数气泡。
 */
const EVT = "canvas-settings-exclusive-open";

export function useExclusiveSettings(id: string, open: boolean, setOpen: (open: boolean) => void) {
    useEffect(() => {
        if (open) window.dispatchEvent(new CustomEvent(EVT, { detail: id }));
    }, [open, id]);

    useEffect(() => {
        const onClose = (event: Event) => {
            if ((event as CustomEvent).detail !== id) setOpen(false);
        };
        window.addEventListener(EVT, onClose);
        return () => window.removeEventListener(EVT, onClose);
    }, [id, setOpen]);
}
