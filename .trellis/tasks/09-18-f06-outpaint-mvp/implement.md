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

## 用户终验反馈修复（2026-09-20 第十七轮，提交 ac3bcb29 / ff48181b）

- [x] S1 「超级加倍」根因实锤（bun -e 序列模拟）：resolveOutpaintPaddingForRatio 的 closest-by-log-area 度量单调棘轮——面积距离总偏爱保持当前外扩量的候选、锚定轴只增不减，依次点击比例 3283² → 41499² 爆炸 160 倍。修复 = 第三次重写为**和守恒语义**：守恒 S=sw+sh（切比例不改变外扩总量），联立解 sh'=(W+S−r·H)/(1+r)、sw'=S−sh'，S 不足达到比例时回落最小合法框；同比例重选=精确 no-op，逐点点击全程稳定。测试更新（翻转用例 2189×3283、雪球回归用例），几何 25 pass。
- [x] S2 「沙漏缺口」根因实锤（最小复现 HTML + 逐 + 号存在性地图）：`clip-path: polygon(evenodd, 外环4点, 内环4点)` 在 CSS 里是**单条连续 8 顶点路径**——外环末点→内环首点的跳边与隐式闭合边是两条横贯左 gap 的长对角线，evenodd 逐点奇偶翻转把对角线扫过区误剪成沙漏（绕数计算与 28×6 存在性地图完全吻合）。洞居中时 gap 窄沙漏不可见（历次 headless 全过的原因）；用户放大框后 gap 128px 缺口显现。**修复 = 弃用 evenodd 多边形，改 SVG mask（白底全显 + 黑洞矩形 ref），writeClipHole 同签名改写 4 个 attribute**。最小复现 mask 版 0 缺失；真应用比例点击 + 拖图后四 gap 存在性扫描全满铺、拖图中途帧无沙漏、洞=图片矩形精确。
- 备注：本节奏再次验证「DOM 度量断言全过 ≠ 视觉正确」——缺口是渲染语义 bug，只有像素级扫描/目视才能抓到（用户两轮坚持截图质疑是对的）。

## 已定裁定（2026-09-18 用户）

- 积分槽位 = 真实计价组件（requestCreditCost + quoteLogicalModel + CreditSymbol，creditsEnabled 门控）。
- mask 极性 = 透明区即扩图生成区。

## Agent 扩图端到端验证（2026-09-19 完成，提交 0779f1c4 + e30f8472）

- [x] A1 E2E 全链贯通（run ag6c7f8d4e8479b535631a03fc74d74dba，gpt-5.6-luna 驱动）：plan → canvas_get_state → model_list → generate_media(outpaintRatio=16:9) → 审批卡带「扩图目标画幅：16:9」→ 批准 → 服务端 pad+mask 合成物化（1380x777）→ POST /api/tasks（image_outpaint，config.size = snap16 对齐像素，admission 16 倍数校验通过——前两轮 1381x778 未对齐被拒、本轮放行即证）→ ddcat gpt-image-2.5-4k 真实出图 **1677×938（≈16:9）** → 结果回写画布节点 outpaint-16x9-golden-puppy-v2 并连回原图。证据 .local/f06-evidence/agent-outpaint-result.png（视觉复核：扩展区木露台/花园/天空协调延续，主体保持）。
- [x] A2 修复过程暴露 4 个真 bug（均在 e30f8472）：
  - LLM 冗余传视频默认字段（durationSeconds:0/videoGenerateAudio:false）被 image 模式拒绝 → 容错：仅拦语义冲突（audio 模式 duration!=0、非视频却要音频）。
  - 扩图任务 config.size 落到渠道默认 "16:9" → 上游 edits 端点要 WxH 格式 400。修 = applyCloudAgentOutpaint 返回 pad 后目标像素并显式提交 config.size。
  - pad 后像素非 16 倍数 → gpt-image-2 系自定义尺寸校验拒绝。修 = plan 阶段 pickAligned（floor16/round16 组合选优，候选必须全对齐）+ paint 阶段 snap16 就近对齐（<16 不动），取整差吸收进右/下 padding，base/mask 同画布保持对齐。
  - pickAligned 初始候选含未对齐原值导致取整永不生效 → 初始候选改对齐组合。
- [x] A3 测试：go test ./internal/app/ 全绿（TestDeleteGeneratedAssetTaskReferences 首跑 SQLite db busy flaky，复跑过）；./internal/prompts/ 绿（media policy v3→4 断言同步）。
- 备注：调试期间的后端重启需 pkill 与启动分两次调用（pkill 自杀问题）；tmp debug log 已移除。

## 用户终验反馈修复（2026-09-19 第八轮，提交 5a6e9d2b）

- [x] J1 拖拽语义重写（反馈 2+3：拖边整框动 / 锁比例不锁比）：`resolveOutpaintPadding` 的 ratio 分支从「反解对边补偿」（被拖边动→对边跟着反解重算=整框平移观感）重写为**等比缩放扩图区域**——被拖轴对边锚定（padding 不变）、被拖边跟手、另一轴外扩总量按 ratio 联动并按「图片方位保持」（dL/dB 半和分配，与 resolveOutpaintPaddingForRatio 同款）分配；触底回推保 clamp。自由分支保持纯边 clamp。真机数值：1:1 锁定拖右边 +160px → padL 38 不变、padT/B 各 +80 对称、框比恒 1.000；自由拖底边 → 仅底边 +90 其余三边不动。
- [x] J2 参数槽对齐渠道结构化档位（反馈 4+5：2.33:1 是什么 / 分辨率混入比例）：比例槽不再对全 tier WxH values 逐项 gcd 推导（2048x878→2.33:1、3808x1632→7:3 的重复垃圾档根因），改用渠道能力配置的结构化 presets（image-resolution-tiers.ts buildImageResolutionOptions：tier×ratio→WxH）去重——gpt-image-2.5 显示渠道配置的 10 个比例；分辨率槽显示 AUTO+启用 tier（AUTO/1K）而非逐 WxH 列表；提交 size = tier×ratio 的渠道精确像素（自由比例或 auto → "auto"）。真机：GPT Image 1 菜单 = 自由/1:1/3:2/2:3（恰为其 presets 3 项）+ AUTO/1K。
- [x] J3 无模型隐藏参数槽（反馈 6：没有模型怎么也有参数）：根因 = modelCapabilityConfigFor 对空 model 回落默认能力域 → hasModel 判定失效。修 = hasModel=Boolean(model) 严格判定，无模型时比例/分辨率/张数槽全部隐藏、执行禁用；报价请求空模型短路。
- [x] J4 参数条居中（反馈 7）：真机量测 deltaCX=0（bar 中心=框中心）——居中本已生效，用户截图观感偏移源于 J1 的框漂移 bug（框被反解拖歪后 bar 跟随歪框）。
- [x] J5 Agent 扩图证据链补强（反馈 1：确定是扩图工具而非提示词？）：三条独立证据 = 任务表 operation='image_outpaint'；结果节点 metadata.size='1376x784'（服务端 snap16 对齐的目标像素，纯提示词生图无此值）；面板显示「16:9 · 1K · 自动」= formatImageResolutionSize(1376x784) 的映射结果。另发现并修复合成资源幂等 key 未含目标画幅的真实缺陷（合成算法迭代后同 key 命中陈旧尺寸 pad 图，mask/底图与提交 size 失配）→ key 追加 :WxH；run9 复验 1376x784 正确物化 + 真实出图 1678×937（.local/f06-evidence/agent-outpaint-run9.png 视觉复核通过）。
- 验证：几何测试 15 例全绿（含新等比语义 5 例）；全量 1820 pass/18 fail=存量基线；tsc/build 双绿；vite 重启后 headless 实测（/mnt/f watcher 失效坑再证）。

## 用户终验反馈修复（2026-09-19 第九轮，提交 9863775a）

- [x] K1 扩图模式隐藏 composer（反馈 1：怎么还出来了 composer）：根因 = 扩图激活时 dialogNodeId 仍指向目标节点，CanvasNodePromptPanel 照常挂载。修 = project.tsx selectedPanelNode 排除 outpaintNodeId 目标节点；headless 验证扩图激活后 composer 面板数 0。
- [x] K2 拖动图片 = 框内重定位（反馈 2）：新纯函数 `relocateOutpaintPadding`（拖图位移转为四边 padding 转移；ratio 锁定时总量守恒）+ overlay capture 阶段拦截内容盒 pointerdown（阻断节点拖拽管线）。headless：拖 20 → padL 38→59/padR 38→18、上下不动；往返拖回精确还原 38/38/38/38（数学自洽）；拖 120 > 右 pad 余量 → 贴边后框随图扩展（padR→1）。±1px 为显示舍入。
- [x] K3 执行按钮无反应（反馈 3）：headless 复现主链路完全正常（按钮非禁用、点击后 POST /api/assets/batch + POST /api/tasks 200、bar 正常关闭）——判定为 K1 修复前 composer 浮层（CanvasNodePanelOverlay 世界层）遮挡参数条点击所致，K1 修复即解；若真机复测仍有无反应场景需用户提供具体节点与操作序列。
- [x] K4 扩图提示词封装（反馈 4+5+6）：实锤两处暴露——前端链 canvasGenerationPromptMetadata(composerContent=追加, prompt=模板全文) composer 显示追加说明（不暴露 ✓）；**agent 链后端 createCloudAgentMediaNode 把 LLM 提示词同时写进 composerContent → 结果节点 composer 直接展示内部提示词（截图 5 实锤）**。修 = 后端对 outpaint 任务（mode=image && OutpaintRatio 非空）composerContent 置空 + metadata.outpaint={ratio} 标记（prompt 保留供重试/审计）；agent 扩图结果节点 composer 回归占位态。前端工具链生成节点无需改动（composerContent 语义已正确）。
- 验证：几何 18 例全绿（relocate 3 例新增）；全量 1841 tests / 18 fail = 存量基线；tsc/build 双绿；go test app 包 media/outpaint 全绿。

## 用户终验反馈修复（2026-09-19 第十轮，提交 299fadee）

- [x] L1 拖图方向反转（反馈 1：按住图片拖动变成框反向移动）：K2 拦截方案的结构性缺陷——padding 转移数学正确但图片本身不跟手（rect 不动、框随 padding 移动）= 视觉反向。重构：**删除内容盒 pointerdown 拦截，图片恢复原生节点拖拽（跟手）**，overlay 订阅 `subscribeCanvasNodeDragPreview` 拖拽预览事件实时反向补偿 padding——图片移 dx 则 left 增 dx / right 减 dx，框 rect 数学静止；贴边后 padding 无余量框随图扩展；ratio 锁定时总量守恒。headless：拖 (73,19) 图片跟手、框 drift (0.0,0.0) 精确静止、preview 事件 12 个正常流动。
- [x] L2 内部 composer 仍弹出（反馈 2）：「内部 composer」= 节点内 hover 信息态卡（CanvasNodeHoverComposer，flora S1），与画布级 composer 是两个实例——扩图激活时前者只由 dialogOpen 抑制而扩图 overlay 不是 dialog 挂件。修 = project.tsx `dialogOpenNodeId={outpaintNodeId ?? dialogNodeId}`（扩图目标节点同语义挂载 → hoverComposerVisible=false）；headless：扩图激活态 `data-node-hover-composer="visible"` 数 0。另修信息态取值顺序 `composerContent ?? prompt`（原 `prompt ?? composerContent` 会优先显示提交链合成文本=扩图模板全文），追加说明优先、模板不暴露。存量污染节点（composerContent 已被旧版写入全文）依赖 dialogOpen 抑制兜底。
- 排查插曲（记入排查史）：headless 首测 M2 节点不动系 mouse.down 命中参数条（框下 16px 覆盖节点中心），改拖节点上部 1/4 后 PASS；另发现 select 选中挂载 composer 时 elementsById 预览缓存可能陈旧（元素失连后 apply 只 dispatch 不设 translate）——headless 伪影/存量疑点，与 F-06 无关，登记待观察。
- 验证：tsc 双绿；几何 18 例全绿；全量 1841 tests / 18 fail = 存量基线。

## 用户终验反馈修复（2026-09-19 第十一轮，提交 a60c75f5）

- [x] N1 拖图框漂移 + 回弹（反馈 1 前半）：第十轮同步链仍走 setState → render → MO 回调的异步路径，图片 translate 与 padding 补偿差数帧 → 观感 = 框慢慢跟着漂 + 抬起后 transition 恢复把末帧落差放大成回弹。修 = preview 回调只写 paddingRef + **立即同步调 updateFrame()** 直改 frame DOM（与图片 translate 同一 tick），React setPadding 降级为拖拽结束时的树对齐；拖拽期 transition 由 dragging state 禁用不变。headless（fb10-final 同法）：拖动中框最大漂移 0.00px、松手后 0.00px 无回弹（本轮复测因用户真机会话同时操作同一画布互相干扰而中止，以几何纯函数 + 第十轮基线 + 同步链逻辑为准，真机由用户验证）。
- [x] N2 「+」号与图片粘连（反馈 1 后半）：+ 号 pattern 语义从「锚定图片左上」改为「锚定 frame 左上」——patternTransform = translate(-stripX, -stripY) 恒定，拖图（padding 转移、frame 静止）与拖边（洞口变化）时 + 号纹丝不动，只有条带尺寸变化，新露出区域自然接续。
- [x] N3 标注/提交/档位三方失配（反馈 2：图片 4:3·1K 顶部却显示 2045×1534）：scale 换算产生 2045×1534 类任意值，且参数槽重构（J2）后提交 size=tier×ratio 档位（如 1024×768）与 pad 图实际像素失配——扩图结果可能比原图还小。修 = 新纯函数 `snapOutpaintTargetSize`：比例+档位锁定时目标像素 snap 到该比例下离拖拽量级最近的档位档（2045×1534 → 2048×1536；preset 容不下原图则排除，全排除回落换算目标），paddingPx 精确重算（left+contentW=presetW，取整差吸收右/下）——**标注 = 提交 size = pad 合成像素同源**。headless：1:1 锁定标注 1741×1741 精确。几何测试 +2 例。
- [x] N4 连接点仍显示（反馈 3）：ConnectionSideRail 左右端口 visible 加 `&& !dialogOpen`（扩图激活 = dialogOpen 同语义挂载）——扩图拖拽/框内重定位期间端口不再遮挡手势。
- 环境记录：:3001 vite 两次静默死亡（setsid 启动方式不稳）+ /mnt/f watcher 失效导致探针未进产物误判；改用 `setsid nohup bash -c 'exec bunx vite --port 3001 --strictPort'` 后稳定。headless 自动化与用户真机会话共享同一画布文档会互相干扰（用户操作会改变节点 rect / 触发实时同步），用户测试期间禁止在同一画布跑自动化。
- 验证：tsc 双绿；几何 20 例全绿；全量 1843 tests / 18 fail = 存量基线。

## 用户终验反馈修复（2026-09-19 第十二轮，提交见 git log）

- [x] O1 拖图框反向移动（反馈 1）：**真单位 bug**——`CANVAS_NODE_DRAG_PREVIEW_EVENT` 的 x/y 是世界域位移（selection-controller 除以 viewport.k 后发布），overlay 回调又除以 scaleRef = 双重换算，补偿量随缩放倍增 → 非 1:1 视野下框大幅反向移动。headless 适应画布后 scale≈1 测不出（假 PASS 根因）。修 = 直接使用 preview.x/y（世界域对世界域）。教训：跨层事件必须标注坐标域。
- [x] O2 回弹（反馈 1）：FRAME_EXPAND_TRANSITION（left/top/width/height 360ms）恒开——松手 commit 后末帧位置修正被 360ms 动画放大 = 回弹；viewport 平移/缩放跟随同理"游动"。修 = transition 仅 expanding 标志开启（比例切换/档位切换的唯一入口，420ms 后自动关闭），拖图与 viewport 跟随路径直改 DOM 即时生效。
- [x] O3 锁定档位语义（反馈 2 用户教学：比例+档位定下→分辨率定下→调节只是调原图位置/占比）：
  - 档位过滤：容不下原图真实像素的档位（如 3:4 的 1K preset < 1492×1054 原图）从分辨率菜单剔除，杜绝"目标比原图还小"的无效组合；
  - 锁定档位+比例 → 目标画幅 = preset 精确像素定死：新纯函数 `resolveOutpaintPaddingForPreset`（原图居中），选比例/选档位即按 preset 重算 padding；**手柄禁用**（opacity-40 + pointerdown early-return，框不再拖拽缩放）；拖图重定位仍可用（relocate ratio 锁定总量守恒 = 框静止、图位移）；
  - 自由/auto 模式：手柄恢复可用（框自由外扩），提交目标 clamp 模型最大长边（既有 4096）；
  - 标注/提交/pad 同源 preset（N3 snap 链在锁定模式下数学恒等，保留兜底）。
  - 待用户裁定：锁定档位下"原图占比缩放"交互（手柄调 zoom）是否需要——现实现拖图=位置、框=preset 定死，占比调整需节点缩放支持（预览管线不支持 scale transform），超出本轮范围。
- [x] O4 环境根修：:3001 dev server 反复静默死亡 = bunx 后台包装不稳定；改 `nohup node node_modules/vite/bin/vite.js --port 3001 --strictPort`（与主 checkout 同款方式）后稳定。**启动必须带 VITE_API_PROXY_TARGET=http://127.0.0.1:8181**（漏带即 502"后端不可用"，上一轮"登录失败"根因）。proxy/env/探活已入启动命令模板。
- 验证：tsc 双绿；几何 22 例全绿（preset 居中 2 例新增）；全量 1845 tests / 18 fail = 存量基线；build 通过；页面/代理双 200 + 新代码进产物实测。

## 用户终验反馈修复（2026-09-19 第十三轮，提交见 git log）

- [x] Q1 档位语义再纠正（用户教学：扩图扩的是**空间/信息**，不是实际分辨率扩大——2K 图可用 1K 档生成；档位/比例只需在**所选模型支持域**内；自由模式 = 模型支持自定义；"不超 4K" = 模型最大分辨率约束）：撤销第十二轮的档位过滤（tierChoicesValid）与手柄禁用（frameLocked）——两者建立在"目标 ≥ 原图"的错误约束上。**新语义**：锁定档位+比例 → 提交 size 恒 = preset 精确像素（与拖拽量级解耦）；框显示自由（手柄可用、比例锁定重排）；**合成按占比缩放**——padImageToDataUrl 新增 target 模式（合成画布 = preset 像素、原图 drawImage 按 k=preset/框像素 缩放摆入），buildOutpaintSubmitVariants 透传 target；snapOutpaintTargetSize 去 content 排除参数（paddingPx×k 缩放）。resolveOutpaintPaddingForPreset 删除（居中方案废弃）。
- [x] Q2 拖图微震动 + 贴边顶框（反馈 2）：微震动 = preview 位移与 padding 补偿的浮点舍入差逐帧残留 → 修 = **拖图会话冻结 frame DOM**（updateFrame 对 imageDragRef 非空早退，preview 回调只累积 paddingRef 不触碰 DOM）——拖动全程框零写入=零震动；松手 padding 终值 + 节点 commit 位置一次重算精确衔接。贴边顶框 = relocate 自由分支的 overflow 扩展语义 → **统一总量守恒**（自由与锁定同语义：拖图到边图片停住，框永不被顶着移动；扩图总量由手柄/档位决定）。relocate 测试更新（守恒 2 例）。
- [x] Q3 扩图模式禁用画布对齐线（反馈 3）：useCanvasSelectionController 新增 alignmentSuppressed 参数（ref 镜像，拖拽帧与 mouseup commit 两处跳过 calculateNodeAlignment），project.tsx 传 Boolean(outpaintNodeId)。
- [x] Q4 九宫格线增强（反馈 4）：三分内线 primary/15 → /30（+号之外可辨识，辅助框内拖动定位）。
- [x] Q5 跨线端口协作（A 线对照单）：B 线占用 :3001（vite，proxy→:8181 backend，数据目录 .local/f06-wt-debug）；不碰 A 线的 :3000/:8081/tab 62；tmwd 桥（18765/18766）B 线不使用（headless 用本地 playwright）；接受前台互斥与 batch 纪律。已确认两线端口零交叠。
- 验证：tsc/build 双绿；几何 20 例全绿（relocate 守恒 + snap 占比缩放语义更新）；全量 1843 tests / 18 fail = 存量基线；vite 重启后新代码进产物实测（preset 函数 0 残留、守卫 1 处）。

## 用户终验反馈修复（2026-09-19 第十四轮，提交见 git log）

- [x] R1 拖图架构根重构（反馈 1：拖图原位空掉/图片拖出框/松手回填/框被顶走——补偿-抵消架构真机失效）：**放弃借道节点拖拽管线的补偿式方案**（贴边后 padding 补偿封顶、节点继续跟手 = 框被顶走；管线无边界 = 图片可拖出框；headless scale≈1 测不出）。新架构 = overlay 自实现拖拽：
  - 容器级捕获委托 pointerdown（目标时刻解析 contentEl，虚拟化重建不失连；stopPropagation 阻断节点拖拽/画布手势管线）+ setPointerCapture；
  - pointermove：位移 **clamp 在 padding 余量内**（图片视觉 rect 永不越出 frame，贴边即停）；图片 transform 直改跟手 + **纹理洞 clip-path（evenodd 双环）同帧跟随**（洞 = 图片视觉矩形，rect 已含 transform，直接相对 frame，不得再加位移）+ paddingRef 累积（relocate 守恒）；
  - frame 拖动全程冻结（imageDragRef 早退，DOM 零写入 = 零震动）；
  - 松手**同批提交**：onNodeMove（节点 position += 位移世界域）+ applyPadding（重分布）→ frame = node' + pad' 数学不变（零跳变）+ transform 清零。React 18 事件批处理一次 paint 无闪帧。
  - 纹理层从「四条带挖洞」重构为**单一 pattern 全铺 + clip-path 洞**：拖图时洞跟图片走、原位露 + 号纹理（tapnow 同款），frame 内部零布局变化；拖洞 transition 在 pointerdown 同步置 none（防 React render 前首帧拖尾），pointerup 清 inline 恢复。
  - onNodeMove 接线：overlay → media-dialogs（onOutpaintNodeMove）→ project.tsx setNodes 包装（stampCanvasNodeChanges 走既有持久化链）。
- [x] R2 「原图比例」默认 + 「自由」allowCustom 门控（反馈 3，截图实锤模型编辑弹窗「允许自定义」=关但扩图仍显示自由）：ratioOptions = [原图比例(默认首项), ...模型枚举档位, ...(allowCustom ? [自由] : [])]；ORIGINAL_RATIO_KEY 数值 = 原图真实宽高比（contentWidth/contentHeight）；初始与模型切换默认原图比例；aspect_ratio 制 original 提交回落模型默认（枚举无该值）；size 制 original+tier → snap 候选 = 该 tier 全部 presets（按面积就近取档，提交像素必落模型域内）。
- [x] R3 参数条居中（反馈 2）：判定为 R1 拖图 bug 的伴生症状（框被顶走后 bar 跟随歪框；J4 曾实测 deltaCX=0），拖图根修后 frame 位置稳定即恢复；待用户复测确认。
- 验证口径（如实声明）：tsc/eslint/build 双绿；全量 1843 tests / 18 fail = 存量基线；几何纯函数无新改动（clamp 在 UI 层）。**拖图手感、贴边停住、洞跟随、松手零跳变均属真机交互，headless 合成事件无法等价验证（第十四轮教训）**——以上由用户真机验收，不再宣称自测通过。

## 用户终验反馈修复（2026-09-19 第十五轮，提交 a97969ef + 044a1e9e）

- [x] S1 验证方式根变（用户质问「验证都是脚本而不是模拟人工？」成立）：新增 /tmp/f06-final-verify.py 模拟人工链路 = 真实鼠标 hover 工具条（图片工具是 click 触发的受控 Dropdown，evaluate 假点击无效）→ 点开 → 点扩图 → 真实 mouse 拖手柄/拖图片 → **逐帧 DOM 采样 + 每步截图目视复核**。本轮全部结论以截图目视为准，数值断言只作辅助。
- [x] S2 拖图撕裂总根源（三处叠加，逐个实证）：
  1. **视觉通道**：拖图写 style.transform 覆盖 React 节点定位 transform → 节点瞬移 3913px（拖图前 rect 520 vs 拖图中 4433 实锤）；改 translate 属性后实锤 **contain:layout style 节点上 translate 写入渲染不生效**（rect 恒定不动）；最终通道 = **绝对定位 left/top**（React 空闲、与 transform 定位叠加生效），SAMPLE 实测 wrapperL 533→548 精确跟手。
  2. **事件仲裁**：pointerdown 的 stopPropagation 阻不断**独立派发的 mousedown**——节点拖拽管线监听 mousedown 照常启动、每帧写世界域 translate 与我们的补偿叠加 + 双重 commit。修 = mousedown 捕获阶段独立阻断（onMouseDownBlock）+ 手柄拖拽会话防御（dragRef 非空时忽略节点卡上的 pointer 事件——手柄悬于节点卡上方，其松手事件会被拖图 up handler 误捕获引发错误 commit，实锤 commit 栈指向 onPointerUp :587）。
  3. **洞基准**：拖图中每帧重读 rect 会被 viewport/transition 的 rect 幻影污染（拖图瞬间 rect 跳 3913px）→ 修 = pointerdown 冻结 holeBase（图片盒相对 frame 偏移），拖图中洞 = 冻结基准 + 我们自己的位移，与图片严格同源。
- [x] S3 clamp 精确性：位移钳制在 padding 余量×scale 内（SAMPLE5 37.44 = 48×0.78 精确贴边），图片永不越出 frame；松手 translate/left 清零 + 节点 position commit（世界域）+ padding 重分布同批提交，gapL 76/gapT 1 精确衔接（1px 为显示舍入）。
- [x] S4 环境坑新增记录：①「图片工具」下拉是 click 触发的受控 antd Dropdown，evaluate 的 .click() 不展开（须真实鼠标 click）；② 激活扩图会触发 viewport 聚焦动画，激活前采集的节点坐标全部过期（鼠标落空白触发画布 pan），必须激活后重采；③ 节点互相重叠时 elementFromPoint 命中错误节点，须 5×5 网格采样找属于目标节点的命中点；④ 节点拖拽管线在 mousemove 中（非 rAF）逐帧写 applyCanvasNodeDragPreview。
- 验证：tsc/eslint/build 双绿；全量 1843 tests / 18 fail = 存量基线；**拖图与拖手柄全程截图目视逐张复核**（10/12/13/14-big.png）：拖图 = 图片跟手 + +号纹理填原位 + 框静止；松手 = 图片停在新位 + 无跳动；拖手柄 = 框扩 + 图片不动；调试探针（f06-commit console.log）已全部移除并 curl 验证产物。

## 用户终验反馈修复（2026-09-19 第十六轮，提交见 git log）

- [x] T1 拖图左右空缺/重叠（用户大框截图）：**世界域单位 bug**——updateImageDragVisual 把屏幕域位移 tx 直接写 wrapper 的 left/top，但 wrapper 在世界层内、left/top 走世界布局坐标，写入值被画布缩放 k 衰减（写 18px 实动 14px）→ 拖得越远洞与图片错位越大（截图 35% 重叠）。修 = tx/scale、ty/scale 域换算后再写。headless（scale 0.78）：left 23.077 世界 ×0.78 = 18px 屏幕位移逐帧 1:1；域换算与 clamp 余量换算同源后贴边行为精确。
- [x] T2 角拖拽跳变：dragAxis 每帧按累计 |dx|≥|dy| 现判主轴，斜拖时两条求解分支来回切换 = 框尺寸跳变。修 = 拖拽会话在首次显著位移（≥3px 死区）时锁定主轴（DragState.axis，resolveOutpaintPadding 新增 axis 参数）。headless：右下角斜拖 14 帧尺寸序列 651→832 平滑（比例恒 1.5），跳变 0。
- [x] T3 AUTO 标注超模型域（截图 3283×2189，模型仅 1K）：AUTO 档 presetCandidates 为空 → 标注/提交落 scale 换算裸值，admission 也会拒。修 = 新统一解析 resolveOutpaintSubmitTarget：锁定档位走既有精确比例 snap；AUTO/自由走全域 ratio 感知 snap（snapOutpaintTargetSize 新增 targetRatio，距离 = 面积项+比例项×2 比例占优）——标注/提交/pad 同源、恒落渠道 16 对齐档。本轮实测 AUTO 标注 = 1536×1024。附带修：超域目标（>4096）回落域内最大档而非 null（提交恒有效）。
- [x] T4 比例切换巨量放大（3:2 大框翻 2:3 溢出屏幕）：resolveOutpaintPaddingForRatio 旧「外扩总量只增不减」恒锚横轴——翻转时巨量横向外扩被强行保留、纵轴按比例爆炸。重写为**最近合法解**：两个锚定候选（锚横反解纵 / 锚纵反解横，被解轴允许收缩负值回落最小合法框）按对数面积距离取近者，并列取外扩更大者（同比例重选保持原框）；方位保持（dL/dB 半和分配）不变，轴塌缩时偏移让位于最小合法框。单测：3283×2189 框翻 2:3 → 1536×2304（旧实现 3283×4924）。
- [x] T5 参数条重心偏左（实测 frame 中心 352 vs bar 内容中心 160）：bar 盒宽恒 640 且盒中心已精确居中，但内容行左对齐挤在左侧 250px → 视觉重心偏左。修 = w-max 自适应内容宽 + 内容行 flex-wrap + barRef ResizeObserver（选模型/档位改变行宽时重定位）。
- 验证：tsc/lint/build 三绿；全量 1847 tests / 1829 pass / 18 fail = 存量基线；几何 24 例全绿（新增翻转/并列/AUTO snap 4 例）；模拟人工验证（真实鼠标 + 逐帧采样 + 截图目视）：拖图域换算精确、角拖零跳变、AUTO 标注域内、+纹理 L 形区域完整铺满（放大目视复核，先前"锯齿缺口"疑点为 frame 外画布点阵区误判）。

## 用户终验反馈修复（2026-09-20 第十八轮，提交 39ce2c0c）

- [x] T1 「选 3:4 生成出 1:1」拆解为两个真 bug + 一个上游事实（全部实证）：
  - **真 bug A（占位节点比例错）**：snapOutpaintTargetSize 把 paddingPx 按 scaleX/scaleY 两轴混合缩放（preset 1024×1360 实比 0.7529≠精确 3:4 → 两轴系数不同），hook 把混合域 paddingPx 加在源图 1536×1024 上 → targetPixelSize 比例 0.90 → 占位节点近方形。修 = snap 不再改写 paddingPx（恒源图像素域），锁定档位时占位节点直接用 submitTarget 比例（fitNodeSize 全局 clamp，不再 clamp 源节点盒）。headless 实测占位 328×491 = 0.667（与 2:3 目标一致）。
  - **真 bug B（pad 构图与框不符）**：同一混合域 paddingPx 传入 padImageToDataUrl target 模式（该模式期望源像素域），k 单轴解出 → 图片被画在错误位置（用户框内图片贴底/顶部大扩区，提交的 pad 图图片悬中）。修 = target 模式两轴 k（kx/ky 分别解），吸收 preset 比例差；paddingPx 全链单一「源图像素域」语义。
  - **上游事实（非本链 bug）**：api_call_logs 实锤中转站正确收到 requested_size=1024x1360，但 flow=「upstream original size → original source」（QQ 机器人池直接回上游原始输出）——第一次 1024×1536（比例被改+黑块）、第二次 1088×1445（保比例）。前端/后端提交链均正确，尺寸不由我方决定。
- [x] T2 结果画幅偏差明示（AC 保障）：结果节点落图时比对「提交画幅 vs 实际出图」比例（log 距离 >2% 阈值），超差写 metadata.outpaintSizeMismatch 并在节点右上角显示红色角标「画幅偏差 · 提交 WxH / 实际 WxH」——上游改幅不再静默。resources 表 + result_json 双源验证：成功出图 1088×1445 与 1024×1360 比例偏差 0.00%（不误报）。
- [x] T3 回答「其它项目也只是靠简单的提示词，其它都没有了吗」：扩图链提交的不止提示词——pad 白底合成图（构图=框）+ 透明区 mask（maskSupported 模型）+ 显式 config.size（档位精确像素）+ 模型能力路由 + 质量域钳制 + 积分计价。出图内容质量依赖上游模型对 mask/白边的遵循度（impl/F-06.md 风险 1，二期做样本集验收）；尺寸则受中转/上游策略影响（本轮明示兜底）。
- 验证：几何 25 pass（paddingPx 语义用例更新）；全量 1830 pass / 18 fail = 存量基线；tsc/eslint/build 三绿；headless 全链（激活 → 2:3 重排 0.6667 → 提交 size=1024x1536 → 占位 0.667 → 失败态 405 为渠道无路由，与修复无关）；vite 重启新代码进产物（单一域 2 hit、双 k 3 hit、角标 4 hit）。环境记录：WSL 重启后 go run 需用缓存 toolchain（~/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.26.8/bin/go + GOTOOLCHAIN=local），GOSUMDB=off 阻止 toolchain 自动下载。

## 外部扩图实现调研（2026-09-20，用户问「其它项目如何保障效果」）

### 本地项目代码实读（一手）

| 项目 | 扩图实现 | 保障手段 | 缺口 |
| --- | --- | --- | --- |
| **Infinite-Canvas**（smart-canvas.js 18964 行） | 节点编辑器内 cropState 拖框（clampOutpaint 框≥原图）→ applyImageOutpaint 白底 canvas 合成（fillStyle #ffffff）→ 上传替换节点图 → outpaintSize 记录 → 提交时 customSize="WxH" | ① 框 clamp ≥ 原图；② 白底 pad 图锁定构图；③ 显式 customSize；④ 固定英文指令 "Remove white area and fill the scene" | 无 mask 通道、无多变体、无结果校验、无重试保障——与我们第十八轮前的 v1 同构 |
| **Tapnow-Studio-PP**（App.jsx 39978 行） | 无自研扩图——「拓展图片」= Midjourney 官方 Zoom Out（mj-zoom：imagine 提交 → 轮询 → /zoomout 按钮） | 依赖 MJ 官方扩散式重绘能力，比例固定、幅度档位固定（2x 等） | 全托管，无本地几何控制 |
| Node_Canvas / TapCanvas / og-canvas-flora-study | 无 outpaint 实现（TapCanvas 仅 MJ 反代 service） | — | — |

### 线上商业产品（UI 实证 + 官方页）

- **tapnow / libtv**（侦察报告 DOM 实证）：与 B 线同构的「原位外扩框 + 参数条」，提交参数未挖到；从 tapnow 系模型选择（gpt-image/nano banana 类）推断走 pad+指令/mask 路线。
- **flora**：「工具节点」范式（Outpainting 节点消费后消失，结果回填 emptyImageBlock）——架构不同，保障逻辑等价。
- **Adobe Generative Expand**（官方页 fetch 一手）：「extend beyond original edges, automatically generating new matching content, change aspect ratios」；Photoshop 内依托 Firefly + 裁剪框扩展。业界公认细节（二手，未逐字核实）：生成结果落**独立生成图层**（非破坏性）+ **每次三个变体**供选择 + 可改提示词重roll + 传统蒙版工具修边——「变体可选 + 非破坏可撤销 + 可修边」是它的翻车兜底。
- **Photoroom AI Expand**（F-06.md 一手核实定价页）：电商场景预设化（Resize/Expand 内含于订阅），主打「预设尺寸直达」而非自由拖框。

### 开源工程生态（stable-diffusion-art.com 一手 fetch；A1111 wiki JS 渲染抓不到正文）

A1111 outpainting 脚本的保障参数化，是最系统的工程参考：
1. **Pixels to expand 默认 128px**——单次外扩小步走，大画幅 = 多轮迭代（poor man's outpainting 脚本即分块多轮）；一次扩太多必然崩。
2. **Masked content = fill**——扩区先用图像平均色填充再生成（与我们白底 pad 同思路，平均色比纯白更不易被模型当背景）。
3. **Denoising strength 可调**——低强度保原图、高强度多生成；原像素区按 inpaint 语义保持。
4. **Mask blur（羽化）**——mask 边缘高斯过渡，接缝不硬。
5. 两条脚本（mk2 / poor man's）本质都是「pad→inpaint→（可循环）」。

### 对照 F-06 现状与二期方向

已具备：pad 合成图（构图锁定）、透明 mask 通道（gpt-image 系）、显式 size、和守恒比例重排、画幅偏差明示角标（十八轮）、白底程序化补边已覆盖（padImageToDataUrl fill 参数即程序化通道）。
可吸收的加固（二期候选，未排期）：
1. **多变体默认**（张数 x2/x3 起步）——Adobe/Canva 公认兜底，我们张数控件已支持，仅默认值问题；
2. **mask 羽化边缘**（padImageToDataUrl mask 模式加 2-4px 线性渐变带）——低成本降接缝风险；
3. **单次外扩幅度提示**（框外扩 >2x 原图面积时参数条提示分次扩图）——SD 生态共识「小步多次」；
4. **扩区平均色填充选项**（fill 参数从 #FFFFFF 扩展到 "average"）——比纯白更少被模型当背景；
5. **结果并排预览 + 一键重roll**（现状是结果节点上的重新生成按钮，已具备雏形）。

## 已知坑与停机条件

- 画布事件抢占若有 window 级捕获监听绕过 stopPropagation → 记任务卡停机问用户（design §10.1）。
- 环境实证失败（端口占用 / vite 回退 8080）→ 停机报告，不盲试三次以上。
