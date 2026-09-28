import { expect, test } from "bun:test";

// 2026-09-25 用户拍板：宫格切分 L2/L3 悬停展开 + 左列行高不随自定义展开变化（右板反算收缩到自然等高）。
// 2026-09-28 rider：反算弃用（用户三实例复现跳闪），改结构性 flex-start；语义级断言如下。

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

test("棋盘开合不改变左列行高：结构性修复（flex-start，替代数字追等式）", async () => {
    const css = await Bun.file(new URL("../src/components/canvas/canvas-grid-split-picker.css", import.meta.url)).text();
    const block = css.match(/(?:^|\n)\.canvas-grid-split-picker \{([^}]+)\}/)?.[1] || "";
    expect(block).toContain("display: flex");
    // 2026-09-28 rider 根因：stretch 下棋盘展开撑高容器 → 左列行被拉伸 → 「自定义」行被推离光标 → 循环跳闪。
    // 断言语义写死：根容器必须是 flex-start（左列保持自然高，开合棋盘前后每行 rect 逐像素不变）。
    expect(block).toContain("align-items: flex-start");
    expect(block).not.toContain("align-items: stretch");
    expect(block).toContain("overflow: visible");

    // L2 菜单零位移的前提：棋盘脱流（absolute），不会把父菜单节点撑动。
    const splitHost = css.match(/\.canvas-node-toolbar-menu-split > \.canvas-grid-split-picker \{([^}]+)\}/)?.[1] || "";
    expect(splitHost).toContain("position: absolute");
});
