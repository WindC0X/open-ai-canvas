# Journal - WindC0X (Part 1)

> AI development session journal
> Started: 2026-09-04

---

## 2026-09-06 flora/quiet → main 合并窗口

- 全量测试三对照（/mnt/f HEAD、/tmp main、/tmp HEAD worktree）后定性：
  - bun 单进程全量存在跨文件状态污染 + 磁盘时序 flaky（同一 HEAD 在 /mnt/f 30 fail、/tmp 22 fail，集合不同）；
  - 同盘干净对照锁定 flora 净引入失败仅 2 条（canvas-visual-contrast 钉旧边框/阴影契约）→ 已更新测试对齐安静化契约（c9a70f5）；
  - 另 18 条失败 main 基线就红（上游问题，另册不上账）。
- backend：grok-image-edit.yingce-plugin（渠道测试遗留 zip，untracked）撞 protocol 包扫描测试 → 归档 .local/archive/；魔数校验（b37e522）与两个上游假夹具冲突 → 夹具升级为真实 1×1 PNG（c9a70f5）。全量 go test 绿。
- merge --no-ff 436e792：main 领先 origin/main 41 提交，树与 flora/quiet 零差异，未推送（D2 待用户）。
- 方法论沉淀：判定"flora 引入"必须同盘同 runner 对照基线，/mnt/f 与 /tmp 时序差异足以翻转失败集合；bun 全量的 flaky 失败不可作为回归证据。

---

## 2026-09-09 S08 模型菜单五轮修复失败 · 深度根因分析存档（未修复）

> 背景：S08 画布模型菜单两问题（① L2 flyout 选行后 DOM 残留；② L1/L2 行 UI 不一致）经 5 轮修复
> （aa34fd7 → 40d4854 → b12616d → b449f84 → 925d338）用户仍未确认修好。
> 本节为独立多智能体工作流（9 agent：5 路取证 + 综合 + 双对抗怀疑者 + 终稿）的结论存档。**只存档，未动代码。**

### ⚠️ 对既有登记的勘误

- 旧登记（本 journal 下方 925d338 轮）称"antd6 源码核实：Popover 用 `{ motionName: zoom-big-fast, motionDeadline: 1000 }`"——**经 antd 6.5.1 源码逐行核实为错误**：只有 Tooltip 传 `motionDeadline: 1000`（antd/es/tooltip/index.js:201-204），Popover 只传 motionName（antd/es/popover/index.js:110-112），**无任何 deadline 兜底**。`useStatus.js:125-131` 的 deadline 分支仅在注册且 >0 时生效。该错误直接导致 b449f84 轮修复依据失效。
- 旧登记"destroyOnHidden 后 Portal 卸载干净"与"合成事件探针在 portal 上失真（b449f84 轮自记）"矛盾——卸载结论建立在已自认失真的探针证据上，未经可靠验证。

### 残留问题①根因链（当前 925d338 HEAD）

1. **卸载链死锁（新引入）**：925d338 的 props 注入 hidden 类（`display:none`，globals.css:7270-7272）与 rc-motion leave 动画同帧生效 → display:none 元素不运行 CSS 动画 → animationend 永不派发 → Popover 无 deadline 兜底（见勘误）→ leave 永久挂起 → `keepDom=inMotion` 恒真（rc-trigger index.js:510）→ destroyOnHidden **永不卸载**。Popover DOM 以不可见态永久驻留。
2. **flyout 游离于一切关闭归属机制外**：pointerdown/wheel 白名单（model-picker.tsx:204-216）只豁免 triggerRef/menuRef；antd useWinClick 只认 popupEle；flyout 裸 div（:561-585）无 data-canvas-no-zoom、无 onKeyDown、无 ref。L2 行选择能工作依赖"pointerdown setOpen(false) 异步 flush 赶不及同一手势 mousedown 前卸载 DOM"的 React 调度时序巧合——时序翻转（后台 tab 恢复/慢设备）即选择丢失，**"时好时坏"的来源**。
3. **400ms 双向窗**（:240）：吞掉窗内一切合法 onOpenChange（含关闭）；打点仅在行 mousedown（:313）。
4. **放大器**：MenuBody 为渲染期内联组件（:394），任何 ModelPicker 重渲染整树重挂。

### L1/L2 不一致问题②根因链

1. **材质至今分叉**：玻璃 L1 blur(16px) 无 saturate（globals.css:7285）vs L2 blur(18px)+saturate(1.2)（7641）；亮色 L1 .94（10800，仅 creation）vs L2 .92（7653）；default 变体 padding 4 vs 8!important、max-height 384 vs 420。925d338 注释称"与 surface blur18+saturate 同源"指的其实是 10713 的 creation surface，与权威值 7285 blur16 自相矛盾——"玻璃同源"从未真正收敛。
2. **多源 !important + 源序决胜**：creation 菜单双副本（3242/10780）、surface 玻璃三源（2940/7282/10713）——任何插行改动即翻转，"按下葫芦浮起瓢"的结构土壤。死类：creation-model-picker-flyout 无 CSS；死规则：.canvas-model-picker-option.has-description（7445）TSX 不输出。
3. **层级差异被混入 bug**：L1 首屏=provider 行 44px 单行+组标，L2=53px 双行模型行；同类行两侧实际同源复用 renderModelRow（:313/:561）。用户感知的"不一致"=真实材质分叉+钻取层级差异叠加。
4. default 变体（9 消费方中 6 个）与亮色主题**从未被 eyeball**。

### 逐轮失败机制（为什么越修越复杂）

| 轮 | 修法 | 失败原因 |
|---|---|---|
| aa34fd7 | mousedown 只选+400ms 挡关闭 | 把关闭延迟到 click，**制造** detach 窗口；治标 |
| 40d4854 | mousedown 即选即关+双向 400ms | 修掉上轮自造窗口（有效），但 400ms 窗成新特例；上游归类错误未动 |
| b12616d | 字号显式化/去双色带 | "双色带"是 40d4854 自己引入的；未查同名选择器；纯治标 |
| b449f84 | 0s hack+DOM 加类+destroyOnHidden | 加的类被 rc-motion 重算抹掉（当轮自认）；motionDeadline 断言为错（见勘误） |
| 925d338 | props 注入 hidden 类 | 对"隐藏"有效但引出**卸载链死锁**；玻璃未真同源；双副本未合并 |

**系统性模式（用户怀疑"过于聚焦小部分而漏整体"成立）**：病灶在**状态机上游**（flyout 归类错误+时序巧合），修复全打在**下游**（动画/类/卸载端）；四层关闭机制叠存而非替换；每轮以 CDP 合成事件+DOM 探针验证，而探针失真已在 b449f84 轮自记——**在失真证据上宣布闭环**是"修好了→用户说没修好"循环的直接原因。

### 架构级判断与修复方向（未执行）

- **本质缺陷**：L1 走 antd Popover、L2 走手写 createPortal = 两套关闭协议/定位/归属判定/豁免标记。L2 每项 L1 能力需手工补且从未补全。
- 修复方向 A（根治）：flyout 并入 L1 Popover content 内部或两级全自研（仓内 use-popover-exit 手工协议先例）；改动大，9 消费方回归。
- 修复方向 B（最小止血）：hidden 语义改 visibility/opacity（解开卸载死锁）+ flyoutRef 进 pointerdown/wheel 白名单 + 补 data-canvas-no-zoom/onKeyDown + 400ms 窗收窄单向。
- 修复方向 C（只治②）：CSS 唯一源重构——合并双副本三源玻璃，删死类死规则；需补亮色/default 变体验证。

### 真机待验证未决项（真实浏览器，勿用 CDP 合成事件下结论）

1. 925d338 前台是否仍有**可见**残留，还是仅剩不可见 DOM 驻留；display:none 阻断 animationend 需断点验证。
2. pointerdown→mousedown 任务边界决定 flyout 选择失败面是否存在。
3. default 变体与亮色主题下①②是否复现。
4. bottomLeft 几何下"菜单收缩后落空 click 落回 trigger 重开"是否真实发生。
5. 400ms 窗吞合法关闭的实际命中率（连点/快速切换）。

（工作流完整证据链：/home/windc0x/.pi/workflows/projects/open-ai-canvas-ef3194f512b6/runs/canvas-model-picker-deep-dive-mtt3ex30-l8nqv5.json）
