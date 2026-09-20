# PRD: Agent 面板撤销接线（消费 undo 端点并真机自验）

## 背景

后端 `POST /agent/runs/:id/undo`（cloud_agent_undo.go）已实现：把云端画布回滚到**最近一次 Agent 画布 mutation** 之前的快照。前端 `undoAgentCanvasRun`（agent.ts:177）已封装。**面板零消费**——Agent 改坏画布后用户没有回滚入口。

## 后端契约（已存在，勿改语义）

- body: `{stepId?, expectedSnapshotHash(必填, 64hex), reason?(≤2000)}`
- 只能撤销**最新一次** Agent 画布 mutation（链式逐次撤销：撤一次后最新变为上一步）
- `expectedSnapshotHash` 必须 == 服务端当前云端画布 hash（防并发；mutation.AfterSnapshotHash 也须相等）
- 已提交生成任务的变更不可撤（不取消不退款）；status=undone/not_undoable 拒绝
- 成功: `{accepted: true, snapshotHash}` + 事件流发 `canvas_undone`（payload: canvasId/stepId/snapshotHash/reason）

## 前端缺口（本任务要补的）

1. **expectedSnapshotHash 无来源**：`canvas_updated` 事件 payload 不带 hash；`canvas_get_state` 是 LLM 工具非前端端点 → 需后端新增 undo 预检端点
2. **面板无撤销 UI**
3. **`canvas_undone` 事件未接 agent-canvas-sync**（payload 无 canvasPatch、不在 needsRefresh 类型表 → 撤销后本地画布不刷新）

## 设计

### 后端（小改）

- 新增 `GET /agent/runs/:id/undo-preview`：返回最新画布 mutation 的预检信息
  `{found, stepId, status, canUndo, blockReason?, afterSnapshotHash, hasSubmittedTask}`
  - 复用 `LatestCloudAgentCanvasMutation` + 当前画布 hash 计算（预检逻辑与 undo 主流程同源，抽公共函数）
  - blockReason 覆盖：已提交任务/已撤销/未保留快照/画布已变化/run 不存在
- handler → service 别名暴露

### 前端

- agent.ts: `previewAgentUndo(runId)`
- 面板（canvas-cloud-agent-panel.tsx）：run 完成（completed/failed/cancelled）后显示「撤销上一步」按钮
  - 点击 → preview → canUndo 则面板内轻确认（可填撤销理由，可选）→ POST undo
  - 成功：消息区追加系统条目「已撤销 <操作摘要>」+ 依赖 canvas_undone 事件刷新画布（双保险再手动 refreshCanvasAfterAgent）
  - 不可撤销：按钮禁用态 + blockReason tooltip
- agent-canvas-sync.receive(): `canvas_undone` → needsRefresh = true（走既有 refresh 限流通道）
- 样式走 theme token（面板既有 discipline）

### 本地画布刷新路径（既有，复用）

`refreshCanvasAfterAgent(canvasId)`：拉云端最新 → 本地无未同步编辑则覆盖；有冲突则报"保留本地"（S08 语义，不改）

## 验收标准（真机自验 checklist——完工后必须全过才算交付）

前提：dev 环境（vite polling 版 + 后端 8081 + floracheck），真实浏览器指针可点。

- [ ] A1 Agent 跑一轮会产生画布写的任务（如"创建一个文本节点写 XX"）→ 完成后面板出现「撤销上一步」
- [ ] A2 点击撤销 → 确认 → 画布中该变更消失（节点/连线回滚）→ 面板出现已撤销条目
- [ ] A3 撤销后再点 → 可继续撤销上一步（链式）；无可撤销时按钮禁用 + 原因可见
- [ ] A4 撤销后本地画布与云端一致（硬刷新后仍是回滚态）
- [ ] A5 Agent 变更后用户手动改画布 → 撤销被拒 → blockReason「画布已发生后续变化」正确显示，且不误伤
- [ ] A6 已提交生成任务的运行 → 撤销被拒提示正确
- [ ] A7 深色/亮色两套主题下按钮与确认态样式正常
- [ ] A8 不涉及 undo 的普通对话轮次 → 按钮不出现/不可用，不误显示

## 执行纪律（用户拍板，2026-09-18）

1. **完工 → 先真机自验一轮才进验收**：真实浏览器、指针可点、面板可见；不接受"代码接好了就当能用"
2. **验收全程只登记不修**：缺陷进本任务卡/pending-test（现象+复现步骤+截图），修复排验收后
3. **证据格式**：Agent 是 LLM 非确定流，不接受"跑通了"三个字——后续联调验收用三种权限模式 × 操作类型矩阵逐格打勾；每步证据 = 截图 + 会话记录落盘

## 边界

- 不做：批量撤销多步、撤销生成任务取消/退款、撤销历史时间轴 UI（只做"撤销上一步"链式）
- 不改：undo 主流程语义、S08 同步水位门、canvas_get_state
