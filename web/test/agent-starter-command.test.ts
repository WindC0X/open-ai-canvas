import { expect, test } from "bun:test";

// S1（控制线 2026-09-27 裁决 2）：starter 卡点击 = 一条新命令（自增 id）+ 立即执行（submit 标记）；
// 不另造发送路径；忙态/运行中守卫拒绝必须可见（toast），禁止静默吞。
test("starter 卡走自增 id prefill 命令通道并复用 submit 发送路径", async () => {
    const [project, panel] = await Promise.all([
        Bun.file(new URL("../src/pages/canvas/project.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
    ]);
    // 父级：starter 入口走自增 id 命令 + submit 标记；面板接线完整
    expect(project).toContain("const runAgentStarter = useCallback((prompt: string) => {");
    expect(project).toContain("setAgentPrefill({ id: agentPrefillIdRef.current, prompt, submit: true });");
    expect(project).toContain("prefillSubmit={agentPrefill.submit}");
    expect(project).toContain("onStarterPrompt={runAgentStarter}");
    // 面板：submit 经裁决函数消费（忙态分支存在）；toast 文案固定；发送走 submitRef
    expect(panel).toContain("resolveStarterRunDecision({ value, busy, running, pending: submissionRequestRef.current })");
    expect(panel).toContain("正在创作中，请稍候");
    expect(panel).toContain("submitRef.current?.(value)");
    expect(panel).toContain("if (!prefillSubmit) return;");
});

// S1 v4（基线不减原则）：welcome 回归基线（零 fork 痕迹）；卡区/钻取链路/静默挂载保留。
test("v4：welcome 回归基线（无 tier 裁剪），卡区与静默挂载保留", async () => {
    const [panel, welcome, chatUi, sceneCards] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-agent-welcome.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-chat-ui.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-agent-scene-cards.tsx", import.meta.url)).text(),
    ]);
    // welcome：基线指纹在位；零 fork 标记（tier / 钻取响应 / 折叠钮 / 电商组）
    expect(welcome).toContain('<section className="agent-welcome" aria-label="开始 Agent 创作">');
    expect(welcome).toContain("先聊想法，再决定下一步");
    expect(welcome).not.toContain("tier");
    expect(welcome).not.toContain("drilledScene");
    expect(welcome).not.toContain("更多开始方式");
    expect(welcome).not.toContain("ECOM_STARTER");
    // 面板：welcome 调用回归基线签名；tier 体系移除
    expect(panel).toContain("<AgentWelcome appearance={appearance} nodeCount={nodeCount} onChooseSkill={onChooseSkill} onDraftPrompt={onDraftPrompt} />");
    expect(panel).not.toContain("welcomeTier");
    expect(panel).not.toContain("resolveAgentWelcomeTier");
    expect(panel).not.toContain("更多开始方式");
    // 卡区渲染：胶囊条之后、welcome 守卫内（保留件）
    expect(panel).toContain("onActiveChange={setDrilledScene}");
    expect(panel).toContain("<AgentSceneCards");
    expect(panel.indexOf("<AgentSceneCapsules")).toBeLessThan(panel.indexOf("<AgentSceneCards"));
    // 钻取状态机：真实 setActiveKey 调用点均同步上报（钻取 + 返回）
    expect(chatUi).toContain("setActiveKey(bucket.key);");
    expect(chatUi).toContain("onActiveChange?.(bucket.key);");
    expect(chatUi).toContain("setActiveKey(null);");
    expect(chatUi).toContain("onActiveChange?.(null);");
    // 静默挂载：组合/单技能激活不写会话消息，反馈走 toast
    expect(panel).not.toContain("text: `已按「`");
    expect(panel).not.toContain("text: `已把「`");
    expect(panel).toContain("message.info(`已按「${preset.name}」挂上");
    expect(panel).toContain("message.info(`已把「${skill.skillName}」挂到本会话");
    // 卡区由场景解析驱动 + 组头格式
    expect(sceneCards).toContain("resolveSceneStarterCards");
    expect(sceneCards).toContain("· 快捷开始");
    expect(sceneCards).toContain("data-scene-cards");
});

// S1.1（控制线 P0）：消息 chip 化（保留件）；v4：welcome 滚动行为回归基线（P2 贴底守卫已随折叠钮退场）。
test("S1.1：chip 化保留 + welcome 滚动回归基线", async () => {
    const [panel, chatUi] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-chat-ui.tsx", import.meta.url)).text(),
    ]);
    expect(chatUi).toContain("findEcomStarterCardByPrompt");
    expect(chatUi).toContain("agent-starter-chip");
    // v4：贴底守卫（hasMessagesRef）移除，滚动段回归基线原文
    expect(panel).not.toContain("hasMessagesRef");
    expect(panel).toContain("if (element && followRef.current) element.scrollTop = element.scrollHeight;");
    expect(panel).toContain("if (followRef.current) element.scrollTop = element.scrollHeight;");
});
