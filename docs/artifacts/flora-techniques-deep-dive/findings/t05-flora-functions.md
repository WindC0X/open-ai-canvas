# FLORA_FUNCTIONS 函数目录与 Action Node 体系（t05）

> 语料：`/tmp/flora-chunks/*.js`（137 个 Next.js turbopack chunk）。
> 本文件所有「逐字」片段均直接摘自 bundle，保留原始混淆标识符（`eM`、`eR`、`v`、`d` 等）。
> 证据等级标注：【逐字】= bundle 原文抄录；【推断】= 由代码结构推理；【未找到】= 语料中未检索到。

---

## 一、产品级摘要

### 1.1 这套体系是什么

FLORA 画布中存在一类特殊节点 **codeBlock**（UI 名称 **Action**，block mode 常量 `CODE_EXECUTION="codeExecution"`，展示名映射 `codeExecution:"Action"` —— chunk `1ti9dii67la6x`）。它有两种形态：

1. **内置函数（Flora Function）**：平台预置的确定性代码块（Python 服务端 / JavaScript 浏览器端），由 `nodeType:"codeBlock"` + `data.floraFunction:<函数id>` 标识。用户从 Action 选择器挑选，不可见代码细节（代码由注册表内嵌）。
2. **用户自定义 Code Block**：`codeUrl` 指向 `/api/code-storage` 的用户代码，带 `aiPrompt`（可 "Generate Action" 让 AI 生成/修改代码）。

两者共用同一 schema 驱动机制：代码注释中的 `@flora-*` 注解被解析成 **inputs / outputs / params**，直接驱动节点的输入输出口和参数面板控件。

### 1.2 函数目录规模与分类

注册表共 **63 个**内置函数（chunk `0-shlriu0gzsu`，逐字统计 `eM(` 调用 = 63）。分两类 runtime：

| 分类 | 数量 | runtime | status 分布 |
|---|---|---|---|
| 浏览器图像/文本工具（`-browser` 后缀） | 24 | `javascript` + `"browser"` | 22 released、1 staged（annotate-image-browser）、1 unlisted（flip-image-browser） |
| 服务端视频/文本/图像工具 | 39 | `python`（无 runtime 字段） | 19 released（全部视频类）、20 unlisted（文本/图像 Python 版） |

用户可见语义：**released 函数进入 `FLORA_FUNCTIONS`**（Action 选择器默认列表）；**unlisted 函数只在 `FLORA_FUNCTIONS_ALL`**（推断：unlisted 用于灰度/内部/被 browser 版替代的旧 Python 版本——每对如 `color-grade-image`(python,unlisted) 与 `color-grade-image-browser`(javascript,released) 代码注释逐字印证："Drop-in for the python "Color Grade Image" prebuilt"）。`status:"staged"` 在选择器 UI 中显示琥珀色 "Staged" 徽标（chunk `3983pkyadzzah` 逐字）。

### 1.3 交互流程

```text
Action 选择器（+号菜单 → Action 分区）
  ├─ 列表 = FLORA_FUNCTIONS（隐藏 unlisted），按 label/短描述搜索
  │    按 schema.inputs 与已连数据源类型过滤（"No actions accept this input"）
  ├─ "Generate Action" 项（订阅用户）：AI 从 prompt 生成自定义 action
  ├─ 选中 → add_node_menu_clicked {action:"flora_function", function_name, source:"click"|"arrow_enter"}
  │    或拖拽 → dataTransfer "flora-item" = {"kind":"flora-function","floraFunctionId":...}
  ▼
落到画布 = codeBlock 节点
  nodeData = { floraFunction:<id>, language, parsedSchema:<schema>, label:<schema.name> }
  ├─ 输入/输出口 ← schema.inputs/outputs（含 multiple/dynamic/optional）
  ├─ 参数面板 ← schema.params（number/boolean/color/select/text/point2d/point3d/interval 控件）
  └─ 徽标：cost>0 显示花朵用量图标（PricingV3CostScaleFlowers）
```

### 1.4 计费机制（用户可见语义）

- 选择器中每个函数若有成本则显示 "Usage consumption" 花朵徽标。
- **实际目录内所有函数 `creditCost` 逐字硬编码为 `0`**（见 2.3），因此当前内置函数免费；成本结构已预留（`estimatedSeconds`、花朵徽标、`getFloraFunctionCost`）。
- 自定义代码块：`codeUrl` 非空 → 运行成本 0；否则按其绑定函数的 `creditCost`。

### 1.5 与 Custom Actions / Technique 的关系

- Action 选择器顶部固定一项 **"Generate Action"**（副标题 "Build with AI from a prompt" / 未订阅 "Upgrade to generate custom actions"）→ 生成的是用户自定义 codeBlock（`aiPrompt` 字段存 prompt）。【逐字，chunk 3983pkyadzzah】
- 内置 Flora Function 与 techniqueBlock 是并列体系：拖拽 item `kind` 分别为 `"flora-function"` 与 `"technique"`；node picker 搜索里 FLORA_FUNCTIONS 是独立于普通节点分区之外的补充结果区。
- 浏览器 runtime 函数（`-browser`）在客户端执行（WebGL/Canvas/PIL 等价实现），Python 函数推断在服务端沙箱执行（`FloraUserError`、`/tmp/output/`、`subprocess.run(cmd,...)` 逐字出现于函数体；未找到沙箱实现 chunk）。

---

## 二、机制级附录

### 2.1 注册表模块（chunk `0-shlriu0gzsu`，module id 761337）

注册函数定义（逐字）：

```js
function eM(e,t,a,r="staged",n){
  let o=v(a);
  if(!o)throw Error(`[flora-functions] Failed to parse schema for built-in function: ${e}`);
  return{id:e,label:o.name??e,description:o.description??"",language:t,
         ...n&&{runtime:n},code:a,schema:o,status:r,
         estimatedSeconds:eR[e]??10,creditCost:0}}
```

导出与派生（逐字）：

```js
eA=eT.filter(e=>"released"===e.status),            // FLORA_FUNCTIONS
eP=eA.map(e=>e.id),                                 // FLORA_RELEASED_FUNCTION_IDS
eL=new Map(eT.map(e=>[e.id,e]));                    // FLORA_FUNCTIONS_BY_ID
e.s(["FLORA_FUNCTIONS",0,eA,"FLORA_FUNCTIONS_ALL",0,eT,
     "FLORA_FUNCTIONS_BY_ID",0,eL,
     "FLORA_RELEASED_FUNCTION_IDS",0,eP],761337)
```

服务端视频函数成本表 `eR`（逐字，秒数；未找到其被用于计费的代码）：

```js
eR={"ken-burns-video":30,"stitch-videos":60,"split-video":30,"extract-video-frames":30,
"color-grade-video":45,"video-to-frame-grid":30,"boomerang-video":30,"reverse-video":30,
"video-to-long-exposure":45,"video-effect":45,"color-filter-video":45,"speed-up-video":30,
"slow-down-video":30,"duplicate-video":30,"greenscreen-video":45,"resize-video":30,
"change-video-ar":45,"split-audio-from-video":30,"merge-audio-into-video":30}
```

### 2.2 FLORA_FUNCTIONS 完整目录（63 个）

字段说明：code 取自注册时的变量名（inline = 模板字符串内嵌于 chunk）；estimatedSeconds 无 eR 条目时默认 10；creditCost 全部为 0；runtime 仅 browser 函数有。全部来源 chunk `0-shlriu0gzsu`。

| # | id | 显示名(@flora-name) | lang/runtime | status | code 变量 | inputs → outputs |
|---|---|---|---|---|---|---|
| 1 | color-grade-image-browser | Color Grade Image | js/browser | released | inline 模板 | source:image → graded:image |
| 2 | overlay-image-browser | Overlay Image | js/browser | released | eo | base:image, overlay:image → composite:image |
| 3 | draw-image-browser | Draw | js/browser | released | O | source:image(optional) → drawn:image |
| 4 | pixel-remover-image-browser | Pixel Remover | js/browser | released | ei | source:image → erased:image |
| 5 | magic-eraser-image-browser | Magic Eraser | js/browser | released | er | source:image → healed:image |
| 6 | annotate-image-browser | Annotate | js/browser | **staged** | S | source:image → annotated:image |
| 7 | crop-image-browser | Crop | js/browser | released | U | source:image → cropped:image |
| 8 | scene-3d-image-browser | 3D Shape to Image | js/browser | released | ef | background:image(optional) → render:image |
| 9 | blur-image-browser | Blur | js/browser | released | C | source:image → blurred:image |
| 10 | change-image-ar-browser | Pad / Crop Image to AR | js/browser | released | M | source:image → output:image |
| 11 | rotate-image-browser | Rotate / Flip Image | js/browser | released | em | source:image → result:image |
| 12 | color-filter-image-browser | Image Filter | js/browser | released | P | source:image → filtered:image |
| 13 | color-tint-image-browser | Color Tint Image | js/browser | released | W | source:image → tinted:image |
| 14 | filter-color-image-browser | Color Key | js/browser | released | V | source:image → filtered:image |
| 15 | duplicate-image-browser | Duplicate Image | js/browser | released | j | source:image → copies:image(multiple) |
| 16 | side-by-side-composite-browser | Side-by-Side Composite | js/browser | released | ey | images:image(multiple) → composite:image |
| 17 | add-shape-to-image-browser | 2D Shape to Image | js/browser | released | _ | background:image(optional) → result:image |
| 18 | add-text-to-image-browser | 2D Text to Image | js/browser | released | E | background:image(optional) → result:image |
| 19 | qr-code-generator-browser | QR Code Generator | js/browser | released | el | content:text → qr:image |
| 20 | resize-image-browser | Resize Image | js/browser | released | ec | source:image → resized:image |
| 21 | shader-effect-browser | Shader Effect | js/browser | released | eg | source:image → shaded:image |
| 22 | split-text-browser | Split Text | js/browser | released | e_ | source:text → parts:text(multiple) |
| 23 | find-and-replace-text-browser | Find and Replace | js/browser | released | Z | source:text → result:text |
| 24 | concat-text-browser | Concat Text | js/browser | released | F | parts:text(multiple) → combined:text |
| 25 | ken-burns-video | Image to Video Ken Burns | python | released | ea | source:image → video:video |
| 26 | stitch-videos | Stitch Videos | python | released | eE | videos:video(multiple) → stitched:video |
| 27 | split-video | Split Video | python | released | ek | source:video → segments:video(multiple) |
| 28 | extract-video-frames | Extract Video Frames | python | released | X | source:video → frames:image(multiple) |
| 29 | color-grade-video | Color Grade Video | python | released | N | source:video → graded:video |
| 30 | video-to-frame-grid | Video to Frame Grid | python | released | ez | source:video → grid:image |
| 31 | watermark-video | Watermark | python | **released(默认省略)** | eI | source:video, watermark:image(optional) → watermarked:video |
| 32 | boomerang-video | Boomerang | python | released | I | source:video → boomerang:video |
| 33 | reverse-video | Reverse Video | python | released | ed | source:video → reversed:video |
| 34 | video-to-long-exposure | Video to Long Exposure | python | released | eC | source:video → exposure:image |
| 35 | video-effect | Video Effect | python | released | eS | source:video → effected:video |
| 36 | color-filter-video | Video Color Filter | python | released | L | source:video → filtered:video |
| 37 | speed-up-video | Speed Up Video | python | released | ex | source:video → sped:video |
| 38 | slow-down-video | Slow Down Video | python | released | eb | source:video → slow:video |
| 39 | duplicate-video | Duplicate Video | python | released | q | source:video → copies:video(multiple) |
| 40 | greenscreen-video | Greenscreen Remove | python | released | et | source:video → keyed:video |
| 41 | resize-video | Resize Video | python | released | ep | source:video → resized:video |
| 42 | change-video-ar | Change Video AR | python | released | T | source:video → output:video |
| 43 | split-audio-from-video | Split Audio from Video | python | released | ev | source:video → audio:audio, muted:video |
| 44 | merge-audio-into-video | Merge Audio into Video | python | released | en | video:video, audio:audio → merged:video |
| 45 | split-text | Split Text | python | unlisted | ew | source:text → parts:text(multiple) |
| 46 | find-and-replace-text | Find and Replace | python | unlisted | K | source:text → result:text |
| 47 | concat-text | Concat Text | python | unlisted | B | parts:text(multiple) → combined:text |
| 48 | color-grade-image | Color Grade Image | python | unlisted | H | source:image → graded:image |
| 49 | change-image-ar | Change Image AR | python | unlisted | R | source:image → output:image |
| 50 | rotate-image | Rotate Image | python | unlisted | eu | source:image → rotated:image |
| 51 | color-filter-image | Color Filter | python | unlisted | A | source:image → filtered:image |
| 52 | color-tint-image | Color Tint | python | unlisted | D | source:image → tinted:image |
| 53 | filter-color-image | Color Key | python | unlisted | Y | source:image → filtered:image |
| 54 | blur-image | Blur | python | unlisted | z | source:image → blurred:image |
| 55 | duplicate-image | Duplicate Image | python | unlisted | G | source:image → copies:image(multiple) |
| 56 | side-by-side-composite | Side-by-Side Composite | python | unlisted | eh | images:image(multiple) → composite:image |
| 57 | add-shape-to-image | Add Shape to Image | python | unlisted | w | source:image → result:image |
| 58 | add-text-to-image | Add Text to Image | python | unlisted | k | source:image → result:image |
| 59 | qr-code-generator | QR Code Generator | python | unlisted | es | content:text → qr:image |
| 60 | flip-image | Flip Image | python | unlisted | Q | source:image → flipped:image |
| 61 | flip-image-browser | Flip Image | js/browser | unlisted | $ | source:image → flipped:image |
| 62 | generate-shape-image | Generate Shape Image | python | unlisted | J | （无输入）→ image:image |
| 63 | generate-text-image | Generate Text Image | python | unlisted | ee | （无输入）→ image:image |

注：
- `watermark-video` 是唯一注册时省略第 4 参的函数（`eM("watermark-video","python",eI)`），走默认 `status="staged"`【逐字】。
- `color-grade-image-browser` 模板头（逐字）：`// @flora-name: "Color Grade Image"` / `// @flora-description: "Apply cinematic color grading — adjust tone, color, highlights, and hue"`；参数含 `warmth/contrast/saturation/brightness/highlights/shadows/tint/hueShift/advanced/showScope`，其中 `advanced` 用不可满足的 `visibleIf` 故意隐藏（"advanced remains accepted (no-op) for API/saved-node compat"）。
- `baseFunctionId`（chunk 3983pkyadzzah，逐字）：`e.endsWith("-browser")?e.slice(0,-8):e` —— browser 函数回退到同名 Python 函数查短描述/图标。
- `floraFunctionIcon(id)`：查图标映射 `C[id] ?? C[baseFunctionId(id)]`。

### 2.3 计费特例：codeBlock 成本（chunk `1ti9dii67la6x`，module 18505 + 665343，逐字）

```js
e.s(["CODE_EXECUTION_CREDIT_COST",0,0,"CODE_EXECUTION_USAGE_COST",0,0],18505);
function t(e){if(!e)return 0;let t=o.FLORA_FUNCTIONS_BY_ID.get(e);return t?.creditCost??0}
e.s(["FLORA_FUNCTION_SHORT_DESCRIPTIONS",0,{
  "color-grade-image":"Adjust colors, tone, and contrast",
  "color-grade-video":"Adjust colors, tone, and contrast",
  "stitch-videos":"Join multiple clips into one",
  "split-video":"Cut a video into segments"},
 "getCodeExecutionCost",0,function(e){
   return (e.codeUrl?.trim()??"").length>0 ? 0 : t(e.floraFunction??void 0)},
 "getCodeForNode",0,function(e,t){
   if(e.floraFunction){let t=o.FLORA_FUNCTIONS_BY_ID.get(e.floraFunction);if(t)return t.code}
   return t},
 "getFloraFunctionCost",0,t,
 "getSchemaForNode",0,function(e,t){
   if(e.floraFunction){let t=o.FLORA_FUNCTIONS_BY_ID.get(e.floraFunction);if(t)return t.schema}
   return t??e.parsedSchema},
 "isFloraFunction",0,function(e){
   return !!e.floraFunction&&o.FLORA_FUNCTIONS_BY_ID.has(e.floraFunction)}],665343)
```

即：**`getCodeExecutionCost(nodeData)` = `codeUrl` 非空(trim) → 0；否则 `FLORA_FUNCTIONS_BY_ID.get(nodeData.floraFunction)?.creditCost ?? 0`**。UI 端 cost>0 才渲染花朵徽标：`V=(0,k.getFloraFunctionCost)(K.id),G=V>0`（chunk 3983pkyadzzah 逐字）。

### 2.4 schema 结构：`@flora-*` 注解 → 运行时 schema（chunk `0-shlriu0gzsu`）

**解析入口**（逐字，module 785979）：

```js
function v(e){
  let t=h(e,"name"),a=h(e,"description"),
      n=y(e,"inputs"),o=void 0!==n?x(n):void 0,
      i=y(e,"outputs"),s=void 0!==i?x(i):void 0,
      l=d(e),c=r(e);
  if(t||a||void 0!==o||void 0!==s||0!==l.length||c)
    return{...t&&{name:t},...a&&{description:a},
           ...void 0!==o&&{inputs:o},...void 0!==s&&{outputs:s},
           ...l.length>0&&{params:l},hasPreview:c}}
e.s(["parseCodeBlockSchema",0,v],785979)
```

- `h(e,t)`：逐行匹配注释 `^\s*(?:\/\/|#)\s*@flora-<t>\s*:\s*(.+)`，取标量值（≤300 字符，支持 JSON 字符串）。
- `y(e,t)`：取 `@flora-inputs:` / `@flora-outputs:` / `@flora-params:` 的**多行续行 JSON 数组**（括号配平检测函数 `b`/`u` 支持跨行和 `#`/`//` 注释行拼接）。
- `x(list)`：输入/出口归一化（逐字语义）：
  - `{name,type}` 必填，type ∈ `["image","video","text","audio","model3d"]`（常量 `CODE_BLOCK_IO_TYPES`）；
  - `multiple:true` 或 `dynamic:true` → `{multiple:true, dynamic:true, min:1, max:Infinity 语义}`；`multiple:{min,max}` → 限量多输入；
  - `optional:true` → 可选（非 multiple 时 min=0）。
- `hasPreview`（module 877512，逐字）：`r(e)=/^\s*export\s+const\s+preview\b/m.test(e)` —— 代码声明 `export const preview` 即节点带预览。

**params 解析 `d(e)` → 参数控件映射**（逐字语义，module 570867）：

- 允许的 param type 白名单：`["number","boolean","color","select","text","point2d","point3d","interval"]`。
- 校验：key 唯一且非空、label 必填、必须含 `default`；`visibleIf` 必须是 `{key, equals|notEquals}` 数组（互斥，不能同时有 equals 与 notEquals；值可为 string/number/boolean）。
- 类型映射到内部 `ParameterType`（chunk 0-shlriu0gzsu 逐字）：

| @flora-params type | 条件 | ParameterType | UI 控件语义 |
|---|---|---|---|
| number | 有 min+max | `NonScaledSlider` | 滑杆 |
| number | 无 min/max | `NumberInput` | 数字输入框 |
| boolean | — | `Boolean` | 开关 |
| color | — | `Color` | 取色器 |
| select | options 非空 | `Select` | 下拉（options→`availableValues{label,value}`） |
| text | — | `Textinput` | 文本框 |
| point2d | default {x,y} | `Point2D` | 2D 点（min/max/step 均为 {x,y} 对象） |
| point3d | default {x,y,z} | `Point3D` | 3D 点 |
| interval | default {min,max}+min/max+可选 step | `Interval` | 区间滑杆 |

- 生成控件定义（逐字）：`n={key:e.key,label:e.label,type:r,defaultValue:e.default,..."string"==typeof e.description&&{infoTooltip:e.description}}`；`visibleIf` 数组原样带上；number/interval → `minNumberValue/maxNumberValue/numberStep`；select → `availableValues`；point2d/3d → `point2dMin/point2dMax/point2dStep`（3d 同理）。
- 配套导出：`getDefaultParamValues(schema)` = 把每个 param 的 `defaultValue` 收成 `{key:value}`；`isValueCompatible(param,value)` 按类型校验值合法性（select 校验 `availableValues.some(v=>v.value===t)`）。

**如何驱动 UI**【推断】：`schema.params` → 转成 `ParameterType` 控件定义（`visibleIf` 控制联动显隐，如 qr-code-generator 的 `background` 字段 `visibleIf:[{key:"showBackground",equals:true}]` 逐字可见），与模型端点的参数面板（`collectParameterPanelComponentsDefinitions`，见 2.7）同一套渲染管线。节点输入/输出口由 `schema.inputs/outputs` 生成，见 2.6 的 `u(e)`。

### 2.5 codeBlock 节点数据形状（chunk `440x_k-bktkm8`，逐字）

```js
...n===s.NodeTypes.codeBlock?{codeUrl:e.data.codeUrl,language:e.data.language,
   aiPrompt:e.data.aiPrompt,parsedSchema:e.data.parsedSchema,
   paramValues:e.data.paramValues,floraFunction:e.data.floraFunction,
   runtime:e.data.runtime,toolState:e.data.toolState,shouldRun:!1}:null
```

`paramValues` 合并语义（同 chunk 逐字）：`paramValues:(e,t)=>void 0===t?e:{...e??{},...t}`。

从拖拽/选择创建内置函数节点（chunk `2kralpe5w898d`，逐字）：

```js
if(W(e)){let t=T.FLORA_FUNCTIONS_ALL.find(t=>t.id===e.floraFunctionId);
  if(!t)throw Error(`Unknown flora function id: ${e.floraFunctionId}`);
  return{nodeType:E.NodeTypes.codeBlock,
    nodeData:{floraFunction:t.id,language:t.language,
              parsedSchema:t.schema,label:t.schema.name??t.label}}}
```

拖拽 item 工厂（chunk `2kralpe5w898d`，逐字）：
`"createFloraFunctionDragItem",0,({floraFunctionId:e})=>({kind:"flora-function",floraFunctionId:e})`
（同类：`kind:"node-type"|"technique"|"element"|"document-page"|"styled-node"|"library-folder"`；写入 `dataTransfer` 键名 `"flora-item"`。）

### 2.6 输入槽系统（chunk `1ti9dii67la6x`，逐字）

```js
let a={text:"prompt",image:"image",video:"video",audio:"audio",model3d:"reference"};
function u(e){                       // codeBlockSchemaInputSlots
  if(!e?.inputs?.length)return s;    // s=[]
  let t=new Set,
  d=e.inputs.filter(e=>!!e.name).map(e=>{
    let d=e.name,i=2;
    for(;t.has(d);)d=`${e.name}-${i++}`;   // 重名 slot 自动加后缀 name-2, name-3…
    let{min:n,max:r}=!0===e.multiple||e.dynamic
        ?{min:+!e.optional,max:void 0}
        :e.multiple&&"object"==typeof e.multiple
          ?{min:e.multiple.min??1,max:e.multiple.max}
          :{min:+!e.optional,max:1};
    return{id:d,name:d.charAt(0).toUpperCase()+d.slice(1),
      type:l.CODE_BLOCK_IO_TYPE_TO_NODE_IO_TYPE[e.type],role:a[e.type],min:n,max:r}});
  return T.set(e,d),d}
```

连接匹配 `matchConnectionsToActionSlots(slots, connections)`：逐边检查 targetHandle 对应 slot 的 type 兼容，否则 `{state:"unexpected"}`；未指定 handle 的边贪心找第一个同类型未满额 slot（`max??1/0`）。`actionRequiredSlotsSatisfied(slots, claimed)`：所有 `min>0` 的 slot 都被满足才可运行。

类型兼容过滤（chunk `3ldpt1pk51grl`，逐字）：

```js
"isFloraFunctionCompatibleWithSources",0,function(e,t){
  if(void 0===e.inputs||0===t.length)return!0;
  if(0===e.inputs.length)return!1;
  let o=function(e){let t=new Set;for(let o of e.inputs??[])t.add(o.type);return t}(e);
  return t.every(e=>{let t=eI.NODE_IO_TYPE_TO_CODE_BLOCK_IO_TYPE[e];
    return void 0!==t&&o.has(t)})}
```

（`canFitAllInCodeBlockSchema(schema, sourceTypes, extra)` 支持向 dynamic slot 塞多个源。）

### 2.7 collectParameterPanelComponentsDefinitions（chunk `25b_jv9e6qdx1`，逐字）

```js
"collectParameterPanelComponentsDefinitions",0,function(){
  return this.options.params.filter(e=>!!e.options.component)
         .map(e=>e.options.component.toParameterConfig(e))}
```

- 定义在**模型端点类**上（chunk `3zqb624po1kk-`：`class P{options;constructor(e){this.options=e,this.collectParameterPanelComponentsDefinitions=Z.collectParameterPanelComponentsDefinitions}collectParameterPanelComponentsDefinitions;...}`，Z 即 chunk 864760 = 25b_jv9e6qdx1 导出）。
- 语义：端点 `options.params` 中带 `options.component` 的参数，逐个调 `component.toParameterConfig(param)` 生成参数面板控件定义。【推断：与 2.4 的 flora param 定义最终走同一 ParameterType 控件渲染体系；此方法属于模型节点而非 codeBlock。】
- 消费示例（chunk `1hayrh3hp9xtt`，逐字）：`e.collectParameterPanelComponentsDefinitions().find(e=>t.includes(e.key))` —— 用于 resolution 级联选择（`resolutionParameterKey`、`"__default__"` 哨兵值）。
- 相关静态控件工厂（逐字）：`createModelSelectorStaticParamConfig(endpoints)`（缓存于 Map，`Object.freeze`；Select key = `SPECIAL_MODEL_SELECTOR_PARAM_KEY`）、`createStylesSelectorStaticParamConfig`（key `"../styles"`，value=`lora_UUID`）。

### 2.8 代码存储与执行端点

端点表（chunk `245x6abtmz2ih`，逐字）：

```js
workflow:{generate:"/api/workflow/generate",
  canvasBatchGenerate:"/api/workflow/canvas-batch/generate",
  generationTableGenerate:"/api/workflow/generation-table/generate",
  codeExecution:"/api/workflow/code-execution",
  preprocessElement:"/api/workflow/preprocess-element",
  runTechnique:"/api/workflow/run-technique"}
```

代码存储（chunk `3983pkyadzzah`，逐字，粘贴复制 codeBlock 时克隆用户代码）：

```js
fetch("/api/code-storage/load",{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({codeUrl:o})})
  .then(e=>e.json())
  .then(t=>fetch("/api/code-storage/save",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({code:t.code,language:r,projectId:e})}))
  .then(e=>e.json()).then(e=>{I.getState().updateNode(
    el.MeaningfulProjectChange.ChangeNodeInput,i,
    t=>({...t,data:{...t.data,codeUrl:e.codeUrl}}))})
```

即用户代码存服务端，节点只持 `codeUrl` 引用；复制节点 = load 旧 codeUrl → save 新副本 → 更新节点 `codeUrl`。内置函数节点无 `codeUrl`（`codeUrl&&!e.data.floraFunction` 才走此克隆）。

执行请求体字段【未找到】：`/api/workflow/code-execution` 的请求/响应字段在本语料中只出现端点常量，未找到调用点逐字代码（推断由另一 chunk 动态构造；`440x_k-bktkm8` 的遥测快照含 `codeUrl/language/aiPrompt/parsedSchema/paramValues/floraFunction/runtime/toolState`，可作为请求字段参考，证据等级：推断）。

### 2.9 浏览器函数执行约定（以 color-grade-image-browser 为例，逐字）

```js
export async function execute({ inputs, params }) {
  const input = imageInput(inputs)
  if (!input) throw new Error("Connect an image input")
  const img = new Image()
  img.src = input.dataUrl
  await img.decode()
  ...
  return { type: "image", dataUrl: out.toDataURL("image/png"), name: "graded.png" }
}
```

- 浏览器函数约定导出 `execute({inputs, params})`，inputs 元素形如 `{type:"image", dataUrl}`，返回 `{type, dataUrl, name}`。【逐字（该函数体）；作为全部 24 个 browser 函数的统一约定：推断】
- `toolState` 持久化预览态：注释逐字 "The scope overlay is preview-only ... persist in toolState, not params"。
- Python 函数约定：`get_input(0)`、`get_param(key, default)`、`raise FloraUserError("...")`、写 `/tmp/output/`（逐字出现于 watermark-video / add-shape-to-image 函数体）。

### 2.10 选择器 UI 细节（chunk `3983pkyadzzah`，逐字要点）

- 数据源：`v=(I?C.FLORA_FUNCTIONS_ALL:C.FLORA_FUNCTIONS).filter(e=>"unlisted"!==e.status)`（I 为布尔，语义未定位；两者都再排除 unlisted）。
- 过滤链：数据源类型过滤（"No actions accept this input"）→ 500ms 防抖搜索（`action_picker_searched {search_query,result_count}`）→ 匹配 `label` 或 `FLORA_FUNCTION_SHORT_DESCRIPTIONS[id] ?? description`。
- 条目渲染：图标（`floraFunctionIcon`）、`label`、staged 琥珀 "Staged" 徽标、cost 花朵徽标（`ModelDropdownItemBadge` tooltip "Usage consumption"）、输入→输出模态徽标（`schema.inputs?.map(L)` + `→` + `outputs?.map(U)`）。
- 顶部固定项 "Generate Action"：订阅者显示 "Build with AI from a prompt"，否则 "Upgrade to generate custom actions"；点击埋点 `add_node_menu_clicked {action:"generate_action"}`。

---

## 三、证据与来源（chunk 清单 + 可复现命令）

### 3.1 chunk 清单

| chunk | 大小 | 内容 |
|---|---|---|
| `0-shlriu0gzsu.js` | 609,126 B | module 761337 注册表（63×`eM`、`eR` 成本表）、module 785979 `parseCodeBlockSchema=v`、module 570867 `@flora-params` 解析、module 877512 `codeDeclaresPreview`、module 894567 IO 类型映射；内嵌全部函数源码 |
| `1ti9dii67la6x.js` | 27,253 B | module 18505（CODE_EXECUTION_CREDIT_COST=0）+ 665343（`getCodeExecutionCost/getSchemaForNode/getCodeForNode/isFloraFunction/FLORA_FUNCTION_SHORT_DESCRIPTIONS`）、144785（输入槽 `u`/`matchConnectionsToActionSlots`） |
| `2kralpe5w898d.js` | 37,832 B | 拖拽 item 工厂（`createFloraFunctionDragItem`）、`kind:"flora-function"` → codeBlock 节点创建（`Unknown flora function id` 错误） |
| `3983pkyadzzah.js` | 164,793 B | node picker / Action 选择器（FloraFunctionSearchResult、Generate Action、"Staged" 徽标、花朵成本徽标、`baseFunctionId`/`floraFunctionIcon`）、`/api/code-storage/load|save` 克隆链 |
| `3ldpt1pk51grl.js` | — | `isFloraFunctionCompatibleWithSources` / `canFitAllInCodeBlockSchema`（module 605205）、`parameters-sidebar` 测量 |
| `25b_jv9e6qdx1.js` | 24,943 B | `collectParameterPanelComponentsDefinitions`、`createModelSelectorStaticParamConfig`、`createStylesSelectorStaticParamConfig`、`FloraEndpointStatus` |
| `3zqb624po1kk-.js` | 10,799,757 B | 模型端点类 `class P`（绑定 `collectParameterPanelComponentsDefinitions`、`validateInputParams`、`transformParams`） |
| `1hayrh3hp9xtt.js` | 112,439 B | 参数面板消费端（resolution 级联 `__default__`） |
| `440x_k-bktkm8.js` | 347,799 B | codeBlock 节点数据快照字段（遥测）、`paramValues` 合并 mutation |
| `245x6abtmz2ih.js` | — | appRoutes 端点表（`workflow.codeExecution` 等） |
| `3d6au3l0x3k0q.js` / `1ti9dii67la6x.js` | — | `CodeBlockMode.CODE_EXECUTION="codeExecution"`，展示名映射 `codeExecution:"Action"` |

### 3.2 可复现命令

```bash
# 定位注册表与消费端
grep -l 'FLORA_FUNCTION' /tmp/flora-chunks/*.js
grep -l 'creditCost' /tmp/flora-chunks/*.js
grep -l 'collectParameterPanelComponentsDefinitions' /tmp/flora-chunks/*.js
grep -l 'createFloraFunctionDragItem' /tmp/flora-chunks/*.js
grep -oh '"/api/[^"]*"' /tmp/flora-chunks/*.js | sort -u

# 提取函数目录（本报告 2.2 的生成逻辑）
python3 - <<'EOF'
import re
s=open('/tmp/flora-chunks/0-shlriu0gzsu.js',encoding='utf-8',errors='replace').read()
pos=0
while True:
    m=re.search(r'eM\("([^"]+)","(javascript|python)",',s[pos:])
    if not m: break
    i=pos+m.start(); j=pos+m.end()
    # 括号配平扫描（处理反引号模板/字符串转义）后取尾部 status/runtime
    ...
EOF
```

### 3.3 缺口清单（未找到 / 推断项）

- **未找到**：`/api/workflow/code-execution` 请求/响应体的逐字构造代码（仅端点常量 + 遥测字段旁证）。
- **未找到**：Python 函数服务端沙箱实现（runner、依赖、超时）——仅函数体内 `FloraUserError`、`/tmp/output/`、`subprocess.run` 逐字可见。
- **未找到**：`eR`（estimatedSeconds）是否参与任何计费/限流逻辑；以及 `creditCost` 非零值的注入路径（当前全为 0，疑似服务端下发或未来 A/B）。
- **未找到**：`FLORA_FUNCTION_SHORT_DESCRIPTIONS` 仅覆盖 4 个函数（color-grade-image / color-grade-video / stitch-videos / split-video），其余函数在选择器回退到 `description`（@flora-description）。
- **推断**：`eM` 第 5 参 `n` → `runtime` 字段仅 browser 函数传 `"browser"`；Python 函数 runtime 为空，执行位置由服务端决定。
- **推断**：Action 选择器中布尔 `I` 决定用 `FLORA_FUNCTIONS_ALL` 还是 `FLORA_FUNCTIONS`（疑似某 flag/hook，未定位定义）。
