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

test("节点移出视口时工具栏/挂件隐藏（不再被挤在可视区）", async () => {
    const [toolbar, overlays] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-node-toolbar.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-workspace-overlays.tsx", import.meta.url)).text(),
    ]);
    expect(toolbar).toContain("centerX < containerRect.left");
    expect(toolbar).toContain("setAnchor(null);\n                return;");
    expect(overlays).toContain('panel.style.visibility = "hidden"');
});
