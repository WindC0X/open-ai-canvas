import { expect, test } from "bun:test";

// 2026-09-24 批2·D1 裁决：菜单保留 fork flyout 交互（非上游单层品牌/模型列表）——
// 本文件原为 W7 带入的上游形状断言，按合并现实重写：flyout hover 打开 / mousedown 选中
// 即收起 / 空配置回调；价格标签与样式视口边界回归保持不变。

test("模型行保留 hover 预览与独立彩色价格标签（fork flyout 版）", async () => {
    const [component, styles, workspace] = await Promise.all([
        Bun.file(new URL("../src/components/model-picker.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/styles/shared/model-picker.css", import.meta.url)).text(),
        Bun.file(new URL("../src/styles/workspace-product.css", import.meta.url)).text(),
    ]);
    expect(component).not.toContain("previewedModel");
    // fork flyout：provider 行 hover 打开二级面板并交付在飞关闭（上游断言为 not.toContain("onMouseEnter")）
    expect(component).toContain("onMouseEnter={(event) => openFlyout(group.key, event.currentTarget)}");
    expect(component).toContain("scheduleFlyoutClose");
    expect(styles).not.toMatch(/canvas-model-picker-(?:brand|option)(?:\[[^\]]*\])?:hover/);
    expect(workspace).not.toContain(".canvas-model-picker-brand.is-active");
    expect(styles).toContain('.canvas-model-picker-brand[aria-pressed="true"]');
    expect(styles).toContain('.canvas-model-picker-option[aria-selected="true"]');
    expect(styles).toContain(".canvas-model-picker-option:focus-visible");
    const price = styles.match(/\.model-picker-price \{([^}]+)\}/)?.[1] || "";
    expect(price).toContain("color: var(--model-price-ink)");
    expect(price).toContain("font-weight: 650");
    expect(price).not.toContain("background:");
    expect(styles).toContain(".dark .model-picker-price");
    const badge = styles.match(/\.canvas-model-picker-option \.model-picker-price \{([^}]+)\}/)?.[1] || "";
    expect(badge).toContain("border-radius: var(--r-sm)");
    expect(badge).toContain("background: color-mix");
    expect(badge).toContain("padding: 2px 5px");
    expect(price).toContain("--model-price-ink: #946900");
    // fork 行价格渲染 = canvas-model-picker-chip + Coins size-3（上游 .model-picker-price-icon 类不在我方渲染路径；
    // .model-picker-price 样式断言仍由 shared 样式侧覆盖）
    expect(component).toContain('<Coins className="size-3" />');
    expect(styles).toContain("width: min(800px, calc(100vw - 24px))");
});

test("打开菜单派发 model-picker-open 并处理空配置（fork flyout 版）", async () => {
    const component = await Bun.file(new URL("../src/components/model-picker.tsx", import.meta.url)).text();
    const opening = component.match(/const setPickerOpen = \(nextOpen: boolean\) => \{([\s\S]*?)\n    \};/)?.[1] || "";
    expect(opening).toContain('window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }))');
    expect(opening).toContain("onMissingConfig?.()");
    expect(opening).toContain("setOpen(nextOpen)");
    // fork 无「打开即展开当前选中目录」的 setActiveGroupKey 行为（目录展开由 flyout hover 驱动）
    expect(opening).not.toContain("setActiveGroupKey");
});

test("选择模型按 fork 语义：mousedown 即选中并收起，落空点击由时间窗拦截", async () => {
    const component = await Bun.file(new URL("../src/components/model-picker.tsx", import.meta.url)).text();
    const selection = component.match(/onMouseDown=\{\(\) => \{([\s\S]*?)\}\}/)?.[1] || "";
    expect(selection).toContain("onChange(model)");
    expect(selection).toContain("setFlyoutGroup(null)");
    expect(selection).toContain("setOpen(false)");
    expect(selection).toContain("triggerRef.current?.focus()");
    expect(component).toContain('event.key === "Escape"');
    expect(component).toContain('window.addEventListener("pointerdown", closeOnOutsidePointer, true)');
});

test("ModelPicker 样式单一源收敛，并保留模型列表的视口边界（G7 完成期）", async () => {
    const [application, globals, pickerStyles] = await Promise.all([
        Bun.file(new URL("../src/application.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/styles/globals.css", import.meta.url)).text(),
        Bun.file(new URL("../src/styles/shared/model-picker.css", import.meta.url)).text(),
    ]);

    expect(application).toContain('import "./styles/shared/model-picker.css";');
    // G7 完成（2026-09-24）：模型菜单家族已单一源收敛至 shared；globals 不得再含该家族任何规则。
    expect(globals).not.toContain("canvas-model-picker");
    expect(pickerStyles).toContain(".canvas-model-picker-menu {");
    // [2026-09-24 G7] 飞层高度上限 420→480：53px 行高下 8 行约 440，曾被 420 裁底行。
    expect(pickerStyles).toContain("max-height: min(480px, calc(100vh - 32px));");

    const creationMenu = pickerStyles.match(/\.creation-model-picker-menu \{([\s\S]*?)\}/)?.[1] || "";
    expect(creationMenu).toContain("max-height: min(460px, calc(100vh - 24px));");
    expect(creationMenu).toContain("overflow-y: auto;");
    expect(pickerStyles).toContain(".app-user-workspace .creation-model-picker-menu.is-brand-list");
    expect(pickerStyles).toContain(".creation-model-picker-surface .creation-model-picker-menu.is-model-list");
    expect(pickerStyles).toContain(".creation-model-picker-surface .creation-model-picker-menu.is-brand-list");

    const modelList = pickerStyles.match(/\.creation-model-picker-surface \.creation-model-picker-menu\.is-model-list \{([\s\S]*?)\}/)?.[1] || "";
    expect(modelList).toContain("max-height: min(460px, calc(100vh - 24px)) !important;");
    expect(modelList).toContain("overflow-y: auto !important;");
    expect(pickerStyles).not.toContain(".app-user-workspace .creation-model-picker-menu {");
    expect(pickerStyles).not.toContain(".creation-model-picker-surface .creation-model-picker-menu {");
});
