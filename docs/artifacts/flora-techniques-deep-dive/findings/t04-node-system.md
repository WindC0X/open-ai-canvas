# 节点系统全集（类型 / schema / 连接规则）— Flora (app.flora.ai) 逆向

> 证据等级标记：〔一手逐字〕= bundle 原文抄录；〔推断〕= 由代码结构推断；〔未找到〕= 语料中未检索到。
> 所有行内代码均为 bundle 逐字标识符，保留混淆后原名。

## 一、产品级摘要

Flora 画布是一个 **类型化有向图编辑器**：每个节点声明「输入槽（inputs）/ 输出槽（outputs）」，连线合法性由三层机制共同决定 —— ①节点类型硬约束（family 规则）、②IO 类型匹配（imageUrl/videoUrl/text/audioUrl/documentUrl/model3dUrl/boolean/realtime）、③目标节点 arity（min/max 连接数）与约束组（exclusive/coexistent 等）。生成型节点根据「当前输入组合」自动切换 **任务模式（mode）**，模式再决定可选模型池（ENDPOINTS）。

### 1.1 节点类型全集

`NodeTypes` 枚举共 **31 种**〔一手逐字，chunk `3w-31noquwqf6.js`，module 99215〕：

| NodeTypes 值 | UI 名称 | nodeFunction 分组 | 角色一句话（bundle description 逐字） |
|---|---|---|---|
| `videoBlock` | Video | video | "Use this video as input for any node which takes a video input." |
| `textBlock` | Text | text | "Takes text input and responds. Use this to experiment \nwith phrasing and ideas for image generation prompts." |
| `comment` | Comment | special | "Leave comments in the workspace." |
| `group` | Field | special | "Organize multiple nodes together." |
| `ghost` | Ghost | special | "Invisible node to keep unconnected edges." |
| `virtualSourceNode` | Virtual Source | special | "Not materialized as a node, used to spawn the respective media nodes." |
| `emptyImageBlock` | Image | image | "An image node to upload or generate an image." |
| `outpaintImageBlock` | Outpaint Image | image | "An image node with outpainted dimensions."（onlySystemAdd） |
| `inpaintImageBlock` | Inpaint Image | image | "An image node with inpainted content."（onlySystemAdd） |
| `staticImageBlock` | Image | image | "An uploaded image."（onlySystemAdd） |
| `staticVideoBlock` | Video | video | "An uploaded video."（onlySystemAdd） |
| `resultImageBlock` | Image | image | "A generated image."（onlySystemAdd） |
| `resultVideoBlock` | Video | video | "A generated video."（onlySystemAdd） |
| `resultTextBlock` | Text | text | "A generated text."（onlySystemAdd） |
| `audioBlock` | Audio | audio | "Generate audio from text input." |
| `resultAudioBlock` | Audio | audio | "A generated audio."（onlySystemAdd） |
| `staticAudioBlock` | Audio | audio | "An uploaded audio."（onlySystemAdd） |
| `techniqueBlock` | Technique | special | "A reusable workflow recipe that runs multiple generations and creates output nodes."（onlySystemAdd） |
| `layerEditorNode` | Layer Editor | special | （无 description）outputKey imageUrl |
| `videoEditorNode` | Timeline Editor | special | （无 description）outputKey videoUrl |
| `collectionNode` | Batch | special | "Aggregates multiple items of the same modality for batch processing." |
| `routerNode` | Router | utilities | "Route multiple inputs of one type to many outputs." |
| `switchNode` | Switch | utilities | "Route execution by evaluating conditions against its inputs." |
| `elementNode` | Element | source | "Reusable visual assets." |
| `textLabel` | Label | special | "Add text labels to the canvas." |
| `notes` | Notes | special | "Write longer notes on the canvas." |
| `codeBlock` | **Action** | special | "Operational tools and functions" |
| `documentNode` | Document | special | "Upload and reference a PDF" |
| `deckNode` | Deck | special | "Arrange images, videos, and text into a presentation." |
| `exportNode` | Export | special | "Push wired assets to a destination." |
| `webcamNode` | Webcam | source | "Capture photos and video from your webcam." |
| `model3dNode` | 3D Model | special | "Import and place a Flora-hosted 3D model." |

分组常量〔一手逐字，module 87597〕：
- 生成型（`GENERATIVE_NODE_TYPE_SET`）：`emptyImageBlock, textBlock, videoBlock, audioBlock`。
- 可 pin（`isPinnableNodeType`）：生成型 + static*、result*、`layerEditorNode, videoEditorNode, collectionNode, exportNode`。
- 历史（`isHistoryNodeType`）：生成型 + result* + `model3dNode`。
- 动态输出（`isDynamicOutputNodeType`）：`collectionNode, routerNode, codeBlock, switchNode`（输出类型运行时才定）。
- 透传（`isPassthroughNodeType`）：`collectionNode, switchNode`。
- 内容节点（`CONTENT_NODE_TYPES`）：生成型 + static*/result* + `layerEditorNode, videoEditorNode, elementNode, model3dNode`。
- `NON_TAGGABLE_TYPES`：`techniqueBlock, collectionNode, elementNode, routerNode, comment`。
- `onlySystemAdd:!0` 的节点用户不能从工具栏直接创建（由系统在生成/派生时创建）。

### 1.2 IO 类型与角色

`NodeInputOutputTypes`（module 87597，逐字）：

```
{ imageUrl, videoUrl, realtime:"realtime", text, audio, documentUrl:"documentUrl",
  boolean:"boolean", model3dUrl }
```
其中 imageUrl/videoUrl/text/audio/model3dUrl 复用 `CORE_IO`（module 106966）：`IMAGE_URL:"imageUrl", VIDEO_URL:"videoUrl", AUDIO_URL:"audioUrl", TEXT:"text", DOCUMENT_URL:"documentUrl", MODEL3D_URL:"model3dUrl"`。

`InputRole`（chunk `13nsutw7u1so2.js`）：`prompt, image, video, audio, firstFrame, lastFrame, mask, reference, seed, aspectRatio`。
`ROLE_BY_IO_TYPE`：`text→prompt, imageUrl→image, videoUrl→video, audioUrl→audio, documentUrl→reference, model3dUrl→reference`。

用户可见语义（ioTypeToHuman，逐字，chunk `440x_k-bktkm8.js`）：
`imageUrl:"image", videoUrl:"video", realtime:"realtime(webcam or realtime node)", text:"text", audioUrl:"audio", model3dUrl:"3D model", documentUrl:"document", boolean:"boolean"`。

### 1.3 交互流程（推断 + 一手混合）

```
用户拖入/生成节点 (addNode)
      │  nodeFactory 按 NodeTypes + nodesConfig 建槽位
      ▼
连线尝试 (getConnectionError 校验管线)
      │  通过 → edgeFactory 建边；失败 → 悬浮英文错误文案
      ▼
recalculateNodeModes：统计上游输入数量
      │  determineBlockMode() 由 (nodeType, 输入组合) 推出 mode
      ▼
mode → ENDPOINTS[mode] 模型池 → 默认/保留模型选择
      │
      ▼
节点运行：输出物落成 result* 节点（onlySystemAdd）或回填本节点
```

## 二、机制级附录

### 2.1 NodeTypes 枚举（逐字）

来源：chunk `3w-31noquwqf6.js`，module 99215，导出名 `NodeTypes`。

```js
var t={}; t.videoBlock="videoBlock", t.textBlock="textBlock", t.comment="comment",
t.group="group", t.ghost="ghost", t.virtualSourceNode="virtualSourceNode",
t.emptyImageBlock="emptyImageBlock", t.outpaintImageBlock="outpaintImageBlock",
t.inpaintImageBlock="inpaintImageBlock", t.staticImageBlock="staticImageBlock",
t.staticVideoBlock="staticVideoBlock", t.resultImageBlock="resultImageBlock",
t.resultVideoBlock="resultVideoBlock", t.resultTextBlock="resultTextBlock",
t.audioBlock="audioBlock", t.resultAudioBlock="resultAudioBlock",
t.staticAudioBlock="staticAudioBlock", t.techniqueBlock="techniqueBlock",
t.layerEditorNode="layerEditorNode", t.videoEditorNode="videoEditorNode",
t.collectionNode="collectionNode", t.routerNode="routerNode",
t.switchNode="switchNode", t.elementNode="elementNode",
t.textLabel="textLabel", t.notes="notes", t.codeBlock="codeBlock",
t.documentNode="documentNode", t.deckNode="deckNode", t.exportNode="exportNode",
t.webcamNode="webcamNode", t.model3dNode="model3dNode";
```

### 2.2 nodesConfig 表（31 节点的槽位声明）

来源：chunk `3w-31noquwqf6.js`，module 87597，导出名 `nodesConfig`（变量 `k`）、`nodeInputKeys`（变量 `U`）、`nodeOutputKeys`（变量 `I`）。

`nodeInputKeys`（单数主输入 key）逐字：
```js
{ textBlock:"text", emptyImageBlock:"imageUrl", inpaintImageBlock:"imageUrl",
  outpaintImageBlock:"imageUrl" }
```

`nodeOutputKeys` 逐字（31 项全量）：
```js
{ textBlock:"text", videoBlock:"videoUrl", comment:void 0, group:void 0, ghost:void 0,
  virtualSourceNode:void 0, emptyImageBlock:"imageUrl", inpaintImageBlock:"imageUrl",
  staticImageBlock:"imageUrl", resultImageBlock:"imageUrl", resultVideoBlock:"videoUrl",
  resultTextBlock:"text", audioBlock:"audioUrl", resultAudioBlock:"audioUrl",
  staticAudioBlock:"audioUrl", staticVideoBlock:"videoUrl", outpaintImageBlock:"imageUrl",
  techniqueBlock:void 0, layerEditorNode:"imageUrl", videoEditorNode:"videoUrl",
  collectionNode:void 0, routerNode:void 0, switchNode:"boolean",
  elementNode:"imageUrl", textLabel:void 0, notes:void 0, codeBlock:void 0,
  documentNode:void 0, deckNode:void 0, exportNode:void 0, webcamNode:void 0,
  model3dNode:"model3dUrl" }   // 注：switchNode 的值是变量 u.boolean
```

`nodesConfig` 逐字要点（完整 31 条，字段：name/displayName/nodeFunction/inputKey/multipleInputKeys/multipleOutputKeys/exclusiveInputGroups/hiddenInputKeys/outputKey/latestVersion/description/onlySystemAdd）：

```js
staticImageBlock: {displayName:"Image", nodeFunction:"image", outputKey:"imageUrl",
  latestVersion:1, description:"An uploaded image.", onlySystemAdd:!0}
staticVideoBlock: {displayName:"Video", nodeFunction:"video", outputKey:"videoUrl",
  latestVersion:1, description:"An uploaded video.", onlySystemAdd:!0}
webcamNode: {displayName:"Webcam", nodeFunction:"source", latestVersion:1,
  description:"Capture photos and video from your webcam."}
resultVideoBlock: {inputKey:["videoUrl"], outputKey:"videoUrl", onlySystemAdd:!0}
resultTextBlock: {inputKey:["text"], outputKey:"text", onlySystemAdd:!0}
outpaintImageBlock: {inputKey:["text","imageUrl"], outputKey:"imageUrl", onlySystemAdd:!0}
resultImageBlock: {inputKey:["imageUrl"], outputKey:"imageUrl", onlySystemAdd:!0}
emptyImageBlock: {inputKey:["text","imageUrl","imageUrl","imageUrl","imageUrl","imageUrl",
  "imageUrl","imageUrl","imageUrl","imageUrl","imageUrl","imageUrl","imageUrl","imageUrl",
  "imageUrl"],  // 1×text + 14×imageUrl（多入口槽位）
  hiddenInputKeys:["enabled"], outputKey:"imageUrl"}
inpaintImageBlock: {inputKey:["text","imageUrl"], outputKey:"imageUrl", onlySystemAdd:!0}
textBlock: {inputKey:["audio"],
  multipleInputKeys:["text","imageUrl","videoUrl","documentUrl"],
  exclusiveInputGroups:[["audio","imageUrl"],["audio","videoUrl"]],
  hiddenInputKeys:["enabled"], outputKey:"text"}
videoBlock: {inputKey:["text"], multipleInputKeys:["imageUrl","videoUrl","audio"],
  hiddenInputKeys:["enabled"], outputKey:"videoUrl"}
audioBlock: {inputKey:["text","imageUrl"], hiddenInputKeys:["enabled"], outputKey:"audio"}
resultAudioBlock: {inputKey:["audio"], outputKey:"audio", onlySystemAdd:!0}
staticAudioBlock: {outputKey:"audio", onlySystemAdd:!0}
techniqueBlock: {onlySystemAdd:!0, hiddenInputKeys:["enabled"],
  multipleInputKeys:["imageUrl","videoUrl","text","audio","documentUrl","model3dUrl"],
  multipleOutputKeys:["imageUrl","videoUrl","text","audio","model3dUrl"]}
layerEditorNode: {multipleInputKeys:["imageUrl","text"], outputKey:"imageUrl"}
videoEditorNode: {multipleInputKeys:["videoUrl","imageUrl","audio","text"], outputKey:"videoUrl"}
collectionNode: {multipleInputKeys:["imageUrl","videoUrl","text","audio","documentUrl"],
  exclusiveInputGroups:[["imageUrl","videoUrl","text","audio","documentUrl"]],
  multipleOutputKeys:["imageUrl","videoUrl","text","audio","documentUrl"]}
routerNode: {multipleInputKeys:["imageUrl","videoUrl","text","audio","documentUrl"],
  exclusiveInputGroups:[["imageUrl","videoUrl","text","audio","documentUrl"]],
  multipleOutputKeys:["imageUrl","videoUrl","text","audio","documentUrl"]}
switchNode: {multipleInputKeys:["imageUrl","videoUrl","text","audio","documentUrl"],
  outputKey:"boolean"}
elementNode: {outputKey:"imageUrl"}
codeBlock: {displayName:"Action", hiddenInputKeys:["enabled"],
  multipleInputKeys:["imageUrl","videoUrl","text","audio"],
  multipleOutputKeys:["imageUrl","videoUrl","text","audio"]}
documentNode: {multipleOutputKeys:["documentUrl","text","imageUrl"]}
deckNode: {multipleInputKeys:["imageUrl","videoUrl","text"]}
exportNode: {multipleInputKeys:["imageUrl","videoUrl","audio"]}
model3dNode: {inputKey:["text","model3dUrl"], multipleInputKeys:["imageUrl"],
  outputKey:"model3dUrl"}
comment/ghost/virtualSourceNode/group/textLabel/notes: {} // 无 IO 槽位
```

### 2.3 节点 schema 定义表（nodeDefinitions，arity 全量）

来源：chunk `13nsutw7u1so2.js`，module 169751 导出 `nodeDefinitions`（变量 `Y`）。schema 结构：`{schemaVersion:1, inputs:[{key,role,type,arity:{min,max}}], outputs:[{key,type}], constraints?}`。`u=Number.MAX_SAFE_INTEGER`（导出名 `UNBOUNDED_ARITY`）〔一手逐字〕。

| 节点（definition 导出名） | inputs（key/role/type/arity） | outputs |
|---|---|---|
| `videoBlockDefinition` | text(Prompt,text,0..1)、imageUrl(Image,0..**9**)、videoUrl(Video,0..1)、audioUrl(Audio,0..1) | videoUrl |
| `textBlockDefinition` | audioUrl(Audio,0..1)、text(Prompt,0..∞)、imageUrl(Image,0..∞)、videoUrl(Video,0..∞)、documentUrl(Reference,0..∞) | text |
| `audioBlockDefinition` | text(Prompt,0..1) | audioUrl |
| `emptyImageBlockDefinition` | text(Prompt,0..1)、imageUrl(Image,0..**14**) | imageUrl |
| `inpaintImageBlockDefinition` | text(Prompt,0..1)、imageUrl(Image,0..1) | imageUrl |
| `outpaintImageBlockDefinition` | text(Prompt,0..1)、imageUrl(Image,0..1) | imageUrl |
| `staticImageDefinition`（schema 常量 `staticImageSchema`） | 无 | output: imageUrl |
| `staticVideoDefinition` | 无 | output: videoUrl |
| `staticAudioDefinition` | 无 | output: audioUrl |
| `resultImageBlockDefinition` | imageUrl(0..1) | imageUrl |
| `resultVideoBlockDefinition` | videoUrl(0..1) | videoUrl |
| `resultTextBlockDefinition` | text(0..1) | text |
| `resultAudioBlockDefinition` | audioUrl(0..1) | audioUrl |
| `techniqueBlockDefinition` | **动态**：`schema:({nodeData})=>({inputs:(nodeData?.inputs??[]).map(P), outputs:(nodeData?.outputs??[]).map(W)})`，P 按 `cardinality==="collection"?0..∞:0..1` | 同左 |
| `codeBlockDefinition` | **动态**：由 `nodeData.parsedSchema` 映射，`dynamic:!0`→0..∞，否则 0..1 | 同左 |
| `batchNodeDefinition`(collectionNode) | 5 槽 imageUrl/videoUrl/text/audioUrl/documentUrl 各 0..∞；`constraints:[{kind:"exclusive",inputs:[5槽全]}]` | 动态：返回第一个非空输入的 modality `[输出同名槽]` |
| `routerNodeDefinition` | 同上 5 槽 0..∞ + exclusive 约束 | 动态：同 batch |
| `switchNode`（无独立 definition，用通用路径） | —（运行时 boolean 判定） | outputKey: boolean |
| `elementDefinition` | 无 | output: imageUrl |
| `documentDefinition` | 无 | output: documentUrl，`when:{kind:"oneOf",options:["documentUrl","text","imageUrl"]}` |
| `model3dNodeDefinition`（schema 常量 `model3dNodeSchema`） | 无 | output: model3dUrl |
| `layerEditorDefinition` | imageUrl(Image,0..∞)、text(Prompt,0..∞) | imageUrl |
| `exportDefinition` | imageUrl/videoUrl/audioUrl 各 0..∞ | 无 |
| `commentDefinition`/`groupDefinition`/`ghostDefinition`/`textLabelDefinition`/`notesDefinition` | `[]` | `[]` |
| `virtualSourceNodeDefinition` | `[]` | `[]` |
| `deckNode`/`webcamNode`/`videoEditorNode`/`switchNode` | **未在 nodeDefinitions 中出现**（仅存在于 nodesConfig）〔一手逐字：Y 表只有 25 个 definition〕 | — |

Schema 层 zod 校验（同 chunk）：输入项 `E`、输出项 `I`（`output.type must be one of when.options when when.kind is oneOf`）。`when` 判定支持 `oneOf` 与 `dependsOn`（依输入 key 的实际连接类型切换输出类型）。

### 2.4 输入校验算法（validateNodeInputs）

〔一手逐字，chunk `13nsutw7u1so2.js`〕issue code 全集：`missing_required_input`、`input_count_exceeded`、`incompatible_type`、`concatenated_text_exceeds_max`、`constraint_violated`。

- arity：`arity.min>=1 && 连接数<min → missing_required_input`；`连接数>max → input_count_exceeded`。
- 类型：`acceptedTypeSet(input)`（含 when 展开）不含已连类型 → `incompatible_type`。
- 多 text/documentUrl 槽支持 `maxLength` 合并上限检查。
- constraints 判定器 `en(e,t)` 逐字：`exclusive`（同组连多个违规）、`coexistent`（要么全连要么全不连）、`requires`（连了 input 就必须连 needs 全部）、`exclusiveWhen`（`when.input` 连接状态等于 `when.connected` 时 input 不得再连）。

### 2.5 输入组合 → 任务模式判定（determineBlockMode）

〔一手逐字，chunk `1ti9dii67la6x.js`，module 741025，函数 `B({nodeType,hasElementParent,numberOfInputImages,numberOfInputVideos,numberOfInputAudios,numberOfInputModel3Ds})`〕

模式枚举全集（逐字）：
- `TextBlockMode`: `textToText, imageToText, imagesToText, videoToText, videosToText, audioToText, mixedToText, deepResearch`
- `ImageBlockMode`: `textToImage, imageToImage, inpaintingImageToImage, outpaintingImageToImage, inOutPaintingImageToImage, imagesToImage`
- `VideoBlockMode`: `textToVideo, imageToVideo, imagesToVideo, firstFrameLastFrame, videoToVideo, mixedToVideo, audioVideoToVideo, audioImageToVideo, audioToVideo`
- `AudioBlockMode`: `textToAudio`
- `Model3DBlockMode`: `textToModel3d, imageToModel3d, model3dToModel3d`
- `CodeBlockMode`: `codeExecution`
- `OtherBlockMode`: `noMode`

判定算法逐字（伪代码化）：
```
codeBlock        → "codeExecution"
inpaintImageBlock→ "inpaintingImageToImage"
emptyImageBlock  → nImg>1 ? imagesToImage : nImg==1 ? imageToImage : textToImage
videoBlock:
  hasElementParent→ nVid>0 ? mixedToVideo : imagesToVideo
  有音频:
    nVid&&nImg → mixedToVideo
    nVid       → audioVideoToVideo
    nImg       → audioImageToVideo
    else       → audioToVideo
  无音频:
    nImg&&nVid → mixedToVideo
    nVid       → videoToVideo
    nImg==1    → imageToVideo
    nImg==2    → firstFrameLastFrame
    nImg>2     → imagesToVideo
    else       → textToVideo
audioBlock       → "textToAudio"
model3dNode      → nM3d>0 ? model3dToModel3d : nImg>0 ? imageToModel3d : textToModel3d
textBlock:
  有音频且无图无视频 → audioToText
  否则 nImg&&nVid→mixedToText / nImg>1→imagesToText / nImg→imageToText
       / nVid>1→videosToText / nVid→videoToText / else→textToText
其余            → "noMode"
```

`getNodeTypeFromMode` 反向映射：text 系→textBlock；image 系→emptyImageBlock；video 系→videoBlock；`textToAudio`→audioBlock；3D 系→model3dNode；`codeExecution`→codeBlock〔一手逐字〕。

模式→模型池（chunk `1ti9dii67la6x.js`，module 410730，`DEFAULT_NODE_MODE` + `ENDPOINTS` Proxy）：
```js
DEFAULT_NODE_MODE = { textBlock:"textToText", emptyImageBlock:"textToImage",
  inpaintImageBlock:"inpaintingImageToImage", outpaintImageBlock:"outpaintingImageToImage",
  videoBlock:"textToVideo", audioBlock:"textToAudio", static*/result*/layerEditor/
  videoEditor/webcamNode:"noMode" }
ENDPOINTS = new Proxy({},{get:(e,mode)=>T[mode]?.()??[]})   // 惰性从 modelService 取
T = { textToVideo: modelService.textToVideoEndpoints,
  imagesToVideo: framesToVideoEndpoints, imageToVideo: imageToVideoEndpoints,
  firstFrameLastFrame: firstFrameLastFrameEndpoints.concat(framesToVideoEndpoints),
  videoToVideo: videoToVideoEndpoints.concat(videoUpscalerEndpoints),
  mixedToVideo: mixedToVideoEndpoints, audioVideoToVideo: audioVideoToVideoEndpoints,
  audioImageToVideo: audioImageToVideoEndpoints, audioToVideo: audioToVideoEndpoints,
  textToImage: textToImageEndpoints, imageToImage: imageToImageEndpoints.concat(imageUpscalerEndpoints),
  imagesToImage: imagesToImageEndpoints, inpainting/outpainting→imageToImageInpainting/OutpaintingEndpoints,
  inOutPainting→imageToImageInpaintingEndpoints, textToText/image|video(s)ToText/textToAudio…,
  deepResearch: [], codeExecution: [], noMode: [] }
```

mode 重算主循环 `recalculateNodeModes`（chunk `440x_k-bktkm8.js`，`ev=(e,t,...)`）：对每个受影响节点统计 `numberOfInputImages/Videos/Audios/Model3Ds`（`countInputImagesAndVideos`，element 子图按 `countElementImages` 展开计数），`resolveParentsThroughRouters` 穿透 router 找 element 父（→hasElementParent），`resolveVideoModeForReferenceOnlyModel` 对 reference-only 模型做 imageToVideo↔imagesToVideo 修正，再按新 mode 重选模型（保留原模型若兼容，否则按 `orderEndpoints` 排序选默认）并合并 `modelParameters`（含 aspect_ratio auto）。

### 2.6 连接合法性规则（三层）

#### 第 1 层 · 类型家族硬约束 `getNodeTypeFamilyError`（函数 `g`）
〔一手逐字，chunk `440x_k-bktkm8.js`〕
- `routerNode → collectionNode`："Router cannot connect to Batch yet. Connect sources directly to Batch, or wire the router to blocks first."
- `routerNode → layerEditorNode`："Routers can't connect to layer editor nodes — connect the source directly"
- `collectionNode → collectionNode | layerEditorNode` → `BATCH_CHAIN_TARGET_ERROR` =
  "Batch chain nodes can only connect to image, video, text, audio, 3D, action, or technique blocks"（逐字，变量 `m`）
- `documentNode → layerEditorNode`："Documents can't connect to the Layer Editor yet"；`documentNode → audioBlock`："Documents can't connect to an Audio block"
- `elementNode → 非 emptyImageBlock/resultImageBlock/videoBlock/routerNode/techniqueBlock`："Elements can only connect to image, video, router, or technique nodes"

`eJ`（导出 `getEdgeConnectionError`，同 chunk）流程：先 `getNodeTypeFamilyError(source→target)`；再 `walkSourceThroughRouters` 展开源侧链路，链上任一 `collectionNode` 指向 batch-incompatible 目标即 BATCH_CHAIN_TARGET_ERROR；最后按 `getPossibleOutputTypes(source)∩canNodeConfigAcceptInputType(nodesConfig[target])` 生成文案 `Cannot connect ${ioTypeToHuman[X]} to an input that only accepts ${...}`。

`getPossibleOutputTypes` 语义：switch 按 `switchOutputMode(data)` 返回 `["boolean"]` 或锁定 key；动态输出节点（collection/router/codeBlock）用 `normalizeDynamicOutputKey`；model3dNode 输出 `[model3dUrl, imageUrl]`（可降级连 image 槽）〔一手逐字〕。

#### 第 2 层 · 图结构规则（store 级 `getConnectionError` 主管线）
〔一手逐字，chunk `3ldpt1pk51grl.js`〕按执行顺序：
1. `!e||!o → "Missing Blocks"`；`e===o → "Self connect not allowed"`。
2. `isStaticTextNode(source) && 源=textBlock 且 staticText → "Static text nodes don't take inputs"`（目标为静态文本）。
3. 源或目标是 router 且 `wouldCreateCycle → "Connection would create a cycle"`（DFS 沿 childrenMap）。
4. 源链（穿 router）中 collectionNode/batch 链 → batch 兼容检查（同上）。
5. element→video 时按端点 `getEffectiveMaxImageInputs(endpoint) = max(0, options.maxInputs - getReservedImageInputs)` 检查 image 预算，超限 → "This model's image limit is already exceeded"。
6. `singleElementPerVideoConnectionError`：一个 video 节点（videoBlock/resultVideoBlock，穿 router 收集）只能接 1 个 element → "Video nodes support a single element connection"。
7. `singleInputPerSwitchError`：switch 只能有一个输入 → "Switch nodes accept a single input"。
8. `switchValueOutputToRouterError`：switch 的 value 输出不得经 router 中转 → "Connect a switch's value outputs directly to a node, not through a router"。
9. `resolveSourceForTarget` 解析实际源；`getTargetHandleInputType` 解析目标槽类型；`model3dUrl` 特判：若源侧 `dynamicNodeCanOfferModel3D`（源是动态输出或其子图含 3D 输出）则源视为 3D。
10. 无输入槽/无输出类型 → collectionNode: "Connect items to the batch first"；switchNode: "Connect an input first"；否则 "Invalid Blocks"。
11. boolean 槽特判：boolean 输出只能接 boolean 输入槽或隐藏槽（"Connect boolean outputs to a boolean input"）。
12. 显式模型（非 auto）时 `getAcceptedInputTypesForModel(model)` 不含源类型 → "The selected model doesn't accept ${ioTypeToHuman[H]} input"（element→videoBlock 例外）。
13. collection 输出锁定 `normalizeDynamicOutputKey` + `dynamicLockAcceptsSourceType`（允许 model3d↔image 互换）→ "This batch only accepts ${...}"。
14. videoEditorNode 按 `getVideoEditorInputKindFromOutputType` 分轨计数（后接 `This action only accepts ${t}` 系列文案）。

#### 第 3 层 · schema 级 validateProposedEdge（module 169751 导出，逐字全文）
```js
validateProposedEdge = function(e){
  let t=H(e.source.definition,e.source.ctx), i=H(e.target.definition,e.target.ctx), n=[],
      r=er(t.outputs,e.source.outputKey), o=er(i.inputs,e.target.inputKey);
  if(!r||!o) return n.push({code:"incompatible_type",inputKey:e.target.inputKey??o?.key??""}),
    {status:"invalid",issues:n};
  let s=ee(r,t,e.source.ctx), u=Z(o,i,e.target.ctx);
  [...s].some(e=>u.has(e)) || n.push({code:"incompatible_type",inputKey:o.key});
  (e.target.ctx.inputs[o.key]?.length??0)===o.arity.max
    && n.push({code:"input_count_exceeded",inputKey:o.key,max:o.arity.max});
  // constraints 模拟“连上之后”的满足性 …
  return n.length>0?{status:"invalid",issues:n}:{status:"valid",isRunnable:!1}}
```

#### 附加规则
- **enabled gate**：每个生成块有隐藏输入 `enabled`（`ENABLED_INPUT_HANDLE_ID:"enabled"`，`ENABLED_INPUT_DEFAULT:!0`）。`isEnabledGateEdge=e6:e.targetHandle==="enabled"`；`connectsToEnabledGate(y)=源输出为 boolean 且目标 hasHiddenInputOfType(boolean)`〔一手逐字，chunk `440x_k-bktkm8.js` / module 672317〕。隐藏槽定义表逐字：`{"enabled":{id:"enabled",name:"Enabled",type:"boolean",min:0,max:1,defaultValue:true}}`。
- **switch 条件算子**（chunk `3d6au3l0x3k0q.js`，module 16903）：`OPERATOR_KIND = {equals:"string",notEquals:"string",contains:"string",notContains:"string",isEmpty:"presence",isNotEmpty:"presence",greaterThan:"numeric",lessThan:"numeric",greaterThanOrEqual:"numeric",lessThanOrEqual:"numeric"}`，符号表 `OPERATOR_SYMBOL`（`= ≠ ⊃ ⊅ ∅ ≠∅ > < ≥ ≤`），`DEFAULT_CASE_HANDLE_ID:"default"`。
- **codeBlock IO 契约**（chunk `0-shlriu0gzsu.js`）：`CODE_BLOCK_IO_TYPES=["image","video","text","audio","model3d"]`，与 Node IO 双向映射表 `CODE_BLOCK_IO_TYPE_TO_NODE_IO_TYPE` / `NODE_IO_TYPE_TO_CODE_BLOCK_IO_TYPE`；`codeDeclaresPreview=/^\s*export\s+const\s+preview\b/m`；参数注解 `@flora-params:`（`//` 或 `#` 注释行）。`FLORA_FUNCTIONS_BY_ID` 预置函数：`color-grade-image`（"Adjust colors, tone, and contrast"）、`color-grade-video`、`stitch-videos`（"Join multiple clips into one"）、`split-video`（"Cut a video into segments"）；`getCodeExecutionCost`：有 `codeUrl` 时 0 积分，预置函数按 `creditCost`〔一手逐字，chunk `1ti9dii67la6x.js`，module 665343〕。
- **模型 capability → schema 映射**（module 169751 导出 `mapModelCapabilityToNodeSchema`）：类型映射 `IMAGE:"imageUrl",VIDEO:"videoUrl",AUDIO:"audioUrl",TEXT:"text",DOCUMENT:"documentUrl",MODEL3D:"model3dUrl"`；参数枚举值含 `costOffset/costOffsetDollars/costMultiplier/previewUrl`；`selectAutoModel` 按 scoring（`{input,output,score}`）+ updatedAt + deprecated + pinnedModelId 排序自动选模型。
- **maxImageInputs 预算**：`getEffectiveMaxImageInputs(endpoint)=max(0,(endpoint.options.maxInputs??Infinity)-getReservedImageInputs(endpoint))`；超限截断提示 "supports up to ${n} input images — only the first ${n} will be used."〔一手逐字，chunk `3d6au3l0x3k0q.js`〕。

### 2.7 特殊节点语义

- **techniqueBlock**：nodesConfig 声明 6 输入 5 输出槽（见 2.2），schema 动态来自 `nodeData.inputs/outputs`（technique 发布产物），`cardinality:"collection"` 的槽 0..∞。addNode 时对 technique 特殊处理：连接源不自动建边（`isTechniqueBlockNode` 分支），router 叶子数 >1 的源不预连〔一手逐字，chunk `3ldpt1pk51grl.js` addNode〕。builder 状态含 `currentStep:"inputs"|"workflow"`、`editingTechniqueNodeId/Slug`、`preparedPublishGraph`〔一手逐字，chunk `0c6ddwvie1pby.js`〕。
- **collectionNode（Batch）**：5 模态槽互斥（exclusive）；输出槽由第一个非空输入 modality 决定（`batchNodeDefinition` outputs 函数）；可锁定 `data.outputKey`（`dynamicLockAcceptsSourceType` 校验，model3d↔image 可互换）；`T(e,t)` 判定 batch 的虚拟输出类型（model3d 锁定时对外表现为 imageUrl）〔一手逐字〕。子项 key 体系：`collectionItemKey("node"|"upload"|"text-split", id)`〔一手逐字，chunk `440x_k-bktkm8.js` module 232652〕。
- **routerNode**："one type → many outputs" 的分流器；穿 router 语义遍布全库（`walkSourceThroughRouters`、`resolveParentsThroughRouters`、`expandAffectedNodeIdsThroughRouterChildren`）；不可连 batch/layerEditor；cycle 检查对 router 双向生效；element 经 router 展开为多条虚拟边（edge id 后缀 `::router-resolved::`）〔一手逐字，chunk `440x_k-bktkm8.js`〕。
- **switchNode**：单输入；输出双模 `switchOutputMode(data)=data.outputMode??"value"`（value 模式输出 booleans 对象，boolean 模式输出 true/false 门控）；boolean 模式的输出可作其它节点的 `enabled` gate 输入；条件判定用 OPERATOR_* 表 + `switchCaseConditions(e)=[e,...e.andConditions??[]]`〔一手逐字〕。
- **codeBlock（UI 名 Action）**：schema 由用户代码 `parsedSchema` 动态生成；`floraFunction` 字段可引用预置函数（getSchemaForNode/getCodeForNode）；hidden enabled 输入；动态输出可提供 model3D〔一手逐字〕。
- **elementNode**：可复用素材，输出 imageUrl；连接白名单极窄（image/video/router/technique）；多图 element 在数据流展开为 `::element-item::${i}` 虚拟边；每 video 限 1 个 element；`MAX_ELEMENT_IMAGE_COMPONENTS=8`〔一手逐字，module 87597〕。
- **exportNode**：输入 image/video/audio 各 0..∞，无输出；"Push wired assets to a destination"（对接 provider：frameio/arena/aem/dropbox/google drive/shopify/local，`resolveFolderUrl` 逐字含各 provider 域名）〔一手逐字，chunk `1ti9dii67la6x.js`〕。
- **documentNode**：无输入；输出 `when:{kind:"oneOf",options:["documentUrl","text","imageUrl"]}`（同一输出槽可按上下文产出三种类型）；禁入 layerEditor/audioBlock〔一手逐字〕。
- **ghost / virtualSourceNode**：不可见（`isVisibleNodeType` 排除二者）；ghost 边（id 前缀 `ghost`）在各校验中被跳过；virtualSource 不物化，仅用于派生 spawn 对应 media 节点〔一手逐字〕。
- **deckNode**：Deck 演示装配（image/video/text 输入）；addNode 时记录 `createdByUserId: workspaceUser._id`〔一手逐字，chunk `3ldpt1pk51grl.js`〕。schema 未在 nodeDefinitions 中 → deck 是特殊运行时节点〔推断〕。
- **webcamNode**：source 分组，无 IO schema（noMode），realtime IO 类型为其专属扩展（`NodeInputOutputTypes.realtime`）〔一手逐字 + 推断〕。

### 2.8 addNode 机制（节点创建 → 自动布线）

〔一手逐字，chunk `3ldpt1pk51grl.js`〕`addNode(nodeType, config, edgeHint?, position?, input?, id?, parentId?, …)`：
- id 默认 `crypto.randomUUID()`；位置由 `calculateAddNodePosition`（源/目标节点邻近避让）。
- `configureInitialInput` 按类型初始化输入；`textBlock/emptyImageBlock/inpaintImageBlock/outpaintImageBlock/videoBlock` 会 seed 示例 prompt（`resolveInitialExamplePrompt`）。
- `nodeFactory` 应用 preconfiguration；deckNode 附加 `createdByUserId`。
- 新节点自动入 intersecting group（`assignNodesToIntersectingGroups`）。
- 若带 edgeHint（source/target），自动 `edgeFactory` 预连一条边（technique 与 enabled-gate 例外，见 2.7）。

## 三、证据与来源

### chunk 清单（本报告全部一手证据来源）
| chunk | turbopack module | 内容 |
|---|---|---|
| `3w-31noquwqf6.js` | 99215 / 106966 / 87597 | NodeTypes、CORE_IO、NodeInputOutputTypes、nodesConfig、nodeInputKeys/nodeOutputKeys、is* 判定函数、MAX_ELEMENT_IMAGE_COMPONENTS |
| `13nsutw7u1so2.js` | 169751 及子模块 | nodeDefinitions 全表、InputRole/roleCatalog、arity、constraints、validateNodeInputs、validateProposedEdge、acceptedTypeSet/producedTypeSet、mapModelCapabilityToNodeSchema、selectAutoModel、NurseryModelItemSchema |
| `1ti9dii67la6x.js` | 741025 / 334229 / 410730 / 665343 / 348174 | determineBlockMode、BlockMode 枚举、getModeLabel、getNodeTypeFromMode、switchOutputMode、isValid*Output guards、ENDPOINTS Proxy、DEFAULT_NODE_MODE、codeBlock 成本/FLORA_FUNCTIONS、filterEndpointsByInputCounts |
| `440x_k-bktkm8.js` | 510921 等大图工具模块 | getEdgeConnectionError(eJ)、getNodeTypeFamilyError(g)、BATCH_CHAIN_TARGET_ERROR、singleElementPerVideoConnectionError、singleInputPerSwitchError、switchValueOutputToRouterError、wouldCreateCycle、getPossibleOutputTypes、dynamicLockAcceptsSourceType、dynamicNodeCanOfferModel3D、connectsToEnabledGate、recalculateNodeModes(ev)、getHiddenInputSlots、ENABLED_INPUT_HANDLE_ID、partitionEnabledGateSources、collection 工具族 |
| `3ldpt1pk51grl.js` | canvas store | getConnectionError 主管线全文、addNode 全文、"Cannot connect …" 文案、resolveSourceForTarget 调用序 |
| `3d6au3l0x3k0q.js` | 16903 等 | ENABLED/DEFAULT_CASE handle 常量、OPERATOR_KIND/SYMBOL、switchCaseConditions、getEffectiveMaxImageInputs |
| `0-shlriu0gzsu.js` | 989750/87597 相关 | CODE_BLOCK_IO_TYPES、双向映射、codeDeclaresPreview、@flora-params 解析 |
| `0c6ddwvie1pby.js` | technique builder store | builder 状态字段（inputs/workflow 步骤、preparedPublishGraph） |
| `1_yikyizvac65.js` | resolveCollectionNodeItemDisplay | collection item 展示 modality 解析 |
| `1hayrh3hp9xtt.js` | 模型切换面板 | determineBlockMode 的 image→mode 回退用法 |

### 可复现命令
```bash
# 1) NodeTypes / nodesConfig
grep -o 'videoBlock="videoBlock"' /tmp/flora-chunks/3w-31noquwqf6.js
python3 -c "d=open('/tmp/flora-chunks/3w-31noquwqf6.js').read();i=d.find('let U={[n.NodeTypes.textBlock]');print(d[i:i+9000])"

# 2) nodeDefinitions / validateProposedEdge
python3 -c "d=open('/tmp/flora-chunks/13nsutw7u1so2.js').read();i=d.find('codeBlockDefinition');print(d[i-900:i+6200])"

# 3) determineBlockMode
python3 -c "d=open('/tmp/flora-chunks/1ti9dii67la6x.js').read();i=d.find('function B({nodeType');print(d[i:i+1400])"

# 4) 连接校验管线
python3 -c "d=open('/tmp/flora-chunks/3ldpt1pk51grl.js').read();i=d.find('getConnectionError:(e,o,n,i)');print(d[i:i+5200])"

# 5) family 规则 / batch 链错误
python3 -c "d=open('/tmp/flora-chunks/440x_k-bktkm8.js').read();i=d.find('function g(e,t){var r');print(d[i:i+800])"
```

### 缺口（诚实声明）
- **未找到**：`deckNode`、`webcamNode`、`videoEditorNode`、`switchNode` 的 nodeDefinitions 级 schema（只存在于 nodesConfig；〔推断〕它们由专用运行时处理而非通用 schema 校验器）。
- **未找到**：`ENDPOINTS` 各 modelService 端点数组的具体模型清单（在另一模块 modelService，超出本主题边界）。
- **推断**：`NodeInputOutputTypes.realtime` 仅见引用（webcam/realtime），未找到其完整类型表条目。
- 文件大小核查：本报告引用的 10 个 chunk 均为有效 JS（无 Not Found 错误页）。
