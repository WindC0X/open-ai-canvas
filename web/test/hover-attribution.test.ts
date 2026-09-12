import { describe, expect, test } from "bun:test";
import { attributeHover, type NodeHit, type SupplyHit } from "../src/lib/canvas/hover-attribution";

const node = (id: string, left: number, top: number, right: number, bottom: number, stackRank = 0): NodeHit => ({
    id,
    rect: { left, top, right, bottom },
    stackRank,
});

const supply = (nodeId: string, kind: SupplyHit["kind"], left: number, top: number, right: number, bottom: number, level: SupplyHit["level"] = "micro"): SupplyHit => ({
    nodeId,
    kind,
    rect: { left, top, right, bottom },
    level,
});

describe("attributeHover", () => {
    test("空白画布归属 outside", () => {
        const r = attributeHover([node("a", 0, 0, 100, 100)], [], 200, 200);
        expect(r.nodeId).toBeNull();
        expect(r.surface).toBe("outside");
    });

    test("单节点本体命中", () => {
        const r = attributeHover([node("a", 0, 0, 100, 100)], [], 50, 50);
        expect(r).toEqual({ nodeId: "a", surface: "node" });
    });

    test("症状1: 重叠节点归属最上层(stackRank)", () => {
        // a 在左且被 b(上层)部分覆盖; 指针在重叠区 → 归 b
        const nodes = [node("a", 0, 0, 200, 100, 0), node("b", 100, 0, 300, 100, 1)];
        expect(attributeHover(nodes, [], 150, 50).nodeId).toBe("b");
        expect(attributeHover(nodes, [], 50, 50).nodeId).toBe("a");
    });

    test("规则①: 供给优先于节点本体(桥覆盖区归供给节点)", () => {
        const r = attributeHover([node("a", 0, 0, 100, 100), node("b", 0, 130, 100, 230, 1)], [supply("a", "bridge", 0, 100, 100, 132)], 50, 120);
        expect(r).toEqual({ nodeId: "a", surface: "bridge" });
    });

    test("M2: micro composer 面板本体不进候选(视觉空白不劫持)", () => {
        const r = attributeHover([node("a", 0, 0, 100, 100)], [supply("a", "composer", 0, 100, 300, 300, "micro")], 250, 200);
        expect(r.nodeId).toBeNull();
        expect(r.surface).toBe("outside");
    });

    test("full composer 面板本体参与归属", () => {
        const r = attributeHover([node("a", 0, 0, 100, 100)], [supply("a", "composer", 0, 100, 300, 300, "full")], 250, 200);
        expect(r).toEqual({ nodeId: "a", surface: "composer" });
    });

    test("hidden 供给不参与", () => {
        const r = attributeHover([node("a", 0, 0, 100, 100)], [supply("a", "toolbar", 0, -44, 300, -2, "hidden")], 200, -20);
        expect(r.nodeId).toBeNull();
    });

    test("感应带归属其节点", () => {
        const r = attributeHover([node("a", 0, 0, 100, 100)], [supply("a", "sense-band", 0, 100, 100, 112)], 50, 106);
        expect(r).toEqual({ nodeId: "a", surface: "sense-band" });
    });

    test("工具栏本体优先于桥/感应带", () => {
        const supplies = [supply("a", "bridge", 0, 100, 200, 132), supply("a", "toolbar", 0, -44, 200, -2), supply("a", "sense-band", 0, 100, 200, 112)];
        expect(attributeHover([node("a", 0, 0, 100, 100)], supplies, 150, 110).surface).toBe("sense-band");
        expect(attributeHover([node("a", 0, 0, 100, 100)], supplies, 150, -20).surface).toBe("toolbar");
    });

    test("双实例并存: selected 节点 full 面板 + hover 微供给互不抢占", () => {
        const nodes = [node("sel", 0, 0, 100, 100, 1), node("hov", 300, 0, 400, 100, 0)];
        const supplies = [supply("sel", "composer", 0, 100, 300, 300, "full"), supply("hov", "toolbar", 300, -44, 400, -2, "micro")];
        expect(attributeHover(nodes, supplies, 150, 200)).toEqual({ nodeId: "sel", surface: "composer" });
        expect(attributeHover(nodes, supplies, 350, -20)).toEqual({ nodeId: "hov", surface: "toolbar" });
    });

    test("供给越界区归属供给节点而非其下节点(现状语义, 宽度收窄前)", () => {
        // 窄节点 a 的宽桥盖到 b 本体上方 → 指针在桥上归 a(供给优先), 这是"宽度收窄"待办的行为基准
        const nodes = [node("a", 0, 0, 100, 100), node("b", 90, 130, 300, 230, 1)];
        const r = attributeHover(nodes, [supply("a", "bridge", 0, 100, 400, 132)], 250, 120);
        expect(r.nodeId).toBe("a");
    });
});
