# 设计 · 模型行变体 T（原型 A2 → 代码映射）

> 权威规格 = `attachments/proto-model-row-planA2.html`（变体 T 列）。色板取自真实标签数据。

## 结构映射（原型 → 实现）

| 原型 | 实现 |
| --- | --- |
| `.inner { flex; gap 10; padding 8 10; align-items: flex-start }` | 复用现有 option（padding 8 10 由 `.creation-model-picker-menu .canvas-model-picker-option` 提供）+ option-body `items-start`（3b 已就位） |
| `.logo { 24px; margin-top: -2px }` | 3b 已有 `margin-top: calc(var(--fs-body)*0.7 - 12px)`（= -2.2px），保留 |
| `.line1 { margin-right: 96px }` | 实测反推为 **66px**（原型示意值 96 按最宽价格推导，实测装不下验收要求的 sunburst 全名 191px：96 时可用 166，66 时可用 194）；无价格行（扩图浮层/积分关闭）再收窄 **36px**（`.no-rail-price`，右轨仅 ✓+pin） |
| `.zone { fs 12; lh 17; mt 2 }` + `.mini` chip | 新类 `.canvas-model-picker-zone`（-webkit-line-clamp 2）+ `.canvas-model-picker-zone-tag`（data-tone 音色，ink 取自 model-tags.css 六音色，弱背景 color-mix 14%） |
| `.rail { absolute; right 10; top 8; gap 5 }` | 拆两半：`.canvas-model-picker-rail`（价格+✓，absolute，right 35 = 10+pin20+gap5）+ pin 兄弟按钮（absolute right 10）——pin 是 `<button>`，不可嵌进 option `<button>`（非法嵌套交互元素），故留在行组层 |
| 行高 54/71 | 自然流：8+19.6+2+17+8=54.6 / +17=71.6（54/71 四舍五入口径） |

## 锚定（双上下文）

rail/pin 的 `top` 锚标题行带（高度 = `var(--fs-body)*1.4` = 19.6，中心 17.8/15.8 视上下文）：
- 基础上下文（option padding 6 8）：top 6 / pin top 5.8
- creation-menu 上下文（padding 8 10，L1 菜单与 L2 flyout 均携带该类）：top 8 / pin top 7.8
- `top` 用 `calc(8px + var(--fs-body)*0.7 - 10px)` 形式随字号自适应（pin）；rail 用 `top:8 + height: fs*1.4 + align-center`。

## 关键决策

1. **pin 不嵌 option**：option 是 `<button role=option>`，嵌 `<button>` 非法 → pin 留在行组（绝对定位），reveal 规则（rowgroup:hover / .is-pinned / focus-visible）沿用。
2. **价格/✓ 进 rail（option 内）**：非交互元素，合法；rail 的包含块 = 行组（relative），逃逸 option-body 的 overflow hidden（CB 链不含裁剪者）。
3. **zone 替换 subtitle+ModelTags**：删除 subtitleRef/is-overflow 跑马灯机制（clamp+title 全文取代）；`capabilitySummary` 表达式逐字保留（subtitle-restore 守卫）；ModelTags 从 model-picker.tsx 退场（model-tags.css/tsx 仍零改动，C1 收敛）。
4. **音色**：mini chip 用 `data-tone`（blue/green/gold/orange/pink + 默认），ink 值复制 model-tags.css（含 .dark 提亮），避免与 ModelTags 的 `data-color` 断言面冲突。
5. **line1 让位 96px**：覆盖最宽 rail 组合（price ~38-42 + gap 5 + ✓ 14 + gap 5 + pin 20 + 右衬 10 ≈ 92-96）；更宽价格（tiers 长文案）极端情况允许压入标题带（注释登记）。
6. **tier 徽章（推荐/可用）留标题行**：任务书只迁价格；扩图档位门控行为与既有测试面不动。（实测：无价格行收窄 36 后，tier 徽章 + ddcat 长名 170px 全名可见。）
7. **hover 红线**：行组 hover 背景规则沿用（rowgroup 承载、option 抑制双写），零 height/padding 补间。
8. **option 顶对齐**（实测补丁）：既有 min-height 58 选中行下，center 对齐会把内容下推 ~2.2px（实测标题中心 19.5 vs 轨锚 17.8）；unlayered `align-items: flex-start` 让内容带恒从 padding 顶起 → 六元素恒 17.8。
9. **让位值实测反推**：66 = sunburst 全名 191px 的物理下限（可用 194）；✓（轨内左缘文本列坐标 267）与 pin（286）恒在让位带（250）之外零压名；残留：≥6 字价格芯片（44.7px）极端截断行存在 ≤14px 静态贴边风险（登记待观察）。

## 不做

- brand/provider 行零改动。
- "当前模型行 min-height 58" 保留（观感影响：选中行 58 vs 未选 54/71，右轨锚定不受影响——锚点挂标题行不挂行盒）。
- 标签并入价格徽章/状态点降维（不采纳项，已记录在案）。
