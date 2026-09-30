# T08 · MCP 集成页（FLORA / app.flora.ai 前端 bundle 逆向）

> 主题：侧栏 "MCP" 入口、MCP 服务端配置、暴露的工具、鉴权、与 Techniques/画布的关系、try.flora.ai/lp/mcp。
> 语料：/tmp/flora-chunks/*.js（137 个 Next.js turbopack chunk）。检索方式：`grep -o -i 'mcp'` 定位 13 个 chunk，python+re 定向窗口提取，未整读任何大文件。

## 一、产品级摘要

### 结论先行

| 问题 | 结论 | 证据等级 |
|---|---|---|
| MCP 页面是什么 | **不是 app.flora.ai 内的页面**。侧栏 "MCP" 导航项是 `external: true` 的外链，指向 `https://try.flora.ai/lp/mcp` | 一手逐字 |
| MCP server 配置结构 | 前端 bundle **未找到** `mcpServers` / `mcpUrl` / `mcp.json` / `registerMcpServer` / `tools/call` / `jsonrpc` 等任何 MCP 协议实现痕迹 | 一手（否定性） |
| 暴露给 MCP 的工具 | 前端不可见。仅有服务端环境变量 `MCP_CODE_RUNNER_SECRET`、`MCP_SANDBOX_SNAPSHOT_NODE`、`CREATE_AGENT_FLORA_MCP_URL` 证明服务端存在 MCP + 沙箱代码执行设施 | 一手逐字（env 名）+ 推断（功能） |
| 鉴权方式 | 前端 bundle 未发现 MCP OAuth 流。发现 5 个埋点事件 `mcp_consent_viewed/granted/denied/signed_out/unavailable`，形态类似 OAuth 授权同意页埋点（推断）；用户表含 `mcpUsedAt`、`mcpTrialCreditClaimedAt` | 事件名一手逐字，机制推断 |
| 与 Techniques / 画布的关系 | 生成的每一笔都带 `GenerationSource` 来源标签，MCP 是其中之一（`MCP` / `WEBMCP` / `PUBLIC_API_MCP`）；MCP 产物落入统一 Library，可按 "MCP" 来源筛选 | 一手逐字 |
| Techniques 能否作为 MCP tool 暴露 | bundle 中未找到 "把技法导出为 MCP tool" 的任何代码路径 | 未找到 |

### 1. 入口与信息架构

侧栏导航（dashboard sidebar）中 MCP 与 Techniques、Community、Brand OS、Slack、Projects、Library、Tools 并列：

```
Dashboard Sidebar
├── Techniques   → /techniques（站内）
├── Community    → /community（站内）
├── Brand OS     → /brand-os（站内，badge "Internal"）
├── MCP          → https://try.flora.ai/lp/mcp  ★ external: true，badge "New"，icon: Plug
├── Slack        → SlackSidebarNav
├── Projects / Library / Tools / More ...
```

点击 MCP 项只做两件事：外跳 + 上报埋点 `mcp_tab_clicked`。侧栏 badge 为 `IntegrationNewBadge` 默认 label `"New"`（绿色/grass 色调），即用户看到的 "MCP New"。

用户旅程（bundle 可证部分）：

```
用户点击侧栏 MCP ──► mcp_tab_clicked 埋点 ──► 外跳 try.flora.ai/lp/mcp（营销/落地页）
                                                    │ (MCP 客户端接入流程在该域完成，bundle 外)
外部 MCP 客户端调用 Flora MCP server ──► generation(source="mcp"|"webmcp"|"public_api_mcp")
                                                    │
产物（图/视频/文本…）作为 saved node 落库 ──► originLabel = "mcp" ──► Library "MCP" 筛选 tab，黄色 "MCP" 徽章
                                                    │
用户首次用 MCP 后 users.mcpUsedAt 置位；可领 MCP 试用积分 mcpTrialCreditClaimedAt
```

### 2. MCP 在产品中的角色（综合推断）

- 推断：Flora 把「画布生成能力」通过 MCP 暴露给外部 AI 客户端（Claude/Cursor 等），用户在外部 agent 里生成的内容回到 Flora 的 Library，形成拉新/留存闭环；配套「MCP 试用积分」（`mcpTrialCreditClaimedAt`）是典型增长手段。
- 佐证（一手）：`SAVED_NODE_ORIGIN_LABEL={MCP:"mcp",API:"api",CANVAS:"canvas"}` 表明 MCP 与 API、画布并列为一等产物来源；Library 专门有 `ea={MCP:"mcp",API:"api"}` 两个集成筛选 tab。
- 推断：`WEBMCP` 与 `PUBLIC_API_MCP` 并存说明 MCP 接入有两条链路——网页/web 侧 MCP（webmcp）与公网 API 网关侧 MCP（public_api_mcp），外加内部 `MCP` 来源；区别在 bundle 外的服务端，无法进一步证实。

### 3. 付费墙

Pricing 页 Starter 套餐 feature 列表逐字包含 `{label:"API & MCP access",included:!0}`；Pro/Max 套餐文案为 "Everything in Starter/Pro"，未单独提 MCP。即 MCP 访问随 Starter 及以上套餐提供（一手，feature 文案）。

## 二、机制级附录

### A. 侧栏 MCP 导航项（3yc-y57ou8gwi.js，一手逐字）

```js
case"mcp":return(0,t.jsx)(G.DashboardSidebarNavItem,{
  href:H.appRoutes.mcp, external:!0, icon:g.Plug, label:"MCP",
  compact:to, selected:!1, onClick:eR,
  trailing:(0,t.jsx)(y.IntegrationNewBadge,{}), dataTest:"sidebar-mcp"},e);
// 事件处理器（同文件）：
function eR(){(0,R.captureAnalyticsEvent)(l.EVENTS.mcp_tab_clicked)}
```

### B. 路由表（245x6abtmz2ih.js，一手逐字）

```js
mcp:"https://try.flora.ai/lp/mcp",
```
（同一 appRoutes 对象中其余条目均为站内相对路径，如 `techniques:"/techniques"`、`apiPlayground:{root:"/api",...}`，mcp 是少数绝对外链。）

### C. GenerationSource 枚举（2zk-27-g42vq3.js，一手逐字）

```js
e.s(["GenerationSource",0,{ACTIVE_CANVAS:"active_canvas",BATCH_GENERATION:"batch_generation",
CHAT_VIEW:"chat_view",FAUNA:"fauna",GENERATE_PAGE:"generate_page",MCP:"mcp",
NODECADEMY:"nodecademy",PUBLIC_API:"public_api",PUBLIC_API_MCP:"public_api_mcp",
API_PLAYGROUND:"api_playground",VIDEO_EDITOR:"video_editor",WEBMCP:"webmcp"}, ...
```

在 Convex/zod 校验层（2ru825uhloavh.js，一手逐字）被用作 literal union：

```js
ej=b.v.union(b.v.literal(r.GenerationSource.ACTIVE_CANVAS),...,b.v.literal(r.GenerationSource.MCP),
  ...,b.v.literal(r.GenerationSource.PUBLIC_API_MCP),...,b.v.literal(r.GenerationSource.WEBMCP))
```

### D. 埋点事件（245x6abtmz2ih.js，一手逐字）

事件注册表（与前后的 `api_key_created`、`public_api_request`、`integration_connect_completed` 等相邻）：

```js
mcp_tool_call:"mcp_tool_call",
mcp_tab_clicked:"mcp_tab_clicked",
mcp_consent_viewed:"mcp_consent_viewed",
mcp_consent_granted:"mcp_consent_granted",
mcp_consent_denied:"mcp_consent_denied",
mcp_consent_signed_out:"mcp_consent_signed_out",
mcp_consent_unavailable:"mcp_consent_unavailable",
```

- `mcp_tool_call`：说明前端埋点能感知一次 MCP 工具调用（推断：由轮询/SSE/引用计数带回前端；触发点不在 bundle 命中处）。
- `mcp_consent_*` 五连：推断为 OAuth 式授权同意页的漏斗（viewed→granted/denied），外加未登录（signed_out）与不可用（unavailable）分支。bundle 中未找到该 consent UI 的渲染代码——推断 consent 发生在 try.flora.ai/lp/mcp 域或服务端渲染页。

### E. 服务端环境变量（37kvhloo39esn.js 运行时 env 注入 + 2bbvvfva7pfdq.js zod schema，一手逐字）

```js
// zod schema（2bbvvfva7pfdq.js）：
CREATE_AGENT_FLORA_MCP_URL:n.z.preprocess(e=>""===e?void 0:e,n.z.string().url().optional()),
MCP_CODE_RUNNER_SECRET:n.z.string().min(1).optional(),
MCP_SANDBOX_SNAPSHOT_NODE:n.z.string().min(1).optional(),

// env 注入（37kvhloo39esn.js）：
CREATE_AGENT_FLORA_MCP_URL:o.default.env.CREATE_AGENT_FLORA_MCP_URL,
MCP_CODE_RUNNER_SECRET:o.default.env.MCP_CODE_RUNNER_SECRET,
MCP_SANDBOX_SNAPSHOT_NODE:o.default.env.MCP_SANDBOX_SNAPSHOT_NODE,
```

解读（推断，标识符逐字为证）：
- `CREATE_AGENT_FLORA_MCP_URL`：可选 URL，指向 Flora 自己的 MCP 端点，供 "Create agent" 子系统调用——即 Flora 内部 agent 也会消费自家 MCP server。
- `MCP_CODE_RUNNER_SECRET` + `MCP_SANDBOX_SNAPSHOT_NODE`：MCP 侧存在代码执行沙箱；snapshot node 命名风格与同列表的 `MODEL3D_BLENDER_SANDBOX_SNAPSHOT_ID`（Blender 3D 沙箱快照）一致，推断是预构建的容器/VM 快照（node 版本快照），`MCP_CODE_RUNNER_SECRET` 是调用该 runner 的共享密钥。

### F. 用户表 MCP 字段（2ru825uhloavh.js，Convex users validator，一手逐字）

```js
mcpUsedAt:b.v.optional(b.v.number()),
mcpTrialCreditClaimedAt:b.v.optional(b.v.number()),
```
（均为 epoch 数字时间戳，optional。同表相邻字段含 `subscriptionCancellationRequestedAt`、`studioExplorationCreditClaimedAt` 等。）

### G. 产物来源标签（18_rcz_m_sgob.js，一手逐字）

```js
e.s(["SAVED_NODE_ORIGIN_LABEL",0,{MCP:"mcp",API:"api",CANVAS:"canvas"}])
```

### H. Library 的 MCP 筛选与徽章（3avtxeavd0-qo.js + 02sbsm9v-_rmv.js，一手逐字）

```js
// 集成来源 tab（3avtxeavd0-qo.js）
let y={mcp:{id:"mcp",label:"MCP"},api:{id:"api",label:"API"}};
// saved node → Library 视图模型时：source:e.originLabel?y[e.originLabel]:void 0

// 卡片徽章（02sbsm9v-_rmv.js）
function rL(e){return e.source?.id==="api"?(0,t.jsx)(h.IntegrationNewBadge,{label:"API"}):
  e.source?.id==="mcp"?(0,t.jsx)(h.IntegrationNewBadge,{label:"MCP",tone:"yellow"}):null}

// 类型筛选下拉含 MCP（02sbsm9v-_rmv.js）
let nG=["All","Text","Doc","Audio","Image","Video","3D","MCP","API"];
```

注意：在 Library 筛选下拉里 "MCP" 是与媒体类型并列的一个"类型"入口，实现上通过 `ea={MCP:"mcp",API:"api"}` 映射为来源过滤。

### I. Pricing（00d0pt9gjg7yi.js，一手逐字）

```js
[G.PricingV3Plan.Starter]:{...features:[...,{label:"API & MCP access",included:!0},
 {label:"Real-time collaboration",included:!0}]},
```

### J. 媒体 CDN 目录（2vbd3ltw6fooi.js，一手逐字）

`https://media.flora.ai/mcp-uploads/2026/8/14/user_33XfrVmgco7f88oWnNFkr2WXR5j/<uuid>.jpg?tr=orig`
——存在 `mcp-uploads/` 上传目录（此处 8 张图实为 Fashion Studio 宣传素材）。证明 MCP/上传管线写入同一媒体 CDN（推断：MCP 生成/上传的产物目录前缀为 `mcp-uploads/`）。

### K. 否定性发现（均一手验证，检索 2026-09-30）

| 检索项 | 结果 |
|---|---|
| `mcpServers` / `mcpUrl` / `mcp.json` / `registerMcpServer` | 0 命中 |
| `tools/call` / `tools/list` / `jsonrpc` / `streamable` | 0 命中 |
| `Model Context Protocol`（全文） | 0 命中 |
| MCP 客户端配置示例（claude_desktop_config 等） | 0 命中 |
| `setMcpUsed` / `claimMcpTrial` 等 Convex mutation 名 | 0 命中（字段在 validator 中存在，mutation 在服务端 bundle，未随前端下发） |
| `smithery` / `mcp-remote` | 0 命中 |

`oauth/authorize` 唯一命中（0oeksuqbl2-3k.js）是 Clerk 前端 API（`https://clerk.flora.ai`）登录重定向白名单 `new Set(["/oauth/authorize","/oauth/authorize-with-immediate-redirect"])`，与 MCP OAuth 无关。

### L. 与 Techniques 的关系

- bundle 中未找到 "技法 → MCP tool" 的暴露路径；Techniques 相关常量（18_rcz_m_sgob.js 的 `TECHNIQUE_CATEGORIES` 等）与 MCP 无交集。
- 推断：MCP server 暴露的工具集由服务端定义（配合 `MCP_CODE_RUNNER_*` 沙箱执行生成代码），前端只负责来源标记与 Library 展示。技法是否已作为 MCP tool 提供，bundle 内无法证实（未找到）。

## 三、证据与来源

### chunk 清单

| chunk | 大小 | 角色 | 证据 |
|---|---|---|---|
| 245x6abtmz2ih.js | 54KB | 埋点事件注册表 + appRoutes | mcp_tool_call/mcp_consent_*/mcp_tab_clicked；`mcp:"https://try.flora.ai/lp/mcp"` |
| 3yc-y57ou8gwi.js | 126KB | Dashboard 侧栏组件 | sidebar-mcp 导航项、external:true、eR 埋点 |
| 2zk-27-g42vq3.js | 51KB | 共享枚举 | GenerationSource 枚举含 MCP/WEBMCP/PUBLIC_API_MCP |
| 2ru825uhloavh.js | 98KB | Convex schema/validator | GenerationSource literal union；users.mcpUsedAt/mcpTrialCreditClaimedAt |
| 37kvhloo39esn.js | 361KB | 服务端 env 注入 | MCP_CODE_RUNNER_SECRET/MCP_SANDBOX_SNAPSHOT_NODE/CREATE_AGENT_FLORA_MCP_URL |
| 2bbvvfva7pfdq.js | 29KB | env zod schema | 同上三个变量的校验定义 |
| 18_rcz_m_sgob.js | 26KB | 共享常量 | SAVED_NODE_ORIGIN_LABEL={MCP,API,CANVAS} |
| 3avtxeavd0-qo.js | 57KB | Library 视图模型 | y={mcp:{id:"mcp",label:"MCP"},api:…}，source 映射 |
| 02sbsm9v-_rmv.js | 252KB | Library UI | MCP 黄色徽章 rL、筛选下拉 nG |
| 00d0pt9gjg7yi.js | 137KB | Pricing 页 | Starter "API & MCP access" |
| 2vbd3ltw6fooi.js | 95KB | 营销素材 | media.flora.ai/mcp-uploads/ 目录 8 例 |
| 0oeksuqbl2-3k.js | 37KB | Clerk 登录流 | oauth/authorize 白名单（排除 MCP OAuth 误解） |
| 3zqb624po1kk-.js | 10.8MB | SSR 数据快照 | 仅 `prm_v12ymcpjz012xy1ike8mhesk` 等 ID 随机子串误命中，无真实 MCP 内容 |

### 可复现命令

```bash
# 定位（区分大小写两轮 + 精确词）
grep -l -i 'mcp' /tmp/flora-chunks/*.js
grep -l 'MCP' /tmp/flora-chunks/*.js
grep -o -i '[a-zA-Z0-9_./-]*mcp[a-zA-Z0-9_./-]*' /tmp/flora-chunks/*.js | sort | uniq -c | sort -rn

# 关键锚点
grep -l 'try\.flora\.ai' /tmp/flora-chunks/*.js                 # → 245x6abtmz2ih.js
grep -l 'mcpServers\|mcpUrl\|tools/call\|jsonrpc' /tmp/flora-chunks/*.js   # → 0 命中

# 窗口提取（本文所有引文出自该脚本）
python3 - << 'EOF'
import re
data=open('/tmp/flora-chunks/245x6abtmz2ih.js',encoding='utf-8',errors='replace').read()
for m in re.finditer(r'try\.flora\.ai', data):
    print(data[max(0,m.start()-1200):m.end()+1200])
EOF
```

### 证据分级汇总

- 一手逐字：B/C/D/E/F/G/H/I/J 全部引文、K 的否定性检索。
- 推断：MCP 页在 try.flora.ai 外部域承载；`mcp_consent_*` 为 OAuth 式同意漏斗；WEBMCP vs PUBLIC_API_MCP 双链路分工；沙箱快照用于 MCP 代码执行；MCP 产物上传目录前缀 `mcp-uploads/`。
- 官方文档：无（本次未联网核对 try.flora.ai/lp/mcp 内容）。
- 未找到：MCP 协议端点/传输/工具清单、 Techniques→MCP tool 映射、consent UI 渲染代码、mcpUsedAt 的写入 mutation。
