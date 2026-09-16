# Design：composer 归属节点——hover 信息态 + selected 底部挂件式

> 2026-09-15 v2（用户澄清后重写，推翻 v1 的「选中态保留浮出面板」）。
> 用户定稿原话要点：照 flora 节点内 composer 设计，只去掉底部的「发送/@/#/滑块/箭头」；引用缩略行不上限、溢出为滚动行；提示词全文非截断；hover 微供给 + hover 到 composer 全显机制不变；hover 展开/关闭动画用 flora 动画、与工具栏节奏一致；hover→selected 时节点内 composer **向下坠落同时展开**为完整**底部挂件式** composer。

## 一、交互模型（三态）

```
idle          hover 未选中              hover 到 composer     selected
┌──────┐     ┌──────────────┐         (同左，全亮)        ┌──────────────┐
│ 节点  │     │ 节点          │                             │ 节点          │
│      │     │ ············· │ ← 微亮信息态                │ ············· │
└──────┘     │ 提示词全文     │   (opacity+坠落位)          │ ············· │
             │ [▢▢▢▢▢▢→滚动] │                             └──────┬───────┘
             └──────────────┘                                    ▼ 坠落+展开
                                                    ┌────────────────────┐
                                                    │ 完整挂件 composer    │
                                                    │ 提示词·引用·参数·发送 │
                                                    └────────────────────┘
```

1. **hover 微态**：节点内底部 composer 显现，**微亮**（AffordanceSurface micro 语义，0.45 opacity），内容=纯信息态。
2. **hover 到 composer 本体**：全显（micro→full 既有微供给机制，**不变**）。全显仍为信息态（节点内 composer 永无按钮——按钮只在 selected 挂件态）。
3. **selected 挂件（方案 C，用户 09-15 批准）**：**复用 `CanvasNodePromptPanel` 组件本体 100% 不动**，只改两处：① 定位挂件化——`CanvasNodePanelOverlay` 的锚定从节点上方改为**节点底部正下方、宽度=节点宽度、顶角取直/底角圆**（视觉挂件，DOM 仍在 world layer 不迁入节点，规避 z-index/裁剪问题）；② 入场动画——初始 transform 对齐节点内信息态位置，flora 200ms 曲线**坠落+展开**，视觉连续。参数气泡/发送/count popover 零迁移。

## 二、信息态内容构成（照 flora，仅去按钮）

| 区块 | flora 证据 | 影策实现 |
|---|---|---|
| 提示词 | PromptMentionEditor 全文（`0_di9:7410`，`resize-none bg-transparent text-text-1`） | 只读文本全文展示（信息态不编辑；编辑在 selected 挂件） |
| 引用缩略行 | `-mx-4 -my-20 overflow-x-auto overflow-y-hidden px-4 py-20 pointer-events-none [&>*]:pointer-events-auto` + `nowheel`（`0_di9:7643/7903/12624`）；`mask-fade-x` 渐隐边缘 + 滚动条隐藏（`0_di9:17210`） | 横向滚动、**不设上限**、渐隐边缘、隐藏滚动条、滚轮不冒泡画布 |
| 按钮 | flora 有 ↑发送/@/#/滑块 | **全部去掉**（用户裁剪） |

类型差异：Image/Video=引用图/视频首帧缩略；Audio=音频 chip（波形/名称）；Text=引用缩略；Config=composerContent。

## 三、动画（flora 证据原样）

flora `NodeControlSurface`（`0_di9:8121/7926` 区段）：
- 双层：外层 `transition-[padding,opacity] duration-200 ease-[cubic-bezier(0,0.8,0.1,1)]`（隐藏 `opacity-0` + `pointer-events-none`）；内层 `transition-transform duration-200 ease-[cubic-bezier(0,0.8,0.1,1)]`（隐藏 `translate-y-[calc(100%+8px)]` → 显示 `translate-y-0`）。
- 卸载：`useDelayedVisibility` + `SURFACE_UNMOUNT_DELAY_MS`——退场动画播完再卸载。
- **影响策**：曲线/双层结构/坠落方向照搬（200ms `cubic-bezier(0,0.8,0.1,1)`），时长与工具栏 `--motion-dur-fast`(150ms) 同族节奏——统一取 200ms 为挂件/信息态动画 token（工具栏维持 150ms 不动，或后续统一，不在此任务扩scope）；reduced-motion 直切。坠落方向天然朝节点下方→不遮挡节点上邻；**selected 挂件遮挡下邻是有意行为**（选中即编辑，指针预期在挂件上），与 hover 信息态（零越界）不矛盾——hover 态永远不出节点边界。

## 四、结构迁移

1. **节点内信息态 composer**（新）：`canvas-node.tsx` 内部底部 overlay（inset-x-0 bottom-0），props 下发 prompt/references（世界层组装，同 isHovered 路径）；`pointer-events` 按层控制（行内 pe:none + 子项 pe:auto，照 flora 负 margin 模式）；显隐=affordance level（micro/full），selected/生成中/batch 展开隐藏。
2. **selected 挂件 composer**（复用面板本体，挂件化定位）：`CanvasNodePanelOverlay` 保留挂载点，定位逻辑改为节点底部锚定（宽=节点宽，待实现时按内容最小宽校准）；入场动画对齐信息态位置坠落展开；参数气泡弹出方向随挂件位置校验。
3. **退役**：外部微浮现双实例（project.tsx hoverPanelNode + AffordanceSurface composer 分支）、sense band、composer 类 supply。**不退役**：`CanvasNodePanelOverlay`（保留为挂件挂载点，仅定位/动画挂件化）、issue-1 幽灵层防御（key 重建、pointer-events ghost 防御、flyoutPointer）。
4. **保留**：toolbar 微供给全链、AffordanceSurface 原语、issue-1 幽灵层防御（key 重建、pointer-events ghost 防御、flyoutPointer）。

## 五、风险与边界

- 挂件与 BatchFrame/batch 子列、视频播放态、加载态的共存：挂件展开时 batch 展开视图/播放控制不重叠（挂件从底部向下，BatchFrame 徽章在顶部）。
- 触屏：无 hover——信息态由选中直达（触屏 selected 挂件照常）；信息态对触屏隐藏。
- 现有 `isPanelCarrier` 类型范围照旧；audioGenerationCount/videoGenerationCount 引用计数语义不变。

## 六、验收（对齐 PRD A1-A6）

A1 用户截图场景：hover 信息态 rect ⊆ 节点 rect（零越界）；A2 micro→full 升级在节点内完成；A3 selected 坠落展开挂件可用、参数气泡/发送全链通；A4 batch/播放/加载共存；A5 明暗/reduced-motion/触屏；A6 attribution 供给面裁剪后测试更新全绿 + 工具栏回归。
