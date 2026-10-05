# R4 第二段 · 修复批回归面评审检查清单（v2）

> **状态**：v2（已采纳控制线三处补充 + 修正一处归因），待 A线 收口（2 个 P2 修复 + A-1 登记完成）后启用
> **用途**：A线 17 commit + B线 新批的回归面评审执行框架
> **不依赖** A线 产物，可提前准备

---

## §0 评审对象的语义角色分类（★ 前置步骤）

**教训来源**：R4 选项 C 发现 `dc8965a0` 的 parent 是评审分支，且 `e2431865` 才是 T2-P1a 的真实修复、`dc8965a0` 是重构。
**⇒ 验证前必须确认每个 commit 的语义角色**，否则会用错误的注入方式验证。

| 角色 | 识别方法 | 验证方式 |
|---|---|---|
| **修复（fix）** | commit message 含「修复/根因/收口」+ 改动含行为逻辑 | 注入「恢复缺陷」→ 必须红 |
| **重构（refactor/test）** | 改动为抽取/改名/结构 | 注入「恢复旧结构」→ 接线断言必须红；行为不应变 |
| **登记（docs/chore）** | 只改文档/删除孤立物 | 残留核查（零引用）+ 邻近项完好 |
| **测试补强（test）** | 只加断言 | 注入「移除被测行为」→ 必须红 |

**★ 本轮实例**：
- `fd40026c`（fix）→ 恢复 `break` 应红 ✅
- `dc8965a0`（refactor）→ 恢复旧条件应红（接线级）✅
- `d3f18b28`（chore）→ 零残留核查 ✅

---

## §1 通用检查项（每个 commit 都做）

### 1.1 基线

- [ ] 在**隔离树**（ext4，非 `/mnt/f`）检出该 commit
- [ ] 相关测试基线绿（记录 pass/fail 数）
- [ ] 全量基线（**必须对照污染源**，见 §3）

### 1.2 证伪（核心）

- [ ] **注入缺陷** → 必须红（记录红的**实测**条数，非凭记忆）
- [ ] **还原** → 必须绿
- [ ] 红的是**预期的那条**（不是被其他机制顺带触发）
- [ ] ★ **注入覆盖完整因果链** —— 若注入后不红，**先怀疑注入不完整**，而非「测试无防护」

**★ 依据（`8594667a` C-1 教训）**：
C-1 首次注入只交换「记录读取」与「归属校验」两行 → **测试仍 PASS**（假阴性）。
复核后发现泄漏点在**解析**（`collectOwnedAssetDocumentReferences`），
必须把**整个「读 + 解析」块**移到归属校验之前才复现缺陷 → 1 红（错误信息正是泄漏形态）。
⇒ **形式上的「交换两行」不等于还原缺陷**。

### 1.3 断言可靠性（★ V9 三族，本轮新增重点）

| 族 | 检查 | 方法 |
|---|---|---|
| ① **注释免疫** | 断言是否被注释中的字样满足 | `stripComments` 后重跑；或「只删代码保留注释」注入 |
| ② **锚点消失** | `slice(indexOf(锚点), …)` 的锚点缺失时会怎样 | 注入「恢复缺陷写法」看锚点是否消失 → 断言是否仍绿 |
| ③ **失败路径不可诊断** | 护栏崩溃 vs 被测对象坏，能否区分 | 构造护栏失败（如空输入）看报错是否可定位 |

- [ ] 每个源码文本断言都过一遍三族
- [ ] 特别检查：`toContain` / `not.toContain` / `slice` 组合
- [ ] ★ **记录红的实测条数**（不得凭记忆写「恰好 N 红」）—— 见 §1.3.1

### 1.3.1 证伪红数必须来自实测（★ 控制线补充 1）

**依据**（本轮两处偏差，均为凭记忆）：
| commit | 自述 | 实测 | 偏差方向 |
|---|---|---|---|
| `63df7eff` F-2 | 「恰好 1 红」 | **2 红** | 偏保守 |
| `9c75ddaf` superres | 「2 红」 | **1 红** | 偏乐观 |

⇒ **不是缺陷，但影响可信度**。**动作**：证伪后**立即记录实测输出**，报告引用该记录。

### 1.4 残留与边界

- [ ] 删除类改动：全仓零残留（`git grep`）
- [ ] 邻近项完好（未误伤）
- [ ] 调用方同步（改了签名/类型，调用方是否跟上）

---

## §2 A线 批专项清单（17 commit）

### 2.1 已双线核验（不需重复）

| commit | 条目 | 状态 |
|---|---|---|
| `63df7eff` | F-2/F-3 | ✅ 双线 |
| `d3f18b28` | S-4 | ✅ 双线 |
| `fd40026c` | F-1 | ✅ 双线 |
| `59fd251d` | A-2 | ✅ 双线 |
| `b6eacc8c` | S-2 | ⚠️ **P2 待修** |
| `dc8965a0` | T2-P1a 重构 | ✅ 双线 |
| `9c75ddaf` | superres rider | ⚠️ **P2 待修** |

### 2.2 单线核验（控制线已验，我做抽查即可）

`8594667a`（C 组）/ `c806599a`（S-3）/ `7978b0a3`（P1-1）/ `abb92add`（P1-2）/
`6d93dc91`（T1-P2）/ `e111a6ad`（护栏优化）/ `7228e83f`（护栏诊断）/ `e2431865`（T2-P1a 修复）

**抽查策略**（★ 控制线补充 2 —— 具体化）：

| 优先抽 | 注入 | 预期 |
|---|---|---|
| `8594667a`（C 组后端，行为级） | 还原 order-inverted | 应红 |
| `7978b0a3`（P1-1 护栏） | 非递归 scan | 应红（控制线已验 4/4） |
| `6d93dc91`（T1-P2） | 注释掉调用 | 应红（控制线已验） |

**可跳过**：`e111a6ad` / `7228e83f`（纯测试基础设施，控制线已验）

⇒ 仍保留「优先行为级而非纯文本断言」原则。

### 2.3 待修 P2 的验收（收口后）

- [ ] `b6eacc8c` 的 S-2：切片前加锚点存在性断言 → 注入「锚点消失」形态应红
- [ ] `9c75ddaf` 的 superres：`stripComments` 后再断言 → 注入「只删代码保留注释」应红

### 2.4 未核

- [ ] `3fe603d2`（A-1 登记，docs 类）→ 残留/一致性核查

---

## §3 环境基线（★ 必须对照）

### 3.1 污染源（R4 补正确认）

**唯一污染源**：`web/test/user-data-sync-load-deadlock.test.ts`
- `mock.module("../src/stores/canvas/use-canvas-store", ...)` 进程级泄漏
- **受害者**：`canvas-asset-repair.test.ts`（7 条）+ `headless-workspace-writer.test.ts`（5 条）

**标准跑法**：
```bash
mapfile -t ALL < <(find . \( -name "*.test.ts" -o -name "*.test.tsx" \) -not -path "./node_modules/*" | sed 's|^\./||' | sort)
mapfile -t EXCL < <(printf '%s\n' "${ALL[@]}" | grep -v "load-deadlock")
bun test "${EXCL[@]}"
```
**期望**：`0 fail`（若有 fail，须逐条归因：新缺陷 vs flaky vs 其他污染）

**★ 边界说明（控制线补充 3）**：本排除跑法**在 B线 P1-2 治本合入后会变化** ——
若 `load-deadlock` 改用 `spyOn` + `afterAll` 还原，则污染消失，
**全量（不排除）应回到 0 fail**（除 asset-repair 族自身基线）。
⇒ **该跑法是「当前状态的适配」，不是永久纪律**；B线 治本合入后必须复核。

### 3.2 已知 flaky

- 首次排除跑可能出 1 fail，复跑消失（R4 选项 C 实测）

### 3.3 后端环境缺口（★ 归因已修正）

**修正前**（v1 的表述不准确）：「临时树缺 `backend/agent-runtime/pi/node_modules`」

**修正后**（控制线 §④ 提出 + 我独立核验）：
> 不是「建树方式」问题，而是 **`backend/agent-runtime/pi/node_modules` 整个目录未安装**
> —— 该目录是 **Pi 运行时自己的依赖树**（`package.json` 声明 `undici 7.28.0` 等），
> **与 `web/node_modules` / `backend/node_modules` 完全分开**（后两者在本仓均不存在）。
> ⇒ **与建树方式无关，是环境既有缺口**（V4 已登记族）。

**我的独立核验证据**：
```
① backend/agent-runtime/pi/node_modules        → 不存在
② backend/agent-runtime/pi/package.json        → 声明 undici 7.28.0（依赖确实需要）
③ web/node_modules/undici                      → 存在（但解析路径不覆盖 pi 运行时）
④ backend/agent-runtime/pi/ 目录内容            → 只有 agent-runtime.mjs / package.json / package-lock.json
⑤ AGENTS.md:29                                 → 「cd backend/agent-runtime/pi && npm install」★ 需手动安装
⑥ 测试注释（cloud_agent_runtime_e2e_test.go:87）→ 「Pi runtime 依赖树（…pi/node_modules，203M/24962 文件）」
⑦ 测试线 twin（oac-wt-test）已安装该依赖树         → 含 undici
⑧ ★ 决定性：软链 twin 依赖树后重跑                 → TestCloudAgentRuntimeCompletesToolRoundTrip **PASS**（4.54s）
```

⇒ **归因完全确认**：安装 `backend/agent-runtime/pi` 依赖即可解决。

**对评审的影响**：
- `TestCloudAgent*` 5 红 **不是代码缺陷**，评审时应**排除**或**先安装依赖**
- **建议**：做后端回归面时，先 `ln -s` 测试线 twin 的依赖树（或 `npm install`），再跑全量
- F-1 真实回归面（计费）不受影响：`go test -run "TestImageUpscale|TestSKU|TestPriceTier|TestChannelModelPrice"` → ok

### 3.4 隔离树纪律（V6）

- [ ] 用 `/home/windc0x/oac-ext4/` 下的临时 worktree（`git worktree add --detach`）
- [ ] `web/node_modules` 软链测试线 twin（记录为**依赖共享**）
- [ ] **用完即删**（`git worktree remove --force`）
- [ ] **不在 `/mnt/f` 跑测试**（9p 挂载会 D 状态阻塞）

---

## §4 输出格式

```markdown
## <commit> <条目>
- **语义角色**：fix / refactor / test / docs
- **基线**：N pass / M fail（隔离树）
- **注入**：<注入内容> → **X 红**（实测）
- **还原**：N pass / 0 fail
- **断言可靠性**：三族检查结果
- **残留**：零残留 / 邻近完好
- **判定**：通过 / P0-P3
```

---

## §5 本轮两轮 P2 的方法论沉淀（供纪律引用）

| 轮次 | 形态 | 假绿机制 | 触发条件 |
|---|---|---|---|
| 选项 C S-2 | `slice(indexOf(锚点), indexOf(结束))` | 锚点缺失 → -1 → **空串** → `not.toContain` 恒真 | 恢复缺陷写法 |
| 本轮 superres | `slice(ci, ci+600)` + `toContain` | 窗口**覆盖注释**字样 | 只删代码保留注释 |

**共同点**：**源码文本切片断言在边界条件下失效，触发条件都是最自然的回归写法**

**建议纪律（V9 补充）**：
> 切片类断言必须满足两条：
> ① 锚点存在性前置断言（`expect(idx).toBeGreaterThan(-1)`）
> ② **断言前剥离注释**（`stripComments`）

**本仓现成范式**：`web/test/task-face-independence.test.ts:28-32`
```ts
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1))
        .replace(/^\s*\/\/.*$/gm, "");
}
```

---

---

## §6 v2 变更记录

| # | 变更 | 来源 |
|---|---|---|
| 1 | §1.3 新增第 ④ 条「证伪红数来自实测」+ §1.3.1 依据表 | 控制线补充 1 |
| 2 | §2.2 抽查策略具体化（三条优先 + 两条可跳过） | 控制线补充 2 |
| 3 | §3.1 新增边界说明（B线治本后排除跑法失效） | 控制线补充 3 |
| 4 | §3.3 归因修正（不是建树问题，是 pi 运行时依赖未安装）+ 8 条独立核验证据 | 控制线 §④ + 我的核验 |
| 5 | §0 语义角色分类升级为**强制前置步骤** | 控制线批准 |

---

**评审线（第四线）· R4 第二段检查清单 v2 · 2026-10-05**
