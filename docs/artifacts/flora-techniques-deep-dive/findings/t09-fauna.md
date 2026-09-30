# FAUNA —— FLORA 的画布 AI 智能体（兼品牌遗产痕迹）

> 调查范围：/tmp/flora-chunks/*.js（137 个 turbopack chunk）。
> 结论标注：**一手逐字** = bundle 中逐字读到的字符串/代码；**推断** = 由证据推导。
> 主题一句话：FAUNA 是 FLORA 内置的对话式 AI 智能体（Agent），以「画布右侧浮动聊天侧边栏 + 独立 /chat 路由」双形态存在，可读画布、下画布命令、生成媒体；同时 "fauna" 也是公司旧品牌（FloraFauna）遗留的目录/域名/资源前缀。

---

## 一、产品级摘要

### 1.1 FAUNA 是什么（一手逐字，来自 dashboard 导航项）

```js
{ href: H.appRoutes.chat, icon: f.Paintbrush, label: "Create",
  description: "Chat with FAUNA to create images, videos, and more" }
```
（来源：`3yc-y57ou8gwi.js` @74699）

- FAUNA = FLORA 的原生 AI 助手/智能体，入口是侧边栏导航第 1 项的 **"Create"**，路由 `/chat`。它**对话式地创建图片、视频等内容**，并能直接操作画布（节点/连线）。
- 定价页 Free 档文案（逐字）：`"FAUNA (unlimited, free)"` —— 个人版无限免费（`00d0pt9gjg7yi.js`）。企业版有 **ACCESS_FAUNA_MOBILE** 权益；fauna 有独立 entitlement 错误 `ACCESS_FAUNA_ENTITLEMENT_REQUIRED`（`2zk-27-g42vq3.js`：title `"Fauna unavailable"`, description `"Fauna isn't enabled for this workspace."`）。
- 公司层面的品牌遗产（非产品功能）：支持邮箱 `support@florafauna.ai`、管理员邮箱判定 `endsWith("@florafauna.ai")`、Clerk 卫星域 `app.florafauna.ai / florafauna.ai / florafauna.site`、Modal 计算组织 `florafauna-ai`（`https://florafauna-ai--*-endpoint.modal.run`）、社交账号 `florafaunaai`、静态资源目录 `/fauna/visual-examples/*.png`（工具卡片缩略图，**不代表功能模块**）。`30acolqt4cov4.js` 中 `ONBOARDING_SOURCE.FAUNA="fauna"` 表明旧 onboarding 体系曾直接用 "fauna" 命名。

### 1.2 双形态交互

| 形态 | 证据 | 说明 |
|---|---|---|
| 独立页面 `/chat`、`/chat/:id` | `245x6abtmz2ih.js` appRoutes: `chat:"/chat"`, `chatProject:e=>`/chat/${e}`` | 全屏对话式创作（dashboard 导航 "Create"） |
| 画布侧边栏 | `2n18recfvghp1.js`、`3u2jerdo-_t4a.js`、`3ldpt1pk51grl.js` | 画布上的浮动面板：宽 480px，右侧停靠，dock 时把画布可视区推挤 488px；按钮为右下角 56px 圆形浮钮 |

### 1.3 交互流程（ASCII）

```
用户 (画布右下浮钮 / Create 页)
        │ 点击 → fauna_sidebar_opened
        ▼
FAUNA 侧边栏 (480px, z-1050)
        │ 输入消息（可 @提及节点 / 附参考节点、附件）
        │ 选择模式: Assist(确认后生成) | Auto(自动生成)  ← 默认 Auto
        ▼
服务端 Agent (Braintrust "fauna-system" + "fauna-instruction-compiler")
        │ 流式返回 segments: thinking → text → tool_call
        │ 工具调用 → 画布命令 (AddNode/ChangeNodeParams/...)
        ▼
画布变更，新建节点带 data.faunaCreated=true
        │
        ├─ 用户手动改动 FAUNA 创建的节点 → fauna_manual_canvas_takeover 遥测
        └─ 回合结束 → fauna_turn_duration / fauna_task_end
```

### 1.4 产品机制要点

- **模式开关**：`FaunaChatMode = {ASSIST:"assist", AUTO:"auto"}`，默认 `auto`；Assist=“Confirm before generating”，Auto=“Generate automatically”（`03a0fob5rewok.js` @12013，逐字）。
- **Agent 阶段**：`AgentStage = {REASONING:"reasoning", RESPONDING:"responding", TOOL:"tool", AWAITING_APPROVAL:"awaiting_approval"}`（同 chunk，逐字）。
- **回合（Turn）**：每个回合有 `turnId (crypto.randomUUID)`、sessionId、mode、model；流式状态跟踪并统计 `faunaCommandCount / successfulFaunaCommandCount / lastFaunaCommandNodeIds`（`3ldpt1pk51grl.js`）。
- **画布接管检测**：FAUNA 回合进行中或结束后 10 分钟内（`6e5` 秒 = 600000ms），若用户手动改动 FAUNA 创建过的节点/连线，触发 `fauna_manual_canvas_takeover`，细分 `intervention_during_stream / takeover_after_interruption / correction_after_finish`（`3ldpt1pk51grl.js` @104827-108013，逐字）。
- **创建物溯源**：节点数据 `data.faunaCreated=true`；导出 PNG/视频时作为 metadata（`faunaCreated:p`）随下载与 `download_file` 遥测上报（`10oy_yh3gq4_q.js`）。
- **Harness（画布状态校验器）**：会话内记录 `inspectedNodes`（含 inspectionType:`full|partial`、nodeVersion、contentHash）、`turnsSinceLastInspection`、`consecutiveToolErrors`、`lastStaleWarningVersion`，防止 agent 基于过期画布操作（`2ru825uhloavh.js`；遥测事件 `fauna_harness_staleness_detected / nudge_triggered / validation_blocked`）。
- **上下文压缩**：长会话自动/手动 compact；`FAUNA_COMPACTION_MODEL` 默认 `"gpt-5.4-nano"`，prior 会话 token 上限 `12e4`（`2bbvvfva7pfdq.js`）。
- **限制**：`MAX_ATTACHMENTS=5`、`MAX_ATTACHMENT_SIZE_BYTES=0x1400000`（20MB）、`MAX_CONTEXT_NODES=15`、`MAX_DOCUMENT_TEXT_CHARS=120000`、`MAX_MESSAGE_LENGTH=25000`（`03a0fob5rewok.js`）。
- **错误语义**（用户可见文案，`2zk-27-g42vq3.js`）：`FAUNA_MAX_TURNS_EXCEEDED`→“Reasoning limit reached”；`FAUNA_TURN_IN_PROGRESS`→“A previous turn is still finishing”；`FAUNA_CHAT_HOOK_TIMEOUT`→“The generation hook was not resumed in time” 等（详见附录）。
- **生成归属**：生成事件来源枚举 `GenerationSource.FAUNA="fauna"`（`2zk-27-g42vq3.js` @50517）。

### 1.5 是否有独立路由与 UI

- 有独立路由：`/chat`、`/chat/:id`（appRoutes，`245x6abtmz2ih.js`）。移动端有独立 gate：`isFaunaCreateEnabled` prop（`2vbd3ltw6fooi.js`）、`ACCESS_FAUNA_MOBILE` 权益。
- UI 侧边栏有专用测试锚点：`[data-testid='fauna-sidebar']`、`[data-fauna-chat-input]`（`3ldpt1pk51grl.js`、`2bbvvfva7pfdq.js`）。
- 独立 store：`faunaSidebarStore`（zustand），字段见附录二。

---

## 二、机制级附录

### 2.1 服务端配置（环境变量 + Braintrust 提示词体系）— 一手逐字

来源 `2bbvvfva7pfdq.js` @13228（Zod schema 默认值）：
```js
BRAINTRUST_FAUNA_SYSTEM_SLUG: z.string().min(1).default("fauna-system"),
BRAINTRUST_FAUNA_INSTRUCTION_COMPILER_SLUG: z.string().min(1).default("fauna-instruction-compiler"),
BRAINTRUST_VIDEO_AUTO_CLASSIFIER_SLUG: z.string().min(1).default("video-auto-classifier"),
BRAINTRUST_FAUNA_PROMPT_ENV: z.string().optional(),
FAUNA_COMPACTION_MODEL: z.string().min(1).default("gpt-5.4-nano"),
FAUNA_MAX_PRIOR_CONVERSATION_TOKENS: z.coerce.number().int().default(12e4),
FAUNA_DURABLE_KICK_SECRET: z.string().min(32).optional(),
```
来源 `37kvhloo39esn.js` @2857（服务端 env 白名单，逐字）：
```js
OPENAI_FAUNA_API_KEY: o.default.env.OPENAI_FAUNA_API_KEY,
ANTHROPIC_FAUNA_API_KEY: o.default.env.ANTHROPIC_FAUNA_API_KEY,
```
推断：FAUNA 走独立 API key 的 OpenAI/Anthropic 供应商；"instruction-compiler" 推断为把用户指令+画布上下文编译成模型输入的组件；"durable kick" 推断为服务端持久化任务唤醒机制（secret 用于鉴权）。

### 2.2 Convex 数据模型（客户端 schema，逐字）

来源 `2ru825uhloavh.js` @76936 起：

**faunaSessions 会话**：
```
userId: v.id("users"), projectId: v.id("projects"), title: string, lastUsedAt: number,
messageCount: number, surface?: string, activeWorkflowRunId?: string, lastWorkflowRunId?: string,
lockAcquiredAt?: number,
activeTelemetryIds?: { braintrustSpanId?, raindropEventId?, conversationRootExport? },
activeTelemetryContext?: { input, model, userEmail?, userName?, userFirstName?, userLastName?, compactionSummary? },
todos?: { id, content, status: "pending"|"in_progress"|"completed"|"cancelled" }[],
activeSkillIds?: v.id("faunaSkills")[],
deleted: boolean, deletedAt?: number,
harnessState?: { inspectedNodes: Record<string,{inspectedAt,nodeVersion,inspectionType:"full"|"partial",nodeType,nodeLabel,contentHash?}>,
  turnsSinceLastInspection: number, consecutiveToolErrors: number, lastStaleWarningVersion?: number }
```

**faunaMessages 消息**（role = system|user|assistant）：
```
sessionId: v.id("faunaSessions"), role, content: string, tokenEstimate?, totalTokenEstimate?,
embedding?: number[], deleted, deletedAt?, isError?, errorCode?, queueId?,
thinkingContent?, thinkingDuration?, segments?: Part[],
raindropEventId?, braintrustSpanId?, workflowRunId?,
contextNodes?: { nodeId, label, type, data:{imageUrl?,videoUrl?,audioUrl?,documentUrl?,text?} }[],
attachments?: { assetId?, filename, mediaUrl, mediaType:"image"|"video"|"audio"|"document", mimeType,
  fileSize?, width?, height?, transcript?, transcriptModel?, keyframeUrls?: string[], documentId?, documentText? }[],
webSearchResults?: { toolCallId, query, source?:"web"|"unsplash",
  results:{id,title,url,content,score,favicon?}[], images:{id,url,thumbnailUrl?,description?,photographer?,photographerUrl?}[] }[],
modelMessages?: any[], canvasHash?: string,
isCompactionBoundary?: boolean, compactionMetadata?: { trigger:"auto"|"manual", preCompactTokenEstimate:number },
activeSkillIds?: v.id("faunaSkills")[]
```
**Part（segments 元素）**：
```
{type:"thinking", content, durationMs?, provider?} | {type:"text", content} |
{type:"tool_call", toolCallId, toolName, publicName, status:"running"|"completed"|"error", durationMs?}
```
**Compaction 记录**：
```
sessionId, trigger:"auto"|"manual", summary, preCompactTokenEstimate,
postCompactTokenEstimate, messagesCompacted, modelUsed, durationMs
```
**Queued 用户消息**（输入队列）：
```
sessionId, queueId?, content, createdAtMs, deleted,
activateSkillIds?: v.id("faunaSkills")[], contextNodes?, attachments?,
referenceContext?: { nodeRefs:[{nodeId, shortId?, source:"selected"|"mention", priority, selectionIndex?, mentionIndex?, label, type, data{...}}],
  attachmentRefs:[{attachmentId, filename, mediaUrl, mediaType:"image", mimeType, width?, height?, assetId?}],
  primaryNodeIds: string[], primaryShortIds?: string[], mustUseReferences: boolean, workflowRequiredNodeIds?: string[] },
referencedTechniques?: { techniqueDefinitionId, snapshotId?, name }[], canvasHash?
```
**faunaSkills 技能表**（推断为该表 schema，结构紧随其后）：
```
ownerUserId: v.id("users"), workspaceId: v.id("workspaces"), name, displayName, description,
body, bodyHash?, deleted, deletedAt?, createdAt, updatedAt
```

### 2.3 画布命令与回合跟踪（`3ldpt1pk51grl.js`，全部逐字）

- 遥测包装：`function eg(e,t){isAnalyticsCaptureEnabled()&&captureAnalyticsEvent(e,{feature:"fauna",...t})}` 导出为 `trackFaunaEvent`。
- 回合对象：
```js
startFaunaTurn: em = { turnId, sessionId, projectId, mode, model, sidebarOpen,
  turnStartedAt, isStreaming:true, faunaCommandCount:0, successfulFaunaCommandCount:0,
  lastFaunaCommandNodeIds:[], takeoverTracked:false }
finishFaunaTurn({now, outcome}) → isStreaming=false, turnEndedAt, turnOutcome
createFaunaTurnId: () => crypto.randomUUID()
```
- 命令记录：`recordFaunaCanvasCommand(type, at, success=true, nodeIds=[])` → 覆写 `lastFaunaCommandType / lastFaunaCommandAt / lastFaunaCommandNodeIds` 并计数；`runAsFaunaCanvasMutation(fn)` 用计数器 `ey` 抑制“手动接管”误报。
- `maybeTrackManualCanvasTakeover`：要求 `change` 显著性为 `normal|major`；成功命令数>0；且（流式中 或 回合结束 600000ms 内 或 最后命令 600000ms 内）。
- 接管原因判定（逐字）：
```js
e.isStreaming ? "intervention_during_stream"
: "error"===turnOutcome || "stopped"===turnOutcome ? "takeover_after_interruption"
: "success"===turnOutcome && ["ChangeNodeInput","ChangeNodeOutput","ChangeNodeParams",
   "ChangeNodeResult","EditNode","RemoveNode","RemoveEdge","RemoveNodeAndEdge"].includes(change)
  ? "correction_after_finish" : null
```
- 影响面计算：受影响节点/连线数、`affected_edge_touching_fauna_created_node_count`（边任一端 `data.faunaCreated`）、`affected_fauna_created_node_count`、`affected_node_types`。
- 节点“有意义变化”判定包含 `data?.faunaCreated` 比较（`didNodeMeaningfullyChange`）。
- 侧边栏测量：`measureCanvasFaunaRightChromeInset`（用 `[data-testid='fauna-sidebar']` 与 `.react-flow` 计算画布右缘被遮挡宽度，`panTo` 时用于自动留白）。

### 2.4 UI 常量与 store（逐字）

来源 `2n18recfvghp1.js` @1066：
```js
FAUNA_BUTTON_BOTTOM: 8,  FAUNA_BUTTON_MARGIN: 16, FAUNA_BUTTON_RIGHT: 8, FAUNA_BUTTON_SIZE: 56,
FAUNA_DOCK_TRANSITION: CHROME_TRANSITION, FAUNA_DOCK_TRANSITION_DURATION_SECONDS: CHROME_TRANSITION_DURATION_SECONDS,
FAUNA_DOCK_TRANSITION_MOTION_EASE: CHROME_TRANSITION_MOTION_EASE,
FAUNA_SIDEBAR_BOTTOM_OFFSET: 72, FAUNA_SIDEBAR_DOCK_INSET: 8, FAUNA_SIDEBAR_IDLE_HEIGHT: 512,
FAUNA_SIDEBAR_OVERLAY_Z_CLASS: "z-[1060]", FAUNA_SIDEBAR_TOP_OFFSET: 72, FAUNA_SIDEBAR_WIDTH: 480,
FAUNA_SIDEBAR_Z_INDEX: 1050,
getFaunaDockOffset: ({isDocked,isOpen}) => isDocked&&isOpen ? 488 : 0
```

来源 `3u2jerdo-_t4a.js` @14659（store 初始状态，逐字）：
```js
faunaSidebarStore = createStore(e => ({
  isOpen:false, isDocked:false, idleAnimation: pickRandom(IDLE_ANIMATIONS) (fallback "pulse"),
  thinkingAnimation:"noise", pendingEditorMessage:null, isStreaming:false, hasActiveChat:false,
  pendingEditorPrefill:null, splashComplete:false, chromeIntroOnly:false, pendingScrollToBottom:false,
  pendingActionChat:null,
  setPendingActionChat, setIsOpen, setIsDocked, toggleDock,
  rollThinkingAnimation: ()=>set({thinkingAnimation:"noise"}), setIsStreaming,
  setPendingEditorPrefill, setPendingEditorMessage }))
```
（`[fauna-sidebar-store] pickRandom called with empty array` 为 console.error 兜底文案。）

### 2.5 聊天/上传常量（逐字）

来源 `03a0fob5rewok.js` @12013 / @22296：
```js
FaunaChatMode = { ASSIST:"assist", AUTO:"auto" };  DEFAULT_CHAT_MODE = "auto";
CHAT_MODE_CONFIG = { assist:{label:"Assist",description:"Confirm before generating"},
                     auto:{label:"Auto",description:"Generate automatically"} };
AgentStage = { REASONING:"reasoning", RESPONDING:"responding", TOOL:"tool", AWAITING_APPROVAL:"awaiting_approval" };
MAX_ATTACHMENTS=5; MAX_ATTACHMENT_SIZE_BYTES=0x1400000; MAX_CONTEXT_NODES=15;
MAX_DOCUMENT_TEXT_CHARS=12e4; MAX_MESSAGE_LENGTH=25e3; MAX_NODE_MANIFEST_LABEL_LENGTH=200; MAX_NODE_MANIFEST_SIZE=20;
```
`FAUNA_CHAT_ACCEPT_SERIALIZED`（`37ka3q_2q-i0_.js` @4023）为拼接的 accept 字符串：图片扩展名+MIME、视频、音频、`.pdf,application/pdf`、3D 模型（`M=[...n,...c,...s,...b(f),...d].join(",")`）。

### 2.6 错误码（`2zk-27-g42vq3.js`，逐字）

```
FAUNA:     FAUNA_INTERNAL_ERROR / FAUNA_MAX_TURNS_EXCEEDED / FAUNA_USER_CANCELLED /
           FAUNA_LLM_PROVIDER_UNAVAILABLE / FAUNA_TURN_IN_PROGRESS
FAUNA_CHAT: FAUNA_CHAT_HOOK_TIMEOUT / FAUNA_CHAT_HOOK_FAILED / FAUNA_CHAT_GENERATION_FAILED
用户可见文案（摘录）:
FAUNA_INTERNAL_ERROR: "Fauna chat error" / "The assistant encountered an unexpected error."
FAUNA_MAX_TURNS_EXCEEDED: "Reasoning limit reached" / "This question requires more reasoning steps than allowed..."
FAUNA_TURN_IN_PROGRESS: "A previous turn is still finishing. Please retry shortly."
FAUNA_CHAT_HOOK_TIMEOUT: "Generation Timeout" / "The generation hook was not resumed in time. Please try again."
```

### 2.7 遥测事件清单（`245x6abtmz2ih.js` @19382 起，逐字）

```
fauna_first_message_sent, fauna_message_sent, fauna_chat_message_sent, fauna_task_end, fauna_tool_invoked,
fauna_sidebar_opened, fauna_sidebar_closed, fauna_feedback_submitted, fauna_session_created,
fauna_session_switched, fauna_session_resumed, fauna_canvas_command, fauna_manual_canvas_takeover,
fauna_node_navigated, fauna_time_to_first_token, fauna_turn_duration, fauna_new_conversation,
fauna_history_expanded, fauna_history_collapsed, fauna_reuse_clicked, fauna_contextual_opened,
fauna_continue_clicked, fauna_mode_switched, fauna_harness_validation_blocked, fauna_harness_staleness_detected,
fauna_harness_nudge_triggered, fauna_harness_inspection_recorded, fauna_harness_modification_recorded,
fauna_harness_turn_counters_updated, fauna_tool_execution_start, fauna_tool_execution_success,
fauna_tool_execution_error, fauna_node_created, fauna_node_edited, fauna_compaction_completed,
fauna_compaction_skipped, fauna_compaction_failed, fauna_audio_transcription, fauna_video_keyframe_extraction,
fauna_layer_editor_action_started/completed/failed
```
turn 遥测字段样例（`fauna_turn_duration` 上下文）：`fauna_turn_id, session_id, project_id, mode, model, sidebar_open, ...`（`3ldpt1pk51grl.js`）。

### 2.8 导出溯源（`10oy_yh3gq4_q.js`，逐字）

```js
downloadLayerEditorPng({nodeId, imageUrl, projectName, blockName, generationId, metadataAssetId, faunaCreated})
... captureAnalyticsEvent(EVENTS.download_file, { file_format, file_type:"image", eu_watermark, node_id, fauna_created: p ?? false, auto_model? })
```
视频导出同构（`file_type:"video"`）。

### 2.9 品牌/资源遗产（逐字）

- Clerk allowed origins：`https://app.flora.ai, https://flora.ai, https://app.florafauna.ai, https://florafauna.ai, https://florafauna.site, https://www.florafauna.ai, https://www.flora.ai, https://*-floraai.vercel.app`；satellite domain `"florafauna.ai"`（`1qoler3c4z5br.js`）。
- `/fauna/visual-examples/`：`cinematic-panel-design.png / cinematic-model-series.png / fashion-photography-composition.png / interior-transformation-scene.png / node-graph-design.png` —— `TOOL_REGISTRY` 卡片缩略图与 studio 卡片兜底图（`1qoler3c4z5br.js` @553263、`0wqo-xbxn0uus.js` @5189）。**仅为静态资源，与 FAUNA 功能无直接关系**。
- Modal 端点组织名 `florafauna-ai`（8 个端点，如 `florafauna-ai--text2img-flux-endpoint.modal.run`，`3zqb624po1kk-.js`）——推断为旧品牌下的推理基础设施命名，属通用生成管线而非 FAUNA agent 专用。
- Feature flag：`fauna_admin_hide_draft_models` / `florafauna_admin_hide_draft_models`（`1mhres2mokwdl.js`）。

### 2.10 未找到 / 缺口（不编造）

- **未找到**：任何 `/api/fauna*` HTTP 端点路径、FaunaCommandType 的完整字符串枚举表、`fauna-system` 提示词正文。推断：agent 主循环与提示词均在服务端（Braintrust + 独立部署），客户端仅消费流；`recordFaunaCanvasCommand` 的调用点不在本 137 chunk 语料内（懒加载 chunk 缺失）。
- **未找到**：`6e5` 窗口的官方名称（bundle 中仅为字面量 `p-u.turnEndedAt<=6e5`）。推断：10 分钟“接管归属窗口”。
- **未找到**：FAUNA 侧边栏自身组件（React）源码位置；只见 store/常量/测量函数与其 testid。

---

## 三、证据与来源（chunk 清单 + 可复现命令）

| chunk | 大小 | FAUNA 相关内容 |
|---|---|---|
| `3ldpt1pk51grl.js` | 116,829B | turn 生命周期、takeover 检测、`faunaCreated`、trackFaunaEvent、侧边栏测量 |
| `2ru825uhloavh.js` | 98,318B | Convex schema：faunaSessions/faunaMessages/faunaSkills/compaction/harness |
| `2zk-27-g42vq3.js` | 51,605B | FAUNA 错误码与用户文案、GenerationSource.FAUNA |
| `03a0fob5rewok.js` | 25,338B | FaunaChatMode/AgentStage/限制常量、上传 helpers |
| `2bbvvfva7pfdq.js` | 29,749B | env schema（fauna-system slug、compaction model 等）、`data-fauna-chat-input` |
| `37kvhloo39esn.js` | 361,809B | 服务端 env 白名单（OPENAI/ANTHROPIC_FAUNA_API_KEY） |
| `2n18recfvghp1.js` | 30,491B | FAUNA_(BUTTON|SIDEBAR|DOCK)_* 布局常量、getFaunaDockOffset |
| `3u2jerdo-_t4a.js` | 67,464B | faunaSidebarStore 定义 |
| `02sbsm9v-_rmv.js` | 252,459B | useCanvasPanelPlacement 消费 fauna dock offset |
| `245x6abtmz2ih.js` | 54,374B | 全量 fauna_* 遥测事件表、appRoutes(chat) |
| `10oy_yh3gq4_q.js` | 53,403B | fauna_created 随导出 metadata |
| `3yc-y57ou8gwi.js` | 126,421B | "Chat with FAUNA..." 导航文案、社交链接 florafaunaai |
| `1qoler3c4z5br.js` | 98,454B | Clerk florafauna.ai 域、/fauna/visual-examples 资源 |
| `00d0pt9gjg7yi.js` | 137,945B | Free/Starter 权益 "FAUNA (unlimited, free)"、ACCESS_FAUNA_MOBILE |
| `2kralpe5w898d.js` | 37,832B | Entitlements.ACCESS_FAUNA / ACCESS_FAUNA_MOBILE |
| `30acolqt4cov4.js` | 33,204B | ONBOARDING_SOURCE.FAUNA |
| `37ka3q_2q-i0_.js` | 42,618B | FAUNA_CHAT_ACCEPT_SERIALIZED |
| `2vbd3ltw6fooi.js` | 95,012B | MobileDashboardShell isFaunaCreateEnabled |
| `3983pkyadzzah.js` | 164,793B | faunaSidebarStore.setIsOpen 调用（添加视频节点时关闭） |
| `3zqb624po1kk-.js` | 10,799,757B | florafauna-ai Modal 端点（品牌遗产） |

可复现命令（在 /tmp/flora-chunks 下）：
```bash
grep -l -i 'fauna' /tmp/flora-chunks/*.js
grep -o -i 'fauna[a-zA-Z0-9_/.-]*' /tmp/flora-chunks/*.js | sed 's/^[^:]*://' | sort | uniq -c | sort -rn
# 定向窗口提取示例（不整读大文件）：
python3 - <<'EOF'
import re
s=open('/tmp/flora-chunks/2ru825uhloavh.js',encoding='utf-8',errors='replace').read()
i=s.find('faunaSessions'); print(s[i-200:i+900])
EOF
```
