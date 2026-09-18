# F-06 扩图 MVP 执行计划

> 前置：本计划按 design.md 执行。每个提交点小步提交到 `feat/ecom-f06-outpaint`；主 checkout 只读。
> 验证命令统一在 `web/` 下执行：`bun test <file>`（专项）、`bun test`（全量）、`bun run build`（收口）。

## Step 0：M0 前置核对（2026-09-18 完成，无 design 冲突）

- [x] 0.1 mask 极性：`buildEditMask`（canvas-node-mask-edit-dialog.tsx:310）产出 = 白底不透明全铺 + 涂抹区 alpha→0（透明）；即现行语义 **透明=要生成**，与用户裁定一致。`provider_protocol.go:264-267` 仅规范化 `role:"mask"`，无极性反转；openai-images 合同（mask 透明区=编辑区）端到端同向。结论：`padImageToDataUrl(fill:"transparent")` 直接产出「原图区不透明、新增区透明」无需转换。
- [x] 0.2 DOM 结构：节点元素选择器 `[data-node-id="{id}"]`；世界层 `[data-canvas-world-layer], .canvas-world-layer`；挂件对 worldLayer 挂 `MutationObserver(attributes:["style"], subtree:true)` 捕捉拖拽预览（canvas-workspace-overlays.tsx:159-188）；`data-canvas-no-zoom`/`data-canvas-wheel-scroll` 约定在多个画布组件在用。外扩框挂载父级 = 画布容器内节点锚定（实现时按 overflow 裁剪边界定）。
- [x] 0.3 `maxImages: 0` = `grok-imagine-image` 前缀模型（model-capabilities.ts:268-269，grok-image 协议除外）→ 即参数条明示禁用的对象。
- [x] 0.4 `canvas-live-viewport.ts`：`subscribeCanvasViewportPreview(container, listener)`（CustomEvent detail = ViewportTransform，返回退订函数）；`subscribeCanvasNodeDragPreview` 同款；实时 scale 通道可用。

## Step 1：几何纯函数（提交 1：`feat(canvas): 扩图几何纯函数`）

- [x] 1.1 新建 `web/src/lib/canvas/canvas-outpaint-geometry.ts`：`resolveOutpaintPadding` / `resolveOutpaintTargetPx` / `describeOutpaintSize`（design §7）。
- [x] 1.2 新建 `web/test/canvas-outpaint-geometry.test.ts`：clamp 边界（每边 ≥0）、ratio 约束往返、4096 长边 clamp、scale 换算一致性。
- [x] 1.3 验证：`bun test canvas-outpaint-geometry`。
- 回滚点：纯新增文件，revert 单提交即可。

## Step 2：padImageToDataUrl（提交 2：`feat(canvas): padImageToDataUrl 补边合成`）

- [x] 2.1 `canvas-image-data.ts` 加 `ImagePadRect` + `padImageToDataUrl`（design §5，复用文件内 loadImage）。
- [x] 2.2 无 canvas stub 先例（bun test 无 DOM，全库零先例），按预留路径：padImageToDataUrl 保持与 cropDataUrl 同构的薄实现，几何契约由 Step 1 测试锁定，真机验证兜底（Step 6），交付说明标注。
- [x] 2.3 验证：专项几何测试 11 pass；tsc --noEmit 通过；全量 1831 tests / 1813 pass / **18 fail = 枝点存量基线**（stash 对照实证：去掉本枝未提交改动后同样 18 fail；失败集中 storyboard/creative-agent/director-diagnostics/toolbar-mode-switch 等 6 个无关文件，零 import 关联）。降级门口径 = 交付时 fail 集合 ⊆ 这 18 个。

## Step 3：提交链（提交 3：`feat(canvas): outpaintImageNode 扩图提交链`）

- [x] 3.1 `use-canvas-media-tools.ts`：`outpaintNodeId` state + `setOutpaintNodeId` + 返回值导出（:114/:978 模式）。
- [x] 3.2 `outpaintImageNode` 照 maskEditImageNode 骨架：能力校验换 `maxImages>=1`、双协议路由（mask 带与不带）、固定提示词模板、root/child 批量、结果落节点（design §6）。
- [x] 3.3 验证：`bun test` 全量；`bun run build` 类型通过。

## Step 4：覆盖层组件（提交 3：`feat(canvas): 画布内扩图外扩框与参数条`，2026-09-18 完成）

> 实现备注：按 design §3.1 修订落地（外扩框渲染在屏幕空间覆盖层 + `[data-node-id]` rect 实测定位 + MO/RO/live-viewport 三通道实测驱动）；积分槽位照 prompt-panel :137-207 同款（requestCreditCost + quoteLogicalModel AbortController + CreditSymbol + creditsEnabled 门控）；手柄 pointerdown stopPropagation + setPointerCapture；参数条挂 data-canvas-no-zoom/wheel-scroll；inline transition 一拍入场。

- [x] 4.1 新建 `canvas-node-outpaint-overlay.tsx`：导出 `CanvasImageOutpaintPayload` + `CanvasNodeOutpaintOverlay`。
- [x] 4.2 世界层外扩框：8 手柄（pointerdown stopPropagation + pointer capture）、三分网格、尺寸标注、clamp、比例约束（geometry 纯函数驱动）。
- [x] 4.3 屏幕层参数条：✕ / 比例 / 引导文案 / 分辨率 / 张数 / 模型 / 积分预估 / 执行；`pointer-events-none` 容器 + `pointer-events-auto` 子元素；`data-canvas-no-zoom` + `data-canvas-wheel-scroll`；玻璃仅参数条局部；inline transition。积分槽位照 prompt-panel :137-207 模式：`requestCreditCost` 本地价 + `quoteLogicalModel` 远端报价（AbortController）× 张数 + `<CreditSymbol/>`；`creditsEnabled=false` 隐藏整块。
- [x] 4.4 DOM 实测接线：RO/MO 循环（参照 `canvas-workspace-overlays.tsx:55-60/172-196`）；`maxImages=0` 明示禁用执行。
- [x] 4.5 样式三层令牌自查：无 globals.css 改动、无字面值散落（`git diff --stat` 核对）。

## Step 5：接线面（提交 5：`feat(canvas): 扩图工具入口接线`，2026-09-18 完成）

> 实现备注：接线面实际涉及 6 文件（比 D2 清单多 use-canvas-render-model.ts 与 shared.tsx 两处：前者负责 outpaintNodeId→outpaintNode 解析同 crop/maskEdit 模式，后者是 unauthorized 场景的工具栏 props 兜底）——记录合并成本供 A 线参照。

- [x] 5.1 `canvas-image-toolbar-tools.tsx`：outpaint 工具定义（"构图与尺寸" group process、order 15）+ handler。
- [x] 5.2 `canvas-project-media-dialogs.tsx`：outpaintNodeId 激活时挂 overlay；onClose 清理。
- [x] 5.3 `project.tsx`：state 透传 + `onOutpaint` + payload 回调（照 maskEdit :923/:3405 模式）。
- [x] 5.4 `canvas-node-toolbar.tsx`：实现时核实是否需同步（group 渲染兼容），预期小改或零改。
- [x] 5.5 验证：`bun test` 全量 + `bun run build`。

## Step 6：真机验证（开发自测 2026-09-18 完成，用户终验待做）

- [x] 6.1 环境实证：端口实测（8080/8081/3000/8182 被 A 线占；3001/8181 空闲按任务书启用）；backend health 200（schema 19/19，独立数据目录 .local/f06-wt-debug）；:3001 页面 200；:3001/api 代理透传返回 8181 响应（防 vite.config.ts:10 回退 8080 已实证）。**注：tmwd 桥全瘫（内容脚本孤儿化+CDP 锁死，已知状态），改用本机 Chrome headless 自测（合成事件仅作开发自测证据，最终验收由用户真机进行）。**
- [x] 6.2 冒烟实测（headless 自测 + 后端日志证据）：AC1 外扩框包裹节点[四边 48px]/8 手柄/网格 9 格/参数条恒宽 500 在框下/容器 pointer-events:none ✓；AC2 拖手柄框变宽且节点未平移 ✓、clamp(框≥原图) ✓、4:3 比例精确锁定 1.3333 ✓（1:1 因宽图 padding 无解发生设计内让步）；缩放跟随 UI 放大 ✓；AC3 ✕ 后 overlay/bar 全消失 ✓；AC4 gpt-image-1(maxImages=16) 执行激活 + 无渠道时禁用明示 ✓、maskSupported=true 提交带 mask（请求体含 mask）✓；AC5 提交链贯通：pad 图+mask 资产上传 → POST /api/tasks 200（queued/progress 5）→ worker 出站 example.com(HTTP 405) → 节点错误态+重新生成 ✓；AC5b 积分 0.50/张 真实本地价 ✓。
- [x] 6.3 证据：`.local/f06-evidence/*.png`（22-outpaint-active[激活态]、25-ratio-43[比例] 、30-model-picked[模型+积分]、32-after-submit[提交后]、33-task-error[错误态]）。
- [ ] 6.4 **用户终验（待做）**：真实渠道下拖拽生成一张真实扩图；tmwd 桥需用户重载 Chrome 扩展后可用；测试账号 f06test / f06Test12345（本 worktree 独立库 .local/f06-wt-debug）；自测渠道 CHANNEL_000003(f06-selftest, example.com 占位) 可在终验前删除或替换为真实渠道。
- [ ] 6.2 冒烟清单：AC1–AC7 + AC5b 逐条过（外扩框跟随缩放平移 / 手柄拖拽不触发画布平移 / clamp / 比例约束 / ✕ 清理 / 能力禁用明示 / 提交出图 / 结果节点连线 / 积分随模型与张数变化且报价失败回落本地价）；截图或录屏留证（CDP 合成事件不算）。
- [ ] 6.3 明暗主题、缩放极端（很小/很大）、长图与方图各一轮。

## Step 7：文档同步 + 收口（提交 6：`docs(canvas): F-06 扩图 MVP 文档`）

- [ ] 7.1 `docs/content/docs/overview/features.mdx` 增 F-06 条目。
- [ ] 7.2 `docs/content/docs/backend/code-map.mdx` 如涉及前端地图则补（后端零改动不触发表文档）。
- [ ] 7.3 `docs/content/docs/progress/pending-test.mdx` 登记"已实现待用户确认"条目。
- [ ] 7.4 最终验证：`bun test` 全绿 + `bun run build`；git log 小步提交链完整。

## Review Gate

- Step 0 后：核对结论若有与 design 冲突 → 回 design.md 修订再继续。
- Step 5 后：code-review-expert skill 全面审查（2026-09-18）——发现并修复 6 项：P0 拖拽增量叠加（改起点基准）、P1 storageKey 覆盖 pad 白边（去字段）、P1 节点切换状态残留（key 重挂）、P2 追加入口缺失、遮挡 bug（z-10→--z-node-toolbar 令牌）、size 值域错配（全局比例语义→模型档位域钳制）。提交 2af268b7 / 964a3560。
- Step 6 前后：合入降级门材料（测试证据 + 截图）交付用户；合入动作由用户在 main checkout 执行。

## 用户终验反馈修复（2026-09-18 第二轮，提交 165471af）

- [x] F1 聚焦动画：触发扩图时 `focusCanvasImageNode` viewport 聚焦 + 框从原图 0 padding 展开到默认值（inline transition 360ms，拖拽期自动禁用跟手）。
- [x] F2 扩图期隐藏工具栏：render-model 的 `toolbarNode` 与 project.tsx 的 `hoverToolbarNode` 双路径在 outpaintNodeId 激活时置空（工具栏+hover 微浮全隐藏，✕ 退出后恢复）。
- [x] F3 框漂移错位：根因 = viewport 转场是 rAF 逐帧插值且 CSS transition 插值帧不触发 MutationObserver，v1 未订阅 `CANVAS_VIEWPORT_PREVIEW_EVENT` → 聚焦动画期间框停在旧位置。修复 = 补订阅逐帧重算 + `ensureNodeElement` 防虚拟化世界重建节点 DOM 后 ref 失连。复验：四边对称 ±37px、平移/缩放后精确跟随（48×scale 换算无误差）。
- [x] F4 边手柄拖拽变平移：根因 = 比例默认"原图比例"锁定 ratio，单边拖拽被反解为对边补偿（净效果平移）。修复 = "自由"档（ratio=null），单边拖拽纯调整大小；选中具体比例仍锁定。
- [x] F5 参数条重排（用户裁定顺序）：✕ / 模型 / 比例 / 分辨率(1K/2K/4K 或模型 size 档，按模型能力域) / 数量 / 生成按钮(附预估消耗)。比例槽在 aspect_ratio 制模型用模型档位并提交 size；size 制模型显示分辨率档；quality 多档显示画质档。
- 备注：排查期间 headless 测得"框脱节 1270px"为测试脚本参照物错误（querySelector 首个节点 ≠ overlay 绑定节点）的假警报，组件定位本身精确（style.left 与绑定节点 530px 处匹配）。

## 用户终验反馈修复（2026-09-18 第三轮）

- [x] G1 框样式减重 + 亮色适配：白边+黑圈 shadow 改 `border-primary/70`（明暗自适应）、去黑 shadow、网格减为 4 条内线 primary/15、角手柄 primary 实心+background 描边、边手柄半透明胶囊、尺寸标注换 bg-background/85+border 材质。
- [x] G2 扩展区"+"号填充（用户参考图：砖石交错）：4 条带挖出原图区域 + 内联 SVG pattern（tile 44x22 双列错半步 + 菱形中心微弱点 opacity .4），stroke=currentColor 走 `text-primary/35` 令牌明暗自适应。
- [x] G3 参数条分隔：✕|模型|比例|分辨率|数量 间全部加 `h-6 w-px bg-border` 分隔线；执行按钮 `text-primary-foreground` 被 antd unlayered reset 覆盖（computed #111827 实锤，PATCH-MAP #13 同款模式）→ inline style 对抗，明暗双主题 computed 验证通过。
- [x] G4 真实生成验证：grok2api 渠道（Tailscale 内网，`CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS` 精确放行 + A 线库 `enc:v1:` AES-GCM 解密搬运 key）链路全通但上游账号冷却（429 upstream_cooling，且该渠道不支持图生图——用户确认）；改用用户提供的 ddcat 渠道（gpt-image-2，openai-image 协议 mask 路由）**真实扩图出图成功**：800×600 → 1421×1107 PNG，扩展区渐变无缝延续，任务 15s 完成（任务 075a8bcf、渠道 CHANNEL_000005 f06-ddcat）。
- [x] G5 quality 域钳制（真实测试发现）：payload.quality 为空时 hook 回落全局 config.quality（"medium"）→ aspect_ratio/1k2k 域模型 400「生成质量超出支持范围」；修 = overlay 提交层 quality 域非空时总是给域内值（越域回落模型默认档）短路回落链。
- 遗留记录：grok 429 失败节点「重新生成」报「参考图片已丢失」——任务重试链不带原任务临时 dataUrl 参考图，属重试链限制（非扩图主链），后续任务处理。

## 用户终验反馈修复（2026-09-18 第四轮，提交见 git log）

- [x] H1 模型参数推导（F1）：size 制模型的比例槽从分辨率档推导真实画幅（`sizeValueToRatioLabel` gcd 约分：1024x1024→1:1、1536x1024→3:2、1024x1536→2:3），不再显示与模型无关的通用组；aspect_ratio 制照旧用模型档位。
- [x] H2 菜单统一向上（F2）：比例 Dropdown `placement="top"`、分辨率/数量 Select `placement="topLeft"`，headless 断言 `menu.bottom <= bar.top` 通过。
- [x] H3 "扯"与"+"号重叠（F3）：定位基准从 `[data-node-id]`（含悬浮 header）改为优先 `[data-canvas-image-content]`（canvas-node-content.tsx 新 data 标记，真图片盒），上下拖拽语义即正确（headless: top 拖 -60 → top padding 135→74）；上下条带补 360ms 展开 transition（拖拽中禁用）。
- [x] H4 真实照片全链路（F4）：生成 1536x1024 金毛幼犬实拍照 drop 入画布 → 扩图（gpt-image-2）→ 90s 出图 1492x1054，主体/构图/光照保持，扩展区（木露台、花箱、洒水壶、花园景深）协调延续。证据 .local/f06-evidence/91-puppy-outpaint.png。
- [x] H5 重试链修复（F5）：根因 = referenceUrl 只留 storageKey/url，纯 dataUrl 的 pad 底图在 metadata.references 中丢失 → 重试时 resolveMetadataReferences 无图。修 = 提交前 `uploadImage(paddedSource)` 物化为 resource 再引用（storageKey 指向 pad 图不退化白边）。headless 断言：失败渠道触发后重试，missing-ref error 不再出现，重试任务正常创建。
- [x] H6 比例即时重算（F6）：新纯函数 `resolveOutpaintPaddingForRatio`（联立解保精确框比 + anchor 保底既有外扩量级，补差为负回落纯解），比例菜单 onClick 即算 padding，条带/框 360ms 过渡跟随。headless: 选 3:2 框比 1.501（目标 1.500）。
- [x] H7 提交压缩（H4 伴生）：2.4MB 原图 base64 edits 请求被 ddcat 中转断连（unexpected EOF，200s 实录）；`padImageToDataUrl` 增加 `PadImageOptions`（maxLongEdge 1536 整体等比缩 + 底图 JPEG 0.92 / mask PNG 保 alpha，同一 maxLongEdge 对齐）。
- [ ] H8 Agent 接入（F7）：**超出本任务边界，停机待用户裁定**——agent 的 CanvasOperation 契约只有 run_generation（无 outpaint 语义）；接入需扩 operation 契约（前端 canvas-operation-contract）+ creative-agent 方案 schema + 后端 agent 工具编排提示词，后端不再零改动。选项见交付说明。

## 用户终验反馈修复（2026-09-18 第五轮）

- [x] I1 比例反解公式错误（2:3 选完是 2.333 超宽框）：旧第二分支漏 anchor 项（`W/ratio` 应为 `(W+2*anchor)/ratio`）。重写为**中心偏移保持**算法：联立 (W+sw)/(H+sh)=ratio，sw=max(当前, ratio*H−W, 0)，dL/dB 半和分配回两边——同时修掉「忽大忽小」（外扩总量只增不减）与「图片被强制居中」（偏心方位保持，图片贴左下选比例后仍在左下）。新增 5 例测试，数值验证 2:3→0.667 精确锁定。
- [x] I2 模型菜单不向上：ModelPicker 已有 `placement` prop（:49/:620），overlay 传 `placement="top"` 生效；antd 在上方空间不足时自动翻转为合理降级（框超高被 clamp 到顶部时向下，正常位置 headless 断言 upward=true）。
- [x] I3 "+"号相位漂移（拖一边其它区域的+整体动）：4 条带各自 SVG 原点导致相位不一致。修 = 各条带内 rect 用 CSS x/y 平移到 frame 全局原点（SVG2 geometry property），四条带共享同一网格相位——拖动任一边所有 + 号静止，只有洞口变化；rect x/y 补同款 360ms transition。

## Agent 接入裁定（2026-09-18 用户：本期接入）——已实施

- 架构实测：creative agent 的工具 schema（creative_respond）、系统提示词、proposal 校验全在前端，后端仅转发 LLM 请求与承载报价/任务 API——**后端零改动成立**。
- 接入面（提交 feat(canvas): 扩图接入 creative agent）：
  - `creative-agent-contract.ts`：CreativeGenerationItem 增 `operation?: "outpaint"` + `outpaint?: { ratio?, paddingPx? }`。
  - `creative-agent-state.ts` normalize：outpaint 校验（仅图片节点、恰好 1 张源图引用、ratio/paddingPx 二选一且合法）；3 例单测。
  - `creative-agent-tools.ts`：工具 schema generation 项扩 operation/outpaint 字段 + 系统提示词扩图段落（何时用、引用规则、参数二选一、提示词边界）。
  - `creative-agent-controller.ts` prepare 循环 outpaint 分支：按 ratio（resolveOutpaintPaddingForRatio，anchor 96 保底）或 paddingPx 合成 pad 底图+mask（buildOutpaintSubmitVariants 共享 helper）→ uploadImage 物化 → 走**既有报价确认链**提交（mask 原生支持）——agent「媒体单独批准」纪律完整保留。
- 重构伴随：pad 合成逻辑从 hook 提炼为 canvas-image-data.ts 共享 `buildOutpaintSubmitVariants`（hook 与 controller 消除重复）；parseRatioValue 迁入 geometry 单一源导出。
- 验证：tsc/lint/全量 18 fail=存量基线；normalize 3 例单测过。**Agent 会话端到端（LLM 真实提出 outpaint 方案→批准→生成）待用户真机验收**——需要配置 chat 模型渠道驱动 creative_respond 工具调用。

## 已定裁定（2026-09-18 用户）

- 积分槽位 = 真实计价组件（requestCreditCost + quoteLogicalModel + CreditSymbol，creditsEnabled 门控）。
- mask 极性 = 透明区即扩图生成区。

## 已知坑与停机条件

- 画布事件抢占若有 window 级捕获监听绕过 stopPropagation → 记任务卡停机问用户（design §10.1）。
- 环境实证失败（端口占用 / vite 回退 8080）→ 停机报告，不盲试三次以上。
