import { describe, expect, test } from "bun:test";

import { deriveComposerAffordance, deriveToolbarAffordance } from "../src/lib/canvas/affordance";

const NODE = "node-1";
const base = { nodeId: NODE, hoveredNodeId: null as string | null, dialogNodeId: null as string | null, selfHover: false };
const tbGuards = { nodeDragging: false, selectionBoxActive: false, settingsOpen: false };
const cmGuards = { nodeDragging: false, selectionBoxActive: false };

describe("deriveToolbarAffordance", () => {
    test("idle: 无 hover 无 selected → hidden", () => {
        expect(deriveToolbarAffordance(base, tbGuards)).toBe("hidden");
    });

    test("hover 节点 → micro(双微)", () => {
        expect(deriveToolbarAffordance({ ...base, hoveredNodeId: NODE }, tbGuards)).toBe("micro");
    });

    test("hover 工具栏自身 → full", () => {
        expect(deriveToolbarAffordance({ ...base, hoveredNodeId: NODE, selfHover: true }, tbGuards)).toBe("full");
    });

    test("hover composer(另一供给) → 工具栏保持 micro", () => {
        // composer 的 selfHover 不影响工具栏级别; 工具栏未自悬停即保持 micro
        expect(deriveToolbarAffordance({ ...base, hoveredNodeId: NODE, selfHover: false }, tbGuards)).toBe("micro");
    });

    test("selected → full(常驻,鼠标离开节点也不收)", () => {
        expect(deriveToolbarAffordance({ ...base, dialogNodeId: NODE }, tbGuards)).toBe("full");
        expect(deriveToolbarAffordance({ ...base, dialogNodeId: NODE }, { ...tbGuards })).toBe("full");
    });

    test("dragging → hidden(即使 selected)", () => {
        expect(deriveToolbarAffordance({ ...base, dialogNodeId: NODE }, { ...tbGuards, nodeDragging: true })).toBe("hidden");
    });

    test("设置气泡开启 → 工具栏 hidden 让位", () => {
        expect(deriveToolbarAffordance({ ...base, dialogNodeId: NODE, hoveredNodeId: NODE }, { ...tbGuards, settingsOpen: true })).toBe("hidden");
    });

    test("框选中 → hidden", () => {
        expect(deriveToolbarAffordance({ ...base, hoveredNodeId: NODE }, { ...tbGuards, selectionBoxActive: true })).toBe("hidden");
    });
});

describe("deriveComposerAffordance", () => {
    test("idle → hidden; hover → micro; 自悬停 → full; selected → full", () => {
        expect(deriveComposerAffordance(base, cmGuards)).toBe("hidden");
        expect(deriveComposerAffordance({ ...base, hoveredNodeId: NODE }, cmGuards)).toBe("micro");
        expect(deriveComposerAffordance({ ...base, hoveredNodeId: NODE, selfHover: true }, cmGuards)).toBe("full");
        expect(deriveComposerAffordance({ ...base, dialogNodeId: NODE }, cmGuards)).toBe("full");
    });

    test("拖拽不抑制 composer(拖拽替换引用需要可投放)", () => {
        expect(deriveComposerAffordance({ ...base, dialogNodeId: NODE }, { ...cmGuards, nodeDragging: true })).toBe("full");
    });

    test("框选 → hidden; 设置气泡开启不影响 composer", () => {
        expect(deriveComposerAffordance({ ...base, dialogNodeId: NODE }, { ...cmGuards, selectionBoxActive: true })).toBe("hidden");
    });

    test("另一节点被选中时本节点 hover → 仍按 hover 语义 micro", () => {
        expect(deriveComposerAffordance({ ...base, hoveredNodeId: NODE, dialogNodeId: "other" }, cmGuards)).toBe("micro");
    });
});
