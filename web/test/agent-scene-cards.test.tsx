import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentSceneCards } from "@/components/canvas/canvas-agent-scene-cards";
import { AgentWelcome } from "@/components/canvas/canvas-agent-welcome";
import { DEFAULT_CANVAS_APPEARANCE } from "@/lib/canvas/agent-appearance";
import { resolveSceneStarterCards } from "@/lib/canvas/canvas-ecom-starters";

const noop = () => {};

// 验收 c/d：卡区按场景解析渲染；无卡场景零渲染（零假空态）。
test("v4 场景卡区：广告电商渲染四卡 2×2（组头 + 成本副标题），其余场景零渲染", () => {
    const html = renderToStaticMarkup(<AgentSceneCards sceneKey="ecommerce" onRunStarter={noop} />);
    expect(html).toContain("广告电商 · 快捷开始");
    expect(html).toContain('data-scene-cards="ecommerce"');
    expect(html.match(/class="agent-scene-card"/g)).toHaveLength(4);
    for (const title of ["白底产品图", "3:4 详情图", "批量优化提示词", "商品场景图"]) {
        expect(html).toContain(title);
    }
    // v4：磁贴保留成本副标题（生成主图 · 约消耗 1 张图档 等）
    expect(html).toContain("生成主图 · 约消耗 1 张图档");
    // 无卡场景：不渲染卡区（空串 = 零 DOM），解析函数返回 null
    for (const key of ["drama", "creative", "frequent", "social", "others"]) {
        expect(renderToStaticMarkup(<AgentSceneCards sceneKey={key} onRunStarter={noop} />)).toBe("");
        expect(resolveSceneStarterCards(key)).toBeNull();
    }
});

// v4 基线不减：welcome = 基线形态（球体 + 副标题 + 双行卡 + 辅助行），无 tier 类、无折叠钮。
test("v4 welcome 回归基线形态：球体 + 副标题 + 双行卡 + 辅助行", () => {
    const html = renderToStaticMarkup(<AgentWelcome appearance={DEFAULT_CANVAS_APPEARANCE} nodeCount={3} onChooseSkill={noop} onDraftPrompt={noop} />);
    expect(html).toContain("agent-welcome-orb");
    expect(html).toContain("从一个想法开始，和影策一起创作。");
    expect(html).toContain("为这次创作找到合适的帮手");
    expect(html).toContain("先聊想法，再决定下一步");
    expect(html.match(/type="button"/g)).toHaveLength(3);
    expect(html).not.toContain("更多开始方式");
    expect(html).not.toContain("agent-welcome--");
    expect(html).not.toContain("快捷开始");
});
