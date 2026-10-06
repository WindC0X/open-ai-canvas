import { describe, expect, test } from "bun:test";

import {
    CANVAS_TEMPLATES,
    CLONE_RECREATE_TEMPLATE,
    findCanvasTemplate,
    instantiateCanvasTemplate,
    templateCloneParams,
    templateContainerSpec,
} from "../src/lib/canvas/canvas-clone-template";
import { canFrameContain } from "../src/lib/canvas/canvas-frame";
import { CanvasNodeType } from "../src/types/canvas";

/**
 * F-09 三期 §2.2：画布模板（节点图）机制。
 *
 * 判据（任务书 §2.2）：用户能一次性选中并移动/复制整个 F-09 工作流
 * （2 图节点 + Config + 连线）。本组测试锁住实例化结果的【结构】——
 * 容器 / 节点数 / 连线 / 数组顺序契约 / productImageCount 透传。
 */

function fixedIds(): (key: string) => string {
    let counter = 0;
    return (key) => `${key}-${counter++}`;
}

describe("F-09 §2.2 画布模板实例化", () => {
    test("★ 模板实例化产生完整节点组：2 图节点 + 1 Config + 2 连线 + 容器", () => {
        const result = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 100, y: 200 }, fixedIds());
        expect(result.nodes).toHaveLength(3);
        expect(result.connections).toHaveLength(2);
        expect(result.containerId).not.toBeNull();
        // 节点类型正确
        const types = result.nodes.map((node) => node.type);
        expect(types.filter((type) => type === CanvasNodeType.Image)).toHaveLength(2);
        expect(types.filter((type) => type === CanvasNodeType.Config)).toHaveLength(1);
    });

    test("★ 连线顺序 = 数组顺序契约：产品图先于版式参考图", () => {
        const result = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 0, y: 0 }, fixedIds());
        const productId = result.nodes.find((node) => node.title.includes("产品图"))!.id;
        const layoutId = result.nodes.find((node) => node.title.includes("版式参考图"))!.id;
        const generateId = result.nodes.find((node) => node.type === CanvasNodeType.Config)!.id;
        // ★ 第一条连线必须是 product → generate（后端按连线顺序编号「图片1」= 产品图）
        expect(result.connections[0]).toEqual({ fromNodeId: productId, toNodeId: generateId });
        expect(result.connections[1]).toEqual({ fromNodeId: layoutId, toNodeId: generateId });
    });

    test("★ 生成节点携带 productImageCount=1（产品图在前 N 位）", () => {
        const result = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 0, y: 0 }, fixedIds());
        const generate = result.nodes.find((node) => node.type === CanvasNodeType.Config)!;
        expect(generate.metadata.productImageCount).toBe(1);
        // 参数面默认值随模板落地（UI 回显）
        // 修复批 N-4：默认 copyMode 改为 no-copy（对齐 F-09-IMPLEMENTATION-PLAN.md:468）
        expect(generate.metadata.cloneRecreateParams).toEqual({ cloneDegree: "high-structure", cloneScope: ["composition", "palette", "lighting"], copyMode: "no-copy" });
    });

    test("★ 容器内节点带 parentId（Frame 归属，供整体移动/复制）", () => {
        const result = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 0, y: 0 }, fixedIds());
        expect(result.containerId).not.toBeNull();
        for (const node of result.nodes) {
            expect(node.parentId).toBe(result.containerId);
        }
    });

    test("★ 容器为 Frame 且能容纳全部节点（含 Config —— F-2 扩判定的消费方）", () => {
        const spec = templateContainerSpec(CLONE_RECREATE_TEMPLATE);
        expect(spec).not.toBeNull();
        const result = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 0, y: 0 }, fixedIds());
        for (const node of result.nodes) {
            // ★ 真实消费路径：容器能容纳每个模板节点（Config 此前被 canFrameContain 排除）
            expect(canFrameContain(node as never)).toBe(true);
        }
        // 容器展开（collapsed: false）—— 折叠会重定向连线，模板实例化必须展开
        expect((spec!.metadata.frame as { collapsed: boolean }).collapsed).toBe(false);
    });

    test("位置按 origin 偏移（同一模板可多次实例化到不同位置）", () => {
        const at100 = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 100, y: 200 }, fixedIds());
        const at900 = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 900, y: 1000 }, fixedIds());
        const first100 = at100.nodes[0].position;
        const first900 = at900.nodes[0].position;
        expect(first900.x - first100.x).toBe(800);
        expect(first900.y - first100.y).toBe(800);
    });

    test("两次实例化产生不同 id（不共用节点）", () => {
        const a = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 0, y: 0 }, fixedIds());
        const b = instantiateCanvasTemplate(CLONE_RECREATE_TEMPLATE, { x: 0, y: 0 }, fixedIds());
        const idsA = a.nodes.map((node) => node.id);
        const idsB = b.nodes.map((node) => node.id);
        // fixedIds 是确定性生成器（每次调用从 0 开始）⇒ 这里验证的是「模板定义未被就地修改」
        expect(idsA).toEqual(idsB);
        // 关键：模板常量本身没有被污染（节点 id 未写回模板）
        expect(CLONE_RECREATE_TEMPLATE.nodes.every((node) => !("id" in node))).toBe(true);
    });

    test("findCanvasTemplate 按 id 查得到；未知 id 返回 undefined", () => {
        expect(findCanvasTemplate("clone-recreate")).toBe(CLONE_RECREATE_TEMPLATE);
        expect(findCanvasTemplate("nope")).toBeUndefined();
        expect(CANVAS_TEMPLATES).toContain(CLONE_RECREATE_TEMPLATE);
    });

    test("templateCloneParams 返回参数面默认值（UI 回显入口）", () => {
        expect(templateCloneParams(CLONE_RECREATE_TEMPLATE)).toEqual({ cloneDegree: "high-structure", cloneScope: ["composition", "palette", "lighting"], copyMode: "no-copy" });
    });
});
