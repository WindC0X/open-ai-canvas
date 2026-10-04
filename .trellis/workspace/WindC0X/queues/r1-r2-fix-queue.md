# A线 R1+R2 修复批队列（仓库侧持久化）

> ★ 落盘理由：评审线 R3 教训「跨重启产出持久化」—— /tmp 产出重启全丢，
> 队列应同步落盘仓库侧（`.trellis/workspace/<dev>/queues/`）。
> 登记时点：2026-10-05（重启后重建，内容取自本会话消息原文）。

## 范围（9 条 P1 + 1 条降级，评审线已核验 confirmed）

### C 组（AST-08 —— 查询面与删除面同根不同源；正解 = 抽共享过滤函数，两条支路同时收口）
- **C-1** 方向二归属校验顺序倒置（表述按核验修正：归属校验未前置，错误码泄漏他人记录状态）
- **C-2** 自引用计入引用者（预检说仍被引用，删除却成功——已独立复现）
- **C-3** 已结束任务日志/结果计入（删除面明确跳过）
- **C-4** 裸 URL 标量文档查询面漏（删除面拦得住）
- **C-5** 解析失败静默吞（注释描述的 unknown 通道不存在）
  - ★ **排 C 批最前**（控制线 2026-10-05 精化：唯一不依赖数据形态即触发的项）

### F 组（计费，F-1+F-2 强耦合）
- **F-1** 归属修正：backend 本批零改动——是本批新开下拉入口使既有后端语义不一致变为**可达**；
  修法 = 配置入口收窄 + 后端语义对齐
- **F-2** 计费修复无回归测试（闭环）
- **F-3**「size 修复贯通」是测试镜像实现（真接线在 `use-canvas-media-tools.ts:1572-1576`，
  测试未经过）⇒ 补接线级断言
- ★ **NaN/Infinity 复算确认**（控制线现场核对成立）：
  Infinity 穿过 `>0` 守卫 → 序列化出 `NaNxNaN` 形态；
  `priceTierPayloadFromForm` 的 `Math.round((tier.unitPrice || 0) * 1_000_000)` **无 isFinite 守卫**。
  修法：`unitPrice` / `inputTokenPrice` / `outputTokenPrice` / `cachedTokenPrice`
  及 **cost 系全组**补有限性守卫（或入口 InputNumber 层拦截 + payload 层双保险，两层都要）

### A 组
- **A-2** 片 7 motion prompt 33/33 空 + 测试假绿（修测试与验证记录，非代码；
  核验修正：本枝无消费者，影响 = 未来消费侧拿空串）
- **A-1**（降 P2）：前端消费侧版本校验未落 + 验证记录登记缺口——低优先，随批或缝隙池

## R2 追加（评审线 R2 · sync 面，控制线现场复核成立）

与 R1 同批或紧随小批（自判，保持批名-范围一致）。

- **S-2** prefill 双通道短路：`canvas-cloud-agent-panel.tsx:349-365` effect 的 `prefillRequest`
  提前 return 使 fork 通道（`prefillPrompt`/`prefillPromptId`）**永不可达**；
  调用方 `project.tsx:514-515` 双写。
  修法二选一（判后报）：① 两通道独立 ref（保留上游 append + fork 替换，各自去重）
  ② 单通道收敛（需说明上游语义如何保留）
- **S-3** 文档死链：`features.mdx:28` + `http-api.mdx:92` 改
  `/docs/reference/backend/update-announcements` + 扫 docs/ 同源旧路径引用
- **S-4** 孤儿令牌 + PATCH-MAP 回填：`globals.css L1287` 删
  `--canvas-mention-chip-offset-y` 定义（使用点已随上游删除）
  + PATCH-MAP L1 处置列回填「2026-10-04 sync #2 接受上游值（三方差分确认 fork 未改）+ 无覆写需求」
- **S-1** ritual 条款（不改历史）：「合并 commit 必须自身可编译 + 最终态验证记录」
  写入 sync ritual 检查项（落点：PATCH-MAP 或 journal 固定段，自判）

## 顺带（自判并入）
superres catch rider 与 F 组同文件面邻近（`use-canvas-media-tools.ts`）⇒ **并入本批**。

## R3 新增（评审线 R3，控制线待裁归属）
- **T1-P1** workspaceType 全仓无写入者 ⇒ 过滤/首入整理/headless 语义空转。
  我方独立核实**属实**；按设计卡属 B 线（直线入口卡 L244「消费姊妹卡的 workspaceType」），
  但 B 线实现零命中 ⇒ **跨卡接缝未接**。归属待裁。
- **T2-P1a** 分页层过滤致计数/内容不一致（评审线措辞「死锁」偏重）。
  属我批（canvas/index.tsx）。修法二选一：服务端过滤 / 前端计数改按过滤后算。待裁。
- **T2-P1b** 生成中 /create 钉死 `showOpenInCanvas={false}` 与硬验收②「任一步可达」冲突。
  属我批（linear-flow-runner.tsx:269）。待裁：本批补或随 R1+R2。

## P2 台账（无需处理）
P2 十三条已入缝隙池台账。若与批面文件重合可顺带（报备即可）：
- P2-2 语义择一注释
- P2-4 预算测量产物
- P2-11 watermark 只写不读

## 纪律
- 接线级测试（行为/渲染/反例，不得纯函数镜像）
- 报告断言逐条对码
- precheck sync 触碰面
- 分支 `fix/w5-review-r1-a`
- 门禁绑定 commit
- journal 逐条
- branch-only
