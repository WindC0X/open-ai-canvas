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

### 时长/缓动体系对齐注记(2026-10-03 深拆 S15d 吸收,[D] D1/D2/D4)

- **D1 三值收编**:旧代码内游离毫秒值 `160ms`(114 处)+`180ms`(107 处)+`140ms`(44 处)=265 处不在 token 表——已在 flora 批收编:180ms→`--motion-state`、160ms→`--motion-dur-fast-calc`、100ms→`--motion-dur-instant-calc`(4 处白名单豁免除外)。新增装饰动画禁止裸毫秒字面值(CI bare-ms 守卫已落地,flora-overrides-guard.test.ts)。**规格表 3 档 vs globals.css 5 档(80/150/250/400/600)的口径差就此登记**:规格表为「用途档位」,globals.css 为「Primitive 全集」,新动效先查 Primitive 再映射档位,两表不冲突但引用时须声明用哪个。
- **D2 强出场曲线升 Primitive**:`--ease-product-enter: cubic-bezier(.16,1,.3,1)` 目前只是语义别名(20 次消费);与 higgsfield `--hf-ease-out-expo`(逐字符同值)同源,补 `quart` 族后升级为 Primitive 档,不再当别名用。
- **D4 过渡默认缓动**:`transition` 用 `ease-out` 为默认(现状 `ease` 282 次 > `ease-out` 218 次,正滑向默认派);`animation` 内禁 `ease`。新代码按此,存量随触碰收敛,不专项清洗。
- **D3 `--animate-*` 命名化动画层（规划档，未实现）**：现状 61 个 keyframes 直接写在 `animation:` 简写里、无动画级 token 层（higgsfield 有 52 条）。规划：按三态收敛 `--animate-enter/exit/settle-*`；新动画必须消费命名层，不再新增内联 keyframes；存量 61 个随触碰迁移，不专项清洗。此条为**规划登记**，Primitive 落地随注册表升格批执行。
- **D1 范围与余量如实登记（2026-10-03 三模型审查勘误）**：本批收编仅覆盖 flora 批触达文件（8 处）+ 白名单 4 处豁免；存量游离毫秒值仍有约 48 处（globals.css 内 `140ms` 等未清），**随触碰收敛，不专项清洗**。原裁定的 `--motion-dur-micro: 140ms` Primitive **未废弃、待补**（下批 Primitive 落地时建立），在此之前 140ms 存量保持原值不误改。上句"265 处"为扫描口径，已收编数以 flora 批实绩为准。
- 完整 26 条前端吸收清单见 `canvas/竞品深拆-吸收落地方案-2026-10-01.md` §四;11 站动效基线数据见 `_synthesis/S15d-MOTION.md`。

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

### 两套阴影语义纪律（[D] C2，2026-10-03 深拆 §四 吸收；三模型交叉审查补录）

影策的两套阴影语义各只有竞品的一半蓝本（figma-weave 的 `inset 0 0 .5px` hairline 与 magnific 的 `--color-surface-border-alpha-*`），**影策的区分是完整的、应保持并写清**：

- `--shadow-*`：暗色翻白系——节点/卡片在暗背景上的"抬升"表达；
- `--elevation-*`：双主题黑影 + hairline 系——浮层/弹层的"贴面"表达；
- 消费规则：抬升面（节点体/卡片）禁用 hairline，贴面浮层（popover/dialog）禁用彩色投影；两系不得互换取值。新增组件先判"抬升还是贴面"再选系。

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

### 入口面与路由接口(2026-10-03 深拆落地方案 §四吸收,[D] A1/A2/B2)

**四档判据（MASTER-PLAN §14 落点①兑现）**：按「复杂度 × 交互形态」分配界面层级，同一资产多入口——高复杂度（多步编排/专属参数面）→独立工具页；中复杂度→画布内弹窗/浮层；低复杂度→画布外通用交互页（预设卡/快捷指令/chips）；零复杂度（纯资产）→模板/预设直接套用。机制详载《能力组织层方案》§4，本节登记其在 DESIGN.md 词汇中的落点。

- **A1 画布工具子路径(P0)**:`/canvas/:id` 增 `/canvas/:id/:tool`,白名单 `grid`/`portrait`/`angle`/`upscale`/`batch`,用 **`history.replaceState`(不 push,不产生历史栈噪音)**。定位=工作台派接口:画布内高复杂度操作的 URL 化,与未来独立工具页(四档第 2 档)是两档不同入口。蓝本=Magnific/RunningHub 工具子路径。
- **A2 单产物公开页(P1)**:新增 `/share/artifact/:token` 只读页(handler/canvas_share.go 补 token 校验)。5/11 站有此形态;小白把成品发给客户的交付形态,也是 Higgsfield Effects「独立 URL+可分享产物」的一手蓝本。与既有 `/share/canvas/:token`(整画布分享)并存,粒度不同。
- **B2 发现面(P0)**:不为工具发现新增一级导航项;模板/发现面复用 `/share/canvas/:token` 与未来配方画廊承载。一级导航上限 8 不破(与能力组织层方案 §3 工具目录条件触发同源)。
- **B1 node-hover 二级分组(P0)**:`node-hover-tools.tsx` 20 项平铺改用 `nodeToolbar.section` 分组(`tool-definition.ts:190` 已有字段,`add-node-menu-tools.tsx` 已用);与能力组织层毕业机制(引导态露 6 动作)同批实现。
- **B5 slash 场景预设(P1)**:三组画布菜单(九宫格/人像/视角)扩为 slash 条目(LibTV 蓝本);归属=能力组织层配方画廊的画布内分发位。

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
- **A4 不为工具发现新增一级页(P0,负向)**:`/admin` 30 子路由是 11 站唯一「后台路由>产品路由」形态(54%),这是特性不是缺陷;工具发现走 ⌘K/卡网格/配方画廊,不新开一级页(对照 11 站导航项数≠功能数的反直觉结论)。
- **C1 不重构为 surface×foreground 正交(P0,负向)**:竞品 5/11 站按正交组织;影策多轨并存,重构会同时触碰 627 个定义与全部组件消费点——**token 数量不是问题,层级才是**(S15c 结论 1)。不做。
- **D6 分级降级优于一刀切(P0,负向)**:`--motion-scale` 连续降级+`.no-motion` 是影策 L0/L1/L2 唯一分级方案,11 站未见等价物;runninghub 的 `.01ms` 与 opentu 全局兜底是一刀切——**不应改成布尔开关**。
- **D7 不用 keyframes 数量做度量(P1,负向)**:neowow 726 keyframes/5 变量 vs higgsfield 128/83 token——数量大≠规范强。引用 `_s15/` 预提取时长表必须先回算(`.15s`→`150ms`,11/11 站全中此坑)。
- **负向四不**(:§四) :工具不迁独立路由(6/11 站主选择是节点工具条)/不照搬「工具=画布元素」/一级导航不扩到 15-24 项/不做 flowith 式 iframe 微前端编辑器。

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

### 组件词汇补充约束(2026-10-03 深拆落地方案 §四吸收,[D] B4/B7/C3/C5/C6)

- **C5 双轨维持(P0,确认)**:admin/设置/表单=antd、画布面=画布原语的双轨方向正确(竞品 React 8/Vue 2/自研 3);Celadon UI 四层+「不引入 Radix」维持。不因竞品栈动摇。
- **C6 skin 双主题纪律(P1)**:画布独立主题+用户可配 skin 是影策差异化(8 站只有 `.dark` 类);**skin 新增必须同时提供明暗双份 tokens**(`skin-themes.ts` 的 `tokens[mode]` 已强制),此条为维护纪律。
- **C3 主色=定位选择(P1)**:无彩反相(亮 #171717/暗 #f5f5f5)与 runninghub 同族,是定位选择不是缺陷;**品牌识别不能依赖主色**,避免未来把「主色不够醒目」当 bug 改。
- **B4 徽标体系(P1)**:新增 `lib/feature-badges.ts` 四档(`new`/`experimental`/`legacy`/`member`);`AddNodeMenuCommand.badge?: string`(`tool-definition.ts:218`)已存在→**扩展现有字段不另起炉灶**。实现细则落 `canvas-floating-controls.mdx`。
- **B7 三态可见性(P1)**:功能门控三态 `allowed|locked|hidden`(TapNow 25 面+15 字段蓝本),引入到 RequireFeature 之上;**「隐藏」和「禁用」是两种沟通方式**。与能力组织层毕业机制(门控默认关、主动解锁)同批实现。实现细则落 `canvas-floating-controls.mdx`。

## Verification

- 每切片:三相闸门(`yingce-floraization/scripts/validate_evidence_bundle.py`)+ 并排对照 + 人眼签收;
- 构建:`bun run build`(或分阶段 `tsc --noEmit` + `vite build`);
- 浏览器验证:tmwd-bridge。
