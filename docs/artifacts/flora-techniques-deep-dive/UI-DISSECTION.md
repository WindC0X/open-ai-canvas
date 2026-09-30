# Flora 前端（UI）全量拆解（2026-09-30）

> **背景**：此前的 10 主题深拆只覆盖了**机制层**（API/数据/schema），界面层仅 ~15%（1 个技法详情页样本）。
> 本文补齐**界面层**。
>
> **方法声明（重要）**：本文**不是截图推断**。核心数据来自三源实测：
> 1. **CSS 自定义属性真值** —— `getComputedStyle` 逐变量取值（1326 暗 / 1456 亮）
> 2. **完整主 CSS 文件**（960 KB）—— 含 43 个 `f-*` 类定义与 token→utility 映射
> 3. **DOM 计算样式** —— 28 个组件的实际 `backgroundColor`/`borderRadius`/`fontSize` 像素值
>
> 截图仅用于**布局与信息层级**参照。所有颜色/尺寸/字体值均为**实测**，非视觉估算。
> 证据等级：**一手实测**（登录态真机）。
>
> **数据产物**：`data/ui/` —— `flora-main.css`(960KB) / `flora-vars-dark.json`(1326 变量) / `flora-vars-light.json`(1456 变量) / `flora-computed-styles.json`(28 组件)

---

## 0. 全局设计系统（★ CSS 真值）

### 0.0 主题机制（★ 影策 flora 化皮肤直接相关）

Flora 用 **`data-theme` 属性 + `.dark` 类**双轨切换：

```html
<html data-theme="flora-dark" class="... dark">
<!-- 切亮色： -->
<html data-theme="flora-light" class="...">   <!-- 移除 dark -->
```

**实测差异**：亮/暗两套主题共 **216 个变量值不同**（暗 1326 / 亮 1456 个变量）。

**关键语义 token 对照（实测值）**：

| Token | `flora-dark` | `flora-light` |
|---|---|---|
| `--color-text-1`（主文字） | `#eee` | `#202020` |
| `--color-text-2`（次文字） | `#b4b4b4` | `#646464` |
| `--color-text-3`（三级文字） | `#7b7b7b` | `#838383` |
| `--color-background-dark-1` | `#111` | `#fcfcfc` |
| `--color-dark-1` | `#111` | `#fcfcfc` |
| `--color-border-alpha-light-1` | `#ffffff1b` | `#00000017` |
| `--color-grass-9`（强调色） | `#57c957` | `#46a758` |
| `--color-grass-11` | `#71d083` | `#2a7e3b` |
| `--color-background-flora-green-primary` | `#57c957` | `#57c957`（不变） |

**★ 洞察**：`--color-background-dark-1` 在亮色下变成 `#fcfcfc` —— 命名叫 "dark" 但**语义是「面板底」**，不是「暗色」。这是 Flora 的 token 命名惯性，**影策移植时需注意**。

### 0.1 语义层架构（三层）

```
第三层  utility 类      .bg-background-dark-1 → background-color: var(--color-background-dark-1)
         ↑
第二层  语义 token      --color-background-dark-1 = #111
         ↑
第一层  原始色阶        --color-grass-1..12 + alpha 变体（Radix Colors 12 阶）
```

**第一层实例**（Radix 风格 12 阶）：
```
--color-grass-1  = #fbfefb    --color-grass-7  = #94ce9a
--color-grass-2  = #f5fbf5    --color-grass-8  = #65ba74
--color-grass-3  = #e9f6e9    --color-grass-9  = #46a758   ← 强调色（亮色主题）
--color-grass-4  = #daf1db    --color-grass-10 = #3e9b4f
--color-grass-5  = #c9e8ca    --color-grass-11 = #2a7e3b
--color-grass-6  = #b2ddb5    --color-grass-12 = #203c25
+ alpha 变体：--color-grass-a1..a9 / --color-grass-alpha-3,4,6,8
```

### 0.2 第二层：`--brand-os-*` 语义族（★ 最完整的一套）

**这是 Flora 真正的主语义层**（浅色系值，说明原本为亮色设计）：

| 族 | Token | 值 |
|---|---|---|
| **强调** | `--brand-os-accent` | `#5c8a50` |
| **墨色**（文字） | `--brand-os-ink` / `-2` / `-3` | `#35363b` / `#4f4e4a` / `#65635e` |
| **面板** | `--brand-os-canvas` | `#e5e3df` |
| | `--brand-os-panel` | `#f6f5f4` |
| | `--brand-os-card` | `#fbfaf8` |
| | `--brand-os-well` | `#edece8` |
| | `--brand-os-raised` | `#fff` |
| **边框** | `--brand-os-border` / `-strong` | `#dfdcd6` / `#c4c0b9` |
| **动作** | `--brand-os-action` / `-hover` | `#121212` / `#2b2b2b` |
| **三态·正** | `positive-text` / `-surface` / `-border` | `#4a7440` / `#5c8a501a` / `#a9c39f` |
| **三态·警** | `warning-text` / `-surface` / `-fill` / `-border` | `#8a5100` / `#fbf3e0` / `#c98a1b` / `#e3c27a` |
| **三态·危** | `danger-text` / `-text-2` / `-surface` / `-border` | `#a8201a` / `#c0342b` / `#fcedec` / `#efb1ae` |
| **叠色** | `--brand-os-tint-1` / `-2` / `-3` | `#3030300d` / `#30303014` / `#30303024` |
| **焦点** | `--brand-os-focus` | `#35363b` |

### 0.3 `f-*` 类体系（43 个，★ 完整清单）

**字体 scale**（`--font-display` = GeistSans）：

| 类 | font-size | weight | line-height | letter-spacing |
|---|---|---|---|---|
| `.f-font-h1` | `var(--text-6xl)` | — | 1.375 | — |
| `.f-font-h2` | `var(--text-3xl)` | — | 1.375 | — |
| `.f-font-h3` | `var(--text-base)` | — | 1.375 | -0.02rem |
| `.f-font-body-lg` | `var(--text-base)` | — | 1.375 | -0.01rem |
| `.f-font-body` | `var(--text-sm)` | **350** | 1.4 | 0 |
| `.f-font-body-bold` | `var(--text-sm)` | 500 | 1.4 | -0.01rem |
| `.f-font-accent` | `var(--text-xs)` | — | 1 | -0.01rem |
| `.f-font-accent-bold` | `var(--text-xs)` | 500 | 1.375 | -0.01rem |
| `.f-font-caption` | `var(--text-xs)` | — | 1.375 | — |
| `.f-font-value` | `var(--text-xs)` | — | 1.375 | —（**等宽** `--font-mono`） |
| `.f-font-chat` | `var(--text-sm)` | — | 1.5 | 0（系统字体栈） |
| `.f-font-brand-os-heading` | `2rem` | 400 | 1.1 | **-0.06rem** |
| `.f-font-typescale-{xs,sm,base,xl,3xl}` | 对应 token | — | 1.375 | — |

**★ 洞察**：`--font-display` 是 **GeistSans**（Vercel 字体），正文 weight 是 **350**（非标准 400）—— 这是 Flora 的排版特征。

**效果层**：

| 类 | 定义 |
|---|---|
| `.f-effect-panel` | `backdrop-filter: blur(var(--blur-xl))` + `box-shadow: var(--shadow-xl)` |
| `.f-effect-shadow-{sm,md,lg,xl,inner,none}` | Tailwind 阴影阶 |
| `.f-effect-shadow-drawer` | `0 -.5rem .625rem #0000001a, 0 -1.25rem 1.5625rem #0000001a` |
| `.f-effect-shadow-popover` | `0 4px 8px #0000001f` |
| `.f-effect-backdrop-blur-{sm,md,lg,xl,2xl}` | `backdrop-filter: blur(var(--blur-*))` |
| `.f-effect-gradient-blur` | 渐变遮罩 + blur（`--gradient-blur-amount` / `-direction` 可调） |

**背景图案**：

| 类 | 定义 |
|---|---|
| `.f-bg-dotted-pattern` | `radial-gradient(circle, #383838 1px, transparent 1px)` + `background-size: 16px 16px` |
| `.f-bg-onboarding-welcome-card` | `linear-gradient(40deg, #71d08326 3.46%, #71d0831a 26.73%, #71d08300 96.54%)` |
| `.f-bg-studio-onboarding-coach` | `conic-gradient(from 140deg at 55% 25%, #f0abfc, #67e8f9, #fde68a, #86efac, #a78bfa, #f0abfc)` |

**动画**：`.f-rail-dot-snap-pulse`（0.16s）/ `.f-rail-terminal-pulse`（0.32s）/ `.f-rail-tether-enter`（0.12s）

### 0.4 token→utility 映射（★ 直接可用）

```css
/* 背景 */
.bg-background-dark-1        → background-color: var(--color-background-dark-1)
.bg-background-dark-alpha-1  → background-color: var(--color-background-dark-alpha-1)
.bg-background-accent-1      → background-color: var(--color-background-accent-1)
.bg-background-danger        → background-color: var(--color-background-danger)
.bg-light-alpha-1            → background-color: var(--color-light-alpha-1)
.bg-dark-1                   → background-color: var(--color-dark-1)

/* 文字 */
.text-text-1                 → color: var(--color-text-1)
.text-text-2                 → color: var(--color-text-2)
.text-text-accent-1          → color: var(--color-text-accent-1)
.text-text-disabled          → color: var(--color-text-disabled)
.text-text-danger            → color: var(--color-text-danger)

/* 边框 */
.border-border-alpha-light-1 → border-color: var(--color-border-alpha-light-1)
.border-border-grass-alpha-4 → border-color: var(--color-border-grass-alpha-4)
.border-border-collection    → border-color: var(--color-border-collection)

/* 圆角 */
.rounded-radius-100/200/250/400 → border-radius: var(--radius-radius-N)
```

### 0.5 核心变量真值表（实测）

| 变量 | 值 |
|---|---|
| `--color-text-1` | `#eee` |
| `--color-text-2` | `#b4b4b4` |
| `--color-text-3` | `#7b7b7b` |
| `--color-text-disabled` | `#606060` |
| `--color-background-dark-1` | `#111` |
| `--color-background-dark-alpha-1` | `#191919e6` |
| `--color-background-dark-alpha-2` | `#000000e6` |
| `--color-border-alpha-light-1` | `#ffffff1b` |
| `--color-light-alpha-1` | `#ffffff1c` |
| `--color-grass-9` | `#57c957` |
| `--color-background-flora-green-primary` | `#57c957` |
| `--radius-radius-250` | `.75rem`（12px） |
| `--blur-xl` | `24px` |
| `--shadow-xl` | `0 20px 25px -5px #00000080, 0 8px 10px -6px #0006` |
| `--font-display` | `"GeistSans", "GeistSans Fallback", "Geist Sans", Helvetica, sans-serif` |
| `--font-mono` | `"GeistMono", ui-monospace, SFMono-Regular, ...` |

### 0.6 组件计算样式（28 个，实测像素值）

| 组件 | 实测值 |
|---|---|
| `MAIN` | `bg rgba(25,25,25,0.9)` = `#191919e6`，类 `bg-background-dark-alpha-1` |
| `HEADER` | `bg rgb(17,17,17)` = `#111`，类 `bg-dark-1`，`border-b border-border-alpha-light-1` |
| `NAV`（左 Dock） | `bg #111`，`w-14`（56px），`border-r` |
| `ASIDE`（右侧面板） | `bg #111`，**`w-[18.25rem]` = 292px**，`border-l`，`backdrop-blur-xl` |
| 分段控件 | `bg rgba(0,0,0,0.9)`，`rounded-xl`（12px），`border-border-alpha-light-1`，`p-0.5` |
| 标签 | `bg rgba(255,255,255,0.05)`，`rounded-md`（6px），`f-font-s-accent-bold` |
| 上传框 | `bg rgb(27,42,30)`，`rounded-lg`（8px），`border`，`aspect-square` |
| 绿色圆钮 | `bg rgb(87,201,87)` = `#57c957`，`rounded-full`，`size-[1.875rem]`（30px） |
| 卡片 | `bg rgba(255,255,255,0.11)`，`rounded-2xl`（16px），`f-effect-panel` |
| 悬浮标签 | `bg oklab(0 0 0 / 0.4)`，`rounded-md`，`backdrop-blur-xl` |
| 图片 | `rounded-xl`，`border-border-alpha-light-1` |

**★ 关键尺寸**：右面板 **292px**（`w-[18.25rem]`）、左 Dock **56px**（`w-14`）—— 这两个数字此前只能靠截图估算。

### 0.7 三栏式应用骨架（所有页面共用）

```
┌──────────────────────────────────────────────────────────────────────┐
│ 左侧 Dock (~48px)  │        主内容区（自适应）      │ 右侧面板 (~360px) │
│                    │                                │                  │
│  • Logo            │  页面标题 + 副标题             │ Run App 面板     │
│  • 搜索/团队/通知   │  标签行（App/Workflow/...）    │  输入表单        │
│  ─────────────     │  ─────────────────────────     │  预设选择        │
│  • + New project   │  主内容（卡片网格/画布/表格）  │  ──────────      │
│  • Create          │                                │  ⏱ ~1 min       │
│  • Generate        │                                │  [Generate]      │
│  ─────────────     │                                │                  │
│  • Home            │                                │                  │
│  • Projects        │                                │                  │
│  • Library  >      │                                │                  │
│  ─────────────     │                                │                  │
│  • Tools    New >  │                                │                  │
│  • Techniques      │                                │                  │
│  • Community       │                                │                  │
│  • MCP      New    │                                │                  │
│  • More     >      │                                │                  │
│  ─────────────     │                                │                  │
│  Pinned >          │                                │                  │
│  Recents           │                                │                  │
│   Project 1..5     │                                │                  │
│  ─────────────     │                                │                  │
│  赵 迪's workspace │                                │                  │
│  [📁][?][⚙]        │                                │                  │
└──────────────────────────────────────────────────────────────────────┘
```

**左侧 Dock 常量**（9 个页面完全一致）：
- 顶部：Logo（四叶草/四宫格）+ 搜索 / 团队 / 通知三图标
- 快捷：`+ New project` / `Create`（罗盘）/ `Generate`（火花）
- 导航：`Home` / `Projects` / `Library >`
- 工具：`Tools`（绿 `New` 徽标）> / `Techniques` / `Community` / `MCP`（绿 `New`）/ `More >`
- 项目：`Pinned >` / `Recents`（Project 1-5，带铅笔图标）
- 底部：头像 + `赵 迪's workspa...` + `↕` + `[📁][?][⚙]`

### 0.2 设计 Token（从截图取样）

| 类别 | 值 |
|---|---|
| 页面主背景 | `#191919e6`（`--color-background-dark-alpha-1`，实测） |
| Header/Nav 背景 | `#111`（`--color-background-dark-1` / `--color-dark-1`） |
| 边框 | `#ffffff1b`（`--color-border-alpha-light-1`） |
| 浅色叠加 | `#ffffff1c`（`--color-light-alpha-1`） |
| 主文字 | `#eee`（`--color-text-1`） |
| 次文字 | `#b4b4b4`（`--color-text-2`） |
| 三级文字 | `#7b7b7b`（`--color-text-3`） |
| 禁用文字 | `#606060`（`--color-text-disabled`） |
| **强调绿** | `#57c957`（`--color-grass-9` / `--color-background-flora-green-primary`） |
| 上传框底 | `rgb(27,42,30)` |
| 圆角 | `--radius-radius-250` = `.75rem`（12px）；卡片 `rounded-2xl`（16px） |
| 模糊 | `--blur-xl` = `24px` |
| 阴影 | `--shadow-xl` = `0 20px 25px -5px #00000080, 0 8px 10px -6px #0006` |
| 字体 | `--font-display` = GeistSans；正文 weight **350** |

**统一浮标**：右下角 `ljq_driver: 已连接`（绿字 + 深绿半透明胶囊）—— 本地驱动连接状态。

---

## 一、页面清单（9 个）

| # | 页面 | 路由 | 截图 | 关键结构 |
|---|---|---|---|---|
| 1 | 技法市场 | `/techniques` | `market.png` | 112 技法卡片网格 + 11 类别筛选 |
| 2 | 技法详情·App | `/techniques/{slug}` | `app.png` | 三栏 + Run App 表单 |
| 3 | 技法详情·Workflow | 同上（标签） | `workflow.png` | React Flow 画布 78 节点 |
| 4 | Studios 列表 | `/studios` | `studios.png` | 2 个 Studio 卡片 |
| 5 | Fashion Studio 工作台 | `/studios/fashion-studio/open` | `studio.png` | 起始 4 选项 + 三组 rail |
| 6 | Tools 列表 | `/tools` | `tools.png` | 5 工具卡片 |
| 7 | Bulk Generate | `/batch-generate` | `batch.png` | 参数化表格（200 行上限） |
| 8 | Director | `/imagine/director` | `director.png` | 单框 + 分辨率/比例/首尾帧 |
| 9 | Pose | `/imagine/pose` | `pose.png` | 3D 编辑器 + 预览双栏 |
| 10 | Realtime | `/imagine/realtime` | `realtime.png` | 双视口 + Play 计费 |

---

## 二、技法市场（`/techniques`）

### 2.1 布局

```
Techniques                         [🔍 Search techniques] [Request a Technique] [New Technique]
112 techniques

Community | Workspace | My Techniques | Favorites
─────────────────────────────────────────────
[All] [Featured] [Essentials] [Brand & Visual Design] [Product Visualization]
[Marketing & Ads] [Video & Animation] [Fashion & Apparel Editorial] [Content Packaging]
[Film & VFX] [Space & Architecture] [Fun & Inspiration]

Featured
┌────────────────────────┬────────────────────────┐
│ CoverArt               │ Character Lock         │
│ by Domenico A. ·453 uses│ by DJ Kim · 8K uses   │
└────────────────────────┴────────────────────────┘

All Techniques
┌────────┬────────┬────────┬────────┐
│ CoverArt│Material│3D Subject│Art &  │
│ 453 uses│3D Logo │ 56 uses  │Artist │
└────────┴────────┴────────┴────────┘
（4 列网格，卡片 16:10，右上角 ♡ 收藏）
```

### 2.2 关键发现

- **四级分区**：`Community`（社区技法，默认）/ `Workspace` / `My Techniques` / `Favorites`
- **11 个类别筛选**（与数据层 category 一致）：All / Featured / Essentials / Brand & Visual Design / Product Visualization / Marketing & Ads / Video & Animation / Fashion & Apparel Editorial / Content Packaging / Film & VFX / Space & Architecture / Fun & Inspiration
- **卡片元素**：缩略图 + 右上角收藏心形 + 标题 + `by {作者} · {N} uses`
- **两个 CTA**：`Request a Technique`（请求新技法，需求收集）+ `New Technique`（自己创建）

---

## 三、技法详情页（核心，三栏）

### 3.1 顶部视图切换器（★ 关键交互）

```
        ┌─────────────────┐
        │ [▣ App] [⚯ Workflow] │   ← 胶囊分段控件
        └─────────────────┘
```

- **App 视图**：面向使用者 —— Hero 介绍 + 画廊 + Run App 表单
- **Workflow 视图**：面向作者 —— React Flow 画布 + 右侧 Run App 面板

**实测**：JS `click()` **不触发**切换，必须 CDP 真实鼠标事件（`Input.dispatchMouseEvent`）。

### 3.2 App 视图布局

```
Techniques › Ghost Mannequin System          [App|Workflow]        [头像]
─────────────────────────────────────────────────────────────────────────
┌──────────────────────┬────────────────────────────────┬─────────────────┐
│ Ghost Mannequin      │  ┌──────┬──────┬──────┐        │ Run App      [🔗]│
│ System               │  │      │      │      │        │                 │
│                      │  ├──────┼──────┼──────┤        │ Stylish Casual  │
│ Turn any outfit...   │  │      │      │      │        │ Outfit      [ⓘ] │
│                      │  ├──────┼──────┼──────┤        │ ┌─────────────┐ │
│ ● Zazzy              │  │      │      │      │        │ │  ⬆ Upload   │ │
│                      │  └──────┴──────┴──────┘        │ │   image     │ │
│                      │  （10+ 张拼接画廊）             │ │ JPG,PNG,WEBP│ │
│                      │                                │ └─────────────┘ │
│                      │                                │                 │
│                      │                                │ Use preset      │
│                      │                                │ [■■] [■■] [■■]  │
│                      │                                │ ─────────────── │
│                      │                                │ ⏱ ~1 min        │
│                      │                                │ [  Generate  ]  │
├──────────────────────┴────────────────────────────────┴─────────────────┤
│ Examples | About                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ →] Input [1]                          [Outputs [14]                       │
│ ┌────────────┐  ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│ │Stylish     │  │Outfit      │ │Falling     │ │...         │            │
│ │Casual      │  │Reconstr.   │ │Fashion Pose│ │            │            │
│ │Outfit      │  │            │ │            │ │            │            │
│ └────────────┘  └────────────┘ └────────────┘ └────────────┘            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Run App 面板组件**（右侧，320-360px 固定）：
1. 标题 `Run App` + 分享链接图标 🔗
2. 字段标签（如 `Stylish Casual Outfit`）+ ⓘ 提示
3. **上传区**：墨绿底（`#15241b`）+ 虚线边框 + 圆形绿色上传图标 + `Upload image` + `JPG, PNG, WEBP`
4. `Use preset` + 预设缩略图行（44×44px，圆角 8px）
5. **底部 sticky**：`⏱ ~1 min` + 全宽 `Generate`（墨绿 `#345c3f`）

### 3.3 Workflow 视图（React Flow 画布）

**实测数据**（ghost-mannequin-system）：
- 节点 **78** 个 / 边 **54** 条
- 节点类型分布：

| 类型 | 数量 | 说明 |
|---|---|---|
| `techniqueViewLabel` | 32 | 标签节点（分组标题） |
| `textBlock` | 15 | 提示词节点 |
| `emptyImageBlock` | 15 | 空图像槽（输出位） |
| `techniqueViewIo` | 15 | IO 标记节点 |
| `staticImageBlock` | 1 | 静态参考图 |

**布局**：左侧输入节点 → 中间提示词处理列 → 右侧 14 个输出节点纵向排列。

**画布**：`react-flow__node` / `react-flow__edge` 类名可枚举；`.react-flow__controls` / `__minimap` / `__panel` 未渲染（可能是隐藏或按需）。

---

## 四、Studios

### 4.1 Studios 列表（`/studios`）

```
Studios
2 studios
                                          [Request a studio]

┌──────────────────────────┐  ┌──────────────────────────┐
│  Fashion Studio          │  │  Film Studio             │
│  Take any garment from   │  │  Take a production from  │
│  first sketch to          │  │  location scout to       │
│  campaign-ready.          │  │  finished frame.         │
└──────────────────────────┘  └──────────────────────────┘
```

**关键**：`/studios/fashion` **会重定向回** `/studios`；真实入口是卡片链接 `/studios/fashion-studio/open`。

### 4.2 Fashion Studio 工作台（★ 空态设计）

```
┌─────────────────────────────────────────────────────────────┐
│ ⊞ Project 5 ⋯                                               │
│ 🔒 Private · 赵迪's workspace                                │
│                                                             │
│  ┌──────┐                    [四叶草 Logo]                  │
│  │ ▤ +  │                    Fashion Studio                 │
│  ├──────┤        Start with a sketch, reference, or prompt  │
│  │Concept│                    of your idea.                 │
│  │Prompt │                                                   │
│  │Sketch │        ┌────────┐ ┌────────┐ ┌────────────────┐  │
│  ├──────┤        │   +    │ │   +    │ │ Describe a look│  │
│  │Extract│        │ Sketch │ │ Image  │ │ ...         [↑]│  │
│  ├──────┤        └────────┘ └────────┘ └────────────────┘  │
│  │Refine │                                                   │
│  │●Ghost │                                                   │
│  │Flat   │                                                   │
│  │Recolor│                                                   │
│  ├──────┤                                                    │
│  │Showcase│                                                  │
│  │Try-On │                                                   │
│  │360    │                                                   │
│  └──────┘                                                   │
│                                        [ljq_driver: 已连接] [?]│
└─────────────────────────────────────────────────────────────┘
```

**左侧 rail 结构**（三组，实测）：
- **Concept**：`Prompt` / `Sketch` / `Extract`
- **Refine**：`Ghost`（当前激活，绿点）/ `Flat` / `Recolor`
- **Showcase**：`Try-On` / `360`

**空态中央**（★ 设计亮点）：
1. 四叶草 Logo
2. 标题 `Fashion Studio`
3. 副标题 `Start with a sketch, reference, or prompt of your idea.`
4. **输入栏三个元素**：`+ Sketch` 卡片（虚线边框）/ `+ Image` 卡片 / 主提示词输入框（占位符 `Describe a look, campaign, or product image...` + 内嵌圆形 `↑` 提交按钮）

**注意**：rail 只渲染**当前项目已添加的** 8 个工具 —— 完整 15 个需从 React fiber 挖（见 `FULL-DATA-REPORT.md` §2）。

---

## 五、Tools 页面

### 5.1 Tools 列表（`/tools`）

```
Tools                                    [🔍 Search tools]
5 tools

┌────────────────────────────────────────────────────────────┐
│ Featured                                                    │
│ Bulk Generate                                               │
│ Create many image variations at once.                       │
│ [Open tool]                              （右侧 banner 图）  │
└────────────────────────────────────────────────────────────┘

┌────────────┬────────────┬────────────┬────────────┐
│ Fashion    │ Bulk       │ Director   │ Pose       │
│ Studio     │ Generate ★ │            │            │
│ Take any   │ Create many│ Direct a   │ Pose a     │
│ garment... │ variations │ previz...  │ figure...  │
└────────────┴────────────┴────────────┴────────────┘
┌────────────┐
│ Realtime   │
│ Restyle    │
│ your camera│
└────────────┘
```

**5 个工具**（页面明确列出）：Bulk Generate ★ / Fashion Studio / Director / Pose / Realtime
**隐藏的 Film Studio**（`/productions`）**不在**此页 —— 印证此前的「公开 5 个 / 实际 6 个注册」发现。

**卡片结构**：全幅图 + 底部渐变遮罩（`from-black/90 via-black/50 to-transparent`）+ 标题 + 描述。

### 5.2 Bulk Generate（`/batch-generate`）★ 表格化批处理

```
New batch - Sep 2, 2026 ⌄
Fill a batch, generate every row, and compare the outputs in place. Saved automatically.
Watch how it works                    [🕘 Previous batches] [+ New batch]
─────────────────────────────────────────────────────────────────────────
[+ Add row] [+ Add in bulk]
┌────────────────────────────────────────────────────────────────────┐
│ 🖼 Input images                    Add up to 4 images. They guide   │
│                                    every row in this batch. [Upload]│
└────────────────────────────────────────────────────────────────────┘
[All 2] [Draft 2] [Generating 0] [Completed 0]   [🔍 Search prompts] [▤][⊞]
─────────────────────────────────────────────────────────────────────────
○ │ # │ Prompt              │ Input │ Model ⌄         │ Resolution ⌄ │ Aspect ⌄ │ Output │ ⋯
──┼───┼─────────────────────┼───────┼─────────────────┼──────────────┼──────────┼────────┼───
○ │ 1 │ Describe what...    │  [+]  │ Nano Banana Pro │ Default      │ Auto     │   —    │ ⋯
○ │ 2 │ Describe what...    │  [+]  │ Nano Banana Pro │ Default      │ Auto     │   —    │ ⋯
─────────────────────────────────────────────────────────────────────────
[+ Add row] [+ Add in bulk]                                    2 of 200 rows
```

**★ 关键**：
- **全局输入图**（最多 4 张，"guide every row in this batch"）
- **行级参数**：Prompt / Input / Model / Resolution / Aspect ratio / Output
- **状态过滤**：All / Draft / Generating / Completed（带计数）
- **视图切换**：列表 `▤` / 网格 `⊞`
- **上限 200 行**（`2 of 200 rows`）
- **自动保存**（"Saved automatically"）

---

## 六、Imagine 三工具 UI

### 6.1 Director（`/imagine/director`）

```
Director [New]  Direct a previz stream.
                          ┌──────────────────────────┐
                          │     [🎬 场记板图标]      │
                          │     Set the scene        │
                          └──────────────────────────┘
        ┌──────────────────────────────────────────────────┐
        │ Try "a golden-hour desert highway, a vintage     │
        │ convertible tracked from alongside"        [tab] │
        │                                            [🎙]  │
        ├──────────────────────────────────────────────────┤
        │ [480p|768p|1080p 2×]  [16:9|9:16|1:1]           │
        │ [🖼 First frame] [⚑ End frame] [🔊 Audio]         │
        │                                        [▶ Start] │
        └──────────────────────────────────────────────────┘
```

**控件**：分辨率三档（480p / 768p / 1080p 2×）+ 宽高比三档（16:9 / 9:16 / 1:1）+ 首帧/尾帧/音频 + `Start`
**空态**：场记板图标 + `Set the scene` + 示例提示词 + `tab` 快捷键提示
**对应机制**：这些 UI 控件直接映射 `{type:"configure", resolution, aspect_ratio, image_url, end_image_url, audio_url}`

### 6.2 Pose（`/imagine/pose`）★ 最复杂

```
Pose [New]  Pose the figure.
┌───────────────────────────┬────────────────────────┐  ┌──────────────┐
│  3D 姿态编辑器            │  生成预览              │  │ CONDITIONING │
│  （白色卡片 + 网格地面）  │  （暗色卡片）          │  │ OpenPose...  │
│                           │  • Waiting for a prompt│  │ [缩略图]     │
│   [人偶 + OpenPose 关节]  │                        │  ├──────────────┤
│                           │  Write a prompt and    │  │ MODEL        │
│                           │  the render starts     │  │ Freedom      │
│                           │  streaming.            │  │ μ 1.73 [====]│
│  [Stand|T-pose|Wave|Walk  │                        │  │ Facing       │
│   |Run|Sit|Jump]  [↔][⛶]  │                        │  │ [Front|¾|Side│
│                           │                        │  │  |Back]      │
└───────────────────────────┴────────────────────────┘  │ Resolution   │
                                                          │ [768|1024]   │
┌───────────────────────────────────────────────────────┴──────────────┤
│ Try "a samurai mid-leap through a bamboo forest"  [tab]        [🎙]  │
│ ☑ Pose-aware template  ☑ Auto pose words                             │
│ Your prompt, expanded with the pose, appears here.  [🔥120280] [■Stop]│
└──────────────────────────────────────────────────────────────────────┘
```

**★ 关键 UI**：
- **3D 姿态编辑器**：白色卡片 + 透视网格地面 + OpenPose 关节配色（**右侧关节红 / 左侧关节蓝 / 中轴黄橙**）+ 地面软阴影
- **7 个姿态预设**：`Stand` / `T-pose` / `Wave` / `Walk` / `Run` / `Sit` / `Jump`
- **Freedom 滑块**：显示 `μ 1.73` —— **直接对应机制层的 `schedule_mu = 2.5 − 2.2 × freedom`**（μ 1.73 → freedom ≈ 0.35）
- **Facing 四档**：`Front` / `¾` / `Side` / `Back`
- **Resolution 两档**：`768` / `1024`
- **两个开关**：`Pose-aware template` + `Auto pose words`（对应机制层的提示词自动扩展）
- **积分余额**：`🔥 120280`
- **预览文案**：`Your prompt, expanded with the pose, appears here.`

### 6.3 Realtime（`/imagine/realtime`）

```
Realtime [New]  Your camera, restyled in real time.
┌──────────────────────────┬──────────────────────────┐
│ Camera                   │ ● Camera blocked         │
│  [🚫 摄像机图标]         │  [▶ 播放图标]            │
│  No camera available.    │  Describe a look below,  │
│                          │  then press Play — the   │
│                          │  stream bills while it   │
│                          │  runs.                   │
└──────────────────────────┴──────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ Try "a weathered marble statue"              [tab]   │
│ ☑ Mirror view                            [▶ Play]    │
└──────────────────────────────────────────────────────┘
```

**★ 关键**：
- **双视口**：左 = 摄像头原始输入（`Camera`）/ 右 = AI 重绘输出（`Camera blocked`）
- **计费提示**：`the stream bills while it runs` —— 对应机制层的按活跃秒计费
- **`Mirror view` 开关**（默认开）
- **`Play`** 按钮（不是 Generate/Start —— 强调"直播"语义）
- 空态：`No camera available.` / `Camera blocked`

---

## 七、跨页面 UI 模式总结

### 7.1 五个可复用模式

| # | 模式 | 出现在 | 影策可用性 |
|---|---|---|---|
| 1 | **App/Workflow 双视图切换器** | 技法详情页 | ★★★ 直接对应影策「用户态/作者态」 |
| 2 | **右侧 Run App 表单 + 底部 sticky CTA** | 技法详情 / Studio | ★★★ 影策预设场景 2.0 的完整形态 |
| 3 | **空态三要素**（Logo + 标题 + 输入栏） | Studio / Director / Pose | ★★★ 影策 onboarding |
| 4 | **参数化表格批处理** | Bulk Generate | ★★★ 影策 F-05 批量 |
| 5 | **双视口对比**（输入 / 输出） | Realtime | ★★ 影策生成对比 |

### 7.2 交互细节（实测）

- **`tab` 键采纳示例提示词**（Director / Pose / Realtime 一致）
- **麦克风语音输入**（三个 Imagine 工具都有）
- **积分余额常驻显示**（Pose 底部 `🔥 120280`）
- **`ljq_driver: 已连接` 状态浮标**（所有页面右下角）
- **标签切换必须真实鼠标事件**（JS `click()` 无效）

### 7.3 控件类型枚举（11 种，从 bundle 提取）

```js
{TEXT:"text", IMAGE:"image", ELEMENT:"element", COLOR:"color", SELECT:"select",
 SLIDER:"slider", MASK:"mask", COLLECTION:"collection", VIDEO:"video",
 AUDIO:"audio", GENERIC:"generic"}
```

**对应 UI**：`SLIDER` → Pose 的 Freedom 滑块；`MASK` → Garment Recolor 的选区；`COLOR` → Recolor 的颜色选择；`SELECT` → 下拉；`COLLECTION` → 批量/集合。

---

## 八、对影策（open-ai-canvas）的界面迁移建议

### 8.1 立即可用（1-2 人日）

| 项 | 说明 |
|---|---|
| **App/Workflow 双视图** | 影策已有画布 + Agent，缺「使用者视图」；这是预设场景 2.0 的关键 |
| **空态三要素** | Logo + 一句话 + 输入栏 —— 影策 onboarding 目前无此设计 |
| **`tab` 采纳示例** | 极低成本提升首用体验 |
| **积分余额常驻** | 影策有 payment-plugins，需对应 UI |

### 8.2 需适配（3-8 人日）

| 项 | 说明 |
|---|---|
| **参数化批处理表格** | 影策 F-05 批量；Flora 的全局输入图 + 行级参数是完整参考 |
| **3D 姿态编辑器** | 影策影视线可用；需 three.js + IK，成本较高 |
| **双视口对比** | 影策生成对比场景 |

### 8.3 设计 token 对齐（★ 现在可直接执行）

影策已有 `flora-tokens.css` / `flora-overrides.css`。**已获真值清单**（`data/ui/`）：

| 产物 | 内容 | 用途 |
|---|---|---|
| `flora-vars-dark.json` | 1326 个变量（暗色计算值） | 逐项比对影策 token |
| `flora-vars-light.json` | 1456 个变量（亮色计算值） | 双主题支持 |
| `flora-main.css` | 960 KB 完整主 CSS | `f-*` 类定义 + utility 映射 |
| `flora-computed-styles.json` | 28 个组件实际样式 | 组件级校对 |

**建议核对顺序**（按影响面）：
1. `--color-text-1/2/3`（`#eee`/`#b4b4b4`/`#7b7b7b`）—— 全局文字
2. `--color-background-dark-1`（`#111`）与 `-alpha-1`（`#191919e6`）—— 面板底
3. `--color-border-alpha-light-1`（`#ffffff1b`）—— 全局边框
4. `--color-grass-9`（`#57c957`）与 `--color-background-flora-green-primary` —— 强调色
5. `--radius-radius-250`（12px）/ `--blur-xl`（24px）/ `--shadow-xl`
6. `--font-display`（GeistSans）+ 正文 weight **350**

**★ 两个易错点**：
- `--color-background-dark-1` 在**亮色主题下是 `#fcfcfc`** —— 命名带 dark 但语义是「面板底」，不是「暗色面板」
- Flora 正文 weight 是 **350**（非 400）—— 影策若用 400 会显得偏重

**双主题机制**：`data-theme="flora-dark"|"flora-light"` + `.dark` 类；216 个变量随主题变化。影策若要支持双主题可直接复用这套变量名。

### 8.4 与影策现有 `flora-tokens.css` 的核对（★ 实测对照）

影策 `web/src/styles/flora-tokens.css`（88 行 / 17 个变量）的注释登记了三条 flora 暗色系参考族。**逐条对照真值**：

| 影策注释声明 | Flora 真值 | 影策实际值 | 结论 |
|---|---|---|---|
| 近黑底 `#0c0c0c-#121212` | `--color-background-dark-1` = **`#111`** | `--background: #0f0f0f` | ✅ 两者均在族内 |
| 深灰容器 `#181818-#222` | `--color-background-dark-alpha-1` = **`#191919e6`** | `--card: #181818` | ✅ 在族内 |
| 绿 accent `#57c957` 族 | `--color-grass-9` = **`#57c957`** | 未启用 | ✅ 真值可直取 |
| 边框 | `--color-border-alpha-light-1` = **`#ffffff1b`** | `--border: #222222` | ❌ **不匹配** |

**结论**：影策此前的 flora 化推导（基于 `flora-css-vars.json` 语料 + 用户实拍）**方向与量值基本正确**（底/容器/强调色均命中）。本次全量抓取提供**权威依据**，并暴露一处差异：

**★ 唯一发现的不匹配：边框色**
- Flora：`--color-border-alpha-light-1` = `#ffffff1b`（**白色 10.6% 透明度**，叠加式）
- 影策：`--border: #222222`（**不透明深灰**）

两者视觉近似但**机制不同**：Flora 用**半透明白叠层**（可在任意底色上自然融合，如玻璃面板），影策用**实色**（在非 `#0f0f0f` 底上会显脏）。若影策有半透明面板（`backdrop-blur` 类），建议改用 `#ffffff1b` 方案。

**可立即执行的动作**：
1. 核对 `--background: #0f0f0f` vs 真值 `#111`（差 2 级，影响很小）
2. **边框色**：评估是否改用 `#ffffff1b` 叠层方案（见上）
3. 正文 weight 核对：Flora = **350**，影策若为 400 会偏重
4. 若后续要启用纯绿 accent，真值可直接取 `#57c957`（`--color-grass-9`）
5. 双主题：影策若要支持亮色，`flora-vars-light.json` 提供 216 个差异变量的完整对照

---

## 九、缺口（诚实登记）

| # | 缺口 | 原因 |
|---|---|---|
| 1 | 移动端布局 | 未测 |
| 2 | ~~暗色/亮色主题切换~~ | ✅ **已解决** —— `data-theme` 双轨 + 216 个差异变量已拓 |
| 3 | ~~组件的完整 CSS 值~~ | ✅ **已解决** —— 28 组件计算样式 + 960KB 主 CSS + 1326/1456 变量 |
| 4 | 动画/过渡细节 | 只有 3 个 `f-rail-*` 动画定义；其余过渡在 Tailwind 类里 |
| 5 | 技法详情页 Examples/About 标签内容 | 点击未切换（需 CDP） |
| 6 | Film Studio 内页 | 未进入 |
| 7 | MCP 页面 | 按用户令跳过 |
| 8 | `@font-face` 字体文件 | 未下载（GeistSans 等） |

---

## 十、可复现命令

```bash
# 1. 开标签
tmwd-browser exec <SID> '{"cmd":"tabs","method":"create","url":"https://app.flora.ai/techniques"}'

# 2. 截图（CDP，返回 base64）
tmwd-browser cdp <SID> Page.captureScreenshot '{"format":"png"}' \
  | python3 -c "import sys,json,base64; print(len(base64.b64decode(json.load(sys.stdin)['r']['data']['data'])))"

# 3. 抓 CSS 变量真值（关键：cssRules 通道能拿到 Tailwind v4 变量名）
tmwd-browser exec <SID> '(function(){const names=new Set();for(const sh of document.styleSheets){try{for(const r of sh.cssRules){if(r.style)for(let i=0;i<r.style.length;i++){const p=r.style[i];if(p.startsWith("--"))names.add(p);}if(r.cssText)for(const m of r.cssText.matchAll(/(--[\w-]+)\s*:/g))names.add(m[1]);}}catch(e){}}const root=getComputedStyle(document.documentElement);const out={};for(const n of names){const v=root.getPropertyValue(n).trim();if(v)out[n]=v;}window.__CV_JSON=JSON.stringify(out);return Object.keys(out).length;})()'

# 4. 取回大 JSON（避免 exec 截断）
tmwd-browser exec <SID> 'window.__CV_JSON' | python3 -c "import sys,json;print(len(json.load(sys.stdin)['r']['data']))"

# 5. 下载完整主 CSS
tmwd-browser exec <SID> '(async()=>{const u=[...document.styleSheets].find(s=>s.href&&s.href.includes("0-f4_cjcq0of-")).href;window.__MAINCSS=await(await fetch(u)).text();return window.__MAINCSS.length;})()'

# 6. 切主题
tmwd-browser exec <SID> 'document.documentElement.setAttribute("data-theme","flora-light");document.documentElement.classList.remove("dark");return "ok"'

# 7. 标签切换（必须真实鼠标事件，JS click 无效）
tmwd-browser cdp <SID> Input.dispatchMouseEvent '{"type":"mousePressed","x":1194,"y":32,"button":"left","clickCount":1}'
tmwd-browser cdp <SID> Input.dispatchMouseEvent '{"type":"mouseReleased","x":1194,"y":32,"button":"left","clickCount":1}'
```

**关键坑**：
- `tmwd-browser screenshot` 子命令**不存在** —— 用 `cdp ... Page.captureScreenshot`
- `/studios/fashion` 重定向回 `/studios` —— 真实入口是 `/studios/fashion-studio/open`
- 标签页 JS `click()` 不触发切换，必须 CDP `Input.dispatchMouseEvent`
- **Tailwind v4 的变量名只能从 `r.cssText` 正则抠**（`r.style` 不暴露 `@layer` 内定义）
- 大 JSON 回传要用 `window.__X_JSON` + 分块 slice（exec 有大小限制）
