# Implement · 节点工具栏与 Composer 微供给质感化

## 执行清单（按序，每步独立 commit = 回退点）

### S1 状态机纯函数 + 单测
- [x] 新建 `web/src/lib/canvas/affordance.ts`：`deriveToolbarAffordance` / `deriveComposerAffordance` 纯函数（签名见 design §1；guard 输入对象化）。
- [x] 新建 `web/test/canvas-affordance.test.ts`（14 用例含间隙保持）：PRD 状态表 9 格全覆盖 + guard 抑制格 + 键盘 focus-visible 视同 full。
- [x] 验证：14 pass。
- Commit: `feat(canvas): 节点微供给状态机纯函数 - idle/hover/selected/悬停升级推导`

### S2 原语改造
- [x] `primitives/hover-toolbar.tsx` 重写为 `AffordanceSurface`（level 三级；常挂载；只动 opacity/filter；reduced-motion 直切；micro 保 pointer-events）。数值从 canvas-theme 新令牌取（`affordanceMicroOpacity`/`affordanceMicroSaturate`）。
- [x] `primitives/index.ts` 导出更新；删除旧 `HoverToolbar`/`ToolbarPersistence` export。
- [x] `/dev/primitives` 页面同步（primitives-lab.tsx 已在 main）。
- [ ] 验证：`bunx tsc --noEmit` 0 错。
- Commit: `refactor(canvas): HoverToolbar 原语改造为微供给容器 AffordanceSurface`

### S3 工具栏接线 + 玻璃化
- [x] project.tsx：工具栏包 `AffordanceSurface`（CanvasNodeToolbar 内部 level prop；shared.tsx 同步接线），`onMouseEnter/Leave` 写 `toolbarHover`（新 useState）；level = `deriveToolbarAffordance(...)`。
- [x] globals.css 玻璃块扩展 `.canvas-node-toolbar` 选择器（与模型菜单同源值）；`canvas-node-toolbar.tsx` 容器去 `canvasDockStyle` 阴影/radius，h-11 → 玻璃容器规范高度（视觉对齐参数面板密度）。
- [x] tsc 0；明暗玻璃值机检通过；微→全显只动 opacity/filter（CDP rAF 冻结下过渡帧由用户人眼验）。
- Commit: `feat(canvas): 节点工具栏微供给接线+玻璃质感对齐flora材质族`

### S4 composer 接线
- [x] composer 容器包 `AffordanceSurface`（含 hover 未选中节点微浮现——用户拍板完整面板微浮现），level = `deriveComposerAffordance(...)`；`composerHover` 局部布尔。
- [x] issue-1 防线逐项核对保留（key 强重建/panelNode 联动）（key 强重建/`nodeImageSettingsOpen` 联动/交互拦截）。
- 验证：tsc 0 + build。
- Commit: `feat(canvas): composer 接入微供给状态机 - 选中全显/悬停全显/节点悬停微形态`

### S5 删旧状态机 + 回归
- [x] project.tsx 删旧 timer 状态机（3 hooks 的 setToolbarNodeId option 一并退役；220ms 宽限语义保留为 hover 离开延迟清空）（guard 并入纯函数输入）；`canvas-node-toolbar.tsx` 内部 visible/opacity 自理逻辑收敛。
- [x] 全量回归：`bun test`（对比 35 fail 基线，不新增）；`bun run build`。
- Commit: `refactor(canvas): 退役工具栏220ms timer状态机 - guard 并入微供给推导`

### S6 真机逐格验收 + 登记
- [x] tmwd/真机：PRD 状态表 9 格（7 格真机过，框选/拖拽 2 格 CDP hidden 限制由单测覆盖）（idle/hover 节点/hover 工具栏/hover composer/selected/selected 后离开/dragging/设置气泡开/框选）+ 图片/视频/音频/文本/绘图节点 + 相机控制 + 全屏 composer。
- [x] getComputedStyle 断言：微→全显只变 opacity/filter（width/height/transform 不变）；玻璃值与参数面板同源。
- [x] reduced-motion CSS 直切已落地（真机 emulate 待人眼）。
- [x] `docs/content/docs/progress/pending-test.mdx` 登记（git add -f）+ 07 号状态文件进度更新。
- Commit: `docs(progress): 节点微供给质感化批登记`

## 全局验证命令
- `cd web && bunx tsc --noEmit`
- `cd web && bun test test/canvas-affordance.test.ts`
- `cd web && bun run build`
- 真机：localhost:3000（vite 重启后 served 验证再验收——WSL watcher 失效纪律）

## 回退点
每切片一个 commit；S3/S4 接线可独立 revert；S5 删除旧状态机前 S3/S4 已可独立回退到 timer 版。

### S7-S10 工作流审计裁决迁移（2026-09-13，四视角审计后追加）
- [x] S7 归属纯函数 `lib/canvas/hover-attribution.ts`（供给优先级 toolbar>sense-band>bridge>composer，M2 micro 面板主体排除，节点 stackRank 自由遮挡）+11 单测。Commit: `feat(canvas): hover归属单一权威纯函数...`
- [x] S8 状态机 hook `use-canvas-hover-attribution.ts`（mousemove→rAF+33ms 兜底采样→reducer idle/active/leaving 380ms/exiting 160ms）；project.tsx 三套校准/事件写入链/宽限计时器/handleSupplyLeave/pointerOverSupply 全删，hoveredNodeId/exitingNodeId 收敛为状态机单向投影。Commit: `refactor(canvas): hover生命周期收敛为状态机唯一写入者...`
- [x] S9 canvas-node 本地 hovered/双向校准/enter-leave 链删除，isHovered 由 world layers 下发 + React.memo；shared 页 onLocalHoverChange 本地自持。Commit: `refactor(canvas): 节点侧hover双写退役...`
- [x] S10 供给回调链退役（桥/感应带删 onEnter），桥宽 clamp 节点宽、感应带宽 clamp 模型宽；toolbarMenuOpenId 反向边（实例卸载/节点删除对账）；M3 键盘焦点通道（focusToolbarId 并入 selfHover）。Commits: `refactor(canvas): 供给回调链退役+宽度收窄...` / `feat(canvas): toolbarMenuOpenId反向边+M3键盘焦点通道...`
- [x] 真机 11 场景回归：idle 空/hover 双微/工具栏 full+面板 micro/桥上>380ms 域连续/出域完整退场/micro 面板主体不劫持归属/选中双 full 常驻/离指针保持 full/双实例共存/focusin micro→full 升级。
- [x] pending-test.mdx 登记（1facc4f5）。
