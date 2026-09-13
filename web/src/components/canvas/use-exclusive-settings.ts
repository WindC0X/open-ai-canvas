import { useEffect, useRef } from "react";

/**
 * 生成参数气泡互斥(实证: 份数气泡与图像设置面板同开时互相遮挡, 模型菜单已有 sibling-close 而设置气泡没有)。
 * 任一气泡打开时广播; 其余实例收到他人广播即收起。同一时刻画布上至多展开一个参数气泡。
 */
const EVT = "canvas-settings-exclusive-open";

export function useExclusiveSettings(id: string, open: boolean, setOpen: (open: boolean) => void, supplyNodeId?: string) {
    useEffect(() => {
        if (open) window.dispatchEvent(new CustomEvent(EVT, { detail: { id, nodeId: supplyNodeId } }));
    }, [open, id, supplyNodeId]);

    // 关闭广播(project 层用 detail.nodeId 清"气泡开=钉 composer full"的边): open 翻 false 才发,
    // 首次挂载(open=false 初值)不发 — 用同步 ref 记录"曾打开过"判定真关闭。
    const everOpenedRef = useRef(false);
    useEffect(() => {
        if (open) {
            everOpenedRef.current = true;
            return;
        }
        if (!everOpenedRef.current) return;
        everOpenedRef.current = false;
        window.dispatchEvent(new CustomEvent(EVT + "-close", { detail: { id, nodeId: supplyNodeId } }));
    }, [open, id, supplyNodeId]);

    useEffect(() => {
        const onClose = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            const detailId = typeof detail === "object" && detail !== null ? detail.id : detail;
            if (detailId !== id) setOpen(false);
        };
        window.addEventListener(EVT, onClose);
        return () => window.removeEventListener(EVT, onClose);
    }, [id, setOpen]);
}
