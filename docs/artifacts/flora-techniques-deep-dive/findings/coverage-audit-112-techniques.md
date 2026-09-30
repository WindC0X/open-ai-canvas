# 112 技法覆盖度核查（2026-09-30 自审）

> 用户问：112 技法都完整获取了吗？包括机制、界面
> **诚实回答：没有。** 本文是准确的三层账目。

## 0. 一句话结论

| 层 | 覆盖度 | 说明 |
|---|---|---|
| **技法清单与元数据** | ✅ **112/112（100%）** | 名称/slug/类别/作者/费用/运行数/标签/描述/输入输出/模型链 |
| **界面（UI）** | ⚠️ **~15%（1 个完整样本）** | 仅 `ghost-mannequin-system` 详情页 + 列表页；112 个的详情页未逐一抓 |
| **机制（graph + 提示词）** | ❌ **~1%（1/112）** | **只有 1 个技法的完整 graph**；其余 111 个的 graph、提示词正文、节点参数**全部未取** |

**我的前一份档（`t06-supplement-studio-tool-model-map.md`）有夸大**：它写了「24 个工具全量已获」，但获的是 **listing 层元数据**，不是 graph。已在本文纠正。

---

## 一、已完整获取（112/112）

**来源**：React context（`memoizedProps.value.techniques`），一次拿到全部。

每个技法含：

| 字段 | 类型 | 样本值 |
|---|---|---|
| `name` | str | "Ghost Mannequin System" |
| `slug` | str | "ghost-mannequin-system" |
| `techniqueDefinitionId` | str(32) | "ts78fd3drgdez37fsmk2k8sppn85yv89" |
| `snapshotId` | str(32) | "v170st14k6n6pmnxx80z9rweth8dmjc9" |
| `listingId` | str(32) | "tx7d6abgzrjz1x6e5tqxn6at2s85zndp" |
| `chargedCost` / `chargedUsageCost` | number | 1360 / 1944 |
| `runCount` | number | 169 |
| `reviewStatus` | str | "published" \| null |
| `visibility` | str | "public" |
| `createdAt` / `updatedAt` / `publishedAt` | number | 时间戳 |
| `currentUserCanEdit` / `IsCreator` / `CanOpenInAppMode` | bool | 权限 |
| `open` | bool | |
| `galleryMedia` | obj{4} | `{mediaKind, mediaLabel, mediaSource, mediaUrl}` |
| `presetInputSamples` | obj | `{inputId: {imageUrl}}` |
| `presetOutputSamples` | obj | `{outputId: {imageUrl}}` |
| **`listing`** | obj{22} | 见下 |

**`listing` 的 22 个字段**（逐字）：

```
actions, appLinkAccess, category, creator, deleted, description,
detailImages, estimatedTime, favoriteCount, inputItems, isFeatured,
isFloraTechnique, isVisible, listingId, modelRefs, outputItems,
previewImageUrl, slug, sortOrder, tags, techniqueDefinitionId, visibility
```

**统计**（自审实测）：

| 项 | 数 |
|---|---|
| 总数 | **112** |
| 有 listing | 112 |
| 有 modelRefs | **111**（缺 1：`Color Palette Extraction`） |
| 有 inputItems | 112 |
| 有 description | 111 |
| **类别分布** | brandVisualDesign 15 / fashionApparelEditorial 16 / funInspiration 16 / essentials 13 / productVisualization 12 / marketingAds 8 / videoAnimation 8 / spaceArchitecture 6 / contentPackaging 5 / printFilmVfx 5 / **null 8** |
| **reviewStatus** | published 57 / **null 55** |
| **visibility** | 全部 "public" |

> **注意**：`null 55` 意味着 55 个技法**没有 reviewStatus**——它们可能是 workspace 私有技法（非市场发布），需要区分对待。

**全量导出体积**：`JSON.stringify(techniques).length = 353,772` 字节（≈346 KB）。

---

## 二、部分获取（1/112 完整，其余未抓）

### 已完整获取的样本：`ghost-mannequin-system`

**来源**：技法详情页 `/techniques/ghost-mannequin-system` 的 React props —— `props.techniqueDefinition`。

**完整结构**（逐字）：

```js
{
  id: "ts78fd3drgdez37fsmk2k8sppn85yv89",
  name: "Ghost Mannequin System",
  description: "Turn any outfit image into ghost mannequin shots, physics poses, and detailed product visuals...",
  chargedCost: 1360,
  chargedUsageCost: 1944,
  graph: {
    nodes: [ ...16 个 ],          // ★ 节点图
    edges: [ ...42 条 ],          // ★ 连线
    inputs: [ ...1 个 ],
    outputs: [ ...14 个 ],
    nodeInputsMap: { ... },       // ★★ 每节点的 模型 + 提示词正文 + 参数
    presets: [ ...1 个 ],         // ★★ 默认预设（含完整提示词）
    sampleOutputs: { ... }        // 样例输出 URL
  }
}
```

**`nodeInputsMap` 是核心资产** —— 含**提示词全文**与**模型绑定**（逐字节选）：

```js
"2405a046-f6c3-4903-b521-8e2f8bea631b": {
  "mode": "textToText",
  "model": "Claude Opus 4.6",
  "modelParameters": {
    "prompt": "Create a fashion product detail composition using a split layout.\r\n\r\nStructure:\r\n- include a full outfit shown on a model or ghost mannequin, scaled smaller\r\n- place this full view on one side (left or center-left)\r\n\r\nDetail focus:\r\n- create a large zoomed-in crop of a key garment area (e.g. pants, fabric, logo, stitching)\r\n..."
  }
}
```

**`presets` 含完整输入与节点文本**（逐字节选）：

```js
[{ "id": "default",
   "inputs": { "stylish-casual-outfit": {
     "aspectRatio": 0.5625, "assetId": "jd7bgt44mt91jkvn29r7x546p985p4c1",
     "height": 1920, "width": 1080,
     "imageUrl": "https://media.flora.ai/b8e93ba2-...png" } },
   "nodes": { "2405a046-...": { "text": "Create a fashion product detail composition..." } } }]
```

**节点类型只有 2 种**：`textBlock`（提示词节点）与 `emptyImageBlock`（生成节点）。
**16 节点 / 42 边 / 1 输入 / 14 输出**。

### 界面（UI）已获取部分

| 界面 | 状态 |
|---|---|
| 技法市场列表页 `/techniques` | ✅ 已抓（T01 报告） |
| 技法详情页 4 标签（App/Workflow/Examples/About） | ✅ 标签名已确认 |
| **`ghost-mannequin-system` 详情页** | ✅ 已进入并抓取 |
| 其余 111 个详情页 | ❌ **未逐一访问** |
| Run App 表单（112 个各自的表单） | ❌ **只知 schema 形状，无逐技法实例** |
| Workflow 标签页的可视化图 | ⚠️ 有数据（graph）但未截图/未解析布局 |

---

## 三、未获取（111/112 的 graph）

### 缺什么

对**其余 111 个技法**，以下**全部未取**：

1. **graph 本体**（nodes / edges / inputs / outputs）
2. **`nodeInputsMap`**（每节点的模型 + **提示词全文** + 参数）
3. **`presets`**（默认预设的输入值与节点文本）
4. **`sampleOutputs`**（样例输出 URL）
5. 各技法的**节点数与拓扑**

### 为什么没取到

**核心障碍：`getDefinition` 走 Convex，而 Convex 客户端在本会话中不可用。**

实测三条路全部失败：

| 路径 | 结果 |
|---|---|
| `ctx.getDefinition(defId)` | ❌ 返回 `null`（列表页）/ 抛错（详情页 context 结构不同） |
| Convex WebSocket `cc.query()` | ❌ **永久挂起**（WebSocket 断连，`isWebSocketConnected: false`，且 query 不 reject） |
| Convex HTTP `/api/query` | ❌ `401 NoAuthProvider`（Clerk JWT 直传不被接受，需要 Convex 注册的 auth provider 配置） |
| REST `/api/techniques/{slug}` | ❌ 404（返回 SPA fallback HTML） |
| REST `/api/techniques/search` | ❌ 405（方法不允许） |
| REST `/api/model-service/dynamic-endpoints` | ❌ 405 |
| REST `/api/model-service/technique-quote` | ✅ 200（但只返回**价格**，无 graph） |

**`graph` 只在详情页被 Convex 推送后进入 React props** —— 即**每个技法必须访问其详情页**才能拿到。

### 可行的补齐方案

| 方案 | 做法 | 成本 |
|---|---|---|
| **A′（推荐）** | **脚本化遍历 ~40 个电商对口技法详情页**（fashionApparelEditorial 16 + productVisualization 12 + marketingAds 8 + essentials 商品子集）：逐个 `tabs.create` 打开 `/techniques/{slug}` → 等 Convex 推送 → 从 `props.techniqueDefinition` 抽取 → 存 JSON | 40 次页面加载，约 15–25 分钟 |
| A | 全量 112 个（含与影策不对口的 funInspiration/brandVisualDesign 等） | 112 次，约 30–60 分钟，**边际价值低** |
| B | 修复 Convex 认证（找到正确的 auth provider 配置）后一次性 `getDefinition` 全量 | 需要研究 Convex + Clerk 集成配置，不确定性高 |
| C | 只抓 Studio 的 13–24 个 | 约 10 分钟，覆盖最集中的电商/服装场景 |

**方案 A′ 已实测可行**（`ghost-mannequin-system` 就是这么拿到的），只是**需要循环 40 次**。

---

## 四、诚实纠正

**前一份档 `t06-supplement-studio-tool-model-map.md` 的表述问题**：

原文写「**24 个工具全量已获**（含 `chargedCost`/`category`/`inputItems`/`outputItems`）」——**这句在 listing 层是对的，但容易被误读为"技法内容全量已获"**。

**实际**：24 个工具获的是**元数据**（listing 层），**不是技法图**（graph 层）。技法图只有 1 个样本。

**已在本文档 + 后续更新中明确区分两层。**

---

## 五、对影策（open-ai-canvas）的实际影响

### ⚠️ 本文初版判断错误，已更正（2026-09-30）

**初版写的**：「Flora 的提示词是服装电商场景，影策是影视/短剧，直接复用价值低」+「不值得全抓，抽 5-8 个够了」。

**这是错的。影策有两条主线，电商是自建主攻线之一。**

`MASTER-PLAN.md` §2.5 定位声明逐字：

> **定位声明**：影策 = 为**电商创作者与小型影视团队**服务的、本地/私有部署优先的生成式图像工作台——**电商改图/商拍/品牌锁是自建主攻线**，影视 agent 玩法跟随上游，UI 质感走 flora 化皮肤外置。
>
> 用户画像 = PRODUCT.md 既有画像（个人创作者/小型影视团队/短剧制作者）**+ 本次显式扩展「电商创作者」人群**。

§2.3 差异化真空逐字：

> 上游 90d 全量 feat 标题中**未出现电商/设计类词汇**……上游安全区=**电商/设计类业务节点/模板/工作流**、backend Go 私有扩展……

**即：电商是影策刻意选择、上游不做的差异化地盘**（三条作战线中的 **B 线**）。

### 影策电商线 F-01..F-12 与 Flora 技法的实际映射

`analysis-2026-09-12/ecom-design/candidates-ecom.md` 的 Top12：

| 影策功能 | 优先级 | Flora 对应技法（有 graph 可抽） |
|---|---|---|
| **F-01 智能抠图/白底图** | 25 | `Anything to Vector`（含 `Remove background` 节点） |
| **F-02 AI 商品场景图/背景替换** | 25 | **`Product in Scene Generator`**（uoi-image-generator，5 输出）/ `Relighting` |
| **F-03 商品/模特一致性参考锁** | 20 | `Scene Continuity Lock` / `Editorial Fashion Shoot Replicator` |
| **F-04 AI 模特换装/虚拟试衣** | 20 | **`Virtual Try-On`**（550cr）/ `Model Poses`（10 输出）/ `Ghost Mannequin System`（14 输出） |
| **F-05 模板变量批量出图** | 20 | Bulk Generate（t07 已拆，非技法） |
| **F-06 扩图/画幅重构** | 20 | 无直接技法（影策已自建 MVP，0.02 硬贴回阈值） |
| **F-07 修复型垂直工具群** | 20 | `Relighting Photoshoot` / `Product recolor` |
| **F-08 视觉标注局部修改** | 20 | `Image Recolor` / `Product recolor` |
| **F-09 爆款图复刻** | 16 | **`Editorial Fashion Shoot Replicator`**（名字就是"复刻"） |
| **F-10 品牌套件锁定** | 16 | `Editorial Fashion Shoot Replicator`（风格注入链） |
| **F-11 OCR 改字** | 16 | 无（Flora 无文字层） |
| **F-12 批量基础处理** | 16 | `3 Angle Shoot` / `Multi-Angle Shoot` / `Product Package on White` |

**结论：12 项电商功能中，至少 8 项能在 Flora 技法里找到对口参照。**

### 因此，graph 层的补齐优先级应重排

**应优先全抓的技法类别**（与影策电商线直接对口）：

| 类别 | 数量 | 理由 |
|---|---|---|
| `fashionApparelEditorial` | **16** | F-01/03/04/07/08/12 核心参照 |
| `productVisualization` | **12** | F-02/07/12 参照 |
| `marketingAds` | **8** | F-05/09/10 参照 |
| `essentials`（商品相关子集） | ~8 | F-01/12 参照 |
| **合计** | **约 40-44 个** | |

**真正不值得全抓的**：`funInspiration` 16 / `brandVisualDesign` 15 / `spaceArchitecture` 6 / `printFilmVfx` 5 —— 与影策两条主线都不对口。

### 修正后的建议

**方案 A′（取代原方案 A/C）**：优先抓 **~40 个电商对口技法**的完整 graph，而非全量 112，也不只是 24 个 Studio 工具。

理由：
- **提示词正文可直接参照**：Flora 的「纯白背景 #FFFFFF / 棚拍软光 / 面料质感保留 / 无遮挡」等提示词工程，与影策「白底产品图」starter 的需求**同构**
- **多模型链分工可直接参照**：LLM 出提示词 → Nano Banana 出图，与影策多渠道架构契合
- **节点拓扑可直接参照**：16 节点如何组织一次商品图生成（16 节点 / 42 边 / 1 输入 / 14 输出的模式）

**已实测可行的抽取方法**：遍历 `/techniques/{slug}` 详情页 → 从 `props.techniqueDefinition` 抽 `graph`（含 `nodeInputsMap` 提示词正文）。40 个约 15–25 分钟。
