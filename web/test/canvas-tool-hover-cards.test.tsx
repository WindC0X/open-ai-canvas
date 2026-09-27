import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Undo2 } from "lucide-react";

import type { FloatingDockCommand } from "../src/components/ui/aceternity/floating-dock";
import { FloatingDock } from "../src/components/ui/aceternity/floating-dock";
import { ToolHoverCardContent, computeToolHoverCardPosition, initialToolHoverCardState, isToolHoverCardOpen, reduceToolHoverCardState } from "../src/components/ui/tool-hover-card";
import { CANVAS_SHORTCUTS } from "../src/lib/canvas/canvas-shortcuts";
import { resolveToolHoverCardData } from "../src/lib/canvas/tool-hover-card-data";
import { addNodeMenuCommands } from "../src/lib/canvas/tool-registry/definitions/add-node-menu-tools";
import { mainToolbarTools } from "../src/lib/canvas/tool-registry/definitions/main-toolbar-tools";
import { resolveToolbarEntries, type ToolContext, type ToolbarHandlers } from "../src/lib/canvas/tool-registry";

function createMainContext(): ToolContext {
    return {
        selectedCount: 0,
        selectedNodeTypes: new Set(),
        selectedVideoCount: 0,
        canvasTool: "box-select",
        workspaceMode: "professional",
        isProjectLinked: false,
        canUndo: false,
        canRedo: false,
        extractingVideoFrames: false,
        extractingAudio: false,
        trimmingVideos: false,
        mergingVideos: false,
        addPanelOpen: false,
        appearancePanelOpen: false,
        settingsPanelOpen: false,
        handlers: {} as ToolbarHandlers,
    };
}

describe("S2 hover 说明卡 · 数据覆盖", () => {
    test("主 Dock 全量工具均有 hover 文案（switch 组的段各自持有）", () => {
        for (const tool of mainToolbarTools) {
            if (tool.switchGroup) {
                for (const option of tool.switchGroup.options) {
                    expect(option.hover?.description.length ?? 0).toBeGreaterThan(0);
                }
            } else {
                expect(tool.hover?.description.length ?? 0).toBeGreaterThan(0);
            }
        }
        expect(mainToolbarTools.find((tool) => tool.id === "tool-undo")?.hover?.description).toBe("撤销上一步操作");
        expect(mainToolbarTools.find((tool) => tool.id === "tool-delete")?.hover?.description).toBe("删除当前选中的节点，可撤销");
        expect(mainToolbarTools.find((tool) => tool.id === "tool-clear")?.hover?.description).toContain("清空前请确认");
    });

    test("添加节点菜单全量命令均有 hover 文案", () => {
        for (const command of addNodeMenuCommands) {
            expect(command.hover?.description.length ?? 0).toBeGreaterThan(0);
        }
        expect(addNodeMenuCommands.find((command) => command.id === "style")?.hover?.description).toBe("为项目选择统一的画面风格");
        expect(addNodeMenuCommands.find((command) => command.id === "folder")?.hover?.description).toBe("用文件夹整理、收纳画布节点");
    });

    test("快捷键只引用 CANVAS_SHORTCUTS 已注册 id，且解析为实时键位", () => {
        const declaredIds = [
            ...mainToolbarTools.flatMap((tool) => tool.hover?.shortcuts ?? []),
            ...mainToolbarTools.flatMap((tool) => tool.switchGroup?.options.flatMap((option) => option.hover?.shortcuts ?? []) ?? []),
            ...addNodeMenuCommands.flatMap((command) => command.hover?.shortcuts ?? []),
        ];
        const registeredIds = new Set(CANVAS_SHORTCUTS.map((shortcut) => shortcut.id));
        for (const id of declaredIds) expect(registeredIds.has(id)).toBe(true);

        const undoData = resolveToolHoverCardData(mainToolbarTools.find((tool) => tool.id === "tool-undo")?.hover);
        expect(undoData?.shortcutKeys).toEqual([[CANVAS_SHORTCUTS.find((shortcut) => shortcut.id === "undo")!.keys[0][0], "Z"]]);
        const redoData = resolveToolHoverCardData(mainToolbarTools.find((tool) => tool.id === "tool-redo")?.hover);
        expect(redoData?.shortcutKeys?.length).toBe(2);
        expect(redoData?.shortcutKeys?.[1]?.at(-1)).toBe("Y");
        const deleteData = resolveToolHoverCardData(mainToolbarTools.find((tool) => tool.id === "tool-delete")?.hover);
        expect(deleteData?.shortcutKeys).toEqual([["Delete"], ["Backspace"]]);
        // 未知 id 直接跳过，不产生徽章。
        expect(resolveToolHoverCardData({ description: "仅文案", shortcuts: ["not-registered"] })?.shortcutKeys).toBeUndefined();
    });

    test("preview 资产盘点：声明即存在（本批 1/26，B1 有意不配）", () => {
        const previews = [
            ...mainToolbarTools.flatMap((tool) => (tool.hover?.preview ? [tool.hover.preview] : [])),
            ...mainToolbarTools.flatMap((tool) => tool.switchGroup?.options.flatMap((option) => (option.hover?.preview ? [option.hover.preview] : [])) ?? []),
            ...addNodeMenuCommands.flatMap((command) => (command.hover?.preview ? [command.hover.preview] : [])),
        ];
        expect(previews).toEqual(["/images/canvas/folder-default-cover.png"]);
        for (const preview of previews) {
            expect(existsSync(new URL(`../public${preview}`, import.meta.url))).toBe(true);
        }
    });
});

describe("S2 hover 说明卡 · 注册表解析与接入", () => {
    test("dock 条目带上 hoverCard（switch 选项按段、命令按数据）", () => {
        const entries = resolveToolbarEntries("main", createMainContext(), null);
        const modeSwitch = entries.find((entry) => entry.kind === "switch" && entry.id === "tool-canvas-mode");
        expect(modeSwitch?.kind === "switch" ? modeSwitch.options[0].hoverCard?.description : undefined).toBe("框选批量选择节点");
        expect(modeSwitch?.kind === "switch" ? modeSwitch.options[1].hoverCard?.description : undefined).toBe("拖动平移画布视图");

        const commandEntries = entries.filter((entry): entry is FloatingDockCommand => entry.kind !== "switch" && entry.kind !== "separator");
        const undo = commandEntries.find((entry) => entry.id === "tool-undo");
        expect(undo?.hoverCard?.shortcutKeys?.[0]?.at(-1)).toBe("Z");
        const clear = commandEntries.find((entry) => entry.id === "tool-clear");
        expect(clear?.hoverCard?.description).toContain("清空前请确认");
    });

    test("默认关闭态不渲染卡片；无 hover 数据的 dock 保持原样", () => {
        const withoutData = renderToStaticMarkup(<FloatingDock items={[{ id: "probe", label: "操作", icon: <span>+</span> }]} />);
        expect(withoutData).not.toContain("tool-hover-card");

        const withData = renderToStaticMarkup(<FloatingDock items={[{ id: "probe", label: "操作", icon: <span>+</span>, hoverCard: { description: "测试文案" } }]} />);
        expect(withData).not.toContain('role="tooltip"');
    });

    test("两处挂点与数据管道均已接线（静态守卫）", () => {
        const dockSource = readFileSync(new URL("../src/components/ui/aceternity/floating-dock.tsx", import.meta.url), "utf8");
        expect(dockSource).toContain("useToolHoverCard");
        expect(dockSource).toContain("cardsEnabled");
        expect(dockSource).toContain("hoverCard.card");

        const menuSource = readFileSync(new URL("../src/components/canvas/canvas-create-menu.tsx", import.meta.url), "utf8");
        expect(menuSource).toContain("useToolHoverCard");
        expect(menuSource).toContain("hoverCard.card");

        const registrySource = readFileSync(new URL("../src/lib/canvas/tool-registry/tool-registry.ts", import.meta.url), "utf8");
        expect(registrySource).toContain("resolveToolHoverCardData");
    });
});

describe("S2 hover 说明卡 · a11y（WCAG 1.4.13 三件套）", () => {
    test("键盘聚焦可触发；指针可移入卡片不闪断；Esc 关闭且可重新武装", () => {
        const focused = reduceToolHoverCardState(initialToolHoverCardState, "trigger-focus");
        expect(isToolHoverCardOpen(focused)).toBe(true);

        const hoverThenInto = reduceToolHoverCardState(reduceToolHoverCardState(initialToolHoverCardState, "trigger-enter"), "card-enter");
        const pointerOnCard = reduceToolHoverCardState(hoverThenInto, "trigger-leave");
        expect(isToolHoverCardOpen(pointerOnCard)).toBe(true);

        const dismissed = reduceToolHoverCardState(pointerOnCard, "escape");
        expect(isToolHoverCardOpen(dismissed)).toBe(false);
        expect(isToolHoverCardOpen(reduceToolHoverCardState(dismissed, "trigger-focus"))).toBe(true);
    });

    test("Esc 由卡片自身挂在 document 捕获阶段；reduced-motion 关停动画", () => {
        const cardSource = readFileSync(new URL("../src/components/ui/tool-hover-card.tsx", import.meta.url), "utf8");
        expect(cardSource).toContain('event.key !== "Escape"');
        expect(cardSource).toContain('document.addEventListener("keydown"');
        expect(cardSource).toContain("onPointerEnter={onCardEnter}");
        const css = readFileSync(new URL("../src/components/ui/tool-hover-card.css", import.meta.url), "utf8");
        expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    });

    test("卡片内容含角色/文案/键帽（SSR 结构）", () => {
        const undoData = resolveToolHoverCardData({ description: "撤销上一步操作", shortcuts: ["undo"] });
        if (!undoData) throw new Error("undo hover data missing");
        const html = renderToStaticMarkup(<ToolHoverCardContent data={undoData} label="撤销" icon={<Undo2 />} />);
        expect(html).toContain('role="tooltip"');
        expect(html).toContain("撤销上一步操作");
        for (const key of CANVAS_SHORTCUTS.find((shortcut) => shortcut.id === "undo")!.keys[0]) {
            expect(html).toContain(`>${key}<`);
        }
    });

    test("定位：触发器上方优先、空间不足翻转下方、水平夹取、不遮挡触发器", () => {
        const card = { width: 200, height: 100 };
        const viewport = { width: 1440, height: 900 };

        const above = computeToolHoverCardPosition({ top: 300, bottom: 320, left: 100, width: 30 }, card, viewport);
        expect(above.placement).toBe("above");
        expect(above.top + card.height).toBeLessThanOrEqual(300 - 8);

        const below = computeToolHoverCardPosition({ top: 10, bottom: 30, left: 100, width: 30 }, card, viewport);
        expect(below.placement).toBe("below");
        expect(below.top).toBe(38);

        const clampedLeft = computeToolHoverCardPosition({ top: 300, bottom: 320, left: 0, width: 30 }, card, viewport);
        expect(clampedLeft.left).toBe(8);
        const clampedRight = computeToolHoverCardPosition({ top: 300, bottom: 320, left: 1400, width: 30 }, card, viewport);
        expect(clampedRight.left).toBe(1440 - 8 - card.width);
    });
});
