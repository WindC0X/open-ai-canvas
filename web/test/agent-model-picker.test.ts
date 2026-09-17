import { expect, test } from "bun:test";

test("Agent 对话和设置复用创作页模型选择器，并且只展示文本模型", async () => {
    const panel = await Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text();
    const settings = await Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-settings.tsx", import.meta.url)).text();
    const css = await Bun.file(new URL("../src/components/canvas/canvas-cloud-agent.css", import.meta.url)).text();

    expect(panel).toContain('capability="text"');
    expect(panel).toContain('variant="creation"');
    expect(panel).toContain('popoverClassName="agent-model-picker-popover"');
    expect(panel).toContain('selectableModelsByCapability(config, "text")');
    expect(panel).toContain('placeholder="选择文本模型"');

    expect(settings).toContain('capability="text"');
    expect(settings).toContain('variant="creation"');
    expect(settings).toContain('popoverClassName="agent-model-picker-popover"');
    expect(settings).toContain('placeholder="选择文本模型"');

    expect(css).toContain(".agent-model-picker-popover");
    expect(css).toContain("z-index: calc(var(--z-modal-overlay) + 1000)");

    // 上游 v1.3 的双栏菜单(is-model-list/two-pane)未被采纳(merge 取我们 flyout 分组菜单, 死 CSS 已清);
    // 本断言改为验证 flyout 语义下的等价收缩保障: Agent 面板壳层 min-width:0, 长模型名不撑破窗口。
    expect(css).toContain(".canvas-agent-panel > div");
    expect(css).toContain("min-width: 0");
});
