# T03 · Run App 与 run-technique 执行链路

> 证据等级标注：**[逐字]** = bundle 中逐字抄录；**[推断]** = 由证据推理；**[未找到]** = 全语料检索无命中。
> 语料：/tmp/flora-chunks/*.js（137 个 Next.js turbopack chunk）。本文所有 chunk 名均在该目录下。

## 一、产品级摘要

### 1. Run App 是什么（推断 + 逐字混合证据）

Flora 的 App Mode（Run App）是「模板化运行」层：用户在 technique 详情页输入 → 以 technique 为单位运行 → 在 feed 里看输出 → 可转画布继续编辑。语料中未捕获 Run App 桌面主页面 chunk，但以下用户可见语义全部逐字可得：

| 用户可见能力 | 语义 | 来源 chunk |
|---|---|---|
| 技术运行历史 | 按天分组的 feed，搜索框按 `techniqueName` 过滤，分页 15 条/页，删除带确认对话框 | 0zuerjfqaw5ej.js (GenerationHistoryFeedView, MobileRunOutput) |
| 最近运行的技术 | 移动端抽屉 "Recent techniques"，显示旋转 loader（`hasActiveRun`）与绿点（`hasUnseenResults`） | 0zuerjfqaw5ej.js (MobileNavDrawerRecent) |
| 运行中占位 | pending/running 时对每个期望输出显示进度条或 "Generating..." | 0zuerjfqaw5ej.js (MobileRunOutput) |
| 输出交互 | 文本输出可 "Use as input"/复制；图片/视频/3D 可下载（单张 "Download"/批量 "Download all"）、"Re-run"（复用上次输入）、"Delete" | 0zuerjfqaw5ej.js, 1afs6viimnwzf.js |
| 输出反馈 | 👍/👎 按钮，投票后本地记忆（localStorage，上限 500 条），事件字段含 `technique_id/technique_run_id/output_id/generation_id/project_id/node_id` | 2x0fex7ap5m96.js (module 4196) |
| 在画布中编辑 | "Edit in project"：新开标签创建画布项目并携带 `?snapshot=&technique=&edit=1` | 2n-l3nic7n76j.js (useEditTechniqueInNewProject) |
| 3D 预览调度 | `claimAppModeModel3DViewer`/`releaseAppModeModel3DViewer`：同一时刻只有一个 slot 激活 3D viewer（悬停可抢占） | 1afs6viimnwzf.js (module 361229) |

### 2. 运行交互流程（用户可见语义）

```
technique 详情页
   │  选择 preset（或自由输入）
   ▼
[发起运行] ──► toast "Technique run started"（失败："Failed to start technique run"）
   │            埋点：appmode_run_started / appmode_preset_run_started（preset 路径单独埋点）
   ▼
乐观 UI：立即出现本地 run 记录（clientRunId 标识）
   status: pending ──► running（progress 0-100）──► completed（items 落地）
                                  └──► failed（errorCode+errorMessage）
   │
   ▼
[运行历史 feed]：按天分组、可搜索、可删除；完成后显示反馈按钮
   │
   ├─ Re-run：把该 run 的 inputs 原样再跑一次
   ├─ Download / Download all（zip）
   └─ Edit in project / Open in project：创建/打开画布项目继续编辑
```

### 3. Preset（Use preset）机制

Preset 是 technique 定义里预置的「示例输入组合」：

- 每个 technique 可带多个 preset（`presets` 数组），其中 `id === "default"` 的为默认（无则取第一个）。**[逐字]**
- 用户在画布/详情页给某个输入节点添加的示例值，会被抽取为 preset draft（`extractInputPresetDraftsFromGraph`），合并回 technique 图（`mergeInputPresetDraftsIntoGraph`），自动生成 `source:"inputChoice"` 的 preset。**[逐字]**
- 选择 preset 运行时走独立的埋点事件 `appmode_preset_run_started`（与 `appmode_run_started` 并列）。**[逐字]**
- 若某个 preset 的全部输入输出值与用户当前画布取值完全一致，`findMatchingTechniquePreset` 会判定「当前画布就是这个 preset」，可回显 preset 身份。**[逐字]**
- 项目创建侧存在 reason 枚举 `"direct" | "explicit_preset" | "explicit_starter" | ...`，即「从 preset 显式发起」是服务端记录的项目创建动因之一。**[逐字枚举，语义为推断]**

### 4. Credit 与运行结算（产品语义）

- Credit 按 workspace 归属扣除，UI 提示逐字为 "Credits are deducted from your active workspace"；账单页显示 "Estimated X · Charged Y"（报价 vs 实扣，pricing v3）。**[逐字]**
- 服务端错误码揭示两阶段结算：reserve（预留）→ spend（实扣）/ release（释放）。**[逐字错误码，流程顺序为推断]**
- 每个 generation 记录可关联 `techniqueRunId`，即 run 的花费由底层 generations 分摊记账。**[逐字 schema 字段]**

## 二、机制级附录

### A. `/api/workflow/run-technique` 端点与请求体

路由常量 **[逐字]**（chunk `245x6abtmz2ih.js`，module 344750，`appRoutes` 对象尾部）：

```js
workflow:{
  generate:"/api/workflow/generate",
  canvasBatchGenerate:"/api/workflow/canvas-batch/generate",
  generationTableGenerate:"/api/workflow/generation-table/generate",
  codeExecution:"/api/workflow/code-execution",
  preprocessElement:"/api/workflow/preprocess-element",
  runTechnique:"/api/workflow/run-technique"
}
```

**请求体：[未找到]**。`runTechnique` 字符串与 `.runTechnique` 成员访问在全语料仅此一处（路由定义），无任何调用方 chunk 捕获到该端点的 fetch/请求体。Run App 主页面 chunk 不在语料内。

同族端点的通用调用约定 **[逐字]**（`1hayrh3hp9xtt.js`，对 `generationTableGenerate`）：

```js
let t=await fetch(U.appRoutes.api.workflow.generationTableGenerate,{
  method:"POST",
  headers:await (0,O.createRequestHeaders)(),
  body:JSON.stringify({params:e})
});
if(401===t.status)return window.location.href=`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`,...
```

请求头 **[逐字]**（`3n5f4u_c2t1ed.js` module 598215 + 190100）：

```js
async function r(e=!0){return{"Content-Type":"application/json",...(0,t.activeProjectHeaders)()}}
// module 190100:
function(){return t?{"x-flora-project-id":t}:{}}   // setActiveProjectId 设置
```

**[推断]**：`/api/workflow/run-technique` 客户端调用大概率同为 `POST + JSON + {params:...}` 包裹 + `x-flora-project-id` 头，但请求体具体字段（techniqueId/snapshotId/inputs/…）无逐字证据，不可断言。

### B. appMode API 面（Convex 风格 `api.appMode.*`，客户端可见全集）

全语料枚举 **[逐字]**：

| 调用 | 形参（逐字调用点） | 返回中被使用的字段 | chunk |
|---|---|---|---|
| `appMode.queries.getWorkspaceRunHistory` | `{}`（usePaginatedQuery，`{initialNumItems:15}`） | results[]: `runId, techniqueName, techniquePreviewImageUrl, status, errorCode, errorMessage, progress, startedAt, completedAt, projectId, techniqueId` | 0zuerjfqaw5ej.js |
| `appMode.queries.getRunOutputs` | 乐观 id 时 `"skip"`，否则 `{runId}` | `{inputs:[{inputId,type,value}], outputs:[{generationId,assetId,title,imageUrl,videoUrl,audioUrl,model3dUrl,previewImageUrl,text}]}` | 2x0fex7ap5m96.js, 0zuerjfqaw5ej.js |
| `appMode.queries.getRecentlyRunTechniques` | `{limit:RECENT_TECHNIQUES_LIMIT}`（=20） | `techniqueId, techniqueName, slug, previewImageUrl, previewVideoUrl, hasActiveRun, hasUnseenResults` | 0zuerjfqaw5ej.js |
| `appMode.mutations.deleteRun` | `{runId}` | —（toast "Run deleted"） | 0zuerjfqaw5ej.js |
| `appMode.mutations.createTechniqueCanvasProject` | `{techniqueName}` | `{projectId}` | 2n-l3nic7n76j.js |
| `techniques.publicQueries.getTechniqueRunCounts` | `{techniqueDefinitionIds}` | 每个定义的运行计数 | 1mrn9kx6teaj4.js, 3jqi80vqxl126.js |

**`createTechniqueRunProject` / `ensureTechniqueProject` / `persistPresetRun`：[未找到]**（全语料 0 命中，含模糊词根 RunProject / ensureTechnique / persistPreset）。**[推断]**：要么位于未捕获的 Run App 主页面 chunk，要么实际名称不同；任务简报中的这三个名字无法从本语料证实。

### C. 运行状态机

枚举定义 **[逐字]**（`18_rcz_m_sgob.js` @3582）：

```js
"TECHNIQUE_RUN_STATUS",0,{PENDING:"pending",RUNNING:"running",COMPLETED:"completed",FAILED:"failed"}
```

乐观运行 store（zustand 风格）**[逐字]**（`2h7hcgawe62_1.js` @19400-22100，studio store 内）：

```js
optimisticTechniqueRuns:{},
trackOptimisticTechniqueRun(t){let i=t.clientRunId;i&&e(e=>{
  let n={...e.optimisticTechniqueRuns};
  for(let[e,i]of Object.entries(n)) i.instanceNodeId===t.instanceNodeId && i.status===s.TECHNIQUE_RUN_STATUS.FAILED && delete n[e];
  return n[i]=t,{optimisticTechniqueRuns:n}})},
setOptimisticTechniqueRunProgress(t,i){... n.status===TECHNIQUE_RUN_STATUS.RUNNING && n.progress!==i ? {...,[t]:{...n,progress:i}} : e},
completeOptimisticTechniqueRun(t,i){... status:COMPLETED, progress:void 0, completedAt:Date.now(), items:i ...},
failOptimisticTechniqueRun(t,i){... status:FAILED, progress:void 0, errorCode:n.ERRORS.GENERATION.FAILED_TO_START, errorMessage:i, completedAt:Date.now() ...},
clearOptimisticTechniqueRun(t){... delete i[t] ...}
```

要点：乐观 run 以 `clientRunId` 为主键、携带 `instanceNodeId`；同 instance 的旧 FAILED 记录会被新 run 顶掉；进度只在 RUNNING 态可写。查询侧对乐观 id 短路 **[逐字]**（`2x0fex7ap5m96.js` useRunOutputData）：

```js
r=(0,o.isOptimisticId)(m)?"skip":{runId:m}
```

服务端生命周期（由错误码反推）**[逐字错误码 / 顺序推断]**（`2zk-27-g42vq3.js`）：

```
technique_not_found → technique_graph_cycle / technique_graph_stuck / technique_node_config_error
→ technique_element_resolution_failed
→ technique_reserve_credits_failed / technique_reservation_cost_exceeded / technique_override_pricing_failed
→ technique_mark_running_failed
→ technique_start_generations_failed
→ technique_fetch_generation_failed / technique_generation_not_found / technique_generation_status_update_failed
→ technique_no_outputs_produced / technique_generation_failed / technique_timeout
→ technique_complete_failed / technique_spend_credits_failed
   失败分支：technique_mark_failed_failed / technique_release_credits_failed / technique_fetch_run_failed
```

### D. 运行历史查询与分组

分页 feed **[逐字]**（`0zuerjfqaw5ej.js` GenerationHistoryFeedView）：

```js
let{results:b,status:j,loadMore:v}=(0,r.usePaginatedQuery)(d.api.appMode.queries.getWorkspaceRunHistory,t,l) // t={}, l={initialNumItems:15}
... "CanLoadMore"===j && v(15) ...   // status 值："LoadingFirstPage" | "LoadingMore" | "CanLoadMore"
await w({runId:e})                    // deleteRun mutation；toast "Run deleted"
```

按天分组 **[逐字]**（module 72237，同 chunk）：

```js
function(e,t=new Date){...let e=i.startedAt??i.completedAt??l, n=s(e)...}   // 日键 = startedAt 优先，回退 completedAt
dayLabel: isSameDay→"Today"；同年→"d MMM"；否则 "d MMM yyyy"
```

常量 **[逐字]**（`1afs6viimnwzf.js` module 730164）：

```js
"APP_MODE_RUN_HISTORY_LIMIT",0,100,
"RECENT_TECHNIQUES_LIMIT",0,20,
"SCROLL_PROXIMITY_THRESHOLD_PX",0,300,
"STARTING_COOLDOWN_MS",0,2e3,
"TOAST_MESSAGES",0,{UPLOAD_COMPLETE:"Upload complete",UPLOAD_FAILED:"Upload failed",
 UPLOAD_NO_URL:"Upload succeeded but no URL was returned",INVALID_FILE:"Invalid file",
 RUN_STARTED:"Technique run started",RUN_FAILED:"Failed to start technique run",
 EDIT_IN_PROJECT_FAILED:"Failed to open run in project"}
```

失败展示 **[逐字]**（`2x0fex7ap5m96.js`）：`p===TECHNIQUE_RUN_STATUS.FAILED ? getErrorDisplay(x,h,{surface:"technique"}) : null`。

### E. 运行转画布：三个 mutation 的差异

- **`createTechniqueCanvasProject` — [逐字]**（`2n-l3nic7n76j.js`，唯一可证的 run→canvas mutation）：

```js
h=(0,i.useMutation)(t.api.appMode.mutations.createTechniqueCanvasProject);
let{projectId:e}=await h({techniqueName:c}),                    // 入参仅 techniqueName
s=new URLSearchParams({
  [l.EDIT_IN_CANVAS_QUERY_PARAM_SNAPSHOT]:i.snapshotId,          // "snapshot"
  [l.EDIT_IN_CANVAS_QUERY_PARAM_TECHNIQUE]:t,                    // "technique"（techniqueDefinitionId）
  [l.EDIT_IN_CANVAS_QUERY_PARAM_EDIT]:"1"}),                     // "edit"
n=`${r.appRoutes.project(e)}?${s.toString()}`;
f=window.open("about:blank","_blank"); ... f.location.replace(n) // 先开空白页占位再重定向
```

  查询参数常量 **[逐字]**（同 chunk 引 module 10706）：`duplicateRun→"duplicateRun"`, `edit→"edit"`, `snapshot→"snapshot"`, `technique→"technique"`, `SEND_TO_CANVAS_QUERY_PARAM_ASSETS→"seedAssets"`, `SEND_TO_CANVAS_QUERY_PARAM_SHARES→"seedShares"`。
  即：**服务端只拿 name 建项目，画布侧凭 query 参数自行拉取 snapshot/technique 定义并进入编辑态**；另有 `duplicateRun=1`（从某 run 复制）与 `seedAssets/seedShares`（播种资产）两条并行入口。

- **`createTechniqueRunProject` / `ensureTechniqueProject`：[未找到]**（0 命中）。无法比较三者差异；**[推断]** 若存在，应分别对应「run→项目」「幂等 ensure」语义，但本语料不能证实其存在。

- 画布内的 run 承接 **[逐字]**（`440x_k-bktkm8.js` @129386）：techniqueBlock 节点数据形状

```js
n===s.NodeTypes.techniqueBlock ? {techniqueId:e.data.techniqueId, snapshotId:e.data.snapshotId,
  techniqueName:e.data.techniqueName, inputs:e.data.inputs, outputs:e.data.outputs,
  parameterOverrides:e.data.parameterOverrides, pendingTechniqueRunId:void 0,
  lastTechniqueRunId:void 0, shouldRun:!1} : null
```

  以及 output 节点归属同步 mutation **[逐字]**（`3ldpt1pk51grl.js` @89780）：画布删除节点后把幸存 output 节点 id 回报给 run：

```js
i({runId:o,outputNodeIds:u}).catch(t=>{r.warn("Failed to sync technique output node IDs after deletion",...)})
```

  项目枚举 **[逐字]**（`2ru825uhloavh.js`）：`ProjectOrigin` ∈ {CANVAS,APP,API,GENERATE,GENERATION_TABLE,MCP,EVAL,CHAT,VALIDATION}；`ProjectKind` ∈ {CANVAS,STUDIO,CHAT,GENERATE}。**[推断]** App Mode 建的项目 origin=APP。创建动因 validator **[逐字]**：`reason: union("direct","explicit_preset","explicit_starter","first_project_experiment","experiment_control","onboarding_triage")` + `seedId/experimentKey/experimentVariant`。

### F. Preset 数据结构与算法 **[逐字]**（`00d0pt9gjg7yi.js` module 76542 / 448072 区）

```js
"DEFAULT_PRESET_ID",0,"default"
"getDefaultTechniquePreset",0,function(e){return e.presets?.find(e=>e.id===l)??e.presets?.[0]}
// preset 值形态：{imageUrl?|videoUrl?|audioUrl?|model3dUrl?|text?, width?, height?, aspectRatio?, assetId?, previewImageUrl?}
"hasTechniquePresetValue",0,c            // 任一 media/text 字段 length>0
"getPresetValueStringForType",0,d        // e[type] 为非空 string 才返回
"isPresetableIOType",0,o                 // isCoreIOMediaType || TEXT || MODEL3D_URL
"MAX_PRESET_CHOICES_PER_INPUT",0,100,
"MAX_PRESET_SETS",0,4
```

匹配算法 `findMatchingTechniquePreset(graph, pickedValues)` **[逐字]**：拒绝条件——存在 unsupported 节点类型、output 的 sourceOutputId≠自身、picked 未覆盖全部非 optional 输入、technique 带 outputs；然后逐 preset 比对 outputs 全有值、picked 值逐一相等（MODEL3D 还比对 previewImageUrl）、且 preset 无多余非空输入。

draft 抽取/合并 **[逐字]**（module ~448072）：

```js
"extractInputPresetDraftsFromGraph"   // 画布 → {[canvasNodeId]: [{id, value}]}；仅收单个有值输入的 preset（source==="inputChoice" 或 IMAGE_URL）
"mergeInputPresetDraftsIntoGraph"     // 反向：preset id = `${inputDefinitionId}-${draftId}`（已带前缀则不重复）；media 附加 width/height/aspectRatio/assetId；model3d 附加 assetId/previewImageUrl
"seededOutputFromPresetValue"         // preset 值 → {type,value,metadata:{width,height,aspectRatio}} 种子输出
"getTechniquePresetInputs/Nodes/Outputs",0,function(e){return getDefaultTechniquePreset(e)?.inputs/nodes/outputs ?? {}}
```

**persistPresetRun：[未找到]**。preset 与 run 的持久化关联只能看到：埋点 `appmode_preset_run_started`（`245x6abtmz2ih.js`）与项目创建 reason `"explicit_preset"`（`2ru825uhloavh.js`）。

### G. Credit 记账与预估

- 余额读取 **[逐字]**（`0zuerjfqaw5ej.js` AppModeUserPopover）：`api.currentUser.queries.creditsForWorkspaces({workspaceIds})` → `getPricingV3ClientAvailableUsage(G[e.id]) ?? 0`；tooltip 逐字 "Credits are deducted from your active workspace"。
- 报价 vs 实扣 **[逐字]**（`0co13buln55xq.js`）：`` `Estimated ${a} · Charged ${r}` ``，其中 `a=formatUsageDollars(e.quotedAmountUsage)`、`r=formatUsageDollars(e.amountUsage)`；tooltip 含 `costBreakdown.tokenUsage{inputTokens,cacheReadTokens,cacheWriteTokens,outputTokens}` 与 `dominantBrain`。
- 记账流水 validator **[逐字]**（`2ru825uhloavh.js` @57132，字段节选）：

```js
{workspaceId:id("workspaces"), organizationId, userId,
 generationId?:id("generationHistory"), techniqueRunId?:id("techniqueRuns"),
 renderJobId?:id("videoEditorRenderJobs"), imagineSessionId?:id("imagineUsageSessions"),
 nodeId:string,
 amount:vLegacyCredits(), amountUsage?:vUsageCredits(), fixedAddOnUsageCredits?:vUsageCredits(),
 talentUsageCharges?:[], settleTechniqueTalentRoyalties?:boolean,
 amountFromFreePool:number, billingSystem?:union("legacy","v3"),
 amountIncluded?/amountPrepaid?/amountOverage?, quotedAmountUsage?, actualProviderCostUsd?,
 appliedRule?:{source:union("plan_default","workspace_override","experiment"),modelId,ruleSlug?,discountPercent},
 status:string, createdAt:number, expiresAt:number, ...}
```

- generationHistory 表字段 **[逐字]**（同 chunk @36400 节选）：`estimatedTime:b.v.number()`（必有）、`techniqueRunId?:b.v.id("techniqueRuns")`、`concurrencyManaged?`、`workflowRunId?`、`dedupeClaimedAt?`、`workspacePlan?`、`gatewayChargedUsage?/gatewayCatalogUsage?`、`pg_*`（Postgres 同步列）。
- **"~5 min / 580 credits" 具体预估文案：[未找到]**（`~5 min`、580 精确词均 0 命中）。**[推断]** 该 UI 若存在，`estimatedTime` 字段与端点 `estimatedTime` 选项（`1n2meeaqbzn9r.js`：`b[h.options.id]?.estimatedTime`）是其数据源；预估额（如 580）应由服务端按技术图报价，客户端语料无计算逻辑。

### H. 输出反馈埋点字段 **[逐字]**（`2x0fex7ap5m96.js` module 4196）

```js
let n="app-mode-output-feedback";                       // localStorage key
c={technique_id:y,technique_name:N,technique_run_id:k,output_id:w,output_node_id:C,
   output_type:I,generation_id:j,project_id:S,source:"app_mode_feed"}
// getVotedOutputs(): Set(JSON.parse(localStorage)); markOutputAsVoted(): 超过 500 条截断至最近 500
```

### I. Technique 图节点支持矩阵 **[逐字]**（`00d0pt9gjg7yi.js` module 746264）

```js
resultImageBlock/resultVideoBlock/resultTextBlock/resultAudioBlock/elementNode/codeBlock → "supported"
comment/group/ghost/virtualSourceNode → "ignored"
textLabel/notes/routerNode/techniqueBlock/inpaintImageBlock/outpaintImageBlock/
  layerEditorNode/videoEditorNode/deckNode/exportNode/webcamNode → "unsupported"
collectionNode → "fanout"      switchNode → "control"
// 另有 "prompt-capable"/"input-only" 两类（矩阵前段被截断，具体节点未捕获）
RESULT_NODE_TYPES / SUPPORTED_TECHNIQUE_NODE_TYPES / TECHNIQUE_GRAPH_NODE_TYPES 由该矩阵派生
```

## 三、证据与来源

### chunk 清单（本主题全部一手证据来源）

| chunk | 内容 |
|---|---|
| 245x6abtmz2ih.js | appRoutes 路由常量表（含 `runTechnique:"/api/workflow/run-technique"`）、providers 端点表、埋点事件名清单（appmode_run_started / appmode_preset_run_started 等） |
| 0zuerjfqaw5ej.js | GenerationHistoryFeedView、MobileRunOutput、MobileNavDrawerRecent、AppModeUserPopover、useEditTechniqueInNewProject 引用、deleteRun/getRecentlyRunTechniques 调用点 |
| 1afs6viimnwzf.js | module 730164 常量（APP_MODE_RUN_HISTORY_LIMIT 等、TOAST_MESSAGES）、AppModeModel3DPreview 与 viewer slot 调度 |
| 2x0fex7ap5m96.js | useRunOutputData（getRunOutputs + isOptimisticId 短路）、RunInputRow、OutputFeedbackOverlay（反馈埋点）、useAppModeElements |
| 2h7hcgawe62_1.js | 乐观 technique run store（track/progress/complete/fail/clear、clientRunId、TECHNIQUE_RUN_STATUS 引用） |
| 18_rcz_m_sgob.js | TECHNIQUE_RUN_STATUS 枚举定义、TECHNIQUE_VISIBILITY_VALUES |
| 2n-l3nic7n76j.js | useEditTechniqueInNewProject（createTechniqueCanvasProject 调用全文）、EDIT_IN_CANVAS/SEND_TO_CANVAS query 参数常量 |
| 00d0pt9gjg7yi.js | module 76542 preset 匹配/默认值、MAX_PRESET_* 限制、extract/merge/seededOutput、technique 图节点支持矩阵 |
| 2ru825uhloavh.js | 服务端 Convex validator：generationHistory 字段（estimatedTime、techniqueRunId）、credit 流水字段、ProjectOrigin/ProjectKind、项目创建 reason（explicit_preset） |
| 2zk-27-g42vq3.js | 服务端错误码目录（technique_* 全套、billing_*） |
| 440x_k-bktkm8.js | techniqueBlock 节点数据形状（pendingTechniqueRunId/lastTechniqueRunId/shouldRun）、storage mutation setter |
| 3ldpt1pk51grl.js | 画布 output 节点归属同步 `{runId,outputNodeIds}` mutation 调用点 |
| 1hayrh3hp9xtt.js | /api/workflow/* fetch 调用约定（POST+headers+{params}、401 跳转） |
| 3n5f4u_c2t1ed.js | createRequestHeaders 与 x-flora-project-id activeProjectHeaders |
| 1mrn9kx6teaj4.js / 3jqi80vqxl126.js | techniques.publicQueries.getTechniqueRunCounts 调用点 |
| 0co13buln55xq.js | "Estimated X · Charged Y"（quotedAmountUsage vs amountUsage） |
| 2kralpe5w898d.js | 任务状态文案（techniqueRun: Error/Done/N% complete/Running...） |

### 可复现命令

```bash
cd /tmp/flora-chunks
# 1) 路由常量与埋点事件
grep -l 'run-technique' *.js                      # → 245x6abtmz2ih.js
python3 - <<'EOF'
data=open('245x6abtmz2ih.js',encoding='utf-8',errors='replace').read()
print(data[53800:54100])   # runTechnique 路由行
EOF
# 2) appMode API 全集
grep -oh 'appMode\.\(mutations\|queries\)\.[a-zA-Z0-9_]*' *.js | sort -u
# 3) 状态机
grep -l 'TECHNIQUE_RUN_STATUS' *.js; python3 -c "d=open('18_rcz_m_sgob.js',errors='replace').read();i=d.find('TECHNIQUE_RUN_STATUS');print(d[i-30:i+120])"
# 4) 乐观 run store
python3 -c "d=open('2h7hcgawe62_1.js',errors='replace').read();print(d[19400:22100])"
# 5) preset 算法
python3 -c "d=open('00d0pt9gjg7yi.js',errors='replace').read();print(d[13200:16400]);print(d[133100:137200])"
# 6) 转画布 mutation
python3 -c "d=open('2n-l3nic7n76j.js',errors='replace').read();print(d[39000:41200])"
# 7) credit 流水 validator
python3 -c "d=open('2ru825uhloavh.js',errors='replace').read();print(d[56500:60200])"
# 8) 服务端错误码
python3 -c "d=open('2zk-27-g42vq3.js',errors='replace').read();import re;i=d.find('technique_generic_error');print(d[i-200:i+1400])"
```

### 缺口清单（诚实声明）

| 缺口 | 状态 | 说明 |
|---|---|---|
| `/api/workflow/run-technique` 请求体 | **未找到** | 路由常量存在，但语料内无调用方；请求体字段不可证实 |
| `createTechniqueRunProject` / `ensureTechniqueProject` | **未找到** | 全语料 0 命中；仅 `createTechniqueCanvasProject` 可证 |
| `persistPresetRun` | **未找到** | 仅可证 `appmode_preset_run_started` 埋点与 `explicit_preset` 项目 reason |
| "~5 min / 580 credits" 预估 | **未找到** | 具体数值/文案不在 bundle；数据源 `estimatedTime` 字段可证，计算在服务端 |
| Run App 桌面主页面 chunk | **未捕获** | 发起 run 的客户端入口（fetch/convex 调用、credits 校验 UI）随主页面 chunk 缺失 |
| techniqueRuns 表 validator | **未捕获** | 仅见 `b.v.id("techniqueRuns")` 引用；表结构在服务端，未随客户端 bundle 下发 |
