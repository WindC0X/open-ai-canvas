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

// S1 v3.2（控制线 2026-09-27）：卡区下移到胶囊条下方、无折叠钮、钻取状态机联动、静默挂载。
test("v3.2：场景卡区下移、无折叠钮、真实钻取状态机与静默挂载", async () => {
    const [panel, welcome, chatUi, sceneCards] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-agent-welcome.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-chat-ui.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-agent-scene-cards.tsx", import.meta.url)).text(),
    ]);
    // 分级仍在；「更多开始方式」折叠钮与 tier 门控彻底移除（验收 b）
    expect(panel).toContain("resolveAgentWelcomeTier(panelLayout.compact");
    expect(panel).not.toContain("更多开始方式");
    expect(panel).not.toContain("welcomeMoreOpen");
    expect(welcome).not.toContain("更多开始方式");
    // 卡区渲染：面板接线（welcome 守卫内、胶囊条之后）+ 面板把钻取态传给 welcome（验收 c/d）
    expect(panel).toContain("onActiveChange={setDrilledScene}");
    expect(panel).toContain("<AgentSceneCards");
    expect(panel).toContain("drilledScene={drilledScene}");
    expect(panel.indexOf("<AgentSceneCapsules")).toBeLessThan(panel.indexOf("<AgentSceneCards"));
    // 钻取状态机：真实 setActiveKey 调用点均同步上报（钻取 + 返回）
    expect(chatUi).toContain("setActiveKey(bucket.key);");
    expect(chatUi).toContain("onActiveChange?.(bucket.key);");
    expect(chatUi).toContain("setActiveKey(null);");
    expect(chatUi).toContain("onActiveChange?.(null);");
    // welcome 钻取态隐藏通用三卡与辅助行
    expect(welcome).toContain("drilledScene ? null : (");
    // 静默挂载（验收 e）：组合/单技能激活不写会话消息，反馈走 toast
    expect(panel).not.toContain("text: `已按「`");
    expect(panel).not.toContain("text: `已把「");
    expect(panel).toContain("message.info(`已按「${preset.name}」挂上");
    expect(panel).toContain("message.info(`已把「${skill.skillName}」挂到本会话");
    // 卡区由场景解析驱动 + 组头格式
    expect(sceneCards).toContain("resolveSceneStarterCards");
    expect(sceneCards).toContain("· 快捷开始");
    expect(sceneCards).toContain("data-scene-cards");
});

// S1.1（控制线 P0/P2）：消息 chip 化 + welcome 态不自动贴底（保留件）。
test("S1.1：chip 化与 welcome 态不自动贴底护栏", async () => {
    const [panel, chatUi] = await Promise.all([
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-chat-ui.tsx", import.meta.url)).text(),
    ]);
    expect(chatUi).toContain("findEcomStarterCardByPrompt");
    expect(chatUi).toContain("agent-starter-chip");
    expect(panel).toContain("hasMessagesRef.current = messages.length > 0");
    expect(panel).toContain("followRef.current && hasMessagesRef.current");
});
