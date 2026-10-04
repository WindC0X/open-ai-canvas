# W5 毕业机制批 —— 任务书

> **依据**：`docs/artifacts/w5-linear-entry-card.md` §3.4（毕业机制）+ §6.2 验收 9
> **上游**：`/mnt/f/CODE/Project/canvas/能力组织层方案-2026-10-03.md` §5（毕业机制 + 门控方向）
> **控制线裁定**：2026-10-04 四项（解锁面/形态/6动作授权/依赖）+ 载体与清单二次裁定
> **分支**：`feat/w5-graduation`（从 main `5c6be4fc` 起枝）
> **执行**：B 线
> **状态**：任务书（待控制线封版确认）

---

## 一、问题定义

### 1.1 设计卡缺口 D5

> **无毕业机制** —— 引导态 6 动作 / 完整画布解锁未实现（方案 §5）

### 1.2 方向性纪律（PRODUCT.md 反参照 + 硬验收②，控制线钉死）

| 模式 | 谁 | 看到什么 |
|---|---|---|
| TapNow | 默认引导态 | 小白看不到全部 → 毕业才给画布 |
| **影策（本批）** | **画布全量在场** | 用户**主动**进入引导态（从卡流程）→ **门控只锁引导态内** |

**两条硬依据**：
1. PRODUCT.md 反参照：「不把画布藏起来」
2. 硬验收②：「画布在任一步可达」双条件

⇒ **直接打开画布的用户永远摸不到门控**（默认完整）。

---

## 二、★ 两个门控、两个作用域（控制线裁定②，防方向性歧义）

| 门控 | 模块 | 作用域 | 本批 |
|---|---|---|---|
| `LinearFlowGate` | `web/src/lib/canvas/linear-flow-gate.ts` | **直线流程内部步骤**（allowed/locked/hidden） | 已交付（linear-entry 批），**本批不动** |
| `GuideState` | `web/src/lib/canvas/graduation-state.ts` | **画布节点工具栏可见性** | ★ 本批主体 |

**两者正交、互不 import**（测试断言代码区零引用）。

---

## 三、★ 载体裁定：方案 A（扩展 `CanvasWorkspaceMode`）

### 3.1 既有基础设施（实码核实，非推断）

| 事实 | 位置 | 状态 |
|---|---|---|
| `CanvasWorkspaceMode = "simple" \| "professional"` | `types/canvas.ts:54` | 类型已存在 |
| `ToolContext.workspaceMode` 已消费 | `tool-definition.ts:114/138` | 判据已接线 |
| `simpleMode(ctx)` 判据在用 | `node-hover-tools.tsx:23` | simple 态排除 6 项（L87/101/115/194/207/220） |
| `project.tsx:266` 硬编码 `"professional"` | `project.tsx:266` | **未通电轨道**（simple 从未激活） |

⇒ 这是「已铺好但未通电」的现成载体，**不另造 GuideState 平行体系**（两套可见性判据 = 并行真值）。

### 3.2 三态落地

| GuideState | workspaceMode | 毕业标记 | 可见性 |
|---|---|---|---|
| `novice` | `professional` | `graduated: false` | 完整（零门控） |
| `guide` | `guide`（新增值） | `graduated: false` | 白名单 6 动作 |
| `graduate` | `professional` | `graduated: true`（**sticky**） | 完整（零门控） |

### 3.3 与 `starterMode` 的关系（控制线裁定：并列不复用）

- `starterMode`（`"guided" \| "freeform"`）= **空态呈现**（用户第一眼看到什么）
- `workspaceMode` = **能力可见性**（用户能做什么）
- 两个正交维度**硬挤一个字段**会造成「空态=guided 但能力=full」这类无法表达的组合
- ⇒ 新增 `graduated?: boolean`（sticky 持久化）到与 `starterMode` 同层级

### 3.4 ★ 默认分支纪律（控制线重点提醒）

`project.tsx:266` 改造时，**默认分支必须保持 `professional`** —— 直接进画布的用户行为零变化。
此前「门控方向」裁定的落实面就在这一行。

### 3.5 判据扩展（控制线纪律：两种判据不混写）

```
guide 态     = 白名单（只露 6 动作）
professional = 黑名单式排除（simpleMode 的既有排除逻辑）
```

⇒ `node-hover-tools` 的判据扩展为 `!isFullMode(ctx)`，但**白名单与黑名单两套语义分开写**，
不得合并成一个「排除列表」—— 否则 guide 新增动作时会与 simple 的排除项混淆。

---

## 四、★ 6 动作清单（控制线裁定③授权按四判据选取）

### 4.1 四判据（控制线原文）

1. **新手任务对齐** —— 卡流程教过的动作优先
2. **排除系统动作** —— delete/retry/info 等「管理」不进
3. **覆盖「结果永远可编辑」核心语义** —— 编辑类优先
4. **registry 条目对齐** —— 映射注册表 tool id，保持注册表原生纪律

### 4.2 清单（6 项，逐项判据命中）

| # | tool id | displayLabel | 判据命中 |
|---|---|---|---|
| 1 | `edit` | 生成设置 / 文本生成 | ③ 核心编辑语义；① 卡流程「确认」步的延续；**适用面：文本+图片+视频**（`canOpenDialog`） |
| 2 | `generateImage` | 生图 | ③ 结果可再生成；① 卡流程「出图」步的画布侧对应 |
| 3 | `uploadImage` | 上传图片 | ① 卡流程「传图」步逐字对应 |
| 4 | `download` | 下载 | ③ 硬验收③「交付步」在画布侧的对应 |
| 5 | `editText` | 放大编辑 | ③ 内容编辑（`onNodeEditText`）；**适用面：仅文本节点**（`isEditableText`） |
| 6 | `saveAsset` | 保存到素材库 | ③ 成果沉淀（结果可保存复用） |

### 4.3 ★ `edit` vs `editText` 重叠核实（控制线要求实码核实后定）

**实码核实结论：语义不重叠，两者均保留。**

| 项 | handler | 图标 | applicable | 语义 |
|---|---|---|---|---|
| `edit` | `onNodeToggleDialog` | `MessageSquare` | `canOpenDialog`（文本/图片/视频） | 打开**生成设置/文本生成弹窗** |
| `editText` | `onNodeEditText` | `Maximize2` | `isEditableText`（仅文本） | **放大编辑**（全屏编辑文本内容） |

⇒ 前者是「配置生成参数」，后者是「编辑已产出的文本内容」，功能不同、适用面不同（图片/视频节点没有 `editText`）。**两者均保留**，任务书注明区别（本节）。

### 4.4 排除项（判据②）

| 排除 | 理由 |
|---|---|
| `info` | 只读信息，非创作 |
| `delete` | 危险操作（`section: "危险操作"`） |
| `retry` | 异常恢复，非创作 |
| `node-lock` | 状态管理（锁定/解锁） |

### 4.5 ★ 视频动作纪律（控制线裁定）

`extractFrames` / `extractAudio` / `trimRegenerate` **不进首批**：

- 它们在 node-hover 里已被 `simpleMode` 排除（`node-hover-tools.tsx` L87/101/115）
- guide 态复用该排除逻辑**天然不含视频** —— 这是现成的一致性，不为覆盖面破坏它
- 视频动作可见性随**视频线启动批**统一处理（与 R25m motion 33 项同一窗口纪律）

---

## 五、毕业机制（单向粘性）

### 5.1 触发条件（设计卡 §3.4）

① 完成首单（首个任务 `succeeded`）或 ② 用户点「完整画布」

### 5.2 状态机（已实现，纯函数层）

```ts
resolveGuideState({ current?, entry, firstOrderCompleted?, fullCanvasRequested? }): GuideState
```

优先级（高 → 低）：
1. 已是 `graduate` → `graduate`（**终态，任何输入不回退**）
2. 完成首单 或 点「完整画布」→ `graduate`
3. 从卡流程进入 → `guide`
4. 直接进入 → `novice`（保持当前；默认完整画布）

### 5.3 毕业后的呈现（设计卡 §3.4）

node-hover **20 项按 B1 分组**全量呈现。分组来源 = 注册表 `nodeToolbar.section`
（`tool-definition.ts:190` 字段已有），**不是硬编码清单** —— 随注册表演进自动跟随。

---

## 六、文件清单

| 文件 | 动作 | 说明 | 状态 |
|---|---|---|---|
| `web/src/lib/canvas/graduation-state.ts` | **新增** | 状态机 + 6 动作白名单 + B1 分组（纯函数） | ✅ 已写 |
| `web/test/graduation-state.test.ts` | **新增** | 状态机/粘性/白名单/分组测试 | ✅ 已写（25 test） |
| `web/src/types/canvas.ts` | 改 | `CanvasWorkspaceMode` 加 `"guide"`；`graduated?: boolean` | ⏸ 待载体接线 |
| `web/src/pages/canvas/project.tsx` | 改 | `workspaceMode` 从入口推导（默认 professional） | ⏸ 待接线 |
| `web/src/lib/canvas/tool-registry/definitions/node-hover-tools.tsx` | 改 | 判据扩展（白名单/黑名单分开写） | ⏸ 待接线 |
| `web/src/components/canvas/linear-flow-*` | 改 | 入口钩子：卡流程写入引导态元数据 | ⏸ **等 linear-entry 合入** |
| `web/src/pages/canvas/project.tsx` | 改 | 「完整画布」出口（顶部常驻） | ⏸ 待接线 |
| `docs/content/docs/getting-started/features.mdx` | 改 | 文档同步 | ⏸ |

---

## 七、验收

| # | 验收 | 验证方式 | 状态 |
|---|---|---|---|
| 9a | 三态迁移正确 | 状态机单测（含单向粘性） | ✅ 25 test |
| 9b | 6 动作白名单 | 断言恰好 6 项 + 全部映射注册表 id | ✅ |
| 9c | 排除系统动作 | 断言 delete/retry/info/node-lock 不在白名单 | ✅ |
| 9d | 毕业后 B1 分组全量 | 断言 20 项分组覆盖 + 零丢失 | ✅ |
| 9e | ★ 默认完整画布（验收 10 联动） | 断言 novice/graduate 返回 null（零门控） | ✅ |
| 9f | 直接进画布用户零变化 | 回归测试 + 真机验证 | ⏸ 待接线 |
| 9g | 两个门控正交 | 断言 graduation-state 不 import linear-flow-gate | ✅ |
| 9h | 「完整画布」出口可用 | 真机验证（点出口 → 毕业 → 不回退） | ⏸ 待接线 |

---

## 八、不做

- ❌ 不做独立引导浮层（控制线裁定② B 变体驳回：新 UI + 违反「不做一站式向导」）
- ❌ 不把引导态塞进卡流程（控制线裁定② C 变体驳回：毕业是画布侧状态，与卡流程正交）
- ❌ 不动组件侧 30 项工具条（控制线裁定①：那是图片专用操作面，语义不同）
- ❌ 视频动作不进首批（控制线 4.5 纪律）
- ❌ 不做独立小白版产品（PRODUCT.md 反参照）

---

## 九、依赖与排序（控制线裁定④）

| 依赖 | 状态 |
|---|---|
| 与统一任务面守卫测试 | **无技术依赖**（零文件交集），可并行 |
| 与 `linear-entry` 批 | **真依赖**：入口钩子长在 `linear-flow-runner/index`，需等其合入后在新 main 起枝续做 |

**开工姿势**：纯函数层先行（零咽喉可动）→ 载体接线与入口钩子等 linear-entry 合入后补。
