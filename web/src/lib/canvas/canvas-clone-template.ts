/**
 * F-09 三期 §2.2 —— 画布模板（节点图）机制。
 *
 * ★ 为什么需要这一层：
 *   用户原话（2026-10-06 07:00）「整个工作流/模板打包成一组（打成一组）」。
 *   此前画布没有模板实例化（F-05 未实现），用户要手工搭「2 图节点 + 生成节点 + 连线」。
 *   本模块把该节点图固化为**前端常量模板**，一次实例化为可整体操作的节点组。
 *
 * ★ 载体形式（控制线 2026-10-06 裁定 F-2）：
 *   用 Frame 作视觉容器（`canFrameContain` 已扩为容纳 Config），
 *   不新增 CanvasNodeType。可行性见 web/test/canvas-frame-config-containment.test.ts。
 *
 * ★ 数据位置（控制线裁定 T-1）：前端常量。三期只做最小模板集（单模板），
 *   无需后端 seed 的热更能力；架构方案 §3.2 允许前端常量 + 离线降级标注。
 *
 * ★ 与 linear-flow-cards 的分工：
 *   linear-flow-cards 是**表单式直线流程**（问答 → 提示词），不产生节点图；
 *   本模块是**画布内节点图实例化**（点卡 → 画布出现完整节点组）。
 *   两者互补：前者面向 /create 页的无画布用户，后者面向画布内用户。
 */

import type { CanvasNodeMetadata, CanvasNodeType as CanvasNodeTypeValue, Position } from "@/types/canvas";
import { CanvasNodeType } from "@/types/canvas";
import { DEFAULT_CLONE_RECREATE_PARAMS, type CloneRecreateParams } from "@/lib/canvas/clone-recreate-params";

/** 模板里的节点声明（不含 id —— 实例化时生成）。 */
export type CanvasTemplateNode = {
    /** 模板内局部 id（供连线引用，实例化时映射为真实 id）。 */
    key: string;
    type: CanvasNodeTypeValue;
    title: string;
    /** 相对模板原点的位置。 */
    position: Position;
    width: number;
    height: number;
    metadata: CanvasNodeMetadata;
    /** 是否放入模板容器（Frame）内。 */
    inContainer?: boolean;
};

/** 模板里的连线声明（用局部 key 引用）。 */
export type CanvasTemplateConnection = {
    fromKey: string;
    toKey: string;
};

/** 画布模板定义。 */
export type CanvasTemplate = {
    id: string;
    title: string;
    hint: string;
    /** 容器（Frame）尺寸；无容器时为 undefined。 */
    containerSize?: { width: number; height: number };
    nodes: CanvasTemplateNode[];
    connections: CanvasTemplateConnection[];
};

/**
 * F-09 爆款复刻模板 —— 最小模板集（三期）。
 *
 * 节点图（用户只需替换图片 → 点生成）：
 *   [产品图节点] ─┐
 *                 ├─→ [爆款复刻生成节点]
 *   [版式参考图] ─┘
 *
 * ★ 数组顺序契约：产品图节点在【前】（槽位「图片1」），版式参考图在【后】（「图片2」）——
 *   连线顺序即数组顺序，后端据此编号「图1＝产品图组 / 图2＝版式参考图组」。
 */
export const CLONE_RECREATE_TEMPLATE: CanvasTemplate = {
    id: "clone-recreate",
    title: "爆款复刻",
    hint: "上传产品图 + 版式参考图，一键复刻成片",
    containerSize: { width: 1080, height: 640 },
    nodes: [
        {
            key: "product",
            type: CanvasNodeType.Image,
            title: "产品图（替换这里）",
            position: { x: 40, y: 80 },
            width: 320,
            height: 400,
            metadata: {},
            inContainer: true,
        },
        {
            key: "layout",
            type: CanvasNodeType.Image,
            title: "版式参考图（替换这里）",
            position: { x: 40, y: 520 },
            width: 320,
            height: 400,
            metadata: {},
            inContainer: true,
        },
        {
            key: "generate",
            type: CanvasNodeType.Config,
            title: "爆款复刻",
            position: { x: 440, y: 300 },
            width: 420,
            height: 260,
            metadata: {
                // ★ 产品图张数 = 1（前 1 张 = 产品图，其余 = 版式参考图）。
                //   后端据此注入图片角色清单（prompt_image_role.go）。
                productImageCount: 1,
                // 参数面默认值（UI 回显用；实际提交值由用户选择覆盖）。
                cloneRecreateParams: { ...DEFAULT_CLONE_RECREATE_PARAMS },
            },
            inContainer: true,
        },
    ],
    // ★ 连线顺序 = 数组顺序：product 先于 layout ⇒ 产品图是「图片1」。
    connections: [
        { fromKey: "product", toKey: "generate" },
        { fromKey: "layout", toKey: "generate" },
    ],
};

/** 全部模板（三期只 1 个；后续批次在此追加）。 */
export const CANVAS_TEMPLATES: CanvasTemplate[] = [CLONE_RECREATE_TEMPLATE];

/** 按 id 查模板。 */
export function findCanvasTemplate(id: string): CanvasTemplate | undefined {
    return CANVAS_TEMPLATES.find((template) => template.id === id);
}

/**
 * 模板实例化 —— 把模板展开为「待落盘的节点与连线」。
 *
 * 纯函数：只做 key→id 映射与位置偏移，不触碰 store（由调用方 commit）。
 * 这样实例化结果可被结构断言直接测试（F-08 纯函数先例）。
 *
 * @param template 模板定义
 * @param origin 容器左上角在画布中的位置
 * @param makeId 生成真实节点 id（调用方注入，便于测试固定 id）
 */
export function instantiateCanvasTemplate(
    template: CanvasTemplate,
    origin: Position,
    makeId: (key: string) => string,
): {
    containerId: string | null;
    nodes: { id: string; type: CanvasNodeTypeValue; title: string; position: Position; width: number; height: number; metadata: CanvasNodeMetadata; parentId?: string }[];
    connections: { fromNodeId: string; toNodeId: string }[];
} {
    const containerId = template.containerSize ? makeId("__container__") : null;
    const idByKey = new Map<string, string>();
    for (const node of template.nodes) idByKey.set(node.key, makeId(node.key));

    const nodes = template.nodes.map((node) => {
        // 容器内节点用绝对坐标（画布按位置渲染，parentId 只标记归属）；
        // 与既有 applyFrameDrop 的语义一致（见 canvas-frame.ts:157-172）。
        const position = { x: origin.x + node.position.x, y: origin.y + node.position.y };
        return {
            id: idByKey.get(node.key)!,
            type: node.type,
            title: node.title,
            position,
            width: node.width,
            height: node.height,
            metadata: { ...node.metadata },
            ...(node.inContainer && containerId ? { parentId: containerId } : {}),
        };
    });

    const connections = template.connections.map((connection) => ({
        fromNodeId: idByKey.get(connection.fromKey)!,
        toNodeId: idByKey.get(connection.toKey)!,
    }));

    return { containerId, nodes, connections };
}

/**
 * 模板容器（Frame）的构造参数 —— 供调用方 createCanvasNode 使用。
 *
 * 返回 null 表示模板无容器（此时用户靠多选操作，见任务书 §2.2 的 F-3 退路）。
 */
export function templateContainerSpec(template: CanvasTemplate): { title: string; width: number; height: number; metadata: CanvasNodeMetadata } | null {
    if (!template.containerSize) return null;
    return {
        title: template.title,
        width: template.containerSize.width,
        height: template.containerSize.height,
        metadata: { frame: { collapsed: false, expandedWidth: template.containerSize.width, expandedHeight: template.containerSize.height } },
    };
}

/** 供 UI 展示的参数面默认值（模板实例化后写入生成节点 metadata）。 */
export function templateCloneParams(template: CanvasTemplate): CloneRecreateParams | undefined {
    const node = template.nodes.find((item) => item.type === CanvasNodeType.Config);
    return node?.metadata.cloneRecreateParams;
}
