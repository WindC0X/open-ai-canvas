# R6 回归面评审报告（评审线 · 第四线）

**锚点**：`e4b59f89`（= main = fork/main = remote，三方一致）
**范围**：B线 R5 修复批 merge `58eef5d2`（双亲 `525532ef × cf8fbf52`，6 文件 +187/-8）
- **P1** 跨卡片状态残留（`key={linearFlowCard?.id ?? "none"}`）
- **P2-1** D-2 路径 B 会话缺失（`TaskCanvasAction.navigate` 增 `sessionId?`）
- **P2-2** `scripts/merge-file-face.sh` 权限 `100644 → 100755`

**方法**：隔离树 `_r6 @ e4b59f89`（ext4）+ **依赖物理隔离**（R5 教训十六）+ 逐项注入证伪
**清单**：控制线 5 项评审重点 + §0 语义角色分类（强制前置）

---

## §0 结论摘要

| 项 | 结论 |
|---|---|
| **P1 修复充分性** | ✅ **充分** —— key 重建实例 ⇒ **全部** state + ref 重置（不止两个残留点） |
| **P1 守卫证明力** | ✅ **本仓最强可行组合**（B线「无 DOM」说法经我独立核查**准确**） |
| **★ 注入3 等价性论证** | ✅ **不变量成立**（形式化证明 + 7 变体穷举 + 注入实测 0 红） |
| **P2-1 sessionId 规则** | ✅ **正确**（取最后一条，依据充分；且经我实证 carrier 消息在 result 合并后存活） |
| **P2-2 权限完整性** | ✅ **完整**（index `100755` + 工作区 `-rwxr-xr-x` + 直接调用 exit 0） |
| **V9 三族防护** | ✅ **全部真实有效**（注释免疫 2 红 / 锚点消失显式报错 / 失败可诊断） |
| 全量基线 | ✅ **3114 pass / 0 fail / 368 files**（2 次跑，与控制线一致） |

**计数：P0=0 · P1=0 · P2=0 · P3=1**

**★ 三项修复全部有效，无回归。**

---

## §1 §0 语义角色分类（强制前置）

| commit | 角色 | 文件面 | 核验方式 |
|---|---|---|---|
| `cf8fbf52` | **fix**（P1 + P2-1 + P2-2） | 6 文件 +187/-8 | 注入证伪（6 项） |
| `525532ef` | docs（C8 纪律） | — | 跳过（docs） |

**★ 分类价值**：本批是**混合批**（一个 commit 含 3 项修复）——
P1（接线）与 P2-1（纯函数 + 接线）与 P2-2（文件 mode）**验证方式完全不同**：
- P1：只能接线守卫（key 语义需客户端 reconciler）
- P2-1：可行为测试（纯函数）+ 接线守卫
- P2-2：只能文件系统实证

**⇒ 分类避免了「用一种方式验三种修复」的错配。**

---

## §2 重点1：P1 修复充分性 —— ✅ 充分

### 2.1 key 是否真解决两个残留点

**R5 我列出的残留面**：
```
state: step, completed, answers, reference, uploading, stage, resultUrl,
       resultText, errorText, openingCanvas, taskId
ref:   fileInputRef, abortRef, canvasIdRef
```

**React key 语义**：key 变化 ⇒ 旧实例 `unmount` + 新实例 `mount`
⇒ **全部 `useState` 回到初始值** + **全部 `useRef` 重新创建**

**⇒ 两个残留点（`stage` + `canvasIdRef`）同时解决**，且**顺带解决 R5 未单独列出的其余残留**
（`resultUrl` / `resultText` / `taskId` / `answers` / `abortRef` 等）—— 修复**超出**两个点的范围。

### 2.2 key 取值域分析（穷举）

```
卡片A:   key = "card-a"
关闭:    key = "none"     ← card=null → ?? "none"
卡片B:   key = "card-b"
```
- 路径 `A → null → B`：key 变化两次（`A→none`，`none→B`）⇒ 两次重建 ✓
- 路径 `A → B`（直接切换，无中间 null）：key 从 `card-a → card-b` ⇒ 重建 ✓
- **`?? "none"` 的作用**：card 为 null 时 key **稳定**（不因 `undefined` 抖动），避免 React 警告 ✓

### 2.3 副作用核查

| 检查项 | 结果 |
|---|---|
| Modal 卸载异常 | ✅ 无 —— 新实例 mount 时 `card=null` ⇒ hooks 后立即 `return null`（不渲染 Modal） |
| `abortRef` 悬空 | ✅ 无 —— `handleClose` 在 key 变化前已调 `abortRef.current?.abort()` |
| 双重重置竞争 | ✅ 无 —— 组件零 `useEffect`，key 是**唯一**重置路径（反例锚点测试守护此前提） |

### 2.4 ★ 守卫证明力评估（控制线重点）

**B线 自报**：「P1 只能做接线守卫（无行为测试，因 `LinearFlowRunner` 需 antd Modal + `App` context，bun 无 DOM）」

**我的独立核查**：

| 核查项 | 实测 |
|---|---|
| ① 本仓有 DOM 测试库？ | ✗ 无（`package.json` 无 `happy-dom` / `jsdom` / `@testing-library/react` / `react-test-renderer`） |
| ② SSR 能渲染 `LinearFlowRunner`？ | 渲染**不抛错**，但**输出为空**（长度 0） |
| ③ 为何为空？ | antd `Modal` 走 **portal**，`renderToStaticMarkup` **不渲染 portal**（对照实验确认） |
| ④ 既有 `.tsx` 测试范式 | 30/35 用 `renderToStaticMarkup`，5 用 `render()` —— 均为「静态标记」范式 |

**⇒ B线 的评估准确**：key 语义只在**客户端 reconciler** 生效，SSR 每次都是全新渲染 ⇒
**本仓确实无法对 key 语义做行为测试**。接线守卫 + 真机验证是**本仓可行的最强组合**。

**★ 且 B线 的接线守卫质量高**：
- 切片到挂载点属性区（`code.slice(mountAnchor, code.indexOf("/>", mountAnchor))`）—— 避免匹配文件其他位置的 key
- 三条断言分层（存在性 / 引用 card id / 带 `?? "none"` 回退）
- **反例锚点测试**：断言 runner 无 `useEffect` 且保留 `if (!card) return null` —— 守护「key 是唯一重置路径」前提

**我的注入验证**：给 runner 加 `useEffect` → **反例锚点变红** ✅（信息：「key 不再是唯一重置路径，需复核两套重置的语义」）

---

## §3 ★ 重点2：注入3 的等价性论证 —— ✅ 不变量成立

### 3.1 B线 的主张

> 路径B 的 `findTaskSessionId` 是死代码 —— 因 `findLinearFlowContainer` 全库扫描，
> 路径A 未命中 ⇒ 路径B 可达时全库无此会话。

### 3.2 我的形式化证明

```
【定义】
  A_hit  ⟺ findLinearFlowContainer(taskId, projects) ≠ undefined
         ⟺ ∃p∈projects, ∃s∈p.chatSessions, ∃m∈s.messages: readTaskIds(m.detail) ∋ taskId
  B_reach ⟺ ¬A_hit ∧ task.projectId≠∅ ∧ bound = projects.find(p.id = task.projectId) ≠ ∅
            ∧ isHeadlessTaskWorkspace(bound.workspaceType)

【待证】B_reach ⇒ findTaskSessionId(taskId, bound) = undefined

【证明】
  B_reach ⇒ ¬A_hit
          ⇒ ∀p∈projects: ¬∃s∈p.chatSessions, ∃m∈s.messages: readTaskIds(m.detail) ∋ taskId
  bound ∈ projects（bound = projects.find(...) 的返回值必是数组元素）
          ⇒ 特别地 ¬∃s∈bound.chatSessions, ∃m∈s.messages: readTaskIds(m.detail) ∋ taskId
  而 findTaskSessionId 的扫描域恰为 bound.chatSessions × messages × readTaskIds
          ⇒ findTaskSessionId(taskId, bound) = undefined   ∎

【前提核查（4 项，全部实测）】
  ① 全库扫描：findLinearFlowContainer 外层 for..of projects ✓
  ② 判据一致：两函数都用 readTaskIds(message.detail).includes(taskId) ✓
  ③ 同一 projects：resolveTaskCanvasAction 内两次调用都用入参（无 await、无重取）✓
  ④ 扫描域包含：{bound} ⊆ projects ✓
```

### 3.3 穷举验证（7 变体，全部成立）

| 变体 | 结果 |
|---|---|
| 空容器 | sessionId = undefined ✓ |
| 有会话但无该 taskId | undefined ✓ |
| 会话无 detail | undefined ✓ |
| detail 无 taskIds | undefined ✓ |
| taskIds 非数组（字符串） | undefined ✓ |
| taskIds 含非字符串 | undefined ✓ |
| 别的容器有会话（不同 taskId） | undefined ✓ |

### 3.4 注入实测（精确复现控制线的「注入3」）

| 注入形态 | 代码 | 结果 |
|---|---|---|
| **A（等价形态）** | 路径B 加回 `sessionId: findTaskSessionId(task.id, bound)` | **0 红** ✅（值恒 undefined，与不写等价） |
| **B（错误形态）** | 路径B 硬编码 `sessionId: \`creation:linear-flow-${task.id}\`` | **2 红** ✅（值非 undefined，破坏语义） |

**★ 澄清**：控制线记录的「注入3 → 0 红」对应**注入 A**（等价性证据）✓ 记录准确。
两者都是「给路径B 加 sessionId 字段」，但**值不同** ⇒ 结果不同 —— 这说明测试**验的是语义而非字段存在性**（更强的守卫）。

**⇒ 我无法构造「路径A 未命中 + 路径B 可达 + 容器内确有该 taskId 会话」的情形** ——
B线 的简化**正确**。

---

## §4 重点3：sessionId「取最后一个」的选择规则 —— ✅ 正确

### 4.1 依据核查

**B线 的依据**：「`creation-canvas-conversation.ts:51` 的 `[...filter, session]` 追加语义」

**我的核实**（`:51`）：
```ts
useCanvasStore.getState().updateProject(project.id, {
    chatSessions: [...sessions.filter((item) => item.id !== sessionId), session],  // ★ 替换语义
    activeChatId: sessionId,
});
```
**⇒ 是「先过滤同 id 再追加」= 替换语义**（非简单追加）——
同一 sessionKey **不会**产生第二条会话。

### 4.2 多会话可达性分析

**哪些写入会带 `taskIds`**（决定会话可被 `findTaskSessionId` 命中）：

| 写入点 | 带 taskIds？ | sessionKey |
|---|---|---|
| 卡流程 carrier（`create/index.tsx`） | ✅ `taskIds: [handoff.taskId]` | `linear-flow-${taskId}` |
| 卡流程 result（`create/index.tsx`） | ❌ 只有 `attachments` | `linear-flow-${taskId}`（**同**） |
| D-2 重建（`tasks/index.tsx`） | ✅ `taskIds: [task.id]` | `linear-flow-${taskId}`（**同**） |

**★ 关键发现（我实证的）**：result 分支**不带 taskIds**，但 carrier 消息**在 result 合并后存活**。

**我的模拟验证**（复刻 service 的真实映射 + 合并逻辑）：
```
★ 会话数: 1                          ← 替换语义 ⇒ 唯一
★ 合并后消息:
   creation:linear-flow-t1:linear-flow-user-linear-flow-t1       detail.taskIds=undefined
   creation:linear-flow-t1:linear-flow-carrier-linear-flow-t1    detail.taskIds=["t1"]   ← ★ 存活
   creation:linear-flow-t1:linear-flow-assistant-linear-flow-t1  detail.taskIds=undefined
★ findTaskSessionId(t1) = creation:linear-flow-t1   ✓
```

**⇒ 结论**：
1. 正常路径下**同一容器同一 taskId 只有一条会话**（替换语义）
2. 「取最后一个」是**防御性设计**（历史数据/异常写入可能产生多条）
3. **carrier 消息存活**保证 result 交接后容器仍可被反查命中 ✓

### 4.3 「最后一条是用户期望落点」的语义核查

**测试用例**（`linear-flow-task-link.test.ts`）：
```ts
test("同 taskId 多会话 ⇒ 取最后一个（P2-1 场景③：result 晚于 carrier 写入）", ...)
```
**⇒ 依据**：`chatSessions` 数组尾部 = **最近更新**（service 的 `[...filter, session]` 把更新项追加到尾部）⇒
后写入的更接近用户期望的落点 ✓ **语义正确**。

---

## §5 重点4：P2-2 权限完整性 —— ✅ 完整

| 核查项 | 实测 |
|---|---|
| ① index（git 记录） | `100755` ✅ |
| ② 工作区实际权限 | `-rwxr-xr-x` ✅ |
| ③ **直接调用**（R5 时 Permission denied） | `./scripts/merge-file-face.sh 58eef5d2` → **exit 0**，stdout 6 行，stderr `文件数: 6` ✅ |
| ④ diff 确认本批唯一改动 | `old mode 100644` / `new mode 100755`（**零内容变更**）✅ |

**★ 控制线问「只改 index 时 `./script` 仍 Permission denied」** —— **确认**：
- git 的 `mode` 变更**只改 index**；工作区文件的实际权限位需要 `git checkout` 或 `update-index --chmod` 后由 git 在检出时应用
- 本批已把**两侧**都改到（index `100755` + 工作区 `-rwxr-xr-x`）✓

**对照**：`scripts/` 下 3 个 `100644`（`snapshot-registry-seeds.sh` / `fetch-cutout-models.sh` / 本脚本修复前）
—— **本脚本现已与 4 个 `100755` 的安装脚本一致** ✓

---

## §6 重点5：V9 三族防护 —— ✅ 全部真实有效

| V9 族 | B线 的实现 | 我的注入 | 实测 |
|---|---|---|---|
| **① 注释免疫** | `stripComments(pageSource)` 先剥注释 | **注释掉 key** | **2 红** ✅ |
| **② 锚点消失** | `expect(mountAnchor, "...").toBeGreaterThan(-1)` 前置 | **挂载点改名 `<Runner>`** | **显式报错**：「找不到 `<LinearFlowRunner` 挂载点 —— 锚点消失，断言失效」✅ |
| **③ 失败可诊断** | 每条断言带自定义消息说明「移除什么会红、为什么」 | **移除 key** | 错误信息含具体代码行 + 原因 ✅ |

**族② 首次注入失败（我的方法问题）**：我先把 `<LinearFlowRunner` 改成 `<LinearFlowRunnerX` ——
`indexOf("<LinearFlowRunner")` **仍命中**（前缀匹配）⇒ 0 红。
**重做为 `<Runner>`（真锚点消失）→ 显式报错** ✅
**⇒ 记录为方法提醒**：锚点消失注入必须确保新名字**不含**原锚点作为子串。

### 6.1 反例锚点测试（B线 的额外防护）

```ts
test("反例锚点：组件确实无 useEffect 重置（说明 key 是唯一重置路径）", ...) {
    expect(code, "runner 新增了 useEffect —— key 不再是唯一重置路径，需复核两套重置的语义").not.toContain("useEffect(");
    expect(code, "`if (!card) return null` 消失 —— 实例保留前提变了，需复核 key 必要性").toContain("if (!card) return null");
}
```

**我的注入**：给 runner 加 `useEffect` → **变红** ✅，信息为「key 不再是唯一重置路径，需复核两套重置的语义」。

**⇒ 这是「守卫的守卫」**：它不验修复本身，而是**守护修复的前提**——
若未来有人加了第二条重置路径，会提示复核语义一致性（避免双重重置/时序竞争）。
**设计质量高。**

---

## §7 证伪汇总（控制线 4 项 + 我的 6 项）

**★ 记账更正（控制线 R6 验收指出，2026-10-05）**：
本表初版把「控制线的注入2（无条件 conversation）」与「我的新注入（key 硬编码）」**并成同一行比较**，
误述为「同一注入有分歧」。**实际是两项完全不同的注入**，两项都成立：
```
注入 A（控制线的注入2）：tasks/index.tsx 恢复无条件 conversation  → 5 pass / 1 fail
注入 B（我的新注入）  ：create/index.tsx key 硬编码 key="runner"  → 4 pass / 2 fail
```
控制线已独立重跑确认（两项数字一致）。**更正后的对应关系见下表**。

| # | 注入 | 对象文件 | 我的实测 | 控制线记录 | 判定 |
|---|---|---|---|---|---|
| 1 | 移除 key | `create/index.tsx` | **2 红** | 1→2红 | ✅ 同一注入，一致 |
| 2 | 恢复无条件 conversation（P2-1 接线） | `tasks/index.tsx` | **1 红** | 2→1红 | ✅ **同一注入**，一致 |
| 3 | 路径B 加回冗余查询（等价形态） | `linear-flow-task-link.ts` | **0 红** | 3→0红 | ✅ 同一注入，一致 |
| 4 | 移除路径A 的 sessionId | `linear-flow-task-link.ts` | **4 红** | 4→4红 | ✅ 同一注入，一致 |
| 5 | 注释掉 key（V9 族①） | `create/index.tsx` | **2 红** | — | ✅ 新增 |
| 6 | 挂载点改名（V9 族②） | `create/index.tsx` | **显式报错** | — | ✅ 新增 |
| 7 | 路径B 硬编码错误 sessionId | `linear-flow-task-link.ts` | **2 红** | — | ✅ 新增（语义破坏被捕获） |
| 8 | runner 加 useEffect（反例锚点） | `linear-flow-runner.tsx` | **1 红** | — | ✅ 新增 |
| 9 | 移除 `?? "none"` 回退 | `create/index.tsx` | **2 红** | — | ✅ 新增 |
| 10 | **key 硬编码 `key="runner"`** | `create/index.tsx` | **2 红** | — | ✅ 新增（**非控制线注入2**） |

**★ 更正要点**：
- **控制线的注入2 = 本表 #2**（无条件 conversation）—— 与我的实测**完全一致**（1 红）
- **我原来的「#2」= 本表 #10**（key 硬编码）—— 是我新增的注入，**控制线未记录过**
- 初版表格的错因：**两列语义不同**（「我的实测」列按我的注入序列，「控制线记录」列按控制线的注入序列），
  逐行对齐时会错配。**教训：跨序列对比必须按「注入对象 + 形态」对齐，不能按序号对齐。**

---

## §8 全量基线与环境

```
锚点 e4b59f89（ext4 隔离树 _r6）
  ★ 依赖物理隔离（cp -r，非软链 —— R5 教训十六）
  全量 bun test ×2 → 3114 pass / 0 fail / 15727 expect / 368 files  ✅ 与控制线一致
  本批相关三文件 → 36 pass / 0 fail
```

**环境纪律执行**：
- ✅ 依赖**物理隔离**（`cp -r`，`web` 2.3G + `pi` 252M）
- ✅ 未在 `/mnt/f` 跑测试（V6）
- ✅ 未使用他人树（R5 令⑤）
- ✅ 已知 flaky `agent-canvas-sync.test.ts:75` **本轮未出现**（2 次跑全绿）

---

## §9 覆盖声明

| 项 | 状态 |
|---|---|
| **已核验** | 5 项评审重点（全部通过）+ 10 项注入证伪 + 形式化不变量证明 + 7 变体穷举 + SSR 可行性核查 |
| **未核验** | 真机证据（B线 自跑 6 步）—— 我无浏览器环境，**采信控制线转述**；`525532ef`（docs 类，跳过） |
| **新发现** | 无 P1/P2。**P3-1**：见下 |
| **产出** | 本文件 + `.trellis/workspace/WindC0X/review/r6/r6-report.md` |

### P3-1：锚点消失注入的子串陷阱（方法提醒，非产品缺陷）

`indexOf("<LinearFlowRunner")` 对 `<LinearFlowRunnerX` **仍命中**（前缀匹配）——
若未来有人用「改名」形态注入锚点消失，需确保新名字**不含**原锚点作为子串，
否则会误判为「锚点防护无效」。**已记录为注入方法提醒。**

---

**计数：P0=0 · P1=0 · P2=0 · P3=1**

**★ 一句话结论**：三项修复**全部有效且超出预期** ——
P1 的 key 不仅解决两个残留点（顺带解决全部 state/ref 残留），
P2-1 的路径B 简化经**形式化证明 + 穷举 + 注入**三重验证**等价性成立**，
P2-2 权限两侧完整；测试守卫**V9 三族全防**且含**「守卫的守卫」**（反例锚点）。

**评审线（第四线）· R6 · 2026-10-05**
