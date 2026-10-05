# R4 追加 · 选项 A 核验：任务创建后能否补写 projectId

**问题**（控制线 §③ 未决前提）：「后端是否支持在任务创建后补写 projectId（PATCH /api/tasks/:id）」
**结论**：**不支持**，但**存在更优解**（不需要补写）

---

## §1 直接答案：**无 PATCH/PUT 任务路由**

`backend/internal/handler/routes.go` 中全部 `/tasks` 路由（逐条枚举）：

```
POST   /tasks                         :30   ← 创建
GET    /tasks                         :101  ← 列表
GET    /tasks/:id                     :123  ← 详情
POST   /tasks/:id/text-deltas         :136
GET    /tasks/:id/text-deltas         :156
GET    /tasks/:id/text-events         :174  ← SSE
POST   /tasks/:id/retry               :192
POST   /tasks/:id/recover-media       :205
POST   /tasks/:id/query-provider      :222
POST   /tasks/:id/cancel              :235
POST   /tasks/:id/text-replay-complete:248
GET    /tasks/:id/logs                :268
```

**grep `PATCH|PUT|UpdateTask|PatchTask` → 零命中**。

service 层任务更新函数**全部是状态机内部字段**，无 ProjectID：
```
UpdateTaskProviderState / UpdateTaskProgress / UpdateTaskProgressForLease
UpdateTaskProviderProgress / UpdateTaskTerminalState / UpdateTaskTerminalDiagnostic
UpdateTaskExecutionDiagnostic
```
⇒ **ProjectID 只在创建时写入**（`task_creation.go:132` `ProjectID: req.ProjectID`），**之后不可改**。

---

## §2 但**不需要补写** —— 我找到更优解：**预生成 canvas id**

### 2.1 关键事实：canvas id 由**前端 nanoid() 生成**

```ts
// web/src/stores/canvas/use-canvas-store.ts:480-482
createProject: (title = "未命名画布", projectId) => {
    const now = new Date().toISOString();
    const id = nanoid();              // ← 前端生成，同步返回
    ...
    set((state) => ({ projects: [project, ...state.projects] }));
    return id;                        // ← 同步返回 id
},
```

⇒ **id 不依赖服务端**，前端可**在提交任务前**就得到 canvas id。

### 2.2 任务创建对不存在的 projectId **宽容**

```go
// backend/internal/app/project.go:640-670
func (s *Service) ensureTaskProjectActive(userID string, canvasOrProjectID string) error {
    id := strings.TrimSpace(canvasOrProjectID)
    if id == "" { return nil }
    if canvas, err := s.repo.CanvasProjectForUser(userID, id); err == nil {
        ... // 存在则校验归档状态
    } else if !errors.Is(err, gorm.ErrRecordNotFound) {
        return err
    }
    project, err := s.repo.ProjectForUser(userID, id)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil          // ← ★ 不存在也放行（宽容）
        }
        return err
    }
```

⇒ **任务可以先于容器创建**（带一个尚未落库的 canvas id 也能通过校验）。

### 2.3 ⇒ **正确时序（无鸡生蛋）**

```
① 前端预生成 canvasId（nanoid 或先调 createProject 拿 id）
② 建任务，带 projectId: canvasId      ← ensureTaskProjectActive 宽容放行
③ 建容器，用同一 canvasId 落库        ← 此时任务已带 projectId
④ carrier/result 两分支：sessionKey = linear-flow-${taskId}（天然一致）
```

**或更简单**（推荐）：
```
① submit() 时先调 createCanvasProjectWithRemoteSync(...) 拿 id（同步返回，见下）
② 建任务带 projectId: id
③ onOpenInCanvas 的 carrier/result 分支改为「导航到已有容器」
```

### 2.4 `createCanvasProjectWithRemoteSync` 的时序细节（核实）

```ts
// web/src/services/user-data-sync.ts:710-712
export async function createCanvasProjectWithRemoteSync(title, projectId?, initialContent?) {
    const id = useCanvasStore.getState().createProject(title, projectId);   // ← 同步拿到 id
    if (initialContent) useCanvasStore.getState().updateProject(id, initialContent);
    if (!activeRemoteUserId) return { id, syncError: ... };
    try { await saveRemoteUserDataNow(id); return { id }; }                  // ← 云端同步在此
    catch (syncError) { scheduleRemoteUserDataSync(); return { id, syncError }; }
}
```

⇒ **`id` 在函数第一行就同步得到**，云端同步是后续异步步骤且**失败也返回 id**。
⇒ 若只需要 id，甚至不必等 `createCanvasProjectWithRemoteSync` 完成——
**直接 `useCanvasStore.getState().createProject()` 拿 id 即可**（但这样会绕过 hydrated 守卫，见 §3）。

---

## §3 前提核实：`hydrated` 守卫的真实影响

**控制线 §③ 提到**：`continueCreationConversationOnCanvas` 要求 `hydrated`（`:26`）。

**我的核实**：
- `createProject`（store action）**无 hydrated 守卫** —— 它只 `set(state => ...)`
- `continueCreationConversationOnCanvas` **有** hydrated 守卫（`:26`）
- **但**：`createCanvasProjectWithRemoteSync` **也没有** hydrated 守卫

⇒ **两条路径的约束不同**：

| 路径 | hydrated 守卫 | 说明 |
|---|---|---|
| `useCanvasStore.createProject()` | ❌ 无 | 任何时候可调，但需看后续 hydrate 行为（见下） |
| `createCanvasProjectWithRemoteSync()` | ❌ 无 | 同上，且会尝试云端同步 |
| `continueCreationConversationOnCanvas()` | ✅ 有（`:26`） | 抛「画布资料正在加载」 |

### ★ 本轮动态验证：hydrate 前写入的真实后果

**探针实验**（临时测试文件，用完即删）：
```ts
const id = useCanvasStore.getState().createProject("探针画布");
// → createProject 后: true, 总数: 1
useCanvasStore.getState().replaceProjects([]);   // 模拟 hydrate 完成
// → replaceProjects([]) 后: false, 总数: 0     ← 写入被覆盖
```

**但真实 hydrate 路径有并发保护**（不是静默覆盖）：
```ts
// web/src/services/user-data-sync.ts:533-534
if (useCanvasStore.getState().projects !== localProjects) {
    throw new Error("本地画布仍在更新，已保留本地内容，请重新同步");
}
useCanvasStore.getState().replaceProjects(projects);
```

⇒ **真实后果是「同步失败并报错」**（用户可见），**不是数据静默丢失**。
⇒ **修正我原先的担忧**：hydrate 覆盖不是静默的，而是**fail-fast 报错**。

**结论**：在 submit() 里调 `createCanvasProjectWithRemoteSync` **不会静默丢数据**；
若发生 hydrate 竞争，用户会看到「本地画布仍在更新，已保留本地内容，请重新同步」。
**安全做法**（仍建议）：submit() 前确保 `remoteUserDataPhase === "ready"`（`:591` 的 `hasRemoteUserDataSyncSession()` 可查）。

---

## §4 回答控制线的三个子问题

**Q1：后端是否支持任务创建后补写 projectId？**

**不支持**。无 PATCH/PUT 路由；service 层任务更新函数均不含 ProjectID。
`ProjectID` 只在 `task_creation.go:132` 创建时写入。

**Q2：若不支持，新时序方案能否让容器内面板立即看到任务？**

**能**，且**不需要补写** —— 改用**预生成 id** 的时序（§2.3）：
任务创建时就带上 canvas id ⇒ `task.projectId` 从一开始就正确 ⇒ 容器内面板**立即可见**。

**Q3：容器内面板的可见性依赖什么？**

`useCanvasActiveTasks(projectId, enabled)` 的 query：
```ts
queryFn: ({ signal }) => listGenerationTasks(30, { projectId, activeOnly: true }, undefined, signal)
    .then((tasks) => tasks.filter((task) => !isInternalAgentTask(task)).slice(0, 5)),
enabled: enabled && Boolean(projectId),
```
- **列表按 `projectId` 过滤**（服务端）⇒ task.projectId 正确即可见
- **`activeOnly: true`** ⇒ **只显示 queued/running**（订阅回调里 `task.status !== "queued" && task.status !== "running"` 时移除）
- ⇒ **任务成功后，面板会移除它**（这是 `activeOnly` 的语义）

**★ 一个重要推论**：即使 projectId 正确，**任务完成后容器内面板也会变空**。
所以「容器内面板可见」只解决**生成中**的可见性；**生成完成后**用户仍需 (a) 折叠分组或 (c) 才能回到容器。
⇒ **与我在路径 B 评估 §5 的结论一致**：路径 B 不单独解决 P1-1。

---

## §5 我的最终建议（修正控制线 §③ 的方案）

控制线方案（onTaskUpdate 建容器 + 补写 projectId）**因 Q1 不成立而需调整**。建议：

| 步骤 | 做法 |
|---|---|
| 1 | **submit() 前预生成 canvasId**（调 `useCanvasStore.createProject()` 或 `createCanvasProjectWithRemoteSync`） |
| 2 | **建任务带 `projectId: canvasId`**（`generation-task.ts:33` 参数已存在） |
| 3 | **容器在预生成时就已存在**（本地）⇒ carrier/result 两分支都只**导航**（不再建） |
| 4 | sessionKey 用 `linear-flow-${taskId}`（**taskId 在 onTaskUpdate 后可得**，但此时容器已存在 ⇒ 只需把会话写进该容器） |

**★ 与 B-3 的差异**：B-3 是「submit 建容器」，本方案是「**submit 前预生成 id**」——
两者都解决双容器问题，但本方案**额外解决 projectId**（因 id 在任务创建前已知）。

**唯一残留风险**：hydrate 覆盖（§3）——建议实现时**显式 await hydrated**或使用带守卫的路径。

---

**评审线（第四线）· R4 选项 A 核验 · 2026-10-05**
