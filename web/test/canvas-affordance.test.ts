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

    test("参数面板开启不再隐藏工具栏(2026-09-12: 面板与工具栏无几何重叠, settingsOpen guard 移除)", () => {
        // settingsOpen 省略(undefined) — guard 不生效, selected 仍 full
        expect(deriveToolbarAffordance({ ...base, dialogNodeId: NODE }, { nodeDragging: false, selectionBoxActive: false })).toBe("full");
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

    test("间隙保持: 指针在另一供给上时本供给保持 micro 不闪隐", () => {
        // hover 已离开节点, 但同节点另一供给仍被悬停 → 保持 micro(旧 220ms timer 的语义等价物)
        expect(deriveComposerAffordance({ ...base, hoveredNodeId: null, siblingHover: true }, cmGuards)).toBe("micro");
        expect(deriveToolbarAffordance({ ...base, hoveredNodeId: null, siblingHover: true }, tbGuards)).toBe("micro");
    });

    test("间隙保持与 selected 并存时 selected 优先", () => {
        expect(deriveComposerAffordance({ ...base, dialogNodeId: NODE, siblingHover: true }, cmGuards)).toBe("full");
    });

    test("参数设置气泡打开 → composer 钉 full(与 toolbarMenuOpenId 对称)", () => {
        const base = { nodeId: "n", hoveredNodeId: null, dialogNodeId: null, selfHover: false };
        expect(deriveComposerAffordance({ ...base, settingsBubbleOpen: true }, { selectionBoxActive: false })).toBe("full");
        // 指针回节点本体(归属 node)时气泡仍钉 full, 底栏不在气泡脚下变暗
        expect(deriveComposerAffordance({ ...base, hoveredNodeId: "n", settingsBubbleOpen: true }, { selectionBoxActive: false })).toBe("full");
        // guard 仍最高: 框选中气泡钉不住
        expect(deriveComposerAffordance({ ...base, settingsBubbleOpen: true }, { selectionBoxActive: true })).toBe("hidden");
    });
});
