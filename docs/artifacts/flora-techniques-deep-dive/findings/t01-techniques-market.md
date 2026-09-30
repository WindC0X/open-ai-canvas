# Techniques 市场与列表/详情（数据层）

> 逆向来源：FLORA (app.flora.ai) Next.js/turbopack 前端 bundle，本地副本 `/tmp/flora-chunks/*.js`（137 个 chunk）。
> 证据等级说明：**一手逐字** = bundle 中直接读到的标识符/字符串/逻辑；**推断** = 由字段用法推导、未在 bundle 中见到明确定义；**未找到** = 多轮检索无结果。
> 本文由两轮 agent 接力完成；前一轮（history）已完成部分结论，本轮补齐 schema/列表查询/分类/快照/收藏，以下所有机制段均标注具体 chunk。

## 一、产品级摘要

### 1.1 能力清单

| 能力 | 说明 | 证据 |
|---|---|---|
| 市场浏览 | Techniques 库，四个 tab：Community（社区）/ Workspace（工作区）/ My Techniques（我的）/ Favorites（收藏） | 一手，`2n-l3nic7n76j.js` |
| 分类过滤 | 10 个固定分类 + "All" + "Featured" 过滤 tab，横向滚动胶囊条 | 一手，`18_rcz_m_sgob.js`、`1mmwhx_zs_eu3.js` |
| Featured 精选 | 社区 tab 内单独 Featured 区块（取前 2 个，双列大卡）；`isFeatured` + `sortOrder` 排序 | 一手，`2n-l3nic7n76j.js`、`1mrn9kx6teaj4.js` |
| 搜索 | 输入即搜（250ms 防抖 + AbortController），`POST /api/techniques/search`，库内按 listingId 匹配本地列表 | 一手，`3u2jerdo-_t4a.js`、`2n-l3nic7n76j.js` |
| 收藏 | 登录用户按 listingId 收藏/取消；收藏集合经 Convex 查询拉取；Favorites tab 聚合展示 | 一手，`1mmwhx_zs_eu3.js`、`2n-l3nic7n76j.js` |
| 卡片操作 | Try（直接运行）/ View details（进详情）/ Edit（新项目打开）/ Delete（10 秒撤销）/ 收藏切换 / 右键菜单 | 一手，`2n-l3nic7n76j.js`、`1mmwhx_zs_eu3.js` |
| 使用数展示 | runCount 由 `getTechniqueRunCounts` 拉取注入列表；≥ `MIN_RUN_COUNT_TO_DISPLAY`(10) 才在卡片显示 | 一手，`1mmwhx_zs_eu3.js`、`18_rcz_m_sgob.js` |
| 最近使用 | `getRecentlyUsedTechniqueIds({limit:5})`，映射回列表项 | 一手，`1mrn9kx6teaj4.js` |
| 可见性/审核 | visibility：public / workspace / unlisted / private；reviewStatus：pending / published；提交社区审核、撤回、访问设置对话框 | 一手，`1mmwhx_zs_eu3.js`、`2n-l3nic7n76j.js` |
| 快照 | 每个 technique definition 有 `snapshotId`；路由与编辑按 snapshot 定位 | 一手（前轮 + 本轮），`2n-l3nic7n76j.js`、`1mrn9kx6teaj4.js` |

### 1.2 市场页交互流程

```
/dashboard (Techniques view)
 ├─ Tab: community | workspace | myTechniques | favorites      （URL ?tab=，默认 community）
 ├─ Category 胶囊: all | featured | essentials | brandVisualDesign | ... （URL ?category=，默认 all）
 │   · "featured" 仅 community tab 生效，其他 tab 自动回落 "all"
 ├─ community:
 │    ├─ Featured 区块（isFeatured 列表前 2 张，大卡 FeaturedCard）
 │    └─ All Techniques 区块（按 category 分组，组内 listing.sortOrder 排序；4 列网格）
 ├─ workspace: visibility==="workspace" && workspaceId===当前工作区
 ├─ myTechniques: creatorUserId===我，按 updatedAt 倒序
 └─ favorites: 收藏的 listingId 集合 ∩ (community ∪ my ∪ workspace)，按 techniqueDefinitionId 去重

卡片操作:
  ├─ Try          → captureAnalytics("technique_page_viewed",{source:"dashboard"}) → /techniques/<slug>
  ├─ View details → captureAnalytics("technique_detail_viewed") → /techniques/manage/<slug>?from=<tab>
  ├─ Edit         → createTechniqueCanvasProject → 新项目 URL 带 snapshotId/technique/EDIT=1
  ├─ Delete       → 确认对话框 → deleteTechnique → 10s "Undo" toast
  └─ ♥           → add/removeTechniqueFromFavorites({listingId})
```

### 1.3 用户可见语义（重点文案，逐字）

| 位置 | 文案 |
|---|---|
| 卡片徽章 | "New"（published 且 publishedAt 距今 ≤ 7 天，`6048e5` ms）、"In Review"（pending）、"Public"/"Workspace"/"Unlisted"/"Private"（访问级别，aria-label `Access: {label}`） |
| 卡片署名 | `by {creator.name ?? "FLORA"}`；若 creator.company 存在：`{name} from {company}` |
| 使用数 | `{formatNumberCompact(runCount)}` + 上箭头图标（runCount ≥ 10 才显示）；收藏数 >0 显示爱心数字 |
| 删除确认 | "You'll have 10 seconds to undo this action."；撤销按钮 "Undo" |
| 删除 toast | "Technique deleted" / 撤销后 "Technique restored" |
| 空状态 | "No techniques found" / "Try a different search term." / "Check back soon for new techniques." |
| 搜索标题 | `Search results for “{query}”` |
| 收藏按钮 | aria-label "Add to favorites" / "Remove from favorites"，aria-pressed |
| 访问对话框 | "Change Technique access" / "Where should this Technique be listed?" |
| 编辑失败 | "Technique definition not found" / `TOAST_MESSAGES.EDIT_IN_PROJECT_FAILED` |
| 添加画布 | `Added "{name}" to canvas` |

### 1.4 分类体系（一手逐字，`18_rcz_m_sgob.js` @2285）

10 个分类，显示顺序固定：

| key | label |
|---|---|
| essentials | Essentials |
| brandVisualDesign | Brand & Visual Design |
| productVisualization | Product Visualization |
| marketingAds | Marketing & Ads |
| videoAnimation | Video & Animation |
| fashionApparelEditorial | Fashion & Apparel Editorial |
| contentPackaging | Content Packaging |
| printFilmVfx | Film & VFX |
| spaceArchitecture | Space & Architecture |
| funInspiration | Fun & Inspiration |

展示分类列表 = 当前列表里实际出现的 category 与 `CATEGORY_DISPLAY_ORDER` 的交集（按固定顺序）；"all"/"featured" 永远在最前。

## 二、机制级附录

### 2.1 常量（一手逐字）

```js
// 18_rcz_m_sgob.js @2285
CATEGORY_DISPLAY_ORDER = ["essentials","brandVisualDesign","productVisualization",
  "marketingAds","videoAnimation","fashionApparelEditorial","contentPackaging",
  "printFilmVfx","spaceArchitecture","funInspiration"]
MAX_TECHNIQUE_NODE_LABEL_LENGTH = 200
MIN_RUN_COUNT_TO_DISPLAY = 10
TECHNIQUE_CATEGORIES = { essentials:"Essentials", brandVisualDesign:"Brand & Visual Design",
  productVisualization:"Product Visualization", marketingAds:"Marketing & Ads",
  videoAnimation:"Video & Animation", fashionApparelEditorial:"Fashion & Apparel Editorial",
  contentPackaging:"Content Packaging", printFilmVfx:"Film & VFX",
  spaceArchitecture:"Space & Architecture", funInspiration:"Fun & Inspiration" }
TECHNIQUE_GRAPH_ISSUE_CODES = { MISSING_OUTPUT:"missing_output", DUPLICATE_ID:"duplicate_id",
  INVALID_EDG... /* 截断于 bundle 片段外 */ }

// 1mrn9kx6teaj4.js（同一 bundle 内 TECHNIQUE_PREVIEW_SIZE）
TECHNIQUE_PREVIEW_SIZE   = { width: 512, height: 326 }
TECHNIQUE_THUMBNAIL_SIZE = { width: 64,  height: 64 }

// 1mmwhx_zs_eu3.js
"New" 徽章窗口 = 6048e5 ms（7 天）
category 过滤 tabs = ["all","featured",...CATEGORY_DISPLAY_ORDER]，显示名 {all:"All",featured:"Featured",...TECHNIQUE_CATEGORIES}
```

### 2.2 数据模型（listing / definition，字段级）

**列表项（provider 输出 item）**——由 `TechniquesProvider` 合并后使用，字段为跨 chunk 逐字汇总（`1mrn9kx6teaj4.js`、`3jqi80vqxl126.js`、`2n-l3nic7n76j.js`、`1mmwhx_zs_eu3.js`）：

```
item = {
  techniqueDefinitionId: string,
  listingId: number,              // 收藏/可见性 mutation 的键；搜索匹配键（String(listingId)）
  name: string,
  description?: string,
  slug?: string,                  // 路由用；缺失时回退 techniqueId
  snapshotId?: string,            // definition 快照 ID
  visibility: "public" | "workspace" | "unlisted" | "private",
  reviewStatus?: "pending" | "published",
  publishedAt?: number,
  runCount?: number,              // 经 getTechniqueRunCounts 注入
  creatorUserId: string,
  workspaceId?: string | null,
  creator?: { name?, profileImg?, company? },
  currentUserCanEdit?: boolean,   // 默认 x?._id===creatorUserId（x=maybeMe）
  currentUserIsCreator?: boolean,
  currentUserCanOpenInAppMode?: boolean,  // isFloraAdminEmail(x.email)
  open?: boolean,                 // currentWorkflowVisible（卡片菜单用）
  updatedAt: number,
  listing: {
    name?, description?, slug?,
    category?: string,            // TECHNIQUE_CATEGORIES 的 key
    isFeatured?: boolean,
    sortOrder?: number,
    visibility?, deleted?: boolean, deletedAt?,
    favoriteCount?: number,       // TechniqueCard: $.favoriteCount ?? 0
    appLinkAccess?: "inherit" | ...,
    previewImageUrl?, previewVideoUrl?, previewImageFit?,
    outputItems?: [{ type: "imageUrl" | ... }],
    publishedAt?, updatedAt?,
  },
  definition?: {...}              // 仅 authenticated 下有值（来自 personalized delta）
}
```

**快照/版本机制（一手）**：
- item 携带 `snapshotId`；Provider 内部建索引 `Z: snapshotId → item`，`getTechniqueBySnapshotId(sid)` 与 `getDefinitionBySnapshotId(sid)`（后者 = `Z.get(sid)` 后取 `J.get(item.techniqueDefinitionId)`，`J` = definition map，仅 authenticated 构建）。
- 编辑入口 `useEditTechniqueInNewProject`（前轮已确立）：`createTechniqueCanvasProject({techniqueName})` → `{projectId}`，新窗口 URL `…?EDIT_IN_CANVAS_QUERY_PARAM_SNAPSHOT=<item.snapshotId>&…TECHNIQUE=<id>&…EDIT=1`；无 `snapshotId` 直接报 "Technique definition not found"。
- 说明：definition 与 listing 分离——listing 承载市场元数据（分类/精选/排序/可见性/删除标记），definition 承载可运行快照；个性化的 listing 覆盖经 `getPersonalizedTechniqueDelta` 合入。

**合并算法（一手逐字，`1mrn9kx6teaj4.js`）**：

```js
// visible=基础列表 e，delta=个性化 t；以 techniqueDefinitionId 为键
let s = new Map; for (let t of e) s.set(t.techniqueDefinitionId, t);
for (let e of t) {
  let t = s.get(e.techniqueDefinitionId), i = t?.listing;
  s.set(e.techniqueDefinitionId, { ...t, ...e, listing: { ...i, ...e.listing,
    category:  i?.category  ?? e.listing.category,
    isFeatured:i?.isFeatured?? e.listing.isFeatured,
    sortOrder: i?.sortOrder ?? e.listing.sortOrder,
    visibility:i?.visibility?? e.listing.visibility,
    deleted:   i?.deleted   ?? e.listing.deleted },
    definition: e.definition ?? t?.definition });
}
// 本地删除标记 N（setTechniqueDeletedState）叠加：listing.deleted=true
```

**mapper（一手逐字）**：
```js
// u(e) — visible list mapper
{ ...e, listing: e.listing, reviewStatus: e.reviewStatus ?? ("number" == typeof e.publishedAt ? "published" : undefined) }
// h(e) — delta mapper
{ ...e, listing: e.listing, reviewStatus: e.reviewStatus, definition: e.definition }
```

### 2.3 Convex 端点（一手逐字，按调用点）

| 端点 | 参数 → 返回 | 调用处 |
|---|---|---|
| `api.techniques.publicQueries.getVisibleTechniques` | `{}` → 可见 technique 列表 | Provider（public 与 authenticated 均先拉） |
| `api.techniques.clientQueries.getPersonalizedTechniqueDelta` | `{}` → delta 列表（含 definition、listing 覆盖） | Provider（仅 authenticated） |
| `api.techniques.publicQueries.getTechniqueRunCounts` | `{techniqueDefinitionIds: string[]}` → `[{techniqueDefinitionId, runCount}]` | Provider runCount 注入 |
| `api.techniqueRuns.queries.getRecentlyUsedTechniqueIds` | `{limit:5}` → `string[]`（definitionIds，映射回列表） | Provider |
| `api.techniques.queries.getFavoriteTechniqueListingIds` | auth 时 `{}`，否则 `"skip"` → `string[]/number[]`（构造 Set） | `useFavoriteTechniqueListingIds` |
| `api.techniques.mutations.addTechniqueToFavorites` | `{listingId}` | `useToggleTechniqueFavorite` |
| `api.techniques.mutations.removeTechniqueFromFavorites` | `{listingId}` | 同上 |
| `api.techniques.mutations.deleteTechnique` | `{definitionId}` | 市场页删除流 |
| `api.techniques.mutations.undoDeleteTechnique` | `{definitionId}` | 撤销 Undo（10s） |
| `api.techniques.mutations.setTechniqueListingVisibility` | `{listingId, visibility, appLinkAccess, updatedAt: Date.now()}` | TechniqueAccessDialog |
| `api.techniques.mutations.setTechniqueWorkflowVisibility` | `{listingId, open, updatedAt: Date.now()}` | TechniqueAccessDialog |
| `api.techniques.mutations.submitForReview` | `{definitionId}` | TechniqueAccessDialog |
| `api.techniques.mutations.withdrawSubmission` | （调用形如 `K()`，参数被编译重排，见注） | TechniqueAccessDialog |
| `api.appMode.mutations.createTechniqueCanvasProject` | `{techniqueName}` → `{projectId}` | `useEditTechniqueInNewProject`（前轮） |

注：AccessDialog 内 mutation 变量名（W/G/J/K）与调用点经 React Compiler 重排，`J({definitionId:g})`、`K()` 的具体语义对位存在歧义（J 声明为 submitForReview，但相邻 toast 为 "Submission withdrawn"）；此处仅保证 mutation 名称与参数形态为逐字。

**HTTP 端点（一手逐字，`3u2jerdo-_t4a.js`）**：

```js
POST /api/techniques/search
headers: { "Content-Type": "application/json" }
body: { query, surface, limit?, desiredOutputTypes?, availableInputTypes?, accessMode? }
       // undefined 字段以展开省略
response: { results: [...] }         // 非数组时按 [] 兜底
// 客户端：AbortController 取消旧请求；默认 debounceMs=250；
// cache key = `${query}|${surface}|${JSON.stringify({l:limit,d:desiredOutputTypes,a:availableInputTypes,m:accessMode})}`
// surface="library" 用于市场页；limit=25；搜索请求失败→ {results:[]}
```

### 2.4 列表查询与排序（一手逐字）

```js
// 市场页 tab 与过滤（2n-l3nic7n76j.js）
tabs        = ["community","workspace","myTechniques","favorites"]   // ?tab=
filters     = ["all","featured",...CATEGORY_DISPLAY_ORDER]           // ?category=; 参数名 "category"
tab 默认     = "community"；filter 默认 = "all"
featured 仅 community：E = ("featured"===A && "community"!==tab) ? "all" : A

// 列表派生（1mrn9kx6teaj4.js / 2n-l3nic7n76j.js）
currentUserTechniques = L.filter(t => me._id === t.creatorUserId && t.listing.deleted !== true)
workspaceTechniques   = L.filter(e => e.visibility==="workspace" && e.listing.deleted!==true
                                && e.workspaceId!=null && e.workspaceId===currentWorkspaceId)
community(public)     = L.filter(e => e.visibility==="public" && e.listing.deleted!==true)
featuredTechniques    = publicList.filter(e=>e.listing.isFeatured)
                          .sort((a,b)=>a.listing.sortOrder-b.listing.sortOrder)      // 升序
总排序 L              = [...list].sort((a,b) => {
                          const s=a.listing.category, i=b.listing.category;
                          if(s&&i){ const c=s.localeCompare(i); if(c!==0) return c; }
                          else if(s) return -1; else if(i) return 1;
                          return a.listing.sortOrder - b.listing.sortOrder; })
myTechniques 排序      = sortByUpdatedAtDesc(list) = [...l].sort((a,b)=>b.updatedAt-a.updatedAt)
分组                  = groupTechniquesByCategory(list) = list.reduce(...按 listing.category 分桶...)
recentlyUsed          = getRecentlyUsedTechniqueIds 结果按 map 映射，跳过已删除
```

### 2.5 收藏机制（一手逐字，`1mmwhx_zs_eu3.js` @35701）

```js
function useFavoriteTechniqueListingIds() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const args = (isAuthenticated && !isLoading) ? {} : "skip";
  const p = useQuery(api.techniques.queries.getFavoriteTechniqueListingIds, args);
  const favoriteListingIds = new Set(p ?? []);
  const isReady = !isLoading && (!isAuthenticated || p !== undefined);
  return { favoriteListingIds, isReady };
}
function useToggleTechniqueFavorite() {
  const add    = useMutation(api.techniques.mutations.addTechniqueToFavorites);
  const remove = useMutation(api.techniques.mutations.removeTechniqueFromFavorites);
  return async (listingId, isFavorited) => {
    try { isFavorited ? await remove({ listingId }) : await add({ listingId }); }
    catch (t) { toast.error(t instanceof Error && t.message ? t.message : "Failed to update favorite"); }
  };
}
// 判定：isFavorited = !!item.listingId && favoriteListingIds.has(item.listingId)
// Favorites tab 聚合：遍历 [...community, ...my, ...workspace]，listingId∈Set，
//   以 techniqueDefinitionId 去重（e.has(id) 跳过）
```

### 2.6 删除流（一手逐字，`2n-l3nic7n76j.js`）

```js
deleteTechnique = useMutation(api.techniques.mutations.deleteTechnique);
undoDelete      = useMutation(api.techniques.mutations.undoDeleteTechnique);
await deleteTechnique({ definitionId });
setTechniqueDeletedState(definitionId, true);        // 本地标记 listing.deleted=true
refetchVisibleTechniques();
toast.success("Technique deleted", { action: { label: "Undo",
  onClick: async () => { await undoDelete({ definitionId });
    setTechniqueDeletedState(definitionId, false); refetchVisibleTechniques();
    toast.success("Technique restored"); } }, duration: 1e4 });
// 错误：ConvexError && typeof data==="string" ? data : "Failed to delete technique"（undo 同理 "Failed to restore technique"）
// 确认对话框：DeleteTechniqueConfirmationDialog，description="You'll have 10 seconds to undo this action."，
//   requireConfirmationText 时可要求输入小写 trim 后等于 "confirm"
```

### 2.7 可见性 / 审核状态（一手逐字，`1mmwhx_zs_eu3.js`、`2n-l3nic7n76j.js`）

```js
visibility 徽章映射 = {
  public:    { label:"Public",    Icon: Globe },
  workspace: { label:"Workspace", Icon: Users },
  unlisted:  { label:"Unlisted",  Icon: Link  },
  private:   { label:"Private",   Icon: Lock  } }
// ariaLabel = `Access: ${label}`；hideCommunityVisibility 且 public → 不显示徽章

reviewStatus 徽章优先级：
  1) "published" && nowMs - publishedAt <= 6048e5  → "New"（Sparkles）
  2) "pending"                                      → "In Review"（Loader2, animate-spin）
  3) 否则按 visibility 显示访问徽章
// 兜底推断字段：reviewStatus ?? (typeof publishedAt==="number" ? "published" : undefined)

// TechniqueAccessDialog（"Change Technique access"）
状态初始化：T = (reviewStatus==="pending")           // 审核中
           I = pending || published                  // 已在社区流程
           initial visibility D = ("workspace"===map(y)) ? "workspace" : "private"
           appLinkAccess P 初始 = v ?? "inherit"
           workflowVisible F 初始 = j
提交形态：
  setTechniqueListingVisibility({ listingId, visibility, appLinkAccess, open, updatedAt: Date.now() }) → refetch
  setTechniqueWorkflowVisibility({ listingId, open, updatedAt: Date.now() }) → refetch
  submitForReview({ definitionId })；withdrawSubmission(...)
  文案："Access updated" / "Submission withdrawn"
copy 链接：`${window.location.origin}${appRoutes.technique(slug)}` → toast "Link copied"
```

### 2.8 路由（一手逐字，`245x6abtmz2ih.js`）

```js
appRoutes.technique        = (slug) => `/techniques/${slug}`          // 公开详情
appRoutes.techniqueDetails = (slug) => `/techniques/manage/${slug}`   // 管理/详情（?from=<tab>）
resolveTechniqueRouteSlug({techniqueId, slug, listing}) =
  o(e.slug) ?? o(e.listing?.slug) ?? o(e.techniqueId)   // o = 非空 trim；全空则 throw "Technique route slug could not be resolved"
```

### 2.9 卡片/缩略图实现细节（一手逐字，`1mmwhx_zs_eu3.js`）

```js
// 默认缩略图（4 张 CDN 背景，按运行号选择）
X = ["https://media.flora.ai/Technique%20builder/Thumbnail%20Background/Background%201.png",
     ".../Background%202.png", ".../Background%203.png", ".../Background%204.png"]
// 卡片预览优先级：previewVideoUrl → previewImageUrl(toHumaneSizedImageUrl(url, TECHNIQUE_PREVIEW_SIZE)) → outputItems[0] 类型图标
// 对象适配：getTechniqueThumbnailObjectFitClass(previewImageFit)
// 预览媒体取数无 URL 时提示 "Please provide a video or an image."
// TechniqueCard props（dashboard 模式）:
//   { listing, runCount, visibility, reviewStatus, publishedAt, hideCommunityVisibility,
//     listingId, isFavorited, onToggleFavorite, mode:"dashboard", layout:"dashboardGrid" }
// FeaturedCard: layout:"dashboardFeatured"；Featured 区块只渲染前 2 张 (ex.slice(0,2))
// TechniqueCardContextMenu props: { techniqueDefinitionId, slug, isOwner, isCreator, listingId,
//   currentVisibility, currentAppLinkAccess, currentWorkflowVisible, onDelete, onEdit }
```

### 2.10 分析事件（一手逐字）

| 事件 | 字段 | 触发 |
|---|---|---|
| `technique_library_search` | `{ query, result_count, surface:"library" }` | 库搜索 400ms 防抖上报 |
| `technique_detail_viewed` | `{ technique_id: techniqueDefinitionId, technique_name }` | 卡片 View details |
| `technique_page_viewed` | `{ technique_id, technique_name, source:"dashboard" }` | 卡片 Try |
| `technique_added` | `{ technique_id, technique_name, node_id, snapshot_id, search_query, surface }`（前轮确立） | 加画布 |

## 三、证据与来源

### 3.1 chunk 清单（本主题相关）

| chunk | 内容 | 本主题用到的证据 |
|---|---|---|
| `18_rcz_m_sgob.js` | 常量模块 | CATEGORY_DISPLAY_ORDER / TECHNIQUE_CATEGORIES / MIN_RUN_COUNT_TO_DISPLAY / MAX_TECHNIQUE_NODE_LABEL_LENGTH / TECHNIQUE_GRAPH_ISSUE_CODES |
| `1mrn9kx6teaj4.js` | TechniquesProvider 数据层（39KB） | getVisibleTechniques + delta 合并算法、runCount 注入、recentlyUsed、categories 交集、各派生列表、删除本地态、mapper u/h、TECHNIQUE_PREVIEW_SIZE |
| `3jqi80vqxl126.js` | Provider 另一副本（含早期 return 分支） | reviewStatus 兜底规则、provider context 形态 |
| `1mmwhx_zs_eu3.js` | 卡片/收藏/徽章 UI + hooks（37KB） | 分类 tabs、visibility/reviewStatus 徽章、TechniqueCard/FeaturedCard、useFavoriteTechniqueListingIds、useToggleTechniqueFavorite、groupTechniquesByCategory、sortByUpdatedAtDesc、默认缩略图 URL、TECHNIQUE_PREVIEW_SIZE 引用 |
| `2n-l3nic7n76j.js` | 市场页 + AccessDialog + 详情路由（47KB） | tabs/过滤、删除流、收藏聚合、搜索匹配、resolveTechniqueRouteSlug、AccessDialog mutations、复制链接 |
| `3u2jerdo-_t4a.js` | useTechniqueSearch hook | `POST /api/techniques/search` 全参数、AbortController、250ms 防抖、cache key、结果 `{results}` |
| `245x6abtmz2ih.js` | appRoutes 路由表 | `/techniques/:slug`、`/techniques/manage/:slug` |
| `3983pkyadzzah.js` | 画布侧添加/悬浮预览（前轮） | technique_added 事件、HoverPreviewCard、toHumaneSizedImageUrl |
| `2ru825uhloavh.js` | 大 schema 文件（前轮） | selectedTechnique {definitionId,snapshotId,slug,name,chargedCost}、techniqueRunId |

### 3.2 可复现命令

```bash
cd /tmp/flora-chunks

# 分类常量
python3 -c "d=open('18_rcz_m_sgob.js').read();i=d.find('CATEGORY_DISPLAY_ORDER');print(d[i-100:i+700])"

# Provider 合并算法
python3 -c "d=open('1mrn9kx6teaj4.js').read();i=d.find('getPersonalizedTechniqueDelta');print(d[i-600:i+3000])"

# 收藏 hooks
python3 -c "d=open('1mmwhx_zs_eu3.js').read();i=d.find('useFavoriteTechniqueListingIds');print(d[i-100:i+1900])"

# 市场页主体
python3 -c "d=open('2n-l3nic7n76j.js').read();print(d[12500:24500])"

# 搜索 hook / HTTP 端点
python3 -c "d=open('3u2jerdo-_t4a.js').read();i=d.find('/api/techniques/search');print(d[i-800:i+2200])"
```

### 3.3 缺口与未确认项

- **Convex 表名/schema 原文**：未找到（bundle 只有 `api.*` 路径与使用面形状）。listing/definition 分离为推断（由字段用法与 delta 结构支持）。
- **reviewStatus 完整枚举**：逐字只见 `"pending"`、`"published"`（与 publishedAt 兜底）；未见 `approved`/`rejected` 等其余值 → 未找到。
- **search API 返回 item 完整结构**：仅见 `{results:[…]}` 且对齐按 `listingId`；单条 item 的完整字段未逐字捕获。
- **submitForReview / withdrawSubmission 参数对位**：调用处变量经 React Compiler 重排，存在 "Submission withdrawn" toast 与声明名不一致的歧义（见 2.3 注）。
- **未细查**：technique 详情页（`/techniques/manage/:slug`）自身组件内部的数据请求（本轮以市场列表与数据层为主；详情页组件可能分布在 `1hayrh3hp9xtt.js`、`0c6ddwvie1pby.js` 等未完全展开的 chunk），以及 run 执行链（属其他子任务范围）。
- 大文件 `3zqb624po1kk-.js`（10.8MB）未整体读取，仅按关键词窗口检索（reviewStatus 无命中，说明该 chunk 与本主题数据层交集有限）。
