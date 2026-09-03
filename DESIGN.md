# Design

> 影策 flora 化的设计权威文件。骨架状态:Phase 0 契约起草中,标注 `Phase 0` 的小节待定稿。
> 上位文档:`PRODUCT.md`(产品 register:product);方法论:flora-evidence-kit(00-04)。
> 运行规则:yingce-floraization skill(WSL `~/.codex/skills/yingce-floraization`)。

## Register

product——设计服务于创作任务,不喧宾夺主(与 PRODUCT.md 一致)。

## Design principles(总原则,来自八条总原则的设计子集)

1. **语法改编,不是克隆**:借鉴 flora 的交互结构、密度、状态时序、归属面;不搬品牌/文案/素材。
2. **归属面先于代码**:每个能力有唯一 owner surface;`needs owner decision` 的能力不进实现。
3. **令牌先于组件**:所有组件(antd / 自制原语 / 第三方)读同一套影策令牌;动效从动效规格表取值。
4. **同一交互面不混组件词汇**:画布面用影策画布原语;admin/设置保留 antd。
5. **可打断、compositor-only、reduced-motion**:动效三底线。

## Token & motion spec(定稿 2026-09-03)

### 令牌落点

`web/src/lib/app-theme.ts` + `web/src/styles/globals.css` 令牌块(`:root`/`.dark`)+ `web/src/lib/canvas-theme.ts`;分支 `flora/quiet`。所有组件(antd/自制原语/第三方)只读令牌,不得自带视觉字面值。

### 动效规格表(所有动效取值于此,禁止库默认值)

| 档位 | 时长 | 缓动 | 用途 |
|---|---|---|---|
| 微 fast | 100–150ms | ease-out | 悬停工具条进/出(BORDER_FADE 150ms)、菜单/popover 开合、拖拽吸附、按下反馈 |
| 标准 base | 200–250ms | 进 ease-out / 出 ease-in | 节点 spawn(SPAWN 200ms)、HUD/Context 展开、对话框、主题切换、队列条目滑入 |
| 大 reveal | 300–400ms | ease-out | 生成结果显现(GENERATION_REVEAL 400ms)、工作台进入、空态首现 |

flora 实测常量对齐:BORDER_FADE 150ms、SPAWN 200ms、GENERATION_REVEAL 400ms(与档位冲突时以实测为准并在此登记)。

### 动效六规则

1. 只动 transform/opacity(合成器属性);
2. 可打断:新操作中断动画不跳帧;
3. persistence:反馈类每次动;揭示类仅首次/状态变化时动,重复触发退化为噪音;
4. 错误/注意:单次脉动,不循环;装饰性循环动画禁止;
5. `prefers-reduced-motion`:全部降级为即时 opacity 切换,无位移;
6. 第三方库默认时长/缓动一律视为"有意覆盖"登记项,以本表为准。

CSS 变量:`--motion-fast / --motion-base / --motion-reveal`、`--ease-out / --ease-in`;同步进 app-theme.ts 的 AntD motion token。

### 表面/边框/密度安静化补录(2026-09-03 草案,依据 T1 flora 实测 + 上游既有 token)

原则:不发明新 token——全部映射到 globals.css 既有 `--shadow-*`/`--workspace-*`/`--card-*` 体系,只调整数值与消费方式;画布节点面参照 flora T1 实测(alpha 表面、细边框、克制阴影)。

| 项 | 现状(上游 v1.2.5) | 安静化目标 | 依据 |
|---|---|---|---|
| 画布节点面板 | `canvas-theme` node.fill #181818(dark) | 保持(已同向) | flora dark #111/#191919 系 |
| 节点阴影 | dark `0 8px 24px rgba(0,0,0,.34)` | `0 4px 12px rgba(0,0,0,.30)`(--shadow-md 档) | flora 克制升高;T1 实测结果节点阴影低模糊 |
| 选中描边 | dark activeStroke #f1f1f1 全亮 | 保持(flora 选中即高对比) | T1 实测选中态 |
| 工具条面板 | dark `rgba(20,20,20,.97)` + border .10 | **透明度降至 .92 + 去阴影**(border 保持) | flora 工具条为 alpha 表面+1px 细边,无投影 |
| 页面卡/workspace 面 | `--workspace-surface` #181818 | 保持 | 上游工作区壳契约(1px 边+--r-xl+单影)已安静 |
| 弹层升高 | 已收敛(Phase 2 核心) | 保持 | flora |
| 密度 | controlHeight 36 / fontSize 13 | 保持(flora 密度相仿) | T1 composer 实测 |
| 连线 | 现状带色 | 静默化:常态更淡(仅选中/悬停增强)——**归属 Phase 3 连线切片再动**,此处不预设值 | flora relation 语法 |

禁改清单(本补录不触碰):页面布局几何(工作区壳 gutter/侧栏宽)、AntD 组件密度、字体栈、画布背景模式(dots/lines/blank 用户可选语义)。

### 有意覆盖登记(对默认值的覆盖,持续维护)

| 日期 | 覆盖对象 | 默认值 | 覆盖值 | 依据 |
|---|---|---|---|---|
| 2026-09-03 | AntD motionDurationFast/Mid/Slow(app-theme.ts) | 0.12/0.18/0.24s | **0.15/0.2/0.4s** | flora 实测常量(BORDER_FADE/SPAWN/GENERATION_REVEAL);与 globals.css 既有 `--motion-dur-fast/base/slow`(150/250/400ms)对齐 |
| 2026-09-03 | AntD boxShadowSecondary(弹层升高) | 0 24px 72px(dark)/ 0 22px 64px(light) | **0 8px 24px 0.4(dark)/ 0 6px 20px 0.1(light)** | flora 安静化:克制升高,flora 参考为 alpha 表面+细边框+低模糊 |
| 2026-09-03 | globals.css --elevation-overlay(light+dark) | 0 24px 60px .2 / 0 28px 72px .62 | **0 8px 24px .14 / 0 8px 24px .4** | 同上;单一源令牌,7 处消费(顶栏簇/浮动 dock/文件夹等)一并安静化 |

注:globals.css 已内置 `--motion-dur-*`(80/150/250/400/600ms)与 `--motion-ease-*` 完整体系(上游工作区壳工程产物)——动效规格表与其一致,Phase 2 无需新建变量,只做 AntD 对齐。

## Owner surface decisions(定稿 2026-09-03)

完整无损归宿表见 flora-evidence-kit `05-owner-surface-draft.md`(约 40 项能力已全部定位)。以下为评审决议登记:

| 能力 | 决议 |
|---|---|
| 时间线 | 独立视频工作台 |
| 导演工作台 | 入口/出口与 Agent 芯片走 flora 语法;内部 3D 交互领域专属 |
| 分镜 | 混合:剧本/分镜数据在节点,单镜编辑进 detail 面 |
| 色彩分级 | 保留节点化 |
| 短剧入口 | 创建菜单条目 + 项目侧栏区块,无专属画布语法 |
| 世界图层 | Canvas base 安静切换器 + popover 编辑 |
| 历史 | Context 只放选中对象最近变更;全画布历史/版本对比留抽屉 |
| 视频分段/帧 | 工具模态,结果以节点/引用回画布 |

通用高置信映射(同表 A/B/C):媒体节点=作品主导节点体+四态悬停工具条;生成前参数=composer 微控件;引用=素材库→composer chip→端口;Agent 独立面(呼吸球→对话框);模型/密钥/渠道=设置·后台,绝不进画布 UI。

`needs owner decision`:**暂无**。新增能力进入实现前必须先在此登记决策。

## Negative constraints(定稿 2026-09-03)

禁止回潮的旧 UI 元素清单。任何切片验收时逐条核对:
- 生成后的媒体节点不得残留常驻生成表单;
- 参数(模型/比例/数量)不得以常驻表单堆出现在节点体;
- 数量控件不得是常驻参数行;
- 连线默认不带 source/provenance 文字;
- Agent/Inspector/Context 不得合并为一个大面板的 tabs;
- 画布 UI 不得出现 provider/protocol/Base URL/SecretRef/裸 ID;
- 不得引入装饰性循环动画(仅状态反馈,见动效规格表第 4 条);
- 同一交互面不得混用 antd 与画布原语两套词汇;
- 空态不得是"暂无数据"式死文案,必须含"这里是什么 + 下一步入口"(异常空态说明原因);
- "增强提示词"类动作必须是悬停/聚焦供给或本地化动作,不得是常驻标签。

### 证据纪律(台账 evidence-gap-ledger §9"不得复制"清单,2026-09-03 并入)

### 归属面去重纪律(2026-09-03 教训补录,效力高于一切新增冲动)

- **任何新表面/新部件动工前,先列出"同一批动作/信息现在住在哪些面"**——右键菜单、标题头、既有面板、快捷键;新面必须替换而非叠加,否则即重复;
- 走闸门不是形式:切片 1/3 绕过 spec→implement 闸门直接实现,被用户抓出重复后整体 revert(1b4347a/a6ff26b)——**闸门省不得,自审替代不了归属面评审**;
- flora 的"独立右侧事实面板"语法成立的前提是**有独立面板**;影策没有右面板时,事实的归属先决策(升级现有面/新建面/留在节点头),不做就地硬塞;
- 已撤销实现(原语本体保留在 primitives/,playground 可见):ObjectHud 接线(0efbc1a)、NodeHoverActions 接线(70d3438)。


- 不把单一节点的解剖/几何公式/控件/生命周期外推到整个族(几何公式存在两代血统:固定宽 384 vs 固定高 384);
- 旧版留存(retained)或仅源码(source-only)组件不得当作当前线上行为;
- Generate 状态机不得外推到 Agent Send / Run / Collection 按钮(它们是独立 owner 与状态机);
- 工具条存在 ≠ 指针可达/响应式安全;DOM 缺失 ≠ 媒体/端口/关系缺失;portal 消失 ≠ 焦点/选择/锁定/数据恢复;
- flora 当前的可访问性/响应式缺陷不得当作产品设计语言;
- 设计假设(非对标要求):双 WebGL、剔除常量(2x/150ms/12/RAF、LOD .12)、端口命中半径、30 类一一对应层级、Agent/Queue 的具体实现。

(台账 §9"可安全改编"8 条已体现在总原则与上述约束中:语法优先、owner 拆分、正交状态轴、坐标契约、owner 边界共享原语、家族级 fixture、焦点恢复/reduced-motion/响应式为独立验收向量。)

## Component vocabulary

- admin/设置/表单:antd 6.5.1(现有)。
- 画布面:影策画布原语(`web/src/components/canvas/primitives/`,行为底座 Base UI,动效 motion,图标动效 animate-ui icons,agent 质感 ElevenLabs UI / AICSS 参考)——经 04 号清单许可证门与包装规则采纳。
- 第三方组件词汇不得散落在业务代码,一律包装进影策原语 API。

## Verification

- 每切片:三相闸门(`yingce-floraization/scripts/validate_evidence_bundle.py`)+ 并排对照 + 人眼签收;
- 构建:`bun run build`(或分阶段 `tsc --noEmit` + `vite build`);
- 浏览器验证:tmwd-bridge。
