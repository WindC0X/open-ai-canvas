# PRD · 节点工具栏与 Composer 微供给质感化

## 背景

节点悬浮工具栏（`canvas-node-toolbar.tsx`，611 行，dock 风格）与 composer（`canvas-node-prompt-panel.tsx`）是画布节点的高频交互面，二者尚未接入 flora 质感与状态语法：

1. **质感**：工具栏为 dock 材质（`--dock-surface` + `elevation-overlay` 阴影 + `dock-radius-tight` h-11），与已统一的 flora 玻璃材质族（模型菜单/参数面板：glass + radius 16 + 无阴影）不一致。
2. **生命周期**：显隐由 `project.tsx` 的手工状态机驱动（`toolbarNodeId` + 220ms hide timer + 多重 guard：dragging/设置气泡开/框选/对话节点），状态散落、语义不成体系。
3. **原语闲置**：`primitives/hover-toolbar.tsx`（四态 persistence 语义）已写好但零接线。

## 用户拍板的状态机契约（2026-09-12）

| 状态 | 工具栏 | Composer |
|---|---|---|
| idle（未 hover 未选中） | 不显示 | 不显示 |
| hover 节点 | **微形态**（降不透明度/饱和度） | **微形态** |
| hover 到工具栏 | **全显**（渐显不变形） | 保持微 |
| hover 到 composer | 保持微 | **全显** |
| selected | **全显**（常驻，鼠标离开不收） | **全显**（常驻） |

- 微→全显过渡：**渐显不变形**——只动 opacity/blur（合成器属性），不打动尺寸/布局；可打断；`prefers-reduced-motion` 降级为直接切换。
- 微供给语义：工具栏与 composer 是**两个独立的微供给**，hover 目标决定哪个全显，互不抢占。

## 约束

1. **替换而非叠加**（09-03 revert 教训，DESIGN.md 归属面去重纪律）：微供给状态机替换现有 `toolbarNodeId` + timer 状态机；动作归属维持现状（工具栏/右键菜单/composer 各自职责不重排——动作重排属于独立归属面决策，不在本任务）。
2. 上游功能保全：`tool-registry`（resolveToolbarTools）的工具集、相机控制、拖拽/框选 guard 语义全部保留。
3. issue-1 防线不回退：composer `key={panelNode.id}` 强重建、rc-motion 过渡态禁交互、`flyoutPointerRef` 拦截等已落地防线不动。
4. 质感令牌从现有 flora 族取（模型菜单/参数面板同源玻璃值），不新增第三套材质。
5. 键盘可达性：微形态不剥夺焦点可达（focus-visible 时按全显处理）。

## 验收标准

1. 状态机逐格真机验证：idle/hover 节点/hover 工具栏/hover composer/selected/selected 后鼠标离开/dragging/设置气泡开/框选中——每格工具栏与 composer 的存在感与状态表一致。
2. 质感：明暗两主题下工具栏玻璃材质与参数面板同族（computed style 对照），无阴影、radius 一致。
3. 微→全显只动 opacity/blur（getComputedStyle 断言 width/height/transform 不变）。
4. reduced-motion 下无过渡直接切换。
5. 回归面：图片/视频/音频/文本/绘图节点 + 相机控制 + 全屏 composer + mask-edit-dialog 等消费方不破。
