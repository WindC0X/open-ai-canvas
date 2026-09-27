import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Undo2 } from "lucide-react";

import type { FloatingDockCommand } from "../src/components/ui/aceternity/floating-dock";
import { FloatingDock } from "../src/components/ui/aceternity/floating-dock";
import { NodePreviewMockup } from "../src/components/ui/tool-hover-card-mockups";
import { ToolHoverCardContent, computeToolHoverCardPosition, createToolHoverCardExclusivity, initialToolHoverCardState, isToolHoverCardOpen, reduceToolHoverCardState } from "../src/components/ui/tool-hover-card";
import { CANVAS_SHORTCUTS } from "../src/lib/canvas/canvas-shortcuts";
import { NODE_PREVIEW_KINDS, resolveToolHoverCardData } from "../src/lib/canvas/tool-hover-card-data";
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

/** 收集两表面全部 hover 定义（switch 组的段各自一条） */
function collectHoverDefs() {
    return [
        ...mainToolbarTools.flatMap((tool) => (tool.switchGroup ? tool.switchGroup.options.map((option) => ({ id: option.id, label: option.label, hover: option.hover })) : [{ id: tool.id, label: typeof tool.label === "string" ? tool.label : tool.id, hover: tool.hover }])),
        ...addNodeMenuCommands.map((command) => ({ id: command.id, label: command.label, hover: command.hover })),
    ];
}

describe("S2.1 hover 说明卡 · 三段式数据覆盖", () => {
    test("主 Dock 全量工具均有 tagline + 长句（switch 组的段各自持有）", () => {
        for (const tool of mainToolbarTools) {
            if (tool.switchGroup) {
                for (const option of tool.switchGroup.options) {
                    expect(option.hover?.tagline.length ?? 0).toBeGreaterThan(0);
                    expect(option.hover?.description.length ?? 0).toBeGreaterThan(0);
                }
            } else {
                expect(tool.hover?.tagline.length ?? 0).toBeGreaterThan(0);
                expect(tool.hover?.description.length ?? 0).toBeGreaterThan(0);
            }
        }
        expect(mainToolbarTools.find((tool) => tool.id === "tool-undo")?.hover?.tagline).toBe("撤销上一步操作");
        expect(mainToolbarTools.find((tool) => tool.id === "tool-undo")?.hover?.description).toContain("画布设置");
        expect(mainToolbarTools.find((tool) => tool.id === "tool-delete")?.hover?.tagline).toBe("移除所选内容");
        expect(mainToolbarTools.find((tool) => tool.id === "tool-delete")?.hover?.description).toContain("会话内撤销");
        expect(mainToolbarTools.find((tool) => tool.id === "tool-clear")?.hover?.description).toContain("清空前请确认");
    });

    test("添加节点菜单全量命令均有 tagline + 长句；必改三处已落", () => {
        for (const command of addNodeMenuCommands) {
            expect(command.hover?.tagline.length ?? 0).toBeGreaterThan(0);
            expect(command.hover?.description.length ?? 0).toBeGreaterThan(0);
        }
        expect(addNodeMenuCommands.find((command) => command.id === "style")?.hover?.tagline).toBe("统一画面风格");
        expect(addNodeMenuCommands.find((command) => command.id === "folder")?.hover?.tagline).toBe("用文件夹收纳");
        expect(addNodeMenuCommands.find((command) => command.id === "project-character")?.hover?.tagline).toBe("复用角色设定");
        expect(addNodeMenuCommands.find((command) => command.id === "assets")?.hover?.tagline).toBe("选取素材插入画布");
    });

    test("tagline ≤10 字、与名称不同文（防同文/防长度跳变）", () => {
        for (const def of collectHoverDefs()) {
            expect(def.hover?.tagline.length ?? 0).toBeLessThanOrEqual(10);
            expect(def.hover?.tagline).not.toBe(def.label);
        }
    });

    test("快捷键只引用 CANVAS_SHORTCUTS 已注册 id，且解析为实时键位", () => {
        const declaredIds = [
            ...mainToolbarTools.flatMap((tool) => tool.hover?.shortcuts ?? []),
            ...mainToolbarTools.flatMap((tool) => tool.switchGroup?.options.flatMap((option) => option.hover?.shortcuts ?? []) ?? []),
            ...addNodeMenuCommands.flatMap((command) => command.hover?.shortcuts ?? []),
        ];
        const registeredIds = new Set(CANVAS_SHORTCUTS.map((shortcut) => shortcut.id));
        for (const id of declaredIds) expect(registeredIds.has(id)).toBe(true);

        const undoData = resolveToolHoverCardData(mainToolbarTools.find((tool) => tool.id === "tool-undo")?.hover, "tool-undo");
        expect(undoData?.shortcutKeys).toEqual([[CANVAS_SHORTCUTS.find((shortcut) => shortcut.id === "undo")!.keys[0][0], "Z"]]);
        const redoData = resolveToolHoverCardData(mainToolbarTools.find((tool) => tool.id === "tool-redo")?.hover, "tool-redo");
        expect(redoData?.shortcutKeys?.length).toBe(2);
        expect(redoData?.shortcutKeys?.[1]?.at(-1)).toBe("Y");
        const deleteData = resolveToolHoverCardData(mainToolbarTools.find((tool) => tool.id === "tool-delete")?.hover, "tool-delete");
        expect(deleteData?.shortcutKeys).toEqual([["Delete"], ["Backspace"]]);
        // 未知 id 直接跳过，不产生徽章。
        expect(resolveToolHoverCardData({ tagline: "仅文案", description: "仅文案", shortcuts: ["not-registered"] })?.shortcutKeys).toBeUndefined();
    });

    test("预览模式分布：工具类大图标 / 节点类 11 项全量 mockup（零位图）", () => {
        const menuResolved = addNodeMenuCommands.map((command) => ({ id: command.id, data: resolveToolHoverCardData(command.hover, command.id) }));
        const nodeItems = menuResolved.filter((item) => item.data?.preview.mode === "node");
        expect(nodeItems.map((item) => item.id).sort()).toEqual([...NODE_PREVIEW_KINDS].sort());
        expect(nodeItems.length).toBe(11);
        const iconItems = menuResolved.filter((item) => item.data?.preview.mode === "icon");
        expect(iconItems.map((item) => item.id).sort()).toEqual(["assets", "project-character", "style", "upload", "workflow"]);

        for (const tool of mainToolbarTools) {
            if (tool.switchGroup) {
                for (const option of tool.switchGroup.options) {
                    expect(resolveToolHoverCardData(option.hover, option.id)?.preview.mode).toBe("icon");
                }
            } else {
                expect(resolveToolHoverCardData(tool.hover, tool.id)?.preview.mode).toBe("icon");
            }
        }
        // 声明 node 但 id 不在 11 型白名单时安全降级为图标模式。
        expect(resolveToolHoverCardData({ tagline: "t", description: "d", preview: "node" }, "tool-undo")?.preview.mode).toBe("icon");
    });
});

describe("S2.1 hover 说明卡 · 注册表解析与接入", () => {
    test("dock 条目带上 hoverCard（switch 选项按段、命令按数据）", () => {
        const entries = resolveToolbarEntries("main", createMainContext(), null);
        const modeSwitch = entries.find((entry) => entry.kind === "switch" && entry.id === "tool-canvas-mode");
        expect(modeSwitch?.kind === "switch" ? modeSwitch.options[0].hoverCard?.tagline : undefined).toBe("框选批量选择节点");
        expect(modeSwitch?.kind === "switch" ? modeSwitch.options[1].hoverCard?.tagline : undefined).toBe("拖动平移画布视图");

        const commandEntries = entries.filter((entry): entry is FloatingDockCommand => entry.kind !== "switch" && entry.kind !== "separator");
        const undo = commandEntries.find((entry) => entry.id === "tool-undo");
        expect(undo?.hoverCard?.shortcutKeys?.[0]?.at(-1)).toBe("Z");
        const clear = commandEntries.find((entry) => entry.id === "tool-clear");
        expect(clear?.hoverCard?.description).toContain("清空前请确认");
    });

    test("默认关闭态不渲染卡片；无 hover 数据的 dock 保持原样", () => {
        const withoutData = renderToStaticMarkup(<FloatingDock items={[{ id: "probe", label: "操作", icon: <span>+</span> }]} />);
        expect(withoutData).not.toContain("tool-hover-card");

        const withData = renderToStaticMarkup(<FloatingDock items={[{ id: "probe", label: "操作", icon: <span>+</span>, hoverCard: { tagline: "测试", description: "测试文案", preview: { mode: "icon" } } }]} />);
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

describe("S2.1 hover 说明卡 · 四层结构与形态守卫", () => {
    test("SSR 四层结构：标题 + tagline / 长句 / 预览（工具类大图标） / footer 句式中文化", () => {
        const data = resolveToolHoverCardData(mainToolbarTools.find((tool) => tool.id === "tool-undo")?.hover, "tool-undo");
        if (!data) throw new Error("undo hover data missing");
        const html = renderToStaticMarkup(<ToolHoverCardContent data={data} label="撤销" icon={<Undo2 />} />);
        expect(html).toContain('role="tooltip"');
        expect(html).toContain('data-preview-mode="icon"');
        expect(html).toContain("tool-hover-card-title");
        expect(html).toContain("撤销");
        expect(html).toContain("撤销上一步操作");
        expect(html).toContain("回退最近一步编辑");
        expect(html).toContain("tool-hover-card-preview-icon");
        // footer：按 + kbd 徽章 + 引导语，且非英文直译
        expect(html).toContain("按");
        expect(html).toContain("tool-hover-card-kbd");
        for (const key of CANVAS_SHORTCUTS.find((shortcut) => shortcut.id === "undo")!.keys[0]) {
            expect(html).toContain(`>${key}<`);
        }
        expect(html).not.toContain("Press");
    });

    test("SSR 节点类预览：小标题 + SVG mockup（无位图，无 footer）", () => {
        const data = resolveToolHoverCardData(addNodeMenuCommands.find((command) => command.id === "image")?.hover, "image");
        if (!data) throw new Error("image hover data missing");
        const html = renderToStaticMarkup(<ToolHoverCardContent data={data} label="图片" icon={<span />} />);
        expect(html).toContain('data-preview-mode="node"');
        expect(html).toContain("节点预览");
        expect(html).toContain('data-mockup-kind="image"');
        expect(html).toContain("<svg");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("tool-hover-card-kbd");
    });

    test("11 种 mockup 全量可渲染且带类型标识", () => {
        for (const kind of NODE_PREVIEW_KINDS) {
            const html = renderToStaticMarkup(<NodePreviewMockup kind={kind} />);
            expect(html).toContain(`data-mockup-kind="${kind}"`);
            expect(html).toContain("<svg");
        }
        expect(renderToStaticMarkup(<NodePreviewMockup kind="image" />)).toContain("山间日落");
        expect(renderToStaticMarkup(<NodePreviewMockup kind="audio" />)).toContain("主题配乐");
    });

    test("形态守卫：毛玻璃/圆角/边线/阴影/#949494/纵向兜底（静态 CSS 断言防回退）", () => {
        const css = readFileSync(new URL("../src/components/ui/tool-hover-card.css", import.meta.url), "utf8");
        for (const needle of [
            "position: fixed",
            "backdrop-filter: blur(16px)",
            "border-radius: 24px",
            "rgba(32, 32, 32, 0.9)",
            "#949494",
            "#b4b4b4",
            "rgba(255, 255, 255, 0.106)",
            "rgba(255, 255, 255, 0.05)",
            "rgba(0, 0, 0, 0.5)",
            "width: min(408px, calc(100vw - 16px))",
            "max-height: calc(100vh - 16px)",
            "height: 229px",
            "min-height: 2.8em",
            "rgb(168, 168, 168)",
            "height: 41px",
        ]) {
            expect(css).toContain(needle);
        }
        const cardSource = readFileSync(new URL("../src/components/ui/tool-hover-card.tsx", import.meta.url), "utf8");
        expect(cardSource).toContain("data-preview-mode");
        expect(cardSource).toContain("data-entering");
        expect(cardSource).toContain("will-change");
        expect(cardSource).toContain("offsetWidth");
        expect(css).toContain("@media (prefers-reduced-motion: reduce)");
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

    test("Esc 由卡片自身挂在 document 捕获阶段；指针入卡绑定 onPointerEnter", () => {
        const cardSource = readFileSync(new URL("../src/components/ui/tool-hover-card.tsx", import.meta.url), "utf8");
        expect(cardSource).toContain('event.key !== "Escape"');
        expect(cardSource).toContain('document.addEventListener("keydown"');
        expect(cardSource).toContain("onPointerEnter={onCardEnter}");
    });

    test("定位：上方优先 / 不足翻下 / 翻下仍出界则上移夹紧 / 水平夹取", () => {
        const card = { width: 408, height: 430 };
        const viewport = { width: 1440, height: 900 };

        const above = computeToolHoverCardPosition({ top: 600, bottom: 630, left: 300, width: 30 }, card, viewport);
        expect(above.placement).toBe("above");
        expect(above.top).toBe(600 - 8 - 430);
        expect(above.top + card.height).toBeLessThanOrEqual(600 - 8);

        const below = computeToolHoverCardPosition({ top: 100, bottom: 130, left: 300, width: 30 }, card, viewport);
        expect(below.placement).toBe("below");
        expect(below.top).toBe(138);

        const clampedLeft = computeToolHoverCardPosition({ top: 600, bottom: 630, left: 0, width: 30 }, card, viewport);
        expect(clampedLeft.left).toBe(8);
        const clampedRight = computeToolHoverCardPosition({ top: 600, bottom: 630, left: 1400, width: 30 }, card, viewport);
        expect(clampedRight.left).toBe(1440 - 8 - 408);
    });

    test("几何边界（1024×768）：贴边触发不溢出视口、不遮挡触发器；横向窄视口夹紧", () => {
        const card = { width: 408, height: 430 };
        const viewport = { width: 1024, height: 768 };

        // 底边触发（主 Dock 场景）：上方放得下 → 卡底不压触发器
        const bottomEdge = computeToolHoverCardPosition({ top: 736, bottom: 772, left: 500, width: 30 }, card, viewport);
        expect(bottomEdge.placement).toBe("above");
        expect(bottomEdge.top).toBeGreaterThanOrEqual(8);
        expect(bottomEdge.top + card.height).toBeLessThanOrEqual(736);

        // 顶边触发：翻下且不压触发器
        const topEdge = computeToolHoverCardPosition({ top: 8, bottom: 44, left: 500, width: 30 }, card, viewport);
        expect(topEdge.placement).toBe("below");
        expect(topEdge.top).toBeGreaterThanOrEqual(44);
        expect(topEdge.top + card.height).toBeLessThanOrEqual(768 - 8);

        // 中部触发（上下都放不下）：整体上移夹进视口
        const middle = computeToolHoverCardPosition({ top: 300, bottom: 340, left: 500, width: 30 }, card, viewport);
        expect(middle.top).toBe(768 - 8 - 430);
        expect(middle.top + card.height).toBe(760);

        // 视口装不下整卡：按 max-height 折算后贴顶
        const tallCard = { width: 408, height: 600 };
        const cramped = computeToolHoverCardPosition({ top: 200, bottom: 240, left: 500, width: 30 }, tallCard, { width: 1024, height: 500 });
        expect(cramped.top).toBe(8);
        expect(cramped.top + Math.min(tallCard.height, 500 - 16)).toBe(492);

        // 窄视口横向：宽卡夹到视口内
        const narrow = computeToolHoverCardPosition({ top: 300, bottom: 340, left: 190, width: 30 }, card, { width: 400, height: 900 });
        expect(narrow.left).toBe(8);
        expect(narrow.left + Math.min(card.width, 400 - 16)).toBe(392);
    });
});

describe("S2.1 hover 卡 · 全局单卡不变式（节流环境双卡残留加固）", () => {
    test("后开的卡强制关闭先开的卡；幂等 / 不误杀", () => {
        const registry = createToolHoverCardExclusivity();
        const calls: string[] = [];
        const a = () => calls.push("a");
        const b = () => calls.push("b");

        registry.request(a);
        expect(calls).toEqual([]);
        registry.request(b);
        expect(calls).toEqual(["a"]); // 后开者强制关闭先开者
        registry.request(b);
        expect(calls).toEqual(["a"]); // 同 closer 重复 request 幂等
        registry.release(a);
        registry.request(b);
        expect(calls).toEqual(["a"]); // 非 active 释放不误杀
        registry.request(a);
        expect(calls).toEqual(["a", "b"]); // 换回 a 时关掉 b
        registry.release(a);
        registry.request(b);
        expect(calls).toEqual(["a", "b"]); // active 已空，无旧卡可关
    });

    test("hook 侧接入不变式（静态守卫）", () => {
        const source = readFileSync(new URL("../src/components/ui/tool-hover-card.tsx", import.meta.url), "utf8");
        expect(source).toContain("toolHoverCardExclusivity.request");
        expect(source).toContain("toolHoverCardExclusivity.release");
    });
});
