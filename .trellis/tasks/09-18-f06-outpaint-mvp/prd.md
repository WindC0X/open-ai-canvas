# F-06 扩图 MVP：画布内聚焦外扩框 + 参数条

## Goal

B 线 Wave1 试点：选中图片节点后，在画布内叠加可向外拖拽的目标画幅外扩框（四角圆点 + 四边胶囊手柄 + 三分网格 + 实时尺寸标注），框下停靠参数条（模型 / 比例 / 分辨率 / 张数 / 执行），全程无 Modal。提交链复用现成图片编辑任务（按模型能力双协议路由：mask 通道 / 指令通道），`padImageToDataUrl` 在白底补边与 mask 生成两个场景复用。后端零改动。

双重试点价值：① 验证 worktree 分枝 → 自测 → 降级门合入全流程；② 立"去对话框化"UI 范式标杆——后续 F-02 / F-07 / F-08 的画布内交互全部跟随此形态（用户裁定 2026-09-18）。

## Requirements

### R1 交互形态（用户已裁定，禁止做成对话框 / Modal）

- 选中图片节点后，工具栏触发扩图：原图上叠加外扩框，四角圆点 + 四边胶囊手柄（8 手柄），框内三分网格，框边实时尺寸标注（目标像素）。
- 参数条停靠外扩框下方，控件谱系与顺序：✕ 关闭 / 比例 / 引导文案 / 分辨率档 / 张数 / 模型 / 积分预估 / 执行。
- 积分预估为真实计价（用户裁定 2026-09-18）：本地价（`requestCreditCost`）+ 远端报价（`quoteLogicalModel`）× 张数，`creditsEnabled=false` 时隐藏；复用 prompt-panel / model-picker 现成模式，不新接账务接口。
- 引导文案内嵌（参照 tapnow"拖拽外框进行扩图"），零学习成本。
- 关闭机制只留一条：✕（不绑定 Esc、不做点击外部关闭）。

### R2 双层坐标架构（侦察报告核心结论）

- 外扩框：世界空间，随画布缩放平移，不脱离原图节点。
- 参数条：屏幕空间画布级覆盖层（`absolute inset-0 z-10 pointer-events-none`，子元素 `pointer-events-auto`），恒定像素宽，禁止放世界层（否则缩放时字忽大忽小）。

### R3 几何纪律

- 外扩框几何走 DOM 实测驱动（ResizeObserver / MutationObserver，参照挂件锚定系统 `canvas-workspace-overlays.tsx`），禁读 viewport React prop（1f5cacfb 教训）。
- 外扩框不小于原图（clamp 语义，参照 Infinite-Canvas `clampOutpaint`：`w = Math.max(原图 w, 框 w)`，四边 padding ≥ 0）。
- 比例选择后拖拽保持比例约束；实时尺寸标注显示 pad 后目标像素。

### R4 事件纪律

- 手柄 pointerdown 必须 `stopPropagation`（tapnow `nodrag/nopan` 语义的规范目标 = 拖手柄不触发画布平移 / 选区 / 缩放）。
- 参数条区域整体豁免画布手势（滚轮 / 拖拽），沿用 `data-canvas-no-zoom` / `data-canvas-wheel-scroll` 边界约定。
- 动画走 inline transition（cc383e14 教训：后台节流下 CSS animation 不播放）。
- 玻璃模糊只许用在参数条局部（`bg/90 + backdrop-blur` 量级），禁全屏 backdrop、禁 portal、禁全屏遮罩。

### R5 提交链（后端零改动）

- mask 极性（用户裁定 2026-09-18）：**透明区 = 扩图生成区**——`padImageToDataUrl` 以 `fill:"transparent"` 产出「原图区域不透明（保留）、新增区域透明（生成）」的 mask。

- `web/src/lib/canvas/canvas-image-data.ts` 新增 `padImageToDataUrl`：把原图按四边 padding 合成到目标画幅。白底补边（fill `#FFFFFF`）与 mask 生成（fill transparent）复用同一函数。
- `web/src/pages/canvas/use-canvas-media-tools.ts` 新增 `outpaintImageNode`（照 `maskEditImageNode` 骨架）：
  - 跳过 maskSupported 硬校验；**只要求 `references.maxImages >= 1`**（至少可提交参考图）。
  - 模型能力双协议路由：`maskSupported=true` → pad 底图 + 新增区 mask 走 mask 任务链；`maskSupported=false` → pad 底图 + 固定指令，靠模型自行延展。
  - 固定提示词模板（向外延展 / 保持主体 / 仅填新增区域）+ 用户追加说明。
- 结果生成照 maskEdit 的 root/child 批量结构，连回原节点，走现成 `runBackendCanvasGenerationTask`。

### R6 模型能力与红线

- 模型不支持 edit（`references.maxImages === 0`）时参数条**明示并禁用执行**（红线，不允许静默失败）。
- FLUX.1-Fill-dev 权重非商用（官方模型卡一手）：自部署路线只能 schnell / klein；本任务不引入任何自部署权重。
- 第一版纪律：只做外扩框 + 参数条，不加任何花样（不加预设组、不加场景路由、不加程序化补边独立通道 UI）。

### R7 接线面（4 个共享文件，注意合并成本）

`canvas-project-media-dialogs.tsx` / `canvas-image-toolbar-tools.tsx` / `canvas-node-toolbar.tsx` / `project.tsx`。

### R8 样式纪律

- 新增 UI 一律走三层令牌（Primitive → Semantic → Component），**不改 `globals.css`**（热区归 A 线），组件样式写在组件文件或新 CSS 文件。
- 确需新令牌：登记进本任务卡，不动 globals。

## Constraints

- 活动范围仅本 worktree（`oac-wt-f06`，分支 `feat/ecom-f06-outpaint`）；主 checkout `../open-ai-canvas` 只读。
- 共享 GLM 路由并发 ≤2；范围锁死 F-06，不顺手做别的功能。
- 合入不在本会话权限内：枝完成后自测 + 报告，合入时机由用户决定、动作在 main checkout 执行（testing M1 未就绪，合入走降级门：`bun test` 同盘基线对照 + 真机冒烟）。
- 遇到任务卡没覆盖的坑（尤其画布事件抢占）：记进任务卡并停下来问用户，不自行扩大改动面。
- 完成声明必须带证据：`bun test` 全绿 + 真机操作截图 / 录屏（CDP 合成事件不算验收证据）。

## Acceptance Criteria

- [ ] AC1：选中图片节点 → 工具栏触发扩图 → 外扩框出现在原图上（8 手柄 + 三分网格 + 尺寸标注），画布缩放 / 平移时框跟随不变形；参数条恒定像素宽、跟随框底、不随缩放变形。
- [ ] AC2：拖拽四边 / 四角手柄能改变框大小且不触发画布平移 / 选区；框不可小于原图（clamp 生效）；切换比例后有比例约束。
- [ ] AC3：✕ 关闭后覆盖层与状态完全清理；节点删除 / 切换选中时覆盖层同步消失，无残留。
- [ ] AC4：模型能力正确路由——`maxImages>=1` 可执行；`maxImages=0` 参数条明示禁用；`maskSupported=true` 时提交带 mask（透明=扩图区），`false` 不带宽 mask。
- [ ] AC5：执行生成 → 后端返回 pad 画幅结果图（尺寸 = 目标像素），新节点连回原节点；批量（张数 >1）结构正常。
- [ ] AC5b：积分预估槽位——`creditsEnabled=true` 时显示 `<CreditSymbol/> 价格`，本地价随模型/张数变化，远端报价可达时以报价 × 张数为准；`creditsEnabled=false` 整块隐藏。
- [ ] AC6：`bun test` 全绿（新增几何纯函数测试 + 现有测试无回归）；真机操作截图 / 录屏证明 AC1–AC5。
- [ ] AC7：`git diff` 不含 `globals.css` 改动；无新增依赖。

## Notes

- 侦察报告（实现前逐条对照）：`/mnt/f/CODE/Project/canvas/analysis-2026-09-12/ecom-design/f06-outpaint-ui-recon.md`
- 技术路线全文：`/mnt/f/CODE/Project/canvas/analysis-2026-09-12/ecom-design/impl/F-06.md`
- 用户裁定（2026-09-18）：① 参数条积分槽位为真实计价组件（复用 `requestCreditCost` + `quoteLogicalModel` + `CreditSymbol` 现成链路）；② mask 极性 = 透明区即扩图生成区。
