# Design · 节点工具栏与 Composer 微供给质感化

## 1. 状态机（唯一权威）

```
                    ┌─────────────────────────────────────────────┐
                    │ deriveAffordance(nodeId): "hidden"|"micro"|"full" │
                    └─────────────────────────────────────────────┘
输入(全部已存在,无新事件源):
  hoveredNodeId        — project 层已有(use-canvas-selection-controller 维护)
  dialogNodeId         — project 层已有(selected → composer 打开)
  toolbarHover         — 新增: 工具栏容器 onMouseEnter/Leave(局部布尔)
  composerHover        — 新增: composer 容器 onMouseEnter/Leave(局部布尔)
抑制 guard(任一为真 → 强制 hidden):
  nodeDraggingRef / selectionBox / nodeImageSettingsOpen / 对话节点(dialogNodeId
  非 composer 承载类型时工具栏照旧 guard) / readOnly

推导(纯函数,放 lib/canvas/affordance.ts,可单测):
  selected            = dialogNodeId === nodeId
  hovered             = hoveredNodeId === nodeId
  if (guard)                          → "hidden"
  if (selected)                       → "full"                 // 选中即全显,常驻
  if (!hovered)                       → "hidden"               // idle 不显示
  if (toolbarHover || composerHover)  → 对应供给 "full",另一个 "micro"
  else                                → 双供给 "micro"          // hover 节点=双微
```

状态分两份计算：工具栏态与 composer 态（二者在同一 hover 事件下可不同级）。

## 2. 原语改造（替换而非叠加）

`primitives/hover-toolbar.tsx` 改造为微供给容器 `AffordanceSurface`：

- props: `level: "hidden" | "micro" | "full"` + `children`（去掉旧四态 persistence/anchor 自定位——定位仍由调用方负责，与现状一致）。
- 渲染：常挂载（不卸载，保住 Dropdown/Tooltip 内部状态），`level` 驱动样式：
  - hidden → `opacity: 0; pointer-events: none`
  - micro → `opacity: 0.45; filter: saturate(0.8)`（数值进 canvas-theme 令牌）
  - full → `opacity: 1; filter: none`
- 过渡只动 `opacity/filter`（合成器属性，可打断），220ms `var(--motion-dur-normal)`；`prefers-reduced-motion: reduce` 时 transition: none。
- pointer-events：micro 态保持可交互（hover 到它本身即升级 full——这正是微供给的入山路径），hidden 态关闭。
- 旧四态 export 删除（原语无其他消费方，/dev/primitives 同步更新）。

## 3. 接线点（project.tsx）

- 工具栏容器（`CanvasNodeToolbar` 外层）与 composer 容器（`renderCanvasNodePanel` 产物外层）各包 `AffordanceSurface`，onMouseEnter/Leave 写 `toolbarHover`/`composerHover`。
- **删除**：`toolbarHideTimerRef`、`keepNodeToolbar`/`hideNodeToolbar` 的 timer 逻辑（guard 判断并入 deriveAffordance 的 guard 输入）；`CanvasNodeToolbar` 内部的 visible/opacity-0 自理逻辑同步收敛。
- composer 的 `key={panelNode.id}` 强重建、`nodeImageSettingsOpen` 联动等 issue-1 防线全部保留（guard 只是让 level→hidden，不改卸载语义）。

## 4. 质感（工具栏玻璃化）

- `canvas-node-toolbar.tsx` 容器样式从 `canvasDockStyle`（--dock-surface + elevation-overlay 阴影）切换到 flora 玻璃族令牌：暗 `rgba(32,32,32,.9)` / 亮 `rgba(255,255,255,.94)`，`backdrop-blur(16px)`，radius 16，**无 box-shadow**，border `rgba(255,255,255,.05)` / `rgba(15,23,42,.08)`——与 `.canvas-model-picker-popover` / 四参数面板同一来源（globals.css 玻璃块扩展一个 `.canvas-node-toolbar` 选择器，不新增第三套值）。
- 内部按钮的 antd 皮（ghost/hover）沿用 composer 底栏已验证的 `.canvas-node-composer-settings-trigger` 模式（unlayered !important 覆盖），不在本任务新造按钮语义。
- composer 质感已达标（708e0b0/bc631bb 批），不动。

## 5. 切片与验证顺序

1. affordance 纯函数 + 单测（状态表全格覆盖）。
2. 原语改造 + /dev/primitives 更新。
3. 工具栏接线 + 质感玻璃化（明暗 computed style 对照）。
4. composer 接线（复用同一状态机输出）。
5. 删除旧 timer 状态机 + 回归（图片/视频/音频/文本/绘图/相机/全屏 composer/mask-edit-dialog）。
6. 真机逐格验收（PRD 状态表 9 格）+ pending-test.mdx 登记。

## 6. 风险与回退

- revert 教训（09-03）：本任务不新增第二套动作面——工具栏职责/动作集合不变，只换状态机与皮；HUD 不动。
- antd Dropdown 在 opacity 容器内的 portal 定位已由现有 `.canvas-dock-*` 验证，容器从 dock 换玻璃不改变 portal 结构。
- 回退点：每切片独立 commit；状态机纯函数 + 原语 + 两侧接线可分别 revert。
