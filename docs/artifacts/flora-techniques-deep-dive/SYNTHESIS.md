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
1. **工具=technique**：rail 13 个工具分 3 组（Concept 4 / Refine 4 / Showcase 7），以 `names/slugBases` 前缀+纯数字后缀匹配 technique listing（`sketch-to-render`、`garment-recolor`、`fabric-swap`…），未匹配项全部落入 showcase——**Studio 无独立工具运行时**。
2. **双 Studio 状态**：fashion-studio 正式上线（移动导航硬编码 "New" 徽章 + splash campaign `fashion_studio_launch_2026_08`）；film-studio 由 `useFeatureFlagEnabled("film_studio")` 门控 Early access、tile 跳 `/productions`。
3. **三面板 store**：zustand persist `studio-storage` v2，`sidebarWidth` clamp .1–.6 默认 .4、`panelWorkspaceWidth` 831/1920；含乐观 run、masks 分段、上传指纹去重、tour 状态。
4. **扇出与阻断**：`STUDIO_GENERATE_BLOCKED_REASON = insufficient_credits|unpriceable_fanout|segmentation_pending|missing_input`；扇出落库 `workflowRuns{generationBatchId, idempotencyKey, generations[{collectionItemKey, orderIndex}]}`，itemKey 支持 `node:|upload:|text-split:` 与双臂复合 key `"{a}={x}+{b}={y}"`（A/B 交集）。
5. **folia 智能路由（一手 schema）**：`router:"folia-image"|"folia-video"`，method ∈ multimodal_embedding/multimodal_llm/deterministic/fallback，taskType 语义枚举（product_photography/material_fidelity/reference_edit/…），记录 `selectedTechnique:{definitionId, snapshotId, slug, name, chargedCost}` 与 `catalogSource:"versioned"|"live"`。

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

> 依据影策定位（影视/短剧创作者、本地/私有部署、自有 backend、已有 canvas-agent）。工作量级均为**估算**（人日），按一名熟悉影策代码库的工程师折算。

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

### 4.2 需改造

| # | 机制 | 改造点与理由 | 工作量（估算） |
|---|---|---|---|
| 1 | **Technique 反向提取 Builder** | 产品形态（画布选 IO→生成模板）价值高，但候选判定算法深度绑定 Flora 节点能力表（traversal barrier/router 折叠/反向可达）；需按影策节点集重写规则，四步 UI 需中文化 | 15–25 人日 |
| 2 | **模板变量批量表格**（{变量} 笛卡尔积展开 + contentEditable 变量 DOM） | 展开算法 `tS` 与行 schema 可整体移植；UI 需中文化、图片变量需接影策上传/资产体系；对「分镜批量出图」直接可用 | 8–12 人日 |
| 3 | **collection 扇出** | 双臂复合 key（A/B 交集）超出影策当前需求，建议裁剪为单集合扇出 + `collectionItemKey` 落库 + `unpriceable` 式预估阻断 | 5–10 人日 |
| 4 | **参数级计价引擎**（costMultiplier/costOffsetPerSecond/costPerInputImageDollars/freeInputImages） | 影策私有部署多不计费，但「生成前成本估算显示」对多 API 接入仍有价值；可剥离 reserve/spend 后端只留纯函数 | 3–5 人日 |
| 5 | **@flora-\* 注解→schema** | 「代码即 schema」思想适用于 canvas-agent 自定义工具节点；实现应换为 TS 类型/JSON schema 而非运行时正则解析注释 | 5–8 人日 |
| 6 | **Studio 三面板工作台** | 形态与影策 anti-reference（不做消费级瀑布流/堆叠卡片）冲突，需按分镜语义重设计；可保留「工具=工作流模板 slug 匹配注册表」思想与 feed/run 数据模型 | 10–15 人日 |

### 4.3 不适用

| # | 机制 | 理由 |
|---|---|---|
| 1 | legacy/v3 双轨计费、Stripe、auto-top-up、overage、发票与 admin credit 路由 | 影策本地/私有部署无订阅计费体系 |
| 2 | MCP 外链营销页、mcp_consent 漏斗、MCP 试用积分 | bundle 内无协议实现可借鉴；影策若未来做 MCP 需另行设计 |
| 3 | 品牌营销机制（splash ad campaign、flagship ad 去重、guest try funnel、UTM 链路） | 与影策产品定位无关 |
| 4 | 63 个 Flora 函数目录的具体内容 | 绑定 Flora 模型生态；仅 status 三态灰度注册表（released/staged/unlisted）思想可留 |
| 5 | Convex 后端栈 | 影策自有 backend；仅借鉴「读走实时订阅、写走 mutation、重操作走 REST」的 API 分层，不迁移实现 |

---

## 五、证据等级声明

- **一手逐字（高置信）**：10 份分报告中所有代码块、字段名、常量值、toast/UI 文案、端点路径、Convex mutation/queries 名、错误码、枚举值，均从 chunk 原文抄录并保留混淆名；各报告附 chunk 清单、`chunk:offset` 或可复现提取命令。关键结论存在跨报告独立互证（visibility 枚举 t01/t02、编辑跳转参数 t02/t03、fanout 语义 t04/t06、乐观 run store t03/t06、CORE_IO t02/t04/t05）。
- **推断（已逐条标注）**：四步 UI 语义映射、`adminEditMessage` 用途、换模型重置参数的动机、starter-row 机制意图、版本比较逻辑（snapshotId ≠ 当前 listing snapshot）、impersonas 供应商语义、legacy→v3 系数 1.2 的业务含义、`mcp_consent_*` 为 OAuth 同意漏斗、recordImagineUsage 返回结构（消费端反推）、run-technique 请求体形态（同族端点类比）。
- **本综述新增判断（主编交叉验证）**：见第六节矛盾裁定；三档迁移分级与工作量估算为编辑判断，非 Flora 侧证据。
- **未找到（诚实缺口）**：见第六节。

## 六、矛盾裁定与缺口清单

### 6.1 主题间/内部矛盾（3 处）

1. **reviewStatus 枚举范围**：T01（市场视角）仅见 `pending/published` 并称其余「未找到」；T02（治理流视角）逐字捕获第三值 `admin_edit_pending`。**裁定**：互补非矛盾，合并结论为至少 3 值；`approved/rejected` 仍无证据。
2. **T05 内部：watermark-video 状态**：目录表格标 "released(默认省略)"，但同文注释与 `eM` 函数签名（`r="staged"` 为默认第 4 参，该函数调用省略此参）指向 `staged`。**裁定**：以函数签名为准应为 staged；T05 §1.2 的 "19 released" 统计可能偏 1，建议复核该调用点——影响仅限灰度标记，不影响机制结论。
3. **legacy credits 换算双基数**：`legacyCreditsFromUserDollars` 用 $0.0009/credit，`calculatePricingV3UsageCostFromLegacyCredits` 用 1/1333≈$0.00075/credit。**裁定**：两函数并存为逐字事实，可能对应不同时代定价或买卖价差；业务含义无法从前端定论，列为缺口（不计为矛盾错误）。

### 6.2 缺口清单（未解决问题 → 所需手段）

| # | 缺口 | 影响 | 所需额外手段 |
|---|---|---|---|
| 1 | `/api/workflow/run-technique` 请求体/响应（T03/T06 双重确认未找到） | 技法执行的精确客户端契约 | 运行时抓包，或获取服务端/懒加载 chunk |
| 2 | Run App 桌面主页面 chunk 未捕获（发起 run 的入口 UI） | App Mode 完整交互流 | 重新抓取站点完整 chunk 集（含动态 import） |
| 3 | `/api/techniques/publish|update` 请求体（T02） | 发布契约的 payload 结构 | 运行时抓包；或官方文档 docs.flora.ai 交叉核对 |
| 4 | Convex 表 schema 原文（listing/definition 分离、studios/techniqueRuns 表结构均为推断） | 数据模型精确复刻 | 服务端 bundle 不可得；可用「官方文档 + 控制台观察」替代 |
| 5 | `approveAdminEdit/getLatestValidationRun` 等服务端函数（T02） | 审核流服务端闭环 | 同上 |
| 6 | "Build Technique" 入口按钮与四步面板渲染组件（T02） | Builder UI 复刻细节 | 动态 chunk 抓取 |
| 7 | 工具升级 "New version available/Update" UI（T06，检索 0 命中） | 版本化提示机制仅能推断 | studio 页面主渲染树 chunk + 运行时观察 |
| 8 | MCP 协议实现、工具清单、consent UI（T08） | MCP 能力边界不明 | 访问 try.flora.ai/lp/mcp 与 docs.flora.ai 联网核对（本次未做） |
| 9 | 模型单价目录、Imagine 费率（T10） | 具体价格数字 | 服务端数据；只能运行时抓 quote 响应 |
| 10 | 各 studio 工具的 inputs/outputs/controls 实例值（T06 只有 schema 形状） | 工具级复刻需逐工具定义 | 登录态调用 `getVisibleTechniques` 抓 definition（快照 JSON 已有 `flora-graph-raw.json` 可比对） |
| 11 | `deckNode/webcamNode/videoEditorNode/switchNode` 的 nodeDefinitions 级 schema（T04） | 4 个特殊节点的运行时行为 | 专用运行时 chunk |
| 12 | `/api/workflow/code-execution` 请求体、Python 沙箱实现（T05/T08） | Action 服务端执行细节 | 抓包 + 服务端不可得 |
| 13 | FAUNA 画布命令完整枚举与提示词正文（T09） | agent 工具面复刻 | 服务端（Braintrust）不可得；可从 `recordFaunaCanvasCommand` 调用点的懒加载 chunk 补充 |

### 6.3 主编总结

Flora 的核心竞争力不是单个功能，而是**一条贯穿的契约链**：CORE_IO 类型 → 节点能力表 → 技法快照 → 计费报价 → 来源归因，任何一层的新增物（节点/技法/工具/agent 动作）都自动获得版本化、可计价、可归因、可治理四种能力。对影策而言，优先吸收这条链的「骨架」（IO 契约、快照、部分成功语义、harness），再按影视语义填充自己的「血肉」；计费与增长层整体跳过。
