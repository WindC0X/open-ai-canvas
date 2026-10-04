import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Undo2 } from "lucide-react";

import type { FloatingDockCommand } from "../src/components/ui/aceternity/floating-dock";
import { FloatingDock } from "../src/components/ui/aceternity/floating-dock";
import { NodePreviewMockup } from "../src/components/ui/tool-hover-card-mockups";
import { ToolHoverCardContent, ToolHoverCardMiniContent, TOOL_HOVER_CARD_WATCHDOG_MISS_MS, computeToolHoverCardPosition, createToolHoverCardExclusivity, initialToolHoverCardState, isToolHoverCardOpen, reduceToolHoverCardState, toolHoverCardPointerHit } from "../src/components/ui/tool-hover-card";
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
        // 合并口径（2026-10-04 sync #2）：上游把 project-character 从 resource 段移入 node 段
        // （label 添加角色卡→角色卡，tagline 随之调整）——断言跟随上游位置。
        expect(addNodeMenuCommands.find((command) => command.id === "project-character")?.hover?.tagline).toBe("添加角色卡");
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

    test("定位：上方优先 / 不足翻下 / 水平夹取（above·below 分支语义不变）", () => {
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

    test("几何边界（1024×768）：贴边触发不溢出视口、不遮挡触发器；上下皆不足时侧移出锚点列；无侧向空间退回纵向夹紧", () => {
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

        // 中部触发（上下都放不下）：水平侧移出锚点列（batch-12 hotfix；旧行为纵向夹紧会压住触发器）
        const middle = computeToolHoverCardPosition({ top: 300, bottom: 340, left: 500, width: 30 }, card, viewport);
        expect(middle.placement).toBe("side");
        expect(middle.left).toBe(500 - 8 - 408); // 取空间较大侧：左 492 > 右 486
        expect(middle.left + card.width).toBeLessThanOrEqual(500 - 8);

        // 视口装不下整卡：按 max-height 折算后侧移（上方不足、下方贴底）
        const tallCard = { width: 408, height: 600 };
        const cramped = computeToolHoverCardPosition({ top: 200, bottom: 240, left: 500, width: 30 }, tallCard, { width: 1024, height: 500 });
        expect(cramped.placement).toBe("side");
        expect(cramped.top).toBe(8);
        expect(cramped.top + Math.min(tallCard.height, 500 - 16)).toBe(492);

        // 窄视口横向：两侧都放不下 → 退回纵向夹紧兜底（宽卡夹到视口内）
        const narrow = computeToolHoverCardPosition({ top: 300, bottom: 340, left: 190, width: 30 }, card, { width: 400, height: 900 });
        expect(narrow.left).toBe(8);
        expect(narrow.left + Math.min(card.width, 400 - 16)).toBe(392);
    });

    test("hotfix（batch-12）：clamp 分支水平侧移——三视口参数化，卡矩形 ∩ 锚点矩形 = 空", () => {
        const card = { width: 408, height: 640 };
        const intersects = (
            pos: { top: number; left: number },
            anchor: { top: number; bottom: number; left: number; width: number },
            viewport: { width: number; height: number },
        ) => {
            const width = Math.min(card.width, viewport.width - 16);
            const height = Math.min(card.height, viewport.height - 16);
            const horizontalGap = pos.left >= anchor.left + anchor.width || pos.left + width <= anchor.left;
            const verticalGap = pos.top >= anchor.bottom || pos.top + height <= anchor.top;
            return !horizontalGap && !verticalGap;
        };

        // 下缘菜单锚点（create-menu 在下缘、上方放不下整卡）：短视口必须侧移且不相交
        for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
            const anchor = { top: viewport.height - 424, bottom: viewport.height - 388, left: 24, width: 296 };
            const pos = computeToolHoverCardPosition(anchor, card, viewport);
            expect(pos.placement).toBe("side");
            expect(intersects(pos, anchor, viewport)).toBe(false);
            expect(pos.left).toBeGreaterThanOrEqual(anchor.left + anchor.width + 8);
        }

        // 左缘 dock 锚点：左侧无空间 → 右侧侧移（三视口）
        for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 2320, height: 1287 }]) {
            const anchor = { top: 600, bottom: 636, left: 8, width: 48 };
            const pos = computeToolHoverCardPosition(anchor, card, viewport);
            expect(pos.placement).toBe("side");
            expect(intersects(pos, anchor, viewport)).toBe(false);
        }

        // 2320×1287 的同一菜单锚点：above 分支即可容纳（不变式仍要求不相交）
        const wide = { width: 2320, height: 1287 };
        const wideAnchor = { top: wide.height - 424, bottom: wide.height - 388, left: 24, width: 296 };
        const widePos = computeToolHoverCardPosition(wideAnchor, card, wide);
        expect(widePos.placement).toBe("above");
        expect(intersects(widePos, wideAnchor, wide)).toBe(false);
    });

    test("hotfix-2（batch-12 阻断）：expands 命令 active 态不出卡，收起后恢复", () => {
        const dockSource = readFileSync(new URL("../src/components/ui/aceternity/floating-dock.tsx", import.meta.url), "utf8");
        // 挂点层抑制：active（面板展开）期间 data 置空 → 不出卡；条件里保留 ? command.hoverCard : undefined 即收起即恢复。
        expect(dockSource).toContain("data: !showLabel && cardsEnabled && !command.disabled && !command.active ? command.hoverCard : undefined");
        expect(dockSource).toContain("hotfix-2");
        // 三个 expands 命令的 active 来源仍在（tool-add 为 batch-12 场景主角）。
        const mainTools = readFileSync(new URL("../src/lib/canvas/tool-registry/definitions/main-toolbar-tools.tsx", import.meta.url), "utf8");
        expect(mainTools).toContain("active: (ctx) => ctx.addPanelOpen");
        // 定位函数不动：本条抑制与 hotfix-1 侧移互补，不在同层。
        expect(dockSource).not.toContain("computeToolHoverCardPosition");
    });

    test("hotfix-3（滞留族）：suppression 状态归零——data 恢复后不得重开旧卡（源级 + 契约）", () => {
        const src = readFileSync(new URL("../src/components/ui/tool-hover-card.tsx", import.meta.url), "utf8");
        const resetBlock = src.slice(src.indexOf("if (enabled) return"), src.indexOf("setState(initialToolHoverCardState)"));
        expect(resetBlock).toContain("clearTimer(showTimerRef)");
        expect(resetBlock).toContain("clearTimer(leaveTimerRef)");
        expect(resetBlock).toContain("clearTimer(cardLeaveTimerRef)");
        expect(src).toContain("setState(initialToolHoverCardState)");
        // 契约：归零态不得视作 open；只有全新的 enter 才重新武装（鼠标下方 pointerenter 锁存的结构性拦截）。
        expect(isToolHoverCardOpen(initialToolHoverCardState)).toBe(false);
        expect(isToolHoverCardOpen(reduceToolHoverCardState(initialToolHoverCardState, "trigger-enter"))).toBe(true);
    });

    test("hotfix-3：create-menu 按钮鼠标点击不置 focused（:focus-visible 门控 + mousedown 清焦）", () => {
        const src = readFileSync(new URL("../src/components/canvas/canvas-create-menu.tsx", import.meta.url), "utf8");
        const gates = src.match(/if \(event\.currentTarget\.matches\(":focus-visible"\)\) hoverCard\.onFocus\(\);/g) ?? [];
        expect(gates.length).toBe(2); // ProjectCommandButton + GridCommandButton
        expect((src.match(/hoverCard\.onBlur\(\);/g) ?? []).length).toBeGreaterThanOrEqual(2);
        expect(src).not.toContain("onFocus={hoverCard.onFocus}");
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

describe("O-03 polish · 面板信息小卡（mini 变体）", () => {
    test("SSR：role=tooltip + mini 类名 + 标题/说明行", () => {
        const markup = renderToStaticMarkup(<ToolHoverCardMiniContent title="已应用：Amazon 主图" lines={["白底主图，品牌/文字向"]} />);
        expect(markup).toContain('role="tooltip"');
        expect(markup).toContain("tool-hover-card-mini");
        expect(markup).toContain("已应用：Amazon 主图");
        expect(markup).toContain("白底主图，品牌/文字向");
    });

    test("形态守卫：高于设置浮层 z1100、圆角 16、沿用四层卡底盘与动效", () => {
        const css = readFileSync(new URL("../src/components/ui/tool-hover-card.css", import.meta.url), "utf8");
        expect(css).toContain(".tool-hover-card-mini {");
        expect(css).toContain("z-index: var(--tool-hover-card-mini-z, 1150)");
        expect(css).toContain("border-radius: 16px");
        expect(css).toContain("max-width: min(280px, calc(100vw - 16px))");
    });
});

describe("rider-2：hover 卡看门狗（控制线 2026-09-28）", () => {
    test("模拟指针序列：连续未命中超宽限 → escape 关卡；命中卡/触发器即撤销", () => {
        const card = { left: 0, top: 0, right: 100, bottom: 100 };
        const anchor = { left: 200, top: 200, right: 240, bottom: 240 };
        // 状态机：hover 触发开卡
        let state = reduceToolHoverCardState(initialToolHoverCardState, "trigger-enter");
        expect(isToolHoverCardOpen(state)).toBe(true);
        // 命中：卡内 / 触发器内 → 不武装（看门狗撤销）
        expect(toolHoverCardPointerHit(50, 50, [card, anchor])).toBe(true);
        expect(toolHoverCardPointerHit(220, 220, [card, anchor])).toBe(true);
        // 未命中：远离两矩形 → 宽限到点派发 escape → 关卡
        expect(toolHoverCardPointerHit(450, 450, [card, anchor])).toBe(false);
        state = reduceToolHoverCardState(state, "escape");
        expect(isToolHoverCardOpen(state)).toBe(false);
        // dismissed 语义：指针仍悬停不重开，直到下一次 enter 重新武装
        expect(isToolHoverCardOpen(reduceToolHoverCardState(state, "card-enter"))).toBe(false);
        expect(isToolHoverCardOpen(reduceToolHoverCardState(state, "trigger-enter"))).toBe(true);
        expect(TOOL_HOVER_CARD_WATCHDOG_MISS_MS).toBe(300);
    });

    test("focused 态不受看门狗影响（WCAG 1.4.13）；清场接线齐备（源级）", () => {
        const focused = reduceToolHoverCardState(initialToolHoverCardState, "trigger-focus");
        expect(focused.focused).toBe(true);
        expect(isToolHoverCardOpen(focused)).toBe(true);
        const src = readFileSync(new URL("../src/components/ui/tool-hover-card.tsx", import.meta.url), "utf8");
        // 指针看门狗跳过条件含 focused；清场覆盖 visibilitychange / blur。
        expect(src).toContain("if (!open || state.focused) return;");
        expect(src).toContain('document.addEventListener("pointermove", onPointer, true)');
        expect(src).toContain('document.addEventListener("pointerdown", onPointer, true)');
        expect(src).toContain('document.addEventListener("visibilitychange", onVisibilityChange)');
        expect(src).toContain('window.addEventListener("blur", sweep)');
        // 卡引用贯通（看门狗读取卡片矩形的通道）
        expect(src).toContain("cardElRef");
    });
});
