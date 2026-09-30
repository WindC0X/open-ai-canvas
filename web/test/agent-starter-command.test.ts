import { expect, test } from "bun:test";

// S1 v5（控制线 2026-09-27「选项 B · 面板归零版」）：电商任务卡整体下架，面板回归原版——
// 卡区/钻取接线/静默挂载/焦点迁移全部撤除；组合胶囊恢复上游原语义（确认消息 + 进对话）。
test("v5 面板归零：面板/project 无 S1 新增（卡区/钻取/静默挂载/命令扩展），场景卡文件已删除", async () => {
    const [project, panel, chatUi, composer] = await Promise.all([
        Bun.file(new URL("../src/pages/canvas/project.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-chat-ui.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-composer.tsx", import.meta.url)).text(),
    ]);
    // 命令通道扩展整体回滚（prefill 恢复为基线「仅填充」语义）
    expect(project).not.toContain("runAgentStarter");
    expect(project).not.toContain("prefillSubmit");
    expect(project).not.toContain("onStarterPrompt");
    expect(project).not.toContain("submit: true");
    // 面板：卡区/钻取/静默挂载/焦点迁移/裁决函数全部归零
    expect(panel).not.toContain("AgentSceneCards");
    expect(panel).not.toContain("drilledScene");
    expect(panel).not.toContain("onActiveChange");
    expect(panel).not.toContain("prefillSubmit");
    expect(panel).not.toContain("onStarterPrompt");
    expect(panel).not.toContain("submitRef");
    expect(panel).not.toContain("resolveStarterRunDecision");
    expect(panel).not.toContain("正在创作中，请稍候");
    expect(panel).not.toContain("message.info(`已按「");
    expect(panel).not.toContain("message.info(`已把「");
    // 上游原语义在位：组合/单技能激活写系统确认消息 + 错误走 appendAgentError
    expect(panel).toContain("text: `已按「${preset.name}」挂上 ${preset.skillIds.length} 个技能");
    expect(panel).toContain("text: `已把「${skill.skillName}」挂到本会话。用哪张卡交给 Agent 按任务检索。`");
    expect(panel).toContain("appendAgentError");
    // chat-ui：onActiveChange 上报撤回（条内交互上游原样）
    expect(chatUi).not.toContain("onActiveChange");
    // 锚点迁移（merge-v1.6.1 · 上游 7f5d87ef 拆分）：场景胶囊的 activeKey 状态机随输入区
    // 抽入 canvas-cloud-agent-composer.tsx，断言锚点同步迁移（旧锚 = chat-ui）。
    expect(composer).toContain("setActiveKey(bucket.key);");
    expect(composer).toContain("setActiveKey(null);");
    // 场景卡组件文件已删除
    expect(await Bun.file(new URL("../src/components/canvas/canvas-agent-scene-cards.tsx", import.meta.url)).exists()).toBe(false);
});

// S1 v5：welcome 全表面 = 基线原文（零 fork 痕迹）；welcome 调用签名回归基线。
test("v5：welcome 与基线逐项一致（零 tier/零卡区/零折叠钮）", async () => {
    const [panel, welcome, parts] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-agent-welcome.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel-parts.tsx", import.meta.url)).text(),
    ]);
    expect(welcome).toContain('<section className="agent-welcome" aria-label="开始 Agent 创作">');
    expect(welcome).toContain("先聊想法，再决定下一步");
    expect(welcome).not.toContain("tier");
    expect(welcome).not.toContain("drilledScene");
    expect(welcome).not.toContain("更多开始方式");
    expect(welcome).not.toContain("ECOM_STARTER");
    // 锚点迁移（merge-v1.6.1 · 上游 7f5d87ef 拆分）：welcome 挂载点随渲染段抽入 panel-parts.tsx。
    expect(parts).toContain("<AgentWelcome appearance={appearance} nodeCount={nodeCount} onChooseSkill={onChooseSkill} onDraftPrompt={onDraftPrompt} />");
    expect(panel).not.toContain("welcomeTier");
    expect(panel).not.toContain("resolveAgentWelcomeTier");
});

// S1.1（控制线 P0）：消息 chip 化——休眠保留（无入口触发；为未来 slash 指令/对话内推荐入口留底）。
// 面板滚动段保持基线原文（贴底守卫已在 v4 撤除）。
test("S1.1 chip 休眠保留 + 面板滚动基线", async () => {
    const [panel, chatUi, composer, parts] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-chat-ui.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-composer.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel-parts.tsx", import.meta.url)).text(),
    ]);
    expect(chatUi).toContain("findEcomStarterCardByPrompt");
    expect(chatUi).toContain("agent-starter-chip");
    expect(panel).not.toContain("hasMessagesRef");
    // 锚点迁移（merge-v1.6.1 · 上游 7f5d87ef 拆分）：贴底滚动逻辑随渲染段抽入 panel-parts.tsx。
    expect(parts).toContain("if (element && followRef.current) element.scrollTop = element.scrollHeight;");
    expect(parts).toContain("if (followRef.current) element.scrollTop = element.scrollHeight;");
});
