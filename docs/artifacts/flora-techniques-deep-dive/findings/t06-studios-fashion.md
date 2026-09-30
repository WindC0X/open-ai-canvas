# T06 · Studios 与 Fashion Studio（策展工具集）

> 证据等级标注：**[逐字]** = bundle 中逐字抄录；**[推断]** = 由证据推理；**[未找到]** = 全语料检索无命中。
> 语料：/tmp/flora-chunks/*.js（137 个 Next.js turbopack chunk，本地副本）。chunk 名均在该目录下。
> 检索纪律：10.7MB 大文件（3zqb624po1kk-.js 等）仅用 python3 正则窗口提取，未整读。

---

## 一、产品级摘要

### 1.1 Studios 是什么

Studios = FLORA 的「**策展工具集**」层：把一组面向特定行业工作流的 technique 工具打包成一个具名 Studio（带自己的 URL、项目类型、桌面三面板 UI）。语料证实两个 Studio：

| Studio | 状态 | 证据 |
|---|---|---|
| **Fashion Studio**（slug `fashion-studio`） | 正式上线（2026-08 发布活动），移动导航带硬编码 "New" 徽章 | [逐字] `0hrrv_zu9_682.js`（badge `bg-background-grass-3`/"New"）、`2vbd3ltw6fooi.js`（发布 splash） |
| **Film Studio**（slug `film-studio`） | Early access：`useFeatureFlagEnabled("film_studio")` 门控；tile 点击跳 `/productions` 而非 studio 工具页；tile 显示 "Early access" 徽章 | [逐字] `2h88vpjgltysp.js`、`3yc-y57ou8gwi.js`、`1qoler3c4z5br.js`（TOOL_REGISTRY film-studio 条目） |

注意区分：`PricingV3Plan.StudioPartner`（`00d0pt9gjg7yi.js`）是**计费 plan**，与 Studios 产品无关，仅同名。

### 1.2 Studios 注册表与仪表盘

```
/dashboard（Studios tab）
 ├─ Convex: api.studios.queries.listStudios({}) → studio[]（_id/name/description/thumbnailUrl/category）
 ├─ 页头 "Studios · {n} studios"，副标题计数埋点 studios_tab_viewed {studio_count}
 ├─ 右上 "Request a studio" → appRoutes.feedback.studio（tally 表单）
 └─ tile 点击 → 埋点 studio_selected {source:"dashboard_tile"}
       ├─ 菜单 "Open last edited project" → projects.queries.fetchLastEditedStudioProject({studioId}) → /projects/{id}
       └─ 菜单 "New project" → openNewProjectPage(..., ProjectKind.STUDIO, studio._id)
                                  → getNewStudioProjectHref: /new?projectKind=STUDIO&studioId={id}
```

- **slug 解析** [逐字]（`3yc-y57ou8gwi.js` module 123234）：`resolveStudioSlug = studio.slug ?? normalizeTechniqueSlug(studio.name) ?? studio._id`；`isFilmStudio = slug === "film-studio"`；`getStudioTileHref = isFilmStudio ? appRoutes.productions : appRoutes.studioOpen(slug)`。
- **tools 侧边栏聚合** [逐字]（`3yc-y57ou8gwi.js` eE 组件）：`listStudios({category:"fashion"})` 与本地 `TOOL_REGISTRY`（Bulk Generate / Film Studio / Director / Pose / Realtime / Focus）合并展示于 "Tools" hover 面板，共享 "Search tools" 输入。
- **Tools Dashboard** [逐字]（`0wqo-xbxn0uus.js`）：`[...studios.map(toToolCard), ...TOOL_REGISTRY]`，studio 卡 fallback 缩略图 `/fauna/visual-examples/fashion-photography-composition.png`，tag `["studio", category??"fashion"]`。

### 1.3 路由体系 [逐字]

`245x6abtmz2ih.js` appRoutes + `3jhgeds-e4yyh.js` 路由表：

```
/studios                 Studios 仪表盘
/studios/:studioSlug     studio 落地页
/studios/:studioSlug/try  try 页（guest 试用，见 1.7）
/studios/:studioSlug/open studio 工具页（三面板 UI）
/new?projectKind=STUDIO&studioId={id}   新建 studio 项目
/projects/{id}/{techniqueSlug}          studio 项目内按工具打开
```

### 1.4 Fashion Studio 工具管线（rail 分组）

工具栏 rail 的分组-工具映射 [逐字]（`0hrrv_zu9_682.js`，模块 745244 `h` 数组）。**这就是「工具清单」的直接一手证据**——每个条目 = name/shortName 别名 + technique route slug 前缀，运行时与可用 technique 列表匹配（`resolveStudioRailGroupedSections`，未匹配项全部追加进 showcase 组）：

| Rail 组 | 工具（names / slugBases） |
|---|---|
| **Concept** | prompt（`prompt`）；Sketch to Render（`sketch-to-render`）；Garment Extractor / extract（`garment-extractor`）；concept（`concept`） |
| **Refine** | Ghostform / ghost（`ghostform`）；Flatlay / flat lay（`flatlay`）；Garment Recolor / recolor（`garment-recolor`）；Fabric Swap（`fabric-swap`） |
| **Showcase** | Model Maker（`model-maker`）；Model Try-On / try on（`model-try-on`）；Garment Swap（`garment-swap`）；Photo Shoot / photoshoot（`photo-shoot`）；360 Garment Video（`360-garment-video`）；360 Model Video（`360-model-video`）；Multi-Angle Shoot（`multi-angle-shoot`） |

任务简报中「Sketch to Render / Garment Extractor / Garment Color Swap / 第四个」四工具对照：Sketch to Render 与 Garment Extractor 在 Concept 组；"Garment Color Swap" 对应 **Garment Recolor**（`garment-recolor`）；**第四个是 Fabric Swap**（refine 组，Ghostform/Flatlay 亦属 Refine）[逐字映射 + 名称对应为推断]。

**各工具输入输出与底层模型**：
- 工具运行时身份 = technique。每个工具输入输出由 technique definition 的 graph 定义（见 1.6 输入 schema；graph 结构属 T02/T04 主题）。[推断：由 rail 匹配机制与 `buildTechniqueProperties` 字段得出]
- **底层模型：未找到** 工具级固定 endpoint 映射。最接近的一手证据是 folia 智能路由 schema（`2ru825uhloavh.js`，详见附录 F）：`router:"folia-image"|"folia-video"`，image 路由 taskType 含 `text_fidelity / product_photography / material_fidelity / reference_edit / anatomy / background_change…`，且记录 `selectedTechnique:{definitionId, snapshotId, slug, name, chargedCost}`——即生成经由 folia 路由器选择端点并按 technique 计价。[逐字 schema；「工具→路由器」链路为推断]
- 发布 splash 的轮播 alt 文本可佐证工具能力 [逐字]（`2vbd3ltw6fooi.js`，media.flora.ai 图片 alt）："turning the utility jacket sketch into a photorealistic render"（Sketch to Render）、"recoloring the rendered utility jacket"（Recolor）、"applying a dark patterned fabric"（Fabric Swap）、"detailed 4K render"、"placing … on a model"（Photo Shoot）、"generating multiple model angles"（Multi-Angle）、"in multiple locations"（多场景）。

### 1.5 交互流程（三面板 UI）

```
┌─────────────┬──────────────────────────────┬───────────────┐
│ 左 rail      │  中部 Feed（按 run 分组）      │ 右 Details 面板 │
│ 工具轨+设置   │  视图: Rows/Grid/Filmstrip/   │ 选中结果详情    │
│ （输入/参数） │       Single (Shift+R/G/F/S) │ (I 切换显隐)    │
└─────────────┴──────────────────────────────┴───────────────┘
选工具 → 设输入(拖拽/上传/库/示例/feed_drag) → Generate
   ├─ 阻断原因: insufficient_credits | unpriceable_fanout | segmentation_pending | missing_input
   ├─ 乐观 run (clientRunId): pending→running(progress)→completed/failed
   └─ 结果进 feed → 打开/下载/删除/标记(marked)/建 Element/Open in Canvas
```

面板布局持久化 [逐字]（`2h7hcgawe62_1.js`，zustand persist `studio-storage` v2）：`sidebarWidth`（clamp .1–.6，默认 .4）、`panelWorkspaceWidth`（默认 `831/1920≈.4328`，clamp .17–.6；v1 的 `detailsPanelWidth` 在 migrate 中删除）。

### 1.6 集合（collections）输入 → 一次生成扇出多个

输入可声明 `cardinality:"collection"`（集合模式）与 `collectionSelectionMode:"single"|"multiple"`；选中多个集合项后一次 Generate 对每个 item 扇出一个 generation。机制证据链全部一手（附录 E/F）：

```
collectionNode (画布节点类型, 遍历语义 "fanout" [逐字] 00d0pt9gjg7yi.js)
   └─ collectionItems 表: {collectionNodeId, projectId, type:"node"|"upload"|"text-split",
                          sourceNodeId?, assetId?, textContent?, order?}          [逐字 2ru825uhloavh.js]
   └─ itemKey 格式: "node:{id}" | "upload:{id}" | "text-split:{id}"
      复合 key: "{armId}={itemKey}+{armId2}={itemKey2}"（双臂 A/B 交集）; "variation:{id}"  [逐字 440x_k-bktkm8.js]
   └─ 扇出落库: workflowRuns {targetNodeId, collectionNodeId?, generationBatchId, idempotencyKey,
                generations:[{generationId, workflowRunId, collectionItemKey, orderIndex}]}  [逐字 2ru825uhloavh.js]
   └─ generationHistory 每条带 collectionItemKey + generationBatchId + orderIndex            [逐字]
   └─ 定价侧: 生成阻断原因 UNPRICEABLE_FANOUT —— 扇出规模不可报价即阻断                       [逐字 0hrrv_zu9_682.js]
   └─ 埋点: studio_collection_item_toggled {item_key, enabled, enabled_item_count, total_item_count} [逐字]
```

### 1.7 访客与增长机制

- `/studios/:studioSlug/try` 路由存在（[逐字] `3jhgeds-e4yyh.js`）；事件 `studio_guest_try_viewed`、`studio_guest_signup_prompted`（[逐字] `245x6abtmz2ih.js`）→ 游客可试，生成前提示注册。[推断：文案语义]
- 发布 splash modal（in-product 广告）：`Introducing Fashion Studio` — "Our new Fashion Studio, purpose-built for fashion creatives to go from idea to render in one flow."，CTA "Try Fashion Studio Now" → `/studios/fashion-studio/open?fresh=1&utm_source=in_product&utm_medium=splash_modal&utm_campaign=fashion_studio_launch`；8 张 utility jacket 演示轮播 [逐字]（`2vbd3ltw6fooi.js`）。另有一套 splash **ad** 模块（CSS class `fashion-studio-splash-ad-module`，campaign `fashion_studio_launch_2026_08`，flag `fashion_studio_splash_ad`，claim 动作 `flagshipAds.actions.claimFlagshipAd` 返回 `{shouldShow}`，按 `userId:workspaceId:adId` 去重）。[逐字]
- Onboarding：users 表 `studioTourSeenAt`、`studioExplorationCreditClaimedAt`（探索 credit 一次性领取）[逐字]（`2ru825uhloavh.js`）；studio 内引导 tour 状态 `tourActive`/`tourMaskSelectionActive`（`2h7hcgawe62_1.js`）+ `studio_tour_*` 事件族（landing/step/run/artifacts_cleaned 等 13 个，`245x6abtmz2ih.js`）。

### 1.8 工具版本化（New version available / Update）

- **UI 文案「New version available」/「Update」按钮：未找到**（`grep -l 'New version\|new_version\|updateAvailable\|versionAvailable'` 全语料 0 命中，仅命中 Next.js 内部与 Convex querySet 无关代码）。
- 机制侧证据（一手，说明版本化以 snapshot 为原子）：
  - technique 全链路携带 `snapshotId`：listing `snapshotId`、drag item `snapshotId`、techniqueBlock 节点 `nodeData:{techniqueId, snapshotId?, …}` 固定快照、`getTechniqueBySnapshotId`、编辑跳转 URL 参数 `EDIT_IN_CANVAS_QUERY_PARAM_SNAPSHOT`（`2n-l3nic7n76j.js` `useEditTechniqueInNewProject`）。[逐字]
  - folia 路由记录 `catalogSource:"versioned"|"live"` + `catalogVersionId` + `selectedTechnique:{definitionId, snapshotId, slug, name, chargedCost}`。[逐字]
  - 治理面：`techniques.clientQueries.getSnapshotIdForLegacyTechniqueId`（旧 id→快照迁移，见 t01/t03）。[逐字，出自既有 T01 结论]
- **推断**：studio 工具运行时在选定 tool 时锁定 definition snapshot（保证 run 可复现）；服务端定义更新后生成新 snapshot，"New version available" 提示应基于「run 记录的 snapshotId ≠ 当前 listing 的 snapshotId」比较，但其 UI chunk 不在语料内。

### 1.9 Studio 工具与 technique 的关系（结论）

1. Studio 工具就是 technique：rail 用 `names/slugBases` 匹配 technique listing；analytics `buildTechniqueProperties` 上报 `technique_definition_id / snapshot_id / technique_name / tool_index / tool_count`。[逐字]
2. technique listing 额外带 `studioAccent`（studio 主题色）字段供 studio UI 着色。[逐字 `1mmwhx_zs_eu3.js`]
3. 项目打开 `/projects/{id}/{techniqueSlug}`：studio 项目内每个工具对应画布里的 techniqueBlock。[推断：与 T04 一致]
4. 工具 kind 解析 [逐字]（`0hrrv_zu9_682.js` `resolveStudioToolKind`）：slug 匹配 `["prompt"]` → `"prompt"`；匹配 `["concept-fbh71t","concept-svc0b6","concept-d4vy2w"]`（含 `-<数字>` 后缀变体）→ `"concept"`；name/shortName === "model maker" → `"model-maker"`。

---

## 二、机制级附录

### A. 路由常量 [逐字]（`245x6abtmz2ih.js` module 344750）

```js
studio: e=>`/studios/${e}`,
studioOpen: e=>`/studios/${e}/open`,
projectTechnique: (e,_)=>`/projects/${e}/${_}`,
technique: e=>`/techniques/${e}`,
techniqueDetails: e=>`/techniques/manage/${e}`,
newProject: "/new"
```
`3yc-y57ou8gwi.js`：
```js
function n(e){return e.slug ?? (0,i.normalizeTechniqueSlug)(e.name) ?? e._id}
function s(e){return "film-studio"===n(e)}
"getNewStudioProjectHref",0,function(e){let i=new URLSearchParams({projectKind:t.ProjectKind.STUDIO,studioId:e});return `${a.appRoutes.newProject}?${i.toString()}`}
"getStudioTileHref",0,function(e){return s(e)?a.appRoutes.productions:a.appRoutes.studioOpen(n(e))}
```

### B. Convex API 面（client 可见）[逐字]

| 调用 | 形参 | chunk |
|---|---|---|
| `api.studios.queries.listStudios` | `{}`（仪表盘）/ `{category:"fashion"}`（tools 面板） | 2h88vpjgltysp.js / 3yc-y57ou8gwi.js / 0wqo-xbxn0uus.js |
| `api.projects.queries.fetchLastEditedStudioProject` | `{studioId}` | 2h88vpjgltysp.js |
| `api.flagshipAds.actions.claimFlagshipAd` | （splash 广告认领） | 2vbd3ltw6fooi.js |

**studios 表字段**：表名 `studios` 存在（`projects.studioId: b.v.optional(b.v.id("studios"))`，[逐字] `2ru825uhloavh.js`）；**studios 表完整 schema：未找到**。从消费端反推的必有字段：`_id, name, description, thumbnailUrl, slug?, category`。[推断]
**projects 表 studio 相关字段** [逐字]（`2ru825uhloavh.js`）：
```js
projectKind: b.v.optional(union(CANVAS, STUDIO, CHAT, GENERATE)),
studioId: b.v.optional(b.v.id("studios")),
productionId: b.v.optional(b.v.id("productions")),
```

### C. rail 分组与 tool kind [逐字]（`0hrrv_zu9_682.js`）

```js
let r=["concept-fbh71t","concept-svc0b6","concept-d4vy2w"], l=["prompt"];
function c(e,t){for(let a of t){if(e===a)return!0;let t=`${a}-`;
  if(e.startsWith(t)&&/^\d+$/.test(e.slice(t.length)))return!0}return!1}
// resolveStudioToolKind: techniqueSlug 命中 l→"prompt"；命中 r→"concept"；name/shortName==="model maker"→"model-maker"
let h=[{id:"concept",label:"Concept",entries:[
    {names:["prompt"],slugBases:["prompt"]},
    {names:["sketch to render"],slugBases:["sketch-to-render"]},
    {names:["garment extractor","extract"],slugBases:["garment-extractor"]},
    {names:["concept"],slugBases:["concept"]}]},
  {id:"refine",label:"Refine",entries:[
    {names:["ghostform","ghost"],slugBases:["ghostform"]},
    {names:["flatlay","flat lay"],slugBases:["flatlay"]},
    {names:["garment recolor","recolor"],slugBases:["garment-recolor"]},
    {names:["fabric swap"],slugBases:["fabric-swap"]}]},
  {id:"showcase",label:"Showcase",entries:[
    {names:["model maker"],slugBases:["model-maker"]},
    {names:["model try-on","model try on","try on"],slugBases:["model-try-on"]},
    {names:["garment swap"],slugBases:["garment-swap"]},
    {names:["photo shoot","photoshoot"],slugBases:["photo-shoot"]},
    {names:["360 garment video","360 garment"],slugBases:["360-garment-video"]},
    {names:["360 model video","360 model"],slugBases:["360-model-video"]},
    {names:["multi-angle shoot","multi angle shoot","multi angle"],slugBases:["multi-angle-shoot"]}]}];
// resolveStudioRailGroupedSections: 按上表顺序各取第一个未消费的匹配工具；剩余工具全部 push 进 showcase 组
```
slug 变体匹配规则：`slug === base || slug.startsWith(base + "-") && 后缀全数字`（`p()` 函数内）。

### D. 工具输入 schema（studio tool input，Convex validator）[逐字]（`2ru825uhloavh.js`）

```js
tP = union(IMAGE_URL, VIDEO_URL, AUDIO_URL, TEXT, DOCUMENT_URL, MODEL3D_URL)   // CORE_IO
tO = {name?, thumbnailUrl?, images: string[], texts: string[], elementId?, managedProvider?: literal("impersonas")}
b.v.object({
  id: string, name: string, type: tP,
  cardinality: optional(union("single","collection")),
  collectionItemCount: optional(number),
  sourceOutputId: optional(string), collectionItemIndex: optional(number),
  nodeType: optional(string), codeOutputIndex: optional(number),
  elementId: optional(string), elementPreset: optional(tO), elementPresets: optional(array(tO)),
  description: optional(string), emptyStateText: optional(string),
  specifiedAspectRatio: optional(string), specifiedDuration: optional(number),
  editableParameterKeys: optional(string[]),
  propagateEditableParametersUpstream: optional(boolean),
  category: optional(string), optional: optional(boolean), allowMultiple: optional(boolean),
  collectionNodeId: optional(string),
  collectionItems: optional(array({key: string, label?: string, type: tP, previewUrl?: string})),
  collectionSelectionMode: optional(union("single","multiple")),
  controls: optional(union(
    {kind:"text"}, {kind:"color"},
    {kind:"select", options:[{label,value}]},
    {kind:"slider", options:[{label,value}], defaultValue?: string},
    {kind:"image"},
    {kind:"mask", sourceImageInputId: string},
    {kind:"element", category?: ELEMENT_CATEGORY}))
})
```
`managedProvider:"impersonas"` 也出现在 element 引用 schema：
```js
ef = {elementId: string, managedProvider?: literal("impersonas"), referenceId?: id("elementReferences"),
      elementName: string, parentNodeId: string, promptExtension: string, tag: string, imageOrdinal?: number}
```
[推断] impersonas 是元素（模特/材质等预设）的托管供应商；语义未在 bundle 中展开。

### E. 集合扇出数据结构 [逐字]

`2ru825uhloavh.js`：
```js
tx = union("node","upload","text-split")
collectionItems 表: {collectionNodeId: string, projectId: id("projects"), type: tx,
                     sourceNodeId?: string, assetId?: id("assets"), textContent?: string, order?: number}
ex = {generationId: id("generationHistory"), workflowRunId: string, collectionItemKey: string, orderIndex: number}
workflowRuns 表: {userId, workspaceId, projectId, targetNodeId: string,
                  collectionNodeId?: string, idempotencyKey: string, generationBatchId: string,
                  status: union("starting","started","failed"),
                  generations: array(ex), failureReason?: string, createdAt, updatedAt}
generationHistory 表（相关字段）: …techniqueRunId?: id("techniqueRuns"), collectionItemKey?: string,
                  generationBatchId?: string, orderIndex?: number …
```
`440x_k-bktkm8.js`（module 518909）：
```js
function o(e,t){switch(e){case"node":return`node:${t}`;
  case"upload":return`upload:${t}`; case"text-split":return`text-split:${t}`}}
function a(e,t,r,n){return e<=r?`${e}=${t}+${r}=${n}`:`${r}=${n}+${e}=${t}`}   // 复合 key（双臂）
"variationItemKey",0,function(e){return `variation:${e}`}
// isEnabledCollectionItemKey: 复合 key 按 '+'/'+' 拆分，全部臂的 key 均在启用集且无禁用臂才启用
```
`3ldpt1pk51grl.js`（module 196657）：
```js
buildCollectionGenerationResult(e,t,o,r,d): {
  collectionNodeId, sourceNodeIds(=target 的非 ghost 入边源),
  itemDescriptors: 按 orderedItemKeys 排序后剔除 disabledItemKeys 的描述符,
  propagatingParentId, hopsFromCollection }
descriptor = {type:"node",sourceNodeId} | {type:"upload",itemId,mediaUrl,modality} | {type:"text-split",itemId,textContent}
```
`00d0pt9gjg7yi.js`：
```js
[NodeTypes.collectionNode]:"fanout"   // technique 图遍历语义表
"isTechniqueFanoutNodeType",0,function(e){return e===n.NodeTypes.collectionNode}
```
`3ldpt1pk51grl.js`（ProjectContext mutations）：
`api.collectionItems.mutations.addCollectionItem / removeCollectionItemBySourceNode / removeAllCollectionItems`、`api.techniqueRuns.mutations.updateOutputNodeIds`、`api.generationHistory.mutations.createGeneration`。

### F. folia 路由 schema（生成走哪个模型）[逐字]（`2ru825uhloavh.js`）

```js
eN = {router: literal("folia-image"), routerVersion: union("4","5"),
      catalogSource?: union("versioned","live"), catalogVersionId?: string,
      candidates?: [{endpointId, endpointName, family, profileId, profileVersion}],
      policyVersion: string,
      method: union("multimodal_embedding","multimodal_llm","deterministic","fallback"),
      taskType: union("text_fidelity","product_photography","intimates","material_fidelity",
        "multi_ref_composition","prompt_adherence","reference_edit","spatial","anatomy",
        "background_change","exact_edit","general"),
      effort: union("low","medium","high"), confidence: number,
      confidenceKind: union("similarity_margin_uncalibrated","rule_margin_uncalibrated","not_applicable"),
      selectedEndpointId, selectedEndpointName, selectedProfileId?, selectedProfileVersion?,
      selectedFamily?, selectedTechnique?: {definitionId, snapshotId, slug, name, chargedCost},
      techniqueSkipReason?: string, classifierModel?, visualEvidenceCount?, reason,
      matchedSignals: string[], excludedCandidates: [{endpointId, reason}], promptFingerprint?,
      routingLatencyMs?, fallbackReason?}
eU = {router: literal("folia-video"), routerVersion: "1", method: union("multimodal_llm","fallback"),
      taskType: union("prompt_fidelity","subject_preservation","camera_direction",
        "multi_scene_consistency","text_motion_graphics","spatial_physics","vfx_integration",
        "audio_coherence","general"), effort: union("low","high"), …其余同构}
```

### G. 三面板 store（zustand persist `"studio-storage"` v2）[逐字]（`2h7hcgawe62_1.js`）

```js
{
  sidebarWidth:.4, sidebarCollapsed:false, panelWorkspaceWidth:831/1920,   // clamp .1-.6 / .17-.6
  feedDragMediaType:null,                    // feed 拖拽中的媒体类型
  studioInfoLoading, studioId, projectId, workspaceId, studioName,
  toolName, toolDescription, isAuthenticated, // setStudioInfo({...}) 一次写入
  studioEditorTrayVisible,                   // 编辑 tray 显隐
  segmentingInputs:{},                       // key=`${studioId}:${inputId}` → 分段(masks)进行中
  selectedMaskInputs:{}, pendingMaskApplies:{}, timedOutMaskInputs:{},
  optimisticPreviewImageUrl, optimisticTechniqueRuns:{},   // 见 T03（clientRunId/instanceNodeId/progress/items）
  optimisticFeedEdits:{},     // {clientId, editType, sourceGenerationId, generationId, feedItemId, previewUrl, status, retainPreview}
  sharedSettingsPicks:{},     // sharedSettingsPicks[tool][setting]=value
  uploadFingerprints:{},      // 去重: committed {sourceUrl,hash} / pending {id,status:"pending"|"ready"|"unavailable"}
  tourActive, tourMaskSelectionActive,
  // migrate: delete detailsPanelWidth; v<2 → panelWorkspaceWidth=831/1920
}
```

### H. Feed 视图 / run 级操作 / 结果操作

快捷键 [逐字]（`2ppxoie_3yzgq.js`，ShortcutId，category:"studio"）：

| id | 键 | label | description（逐字） |
|---|---|---|---|
| STUDIO_VIEW_ROWS | Shift+R | Rows | Runs stacked vertically, one scrolling row of results each |
| STUDIO_VIEW_GRID | Shift+G | Grid | Runs stacked vertically, results wrapping into a grid |
| STUDIO_VIEW_FILMSTRIP | Shift+F | Filmstrip | One horizontal reel of runs, newest first |
| STUDIO_VIEW_SINGLE | Shift+S | Single | One large result at a time, with a strip to browse the rest |
| STUDIO_TOGGLE_RIGHT_PANEL | I | Details | Show or hide the details panel |
| STUDIO_FILTER_MARKED | Shift+M | Show marked only | Show only marked results in the feed |

结果缩略图 URL helper [逐字]（`3e97v9t6pv1g4.js`）：
```js
STUDIO_FEED_IMAGE_FALLBACK_SIZE = 512
studioFeedImageVariantUrl(e,t) → humane sized {width: t?.width??512, height: t?.height??512}
studioSourceThumbnailVariantUrl(e,t) → {width: min(512, max(1, round(80*r/i))), height: 80}
```

枚举 [逐字]（`0hrrv_zu9_682.js`）：
```js
STUDIO_FEED_SCOPE = {RESULT:"result", RUN:"run", SELECTION:"selection", SOURCE_THUMBNAIL:"source_thumbnail"}
STUDIO_LIBRARY_IMPORT_SCOPE = {FEED:"feed"}
STUDIO_SELECTION_SOURCE = {INITIAL_AUTO:"initial_auto", RESTORED:"restored", USER_CLICK:"user_click"}
STUDIO_GENERATE_BLOCKED_REASON = {INSUFFICIENT_CREDITS:"insufficient_credits",
  UNPRICEABLE_FANOUT:"unpriceable_fanout", SEGMENTATION_PENDING:"segmentation_pending",
  MISSING_INPUT:"missing_input"}
STUDIO_CONTROL_KIND = {TEXT,IMAGE,ELEMENT,COLOR,SELECT,SLIDER,MASK,COLLECTION,VIDEO,AUDIO,GENERIC}
STUDIO_INPUT_SOURCE = {TYPED,UPLOAD,LIBRARY,EXAMPLE,REPLACE,CLEAR,ELEMENT_SELECT,
  COLOR_SELECT,OPTION_SELECT,FEED_DRAG,RECENT}
```
[推断] `SELECTION` scope + `feedDragMediaType` 表明 feed 支持多选/拖拽；**显式多选批量 UI chunk 未捕获**（批量操作 UI：未找到）。

### I. Analytics 事件与属性 [逐字]

事件名（`245x6abtmz2ih.js`，键名原文）：
```
studios_tab_viewed, studios_tab_clicked, studio_selected, studio_project_opened, studio_project_created,
studio_start_action_selected, studio_view_changed, studio_tool_picker_opened, studio_tool_activated,
studio_asset_sent_to_tool, studio_input_set, studio_setting_changed, studio_library_imported,
studio_generate_clicked, studio_guest_signup_prompted, studio_guest_try_viewed, studio_generate_blocked,
studio_run_started, studio_run_start_failed, studio_run_cancelled, studio_run_completed, studio_run_failed,
studio_feed_result_opened, studio_feed_downloaded, studio_feed_deleted, studio_feed_marked,
studio_feed_marked_filter_toggled, studio_feed_create_element_clicked, studio_collection_item_toggled,
studio_mask_segmentation_completed, studio_source_thumbnail_reused, studio_open_in_canvas_clicked,
studio_upload_started, studio_upload_completed, studio_upload_failed,
studio_edit_tool_activated, studio_edit_submitted, studio_edit_completed, studio_edit_cancelled, studio_edit_failed,
studio_share_started, studio_share_completed, studio_share_failed,
studio_tour_landing_viewed, studio_tour_landing_cta, studio_tour_started, studio_tour_ended, studio_tour_viewed,
studio_tour_step_viewed, studio_tour_step_advanced, studio_tour_step_back, studio_tour_run_started,
studio_tour_run_start_failed, studio_tour_run_failed, studio_tour_skipped, studio_tour_completed,
studio_tour_artifacts_cleaned, studio_feedback_clicked
```
属性构造器 [逐字]（`0hrrv_zu9_682.js`）：
```js
buildStudioBaseProperties(e) → {project_kind:"studio", studio_kind:e.studioKind??"fashion",
  studio_id:String(e.studioId)?, project_id:String(e.projectId)?, source?, is_authenticated?}
buildTechniqueProperties(e,t) → {technique_node_id, technique_definition_id, snapshot_id,
  technique_name, tool_index?, tool_count?}
buildStudioInputProperties(e) → {input_id, input_type, control_kind, input_source, is_optional,
  was_connected_before?}
buildStudioRailGroupProperties(e) → {rail_group}      // concept|refine|showcase
// captureStudioAssetSentToTool: + from_technique_name / to_technique_name / input_id / generation_id / asset_id
// captureStudioCollectionToggle → studio_collection_item_toggled {input_id,input_type,control_kind:"collection",
//   item_key, enabled, enabled_item_count, total_item_count}
```

### J. Fashion Studio 发布 splash [逐字]（`2vbd3ltw6fooi.js`）

```js
P = `${N.appRoutes.studioOpen("fashion-studio")}?fresh=1&utm_source=in_product&utm_medium=splash_modal&utm_campaign=fashion_studio_launch`
// 另一变体（splash ad 模块）:
P = `${N.appRoutes.studioOpen("fashion-studio")}?fresh=1&utm_source=in_product&utm_medium=splash_ad&utm_campaign=fashion_studio_launch_2026_08`
s = "fashion_studio_launch_2026_08"; localStorage 去重键 `fashion_studio_launch_2026_08`（splash ad 变体）
A = useFeatureFlagEnabled("fashion_studio_splash_ad")
claimFlagshipAd → {shouldShow}；Map 缓存键 `${userId}:${workspaceId}:${adId}`
事件: flagship_ad_viewed {ad_id, surface:"splash_modal"} / flagship_ad_cta_clicked {ad_id, cta_href, surface:"splash_modal"}
     / flagship_ad_dismissed {ad_id, dismiss_method, surface:"splash_modal"}（dismiss_method: "close_control"|"dialog"…）
轮播: 8 张 media.flora.ai/mcp-uploads/2026/8/14/...jpg，alt 见 1.4 节（utility jacket 全流程演示）
文案: DialogTitle "Introducing Fashion Studio"; DialogDescription "Our new Fashion Studio, purpose-built for
     fashion creatives to go from idea to render in one flow."; CTA "Try Fashion Studio Now"; "Close"
门控: useCurrentAccess + PERMISSION.CREATE_PROJECT + isSignedIn
CSS 模块: fashion-studio-splash-ad-module__…{fashion-studio-progress, progressIndicator}
```
移动导航入口 [逐字]（`0hrrv_zu9_682.js`）：`O = k.appRoutes.studioOpen("fashion-studio")`，label "Fashion Studio"，badge `"New"`（`bg-background-grass-3 … text-grass-11`），点击埋点 `studio_selected {source:"mobile_navigation"}`。

### K. 版本化相关证据（补 1.8）

- technique listing/definition 消费端统一形态 [逐字]（`3jqi80vqxl126.js`）：
```js
function c(e){return {...e, listing:e.listing, reviewStatus:e.reviewStatus ?? ("number"==typeof e.publishedAt?"published":void 0)}}
function d(e){return {...e, listing:e.listing, reviewStatus:e.reviewStatus, definition:e.definition}}
// getVisibleTechniques + getPersonalizedTechniqueDelta 合并；getTechniqueBySnapshotId(snapshotId)
```
- techniqueBlock 节点固定快照 [逐字]（`2kralpe5w898d.js`）：`nodeData:{techniqueId, ...e.snapshotId?{snapshotId:e.snapshotId}:{}, techniqueName, techniqueShortName?, techniqueIcon?, inputs, outputs, label}`。
- 编辑跳转 [逐字]（`2n-l3nic7n76j.js`）：`?{SNAPSHOT}={snapshotId}&{TECHNIQUE}={techniqueId}&{EDIT}="1"`；快照缺失时报错 "Technique definition not found"。
- 路由记录 catalog 版本双轨 [逐字]：见附录 F `catalogSource:"versioned"|"live"`。

### L. 明确未找到清单（检索均全语料 0 命中）

| 项 | 检索命令（可复现） |
|---|---|
| "New version available"/"Update" 工具升级 UI | `grep -rl 'New version\|new_version\|updateAvailable\|versionAvailable\|hasNewVersion\|isOutdated' *.js` |
| 工具级固定模型 endpoint 映射 | `grep -rl 'garment\|sketch-to-render\|ghostform\|flatlay' *.js`（仅 0hrrv 分组与示例文案命中） |
| studio 工具页主组件（rail+feed+details 渲染树） | `grep -rl 'STUDIO_VIEW_ROWS\|Runs stacked\|details panel' *.js`（仅快捷键定义命中；页面 chunk 动态加载未在语料内） |
| feed 多选批量操作 UI | `grep -rl 'multiSelect\|bulkSelect\|selectionMode' *.js`（仅 input schema 的 collectionSelectionMode 命中） |
| studios 表完整 Convex schema | `grep -o 'id("studios")' *.js`（仅外键引用） |
| `/api/workflow/run-technique` 请求体 | 同 T03 结论：仅路由常量，无调用方 chunk |

---

## 三、证据与来源（chunk 清单 + 可复现命令）

### 主力 chunk

| chunk | 大小 | 内容 |
|---|---|---|
| `0hrrv_zu9_682.js` | 34.6KB | ★ rail 分组 h 数组、resolveStudioToolKind、STUDIO_* 全部枚举、buildStudio* analytics、MobileNavDrawer（Fashion Studio 入口+New 徽章）、ChatHistoryList（"Open in Canvas View"） |
| `2vbd3ltw6fooi.js` | 95KB | ★ 发布 splash modal + splash ad 模块（campaign/flag/claim/事件/轮播/CSS 模块名） |
| `2h7hcgawe62_1.js` | 26.8KB | ★ studio-storage store 全文（三面板布局/乐观 run/feed 编辑/masks/上传指纹/tour） |
| `2ru825uhloavh.js` | 98.3KB | ★ Convex validator：projects(projectKind/studioId)、collectionItems、workflowRuns、generationHistory、tool input schema、element schema、folia 路由 schema、users(studioTourSeenAt/studioExplorationCreditClaimedAt)、technique 分类枚举 |
| `3yc-y57ou8gwi.js` | 126KB | resolveStudioSlug/getStudioTileHref/isFilmStudio/getNewStudioProjectHref、Tools hover 面板、feature flag 集 |
| `2h88vpjgltysp.js` | 7.7KB | ★ StudiosDashboardPage 全文（listStudios/tile/菜单/film_studio flag/Early access） |
| `0wqo-xbxn0uus.js` | 9.1KB | ToolsDashboardPage（studio 卡映射 + listStudios({category:"fashion"})） |
| `1qoler3c4z5br.js` | 98.5KB | TOOL_REGISTRY（Film Studio 条目 + availability 过滤）+ useAvailableTools flag 逻辑 |
| `440x_k-bktkm8.js` | 348KB | collectionItemKey 工具集（key 格式/复合 key/启用判定） |
| `3ldpt1pk51grl.js` | 117KB | buildCollectionGenerationResult、ProjectContext 的 collectionItems/techniqueRuns mutations |
| `2ppxoie_3yzgq.js` | 30.1KB | ★ ShortcutId（studio 视图/详情/marked 快捷键 + 逐字描述） |
| `245x6abtmz2ih.js` | 54.4KB | appRoutes（studio/studioOpen）+ studio_* 事件全集 |
| `2kralpe5w898d.js` | 37.8KB | drag→techniqueBlock 节点数据（snapshotId 固定） |
| `3jqi80vqxl126.js` | 6.8KB | TechniquesProvider（listing/definition/snapshotId 消费端） |
| `3e97v9t6pv1g4.js` | 28.6KB | studioFeedImageVariantUrl/SourceThumbnail 缩略图 URL |
| `3jhgeds-e4yyh.js` | 130KB | 路由表 `/studios/:studioSlug`、`/studios/:studioSlug/try` |
| `00d0pt9gjg7yi.js` | 137.9KB | collectionNode="fanout" 遍历语义、PricingV3Plan.StudioPartner（区分同名） |
| `1nszrujos267j.js` | 26.3KB | onboarding use case（garment-silhouette 等 fashion 向选项） |
| `0hrrv_zu9_682.js` 之外的大文件 | 10.7MB | `3zqb624po1kk-.js`：无 fashion/garment studio 命中（仅 prompt 指南示例文案） |

### 可复现命令

```bash
# 定位
grep -l 'fashion-studio\|Fashion Studio' /tmp/flora-chunks/*.js
grep -l 'studios.queries\|listStudios' /tmp/flora-chunks/*.js
grep -l 'STUDIO_VIEW_ROWS\|Runs stacked' /tmp/flora-chunks/*.js
grep -rl 'collectionItemKey' /tmp/flora-chunks/*.js
# 窗口提取（大文件安全）
python3 - <<'EOF'
import re
s=open('/tmp/flora-chunks/0hrrv_zu9_682.js').read()
i=s.find('let h=[{id:"concept"');print(s[i:i+1200])
EOF
# 负验证（版本化 UI 文案）
grep -rl 'New version\|new_version\|updateAvailable\|versionAvailable\|hasNewVersion\|isOutdated' /tmp/flora-chunks/*.js
# studios 外键
grep -o 'id("studios")' /tmp/flora-chunks/*.js
```

### 证据等级小结

- 一手逐字：路由、studios API 调用面、rail 13 工具分组、tool input schema、collection key/扇出表、studio store、快捷键、事件全集、splash campaign、Folia 路由 schema、flag 机制。
- 推断：工具=technique 的运行时绑定方式、"Garment Color Swap"=garment-recolor 的产品名对应、版本化比较逻辑、impersonas 供应商语义、SELECTION scope 的多选语义。
- 未找到：工具升级 "New version available/Update" UI 文案、工具级固定底层模型映射、studio 页面主渲染树、feed 多选批量 UI、studios 表完整 schema、run-technique 请求体。
