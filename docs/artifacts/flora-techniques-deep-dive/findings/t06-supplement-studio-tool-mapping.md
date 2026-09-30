# T06 补充 2 · Studio 工具 ↔ 技法 ↔ 模型 的映射机制

> 2026-09-30 补抓。证据等级：**一手逐字**（bundle 原文）+ **推断**（显式标注）。
> **诚实声明**：本文给出了映射**机制**，但**未拿到逐工具的模型清单**（原因见 §4）。

## 0. 结论先行

**Studio 工具不是独立实体，而是"技法（Technique）的展示外壳"**。映射链：

```
Studio rail 条目（names / slugBases）
        │  运行时匹配
        ▼
可用技法列表（getVisibleTechniques 的返回）
        │  匹配键：routeSlug / name / shortName
        ▼
technique definition（含 graph）
        │  graph 内的生成节点
        ▼
具体模型（folia 路由器在运行时选择）
```

**关键**：rail 条目只声明"名字与 slug 前缀"，**不含模型**。模型在**技法图的生成节点里**，且生成时可能经 **folia 智能路由器**再选端点。

---

## 一、机制级附录（逐字）

### A. rail 注册表全文（`0hrrv_zu9_682.js`，模块 960437）

```js
let h = [
  { id: "concept", label: "Concept", entries: [
      { names: ["prompt"],                          slugBases: ["prompt"] },
      { names: ["sketch to render"],                slugBases: ["sketch-to-render"] },
      { names: ["garment extractor", "extract"],    slugBases: ["garment-extractor"] },
      { names: ["concept"],                         slugBases: ["concept"] }
  ]},
  { id: "refine", label: "Refine", entries: [
      { names: ["ghostform", "ghost"],              slugBases: ["ghostform"] },
      { names: ["flatlay", "flat lay"],             slugBases: ["flatlay"] },
      { names: ["garment recolor", "recolor"],      slugBases: ["garment-recolor"] },
      { names: ["fabric swap"],                     slugBases: ["fabric-swap"] }
  ]},
  { id: "showcase", label: "Showcase", entries: [
      { names: ["model maker"],                     slugBases: ["model-maker"] },
      { names: ["model try-on", "model try on", "try on"], slugBases: ["model-try-on"] },
      { names: ["garment swap"],                    slugBases: ["garment-swap"] },
      { names: ["photo shoot", "photoshoot"],       slugBases: ["photo-shoot"] },
      { names: ["360 garment video", "360 garment"],slugBases: ["360-garment-video"] },
      { names: ["360 model video", "360 model"],    slugBases: ["360-model-video"] },
      { names: ["multi-angle shoot", "multi angle shoot", "multi angle"], slugBases: ["multi-angle-shoot"] }
  ]}
]
```

**13 个工具**（3 组）——**无任何模型字段**。

### B. 匹配算法（逐字）

```js
function u(e) { return e.trim().toLowerCase() }

function p(e, t) {                                  // e = 技法对象, t = rail 条目
  let a = e.name ? u(e.name) : "",
    i = e.shortName ? u(e.shortName) : "";
  if (("" !== a && t.names.includes(a)) || ("" !== i && t.names.includes(i))) return !0;
  let n = e.routeSlug;
  return !!n && t.slugBases.some(e => n === e || n.startsWith(`${e}-`))   // ★ 前缀匹配
}

function m(e) { return h.find(t => t.entries.some(t => p(e, t)))?.id }    // → "concept"|"refine"|"showcase"
```

**匹配键**：`name` / `shortName`（小写精确）或 `routeSlug`（**精确或前缀**）。
**例**：`routeSlug = "sketch-to-render-v2"` 会匹配 `slugBases: ["sketch-to-render"]`。

### C. 分组解析（逐字）

```js
// 1wlnvimss9xef.js
a = (0, rH.resolveStudioRailGroupedSections)(b)     // b = 技法列表（来自 Convex 查询）
// 返回值 P = sections，喂给 rF 组件渲染 rail
```

→ **rail 的内容完全由"可用技法列表"驱动**，注册表只负责分组与匹配。

### D. 工具 kind 解析（逐字）

```js
function d(e) {
  if (e.techniqueSlug) {
    if (c(e.techniqueSlug, l)) return "prompt";
    if (c(e.techniqueSlug, r)) return "concept"
  }
  let t = e.techniqueShortName ? u(e.techniqueShortName) : "",
    a = e.techniqueName ? u(e.techniqueName) : "";
  return "prompt" === t || "prompt" === a ? "prompt"
    : "concept" === t || "concept" === a ? "concept"
    : "model maker" === t || "model maker" === a ? "model-maker"
    : null
}
e.s(["isPromptStudioTool", 0, e => "prompt" === d(e),
     "normalizeTechniqueName", 0, u,
     "resolveStudioToolKind", 0, d])
```

**工具 kind**：`prompt` / `concept` / `model-maker` / `null`（其余）。

### E. 生成时的模型选择（folia 路由器，逐字来自 T06 原文）

```js
// 2ru825uhloavh.js
{ router: "folia-image" | "folia-video",
  taskType: [ "text_fidelity", "product_photography", "material_fidelity",
              "reference_edit", "anatomy", "background_change", ... ],
  selectedTechnique: { definitionId, snapshotId, slug, name, chargedCost } }
```

**推断**：`selectedTechnique` 是路由器**入参**（告诉它"这是技法 X 的生成"以便计价与归因），不是模型映射表。真正的模型选择由 `taskType` + 路由器内部策略决定。

→ **所以「工具→模型」在前端 bundle 里根本不存在静态映射**：它是运行时由 folia 路由器决定的。

### F. 技法图的生成节点（模型所在处）

技法 definition 的 `graph` 里，生成节点带 `model` / `modelId` / `mode`。佐证（`2nvrwl4dv01b-.js` 同族，`computeTechniqueBlockedModelNames`）：

```js
"computeTechniqueBlockedModelNames", 0, function ({ graphNodeInputsMap: e, blockedModelIds: t,
                                                     getEndpointForModeAndModelId: i,
                                                     getEndpointForModeAndModelSafe: n }) {
  if (!e || 0 === t.length) return [];
  let o = new Set(t), a = [];
  for (let t of Object.values(e))
    if (!(0, r.isCodeNodeInput)(t) && t.model && t.mode)
      try {
        let e;
        if (t.modelId) try { let o = i(t.mode, t.modelId); e = n(t.mode, o.options.name) ?? o }
                       catch { e = n(t.mode, t.model) }
        else e = n(t.mode, t.model);
        if (!e) continue;
        o.has(e.options.id) && a.push(t.model)
      } catch { continue }
  return [...new Set(a)]
}
```

**关键事实**：技法图的生成节点用 `{model, modelId, mode}` 三元组标识模型，经 `getEndpointForModeAndModelId(mode, modelId)` 解析为端点。

→ **要拿到逐工具模型清单，必须读每个技法 definition 的 graph**（存在 Convex，需登录态查询）。

---

## 二、产品级摘要

### 三层解耦设计

| 层 | 内容 | 存在位置 |
|---|---|---|
| **展示层** | rail 分组（Concept/Refine/Showcase）+ 工具名 | 前端静态注册表 |
| **定义层** | 技法 graph（含生成节点的 model/modelId/mode） | Convex（服务端） |
| **执行层** | folia 路由器按 taskType 选端点 | 服务端 |

**好处**：
- 新增工具 = 发布一个技法（前端不用改代码，rail 自动匹配）
- 工具可跨 Studio 复用（同一个技法能出现在不同 Studio 的 rail）
- 模型可替换（改技法图，不动前端）

**代价**：前端无法静态得知"某工具用哪个模型"。

### 已知的工具→模型线索

| 来源 | 证据 |
|---|---|
| `artwork-to-physical` 实测图 | 7 输出 → **Nano Banana 2**；2 视频输出 → **Kling O1** |
| 发布 splash alt 文本 | Sketch to Render（"photorealistic render"）/ Recolor / Fabric Swap / Photo Shoot / Multi-Angle 的能力描述 |
| folia 路由 taskType | `text_fidelity` / `product_photography` / `material_fidelity` / `reference_edit` / `anatomy` / `background_change` |
| 官方文档 | Fashion Studio 四工具的能力说明（无模型名） |

→ **Fashion Studio 13 个工具的具体模型未逐一定位**（推断：与 artwork-to-physical 同族，主力为 Nano Banana 2 / Kling O1，服装类可能用 Seedream / Flux Kontext 系列）。

---

## 三、证据与来源

| chunk | 内容 |
|---|---|
| `0hrrv_zu9_682.js` | ★ rail 注册表 + 匹配算法 `p` + kind 解析 `d` |
| `1wlnvimss9xef.js` | ★ `resolveStudioRailGroupedSections` 调用点 + element picker |
| `2ru825uhloavh.js` | folia 路由 schema + `selectedTechnique` |
| `2nvrwl4dv01b-.js` | `computeTechniqueBlockedModelNames`（模型三元组证据） |

### 可复现命令

```bash
# 进 Fashion Studio（重定向到项目编辑器）
tmwd-browser exec <SID> '{"cmd":"tabs","method":"create","url":"https://app.flora.ai/studios/fashion-studio/open"}'

# 抓 rail 注册表
tmwd-browser exec <SID> 'const urls=[...document.querySelectorAll("script[src]")].map(s=>s.src); let o={}; await Promise.all(urls.map(async u=>{const t=await (await fetch(u)).text(); const i=t.indexOf("slugBases"); if(i>=0) o[u.split("/").pop()]=t.slice(i-1500,i+2000)})); return JSON.stringify(o)'
```

---

## 四、为什么没拿到逐工具模型清单（诚实说明）

**尝试过的路径与结果**：

| 尝试 | 结果 |
|---|---|
| `grep 'garment\|sketch-to-render'` 找模型绑定 | ❌ 只命中 rail 分组与示例文案 |
| 枚举动态 chunk 找 Studio 工具页主组件 | ⚠️ 找到 rail 渲染与匹配，**无模型字段** |
| React fiber 找 Convex client | ✅ 拿到 client（`context` 路径） |
| **调 Convex `getVisibleTechniques`** | ❌ 挂起超时（需要认证上下文注入，页内直接调不通） |
| CDP 点击 Studio 工具触发请求 | ❌ 未触发（该标签有另一 debugger 附着，CDP 调用失败） |
| 从 DOM 读工具列表 | ⚠️ 只读到 9 个（rail 折叠态，非完整 13 个） |

**根因**：逐工具模型在**技法 graph 里**，而 graph 存在 Convex 服务端。前端只有：
1. rail 注册表（无模型）
2. folia 路由 schema（有 taskType，无工具映射）

**要拿到它，需要**：
- **A**（推荐）：用 Convex client + 认证 token 调 `techniques.clientQueries.getTechnique` / `publicQueries.getDefinition`，逐个取 13 个工具的 graph
- **B**：真机点进每个工具、跑一次生成，抓 `run-technique` 请求 + 响应的 `selectedTechnique`
- **C**：官方文档站用 `?ask=` 问（`docs.flora.ai` 有该接口，本次未用）

**我的判断**：这条路的价值主要是"满足完整性"，而**机制层结论已经足够**——影策若要复用 Studio 形态，需要的是"工具=技法外壳 + rail 自动匹配"这个架构，而不是 Flora 具体用了哪些模型（那是他们的模型生态选择）。
