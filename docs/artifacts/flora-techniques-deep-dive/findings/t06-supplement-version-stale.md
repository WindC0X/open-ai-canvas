# T06 补充 · 工具/技法版本化机制（缺口 #7 已补齐）

> 2026-09-30 补抓。方法：tmwd-browser 进 Fashion Studio（`/studios/fashion-studio/open`，重定向到 `/projects/<id>?view=editor`）→ 枚举 chunk → 关键词定位。
> 证据等级：**一手逐字**（bundle 原文）。
>
> **为何此前"未找到"**：T06 原检索词是 `New version` / `updateAvailable` / `hasNewVersion` / `isOutdated`，而真实标识符是
> **`TECHNIQUE_SNAPSHOT_STALE_*`** 与 **`getIsTechniqueBlockPinnedToOlderSnapshot`**——机制名是「快照过期」而非「版本更新」。

## 0. 结论先行

**这不是"工具版本化 UI"，而是「技法快照过期」机制**，且它绑定在**画布上的技法块**（technique block），不是 Studio 工具列表。

```
技法定义有多个快照（snapshotId）
  ↓
画布上的技法块记录 blockSnapshotId（创建时钉住的版本）
  ↓
服务端提供 latestSnapshotId（最新发布版本）
  ↓
两者不等 → 块"钉在旧快照" → UI 提示 + 编辑受阻
```

**官方文档说的 "New version available / Update" 就是这个机制的 UI 表现。**

---

## 一、机制级附录（逐字）

### A. 文案常量（`2nvrwl4dv01b-.js`，模块 793088）

```js
e.s([
  "TECHNIQUE_SNAPSHOT_STALE_MESSAGE", 0,
  "A newer version of this technique has been published. Update the block to the latest version before editing.",
  "TECHNIQUE_SNAPSHOT_STALE_TOOLTIP", 0,
  "Update to latest version of technique to update"
])
```

- `TECHNIQUE_SNAPSHOT_STALE_MESSAGE` → **toast 报错文案**（阻止编辑时弹出）
- `TECHNIQUE_SNAPSHOT_STALE_TOOLTIP` → **hover 提示文案**（悬浮在更新入口上）

### B. 核心判定函数（`2nvrwl4dv01b-.js`，模块 210463）

```js
e.s(["getIsTechniqueBlockPinnedToOlderSnapshot", 0, function (e) {
  return !!e.blockSnapshotId && !!e.latestSnapshotId && e.blockSnapshotId !== e.latestSnapshotId
}])
```

**判定逻辑**：三个条件同时成立才算过期
1. `blockSnapshotId` 存在（块已钉版本）
2. `latestSnapshotId` 存在（服务端有最新版本）
3. 两者**不相等**

→ 纯函数，输入 `{blockSnapshotId, latestSnapshotId}`，输出 boolean。

### C. 编辑受阻路径（`2nvrwl4dv01b-.js`，模块 144464 附近）

```js
// 逐字抄录（编辑入口的 async 回调）
c = async () => {
  if (!f || g?.listing?.deleted === !0) return;
  if (E) return void n.toast.error(i.TECHNIQUE_SNAPSHOT_STALE_MESSAGE);   // ★ 过期 → 直接 toast 报错并返回
  if (S && !await S()) return;
  r.liveblocksStore.getState().detachStorage();
  let e = h({ wrapInGroup: !1 });
  if (!e) return void r.liveblocksStore.getState().attachStorage();
  w({ nodeId: m, techniqueRow: g, techniqueDefinition: f, techniqueId: y, techniqueName: x,
      snapshotId: v, canvasNodeIdByGraphId: e.canvasNodeIdByGraphId,
      graphIdByCanvasNodeId: e.graphIdByCanvasNodeId, entrypoint: b, ...I ? { isAdminEdit: I } : {} });
  let t = Object.values(e.canvasNodeIdByGraphId);
  t.length > 0 && N(t)
}
```

**关键**：`E` 为真时**直接 toast 报错并 return**——编辑被硬性阻止，用户必须先更新块版本。

`E` 由组件内计算（含 `...blockSnapshotId, ...latestSnapshotId` 等依赖），即 `getIsTechniqueBlockPinnedToOlderSnapshot(...)` 的结果。

### D. 待处理编辑标记（`2nvrwl4dv01b-.js`，模块 294964）

```js
let t = new Set;                       // 模块级 Set
e.s([
  "consumeTechniqueBlockPendingEdit", 0, function (e) {
    return !!t.has(e) && (t.delete(e), !0)     // 读取并清除（一次性）
  },
  "markTechniqueBlockPendingEdit", 0, function (e) { t.add(e) }
])
```

**语义**：`markTechniqueBlockPendingEdit(blockId)` 标记某技法块有"待处理编辑"；`consumeTechniqueBlockPendingEdit(blockId)` **读取后立即清除**（一次性消费）。用于「更新版本后自动进入编辑」这类流程的状态传递。

### E. 技法块输出节点的版本相关字段

```js
// 逐字（模块 881269 addTechniqueOutputNodesMutation 附近）
if (d) {
  let e = c.get("data"),
    t = e.pendingTechniqueRunId === d,
    i = t || null == e.lastTechniqueRunId,
    n = t ? void 0 : e.pendingTechniqueRunId,
    o = i ? d : e.lastTechniqueRunId;
  if (n !== e.pendingTechniqueRunId || o !== e.lastTechniqueRunId) {
    let t = { ...e, pendingTechniqueRunId: n, lastTechniqueRunId: o };
    c.set("data", t)
  }
}
```

技法块节点 data 里的运行相关字段：`pendingTechniqueRunId` / `lastTechniqueRunId`。

### F. 节点级版本（与技法块版本是两套）—— 澄清

`440x_k-bktkm8.js` 里还有一套**节点类型版本**：

```js
{
  id: e, type: t, position: n,
  data: {
    label: E,
    currentVersion: a.nodesConfig[t].latestVersion,     // ★ 节点类型版本
    inputKey: a.nodeInputKeys[t],
    outputKey: a.nodeOutputKeys[t],
    ...
  },
  ...
}
```

节点配置表（`3w-31noquwqf6.js`）：

```js
k = {
  [n.NodeTypes.staticImageBlock]: { name, displayName: "Image", nodeFunction: "image",
    outputKey: u.imageUrl, latestVersion: 1, description: "An uploaded image.", onlySystemAdd: !0 },
  [n.NodeTypes.staticVideoBlock]: { ..., latestVersion: 1, description: "An uploaded video.", onlySystemAdd: !0 },
  [n.NodeTypes.webcamNode]: { ..., nodeFunction: "source", latestVersion: 1,
    description: "Capture photos and video from your webcam." },
  [n.NodeTypes.resultVideoBlock]: { ..., latestVersion: 1 },
  ...
}
```

**两套版本的区别**：

| | 节点类型版本 | 技法块快照版本 |
|---|---|---|
| 字段 | `currentVersion` vs `nodesConfig[type].latestVersion` | `blockSnapshotId` vs `latestSnapshotId` |
| 粒度 | 节点类型（如 staticImageBlock） | 单个技法块实例 |
| 判定 | 未找到比较函数（可能仅作记录） | `getIsTechniqueBlockPinnedToOlderSnapshot` |
| UI | 未找到 | toast + tooltip（本文 A/B/C 节） |

---

## 二、产品级摘要

### 机制设计意图

**为什么要钉快照？**

技法被发布后，作者可能继续改（产生新快照）。已放在别人画布上的技法块如果自动跟随最新版：
- 图结构可能变化 → 用户的输入连线失效
- 模型/参数可能变化 → 结果不可复现
- 成本可能变化 → 用户预期被打破

所以**块钉在创建时的快照**，只有用户显式"更新"才迁移。

### 用户可见流程

```
画布上的技法块（钉在旧快照）
      │
      ├─ hover 更新入口 → tooltip: "Update to latest version of technique to update"
      │
      └─ 尝试编辑块
            │
            └─ 过期？ → toast: "A newer version of this technique has been published.
                                 Update the block to the latest version before editing."
                        （编辑被阻止）
```

### 与「技法编辑」的关系

`useEnterTechniqueBuilderEditSession`（模块 144464）——进入编辑会话时**先检查过期**。这解释了为什么编辑已有技法要新开项目（`createTechniqueCanvasProject`）：编辑的是**快照的副本**，不直接影响已发布的块。

---

## 三、证据与来源

| chunk | 大小 | 内容 |
|---|---|---|
| `2nvrwl4dv01b-.js` | 1,592,683 B | ★ 全部核心：文案常量（793088）、判定函数（210463）、编辑受阻（144464）、待处理标记（294964）、输出节点 mutation（881269） |
| `440x_k-bktkm8.js` | — | 节点级 `currentVersion` / `latestVersion` |
| `3w-31noquwqf6.js` | — | 节点配置表 `latestVersion: 1` |

### 可复现命令

```bash
# 进 Fashion Studio（会重定向到项目编辑器）
tmwd-browser exec <SID> '{"cmd":"tabs","method":"create","url":"https://app.flora.ai/studios/fashion-studio/open"}'

# 定位版本化机制（注意：搜索词是 SNAPSHOT_STALE，不是 New version）
tmwd-browser exec <SID> 'const urls=[...document.querySelectorAll("script[src]")].map(s=>s.src); let o=[]; await Promise.all(urls.map(async u=>{const t=await (await fetch(u)).text(); for(const kw of ["TECHNIQUE_SNAPSHOT_STALE_MESSAGE","getIsTechniqueBlockPinnedToOlderSnapshot"]){const i=t.indexOf(kw); if(i>=0) o.push({c:u.split("/").pop(),kw,ctx:t.slice(i-800,i+800)})}})); return JSON.stringify(o)'
```

### 检索词教训（重要）

| 错误检索词（0 命中） | 正确标识符（命中） |
|---|---|
| `New version` | `TECHNIQUE_SNAPSHOT_STALE_MESSAGE` |
| `updateAvailable` | `getIsTechniqueBlockPinnedToOlderSnapshot` |
| `hasNewVersion` | `TECHNIQUE_SNAPSHOT_STALE_TOOLTIP` |
| `isOutdated` | `blockSnapshotId` / `latestSnapshotId` |

→ **教训**：官方文档的措辞（"New version available"）与代码标识符（"snapshot stale"）是两套词汇，**从文档措辞直接反推标识符会 0 命中**。正确做法是从**功能语义**（"版本比较"）出发搜更抽象的词（`snapshotId` 比较、`stale`、`pinned`）。

### 缺口状态更新

| 原编号 | 原状态 | 新状态 |
|---|---|---|
| #7 工具升级 "New version available/Update" UI | ❌ 检索 0 命中 | ✅ **已解决**（本文） |

### 未解

- 「更新到最新版」的**实际执行函数**（点击更新后如何迁移块到新快照）——未在本次抓取中找到
- 节点级 `currentVersion` vs `latestVersion` 的**比较与迁移逻辑**（可能有，但未定位）
- Studio 工具列表页是否复用同一套（列表页无此 UI，推测工具=技法故共用）
