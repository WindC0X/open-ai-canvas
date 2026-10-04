# PATCH-MAP 复盘 — flora 外置后首次同步冲突面度量

> **性质**：W5 垫尾项（纯度量，零模型成本）
> **执行**：A 线，2026-10-04 11:15–11:30
> **触发**：控制线裁定「PATCH-MAP 复盘现在开」（测试线 b12r15 已 GO 封版，无插入风险）
> **方法**：真实试合并（ext4 clone `/home/windc0x/oac-ext4/oac-wt-test`，遵守「试合并只在 ext4 做」纪律）

---

## 一、复盘目的

flora 皮肤外置（`flora-tokens.css` + `flora-overrides.css`）的**核心承诺**是：

> 「上游同步时热文件冲突面从**组件规则交错**降为**文件级并列**」
> —— `flora-overrides.css` 头部契约

**本复盘 = 首次用真实同步验证这个承诺是否兑现。**

---

## 二、外置效果度量（核心结论）

### 2.1 globals.css 的 diff 面收敛

| 阶段 | globals.css vs 上游 | hunks |
|---|---|---|
| 外置前（直改时期） | +1220/−85 | — |
| flora-tokens 后（PATCH-MAP 记录） | +850/−41 | 41 |
| **W4 flora-overrides 后（本次实测）** | **+309/−41** | **42** |

**⇒ diff 面从 +850 降至 +309（−64% 行数）**，符合外置预期。

### 2.2 ★ 冲突面实测（真实试合并）

**试合并设置**：
- 我方：`c68b595a`（main tip）
- 上游：`125864f6`（origin/main 最新，2026-10-04 10:49）
- merge-base：`d328a257`（2026-09-30）

**结果**：

| 指标 | 值 |
|---|---|
| 冲突文件 | **23** |
| 自动合并文件 | **242** |
| **`globals.css` 状态** | ✅ **自动合并成功（零冲突）** |

**★ 关键**：`globals.css` 出现在「Auto-merging」列表里 —— **git 自动合并成功，不在 23 个冲突文件中**。

### 2.3 冲突归因（23 个冲突文件的性质）

| 类别 | 文件 | 与外置的关系 |
|---|---|---|
| 文档/账本 | `.gitignore`、`CHANGELOG.md`、`docs/plans/pending-test.mdx`、`docs/content/docs/*` | **预期**（双方都改的记账文件） |
| 云端 Agent 后端 | `backend/internal/app/cloud_agent_*.go`、`analytics.go` | **与本复盘无关**（B 线/上游各自演进） |
| 画布前端 | `canvas-node.tsx`、`project.tsx`、`agent-canvas-patch.ts`、`user-data-sync.ts` 等 | **功能面冲突**（双方都在改画布逻辑） |
| **样式** | **无** | ★ **globals.css 零冲突** |

**⇒ 23 个冲突中「样式类」为零** —— 外置承诺兑现的直接证据。

---

## 三、上游本次对 globals.css 的改动（3 处）

试合并显示上游本次改了 3 处（全部与 fork 改动**无重叠**）：

| # | 位置 | 改动 | 与 fork 冲突 |
|---|---|---|---|
| 1 | L647 `.site-compliance-footer > span` | 新增 `min-width/max-width/overflow-wrap` | 无（fork 最近 hunk 在 331） |
| 2 | L9989 `.canvas-mention-chip` | `vertical-align: baseline → middle`、`translateY(var(--canvas-mention-chip-offset-y)) → translateY(-0.08em)` | 无 |
| 3 | L18786 `.ant-select.app-unified-select` | `.ant-select-arrow → .ant-select-suffix` + `margin-inline-end` | 无（fork 该区无 hunk） |

**★★ 第 2 处已核实（本复盘最重要的发现）**：

上游把 `transform: translateY(var(--canvas-mention-chip-offset-y))` 改为字面值 `translateY(-0.08em)`，
**同时把 `vertical-align: baseline` 改为 `middle`**。

**核实结论（三处证据）**：

| 项 | 事实 |
|---|---|
| 令牌来源 | **上游原生**（`2cedc4c6` 上游版 L1277 已有定义，**不是 fork 引入**） |
| 上游最新版 | **定义保留**（L1283）但**使用点删除** → **令牌被弃用（orphaned）** |
| 我方当前 | 定义（L1281）+ 使用（L10221），**2 处** |

**⇒ 上游正在「去令牌化」**（把令牌内联为字面值）—— 这是**上游的风格演进**，
不是针对 fork 的改动，但**对我方构成实际影响**：

- 若下次同步跟随上游删除使用点 → 我方该处视觉随之变化（`0.14em` → `-0.08em`，**方向相反**）
- 且 `vertical-align` 同时从 `baseline` 改 `middle`，**两个属性联合调整**，非单点

**★ 处置建议（不在本复盘范围，供下次同步）**：
1. 下次同步时**逐处人审**该区块（不机械接受上游）
2. 若采用上游值，需在 `flora-overrides.css` 补覆写（若 fork 视觉依赖原值）
3. **登记进 PATCH-MAP**（作为「上游弃用令牌」类的新条目）

---

## 四、结论

### 4.1 外置承诺：**已兑现**

| 承诺 | 实测 | 判定 |
|---|---|---|
| 冲突面从「组件规则交错」降为「文件级并列」 | `globals.css` 自动合并成功 | ✅ **兑现** |
| globals.css 回归上游原状 | diff +309（仅剩结构类 C，值类已外置） | ✅ **兑现** |
| 外置层承载 fork 全部组件覆写 | `flora-overrides.css` 30,797 字节 | ✅ 在位 |

### 4.2 剩余 diff（+309）的性质

**按 PATCH-MAP 分类**：
- **A 纯令牌值** → 已外置（flora-tokens.css），globals 已回归
- **B 结构性** → 已外置（flora-overrides.css）
- **C 保留直改** → 同步卫生类，**+309 主要在此**（死 CSS 清删 / 上游错位规则清退）

**⇒ +309 是「合理的保留量」，不是未完成的外置。**

### 4.3 ★ 本次复盘的最大价值：发现「上游去令牌化」趋势

上游本次对 globals.css 的 3 处改动中，**有 1 处是去令牌化**（`var()` → 字面值）。

**趋势判断**：上游正在**减少令牌抽象**（可能与 Celadon UI 替换同步）。

**对我方的影响**：
- 我方 flora 外置**依赖令牌层**（`flora-tokens.css` 覆盖同名变量）
- 若上游持续去令牌化，**可覆盖的令牌面会缩小**
- ⇒ **外置策略需关注此趋势**，但不改变当前方向（外置仍是对的：冲突面已证收敛）

**★ 记录为 PATCH-MAP 新类目**：「上游弃用令牌」—— 与既有 A/B/C 三类并列。

---

## 五、待办（本次复盘发现）

| # | 发现 | 处置 |
|---|---|---|
| 1 | **上游弃用令牌 `--canvas-mention-chip-offset-y`**（定义保留、使用点内联为 `-0.08em`，且 `vertical-align` 由 `baseline` 改 `middle`） | ✅ **已核实**：令牌是**上游原生**非 fork 引入；上游正在去令牌化。**下次同步需逐处人审该区块**，可能需 flora-overrides 补覆写；登记 PATCH-MAP 新类目 |
| 2 | 23 个冲突文件中「画布前端」占多数 | **非样式面**，属功能演进冲突，不在 PATCH-MAP 职责内（PATCH-MAP 只管 globals.css） |
| 3 | 上游 globals.css 本次 3 处改动全部与 fork 无重叠 | 记录：**上游样式改动与 fork 样式改动已实现「物理隔离」** |

---

## 六、纪律确认

本次复盘遵守：
- ✅ **试合并只在 ext4 clone 做**（`/home/windc0x/oac-ext4/oac-wt-test`）—— 纪律来自 2026-10-04 控制线主仓试合并超时事故
- ✅ **试合并后 abort + stash pop**，环境复原（HEAD 回 `c68b595a`，无残留）
- ✅ **不 push**（纯度量，无代码改动）
- ✅ **跨枝比较用当前拓扑**（merge-base `d328a257` 实测，非历史记录）

---

## 七、复盘产出

1. **外置承诺已验证**（globals.css 零冲突）
2. **冲突面基线建立**：23 冲突 / 242 自动合并（供下次同步对比）
3. **上游令牌消除苗头**（待核实项 1）
