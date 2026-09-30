# T07 · Bulk Generate（批量表格与变量展开）

> 语料：/tmp/flora-chunks/*.js（137 个 Next.js turbopack chunk）。
> 本文所有「逐字」片段均从 chunk 原文以 python 定向窗口摘录，未做改写；标注「推断」的结论为逆向推理，非逐字证据。
> 主要 chunk：`1hayrh3hp9xtt.js`（112KB，批量生成页 + Add in bulk 对话框，页面入口组件 `ar`，导出 `BatchGenerationGate`，debugId 05540d77）、`1qoler3c4z5br.js`（98KB，TOOL_REGISTRY 与 feature flag）、`245x6abtmz2ih.js`（54KB，路由表与埋点事件名）、`3yc-y57ou8gwi.js`（126KB，侧边栏接入 + `BATCH_TABLE_GENERATION_SURFACE`）、`14khmbpcundo7.js`（28KB，RunCostConfirmation）。

## 一、产品级摘要

### 1. 产品定位与入口

Bulk Generate 是 FLORA 的「批量表格生成」工具：一个独立页面（路由 `/batch-generate`，逐字见 `245x6abtmz2ih.js`：`batchGenerate:"/batch-generate"`），用户在电子表格式界面里填多行 Prompt（每行可选模型 / 分辨率 / 宽高比 / 输入图），一次运行全部行，并在原位对比结果。页面副标题逐字：「Fill a batch, generate every row, and compare the outputs in place. Saved automatically.」

产品级流程：

```
侧边栏/命令面板 "Bulk Generate" → /batch-generate
  └─ Batch 页（Convex 实时订阅 generationTables）
       ├─ Add row            → 单行追加（200 上限内）
       ├─ Add in bulk        → 模板变量对话框 → 笛卡尔积展开成 N 行
       ├─ 整批共享输入图（≤4）+ 行级输入图（≤4）
       ├─ 列头下拉整批改 Model / Resolution / Aspect ratio
       ├─ 状态过滤 + 搜索 + 表格/网格视图切换
       ├─ Generate → 成本确认弹窗 → run（generate / regenerate / retry_failed）
       └─ 结果：单图直下 / 多图 zip；网格视图缩略图墙；全屏查看器
```

### 2. 表格列结构（行字段）

列头逐字（`1hayrh3hp9xtt.js`，TableHead 序列）：

| 列 | 交互 | 说明（逐字/机制） |
|---|---|---|
| 选择框 | 行多选 + 全选 | LibraryListSelectButton |
| `#` | — | 行号 = `orderIndex+1` |
| `Prompt` | 文本编辑 | 草稿暂存，失焦/生成前持久化；上限 8000 字符 |
| `Input` | 行级上传/拖拽 | ≤4 张/行；可 @ 引用 |
| `Model` | 列头批量改 + 行内 Select | 改模型会把行参数重置为仅 prompt（见下） |
| `Resolution` | 同上 | 写入模型定义的 `resolutionParameterKey` |
| `Aspect ratio` | 同上 | 写 `modelParameters.aspect_ratio`；`auto` 值视为删除该键 |
| `Output` | 缩略图 / 进度 / 状态 | 完成→缩略图；生成中→`Generating` 或 `N%`；失败→标记 |
| 行操作 | 复制/删除/重新生成等 | sr-only 列头「Row actions」 |

### 3. 行状态机

存储态（Convex 行文档 + 最新 generation）经纯函数 `tl` 派生为 6 个显示态（逐字常量）：

```
tc={all:"All",draft:"Draft",generating:"Generating",complete:"Completed",failed:"Failed"}
```

| displayState | 触发条件（逐字逻辑） | canGenerate / canRegenerate |
|---|---|---|
| `generating`（乐观） | 第 4 参为 true（提交中的乐观覆盖） | false / false |
| `generating` | 输出存在且 `isGenerationAwaitingMedia(status)` | false / false，`stale` = 行更新晚于生成创建 |
| `complete` | `isGenerationStatusSuccess && mediaUrl` | stale 时可重生成 |
| `failed` | `isGenerationStatusFinalFailure || !mediaUrl` | 可重生成 |
| `ready` | 无输出且 prompt 非空且 ≤8000 | 可生成 |
| `invalid` | prompt 非空但超 8000（校验消息「Prompts are limited to 8,000 characters.」）或行级问题 | 不可 |
| `empty` | prompt 为空 | — |

过滤 Tab 文案逐字：`tu={all:"Every row in this batch",draft:"Rows that have not generated yet",generating:"Rows generating right now",complete:"Rows with a finished image",failed:"Rows whose generation failed"}`；failed Tab 仅在 `counts.failed>0` 时显示。

行级问题（`rowIssuesById`）三类逐字：`input-unavailable`（@ 引用图不再挂载 / 输入图资产不可用）、`model-unavailable`（「This model is unavailable. Choose another model.」）、`inputs-unsupported`（「This model doesn't support N input image(s).」）。

### 4. Add in bulk（模板变量展开）—— 交互

入口按钮组逐字：`{key:"row",label:"Add row",tooltip:"Add one empty row"}`、`{key:"bulk",label:"Add in bulk",tooltip:"Expand one prompt template into many rows"}`。200 行满时按钮禁用，tooltip 变为逐字「Batches hold up to 200 rows」；页脚计数逐字 `${i} of 200 rows`。

对话框（标题逐字「Add rows in bulk」，描述逐字「Insert text or image variables, add their values, and every combination becomes a row.」）：

1. **Prompt template**：contentEditable 富文本框，占位符逐字 `Describe the image, then insert variables for the parts that change`；两个插入按钮：「Text variable」（Braces 图标）与「Image variable」（ImageIcon）。
2. **变量**：模板中出现的每个 `{变量名}` 自动生成一张变量卡（文本变量卡 = 值列表 + "Type a value" 输入 + "Add value" 按钮；图片变量卡 = 多文件上传，tooltip 逐字「Upload one or more images; each image becomes a variable value」）。变量卡颜色按顺序循环 6 色逐字：blue / purple / amber / pink / orange / red。
3. **Copies**：无变量时显示数字输入（默认 "1"），按份数复制整条模板。
4. **Preview**：实时预览前 50 行（逐字 `limit:50`），超过显示逐字 `and N more`；每行把图片值渲染为内联小图+变量名。
5. **汇总条**：逐字 `k?M:0` + `row/rows`，多变量时显示组合式如 `(2 × 3)`（逐字 `N.map(e=>e.values.length).join(" × ")`）。

### 5. 变量语法与展开算法（产品语义）

- 占位符：`{变量名}`；正则逐字 `tR=/\{([^{}\r\n]+)\}/g`（花括号内不允许空花括号嵌套、不允许 CR/LF）。
- 变量名 = 花括号内 trim 后的文本；同文本同名，先出现者定 kind（text/image），可重排（名字相同即沿用）。
- 展开语义：**对每个变量取其值列表做笛卡尔积**，每个组合生成一行；无变量时按 Copies 数复制 N 行。
- 图片变量在生成的 prompt 文本里以内联引用 `@标签` 表示（逐字序列化 `` `@[${e.value.assetId}]` ``），同时该图的 assetId 挂到行的 `inputAssetIds`，`assetId→变量名` 映射挂到 `promptImageReferences`。
- 输入校验（错误文案逐字）：
  - 空模板 → `Enter a prompt template.`
  - 变量没值 → `Add at least one value for each variable.`
  - Copies 非正整数 → `Enter a whole number of copies.`
  - 展开后超过剩余行数 → `` `This would create more than the ${a} rows available.` ``
  - 展开后 prompt 超 8000 → `` `Each prompt must be ${8e3.toLocaleString()} characters or fewer.` ``
  - 模型不支持 → `The selected model doesn't support this batch's shared inputs.` / `The selected model doesn't support this many image variables alongside the shared inputs.`

### 6. 输入图挂载：整批 vs 单行

| 维度 | 整批共享（reference） | 单行 |
|---|---|---|
| 上限 | 4（逐字「Add up to 4 images. They guide every row in this batch.」；toast 逐字「Batches hold up to 4 input images」） | 4/行（逐字 `4-a.inputAssetIds.length`，超出提示 `Only ${l} more input image(s) fit in this row`） |
| 存储 | `generationTables.referenceAssetIds`（table 文档） | `row.inputAssetIds` |
| 写入端点 | `setGenerationTableReference {tableId, assetId, mode:"add"/"remove"}` | `updateGenerationTableRow {rowId, inputAssetIds}` |
| 变化传播 | 乐观更新时用 `t2` 重算每行 inputAssetIds（合并+去重+≥4 裁剪） | 直接写行 |
| 与变量图关系 | 共享图「stay attached but are not mentioned automatically」（逐字提示），即不写 `@` 引用 | 变量图同时写进 prompt 引用 |

整批加入时 toast 逐字：`1 row was skipped because it already has the maximum of 4 input images.`（复数版同理）。

### 7. 批量改列（一次改整批）

列头 `Model / Resolution / Aspect ratio` 是同一个下拉组件 `tf`：菜单标题逐字 `` `Set for ${u} selected row(s)` `` 或 `` `Set for all ${m} row(s)` ``（有选择行时只改选中行，否则改全部可见行）。三个 onApply 循环逐行调用 `updateGenerationTableRow`：

- **Model**：`L(t._id,{modelId:e,modelParameters:tt(t.modelParameters)})` —— `tt` 逐字 `return{prompt:e4(e)}`，即换模型会**丢弃该行除 prompt 外的全部参数**（推断：防止旧参数对不上新模型的 schema）。
- **Resolution**：把标签经 `e2`（大小写不敏感 label/value 匹配）映射为该模型 `resolutionOptions` 里的 value，经 `e9` 写入 `modelParameters[resolutionParameterKey]`（并删除遗留的 `resolution` / `image_size` 键）；选「Default」（内部值 e1）则删除该键。
- **Aspect ratio**：同理经 `te` 写/删 `aspect_ratio`；「Auto」= 删除键。逐字：`"string"==typeof t&&"auto"!==t.toLowerCase()` 才显示非默认值。

可选值计算（逐字 `e3`）：取所有目标行所选模型的 `resolutionOptions`/`aspectRatioOptions` 的**交集**，行间模型不同且无公共值时该列为空选项（`h?[]:e3(p,...)`）。行内模型不可用时选项逐字为 `[{value:er.modelId,label:"Unavailable model",disabled:!0}]`；prompt 超 8000 的行会把所有选项置禁用（`eq=eG.length>8e3`）。

### 8. 生成运行、成本确认与队列

- 估算 hook `t7`：按行查模型服务端点（`ee`，输入图数 0–4，超出返回 null），构造报价请求（`buildGatewayQuoteRequest` 或 `buildQuoteModelParameters`），`getPricingV3ClientGenerationCost` 得单价，按「报价 key」聚合成 `{count, catalogCredits, request?}` 数组，再经 `useGatewayQuotedTotal` 汇总出 `{usageCredits, isEstimate, isPending}`（字段名为使用处逐字 `tZ.usageCredits / tZ.isEstimate`）。
- 三个入口都走 `requestRunCostConfirmation`（`14khmbpcundo7.js`，逐字阈值）：
  - `usageCredits < 1e4` → 直接执行（kind:"none"）；
  - `≥1e4 且 <1e5` → soft 确认框 `Confirm run — $X.XX?`；
  - `≥1e5` → hard 确认框 `Confirm expensive run — $X.XX?`（带 AlertTriangle 图标）。
  - 金额换算 `calculatePricingV3UserDollarsFromUsageCredits`。source 逐字 `"batch_generation"`。
- 确认后调用运行 hook（G，见附录缺口）逐字参数：`{tableId, rowIds, requestId:crypto.randomUUID(), runAction, requestedUsageCreditsEstimate, usageCreditsEstimateIsApproximate}`；`runAction` 取值逐字 `generate` / `regenerate` / `retry_failed`。响应逐字 `{startedCount, skippedCount}`；0 行启动 → `No rows could be started. Check the row settings and try again.`；有跳过 → `N row(s) skipped because their settings or inputs became unavailable.`
- regenerate 前快照防竞态：确认时把行配置快照（`ta`：`_id/inputAssetIds/modelId/modelParameters`）与当前比较，不一致则报逐字 `Row settings changed. Review the batch and regenerate again.`；行还有未保存草稿时报 `Save the row changes before generating.`。
- 并发限制：`t6 = tj?.concurrentGenerationsAllowed === !0`；多行且无并发资格时改为打开定价弹窗 `openGenerationQueuePricing({source:"batch_generation"})`，按钮 tooltip 用常量 `PARALLEL_GENERATION_UPGRADE_TOOLTIP`。
- 底部汇总条逐字文案：`${h} of ${f} row(s) will generate.`；按钮 `Generate ${h}` / `Retry ${g} failed`；超限提示 `${b} row(s) have a prompt over the 8,000 character limit.`

### 9. 搜索 / 过滤 / 视图切换 / 下载

- **搜索**：仅匹配 prompt 文本（逐字 `e4(e.modelParameters).toLowerCase().includes(l)`），输入即清空选择。
- **视图**：`view: "row" | "grid"`（逐字 `("row"===e||"grid"===e)&&N(e)`）；网格 = 结果缩略图墙（逐字 `grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]`），空态逐字 `No results match this search.`；完成结果为 0 时强制回 row 视图（effect 逐字 `tP.length>0||"grid"===eF&&eV("row")`）。
- **下载**：单结果单文件（`downloadFileWithMetadata`，文件名 `Row ${rowNumber} - ${prompt}`，扩展名取 mediaUrl 后缀并经 `EXT_TO_MIME` 白名单、缺省 `png`，`dedupeDownloadFileNames` 去重）；多结果 zip（逐字 `` `${(0,ew.sanitizeFilename)(t)||"Batch"}.zip` ``），带进度 toast（`Downloading N results...` → `Results downloaded` / `Failed to download results`）。zip 批量导出受 `DOWNLOAD_EXPORTS` 权益门控（`useWorkspaceAccessGate({entitlements:[Entitlements.DOWNLOAD_EXPORTS]})`，SelectionBar 的禁用文案逐字 `Upgrade to download exports (in bulk)`）。
- **多选 SelectionBar**（逐字）：`Regenerate` / `Download` / `Delete`（删除需确认 `Delete N selected row(s)?`）。
- **全屏查看器**：输入图与输出图共用，可前后导航，计数 `${tK+1} / ${tQ}`。

### 10. 自动保存与批量管理

- 每次行编辑立即 `updateGenerationTableRow`（乐观更新），生成失败重试标记进 `ex.current`；页面文案即「Saved automatically.」。无独立 autosave 字样（推断：实时 Convex mutation 即自动保存）。
- 批量（table）本身：可重命名（「Double-click to rename」）、新建（「New batch」→ `createGenerationTable {outputType:CORE_IO.IMAGE_URL, initialModelId, initialModelParameters:{prompt:""}, createdAt}`）、删除（`Delete ${name}? — The batch and its rows will be removed.`）、浏览历史（`Previous batches`，分页 `initialNumItems:100` + `Load more batches`）。
- 新表自动补 starter row：若当前表无行则自动 `createGenerationTableRow`；bulk 添加时若 starter 行仍是空白（逐字判定：`orderIndex===0 && 无 latestGenerationId && modelId===defaultModelId && inputAssetIds===referenceAssetIds && prompt 为空`）则以 `replaceStarterRowId` 原子替换，避免空行残留（推断：这是「starter row」机制）。
- 200 上限贯穿：按钮禁用、页脚计数、`tC=Math.max(0,200-tu.length+ +!!tN)`（剩余可加行数，+1 修正会被 starter 行替换占位）。

### 11. 与画布内 Batch Node 的区别

- 本主题对象是**独立页面**（surface 常量逐字 `BATCH_TABLE_GENERATION_SURFACE,0,"batch_table"`，埋点带 `generation_surface:"batch_table"`），不是画布节点。
- 画布侧对应物：`TOOL_REGISTRY` 另有 `availability:"active-canvas"` 的 Focus 编辑器条目；语料中**未找到** `batch_node` / `BatchNode` / 名为 `batch_table_generate` 的 HTTP 端点 —— `batch_table_generate` 在 bundle 中只作为 **feature flag 字符串**出现（`useFeatureFlagEnabled("batch_table_generate")`），后端实际是 Convex 函数族 `generationTables.*`（见附录）。若 batch node 使用同一 Convex 后端，则差异主要在前端 surface 与交互（推断，画布细节不在本主题语料内）。
- 后端调用全部为 Convex 客户端 RPC（`d.api.generationTables.queries/mutations`），非 REST；「batch_table_generate 端点」的说法在 bundle 中无对应字面量（未找到）。

## 二、机制级附录（逐字抄录）

### A. 工具注册与门控 — `1qoler3c4z5br.js`

TOOL_REGISTRY 条目（逐字）：

```js
{id:"bulk-generate",name:"Bulk Generate",description:"Create many image variations at once.",
 href:t.appRoutes.batchGenerate,owner:"FLORA",scope:"team",category:"Create",icon:"layers",
 previewImageUrl:"https://media.flora.ai/fa8ca191-d2a5-4ea5-9a5c-cad8ffe0f1c8_iFHaAYEby.png",
 tags:["bulk","batch","generate","variations","image"],favorite:!0,recent:!0,availability:"bulk-generate"}
```

可用性（逐字）：

```js
l=(0,a.useFeatureFlagEnabled)("batch_table_generate"), ...
m=s&&(!n.isProdEnv||!0===l)   // s=hasPermission(PERMISSION.CREATE_PROJECT)
// filterAvailableTools: "bulk-generate"===e.availability?t:...
```

页面守卫（逐字，`1hayrh3hp9xtt.js`）：

```js
e.s(["BatchGenerationGate",0,function(){...d=(0,s.useFeatureFlagEnabled)("batch_table_generate"),
c=!r.isProdEnv||d,{hasPermission:u,isPending:m}=(0,i.useCurrentAccess)();
return void 0===c||m?null:(c&&u(l.PERMISSION.CREATE_PROJECT)||(0,n.notFound)(),
 ...jsx(ar)... )}],132182)
```

### B. 模板变量正则与展开算法 tS — `1hayrh3hp9xtt.js`（★核心，逐字）

```js
tR=/\{([^{}\r\n]+)\}/g;
function tS(e){let t=e.template.trim(),a=Math.max(0,Math.floor(e.limit??1/0));if(0===a)return[];
if(0===e.variables.length)return Array.from({length:Math.min(e.copies,a)},()=>({prompt:t,
inputAssetIds:[],promptImageReferences:[],segments:[{kind:"text",text:t}]}));
let l=[],n=new Map,r=s=>{if(l.length>=a)return;let i=e.variables[s];if(!i){let e=0,a=[],r=new Map,
s=e=>{if(!e)return;let t=a.at(-1);t?.kind==="text"?t.text+=e:a.push({kind:"text",text:e})};
for(let l of t.matchAll(tR)){s(t.slice(e,l.index)),e=l.index+l[0].length;let i=l[1].trim(),o=n.get(i);
"string"==typeof o?s(o):o?(a.push({kind:"image",label:i,value:o}),r.has(o.assetId)||r.set(o.assetId,i)):s(l[0])}
s(t.slice(e));let i=a.map(e=>"text"===e.kind?e.text:`@[${e.value.assetId}]`).join("");
l.push({prompt:i,inputAssetIds:[...r.keys()],promptImageReferences:[...r].map(([e,t])=>({assetId:e,label:t})),segments:a});return}
for(let e of i.values)if(n.set(i.name,e),r(s+1),l.length>=a)return};return r(0),l}
```

机制注解：DFS 递归（推断：`r(s+1)` 逐变量深入，值循环在内层）；变量→当前值存 Map `n`；未知变量名（模板有 `{x}` 但 variables 里没有）原样输出 `s(l[0])`；输出行结构 `{prompt, inputAssetIds, promptImageReferences, segments}`，segments 为 text/image 段序列，image 段序列化为 `@[assetId]` 拼进 prompt 字符串。

### C. 模板编辑器（contentEditable 变量 DOM）— `1hayrh3hp9xtt.js`

变量节点创建（逐字）：

```js
let n=document.createElement("span");n.dataset.bulkVariable="",n.dataset.bulkVariableKind=e,
n.dataset.placeholder="variable",n.className=(0,ei.cn)(tM,tP),t.insertNode(n);
```

- 变量寻址：`tO` = `closest("[data-bulk-variable]")`；变量文本 = `tD(e)= (e.textContent??"").replaceAll(/[{}\r\n]/g,"").trim()`（变量名内禁止花括号/换行）。
- 键盘：变量节点内 `Space/Enter/Tab` → 结束变量并落光标（未命名变量移除）；`Backspace/Delete` → 整体删除变量；`{` 和 `}` 被直接 preventDefault（禁止手打花括号）。
- 粘贴：只接受 text/plain 且 `replaceAll(/[{}\r\n]/g,"")` 消毒。
- 序列化 `tU`：文本节点去掉零宽空格 `\u200b`；变量 span → `` `{${tD(e)}}` ``；`<br>` → `\n`。失焦时清理未命名变量。
- 变量集合提取（逐字）：

```js
let t=[];for(let a of e.matchAll(tR)){let e=a[1].trim();e&&!t.includes(e)&&t.push(e)}return t
```

变量 kind 判定（逐字）：`"image"===t.dataset.bulkVariableKind?"image":"text"`；kind 归属「同名先出现者优先」。变量样式色循环（逐字）：

```js
tE=["border-blue-a6 bg-blue-a4 text-blue-11","border-purple-a6 bg-purple-a4 text-purple-11",
"border-amber-a6 bg-amber-a4 text-amber-11","border-pink-a6 bg-pink-a4 text-pink-11",
"border-orange-a6 bg-orange-a4 text-orange-11","border-red-a6 bg-red-a4 text-red-11"];
function tz(e){return tE[e%tE.length]}
```

### D. 对话框状态与计数 — `1hayrh3hp9xtt.js`

- 状态：`useState` × 模板串、变量数组、`Map name→textValues`、`Map name→images[{assetId,url,name}]`、`Map name→pendingText`、uploadingName、copies 字符串 "1"、adding 标志。图片值按 `assetId` 去重，文本值去重；值清空即从变量表移除该变量。
- 行数公式（逐字）：

```js
(function(e,t,a){if(0===e.length)return Math.min(t,a+1);let l=1;
for(let t of e){if(0===t.values.length)return 0;if((l*=t.values.length)>a)return a+1}return l})(N,_??0,a)
```

（无变量→copies 与上限取小；有变量→笛卡尔积，超过剩余行数即封顶返回 a+1 用于触发越界错误。）

- prompt 长度估算（逐字，把每个变量按其**最长值**替换后计量）：

```js
function(e,t){let a=e.trim(),l=new Map(t.map(e=>[e.name,
e.values.reduce((e,t)=>Math.max(e,("string"==typeof t?t:`@[${t.assetId}]`).length),0)])),n=0,r=0;
for(let e of a.matchAll(tR)){let t=e[0],a=e.index;n+=a-r,n+=l.get(e[1].trim())??t.length,r=a+t.length}
return n+a.length-r}
```

- 提交（逐字）：

```js
let e=tS({template:C,variables:N,copies:_??0}).map(e=>({prompt:e.prompt,
inputAssetIds:e.inputAssetIds,promptImageReferences:e.promptImageReferences}));
if(!await s(e))return;L(),n(!1)   // s = aB 回调
```

- 预览（逐字）：`tS({template:C,variables:N,copies:_??0,limit:50})`；图片段渲染 `img src=e.value.url` + `e.label`；溢出 `and ${M-50} more`。

### E. 共享输入合并 t2 与乐观更新 t3 — `1hayrh3hp9xtt.js`（逐字）

```js
function t2(e,t,a){let l=new Set(t),n=new Set(a),r=e.filter(e=>!l.has(e)||n.has(e)),s=new Set(r),i=!1;
for(let e of a)if(!(l.has(e)||s.has(e))){if(r.length>=4){i=!0;continue}r.push(e),s.add(e)}
return{inputAssetIds:r,skipped:i}}
```

（移除共享图 = 从行里剔除；新增共享图 = 追加，单行超 4 张则跳过并置 `skipped`。`t3` 将其挂为 `setGenerationTableReference` 的 optimistic update。）

### F. Convex 函数族（`d.api.generationTables.*`）— `1hayrh3hp9xtt.js`

queries：`listGenerationTables`（分页 100）、`listGenerationTableRows {tableId}`（分页 200）、`listGenerationTableOutputs {tableId}`、`listGenerationTableReferenceAssets {tableId}`。
mutations（逐字标识符）：`createGenerationTable`、`updateGenerationTable`、`setGenerationTableReference`、`deleteGenerationTable`、`createGenerationTableRow`、`createGenerationTableRows`、`updateGenerationTableRow`、`duplicateGenerationTableRow`、`deleteGenerationTableRows`。

bulk 写入（aB，逐字）：

```js
await ao({tableId:ti._id,rows:e.map(e=>({modelId:to,modelParameters:{prompt:e.prompt},
inputAssetIds:[...new Set([...ti.referenceAssetIds,...e.inputAssetIds])],
promptImageReferences:e.promptImageReferences})),...tN&&{replaceStarterRowId:tN},createdAt:Date.now()})
```

行文档乐观结构（createGenerationTableRow，逐字关键字段）：`{_id:getOptimisticId(), _creationTime, tableId, orderIndex:(e.at(-1)?.orderIndex??-1)+1, modelId, modelParameters, inputAssetIds, promptImageReferences?, createdAt, updatedAt, deleted:!1}`。

行更新乐观合并（逐字）：`{...e, ...void 0!==a.modelId&&{modelId:a.modelId}, ...void 0!==a.modelParameters&&{modelParameters:a.modelParameters}, ...}`。

run 调用（逐字；hook 本体见「缺口」）：

```js
let n=await G({tableId:ti._id,rowIds:e,requestId:crypto.randomUUID(),runAction:t,
requestedUsageCreditsEstimate:a,usageCreditsEstimateIsApproximate:l});
// n.error / n.response.startedCount / n.response.skippedCount
```

### G. 行状态派生 tl — `1hayrh3hp9xtt.js`（逐字）

```js
function tl(e,t,a,l=!1){if(l)return{output:void 0,displayState:"generating",canGenerate:!1,canRegenerate:!1,stale:!1};
let n=e4(e.modelParameters),r=n.trim().length>0,s=r&&n.length<=8e3,i=s&&void 0===a,
o=void 0!==t&&e.updatedAt>t.createdAt,
d=a??(r&&!s?"Prompts are limited to 8,000 characters.":void 0);
return t?(0,eK.isGenerationAwaitingMedia)(t.status)?{output:t,displayState:"generating",...}
:(0,eK.isGenerationStatusSuccess)(t.status)&&t.mediaUrl?{output:t,displayState:"complete",...}
:(0,eK.isGenerationStatusFinalFailure)(t.status)||!t.mediaUrl?{output:t,displayState:"failed",...}
:{output:t,displayState:"complete",...}
:{output:t,displayState:r?i?"ready":"invalid":"empty",canGenerate:i,canRegenerate:i,stale:!1,...}}
```

参数工具（逐字）：`e4 = modelParameters.prompt || ""`；`e6` = 读 `parameters[resolutionParameterKey]`；`e8` = 读 `aspect_ratio`（`"auto"!==t.toLowerCase()` 才算非默认）；`e9` = 写分辨率（`delete l.resolution; delete l.image_size`）；`te` = 写宽高比（默认删键）；`e7 = {...e,prompt:t}`；`tt = {prompt:e4(e)}`。

### H. 列头批量改的三个 onApply — `1hayrh3hp9xtt.js`（逐字）

```js
// Model
h=e=>{for(let t of c)t.modelId!==e&&L(t._id,{modelId:e,modelParameters:tt(t.modelParameters)})}
// Resolution
g=e=>{for(let t of c){let a=z.find(e=>e.id===t.modelId);if(!a)continue;
let l=e===e1?void 0:e2(a.resolutionOptions,e);if(e!==e1&&!l)continue;
let n=l?.value??e1;e6(t.modelParameters,a)!==n&&L(t._id,{modelParameters:e9(t.modelParameters,a,n)})}}
// Aspect ratio（同理，e2(a.aspectRatioOptions,e) + te）
```

选项交集（逐字）：

```js
function e2(e,t){let a=t.toLowerCase();return e.find(e=>e.label.toLowerCase()===a||e.value.toLowerCase()===a)}
function e3(e,t){if(0===e.length)return[];let[a,...l]=e;return a[t].filter(e=>l.every(a=>void 0!==e2(a[t],e.value)))}
```

下拉菜单文案（逐字）：`g = u>0?`Set for ${u} selected ${1===u?"row":"rows"}`:`Set for all ${m} ${1===m?"row":"rows"}``；aria-label = `` `${d}: ${g.toLowerCase()}` ``（如 `Resolution: set for all 12 rows`）。

### I. 模型-输入数校验 ee 与成本 t7 — `1hayrh3hp9xtt.js`（逐字）

```js
function ee(e,t){if(t<0||t>4)return null;let a=J.modelService.endpointById.get(e);if(!a)return null;
let l=(0,X.determineBlockMode)({nodeType:Q.NodeTypes.emptyImageBlock,numberOfInputImages:t,
numberOfInputVideos:0}),n=Y.ENDPOINTS[l].find(n=>(...id/name 匹配...)&&(0,Z.isEndpointCompatibleWithCurrentInputs)
(n,l,{numberOfInputImages:t,numberOfInputVideos:0,numberOfInputAudios:0,numberOfInputModel3Ds:0}));
return n?{endpoint:n,mode:l}:null}
```

`isImageVariableCountSupported` 回调（逐字）：`t_=(0,E.useCallback)(e=>void 0!==to&&null!==ee(to,tk+e),[to,tk])`（tk = 共享图数，e = 额外图片变量数；即总输入数 ≤4 且模型兼容）。

成本聚合（t7 内部，逐字关键字段）：`{key, count, catalogCredits, request?}[]` → `useGatewayQuotedTotal` → `{usageCredits, isEstimate, isPending}`（字段名取自使用处）。

### J. RunCostConfirmation — `14khmbpcundo7.js`（逐字）

```js
if(!Number.isFinite(e)||e<1e4)return{kind:"none"};
let t=(0,n.calculatePricingV3UserDollarsFromUsageCredits)(e),r=`$${t.toFixed(2)}`;
return e>=1e5?{kind:"hard",...,title:`Confirm expensive run — ${r}?`,
description:`This run is projected to cost ${r}. Are you sure you want to continue?`,confirmLabel:`Run for ${r}`}
:{kind:"soft",...,title:`Confirm run — ${r}?`,description:`This run is projected to cost ${r}.`,confirmLabel:`Run for ${r}`}
// analytics: captureAnalyticsEvent(EVENTS.run_cost_confirmation,{action,kind,charged_usage_cost,projected_user_dollars,technique_id,technique_name,source})
// store: enqueue/advance/mountController/unmountController（队列串行弹窗）
```

### K. 下载 ev — `1hayrh3hp9xtt.js`（逐字关键字段）

```js
let t=(0,en.getExtensionFromUrl)(e.mediaUrl).toLocaleLowerCase(),a=ew.EXT_TO_MIME[t]?t:"png",
l=(0,ew.sanitizeFilename)(e.prompt),n=(0,ew.sanitizeFilename)(`Row ${e.rowNumber}${l?` - ${l}`:""}`);
return{name:`${n||`Row ${e.rowNumber}`}.${a}`,url:(0,en.toMediaDownloadUrl)(e.mediaUrl)??e.mediaUrl,
generationId:e.generationId}
// 多文件：(0,ew.dedupeDownloadFileNames)(a) → (0,ex.downloadFilesAsZip)(l, `${(0,ew.sanitizeFilename)(t)||"Batch"}.zip`, {onProgress})
// prompt 命名前先经 extractReferencedNodeIds + resolveMentionLabels 把 @[assetId] 还原成可读标签
```

### L. 上传 — `1hayrh3hp9xtt.js`（逐字）

```js
{fileInputRef:tg,triggerFileInput:tf,uploadFiles:tb}=(0,W.useElementUpload)(ti?.projectId),  // 整批共享图
{fileInputRef:tx,triggerFileInput:tw,uploadFiles:tv}=(0,W.useElementUpload)(ti?.projectId),  // 行级图
// 行级挂载：a_(e,{inputAssetIds:[...a.inputAssetIds,...n.map(e=>e.assetId)]})
```

（上传目标实现不在本 chunk；仅见 hook 名 `useElementUpload` 与返回的 `uploadFiles`。）

### M. 埋点事件名 — `245x6abtmz2ih.js` / `1hayrh3hp9xtt.js`（逐字）

```js
batch_table_action:"batch_table_action",batch_table_generation_started:"batch_table_generation_started"
// batch_table_action 的 action 值：new_batch_clicked{location:"header"|"menu"},
// rows_added{add_method:"single"|"bulk",row_count}, download_completed{download_scope:"all"|"single",result_count}
// 公共：generation_surface:"batch_table"（BATCH_TABLE_GENERATION_SURFACE，3yc-y57ou8gwi.js），{workspaceId}
```

### N. 200 行上限与 starter 行判定 — `1hayrh3hp9xtt.js`（逐字）

```js
h=i<200  // Add row/bulk 按钮 disabled 取反
tooltip:h?r:"Batches hold up to 200 rows"
footer: `${i} of 200 rows`
tC=Math.max(0,200-tu.length+ +!!tN)   // 剩余可加行
// starter 行判定（tN）：
...0===e.orderIndex&&void 0===e.latestGenerationId&&e.modelId===ti.defaultModelId
&&(0,j.isEqual)(e.inputAssetIds,ti.referenceAssetIds)&&Object.entries(e.modelParameters)
.every(([e,t])=>"prompt"===e&&"string"==typeof t&&!t.trim())... return e._id
```

## 三、证据与来源

### chunk 清单

| chunk | 大小 | 内容 |
|---|---|---|
| `1hayrh3hp9xtt.js` | 112,439B | 批量生成页全部 UI/状态/算法（组件 `ar`、`BatchGenerationGate`、tS/tR/t2/t3/t7/ee/tl/tf/tZ/t0/t1…），debugId `05540d77-cdea-cde6-4afa-3766ab9e3bb3` |
| `1qoler3c4z5br.js` | 98,454B | `TOOL_REGISTRY` bulk-generate 条目、`filterAvailableTools`、`useAvailableTools` feature flag 门控 |
| `245x6abtmz2ih.js` | 54,374B | 路由 `batchGenerate:"/batch-generate"`、EVENTS 常量（batch_table_action 等） |
| `3yc-y57ou8gwi.js` | 126,421B | `BATCH_TABLE_GENERATION_SURFACE`="batch_table"、侧边栏 batch_table_action 埋点、flag 读取 |
| `14khmbpcundo7.js` | 28,515B | `requestRunCostConfirmation`、RunCostConfirmationController、soft/hard 阈值 |

证据等级标注：附录 A–N 均为**一手逐字**；产品摘要中的行为描述均由逐字代码支撑；标注「推断」的仅有：换模型重置参数的动机、starter-row 机制意图、自动保存=实时 mutation、G 为 Convex action hook、画布 Batch Node 与本页面的后端同源性。

### 明确缺口（未找到）

1. **运行 hook 本体**：`G` 的定义（即发出 run 请求的 `useXxx` hook / Convex action 名）在 `1hayrh3hp9xtt.js` 中未以可读名出现（推测挂在未抓取的模块，或被混淆为单字导出）。已逐字确认其请求/响应结构 `{tableId,rowIds,requestId,runAction,requestedUsageCreditsEstimate,usageCreditsEstimateIsApproximate}` → `{error}|{response:{startedCount,skippedCount}}`。
2. **名为 `batch_table_generate` 的 HTTP/RPC 端点**：未找到；该字符串仅为 feature flag 名。
3. **画布内 Batch Node 的实现 chunk**：本主题锚点 4 个 chunk 中无 batch node 代码；`grep -l 'BatchNode|batch_node'` 全语料无命中（0 文件）。
4. **`useElementUpload` 的上传端点实现**、Convex 后端函数源码（bundle 为纯前端）。

### 可复现命令

```bash
# 定位
grep -l 'batch_table' /tmp/flora-chunks/*.js
grep -l 'Add in bulk' /tmp/flora-chunks/*.js
grep -l 'generation-table' /tmp/flora-chunks/*.js   # 无命中（连字符形式不存在）
grep -l 'BulkGenerate'  /tmp/flora-chunks/*.js      # 仅 3yc-y57ou8gwi.js 命中（CSS/类名，非组件名）

# 定向窗口摘录（示例）
python3 - <<'EOF'
import re
s=open('/tmp/flora-chunks/1hayrh3hp9xtt.js',encoding='utf-8',errors='replace').read()
i=s.find('function tS(');print(s[i:i+1400])
i=s.find('startedCount');print(s[max(0,i-800):i+800])
EOF

# 关键字校验
grep -c 'batch_table_action' /tmp/flora-chunks/245x6abtmz2ih.js
grep -o 'tR=/[^;]*;' /tmp/flora-chunks/1hayrh3hp9xtt.js
```
