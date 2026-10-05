# R4 第一段评审报告 · B线 T1-P1 回归面（评审线 · 第四线）

**锚点**：`45d0d583`（merge，parents `06bf455a` + `9bacde62`；T1-P1 代码 commit = `382de2cc`）
**范围**：`git diff 45d0d583^1 45d0d583` = 5 文件（4 代码/测试 + journal）
**方法**：独立行级评审 + 8 轮注入证伪实验 + 全量/隔离双跑测试 + V7 声称对码
**环境**：动态验证树 `oac-wt-baseline @ 45d0d583`（隔离树，ext4）；未在 `/mnt/f` 跑测试
**产出**：本文件 + `.trellis/workspace/WindC0X/review/r4/batch-B-t1p1.md`（已 commit + 推 fork）

---

## §0 门禁（G1/G5 口径）

```
tip = 45d0d583（G5 绑定）
文件面（git diff ^1）= 5 个：journal-1.md / create/index.tsx / creation-canvas-conversation.ts / user-data-sync.ts / headless-workspace-writer.test.ts
对照 git show 口径 = 1 个（差 4 个本批核心文件——G1 价值再次验证）
```

---

## §1 结论摘要

| 项 | 结论 |
|---|---|
| **写入机制正确性** | ✅ 正确（service 层新建分支透传，existingId 分支不覆盖；8 轮注入 6 轮变红） |
| **打标范围语义** | ✅ 正确（卡流程两分支打标 / :862 既有创作交接不打标，依据设计卡 §4.2） |
| **★ 容器孤岛** | ❌ **P1**：容器建成后**无任何 UI 路径可再次进入**（列表已过滤 + 任务面无任务 + snapshot.canvasId 零消费） |
| **★ 测试隔离缺陷** | ❌ **P1**：本批 5 条测试在全量跑时**必失败**（被 `user-data-sync-load-deadlock.test.ts` 的 mock.module 泄漏污染） |
| **★ 门禁声称不复现** | ❌ **P1**：B线 声称「全量 3057 pass·0 fail」，实测 **3045 pass / 12 fail**（两次复跑一致） |
| 源码文本断言 | ⚠️ **P2**：注释掉调用 → 7 pass 假绿（与 R3 教训同族） |
| Pick 白名单无运行时守卫 | ⚠️ **P2**：删除白名单 key → 测试与 tsc 均不报（spread 击败 excess property check） |
| 契约一致性 | ✅ 通过（`isHeadlessTaskWorkspace` / `filterVisibleCanvasProjects` / `shouldTidyHeadlessCanvas` 同源） |

**计数：P0=0 · P1=3 · P2=2 · P3=2**

---

## §2 P1（3 条）

### P1-1 容器孤岛：headless 容器建成后无 UI 路径可再次进入

**位置**：`web/src/pages/create/index.tsx:1152/1176`（打标）→ `web/src/pages/canvas/index.tsx:108`（列表过滤）→ `web/src/pages/canvas/project.tsx:3022`（任务面）

**证据链（三条路径全断）**：

| # | 可能路径 | 实际状态 | 证据 |
|---|---|---|---|
| 1 | 画布列表 | ❌ 被过滤 | `filterVisibleCanvasProjects` 在 `index.tsx:108` 过滤掉全部 headless；全仓仅此一处列表入口 |
| 2 | 任务面「在画布中打开」 | ❌ 容器内无任务 | `useCanvasActiveTasks` 用 `activeOnly: true` **且** `task.projectId === projectId` 过滤（`use-canvas-active-tasks.ts:12,24`）；而 runner 创建任务时**不传 projectId**（`linear-flow-runner.tsx:183-192` 的 `runBackendGenerationTask` 参数无 projectId）⇒ 容器内任务面恒空 |
| 3 | `CreationConversation.canvasId` | ❌ 只写不读 | `creation-types.ts:38` 有字段、`index.tsx:864` 有写入，但全仓**零读取点**（grep `.canvasId` 命中均为画布侧无关字段） |

**用户实际体验**：
- carrier 阶段点「在画布中打开」→ 立即 navigate 到容器 → **当场看到**容器（此时唯一可达时刻）
- 用户离开该页面后（刷新/切走/关标签）→ **无法再回来**：
  - 画布库看不到它（已过滤）
  - 容器内任务面板为空（任务无 projectId + `activeOnly` 双重过滤）
  - `/create` 的会话历史点回该会话 → 只回到 `/create`，不导航画布（`canvasId` 无消费）
- **数据不丢**（画布在 store/云端），但用户**找不到入口** ⇒ 对小白用户等价于「产物消失」

**与设计卡的张力**：设计卡 §4.2 说「用户通过任务面的『在画布中打开』到达，不靠翻列表发现」——但该入口在**容器内**（`project.tsx:3022` 挂 `CanvasActiveTaskPanel`），而容器内恰好看不到任务。**入口与被到达对象自指**。

**修复方向**（三选一，建议 a）：
- (a) **列表不隐藏、改为折叠/分组**：headless 容器进「任务产物」分组（用户可主动找到）
- (b) **`/create` 会话历史加「回到画布」入口**：消费 `conversation.canvasId`（字段已有，零新数据）
- (c) 任务面跨画布可见：容器内任务面按 `taskIds`（会话 meta 已有）而非 `projectId` 过滤

**补充**：本批自述称「真机三条验收全过」——①「画布库不显示」✅ 已验；但**未验「用户如何再找到它」**。这是 V1「验证形态必须匹配被验证对象」的缺口：验的是「隐藏成功」，未验「可达性」。

---

### P1-2 测试隔离缺陷：本批 5 条测试在全量跑时必失败

**位置**：`web/test/headless-workspace-writer.test.ts`（新增，无 `hydrated: true` 设置）

**证据**（可复现，两次全量跑一致）：
```
cd /home/windc0x/oac-ext4/oac-wt-baseline/web && bun test
→ 3045 pass / 12 fail（Ran 3057 tests across 364 files）

失败中的 5 条 = 本批全部 5 条行为测试：
  (fail) 卡流程交接（带 workspaceType）在新建容器时写入 headless_task
  (fail) 既有创作交接（不带 workspaceType）保持 standard —— 不写字段
  (fail) existingId 分支不覆盖既有画布的 workspaceType
  (fail) existingId 分支不被反向改写
  (fail) 同一会话第二次交接（命中 existingId）不改变已有标记
报错：error: 画布资料正在加载，请稍后继续。
      at continueCreationConversationOnCanvas (.../creation-canvas-conversation.ts:26:56)
```
**隔离跑**（`bun test test/headless-workspace-writer.test.ts`）→ **7 pass / 0 fail**。

**根因**（二分定位）：
```
for f in agent-canvas-refresh asset-batch-delete canvas-asset-repair canvas-remote-revision user-data-sync-load-deadlock; do
  bun test test/$f.test.ts test/headless-workspace-writer.test.ts | grep -c 本批失败
done
→ 仅 user-data-sync-load-deadlock 触发（4 条失败）
```
`web/test/user-data-sync-load-deadlock.test.ts:19-29` 用 `mock.module("../src/stores/canvas/use-canvas-store", ...)` 把 store 换成**桩**（其 `setState` 只处理 `patch.projects`，不处理 `hydrated`），bun 的模块 mock 是**进程级跨文件泄漏** → 后续文件的 `useCanvasStore.getState().hydrated` 恒为 `false` → 本批测试在第 26 行守卫处抛错。

该文件自己的注释已预警此风险（`:14-15`：「本仓其他测试文件会 mock.module 掉画布 store（bun 的模块 mock 是进程级、跨文件泄漏）……这里不依赖加载顺序」）——但**它自己也是污染源**。

**影响**：
- 本批 5 条核心行为断言（写入/不覆盖/反向改写）**在 CI 全量门禁下全部失效** ⇒ 回归保护实际为零
- B线 声称的「全量 3057 pass·0 fail」与此矛盾（见 P1-3）

**修复方向**：`beforeEach` 显式 `useCanvasStore.setState({ hydrated: true, projects: [] })`（一行，与本仓其他测试一致）；根治需治 `load-deadlock.test.ts` 的 mock 泄漏（改 `mock.restore()` 或移到子进程）。

---

### P1-3 门禁声称与实测不符：B线 自述「全量 3057 pass·0 fail」，实测 12 fail

**位置**：commit `382de2cc` 自述末段：「门禁（绑定本 commit）：tsc 0 / eslint 0（4 文件）/ 关联回归 53 pass / **全量 bun test 3057 pass·0 fail**（364 文件）」

**证据**：
```
oac-wt-baseline @ 45d0d583（= 该 commit 的合并结果），web/：
bun test → 3045 pass / 12 fail（Ran 3057 tests）  ← 两次复跑一致
```
- 「3057」是**总数**（pass+fail），被写成「pass」⇒ 数字口径错位
- 12 fail 中 **7 条是 V4 已登记基线**（`canvas-asset-repair` mock-leak 族），**5 条是本批新增**（P1-2）
- 若 B线 在 drvfs（`/mnt/f`）上跑，可能因 IO 差异得到不同结果；但 V6 明确「动态验证只在 ext4 上跑」⇒ 应以 ext4 结果为准

**与 V7「报告断言逐条对码」的关系**：本条的「0 fail」是**未对码的声称**，且掩盖了 P1-2 的测试隔离缺陷。若按 V4 基线对照法（「失败对照环境基线」），5 条新失败本应被识别。

**修复方向**：① 修 P1-2 使本批测试在全量下通过；② 报告口径改为「pass/fail 分列 + 失败对照 V4 基线」；③ 门禁脚本加「新增失败 vs 基线失败」的差分断言。

---

## §3 P2（2 条）

### P2-1 源码文本断言对「注释掉调用」不具证伪性（与 R3 教训同族）

**位置**：`web/test/headless-workspace-writer.test.ts:178-190`（接线级断言）

**证据**（注入 5）：把 `create/index.tsx:1152`（carrier 打标行）**整行注释** → `bun test` = **7 pass / 0 fail**（假绿）。
对照：**删除**该行 → 6 pass / 1 fail（变红）。

**机制**：断言用 `source.match(/\}, \{ workspaceType: "headless_task" \}\);/g)` + `toHaveLength(2)` —— 注释掉的文本仍参与匹配。

**影响**：本批最想防的失效模式（接线被摘）中，「注释掉」这一日常形态测不到。R3 报告已对 `task-face-workspace-type.test.ts` 提过同类问题（P1-1），本批新增测试**重复了同一形态**。

**修复方向**：先 `stripComments()` 再匹配（同批 `task-face-independence.test.ts:29-34` 已有该范式，可直接复用）。

---

### P2-2 Pick 白名单扩展无运行时/类型守卫（删除后测试与 tsc 均不报）

**位置**：`web/src/services/user-data-sync.ts:710`

**证据**（注入 8）：删除 Pick 白名单中的 `"workspaceType"` → `bun test` = **7 pass / 0 fail**；`bunx tsc --noEmit` = **exit 0**（均不报）。

**机制**：调用点用条件展开 `...(options?.workspaceType ? { workspaceType: ... } : {})`（`creation-canvas-conversation.ts:68`）——**spread 击败 TypeScript 的 excess property check**（TS 已知行为：对象展开的联合类型不参与多余属性检查）。而 `updateProject` 运行时是 `{ ...current, ...patch }` **全量合并、不做 key 过滤**（`use-canvas-store.ts:543-556`）⇒ Pick 白名单**仅编译期**约束，且该约束被 spread 绕过。

**影响**：白名单被收窄（如未来重构）时无任何门禁报警，`workspaceType` 会静默不落库 ⇒ 容器打标失效且测试全绿。属「类型声明边界 ≠ 运行时保证」（R3 教训家族 5）。

**修复方向**：① 调用点改为显式对象构造（不用条件展开），恢复 excess property check；② 或 `updateProject` 加运行时 key 白名单断言；③ 补一条「白名单收窄 → 测试必须红」的元测试。

---

## §4 P3（2 条）

| # | 内容 | 位置 |
|---|---|---|
| P3-1 | `CreationConversation.canvasId` 写而不读（快照字段成死数据）——本批未引入但被 P1-1 放大 | `creation-types.ts:38`；`index.tsx:864` |
| P3-2 | 已知缺口①（任务无 projectId）在代码注释中登记，但其影响被低估为「面板看不到」，实际是 P1-1 路径 2 断链的直接原因 | `create/index.tsx:1135-1136`；`linear-flow-runner.tsx:183-192` |

---

## §5 注入证伪矩阵（8 轮，实测）

| # | 注入内容 | 结果 | 判定 |
|---|---|---|---|
| 1 | existingId 分支也写 workspaceType（覆盖既有画布） | **4 pass / 3 fail** | ✅ 护栏有效 |
| 2 | 新建分支不传 workspaceType（写入者失效） | **4 pass / 3 fail** | ✅ 护栏有效 |
| 3 | carrier 分支漏打标（删 1152 行） | **6 pass / 1 fail** | ✅ 护栏有效 |
| 4 | result 分支漏打标（删 1176 行） | **6 pass / 1 fail** | ✅ 护栏有效 |
| 5 | **注释掉** carrier 打标行 | **7 pass / 0 fail** | ❌ **假绿** → P2-1 |
| 6 | carrier 改传 `standard` | **6 pass / 1 fail** | ✅ 护栏有效 |
| 7 | `:862` 显式传 `standard`（测反向断言） | **6 pass / 1 fail** | ✅ 护栏有效 |
| 8 | **删 Pick 白名单 `workspaceType`** | **7 pass / 0 fail** + tsc exit 0 | ❌ **假绿** → P2-2 |

**证伪率**：6/8 有效，2/8 假绿（均为 P2 级，不阻塞但需修）。

---

## §6 控制线四重点对账

| 重点 | 结论 |
|---|---|
| ① 打标范围语义正确性 | ✅ 正确。卡流程两分支（carrier `:1152` / result `:1176`）打标；`:862` 既有创作交接保持无参。依据设计卡 §4.2「headless = 用户未主动进入画布、画布只是产物承载方式」——卡流程主路径是「点卡→出图→下载」，画布是可选承载 ⇒ 符合；`:862` 是用户显式「转入画布」⇒ 不符合。**语义判断成立** |
| ② service 层「只在新建分支生效」边界完整性 | ✅ 正确。判定 `source.canvasId \|\| local?.id` 覆盖两条路径；existingId 分支的 `updateProject` 调用**不含** workspaceType（`:62` 行实测）；4 条 existingId 测试 + 注入 1 验证 |
| ③ 测试 6/7 的源码文本断言是否构成 P2/P3 | ✅ **构成 P2**（见 P2-1）——注释掉调用假绿，与 R3 教训同族；同批另有 P1-2 的隔离缺陷（更严重） |
| ④ `user-data-sync.ts` Pick 白名单扩展的其他调用方影响 | ✅ 无回归。`createCanvasProjectWithRemoteSync` 共 6 个调用点（`canvas/index.tsx:100,406`、`use-canvas-project-lifecycle.ts:321`、`creation-agent-entry.tsx:30`、`projects/detail.tsx:92`、`creation-canvas-conversation.ts:65`），**仅本批调用点传 workspaceType**，其余形态不变（前 3 个只传 title；detail.tsx 传 `{nodes, connections}`；agent-entry 只传 title）⇒ 无影响 |
| ⑤ 与 headless-tidy / workspace-type 契约一致性 | ✅ 一致。`workspace-type.ts:12` 的 `isHeadlessTaskWorkspace` 被 `headless-tidy.ts:26` 与 `index.tsx` 过滤共用；`undefined → standard` 零迁移语义贯通（写入侧 `...(cond ? {...} : {})` 缺省不写字段，读取侧 `=== "headless_task"` 严格等值） |

---

## §7 需真机验证的点（供测试线任务书引用）

1. **P1-1 容器孤岛**（★ 最高优先）：真机走完「点卡→出图→点在画布中打开→离开→尝试再进入」全链，确认**是否存在任何可达路径**。建议同时验证：① 画布库是否真的完全看不到容器；② 容器内任务面板是否为空；③ `/create` 会话历史是否有回画布入口。
2. **P1-2 测试隔离**：CI 全量门禁下本批测试是否失败（本地已复现，需确认 CI 环境一致）。
3. **验收 8 首入整理**：headless 容器首入时整理是否触发（依赖 `workspaceType` 正确落库 + 首入标记逻辑）。
4. **反向（防过度打标）**：`:862` 转入的画布是否保持 standard 且正常出现在列表。

---

## §8 覆盖声明与未做项

- **已做**：8 轮注入证伪、全量/隔离双跑测试、二分定位污染源、6 个调用点核对、契约一致性核对、V7 门禁声称对码。
- **未做**：真机验收（归测试线，见 §7）；未跑 eslint（本批自述 4 文件 0，未复核）；未验证后端 `user_data_page.go` 在本批的行为（本批未改后端，其透出逻辑在 `6fab9f48` 已验）。
- **环境**：动态验证树 `oac-wt-baseline @ 45d0d583`（隔离树）；`web/node_modules` 为软链（→ 测试线 twin 依赖目录），被测源码 100% 来自隔离树；未在 `/mnt/f` 跑测试。
- **G1 声明**：文件面用 `git diff 45d0d583^1 45d0d583`（5 文件），非 `git show`（1 文件）。

---

**评审线（第四线）· R4 第一段 · 2026-10-05**
