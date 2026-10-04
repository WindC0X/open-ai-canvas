# verify-T1 — 对抗核验（主面① @ 7db3fa10，只读）

核验树：`/home/windc0x/oac-ext4/oac-wt-baseline` HEAD=`7db3fa10839e2cc2dfdfd7c462f2a44296aa41ff`（与锚点一致，已确认）。
未触碰 `oac-wt-test`，未在 `/mnt/f` 下跑测试。静态面用 `git show 7db3fa10:<path>`。

---

### [confirmed（降级 P2）] `workspaceType` 全仓无生产写入点
- 核验方法：`git grep -n "workspaceType" 7db3fa10 -- web/src backend` + `git grep -n "workspace_type"` + 读 `use-canvas-store.ts` / `user-data-sync.ts:710` / `index.tsx:100` / `creation-agent-entry.tsx:30` / `projects/detail.tsx:92`；再对已合入 main 的 `65c51953` 做同查询排除 branch-only 误判。
- 证据：
  - 生产侧命中仅 3 处形态：字段声明（`stores/canvas/use-canvas-store.ts:50`、`services/api/user-data.ts:44`）、谓词/过滤（`lib/canvas/workspace-type.ts:13,18`）、消费（`pages/canvas/index.tsx:107`、`use-canvas-project-lifecycle.ts:167`）。写入面只有 `use-canvas-store.ts:68` 的 `updateProject` 白名单透传（被动）。
  - `snake_case` 的 `workspace_type` 在 `web/src`+`backend` 生产代码里 **0 命中**（仅测试注释、journal、docs）→ 不存在「写 A 读 B」的拼写错位。
  - 创建入口全部无该参数：`user-data-sync.ts:710` 签名 `(title, projectId?, initialContent?)`，`initialContent` 只收 `nodes|connections|chatSessions|activeChatId`；store `createProject: (title?, projectId?)`（`:480`）。
  - **跨枝对照**：已合入 main 的 `65c51953` 上 `headless_task` 与 `workspaceType` 生产写入同样为 0 → 这是跨卡范围缺口，**不是 branch-only 差异**。
- 影响：机制成立 —— 过滤恒空转、整理恒不触发。
- 备注：**T1 的严重度与前提部分被证伪**，故降级 P2：① 设计卡 `w5-unified-task-face-card.md` §八明确「❌ 不做 headless 画布的创建流程（那是直线入口卡的事，本卡只定义字段与行为）」→ 缺写入者是**已文档化的卡边界**，不是隐性缺口；② T1 断言「本批的测试与文档会显示这两条已『接线完成』」——**证伪**：`git grep -n "验收 7\|验收 8" 7db3fa10 -- docs/` 在分支文档中 **0 命中**，`pending-test.mdx` 亦无 headless/workspaceType 登记，本批未做兑现声明；③ 结论句「headless 容器会照旧出现在主列表顶层」当前不可观测（无写入者 ⇒ 无此类容器），属**前向风险**而非本批缺陷。建议仍成立（在卡内标注 7/8 为消费侧完成 + 记 pending-test），但不应按 P1 记。

### [uncertain] 首入标记早写于整理完成 ⇒ 中断后永久跳过整理
- 核验方法：读 `use-canvas-project-lifecycle.ts:165-179` 逐行时序。
- 证据：`169 markHeadlessCanvasTidied(projectId);` 确实位于 `170 if (!batches.length) return;` 与 `174 if (isStale()) return;` **之前**；`markHeadlessCanvasTidied` 在 7db3fa10 全树唯一调用点即 `:169`（`git grep` 仅 4 命中：定义/import/此处/测试）。
- 备注：**机制真实，但「缺陷」定性不成立**。`headless-tidy.ts:24` 的注释语义是「用户之后的手工排布不被覆盖」——先落标记恰好保护该不变式（若用户已开始手工拖动，重试反而会覆盖用户排布）。只有「第一批都未提交即 stale」这一子场景才是真边界（概率低、后果仅视觉），T1 的「无法自愈」描述对用户已介入的情形是反的。降级 P3 更合适。

### [confirmed] 整理用「标记前的快照坐标」覆盖实时 store
- 核验方法：读 `:168`（快照 `current.nodes`）、`:172`（快照重算 positions）、`:174`（函数式 setNodes 读实时 nodes）与 `applyHeadlessTidyPositions` 实现。
- 证据：`applyHeadlessTidyPositions` 仅做 `positions.has(node.id)` 判定，**无版本/移动校验**；locked 过滤发生在 `:168` 快照时点。窗口内被拖动的节点仍会命中 `positions.has` 而被回写旧坐标；窗口内新 lock 的节点同样不被排除。
- 备注：机制确认；T1 已自认当前因 P1 不可达，作为「F1 修复后立刻显形」的前向缺陷记 P2 合理。

### [refuted] 候选集筛选规则三处漂移（Frame 节点）
- 核验方法：读 `headless-tidy.ts:41-47` 全文 + `canvas-layout.ts:136-142` + `lifecycle:172`。
- 证据：`planHeadlessTidyBatches` 内**已有 Frame 兜底**：
  ```ts
  const candidates = nodes.filter((n) => !n.metadata?.locked && !n.parentId);
  const positions = layoutCanvasAuto(candidates, connections);   // 内部排除 Frame
  const ids = candidates.filter((node) => positions.has(node.id)).map((node) => node.id);
  ```
  Frame 不在 `layoutCanvasAuto` 返回 Map 中 ⇒ `positions.has` 为 false ⇒ **Frame 不可能进入 `ids`、也不可能进入 batch**。T1 的核心影响句「无 locked 的 Frame 节点会进入 candidates 并被分进批次…占掉 batchSize=6 的名额，流式批次数虚增」**证伪**。
- 备注：仅剩两个非缺陷残项：① 两处筛选谓词字面不一致（`planHeadlessTidyBatches` vs `layoutCanvasAuto`）属可维护性 P3；② `lifecycle:172` 重算 `positions` 确属冗余（批次 id 由 plan 内部同源 Map 生成，两次调用输入相同且函数确定，故调用方的 Map 是等价超集，无功能差异）。**假阳性**：T1 未读到 `ids` 这一行的兜底。

### [confirmed] 接线护栏是 `toContain` 源码扫描 ⇒ 对「注释掉调用」不具证伪性
- 核验方法：先跑真测试（`cd /home/windc0x/oac-ext4/oac-wt-baseline/web && bun test test/task-face-workspace-type.test.ts` → **11 pass / 0 fail**，57ms），再用 node 对**内存副本**做等价变异（未落盘、未改仓库）：把 `void tidyHeadlessCanvasIfNeeded();` 前加 `//`、把 runner 的 `<UnifiedTaskFace` 包进 `{/* … */}`，复算测试里的同一组断言。
- 证据：变异后断言全部仍为 true —
  `lifecycle assertions under commented-out call: [true,true,true,true]`（4 项含 `indexOf > indexOf("void load()")`）；
  `runner assertions under commented JSX: [true,true,true]`。
- 备注：确认。护栏只对**整行删除**有证伪力，对**注释掉**无。修复方向（复用同批 `task-face-independence.test.ts:29-34` 的 `stripComments()` 先剥注释）正确且成本极低。

### [confirmed] 后端不校验枚举值 + 前端 `as never` 强制转换
- 核验方法：读 `backend/internal/canvas/user_data_page.go:82`（`WorkspaceType string` 直接取自 `json.Unmarshal`）与 `web/src/lib/canvas/headless-tidy.ts:25-26`。
- 证据：`shouldTidyHeadlessCanvas(projectId, workspaceType?: string)` 内部 `isHeadlessTaskWorkspace(workspaceType as never)`；后端无白名单，原样透出（`:115`）。
- 备注：P3 属实，与 `workspace-type.ts:13` 的严格等值谓词叠加后表现为静默漏过滤。

### [uncertain] 下载文件名扩展名判定脆弱
- 核验方法：未核验（预算纪律）。
- 备注：`web/src/lib/task-face-download.ts:41-46,68-75` 未展开读；T1 自认属静态推演、未构造 audio 回退用例。留给 T2/后续批次或控制线决定是否补。

### 附加核验：重点①「只投影 position」
- [confirmed] `headless-tidy.ts:58-61` 唯一写入字段为 `position`，metadata 走 spread 同引用，非批次/非坐标表节点返回**同一引用**；测试 `task-face-workspace-type.test.ts:96-116` 断的是结构不变式（`next[0].metadata).toBe(nodes[0].metadata)`），非复述实现分支 ⇒ 该护栏非镜像实现。T1 的重点①结论成立。

---

## 统计（含 P2/P3 与重点①的附加核验）
- P0/P1 层面：**confirmed=1（P1 降级为 P2）｜refuted=0｜uncertain=0**
- 全量判定：confirmed=4（P1 降级 / 快照竞态 / toContain 护栏 / `as never`）｜refuted=1（Frame 筛选漂移，核心影响句被证伪）｜uncertain=2（首入标记时序定性 / 下载扩展名未核验）
- 未核验声明：未跑 build / 全量 test；未做浏览器真机；`task-face-download.ts` 未读。

VERIFY T1 confirmed=4 refuted=1 uncertain=2
