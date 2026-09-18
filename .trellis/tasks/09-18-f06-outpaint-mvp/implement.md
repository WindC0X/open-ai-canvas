# F-06 扩图 MVP 执行计划

> 前置：本计划按 design.md 执行。每个提交点小步提交到 `feat/ecom-f06-outpaint`；主 checkout 只读。
> 验证命令统一在 `web/` 下执行：`bun test <file>`（专项）、`bun test`（全量）、`bun run build`（收口）。

## Step 0：M0 前置核对（2026-09-18 完成，无 design 冲突）

- [x] 0.1 mask 极性：`buildEditMask`（canvas-node-mask-edit-dialog.tsx:310）产出 = 白底不透明全铺 + 涂抹区 alpha→0（透明）；即现行语义 **透明=要生成**，与用户裁定一致。`provider_protocol.go:264-267` 仅规范化 `role:"mask"`，无极性反转；openai-images 合同（mask 透明区=编辑区）端到端同向。结论：`padImageToDataUrl(fill:"transparent")` 直接产出「原图区不透明、新增区透明」无需转换。
- [x] 0.2 DOM 结构：节点元素选择器 `[data-node-id="{id}"]`；世界层 `[data-canvas-world-layer], .canvas-world-layer`；挂件对 worldLayer 挂 `MutationObserver(attributes:["style"], subtree:true)` 捕捉拖拽预览（canvas-workspace-overlays.tsx:159-188）；`data-canvas-no-zoom`/`data-canvas-wheel-scroll` 约定在多个画布组件在用。外扩框挂载父级 = 画布容器内节点锚定（实现时按 overflow 裁剪边界定）。
- [x] 0.3 `maxImages: 0` = `grok-imagine-image` 前缀模型（model-capabilities.ts:268-269，grok-image 协议除外）→ 即参数条明示禁用的对象。
- [x] 0.4 `canvas-live-viewport.ts`：`subscribeCanvasViewportPreview(container, listener)`（CustomEvent detail = ViewportTransform，返回退订函数）；`subscribeCanvasNodeDragPreview` 同款；实时 scale 通道可用。

## Step 1：几何纯函数（提交 1：`feat(canvas): 扩图几何纯函数`）

- [ ] 1.1 新建 `web/src/lib/canvas/canvas-outpaint-geometry.ts`：`resolveOutpaintPadding` / `resolveOutpaintTargetPx` / `describeOutpaintSize`（design §7）。
- [ ] 1.2 新建 `web/test/canvas-outpaint-geometry.test.ts`：clamp 边界（每边 ≥0）、ratio 约束往返、4096 长边 clamp、scale 换算一致性。
- [ ] 1.3 验证：`bun test canvas-outpaint-geometry`。
- 回滚点：纯新增文件，revert 单提交即可。

## Step 2：padImageToDataUrl（提交 2：`feat(canvas): padImageToDataUrl 补边合成`）

- [ ] 2.1 `canvas-image-data.ts` 加 `ImagePadRect` + `padImageToDataUrl`（design §5，复用文件内 loadImage）。
- [ ] 2.2 视现有 canvas 测试 mock 先例（`canvas-media-download.test.ts`）补 1–2 个用例；无先例 mock 则以 1.2 几何测试 + Step 6 真机为准并在交付说明标注。
- [ ] 2.3 验证：`bun test canvas-image-data`（若有）+ `bun test` 全量无回归。

## Step 3：提交链（提交 3：`feat(canvas): outpaintImageNode 扩图提交链`）

- [ ] 3.1 `use-canvas-media-tools.ts`：`outpaintNodeId` state + `setOutpaintNodeId` + 返回值导出（:114/:978 模式）。
- [ ] 3.2 `outpaintImageNode` 照 maskEditImageNode 骨架：能力校验换 `maxImages>=1`、双协议路由（mask 带与不带）、固定提示词模板、root/child 批量、结果落节点（design §6）。
- [ ] 3.3 验证：`bun test` 全量；`bun run build` 类型通过。

## Step 4：覆盖层组件（提交 4：`feat(canvas): 画布内扩图外扩框与参数条`）

- [ ] 4.1 新建 `canvas-node-outpaint-overlay.tsx`：导出 `CanvasImageOutpaintPayload` + `CanvasNodeOutpaintOverlay`。
- [ ] 4.2 世界层外扩框：8 手柄（pointerdown stopPropagation + pointer capture）、三分网格、尺寸标注、clamp、比例约束（geometry 纯函数驱动）。
- [ ] 4.3 屏幕层参数条：✕ / 比例 / 引导文案 / 分辨率 / 张数 / 模型 / 积分预估 / 执行；`pointer-events-none` 容器 + `pointer-events-auto` 子元素；`data-canvas-no-zoom` + `data-canvas-wheel-scroll`；玻璃仅参数条局部；inline transition。积分槽位照 prompt-panel :137-207 模式：`requestCreditCost` 本地价 + `quoteLogicalModel` 远端报价（AbortController）× 张数 + `<CreditSymbol/>`；`creditsEnabled=false` 隐藏整块。
- [ ] 4.4 DOM 实测接线：RO/MO 循环（参照 `canvas-workspace-overlays.tsx:55-60/172-196`）；`maxImages=0` 明示禁用执行。
- [ ] 4.5 样式三层令牌自查：无 globals.css 改动、无字面值散落（`git diff --stat` 核对）。

## Step 5：接线面（提交 5：`feat(canvas): 扩图工具入口接线`）

- [ ] 5.1 `canvas-image-toolbar-tools.tsx`：outpaint 工具定义（"构图与尺寸" group process、order 15）+ handler。
- [ ] 5.2 `canvas-project-media-dialogs.tsx`：outpaintNodeId 激活时挂 overlay；onClose 清理。
- [ ] 5.3 `project.tsx`：state 透传 + `onOutpaint` + payload 回调（照 maskEdit :923/:3405 模式）。
- [ ] 5.4 `canvas-node-toolbar.tsx`：实现时核实是否需同步（group 渲染兼容），预期小改或零改。
- [ ] 5.5 验证：`bun test` 全量 + `bun run build`。

## Step 6：真机验证（用户检查点，需用户在场）

- [ ] 6.1 启动环境（查端口占用后）：backend `CANVAS_BACKEND_ADDR=:8181 CANVAS_BACKEND_DATA_DIR=../.local/f06-wt-debug go run ./cmd/server`；web `VITE_API_PROXY_TARGET=http://127.0.0.1:8181 bunx vite --host 0.0.0.0 --port 3001`；实证 curl 透传 + :3001 可开（vite.config.ts:10 静默回退坑，必须实测）。
- [ ] 6.2 冒烟清单：AC1–AC7 + AC5b 逐条过（外扩框跟随缩放平移 / 手柄拖拽不触发画布平移 / clamp / 比例约束 / ✕ 清理 / 能力禁用明示 / 提交出图 / 结果节点连线 / 积分随模型与张数变化且报价失败回落本地价）；截图或录屏留证（CDP 合成事件不算）。
- [ ] 6.3 明暗主题、缩放极端（很小/很大）、长图与方图各一轮。

## Step 7：文档同步 + 收口（提交 6：`docs(canvas): F-06 扩图 MVP 文档`）

- [ ] 7.1 `docs/content/docs/overview/features.mdx` 增 F-06 条目。
- [ ] 7.2 `docs/content/docs/backend/code-map.mdx` 如涉及前端地图则补（后端零改动不触发表文档）。
- [ ] 7.3 `docs/content/docs/progress/pending-test.mdx` 登记"已实现待用户确认"条目。
- [ ] 7.4 最终验证：`bun test` 全绿 + `bun run build`；git log 小步提交链完整。

## Review Gate

- Step 0 后：核对结论若有与 design 冲突 → 回 design.md 修订再继续。
- Step 5 后：dispatch trellis-check 或自检（spec 合规 / 类型 / 测试 / 数据流）。
- Step 6 前后：合入降级门材料（测试证据 + 截图）交付用户；合入动作由用户在 main checkout 执行。

## 已定裁定（2026-09-18 用户）

- 积分槽位 = 真实计价组件（requestCreditCost + quoteLogicalModel + CreditSymbol，creditsEnabled 门控）。
- mask 极性 = 透明区即扩图生成区。

## 已知坑与停机条件

- 画布事件抢占若有 window 级捕获监听绕过 stopPropagation → 记任务卡停机问用户（design §10.1）。
- 环境实证失败（端口占用 / vite 回退 8080）→ 停机报告，不盲试三次以上。
