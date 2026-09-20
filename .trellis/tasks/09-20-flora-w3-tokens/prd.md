# PRD: flora W3 令牌外置（flora-tokens.css）

## Goal

按 MASTER-PLAN §4.1 分步 3 建 `flora-tokens.css`：把 fork 对画布/工作台视觉的语义层改动收敛为一层**同名变量值覆盖**，在 `application.tsx` 的样式导入链**末端**加载，上游文件零改动。本卡先行落文档：文件边界 + 取舍记录；**代码动工等 v1.5.x 同步落地后开工**（同步会大改样式文件布局，先动等于返工）。

## 背景与依据

- fork 的 flora 形态是"在既有三层体系内加令牌/微调数值"（globals.css 17607 行，4151 处 `--` 引用），不是推翻重写；PATCH-MAP.md 已登记 globals.css 直改 75 条（Top20 热区）。
- 纪律（2026-09-18 立）：**新增 UI 一律走三层令牌（Primitive → Semantic → Component），globals.css 不新增结构直改。**
- ⚠️ 上游 5eab8126 已把 globals.css **−1031 行**拆到 `styles/shared/model-picker.css`（843）等独立文件——W3 的"加载序"假设从"globals.css:4 之后"升级为**整个 styles import 链之后**；flora 直改值所在规则（模型菜单 P51-030 族）随迁，路径见 design.md §3。

## Requirements

### R1 令牌映射（Semantic 层重定义，不发明新 token）

- 覆盖对象以 `--shadow-*` / `--workspace-*` / `--card-*` 及 PATCH-MAP 登记的 A 类纯令牌值为准，映射既有体系；不新增 Primitive。
- 覆盖表逐条对齐 PATCH-MAP Top20（挂件/composer > 模型菜单 > 微供给 > 参数面板 > S04），每条注记对应 PATCH-MAP 条目号。

### R2 动效变量外置

- `--motion-dur-fast/base/slow` 的值定义与 `--motion-ease-out/in` 同步进 flora-tokens.css；DESIGN.md 动效规格表（fast 100–150ms / base 200–250ms / reveal 300–400ms，2026-09-03 定稿）作为取值依据落注释。
- 不改变使用侧引用名（`--motion-dur-base-calc` 等既有消费不动）。

### R3 加载序与覆盖机制

- `application.tsx` 样式导入链**末端**引入 `flora-tokens.css`（当前实测链：reset.css → globals.css → …上游 5eab8126 新增的 styles/* imports——以同步落地后的实际链为准）。
- 机制 = 同名变量值覆盖（CSS 级联后胜）；上游文件零改动；`app-theme.ts` / `canvas-theme.ts` 保持 TS 侧唯一落点不变。

### R4 验收锚点（同步落地后执行）

- globals.css fork-side diff 收敛：A 类条目从直改值改由 flora-tokens.css 承担（PATCH-MAP 标注迁移状态）。
- 明暗双主题真机抽查：画布（节点/工具栏/composer/模型菜单）+ 工作台关键页无回归；门 3 截图基线 diff 人审。
- `bun run build` + tsc + bun test 基线对照。

## 边界

- 不做：flora-overrides.css（W4 组件级覆写迁移）；不改上游文件布局；不引入新 token 名。
- 前置阻塞：v1.5.x 同步未落地前不动代码；门 3 基线已有时效缺口（见 design.md §4 风险段）。

## 风险登记

- **基线时效缺口**：测试线 flora-baseline 截图采于 `da69a249`；其后 main 已进 HUD 纯层叠（4acd12cc）、Agent 面板演进（fe80b01d/a4d59b4e）、执行容错批次（796cf7ab 等）——W3 动工前必须重采基线（同盘同 runner），旧基线仅作历史参照。
- **同步竞态**：W3 与 v1.5.x 同步同域（styles/*、globals.css、PATCH-MAP）——串行纪律：同步落地 → PATCH-MAP 复核 → W3 动工。
