# 执行清单 · 模型行变体 T

> 门禁：tsc / eslint / build / web 全量 15 红逐名=冻结基线；go 零改动。双提交不 push；:3002/:8484 保留至验收。

## Step 1：tsx 行结构重排 ✓
- [x] renderModelRow：inlineBadges 去 priceForChip；rail span（价格+✓）挂 option-body 内；pin 兄弟按钮保留
- [x] ModelLabel：line1 类 + zone（mini chip 内联 + capabilitySummary 直排）；删 subtitleRef/is-overflow 机制与 ModelTags 引用

## Step 2：CSS ✓
- [x] rowgroup：grid 双列 → relative block（删 padding 0 2px 0 0）
- [x] pin：absolute right 10 / 20×20 / 双上下文 top；reveal/hover 规则沿用
- [x] rail / line1(96) / zone(lh17+clamp2) / zone-tag(11px+2 5+3+音色) 新规则（unlayered TOP 段）
- [x] 删 3b ✓ 补偿块（✓ 改轨锚）；logo 补偿保留；删 subtitle 死规则（含跑马灯 keyframes）

## Step 3：守卫重写 ✓
- [x] model-picker-style-source：3b 块 → T 块（无 grid pin 列 / rail absolute+锚 / 价格在轨 / zone mini chip+clamp / hover 红线 / logo 补偿保留）
- [x] 周边测试 fallout 修复

## Step 4：:3002 真机验收 ✓
- [x] a6api：GPT ~54 / nano ~71（说明完整+双标签在前）/ sunburst ~54 全名不截断
- [x] 六元素（logo/名/能力图标/价格/✓/pin）逐行同轨量测
- [x] pin hover（选中+未选）；ddcat 8×54≈432 无滚动；L1 走查 + ModelLabel 消费点枚举；hover 无果冻

## Step 5：收口 ✓
- [x] 四门禁；PATCH-MAP C1 升级（fork 专有行结构：右轨+流式区）
- [x] 附件归档（两份原型已入 attachments/；Gemini 咨询全文待控制线补档）
- [x] 双提交不 push；报 HEAD

---

# 执行记录（2026-09-30 · 变体 T）

## 改动（提交1 `fix(canvas)`）

- `model-picker.tsx`：
  - renderModelRow：inlineBadges 去 priceForChip（留 tier 徽章 + 能力图标）；新增 `.canvas-model-picker-rail`（价格+✓，option-body 内）；option 按钮挂 `no-rail-price` 条件类；pin 兄弟按钮结构不动（reveal 由行组 hover 承载）。
  - ModelLabel：标题行加 `.canvas-model-picker-line1`；subtitle+ModelTags → `.canvas-model-picker-zone`（mini chip 内联 + capabilitySummary 直排 + title 全文）；删 subtitleRef/is-overflow 跑马灯机制；`ModelTags` import 退场（model-tags.css/tsx 零改动）。
- `model-picker.css`：
  - rowgroup：grid 双列 → relative block（弃 `grid-template-columns: minmax(0,1fr) auto` 与右衬 padding）。
  - pin：absolute right 10 / 20×20 / 双上下文 top（base `calc(6px+fs*0.7-10px)`、creation `calc(8px+…)`）；reveal/is-pinned/focus-visible/hover 规则沿用。
  - unlayered T 段：line1 让位 **66**（实测反推，原型示意 96 装不下 sunburst 全名）+ `.no-rail-price` 收窄 **36** + zone（lh 17 / clamp 2 / opacity .72）+ zone-tag（11px / 2 5 / r3 / data-tone 六音色 + dark 提亮，ink 复制 model-tags.css）+ rail（absolute right 35 / top 6|8 / 高 fs×1.4 / align-center）+ option `align-items: flex-start`（58px 选中行零漂移）+ logo 补偿保留（3b 遗产）。
  - 删 3b ✓ margin-top 补偿（改轨锚）；删 subtitle 三处死规则 + 跑马灯 keyframes。
- 守卫：`model-picker-style-source.test.ts` 3b 块重写为 T 块（无 grid pin 列 / rail absolute+双上下文锚 / 价格在轨标题行无价 / zone mini chip+clamp+lh17 / line1 66+36 / option flex-start / logo 补偿保留 / ✓ 补偿已撤 / hover 无 height·padding）；`model-picker-prices.test.tsx` 标签断言 data-color → data-tone（意图不变：多标签+色+价格不动）。

## 验收实测（:3002 热更 ↔ :8484，脚本 /tmp/f06t-measure3.py，数据 .local/f06t-evidence/f06t-measure.json）

- **a6api flyout**：GPT 54.6（全名 141/141 不截断）/ nano 54.6（zone 一行：双标签在前 + 「Gemini系生图模型2代，限定1K」完整可见，zoneCut 0）/ **sunburst 54.6 全名 191=191 不截断**（价格迁出验收项 ✓）。
- **六元素同轨**：logo/模型名/能力图标/价格/✓/pin 圆心全 **17.8**（a6api 3 行、ddcat 8 行、L1 置顶行、58px 选中行全部一致，零漂移）。
- **pin hover**：未选中行 hover 只出 pin（opacity 1 / right 10 / cy 17.8，无 ✓）；选中行 hover **✓+pin 并列**（gap 5，双 cy 17.8）。
- **ddcat flyout**：8 行全 54.6；行总高 8×54.6=436.8（+组标 32 = flyout 468.8）；scrollH 467 = clientH 467 **无内部滚动**。
- **L1 composer 内嵌菜单**：置顶 sunburst 行同构（54.6 / 全 17.8 / zone 带标签一行 / 全名不截断）；取消置顶恢复 1→0。
- **扩图浮层**（无价格 + tier 徽章 + 白名单过滤）：a6api nano 全名 142/142；**选中行（58px min-height 保留）全名 170/170 不截断**（no-rail-price 36 收窄后）。
- **hover 无果冻**：行 transition 仅 background-color（守卫断言 + 截图目视）。

## 偏差与登记

1. **nano 行高 54.6 非 71**：任务书 71 预设基于原型示意文案（含加长句「画幅偏差概率略高」）的两行推导；真实说明+双标签在 zone 一行放下（zoneCut 0、完整可见），按「放不下自动换第二行」自适应语义取 54.6。两行 71.6 的能力由 clamp 结构保证（更长文案自动触发）。
2. **line1 让位 96 → 66**（实测反推）：原型 96 按最宽价格推导，实测 sunburst 全名 191 > 可用 166（截断）；66 时可用 194 ≥ 191，且 ✓（左缘 267）/pin（286）恒在让位带（≤250）外零压名。
3. **残留贴边风险**：≥6 字价格芯片（44.7px）+ 截断到极限的长名行，价格左缘与名尾 ≤14px 静态贴边窗口（登记待观察；缓解选项=未来价格芯片限宽）。
4. **ddcat 两个长名（198/209px）仍截断**（196 可用）：与 3b 同级固有（384px flyout 物理宽度），非 T 回归。
5. **Gemini 咨询全文未随任务书到达本环境**：卡附件已归档两份原型（planA/planA2）；咨询全文待控制线补档（决策链摘要已录入 prd）。

## ModelLabel 消费点枚举（报告项）

- 全仓唯一消费点：`web/src/components/model-picker.tsx` renderModelRow（:474 一处）。
- 渲染路径三条同构：L1 置顶区（pinnedGroups）/ L1 搜索结果 / L2 flyout——实测 L1 置顶行与 flyout 行结构/锚点一致。

## 门禁

- tsc rc=0 / eslint rc=0 / build ✓ 1m25s / web 全量 **2288 pass · 15 fail——15 红逐名=冻结基线**（与 3b 轮完全一致，零新增回归；总测试数 2303 不变）。
- go 零改动（纯 FE）。

## 回滚点

- revert 提交1 即回 3b 形态（顶部锚定混排）；守卫随提交恢复。

---

# 返工记录（2026-09-30 · 真机截断返工：flyout 384→432）

## 用户真机反馈（两轮截图，:3002 硬刷后）

- sunburst 选中行名 `gpt-image-2.5-sunburst · a...` **截断**；能力图标与价格徽章 `0.06` **贴叠**。
- 像素级复核确认渲染的**就是 T 结构**（zone 内联 mini chip ✓、右轨价格/✓ ✓）——问题不是旧码，是**宽度裕量为零**。

## 根因（量化）

- 行内可用宽 = flyout 384 − 内衬 22 = **362**；实测 shrink 边界 **196** vs sunburst 名宽 191（Linux 无头 Chromium）——**仅 5px 裕量**；且 caps 尾 283.4 > 价格左缘 280.6（**Linux 上已重叠 2.8px**，首轮验收误读为"2px 间隙"——更正）。
- Windows 真机字体度量比 Linux 宽 +6~10px → 名宽 ~205 > 196 → 截断 + caps 压价格（用户截图实锤）。
- 物理结论：**T 六元素同轨（logo+名+能力图标+价格+✓+pin）在 384 宽装不下最长验收名**——验收方法论缺陷：把"恰好放下"当"放下"，未留跨平台字宽裕量。

## 修复

- L2 flyout 钉宽 384 → **432**（行内 410；shrink 边界 196→**244**，Windows 名宽 ~205 仍有 **39px 真裕量**；caps-价格间隙 **45px**）。L1 菜单保持 384。
- 层叠坑（记档）：**非分层 !important 在层间反序下不敌分层 !important**（unlayered = 隐式末层，important 反序后最弱）——覆盖规则必须写进被覆盖者所在的 @layer utilities 层内且特异性更高（0,2,0 vs 0,1,0）；agent 域（canvas-cloud-agent.css 非分层 !important）反序下自动让位，另补 0,3,0 选择器双保险。
- 基础（非 creation）flyout max-width 384→432；JS 定位 fallback 字面量 384→432 两处（挂载后仍以 offsetWidth 实测为准）；anchor 测试字面量同步。

## 复验（:3002，/tmp/f06t-audit.py + measure3 + repro，证据 .local/f06t-evidence/f06t-measure-after432.log）

- a6api：GPT/nano 54.6、sunburst 选中行 58（min-height 保留）——**全名 191/191 不截断**、六元素全 17.8 同轨、caps-价格 45px 间隙。
- **ddcat：8 行长名（含 198/209）全部不截断**（432 附带收益，原 384 下截断）；8×54.6、scroll 467/467 无滚动。
- L1 置顶行 / 扩图浮层（无价格行 36 让位）/ 选中行 ✓+pin 并列（gap 5）全保持；行高 54.6/71.6 不变。
- 门禁：tsc/eslint 绿；web 全量 2288/15（15 红逐名=冻结基线）；build ✓。

## 教训（升 spec 候选）

- 跨平台 UI 验收：文字宽度类断言必须留字体度量裕量（Linux 无头 ≈ 下限，Windows 真机偏宽），"恰好放下"=必炸。
- 首轮报告的"caps 尾 279 vs 价格 281（2px 间隙）"实为重叠 2.8px（rounding 误读）——数值断言应以代数符号判定（end ≤ left − gap），不做目视差值。
