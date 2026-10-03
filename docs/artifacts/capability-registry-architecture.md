# 能力组织层架构方案

> **规格本体**：`/mnt/f/CODE/Project/canvas/能力组织层方案-2026-10-03.md`（定稿，三模型交叉审查采纳）
> **本文定位**：把规格本体落成**可执行架构文档** —— 五件硬清单（§9 缺一不验收）+ 收编清单 + routeSlug 机制规格。
> **产出方式**：以实码为实证起点做「从实码到规范」的提炼，不从零设计。
> **实证样本**：① `image.superResolve`（O-03 层2，已合入 main `de63c0aa`）
> ② `image.annotateEdit`（F-08，B 线 W5 开线，已封版）
> **日期**：2026-10-03

---

## 0. 一句话总纲（承接规格本体）

**库存两层（能力登记处 + 预设配方库），橱窗四类（开三个半），动作入口四档（小白端到端不见画布）。**

本文只解决**第一层（能力登记处）**的可执行规格 + 第一/二层共用的收编清单，不重述产品判断。

---

## 1. 硬清单①：能力条目 schema 字段表

### 1.1 与 `tool-definition.ts` 的继承关系（关键：两层不是替代关系）

| 层 | 文件 | 注册单元 | 字段重心 | 现状 |
|---|---|---|---|---|
| **按钮层**（既有） | `web/src/lib/canvas/tool-registry/tool-definition.ts` | `ToolDefinition` | `icon` / `run` / `label` / `toolbar` / `defaultVisible` / `nodeToolbar` / `hover` | 4 个定义文件，注册 56 个按钮 |
| **能力层**（本文新增） | `web/src/lib/canvas/capability-entries.ts` | `CapabilityEntry` | `tier` / `contextRequirement` / `assetKind` / `parameterSurface` / `executionChain` | 1 条（O-03），F-08 将进第 2 条 |

**继承关系 = 生成关系，不是包含关系**：
- 按钮层**继续独立存在**（`ToolDefinition` 不改结构，56 个既有按钮零迁移）
- 能力层是**上层元数据**：一条能力条目**按 `tier` 过滤生成**多个按钮层入口（§2.1 原文「工具栏按钮、⌘K 条目、/create 预设卡、`/canvas/:id/:tool` 子路径、工具页 routeSlug——全部从同一条目按档位过滤生成」）
- 二者的**唯一契约**是 `executionChain.handler`（能力层）↔ `ToolbarHandlers.onXxx`（按钮层）
- **禁止**把能力层字段塞进 `ToolDefinition`（控制线 2026-10-03 裁定：登记位独立，升格枝要按记录消费）

### 1.2 字段表（逐字段：名 / 类型 / 必填 / 示例 / 来源）

以 `capability-entries.ts` 实码为准（O-03 范式），**标注**列说明该字段是「实码已有」还是「本文扩/增」。

| # | 字段 | 类型 | 必填 | 示例（来自实码） | 来源 |
|---|---|---|---|---|---|
| 1 | `id` | `string`（`能力域.动作` camelCase） | ✅ | `"image.superResolve"` | 实码已有 |
| 2 | `name` | `string`（用户可见中文名） | ✅ | `"AI 超分"` | 实码已有 |
| 3 | `tier` | `CapabilityEntryTier` = `0 \| 1 \| 2 \| 3` | ✅ | `1` | 实码已有 |
| 4 | `contextRequirement` | `CapabilityContextRequirement`（见 §1.3） | ✅ | `"single_image"` | 实码已有 |
| 5 | `assetKind` | `AssetKind`（见 §2，**实码枚举过窄需扩**） | ✅ | `"capability/tool"` | **本文扩** |
| 6 | `parameterSurface` | `Array<{ field; label; options; default? }>` | ✅ | `[{ field: "targetResolution", label: "目标档", options: ["2k","4k"], default: "2k" }]` | 实码已有 |
| 7 | `executionChain` | `{ handler; location; primaryChannel }` | ✅ | `{ handler: "superResolveImageNode", location: "cloud", primaryChannel: "a6api · nano-banana-2" }` | 实码已有 |
| 8 | `zeroParameterPreset` | `string`（无则显式写 `"暂无"`） | ✅ | `"暂无"` | 实码已有 |
| 9 | `entryPoints` | `Array<{ kind; target }>`（**待建**，见 §1.4） | ⭕ 待建 | `[{ kind: "node-toolbar", target: "superResolve" }]` | **本文增（需回改实码）** |
| 10 | `registryVersion` | `number`（**待建**，防撞与回滚用） | ⭕ 待建 | `1` | **本文增（需回改实码）** |

**必填口径**：控制线裁定「零参数预设显式写『暂无』，不许缺字段」——**所有 8 个既有字段均必填**，不接受 `undefined`。

### 1.3 `contextRequirement` 谓词（解耦命令协议）

**实码定义**（`capability-entries.ts`）：

```ts
export type CapabilityContextRequirement = "none" | "single_image" | "selection";
```

**判定入口**（实码已有）：

```ts
export function capabilityContextSatisfied(
    entry: CapabilityEntry,
    context: { imageCount: number; hasSelection: boolean },
): boolean
```

**语义表**（含 F-08 的裁定修正）：

| 值 | 语义 | 判定 | 实证样本 |
|---|---|---|---|
| `none` | 无上下文要求，可脱离画布执行 | `true` 恒真 | 无（未来：⌘K 直出类） |
| `single_image` | 需要恰好一张图片节点 | `imageCount === 1` | `image.superResolve`、`image.annotateEdit` |
| `selection` | 需要画布选区（多节点或框选） | `hasSelection` | 无（selection-toolbar 17 项未来候选） |

**★ F-08 修正点（已裁定，入档防再犯）**：F-08 任务书默认给 `selection`，但实勘发现语义错位 ——
`selection` 谓词设计给**多选工具条场景**（入口前提 = 画布已有选区），而 F-08 的圈选发生在**弹窗内部**
（打开后才圈），入口前提只需单图。若填 `selection`，**入口可见性条件与实际执行前提错位**。
**裁定：`single_image`**，圈选作为弹窗内交互、不上浮为入口谓词。
> 教训：`contextRequirement` 描述的是**入口前提**，不是**执行期交互**。二者混淆会让入口错误地不可见。

**解耦命令协议（谓词如何生效）**：
1. 入口渲染前调 `capabilityContextSatisfied(entry, context)`
2. 返回 `false` → **不渲染**（而非禁用）——「隐藏」和「禁用」是两种沟通方式（规格本体 §4 B7）
3. 上下文来源由调用方组装（画布页从 `nodesRef` / `selectedNodeIds` 取）

### 1.4 待建字段（需回改实码）

| 字段 | 为什么需要 | 回改落点 |
|---|---|---|
| `entryPoints` | 实码目前**没有入口登记**——O-03 的工具栏条目是手工接线（`canvas-image-toolbar-tools.tsx` 里独立写了一份 `id: "superResolve"`），能力条目与按钮层**只有注释层面的约定**，没有机器可校验的关联。补 `entryPoints` 后，升格枝可校验「每个已声明入口都真实存在」 | `capability-entries.ts` + 消费点 |
| `registryVersion` | 回滚策略（§5）需要版本锚点；跨 5 前端文件 + Go seed 的收编需要能判断「这条记录属于哪次收编」 | 同上 |

**控制线裁定**：发现实码字段不足时**在方案里扩并标注「需回改实码」**——本节即为该标注。

**★ 跨枝条款（控制线裁定 2026-10-04，R25m 实战发现）**：

**在飞条目合入前须同步补齐门①字段（`entryPoints` + `registryVersion`）**。

背景：R25m 把这两字段升为 `CapabilityEntry` **必填**后，在飞枝上按旧 schema 编写的条目
（如 F-08 的 `image.annotateEdit`）会缺字段 → **无论哪侧先合入都阻断**
（`tsc` 报 missing property + `registry-namespace-guard.test.ts` 抛 TypeError/断言失败）。

处置：**补字段是各枝自己的事**，不由先合入方代改 —— 先合入方无阻断
（其自身条目字段已全），后合入方在合入前补齐即可。

### 1.5 两个实证样本并列（校验 schema 可承载性）

| 字段 | `image.superResolve`（O-03） | `image.annotateEdit`（F-08） | schema 是否承载 |
|---|---|---|---|
| `id` | `image.superResolve` | `image.annotateEdit` | ✅ 同命名空间 |
| `name` | `AI 超分` | `圈选改图` | ✅ |
| `tier` | `1` | `1` | ✅ |
| `contextRequirement` | `single_image` | `single_image`（裁定） | ✅ |
| `assetKind` | `capability/tool` | `capability/tool` | ✅ |
| `parameterSurface` | 目标档 + 放大方式 | 编辑意图（actionHint） | ✅ 自由形状 |
| `executionChain.handler` | `superResolveImageNode` | `annotateEditImageNode` | ✅ |
| `executionChain.location` | `cloud` | `cloud` | ✅ |
| `executionChain.primaryChannel` | `a6api · nano-banana-2` | `暂无——候选 a6api·nano-banana-2，F-08 渠道实测门待跑` | ✅ 允许「暂无」 |
| `zeroParameterPreset` | `暂无` | `暂无` | ✅ |

**结论**：8 个实码字段可承载两个不同能力（像素重建 vs 指令跟随编辑），**无需为 F-08 扩字段**。
`entryPoints` / `registryVersion` 是为**升格枝的机器校验**而增，不是被 F-08 逼出来的。

---

## 2. 硬清单②：AssetKind 全集枚举 + 归类映射表

### 2.1 ★ AssetKind 全集（实码枚举过窄，本文扩）

**实码现状**（`capability-entries.ts`，**过窄**）：

```ts
assetKind: "capability/tool" | "asset/image" | "asset/video";   // ← 仅 3 值，无法承载 81+87 项
```

**本文扩为全集**（含模型留槽，规格本体 §2.2 原文「资产 schema 现在就给『模型』留一个 AssetKind」）：

```ts
export type AssetKind =
    // ── 能力域 ──
    | "capability/tool"          // 可执行工具（超分、圈选改图、抠图…）
    | "capability/workflow"      // 多步编排（未来 F-12 成套商拍）
    // ── 资产域（内容素材）──
    | "asset/image"              // 图片素材
    | "asset/video"              // 视频素材
    | "asset/audio"              // 音频素材
    // ── 预设域（参数类，规格本体 §1「预设 = 参数类：风格/光照/机位/镜头」）──
    | "preset/style"             // 风格预置（style presets）
    | "preset/lighting"          // 光照预置
    | "preset/camera"            // 机位/机身预置
    | "preset/lens"              // 镜头预置
    | "preset/motion"            // 运镜预置（视频域，见 §3.3 窗口标注）
    | "preset/channel-spec"      // 渠道规格（Amazon 主图 / 详情长图 / 抖音竖版）
    // ── 模板域 ──
    | "template/canvas"          // 画布快照模板（F-05 CreationTemplate）
    // ── 规格域 ──
    | "spec/prompt-template"     // 提示词模板（skills/seed/presets）
    | "spec/generation"          // 生成规格（generation-contract）
    // ── 模型留槽（缓议，规格本体 §3）──
    | "model/checkpoint";        // 模型橱窗留槽——现在不消费，将来开橱窗成本≈零
```

**★ 落枚举纪律（控制线审查提示，R25m 实现约束）**：

**本枝不得一次性全落 15 值** —— 防「定义了但没人用」的反模式（#11 同族）。

| 批次 | 落哪些值 | 触发条件 |
|---|---|---|
| **R25m 本枝** | `capability/tool` + `capability/workflow`（保留 2 值）+ 收编清单用到的 **9** 个：`preset/style` / `preset/lighting` / `preset/camera` / `preset/lens` / `preset/motion` / `preset/channel-spec` / `template/canvas` / `spec/prompt-template` / `spec/generation` | 立即 |
| **留槽** | `asset/image` / `asset/video` / `asset/audio` / `model/checkpoint` | **有真实消费者再进枚举** |

> 说明：`asset/image` / `asset/video` 是**实码已有的 3 值之二**（O-03 时就在），
> 保留它们是**兼容既有实码**，不是新增；`asset/audio` 与 `model/checkpoint` 是**纯留槽**，
> 无消费者前不进枚举（避免枚举膨胀 + 死代码）。

**扩的理由（逐条对实证）**：
- 实码 3 值只覆盖 `capability/tool` —— 而 O-03 与 F-08 **都用它**，说明该值够用但**不足以承载收编清单**
- 81 条内容资产横跨**风格/光照/相机/镜头/提示词模板/灵感卡**至少 6 种形状（§2.3 实测），3 值无法归类
- 87 项 tools.json 横跨 **style / motion / nine_grid** 3 组（§2.4 实测）
- `model/checkpoint` 为**留槽**（规格本体 §3 模型橱窗「缓议」），**现在不消费**

### 2.2 ★ 归类原则（三条，防「第四套 schema」）

规格本体 §2.2 原文：「**字段语义抄现成的，不发明第四套**——style-profiles 的 `favorite`/`lastUsedAt`/`revision` + skills 的 `scope` 四态」。

本文据此定三条原则：

1. **AssetKind 是「形状标签」不是「用户概念」** —— 用户永远看不到 `preset/lighting` 这种串；它只用于**归类、检索、下发**
2. **同形状归一类，不同形状不合并** —— 光照与相机都是「参数类预设」但**形状不同**（光照有 `color`/`image`，相机有 `profilePrompt`），故分列 `preset/lighting` 与 `preset/camera`
3. **一条记录只属一个 AssetKind** —— 不做多标签。若某资产确需跨类，说明它该拆成两条记录

### 2.3 81 条口径实测核对（★ 发现口径差）

**规格本体 §2.2 原文口径**：
> 81 条内容资产（creation-inspirations 23 + legacyCanvasStylePresets 18 + recommendedCanvasStylePresets 8 + 光照 8 + 相机 8 + 镜头 8 + skills/seed/presets 8）

**实测结果（逐项 grep + 数组元素计数）**：

| 类别 | 规格 | **实测** | 落点（实测） | 判定 |
|---|---|---|---|---|
| creation-inspirations | 23 | **22** | `src/pages/create/creation-inspirations.ts` → `creationFeaturedWorks` | ✗ **差 1** |
| legacyCanvasStylePresets | 18 | **18** | `src/components/canvas/canvas-style-picker-modal.tsx` | ✅ |
| recommendedCanvasStylePresets | 8 | **8** | `src/lib/canvas/canvas-style-system.ts` → `recommendedSelections` | ✅ |
| 光照 | 8 | **8** | `src/components/canvas/canvas-node-lighting-dialog.tsx` → `STYLE_PRESETS` | ✅ |
| 相机 | 8 | **8** | `src/lib/canvas/camera-prompt-library.ts` → `CAMERA_PROFILES` | ✅ |
| 镜头 | 8 | **8** | `src/lib/canvas/camera-prompt-library.ts` → `LENS_PROFILES` | ✅ |
| skills/seed/presets | 8 | **8** | `backend/internal/skills/seed/presets.json` → `presets` | ✅ |
| **合计** | **81** | **80** | | **✗ 差 1** |

**★ 口径修正结论**：
- **实际收编总量 = 80 条**（不是 81）
- 差异来源：`creationFeaturedWorks` 实为 **22 条**（规格记 23）
- **处置**：本文以**实测 80** 为收编基数；规格本体 §2.2 的「81」标注为**口径差**（不追改规格本体，在本文登记）

**★★ 差 1 的根因（控制线审查追问项，2026-10-03 定论）**：

**不是**「23 条里有 1 条不可收编」，而是**计数方法陷阱** —— 第 23 条数据**不存在**，无需在附录 A 标注去向。

| 证据 | 结果 |
|---|---|
| 数组元素·`title` 精确匹配 | **22** |
| 数组元素·顶层对象配对 | **22** |
| `grep -c 'title:'`（含类型定义行） | **23** ← 污染源 |
| git 首次提交 `4eaadef8`（2026-09-16）的数组实测 | **22**（自始未变） |

**污染机制**：`creation-inspirations.ts` 第 3 行是类型定义
`export type CreationInspiration = { title: string; description: string; ... }` ——
该行**含 `title:` 字段声明**，任何 `grep -c 'title:'` 风格的计数都会把它算作第 23 条数据。

**⚠ 同类污染在其他类别同样存在（但规格数字恰好未被污染）**：

| 类别 | 数组实测 | grep 风格计数 | 污染量 |
|---|---|---|---|
| creation-inspirations | 22 | 23 | +1 ← **规格数字被污染** |
| legacyCanvasStylePresets | 18 | 23 | +5 |
| recommendedSelections | 8 | 24 | +16 |
| 光照 STYLE_PRESETS | 8 | 8 | clean |
| 相机 CAMERA_PROFILES | 8 | 18 | +10 |
| 镜头 LENS_PROFILES | 8 | 18 | +10 |

⇒ **教训（计数纪律）**：资产计数**必须用数组元素配对**（或 AST），
**禁止** `grep -c '<字段名>:'` —— 类型定义行、注释、样例代码都会污染计数。
本仓同类前科：源码断言命中注释而非渲染点（`indexOf` 假命中家族）。

**诚实边界**：规格作者实际用的计数方法**无法回溯**（「23」的确切来源未能确证）；
本节证明的是「该 grep 方法会恰好产出 23」与「第 23 条数据不存在」两点事实，
「规格用了该 grep」是**最可能的解释，非确证**。
- **额外发现**：`inspirationSource.notice` 自述「8 条文本模板依据公开领域提示词翻译改编」—— 这 8 条是**改编自 CC0 提示词**（`awesome-chatgpt-prompts` rev `f78a1c51`），收编时**许可证字段必须保留**（见 §3.4）

### 2.4 87 项 tools.json 实测核对

| 组 | 规格 | 实测 | 记录字段形状 | AssetKind 归类 |
|---|---|---|---|---|
| `style` | 45 | **45** ✅ | `id, label_en, label, tag, cover, extra_info[], prompt, media_url, enabled, visibility, create_at, update_at, owner_id` | `preset/style` |
| `motion` | 33 | **33** ✅ | `id, label_en, label, tag, cover, desc, prompt, media_url, enabled, visibility, create_at, update_at, owner_id` | `preset/motion`（**视频域，窗口标注**） |
| `nine_grid` | 9 | **9** ✅ | `id, label_en, label, tag, desc, prompt, ratio, enabled, visibility, create_at, update_at, owner_id` | `template/canvas`（九宫格联系表） |
| **合计** | **87** | **87** ✅ | | |

**形状差异**：三组字段**高度同构**（共享 `id/label_en/label/tag/prompt/media_url/enabled/visibility/create_at/update_at/owner_id`），差异仅在：
- `style` 独有 `extra_info[]`（多张参考图路径）
- `motion` 独有 `desc`
- `nine_grid` 独有 `ratio`

⇒ **可用一个统一 schema 承载**（§3 真值源裁定），差异字段设为可选。

### 2.5 归类映射表（每形状 ≥1 条样例）

**规格本体 §9 硬清单②要求「81+87 项逐条归类映射表（每形状≥1 条样例）」** —— 逐条全表见**附录 A**；本节给**形状级汇总 + 每形状样例**：

| AssetKind | 条数 | 代表样例（真实记录） | 落点 |
|---|---|---|---|
| `preset/style` | 45 + 18 + 8 = **71** | tools.json style #1 `{ label_en: "period_idol", label: "古装偶像", tag: "period", prompt: "...", extra_info: ["period_idol/female.webp", ...] }` | `tools.json` + `canvas-style-picker-modal.tsx` + `canvas-style-system.ts` |
| `preset/motion` | **33** | tools.json motion #1 `{ id: 46, label_en: "static_shot", label: "固定镜头", tag: "basic", desc: "建立冷静秩序" }` | `tools.json`（**视频域**） |
| `template/canvas` | **9** | tools.json nine_grid #1 `{ label_en: "multi_camera_nine_grid", label: "多机位九宫格", desc: "生成一个 3x3 九宫格的多机位联系表", ratio: "..." }` | `tools.json` |
| `preset/lighting` | **8** | `{ id: "rembrandt", name: "伦勃朗光", color: "#5a3a1a", image: "/lighting-presets/rembrandt.png", prompt: "Rembrandt lighting, 45-degree angle key light, ..." }` | `canvas-node-lighting-dialog.tsx` |
| `preset/camera` | **8** | `CAMERA_PROFILES[0]` `{ ..., profilePrompt: "shot on Panavision DXL2 with Panavision DXL color science, ..." }` | `camera-prompt-library.ts` |
| `preset/lens` | **8** | `LENS_PROFILES[0]` `{ ..., profilePrompt: "ARRI Signature Prime lens, large-format coverage, creamy organic bokeh, ..." }` | `camera-prompt-library.ts` |
| `spec/prompt-template` | **8** | `backend/internal/skills/seed/presets.json` presets[0] | `skills/seed/presets.json` |
| `spec/generation` | **22** | `creationFeaturedWorks[0]` `{ title: "雨夜霓虹 · 电影感开场", description: "...", image: "...", mode: "video", prompt: "...", featured: true }` | `creation-inspirations.ts` |

**收编总量**：80（内容资产）+ 87（tools.json）= **167 条**

**★ 另需收编（规格本体 §9 W5 窗口原文「渠道规格/评审资产/运动预设窗口标注纳入收编」）**：

| AssetKind | 条数 | 样例 | 落点 |
|---|---|---|---|
| `preset/channel-spec` | **3** | `{ id: "amazon-main", label: "Amazon 主图", aspect: "1:1", minPixels: { width: 1600, height: 1600 }, desiredResolution: "4k" }` | `src/lib/image-size-presets.ts` → `ECOM_CHANNEL_PRESETS` |
| `spec/generation`（评审资产） | 待定 | `art-critique/` 5 文件（`annotation.ts` / `contracts.ts` / `ai-art-critique-modal.tsx` / `ai-art-critique-report.tsx` / `ai-art-critique-node.tsx`）——**收编前需先界定「评审资产」的边界** | `src/lib/art-critique/` + `components/canvas/art-critique/` |

**收编总基数 = 167 + 3（渠道规格）+ 评审资产（待界定）**

---

## 3. 硬清单③：真值源裁定

### 3.1 现状实勘（两条独立数据通路，都在 Go 后端）

| 数据 | 位置 | 载体 | 消费方式 |
|---|---|---|---|
| **tools.json**（87 项） | `backend/internal/tools/seed/tools.json` | `//go:embed` | `tools_seed.go` 的 `toolSeedItem` struct → 启动时播种入库（**无 `version` 字段，需补**） |
| **skills/presets.json**（8 项） | `backend/internal/skills/seed/presets.json` | `//go:embed` | `skills_presets.go`（**有 `version: 1`**） |

**关键事实**：
- 两份 seed **都已在 Go 后端**，通过 `//go:embed` 编译进二进制
- 前端**当前没有** tools.json 的副本（`style`/`motion`/`nine_grid` 由后端 API 下发）
- 但前端**另有** 71 条风格预设（`legacyCanvasStylePresets` 18 + `recommendedSelections` 8 + `projectStyle*` 等）与后端 tools.json 的 `style` 45 条**部分重叠**

### 3.2 ★ 裁定：服务端为唯一真值源，前端保留 fallback 但标注为降级

**裁定理由（三条，逐条对现状）**：

1. **运营可改卡不发版**（规格本体 §2.2 原文「下发机制：服务端配置 + 缓存（NeoWOW 快捷指令 29 款服务端下发为蓝本），运营改卡不发版」）—— 前端为源则每次改卡都要发版，违背产品目标
2. **seed 已在服务端**（§3.1 实勘）—— 现状即服务端为源，改成前端为源是**倒退**
3. **多端一致性**——未来若有移动端/插件，前端为源会导致多份真值

**裁定内容**：

```
┌─────────────────────────────────────────────────────────────┐
│  真值源（Single Source of Truth）                            │
│  backend/internal/tools/seed/tools.json                      │
│  backend/internal/skills/seed/presets.json                   │
│  + 管理端 CRUD（运营改卡）                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ API 下发
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  前端消费层                                                  │
│  ① 正常态：从 API 取（服务端下发）                            │
│  ② 降级态：API 不可达时用本地 fallback（标注为「离线降级」）   │
└─────────────────────────────────────────────────────────────┘
```

**前端 fallback 的边界（必须标注，不得静默）**：
- 允许：`legacyCanvasStylePresets`（18 条）等**已在代码里的常量**作为离线兜底
- **必须标注**：降级态 UI 明示「离线预设」（沿用 F-01/F-02 的「本地缓存 ≠ 服务端已保存」纪律）
- **禁止**：把 fallback 当默认路径；新增预设**必须**进服务端 seed

### 3.3 ★ 映射契约（两运行时的字段对应）

**Go seed struct → 前端 AssetKind 的映射**（`tools_seed.go` 的 `toolSeedItem` 实勘字段）：

| Go seed 字段 | 前端字段 | 映射规则 |
|---|---|---|
| `id` (int64) | `assetId` | 直接映射（**注意：tools.json 的 id 是数字，能力层 id 是字符串** —— 见 §4 防撞） |
| `label_en` | `slug` | 直接映射（英文标识，用于 routeSlug / 防撞） |
| `label` | `title` | 直接映射（中文显示名） |
| `tag` | `group` | 直接映射（style 用 `period`/…，motion 用 `basic`/`follow`/`reveal`/`emotion`/`aerial`） |
| `prompt` | `prompt` | 直接映射（模型面提示词） |
| `desc` | `description` | 直接映射（motion/nine_grid 有，style 无 → **可选**） |
| `cover` / `media_url` | `coverUrl` / `mediaUrl` | 直接映射 |
| `extra_info[]` | `referenceImages[]` | 直接映射（**仅 style 有** → 可选） |
| `ratio` | `aspect` | 直接映射（**仅 nine_grid 有** → 可选） |
| `enabled` | `enabled` | 直接映射 |
| `visibility` | `scope` | **语义映射**：目标是 skills 的 `public`/`mine`/`favorites`/`created` 四态（规格本体 §2.2 原文）。**实测现状**：tools.json 87 条 `visibility` 全为 `"public"` —— 四态是**目标态**，收编时先承载 `public`，其余三态待用户层（W7 R25f-0）开放 |
| `owner_id` | `ownerId` | 直接映射 |
| `create_at` / `update_at` | `createdAt` / `updatedAt` | 直接映射 |
| — | `assetKind` | **前端派生**：按来源组（style→`preset/style`，motion→`preset/motion`，nine_grid→`template/canvas`） |

**契约纪律**：
- **字段名不一致时以后端为准**（服务端为真值源）
- `assetKind` 由**前端派生**（不存后端）—— 因为它是「归类标签」不是数据本体
- **版本字段**：Go seed 有 `version`（`presets.json` 实测 `version: 1`，`updated: 2026-09-22`），前端消费时必须校验版本，**版本不符拒绝使用**（防新旧 schema 混用）。**注意**：`tools.json` 实测**无** `version` 字段（三组直挂 `title`/`tags`/`list`）—— 收编时需补，否则版本校验对 tools.json 无锚点

### 3.4 许可证字段（★ 收编必带）

`creation-inspirations.ts` 实勘发现：

```ts
export const inspirationSource = {
    repository: "https://github.com/f/awesome-chatgpt-prompts",
    revision: "f78a1c5136fa080155d928e0d7e2b4a41ddef03e",
    license: "CC0-1.0",
    notice: "8 条文本模板依据公开领域提示词翻译改编；其余为本项目编写。",
};
```

**裁定**：收编清单**每条记录必须带来源字段**（`source.repository` / `source.revision` / `source.license` / `source.notice`），至少对**外部来源**的资产强制。理由：许可证合规是收编的**法律边界**，混编后无法回溯。

---

## 4. 硬清单④：ID 命名空间与防撞规则

### 4.1 现状实勘（5 前端文件 + Go seed，实测零撞车）

| 命名空间 | 文件 | 实测 id 数 | id 形态 | 样例 |
|---|---|---|---|---|
| `tool-registry/main` | `definitions/main-toolbar-tools.tsx` | 12 | kebab/camel 混合 | `tool-canvas-mode` |
| `tool-registry/selection` | `definitions/selection-toolbar-tools.tsx` | 17 | camelCase | `tool-move` |
| `tool-registry/node-hover` | `definitions/node-hover-tools.tsx` | 20 | camelCase | `extractFrames` |
| `tool-registry/add-node` | `definitions/add-node-menu-tools.tsx` | 7 | camelCase | — |
| `image-toolbar`（手工层） | `components/canvas/canvas-image-toolbar-tools.tsx` | 30 | camelCase | `superResolve` / `upscale` |
| **`capability`（能力层）** | `lib/canvas/capability-entries.ts` | 1（F-08 将 +1） | **`域.动作`** | `image.superResolve` |
| Go seed（tools.json） | `backend/internal/tools/seed/tools.json` | 87 | **int64 数字** | `1` / `46` / `79` |

**★ 实测结论**：**当前零撞车** ——
- 能力层 id 含点（`image.superResolve`），工具层 id 不含点 → **天然隔离**
- 工具层内部重复 id：**无** ✓
- 能力层与工具层撞车：**无** ✓

### 4.2 ★ 命名空间规则（三条）

**规则 1：能力层 id 强制 `域.动作` 形态，含点号**

```
<domain>.<action>            // camelCase 动作
image.superResolve
image.annotateEdit
video.extend                 // 未来
```

- `domain` 枚举：`image` | `video` | `audio` | `text` | `canvas`
- **含点是硬性要求** —— 这是与工具层（无点）的**机器可判隔离**

**规则 2：工具层 id 沿用现状，禁止引入点号**

- 既有 56 个按钮 id **零迁移**（`superResolve` / `upscale` / `maskEdit` …）
- **新增按钮禁止含点** —— 保隔离不破

**规则 3：Go seed 的数字 id 与前端字符串 id 分属两个空间，用 `label_en` 桥接**

- Go seed `id` 是 int64（`1`/`46`/`79`），**不参与**前端命名空间
- 桥接键 = `label_en`（如 `period_idol` / `static_shot` / `multi_camera_nine_grid`）
- 前端消费时若需生成能力层 id，用 `asset.<label_en>` 形态（如 `asset.period_idol`），**与 `域.动作` 再次隔离**（`asset.` 前缀）

### 4.3 防撞机制（三层，从静态到运行时）

| 层 | 机制 | 落点 | 现状 |
|---|---|---|---|
| **L1 静态** | CI 断言：能力层 id 全部含点 + 工具层 id 全部不含点 + 两集合无交集 | `web/test/` 新增守卫 | **待建**（本文规格，R25m 落地） |
| **L2 注册时** | `registerToolbarTools()` 时检测重复 id，重复则**抛错**（不静默覆盖） | `tool-registry.ts` | 待建 |
| **L3 收编时** | 收编脚本对新条目查重，撞车则**拒绝写入 + 报错**（不自动改名） | R25m 收编枝 | 待建 |

**★ L1 守卫的具体断言（可直接实现）**：

```ts
// 能力层 id 必须含点
for (const entry of CAPABILITY_ENTRIES) expect(entry.id).toContain(".");
// 工具层 id 必须不含点（防误引入）
for (const tool of allToolDefinitions) expect(tool.id).not.toContain(".");
// 两集合零交集（保险）
expect(new Set(capIds).intersection(new Set(toolIds)).size).toBe(0);
```

### 4.4 ★ F-08 第二样本的命名空间校验

F-08 的 `image.annotateEdit`：
- ✅ 符合 `域.动作` 形态（`image` + `annotateEdit` camelCase）
- ✅ 与 `image.superResolve` 同域不同动作，**无撞车**
- ✅ F-08 任务书记录了 id 论证：候选 `image.regionEdit` 被否（丢失「标注语义」）、`image.markupEdit` 无先例 —— **与本文规则一致**

---

## 5. 硬清单⑤：收编回滚策略

### 5.1 收编的四个风险面

| 风险 | 表现 | 影响面 |
|---|---|---|
| **R1 数据污染** | 收编脚本写入脏数据（字段错位/编码错） | 库内真值损坏 |
| **R2 前端崩溃** | 新 schema 字段前端不认（版本不符） | 页面白屏 |
| **R3 部分成功** | 收编中途失败，一半新一半旧 | 状态不一致 |
| **R4 运营误改** | 管理端批量操作失误 | 真值源被改坏 |

### 5.2 ★ 回滚策略（三层防线）

**防线 1：收编前快照（R1/R4 的兜底）**

```
收编前 → 导出 tools.json + presets.json 全量快照到 .local/registry-snapshots/<timestamp>/
       → 快照含 sha256，收编后可比对
```

- **快照必须带版本号**（`version` 字段，§3.3 契约）
- 回滚 = 用快照覆盖 + 重启后端

**防线 2：分片收编 + 逐片验证（R3 的对策）**

规格本体 §9 W5 原文：「**最小可交付切片=2 形状×各 1 文件打通全链**（legacyCanvasStylePresets 与 tools.json style 各取其一），全量收编允许滑 W6 早段，最小切片进砍单序豁免清单」

⇒ **分片粒度 = 形状**（不是文件）：
```
片 1：preset/style（tools.json style 45）        ← 最小切片之一
片 2：preset/style（legacyCanvasStylePresets 18）← 最小切片之二
片 3：preset/lighting（8）
片 4：preset/camera（8）+ preset/lens（8）
片 5：spec/prompt-template（8）
片 6：spec/generation（creationFeaturedWorks 22）
片 7：preset/motion（33）★ 视频域窗口
片 8：template/canvas（nine_grid 9）
片 9：preset/channel-spec（3）
```

**每片收编后立即验证**：① 条数匹配 ② 字段完整 ③ 前端能渲染 ④ 无撞车。**任一片失败 → 只回滚该片**。

**防线 3：前端版本校验（R2 的对策）**

```ts
// 前端消费时必须校验
if (payload.registryVersion !== EXPECTED_REGISTRY_VERSION) {
    // 拒绝使用 + 降级到 fallback + 明示「预设版本不符，已降级」
}
```

**禁止**：静默接受未知版本（会让脏数据混入 UI）。

### 5.3 回滚点（git 层面）

| 回滚点 | 粒度 | 触发条件 |
|---|---|---|
| **commit** | 单片收编 | 该片验证失败 |
| **branch** | 整个 R25m | 多片连续失败 |
| **快照** | 数据 | 库内真值损坏 |

**纪律**：R25m 收编枝**每片一个 commit**（沿用本仓「单逻辑单 commit」），便于 `git revert` 精确回滚。

### 5.4 不做（防过度设计）

- ❌ **不做双写**（同时写前后端）—— 违背「服务端唯一真值源」裁定
- ❌ **不做自动改名防撞** —— 撞车必须**报错**，人工决策（自动改名会静默改变用户可见 id）
- ❌ **不做灰度发布** —— 预设是**只读内容**，非代码逻辑，分片收编已足够

---

## 6. 收编清单（W5 R25m 的输入）

### 6.1 全量清单

| 形状 | 条数 | 落点 | AssetKind | 收编片 | 窗口 |
|---|---|---|---|---|---|
| tools.json style | 45 | `backend/internal/tools/seed/tools.json` | `preset/style` | 片 1（最小切片） | W5 |
| legacyCanvasStylePresets | 18 | `canvas-style-picker-modal.tsx` | `preset/style` | 片 2（最小切片） | W5 |
| recommendedCanvasStylePresets | 8 | `canvas-style-system.ts` | `preset/style` | 片 2 | W5 |
| 光照 STYLE_PRESETS | 8 | `canvas-node-lighting-dialog.tsx` | `preset/lighting` | 片 3 | W5 |
| 相机 CAMERA_PROFILES | 8 | `camera-prompt-library.ts` | `preset/camera` | 片 4 | W5 |
| 镜头 LENS_PROFILES | 8 | `camera-prompt-library.ts` | `preset/lens` | 片 4 | W5 |
| skills presets | 8 | `backend/internal/skills/seed/presets.json` | `spec/prompt-template` | 片 5 | W5 |
| creationFeaturedWorks | **22**（规格记 23） | `creation-inspirations.ts` | `spec/generation` | 片 6 | W5 |
| tools.json motion | 33 | `backend/internal/tools/seed/tools.json` | `preset/motion` | 片 7 | **★ 视频域窗口** |
| tools.json nine_grid | 9 | `backend/internal/tools/seed/tools.json` | `template/canvas` | 片 8 | W5 |
| ECOM_CHANNEL_PRESETS | 3 | `image-size-presets.ts` | `preset/channel-spec` | 片 9 | W5 |
| 评审资产 | 待界定 | `lib/art-critique/` + `components/canvas/art-critique/` | `spec/generation`? | 片 10 | W5（需先界定边界） |
| **合计** | **170 + 评审资产** | | | | |

**★ 注（控制线澄清项定论）**：`creationFeaturedWorks` 的 **22** 是**数组实测**（三种方法交叉），
非「23 条里有 1 条不可收编」—— 第 23 条数据**不存在**，根因是 `grep -c 'title:'` 误计类型定义行（详见 §2.3）。
⇒ **附录 A 无需为该条标注去向**（下线/合并/重复均不适用）。

### 6.2 ★ motion 33 的视频域窗口标注

**依据**：`tools.json` motion 组实测 33 条，按 `tag` 分布：

| tag | 条数 | 语义 |
|---|---|---|
| `basic` | 13 | 基础运镜（固定/推/拉/摇/移…） |
| `follow` | 6 | 跟随运镜 |
| `reveal` | 5 | 揭示运镜 |
| `emotion` | 5 | 情绪运镜 |
| `aerial` | 4 | 航拍运镜 |

**结论**：这 33 条是**运镜/镜头运动预设，属视频域**。
**窗口标注**：规格本体 §9 明列视频线缓行（R12-R16 随视频线启动批）⇒ **这 33 条收编但标注「视频域窗口」**，
即：**数据结构照收编**（进统一 schema），**用户面不下发**（视频线启动前不暴露），待视频线启动批放开。

**★ 不因窗口标注而跳过收编** —— 理由是收编解决的是**数据结构统一**（只读变可索引、可下发），
不是产品面暴露；跳过会让视频线启动时再返工一遍。

### 6.3 收编前置条件（R25m 开工检查表）

> **★ 控制线裁定（2026-10-03 审查）**：本表 6 项前置将**设为 R25m 验收门** ——
> **逐项打勾后才准动收编**。开工令下达时以此为门禁，未打勾项不得绕过。

- [ ] 本文 §1 schema 定稿（含 `entryPoints` / `registryVersion` 回改实码）
- [ ] 本文 §2 AssetKind **按落枚举纪律**（§2.1 ★）落进实码 —— **不是全落 15 值**
- [ ] 本文 §4 防撞守卫 L1 落地（`web/test/` 新增）
- [ ] Go seed 侧 schema 对齐（`toolSeedItem` 补 `desc`/`ratio` 可选字段说明 + 补 `version` 字段）
- [ ] 快照脚本就绪（§5.2 防线 1）
- [ ] `docs/artifacts/` 与 `docs/content/docs/reference/backend/backend-database.mdx` 的同步点确认

---

## 7. routeSlug 机制规格

### 7.1 现状实勘

| 路由 | 现状 | 位置 |
|---|---|---|
| `/canvas/:id` | ✅ 存在 | `router.tsx:191` |
| `/canvas/:id/:tool` | ❌ **不存在** | — |
| `/share/canvas/:token` | ✅ 存在 | `router.tsx:102` |
| `/share/artifact/:token` | ❌ **不存在** | — |

### 7.2 A1 画布工具子路径（P0）

**规格**：`/canvas/:id/:tool`，白名单 `grid` / `portrait` / `angle` / `upscale` / `batch`

**实现纪律（DESIGN.md 已登记，此处补机制细节）**：
- 用 **`history.replaceState`（不 push）** —— 不产生历史栈噪音（DESIGN.md A1 原文）
- **白名单校验**：非白名单值 → 重定向到 `/canvas/:id`（不留 404）
- **定位**：工作台派接口 —— 画布内高复杂度操作的 URL 化，**与独立工具页（档 2）是两档不同入口**

**与能力层的关系**：`tier: 2` 的能力条目**生成** `/canvas/:id/:tool` 入口（§2.1 生成规则）

### 7.3 A2 单产物公开页（P1）

**规格**：`/share/artifact/:token` 只读页

**实现要点**：
- 后端补 token 校验（`handler/canvas_share.go`）
- 与既有 `/share/canvas/:token`（整画布分享）**并存**，粒度不同
- **定位**：小白把成品发给客户的交付形态（Higgsfield Effects 一手蓝本）

### 7.4 routeSlug 与 AssetKind 的桥接

```
能力条目（tier: 2）→ 生成 routeSlug → /canvas/:id/:tool 或 /tools/:slug
预设资产（AssetKind: preset/*）→ 可索引 → 未来「工具目录」页的 routeSlug
```

**触发条件**（规格本体 §3 原文）：注册表条目 **>20** 再议目录页（当前基线：能力层 1 条，工具层 56 条）。

---

## 8. 与既有裁定的相容性检查

| 既有裁定 | 本文是否冲突 | 说明 |
|---|---|---|
| 四档判据（规格本体 §4） | ✅ 相容 | §1.2 `tier` 字段直接承载 |
| 不做清单（规格本体 §10） | ✅ 相容 | 本文不新增用户面 |
| 统一任务面铁律（执行位置只是元数据标签） | ✅ 相容 | §1.2 `executionChain.location` 承载 |
| 一级导航上限 8 | ✅ 相容 | routeSlug 是子路径不是一级导航 |
| 视频线缓行（R12-R16） | ✅ 相容 | §6.2 motion 33 窗口标注 |
| 命名分流红线（`upscale` vs `superResolve`） | ✅ 相容 | §1.2 两个独立能力条目 |
| 登记位独立（控制线裁定） | ✅ 相容 | §1.1 明确「禁止塞进 ToolDefinition」 |

---

## 9. 交付硬清单自检

| # | 规格本体 §9 要求 | 本文落点 | 状态 |
|---|---|---|---|
| ① | 能力条目 schema 字段表（名/类型/必填/示例/与 tool-definition.ts 继承关系 + contextRequirement 谓词 + 解耦命令协议） | §1 | ✅ |
| ② | AssetKind 全集枚举（含模型留槽）+ 81+87 项逐条归类映射表（每形状≥1 样例） | §2（**实测 80+87=167**，口径差已登记） | ✅ |
| ③ | 真值源裁定（tools.json 在 Go seed）+ 两运行时映射契约 | §3 | ✅ |
| ④ | ID 命名空间与防撞规则（跨 5 前端文件 + Go seed） | §4 | ✅ |
| ⑤ | 收编回滚策略 | §5 | ✅ |
| + | 收编清单（81+87+渠道规格+评审资产，含 motion 33 窗口标注） | §6 | ✅ |
| + | routeSlug 机制规格 | §7 | ✅ |

**控制线审查结论（2026-10-03）**：**PASS，质量超预期**。实码抽查四节（§3 真值源 / §2 AssetKind / §4 命名空间 / §5 回滚）关键论证全部成立。采纳三处（80 基数实测为准 / motion 33「收编但不下发」升为正式口径 / 待回改实码两项列入 R25m 开工检查表），另附两处纪律提示（§2.1 落枚举纪律、§6.3 开工检查表设为验收门），澄清项定论见 §2.3 与 §6.1 注。

---

## 附录 A：逐条归类映射表

> 完整逐条表（167 + 3 + 评审资产）——**收编枝 R25m 生成**，本文给出生成规则与形状级样例（§2.5）。
> 理由：逐条表是**收编产物**（从各源文件解析生成），手工誊写会引入误差；本文定的是**归类规则**。

**生成规则**：
1. 从各落点解析出记录数组
2. 按 §2.2 三条原则判定 `AssetKind`
3. 按 §3.3 映射契约转换字段
4. 输出 `[{ assetId, assetKind, slug, title, group, prompt, ... }]`
5. 逐条过 §4.3 L1 防撞守卫

**附录 A 由 R25m 收编枝产出，产出后回填本附录。**
