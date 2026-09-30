# T02/T03 补充 · technique publish/update 契约（缺口 #3 已补齐）

> 2026-09-30 补抓。方法：tmwd-browser 进画布项目页（Technique Builder 代码随画布加载）→ 枚举 chunk → 关键词定位。
> 证据等级：**一手逐字**（bundle 原文）。

## 0. 结论先行

`publish` / `update` **共享同一个 HTTP 客户端**，body 直接是 payload（**没有 `params` 包裹**，与 run-technique 不同），payload 由 `definitionDraft` + `listingDraft` 两段构成。

发布后若勾选"提交社区"，会**自动跑一次 validation run**（复用 run-technique）。

---

## 一、机制级附录（逐字）

### A. HTTP 客户端（`37xc5r2vs5-j_.js`）

```js
// 逐字抄录
async function ik(e, t) {
  let i = await (0, iw.createRequestHeaders)(),
    r = await fetch(e, { method: "POST", headers: i, body: JSON.stringify(t) });   // ★ body 直接是 t
  if (401 === r.status)
    throw window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`,
      Error("Session expired. Redirecting to sign-in.");
  if (!r.ok) {
    let e = `HTTP Error: ${r.status} - ${r.statusText}`;
    try {
      let t = await r.json();
      "string" == typeof t.error && t.error.length > 0 && (e = t.error)      // ★ 读 string 型 error
    } catch {}
    throw Error(e)
  }
  return await r.json()
}

async function iC(e) {                                    // publish
  try { return await ik(t6.appRoutes.api.techniques.publish, e) }
  catch (e) { throw w.log.error("Error calling technique publish API", { error: e }), e }
}

async function iE(e) {                                    // update
  try { return await ik(t6.appRoutes.api.techniques.update, e) }
  catch (e) { throw w.log.error("Error calling technique update API", { error: e }), e }
}
```

**与 run-technique 的关键差异**：

| | run-technique | publish / update |
|---|---|---|
| body 形态 | `{ params: <payload> }` | `<payload>`（直接） |
| 错误处理 | 返回 `{error}` 对象 | **抛异常** |
| 错误字段 | `error.description ?? error.title` | 读 body 的 `error`（string） |

### B. payload 构造器 `iR`（逐字）

```js
function iR(e) {
  let t = iD(e.publish.name),
    i = iD(e.publish.shortName),
    r = iD(e.publish.icon),
    n = e.publish.studioAccent,
    o = iD(e.publish.description);
  // ★ 校验：name / description / visibility / 至少一个 output，缺一即抛
  if (!t || !o || !e.publish.visibility || 0 === e.preparedGraph.graph.outputs.length)
    throw Error("Technique publish metadata is incomplete");
  let a = (0, iO.normalizeTechniqueSlug)(t);
  if (!a) throw Error("Technique publish metadata is incomplete");

  let s = {                                     // ← definitionDraft
    name: t,
    ...i ? { shortName: i } : {},
    ...r ? { icon: r } : {},
    ...n ? { studioAccent: n } : {},
    description: o,
    chargedCost: e.preparedGraph.chargedCost,
    chargedUsageCost: e.preparedGraph.chargedUsageCost,
    ...e.preparedGraph.executionCost ? { executionCost: e.preparedGraph.executionCost } : {},
    graph: e.preparedGraph.graph
  };
  let l = iD(e.publish.thumbnailUrl) ?? e.preparedGraph.previewImageUrl,
    c = e.preparedGraph.previewVideoUrl;

  return {
    definitionDraft: s,
    listingDraft: {                             // ← listingDraft
      slug: a,
      tags: e.publish.tags,
      visibility: e.publish.visibility,
      appLinkAccess: e.publish.appLinkAccess,
      open: e.publish.open,
      ...e.publish.category ? { category: e.publish.category } : {},
      ...l ? { previewImageUrl: l } : {},
      ...l ? { previewImageFit: e.publish.thumbnailFit } : {},
      ...c ? { previewVideoUrl: c } : {},
      ...i ? { shortName: i } : {},
      ...r ? { icon: r } : {},
      ...n ? { studioAccent: n } : {},
      actions: (0, ij.computeActionsCount)({ graph: e.preparedGraph.graph })
    }
  }
}
```

### C. 完整 payload（逐字，含 definition/listing 之外的外层字段）

```js
// 逐字抄录
let { definitionDraft: d, listingDraft: h } = iR({
  preparedGraph: j,
  publish: o
    ? { ...f, visibility: "public" === f.visibility ? "private" : f.visibility ?? "private", appLinkAccess: "public" }
    : f
});
if (!T) throw Error("Publish selections are missing. Reopen the publish step and try again.");

let m = o ? { ...f, visibility: "private", appLinkAccess: "public" } : f,
  C = "edit" === S
    ? JSON.stringify(iA.liveblocksStore.getState().detachedStorage?.getStorage().toJSON())
    : null;
if ("edit" === S && !C)
  throw Error("Technique edit canvas state is missing. Reopen the editor and try again.");

let E = {
  projectId: l,
  ...C ? { storageJson: C } : {},                       // ★ edit 模式才带：Liveblocks 画布状态快照
  selectedInputNodeIds: T.selectedInputNodeIds,
  selectedOutputNodeIds: T.selectedOutputNodeIds,
  inputDefinitionsByNodeId: T.inputDefinitionsByNodeId,
  outputDefinitionsByNodeId: T.outputDefinitionsByNodeId,
  inputPresetsByNodeId: T.inputPresetsByNodeId,
  publish: m
};

if ("edit" === S) {
  if (!b?.snapshotId) throw Error("Technique snapshot is missing. Reopen the technique editor and try again.");
  k = await iE({ ...E, currentSnapshotId: b.snapshotId, ...b.recordsSource ? { recordSource: !0 } : {} })   // update
} else {
  k = await iC(E)                                                                                          // publish
}
```

**payload 字段表**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `projectId` | string | ✅ | 来源画布项目 |
| `storageJson` | string | edit 模式必填 | Liveblocks `detachedStorage` 的 JSON 序列化（画布状态） |
| `selectedInputNodeIds` | array | ✅ | 输入节点 id 列表 |
| `selectedOutputNodeIds` | array | ✅ | 输出节点 id 列表 |
| `inputDefinitionsByNodeId` | object | ✅ | 节点 id → 输入定义 |
| `outputDefinitionsByNodeId` | object | ✅ | 节点 id → 输出定义 |
| `inputPresetsByNodeId` | object | ✅ | 节点 id → 预设值 |
| `publish` | object | ✅ | 见下 |

**`publish` 对象**（UI 表单态 `f`，可能被 `o` 改写）：

| 字段 | 说明 |
|---|---|
| `name` | 技法名（必填，用于生成 slug） |
| `shortName` | 短名（可选） |
| `icon` | 图标（可选） |
| `studioAccent` | Studio 主题色（可选） |
| `description` | 描述（必填） |
| `category` | 分类（可选） |
| `tags` | 标签 |
| `visibility` | `private` / `unlisted` / `workspace` / `public` |
| `appLinkAccess` | app 链接访问级别 |
| `open` | 是否开放 |
| `thumbnailUrl` / `thumbnailFit` | 缩略图与适配方式 |
| `submitToCommunityLibrary` | 是否提交社区（见 E） |

**提交社区时的 visibility 改写**（逐字）：
```js
// 勾选提交社区（o 为真）时，publish 里 visibility 被强制降级
publish: { ...f, visibility: "public" === f.visibility ? "private" : f.visibility ?? "private", appLinkAccess: "public" }
// 且 m（实际传给后端的）也被改写
m = { ...f, visibility: "private", appLinkAccess: "public" }
```
→ **提交社区 = 先私有 + app 链接公开，待审核通过才变 public**

### D. `definitionDraft` / `listingDraft` 分离

**这是 listing 与 definition 分离的直接证据**（此前 T01 只能推断）：

```js
{
  definitionDraft: { name, shortName?, icon?, studioAccent?, description,
                     chargedCost, chargedUsageCost, executionCost?, graph },
  listingDraft:    { slug, tags, visibility, appLinkAccess, open, category?,
                     previewImageUrl?, previewImageFit?, previewVideoUrl?,
                     shortName?, icon?, studioAccent?, actions }
}
```

- `definitionDraft` = 可执行物（graph + 计价）
- `listingDraft` = 可展示物（slug + 标签 + 可见性 + 预览图 + `actions` 计数）

### E. 发布后自动 validation run（逐字）

```js
let _ = !1;
if (o) {                                       // o = submitToCommunityLibrary
  try {
    let t = await e({ definitionId: k.techniqueDefinitionId }),      // submitForReview
      i = j.graph,
      r = i.presets?.[0]?.inputs ?? {},
      n = b?.graph?.presets?.[0]?.inputs ?? {},
      o = i.inputs.map(e => {
        let t = r[e.id] ?? n[e.id];
        return { inputId: e.id, type: e.type, value: (0, iN.getPresetValueStringForType)(t, e.type) ?? "" }
      }).filter(e => "" !== e.value),
      a = await (0, i_.handleRunTechnique_viaApi)({ runId: t.validationRunId, inputAssets: o });
    if (a.error) throw Error(a.error.description ?? "Failed to start validation run");
    _ = !0
  } catch {
    K.toast.error("Technique published, but failed to submit for review. Please try again.")
  }
}
```

**完整发布流程**：
```
1. iR() 构造 definitionDraft + listingDraft
2. iC(E) 或 iE(E)  → POST /api/techniques/publish|update
   → 返回 { techniqueDefinitionId, ... }
3. 若勾选提交社区：
   a. submitForReview({ definitionId })  → { validationRunId }     (Convex)
   b. handleRunTechnique_viaApi({ runId: validationRunId, inputAssets })   (REST)
      ← inputAssets 从 graph.presets[0].inputs 生成，空值过滤掉
4. 埋点 technique_builder_published
```

→ **这解释了 `getLatestValidationRun` 的用途**：社区提交必须跑一次验证运行，其结果供审核参考。

### F. 发布埋点属性（逐字）

```js
(0, iq.captureTechniqueBuilderEvent)(s.EVENTS.technique_builder_published, {
  ...y ?? {},                                  // 可能是 referrer 类
  builder_mode: S,                             // "create" | "edit"
  ...l ? { project_id: l } : {},
  ..."edit" === S && x ? { technique_slug: x } : {},
  builder_node_count: p.size,
  builder_edge_count: u.size,
  ...g ? { entry_source: g } : {},
  publish_action: "edit" === S ? "update" : "create",
  technique_name: d.name
})
```

### G. 审核状态机补全（逐字）

```js
function iF() {
  // ...
  let s = (0, l.useQuery)(i.api.techniques.queries.getReviewStatus, e);
  if (s.isOwner || s.currentUserCanFloristEdit) return iB;      // iB = {isAdminEdit:false, isLoading:false, isAdminBlockedOutOfWindow:false}
  if ("pending" !== s.status && "admin_edit_pending" !== s.status && "admin_edit_rejected" !== s.status) {
    return { ...iB, isAdminBlockedOutOfWindow: !0 }
  }
  return { ...iB, isAdminEdit: !0 }
}
```

**`reviewStatus` 完整枚举（逐字，4 值）**：

| 值 | 含义 |
|---|---|
| `pending` | 待审核 |
| `admin_edit_pending` | 管理员编辑待复核 |
| `admin_edit_rejected` | 管理员编辑被拒 ← **T02 未捕获的第四值** |
| （其余） | 走 `isAdminBlockedOutOfWindow` 分支 |

**额外字段**：`isOwner`、`currentUserCanFloristEdit`（FLORA 内部员工可编辑）
**另一 mutation**：`api.admin.techniques.mutations.submitAdminEditForReview`

→ **这修正了 SYNTHESIS.md §6.1 矛盾裁定的第 1 条**：`reviewStatus` 不是「至少 3 值」，而是**至少 4 值**（新增 `admin_edit_rejected`）。

---

## 二、产品级摘要

### 发布的两条路径

| 路径 | 触发 | payload 差异 | 端点 |
|---|---|---|---|
| **create** | 首次发布 | 无 `storageJson` | `/api/techniques/publish` |
| **edit** | 编辑已有技法 | 带 `storageJson`（Liveblocks 状态）+ `currentSnapshotId` + 可选 `recordSource` | `/api/techniques/update` |

### 编辑模式的画布状态传递

`storageJson` 是 **Liveblocks `detachedStorage`** 的 JSON 序列化——即技法编辑画布是**独立的 Liveblocks room**，其状态被序列化后随 payload 提交。这解释了为什么编辑技法要"新开一个项目"（`createTechniqueCanvasProject`）。

### 社区提交的双重保护

1. **可见性降级**：提交社区时 `visibility` 强制为 `private`（即使表单填了 public），`appLinkAccess` 设为 `public`
2. **验证运行**：必须成功跑一次 validation run 才真正进入审核

---

## 三、证据与来源

| chunk | 大小 | 内容 |
|---|---|---|
| `37xc5r2vs5-j_.js` | 132,177 B | ★ HTTP 客户端 `ik`/`iC`/`iE` + payload 构造 `iR` + 发布流程 + 审核状态机 `iF` |
| `2nvrwl4dv01b-.js` | — | 画布技法块执行（见 t03-supplement） |
| `245x6abtmz2ih.js` | 54,374 B | 路由常量 `techniques:{publish,update}` |

### 可复现命令

```bash
# 进画布项目页（Technique Builder 代码随画布加载）
tmwd-browser exec <SID> '{"cmd":"tabs","method":"create","url":"https://app.flora.ai/projects/<projectId>"}'
# 定位 publish 客户端
tmwd-browser exec <SID> 'const urls=[...document.querySelectorAll("script[src]")].map(s=>s.src); let o={}; await Promise.all(urls.map(async u=>{const t=await (await fetch(u)).text(); const i=t.indexOf("async function ik("); if(i>=0) o[u.split("/").pop()]=t.slice(i-200,i+2600)})); return JSON.stringify(o)'
```

### 已解决的缺口

| 原编号 | 状态 |
|---|---|
| #1 run-technique 请求体 | ✅ 已解决（t03-supplement） |
| #2 Run App 主页面 chunk | ✅ 已解决（t03-supplement） |
| #3 publish/update 请求体 | ✅ **本文解决** |
| #6 Builder 四步面板渲染组件 | ✅ 部分（本文拿到 store 与 payload；渲染树仍未逐行） |
| #5 `approveAdminEdit` 等服务端函数 | ⏳ 客户端调用点已知，服务端不可得 |

### 未解

- `/api/techniques/publish` 的**响应体**结构（只知消费 `techniqueDefinitionId`，update 额外消费 snapshotId）
- `createRequestHeaders()` 的具体 header 集合
- `normalizeTechniqueSlug` / `computeActionsCount` 的实现细节
