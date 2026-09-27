# S1 执行计划

> 前置：先读 `design.md`。提交信息建议 `feat(canvas): 电商 starter 卡 - Agent 新对话点了就跑（自增 id 命令语义 + 成本知情）`。

## Step 0：核对（开跑前）
- [ ] 0.1 控制线复核稿到位（卡数量/文案）——未到前先按草案实现并在交付说明标注"文案以复核稿为准"。
- [ ] 0.2 `git status` 干净；`cd web && bun run typecheck` 基线 0。

## Step 1：数据 + 纯函数（含测试）
- [ ] 1.1 新建 `web/src/lib/canvas/canvas-ecom-starters.ts`（卡数据 + `resolveStarterRunDecision`）。
- [ ] 1.2 新建 `web/test/canvas-ecom-starters.test.ts`。
- [ ] 1.3 验证：`cd web && bun test test/canvas-ecom-starters.test.ts`。

## Step 2：命令通道扩展（project.tsx + panel）
- [ ] 2.1 `project.tsx`：`agentPrefill` 类型加 `submit?: boolean`；新增 `runAgentStarter`（id++ + submit:true + openAgent）。
- [ ] 2.2 `canvas-cloud-agent-panel.tsx`：props 加 `onStarterPrompt`；effect 消费 `submit`；`submitRef` 桥接；忙态 toast「正在创作中，请稍候」。
- [ ] 2.3 静态护栏测试 `web/test/agent-starter-command.test.ts`。
- [ ] 2.4 验证：`bun test test/agent-starter-command.test.ts test/agent-send-prefill-command.test.ts`（旧护栏不回归）。

## Step 3：UI 卡面
- [ ] 3.1 `canvas-agent-welcome.tsx`：新增电商分组 + 卡渲染（图标 + 标题 + 副标题）。
- [ ] 3.2 `canvas-cloud-agent.css` 追加组件级类（如需）；**零 `globals.css` 改动**（diff 自证）。
- [ ] 3.3 免费通道判定接线（若链路可用；否则记录降级+后续项）。

## Step 4：门禁 + 真机走查
- [ ] 4.1 `cd web && bun run typecheck`（=0）；`cd web && bun run build`（通过）。
- [ ] 4.2 `cd web && bun test` 全量对照红基线（15 条内放行；名单外红=stop 报控制线）。
- [ ] 4.3 真机走查（:3010/:8483）：新对话 → 点击卡 → 跑起来 → 连点 → toast → 截图留证（`.local/` 或任务目录）。
- [ ] 4.4 `pending-test.mdx` 登记（S4 迁移前用旧路径）。

## Step 5：交付
- [ ] 5.1 独立 commit（仅 S1 文件集）。
- [ ] 5.2 汇报：状态 + 门禁结果 + 截图索引 + 文案复核稿落地情况。

## 回滚点
- 全量 revert 单 commit；或按 Step 拆 revert（Step 2 回退即恢复"仅填充"行为）。

## 执行记录（2026-09-27）

- 交付物：`web/src/lib/canvas/canvas-ecom-starters.ts`（新增）、`web/test/canvas-ecom-starters.test.ts`、`web/test/agent-starter-command.test.ts`（新增）、`project.tsx` + `canvas-cloud-agent-panel.tsx` + `canvas-agent-welcome.tsx` + `canvas-cloud-agent.css`（扩展）、pending-test 登记。
- 门禁：typecheck=0；build ✓；focused 6 绿（3 测试文件）；全量 2292 tests → 15 红 = 冻结基线（4 白名单 + 11 上游原生，名单外零红）。
- 真机：四卡渲染 / 点击立即起跑（Agent 读画布）/ 3:4 详情图真实产出图像节点 / 运行中二次点击 → toast（详见 design §8）。
- 加固：决策函数 `pending` 分支（同 tick 二次命令不再静默）；对应单测与静态护栏更新。
- 截图索引：`.local/s1-walkthrough/01|02|03|04b|05-*.png`（本地留存，不入库）。

## 重构执行记录（v2，2026-09-27）

- 触发：控制线【S1 退回重构裁决】（盲跑 / 入口不可见 / 定位错误三问题）。
- 交付物变更：canvas-ecom-starters.ts（四段「意图+澄清指令」文案；旧半句模板移除）、canvas-agent-welcome.tsx（三级布局重构）、canvas-cloud-agent-panel.tsx（tier 计算 + more 状态 + capsules 同态）、canvas-cloud-agent.css（compact 变体 + 更多行样式）、agent-panel-layout.ts（tier 阈值纯函数）；测试新增/更新 3 文件。
- 门禁：tsc=0；build ✓；focused 22 测绿；全量对照冻结基线（15 红名单内）。
- 真机（Orca + :3010/:8483）：四卡单轮澄清全过；无图直出全链（复述→审批→生成完成→回写节点）；默认窗高四卡可见；三态截图；守卫 toast 复测入镜。详见 `.local/s1-walkthrough-v2/evidence-notes.md`。
- 消耗：CPA 文本运行 + 1 张图（0.001 积分），可控。

## S1.1 执行记录（v3，2026-09-27）

- 交付物：canvas-ecom-starters.ts（图标表迁入 + findEcomStarterCardByPrompt）、canvas-agent-welcome.tsx（standard 补 footnote；导入改共用图标表）、canvas-cloud-agent-chat-ui.tsx（AgentStarterChip）、canvas-cloud-agent.css（chip 样式）、canvas-cloud-agent-panel.tsx（贴底守卫）；测试增补 chip 判定与静态护栏。
- 门禁：tsc=0；build ✓；focused 23 绿；全量 2295→15 红全基线；负载 flake ×2 已隔离归因（见 v3 evidence-notes）。
- 真机：chip 折叠/展开（12/13）、三态（640/1080/1216 → 14/15/16）、P2 锚点（14）。新 UI 面清单已列（v3 evidence-notes）。

## S1 v3.2 执行记录（v4，2026-09-27；终版）

- 交付物：canvas-agent-scene-cards.tsx（新增）、canvas-ecom-starters.ts（resolveSceneStarterCards）、canvas-agent-welcome.tsx（重写：hero→通用三卡→辅助行 + drilledScene）、canvas-cloud-agent-chat-ui.tsx（onActiveChange ×2）、canvas-cloud-agent-panel.tsx（drilledScene/静默挂载/焦点/卡区渲染）、canvas-cloud-agent.css（compact 重排 + 卡区样式 + 死类清删）；测试新增 agent-scene-cards.test.tsx、重写 agent-starter-command v3.2 段、扩充 canvas-ecom-starters；PATCH-MAP 行为层分歧 B1。
- 归属：上游原生（#608）→ PATCH-MAP 登记。
- 门禁：tsc=0；build ✓；focused 18 绿；全量 2301→15 红全基线（双跑）。
- 真机：矩阵 01–13（含 toast）、焦点迁移、静默挂载、点卡不挂技能、预算实测。见 v4 evidence-notes。

## S1 v4 执行记录（v5，2026-09-27；基线不减终版）

- 交付物：welcome 还原基线（0 diff）；panel 移除 tier/贴底守卫（净 −23 行）；lib 移除 tier 体系（−16 行）；css 删 welcome 变体（净 −35）；测试同步（tier 用例删除、welcome 基线断言、chip + 基线滚动断言）。
- 对照：基线只读实例（/tmp 临时 worktree @5a567238，:3012）vs 我方 fresh origin（:3013）；截图 b1–b6 / m1–m6 + cmp/*（sxs + 数值 diff）。
- 门禁：tsc 0；build ✓ 1m33s；focused 24 绿；全量 2299 → 15 红全基线。
- 行为：静默挂载/点卡 chip/焦点迁移/钻取联动 复测 ✓（v5 evidence-notes）。
