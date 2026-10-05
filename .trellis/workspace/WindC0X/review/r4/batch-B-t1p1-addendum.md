# R4 第一段 · 补正报告（评审线 · 第四线）

**触发**：控制线 §② 对 P1-3 归因的纠正（「不是口径错位，是 V6 违反」）
**方法**：独立验证控制线的纠正 + 追查其未覆盖的一层
**结论**：**控制线的方向正确，但归因链缺最后一环** —— 我找到更深的证据

---

## §1 控制线的纠正：**接受，且我补强了证据**

控制线指出：B线 的错不在「把总数写成 pass」，而在 **drvfs 环境验证**（V6 违反）。

**我接受这个纠正**，并补上控制线未做的**决定性验证**：

```
临时 worktree @ 382de2cc（B线 自己的 commit，未含 main 侧）：
  bun test → 3044 pass / 13 fail   ← 在 ext4 上，B线 自己的 commit 也红
```

**这条证据比「drvfs 归因」更强**：
- 控制线的归因是「在错误的树跑 ⇒ 0 fail 不可信」
- 我的证据是「**即使换到 ext4 的正确树，B线 自己的 commit 也是 13 fail**」
⇒ 即 B线 若遵守 V6 在 ext4 上重跑，**仍会看到红色**，它的「0 fail」**在其 commit 上无论如何都不成立**

**归因修正**（比控制线更进一步）：
| 层 | 归因 | 状态 |
|---|---|---|
| 控制线的纠正 | V6 违反（drvfs 环境） | ✅ 正确，但不完整 |
| 我的补充 | **测试隔离缺陷（P1-2）使 B线 不可能在任何环境得到可信的全量结果** | ✅ 更深 |
| 综合 | B线 的 0 fail 是**污染源 + 环境**双重作用；即使修好环境（回 ext4），**P1-2 未修则结果依然红** | ★ |

⇒ 这解释了为什么 B线 会误报：**它的测试在它自己的 commit 上就是红的**（只要用 ext4 跑）。

---

## §2 ★ 我追查到的更深一层：**那 7 条「V4 基线」失败不是独立基线**

控制线和我此前都采用「12 fail = 7 条 V4 基线 + 5 条本批」的二分。**这个二分不准确**：

```
baseline@45d0d583：
  bun test                          → 3045 pass / 12 fail
  bun test（排除 load-deadlock）     → 3017 pass /  0 fail   ← 全部转绿

_r4-probe@382de2cc：
  bun test                          → 3044 pass / 13 fail
  bun test（排除 load-deadlock）     → 3017 pass /  0 fail   ← 全部转绿
```

**配对实验**（因果验证）：
```
bun test test/canvas-asset-repair.test.ts                              → 10 pass / 0 fail
bun test test/user-data-sync-load-deadlock.test.ts test/canvas-asset-repair.test.ts →  5 pass / 7 fail
bun test test/canvas-asset-repair.test.ts test/user-data-sync-load-deadlock.test.ts →  5 pass / 7 fail（顺序无关）
```

**结论**：
- `canvas-asset-repair.test.ts`（含 `rebindInconsistentCanvasAssets` / `repairMissingCanvasVideoPreviews` 族）**自身完全干净**（隔离跑 10/0）
- 它的 7 条失败**全部由 `user-data-sync-load-deadlock.test.ts` 的 mock 泄漏引起**
- 排除该文件后：**3017 pass / 0 fail**（3 次复跑一致，无 flaky）

⇒ **V4 基线记录的「asset-repair mock-leak 族（7 fail）」归因需更正**：
它不是「asset-repair 自身的 mock 泄漏」，而是**同一污染源（load-deadlock）的受害者**。
V4 记录的是**症状**（哪个文件红），未追到**病因**（谁泄漏）。

---

## §3 污染源唯一性确认

```
全仓 grep "mock.module.*use-canvas-store" → 仅 1 处：
  test/user-data-sync-load-deadlock.test.ts:19

全仓 mock.module 清单（5 个文件）：
  agent-api-reliability.test.ts        （无模块名匹配 → 动态 mock）
  user-data-sync-load-deadlock.test.ts → ../src/stores/canvas/use-canvas-store   ← 唯一污染画布 store
  registry-adapters.test.ts            → ../src/services/api/tools
  canvas-video-batch-executor.test.ts  → @/lib/canvas/canvas-project-generation
  outpaint-drift-node-size.test.ts     → @/services/image-storage
```

**唯一性成立**：画布 store 的 mock 只有一处，与实验的「排除即全绿」互为印证。

---

## §4 对控制线 §③④⑤⑥ 的回应

**§③ 修法 (b) 采纳 —— 我补充一个数据前提**：
修法 (b)（`/create` 会话历史加「回到画布」入口，消费 `conversation.canvasId`）**前提是卡流程真的写了 `canvasId`**。核实：
- `index.tsx:864`（`:862` 既有创作交接路径）写 `canvasId` ✅
- **但卡流程两分支（`:1152`/`:1176`）是否也写 `canvasId`？** —— 见下节实测

**§④ 已转测试线**：确认收到，我的 §7 四点可直接引用。

**§⑤ 门禁差分断言**：建议实现形态 ——
```bash
# 门禁脚本新增（V4 配套）
BASELINE_FAIL=$(bun test 2>&1 | grep -c "(fail)" || true)   # 需先建基线文件
# 或更稳：排除已知污染源后断言 0 fail
bun test $(find . -name "*.test.ts" -not -path "./node_modules/*" | grep -v load-deadlock) \
  | grep -q "0 fail" || { echo "新增失败"; exit 1; }
```
★ 但**更该修的是污染源本身**（P1-2），差分断言只是兜底。

**§⑥ 待令**：R4 第二段（A线批 `d3f18b28` + F-1 修复）待令中。

---

## §5 ★ 卡流程 canvasId 写入核查（修法 (b) 的数据前提）

见下（本条为新增证据，直接决定 (b) 是否可行）。

---

**评审线（第四线）· R4 第一段补正 · 2026-10-05**

## §5 ★ 卡流程 canvasId 写入核查 —— 修法 (b) 的前提**不成立**（需修正）

控制线 §③ 初步判断修法 (b)「成本最低且最符合用户心智」。**我核实后认为该修法的数据前提缺失**：

### 证据

| 路径 | 是否写 `canvasId` | 证据 |
|---|---|---|
| `:862` 既有创作交接（用户显式转入画布） | ✅ **写** | `index.tsx:864`：`updateCreationConversationSnapshot(..., (item) => ({ ...item, canvasId: result.id }))` |
| **卡流程 carrier（`:1152`）** | ❌ **不写** | `:1132-1155` 全文无 `canvasId` 写入 |
| **卡流程 result（`:1176`）** | ❌ **不写** | `:1156-1180` 全文无 `canvasId` 写入 |

### 更关键：卡流程的会话**不进** `/create` 会话历史

```
updateCreationConversationSnapshot 全部调用点：:403 / :409 / :864 / :929
  → 均在「用户已打开的创作会话」上下文中
  → 卡流程两分支（:1152/:1176）**均未调用**该函数

卡流程的会话 id = `linear-flow-${taskId}`（:1131）
  → 它被写进 **画布侧**的 chatSessions（creation-canvas-conversation.ts:62）
  → 不写进 **/create 侧**的 creation conversations 列表
```

⇒ 即使给 `:1152/:1176` 补上 `canvasId`，**`/create` 的会话历史列表里也没有这条会话**（用户看不到它）⇒ 修法 (b) 的入口**无处安放**。

### 修正后的修法建议

| 方案 | 可行性 | 说明 |
|---|---|---|
| **(b) 原样** | ❌ **前提不成立** | 卡流程会话不在 `/create` 历史列表 ⇒ 无入口可加 |
| **(b') 补两处**：卡流程也写 `canvasId` **+** 把 `linear-flow-*` 会话写进 `/create` 历史 | ⚠️ 可行但改动面大于预估 | 需动 `creation-conversation-store` 的会话来源（卡流程当前完全不写 `/create` 侧） |
| **(a) 列表分组** | ✅ 最直接 | 控制线担心「破坏小白不见画布意图」——可用「任务产物」折叠分组 + 默认收起规避 |
| **(c) 任务面按 taskIds 过滤** | ✅ 语义最正确 | 容器内任务面板改为按 `chatSessions[*].messages[*].taskIds` 过滤；需核实 `useCanvasActiveTasks` 的改造面 |
| **(d) 新建：容器内加「本会话产物」入口** | ✅ 改动最小 | 容器是 headless 时，画布页显式展示该会话的 taskIds 与产物（用户当场能看到，离开后仍可从列表分组找到） |

**我的建议**：**短期用 (a) 折叠分组**（一行过滤改分组，可立即恢复可达性）；**中期用 (c)**（语义最正，但需评估 `useCanvasActiveTasks` 改造面）。

### 对 P1-1 定级的影响

**不变，仍为 P1**（且控制线 §③ 的「最高优先」判断成立）。本条只是**修正修法**，不影响缺陷成立。

---

## §6 汇总：本补正报告的新增发现

| # | 发现 | 级别 | 状态 |
|---|---|---|---|
| **P1-2'** | **那 7 条「V4 基线」失败不是独立基线**，而是同一污染源（load-deadlock）的受害者；排除后全量 **3017 pass / 0 fail** | 补充 P1-2 | **新发现** |
| **P1-3'** | 在 B线 **自己的 commit** `382de2cc` 上 ext4 全量 = **3044 pass / 13 fail** ⇒ 「0 fail」在其 commit 上无论如何不成立 | 补强 P1-3 | **新证据** |
| **P1-1'** | 修法 (b) 数据前提不成立（卡流程不写 `canvasId` + 会话不进 `/create` 历史） | 修正建议 | **新发现** |

**计数变更**：P0=0 · P1=3（不变，但 P1-2/P1-3 证据增强）· P2=2 · P3=2 · **新增 P3-3**（V4 基线归因记录不准）

---

**评审线（第四线）· R4 第一段补正 · 2026-10-05**
