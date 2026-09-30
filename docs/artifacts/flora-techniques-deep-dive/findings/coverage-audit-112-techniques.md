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
| **A（推荐）** | **脚本化遍历 112 个详情页**：逐个 `tabs.create` 打开 `/techniques/{slug}` → 等 Convex 推送 → 从 `props.techniqueDefinition` 抽取 → 存 JSON | 112 次页面加载，约 30-60 分钟（每次 15-30s） |
| B | 修复 Convex 认证（找到正确的 auth provider 配置）后一次性 `getDefinition` 全量 | 需要研究 Convex + Clerk 集成配置，不确定性高 |
| C | 只抓 Studio 相关的 ~24 个 | 约 10 分钟，覆盖用户最关心的电商/服装场景 |

**方案 A 已实测可行**（`ghost-mannequin-system` 就是这么拿到的），只是**需要 112 次循环**。

---

## 四、诚实纠正

**前一份档 `t06-supplement-studio-tool-model-map.md` 的表述问题**：

原文写「**24 个工具全量已获**（含 `chargedCost`/`category`/`inputItems`/`outputItems`）」——**这句在 listing 层是对的，但容易被误读为"技法内容全量已获"**。

**实际**：24 个工具获的是**元数据**（listing 层），**不是技法图**（graph 层）。技法图只有 1 个样本。

**已在本文档 + 后续更新中明确区分两层。**

---

## 五、对影策（open-ai-canvas）的实际影响

**关键判断**：**graph 层的 111 个缺口，对影策的价值可能低于 listing 层。**

理由：
- **架构与机制**：已从 1 个样本 + 通用代码路径完整推断（节点类型、IO 契约、快照、执行链）
- **具体提示词**：Flora 的提示词是**服装电商场景**的（ghost mannequin / fabric texture），影策是**影视/短剧**，直接复用价值低
- **模型选型**：listing 层的 `modelRefs` 已足够（说明"这类任务用什么模型"）

**真正值得补的**：
- 若要看**节点拓扑模式**（16 节点如何组织）→ 抽 3-5 个不同类型的技法足够
- 若要看**提示词工程范式**（如何把用户输入注入提示词）→ 抽 3-5 个足够
- **不需要 112 个全抓**

**建议**：抓 **5-8 个代表性技法**（覆盖 fashionApparelEditorial / videoAnimation / productVisualization / marketingAds 四类），而非全量 112。
