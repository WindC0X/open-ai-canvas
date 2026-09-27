import { expect, test } from "bun:test";

// S1（控制线 2026-09-27 裁决 2）：starter 卡点击 = 一条新命令（自增 id）+ 立即执行（submit 标记）；
// 不另造发送路径；忙态/运行中守卫拒绝必须可见（toast），禁止静默吞。
test("starter 卡走自增 id prefill 命令通道并复用 submit 发送路径", async () => {
    const [project, panel, welcome] = await Promise.all([
        Bun.file(new URL("../src/pages/canvas/project.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-agent-welcome.tsx", import.meta.url)).text(),
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
    // 卡面：电商分组由数据驱动渲染，点击走 onRunStarter
    expect(welcome).toContain("ECOM_STARTER_CARDS");
    expect(welcome).toContain("onRunStarter");
    // 重构（控制线 2026-09-27 退回裁决 2.2）：面板按浮窗高度分级；技能胶囊同态折叠；卡面含「更多开始方式」
    expect(panel).toContain("resolveAgentWelcomeTier(panelLayout.compact");
    expect(panel).toContain('(welcomeTier === "expanded" || welcomeMoreOpen)');
    expect(welcome).toContain("agent-welcome--${tier}");
    expect(welcome).toContain("更多开始方式");
    // S1.1（控制线 P0/P2）：消息 chip 化 + welcome 态不自动贴底
    const chatUi = await Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-chat-ui.tsx", import.meta.url)).text();
    expect(chatUi).toContain("findEcomStarterCardByPrompt");
    expect(chatUi).toContain("agent-starter-chip");
    expect(welcome).toContain("ECOM_STARTER_ICONS");
    expect(panel).toContain("hasMessagesRef.current = messages.length > 0");
    expect(panel).toContain("followRef.current && hasMessagesRef.current");
});
