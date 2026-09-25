import { expect, test } from "bun:test";

// 2026-09-25 用户检验批守卫：composer 底栏浅色 ghost / 智能引用玻璃收口 / 份数气泡主题源 / 视口外工具隐藏。
// 均为源码级锁定（样式与行为契约在源文件上可复核），避免后续合merge再回退。

test("浅色 composer 底栏触发按钮保持 ghost（与暗色语义对齐）", async () => {
    const globals = await Bun.file(new URL("../src/styles/globals.css", import.meta.url)).text();
    expect(globals).toContain("html:not(.dark) .canvas-node-composer-model .canvas-composer-model-picker.canvas-composer-model-picker");
    expect(globals).toContain("html:not(.dark) .canvas-node-composer-settings-trigger.canvas-generation-settings-trigger.ant-btn");
});

test("智能引用气泡收口到 composer 设置族玻璃", async () => {
    const globals = await Bun.file(new URL("../src/styles/globals.css", import.meta.url)).text();
    const rule = globals.match(/\.canvas-reference-tools-popover \.ant-popover-container \{([^}]+)\}/)?.[1] || "";
    expect(rule).toContain("border-radius: 16px !important");
    expect(rule).toContain("backdrop-filter: blur(16px)");
    expect(globals).toContain(".dark .canvas-reference-tools-popover .ant-popover-container");
});

test("份数气泡跟随画布外观主题（不再直连工作台主题源）", async () => {
    const src = await Bun.file(new URL("../src/components/canvas/canvas-count-settings-popover.tsx", import.meta.url)).text();
    expect(src).toContain("canvasThemes[useActiveTheme()]");
    expect(src).not.toContain('from "@/stores/use-theme-store"');
    expect(src).not.toContain("useThemeStore((state)");
});

test("工具栏/挂件纯贴附：不夹回视口、中心出界不隐藏（用户对照商业参考拍板）", async () => {
    const [toolbar, overlays] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-node-toolbar.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-workspace-overlays.tsx", import.meta.url)).text(),
    ]);
    // 旧方案(视口夹回/中心出界隐藏)整体退役
    expect(toolbar).not.toContain("centerX < containerRect.left");
    expect(toolbar).not.toContain("halfToolbar + 10");
    expect(overlays).not.toContain('panel.style.visibility = "hidden"');
    // 纯贴附: 工具条居中锚点直取; 挂件中心锚点直取(不再 clamp)
    expect(toolbar).toContain("let left = preferredLeft;");
    expect(toolbar).toContain("let top = above;");
    expect(overlays).toContain("left: nodeRect.left - containerRect.left + nodeRect.width / 2,");
    expect(overlays).toContain("left: nodeCenterX,");
});

// ===== 2026-09-26 用户复查批（P3/HUD 滚动条/composer 空占位/拖动回扯/拖拽动画对齐）=====

test("对象信息 HUD 展开期不闪原生粗滚动条（4px 跑道 + thin-scrollbar）", async () => {
    const hud = await Bun.file(new URL("../src/components/canvas/primitives/object-hud-panel.tsx", import.meta.url)).text();
    expect(hud).toContain("paddingBottom: 4,");
    expect(hud).toContain("thin-scrollbar");
});

test("composer 关重开不被估值覆写（挂载实测为准）", async () => {
    const panel = await Bun.file(new URL("../src/components/canvas/canvas-node-prompt-panel.tsx", import.meta.url)).text();
    expect(panel).not.toContain("setPromptContentHeight(estimatePromptContentHeight(normalizedSavedPrompt, false))");
    expect(panel).not.toContain("setExpandedPromptContentHeight(estimatePromptContentHeight(normalizedSavedPrompt, true))");
    expect(panel).toContain("真实高度以子级 onContentSizeChange 实测为准");
});

test("拖动结束不回扯：dragPreview 位移分量恒零（DOM 直写唯一承担）", async () => {
    const src = await Bun.file(new URL("../src/pages/canvas/use-canvas-selection-controller.ts", import.meta.url)).text();
    expect(src).toContain("setDragPreview({ x: 0, y: 0, nodeIds: dragRef.current.draggedRenderNodeIdSet })");
    expect(src).not.toContain("setDragPreview({ x: pendingNodeDragRef.current.x");
});

test("拖拽关闭/显场对齐：composer 与工具栏同走 hidden 级别，同参过渡", async () => {
    const [aff, project, globals] = await Promise.all([
        Bun.file(new URL("../src/lib/canvas/affordance.ts", import.meta.url)).text(),
        Bun.file(new URL("../src/pages/canvas/project.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/styles/globals.css", import.meta.url)).text(),
    ]);
    expect(aff).toContain("guards.nodeDragging || guards.selectionBoxActive");
    expect(project).not.toContain("!selectionBox && !isCanvasNodeMoving ? dialogNode : null");
    expect(globals).toContain('.canvas-node-panel-affordance[data-affordance="hidden"] .canvas-node-panel-enter');
    expect(globals).toContain("translateY(-12px) scale(0.97)");
});
