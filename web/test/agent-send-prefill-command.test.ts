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
    // ★ S-2 修复（2026-10-05）：两通道各自独立去重 ref，且**都要执行** ——
    // 原共享 lastPrefillIdRef + prefillRequest 提前 return 使 fork 通道永不可达。
    expect(panel).toContain("const prefillId = prefillPromptId ?? 0;");
    expect(panel).toContain("lastPrefillRequestIdRef");
    expect(panel).toContain("lastPrefillPromptIdRef");
    expect(panel).toContain("prefillId !== lastPrefillPromptIdRef.current");
    // ★ 反向：不得再共享单一 ref（两通道 id 空间不同，共享会互吞命令）
    // 注意：不能用 not.toContain("lastPrefillIdRef") —— 它是两个新 ref 名的子串。
    // 用词边界精确匹配旧名。
    expect(/\blastPrefillIdRef\b/.test(panel)).toBe(false);
    // ★ 反向：prefillRequest 分支不得 early-return 吞掉 fork 通道。
    // ★ P2-1 修复（评审线 R4）：原实现直接 slice 两个 indexOf ——
    // 若锚点字符串在回归时消失（最自然的回归写法正是改回 `if (prefillRequest) {`），
    // slice(-1, N) 得空串 ⇒ `not.toContain("return;")` 恒真 ⇒ **假绿**。
    // 修法：锚点存在性前置断言（V9 ②「锚点消失」族的硬要求）。
    const requestBranchStart = panel.indexOf("if (prefillRequest && prefillRequest.id !==");
    const requestBranchEnd = panel.indexOf("const value = prefillPrompt?.trim();");
    expect(requestBranchStart).toBeGreaterThan(-1);
    expect(requestBranchEnd).toBeGreaterThan(requestBranchStart);
    const requestBranch = panel.slice(requestBranchStart, requestBranchEnd);
    expect(requestBranch).not.toContain("return;");
});
