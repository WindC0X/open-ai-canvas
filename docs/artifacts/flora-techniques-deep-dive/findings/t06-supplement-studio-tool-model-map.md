# T06 补充 3 · Studio 工具 → 模型 映射（决定性补齐）

> 2026-09-30 补抓成功。证据等级：**一手逐字**（React context 运行时数据）。
> **本文取代** `t06-supplement-studio-tool-mapping.md` 中「未拿到逐工具模型清单」的结论。

## 0. 突破点

前一份补充档卡在 Convex 查询挂起（WebSocket 断连 + token 过期）。**真正的解法是绕开网络**：

**数据已经在 React context 里** —— `useTechniques` 的 Provider value 持有全部 112 个技法对象（含 `listing.modelRefs`）。

```
React fiber 的 memoizedProps.value  →  { techniques: [...112 个], getDefinition, getTechnique, ... }
```

**获取方法**（逐字，可复现）：
```js
// 遍历 fiber 树，找带 techniques 数组的 context/props
const els = document.querySelectorAll("*");
for (let i = 0; i < els.length; i++) {
  const kk = Object.keys(els[i]).find(x => x.startsWith("__reactFiber"));
  if (!kk) continue;
  let f = els[i][kk], d = 0;
  while (f && d < 200) {
    const p = f.memoizedProps;
    if (p && typeof p === "object" && Array.isArray(p.value?.techniques)) {
      window.__ctx = p.value;      // ★ 命中：112 个技法
      break;
    }
    f = f.return; d++;
  }
  if (window.__ctx) break;
}
```

**关键洞察**：Convex 的 WebSocket 断连后 `cc.query()` 会**永久挂起**（不 reject），而 HTTP `/api/query` 需要正确的 auth provider 配置（Clerk JWT 直传返回 `NoAuthProvider`）。**但页面已经订阅过的数据仍在内存里** —— 读 context 比重新查询更可靠。

---

## 一、映射表（逐字，按 runs 降序）

`listing.modelRefs` 结构：`[{ mode: <IO模式>, model: <模型名> }]`

| 工具 | slug | 类别 | runs | 费用 | 模型链（mode → model） |
|---|---|---|---|---|---|
| Product Lookbook Grid | product-lookbook-grid | productVisualization | 3396 | 236 | imagesToImage→**Nano Banana Pro**; imagesToText→**GPT-5.2** |
| Product Animator | product-animator | productVisualization | 3355 | 40 | textToText→**Claude Opus 4.6**; imagesToText→**Claude Opus 4.6**; firstFrameLastFrame→**Kling O1** |
| Product to Ad Visuals | turn-any-product-into-4-ad-visuals | marketingAds | 1738 | 320 | imageToImage→**Nano Banana 2** |
| Garment Sketch | sketch-to-garment | fashionApparelEditorial | 1529 | 61 | imageToImage→**Nano Banana**; imageToText→**GPT-5.2** |
| Garment Extractor | garment-extractor | fashionApparelEditorial | 1375 | 600 | imageToText→**GPT-5.5**; textToText→**Gemini 3 Pro**; imageToImage→**Nano Banana Pro**; textToText→**Claude Opus 4.8** |
| Product recolor | product-recolor | fashionApparelEditorial | 989 | 1376 | textToText→**GPT-5.2**; imagesToText→**GPT-5.5**; imagesToImage→**Nano Banana 2**; imageToText→**GPT-5.5** |
| Video Scene Builder | video-scene-builder | videoAnimation | 971 | 2670 | imageToText→**Claude Opus 4.6**; imageToImage→**Nano Banana Pro**; imageToVideo→**Kling 3.0 Pro** |
| Product Motion | product-motion | videoAnimation | 876 | 797 | imageToText→**GPT-5**; textToText→**GPT-5**; imageToVideo→**Kling 2.5 Turbo Pro**; imageToImage→**Nano Banana Pro** |
| Relighting | relight-technique | contentPackaging | 848 | 580 | imageToImage→**Nano Banana Pro**; textToText→**GPT-5.2**; imageToText→**GPT-5.2** |
| 3 Angle Shoot | 3-angle-shoot | essentials | 705 | 360 | textToText→**Claude Opus 4.6**; imageToImage→**Nano Banana 2** |
| Image Recolor | image-recolor | essentials | 643 | 100 | textToText→**Claude Sonnet 4.6**; imagesToImage→**Nano Banana Pro** |
| Garment to Vector | garment-to-vector | fashionApparelEditorial | 421 | 1380 | imageToText→**Gemini Flash 3.7**; imageToImage→**GPT Image 2**; textToText→**Claude Sonnet 5**; imageToImage→**Arrow 1.1 Max** |
| Dieline to 3D Package | dieline-to-3d-package | productVisualization | 369 | 178 | textToImage→**GPT Image 2**; imageToImage→**GPT Image 2** |
| Anything to Vector | anything-to-vector | essentials | 236 | 662 | imageToImage→**Remove background**; textToText→**GPT-5.5**; imageToText→**GPT-5.5**; imageToImage→**Nano Banana 2**; textToText→**Claude Sonnet 5**; imageToImage→**Arrow 1.1 Max** |
| Product in Scene Generator | uoi-image-generator | contentPackaging | 201 | 2140 | imageToImage→**undefined**; imagesToText→**Gemini 3.1 Pro**; textToImage→**undefined** |
| Ghost Mannequin System | ghost-mannequin-system | fashionApparelEditorial | 169 | 1360 | textToText→**Claude Opus 4.6**; imageToImage→**Nano Banana Pro**; imagesToImage→**Nano Banana 2**; imagesToImage→**Nano Banana Pro** |
| Editorial Fashion Shoot Replicator | editorial-fashion-shoot-replicator | fashionApparelEditorial | 166 | 220 | imageToText→**Claude Opus 4.6**; imageToImage→**Nano Banana Pro**; textToImage→**Nano Banana Pro** |
| Virtual Try-On | virtual-try-on-4k5vvw | fashionApparelEditorial | 140 | 550 | textToText→**Claude Sonnet 5**; imagesToText→**GPT-5.5**; imagesToImage→**Nano Banana Pro** |
| Sketch to Photorealistic Product Renderer | sketch-to-photorealistic-product-renderer | productVisualization | 116 | 488 | imagesToImage→**Nano Banana 2**; imagesToText→**Claude Sonnet 4.6**; imageToImage→**Nano Banana 2** |
| Static Product Image to Video | static-product-image-to-video | (null) | 90 | 1419 | imageToText→**Claude Sonnet 5**; imageToVideo→**Seedance 2.0**; textToImage→**undefined** |
| Sketchup rendering | sketchup-rendering | spaceArchitecture | 66 | 894 | textToText→**undefined**; imageToImage→**Nano Banana Pro**; imageToImage→**Flux Kontext Max**; imageToVideo→**Kling 2.5 Turbo Pro** |
| Scene Continuity Lock | scene-continuity-lock | printFilmVfx | 64 | 380 | imageToText→**GPT-5.2**; imageToText→**Claude Sonnet 4.6**; imageToImage→**Nano Banana 2** |
| Model Poses | model-poses | fashionApparelEditorial | 60 | 1600 | textToText→**Claude Sonnet 5**; imageToImage→**Nano Banana 2** |

（另有 Product Package on White / SketchUp Scene to Photoreal Photo / Footwear to Vector 等，字段同构）

---

## 二、关键结论

### 1. 工具 → 模型 不是一对一，而是「多模型链」

每个技法由**多个节点**组成，每个节点可绑不同模型。例如 `Ghost Mannequin System`：

```
textToText    → Claude Opus 4.6      （提示词工程/语义理解）
imageToImage  → Nano Banana Pro      （单图编辑）
imagesToImage → Nano Banana 2        （多图合成）
imagesToImage → Nano Banana Pro      （多图合成）
```

**分工模式**：**LLM 做提示词/语义 → 图像模型做生成**。这是 Flora 技法架构的核心范式。

### 2. 图像模型的实际分布（按出现频次）

| 模型 | 出现次数 | 角色 |
|---|---|---|
| **Nano Banana Pro** | 15+ | 主力图像编辑/合成 |
| **Nano Banana 2** | 11+ | 多图合成主力 |
| Nano Banana | 1 | 旧版 |
| **GPT Image 2** | 3 | 矢量/包装类 |
| **Arrow 1.1 Max** | 3 | 矢量输出 |
| **Flux Kontext Max** | 1 | SketchUp 渲染 |
| Remove background | 1 | 抠图工具（非生成模型） |

### 3. LLM 的实际分布

| 模型 | 出现次数 |
|---|---|
| **Claude Opus 4.6** | 6 |
| **Claude Sonnet 5** | 5 |
| **GPT-5.2** | 5 |
| **GPT-5.5** | 5 |
| Claude Sonnet 4.6 | 3 |
| Claude Opus 4.8 | 1 |
| Gemini 3 Pro / 3.1 Pro / Flash 3.7 | 各 1 |
| GPT-5 | 2 |

### 4. 视频模型

| 模型 | 出现次数 |
|---|---|
| **Kling 2.5 Turbo Pro** | 2 |
| **Kling O1** | 1 |
| **Kling 3.0 Pro** | 1 |
| **Seedance 2.0** | 1 |

### 5. IO 模式全集（`modelRefs[].mode`）

```
textToText      imagesToText     imageToText
textToImage     imageToImage     imagesToImage
imageToVideo    firstFrameLastFrame
```

**9 种 IO 模式** —— 这是 Flora 的「能力矩阵」维度。

### 6. `undefined` 的含义

`Product in Scene Generator` / `Sketchup rendering` / `Static Product Image to Video` 有 `model: undefined` 的条目。

**推断**：这些节点用的是**智能路由器**（folia），模型在运行时才决定，故静态数据里无模型名。与 T06 原文发现的 `router: "folia-image"` schema 吻合。

### 7. 类别（`listing.category`）

```
essentials | productVisualization | fashionApparelEditorial | marketingAds
videoAnimation | contentPackaging | spaceArchitecture | printFilmVfx
```

**8 个类别** —— 与 T01 的 `CATEGORY_DISPLAY_ORDER` 对应。

---

## 三、为什么 `modelRefs` 才是答案（而非 definition.graph）

`ctx.getDefinition(defId)` 返回 `null`（定义未在客户端缓存）。

**但不需要它** —— `listing.modelRefs` 已经给出：
- 每个技法用到的**全部模型**
- 每个模型的**IO 模式**（在技法中的角色）

**`modelRefs` 是"技法级模型清单"的权威来源**，由服务端在发布时从 definition graph 聚合生成。

**对影策的启示**：如果要实现"工具卡片显示所用模型"，**不需要展开 graph，只需在 listing 层聚合 modelRefs** —— 这是低成本设计。

---

## 四、可复现命令

```bash
SID=<fashion-studio 标签>

# 1. 进 Studio（重定向到项目编辑器）
tmwd-browser exec $SID '{"cmd":"tabs","method":"create","url":"https://app.flora.ai/studios/fashion-studio/open"}'

# 2. 从 React context 抓全部技法（112 个）
tmwd-browser exec $SID "$(cat /tmp/f1.js)"     # 见本文 §0 代码
tmwd-browser exec $SID 'JSON.stringify(window.__ctx.techniques.length)'

# 3. 导出 modelRefs
tmwd-browser exec $SID "$(cat /tmp/m1.js)"
tmwd-browser exec $SID 'JSON.stringify(window.__M.rows)'
```

---

## 五、对影策（open-ai-canvas）的迁移价值

| 发现 | 影策可复用性 |
|---|---|
| **工具 = 技法外壳，rail 自动匹配** | ⭐⭐⭐ 高 —— 新增工具零前端改动 |
| **listing.modelRefs 聚合模型清单** | ⭐⭐⭐ 高 —— 低成本实现"此预设用哪些模型" |
| **多模型链（LLM 提示词 → 图像生成）** | ⭐⭐⭐ 高 —— 影策已有 canvas-agent，可直接套用分工 |
| **9 种 IO 模式** | ⭐⭐ 中 —— 比影策现有契约更细，可参考扩维 |
| **8 个类别** | ⭐⭐ 中 —— 与预设场景 2.0 的分类可对齐 |
| **具体模型选型（Nano Banana 系为主）** | ⭐ 低 —— 影策模型生态不同 |
| **folia 智能路由器（undefined 条目）** | ⭐⭐⭐ 高 —— 与 Auto-2/Auto-3 设计同构 |

### 最有价值的一条

**`modelRefs` 的聚合位置**：Flora 把"技法用了哪些模型"从 graph 里**聚合到 listing 层**，使列表页/卡片能直接展示，无需展开图。

→ 影策的 Auto-2（规则选模型）如果需要"技法/预设的能力画像"，**可以在注册表层维护聚合字段**，而不是每次遍历图。
