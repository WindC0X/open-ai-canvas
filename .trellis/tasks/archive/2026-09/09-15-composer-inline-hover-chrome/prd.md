# PRD：composer hover 态收进节点内（混合方案）

> 任务目录：09-15-composer-inline-hover-chrome
> 决策日期：2026-09-15，用户批准「混合方案」（三选一问卷）。

## 1. 问题

**用户报告（截图 orca-paste-1789468417852，2026-09-15）**：上下两节点（上方 3 视频节点 + 下方 1 视频节点）时，指针从上边节点移向下边节点，会触发上边节点的 composer 浮现，面板压住下边节点、无法选中下边节点。

**机制根因（已定位，非 bug 而是架构矛盾）**：微供给的 composer 是**外部浮动面板**（CanvasNodePanelOverlay，宽约 855px，浮出节点边界）。微→全升级域必须等于点击域，而外部面板的几何域与邻居节点相交：
- 微面板 body `pointer-events:none`（点击穿透）→ 快速移动跳过 20px 感知带，升级不可靠（300b8b9b 前状态）；
- 感知带窄条升级 → 快速移动必跳过；
- 微面板 body 参与升级域（现状 300b8b9b）→ 升级可靠，但面板压住邻居时指针进入即升级为 full → pe:auto → 拦截邻居点击。

**三条修复路径均已实机验证过且各有矛盾**（2026-09-12/13 多轮），几何上无解。

**语料证据（flora 源码级，20260915 chunk 解析）**：`NodeControlSurface` 为 `absolute inset-0` 节点内控制面（`.flora-capture/static-20260915/pretty/0_di9ysq8i8ky.js`），`useNodeControlSurface` 状态机 `force-expanded(空节点常驻)/expanded(hover)/minimized(生成中+刚完成1.5s)`——控制面域=节点域，与邻居永远不相交。og-canvas 语料同样为节点内嵌 progressive chrome。**这是 flora 无此误触的结构原因**。

## 2. 决策（用户已批准）

三选一问卷结果：**混合方案**。

- **hover 微态**：收进节点内 → 节点内底部微 composer（flora minimized/expanded 底部同构），**零越界**。用户澄清（2026-09-15，三张 flora 截图 orca-paste-1789469759394/-767646/-7776400）：
  - **纯信息展示**：只显示提示词、引用缩略等**信息**；**不含任何操作/按钮**（发送、引用 @、标签 #、参数滑块、↑生成等全部不放）。
  - **覆盖所有带 composer 的节点类型**（图像/视频/音频/文本…），不限于视频节点。
  - flora 参考：hover 时节点底部浮出毛玻璃 HUD（T 图标+参考图缩略+提示词全文）；静置时底部完全干净。
- **选中态（full）**：保留现有浮出大面板（持久态、指针向面板移动是预期行为，无误触风险）。
- 拒绝的选项：严格 flora 全内嵌（改动量最大，现有多行面板放不进 383px 节点，需整体重设计）；回到点击才出面板（放弃已批准的 hover 微浮现交互）；flowith 底部 dock（换轨，丢失就近编辑空间关联）。

## 3. 范围

### 交付
1. **节点内 hover 微 chrome**：hover 未选中节点时，节点内底部出现紧凑一行控制层（微亮态的提示词/参数/生成入口——具体形态由设计 spec 定稿）。在节点 DOM 内、不超出节点边界。
2. **外部微浮现面板退役**：hoveredPanelNode 的 micro composer 外部浮出实例删除（含 sense band、micro 升级域相关供给）。
3. **选中态浮出面板保留**：dialogNode 的 full composer（CanvasNodePanelOverlay 浮出）行为不变。
4. **hover-attribution 供给面简化**：composer 类供给（sense band / panel body / gap bridge for composer）裁剪；toolbar 供给链保留。微 chrome 在节点内，hover 归属回落到节点本身。
5. **S6 依赖对齐**：视频节点播放 HUD/生成中控制面的位置决策改在节点内 chrome 语境内做（flora PlaybackControlsBar 在 NodeControlSurface 沉底）。

### 边界（不做）
- 不做选中态浮出面板的形态重设计（保持现状）。
- 不改工具栏（toolbar）的微供给语义。
- 不引入 flowith dock。

## 4. 验收

- A1：上下堆叠节点场景——指针从上节点移向下节点全程，上方节点不出现压住下方节点的任何浮出物；下方节点可正常选中（真机，对照用户截图场景复现）。
- A2：hover 未选中节点，节点内底部微 chrome 出现（零越界，rect ⊆ 节点 rect）；指针进 chrome 升级为完整 hover 态，不出节点。
- A3：选中节点后浮出面板照常出现/可用；面板打开时移向面板不丢选中。
- A4：微 chrome 与 BatchFrame/batch root、视频播放态、加载态共存不冲突。
- A5：明暗主题、reduced-motion、触屏/键盘路径不劣化。
- A6：回归：工具栏 hover 微供给、issue-1 幽灵层防御、hover-attribution 既有测试全绿。

## 5. 与既有决策的关系

- 取代 micro-affordance 任务（09-12-toolbar-composer-micro-affordance）中 composer 外部微浮现的形态决策（bb656ddf/300b8b9b 引入的机制退役）；其 toolbar 微供给与 AffordanceSurface 原语保留。
- 遵循「归属面去重纪律」：新面替换旧面，不叠加。
- 遵循「从机制层修，不打补丁」指令（2026-09-14）。
- **S6（video-family 播放面）依赖本任务落地**——视频 HUD 的节点内控制面位置在此语境下定案。
