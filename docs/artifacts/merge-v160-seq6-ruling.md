# merge-v1.6.0 序6 · 控制线裁决终版（2026-09-30）

> 本文件为序7 终审的输入。记录序6 裁决过程、控制线自身的 6 笔裁决错误、
> 以及序7 所需的全部状态。**裁决纪律教训：所有断言必须贴证据行，未读证据不裁决。**

## 一、批状态快照

| 项 | 值 |
|---|---|
| 批树 | merge-v1.6.0 @ `fc8337f9`（worktree `/mnt/f/CODE/Project/oac-wt-merge-v158`，clean） |
| 批链 | 8eca2f5c → 95d73d99 → 2d6a3655 → 9783b0c4 → 4781b991 → 790e453f → fc8337f9 |
| 测试线 | `621283f` + `bf0131a`（open-ai-canvas-testing master，不 push） |
| 序1-5 | 全部 ✅（控制线独立验收） |
| 序6 | **通过**（附报告补正指令，已转发测试线） |
| 序7 | 待测试线补正回报后启动 |

## 二、序6 终版裁决（已转发测试线，原文见会话）

**接受**：S1 迁移冒烟（748 画布/6 渠道/49 模型/103 任务，零丢失）；S3 VRT 三面重采；
S4 红基线重导出（go 28 包 0 FAIL）。

**跑3 定性**：S3/S4 专项属任务书「S1-auth → S7-ui-controls」字面范围，执行可接受。
任务书「五跑」措辞歧义 = 控制线起草债，下批模板改为「五跑 = 五轮覆盖全谱」。

**报告补正 4 项**（测试线执行中）：
1. 跑4「429 限流」归因**无日志依据**（run4/run4b 中 "429" 出现 0 次；
   ①② 实际失败 = 重定向 /login 20s = 登录态失效）—— 测试线需给出 429 出处或更正
2. 跑4 实为 4 次尝试（run4 1/4 → run4b 3/4 → run4c ④单跑 → run5 4/4），报告按此更正
3. **控制线撤回对测试线 S4 归因的“纠正”** —— 测试线原归因「产品行为变更 +
   档位模型调整」方向正确。终版归因：非本批引入；批外 O-03 变更（1b3cd2df 等
   4 提交，e8e6261e..507a4c07）+ 默认模型变化（grok-imagine → gpt-image-2 ·
   ddcat-影策，截图实证）+ spec 断言绑定 grok-imagine 档位
4. S4 spec 更新授权：能力驱动断言 + 保留比例组分支用例 + 保持 SPECIAL 门

**挂账**：7 mock-leak 红 = bun mock.module 进程级泄漏（测试基建债），登记
known-test-infra-failure + 独立任务卡，不阻塞序7。
stack-up.sh 需回写 `backend/agent-runtime/pi` npm install（第二次因依赖缺失误判超时）。

## 三、控制线本轮 6 笔裁决错误（教训归档）

| # | 错误 | 正确结论 |
|---|---|---|
| 1 | 「任务书未授权 S4 专项」（未读任务书的猜测） | 任务书字面含 S1→S7，执行可辩护 |
| 2 | 「跑3 整体无效，重跑 S2」（过度反应） | 五跑覆盖全谱，可接受 |
| 3 | 「跑4/5 用 S7_CONTROLS 门控」（凭空编造） | 日志无此变量；S7 已 2026-09-23 转正常跑 |
| 4 | 「3 skipped = S3/S4/S7」（误读） | 3 skip 全是 S6-storyboard 内部 test.skip |
| 5 | 照单接受「429 限流」（未读日志） | 0 次 429；实为登录态失效 |
| 6 | 「非产品行为变更」纠正测试线（纠正本身错） | 测试线归因方向正确；控制线补充证据链 |

**根因**：全部所需事实（5 份日志、error-context、截图、git 历史、任务书原文 #8517）
均可直接读取，读证总共十几分钟。错误不来自“忘记”，来自**研究模式的合理推断
替代了工程裁决的先证据后结论**。

## 四、序7 输入清单

1. 测试线补正回报（4 项 + S3 VRT“为什么” + 7 红挂账登记 + 基建回写）
2. 序7 动作：控制线终审（新红基线 0 红定义入档）→ 用户真机抽验
   （Agent 面板三面 / 迁移后画布完整性 / 旧数据兼容）→ push 到 fork main
3. 序7 纪律（用户裁决中）：每条裁决必须先贴对应日志/git 证据行

---

## 五、序7 终审（2026-09-30 · 控制线）

### 0 红基线定义（入档，即刻生效）

```
web 单测（bun test，web/ 目录内）：0 产品红
  · 已知例外 = known-test-infra-failure 登记项（当前 7 项，
    bun mock.module 进程级泄漏，见测试仓 docs/backlog.md）
  · 例外口径：逐名 + 根因 + 复现命令 + 修复方向 + 验收目标（7→0），
    任何新例外必须控制线裁决后登记，不得静默豁免
go 全量：28 包 0 FAIL（@fc8337f9，13.3m，internal/app 847.8s）
e2e 五轮：S1/S2/S5/S6 门内全绿 + S7 四用例绿（run5 final）
  + S3 专项绿；S4 专项 = spec 已按能力驱动校准（1 passed / 1 skipped）
VRT：dark 7 / light 7 / ws 2 全绿；面③已回滚（动态数据视图，
  采集前稳定化 = 基建债 backlog）
旧 15+7=22 红基线：作废（15 项随序2/3/4 转绿，7 项转入 known-test-infra-failure）
```

### Rider 2 裁决（用户已批：按控制线建议）

不并入本批。序7 push `fc8337f9` 后，rider 2（上游 eb13f736 系，
12 提交 / 227 文件 / v1.5.9 + agent 大重构）开 **v1.6.1 批**。

v1.6.1 recon 待办（已登记）：
1. agent 拆分 hunk 映射：上游 7f5d87ef 把 F1/F2/F4/F5 四域拆散
   （panel −1022 → panel-parts+685 / events+348 / composer+539 / attachments+21；
   chat-ui −587；project.tsx −75；node-content −821）—— fork 增量
   （panelLayout ×9 / AgentUndoBar / prefillPromptId）需逐 hunk 重新挂位
2. card06 域新结构重核：上游把 user-data-sync.ts 媒体键收集拆出
   user-data-sync-media.ts（123 行）；水位门/退避本 rider 零触碰（已验），
   但下一批动该域前按 09-22 规格做 merge-file 独立重跑（针对新文件结构）
3. 227 文件按完整批纪律走：recon → 任务书 → merge → 门禁 → 测试线

### push 计划（待用户真机抽验后执行）

```
拓扑（已验）：
  fork/main = 507a4c07（= main 与批树分叉点）
  本地 main = fork/main + 21 提交（纯 docs/artifacts/*，零代码交集）
  merge-v1.6.0 = fork/main + 67 提交（批增量）
动作：
  1. main merge merge-v1.6.0（预期零冲突——docs 与批零交集）
  2. 自检：merge 后 web/backend 树内容 = fc8337f9 位级一致
  3. push main → fork/main
```

### 序6 闭合确认

S1 ✅ 迁移冒烟（748 画布/6 渠道/49 模型/103 任务零丢失）
S2 ✅ 五轮 + 补正（429 撤回；run4 如实呈现 4 次尝试；global-setup
     吞错真因 = waitForURL().catch(()=>{}) + 无条件 storageState，backlog 在案）
S3 ✅ 两面重采（面① CSS 1119 行已独立复核；面② 几何可复算）+ 面③回滚
S4 ✅ 7 红挂账 + spec 能力驱动校准 + stack-up.sh 基建回写（undici 前置检查）

序1-7 全链：✅✅✅✅✅✅（序7 = 本档 + 用户抽验 + push）
