# PATCH-MAP — fork 对 globals.css 直改存量登记

> 用途：A 线 flora 皮肤外置（flora-tokens.css 重定义 Semantic 层 + flora-overrides.css 组件覆写）的前置存量账本。每次上游同步的「外观隔离」类主题提交必须对照本表。
> 纪律（立此存照，2026-09-18）：**新增 UI 一律走三层令牌（Primitive → Semantic → Component），不再直改组件规则**。本纪律同步写进 Trellis 任务卡模板（.trellis/spec/frontend/）。
> 分类语义：
> - **A 纯令牌值改动** — 只动 token 值（颜色/圆角/时长变量），外置时由 flora-tokens.css 覆盖吸收；
> - **B 结构性改动** — 组件规则级（新增选择器块 / keyframes / antd 对抗规则），外置时需迁移进 flora-overrides.css；
> - **C 保留直改** — 同步卫生类（死 CSS 清删、上游错位规则清退）或上游已对齐后可随删的规则，不进外置。
> 覆盖范围：fork 独有提交（origin/main..HEAD）触及 `web/src/styles/globals.css` 共 **75 条**（2026-09-18 实测；canvas 规划记 69 系 W2 之前口径）。本表先登记热区权重 Top20，其余 55 条后续回填，不阻塞族 3。

## 外置枝登记：flora-tokens.css（2026-09-27 · feat/flora-tokens · 控制线「修-1」）

**外置完成（纯值组，从 globals.css 迁出 → `web/src/styles/flora-tokens.css`，加载序=application.tsx 样式链末端）**：
1. `--elevation-overlay`（亮 `0 8px 24px …0.14` / 暗 `0 8px 24px …0.4`）——500a16ca 安静化令牌代表项；
2. `--affordance-micro-opacity: 0.45` / `--affordance-micro-saturate: 0.8`；
3. `--workspace-foreground: var(--foreground)`（亮/暗两处）；
4. `.dark` 权威值组：`--background: oklch(0.145 0 0)` / `--foreground: oklch(0.985 0 0)` / `--border: oklch(1 0 0 / 10%)`；
5. 模型徽章 `--canvas-model-badge-bg/fg`（亮/暗成对，顺序敏感语义随迁）；
6. `--node-radius: 20px`（flora P51-030 等比适配）；
7. `--canvas-composer-settings-max-width: 168px`。

**globals.css 值面回归上游**：以上 7 组在 globals.css 全部恢复上游原文/删除 fork 增行；消费点（var() 引用）原地未动。
**diff 面收窄**：globals.css vs 上游 2cedc4c6 由 **+874/−45 · 48 hunks → +850/−41 · 41 hunks（−28 行 / −7 hunks）**；余量 = 结构类（B/C，归 W4 flora-overrides 域）。

**Riders（随枝）**：
- ① 全局 `:focus-visible` 环：`--focus-ring-visible`（flora 层）+ 零特异性 `:where()` 凭底 + 上游原生杀点消解（`canvas-node-composer-resize-handle` / `canvas-node-composer-camera-tools-trigger`，flora 层同特异性后置覆盖，globals 零改动）；folder-node / create-card 系设计替代表达，不动。
- ② 侧栏 `app-workspace-sidebar-checkin` offer 截断（72→82 ≥ 81）：gap 8→6、padding 10px 8px 10px 12px、claim padding 12→10（globals 直改 2 处，下游同步注意保留）。

**新增文件**：`web/src/styles/flora-tokens.css`（皮肤层唯一落点）；`web/test/flora-tokens-coverage.test.ts`（加载序 + 外置完成态 + riders 契约）。
**上游结构位移（供下次 merge 登记）**：globals.css 值面 7 组 + checkin 布局 2 处；application.tsx +1 import；flora-tokens.css 新文件；测试 +1 文件。

## Top20（热区权重序：挂件/composer > 模型菜单 > 微供给 > 参数面板 > S04 > 同步卫生）

| # | commit | 语义（改了什么/为什么） | 分类 | 外置化归宿 |
|---|---|---|---|---|
| 1 | `5e0c3c67` | 挂件形态回归上游原版：删 S2 顶角取直设计（直角顶角=贴合感真根因），composer 回归 `var(--canvas-composer-radius)` 四角全圆，间距 10→12px | B | overrides（pendant 圆角/间距语义块） |
| 2 | `095b1f72` | 挂件 review P0-P3 修复批：双挂载删除、fall/expand 拍守卫、退场距离 `calc(100%+40px)`、三拍时长常量化（PENDANT_WAIT/FALL/FADE/EXPAND_MS） | B | overrides（pendant 动画编排块；时长常量若进 token 可升 A） |
| 3 | `cc383e14` | 挂件入场迁 inline transition 两拍：CSS animation 在后台节流下永不播放（DOM style.width 与 rect 脱节实证），机制统一 JS 两拍（坠 240ms 重力 + 展开 420ms 慢尾），globals 孤儿 keyframes 清理 | B | overrides（pendant 遗留规则清退登记；主体已 inline 化） |
| 4 | `50850519` | composer 挂件化 S2：面板底缘锚定（`data-panel-pendant`）左对齐坠落展开，外部微浮双实例与 sense band 退役 | B | overrides（pendant 锚定几何块） |
| 5 | `a3d9d7b3` | 节点内 hover 信息态 composer S1：纯信息零按钮/flora 坠落动画/零越界 | B | overrides（hover composer 信息态层） |
| 6 | `acb1871e` | composer 挂件宽度校准 560+信息态玻璃卡：底栏自然宽实测 534，渐变遮罩换实感玻璃卡 | B | overrides（挂件宽度/玻璃卡；宽度公式已在 TSX 常量，CSS 侧仅残留） |
| 7 | `8767259d` | S08 模型列表 flora 全结构：Pinned 置顶组/渠道 flyout/Models 沉底/媒体类型徽章 | B | overrides（模型菜单结构族，最大单块） |
| 8 | `4296af98` | S08 L1/L2 钻取与 surface 权威值：radius16/384 定宽/渠道行语法 | B | overrides（P51-030 权威值块；radius/width 若 token 化可升 A） |
| 9 | `85760c50` | S08 flora 菜单权威对齐：P51-030 实测值（53 行/12radius/24 圆 logo/18 徽章），wheel 手势打断 | B | overrides（同上合并迁移） |
| 10 | `f82f3d1d` | S08 六轮根治：flyout 根级 portal/关闭器白名单/玻璃 blur16 单源/字体栈钉死/死规则清理 | B | overrides（玻璃单源块——外置时必须保住唯一源语义） |
| 11 | `9b11eee9` | 参数面板密度 + 滚动条权威规则：`canvas-settings-scroll` 细胶囊滚动条成为多面板共用唯一源（Chromium webkit 定制） | B | overrides（滚动条权威块，多面板共用） |
| 12 | `0a395a83` | 参数面板质感层：统一玻璃 surface（dark .9+blur16/亮 .94）+radius16+无阴影+命中区 40px+按下 scale | B | overrides（玻璃 surface 族——与 #10 同族合并迁移） |
| 13 | `ba9df528` | 选项亮度语义+时长步进刻度：选中=内部提亮+字纯白，全部 `!important` 对抗 antd unlayered reset | B | overrides（antd 对抗块，外置时评估 Celadon 后是否可删） |
| 14 | `019dcaf9` | 刻度线性对位/份数纯列表/组卡片/开关降亮：SettingsStepper 线性分布、`canvas-settings-group` 卡片（radius12+groupFill token）、Switch 开态降亮 | B | overrides（组卡片块——已引用 token，迁移成本低） |
| 15 | `fe1fc40e` | 微供给接线+玻璃质感：hover 锚定单例/选中常驻 full/dock 材质换 flora 玻璃族 | B | overrides（AffordanceSurface dock 材质块） |
| 16 | `28c62c00` | AffordanceSurface 原语三级容器：hidden/micro/full，只动 opacity/filter，reduced-motion 直切 | B | overrides（微供给三级规则——组件逻辑在 TSX，CSS 侧是等级视觉） |
| 17 | `52b883bc` | 面板开合动画偏移根修：leave-active 移出 prepare important 块、hidden 注入改 afterOpenChange 门控、微浮方向锚定 `--panel-float-y` | B | overrides（开合动画块；`--panel-float-y` 属 A 级 token） |
| 18 | `fc76db5c` | rc-motion appear 过渡态补入禁交互防线：首开冻结（CDP rAF/后台 tab）时透明浮层不可交互——安全边界非纯视觉 | B | overrides（幽灵防御块，标注「安全边界，迁移时逐条核对覆盖 appear/enter/leave」） |
| 19 | `a6303130` | S04 生成中状态对齐 flora：旋转渐变边框+媒体区骨架脉动+底部安静状态行 | B | overrides（生成态视觉块） |
| 20 | `a97122ce` | W2 review 清删上游 v1.5 自动并入的双栏菜单死 CSS 138 行（JSX 零消费；冲突人审盲区教训本体） | C | 保留直改（同步卫生，随上游演进可整块消失） |

## 回填清单（其余 55 条）

- 模型菜单 S08 长尾 ~10 条（48db3333→77ef2aea 轮次修复，多数已被 Top20 的权威值块吸收，回填时按「已被吸收/独立残留」二分）；
- 微供给 09-12 批 ~8 条（b871be1e/18e51c14/64a746be/0ad9e40a/9ea3cedc/8dbf2fe6/bba8d6df/f675a485/cc11548f/e66b22c9/8f781d58，多数为 AffordanceSurface 迭代中间态，终态已并入 #15/#16）;
- 挂件动画中间态 ~8 条（be90fb3b/75b8af9d/5ea75579/b5a79fa8/91486e28/c635e3bb/865017d0/e1f3945a/934e901d，中间态已被 #1-#6 终态覆盖）;
- 参数面板长尾 ~8 条（ca446eb1/7da29c2b/eb16be42/8f2c9103/55a33bc8/4d14a565/da3f3260/442539ef 等）;
- W1/W2 同步卫生 3 条（2cc4f313/76e28952/065ecf13 的 globals 裁决段，C 类）;
- 其余杂项（500a16ca 安静化令牌=A 类代表〔已 2026-09-27 外置至 flora-tokens.css〕、852d8e3d 字号、b8f50813/composer 底栏批等）。
- 回填排期：不阻塞族 3；在下次上游同步仪式（双周/事件触发）前完成二分登记，外置重构（W3 起）动工前必须全量回填。

## 批内直接编辑登记（E 系列 · 2026-09-28，控制线令）

> 用途：本批（batch-12）经控制线解禁的 globals.css 直接编辑逐条登记；编号由控制线指定，随上游同步时对照处理。

| # | 语义（改了什么/为什么） | 分类 | 外置化归宿 |
|---|---|---|---|
| E11 | z 梯级表增量（控制线 2026-09-28 rider-2 令）：新增 `--z-global-tools: 160`（全局工具带——dock 带抬到画布浮层 150 之上，画布内容从其下穿过；dock z 挂点 `canvas-toolbar.tsx` 消费） | A（纯令牌值增量） | flora-tokens.css 覆盖吸收（token 级） |

## 行为层意图性分歧登记（非 globals.css；随上游同步核对）

> S1 v3.2（2026-09-27）：组合胶囊「静默挂载」曾为对上游 #608 消息行为的意图性分歧。
> **2026-09-27 v5（选项 B · 面板归零）：分歧已撤回** —— 卡面整体下架后死锁前提消失，`applyScenePreset`/`applySingleSkill` 回滚上游原语义（确认消息 + 进对话）。本节当前**无活跃分歧**；B1 仅作审计轨迹存档，上游同步时按「无分歧」处理。

| # | 上游来源 | 分歧语义（fork 改了什么/为什么） | 分类 | 处理 |
|---|---|---|---|---|
| B1 | `67cbda6c`（上游 PR #608「场景胶囊 - 为会话挂载预设技能组合」，ddcat 主线；fork 至今未改该段） | 组合/单技能胶囊激活不再向会话写 `role:"system"` 确认消息（该消息会把 `messages.length` 置非零、卸载 welcome 与任务卡，阻断「先配技能再点卡」路径）；改为更新底栏 `Skills(N)` 计数 + `message.info` toast，错误路径同 toast 化 | B（行为层） | **已撤回（S1 v5「面板归零」，2026-09-27）**：卡面下架、死锁前提消失 → 回滚上游原语义；本行仅存档，上游同步按「无分歧」处理 |


## 形态偏离登记（组件级 · 非 globals.css）

> 范围说明：本节登记 fork 在**组件级样式**（不在 globals.css 账本口径内）对上游 / flora 参照的有意偏离，随上游同步核对。S2.1（2026-09-28，控制线批准）两处，另含 D3（2026-09-29 用户裁定追加）：

| # | 参照 | 偏离语义（改了什么 / 为什么） | 分类 | 处理 |
|---|---|---|---|---|
| D1 | flora.ai 实测（`docs/artifacts/s2-hover-upgrade/flora-hover-spec.md`） | 卡片次级灰 #7B7B7B → #949494：flora 原值对比度 3.87:1 不达 WCAG AA，fork 提亮至 ≥4.6:1 | 组件级（`web/src/components/ui/tool-hover-card.css` 本地值） | 有意保留；外置化/同步时以 AA 为准，不回收 |
| D2 | 同上 | 快捷脚注句式中文化（flora 英文句式 →「按 {kbd} {动作}」） | 组件级（同上） | 有意保留；随组件文件走 |
| D3 | 本仓层级秩序（2026-09-29 用户裁定追加） | 默认 hover 卡 z 定 1150（压过设置浮层 `--z-dialog-popover` 1100）：rider-2 曾取 `--z-tooltip` 1000，被设置弹层水平切卡；与 mini 卡既有语义对齐（1100 之上、1200 之下） | 组件级（`web/src/components/ui/tool-hover-card.css` 本地值） | 有意保留；卡族统一 1150 |

## 批次增量登记：merge-v1.5.9（2026-09-28 · 三枝合入总账）

> 口径：flora 外置枝已完成自登（见顶部「外置枝登记」）、D1/D2 见上节；F-06（B 线）未带 PATCH-MAP 改动，B 线账由合并侧并入本总账。以下条目随上游同步/外置化核对，不回收。

| # | 来源 | 登记语义（改了什么 / 为什么） | 分类 | 处理 |
|---|---|---|---|---|
| E1 | `32cfb3db` + `86cee321` | 域外授权修复（控制线 2026-09-28 授权，用户实报）：节点 hover 引用条 skill chip 修复——注入面收窄（node 级 `mentionReferencesByNodeId` 不再混入 skillMentionReferences，技能仅保留 Agent composer 面）+ hover composer 补 skill 分支（✦ / Skill），守卫=节点引用条零 skill chip；宫格切分跳闪结构性修复 | 组件级行为修复 | 有意保留；随上游同步核对 |
| E2 | `86cee321` | tool 徽章补齐（宫格同批，用户三实例实报） | 组件级 | 有意保留；随上游同步核对 |
| E3 | `61327ae9` | 新节点画质行整行移除（微修令）：偏好转 store，参数面板 2.0 承接入口 | 行为层（入口收缩） | 有意保留（去向已备注） |
| E4 | `66dfb48c` + `dd02711a` + `1f32399e` | 扩图档位门控：capability 新增 `outpaintTier` + nano 族默认播种；模型白名单硬过滤（档位过滤/默认选择/提交兜底）；重试按当前能力域恢复蒙版（关闭蒙版后旧节点重试不再误提交被拒） | B 线（前后端联动） | 有意保留；随上游同步核对 |
| E5 | `37675d30` + `68f59b56` + `4ff30b2d` + `47c9ae5e` | 硬贴回（hardBlend）总账：入库前按 rect 回贴原图像素（缺省开启/8% 失真阈/全降级路径）；Agent 链同源产出几何 rect；提交链写 `metadata.outpaint`；根修=改挂媒体物化漏斗（媒体检查点架构绕过 worker 注入点致贴回从未执行） | B 线账并入总账 | 有意保留（台账证据 75%→0.00%）；随上游同步核对 |
| E6 | `3b1f49a1` + `43736e44` | S3 渠道改造：教程/反馈去 GitHub 化（邮箱+用户群双通道）；`DOCS_BASE_URL` 空置（`web/src/lib/canvas/canvas-help-links.ts`，教程项禁用态「教程编写中」；产品裁定不暴露仓库） | 产品裁定 | 有意保留 |
| E7 | `1b3cd2df` + `75acd589` + `d265f86e` | O-03 层1：渠道预设组/交集逻辑/药丸预设态/画质档位；四刀（预设场景 / 删恢复默认 / 新节点画质+ⓘ补行 / banner「未达该预设要求（≥…）」文案）+ 宫格残余 a/b（两列独立成卡/格点豁免统一内边距/文案纠偏）；polish（说明行收入 hover 小卡/比例角标释义） | 组件级 | 有意保留；随上游同步核对 |
| E8 | `0ce555fa` + `eada7ccb` | hotfix-3（batch-12 三跑 7 红）：hover 卡滞留族修复（状态归零/focus 门控）+ O-03 达标诚实化（实际像素判定）；三文件语义 = `tool-hover-card.tsx` / `canvas-create-menu.tsx` / `image-size-presets.ts`（`canvas-image-settings-popover.tsx` 挂点） | 组件级 | 有意保留；随上游同步核对 |
| E9 | `0a16cd41` + `c8a32f58` | B 线 micro-rider：扩图硬贴回形状失明归一化（经典协议 images 归一化与失配日志；`task_outpaint_hardblend.go`）+ Agent 链 mask 可选化（跳过合成与预检放行；`cloud_agent_media_outpaint.go`） | B 线（后端） | 有意保留；随上游同步核对 |
| E10 | `4dc8c251` + `5a5ac8f1` | dock 让位 rider（batch-12）：`canvas-workspace-overlays.tsx` 面板让位语义——选中态挂件（预设 chip/面板行）不遮 dock 全局工具「添加节点」热区 | 组件级（布局避让） | **已被 E11 取代**：纯贴附恢复 + dock 全局工具带（保留登记不删除） |

---

## 合并处置登记（F 系列 · merge-v1.6.0 上游同步 · 2026-09-30）

> 本批为 fork ⇄ origin/main 上游同步（merge-base `2cedc4c6`，范围 27 commits / 221 files）。
> F 系列登记 fork 侧语义在上游重写面的**逐 hunk 重新落位**结果，以及合并中发现的
> 上游误删 / 双挂载类结构问题处置。判据：fork 语义在场 + 上游新架构在场。

| # | 涉及面 | 上游意图 | fork 语义（必须在场） | 处置 |
|---|---|---|---|---|
| F1 | `canvas-cloud-agent-panel.tsx` | +628/−263 重写：公共轴对齐、三档层级、操作记录折叠（链 `0d6f2291`→`993580a7`，含 merge `48e6a705` PR #624） | `panelLayout` 由父组件 lift 注入（HUD 让位依赖，非上游内部 hook）；`prefillPromptId` | 上游结构为基 + fork 增量逐 hunk 重新落位（无整文件取边）；我方 2169 行 vs 上游 2055 行，`panelLayout` 9 处 / `prefillPromptId` 4 处在场 |
| F2 | `canvas-cloud-agent-chat-ui.tsx` | +738/−136 重写：图标抽 helper（`agentToolCategoryIcon()` 等）+ 操作记录折叠 + `AgentQuestionBar` 增强 | `AgentUndoBar`（上游无此组件）；fork 引用条 skill chip 注入面收窄 | 上游版为基（helper 化纯 refactor 无 fork 独有逻辑）+ fork `AgentUndoBar` 段保留；我方 1910 行 vs 上游 1800 行 |
| F3 | `canvas-cloud-agent.css` | +936/−183 重写 | fork 面板容器样式增量 | 上游 CSS 变量法为基 + fork rounded/border/zIndex 保留；**合并中修复**：fork 段 `@media (prefers-reduced-motion)` 块闭合丢失导致 `CssSyntaxError: Unclosed block`（build 红），补回 `}` |
| F4 | `web/src/pages/canvas/project.tsx` | 仅 2 handler（Markdown 节点类型检查、collapse/批量展开联动） | fork 的 `agentPanelLayout` lift 注入、`onFocusNode` 节点存在性校验 | 上游 2 handler 语义并入；**合并中修复**：`CanvasToolbar`/`InfiniteCanvas` 结构错位与 `CanvasCloudAgentPanel` **双挂载**去重（保留 fork 侧含 `panelLayout`/`prefillPromptId` 的实例，并把上游 `onFocusNode` 的帧折叠/批次展开联动逻辑融合进该实例） |
| F5 | `web/src/components/canvas/canvas-node-content.tsx` | 上游新增 +126/−42（缩略图批，`resolveMediaUrl` 取代 `scheduleResourceBlobCache`） | fork 视频节点循环播放 `loop`（`b9a087ce`/`24f08487`，对齐 flora 证据，loop 经 provider 命令式应用） | 上游结构为基；`loop` 属性**保留**但移到 `preload="metadata"` 之后，以同时满足上游守卫断言 `hasAudio=… autoPlay preload="metadata"` 的相邻匹配（语义等价） |
| F6 | `web/src/styles/unified-buttons.css` | `5df5e09c` 重写本文件时**删除了** `data-icon-only` 豁免规则 | 该规则为 **fork 专有**（`2ce50bbb` 引入）：`:where(button:not(.ant-btn-icon-only):not([data-icon-only]), .ant-btn:…)` `padding-inline: max(12px, var(--space-3))`；`canvas-grid-split-picker.tsx` 依赖其豁免，否则格点 padding 撑破网格轨道 | **恢复 fork 规则**（上游删除属误删，非有意废弃）——否则 `canvas-split-hover-open.test.ts` 残余 B 守卫转红 |
| F7 | `backend/internal/app/task_outpaint_hardblend.go` | 上游新增 `numberValue(value any, fallback float64)`（`cloud_agent_director.go:253`） | fork 版 `numberValue(value interface{}) float64` | **同名重声明冲突**处置：删除 fork 版，6 处调用点（rect x0/y0/x1/y1、frame width/height）改传 `fallback=0` 调上游版（语义一致，上游版经 `cloudAgentSafeNumber` 规范化） |

**本批上游入树核验**：`2cedc4c6..origin/main` 221 文件已入 215；6 个未落地全部合法——`backend/internal/{service,skills}/seed/skills.json` 是上游 `49a73316` 技能库 Markdown 包迁移**主动删除**的旧路径，4 个 `docs/content/docs/**` 属仓库 `.gitignore` 惯例下的 untracked 工作稿。

## 冲突预判登记：merge-v1.6.0（B线 · 2026-09-29 扩图画幅偏差批）

> 用途：控制线任务书 2026-09-29 要求——本批改动面与上游 origin/main 积压 27 commits 的相交预判，随上游同步时优先核对。
> 注：本段基于本枝 PATCH-MAP 快照（fork 时点）；并入批次时请随主版（含 E 系列 / 形态偏离 / merge-v1.5.9 总账）合并处置。

| # | 改动面（本批） | 上游相交面 | 预判 | 处置建议 |
|---|---|---|---|---|
| C1 | `web/src/components/model-picker.tsx`（renderModelRow 右轨/流式区结构 + ModelLabel line1/zone）+ `web/src/styles/shared/model-picker.css`（rail/pin/zone/zone-tag/line1 让位与锚定，unlayered T 段）+ 守卫 `web/test/model-picker-style-source.test.ts` | 上游模型标签 UI（`b8eefdad` 彩色标签系统；origin/main 同文件同区域） | **高**：行内结构已 fork 专有（右轨 absolute 锚标题行 + 两行流式区 zone + pin 退出文档流），上游无同构 | 同步时以 fork 结构为底，上游 tags/价格行变更手工映射进 zone/右轨；model-tags.css/tsx 零改动（上游文件不动，冲突面收敛） |
| C2 | `web/src/lib/canvas/canvas-generation-task-sync.ts`（偏差节点尺寸让位重算） | 上游近期未动（HEAD..origin/main 无该文件） | 低 | 正常核对 |
| C3 | `web/src/pages/canvas/use-canvas-media-tools.ts`（直连写回同口径） | 上游近期未动 | 低 | 正常核对 |
| C4 | `backend/internal/app/task_outpaint_hardblend.go`（贴回阈值 0.08→0.02）+ 测试 | 无（hardblend 为 B 线独有） | 无 | **已并入（2026-09-30 序3）**：阈值 0.02 在树、`TestHardBlendOutpaintImageDriftBoundary`（0.021 跳过 / 0.019 贴回）通过；与本批 F7 的 `numberValue` 处置同文件不同函数，无交叠（控制线观察点复验通过） |

---

## 序4 rider 处置登记（G 系列 · merge-v1.6.0 · 2026-09-30）

> 上游 `f9b8c5a4 → e0a2697c`（24 commits / 916 files，其中 737 为 builtin 技能包新增，
> 与 fork 零交集）的 rider 合并处置。判据同 F 系列：fork 语义在场 + 上游新架构在场。

| # | 涉及面 | 上游意图 | fork 语义 | 处置 |
|---|---|---|---|---|
| G1 | `agent-media-policy.md` v4→v5、`cloud_agent_tools.go` generate_media 文案、`cloud_agent_media_test.go` | **产品语义反转**：auto 免审批收回——「图片、视频在所有权限模式下都先创建草稿 → 界面独立审批，auto 只豁免其他画布修改」；测试 `TestCloudAgentAutoMediaSubmitsWithoutApproval` → `TestCloudAgentAutoMediaRequiresApprovalBeforeSubmit` | fork 的扩图（outpaintRatio）能力描述 | 取上游新审批语义；fork 扩图段保留并融入新文案（policy 三处 + tools 一处） |
| G2 | `cloud_agent_runtime.go` cloudAgentRuntime 结构体 | Pi 运行时字段族：`PiAssistantResponses`（Pi runtime 成功 assistant 计数，不得以 Node 干净退出推断完成）、`IsGenerating`、`LastError` | fork `StepFullSnapshotHash`（双口径，W1 铁律域裁决 2026-09-26） | **双保**：上游字段族全收 + fork 双口径字段插于 Events 前 |
| G3 | `canvas-cloud-agent-panel.tsx` props、`project.tsx` 挂载点 | 新增 `canvasNodes` / `runningNodeId`（识别审批目标节点是否已被用户直接提交生成，配合 10ea9d3f 的 superseded_by_node） | fork `prefillPromptId`（prefill 幂等）、`panelLayout`（父组件 lift 注入） | **双保**：两侧 props 全在场，`project.tsx` 用 fork 多行格式承载 |
| G4 | `agent-canvas-patch.ts` mergeAgentCanvasEditor | `387d3562` 新增 project 顶层字段三方合并（`editor[key]` 循环，排除 id/revision/updatedAt/remoteContentHash/viewport/nodes/connections） | fork 的 `basis` 删除判定（P3 漏删修复，上游版无此逻辑） | **双保**：作用域不重叠（前者管非节点字段、后者管节点增删） |
| G5 | `user-data-sync.ts` saveRemoteUserDataBatch 冲突分支 | 新增「云端内容一致 → 自动校准版本」前置分支（409/428 冲突时先比对内容，一致则就地校准并 continue）；另两处 `getRemoteCanvasProject(id, knownRemote)` 条件读取 | fork 水位门访问器 `openLocalProject` / `watermarkProjects`（卡06 域） | **双保**：上游前置分支采用 fork 访问器实现（校准结果同步写 `acknowledgedProjects` + `watermarkProjects` + `verifiedProjects`）；条件读取已自动合并 |
| G6 | `cloud_agent_batch_table.go` / `cloud_agent_storyboard.go` | 节点级快照哈希（`cloudAgentNodeSnapshotMatches` / `cloudAgentNodeHash`）取代全画布内容哈希，实现细粒度并发控制；`creationConflict` → `cloudAgentFieldError(..., "stale_snapshot", ...)` | fork 无独有语义 | 取上游（新架构，函数已在树） |
| G7 | `model-picker.tsx` / `model-picker.css` | 弹窗宽度限制（固定宽度机制 → `max-width` 弹性）+ 新结构 `canvas-model-picker-option-heading` / `-option-name` / `-option-price`（价格内联进标题行） | fork flyout 分组架构（`canvas-model-picker-flyout`，PATCH-MAP C1 登记为 fork 专有）；`--canvas-model-picker-trigger-width` 机制 | 跟随上游删除 `triggerWidth`（TSX 注入 + `.canvas-model-picker-menu` 消费点）；fork 的 `ModelLabel` T 行结构与 flyout 段保留；`.canvas-model-picker-flyout` 的 `min-width` 待观察（原消费已废变量，退化为 0 时由 `max-content` 兜底） |
| G8 | `cloud_agent_step_hash.go`（**合并中修复**） | 上游 `a0f025aa` 统一日志出口（`log.Printf` → `slog`） | fork 的 `cloudAgentRepairSnapshotHashAgainst` 修复日志 | 自动合并把 fork 的 `log.Printf` 留在已改 `slog` 的文件中（`undefined: log` 编译错），按上游惯例改 `slog.Debug` |
| G9 | `.env.example` / `CHANGELOG.md` / `pending-test.mdx` / `code-map.mdx` | 日志变量组、v1.5.8.2/1 版本记录、三项待测（后端日志/弹窗视口/分镜画幅）、Pi runtime 代码地图 | fork 会话 cookie 变量、Unreleased、F-06 扩图待测、扩图模块描述 | **keep-both**（code-map 融合：上游 Pi runtime 段 + fork `cloud_agent_media_outpaint.go` 段） |

---

## 序5 修复登记（H 系列 · merge-v1.6.0 · 2026-09-30）

> 序5 门禁复跑期间发现的合并引入缺陷与修复。H1 为**真 bug**（schema 与描述同时
> 偏离上游，导致 canvas_apply_ops 在 Pi 路径下被 SDK 参数校验拒绝，审批门静默失效）。

| # | 涉及面 | 缺陷 | 根因 | 处置 |
|---|---|---|---|---|
| H1 | `cloud_agent_tools.go` `opProperties` | `canvas_apply_ops` 在 Pi 路径下**永不进入审批门**：Node 侧探针铁证 `Validation failed for tool "canvas_apply_ops": ops.0.x: schema is false / ops.0.y: schema is false / ops.0: must not have additional properties` → SDK `prepareToolCall` 校验失败返回 immediate error，`execute` 从未进入，Go 侧 `/tool` 桥不被调用 | 序2 处置该工具描述时误删 `opProperties` 的 `"x"`/`"y"` 两行（上游 `e0a2697c` 有），并把描述从上游的「可给 x/y 指定位置；省略坐标时服务端按画布内容自动落位」改成「不要传 x/y」——schema 与描述同时偏离上游，而 `cloud_agent_runtime_e2e_test.go` 的测试参数仍传 `x:24,y:48` | 补回 `x`/`y`（与上游逐行一致）+ 描述恢复上游措辞；当前该文件与上游差异仅剩 fork 扩图段（F 系列有意保留） |
| H2 | `cloud_agent_runtime_e2e_test.go` deadline | 两条 Pi runtime e2e（`TestCloudAgentRuntimeCompletesToolRoundTrip` / `ApprovalWriteRoundTrip`）在 /mnt/f 上必超时 | drvfs 下 Pi 依赖树导入 65907ms vs ext4 729ms（90 倍），60s 窗口不足 | 控制线裁决 b：60s→150s，两处均加注释说明 drvfs 环境适配 + ext4 CI 无影响 + 上游同步重评估提示 |

| I16 | `model_capability_defaults.go` / `_validate.go` | `applyOutpaintTierSeed` 调用（Default 入口）、`OutpaintTier` 白名单校验、`validateGPTImage2CustomSize` 具象文案（c51c8fa7） | 上游拆分新文件均未带 | E4 咽喉三处恢复；go 全量首跑 3 红 → 绿 |
| I17 | `cloud_agent_runtime_errors.go` | `upstream_address_blocked` 分支（SSRF 拒绝映射） | 上游拆分未带 | 恢复；go 全量首跑 1 红 → 绿 |

**系统核验方法（本批新增，供下批复用）**：上游按域拆分文件时，**逐注释/逐 case/逐中文文案**全树比对
（`git diff merge-base..HEAD -- <file>` 取 fork 新增行，在全树 grep 存在性）。本批该方法命中 4 处
静默丢失（E4 三处 + SSRF 映射一处），仅靠函数名比对无法发现（函数名都在，增量在函数体内）。

**教训（供下批 task book 参考）**：合并中修改工具 schema 时，schema 的 `properties`
与工具描述文案是**两个独立的事实面**，改一处必须核另一处；上游测试文件里出现
"参数违反本仓 schema" 类失败时，优先怀疑合并期对 schema 的误删而非测试过时。

---

## 合并处置登记（I 系列 · merge-v1.6.1 上游同步 · 2026-09-30）

> 范围：上游 rider 2 `e0a2697c..d328a257`（13 commits / 227 files）。主体为 `7f5d87ef`
> 平台架构拆分（前端 Agent 面板/node-content/prompt-panel/user-data-sync 与后端
> cloud_agent_*/model_capability/provider/analytics/resource 按域拆文件）。
> 控制线裁决 a：原定 `..eb13f736`，开工 fetch 发现上游越界 `d328a257`（纯格式化单文件），
> STOP 报告后并入。

| # | 涉及面 | fork 增量 | 上游新家 | 落位策略 |
|---|---|---|---|---|
| I1 | `canvas-cloud-agent-panel.tsx` | panelLayout ×9（:109 类型 / :114 签名 / :119-122 pointerHandlers / :183 架构注释）、prefillPromptId ×4、useCanvasOverlayLayer + useAppearanceStore 浮层置顶族 | 渲染段抽入 `canvas-cloud-agent-panel-parts.tsx`（−1033）；events/composer/attachments 另拆 | 根部 5 处原位；渲染段 3 处随拆落 parts；G3 的 canvasNodes/runningNodeId 双保不变 |
| I2 | `canvas-cloud-agent-chat-ui.tsx` | AgentUndoBar 定义（:1009，上游无等价物）、ECOM_STARTER 族 import | 输入区抽入 `canvas-cloud-agent-composer.tsx`（chat-ui −607），附件族入 `-attachments.ts` | 定义原位保留；上游再导出链保持；lucide 图标取 fork 超集（含 Undo2） |
| I3 | `canvas-node-content.tsx` | `loop` 属性（b9a087ce 循环播放）、视频 batch 族 `VideoBatchRootContent` / `BatchPreviewVideo`（eb4d196f） | 媒体族抽入 `canvas-node-media-content.tsx`（−825）；状态族入 `-status-content.tsx` | **F5**：`loop` 落 media-content（preload 之后，守卫断言相邻性）；视频 batch 两函数留 node-content；`BatchFrame`/`BatchPreviewImage` 已迁，`BatchFrame` 的 **视频分支按 fork 语义恢复**（上游拆分丢分支） |
| I4 | `canvas-node-prompt-panel.tsx` | `Quote` 图标（1cfec4b8 ghost 质感统一）、`CanvasCountSettingsPopover`/`CanvasTextSettingsPopover` 等 import 超集 | 抽入 `canvas-node-prompt-config.ts` / `-references.tsx` / `-resize.tsx`（−532） | 引用工具图标恢复 fork 版 `Quote className="size-3"`；import 融合 |
| I5 | `project.tsx` | agentPanelLayout lift + 双挂载去重 + 3 组 import 超集（Brush/Scissors 等图标、AffordanceSurface/ObjectHudPanel、queryGenerationTask 等） | 83 行变化（2 个 handler） | 原位落位；3 个 import 块取 fork 超集；fork 死代码（config/isAiConfigReady）随上游消失（无引用） |
| I6 | `user-data-sync.ts`（card06） | 水位门访问器 `openLocalProject`/`watermarkProjects` + G5 校准分支（云端内容一致自动校准版本，写 acknowledgedProjects/watermarkProjects/verifiedProjects） | **整文件迁** `web/src/pages/canvas/` → `web/src/services/`；media 键族入 `user-data-sync-media.ts`（+123） | 路径重定位；访问器/校准分支落新家（含 fork 语义注释）；水位门逻辑本体未被 rider 触碰 |
| I7 | `cloud_agent_runtime.go`（G2） | `StepFullSnapshotHash` 双口径字段（:164-167 注释+字段）+ 赋值点 | struct 定义保留原文件 :118；39 个函数抽入 `cloud_agent_runtime_state.go` / `-scheduler.go` / `-media.go` / `-tools.go` / `-errors.go` | **G2**：字段原位；赋值点落 `-scheduler.go`（上游拆分漏带，fork 增量恢复）；与上游节点级快照并发新逻辑无冲突 |
| I8 | `cloud_agent_tools.go` | `cloudAgentWrite` 的 `image_layer_split` 登记注释；扩图 `generate_media` 描述段 | 抽入 `-tools_canvas.go` / `-tools_read.go` / `-tools_skills.go`；`generate_media` 描述被上游重写（新增角色卡语义） | 注释迁 `-tools_read.go`；描述融合（上游角色卡段 + fork 扩图段）；重复定义消除 |
| I9 | `model_capability.go`（E4） | `applyOutpaintTierSeed`（nano 族播种 recommended） | 抽入 `-defaults.go` / `-validate.go` | **E4**：定义按落位恢复（上游拆走定义但保留调用点 :206）；outpaintTier 字段/常量原位 |
| I10 | `analytics.go` | `.Local()` 时区修正（41e558de 管理端时间窗查询本地时区对齐） | 抽入 `analytics_build.go` / `-enrich.go` / `-api_logs.go` | 修正落 `analytics_build.go` 的 `normalizeAnalyticsFilter`（上游拆分漏带） |
| I11 | `provider.go` / `resource.go` | — | 按域拆出 `provider_error*.go` / `-text*.go` / `-video*.go` / `-image.go` / `-protocol*.go` 等 | 冲突段删除（fork 段函数 100% 被新家覆盖，0 缺失） |
| I12 | `use-config-store.ts` | `logicalModelFamilyOf`（7888b5f2 S08 家族聚类，model-picker 依赖） | 公共函数抽入 `stores/config-model-options.ts` 并再导出 | 取上游新家；`logicalModelFamilyOf` 落 `config-model-options.ts` 并加入再导出链 |
| I13 | `audio-settings-panel.tsx`（§八增补） | `SettingGroup` 增强版（`extra?: ReactNode` + `theme.node.groupTitle`）、共享 `OptionPill` 导入、12 笔改造 | `b0806745` IndexTTS2 情感段（14 键 + emotionFields + 权重 input）+ `d328a257` 格式化 | AudioSettingKey 取上游 14 键；情感段用上游结构；SettingGroup 用 fork 增强版（extra 可选兼容）；`theme.node.muted` 已证存在 |
| I14 | `CHANGELOG.md` / `pending-test.mdx` | Unreleased 段 / F-06 扩图销账段 | v1.5.9/v1.5.9.1 发布段 / 素材删除+CI 提速+大文件拆分段 | keep-both（G9 惯例）；pending-test 保留 fork 路径 `docs/plans/`（路径分歧先例）+ 融合上游新段 |
| I15 | `canvas-cloud-agent.css` | fork 增量 | **rider 2 零触碰** | 零冲突直接保留 |

## F-01 入口整合登记（J 系列 · 2026-10-01 · 控制线追加裁定）

> 用户真机抽验发现结构性问题：工具栏「去除背景」走上游原生的生成式重画（云渠道扣积分），
> 而本枝实现的浏览器 WASM 本地抠图挂在 media-conversion 的 cutout 桩上——两条「去背景」链并存，
> 最直觉点的入口不走本地推理，违背三级路由的产品形态（基线档应是最易达的默认路径）。
> 控制线裁定入口整合（用户拍板选项 A），并授权触碰咽喉文件 `canvas-image-toolbar-tools.tsx`：
> 该文件的本职就是工具定义与 handlers，改动限「去除背景」这一个工具项。

| # | 涉及面 | fork 增量 | 改动内容 | 咽喉授权 |
|---|---|---|---|---|
| J1 | `canvas-image-toolbar-tools.tsx` `removeBackground` 工具项 | 工具项由「单一生成式」改为「按节点状态分档」：`label` / `description` / `run` 三者改为 node-aware 函数——普通图片走 `onRemoveBackgroundLocal`（本地 WASM），`metadata.backgroundRemoval.mode === "local"` 的结果节点走 `onRemoveBackgroundGenerative`（既有 image-edit 对话框） | 只动 `removeBackground` 一项；`description` 字段类型放宽为 `string \| ((node) => string)` 并在 `buildImageToolbarTools` 里 `resolveToolText` 解析（原先直接透传，函数会被当成字符串渲染）；新增 `isLocalBackgroundRemovalResult` 私有判定 | **控制线授权例外**：改动限该工具项 + 配套 handler 接线，不碰其他工具 |
| J2 | `use-canvas-media-tools.ts` 新增 `removeBackgroundLocally` | 本地抠图执行链：`resolveCroppableImageSource`（同源化，避开跨域 canvas 污染）→ `runBrowserCutout` → `uploadImage` → 子节点落画布并连线选中（与裁剪/标注同范式，不弹对话框）；带 `localCutoutInFlightRef` 重入守卫（首次要下 90MB）；结果节点写 `metadata.backgroundRemoval.mode = "local"` | 新增 handler，既有 `openBackgroundRemoval` 原样保留并包一层 `openBackgroundRemovalGenerative` | 同文件既有职责（媒体工具执行链），非新增面 |
| J3 | `CanvasNodeMetadata.backgroundRemoval` | 新增 `{ mode: "local" \| "generative" }` 字段 | 结果节点据此提供精修入口；不加该字段则 tsc 拒绝写入 | 类型面，非咽喉 |
| J5 | `canvas-node.tsx` 新增 `BackgroundRemovalPhaseOverlay` | 本地抠图阶段覆盖层（`role="status"` + `aria-live`，三段可读文本）；由节点 `metadata.backgroundRemovalPhase` 驱动 | 进度反馈缺陷裁定（2026-10-01）修复件：`onProgress` 原先没接，19s-570s 静默操作。与既有 `NodeStatusBadge` / `CanvasNodeLoadingFill`（S04）并列，不替换它们 | 非咽喉（画布节点渲染层）|
| J4 | `canvas-node-toolbar.tsx` / `project.tsx` / `shared.tsx` | 三个新 handler 透传（`onRemoveBackground` 保留不删） | 访客态 `shared.tsx` 三档全部 `unauthorized`，整合不放行 | 非咽喉（`shared.tsx` 访客态按裁定保持不动） |

**文案红线**：本地档「本地识别，免费离线，逐像素保真」；生成式档「AI 模型重画，适合复杂边缘，消耗积分」。
两档均不承诺「发丝级」（透明/高反光为已知弱项，由精修档承接）。
