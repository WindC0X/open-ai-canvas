# Technique Builder（四步流程 + 审核发布治理）— FLORA 前端 bundle 逆向

> 语料：`/tmp/flora-chunks/*.js`（137 个 Next.js turbopack chunk）。所有「逐字」引用均从 chunk 原文抄录，混淆变量名保持原样。证据等级：**【一手逐字】**=bundle 原文；**【推断】**=基于 bundle 的分析；**【未找到】**=语料中确认缺失。

## 一、产品级摘要

### 1.1 能力清单

| 能力 | 前端表现 | 证据 |
|---|---|---|
| 四步 Builder 流程 | store `currentStep` 取值 `"inputs"\|"outputs"\|"workflow"\|"publish"`；默认 `currentStep:"inputs"` | 一手逐字 `0c6ddwvie1pby.js` |
| Intro 弹窗 | `isIntroModalOpen` / `openIntroModal` / `closeIntroModal`；用户偏好字段 `seenTechniqueBuilderIntroAt` | 一手逐字 `0c6ddwvie1pby.js`、`2ru825uhloavh.js` |
| 画布选点（点选输入/输出节点） | `toggleInputNode` / `toggleOutputNode` / `togglePromptInput` / `reorderInputs` / `reorderOutputs`；选中态由 `showInputSelections`、`showOutputSelections`、`showPromptSelections` 驱动 | 一手逐字 `0c6ddwvie1pby.js` |
| 输入/输出卡编辑 | `updateInputItem` / `updateOutputItem` / `removeInputNode` / `removeOutputNode`；名称上限 40 字符、描述上限 200 字符、名称非空校验 | 一手逐字 `0c6ddwvie1pby.js` |
| 输入预置（presets） | `addInputPreset` / `removeInputPreset` / `inputPresetsByNodeId`，上限 `MAX_PRESET_CHOICES_PER_INPUT` | 一手逐字 `0c6ddwvie1pby.js` |
| 发布草稿 | `updatePublishDraft`；字段 name/shortName/icon/studioAccent/description/category/tags/thumbnailUrl/thumbnailFit/visibility/appLinkAccess/open/submitToCommunityLibrary/adminEditMessage | 一手逐字 `0c6ddwvie1pby.js` |
| 发布/更新端点 | `/api/techniques/publish`、`/api/techniques/update` | 一手逐字 `245x6abtmz2ih.js` |
| 提交社区审核 | Convex `techniques.mutations.submitForReview`、`withdrawSubmission`；查询 `techniques.queries.getReviewStatus` | 一手逐字 `2n-l3nic7n76j.js`、`1mmwhx_zs_eu3.js` |
| 双轴可见性 | `setTechniqueListingVisibility`（listing + appLinkAccess + open）与 `setTechniqueWorkflowVisibility`（仅 open）分离 | 一手逐字 `2n-l3nic7n76j.js` |
| 删除/撤销 | `deleteTechnique` → toast「Technique deleted」带 Undo（10 秒）→ `undoDeleteTechnique` | 一手逐字 `2n-l3nic7n76j.js` |
| 从画布反建/编辑技法 | `useEditTechniqueInNewProject().editTechnique(id)` → `createTechniqueCanvasProject` → 新开项目带 `?snapshot=..&technique=..&edit=1` | 一手逐字 `2n-l3nic7n76j.js` |
| 发布成功态 | `publishSuccess` / `showPublishSuccess` / `setPublishSuccessAppLinkAccess` | 一手逐字 `0c6ddwvie1pby.js` |

### 1.2 四步流程（store 状态机视角）

```
enterBuilderMode({inputs?, promptInputs?, outputs?, entrySource, fitViewNodeIds})
        │
        ▼
┌─ step "inputs" ──── step "outputs" ──── step "workflow" ──── step "publish" ─┐
│  点选/编辑输入卡      点选/编辑输出卡      (只读画布·整图预览)    发布表单+提交社区      │
│  候选=无入边+有出边   候选=有产物+有入边   isWorkflowEditing      isPublishStep          │
│  +有产物+支持类型     +可从已选输入可达    isReadOnlyCanvas=false  preparedPublishGraph   │
└──────────────────────────────────────────────┬──────────────────────────────┘
                                               ▼
                          /api/techniques/publish（create 模式）
                          /api/techniques/update（edit 模式）
                                               ▼
                          publishSuccess + appLinkAccess 设置
```

- 步骤语义来自 `getTechniqueBuilderInteractionState`：`isPickingInputs=("inputs"===currentStep)`、`isPickingOutputs=("outputs")`、`isWorkflowEditing=("workflow")`、`isPublishStep=("publish")`；`isReadOnlyCanvas = isActive && !isPickingStep && !isWorkflowEditing`（**推断：即 "inputs"/"outputs"/"publish" 步骤中画布锁定，仅 "workflow" 步骤可编辑画布**）。
- 编辑态（edit mode）：`enterEditMode` 时 `currentStep = editContext?.recordsSource ? "inputs" : "workflow"`（**推断：从项目记录反建的编辑流程从 "inputs" 开始；否则从 "workflow" 开始**）。
- 创建态（create mode）：候选预选从入口传入（画布已选节点 + `fitViewNodeIds`）。

### 1.3 审核/治理生命周期

```
create ──publish──► 私有(visibility=null→workspace/private) ──setTechniqueListingVisibility──► 公开(unlisted/workspace/public)
     │                                   │
     │   submitForReview({definitionId})  │  （开关「Submit to the FLORA Community Library」）
     ▼                                   ▼
  reviewStatus="pending" ──团队QC──► "published"(进 Community Library) 或 "admin_edit_pending"(编辑需管理员复核)
     │                                   │
     │   withdrawSubmission({definitionId})                      │
     ▼                                                            ▼
  回到普通技法                                              owner 编辑被禁用（menu "Edit" disabled）
```

- 审核状态字面值（一手逐字）：`"pending"`、`"published"`、`"admin_edit_pending"`。
- `reviewStatus` 缺省推导：`reviewStatus: e.reviewStatus ?? ("number"==typeof e.publishedAt ? "published" : void 0)`（`1mrn9kx6teaj4.js` module 548585）。
- 社区提交文案（一手逐字）："The FLORA team selects a set of Techniques each month to feature in the Community Library. Submissions go through a thorough QC process and are reviewed for craft, originality, and usefulness — Techniques must run reliably to be considered, and not all submissions are accepted. If selected, your Technique will be discoverable to all FLORA users."

### 1.4 可见性双轴对比

| 轴 | Mutation | 参数（逐字） | 作用 |
|---|---|---|---|
| Listing 可见性 | `setTechniqueListingVisibility` | `{listingId, visibility, appLinkAccess, open, updatedAt:Date.now()}` | 技法在哪里可见（private/unlisted/workspace/public）+ app 链接访问范围 + 是否开放 |
| Workflow 可见性 | `setTechniqueWorkflowVisibility` | `{listingId, open, updatedAt:Date.now()}` | 仅「Allow others to view the workflow」开关 |
| 提交社区 | `submitForReview` | `{definitionId}` | 进入月度评选 |
| 撤回提交 | `withdrawSubmission` | `{definitionId}` | 撤回 pending / 移除已收录 |

- `TECHNIQUE_VISIBILITY_VALUES`（一手逐字）：`["private","unlisted","workspace","public"]`；UI 徽标映射：public→"Public"(Globe)、workspace→"Workspace"(Users)、unlisted→"Unlisted"(Link)、private→"Private"(Lock)。
- appLinkAccess 取值（zod，一手逐字）：`b.v.union(b.v.literal("inherit"),b.v.literal("public"))`。
- **推断**：listing 弹窗仅提供 `["workspace","private"]` 两档 + 社区公开态锁定；`unlisted`/`public` 由社区收录路径产生（见 §2.9 保存流逻辑）。

## 二、机制级附录（逐字抄录）

### 2.1 Builder store 初始状态与 draft 默认值

来源：`0c6ddwvie1pby.js`（module 690071/22827，`TechniqueBuilderProvider`）

```js
// 初始状态 E()
{builderEdgeIds:I,builderNodeIds:I,hasOutputCandidates:!1,currentStep:"inputs",draft:b(),editContext:null,editModeDirty:!1,editingTechniqueNodeId:null,editingTechniqueName:null,editingTechniqueSlug:null,entrySource:null,entryTrackingProperties:null,isExitConfirmOpen:!1,isIntroModalOpen:!1,mode:"create",pendingFitViewNodeIds:null,previewMode:"node",preparedPublishGraph:null,preparedPublishRawInputs:null,publishSuccess:null}

// draft 默认值 b()（B = DEFAULT_PUBLISH_DRAFT_VISIBILITY = null）
{inputs:[],inputsByNodeId:{},inputPresetsByNodeId:{},outputs:[],outputsByNodeId:{},promptInputs:[],promptInputsByNodeId:{},publish:{category:null,description:"",name:"",shortName:"",icon:"",studioAccent:void 0,tags:[],thumbnailUrl:"",thumbnailFit:"fit",visibility:B,appLinkAccess:"inherit",open:!1,submitToCommunityLibrary:!1,adminEditMessage:""}}
```

- `IO_DESCRIPTION_MAX_LENGTH = 200`；`IO_NAME_MAX_LENGTH = 40`；`areTechniqueBuilderIoItemsValid(e,t) = e.length>0 && e.every(e=>{let r=t[e];return void 0!==r && c(r.name)})`；`isTechniqueBuilderIoNameValid = c`（`c(e){return e.trim().length>0}`）；`truncateIoName = a`（`a(e){return e.slice(0,40)}`）。
- Store actions 全表（逐字节选）：`enterBuilderMode` / `openExitConfirm` / `closeExitConfirm` / `openIntroModal` / `closeIntroModal` / `enterEditMode` / `exitBuilderMode` / `showPublishSuccess` / `setPublishSuccessAppLinkAccess` / `closePublishSuccess` / `resetDraft` / `setCurrentStep` / `setPreviewMode` / `setPreparedPublishGraph(t,r)` / `reconcileDraftCanvasNodes` / `reconcileBuilderGraph` / `reconcileDraftEdgeValidity` / `toggleInputNode` / `togglePromptInput` / `reorderInputs` / `reorderPromptInputs` / `toggleOutputNode` / `updateInputItem` / `removeInputNode` / `addInputPreset` / `removeInputPreset` / `updatePromptItem` / `removePromptInput` / `updateOutputItem` / `removeOutputNode` / `updatePublishDraft` / `setHasOutputCandidates` / `setPendingFitViewNodeIds`。
- `setCurrentStep`: `e=>({currentStep:t,..."edit"===e.mode&&"workflow"!==t&&{editModeDirty:!0}})`（edit 模式下离开 workflow 步骤即标脏）。
- `enterBuilderMode` 逐字（节选）：
```js
enterBuilderMode:t=>{let r=t?Array.isArray(t)?{inputs:t}:t:{},n={...E(),entrySource:r.entrySource??null,entryTrackingProperties:r.entryTrackingProperties??null,isActive:!0,pendingFitViewNodeIds:r.fitViewNodeIds&&r.fitViewNodeIds.length>0?r.fitViewNodeIds:null},d=b();P(r.inputs,d.inputs,d.inputsByNodeId),P(r.promptInputs,d.promptInputs,d.promptInputsByNodeId),P(r.outputs,d.outputs,d.outputsByNodeId),e({...n,draft:d})}
```
- Selectors（module 690071 尾部逐字）：
```js
function f(e){return"edit"===e.mode&&!e.editContext?.recordsSource}   // selectHasTechniqueBuilderWorkflowStep
function h(e){return e.isActive&&"edit"===e.mode&&"workflow"===e.currentStep}
function m(e){return e.isActive&&"edit"===e.mode}
function y(e){return e.isActive&&"create"===e.mode}
function g(e){return e.isActive&&!h(e)}
```

### 2.2 输入候选判定 `isTechniqueBuilderInputCandidate`（module 788033，`0c6ddwvie1pby.js`）

```js
function f({edges:e,nodeId:t,nodeType:n,nodeOutput:d,nodes:u,traversalBarrierNodeIds:o,effectiveEdges:s,allowCollectionInput:a}){
  if(a&&(0,r.isTechniqueFanoutNodeType)(n)){let r=o??p(u);return(s??l(e,u,r)).some(e=>e.source===t)}
  if(c(n)||!(0,i.hasOutputContent)(d))return!1;
  let I=o??p(u),h=s??l(e,u,I),m=h.some(e=>e.target===t),y=h.some(e=>e.source===t);
  return!m&&y}
```
逐义翻译（一手逐字 + 直接读码）：
1. `allowCollectionInput && isFanoutNodeType(type)`（即 collectionNode）→ 只要**有出边**即候选；
2. 否则：`c(n)`（不支持类型，见 §2.4）或 `!hasOutputContent(nodeOutput)` → **排除**；
3. 否则：**无入边（`!m`）且 有出边（`y`）** → 候选。

辅助函数（同 module）：
```js
function p(e){return new Set(e.filter(e=>"string"==typeof e.type&&I(e.type)).map(e=>e.id))}   // traversal barrier 集合
function l(e,t,r){let n=0===r.size?e:e.filter(e=>!r.has(e.source)&&!r.has(e.target));return(0,d.collapseEdgesThroughRouters)(n,t)}  // getEffectiveEdges：剔除与 barrier 相连的边并穿越 router 折叠
```
`I = isTechniqueBuilderTraversalWallNodeType`：`!(!e||isRouterNodeType(e)) && isTechniqueBuilderTraversalBarrierNodeType(e)`。
`hasOutputContent(u)`（module 327717 逐字）：检查 `text/imageUrl/videoUrl/audioUrl/documentUrl/model3dUrl` 任一非空字符串。

### 2.3 输出候选判定 `isTechniqueBuilderOutputCandidate`（module 788033）

```js
function N({edges:e,nodeId:r,nodeType:d,nodeOutput:u,nodes:s,selectedInputNodeIds:a,traversalBarrierNodeIds:I,effectiveEdges:f}){
  if(c(d)||d===n.NodeTypes.codeBlock)return!1;
  if(u){let e=(0,o.getTechniqueOutputTypeFromOutput)(u);if(e&&t.UNSUPPORTED_TECHNIQUE_RESULT_IO_TYPES.has(e))return!1}
  let h=I??p(s),m=f??l(e,s,h),g=y(m,s.filter(e=>e.type===n.NodeTypes.switchNode).map(e=>e.id)).has(r);
  return!(!(0,i.hasOutputContent)(u)&&!g||m.some(e=>e.source===r||e.target===r)&&!m.some(e=>e.target===r))&&(!a||!(a.length>0)||!!y(m,a).has(r))&&!0}
```
逐义翻译：
1. unsupported 类型或 `codeBlock` → 排除；
2. 若 nodeOutput 解析出的 IO 类型 ∈ `UNSUPPORTED_TECHNIQUE_RESULT_IO_TYPES`（= document）→ 排除；
3. 必须：**有生成产物 或 可从某 switch 节点可达**（`g=y(m, switchNodes).has(r)`，`y`=反向可达闭包）；
4. 且 不满足「出现在任何边里但无入边」——即**孤立节点放过，只有出边的节点排除**（`m.some(e=>e.source===r||e.target===r)&&!m.some(e=>e.target===r)`）；
5. 若已选输入非空：节点必须**从已选输入反向可达**（`y(m,a).has(r)`）。

输出预计算 `precomputeOutputCandidates`（module 788033）：
```js
function P(e,t){let{nodes:r,edges:n,nodeOutputsMap:d}=e.getState(),{draft:i,setHasOutputCandidates:u}=t.getState();u(function({nodes:e,edges:t,nodeOutputsMap:r,selectedInputNodeIds:n}){let d=p(e),i=l(t,e,d);return e.some(u=>!!u.type&&N({edges:t,nodeId:u.id,nodeType:u.type,nodeOutput:r[u.id],nodes:e,selectedInputNodeIds:n,traversalBarrierNodeIds:d,effectiveEdges:i}))}({nodes:r,edges:n,nodeOutputsMap:d,selectedInputNodeIds:[...i.inputs,...i.promptInputs]}))}
```

补充：prompt 候选 `isTechniqueBuilderPromptCandidate`（module 788033，B）要求 `isTechniqueBuilderPromptCapableNodeType`，`textBlock` 且 `mode==="textToText"` 排除；`textBlock` 无入边时必须有产物；非 textBlock 节点若所有输入来源都是 textBlock 则排除。

### 2.4 节点类型能力表（module 746264，`00d0pt9gjg7yi.js`）—「受支持类型」权威定义

```js
let i={
  [n.NodeTypes.emptyImageBlock]:"prompt-capable",[n.NodeTypes.videoBlock]:"prompt-capable",[n.NodeTypes.textBlock]:"prompt-capable",[n.NodeTypes.audioBlock]:"prompt-capable",[n.NodeTypes.model3dNode]:"prompt-capable",
  [n.NodeTypes.documentNode]:"input-only",
  [n.NodeTypes.staticImageBlock]:"supported",[n.NodeTypes.staticAudioBlock]:"supported",[n.NodeTypes.staticVideoBlock]:"supported",[n.NodeTypes.resultImageBlock]:"supported",[n.NodeTypes.resultVideoBlock]:"supported",[n.NodeTypes.resultTextBlock]:"supported",[n.NodeTypes.resultAudioBlock]:"supported",[n.NodeTypes.elementNode]:"supported",[n.NodeTypes.codeBlock]:"supported",
  [n.NodeTypes.comment]:"ignored",[n.NodeTypes.group]:"ignored",[n.NodeTypes.ghost]:"ignored",[n.NodeTypes.virtualSourceNode]:"ignored",
  [n.NodeTypes.textLabel]:"unsupported",[n.NodeTypes.notes]:"unsupported",[n.NodeTypes.collectionNode]:"fanout",[n.NodeTypes.routerNode]:"unsupported",[n.NodeTypes.switchNode]:"control",[n.NodeTypes.techniqueBlock]:"unsupported",[n.NodeTypes.inpaintImageBlock]:"unsupported",[n.NodeTypes.outpaintImageBlock]:"unsupported",[n.NodeTypes.layerEditorNode]:"unsupported",[n.NodeTypes.videoEditorNode]:"unsupported",[n.NodeTypes.deckNode]:"unsupported",[n.NodeTypes.exportNode]:"unsupported",[n.NodeTypes.webcamNode]:"unsupported"}

// 派生集合
r = SUPPORTED_TECHNIQUE_NODE_TYPES  = {prompt-capable, supported, input-only}          // 含 documentNode/codeBlock/elementNode
a = TECHNIQUE_GRAPH_NODE_TYPES      = {prompt-capable, supported, input-only, fanout, control}
s = RESULT_NODE_TYPES               = {resultImageBlock,resultVideoBlock,resultTextBlock,resultAudioBlock}

isTechniqueBuilderPromptCapableNodeType : "prompt-capable"===i[e]
isTechniqueBuilderTraversalBarrierNodeType: "unsupported"===t||"ignored"===t            // group/comment/ghost/layerEditor… 皆是 traversal barrier
isTechniqueBuilderUnsupportedNodeType   : "unsupported"===t||"ignored"===t||"fanout"===t||"control"===t
isTechniqueFanoutNodeType               : e===n.NodeTypes.collectionNode
```
**注意**：`isTechniqueBuilderUnsupportedNodeType` 对候选判定的排除集合 = {textLabel, notes, routerNode, techniqueBlock, inpaint/outpaintImageBlock, layerEditorNode, videoEditorNode, deckNode, exportNode, webcamNode} ∪ {comment, group, ghost, virtualSourceNode} ∪ {collectionNode, switchNode}。即任务描述中的 "排除 group/comment/layerEditor/collection/technique" 全部命中，另有更多（见上表逐字）。

### 2.5 技法 IO 类型与「不支持产物类型」（module 305388，`00d0pt9gjg7yi.js`）

```js
let n={IMAGE_URL:t.CORE_IO.IMAGE_URL,VIDEO_URL:t.CORE_IO.VIDEO_URL,AUDIO_URL:t.CORE_IO.AUDIO_URL,TEXT:t.CORE_IO.TEXT,DOCUMENT_URL:t.CORE_IO.DOCUMENT_URL,MODEL3D_URL:t.CORE_IO.MODEL3D_URL},
    i=new Set([n.DOCUMENT_URL]);
e.s(["TECHNIQUE_IO",0,n,"UNSUPPORTED_TECHNIQUE_RESULT_IO_TYPES",0,i,"isTechniqueIOType",0,function(e){return Object.values(n).some(t=>t===e)}])
```
**推断**：document 类型可作为输入但不可作为技法输出（`UNSUPPORTED_TECHNIQUE_RESULT_IO_TYPES = {documentUrl}`）。

### 2.6 输入/输出卡 schema（zod，`2ru825uhloavh.js`）

```js
b.v.object({id:b.v.string(),name:b.v.string(),type:tP,cardinality:b.v.optional(b.v.union(b.v.literal("single"),b.v.literal("collection"))),collectionItemCount:b.v.optional(b.v.number()),sourceOutputId:b.v.optional(b.v.string()),collectionItemIndex:b.v.optional(b.v.number()),nodeType:b.v.optional(b.v.string()),codeOutputIndex:b.v.optional(b.v.number()),elementId:b.v.optional(b.v.string()),elementPreset:b.v.optional(tO),elementPresets:b.v.optional(b.v.array(tO)),description:b.v.optional(b.v.string()),emptyStateText:b.v.optional(b.v.string()),specifiedAspectRatio:b.v.optional(b.v.string()),specifiedDuration:b.v.optional(b.v.number()),editableParameterKeys:b.v.optional(b.v.array(b.v.string())),propagateEditableParametersUpstream:b.v.optional(b.v.boolean()),category:b.v.optional(b.v.string()),optional:b.v.optional(b.v.boolean()),allowMultiple:b.v.optional(b.v.boolean()),collectionNodeId:b.v.optional(b.v.string()),collectionItems:b.v.optional(b.v.array(b.v.object({key:b.v.string(),label:b.v.optional(b.v.string()),type:tP,previewUrl:b.v.optional(b.v.string())}))),collectionSelectionMode:b.v.optional(b.v.union(b.v.literal("single"),b.v.literal("multiple"))),controls:b.v.optional(b.v.union(b.v.object({kind:b.v.literal("text")}),b.v.object({kind:b.v.literal("color")}),b.v.object({kind:b.v.literal("select"),options:b.v.array(b.v.object({label:b.v.string(),value:b.v.string()}))}),b.v.object({kind:b.v.literal("slider"),options:b.v.array(b.v.object({label:b.v.string(),value:b.v.string()})),defaultValue:b.v.optional(b.v.string())}),b.v.object({kind:b.v.literal("image")}),b.v.object({kind:b.v.literal("mask"),sourceImageInputId:b.v.string()}),b.v.object({kind:b.v.literal("element"),category:b.v.optional(tL)})))})
// tP = 上述 6 个 CORE_IO 字面量 union；tO = {name?,thumbnailUrl?,images[],texts[],elementId?,managedProvider?: "impersonas"}
```
- 卡字段用户可见部分：`name`（必填，≤40 字符）、`description`（≤200 字符）、`optional`（是否可选）、`allowMultiple`（对应集合/多值）、`type`（6 种 CORE_IO）。
- **推断**：`optional`/`allowMultiple` 即「是否必需」语义的双字段（schema 层面），发布表单 UI 中的显式必填控件未在语料中捕获（见 §2.15 缺口）。
- 编辑态反建 inputsByNodeId 逐字（`0c6ddwvie1pby.js`）：
```js
n.inputsByNodeId[r]={id:t.id,description:t.description??"",name:a(t.name),sourceNodeId:r,cardinality:"collection",collectionNodeId:r,...t.collectionItemCount?{collectionItemCount:t.collectionItemCount}:{},..."single"===t.collectionSelectionMode?{collectionSelectionMode:t.collectionSelectionMode}:{}}
// collections 分支与普通分支尾部：
...（t.editableParameterKeys?.length??0)>0?{editableParameterKeys:t.editableParameterKeys}:{},...!1===t.propagateEditableParametersUpstream?{propagateEditableParametersUpstream:!1}:{},...t.category?{category:t.category}:{}
// controls 重建：
function(e,t){if(e){if("mask"===e.kind){let r=t.canvasNodeIdByGraphId[e.sourceImageInputId];return r?{kind:"mask",sourceImageNodeId:r}:void 0}if("select"===e.kind||"slider"===e.kind){let t=e.options.map(e=>({id:crypto.randomUUID(),...e}));return"select"===e.kind?{kind:"select",options:t}:{kind:"slider",options:t}}return e}}
```

### 2.7 发布草稿字段与「有改动」判定（`0c6ddwvie1pby.js`）

```js
function a(e){...return e.inputs.length>0||e.promptInputs.length>0||e.outputs.length>0||Object.keys(e.inputsByNodeId).length>0||Object.keys(e.promptInputsByNodeId).length>0||Object.keys(e.outputsByNodeId).length>0||(t=e).publish.name.trim().length>0||(t.publish.shortName?.trim().length??0)>0||(t.publish.icon?.trim().length??0)>0||void 0!==t.publish.studioAccent||t.publish.description.trim().length>0||null!==t.publish.category||t.publish.tags.length>0||t.publish.thumbnailUrl.trim().length>0||t.publish.visibility!==s.DEFAULT_PUBLISH_DRAFT_VISIBILITY||!0===t.publish.submitToCommunityLibrary}
```
发布草稿字段（初值逐字）：`category:null, description:"", name:"", shortName:"", icon:"", studioAccent:undefined, tags:[], thumbnailUrl:"", thumbnailFit:"fit", visibility:null, appLinkAccess:"inherit", open:false, submitToCommunityLibrary:false, adminEditMessage:""`。
**推断**：`adminEditMessage` 用于 edit 提交时向管理员附言（对应 `admin_edit_pending` 审核流）；其消费方（approve/reject）在服务端，前端语料未捕获。

发布端点（`245x6abtmz2ih.js` 逐字）：
```js
techniques:{publish:"/api/techniques/publish",update:"/api/techniques/update"}
```
同文件相邻路由含：`workflow:{...,runTechnique:"/api/workflow/run-technique"}`；docs 链接：`techniqueBuilder:"https://docs.flora.ai/nodes/technique-builder",techniqueBuilderInputs:"...#step-2-define-inputs",techniqueBuilderOutputs:"...#step-3-define-outputs"`（**推断：官方文档步骤编号 = Step1 Intro/Step2 Inputs/Step3 Outputs/Step4 Publish**）。

**未找到**：调用 `/api/techniques/publish` 的 fetch 代码与请求体构造（该 UI chunk 不在语料内；仅 store 中 `preparedPublishGraph {includedNodeIds, ignoredNodeIds}` / `setPreparedPublishGraph(graph, rawInputs)` 可见调用契约）。

### 2.8 prompt 合成输入（module 105565/580983，`0c6ddwvie1pby.js`）

发布时提示词节点被合成为虚拟输入（逐字节选）：
```js
let n="__prompt_input_"; function d(e){return`${n}${e}`}
// injectPromptInputNodes: 为每个 promptInput 创建
n.push({id:c,type:r.NodeTypes.textBlock,position:{x:(I?.position.x??0)-400,y:I?.position.y??0},data:{label:a.name}})
i.push({id:`__prompt_edge_${l}`,source:c,target:l})   // l = 目标节点 id
u[c]={text:h}                                          // h = 原 modelParameters.prompt
// 合成输入定义：
s[c]={id:g,name:m,type:"text",...a.description.trim()?{description:a.description.trim()}:{}}   // g=normalizeTechniqueIdentifier(name) 去重（-2/-3 后缀）
// 并清空目标节点 prompt：p[l]={...f,modelParameters:{...f.modelParameters,prompt:""}}
```
同 module：`TECHNIQUE_BUILDER_EDIT_EDGE_COLOR="var(--color-technique-builder-output)"`、`getAncestorNodeIds`（输出祖先闭包）、`getTechniqueBuilderEditCanvasNodeIds`。
**推断**：create 模式发布图 = `getAncestorNodeIds(outputs)`；edit 模式 = 编辑上下文节点 ∪ 预置 included 节点。

### 2.9 TechniqueAccessDialog（社区/可见性治理 UI）— `2n-l3nic7n76j.js` @33934–36400

组件签名与 mutations（逐字）：
```js
TechniqueAccessDialog:({open:e,onOpenChange:p,listingId:b,definitionId:g,currentVisibility:y,currentAppLinkAccess:v,currentWorkflowVisible:j,reviewStatus:N,slug:C,onSubmittedForReview:q,onRemovedFromCommunity:S})=>{
  let T="pending"===N, I="pending"===N||"published"===N,
      D=E(y),   // E(e){return"workspace"===N(e)?"workspace":"private"}
      [R,L]=useState(D), [P,M]=useState(v??"inherit"), [F,O]=useState(j), [U,V]=useState(I);
  W=useMutation(i.api.techniques.mutations.setTechniqueListingVisibility),
  G=useMutation(i.api.techniques.mutations.setTechniqueWorkflowVisibility),
  J=useMutation(i.api.techniques.mutations.submitForReview),
  K=useMutation(i.api.techniques.mutations.withdrawSubmission),
  X=useBooleanWorkspaceEntitlement(s.Entitlements.USE_PRIVATE_APP_MODE);
  ee="published"===N&&U;
  let A=["workspace","private"];
```
保存流程 en()（逐字，含条件分支）：
```js
en=async()=>{if(b){
  if(R===D&&F===j&&P===(v??"inherit")&&U===I)return void et();          // 无改动直接关
  if(I&&!U&&!T)return void H(!0);                                        // published 且关开关 → 打开移除确认弹窗（ea=确认路径）
  if(I&&!U&&T){if(!g)return;B(!0);try{await K({definitionId:g}),R!==D||F!==j||P!==(v??"inherit")?await ei(es(R)):await Z(),c.toast.success("Submission withdrawn"),et()}catch(t){...}finally{B(!1)}return}
  if(U&&!I){if(!g)return;B(!0);try{(R!==D||F!==j||P!==(v??"inherit"))&&await ei(es(R)),await J({definitionId:g}),await Z(),q?.(),et()}catch(t){...}finally{B(!1)}return}
  B(!0);try{
    if(I){ T?(await W({listingId:b,visibility:es(R),open:F,appLinkAccess:P,updatedAt:Date.now()}),await Z(),c.toast.success("Access updated"))
          :F!==j&&(await G({listingId:b,open:F,updatedAt:Date.now()}),await Z(),c.toast.success("Access updated"));
      et();return }
    await ei(es(R)),c.toast.success("Access updated"),et()   // 非 pending/published（普通 listing）走 listing mutation
  }...}}
// 保存 listing 的辅助 ei：
ei=async e=>{b&&(await W({listingId:b,visibility:e,appLinkAccess:P,open:F,updatedAt:Date.now()}),await Z())}
// 可见性保序 es：
es=e=>e===E(y)&&y&&"public"!==y?y:e
```
**推断（双轴差异的精确语义）**：
- 状态为 `pending` 时：改列表设置也走 `W`（listing visibility）+ 保留提交开关，App link 走 listing 的 `appLinkAccess`；
- 状态为 `published` 时：**只允许改 workflow 开关 `G`**（因为已进社区库公开）；listing 变了则先 `W`；关闭提交开关触发移除确认（`ea` → `ei`+`onRemovedFromCommunity`）；
- 一般状态（无 pending/published）：只调 `W`；
- `submitForReview` 调用后回调 `q`（`onSubmittedForReview`），`withdrawSubmission` 后 toast "Submission withdrawn"。
- UI 文案（逐字）："Change Technique access" / "Where should this Technique be listed?" / "App link access" / "Copy link" / "Submit to the FLORA Community Library" / "Workflow visibility" / "Allow others to view the workflow" / "If enabled, anyone with access to this Technique can view the workflow." / "This Technique is in the Community Library, so it's public and discoverable by everyone. Turn off Community submission below to change who can access it." / 确认按钮 "Saving..."→"Save" / toast "Access updated"、"Link copied"。

### 2.10 TechniqueCardContextMenu（管理菜单与审核态）— `1mmwhx_zs_eu3.js` @19415

```js
TechniqueCardContextMenu:({children,techniqueDefinitionId:a,slug:r,isOwner:n,isCreator:i,listingId:s,currentVisibility:l,currentAppLinkAccess:o,currentWorkflowVisible:c,onDelete:d,onEdit:u})=>{
  g=n&&looksLikeConvexId(a)?a:void 0,
  x=useQuery(S.api.techniques.queries.getReviewStatus,g?{definitionId:g}:"skip"),
  v=useMutation(S.api.techniques.mutations.withdrawSubmission),
  j=!!r, y=n&&!!s,
  N=(i??n)&&x?.status==="pending",
  T=(i??n)&&x?.status==="admin_edit_pending",
  C=n&&!!u;
  // 菜单构建（逐字顺序）：
  C&&u&&e.push({key:"edit",label:"Edit",onSelect:u,disabled:T}),
  j&&e.push({key:"open-as-app",label:"Open as app",onSelect:_}),
  y&&e.push({key:"change-access",label:"Change access",onSelect:O});
  N&&t.push({key:"withdraw",label:"Withdraw submission",onSelect:R,disabled:m,destructive:!0}),
  I&&d&&t.push({key:"delete",label:"Delete technique",onSelect:d,destructive:!0});
  // 撤回：await v({definitionId:g}) → toast.success("Submission withdrawn")；失败 "Failed to withdraw submission"
```
**逐字规则**：`Edit` 在 `admin_edit_pending` 时 disabled；`Change access` 需 owner+listing；`Withdraw submission` 需 (creator||owner)+status=pending。

### 2.11 删除/撤销（10 秒 Undo）— `2n-l3nic7n76j.js` @13513

```js
let v=useMutation(U.api.techniques.mutations.deleteTechnique), j=useMutation(U.api.techniques.mutations.undoDeleteTechnique);
async function S(){...let e=p.techniqueDefinitionId;
  try{await v({definitionId:e})}catch(t){...Q.toast.error(e);return}
  x(e,!0),m(),Q.toast.success("Technique deleted",{action:{label:"Undo",onClick:async()=>{try{await j({definitionId:e}),x(e,!1),m(),Q.toast.success("Technique restored")}...}}})}
```
删除确认弹窗 `DeleteTechniqueConfirmationDialog`（同 chunk 逐字）：
```js
({techniqueName:e,open:h,onOpenChange:f,onConfirm:m,description:x="You'll have 10 seconds to undo this action.",requireConfirmationText:p=!1})=>{...N=!p||y.trim().toLowerCase()===d ...}
let d="confirm";
// 文案：标题 ["Delete ",e,"?"]；确认输入 Label: 'Type "confirm" to confirm.'；按钮 Cancel / Delete（loading 时 Loader2）
```

### 2.12 从画布反建/编辑技法 — `useEditTechniqueInNewProject`（`2n-l3nic7n76j.js` @39672）

```js
useEditTechniqueInNewProject:()=>{...{getDefinition:u,getTechnique:d}=useTechniques(), h=useMutation(t.api.appMode.mutations.createTechniqueCanvasProject);
  editTechnique:useCallback(async t=>{if(e)return;let i=d(t),s=u(t),c=s?.name??i?.name;
    if(!c||!i?.snapshotId)return void n.toast.error("Technique definition not found");
    let f=window.open("about:blank","_blank"); ... f.opener=null;
    try{let{projectId:e}=await h({techniqueName:c}),
      s=new URLSearchParams({[l.EDIT_IN_CANVAS_QUERY_PARAM_SNAPSHOT]:i.snapshotId,[l.EDIT_IN_CANVAS_QUERY_PARAM_TECHNIQUE]:t,[l.EDIT_IN_CANVAS_QUERY_PARAM_EDIT]:"1"}),
      n=`${r.appRoutes.project(e)}?${s.toString()}`; f.location.replace(n)}...}},...
// resolveTechniqueRouteSlug(e){let t=o(e.slug)??o(e.listing?.slug)??o(e.techniqueId); if(!t)throw Error("Technique route slug could not be resolved"); return t}
```
Query 参数常量（module 10706 逐字）：`EDIT_IN_CANVAS_QUERY_PARAM_DUPLICATE_RUN:"duplicateRun"`、`EDIT_IN_CANVAS_QUERY_PARAM_EDIT:"edit"`、`EDIT_IN_CANVAS_QUERY_PARAM_SNAPSHOT:"snapshot"`、`EDIT_IN_CANVAS_QUERY_PARAM_TECHNIQUE:"technique"`、`SEND_TO_CANVAS_QUERY_PARAM_ASSETS:"seedAssets"`、`SEND_TO_CANVAS_QUERY_PARAM_SHARES:"seedShares"`。
**未找到**："Build Technique" 按钮字面文案（含大小写变体）在 137 个 chunk 中均不存在；入口条件（何时允许进入 builder）只在 store/教育文案中可见：`3yc-y57ou8gwi.js` 项目工具教育卡 "Project tools, together — Technique Builder, project chat, slides, agent connectors, and sharing now live here."（`targetSelector:'[data-canvas-education-target="project-tools"]'`）。**推断**：入口是画布工具栏 project-tools 菜单项，文案未在语料。

### 2.13 常量（module 423782，`18_rcz_m_sgob.js`）— 校验/分类/状态

```js
CATEGORY_DISPLAY_ORDER ["essentials","brandVisualDesign","productVisualization","marketingAds","videoAnimation","fashionApparelEditorial","contentPackaging","printFilmVfx","spaceArchitecture","funInspiration"]
MAX_TECHNIQUE_NODE_LABEL_LENGTH 200 ; MIN_RUN_COUNT_TO_DISPLAY 10
TECHNIQUE_CATEGORIES {essentials:"Essentials",brandVisualDesign:"Brand & Visual Design",productVisualization:"Product Visualization",marketingAds:"Marketing & Ads",videoAnimation:"Video & Animation",fashionApparelEditorial:"Fashion & Apparel Editorial",contentPackaging:"Content Packaging",printFilmVfx:"Film & VFX",spaceArchitecture:"Space & Architecture",funInspiration:"Fun & Inspiration"}
TECHNIQUE_GRAPH_ISSUE_CODES {MISSING_OUTPUT:"missing_output",DUPLICATE_ID:"duplicate_id",INVALID_EDGE_REFERENCE:"invalid_edge_reference",DISALLOWED_NODE_TYPE:"disallowed_node_type",MISSING_NODE_CONFIG:"missing_node_config",GRAPH_CYCLE:"graph_cycle",RUNTIME_MODE_MISMATCH:"runtime_mode_mismatch",LABEL_TOO_LONG:"label_too_long",DISALLOWED_INPUT_TYPE:"disallowed_input_type",DISALLOWED_OUTPUT_TYPE:"disallowed_output_type",UNSUPPORTED_BATCH_TEXT_SPLIT:"unsupported_batch_text_split",UNSUPPORTED_MULTIPLE_COLLECTION_INPUTS:"unsupported_multiple_collection_inputs",INVALID_INPUT_CONTROLS:"invalid_input_controls"}
TECHNIQUE_RUN_STATUS {PENDING:"pending",RUNNING:"running",COMPLETED:"completed",FAILED:"failed"}
TECHNIQUE_VISIBILITY_VALUES ["private","unlisted","workspace","public"]
computeActionsCount(e){let{nodes:a,outputs:i,edges:n}=e.graph;return a.filter(e=>t(e.id,n)&&!r(e)).length+i.length}
isStaticTextTechniqueNode(e){"textBlock"===e.type&&e.data?.staticText===!0}
```
`TECHNIQUE_GRAPH_ISSUE_CODES` **推断**：即服务端校验运行（`getLatestValidationRun`）的 issue 码枚举；**前端语料中无 `getLatestValidationRun` 引用**（见 §2.15）。

### 2.14 其他已捕获的技法库/运行细节

- 检索端点（`2n-l3nic7n76j.js` module 783195，逐字）：`fetch("/api/techniques/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:e,surface:i,...limit,...desiredOutputTypes,...availableInputTypes,...accessMode}),signal})`；默认 `debounceMs=250`；响应 `{results:array}`；失败文案 `Technique search failed with status ${status}`。
- 技法库列表 surface（`2n-l3nic7n76j.js` @13513 附近逐字）：`eo=["community","workspace","myTechniques","favorites"]`、`eu=["all","featured",...es.CATEGORY_DISPLAY_ORDER]`、`ed="category"`。
- 收藏：`techniques.mutations.addTechniqueToFavorites` / `removeTechniqueFromFavorites` / `queries.getFavoriteTechniqueListingIds`（`1mmwhx_zs_eu3.js`）。
- 缩略图：`TECHNIQUE_PREVIEW_SIZE {width:512,height:326}`、`TECHNIQUE_THUMBNAIL_SIZE {width:64,height:64}`、`getTechniqueThumbnailObjectFitClass("fit"→"object-contain" 否则 "object-cover")`（`1mrn9kx6teaj4.js` module 210178、`2n-l3nic7n76j.js` module 364627）。
- 拖拽数据：`createTechniqueDragItem({techniqueId,snapshotId?,techniqueName,techniqueShortName?,techniqueIcon?,techniqueStudioAccent?,inputs:n?.graph.inputs??e.inputItems??[],outputs:n?.graph.outputs??e.outputItems??[]})`（`1mmwhx_zs_eu3.js`）。
- fanout 祖先：`getTechniqueCollectionOutputFanout/ItemCount`、`findNearestFanout`、`isCollectionEmptiedBySelection`（`0c6ddwvie1pby.js` module 105565 尾部）。

### 2.15 未找到清单（缺口，明确记录）

| 目标 | 状态 | 说明 |
|---|---|---|
| `approveAdminEdit` / `rejectAdminEdit` / `getPendingAdminEdit` | **未找到** | 137 个 chunk 全量 grep 无命中；服务端 Convex 函数，未被前端调用（前端仅调用 `getReviewStatus` / `withdrawSubmission` / `submitForReview`） |
| `getLatestValidationRun` | **未找到** | 同上；但 issue 码枚举 `TECHNIQUE_GRAPH_ISSUE_CODES` 与运行状态 `TECHNIQUE_RUN_STATUS` 存在，推断其消费方为服务端+未捕获 chunk |
| "Build Technique" 按钮文案/触发组件 | **未找到** | 字面 grep（含大小写变体）无命中；仅 store `enterBuilderMode` 入口与教育文案；按钮在未捕获的 canvas chunk 中 |
| 四步 UI 面板（Intro 弹窗文案、IO 卡编辑器、Publish 表单渲染） | **未找到** | store 与 schema/常量齐全，但渲染组件所在 chunk 不在语料（逐字校验 DOM 无法给出） |
| `/api/techniques/publish` 请求体与响应处理 | **未找到** | 仅有路由定义与 store 侧 `preparedPublishGraph`/`preparedPublishRawInputs` 契约 |
| `submitForReview` 参数除 `{definitionId}` 外的服务端校验 | **未找到**（服务端） | 前端只传 `{definitionId}` |

## 三、证据与来源

### 3.1 chunk 清单

| chunk | 大小 | 贡献 |
|---|---|---|
| `0c6ddwvie1pby.js` | 25,009B | Builder store、候选判定 module 788033、校验常量 module 22827、prompt 合成 module 105565/580983、publish draft |
| `00d0pt9gjg7yi.js` | 137,937B | 节点类型能力表 module 746264、IO 类型 module 305388 |
| `2n-l3nic7n76j.js` | 47,550B | TechniqueAccessDialog、delete/undo、useEditTechniqueInNewProject、路由常量 module 10706、检索 hook、徽标 |
| `1mmwhx_zs_eu3.js` | 37,030B | TechniqueCardContextMenu、getReviewStatus、withdrawSubmission、favorites、缩略图/拖拽 |
| `18_rcz_m_sgob.js` | 26,443B | 常量 module 423782（分类/issue codes/可见性/运行状态） |
| `245x6abtmz2ih.js` | 54,374B | `/api/techniques/publish`、`/api/techniques/update` 路由、docsRoutes |
| `2ru825uhloavh.js` | 98,318B | IO zod schema、`seenTechniqueBuilderIntroAt` |
| `1mrn9kx6teaj4.js` / `3jqi80vqxl126.js` | 39,929B / 6,842B | TechniquesProvider、reviewStatus 推导、尺寸常量 |
| `3yc-y57ou8gwi.js` | 126,421B | project-tools 教育文案（Technique Builder 入口线索） |

### 3.2 可复现命令

```bash
# 定位
grep -l 'submitForReview' /tmp/flora-chunks/*.js                    # → 2n-l3nic7n76j.js
grep -l 'setTechniqueListingVisibility' /tmp/flora-chunks/*.js      # → 2n-l3nic7n76j.js
grep -l 'isTechniqueBuilderUnsupportedNodeType' /tmp/flora-chunks/*.js  # → 00d0pt9gjg7yi.js 0c6ddwvie1pby.js
grep -l 'TECHNIQUE_VISIBILITY_VALUES' /tmp/flora-chunks/*.js        # → 18_rcz_m_sgob.js 2n-l3nic7n76j.js 2ru825uhloavh.js
grep -o 'techniques\.mutations\.[a-zA-Z]*' /tmp/flora-chunks/*.js | sort -u
grep -o 'techniques\.queries\.[a-zA-Z]*' /tmp/flora-chunks/*.js | sort -u
grep -o '/api/techniques[a-zA-Z/]*' /tmp/flora-chunks/*.js | sort -u

# 定向提取（示例：候选判定函数）
python3 - <<'EOF'
import re
s=open('/tmp/flora-chunks/0c6ddwvie1pby.js',encoding='utf-8',errors='replace').read()
i=s.find('isTechniqueBuilderInputCandidate')
print(s[max(0,i-200):i+3000])
EOF
```

### 3.3 证据等级汇总

- **一手逐字**：本文所有代码块、字段名、字面值、toast 文案、UI copy、端点路径、mutation 名。
- **推断**（已显式标注）：四步语义映射（step key→用户步骤名）、document 不可作输出、create/edit 发布图构造、`adminEditMessage` 用途、入口按钮位置、Step 编号对应官方文档锚点。
- **未找到**：见 §2.15。
