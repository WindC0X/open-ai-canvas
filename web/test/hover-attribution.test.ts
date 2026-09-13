import { describe, expect, test } from "bun:test";
import { attributeHover, pointerInSupplyDomainExtension, type NodeHit, type SupplyHit } from "../src/lib/canvas/hover-attribution";

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
    stackRank: 0,
});

describe("pointerInSupplyDomainExtension", () => {
    test("命中链含模型菜单/flyout 类名 → 域内豁免", () => {
        expect(pointerInSupplyDomainExtension(["ant-popover", "canvas-model-picker-popover"], "canvas-model-picker-popover", "canvas-model-picker-flyout")).toBe(true);
        expect(pointerInSupplyDomainExtension(["canvas-model-picker-flyout", "canvas-model-picker-menu"], "canvas-model-picker-popover", "canvas-model-picker-flyout")).toBe(true);
    });
    test("无关浮层类名链 → 域外(遮挡门判空)", () => {
        expect(pointerInSupplyDomainExtension(["aceternity-floating-panel", "canvas-context-menu"], "canvas-model-picker-popover", "canvas-model-picker-flyout")).toBe(false);
        expect(pointerInSupplyDomainExtension(["ant-modal-mask"], "canvas-model-picker-popover", "canvas-model-picker-flyout")).toBe(false);
        expect(pointerInSupplyDomainExtension([], "canvas-model-picker-popover", "canvas-model-picker-flyout")).toBe(false);
    });
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

    test("micro composer 面板本体进候选(可见面, 直落主体即升级; 2026-09-13 修订原 M2)", () => {
        // 面板微态可见(0.45), 排除会让指针越过窄感应带时归属空、面板退场(升级大面积失败)
        const r = attributeHover([node("a", 0, 0, 100, 100)], [supply("a", "composer", 0, 100, 300, 300, "micro")], 250, 200);
        expect(r).toEqual({ nodeId: "a", surface: "composer" });
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
describe("重叠归属与真实绘制序(2026-09-13 回归)", () => {
    const rect = (l: number, t: number, r: number, b: number) => ({ left: l, top: t, right: r, bottom: b });
    const node = (id: string, rank: number) => ({ id, rect: rect(0, 0, 100, 100), stackRank: rank });

    test("数组序低但绘制序高的节点赢归属(遮挡跟随视觉)", () => {
        // A 数组序在前(视觉底层), B 绘制序在后(视觉上层): 归属必须给 B
        const a = node("a", 0);
        const b = node("b", 1);
        expect(attributeHover([a, b], [], 50, 50).nodeId).toBe("b");
        expect(attributeHover([b, a], [], 50, 50).nodeId).toBe("b");
    });

    test("绘制序高者边界外回落底层(合法视觉命中)", () => {
        const bottom = { id: "bottom", rect: rect(0, 0, 200, 100), stackRank: 0 };
        const top = { id: "top", rect: rect(0, 0, 100, 100), stackRank: 1 };
        expect(attributeHover([bottom, top], [], 150, 50).nodeId).toBe("bottom");
    });

    test("selected-full 与 hovered-micro 的 composer 重叠: 归属绘制序高的节点(2026-09-13 C2)", () => {
        // selected 实例 DOM 序在前, hover 实例在后; 若 hover 节点视觉上层, 归属必须给 hover 节点
        const a = { id: "a", rect: rect(0, 0, 400, 300), stackRank: 0 };
        const b = { id: "b", rect: rect(0, 0, 450, 350), stackRank: 1 };
        const supplies = [
            { nodeId: "a", kind: "composer" as const, rect: rect(0, 0, 400, 300), level: "full" as const, stackRank: 0 },
            { nodeId: "b", kind: "composer" as const, rect: rect(50, 50, 450, 350), level: "micro" as const, stackRank: 1 },
        ];
        expect(attributeHover([a, b], supplies, 200, 200).nodeId).toBe("b");
        // 反转 stackRank 后仍归 b: level 决胜(micro 意图面)高于 stackRank — full 常驻面不给邻居升级行程让位会截断升级
        const supplies2 = supplies.map((s0) => ({ ...s0, stackRank: s0.stackRank === 0 ? 1 : 0 }));
        expect(attributeHover([a, b], supplies2, 200, 200).nodeId).toBe("b");
    });

    test("selected-full composer 几何盖住 hover-micro composer 时, hover 节点赢(意图让路规则, 2026-09-13)", () => {
        // 真实场景: selected 节点 A 的 full 面板(绘制序最高)横在 hover 节点 B 的面板位置上方
        const nodeRect = (id: string) => ({ id, rect: rect(0, 0, 100, 100), stackRank: 0 });
        const supplies = [
            { nodeId: "a", kind: "composer" as const, rect: rect(0, 0, 855, 180), level: "full" as const, stackRank: 11 },
            { nodeId: "b", kind: "composer" as const, rect: rect(100, 0, 955, 180), level: "micro" as const, stackRank: 3 },
        ];
        // 指针在重叠区(仅 B micro 可达): 归 B, 保住升级路径
        expect(attributeHover([nodeRect("a"), nodeRect("b")], supplies, 700, 90).nodeId).toBe("b");
        // 指针在 A full 面板独占区: 归 A(操作不受影响)
        expect(attributeHover([nodeRect("a"), nodeRect("b")], supplies, 50, 90).nodeId).toBe("a");
    });
});
