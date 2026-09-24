import { expect, test } from "bun:test";

// 2026-09-25 用户实测「节点右键 → 发送到 Agent 有时候没反应」：
// 旧实现把 prefill 存成字符串并以文本值去重——同一节点重复发送时值相同，
// React 状态不变 + 面板按值去重，命令被静默吞掉（面板常驻挂载，ref 跨开合不清）。
// 修复 = 自增 id 的命令语义（每次点击一条新命令），面板按 id 去重。
test("发送到 Agent 以自增 id 命令语义交付，面板按 id 去重", async () => {
    const [project, panel] = await Promise.all([
        Bun.file(new URL("../src/pages/canvas/project.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url)).text(),
    ]);
    // 父级：每次发送自增 id + 组合状态（值相同也是新命令）
    expect(project).toContain("agentPrefillIdRef.current += 1;");
    expect(project).toContain("setAgentPrefill({ id: agentPrefillIdRef.current, prompt:");
    expect(project).toContain("prefillPromptId={agentPrefill.id}");
    // 面板：按 id 去重，不得按文本值去重
    expect(panel).toContain("const prefillId = prefillPromptId ?? 0;");
    expect(panel).toContain("if (!value || prefillId === lastPrefillIdRef.current) return;");
    expect(panel).toContain("lastPrefillIdRef.current = prefillId;");
    expect(panel).not.toContain("lastPrefillPromptRef");
});
