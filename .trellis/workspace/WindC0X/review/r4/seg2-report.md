# R4 第二段 · 修复批回归面评审报告（评审线 · 第四线）

**锚点**：`b52b206c`（G5 绑定；= fork/main = 本地 main，`ls-remote` 实测一致）
**范围**：A线 18 commit（`8594667a..a98e587e`，经 merge `721a93ce`）+ B线 1 commit（`3d2660ed`，经 merge `f6236a18`）
**方法**：临时隔离树（`_r4-seg2 @ b52b206c`，ext4）+ 逐条注入证伪 + 全量基线对照
**清单**：按 R4 第二段检查清单 v2 执行（§0 语义角色分类为强制前置）

---

## §0 结论摘要

| 项 | 结论 |
|---|---|
| **18+1 commit 回归面** | ✅ **全部通过**，无功能缺陷 |
| **2 个 P2 修复（a98e587e）** | ✅ **修复有效**（证伪：锚点消失 1 红 / 注释满足 2 红 / 顺序 1 红） |
| **B线 治本（3d2660ed）** | ✅ **污染源根治**（三组配对跑 0 fail，原 7/5 红） |
| **A-3 空 manifest 防线** | ✅ 四态全部 exit 2（原空输入 exit 0） |
| **P2-2 Pick 白名单** | ✅ 删白名单 → TS2353（原 exit 0 假绿） |
| **★ 新发现：flaky** | ⚠️ **P2** `agent-canvas-sync.test.ts:75` 时序 flaky（6 次跑 2 次红，独立复现） |
| 全量基线 | 3078 pass / 0 fail（4 次跑全绿）+ 2 次出现 flaky |

**计数：P0=0 · P1=0 · P2=1（flaky）· P3=0**

---

## §1 §0 语义角色分类（强制前置步骤）

| commit | 角色 | 核验状态 |
|---|---|---|
| `8594667a` | fix | ✅ 我核验（证伪 5/5） |
| `63df7eff` | fix | ✅ 我核验（F-2 2 红 / F-3 1 红） |
| `d3f18b28` | chore | ✅ 我核验（零残留） |
| `fd40026c` | fix | ✅ 我核验（2 红） |
| `59fd251d` | test | ✅ 我核验（2 红） |
| `b6eacc8c` | fix | ✅ 我核验（含 P2） |
| `dc8965a0` | test（重构） | ✅ 我核验（两级各 1 红） |
| `9c75ddaf` | fix | ✅ 我核验（含 P2） |
| **`a98e587e`** | **test（P2 修复）** | ✅ **本段核验**（§2） |
| **`3d2660ed`** | **fix（B线 工具批）** | ✅ **本段核验**（§3） |
| `c806599a` | docs | 控制线已验（docs 类） |
| `7978b0a3` | test | 控制线已验（4/4） |
| `abb92add` | fix | 控制线已验 |
| `6d93dc91` | test | 控制线已验 |
| `e111a6ad` | perf | 控制线已验 |
| `7228e83f` | fix（测试基础设施） | 控制线已验 |
| `e2431865` | fix | 控制线已验 |
| `3fe603d2` | docs | 未核（docs 类，A-1 登记） |

**★ 分类价值验证**：`dc8965a0` 与 `e2431865` 都涉及 T2-P1a，但**角色不同**（重构 vs 修复），
注入方式必须不同（前者验接线、后者验死锁行为）——**分类避免了验证对象错配**。

---

## §2 `a98e587e`（两个 P2 修复）—— ★ 修复有效，且超出我的建议

### 2.1 P2-1（锚点消失）修复

```ts
// 修复前（假绿）：
const requestBranch = panel.slice(panel.indexOf("if (prefillRequest && prefillRequest.id !=="), panel.indexOf("const value = prefillPrompt?.trim();"));
expect(requestBranch).not.toContain("return;");

// 修复后（V9 ② 硬要求）：
const requestBranchStart = panel.indexOf("if (prefillRequest && prefillRequest.id !==");
const requestBranchEnd = panel.indexOf("const value = prefillPrompt?.trim();");
expect(requestBranchStart).toBeGreaterThan(-1);        // ★ 锚点存在性前置断言
expect(requestBranchEnd).toBeGreaterThan(requestBranchStart);
const requestBranch = panel.slice(requestBranchStart, requestBranchEnd);
expect(requestBranch).not.toContain("return;");
```

**我的独立证伪**（恢复原 early-return 写法 = 锚点消失形态）：
```
注入前：1 pass / 0 fail
注入后：0 pass / 1 fail    ← ★ 修复前该形态是「假绿」
```
⇒ **修复有效**：锚点消失时**显式失败**（不再是空切片恒真）。

### 2.2 P2-2（注释满足）修复 —— ★ 超出我的建议

**我原建议**：`stripComments` 后再断言。
**A线 实际实现**：**两道防线**（stripComments + **顺序断言**）：
```ts
const stripped = body
    .replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1))
    .replace(/^\s*\/\/.*$/gm, "");
const strippedCatchIndex = stripped.indexOf("if (isGenerationCanceled(error)) return;");
expect(strippedCatchIndex).toBeGreaterThan(-1);
const catchBlock = stripped.slice(strippedCatchIndex, strippedCatchIndex + 600);
const errorToastIndex = catchBlock.indexOf("message.error");
const nodeStatusIndex = catchBlock.indexOf("NODE_STATUS_ERROR");
expect(errorToastIndex).toBeGreaterThan(-1);
expect(nodeStatusIndex).toBeGreaterThan(-1);
expect(errorToastIndex).toBeLessThan(nodeStatusIndex);   // ★ 顺序断言（注释无法满足）
```

**我的独立证伪（两项）**：

| 注入 | 结果 | 说明 |
|---|---|---|
| **只删代码保留注释**（原假绿形态） | **2 红** | ✅ 修复前是假绿 |
| **交换 `message.error` 与 `setNodes` 顺序** | **1 红** | ✅ **顺序断言有效**（注释无法满足） |

⇒ **A线 采纳了我的建议，并主动实现了我在报告里提到的「最强形态」（顺序断言）**——
**这是对 P2 的彻底修复**（不止症状，连根因形态也堵住）。

### 2.3 评价

| 维度 | 评价 |
|---|---|
| 是否采纳建议 | ✅ 完全采纳 |
| 是否超出建议 | ✅ **是**（主动加了顺序断言） |
| 注释质量 | ✅ 完整记录「修复前的假绿形态 + 为何这样修」 |
| 可证伪性 | ✅ **三态全部实测**（锚点消失 / 注释满足 / 顺序交换） |

---

## §3 `3d2660ed`（B线 R2 工具批）—— ★ 治本彻底

### 3.1 P1-2 桩隔离治本

**修复形态**：
```ts
// 修复前：mock.module（进程级、无恢复手段）
// 修复后：
const getStateSpy = spyOn(actualCanvasStore.useCanvasStore, "getState").mockImplementation(() => ({ ...realGetState(), projects }));
const setStateSpy = spyOn(actualCanvasStore.useCanvasStore, "setState").mockImplementation((updater) => {
    // ★ 只接管 projects，其余字段透传真实 store（否则吞掉 hydrated 写入 → 守卫误报）
});
afterAll(() => { getStateSpy.mockRestore(); setStateSpy.mockRestore(); });
```

**我的独立证伪（决定性：污染是否真消失）**：
```
① load-deadlock + asset-repair（原受害者顺序）  → 13 pass / 0 fail   ← 原为 7 fail
② 顺序翻转                                    → 13 pass / 0 fail
③ load-deadlock + headless-writer             → 10 pass / 0 fail   ← 原为 5 fail
```
⇒ **污染源根治确认**：**顺序依赖完全消除**。

**★ 特别认可**：B线 发现并修复了**第二层问题**——
「只处理 projects 的桩会吞掉 persist rehydrate 回调写入的 `hydrated`，使守卫误报」
（配对跑 5 红）⇒ 改为**透传真实 store 的其余字段**。这是**治本中的治本**。

### 3.2 A-3 空 manifest 防线

**修复形态**：
```bash
local entries=()
mapfile -t entries < <(grep '^[0-9a-f]\{64\} ' "$dir/manifest.txt" || true)
if [ ${#entries[@]} -eq 0 ]; then
    echo "校验失败：manifest 无可校验条目（可能被裁剪或改写）" >&2
    return 2
fi
```

**我的独立证伪（四态）**：
```
① 空 manifest      → exit 2  ✅
② 仅注释行 manifest → exit 2  ✅
③ 缺 manifest      → exit 2  ✅
④ （对照）修复前    → exit 0（假通过）
```
⇒ **防线有效**。**★ 与我在 batch-A 恢复件里的 A-3 动态复现完全对应**（我复现了缺陷，B线 修复了它）。

### 3.3 P2-1（断言剥注释）+ P2-2（Pick 白名单）

**P2-2 我的独立证伪**（删 Pick 白名单的 `workspaceType`）：
```
修复前：tsc exit 0（假绿）
修复后：★ TS2353 报警 + tsc exit 1
  error TS2353: Object literal may only specify known properties,
  and 'workspaceType' does not exist in type 'Partial<Pick<CanvasProject, "activeChatId" | "chatSessions" | "connections" | "nodes">>'
```
⇒ **编译期拦截生效**（这正是修复目标：条件展开 → 显式对象字面量，恢复 excess property check）。

---

## §4 ★ 新发现：P2 时序 flaky（`agent-canvas-sync.test.ts:75`）

### 4.1 现象（可复现）

```
全量跑 6 次：4 次 3078/0，2 次 3077/1     ← 33% 概率
单文件跑 6 次：5 次 8/0，1 次 7/1         ← 独立复现
```

**失败的断言**（`test/agent-canvas-sync.test.ts:75`）：
```ts
test("fallback snapshots obey the configured minimum refresh interval", async () => {
    const sync = createAgentCanvasSync({ ..., batchMs: 0, refreshIntervalMs: 100 });
    sync.reconcile();
    await sleep(15);
    for (let index = 0; index < 50; index++) sync.reconcile();
    await sleep(15);
    expect(times).toHaveLength(1);
    await sleep(250);
    sync.dispose();
    expect(times).toHaveLength(2);                      // ← :75 失败行
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(100);
});
```

### 4.2 根因

**测试依赖真实定时器 + 100ms 窗口**：等待 250ms 后**应恰好 2 次**刷新，
但**并行负载下 100ms 定时器回调可被延迟出窗** ⇒ 只发生 1 次 ⇒ 假红。

**测试自己的注释已登记**：
```
// rider 2026-09-28：正等待窗口 120→250ms。全量并行 + /mnt/f 慢 IO 下 100ms 间隔的
// 定时器回调可被延迟出窗 → 假红（本批全量 3 跑 1 现；flora 验收期首现的观察名单
// 二次复现，控制线裁决选 b）。负窗口（15ms 内不得刷新）断言语义原样保留。
```

⇒ **已知问题，但仍是 P2**：它使「全量 0 fail」不可作为**确定性**验收依据。

### 4.3 影响与建议

| 影响 | 说明 |
|---|---|
| **验收可靠性** | 控制线「3 次跑全绿」与我「6 次跑 2 次红」的差异**由此解释**——非环境差异，是 flaky |
| **不阻塞本批** | 该测试**非本批引入**（V4 已登记族），且失败形态是**超时等待**而非逻辑错误 |
| **建议** | ① 改为**注入可控时钟**（fake timer）消除时序依赖；② 或放宽为 `toBeGreaterThanOrEqual(2)` + 独立断言最小间隔；③ 或标记 `test.skip` 并登记技术债 |

**★ 补充**：这也**验证了控制线 V4 更新的必要性**——
「全量 0 fail」应表述为「全量 0 fail（除已知 flaky）」，
否则验收方无法区分「新缺陷」与「flaky」。

---

## §5 全量基线与环境

```
锚点 b52b206c（ext4 隔离树）
  全量 bun test ×6    → 4 次 3078 pass / 0 fail；2 次 3077 pass / 1 fail（flaky）
  配对跑（原污染场景）  → 13 pass / 0 fail（顺序无关）
  P2 修复相关测试       → 38 pass / 0 fail
```

**★ 环境说明**：
- 依赖共享：`web/node_modules` 与 `backend/agent-runtime/pi/node_modules` **均软链测试线 twin**
  （**依赖共享、源码隔离**；本轮未观测到依赖漂移）
- **未在 `/mnt/f` 跑测试**（V6）
- 后端 `TestCloudAgent*` 5 红：本轮**软链 pi 依赖后消除**（`TestCloudAgentRuntimeCompletesToolRoundTrip` PASS 4.54s）
  ⇒ 再次确认归因为**环境缺口**而非代码缺陷

---

## §6 覆盖声明

| 项 | 状态 |
|---|---|
| **已核验** | `8594667a`（5/5）/ `63df7eff`（2）/ `d3f18b28` / `fd40026c` / `59fd251d` / `b6eacc8c`（含 P2）/ `dc8965a0`（两级）/ `9c75ddaf`（含 P2）/ **`a98e587e`（3 项）** / **`3d2660ed`（4 项）** |
| **未核验** | `c806599a` / `7978b0a3` / `abb92add` / `6d93dc91` / `e111a6ad` / `7228e83f` / `e2431865`（控制线已验，本轮按清单 §2.2 抽查策略跳过）/ `3fe603d2`（docs） |
| **新发现** | P2 flaky（`agent-canvas-sync.test.ts:75`） |
| **产出** | 本文件 + `.trellis/workspace/WindC0X/review/r4/seg2-report.md` |

**★ 未核验的 7 条**：按清单 §2.2「控制线已验的不重复」原则跳过；
若控制线要求全量独立复核，我可补做（预计 2-3 轮注入）。

---

**计数：P0=0 · P1=0 · P2=1 · P3=0**
**18+1 commit 回归面：无功能缺陷；2 个 P2 修复均有效；B线 治本彻底**

**评审线（第四线）· R4 第二段 · 2026-10-05**
