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

test("残余 A：卡片背景下放两列独立成卡（根容器透明，展开不再露无内容背景块）", async () => {
    const css = await Bun.file(new URL("../src/components/canvas/canvas-grid-split-picker.css", import.meta.url)).text();
    const root = css.match(/(?:^|\n)\.canvas-grid-split-picker \{([^}]+)\}/)?.[1] || "";
    // 断言语义：单卡背景包 max(两列高) 会在矮列下方露空背景块 → 背景必须下放到两列卡片。
    expect(root).not.toContain("background");
    expect(root).not.toContain("backdrop-filter");
    const presets = css.match(/(?:^|\n)\.canvas-grid-split-presets \{([^}]+)\}/)?.[1] || "";
    expect(presets).toContain("background: rgba(32, 32, 32, 0.9)");
    const custom = css.match(/(?:^|\n)\.canvas-grid-split-custom \{([^}]+)\}/)?.[1] || "";
    expect(custom).toContain("background: rgba(32, 32, 32, 0.9)");
    expect(custom).toContain("border-radius: 12px");
});

test("残余 B：格点 data-icon-only 豁免（防统一按钮 padding 撑破网格轨道）", async () => {
    const tsx = await Bun.file(new URL("../src/components/canvas/canvas-grid-split-picker.tsx", import.meta.url)).text();
    const cellIdx = tsx.indexOf("canvas-grid-split-cell");
    expect(cellIdx).toBeGreaterThan(-1);
    const cellBlock = tsx.slice(Math.max(0, cellIdx - 400), cellIdx + 400);
    // 断言语义：格点必须显式豁免，否则 padding-inline:max(12px, --space-3) 把 24px 最小宽
    // 撑进 ~16.8px 的网格轨道 → 相邻重叠/行高被反推抬升（用户环境呈现为压扁）。
    expect(cellBlock).toContain("data-icon-only");
    const unified = await Bun.file(new URL("../src/styles/unified-buttons.css", import.meta.url)).text();
    expect(unified).toContain("button:not(.ant-btn-icon-only):not([data-icon-only])");
});
