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

// 2026-09-25 用户实测「切浅色后模型列表半深半浅」：画布页 body 无 app-spatial-overlays，
// L1 surface 曾只有暗玻璃、无浅色变体，与已有浅色变体的 flyout(L2) 割裂。
test("L1 弹层玻璃保留暗玻璃并具浅色变体（浅色割裂回归）", async () => {
    const styles = await Bun.file(new URL("../src/styles/shared/model-picker.css", import.meta.url)).text();
    expect(styles).toContain("background: rgba(32, 32, 32, 0.9) !important;");
    const lightBlock = styles.match(/:root:not\(\.dark\) \.canvas-model-picker-popover\.canvas-composer-popover-surface,\n    :root:not\(\.dark\) \.canvas-model-picker-popover \.canvas-composer-popover-surface \{([\s\S]*?)\}/)?.[1] || "";
    expect(lightBlock).toContain("background: rgba(255, 255, 255, 0.92) !important;");
    expect(lightBlock).toContain("border-color: rgba(17, 24, 39, 0.06) !important;");
    // flyout 既有浅色变体保持
    expect(styles).toContain(":root:not(.dark) .canvas-model-picker-flyout {");
});

// 2026-09-25 用户复查「六个弹层质感依旧不一致」：creation 泄漏层归一
// （L1 菜单透明透出玻璃 / L2 flyout 恢复 .9 声明值 / blur 18→16 归一）。
test("模型弹层去 creation 泄漏层（L1 菜单不再叠暗、L2 恢复玻璃、blur 归 16）", async () => {
    const styles = await Bun.file(new URL("../src/styles/shared/model-picker.css", import.meta.url)).text();
    const l1MenuFix = styles.match(/\.canvas-model-picker-popover \.canvas-model-picker-menu\.creation-model-picker-menu \{([\s\S]*?)\}/)?.[1] || "";
    expect(l1MenuFix).toContain("background: transparent !important;");
    const flyoutFix = styles.match(/\.dark \.canvas-model-picker-flyout\.creation-model-picker-menu \{([\s\S]*?)\}/)?.[1] || "";
    expect(flyoutFix).toContain("rgba(32, 32, 32, 0.9) !important");
    const blurBlocks = [...styles.matchAll(/\.canvas-model-picker-popover \.canvas-composer-popover-surface \{([\s\S]*?)\}/g)].map((m) => m[1]);
    expect(blurBlocks.length).toBeGreaterThan(1);
    expect(blurBlocks[blurBlocks.length - 1]).toContain("backdrop-filter: blur(16px) !important;");
    // 泄漏源（工作台层 .7 暗蓝）仍在原处——覆盖依赖其存在，若上游移除本测试提示清理覆盖。
    expect(styles).toContain("background: rgba(25, 27, 32, .7) !important;");
});

test("模型行变体 T：右轨锚标题行 + 两行流式区 + 无 grid pin 列", async () => {
    const [component, styles] = await Promise.all([
        Bun.file(new URL("../src/components/model-picker.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/styles/shared/model-picker.css", import.meta.url)).text(),
    ]);
    // 无 grid pin 列（T：行组弃双列，pin 退出文档流改绝对定位）
    expect(styles).not.toContain("grid-template-columns: minmax(0, 1fr) auto");
    const rowgroupRule = styles.match(/\.canvas-model-picker-rowgroup \{([^}]+)\}/)?.[1] || "";
    expect(rowgroupRule).toContain("position: relative");
    // 右轨存在且绝对定位、锚标题行（top=上下文 padding + 标题行高带）
    expect(component).toContain('className="canvas-model-picker-rail"');
    const railRule = styles.match(/\.canvas-model-picker-rail \{([^}]+)\}/)?.[1] || "";
    expect(railRule).toContain("position: absolute");
    expect(railRule).toContain("top: 6px");
    expect(railRule).toContain("height: calc(var(--fs-body) * 1.4)");
    const railCreation = styles.match(/\.creation-model-picker-menu \.canvas-model-picker-rail \{([^}]+)\}/)?.[1] || "";
    expect(railCreation).toContain("top: 8px");
    // pin 绝对定位让出文档流（行组层，锚标题行同轨）
    const pinRule = styles.match(/\.canvas-model-picker-pin \{([^}]+)\}/)?.[1] || "";
    expect(pinRule).toContain("position: absolute");
    expect(pinRule).toContain("right: 10px");
    // 价格在右轨、标题行（inlineBadges）无价格
    const railBlock = component.match(/canvas-model-picker-rail">([\s\S]*?)<\/span>/)?.[1] || "";
    expect(railBlock).toContain("priceForChip");
    expect(railBlock).toContain("selected ? <Check");
    const badgesBlock = component.match(/inlineBadges=\{\(<>([\s\S]*?)<\/>\)\}/)?.[1] || "";
    expect(badgesBlock).not.toContain("priceForChip");
    expect(badgesBlock).not.toContain("ModelPrice");
    // zone：mini chip 内联 + 2 行 clamp；标题行让位 96、zone 吃满
    expect(component).toContain("canvas-model-picker-zone-tag");
    const zoneRule = styles.match(/\.canvas-model-picker-zone \{([^}]+)\}/)?.[1] || "";
    expect(zoneRule).toContain("-webkit-line-clamp: 2");
    expect(zoneRule).toContain("line-height: 17px");
    const zoneTagRule = styles.match(/\.canvas-model-picker-zone-tag \{([^}]+)\}/)?.[1] || "";
    expect(zoneTagRule).toContain("font-size: 11px");
    expect(zoneTagRule).toContain("padding: 2px 5px");
    expect(zoneTagRule).toContain("border-radius: 3px");
    const line1Rule = styles.match(/\.canvas-model-picker-line1 \{([^}]+)\}/)?.[1] || "";
    expect(line1Rule).toContain("margin-right: 66px");
    // 无价格行让位收窄 + 选中行（min-height 58）顶对齐零漂移
    const noPriceRule = styles.match(/\.canvas-model-picker-option\.no-rail-price \.canvas-model-picker-line1 \{([^}]+)\}/)?.[1] || "";
    expect(noPriceRule).toContain("margin-right: 36px");
    expect(styles.match(/\.canvas-model-picker-option \{[^}]*align-items: flex-start[^}]*\}/)).toBeTruthy();
    // 3b 遗产保留：logo 锚顶补偿；✓ 补偿已撤（改轨锚）
    const logoBlocks = [...styles.matchAll(/\.canvas-model-picker-logo \{([^}]+)\}/g)].map((m) => m[1]);
    expect(logoBlocks.join("\n")).toContain("margin-top: calc(var(--fs-body) * 0.7 - 12px)");
    expect(styles).not.toContain("margin-top: calc(var(--fs-body) * 0.7 - 7px)");
    expect(component).not.toContain("canvas-model-picker-tags-slot");
    expect(styles).not.toContain(".canvas-model-picker-tags-slot");
    // hover 只补间背景/边框/颜色：禁 height/padding 补间（果冻感红线，跨任务书保持）
    const optionRules = styles.match(/\.canvas-model-picker-option[^{,]*\{[^}]*transition[^}]*\}/g) || [];
    expect(optionRules.length).toBeGreaterThan(0);
    for (const rule of optionRules) {
        expect(rule).not.toMatch(/transition:[^;}]*(height|padding)/i);
    }
    expect(optionRules.join("\n")).toContain("transition: background-color");
});
