# T03 补充 · run-technique 执行链完整契约（缺口 #1/#3 已补齐）

> 2026-09-30 补抓。方法：tmwd-browser 控用户 Chrome（登录态）→ 进入 Run App 页面后**枚举动态加载 chunk**（165 个，比静态语料的 137 个多 28 个）→ 页内并行抓取 + 关键词定位。
> 证据等级：**一手逐字**（bundle 原文，保留混淆变量名）。

## 0. 结论先行：两条不同的执行路径

Run App 的技法执行**不是单一 REST 调用**，而是**两段式**：

```
① Convex mutation：api.appMode.mutations.createRun({...})
   → 建立 run 记录（服务端生成 runId），带乐观更新
② REST：POST /api/workflow/run-technique  body = { params: { runId, inputAssets, ... } }
   → 用 runId 触发实际执行
```

这解释了一个此前的困惑：`/api/workflow/run-technique` 的调用方在静态语料中 0 命中——因为**它在动态加载的 chunk 里**（`1j0fe2emf70rj.js` 模块 867804）。

---

## 一、机制级附录（逐字）

### A. REST 客户端（`1j0fe2emf70rj.js`，模块 867804）

```js
// 逐字抄录
async function i(e) {
  try {
    let t = await (0, r.createRequestHeaders)(),
      i = await fetch(a.appRoutes.api.workflow.runTechnique, {
        method: "POST",
        headers: t,
        body: JSON.stringify({ params: e })          // ★ 整个 payload 包在 params 键里
      });
    if (401 === i.status)
      return window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`,
        { error: (0, n.getFloraError)("Unauthorized", "Session expired. Redirecting to sign-in."), result: null };
    if (!i.ok) {
      let e = null;
      try { e = await i.json() } catch {}
      if (e && "object" == typeof e && "error" in e) {
        let { error: t } = e;
        return { result: null, error: t };
      }
      return { error: (0, n.getFloraError)("HTTP_ERROR", `HTTP Error: ${i.status} - ${i.statusText}`), result: null };
    }
    return { result: await i.json(), error: null };
  } catch (r) {
    t.log.error(`Error calling ${a.appRoutes.api.workflow.runTechnique} API`, { error: r });
    let e = r instanceof Error ? r.message : "A network error occurred";
    return { error: (0, n.getFloraError)("NETWORK_ERROR", e), result: null };
  }
}
e.s(["handleRunTechnique_viaApi", 0, i])
```

**要点**：
- 方法 `POST`，body 固定为 `{ params: <payload> }`（单层包裹）
- headers 由 `createRequestHeaders()` 生成（模块 598215）
- 错误分三类：`Unauthorized`（401，自动跳登录）/ `HTTP_ERROR`（非 2xx，尝试读 body 的 `error` 字段）/ `NETWORK_ERROR`（异常）
- 成功返回 `{ result: <json>, error: null }`

### B. 调用点 1：App Mode 的普通 run（`0dji9it51s1b7.js`）

```js
// 逐字抄录
async function z(e, t, r) {
  let { runId: i } = await e(t),                                    // ① Convex createRun
    n = await (0, v.handleRunTechnique_viaApi)({ runId: i, inputAssets: r });   // ② REST
  if (n.error) throw Error(n.error.description ?? n.error.title)
}
```

**payload 最小形态**：`{ runId, inputAssets }`

### C. 调用点 2：画布技法块（`2nvrwl4dv01b-.js`）—— 完整形态

```js
// 逐字抄录（关键片段）
let { error: U } = await (0, u.handleRunTechnique_viaApi)({
  runId: P,
  inputAssets: g,
  ...m ? { inputOverrides: l } : {},                                    // m = 有 inputOverrides
  ...F && Object.keys(F).length > 0 ? { parameterOverrides: F } : {},   // F = mergeParameterOverrides(...)
  ...a?.studioTourStepId ? { studioTourStepId: a.studioTourStepId } : {}
});
if (U) { J(a?.clientRunId, s, U.description ?? U.title), H(U); return }
```

**完整 payload 字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `runId` | string | 必填。Convex `createRun` 返回 |
| `inputAssets` | array | 必填。输入资产数组（结构见 D） |
| `inputOverrides` | object? | 可选。`Object.keys().length > 0` 才带 |
| `parameterOverrides` | object? | 可选。经 `mergeParameterOverrides(节点参数, 调用参数)` 合并 |
| `studioTourStepId` | string? | 可选。Studio 引导步骤追踪 |

**错误处理**：`U.description ?? U.title` —— 错误对象有 `description` / `title` 两字段（对应 `getFloraError` 的产物）。

### D. `inputAssets` 元素结构（逐字）

```js
// 画布路径（2nvrwl4dv01b-.js）
T = g.flatMap(e => {
  if (!(0, o.isTechniqueIOType)(e.type)) return [];
  let t = C.get(e.inputId);                    // C = Map(graph.inputs → controls.kind)
  return [{
    inputId: e.inputId,
    value: e.value,
    type: e.type,
    ...e.metadata ? { metadata: e.metadata } : {},
    ...e.previewImageUrl ? { previewImageUrl: e.previewImageUrl } : {},
    ...t ? { role: t } : {}                    // role 来自 input.controls.kind
  }]
})
```

```js
// App Mode 路径（0dji9it51s1b7.js）
W = e => ({
  inputId: e.inputId,
  type: e.type,
  value: e.value.trim(),                       // ★ 注意 App Mode 路径会 trim
  ...e.previewImageUrl ? { previewImageUrl: e.previewImageUrl } : {}
})
```

**字段**：`{ inputId, value, type, metadata?, previewImageUrl?, role? }`
- `role` 来自技法定义的 `input.controls.kind`
- 类型过滤用 `isTechniqueIOType(e.type)`（CORE_IO 契约，见 T04）

### E. Convex `createRun` 的完整参数（逐字，来自乐观更新）

```js
// 2nvrwl4dv01b-.js，M = $(...) 调用
M = $({
  projectId: V,
  clientRunId: a?.clientRunId,
  instanceNodeId: e,
  techniqueId: t.id,
  snapshotId: O ?? i.snapshotId,
  techniqueName: t.name,
  chargedCost: t.chargedCost,
  chargedUsageCost: t.chargedUsageCost,
  generationBatchId: r?.batchMeta?.generationBatchId,
  collectionItemKey: r?.batchMeta?.collectionItemKey,
  orderIndex: r?.batchMeta?.orderIndex,
  expectedOutputCount: I,                      // computeExpectedTechniqueOutputCount(graph, {inputAssets, inputOverrides})
  inputs: T,
  ..._.length > 0 ? { runSelections: _ } : {}  // _ = a?.runSelections ?? []
})
```

**乐观更新返回形状**（`0dji9it51s1b7.js` 的 `w` 函数，逐字）：

```js
function w(e, t) {                             // e = query store, t = createRun 参数
  if (!t.techniqueId) return;
  let r = { techniqueId: t.techniqueId, origin: t.origin, limit: _.APP_MODE_RUN_HISTORY_LIMIT },
    n = e.getQuery(i.api.appMode.queries.getRunHistory, r) ?? [],
    s = (0, U.getOptimisticId)(),               // workspaceId 乐观 id
    a = t.clientRunId,                          // runId 用 clientRunId
    o = (0, U.getOptimisticId)(),               // projectId 乐观 id
    l = [{
      runId: a, clientRunId: t.clientRunId, projectId: o, workspaceId: s,
      techniqueId: t.techniqueId, techniqueName: t.techniqueName,
      status: b.TECHNIQUE_RUN_STATUS.PENDING,
      chargedCost: t.chargedCost, chargedUsageCost: t.chargedUsageCost,
      startedAt: Date.now(), progress: 0
    }, ...n].slice(0, r.limit);
  e.setQuery(i.api.appMode.queries.getRunHistory, r, l);
  let u = t.inputAssets.map(S);
  e.setQuery(i.api.appMode.queries.getRunOutputs, { runId: a }, { inputs: u, outputs: [] })
}
```

→ **run 记录形状**：`{ runId, clientRunId, projectId, workspaceId, techniqueId, techniqueName, status, chargedCost, chargedUsageCost, startedAt, progress }`

### F. 执行前的完整流水（`2nvrwl4dv01b-.js`，逐字顺序）

```
1. 检查 et.current 重入锁（非 batch 路径）
2. getNodeById(e) 找技法块 → 失败返回 "Technique block not found"
3. 检查 projectId V → 缺失返回 "Missing project context..."
4. livePreviewKeysForParentNodes(n) → flushLiveModel3DPreviews(h)   // 3D 预览先落盘
5. buildTechniqueInputAssets({inputs, inputConnections, inputOverrides, readOutput, readNodeInput, readElementValue})
   → { inputAssets: g, issues: v }
   → v.length > 0 时用 techniqueInputIssueMessage(v[0]) 报错返回
6. computeExpectedTechniqueOutputCount(graph, {inputAssets: g, inputOverrides: l}) → I
7. C = new Map(graph.inputs.filter(e => e.controls?.kind).map(e => [e.id, e.controls.kind]))
8. T = g.flatMap(...)  → inputs 数组（含 role）
9. M = $(...)  → Convex createRun
10. await M → { runId: P }
11. G(MeaningfulProjectChange.ChangeNodeParams, e, ...)  → 节点写 pendingTechniqueRunId
12. 计算技法输出节点映射 L（expandTechniqueCollectionOutputs + 边可达性）
13. await W({ runId: P, outputNodeIds: L })   → updateOutputNodeIds
14. F = mergeParameterOverrides(node.parameterOverrides, call.parameterOverrides)
15. await handleRunTechnique_viaApi({ runId: P, inputAssets: g, inputOverrides?, parameterOverrides?, studioTourStepId? })
16. 错误 → J(clientRunId, runId, U.description ?? U.title) + H(U)
```

**关键**：`updateOutputNodeIds` 在 REST 触发**之前**调用——先登记输出节点映射，再触发执行。

### G. 埋点事件（`0dji9it51s1b7.js` + `245x6abtmz2ih.js`）

App Mode 相关的完整事件名（逐字，来自 EVENTS 常量表）：

```
appmode_generate_clicked        appmode_run_started
appmode_preset_run_started      appmode_open_in_project
appmode_edit_run_in_project     appmode_suggestion_shown
appmode_suggestion_clicked      appmode_suggestion_dismissed
technique_detail_viewed         technique_page_viewed
techniques_library_searched     techniques_tab_clicked
studios_tab_clicked             studios_tab_viewed
studio_selected                 studio_project_opened
studio_project_created          studio_start_action_selected
technique_node_generated        technique_node_gate_retry
technique_output_feedback_reason
request_technique_clicked
```

`appmode_run_started` / `appmode_preset_run_started` 的属性（逐字）：
```js
{ technique_id, technique_name, ...referrer && { referrer, referrer_source_technique_id } }
```

### H. Preset run 的 payload（`0dji9it51s1b7.js`，逐字）

```js
Q({
  techniqueId: e.techniqueId,
  snapshotId: e.snapshotId,
  techniqueName: e.name,
  origin: o.ProjectOrigin.APP,
  inputs: l,        // [{ inputId, type, value, previewImageUrl? }]
  outputs: t        // [{ outputId, name, imageUrl, videoUrl, model3dUrl, previewImageUrl?, text, aspectRatio? }]
}).then(({ runId: e }) => { G(e) })
  .catch(e => { h.toast.error(R(e, "Failed to save preset run")) })
```

→ **preset run 走 Convex mutation 保存**（`persistPresetRun`），不直接调 REST。

---

## 二、产品级摘要（补充）

### 两段式设计的意图

| 段 | 承担 | 好处 |
|---|---|---|
| ① Convex `createRun` | 建 run 记录、乐观 UI、历史列表 | 用户点 Generate 后**立即**在 feed 看到 PENDING 条目 |
| ② REST `run-technique` | 实际执行、返回 error | 重操作不阻塞 Convex 事务；错误可用 HTTP 语义表达 |

**乐观 UI 细节**：
- `runId` 直接用 `clientRunId`（客户端生成），服务端替换
- `workspaceId` / `projectId` 用 `getOptimisticId()`
- 新 run 插在历史列表头部，按 `APP_MODE_RUN_HISTORY_LIMIT` 截断
- 同时预写 `getRunOutputs` 查询为 `{ inputs: u, outputs: [] }`

### 错误对象契约

`getFloraError(code, message)` 产物有 `title` / `description` 两字段。调用方取 `error.description ?? error.title` 展示。已知 code：`Unauthorized` / `HTTP_ERROR` / `NETWORK_ERROR`。

---

## 三、证据与来源

### 新增 chunk（静态语料外，动态加载）

| chunk | 大小 | 内容 |
|---|---|---|
| `1j0fe2emf70rj.js` | 150,715 B | ★ `handleRunTechnique_viaApi`（模块 867804）+ 其他 |
| `2nvrwl4dv01b-.js` | — | ★ 画布技法块的完整执行流水 + createRun 完整参数 |
| `0dji9it51s1b7.js` | 69,574 B | ★ App Mode Run App 主逻辑（`z` 函数 / 乐观更新 `w` / preset run `Q`） |
| `0dji9it51s1b7.js` 同族 | — | 上传流程 `B` / 输入校验 `H` / 3D 预览 `Q` |

### 可复现命令

```bash
# 1. 起桥并进入 Run App 页面（需登录态）
tmwd-browser start
tmwd-browser exec <SID> '{"cmd":"tabs","method":"create","url":"https://app.flora.ai/techniques/artwork-to-physical"}'

# 2. 枚举动态 chunk（比静态语料多 28 个）
tmwd-browser exec <SID> 'const urls=[...document.querySelectorAll("script[src]")].map(s=>s.src); return JSON.stringify(urls.length)'

# 3. 定位 handleRunTechnique_viaApi
tmwd-browser exec <SID> 'const urls=[...document.querySelectorAll("script[src]")].map(s=>s.src); let o={}; await Promise.all(urls.map(async u=>{const t=await (await fetch(u)).text(); const i=t.indexOf("handleRunTechnique_viaApi"); if(i>=0) o[u.split("/").pop()]=t.slice(i-1200,i+1500)})); return JSON.stringify(o)'
```

### 已解决的原缺口

| 原缺口编号 | 状态 |
|---|---|
| #1 `/api/workflow/run-technique` 请求体 | ✅ **已解决**（本文 A/B/C 节） |
| #2 Run App 桌面主页面 chunk 未捕获 | ✅ **已解决**（`0dji9it51s1b7.js`） |
| #3 `/api/techniques/publish\|update` 请求体 | ⏳ 端点已知，调用方仍在定位 |
| #6 "Build Technique" 入口与四步面板渲染组件 | ⏳ 待补 |

### 未解

- `createRequestHeaders()` 的具体 header 集合（模块 598215）
- `buildTechniqueInputAssets` 的完整实现（模块引用 `j`）
- `/api/techniques/publish` 的调用方 chunk（同法可补）
- 服务端 `run-technique` 的响应体结构（需抓真实响应）
