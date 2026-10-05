# R5 回归面评审报告（评审线 · 第四线）

**锚点**：`86f04568`（G5 绑定；main tip）
**范围**：
- **对象1**：B线 主批 `f0d2650e`（D-1/D-2 可达性，9 文件 +639/-10）
- **对象2**：B线 G1 工具批 `86f04568`（`scripts/merge-file-face.sh`，1 文件 +75）
- **对象3**：测试线 b12r22 报告 —— **未落盘**（`docs/artifacts/b12r22/` 不存在），无法评审

**方法**：隔离树 `_r5 @ 86f04568`（ext4）+ 逐条注入证伪 + 全量基线
**清单**：R4 检查清单 v2 + §0 语义角色分类（强制前置）

---

## §0 结论摘要

| 项 | 结论 |
|---|---|
| **对象1（D-1/D-2）** | ⚠️ **实现正确**，但发现 **1 个 P1**（跨卡片状态残留）+ **1 个 P2**（路径 B 会话缺失） |
| **对象2（G1 脚本）** | ⚠️ **逻辑正确**，但发现 **1 个 P2**（无执行权限） |
| **对象3（b12r22）** | ⊘ **未落盘，无法评审** |
| **6 项评审重点** | ✅ **5 项通过**（时序/降级/两段式/收窄/sessionKey）+ ⚠️ **1 项有保留**（测试形态） |
| **6 次证伪注入** | ✅ **6/6 全部变红**（测试有效性确认） |
| 全量基线 | ✅ 3106 pass / 0 fail（依赖物理隔离后 5/5 全绿） |

**计数：P0=0 · P1=1 · P2=3 · P3=1**

---

## §1 §0 语义角色分类（强制前置）

| commit | 角色 | 文件面 | 核验方式 |
|---|---|---|---|
| `1222f3cc` | **fix**（主实现） | 9 文件 +618/-10 | 注入证伪（6 条） |
| `e6061c6b` | **fix**（真机修复） | 2 文件 +22/-1 | 收窄判据核验 |
| `2dcdb828` | docs（journal） | 1 文件 +61 | 零残留（跳过） |
| `a0dee364` | **chore**（脚本引入） | 1 文件 | 边界测试 |
| `2ec6d12b` | **docs**（补契约注释） | 1 文件 +8 | 契约核验 |

**★ 分类价值**：`1222f3cc` 与 `e6061c6b` **都是 fix**，但后者是**收窄修复**（真机验收发现过度标记）——
注入方式不同（前者验时序/降级，后者验收窄判据）。**分类避免了验证对象错配**（V1 教训应用）。

---

## §2 对象1：D-1/D-2 六项评审重点

### 2.1 ✅ 重点1：D-1 预建时序正确性

```ts
// linear-flow-runner.tsx:200-208
if (!canvasIdRef.current && onPrepareCanvas) {
    try { canvasIdRef.current = (await onPrepareCanvas({ title: card.title })) || ""; }
    catch (error) { console.warn("预建承载容器失败，本次任务不带 projectId", error); }
}
const canvasId = canvasIdRef.current;
const result = await runBackendGenerationTask({
    ...(canvasId ? { projectId: canvasId } : {}),   // ← 任务创建带 projectId
```

**我的注入**：把预建块移到 `runBackendGenerationTask` **之后**（时序倒置）
**结果**：**1 红** ✅
```
(fail) runner 提交前调 onPrepareCanvas，且任务创建带 projectId
```

**⇒ 时序正确**：预建在任务创建之前，且测试能抓住倒置。

### 2.2 ✅ 重点2：D-1 降级路径

**实现**：`try/catch` + `|| ""` + 条件展开（无 id 时不传 projectId）。

**我的注入**：移除 `try/catch`（降级失效）
**结果**：**1 红** ✅
```
(fail) runner 预建失败不阻塞生成（降级为不带 projectId）
```

**⇒ 降级完整**：预建失败不阻塞生成。

### 2.3 ✅ 重点3：D-2 两段式判定顺序

**实现**（`tasks/index.tsx`）：
```ts
if (action.kind === "navigate") { navigate(...); return; }   // ① 本地零请求
if (action.kind === "none") return;
const detail = ... await queryGenerationTask(task.id);        // ② 详情确认
if (!isLinearFlowTask(detail.inputJson)) { message.info(...); return; }   // ★ 确认前置
const created = await continueCreationConversationOnCanvas(...);          // ③ 才建容器
```

**我的注入（首轮失败）**：只交换 `setLinearFlowTaskIds` 与确认 —— **0 红**
**★ 我的方法教训**（同 R4 C-1）：注入必须覆盖**完整因果链**。首轮注入未移动 `isLinearFlowTask` 本身，测试的 `confirmAnchor < createAnchor` 仍成立。

**我的注入（正确形态）**：把 `isLinearFlowTask` 确认块整体移到 `continueCreationConversationOnCanvas` **之后**
**结果**：**1 红** ✅
```
(fail) 接线：两段式判定（本地容器 → 详情确认）
```

**⇒ 顺序正确**：确认前置，普通任务不会被建空容器。

### 2.4 ✅ 重点4：D-2 收窄正确性（防过度标记）

```ts
// linear-flow-task-link.ts:resolveTaskCanvasAction
if (task.projectId) {
    const bound = projects.find((project) => project.id === task.projectId);
    if (bound && isHeadlessTaskWorkspace(bound.workspaceType)) return { kind: "navigate", ... };
}
if (task.projectId) return { kind: "none" };   // 已绑定普通画布 ⇒ 不提供
```

**我的注入**：移除 `isHeadlessTaskWorkspace` 收窄（`if (bound)` 直接 navigate）
**结果**：**1 红** ✅
```
(fail) 已绑定普通画布（非 headless）⇒ none（画布页本就有入口，不重复）
```

**⇒ 收窄有效**：普通画布任务不会长出多余按钮。

### 2.5 ✅ 重点5：sessionKey 一致性

| 位置 | sessionKey |
|---|---|
| 卡流程 carrier（`create/index.tsx:1145`） | `linear-flow-${handoff.taskId}` |
| 卡流程 result（`create/index.tsx:1173`） | `linear-flow-${handoff.taskId}` |
| D-2 重建（`tasks/index.tsx:350`） | `linear-flow-${task.id}` |
| service 内部前缀 | `creation:${source.id}` ⇒ `creation:linear-flow-<taskId>` |
| D-2 navigate 参数 | `creation:linear-flow-${task.id}` |

**我的注入**：把 D-2 的 sessionKey 改为 `task-face-${task.id}`
**结果**：**1 红** ✅

**⇒ 一致**（详见 §3 P2 的另一面）。

### 2.6 ⚠️ 重点6：测试形态判定（V9 三族逐条检查）

**B线 的测试形态**：源码文本断言（`Bun.file` + `stripComments` + `indexOf` + `toContain`）。

**V9 三族逐条核查**：

| V9 族 | B线 的实现 | 判定 |
|---|---|---|
| **① 注释免疫** | `stripComments(runnerSource)` 先剥注释再断言 | ✅ **已防** |
| **② 锚点消失** | `expect(prepareAnchor).toBeGreaterThan(-1)` 前置 | ✅ **已防** |
| **③ 失败路径不可诊断** | 断言消息含具体文件名与锚点名 | ✅ **已防** |

**我的证伪验证**：注释掉 `...(canvasId ? { projectId: canvasId } : {})` → **1 红** ✅
（若未 `stripComments`，注释形态会假绿 —— 实测确认防护有效）

**★ 判定：属于「可接受的接线守卫」**，理由：
1. **三条 V9 族全部主动防护**（B线 自己写的防护，非事后补）
2. **顺序断言**（`prepareAnchor < submitAnchor`、`confirmAnchor < createAnchor`）——**注释无法满足**
3. **行为测试存在**：`linear-flow-task-link.test.ts`（163 行）对纯函数做真值/反例/类型守卫测试
4. **接线 + 行为分层清晰**：源码断言管「接线是否还在」，行为测试管「逻辑是否正确」

**★ 但有一处保留**（见 §4 P3-1）：`expect(code.match(/.../g)).toHaveLength(2)` 形式的**计数断言**在
「两分支之一被删除」时会红，但**在「两处都改成错误值」时不会**——计数只验数量不验内容。

---

## §3 ★ P1 发现：跨卡片状态残留（`canvasIdRef` + `stage`）

### 3.1 现象

`LinearFlowRunner` 组件注释（`:102`）**明确宣称**：
```
单卡单流程：`card` 变化即重置（同一时刻只跑一张卡）。
```

**但实测**：组件**零 `useEffect`**，父组件 JSX **无 `key`**，且 `LinearFlowRunner` **无条件渲染**。

### 3.2 根因链

```
① 用户点卡片 A → setLinearFlowCard(cardA) → 组件渲染
② 生成完成 → stage="done"，canvasIdRef.current = 容器A
③ 用户点「取消」/ 关闭 Modal → handleClose → onClose → setLinearFlowCard(null)
   ★ 组件**不卸载**（无条件渲染）→ hooks 全部保留
   ★ handleClose **不调用 reset()**（只 abort + onClose）
④ 用户点卡片 B → setLinearFlowCard(cardB) → **同一实例**
   ★ stage 仍 = "done"（残留）→ 直接显示卡片 A 的结果图
   ★ canvasIdRef.current 仍 = 容器A（残留）
⑤ 用户点「开始出图」→ `if (!canvasIdRef.current && onPrepareCanvas)` 为 false
   → **跳过预建** → 卡片 B 的任务带**卡片 A 的 projectId** ✗
```

### 3.3 实证

```ts
// 我的插桩验证（临时测试，已删除）
★ useEffect 数量: 0
★ canvasIdRef 清空点数量: 1（仅在 reset() 内）
★ 父组件 JSX 是否带 key: false
★ 关闭后组件行为: if (!card) return null（提前返回，不卸载）
```

**关键代码证据**：
- `linear-flow-runner.tsx:102` — 注释宣称「card 变化即重置」
- `linear-flow-runner.tsx:129-141` — `reset()` 是唯一清空点，**只在用户点「重新来一次」时调用**
- `linear-flow-runner.tsx:144-148` — `handleClose` **不 reset**
- `create/index.tsx:1117` — `<LinearFlowRunner card={linearFlowCard} ...>` **无 `key`**

### 3.4 是否本批引入

| 项 | 本批前 | 本批后 |
|---|---|---|
| `useEffect` 数 | 0 | 0 |
| `canvasIdRef` | ❌ 不存在 | ✅ **本批新增** |
| `stage`/`resultUrl`/`taskId` 残留 | ✅ 既有（**既有缺陷**） | ✅ 仍存在 |

**⇒ 本批的 `canvasIdRef` 使既有残留缺陷的后果加重**：
- **本批前**：卡片 B 会显示卡片 A 的残留 UI（stage/resultUrl），但**用户点「重新来一次」即可恢复**
- **本批后**：`canvasIdRef` 残留导致卡片 B 的任务**静默带上卡片 A 的 projectId** ——
  **用户无感知，且无 UI 可恢复**（`reset()` 清空 ref，但用户不知道要按）

### 3.5 影响

| 场景 | 后果 |
|---|---|
| 卡片 A 完成 → 关闭 → 卡片 B | ① 显示卡片 A 的结果图（既有）② 任务带卡片 A 的 projectId（**本批新增**）|
| 后果②的具体表现 | 卡片 B 的生成任务出现在**卡片 A 的容器**里；D-2 反查时 `findLinearFlowContainer` 会把卡片 B 的任务归到卡片 A 的容器 |
| 严重性 | **数据错位**（任务与容器错配），非崩溃；但**无 UI 提示**，用户难以发现 |

### 3.6 建议修法（优先级）

```
① 父组件加 key：<LinearFlowRunner key={linearFlowCard?.id ?? "none"} ...>
   —— 一行，最彻底（card 变化即重挂，注释宣称的行为真正成立）
② 或组件内加 useEffect(() => { reset(); }, [card?.id, reset])
   —— 保持组件自洽，但需处理 reset 在 render 后执行的时序
③ 或 handleClose 调用 reset()
   —— 只解决「关闭后重开」路径，不解决「直接切换卡片」路径
```

**★ 建议 ①**：与注释宣称一致，且零副作用（`card.id` 变化 → 新实例）。

---

## §4 ★ P2 发现

### 4.1 P2-1：D-2 路径 B 的会话缺失（导航后弹警告）

**场景**：D-1 预建容器命中（用户**从未点过**「在画布中打开」）

```
D-1: createCanvasProjectLocal(title, { workspaceType }) → createProject
     ⇒ chatSessions: []（空，无会话）
D-2: resolveTaskCanvasAction 按 projectId 命中 headless 容器 → navigate
     ⇒ navigate(`/canvas/${canvasId}?conversation=creation:linear-flow-${task.id}`)
画布页: project.tsx:681
     if (!chatSessions.some((s) => s.id === sessionId)) {
         message.warning("未找到要接续的会话，请从首页重新进入。");
     }
```

**我的实证**（临时测试，已删除）：
```ts
★ 会话存在？ false | 会话数: 0
★ 画布页行为: 弹 warning「未找到要接续的会话」
```

**影响**：用户从 `/tasks` 点「在画布中打开」→ 画布**打开了**，但弹警告且**智能体面板未打开**（`openAgent()` 在 else 分支）。

**修法建议**：
```
① navigate 前判断会话是否存在，不存在则不带 conversation 参数（最简）
② 或 D-2 的 navigate 分支也走 continueCreationConversationOnCanvas 补齐会话
③ 或画布页对 headless 容器的「会话不存在」降级为静默（不弹警告）
```

**★ 建议 ①**：与「本地反查命中」路径（路径 A）天然有会话不同，路径 B 是「容器存在但无会话」。

### 4.2 P2-2：`scripts/merge-file-face.sh` 无执行权限

```bash
$ ls -l scripts/merge-file-face.sh
-rw-r--r-- 1 windc0x windc0x 3195 ... scripts/merge-file-face.sh
$ git ls-files -s scripts/merge-file-face.sh
100644 329427cd... 0	scripts/merge-file-face.sh
```

**但**：
- 脚本自身 usage 注释写的是 `scripts/merge-file-face.sh <merge-commit>`（直接调用形态）
- G1 纪律文档（`docs/artifacts/multi-line-discipline.md:97`）称其为「工具脚本」
- 脚本内示例：`FILES=$(scripts/merge-file-face.sh <merge> --exclude-deleted web ts tsx) || exit 1`

**实测**：
```
$ ./scripts/merge-file-face.sh 86f04568
/bin/bash: ./scripts/merge-file-face.sh: Permission denied   (exit 126)
$ bash scripts/merge-file-face.sh 86f04568   # 显式 bash 可用
文件数: 1 ...
```

**对照**：`scripts/` 下 7 个 `.sh`，4 个 `100755`（有 +x），3 个 `100644`（无 +x，含本脚本）。

**影响**：按文档示例**直接调用会失败**（exit 126），需改用 `bash scripts/...`。
**修法**：`git update-index --chmod=+x scripts/merge-file-face.sh`（一行）。
**定级**：P2（工具可用性；有 workaround；非产品代码）。

### 4.3 P2-3：依赖软链穿透（评审环境纪律，非产品缺陷）

**发现**：我的 `_r5` 树依赖链为 `_r5/web/node_modules → oac-wt-baseline/web/node_modules → oac-wt-test/web/node_modules`（**穿透到测试线 twin**），而测试线 twin 的 vite（`:3400`）**正在运行**。

**后果**：软链期全量跑出现**间歇红**（首轮 4 次跑 3 次红 `task-face-independence` 护栏 + 1 次 `agent-canvas-sync` flaky）。
**物理隔离后**（`cp -r` 复制依赖）：**5/5 全绿**（3106 pass / 0 fail）。

**⇒ 这是评审环境纪律问题**（R5 令 ⑤ 已要求「不用别人的树」，我首轮违反），非产品缺陷。
**但值得登记**：**依赖共享 + 他人活跃进程 = 不可靠测量**。R4 已登记「依赖共享、源码隔离」，
本轮补充：**共享依赖在他人有活跃写入时会导致假红**。

---

## §5 对象2：G1 工具脚本核验

### 5.1 ✅ 空输入防线有效

```bash
mapfile -t FILES < <(git diff --name-only ${DIFF_FILTER:+"$DIFF_FILTER"} "${MERGE}^1" "${MERGE}")
...
echo "文件数: ${#FILES[@]}" >&2
if [ ${#FILES[@]} -eq 0 ]; then echo "❌ 文件面为空，中止" >&2; exit 1; fi
```

**实测四态**：

| 场景 | exit | stderr |
|---|---|---|
| 无参数 | **2** | `用法: ...` |
| 不存在的 commit | **1** | `❌ 无法解析 commit` |
| SCOPE 过滤后为空 | **1** | `文件数: 0` + `❌ 文件面为空，中止` |
| 有效输入 | **0** | `文件数: 1` |

**⇒ 防线有效**（空输入显性为 0 + exit 1），且**注释解释了为何不用 `echo \| wc -l`**（`echo ""` 也产生 1 行）。

### 5.2 ✅ 根 commit 边界 fail-closed

**实测**：根 commit（无 `^1`）
```bash
$ bash scripts/merge-file-face.sh <root>
fatal: ambiguous argument '<root>^1': unknown revision...
文件数: 0
❌ 文件面为空，中止
exit=1
```

**⇒ fail-closed 正确**：`git diff` 失败 → 空数组 → 防线拦截（不是静默 exit 0）。
**★ 这与我 R4 审出的 A-3（`snapshot-registry-seeds.sh` 空输入 exit 0 假通过）形成对照** ——
同类脚本，**本脚本的防线更完整**（数组 + 显性计数 + exit 1）。

### 5.3 ✅ `set -euo pipefail` 行为安全

| 检查项 | 实测 |
|---|---|
| `[ $# -gt 0 ] && shift`（`$#=0` 时） | ✅ 存活（未因 `set -e` 退出） |
| 空数组 `${A[@]}` 展开（`set -u`） | ✅ 存活（bash 4.4+ 语义） |
| bash 版本 | 5.2.21 |

### 5.4 ✅ SCOPE 剥前缀契约可靠

**实测**：
```
$ bash scripts/merge-file-face.sh 86f04568 web ts tsx
提示: 输出路径已剥离 'web/' 前缀，请在 web/ 下消费（cd web && <tool> $FILES）   ← stderr
文件数: 0
❌ 文件面为空，中止
```
**⇒ stderr 提示在位**（与 stdout 分离，不污染 `$(...)` 捕获）。

**stdout 纯净性验证**：
```
$ out=$(bash scripts/merge-file-face.sh 86f04568 2>/dev/null)
stdout=[scripts/merge-file-face.sh]     ← 仅文件清单 ✓
$ err=$(bash scripts/merge-file-face.sh 86f04568 2>&1 >/dev/null)
stderr=[文件数: 1]                       ← 提示与计数在 stderr ✓
```

### 5.5 边界观察（P3）

**参数顺序敏感性**：`--exclude-deleted` 必须在 SCOPE **之前**。
```bash
$ bash scripts/merge-file-face.sh 86f04568 web --exclude-deleted
提示: 输出路径已剥离 'web/' 前缀...
文件数: 0            ← 把 --exclude-deleted 当成扩展名过滤了
```
**⇒ 静默语义漂移**（不报错，但结果与预期不同）。脚本 usage 已注明顺序，故降为 **P3**。

---

## §6 对象3：b12r22 报告 —— 未落盘

```bash
$ ls docs/artifacts/b12r22/        # 评审仓
  ✗ 不存在
$ ls /mnt/f/CODE/Project/open-ai-canvas/docs/artifacts/b12r22/   # 主仓
  ✗ 不存在
$ find . -name "*b12r22*"
  （无结果）
```

**⇒ 无法评审**。控制线已让测试线补落，**落盘后我可补做**（预计 1 轮）。

---

## §7 全量基线与环境

```
锚点 86f04568（ext4 隔离树 _r5）
  ★ 依赖物理隔离前：6 次跑 → 2 次 3105/1（护栏间歇红 + flaky）
  ★ 依赖物理隔离后：5 次跑 → 5 次 3106 pass / 0 fail  ← 权威测量
```

**隔离措施**：
- `web/node_modules`：`cp -r`（2.3G，物理复制，非软链）
- `backend/agent-runtime/pi/node_modules`：`cp -r`（252M）
- **未在 `/mnt/f` 跑测试**（V6）
- **未使用他人树**（R5 令 ⑤；首轮软链穿透已纠正）

**★ 与 R4 对比**：R4 是「依赖共享、源码隔离」，本轮升级为**依赖物理隔离**（更严格）。

---

## §8 覆盖声明

| 项 | 状态 |
|---|---|
| **已核验** | 对象1 六项重点（5 通过 + 1 保留）+ 6 条注入证伪 + 对象2 五项边界 |
| **未核验** | 对象3（未落盘）；对象2 的「含空格文件名」场景（`mapfile` 数组理论上安全，未构造真实用例） |
| **新发现** | P1-1 跨卡片状态残留 / P2-1 D-2 路径 B 会话缺失 / P2-2 脚本无 +x / P2-3 依赖软链穿透（环境纪律）/ P3-1 计数断言只验数量 |
| **产出** | 本文件 + `.trellis/workspace/WindC0X/review/r5/r5-report.md` |

---

**计数：P0=0 · P1=1 · P2=3 · P3=1**

**★ 一句话结论**：D-1/D-2 的**六项设计意图全部正确实现且可证伪**（6/6 注入变红），
但组件的**跨卡片状态残留**（注释宣称「card 变化即重置」而实现无重置）在本批新增的 `canvasIdRef`
作用下从「UI 残留」升级为「任务与容器静默错配」，需修。

**评审线（第四线）· R5 · 2026-10-05**
