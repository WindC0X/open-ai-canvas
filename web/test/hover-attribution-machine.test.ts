import { describe, expect, test } from "bun:test";
import { reducer, NODE_TOOLBAR_HOVER_SAFE_CLOSE_MS, EXIT_HIDDEN_MS } from "../src/pages/canvas/use-canvas-hover-attribution";
import { attributeHover, type NodeHit, type SupplyHit } from "../src/lib/canvas/hover-attribution";

const node = (id: string, stackRank = 0): NodeHit => ({ id, rect: { left: 0, top: 0, right: 100, bottom: 100 }, stackRank });
const supply = (nodeId: string, kind: SupplyHit["kind"], level: SupplyHit["level"] = "micro"): SupplyHit => ({
    nodeId, kind, rect: { left: 0, top: 100, right: 200, bottom: 132 }, level,
});

describe("hover 状态机 reducer", () => {
    test("idle + 归属节点 → active", () => {
        const next = reducer({ kind: "idle" }, { type: "attribute", nodeId: "a", surface: "node" });
        expect(next).toEqual({ kind: "active", ownerId: "a", surface: "node" });
    });

    test("active + 归属空 → leaving(启动 grace)", () => {
        const next = reducer({ kind: "active", ownerId: "a", surface: "node" }, { type: "attribute", nodeId: null, surface: "outside" });
        expect(next.kind).toBe("leaving");
        if (next.kind === "leaving") expect(typeof next.since).toBe("number");
    });

    test("graceExpired: leaving → exiting; exitDone: exiting → idle", () => {
        const leaving = reducer({ kind: "active", ownerId: "a", surface: "node" }, { type: "attribute", nodeId: null, surface: "outside" });
        const exiting = reducer(leaving, { type: "graceExpired" });
        expect(exiting.kind).toBe("exiting");
        expect(reducer(exiting, { type: "exitDone" }).kind).toBe("idle");
    });

    test("grace 期归属回到 owner → 重新 active(续期)", () => {
        const leaving = reducer({ kind: "active", ownerId: "a", surface: "node" }, { type: "attribute", nodeId: null, surface: "outside" });
        const back = reducer(leaving, { type: "attribute", nodeId: "a", surface: "toolbar" });
        expect(back).toEqual({ kind: "active", ownerId: "a", surface: "toolbar" });
    });

    test("归属换节点 → 直接换 owner(被压节点让位)", () => {
        const next = reducer({ kind: "active", ownerId: "a", surface: "node" }, { type: "attribute", nodeId: "b", surface: "node" });
        expect(next).toEqual({ kind: "active", ownerId: "b", surface: "node" });
    });

    test("grace 常量与 og 对齐", () => {
        expect(NODE_TOOLBAR_HOVER_SAFE_CLOSE_MS).toBe(380);
        expect(EXIT_HIDDEN_MS).toBe(160);
    });
});

describe("attributeHover 供给域(M2 级别过滤)", () => {
    test("micro composer 主体不进候选但 full 进", () => {
        const supplies = [supply("a", "composer", "micro")];
        expect(attributeHover([node("a")], supplies, 100, 120).surface).toBe("outside");
        expect(attributeHover([node("a")], [supply("a", "composer", "full")], 100, 120).surface).toBe("composer");
    });

    test("micro toolbar(44px 条)仍参与(它是可交互面)", () => {
        expect(attributeHover([node("a")], [supply("a", "toolbar", "micro")], 50, 120).surface).toBe("toolbar");
    });
});
