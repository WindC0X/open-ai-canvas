/**
 * F-09 三期 §2.3 —— 空状态模板卡入口。
 *
 * ★ 为什么需要这一层：
 *   画布空状态此前只有「+ 添加第一项」（手动建节点）与自由画布的创建菜单，
 *   没有「点卡 → 出现完整节点组」的闭环。用户原话（2026-10-06 07:00）：
 *   「小白需要画布内的引导标记」「整个工作流/模板打包成一组」。
 *   本 hook 把 `CANVAS_TEMPLATES` 接到空状态卡面上。
 *
 * ★ 与既有空状态的关系（V1：真实接缝，不新建平行入口）：
 *   `CanvasFreeformEmptyState` 是既有空状态组件，本 hook 提供额外的卡面命令，
 *   由调用方传给该组件渲染 —— 不新增空状态类型，也不改动 `resolveCanvasEmptyStateKind`。
 *
 * ★ 兼容要求（任务书 §2.3）：既有 4 张 starter 卡的 prompt 行为不得回归。
 *   本 hook 只【新增】模板卡，不触碰 canvas-ecom-starters.ts / linear-flow-cards.ts。
 */

import { useCallback } from "react";
import { nanoid } from "nanoid";

import { CANVAS_TEMPLATES, instantiateCanvasTemplate, templateContainerSpec, type CanvasTemplate } from "@/lib/canvas/canvas-clone-template";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/types/canvas";

export type CanvasTemplateCard = {
    id: string;
    title: string;
    hint: string;
};

export type UseCanvasTemplateCardsOptions = {
    /** 当前画布节点（读引用，避免闭包捕获旧数组）。 */
    nodesRef: { current: CanvasNodeData[] };
    /** 当前画布连线。 */
    connectionsRef: { current: CanvasConnection[] };
    /** 提交节点。 */
    commitNodes: (nodes: CanvasNodeData[]) => void;
    /** 提交连线。 */
    commitConnections: (connections: CanvasConnection[]) => void;
    /** 选中新实例化的节点组（让用户可立即整体移动）。 */
    selectNodes: (ids: Set<string>) => void;
    /** 画布中心（模板落点）。 */
    getCanvasCenter: () => { x: number; y: number };
};

/** 空状态卡面数据（供 UI 渲染）。 */
export function canvasTemplateCards(): CanvasTemplateCard[] {
    return CANVAS_TEMPLATES.map((template) => ({ id: template.id, title: template.title, hint: template.hint }));
}

/**
 * 实例化模板并落到画布。
 *
 * 纯编排：节点/连线由 `instantiateCanvasTemplate`（纯函数）产生，
 * 本函数只负责生成真实 id、写 store、选中新组。
 */
export function useCanvasTemplateCards(options: UseCanvasTemplateCardsOptions) {
    const { nodesRef, connectionsRef, commitNodes, commitConnections, selectNodes, getCanvasCenter } = options;

    const instantiateTemplate = useCallback((templateId: string) => {
        const template = CANVAS_TEMPLATES.find((item) => item.id === templateId);
        if (!template) return;
        const center = getCanvasCenter();
        const spec = templateContainerSpec(template);
        const size = template.containerSize ?? { width: 0, height: 0 };
        // 模板落点：容器左上角使容器中心对齐画布中心。
        const origin = { x: Math.round(center.x - size.width / 2), y: Math.round(center.y - size.height / 2) };
        const instantiated = instantiateCanvasTemplate(template, origin, () => nanoid());

        const newNodes: CanvasNodeData[] = [];
        // 容器（Frame）先入数组 —— 与 createFolder 先例一致（父先于子提交）。
        if (instantiated.containerId && spec) {
            newNodes.push({
                id: instantiated.containerId,
                type: CanvasNodeType.Frame,
                title: spec.title,
                position: origin,
                width: spec.width,
                height: spec.height,
                metadata: { ...spec.metadata },
            });
        }
        for (const node of instantiated.nodes) {
            newNodes.push({
                id: node.id,
                type: node.type,
                title: node.title,
                position: node.position,
                width: node.width,
                height: node.height,
                metadata: { ...node.metadata },
                ...(node.parentId ? { parentId: node.parentId } : {}),
            });
        }
        const newConnections: CanvasConnection[] = instantiated.connections.map((connection) => ({
            id: nanoid(),
            fromNodeId: connection.fromNodeId,
            toNodeId: connection.toNodeId,
        }));

        commitNodes([...nodesRef.current, ...newNodes]);
        commitConnections([...connectionsRef.current, ...newConnections]);
        // ★ 选中整组（含容器）—— 用户可一次性移动/复制（任务书 §2.2 判据）。
        selectNodes(new Set(newNodes.map((node) => node.id)));
    }, [commitConnections, commitNodes, connectionsRef, getCanvasCenter, nodesRef, selectNodes]);

    return { cards: canvasTemplateCards(), instantiateTemplate };
}
