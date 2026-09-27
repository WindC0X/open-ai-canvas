import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentSceneCards } from "@/components/canvas/canvas-agent-scene-cards";
import { AgentWelcome } from "@/components/canvas/canvas-agent-welcome";
import { DEFAULT_CANVAS_APPEARANCE } from "@/lib/canvas/agent-appearance";
import { resolveSceneStarterCards } from "@/lib/canvas/canvas-ecom-starters";

const noop = () => {};

// 验收 c/d：钻取↔卡区渲染、返回↔恢复——卡区按场景解析渲染；无卡场景零渲染（零假空态）。
test("v3.2 场景卡区：广告电商渲染四卡 2×2（组头 + 磁贴），其余场景零渲染", () => {
    const html = renderToStaticMarkup(<AgentSceneCards sceneKey="ecommerce" onRunStarter={noop} />);
    expect(html).toContain("广告电商 · 快捷开始");
    expect(html).toContain('data-scene-cards="ecommerce"');
    expect(html.match(/class="agent-scene-card"/g)).toHaveLength(4);
    for (const title of ["白底产品图", "3:4 详情图", "批量优化提示词", "商品场景图"]) {
        expect(html).toContain(title);
    }
    // 无卡场景（验收 d）：不渲染卡区（空串 = 零 DOM），解析函数返回 null
    for (const key of ["drama", "creative", "frequent", "social", "others"]) {
        expect(renderToStaticMarkup(<AgentSceneCards sceneKey={key} onRunStarter={noop} />)).toBe("");
        expect(resolveSceneStarterCards(key)).toBeNull();
    }
});

// 验收 a：默认态通用组无组标题、DOM 在前（hero → 通用三卡 → 辅助行）、常显；验收 b：无折叠钮。
test("v3.2 默认态 welcome：hero → 通用三卡 → 辅助行，无折叠钮、无电商组标题", () => {
    const html = renderToStaticMarkup(<AgentWelcome appearance={DEFAULT_CANVAS_APPEARANCE} nodeCount={3} onChooseSkill={noop} onDraftPrompt={noop} tier="compact" />);
    const cardsIdx = html.indexOf("选择技能，开始创作");
    const footnoteIdx = html.indexOf("先聊想法，再决定下一步");
    expect(cardsIdx).toBeGreaterThan(-1);
    expect(footnoteIdx).toBeGreaterThan(cardsIdx);
    expect(html).not.toContain("更多开始方式");
    // 电商分组标题不再出现在 welcome（卡区已下移到胶囊条下方）
    expect(html).not.toContain("快捷开始");
    expect(html.match(/type="button"/g)).toHaveLength(3);
});

// 验收 c：钻取态 welcome 隐藏通用三卡与辅助行（返回恢复由面板 drilledScene 状态驱动）。
test("v3.2 钻取态 welcome：通用三卡与辅助行隐藏", () => {
    const html = renderToStaticMarkup(<AgentWelcome appearance={DEFAULT_CANVAS_APPEARANCE} nodeCount={3} onChooseSkill={noop} onDraftPrompt={noop} tier="compact" drilledScene="ecommerce" />);
    expect(html).not.toContain("选择技能，开始创作");
    expect(html).not.toContain("先聊想法，再决定下一步");
    expect(html.match(/type="button"/g) ?? []).toHaveLength(0);
});
