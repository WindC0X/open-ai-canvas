# R4 第一段 · 追加件：路径 B 时序可行性评估（回答控制线 §6）

> **触发**：控制线 §6 要求评估「路径 B（先建容器 → 拿 canvasId → 建任务）在 `/create` 上下文能否安全建容器」。
> **结论**：**可行**，且比预估更简单 —— **路径 B 甚至不需要「先建容器再建任务」的时序编排**。

---

## §1 核心发现：`projectId` 参数**早已存在**，只是 runner 没传

```ts
// web/src/services/api/generation-task.ts:33
projectId?: string;              // ← 参数面已有

// :74-76
export async function runBackendGenerationTask({ projectId, ... })

// :102
return createAndWaitGenerationTask({ projectId, mode, prompt, ... }, ...)
```

而 runner 的调用（`linear-flow-runner.tsx:183-192`）**没有传 projectId**：

```ts
const result = await runBackendGenerationTask({
    mode: card.mode,
    prompt,
    config: requestConfig,
    referenceImages: reference ? [reference] : [],
    signal: controller.signal,
    metadata,
    onTaskUpdate: (task) => setTaskId(task.id),
    // ← 无 projectId
});
```

⇒ **路径 B 的前端改动量 = 传一个参数**，不需要新建任务 API，也不需要后端改动。

---

## §2 控制线问的时序问题：`/create` 能否安全建容器

### 2.1 结论：**可以**，但需处理「hydrate 未完成」的窗口

**关键事实链**：

| # | 事实 | 证据 |
|---|---|---|
| 1 | `/create/index.tsx:12` **静态导入** `creation-canvas-conversation.ts` | `import { continueCreationConversationOnCanvas } from "@/services/creation-canvas-conversation"` |
| 2 | 该模块导入 `useCanvasStore` | `creation-canvas-conversation.ts:6-8` |
| 3 | store 用 `persist` + **异步 localforage**，hydrate 完成才置 `hydrated: true` | `use-canvas-store.ts:565` `onRehydrateStorage: () => () => { useCanvasStore.setState({ hydrated: true }) }` |
| 4 | `continueCreationConversationOnCanvas` 有 `hydrated` 守卫 | `creation-canvas-conversation.ts:26` `if (!useCanvasStore.getState().hydrated) throw new Error("画布资料正在加载，请稍后继续。")` |

⇒ **store 在 `/create` 冷启动时就开始 hydrate**（因静态导入），但**完成时机不确定**（localforage 异步）。
⇒ 若用户在 hydrate 完成前点「在画布中打开」→ 抛错「画布资料正在加载」。

### 2.2 但**现状已如此**，且不是路径 B 引入的新问题

**现状**：`:862`（既有创作交接）与 `:1152/:1176`（卡流程）**都调用同一个函数**，**都受同一个守卫约束**。
⇒ 路径 B 若在 `submit()` 里建容器，**守卫语义不变**（同样要等 hydrate）。

**风险等级**：**低**。理由：
- hydrate 是**本地 IndexedDB 读取**（毫秒级），用户「上传→回答≤3问→点按钮」的耗时远超它
- 且**当前 `:1152` 路径已经这样**（用户点「在画布中打开」时才建容器）——路径 B 只是**把时点从「点击时」提前到「submit 时」**，两者都在 hydrate 之后

### 2.3 若担心窗口，有**现成的兜底模式**

`continueCreationConversationOnCanvas` 的守卫**抛错**，调用方可**重试**。已有先例：

```ts
// :862 路径的调用方写法（index.tsx:862-866）
const result = await continueCreationConversationOnCanvas(source);
if (scope !== getActiveUserScope()) return;
```

⇒ 路径 B 可写成「先尝试建容器，失败则**降级为不传 projectId**」（任务照常创建，只是容器内面板暂空），
**不阻塞主流程**。这是**最小风险的实现形态**。

---

## §3 路径 B 的完整改动面（评估）

| # | 改动 | 位置 | 量级 |
|---|---|---|---|
| 1 | `submit()` 里先建容器，拿 `created.id` | `linear-flow-runner.tsx`（新增） | ~10 行 |
| 2 | 把容器 id 传给 `runBackendGenerationTask` | `:183-192` 加 `projectId: created.id` | 1 行 |
| 3 | 容器创建的 **sessionKey 一致性**：需与 `:1152/:1176` 共用同一 `linear-flow-${taskId}` | 时序冲突：**建容器时还没有 taskId** | ⚠️ **需解决** |

**后端存储面已就绪**（本轮核查）：`model.Task.ProjectID` 是**既有字段且已建索引**
（`models_task.go:16`，`idx_tasks_user_project_created`）⇒ 路径 B **零后端改动**。

### ★ §3.3 是路径 B 的**真实难点**（比 hydrate 更重要）
现状设计（`index.tsx:1131`）：

```ts
const sessionKey = handoff.taskId ? `linear-flow-${handoff.taskId}` : `linear-flow-${Date.now()}`;
// 两分支共用**同一会话 id**（锚定 taskId）⇒ 生成中先开画布、完成后再交接，
// 合并进同一个画布，不因两次点击产生两个容器。
```

**这个「同 sessionKey 合并」的保证依赖 `taskId`**。若路径 B 在 `submit()` 里建容器：
- **建容器时任务还没创建**（`runBackendGenerationTask` 尚未返回）⇒ **拿不到 taskId**
- ⇒ 只能用 `linear-flow-${Date.now()}` 或**预生成 id**
- ⇒ **结果阶段再点「在画布中打开」时**，`handoff.taskId` 已有值 ⇒ sessionKey = `linear-flow-${taskId}` ⇒ **与 carrier 阶段的容器不是同一个** ⇒ **产生两个容器**

**这正是现状设计刻意避免的**（注释明写「不因两次点击产生两个容器」）。

**解决方案**（三选一）：

| 方案 | 做法 | 代价 |
|---|---|---|
| **B-1** | **预生成 sessionKey**：`submit()` 时生成 `linear-flow-${uuid}` 并**存进任务 metadata**，carrier/result 两分支都从任务读回 | 需核 metadata 往返（见下） |
| **B-2** | **runner 记住容器 id + sessionId**：建容器后存进 runner state，carrier/result 两分支改用「导航到已有容器」而非新建 | 改动中等，语义干净 |
| **B-3** | **放弃 carrier 阶段建容器**，只在 `submit()` 建一次，carrier 点击时**直接导航** | 改动最小，最贴合路径 B 原意 |

**★ B-1 的存储面核查**（本轮）：
- `model.Task` **无独立 metadata 字段**；前端 metadata 走 `InputJSON`（`models_task.go:47`，`json:"inputJson"` 对外暴露）
- 前端 `GenerationTask` 有 `inputJson?: string`（`task-center.ts:48`）⇒ **可读回**
- **但** `inputJson` 是**执行输入**，用它存 UI 态（sessionKey）语义错位，且需 `JSON.parse` 且后端可能**按配额压缩**（`cloud_agent.go:267` 注释提及）

⇒ **B-1 不推荐**（语义错位 + 压缩风险）；**推荐 B-3**（最简单且无新存储需求）。

---

## §4 回答控制线的三个子问题
**Q1：路径 B 在 `/create` 页面上下文（非画布页）能否安全建容器？**

**能**。理由：
- `creation-canvas-conversation.ts` 已在 `/create` 静态导入，store 随页面加载开始 hydrate
- 建容器**不要求用户在画布页**（函数内部只依赖 store 与 localforage，无路由耦合）
- **唯一约束**是 hydrate 完成（`:26` 守卫），现状 `:862/:1152/:1176` 同样受此约束

**Q2：若不能，是否有替代（任务创建时带前端生成的 sessionKey 而非 canvasId）？**

**不需要替代**，但 **§3.3 的 sessionKey 一致性问题是真实的**——它不是「能不能建容器」的问题，
而是「**建两次会不会变成两个容器**」的问题。修法见 §3 的 B-1/B-2/B-3。

**Q3（我补充）：路径 B 是否真的「双向修复」？**

**是**，且证据充分：
- **容器内任务面板**：任务带 `projectId` ⇒ `useCanvasActiveTasks({projectId, activeOnly})` 能命中 ⇒ **面板有内容** ⇒ 「在画布中打开」入口出现
- **`/tasks` 跳转**：任务带 projectId ⇒ 任务详情能定位到画布
- **符合设计卡 §4.2「隐式创建」**：容器在提交时隐式创建，用户无感

⇒ **控制线倾向路径 B 的判断成立**。

---

## §5 与 P1-1 修法矩阵的关系（更新）

| 方案 | 修 P1-1（离开后可达）？ | 修容器内面板空？ | 改动面 |
|---|---|---|---|
| (a) 列表折叠分组 | ✅ | ❌ | 小 |
| (c) 任务面按 taskIds 过滤 | ✅ | ✅ | 中（需评估 `useCanvasActiveTasks` 改造） |
| **(B-3) submit 建容器 + projectId 传递** | ⚠️ **部分**（容器内面板有内容，但列表仍过滤 ⇒ 离开后仍需 (a) 或 (c) 才能回列表） | ✅ | 小（1 参数 + 建容器） |
| **(B-3) + (a)** | ✅✅ | ✅ | 小 |

**关键澄清**：**路径 B 不单独解决 P1-1**。它解决的是**容器内面板空**（即「在画布中打开」入口在容器内不可用），
但**「用户离开容器后如何回到它」**仍需 (a) 或 (c)。

⇒ **建议组合：B-3 + (a)**（B-3 让容器内面板有内容，a 让用户离开后能从列表找到）。

---

**评审线（第四线）· R4 第一段追加 · 2026-10-05**
