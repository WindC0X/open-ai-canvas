# Flora 前端（UI）全量拆解（2026-09-30）

> **背景**：此前的 10 主题深拆只覆盖了**机制层**（API/数据/schema），界面层仅 ~15%（1 个技法详情页样本）。
> 本文补齐**界面层**：9 个核心页面的布局、组件、设计 token、交互流程，全部基于**真机截图 + DOM 实测**。
> 证据等级：**一手实测**（登录态真机，截图见 `screenshots/`）。

---

## 0. 全局设计系统

### 0.1 三栏式应用骨架（所有页面共用）

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
| 页面主背景 | `#0a0a0c` ~ `#121214` |
| 卡片/面板背景 | `#161618` ~ `#1c1c20` |
| 浮层/激活态 | `#222226` ~ `#2c2e35` |
| 边框 | `#27272a` ~ `#2e2e33`（1px solid） |
| 虚线边框（上传框） | `#3f3f46` |
| 主文字 | `#ffffff` |
| 次文字 | `#8e8e93` / `#a1a1aa` |
| 占位符 | `#52525b` / `#71717a` |
| **强调绿（主 CTA）** | `#22c55e` / `#4ade80` |
| 强调绿（深底徽标） | `#14532d` / `#166534` |
| 头像紫 | `#8b5cf6` |
| 圆角 | 卡片 12-16px / 按钮 8px / 药丸 9999px |

**字体**：无衬线（Inter / SF Pro Display 类）；标题 22-32px 粗体，正文 13-14px，辅助 12px。

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

### 8.3 设计 token 对齐

影策已有 `flora-tokens.css` / `flora-overrides.css`。**建议核对**本文 §0.2 的取样值（特别是强调绿 `#22c55e` 与深绿徽标 `#14532d`）是否已覆盖。

---

## 九、缺口（诚实登记）

| # | 缺口 | 原因 |
|---|---|---|
| 1 | 移动端布局 | 未测 |
| 2 | 暗色/亮色主题切换 | 只见到暗色 |
| 3 | 组件的完整 CSS 值 | 截图取样，非计算样式 |
| 4 | 动画/过渡细节 | 静态截图无法捕获 |
| 5 | 技法详情页 Examples/About 标签内容 | 点击未切换（需 CDP） |
| 6 | Film Studio 内页 | 未进入 |
| 7 | MCP 页面 | 按用户令跳过 |

---

## 十、可复现命令

```bash
# 开标签
tmwd-browser exec <SID> '{"cmd":"tabs","method":"create","url":"https://app.flora.ai/techniques"}'

# 截图（CDP，返回 base64）
tmwd-browser cdp <SID> Page.captureScreenshot '{"format":"png"}' \
  | python3 -c "import sys,json,base64; print(len(base64.b64decode(json.load(sys.stdin)['r']['data']['data'])))"

# 标签切换（必须真实鼠标事件，JS click 无效）
tmwd-browser cdp <SID> Input.dispatchMouseEvent '{"type":"mousePressed","x":1194,"y":32,"button":"left","clickCount":1}'
tmwd-browser cdp <SID> Input.dispatchMouseEvent '{"type":"mouseReleased","x":1194,"y":32,"button":"left","clickCount":1}'
```

**关键坑**：
- `tmwd-browser screenshot` 子命令**不存在** —— 用 `cdp ... Page.captureScreenshot`
- `/studios/fashion` 重定向回 `/studios` —— 真实入口是 `/studios/fashion-studio/open`
- 标签页 JS `click()` 不触发切换，必须 CDP `Input.dispatchMouseEvent`
