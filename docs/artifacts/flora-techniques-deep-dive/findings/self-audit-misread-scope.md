# 覆盖度自查 · 第二轮（2026-09-30）

> 起因：用户质问「你忘了项目的路线了？？？？？？？？？？？」——我此前把影策定位记成单一「影视/短剧」。
> 本文是**系统性排查**：我还在别处记窄了什么。**结论：又查出三处**。

## 一、错误汇总

| # | 我的错误断言 | 事实 | 证据 |
|---|---|---|---|
| **1** | 影策 = 影视/短剧；Flora 电商技法复用价值低 | 影策 = **电商 + 影视双线**，电商是**自建主攻线（B 线）**，且是上游刻意不做的差异化地盘 | `MASTER-PLAN.md` §2.5 定位声明 |
| **2** | F-11 OCR 改字：Flora 无文字层，无可参照 | Flora **有大量文字渲染能力**：模型目录含 `Ideogram 3.0/4.0`（crisp readable type）、`Seedream 4.5`（sharp text rendering）、`Qwen Image Edit`（best for adding or changing text）、`Qwen Image Edit Plus`（complex layouts with multiple text elements）、`Qwen Image 2.1`（strong typography）、`Flux 2 Klein 9B`（crisper text）、`GPT Image 1.5`（transparent backgrounds）；且有视频字幕工具（font/stroke/alignment） | `flora-official-docs-full.md` 模型目录 + §3453 |
| **3** | 只提了 F-01..F-12，漏了 O-03 超分与 O-10 分层 | Flora **两个都有对口模型**：超分 = `Magnific Creative/Precision Upscaler`、`Topaz Generative Upscaler`、`Topaz Upscaler`（+ 视频超分 4 个）；分层 = `Seedream 5 Pro Layerize`（splits into editable transparent-PNG layers）、`Qwen Image Layered`、`Ad Delayer`（split flat ad into background/product/copy layers） | 同上 |

## 二、错误 #2 详情：Flora 的文字能力（F-11 对口）

**我此前写「Flora 无文字层」是错的。** Flora 的文字相关能力分三层：

### 层 1：文字渲染模型（生成时直接把字画对）

| 模型 | 官方描述（逐字） |
|---|---|
| `Ideogram 3.0` | "Best for logos and art with **crisp, readable type**" |
| `Ideogram 4.0` | "Producing crisp visuals with **accurate text rendering**" |
| `Seedream 4.5` | "**Sharp text rendering** with 4K output" |
| `Seedream 3.0` | "Cinematic film-style visuals with **legible text**" |
| `Seedream 4.0` | "...educational diagrams with **precise labels**" |
| `Qwen Image 2.1` | "Alibaba's unified text-to-image and editing model with **strong typography**" |
| `Flux 2 Klein 9B` | "Enhanced realism, **crisper text** and better color adherence" |
| `GPT Image 1.5` | "...transparent backgrounds, precise control" |

### 层 2：文字编辑模型（改图里的字）

| 模型 | 官方描述（逐字） |
|---|---|
| `Qwen Image Edit` | "**Best for adding or changing text in images**" |
| `Qwen Image Edit Plus` | "**Complex layouts with multiple text elements**" |
| `Flux Kontext Max` | "...**text edits**, maintaining character continuity" |

### 层 3：画布文字工具

| 能力 | 证据 |
|---|---|
| 视频字幕 | §3453：「Style text from the sidebar: **font** (Google Fonts), **stroke** (an outline for legibility over busy footage), **alignment**, plus position, size, opacity, and layer order. Stack text above your video by putting it on a higher track.」 |
| 标题/字幕 | §3317：「**Caption and title** with your choice of font, stroke, and alignment」 |
| 分层 PSD/矢量输出 | §4759：「**Layered PSDs and vectors** when you need the working file, not just the picture」 |

**对影策 F-11 的价值**：影策 F-11 的技术路线是「浏览器 PaddleOCR.js 主路线 + 程序化贴字兜底」。Flora 的层 2（文字编辑模型）**正是影策「程序化贴字」之外的备选**——尤其 `Qwen Image Edit`（best for adding or changing text）与影策的中文文字场景直接对口（Qwen 系中文能力强）。

**修正后的 F-11 对照**：

| 影策 F-11 子问题 | Flora 可参照 |
|---|---|
| OCR 识别 | ❌ 无（Flora 不做 OCR） |
| 文字替换/重绘 | ✅ `Qwen Image Edit` / `Qwen Image Edit Plus` / `Flux Kontext Max` |
| 文字渲染质量 | ✅ `Ideogram 3.0/4.0` / `Seedream 4.5` / `Qwen Image 2.1` |
| 程序化贴字 | ✅ 视频字幕工具的 font/stroke/alignment 参数设计 |

## 三、错误 #3 详情：O-03 / O-10 的对口模型

### O-03 超分（影策三层方案）

影策 O-03：层1 直出引导 / 层2 API 超分（保真档双通道：火山 veImageX + Replicate real-esrgan）/ 层3 Conservative 精修（白名单 SeedVR2/CCSRv2/TSD-SR/Real-ESRGAN）。

**Flora 对口**（官方模型目录逐字）：

| 模型 | 官方描述 | 对应影策层 |
|---|---|---|
| `Magnific Precision Upscaler` | "Detail-preserving 2× upscaling" | 层2 保真档 |
| `Magnific Precision Upscaler V2` | "Sharp edges and texture recovery" | 层2 保真档 |
| `Magnific Creative Upscaler` | "Artistic upscaling with creative options" | 层3 增强档 |
| `Topaz Generative Upscaler` | "reconstructs missing detail, faces, and textures" | 层3 增强档 |
| `Topaz Upscaler` | "Boost resolution and detail, industry-standard" | 层2 保真档 |
| **视频超分** | `Bria Video Upscaler`（"Enterprise-safe, commercially licensed"）、`Magnific Creative Turbo/Video Upscaler`、`Topaz Upscaler`（视频） | 影策视频线储备 |

**关键对照点**：Flora 的「保真档 vs 增强档」区分，与影策 O-03 的**命名分流红线**（`upscale` 插值 vs `superResolve` AI 超分；「保真放大」默认 vs 「AI 增强」勾选确认）**设计意图一致**。Flora 用不同模型名实现，影策用参数分流实现——**Flora 的命名可作为影策的参考样本**。

### O-10 分层能力栈

影策 O-10 四层：L0 格式解析（PSD/PDF-OCG/XCF）→ L1 生成即分层 → L2 按需成层（SAM2 打底）→ L3 整图分解（fal $0.05 / 火山方舟 0.15 元/层）。

**Flora 对口**（官方模型目录逐字）：

| 模型 | 官方描述 | 对应影策层 |
|---|---|---|
| `Seedream 5 Pro Layerize` | "Splits an image into **independent, editable transparent-PNG layers**" | **L3 整图分解** |
| `Qwen Image Layered` | "Split an image into multiple layers" | **L3 整图分解** |
| `Ad Delayer` | "Split a flat ad into **editable background, product, and copy layers**" | **L3 电商特化**（广告图→背景/商品/文案三层） |
| `SAM 3` | "Segment an image by describing what to isolate as a short noun phrase. Returns each matching object as its own cutout or B&W mask" | **L2 按需成层** |
| `Layered PSDs and vectors` | §4759 导出格式 | **L0 格式解析**（出口侧） |

**关键发现**：`Ad Delayer`（广告图拆成背景/商品/文案三层）**直接命中影策电商场景**——这是影策 O-10 讨论中未提到的形态（影策想的是"整图分解"，Flora 已经做了"广告图按语义角色三层拆"）。

**且影策 O-10 的立项门**是「以真实批量 SKU 需求信号决策」；Flora 的 `Ad Delayer` / `Seedream 5 Pro Layerize` 是**已有的商业实现**——可作为影策立项时的**成本对标**（Flora 定价 `Ad Delayer` 105s 估计时长，`Seedream 5 Pro Layerize` 100s）。

## 四、第二轮修正：迁移建议补充

原 §4.4 的 F-01..F-12 表应扩展为：

| 影策项 | 优先级 | Flora 对应 | 说明 |
|---|---|---|---|
| F-01 抠图/白底 | 25 | `Anything to Vector`（含 Remove background） | 已有 |
| F-02 商品场景图 | 25 | `Product in Scene Generator` / `Relighting` | 已有 |
| F-03 一致性锁 | 20 | `Scene Continuity Lock` | 已有 |
| F-04 模特换装 | 20 | `Virtual Try-On` / `Model Poses` / `Ghost Mannequin System` | 已有 |
| F-05 模板批量 | 20 | Bulk Generate（非技法） | 已有 |
| F-06 扩图 | 20 | 无对口技法，但**模型层有** `FLUX 2 Pro Outpaint`（"Extend an image past its edges"） | **新增** |
| F-07 修复 | 20 | `Relighting Photoshoot` / `Product recolor` | 已有 |
| F-08 局部修改 | 20 | `Image Recolor` / `Product recolor` | 已有 |
| F-09 爆款复刻 | 16 | `Editorial Fashion Shoot Replicator` | 已有 |
| F-10 品牌套件 | 16 | `Editorial Fashion Shoot Replicator` | 已有 |
| **F-11 OCR 改字** | 16 | **`Qwen Image Edit`（best for adding/changing text）/ `Qwen Image Edit Plus` / `Flux Kontext Max` + 视频字幕 font/stroke 工具** | **修正：原写"无"是错的** |
| F-12 批量基础 | 16 | `3 Angle Shoot` / `Multi-Angle Shoot` / `Product Package on White` | 已有 |
| **O-03 超分** | — | **`Magnific Precision/Creative Upscaler` / `Topaz Upscaler` / `Topaz Generative Upscaler` + 视频超分** | **新增** |
| **O-10 分层** | — | **`Seedream 5 Pro Layerize` / `Qwen Image Layered` / `Ad Delayer` / `SAM 3`** | **新增** |

**修正后的结论**：影策 F-01..F-12 + O-03 + O-10 **共 14 项中，12 项有 Flora 对口参照**（仅 F-06 扩图无对口技法但模型层有 `FLUX 2 Pro Outpaint`；OCR 识别环节无对口）。

## 五、根因：我为什么会记窄

**三条**：

1. **只读了 PRODUCT.md，没读 MASTER-PLAN.md**。PRODUCT.md 写「个人创作者、小型影视团队和短剧制作者」，看起来就是影视向；MASTER-PLAN.md §2.5 才写明「**+ 本次显式扩展"电商创作者"人群**」。而 PRODUCT.md 的这项修订**被列为 W1 待办，至今未做**——所以我读 PRODUCT.md 时看不到电商。

2. **把「上游不做电商」误读成「影策也不做电商」**。事实相反：上游不做 → 影策**刻意选它做主攻线**。

3. **只看代码不看规划**。代码里有 `ECOM_CHANNEL_PRESETS` / `canvas-ecom-starters.ts`，我当时看到过但没往"这是主线"想。

**教训**：**项目的定位声明在 MASTER-PLAN.md，不在 PRODUCT.md**（后者尚未修订）。判断任何「影策需不需要 X」之前，**先读 MASTER-PLAN.md §2 与 §4**。

## 六、待办（建议）

1. **PRODUCT.md 修订**：MASTER-PLAN.md §2.5 已列为 W1 待办——「纳入电商画像并声明品牌原则对电商场景的适用性」，**至今未做**。这是**项目自身的欠账**，且正是我这次误判的根源。建议补上。
2. **本档与 SYNTHESIS §4.4 已修正**，F-11 与 O-03/O-10 的对口需补入。
