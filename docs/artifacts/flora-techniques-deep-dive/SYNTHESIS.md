# SYNTHESIS · Flora 前端逆向工程主编综述

> 语料：`/tmp/flora-chunks/*.js`（137 个 Next.js/Turbopack chunk），10 个子主题报告见 `findings/t01–t10`。
> 本文为交叉验证后的提炼，不复述原文。证据标注沿用各分报告约定：**逐字**（bundle 原文）、**推断：**（由证据推理）、**未找到**（全语料检索无命中）。
> 日期：2026-09-30。

---

## 一、全景图

Flora（app.flora.ai）是一个「类型化节点画布 + 可复现工作流（Technique）+ 行业工作台（Studios）+ AI Agent（FAUNA）」的生成式创作平台，后端为 Convex 实时 RPC 与 REST 混合，计费为 legacy/v3 双轨。

```
┌────────────────────────── 前端（Next.js + React + zustand，137 chunks）────────────────────────────┐
│                                                                                                    │
│  Surfaces: Dashboard(Techniques/Studios/Tools/Library) · Canvas · /chat(FAUNA) · App Mode(Run)     │
│            /batch-generate · /studios/:slug/open(三面板) · /settings/{usage,billing,plans}          │
│                                                                                                    │
│  ┌─ 画布内核 (t04) ─────────────────┐   ┌─ Agent 线 (t09) ───────────────────┐                      │
│  │ 31 种节点 nodesConfig 槽位声明    │   │ FAUNA：/chat + 画布 480px 侧边栏   │                      │
│  │ nodeDefinitions(schema+arity)×25 │   │ Assist/Auto 模式，默认 auto        │                      │
│  │ 三层连接校验(家族→图→schema)      │   │ harness 画布校验器(防过期漂移)      │                      │
│  │ determineBlockMode→ENDPOINTS 模池│   │ 画布命令/AddNode·faunaCreated 溯源 │                      │
│  │ CORE_IO 6 类型 = 全局 IO 货币    │   │ Braintrust 提示词/compaction       │                      │
│  └──────────────┬───────────────────┘   └────────────────────────────────────┘                      │
│                 │ 子图                                                                              │
│  ┌─ Techniques (t01/t02/t03) ────▼──────────────┐   ┌─ Action/CodeBlock (t05) ─────────────────┐   │
│  │ 市场：4 tab/10 分类/收藏/审核徽章             │   │ 63 内置函数(24 浏览器 JS + 39 服务端 PY) │   │
│  │ Builder：画布反向提取·四步(inputs/outputs/    │   │ @flora-* 注释注解 → schema → 槽位+参数UI │   │
│  │  workflow/publish)→ /api/techniques/publish   │   │ status 三态灰度 released/staged/unlisted │   │
│  │ Run App：乐观 run/历史 feed/preset 运行       │   │ 代码存 /api/code-storage，节点持 codeUrl │   │
│  │ techniqueBlock 节点 = 固定 snapshotId 的技法  │   └──────────────────────────────────────────┘   │
│  └───────────────────────────────────────────────┘                                                 │
│  ┌─ Studios (t06) ─────────────────────────────────┐   ┌─ Bulk Generate (t07) ──────────────────┐   │
│  │ Fashion Studio：13 工具=technique(rail slug 匹配)│   │ 独立表格页 200 行上限                   │   │
│  │ 三面板 rail/feed/details；collection 扇出        │   │ {变量} 模板 → 笛卡尔积展开成行          │   │
│  │ folia 智能路由(taskType 语义分类+记账)           │   │ 行 6 态纯函数；共享图4+行图4             │   │
│  └─────────────────────────────────────────────────┘   └────────────────────────────────────────┘   │
│  ┌─ Imagine 实时线 (t10) ────────────────────────────────────────────────────────────────────────┐  │
│  │ Pose(按帧) · Camera/Realtime(按活跃秒) · Director(按秒)；心跳 15s → recordImagineUsage        │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ 治理层 (t01/t02) ────────────────────────────────────────────────────────────────────────────┐  │
│  │ visibility: private/unlisted/workspace/public · reviewStatus: pending/published/admin_edit_…  │  │
│  │ submitForReview(月度 QC)/withdraw · 删除 10s Undo · entitlements · feature flags(PostHog)     │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ 计费层 (t10) ────────────────────────────────────────────────────────────────────────────────┐  │
│  │ legacy credits ↔ v3 usage credits($0.001)；报价(目录/网关 /api/model-service/quote)           │  │
│  │ → reserve → spend/release；确认阈值 $10(soft)/$100(hard)；套餐 free/starter/pro/max+topup     │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────────────┬──────────────────────────────────┘
        Convex 实时 RPC（读 useQuery / 写 useMutation）      REST /api/*（生成/执行/报价/发布/计费）
               ▼                                                  ▼
┌─ 后端 ────────────────────────────────────────────────────────────────────────────────────────────┐
│ Convex 表族: techniques/techniqueRuns/appMode/generationHistory/generationTables/studios/         │
│   collectionItems/workflowRuns/imagineUsageSessions/customers/faunaSessions/faunaMessages/…       │
│ REST: /api/workflow/{generate,run-technique,code-execution} · /api/techniques/{publish,update}    │
│       /api/model-service/quote · /api/billing/{reserve,spend,release}-credits · /api/code-storage │
│ 外部: Stripe · Braintrust(fauna 提示词) · Modal(florafauna-ai 推理) · MCP server(try.flora.ai 域) │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、10 主题结论汇编

### T01 · Techniques 市场与数据层
1. **listing/definition 分离 + delta 合并**：listing 承载市场元数据（分类/精选/排序/可见性/删除标记），definition 承载可运行快照；个性化覆盖经 `getPersonalizedTechniqueDelta` 以 `techniqueDefinitionId` 为键合并，`category/isFeatured/sortOrder/visibility/deleted` 五字段 base 优先（逐字算法）。
2. **市场信息架构**：四 tab（community/workspace/myTechniques/favorites）+ 10 固定分类 + featured 过滤，全部 URL 参数驱动（`?tab=&category=`）；featured 仅 community 生效。
3. **关键常量**：`MIN_RUN_COUNT_TO_DISPLAY=10`（runCount 达标才显示）、"New" 徽章窗口 7 天（`6048e5`ms）、搜索 `POST /api/techniques/search` 250ms 防抖 + AbortController、`TECHNIQUE_PREVIEW_SIZE {512,326}`。
4. **治理入口齐全**：visibility 4 档、收藏按 `listingId`、删除走 `deleteTechnique` + 本地 deleted 标记 + 10s Undo toast。
5. **交叉验证**：与 T02 独立确认 visibility 徽章映射、`TECHNIQUE_VISIBILITY_VALUES`、编辑跳转 query 参数（snapshot/technique/edit=1）。

### T02 · Technique Builder 与发布治理
1. **画布即 Builder**：四步状态机 `inputs|outputs|workflow|publish`；输入候选 = 无入边+有出边+有产物+支持类型；输出候选 = 从已选输入反向可达（穿 router 折叠，unsupported/ignored 节点为 traversal barrier）。
2. **节点能力表（权威定义，module 746264）**：每节点类型标注 `prompt-capable/supported/input-only/fanout/control/unsupported/ignored` 七类语义，派生 `SUPPORTED_TECHNIQUE_NODE_TYPES` 等；`UNSUPPORTED_TECHNIQUE_RESULT_IO_TYPES={documentUrl}`（document 可输入不可输出——与 T04 的 `input-only` 独立互证）。
3. **IO 卡契约**：name≤40、description≤200；controls 7 种（text/color/select/slider/image/mask/element）；prompt 输入在发布时被合成为虚拟 textBlock 节点（`__prompt_input_` 前缀）。
4. **审核生命周期**：`submitForReview → pending → published`，第三态 `admin_edit_pending` 时 owner 的 Edit 菜单禁用；`TECHNIQUE_GRAPH_ISSUE_CODES` 12 项服务端校验码（missing_output/duplicate_id/graph_cycle/…）。
5. **发布端点**：`/api/techniques/publish`（create）与 `/api/techniques/update`（edit）——请求体**未找到**（见缺口）。

### T03 · Run App 与 run-technique 执行链
1. **乐观运行状态机**：`pending→running(progress 0-100)→completed|failed`；zustand store 以 `clientRunId` 为主键、携带 `instanceNodeId`，同 instance 的旧 FAILED 记录被新 run 顶掉，进度仅 RUNNING 态可写；查询侧对乐观 id `"skip"` 短路。
2. **服务端生命周期由错误码链反推**：reserve_credits → mark_running → start_generations → fetch_generation → complete/spend_credits；失败分支 release_credits——**两阶段计费结算的一手证据**（与 T10 呼应）。
3. **run→canvas 单向升级**：唯一可证 mutation `createTechniqueCanvasProject({techniqueName})` → 新项目 URL `?snapshot=&technique=&edit=1`（服务端只建空项目，画布凭参数自拉快照进入编辑态）；另有 `duplicateRun/seedAssets/seedShares` 并行入口。
4. **Preset 机制**：`DEFAULT_PRESET_ID="default"`、`MAX_PRESET_CHOICES_PER_INPUT=100`、`MAX_PRESET_SETS=4`；`findMatchingTechniquePreset` 逐值比对可回显 preset 身份。
5. **历史 feed**：分页 15/页、`RECENT_TECHNIQUES_LIMIT=20`、按天分组（startedAt 优先回退 completedAt）；输出反馈 localStorage 上限 500 条；`"Estimated ${a} · Charged ${r}"`（报价 vs 实扣）。

### T04 · 节点系统全集
1. **31 种节点 + 双层声明**：`nodesConfig`（槽位/互斥组/hiddenInputKeys/onlySystemAdd）与 `nodeDefinitions`（25 个，`schemaVersion:1`，inputs 带 `{key,role,type,arity:{min,max}}`）；`UNBOUNDED_ARITY=Number.MAX_SAFE_INTEGER`；emptyImageBlock 支持最多 14 张图入。
2. **CORE_IO 6 类型（imageUrl/videoUrl/audioUrl/text/documentUrl/model3dUrl）+ realtime/boolean** 是全库 IO 货币；`InputRole` 10 种（prompt/image/…/aspectRatio）按 `ROLE_BY_IO_TYPE` 从 IO 类型推导。
3. **三层连接校验**：①家族硬约束（router→batch 禁、batch 链目标白名单等）→ ②图结构（DFS 防环、element 每 video 限 1、switch 单输入、boolean 只接 boolean）→ ③schema `validateProposedEdge`（issue：incompatible_type/input_count_exceeded/…）。
4. **输入组合→任务模式**：`determineBlockMode` 把 (节点类型, 输入统计) 映射到 27+ 种 mode（如 `firstFrameLastFrame`=恰好 2 图无音频），mode 再经 `ENDPOINTS` Proxy 惰性取模型池，换 mode 时保留兼容模型。
5. **隐藏门控**：每个生成块有隐藏 `enabled` boolean 输入（默认 true），switch 的 boolean 输出可作其它节点的启停 gate——画布级条件执行原语。

### T05 · Flora Functions（Action 体系）
1. **63 个内置函数**：24 个浏览器 JS（`-browser` 后缀，客户端 `execute({inputs,params})→{type,dataUrl,name}`）+ 39 个服务端 Python（`get_input/get_param`、`raise FloraUserError`、写 `/tmp/output/`）；status 三态灰度，`FLORA_FUNCTIONS` 仅含 released。
2. **注释即 schema**：`@flora-name/description/inputs/outputs/params` 多行 JSON 注解被 `parseCodeBlockSchema` 解析为节点 IO 槽位与参数面板（param 8 类：number/boolean/color/select/text/point2d/point3d/interval，支持 `visibleIf` 联动）。
3. **成本预留结构**：全部 `creditCost` 硬编码 0，但 `estimatedSeconds` 表（stitch-videos 60s、color-grade-video 45s…）与花朵徽标渲染链已就位；`getCodeExecutionCost = codeUrl 非空 ? 0 : 函数 creditCost`。
4. **代码存储**：用户代码存服务端，节点只持 `codeUrl`；复制节点 = `/api/code-storage/load` → `save` 克隆 → 更新引用。
5. ****推断：** browser 函数是 Python 版的替代/灰度（代码注释逐字 "Drop-in for the python … prebuilt"），`baseFunctionId` 去后缀回退查图标/短描述。

### T06 · Studios 与 Fashion Studio
1. **工具=technique**：rail 13 个工具分 3 组（Concept 4 / Refine 4 / Showcase 7），以 `names/slugBases` 前缀+纯数字后缀匹配 technique listing（`sketch-to-render`、`garment-recolor`、`fabric-swap`…），未匹配项全部落入 showcase——**Studio 无独立工具运行时**。**补抓确认（`t06-supplement-studio-tool-mapping.md`）**：匹配算法逐字为 `name`/`shortName` 小写精确匹配 **或** `routeSlug` 精确/前缀匹配；rail 内容由 `resolveStudioRailGroupedSections(技法列表)` 驱动，即 **Studio 工具是技法（Technique）的展示外壳**，新增工具 = 发布一个技法（零前端改动）。
2. **双 Studio 状态**：fashion-studio 正式上线（移动导航硬编码 "New" 徽章 + splash campaign `fashion_studio_launch_2026_08`）；film-studio 由 `useFeatureFlagEnabled("film_studio")` 门控 Early access、tile 跳 `/productions`。
3. **三面板 store**：zustand persist `studio-storage` v2，`sidebarWidth` clamp .1–.6 默认 .4、`panelWorkspaceWidth` 831/1920；含乐观 run、masks 分段、上传指纹去重、tour 状态。
4. **扇出与阻断**：`STUDIO_GENERATE_BLOCKED_REASON = insufficient_credits|unpriceable_fanout|segmentation_pending|missing_input`；扇出落库 `workflowRuns{generationBatchId, idempotencyKey, generations[{collectionItemKey, orderIndex}]}`，itemKey 支持 `node:|upload:|text-split:` 与双臂复合 key `"{a}={x}+{b}={y}"`（A/B 交集）。
5. **folia 智能路由（一手 schema）**：`router:"folia-image"|"folia-video"`，method ∈ multimodal_embedding/multimodal_llm/deterministic/fallback，taskType 语义枚举（product_photography/material_fidelity/reference_edit/…），记录 `selectedTechnique:{definitionId, snapshotId, slug, name, chargedCost}` 与 `catalogSource:"versioned"|"live"`。
6. **工具→模型映射（补抓新增，`t06-supplement-studio-tool-model-map.md`）**：`listing.modelRefs = [{mode, model}]` —— **不是一对一，而是多模型链**；核心范式 = **LLM 做提示词工程 → 图像模型做生成**。24 个工具全量已获（含 `chargedCost`/`category`/`inputItems`/`outputItems`）。图像主力 **Nano Banana Pro/2**（26+ 次），LLM 侧 **Claude Opus 4.6 / Sonnet 5** 与 **GPT-5.2 / 5.5** 平分，视频侧 Kling 系（2.5 Turbo Pro / O1 / 3.0 Pro）+ Seedance 2.0，矢量专用 **Arrow 1.1 Max**、**Flux Kontext Max**。**9 种 IO 模式**（textToText / imagesToText / imageToText / textToImage / imageToImage / imagesToImage / imageToVideo / firstFrameLastFrame），**8 个类别**（essentials / productVisualization / fashionApparelEditorial / marketingAds / videoAnimation / contentPackaging / spaceArchitecture / printFilmVfx）。`model: undefined` 条目 = 走 folia 智能路由器，模型运行时才定。
7. **技法快照过期机制（补抓新增，`t06-supplement-version-stale.md`）**：`getIsTechniqueBlockPinnedToOlderSnapshot({blockSnapshotId, latestSnapshotId})` 纯函数判定（三条件：两者均存在且不等）；文案 `TECHNIQUE_SNAPSHOT_STALE_MESSAGE`（toast）/ `_TOOLTIP`（hover）；过期时 `toast.error` 并 **阻止进入编辑**；配 `markTechniqueBlockPendingEdit`/`consumeTechniqueBlockPendingEdit`（一次性状态传递）。另有**两套独立版本系统**：节点类型版本（`currentVersion` vs `nodesConfig[type].latestVersion`）与技法块快照版本。

### T07 · Bulk Generate
1. **表格形态**：独立页 `/batch-generate`，200 行硬上限（贯穿按钮禁用/页脚计数/剩余可加行公式），后端为 Convex `generationTables.*` 函数族（**不是** HTTP 端点；`batch_table_generate` 仅为 feature flag 名）。
2. **模板变量展开**：正则 `/\{([^{}\r\n]+)\}/g` 抽取变量，DFS 笛卡尔积展开成行；图片变量在 prompt 中序列化为 `@[assetId]` 并同时挂 `inputAssetIds` + `promptImageReferences`；无变量时按 Copies 复制；预览限 50 行。
3. **行状态纯函数**：6 态（empty/ready/invalid/generating/complete/failed）+ `stale`（行更新晚于生成创建→提示可重生成）；prompt ≤8000 字符；行级问题三类（input-unavailable/model-unavailable/inputs-unsupported）。
4. **部分成功语义**：run 请求 `{tableId, rowIds, requestId:crypto.randomUUID(), runAction, requestedUsageCreditsEstimate, …}` → 响应 `{startedCount, skippedCount}` + 「N row(s) skipped because their settings or inputs became unavailable.」；regenerate 前快照行配置防竞态。
5. **输入图预算**：整批共享 ≤4（`referenceAssetIds`）+ 行级 ≤4，合并算法 `t2` 逐行裁剪并回报 skipped；换模型把行参数重置为仅 prompt（**推断**动机：防旧参数不匹配新模型 schema）。

### T08 · MCP 集成
1. **MCP 是外链不是页面**：侧栏 "MCP" 项 `external:true` 指向 `https://try.flora.ai/lp/mcp`；app 前端 bundle 无任何 MCP 协议实现（`mcpServers/jsonrpc/tools/call` 等逐字 0 命中，否定性验证）。
2. **三条来源链路**：`GenerationSource` 含 `MCP/WEBMCP/PUBLIC_API_MCP`；MCP 产物落统一 Library，带黄色 "MCP" 徽章与专属筛选 tab（`SAVED_NODE_ORIGIN_LABEL={MCP:"mcp",API:"api",CANVAS:"canvas"}`）。
3. **服务端设施线索**：env `MCP_CODE_RUNNER_SECRET` + `MCP_SANDBOX_SNAPSHOT_NODE`（MCP 侧代码执行沙箱，命名风格同 Blender 沙箱快照）、`CREATE_AGENT_FLORA_MCP_URL`（**推断**：Flora 自家 agent 也消费自家 MCP server）。
4. **增长钩子**：`mcp_consent_viewed/granted/denied/signed_out/unavailable` 五连事件（**推断**为 OAuth 式同意漏斗）+ `users.mcpUsedAt/mcpTrialCreditClaimedAt` 试用积分；Starter 套餐含 "API & MCP access"。
5. **bundle 中未找到**「technique 导出为 MCP tool」的任何代码路径——技法是否经 MCP 暴露不可证实。

### T09 · FAUNA（画布 AI Agent）
1. **双形态**：独立 `/chat`（dashboard 导航第一项 "Create"）+ 画布右侧浮动侧边栏（480px、z-1050、dock 时推挤画布 488px）；Free 档文案 "FAUNA (unlimited, free)"。
2. **模式与阶段**：`FaunaChatMode={assist,auto}` 默认 auto；`AgentStage={reasoning,responding,tool,awaiting_approval}`；流式 segments 三型 `{thinking,text,tool_call}`。
3. **harness 画布校验器（业界少见）**：会话内记录 `inspectedNodes{nodeVersion, inspectionType:full|partial, contentHash}`、`turnsSinceLastInspection`、`consecutiveToolErrors`，驱动 `fauna_harness_staleness_detected/nudge_triggered/validation_blocked`——防止 agent 基于过期画布状态操作。
4. **接管归因**：节点带 `data.faunaCreated=true` 溯源；用户在回合中/结束后 10 分钟窗口（`6e5`ms）内手动改动 FAUNA 创建物 → `fauna_manual_canvas_takeover`，细分为 intervention_during_stream/takeover_after_interruption/correction_after_finish。
5. **长会话治理**：3 表（faunaSessions/faunaMessages/faunaSkills）+ compaction（`FAUNA_COMPACTION_MODEL` 默认 "gpt-5.4-nano"、prior tokens 上限 `12e4`）+ 限制常量（附件 5×20MB、上下文节点 15、消息 25000 字符）。

### T10 · 计费与 credits 体系
1. **双轨单位**：legacy credits（1cr=$0.0009 由 `legacyCreditsFromUserDollars` 反推；另一函数用 1/1333≈$0.00075——**两套基数并存，见矛盾③**）↔ v3 usage credits（`CENTS_TO_CREDITS=10`，1cr=$0.001）；UI 话术已转向 "usage/prepaid usage"。
2. **前端硬编码价目表**：free 0 / starter $18 / pro $50 / max $200 月付；季 -10%、年 -20%；pro_v3_student 与 max_v3_professor 经 `getCanonicalBillingPlan` 归并；Free 计划内含 `INCLUDED_USAGE_CENTS=250`（$2.5/月）。
3. **参数级计价引擎**：`calculatePricingV3ReservationCost = (baseCost + scaledOffsets) × multiplier + nonScaledOffsets`；参数可带 `costMultiplier/costOffset/costOffsetDollars/costOffsetPerSecond(×duration)/costPerInputImageDollars/freeInputImages`；costBreakdown 可渲染为 `"Base $x; param=y x1.5 +$0.02 scaled; discount 20% -$0.03; final $0.12"`。
4. **两阶段结算 + 报价**：REST `/api/billing/{reserve,spend,release}-credits`；生成前网关报价 `POST /api/model-service/quote`（300ms 防抖、4 并发、2s 缓存，204=无报价回退目录价并整体标 estimate）；高价确认阈值 `<1e4` credits 直接跑 / `≥1e4` soft / `≥1e5` hard（$10/$100）。
5. **三种计费粒度并存**：按次（画布/技法/批量）、按帧（Pose）、按活跃秒（Realtime/Director）；心跳 `IMAGINE_HEARTBEAT_INTERVAL_MS=15e3`，`document.visibilitychange` 隐藏即停计，`outOfCredits:true` 实时停流。

---

## 三、跨主题洞察

### 3.1 贯穿性机制（多主题独立互证）

| 机制 | 贯穿范围 | 一句话概括 |
|---|---|---|
| **CORE_IO 契约化** | t02/t03/t04/t05/t06/t07 | 6 种 IO 类型在 module 106966 单点定义，节点槽位、technique IO、preset、codeBlock 映射、studio 输入 schema、批量表格全部引用同一枚举——改一处全库生效 |
| **快照版本化（snapshotId）** | t01/t02/t03/t06 | listing（市场元数据）与 definition（可运行快照）分离；techniqueBlock 节点、拖拽 item、编辑 URL、folia 路由记录全链携带 snapshotId；`getSnapshotIdForLegacyTechniqueId` 兜底旧 id——**运行可复现性的原子** |
| **计费抽象（reserve→spend/release）** | t03/t05/t06/t07/t10 | 所有生成 surface 共用报价（目录/网关）→ 预留 → 实扣/释放管线 + 统一确认阈值；`unpriceable_fanout` 说明「不可报价即阻断」是一等原则 |
| **来源归因双层枚举** | t03/t08/t09 | `GenerationSource`（13 值，生成笔级）与 `ProjectOrigin`（9 值，项目级）两套体系并存，产物带 `originLabel` 进 Library 筛选——增长与成本分析的地基 |
| **乐观 UI + clientRunId** | t01/t03/t06/t07 | 乐观记录以客户端 id 为主键、查询侧对乐观 id 短路、失败记录被同 instance 新 run 顶掉——同一模式在 Run/Studio/Batch 三处复用 |
| **埋点密度与集中注册** | 全主题 | EVENTS 注册表集中在单 chunk，每 surface 有完整事件族（technique_*/studio_*/fauna_*/batch_table_*/mcp_*），连「接管归因」「跳过原因」都有专属字段 |
| **治理三件套** | t01/t02/t06/t07 | visibility 4 档 × reviewStatus 3 值 × entitlements/feature flag（PostHog 实验），市场、工作台、批量全受同一治理面约束 |

### 3.2 Flora 独有、业界少见的机制

1. **画布反向提取为技法**：不是「保存整张工作流图」（ComfyUI 式），而是点选输入/输出节点、把参数化子图提取为带 IO 契约的模板——画布即 Builder，模板与画布共享同一套节点运行时。
2. **snapshotId 粒度版本化 + delta 合并**：市场列表个性化覆盖经客户端合并算法完成，`catalogSource:"versioned"|"live"` 双轨。
3. **run→canvas 单向升级**：App Mode（简单表单运行）与 Canvas（全功能编辑）共享同一 technique，升级只需 `?snapshot=&technique=&edit=1` 三个 query 参数，服务端零拷贝。
4. **@flora-* 注释注解 → schema → UI**：代码即 schema，注释驱动节点槽位与参数面板渲染，与模型端点的参数面板走同一管线。
5. **collection 扇出复合 key**：`"{armId}={itemKey}+{armId2}={itemKey2}"` 双臂交集语义（A/B 测试式组合扇出）+ `unpriceable_fanout` 报价阻断。
6. **folia 语义路由**：按 taskType（product_photography/anatomy/reference_edit…）分类路由到 endpoint，并把 `selectedTechnique + chargedCost` 写进路由记录——路由与计价同表。
7. **FAUNA canvas harness**：contentHash + 节点版本 + staleness 检测 + manual takeover 归因窗口——为「agent 操作画布」设计的防漂移与责任划分机制。
8. **心跳计费三粒度**：按次/按帧/按活跃秒并存，15s 心跳、页面隐藏即停、`outOfCredits` 实时断流——实时生成的计费完整性方案。

---

## 四、对 open-ai-canvas（影策）的迁移建议

> 依据影策定位（`MASTER-PLAN.md` §2.5：**电商创作者 + 小型影视团队**双人群，电商改图/商拍/品牌锁为**自建主攻线**（B 线），影视 agent 玩法跟随上游，本地/私有部署、自有 backend、已有 canvas-agent）。工作量级均为**估算**（人日），按一名熟悉影策代码库的工程师折算。
>
> ⚠️ **本文早期版本将影策定位误记为单一「影视/短剧」**，导致对电商类迁移价值的低估；已修正。Flora 的电商/商品类技法与影策 B 线 **F-01..F-12** 高度对口（详见 `findings/coverage-audit-112-techniques.md` §五）。

### 4.1 可直接借鉴

| # | 机制 | 理由 | 工作量（估算） |
|---|---|---|---|
| 1 | **CORE_IO 统一 IO 类型契约**（6 类型单点定义全库引用） | 影策节点图跨图像/视频/音频/文本，正缺一个跨节点/工作流/批量一致的最小 IO 枚举；与 DESIGN.md「语法改编」兼容 | 2–3 人日 |
| 2 | **批量部分成功语义**：行级状态纯函数 + `{startedCount, skippedCount}` + 跳过原因文案 | 直接命中 PRODUCT.md「批量动作必须可预览、可取消、可部分成功，并说明被跳过的原因」 | 2–3 人日 |
| 3 | **乐观 run store 模式**（clientRunId 主键、进度仅 running 可写、FAILED 被同 instance 顶掉、乐观 id 查询短路） | 影策生成失败恢复与重试是核心场景，该模式已被 Flora 三处复用验证 | 2–3 人日 |
| 4 | **快照版本化**（definition snapshotId，节点/运行/编辑全链携带） | 分镜工作流复用与「可复现生成」的原子；影策已有工作流概念，加 snapshot 字段与解析即可 | 5–8 人日 |
| 5 | **高价运行双阈值确认**（soft/hard + 队列串行控制器） | 影策若接付费模型 API，批量误触成本风险同构；免费部署可只留骨架 | 1–2 人日 |
| 6 | **来源归因枚举**（生成笔级 source + 项目级 origin + Library 徽章筛选） | 影策多入口（画布/agent/批量）需要成本与行为分析地基 | 1 人日 |
| 7 | **删除 10s Undo**（服务端软删 + toast action + 本地标记） | 与影策「不可恢复的批量操作掩盖状态」红线互补，成本低体验收益高 | 0.5–1 人日 |
| 8 | **agent 画布 harness 思想**（操作前记录节点版本/contentHash，过期检测→nudge/blocked，接管归因） | 影策已有 canvas-agent，这是 Flora 对「agent 改画布」最成熟的一手工程方案 | 5–8 人日 |
| 9 | **技法块快照过期机制**（`getIsTechniqueBlockPinnedToOlderSnapshot` 纯函数 + toast/hover 双文案 + 阻止编辑） | 影策一旦有「预设/工作流被引用后作者又改动」的场景，这套是**最小完备**的版本漂移处理：纯函数判定 + 双面提示 + 硬阻止编辑 + 一次性 pending 标记 | 1–2 人日 |
| 10 | **`modelRefs` 聚合字段**（把"技法用了哪些模型"从 graph 聚合到 listing 层） | 影策 Auto-2 若需「预设/技法能力画像」，**可在注册表层维护聚合字段**，不必每次遍历图；列表/卡片可直接展示所用模型 | 1–2 人日 |

### 4.2 需改造

| # | 机制 | 改造点与理由 | 工作量（估算） |
|---|---|---|---|
| 1 | **Technique 反向提取 Builder** | 产品形态（画布选 IO→生成模板）价值高，但候选判定算法深度绑定 Flora 节点能力表（traversal barrier/router 折叠/反向可达）；需按影策节点集重写规则，四步 UI 需中文化 | 15–25 人日 |
| 2 | **模板变量批量表格**（{变量} 笛卡尔积展开 + contentEditable 变量 DOM） | 展开算法 `tS` 与行 schema 可整体移植；UI 需中文化、图片变量需接影策上传/资产体系；对「分镜批量出图」直接可用 | 8–12 人日 |
| 3 | **collection 扇出** | 双臂复合 key（A/B 交集）超出影策当前需求，建议裁剪为单集合扇出 + `collectionItemKey` 落库 + `unpriceable` 式预估阻断 | 5–10 人日 |
| 4 | **参数级计价引擎**（costMultiplier/costOffsetPerSecond/costPerInputImageDollars/freeInputImages） | 影策私有部署多不计费，但「生成前成本估算显示」对多 API 接入仍有价值；可剥离 reserve/spend 后端只留纯函数 | 3–5 人日 |
| 5 | **@flora-\* 注解→schema** | 「代码即 schema」思想适用于 canvas-agent 自定义工具节点；实现应换为 TS 类型/JSON schema 而非运行时正则解析注释 | 5–8 人日 |
| 6 | **Studio 三面板工作台** | 形态与影策 anti-reference（不做消费级瀑布流/堆叠卡片）冲突，需按分镜语义重设计；可保留「工具=工作流模板 slug 匹配注册表」思想与 feed/run 数据模型 | 10–15 人日 |
| 7 | **Studio 工具 = 技法外壳架构**（rail 注册表 `{names, slugBases}` + `resolveStudioRailGroupedSections` 自动匹配） | 思想价值高（新增工具零前端改动），但匹配算法深度绑定 Flora 的 slug 命名约定；影策若采用需先定义自己的 slug 规范与分组语义 | 3–5 人日 |

### 4.3 不适用

| # | 机制 | 理由 |
|---|---|---|
| 1 | legacy/v3 双轨计费、Stripe、auto-top-up、overage、发票与 admin credit 路由 | 影策本地/私有部署无订阅计费体系 |
| 2 | MCP 外链营销页、mcp_consent 漏斗、MCP 试用积分 | bundle 内无协议实现可借鉴；影策若未来做 MCP 需另行设计 |
| 3 | 品牌营销机制（splash ad campaign、flagship ad 去重、guest try funnel、UTM 链路） | 与影策产品定位无关 |
| 4 | 63 个 Flora 函数目录的具体内容 | 绑定 Flora 模型生态；仅 status 三态灰度注册表（released/staged/unlisted）思想可留 |
| 5 | Convex 后端栈 | 影策自有 backend；仅借鉴「读走实时订阅、写走 mutation、重操作走 REST」的 API 分层，不迁移实现 |

### 4.4 ★ Flora 电商技法 → 影策 B 线 F-01..F-12 映射（补抓新增）

> **背景修正**：本文早期版本把影策定位记成单一「影视/短剧」，低估了 Flora 电商技法的价值。`MASTER-PLAN.md` §2.5 定位声明逐字：影策 = 为**电商创作者与小型影视团队**服务，**电商改图/商拍/品牌锁是自建主攻线**；§2.3 并指出「上游 90d 全量 feat 标题中**未出现电商/设计类词汇**」——即电商是**刻意选择、上游不做的差异化地盘**。

`analysis-2026-09-12/ecom-design/candidates-ecom.md` Top12 ↔ Flora 技法对照：

| 影策功能 | 优先级 | Flora 对应技法 | 可抽取资产 |
|---|---|---|---|
| **F-01 智能抠图/白底图** | 25 | `Anything to Vector`（含 `Remove background` 节点） | 节点链 |
| **F-02 商品场景图/背景替换** | 25 | **`Product in Scene Generator`**（5 输出）/ `Relighting`（4 输出） | ★ 提示词正文 |
| **F-03 一致性参考锁** | 20 | `Scene Continuity Lock` / `Editorial Fashion Shoot Replicator` | 提示词策略 |
| **F-04 模特换装/虚拟试衣** | 20 | **`Virtual Try-On`** / `Model Poses`（10 输出）/ `Ghost Mannequin System`（14 输出） | ★★ 节点拓扑 |
| **F-05 模板变量批量** | 20 | Bulk Generate（t07 已拆） | 非技法 |
| **F-06 扩图/画幅重构** | 20 | 无对口技法 | — |
| **F-07 修复型工具群** | 20 | `Relighting Photoshoot` / `Product recolor` | 提示词正文 |
| **F-08 视觉标注局部修改** | 20 | `Image Recolor` / `Product recolor`（6 输出） | 提示词正文 |
| **F-09 爆款图复刻** | 16 | **`Editorial Fashion Shoot Replicator`**（名字即"复刻"） | ★★ 全链 |
| **F-10 品牌套件锁定** | 16 | `Editorial Fashion Shoot Replicator`（风格注入链） | 风格注入模式 |
| **F-11 OCR 改字** | 16 | 无（Flora 无文字层） | — |
| **F-12 批量基础处理** | 16 | `3 Angle Shoot` / `Multi-Angle Shoot` / `Product Package on White` | 输出布局 |

**12 项中至少 8 项有对口参照。**

**已实测的抽取方法**（`ghost-mannequin-system` 已验证）：遍历 `/techniques/{slug}` 详情页 → 从 React `props.techniqueDefinition` 取 `graph`，其中 `graph.nodeInputsMap` 含**每节点的模型绑定 + 提示词全文 + 参数**，`graph.presets` 含默认输入值与节点文本。

**建议优先级**（取代「全量 112」与「仅 Studio 24」两种极端）：**优先抽 ~40 个电商对口技法**——`fashionApparelEditorial`(16) + `productVisualization`(12) + `marketingAds`(8) + `essentials` 商品子集(~8)；跳过 `funInspiration`(16) / `brandVisualDesign`(15) / `spaceArchitecture`(6) / `printFilmVfx`(5)。

---

## 五、证据等级声明

- **一手逐字（高置信）**：10 份分报告中所有代码块、字段名、常量值、toast/UI 文案、端点路径、Convex mutation/queries 名、错误码、枚举值，均从 chunk 原文抄录并保留混淆名；各报告附 chunk 清单、`chunk:offset` 或可复现提取命令。关键结论存在跨报告独立互证（visibility 枚举 t01/t02、编辑跳转参数 t02/t03、fanout 语义 t04/t06、乐观 run store t03/t06、CORE_IO t02/t04/t05）。
- **推断（已逐条标注）**：四步 UI 语义映射、`adminEditMessage` 用途、换模型重置参数的动机、starter-row 机制意图、版本比较逻辑（snapshotId ≠ 当前 listing snapshot）、impersonas 供应商语义、legacy→v3 系数 1.2 的业务含义、`mcp_consent_*` 为 OAuth 同意漏斗、recordImagineUsage 返回结构（消费端反推）、run-technique 请求体形态（同族端点类比）。
- **本综述新增判断（主编交叉验证）**：见第六节矛盾裁定；三档迁移分级与工作量估算为编辑判断，非 Flora 侧证据。
- **未找到（诚实缺口）**：见第六节。
- **2026-09-30 补抓轮次新增（一手逐字）**：以下五项均来自动态 chunk 枚举与 React context 提取，证据等级同「一手逐字」——
  - 两段式执行链（`t03-supplement-run-technique-contract.md`）：Convex `api.appMode.mutations.createRun` 建 run 记录 → REST `POST /api/workflow/run-technique` 触发执行，body 包在 `params` 里；`inputAssets` 元素结构 `{inputId, value, type, metadata?, previewImageUrl?, role?}`
  - publish/update 契约（`t02-supplement-publish-contract.md`）：`definitionDraft`/`listingDraft` 分离 + 发布后自动 validation run + `reviewStatus` 修正为至少 4 值（含 `admin_edit_rejected`）
  - 技法快照过期机制（`t06-supplement-version-stale.md`）：`getIsTechniqueBlockPinnedToOlderSnapshot` 纯函数 + 两条文案常量 + 编辑受阻 `toast.error` 路径 + `markTechniqueBlockPendingEdit`/`consumeTechniqueBlockPendingEdit` 一次性状态传递
  - Studio rail 注册表（`t06-supplement-studio-tool-mapping.md`）：13 工具 / 3 组（Concept·Refine·Showcase）+ 匹配算法（`name`/`shortName` 小写精确 或 `routeSlug` 前缀）+ **Studio 工具 = 技法外壳**（rail 由 `resolveStudioRailGroupedSections(技法列表)` 驱动）
  - Studio 工具 → 模型映射（`t06-supplement-studio-tool-model-map.md`）：`listing.modelRefs` 给出每个技法全部模型与 IO 模式；**9 种 IO 模式**、**8 个类别**

## 六、矛盾裁定与缺口清单

### 6.1 主题间/内部矛盾（3 处）

1. **reviewStatus 枚举范围**：T01（市场视角）仅见 `pending/published`；T02 捕获 `admin_edit_pending`。**后续补抓修正（2026-09-30，见 t02-supplement-publish-contract.md §G）**：实际为 **至少 4 值** —— `pending` / `admin_edit_pending` / `admin_edit_rejected` / 其余走 `isAdminBlockedOutOfWindow` 分支。另发现 `isOwner`、`currentUserCanFloristEdit`（FLORA 内部员工）两个权限字段与 `api.admin.techniques.mutations.submitAdminEditForReview`。
2. **T05 内部：watermark-video 状态**：目录表格标 "released(默认省略)"，但同文注释与 `eM` 函数签名（`r="staged"` 为默认第 4 参，该函数调用省略此参）指向 `staged`。**裁定**：以函数签名为准应为 staged；T05 §1.2 的 "19 released" 统计可能偏 1，建议复核该调用点——影响仅限灰度标记，不影响机制结论。
3. **legacy credits 换算双基数**：`legacyCreditsFromUserDollars` 用 $0.0009/credit，`calculatePricingV3UsageCostFromLegacyCredits` 用 1/1333≈$0.00075/credit。**裁定**：两函数并存为逐字事实，可能对应不同时代定价或买卖价差；业务含义无法从前端定论，列为缺口（不计为矛盾错误）。

### 6.2 缺口清单（未解决问题 → 所需手段）

> **2026-09-30 补抓轮次**：三轮补充档已入库（`findings/t02-supplement-publish-contract.md`、`t03-supplement-run-technique-contract.md`、`t06-supplement-version-stale.md`、`t06-supplement-studio-tool-mapping.md`、`t06-supplement-studio-tool-model-map.md`），关闭 5 项缺口。方法要点：**动态 chunk 枚举**（登录态页面 `script[src]` 得 165 个 vs 静态语料 137 个，多出 28 个）+ **React context 提取**（绕过断连的 Convex WebSocket，直接读 `memoizedProps.value.techniques`）。

| # | 缺口 | 状态 | 影响 | 所需额外手段 |
|---|---|---|---|---|
| 1 | `/api/workflow/run-technique` 请求体/响应 | ✅ **已解决**（`t03-supplement-run-technique-contract.md`） | — | 已获：`POST` body `{params:{runId, inputAssets, inputOverrides?, parameterOverrides?, studioTourStepId?}}`；**发现两段式执行**（Convex `createRun` 建记录 → REST 触发执行）；响应体仍待 live 抓包 |
| 2 | Run App 桌面主页面 chunk | ✅ **已解决**（同上） | — | 已获：chunk `0dji9it51s1b7.js`（App Mode 主入口，`z` 函数执行链 + 乐观更新 `w`） |
| 3 | `/api/techniques/publish` · `update` 请求体 | ✅ **已解决**（`t02-supplement-publish-contract.md`） | — | 已获：chunk `37xc5r2vs5-j_.js` 完整客户端 + `definitionDraft`/`listingDraft` 分离实证 + 发布后自动 validation run |
| 4 | Convex 表 schema 原文（listing/definition 分离、studios/techniqueRuns 表结构均为推断） | ❌ 未解 | 数据模型精确复刻 | 服务端 bundle 不可得；可用「官方文档 + 控制台观察」替代 |
| 5 | `approveAdminEdit/getLatestValidationRun` 等服务端函数（T02） | ❌ 未解 | 审核流服务端闭环 | 同上 |
| 6 | "Build Technique" 入口按钮与四步面板渲染组件（T02） | ⚠️ 部分（T02 已获四步 `store.currentStep` 值） | Builder UI 复刻细节 | 动态 chunk 抓取 |
| 7 | 工具升级 "New version available/Update" UI | ✅ **已解决**（`t06-supplement-version-stale.md`） | — | **机制名不是"工具版本化"而是"技法快照过期"**：`getIsTechniqueBlockPinnedToOlderSnapshot({blockSnapshotId, latestSnapshotId})` 纯函数判定；文案 `TECHNIQUE_SNAPSHOT_STALE_MESSAGE` / `_TOOLTIP`；过期时 `toast.error` 并阻止进入编辑。**检索词教训**：官方文档措辞（New version available）与代码标识符（snapshot stale）是两套词汇，从文档措辞反推标识符必然 0 命中 |
| 8 | MCP 协议实现、工具清单、consent UI（T08） | ❌ 未解（用户明示 `mcp先不管`） | MCP 能力边界不明 | 访问 try.flora.ai/lp/mcp 与 docs.flora.ai 联网核对（本次未做） |
| 9 | 模型单价目录、Imagine 费率（T10） | ❌ 未解 | 具体价格数字 | 服务端数据；只能运行时抓 quote 响应 |
| 10 | 各 studio 工具的 inputs/outputs/controls 实例值 | ✅ **大部分已解决**（`t06-supplement-studio-tool-model-map.md`） | — | 已获 24 个工具的 `listing.inputItems`/`outputItems`/`modelRefs`/`chargedCost`/`category`（React context 提取）；**`getDefinition` 返回 null**（graph 本体未在客户端缓存），逐节点参数 schema 仍缺 |
| 10b | Studio 工具 → 模型映射 | ✅ **已解决**（同上） | — | 已获：**不是一对一而是多模型链**，`listing.modelRefs = [{mode, model}]` 聚合服务端数据；核心范式 = **LLM 做提示词工程 → 图像模型做生成**；主力 Nano Banana Pro/2（26+ 次）、LLM 侧 Claude Opus 4.6/Sonnet 5 与 GPT-5.2/5.5 平分；`model: undefined` 条目 = 走 folia 智能路由器（与 Auto-2/Auto-3 设计同构） |
| 11 | `deckNode/webcamNode/videoEditorNode/switchNode` 的 nodeDefinitions 级 schema（T04） | ❌ 未解 | 4 个特殊节点的运行时行为 | 专用运行时 chunk |
| 12 | `/api/workflow/code-execution` 请求体、Python 沙箱实现（T05/T08） | ❌ 未解 | Action 服务端执行细节 | 抓包 + 服务端不可得 |
| 13 | FAUNA 画布命令完整枚举与提示词正文（T09） | ❌ 未解 | agent 工具面复刻 | 服务端（Braintrust）不可得；可从 `recordFaunaCanvasCommand` 调用点的懒加载 chunk 补充 |
| 14 | `createRequestHeaders()` header 集（模块 598215） | ❌ 未解 | run-technique 请求完整复刻 | 静态 chunk 已定位模块号，未读实现 |
| 15 | `buildTechniqueInputAssets` 完整实现 | ❌ 未解 | inputAssets 构造规则 | 同上 |
| 16 | `run-technique` 响应体 | ❌ 未解 | 执行结果契约 | 需 live 抓包（本页 Convex WS 已断，HTTP 直调受 Clerk auth provider 限制） |
| 17 | `getDefinition` 的 graph 本体 | ❌ 未解 | 逐节点参数 schema | 客户端未缓存（`ctx.getDefinition` 返回 null）；需 Convex 认证上下文或服务端 |
| 18 | folia 路由器的内部选型策略 | ❌ 未解（服务端） | 智能路由决策逻辑 | 服务端不可得；`modelRefs` 中 `model: undefined` 条目是其存在的旁证 |

### 6.3 主编总结

Flora 的核心竞争力不是单个功能，而是**一条贯穿的契约链**：CORE_IO 类型 → 节点能力表 → 技法快照 → 计费报价 → 来源归因，任何一层的新增物（节点/技法/工具/agent 动作）都自动获得版本化、可计价、可归因、可治理四种能力。对影策而言，优先吸收这条链的「骨架」（IO 契约、快照、部分成功语义、harness），再按**电商 + 影视双线**语义填充自己的「血肉」（电商线可直取 Flora 的电商技法提示词与节点拓扑作参照）；计费与增长层整体跳过。
