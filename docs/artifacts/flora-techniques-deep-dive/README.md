# Flora Techniques & Tools 深拆（免费账号前端逆向 + 官方文档）

- 日期：2026-09-30　方法：tmwd-browser 控用户 Chrome（登录态）+ React fiber/Next chunk 逆向 + `docs.flora.ai` 官方文档（`llms-full.txt` 全量 384K）
- 账号：免费账号（`赵迪's workspace`）——**运行态能拿的拿运行态，拿不到的走前端 bundle 与官方文档**
- 数据源：`app.flora.ai`（Next.js App Router + Clerk + Convex）、`docs.flora.ai`（GitBook，有 `.md` / `llms.txt` / `llms-full.txt` / `?ask=` 接口）

---

# 第一部分 · 架构与栈（实测）

| 层 | 技术 | 证据 |
|---|---|---|
| 前端 | Next.js App Router（turbopack，148 chunks） | `_next/static/chunks/*` + `dpl_*` |
| 鉴权 | Clerk | `clerk.flora.ai` + `tokens/convex` |
| 数据/后端 | **Convex**（WebSocket 实时，非 REST） | `useConvex` / `api.*.queries/mutations` |
| 画布引擎 | **React Flow** | `react-flow__node` DOM + 运行态 nodes/edges |
| 模型路由 | 自有 model-service | `/api/model-service/dynamic-endpoints` |
| 模型目录 | GCS 静态 JSON | `flora-model-catalog-prod/.../models.json` |

**REST 端点（bundle 提取）**
```
/api/workflow/generate                    主生成
/api/workflow/canvas-batch/generate       画布批量
/api/workflow/generation-table/generate   生成表（Batch Generate 页）
/api/workflow/code-execution              代码节点执行
/api/workflow/preprocess-element          元素预处理
/api/workflow/run-technique               ★ Run App 跑技法
/api/techniques/publish | update          ★ 技法发布/更新
/api/providers/{openai,gemini,anthropic,vertex,alibaba,xai,reve,runware,freepik}/{start,status}
/api/model-service/dynamic-endpoints      模型端点目录
```

**Convex API 命名空间（三大）**
```
techniques.*     publicQueries.getVisibleTechniques / getTechniqueRunCounts / getDefinition
                 clientQueries.getTechnique / getTechniqueBySnapshotId /
                               getPersonalizedTechniqueDelta / getPendingAdminEdit /
                               getSnapshotIdForLegacyTechniqueId
                 queries.getReviewStatus / getFavoriteTechniqueListingIds / getLatestValidationRun
                 mutations.submitForReview / withdrawSubmission / addTechniqueToFavorites /
                           removeTechniqueFromFavorites / setTechniqueListingVisibility /
                           setTechniqueWorkflowVisibility / deleteTechnique / undoDeleteTechnique /
                           approveAdminEdit / rejectAdminEdit
techniqueRuns.*  create / get / updateOutputNodeIds / getRecentlyUsedTechniqueIds
appMode.*        createRun / createTechniqueRunProject / createTechniqueCanvasProject /
                 getRunHistory / getRunOutputs / persistPresetRun / getRecentlyRunTechniques /
                 markTechniqueLastViewed / deleteRun
```
→ 读出产品语义：**审核流 + 可见性双轴（listing/workflow 分开）+ 收藏 + 运行历史 + 一键转画布项目**，完整 UGC 市场治理体系。

---

# 第二部分 · Techniques（全拆）

## 2.1 本质定义（官方原文）

> "Techniques are pre-built, multi-step AI workflows that you can add to your canvas and run with a single click. Each technique **encapsulates a complex generation pipeline—combining multiple models and processing steps—into a simple node with defined inputs and outputs**."
> "Think of them as **'recipes' for AI generation**—you provide the ingredients (inputs), and the technique handles all the intermediate steps."

**四个能力支柱**（官方列举）：
1. **Multi-step workflows** — 串联多个 AI 模型（分析图像 → 生成提示词 → 生成视频）
2. **Action nodes** — 确定性处理步骤（调色、音频提取、视频特效）与 AI 生成并列
3. **Batch processing** — 技法内可含 Batch 节点，一次运行扇出处理集合
4. **Consistent results / Time-saving / Curated quality**

## 2.2 三层组成

```
① Workflow（节点图，React Flow DAG）
    内容块 + 结果块 + 结构块 + codeBlock；输入节点绑 ioType，输出节点绑 modelName
② 契约（inputs/outputs schema）
    {key, role, type, arity:{min,max}}  ← codeBlockDefinition 实测结构
③ Run App 外壳（自动生成表单）
    INPUT N ← 契约驱动；Upload image(JPG/PNG/WEBP) / Use preset；~N min + N credits + Generate
```

### 实测样本 `artwork-to-physical`（CoverArt · 452 uses · Domenico Amalfitano）
- 输入 1 个（`imageUrl`，label `Coverart`，`optional:false`）
- 输出 **9 个**：7 × `imageUrl`（Artwork on CD / CD Jewel Case Design / -back / Vinyl Record Design / Vinyl Case front+back / Flyer Design）→ **Nano Banana 2**；2 × `videoUrl`（3D CD Jewel Case / 3D Vinyl Sleeve）→ **Kling O1**
- 图规模 20 节点 / 13 边；类型分布 `techniqueViewLabel ×10` / `emptyImageBlock ×7` / `videoBlock ×2` / `staticImageBlock ×1`
- 预估 `~5 min` / `580 credits`
- 全图 JSON：`graph-artwork-to-physical.json`

### 节点 data 契约（运行态实测）
```jsonc
{ "label":"Artwork on CD", "variant":"output", "ioType":"imageUrl",
  "modelName":"Nano Banana 2", "failed":false, "width":424, "height":554 }
{ "label":"Coverart", "variant":"input", "ioType":"imageUrl", "optional":false }
```

## 2.3 节点类型全集（NodeTypes，bundle 提取）

```
内容类   staticImageBlock / staticVideoBlock / staticAudioBlock / audioBlock /
         textBlock / model3dNode / documentNode / layerEditorNode
结果类   resultImageBlock / resultVideoBlock / resultTextBlock / resultAudioBlock
结构类   techniqueBlock / collectionNode / routerNode / elementNode /
         comment / notes / textLabel
特殊     codeBlock（可执行代码）/ exportNode / model
```
**ioType 四元**：`imageUrl | videoUrl | text | audioUrl`

**输入组合 → 任务模式判定**（`switchOutputMode` 同族，值得整套借鉴）
```
视频  textToVideo / imageToVideo / firstFrameLastFrame(2图) / imagesToVideo(>2) /
      videoToVideo / audioToVideo / mixedToVideo / audioImageToVideo
音频  textToAudio
3D    textToModel3d / imageToModel3d / model3dToModel3d
文本  textToText / imageToText / imagesToText / videoToText / audioToText / mixedToText
```

## 2.4 codeBlock（可编程节点）★

```js
codeBlockDefinition = { kind:"codeBlock", schema: ({nodeData}) => ({
  schemaVersion: 1,
  inputs:  (nodeData?.parsedSchema?.inputs  ?? []).map(c),  // {key, role, type, arity}
  outputs: (nodeData?.parsedSchema?.outputs ?? []).map(h),  // {key, type}
})}
// arity: dynamic → {min:0, max:∞}；否则 {min:0, max:1}
```
- 节点带用户代码（`codeUrl`），有 `CodeBlockMode.CODE_EXECUTION`
- **计费特例**：`getCodeExecutionCost(e)` = `codeUrl非空 ? 0 : FLORA_FUNCTION_BY_ID.creditCost`
  → **自带代码的节点免费**，只有调用平台内置函数才按函数定价
- 内置函数目录 `FLORA_FUNCTIONS_BY_ID`（含 `code` / `schema` / `creditCost`）：`color-grade-image`、`color-grade-video`、`stitch-videos`、`split-video` …

## 2.5 Technique Builder（官方文档，四步流程）

| Step | 内容 |
|---|---|
| **Intro** | 说明：压缩工作流 → 发布到 Workspace → 画布复用 → 作为 app 分享 |
| **Input** | 画布上**点选节点**作为输入。候选条件：① 无入边（起点）② 已有生成产物 ③ 受支持节点类型（排除 group/comment/layerEditor/collection/technique 节点） |
| **Output** | 点选节点作为输出。候选条件：① 无出边（终点）② 已有生成产物 ③ 受支持类型；**至少选一个** |
| **Publish** | 填详情并发布 |

- 入口：画布底部 **Build Technique** 按钮（有可打包工作流时出现）
- 进入 builder 模式后**画布节点锁定编辑**（需稳定快照定义输入输出）
- create 模式隐藏左侧工具板，聚焦定义
- 每个输入/输出卡可配置：**Name（描述性标签）/ 类型 / 是否必需**

## 2.6 三个用户面（同一技法的三种入口）

| 入口 | 形态 | 端点/API |
|---|---|---|
| **Run App** | 表单外壳，只暴露 INPUT N + preset + Generate | `/api/workflow/run-technique` |
| **Workflow** | React Flow 图视图（只读/可编辑） | 详情页 tab |
| **Quick Canvas / Edit and export** | 一键转可编辑画布项目 | `createTechniqueCanvasProject` / `createTechniqueRunProject` |

配套 tab：`App / Workflow / Examples / About`；`About` 含 Use-Case 卡 ×3（Creative Production / Marketing Content / Product Visualization）+ How to use 三步图 + FAQ（credits/时长/可自定义/是否免费）+ Related techniques。

## 2.7 市场与治理（列表页实测）

- `112 techniques`；四 tab：`Community / Workspace / My Techniques / Favorites`
- 分类：`All / Featured / Essentials / Brand & Visual Design / Product Visualization / Marketing & Ads / Video & Animation / Fashion & Apparel Editorial / Content Packaging / Film & VFX / Space & Architecture / Fun & Inspiration`
- 卡片：封面 + 标题 + 作者 + 用量（`8K uses`）+ 收藏心形 + hover `View details` / `Try Technique`
- 搜索 + `Request a Technique` + `New Technique`
- 治理：`submitForReview` → `approveAdminEdit`/`rejectAdminEdit`；可见性双轴；`deleteTechnique`/`undoDeleteTechnique`（软删）；`getLatestValidationRun`（发布前校验运行）

---

# 第三部分 · Tools（官方文档 + 截图）

## 3.1 Tools 与 Studios 的关系（官方定义）

> "Fashion Studio is the first of FLORA's **Studios** — focused creative environments built on top of the canvas. **Everything you make in a studio can be opened in the full canvas** for deeper editing."

侧栏 Tools 列表（截图）：`Fashion Studio` / `Bulk Generate` / `Director` / `Pose` / `Realtime`（均带 `New` 徽章）

## 3.2 Fashion Studio（官方文档完整）

**形态**：三面板 —— 左「工具轨+设置」/ 中「结果 feed」/ 右「详情面板」
**定位**：面向服装团队的策展工具集，**无需节点连线**

| 工具 | 作用 |
|---|---|
| Sketch to Render | 平面草图/技术图 → 照片级服装渲染 |
| Garment Extractor | 从照片中抠出服装为独立素材 |
| Garment Color Swap | 换色同时保留面料、纹理、结构细节 |
| （第四个，官方表格截断处）| |

**关键机制**：
- 输入可接受 **collections** → 一次生成扇出多个（"one garment in every colorway"）
- 页脚显示本次 credit 成本 → Generate
- **工具版本化**：出现 `New version available` 横幅 → Update
- feed：按 run 分组（一次 Generate = 一个 run），grid/ticker 两种视图 + 缩略图尺寸滑杆
- 单结果操作：Download / fullscreen / `⋮`（Show info、**Open in Canvas**、Delete）
- 批量：Shift/Cmd 多选 → 批量下载或批量送画布；run 级下载/删除
- 详情面板：type / resolution / file size / name / model / **generation time**

## 3.3 Batch Generate（官方文档完整）

**定位**：生成的电子表格。**独立整页**（不在画布内）；画布内的批量用 Batch Node。

| 列 | 内容 |
|---|---|
| `#` | 行号 |
| `Prompt` | 唯一必填 |
| `Input` | 该行参考图（可选） |
| `Model` | 该行模型 |
| `Resolution` | 输出尺寸（模型支持时） |
| `Aspect ratio` | 输出形状 |
| `Output` | 生成结果 |

**核心能力**：
- **一行一图**，结果落在同一行
- **Add in bulk**：写一个 prompt 模板 + 插入**变量** + 列出选项 → 自动展开成几十行（"a product photo of a ceramic mug on a {background}…"）
- **列头批量改**：一次改整批的 model / resolution / aspect ratio
- **输入图**：可挂整批（≤4 张，引导每一行）或挂单行
- 生成前**显示成本预估**；一键跑全部
- 就地审阅：按状态过滤（All/Draft/Generating/Completed）、搜 prompt、表格/网格切换、单个或 zip 下载
- **自动保存**，无保存按钮；上限 `200 rows`
- 状态机：`Draft → Generating → Completed`

## 3.4 Director（★ 机制级确认，详见 `imagine-tools-deep-dive.md`）

- 全屏流式台，标题 `Director` + `New`，副标题 `Direct a previz stream.`
- 中央 `Set the scene` 输入卡：prompt 框（含 `tab` 补全提示）+ 麦克风
- 参数：**分辨率 `480p / 768p / 1080p 2x`**（分段控件）+ **比例 `16:9 / 9:16 / 1:1`**
- **首尾帧锚定**：`First frame` / `End frame` + `Audio`
- `▶ Start` 绿色按钮（live prompts 连续 previz 流）

## 3.5 Pose（★ 机制级确认，详见 `imagine-tools-deep-dive.md`）

- 双视窗：左 **3D 骨架编辑器**（色球关节：黄=头/骨盆、红=右肢、蓝=左肢），右**实时渲染流**
- 底部姿势预设：`Stand / T-pose / Wave / Walk / Run / Sit / Jump` + 镜像 + 视角复位
- 右检查器：
  - `CONDITIONING`：OpenPose 骨架叠在淡色 clay ghost 上（"pose from the true joints, plus soft volume cues"）
  - `MODEL`：`Freedom` 滑杆（μ 值，示例 1.73）——**姿势对生成的约束强度**
  - `Facing`：`Front / ¾ / Side / Back`
  - `Resolution`：`768 / 1024`
- 底部生成 dock：prompt + `tab` 补全 + 麦克风 + token 计数 + Stop
- **两个自动注入开关**：`Pose-aware template`、`Auto pose words`（勾选后 "Your prompt, expanded with the pose, appears here."）

## 3.6 Realtime（★ 机制级确认，详见 `imagine-tools-deep-dive.md`）

- 双视窗：左 `Camera`（输入摄像头）/ 右 `Restyled`（输出）
- 底部 prompt + `Mirror view` 勾选 + `▶ Play` 绿色按钮
- **计费语义**：`the stream bills while it runs` —— **按流时长计费**
- 状态：`Camera blocked` / `No camera available.`

## 3.7 画布节点族（官方文档，工具的基础设施）

| 节点 | 作用 | 关键点 |
|---|---|---|
| **Action Node** | 传统编辑工具（调色、裁切、抽帧、文本处理、音轨拆分合并） | 与生成节点同图，无需导出往返 |
| **Custom Actions** | **用自然语言描述 → FLORA 现场构建可用节点**（自带控件：滑杆/取色器/下拉） | "Describe the tool you wish existed" |
| **Batch Node** | 集合 → 同一工作流扇出处理 | 画布内版 "for each" 循环 |
| **Router Node** | 多入一出，再扇出 | 纯透传，不生成不转换；集中管理共享输入 |
| **Export Node** | 导出到本地/Google Drive，从 Drive 导入 | |
| **Layer Editor** | 多图合成单个分层构图 | |
| **Document Node** | PDF → 文本 / 图像 | |
| **3D Node** | text/image/3D → 3D（含 remesh/retexture/segment） | |

---

# 第四部分 · 对 open-ai-canvas 的可迁移点（待裁定）

1. **「预设场景 2.0」的完全体形态**：我们 O-03 预设场景 + 参数面板 2.0 左轨 = Flora「契约 + Run App 表单」的低配。差距在 **契约化（inputs/outputs schema）+ 可发布 + 可分享**
2. **工作流封装**：我们有画布节点图但缺「把一段图封装成命名应用」。关键机制 = `techniqueBlock`（技法可内嵌技法）+ `+ Build Technique`（从画布反建）+ 四步 builder
3. **输入分类学**（textToImage / imageToVideo / firstFrameLastFrame / mixedToVideo…）可直接作为生成任务的类型判定表
4. **代码节点 + 自带代码免费**的计费模式，对「用户自定义处理逻辑」有直接参考价值
5. **多模型单技法**：一次输入、多产物、不同产物绑不同模型（Nano Banana 2 出图 + Kling O1 出视频）——与我们的多渠道架构天然契合
6. **治理层**（审核流 / 可见性双轴 / 收藏 / 运行历史 / 运行转画布）——UGC 市场必备，我们完全空白
7. **Studios 形态**（策展工具集 + 无连线 + 结果 feed + 版本化工具）：比 Techniques 更轻的用户面，适合非专业用户；与我们的「预设场景」路线可并行考虑
8. **Batch Generate 的模板变量展开**（Add in bulk）与**列头批量改**，是我们批量出图痛点的直接解法

---

# 附：证据与复现

- 图 JSON：`graph-artwork-to-physical.json`（20 节点 / 13 边，运行态提取）
- 官方文档：`docs.flora.ai`（`llms.txt` 索引 / `llms-full.txt` 全量 384,872 chars / 页面 `.md` 版 / `?ask=` 问答接口）
- 前端逆向：148 chunks 静态扫描（关键词 `runTechnique` / `FLORA_FUNCTIONS_BY_ID` / `NodeTypes` / `techniqueListings` / `codeBlockDefinition`）+ React fiber `memoizedProps.nodes/edges`
- **证据分级**：架构/端点/schema/官方文档 = 一手实测；Director/Pose/Realtime = **bundle 逐字反解，机制级确认**（见 `imagine-tools-deep-dive.md`：端点 `fal-ai/flux-2/klein` / `minimax/h3-max/director` / `decart/lucy-2-5/realtime`，协议字段与计费公式全部读出）
- 待补：`run-technique` 请求体、credit 计算规则、technique 表完整 Convex schema、Examples/Quick Canvas 细节、Studios 是否只有 Fashion Studio
