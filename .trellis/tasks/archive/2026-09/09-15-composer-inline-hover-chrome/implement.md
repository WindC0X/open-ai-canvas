# Implement：composer 归属节点（方案 C）

> 分片顺序 S1→S4，每片独立 commit + 验证门。禁子代理（用户 2026-09-14 指令），主会话直接实现。

## S1 节点内 hover 信息态 composer
- [x] `canvas-node.tsx` 内部底部 overlay 新组件：只读提示词（flora `max-h-[4.5rem]` + `overflow-auto` 内部滚动，`0_di9:7653`）+ 引用横滚行（`overflow-x-auto overflow-y-hidden`、负 margin 扩域、`pointer-events-none`/子项 auto、`nowheel`、滚动条隐藏、mask 渐隐边缘，`0_di9:7893/17210`）；**零按钮**。
- [x] 动画：flora 双层 200ms `cubic-bezier(0,0.8,0.1,1)`——外层 opacity、内层 `translate-y-[calc(100%+1px)] ↔ 0`；退场播完再卸载（delayedVisibility 同构）。
- [x] 显隐：`isHovered && !selected && !generating && !batchExpanded`；触屏（无 hover）隐藏。
- [x] props 下发：世界层从 `mentionReferencesByNodeId` + `metadata.prompt` 组装（与 isHovered 同路径，保持 memo）。
- [x] 验证：tsc 0 + canvas-node 相关单测 + build；DOM 断言 rect ⊆ 节点 rect。
- commit: `feat(canvas): 节点内 hover 信息态 composer - 纯信息零按钮, flora坠落动画`

## S2 selected 挂件化定位（方案 C）
- [x] `CanvasNodePanelOverlay` 定位：节点底部正下方锚定（gap 0~1px）、宽度=节点宽、外形顶角直/底角圆；入场动画初始 transform=信息态位置，200ms 曲线坠落+展开。
- [x] 退役外部微浮现双实例：project.tsx hoverPanelNode 分支 + AffordanceSurface composer micro（selected full 常驻改挂件挂载）。
- [x] 参数气泡/发送/count popover 在挂件位置的全链回归（弹出方向校验）。
- [x] 验证：tsc + build + hover→selected 动画连续性 DOM 探针。
- commit: `feat(canvas): composer挂件化 - 面板底部锚定坠落展开, 外部微浮现退役`

## S3 供给面退役与归属简化
- [x] 退役：sense band（canvas-workspace-overlays）、composer 类 supply 标记与 `collectSupplyHits` composer 分支、affordance composer micro 层（toolbar 链保留）。
- [x] 测试更新：hover-attribution / affordance / 9 格场景中 composer 项；新增节点内信息态断言。
- [x] 验证：全量 canvas 相关单测 + build。
- commit: `refactor(canvas): composer供给面退役 - 归属回落节点, 工具栏链保留`

## S4 真机验收 + 文档
- [x] A1 用户截图场景复现（上下节点穿透选中）；A2 rect ⊆ 节点；A3 挂件全链；A4 batch/播放/加载共存；A5 明暗/reduced-motion/触屏；A6 回归（工具栏微供给、issue-1 防御、attribution 测试）。
- [x] pending-test.mdx + handoff/状态文件同步。
- commit: `docs(progress): composer归属节点真机验收`
