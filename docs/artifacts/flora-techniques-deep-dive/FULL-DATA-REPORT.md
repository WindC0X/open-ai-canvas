# Flora 全量数据报告（2026-09-30）

> **本报告取代**此前的分散补充档。基于**全量抓取**：112 技法 graph + Fashion Studio 工具 graph。
> 证据等级：**一手逐字**（Convex 运行时数据）。
> 抓取方式：登录态浏览器 → React fiber 取 Convex client → `techniques/publicQueries:getVisibleTechniques` + `techniques/clientQueries:getTechniqueBySnapshotId` / `getTechnique`。

---

## 0. 抓取结果总览

| 数据集 | 数量 | 成功率 | 落盘 |
|---|---|---|---|
| **技法（Techniques）** | **112/112** | 100%（0 失败） | `data/techniques-graphs-full.json`（2.0 MB） |
| **Fashion Studio 工具** | **8/13**（DOM 可见的） | 100% | `data/studio-tools.json`（130 KB） |
| 技法索引 | 112 | — | `data/INDEX.json` / `INDEX.md` |
| 类别提示词库 | 384 条唯一提示词 | — | `data/prompts/*.json`（11 个类别） |
| Studio 工具提示词 | 15 条 | — | `data/studio-tools-prompts.json` |

### 规模统计

```
技法总数        112
节点总数        466
边总数          1211
含提示词节点    600
唯一提示词      412 条（530,545 字符）
模型总数        48 个
IO 模式         12 种
类别            11 种
```

---

## 一、技法全量（112 个）

### 1.1 索引（按 runs 降序 TOP20）

| # | 技法 | slug | 类别 | runs | cost | 节点 | 边 | 入 | 出 | 提示词 | 模型 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Background Remover | `background-remover` | essentials | 52399 | — | 0 | 2 | 1 | 1 | 2 | — |
| 2 | CCTV Cam | `cctv-cam` | funInspiration | 15257 | 311 | 3 | 6 | 1 | 1 | 3 | Claude Opus 4.6, Nano Banana Pro |
| 3 | Character Lock | `character-lock` | brandVisualDesign | 8034 | 400 | 10 | 25 | 2 | 4 | 2 | Nano Banana 2, Nano Banana Pro |
| 4 | Mood Board Maker | `moodboard-maker` | brandVisualDesign | 5978 | 370 | 1 | 2 | 1 | 1 | 2 | Claude Opus 4.6, Nano Banana Pro |
| 5 | Logo to Brand Identity | `logo-to-brand-identity` | brandVisualDesign | 4691 | 380 | 3 | 11 | 1 | 1 | 3 | Claude Opus 4.6, Nano Banana Pro |
| 6 | Product Lookbook Grid | `product-lookbook-grid` | productVisualization | 3396 | 236 | 1 | 2 | 1 | 1 | 2 | GPT-5.2, Nano Banana Pro |
| 7 | Product Animator | `product-animator` | productVisualization | 3355 | 40 | 2 | 4 | 1 | 1 | 3 | Claude Opus 4.6, Kling O1 |
| 8 | Fit Check | `fit-checks` | fashionApparelEditorial | 3233 | 311 | 1 | 2 | 1 | 1 | 2 | Claude Sonnet 5, Nano Banana Pro |
| 9 | Image Upscaler | `image-upscaler` | essentials | 2515 | 312 | 2 | 3 | 1 | 1 | 1 | GPT Image 2, Magnific Precision Upscaler V2 |
| 10 | Prompt Extractor | `prompt-extractor` | essentials | 2499 | 72 | 0 | 2 | 1 | 1 | 2 | Claude Sonnet 4.6 |
| 11 | Product to Ad Visuals | `turn-any-product-into-4-ad-visuals` | marketingAds | 1738 | 320 | 0 | 4 | 1 | 4 | 4 | Nano Banana 2 |
| 12 | Garment Sketch | `sketch-to-garment` | fashionApparelEditorial | 1529 | 61 | 0 | 3 | 1 | 1 | 1 | GPT-5.2, Nano Banana |
| 13 | Garment Extractor | `garment-extractor` | fashionApparelEditorial | 1375 | 600 | 5 | 12 | 2 | 1 | 4 | Claude Opus 4.8, Gemini 3 Pro, GPT-5.5, Nano Banana Pro |
| 14 | Product recolor | `product-recolor` | fashionApparelEditorial | 989 | 1376 | 1 | 3 | 1 | 6 | 4 | GPT-5.2, GPT-5.5, Nano Banana 2 |
| 15 | Video Scene Builder | `video-scene-builder` | videoAnimation | 971 | 2670 | 1 | 4 | 1 | 1 | 3 | Claude Opus 4.6, Kling 3.0 Pro, Nano Banana Pro |
| 16 | Product Motion | `product-motion` | videoAnimation | 876 | 797 | 1 | 3 | 1 | 1 | 3 | GPT-5, Kling 2.5 Turbo Pro, Nano Banana Pro |
| 17 | Relighting | `relight-technique` | contentPackaging | 848 | 580 | 3 | 7 | 1 | 4 | 3 | GPT-5.2, Nano Banana Pro |
| 18 | 3 Angle Shoot | `3-angle-shoot` | essentials | 705 | 360 | 1 | 3 | 1 | 3 | 2 | Claude Opus 4.6, Nano Banana 2 |
| 19 | Image Recolor | `image-recolor` | essentials | 643 | 100 | 1 | 3 | 2 | 1 | 1 | Claude Sonnet 4.6, Nano Banana Pro |
| 20 | Garment to Vector | `garment-to-vector` | fashionApparelEditorial | 421 | 1380 | 2 | 7 | 1 | 1 | 4 | Arrow 1.1 Max, Claude Sonnet 5, GPT Image 2, Gemini Flash 3.7 |

**全量 112 见 `data/INDEX.md`。总 runs 147,093。**

### 1.2 类别分布（11 类）

| 类别 | 数量 | 提示词数 |
|---|---|---|
| funInspiration | 16 | 104 |
| fashionApparelEditorial | 16 | 123 |
| brandVisualDesign | 15 | 64 |
| essentials | 13 | 48 |
| productVisualization | 12 | 80 |
| marketingAds | 8 | 60 |
| videoAnimation | 8 | 37 |
| （无类别） | 8 | 23 |
| spaceArchitecture | 6 | 21 |
| contentPackaging | 5 | 21 |
| printFilmVfx | 5 | 19 |

### 1.3 模型分布（48 个模型）

**图像模型 TOP8**

| 模型 | 出现次数 |
|---|---|
| **Nano Banana Pro** | 186 |
| **Nano Banana 2** | 140 |
| GPT Image 2 | 30 |
| Flux 2 | 11 |
| Nano Banana 2 Lite | ~10 |
| Qwen Image Edit Plus | — |
| Magnific Precision Upscaler V2 | — |
| Seedream 5 Pro | — |

**LLM TOP8**

| 模型 | 出现次数 |
|---|---|
| Claude Sonnet 4.6 | 71 |
| Claude Opus 4.6 | 68 |
| GPT-5.5 | 36 |
| GPT-5.2 | 35 |
| GPT-5.4 | 27 |
| Claude Sonnet 5 | 21 |
| Claude Opus 4.8 | 19 |
| Claude Opus 5 | 15 |

**其他**：Gemini 3 Pro（14）/ Gemini Flash 3.7（11）/ Gemini 3.1 Pro / Gemini 3 Flash；视频侧 Kling O1 / Kling 2.5 Turbo Pro / Kling 3.0 Pro / Seedance 2.0 / Seedance 2.0 Fast。

### 1.4 IO 模式（12 种）

| 模式 | 次数 |
|---|---|
| imageToImage | 249 |
| textToText | 229 |
| imageToText | 94 |
| imagesToImage | 87 |
| （无 mode） | 51 |
| textToImage | 50 |
| imagesToText | 38 |
| imageToVideo | 18 |
| codeExecution | 10 |
| firstFrameLastFrame | 6 |
| textToVideo | 5 |
| textToAudio | 1 |

### 1.5 节点类型分布

| 类型 | 数量 |
|---|---|
| textBlock | 341 |
| emptyImageBlock | 60 |
| staticImageBlock | 43 |
| codeBlock | 10 |
| resultTextBlock | 9 |
| videoBlock | 2 |
| collectionNode | 1 |

**关键洞察**：`textBlock` 占 73%（341/466）——**技法图的本质是「提示词节点 + 生成节点」的编排**，而非复杂拓扑。

---

## 二、Fashion Studio 工具（8/13 已抓）

### 2.1 工具清单与机制

| 工具 | name | slug | cost | 节点 | 边 | 入 | 出 | 模型链 |
|---|---|---|---|---|---|---|---|---|
| **Prompt** | Prompt | `prompt` | 48 | 0 | 5 | 5 | 1 | Claude Sonnet 5 + Nano Banana 2 Lite |
| **Sketch** | Sketch to Render | `sketch-to-render-u5ew94` | 108 | 1 | 4 | 2 | 1 | Claude Sonnet 5 + Gemini Flash 3.6 + Nano Banana 2 Lite |
| **Extract** | Garment Extractor | `garment-extractor-qcjn3m` | 141 | 3 | 7 | 2 | 1 | GPT-5.5 + Gemini 3 Flash + Gemini Flash 3.6 + Nano Banana 2 |
| **Ghost** | Ghostform | `ghostform` | 230 | 1 | 3 | 1 | 1 | GPT-5.5 + Nano Banana 2 |
| **Flat** | Flatlay | `flatlay` | 198 | 1 | 3 | 1 | 1 | GPT-5.5 + Nano Banana 2 Lite |
| **Recolor** | Garment Recolor | `garment-recolor-3gkapi` | 200 | 5 | 9 | 3 | 1 | Claude Sonnet 5 + Nano Banana Pro |
| **Try-On** | Model Try-On | `model-try-on-e381zg` | 208 | 1 | 5 | 2 | 1 | Claude Sonnet 5 + Nano Banana Pro |
| **360** | 360 Garment Video | `360-garment-video` | 2896 | 1 | 5 | 2 | 1 | Claude Opus 5 + Seedance 2.0 |

**未抓到的 5 个**：Fabric Swap（`fabric-swap`）/ Model Maker（`model-maker`）/ Garment Swap（`garment-swap`）/ Photo Shoot（`photo-shoot`）/ 360 Model Video（`360-model-video`）/ Multi-Angle Shoot（`multi-angle-shoot`）
→ **原因**：`resolveStudioRailGroupedSections(技法列表)` 从**当前项目已添加的技法节点**里筛，DOM 只渲染了这 8 个。补齐需在项目里逐个添加其余工具。

### 2.2 工具链的流水线语义（★ 核心发现）

这 8 个工具**不是独立的**，而是一条**服装电商流水线**：

```
【Prompt】  任意图像生成（5 图输入 + 提示词）
    │
【Sketch】  手绘草图 → 照片级服装渲染          inputs: sketch + design-direction
    │
【Extract】 从穿搭照抠出服装（ghostform）      inputs: outfit + garment-mask
    │
【Ghost】   flatlay → 幽灵模特（3D 穿着形态）  inputs: flatlay-garment
    │
【Flat】    ghostform → flatlay（细节保留）    inputs: ghostform-garment   ← 与 Ghost 互为逆操作
    │
【Recolor】 改色（on-model / flatlay / ghostform 皆可）  inputs: base-garment + mask + color
    │
【Try-On】  model + garment → 上身效果          inputs: model + outfit
    │
【360】     garment → 3D 环绕视频               inputs: garment + backview
```

**关键**：`Ghost`（flatlay→ghostform）与 `Flat`（ghostform→flatlay）**互为逆操作**——这解释了 Flora 的**服装形态转换矩阵**：

```
        ┌──────────┬──────────┬──────────┐
        │ flatlay  │ ghostform│ on-model │
   ┌────┼──────────┼──────────┼──────────┤
flatlay │    —     │  Ghost   │  Try-On  │
ghostform│  Flat    │    —     │  Try-On  │
on-model│ Extract  │ Extract  │    —     │
   └────┴──────────┴──────────┴──────────┘
```

### 2.3 提示词工程范式（★ 最高价值发现）

**Flora 的提示词不是自然语言描述，而是结构化契约**。三种范式：

#### 范式 1：`@[引用]` 语法 + ROLE 定义

```text
INPUT ROLES:
@[flatlay-garment] = GARMENT_REFERENCE. ROLE: exact garment reproduction only.
Capture the fabric, wash, color, proportions, and every construction detail
with absolute fidelity. Ignore any accessories, jewelry, props, belts, scarves,
or items on or near the garment—reproduce the garment alone.
Take no background, environment, or context from it.

RULES:
Reproduce the exact garment from @[flatlay-garment] with absolute fidelity:
fabric type, wash and fade pattern, color, proportions, closure type,
pocket count and construction, seam and panel lines, sleeve construction and
width, hem construction, collar or neckline type, hardware, and topstitch color.
Transform the flatlay into a professional ghost-form product photo: fill the
garment to its natural worn 3D shape as if worn by an invisible body.
```

**结构**：`INPUT ROLES`（定义每个引用的角色与边界）→ `RULES`（逐条约束）→ **逐细节保真清单**（fabric/wash/color/proportions/closure/pocket/seam/sleeve/hem/collar/hardware/topstitch）。

#### 范式 2：mask 语义显式声明

```text
Input Roles:
- BASE_IMAGE (Image 1): Owns the garment, its presentation, composition, shape,
  details, lighting, and all non-edited pixels
- GARMENT_MASK (Image 2): a cutout of Image 1. Only the pixels to recolor are
  visible; everything else is transparent and may render as black.
  It is a selection, not a reference photo of the garment.
- TARGET_COLOR: the color reference (what color to apply)

Task: Recolor part of the garment in Image 1 to [TARGET_COLOR].

Image 2 is a selection map, not a photo to copy from. It was cut out of Image 1:
the region to recolor appears with its original fabric pixels, and everything
else is transparent (note: transparent may be rendered as black).
Treat the fabric visible in Image 2 as a stencil that marks where to edit.
Do not copy its current color, do not treat it as a color reference, and do not
recolor anything that is black in Image 2.
```

**关键**：**显式警告模型不要把 mask 当参考图**（"Do not copy its current color"）+ 解释透明区可能渲染为黑（"transparent may be rendered as black"）——**这是对模型常见误解的预防性说明**。

#### 范式 3：两段式（LLM 出提示词 → 图像模型执行）

```
① textToText / imageToText 节点（Claude/GPT-5.5）
   输入：用户图 + 简短意图
   输出：完整结构化提示词（5000-9000 字符）
        ↓
② imageToImage 节点（Nano Banana 2/Pro）
   输入：原图 + ① 生成的提示词
   输出：最终图像（提示词仅 900-1500 字符）
```

**证据**（Ghost 工具）：

| 节点 | 模式 | 模型 | 提示词长度 |
|---|---|---|---|
| ① | imageToText | GPT-5.5 | **3421 ch** |
| ② | imageToImage | Nano Banana 2 | **1254 ch** |

**这解释了为什么 Flora 的提示词那么长**：LLM 节点生成详细规格，图像模型节点执行简化指令。

---

## 三、5 个 Tool 的机制覆盖度

| Tool | 机制覆盖 | 数据来源 | 缺口 |
|---|---|---|---|
| **Bulk Generate** | ✅ 完整 | `t07-bulk-generate.md`（31.8 KB） | 无 |
| **Fashion Studio** | ✅ **机制完整**（8/13 工具 graph + 提示词） | 本报告 §2 + `t06-studios-fashion.md` | 5 个工具未抓（需项目内添加） |
| **Director** | ✅ 机制级 | `imagine-tools-deep-dive.md` | 无（`minimax/h3-max/director` 协议完整） |
| **Pose** | ✅ 机制级 | `imagine-tools-deep-dive.md` | 无（`fal-ai/flux-2/klein` + `schedule_mu` 公式完整） |
| **Realtime** | ✅ 机制级 | `imagine-tools-deep-dive.md` | 无（`decart/lucy-2-5/realtime` 原生 WebRTC 完整） |

---

## 四、对影策（open-ai-canvas）的迁移价值

### 4.1 最高价值：提示词工程范式

**Flora 的提示词可直接参照**（影策电商线 B 线正在做）：

| 影策功能 | 可参照的 Flora 工具 | 参照内容 |
|---|---|---|
| **F-01 抠图/白底** | `Background Remover`（52399 runs，最高）+ `Garment Extractor` | 抠图提示词的边界处理 |
| **F-02 场景图** | `uoi-image-generator` + `relight-technique` | 场景/打光提示词 |
| **F-04 模特换装** | `Model Try-On`（8778 ch 提示词）+ `Ghostform` | ★ **完整的上身效果提示词** |
| **F-07 修复** | `relighting-photoshoot` | 打光修复 |
| **F-08 局部修改** | `Garment Recolor`（mask 语义范式） | ★ **mask 引用与语义声明** |
| **F-09 爆款复刻** | `editorial-fashion-shoot-replicator` | 风格复刻 |
| **F-12 批量基础** | `3-angle-shoot` / `Product Package on White` | 输出布局 |

### 4.2 三个可直接借鉴的机制

1. **`@[引用]` 语法 + INPUT ROLES 段**：把"哪张图是什么角色"显式声明，避免模型误用参考图
2. **mask 语义预防性说明**：显式写"不要把 mask 当参考图"+ 解释透明区渲染行为
3. **两段式提示词生成**（LLM 出规格 → 图像模型执行）：长提示词由 LLM 生成，图像模型只收精简版

### 4.3 服装形态转换矩阵

影策若做服装电商，`flatlay ↔ ghostform ↔ on-model` 的三态转换是**基础能力矩阵**，Flora 用 5 个工具覆盖（Ghost/Flat/Extract/Try-On/Recolor）。

---

## 五、缺口（诚实登记）

| # | 缺口 | 原因 | 补齐方式 |
|---|---|---|---|
| 1 | Fashion Studio 剩余 5 工具 | DOM 只渲染项目已添加的 8 个 | 在项目里逐个添加工具后重抓 |
| 2 | Studio 工具的 `estimatedTime` | 字段为空 | 服务端数据 |
| 3 | 技法 `runs` 需二次抓取 | `getVisibleTechniques` 不含 runCount | 已从列表页 context 补（`data/META.json`） |
| 4 | 12 个技法 nodes 为空 | 旧版格式（节点 ID 直接用语义名） | 数据完整，格式不同 |
| 5 | 提示词中的变量占位符语义 | `[TARGET_COLOR]` 等占位符的替换规则 | 需看执行链 |

---

## 六、可复现命令

```bash
# 1. 打开 Flora（登录态）任意技法详情页
tmwd-browser exec <SID> '{"cmd":"tabs","method":"create","url":"https://app.flora.ai/techniques/ghost-mannequin-system"}'

# 2. 从 React fiber 取 Convex client（WS 需连着）
#    见 /tmp/probe2.js

# 3. 拉全量技法清单
cc.query({[Symbol.for("functionName")]: "techniques/publicQueries:getVisibleTechniques"}, {})

# 4. 逐个拉 graph（用列表里的 snapshotId）
cc.query({[Symbol.for("functionName")]: "techniques/clientQueries:getTechniqueBySnapshotId"}, {snapshotId})

# 5. Studio 工具（用 DOM 上的 data-studio-tool-technique-id）
cc.query({[Symbol.for("functionName")]: "techniques/clientQueries:getTechnique"}, {techniqueDefinitionId})
```

**关键坑**：
- Convex WebSocket 断连时 `cc.query()` **永久挂起不 reject** —— 必须新开标签让 WS 重连
- 列表页的 `snapshotId` 与详情页的可能不同，**用列表页的**才拿到当前版本
- `getTechnique` 只接受 `{techniqueDefinitionId}`（试过 slug/routeSlug/techniqueId 全部报错）
