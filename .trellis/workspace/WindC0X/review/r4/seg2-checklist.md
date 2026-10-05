# R4 第二段 · 修复批回归面评审检查清单（草案 v1）

> **状态**：草案，待 A线 收口（2 个 P2 修复 + A-1 登记完成）后启用
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

### 1.3 断言可靠性（★ V9 三族，本轮新增重点）

| 族 | 检查 | 方法 |
|---|---|---|
| ① **注释免疫** | 断言是否被注释中的字样满足 | `stripComments` 后重跑；或「只删代码保留注释」注入 |
| ② **锚点消失** | `slice(indexOf(锚点), …)` 的锚点缺失时会怎样 | 注入「恢复缺陷写法」看锚点是否消失 → 断言是否仍绿 |
| ③ **失败路径不可诊断** | 护栏崩溃 vs 被测对象坏，能否区分 | 构造护栏失败（如空输入）看报错是否可定位 |

- [ ] 每个源码文本断言都过一遍三族
- [ ] 特别检查：`toContain` / `not.toContain` / `slice` 组合

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

**抽查策略**：抽 2-3 条做**独立注入**（优先抽「行为级修复」而非「纯文本断言」）

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

### 3.2 已知 flaky

- 首次排除跑可能出 1 fail，复跑消失（R4 选项 C 实测）

### 3.3 后端环境缺口

- `TestCloudAgent*` 5 红 = `Cannot find package 'undici'`（临时树缺 `backend/agent-runtime/pi/node_modules`）
- **非代码问题**；F-1 真实回归面用 `go test -run "TestImageUpscale|TestSKU|TestPriceTier|TestChannelModelPrice"` 验证

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

**评审线（第四线）· R4 第二段检查清单草案 v1 · 2026-10-05**
