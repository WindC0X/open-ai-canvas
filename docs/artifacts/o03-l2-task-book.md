# O-03 层2 图片超分 最小闭环 — 任务书

> 控制线指令 2026-10-03：重叠纪律①生效后开枝。**W5 B 线槽位任务提前开 = 抢跑**，
> 交付后只交分支不合入，等 W5 B 线会话接管或控制线明示。
>
> 规格本体：`/mnt/f/CODE/Project/canvas/MASTER-PLAN.md` L399（O-03 三层方案）
> + L223（W5 层2 最小闭环原文）+ `能力组织层方案-2026-10-03.md` §2.1（注册表条目定义）。
> 调研终版：`analysis-2026-09-12/ecom-design/upscale/超分放大方案调研-终版-2026-09-12.md`

## 一、范围

### 1.1 做（控制线点名的三件）

| # | 项 | 原文依据 |
|---|---|---|
| ① | `superResolveImageNode` 照 `maskEditImageNode` 骨架加进 `use-canvas-media-tools.ts` | MASTER-PLAN L223 |
| ② | 占位对话框换真（`canvas-project-status-dialogs.tsx:76-78` 的「暂未实现」） | 同上 |
| ③ | `image_upscale` 计费映射（`task_creation.go` billingOrder 链） | 同上 |

### 1.2 不做（红线）

- ❌ **不重造对话框**（控制线明示）—— 超分对话框已接线（`onSuperResolve` → `setSuperResolveNodeId` → `CanvasProjectStatusDialogs`），只把内容换真
- ❌ 不做层1（直出引导，已交付）、层3（Conservative 精修/ComfyUI，W6+）
- ❌ 不做视频侧超分/插帧（R14，W6+ 候选）
- ❌ 不接真实渠道（本枝只做闭环骨架 + 计费映射；渠道由 W5 B 线或后续渠道枝接）
- ❌ 不碰 `use-canvas-media-tools.ts` 以外的咽喉文件（F-08 同槽连做，见 §六）

## 二、硬约束

1. **命名分流红线**（MASTER-PLAN L399）：`upscale`（插值，免费）与 `superResolve`（AI 超分）必须内分「保真放大」（默认）与「AI 增强」（勾选确认）；**禁用「高清化」模糊词**。
2. **样式红线**（沿用 F-02 口径）：样式只经 `flora-overrides.css` / `flora-tokens.css`，不直改 `globals.css`。
3. **统一任务面铁律**：执行位置只作元数据标签（「云端 · X 积分」），不新造超分专属任务 UI。
4. **许可红线**：商用人脸链默认 GFPGAN（Apache-2.0）；CodeFormer/SUPIR/InvSR/ResShift/4x-UltraSharp 禁商用。
5. **咽喉错峰**：`use-canvas-media-tools.ts` 与 F-08 圈选改图同槽；若 F-08 先入实现段，本枝让位（v1.8 §5.4）。
6. **环境**：渠道实验必须 `no_proxy` 追加目标域名（F-02 §10.2 教训，通用前置）。
7. **STOP 报告**：咽喉文件必须触碰 / 许可红线冲突 / 计费语义无法与既有链对齐 → 停下报告。

## 三、★ 侦察发现（开工前一手核实，2026-10-03）

### 3.1 ★★ 关键发现：占位对话框当前**不可达**（控制线情报需修正）

控制线说「超分对话框已接线」——**部分不成立**。一手核实：

| 环节 | 状态 |
|---|---|
| `project.tsx:3157` `onSuperResolve={(node) => setSuperResolveNodeId(node.id)}` | ✅ 存在 |
| `canvas-node-toolbar.tsx:254` 把 `onSuperResolve` 传进 `buildImageToolbarTools` | ✅ 存在 |
| `canvas-node-toolbar.tsx:261` `onNodeSuperResolve: onSuperResolve` 进 handlers | ✅ 存在 |
| **工具条目 `id: "superResolve"` 的定义** | ❌ **不存在** |
| `handlers.onSuperResolve` 的消费点 | ❌ **零**（全仓 grep 无命中）|

`canvas-image-toolbar-tools.tsx` 的 `ImageNodeActionToolId` 联合类型**含** `"superResolve"`（L7），
`ImageToolHandlers` **含** `onSuperResolve`（L27）——但 `imageToolDefinitions` 数组里**没有对应条目**，
所以 `handlers.onSuperResolve` 永不被调用，`setSuperResolveNodeId` 永不被触发，
`canvas-project-status-dialogs.tsx:76` 的「AI 超分」Modal 永不打开。

**⇒ 结论**：「占位对话框换真」的真实工作量包含**补上入口条目**（否则换真后仍不可达）。
入口形态二选一（见 §四 决策点 D1）。

### 3.2 既有的免费插值链（对照样本，不重造）

| 件 | 位置 | 说明 |
|---|---|---|
| 工具条目 | `canvas-image-toolbar-tools.tsx:228-236` | `id: "upscale"` label「调整尺寸」desc「插值放大像素尺寸，**不是 AI 超分**」 |
| 对话框 | `canvas-node-upscale-dialog.tsx`（113 行） | 算法三选（高质量插值/双线性/最近邻）+ 目标档 1K/2K/4K |
| 执行 | `use-canvas-media-tools.ts:1481` `upscaleImageNode` | **纯前端**（`upscaleDataUrl` canvas 重绘）→ uploadImage → 建子节点，**无任务行、无计费** |
| 算法 | `canvas-image-data.ts:171` `upscaleDataUrl` | `drawStepUpscale` / `drawResize` |

**⇒ 关键**：`superResolveImageNode` 必须走**云端任务链**（`runBackendCanvasGenerationTask` + 计费），
与免费插值形成「本地免费 vs 云端计费」的分流——这正是「执行位置作元数据标签」的第二个实例
（F-01 本地抠图是第一个）。

### 3.3 骨架：`maskEditImageNode`（L676-780，云端任务链样本）

流程：校验模型能力 → `buildGenerationConfig` → `isAiConfigReady` → 提示词 → `nodeReferenceImage`
→ `resolveImageEditStyle` → `buildImageGenerationMetadata("edit", ...)` → 建 root+children 节点
→ `startGenerationRequest` → `runBackendCanvasGenerationTask` → `bindGenerationTask` → `finishGenerationRequest`。

**超分与它的差异**：超分**不需要提示词**（不是生成式编辑，是像素级重建），
且输入只有 1 张源图、输出固定 1 张。⇒ 骨架复用其**节点创建 + 任务绑定 + 错误处理**部分，
提示词/风格执行部分**不需要**。

### 3.4 计费链现状（`image_upscale` 零命中）

| 环节 | 位置 | 现状 |
|---|---|---|
| 计费入口 | `finance.go:430` `taskBillingOrder` | `task.LogicalModelID != ""` 走 `newLogicalModelBillingOrder`；否则读 `input["config"]` 的 channelId/model |
| 定价档解析 | `finance.go:582` `newBillingOrderWithPriceTier` | 参数含 `capability` 与 `scene`（= `task.Operation` 或 `task.Type`） |
| capability 推导 | `analytics_build.go:397` `capabilityFromTaskType` | 从 task.Type 子串匹配 video/image/audio/text |
| operation 推导 | `model_router.go:304-309` | image 有输入图 → `image_to_image`，无 → `text_to_image` |

**⇒ 缺口**：`image_upscale` 既不是 task.Type 也不是现有 operation。需在
`ModelRequestIntentFromTaskInput` / operation 推导处增加 `image_upscale` 分支，
使渠道可按 operation 配置独立价格档（`channelModelPriceTierForBilling` 的 selector 机制）。

### 3.5 层1 埋的钩子（超分触发条件）

`image-size-presets.ts:152` `desiredResolution` 字段注释原文：
> 「名义目标档（控制线 2026-09-27 批）；与实得档的差异 = 层2 superResolve 触发条件（本枝只存字段，不接超分链）」

**⇒ 该字段当前零消费点**（`grep nominalTarget` 无命中，字段实名为 `desiredResolution`）。
层2 落地时应让它成为「实得档 < 名义档 → 提示超分」的判据。

### 3.6 ★★ 第二发现：ObjectHudPanel 的「超分」按钮是命名红线违规

`project.tsx:3054`：
```tsx
{ label: "超分", icon: <ZoomIn className="size-3.5" />, onClick: () => setUpscaleNodeId(toolbarNode.id) },
```
label 写「超分」，但 onClick 走 `setUpscaleNodeId` → `CanvasNodeUpscaleDialog`（**免费插值**，
其正文自述「通过插值放大像素尺寸……**这不是 AI 超分**」）。

**违反 MASTER-PLAN L399 命名分流红线**：
> `upscale`（插值，免费）与 `superResolve`（AI 超分）内分「保真放大」（默认）与「AI 增强」（勾选确认），**禁用「高清化」模糊词**

用户点「超分」得到的却是插值——正是红线要防的混淆。**应随本枝一并修正**（改 label 为「调整尺寸」
或「放大」，与工具栏 `upscale` 条目的 label 一致）。

## 四、注册表条目定义（★ 控制线 2026-10-03 修正版：全字段登记）

超分是**首批注册表原生条目**（F-01/F-02 均为手工接线）。按 `能力组织层方案 §2.1` 要求，
**全字段登记**（控制线裁定：「只给 id/档位/参数面三字段不收货」）。

### 4.1 条目记录（放独立 seed 文件 `capability-entries.ts`）

| 字段 | 值 | 依据 |
|---|---|---|
| **id** | `image.superResolve` | `能力域.动作` 形态；注册表条目层是新增的「能力」概念，与既有「按钮」层 id（`upscale`/`maskEdit` 驼峰）区分 |
| **名称** | `AI 超分` | 与既有对话框标题「AI 超分」一致 |
| **目标档位** | **1（画布内弹窗）** | `能力组织层方案 §4` 表明确列「超分W5」 |
| **资产形态** | `capability/tool` | 控制线指定 |
| **参数面引用** | `superResolve` 参数面：<br>· 目标档 2K / 4K（复用 `ImageResolutionTier`）<br>· 保真放大（默认）/ AI 增强（勾选确认）<br>· 输出落位（新节点，保留原图） | `能力组织层方案 §2.1`；命名分流红线（MASTER-PLAN L399） |
| **执行链引用** | 云端任务链（`superResolveImageNode` → `runBackendCanvasGenerationTask`）<br>实测主力渠道 = a6api · nano-banana-2（同源结论见 F-02 任务书 §10.3） | MASTER-PLAN L223 |
| **零参数预设引用** | **暂无**（显式登记，非缺字段）—— 超分不产预设值；`image-size-presets.ts:152` 的 `desiredResolution` 是**触发条件**不是预设 | 控制线裁定「不许缺字段」 |

### 4.2 ★ 登记位独立（控制线裁定）

- **独立 seed 文件**：`web/src/lib/canvas/capability-entries.ts`（位置选定）
- 一个能力一条记录
- **禁止**把元数据塞进按钮定义的字段或注释里 —— 升格枝要按记录消费

### 4.3 入口形态：C 方案（双轨）

| 轨 | 落点 | 作用 |
|---|---|---|
| 轨 1（入口） | `canvas-image-toolbar-tools.tsx` 加 `id: "superResolve"` 条目，与 `upscale` **同组同形态**（图片加工语义位） | 本枝闭环可用（补上 §3.1 发现的缺口） |
| 轨 2（元数据） | `capability-entries.ts` 登记 §4.1 全字段 | 不阻塞升格方向，升格枝按记录生成其余档位 |

**B 方案（node-hover）已否决**（控制线裁定）：语义错位——node-hover 现有 20 项全是通用节点操作。

### 4.4 生成规则落地边界

`能力组织层方案 §2.1` 原文：工具栏按钮、⌘K 条目、/create 预设卡、`/canvas/:id/:tool` 子路径、
工具页 routeSlug —— 全部从同一条目按档位过滤生成。
**本枝只落档 1**，其余档位的生成留待注册表升格枝（W5 R25m 前后）。

## 五、实现计划

| # | 步骤 | 文件 | 验证 |
|---|---|---|---|
| 1 | 任务书 | `docs/artifacts/o03-l2-task-book.md` | 本文 |
| 2 | 入口条目（按 D1 决策） | `canvas-image-toolbar-tools.tsx` | 工具渲染 + handler 触发 |
| 3 | 参数面类型 | `canvas-node-super-resolve-dialog.tsx`（新） | 参照 upscale 对话框形态 |
| 4 | `superResolveImageNode` | `use-canvas-media-tools.ts` | 照 maskEdit 骨架（去提示词） |
| 5 | 占位换真 | `canvas-project-status-dialogs.tsx:76-78` | Modal 内容替换 |
| 6 | `image_upscale` 计费映射 | `backend/internal/app/`（operation 推导 + intent） | 单测 |
| 7 | 层1 钩子接线 | `desiredResolution` → 超分提示 | 可选（视 §3.5 判据） |
| 8 | 单测 + 门禁 | `web/test/`、`backend/**/*_test.go` | 见 §七 |

## 六、咽喉与并发

- `use-canvas-media-tools.ts`（1785 行）是 F-01/F-02/F-08/O-03 共用咽喉。
- **本枝提前开 = 抢跑**（控制线明示）：交付后**只交分支不合入**，等 W5 B 线接管。
- F-08 若先入实现段，本枝让位（v1.8 §5.4 咽喉错峰）。

## 七、门禁

- 前端：`bunx tsc --noEmit` 0 / `./node_modules/.bin/eslint src test` 0 / `bun test`（在 `web/` 内跑）/ `bun run build`
- 后端：`go test ./...`（涉及计费时补 `finance`/`task_creation` 相关）
- 命名红线机器护栏：断言不出现「高清化」
- 单测：参数面默认值 / 保真档 vs 增强档分流 / 计费 operation 映射 / 入口可达性

## 八、纪律

- worktree：`/mnt/f/CODE/Project/oac-wt-o03`（待建），分支 `feat/o03-l2-superresolve`
- 单逻辑单 commit；STOP 报告；交付后**不合入**
- 估工：3–4 人日（MASTER-PLAN L223 口径）

## 九、渠道实测（★ 环境教训）

- `no_proxy` 必须含目标域名（F-02 §10.2：环境代理 `172.24.176.1:10808` 对 `api.a6api.com` 做 TLS 破环）
- 本枝**不接真实渠道**（见 §1.2），但若 W5 B 线接入，必须带此前提

## 十、控制线裁定（2026-10-03，三项已拍板）

| # | 事项 | 裁定 |
|---|---|---|
| 1 | D1 入口方案 | **C 双轨**：工具栏条目（`canvas-image-toolbar-tools.tsx`，与 upscale 同组同形态）+ 注册表元数据登记。**B 的 node-hover 安放否决**（语义错位，20 项全是通用节点操作） |
| 1a | 元数据字段 | **全字段登记**（§4.1 七字段），「只给 id/档位/参数面不收货」；零参数预设**显式写「暂无」**，不许缺字段 |
| 1b | 登记位 | **独立 seed 文件**（`capability-entries.ts`），一能力一条记录；**禁止**塞进按钮定义字段或注释 |
| 2 | 命名红线 | **随本枝修**：`project.tsx:3054` label「超分」→「调整尺寸」，不开新枝；**附加全仓扫**「超分」字样指向 `setUpscaleNodeId` 的其它位置（tooltip/菜单/帮助文案）一次清干净；「调整尺寸」用词与 O-03 层1 渠道规格组既有命名对齐 |
| 3 | 节奏 | **三线并行一次交付**：「等 D1」不成立 —— `image_upscale` 计费映射 + `superResolveImageNode` 骨架 + 入口（C）并行做。交付形态维持「只交分支不合入」 |

### 10.1 验收证据要求（控制线 · 反模式 #6 口径）

1. **「AI 超分」入口真机可达可演示的截图**
2. **HUD 假按钮改名 before / after 对照**

### 10.2 预告（本枝交付后，现在不动工）

《能力组织层架构方案》正式化（原定 F-02 实测等待期窗口已过未产出）；
规格 = `/mnt/f/CODE/Project/canvas/能力组织层方案-2026-10-03.md`；约 1 人日。

### 10.3 外部依赖

三模型交叉审查（glm-5.3-flash / deepseek-v4.1-flash / gemini-3.8-flash）后台审能力组织层方案
与吸收闭环；结论若涉及本枝会补发指令，**不影响当前开工**。
