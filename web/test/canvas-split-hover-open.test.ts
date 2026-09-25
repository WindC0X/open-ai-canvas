import { expect, test } from "bun:test";

// 2026-09-25 用户拍板：宫格切分 L2/L3 悬停展开 + 左列行高不随自定义展开变化（右板反算收缩到自然等高）。

test("宫格切分 L2 悬停展开（150ms 意图延迟，离开行/面板收起）", async () => {
    const src = await Bun.file(new URL("../src/components/canvas/canvas-node-toolbar.tsx", import.meta.url)).text();
    expect(src).toContain("onMouseEnter={isSplit ? scheduleSplitPanelOpen : undefined}");
    expect(src).toContain("onMouseLeave={isSplit ? scheduleSplitPanelClose : undefined}");
    expect(src).toContain("onHoverLeave={scheduleSplitPanelClose}");
    expect(src).toContain("splitOpenTimerRef.current = window.setTimeout(() => {");
});

test("自定义（L3）悬停展开，指针离开行/棋盘收起", async () => {
    const src = await Bun.file(new URL("../src/components/canvas/canvas-grid-split-picker.tsx", import.meta.url)).text();
    expect(src).toContain("onMouseEnter={scheduleCustomOpen}");
    expect(src).toContain("onMouseLeave={scheduleCustomClose}");
    expect(src).toContain('document.querySelector(".canvas-grid-split-custom:hover")');
});

test("右板按左列自然高反算收缩（展开不改变左列行高）", async () => {
    const css = await Bun.file(new URL("../src/components/canvas/canvas-grid-split-picker.css", import.meta.url)).text();
    const block = css.match(/\.canvas-grid-split-custom \{([^}]+)\}/)?.[1] || "";
    expect(block).toContain("width: 7.3125rem");
    expect(block).toContain("padding: var(--space-2)");
    expect(block).toContain("gap: var(--space-1-half)");
});
