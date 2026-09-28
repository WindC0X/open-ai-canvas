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

## 行为层意图性分歧登记（非 globals.css；随上游同步核对）

> S1 v3.2（2026-09-27）：组合胶囊「静默挂载」曾为对上游 #608 消息行为的意图性分歧。
> **2026-09-27 v5（选项 B · 面板归零）：分歧已撤回** —— 卡面整体下架后死锁前提消失，`applyScenePreset`/`applySingleSkill` 回滚上游原语义（确认消息 + 进对话）。本节当前**无活跃分歧**；B1 仅作审计轨迹存档，上游同步时按「无分歧」处理。

| # | 上游来源 | 分歧语义（fork 改了什么/为什么） | 分类 | 处理 |
|---|---|---|---|---|
| B1 | `67cbda6c`（上游 PR #608「场景胶囊 - 为会话挂载预设技能组合」，ddcat 主线；fork 至今未改该段） | 组合/单技能胶囊激活不再向会话写 `role:"system"` 确认消息（该消息会把 `messages.length` 置非零、卸载 welcome 与任务卡，阻断「先配技能再点卡」路径）；改为更新底栏 `Skills(N)` 计数 + `message.info` toast，错误路径同 toast 化 | B（行为层） | **已撤回（S1 v5「面板归零」，2026-09-27）**：卡面下架、死锁前提消失 → 回滚上游原语义；本行仅存档，上游同步按「无分歧」处理 |


## 形态偏离登记（组件级 · 非 globals.css）

> 范围说明：本节登记 fork 在**组件级样式**（不在 globals.css 账本口径内）对上游 / flora 参照的有意偏离，随上游同步核对。S2.1（2026-09-28，控制线批准）两处：

| # | 参照 | 偏离语义（改了什么 / 为什么） | 分类 | 处理 |
|---|---|---|---|---|
| D1 | flora.ai 实测（`docs/artifacts/s2-hover-upgrade/flora-hover-spec.md`） | 卡片次级灰 #7B7B7B → #949494：flora 原值对比度 3.87:1 不达 WCAG AA，fork 提亮至 ≥4.6:1 | 组件级（`web/src/components/ui/tool-hover-card.css` 本地值） | 有意保留；外置化/同步时以 AA 为准，不回收 |
| D2 | 同上 | 快捷脚注句式中文化（flora 英文句式 →「按 {kbd} {动作}」） | 组件级（同上） | 有意保留；随组件文件走 |

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
