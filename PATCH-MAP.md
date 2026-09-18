# PATCH-MAP — fork 对 globals.css 直改存量登记

> 用途：A 线 flora 皮肤外置（flora-tokens.css 重定义 Semantic 层 + flora-overrides.css 组件覆写）的前置存量账本。每次上游同步的「外观隔离」类主题提交必须对照本表。
> 纪律（立此存照，2026-09-18）：**新增 UI 一律走三层令牌（Primitive → Semantic → Component），不再直改组件规则**。本纪律同步写进 Trellis 任务卡模板（.trellis/spec/frontend/）。
> 分类语义：
> - **A 纯令牌值改动** — 只动 token 值（颜色/圆角/时长变量），外置时由 flora-tokens.css 覆盖吸收；
> - **B 结构性改动** — 组件规则级（新增选择器块 / keyframes / antd 对抗规则），外置时需迁移进 flora-overrides.css；
> - **C 保留直改** — 同步卫生类（死 CSS 清删、上游错位规则清退）或上游已对齐后可随删的规则，不进外置。
> 覆盖范围：fork 独有提交（origin/main..HEAD）触及 `web/src/styles/globals.css` 共 **75 条**（2026-09-18 实测；canvas 规划记 69 系 W2 之前口径）。本表先登记热区权重 Top20，其余 55 条后续回填，不阻塞族 3。

## Top20（热区权重序：挂件/composer > 模型菜单 > 微供给 > 参数面板 > S04 > 同步卫生）

| # | commit | 语义（改了什么/为什么） | 分类 | 外置化归宿 |
|---|---|---|---|---|
| 1 | `5e0c3c67` | 挂件形态回归上游原版：删 S2 顶角取直设计（直角顶角=贴合感真根因），composer 回归 `var(--canvas-composer-radius)` 四角全圆，间距 10→12px | B | overrides（pendant 圆角/间距语义块） |
| 2 | `095b1f72` | 挂件 review P0-P3 修复批：双挂载删除、fall/expand 拍守卫、退场距离 `calc(100%+40px)`、三拍时长常量化（PENDANT_WAIT/FALL/FADE/EXPAND_MS） | B | overrides（pendant 动画编排块；时长常量若进 token 可升 A） |
| 3 | `cc383e14` | 挂件入场迁 inline transition 两拍：CSS animation 在后台节流下永不播放（DOM style.width 与 rect 脱节实证），机制统一 JS 两拍（坠 240ms 重力 + 展开 420ms 慢尾），globals 孤儿 keyframes 清理 | B | overrides（pendant 遗留规则清退登记；主体已 inline 化） |
| 4 | `50850519` | composer 挂件化 S2：面板底缘锚定（`data-panel-pendant`）左对齐坠落展开，外部微浮双实例与 sense band 退役 | B | overrides（pendant 锚定几何块） |
| 5 | `a3d9d7b3` | 节点内 hover 信息态 composer S1：纯信息零按钮/flora 坠落动画/零越界 | B | overrides（hover composer 信息态层） |
| 6 | `acb1871e` | composer 挂件宽度校准 560+信息态玻璃卡：底栏自然宽实测 534，渐变遮罩换实感玻璃卡 | B | overrides（挂件宽度/玻璃卡；宽度公式已在 TSX 常量，CSS 侧仅残留） |
| 7 | `8767259d` | S08 模型列表 flora 全结构：Pinned 置顶组/渠道 flyout/Models 沉底/媒体类型徽章 | B | overrides（模型菜单结构族，最大单块） |
| 8 | `4296af98` | S08 L1/L2 钻取与 surface 权威值：radius16/384 定宽/渠道行语法 | B | overrides（P51-030 权威值块；radius/width 若 token 化可升 A） |
| 9 | `85760c50` | S08 flora 菜单权威对齐：P51-030 实测值（53 行/12radius/24 圆 logo/18 徽章），wheel 手势打断 | B | overrides（同上合并迁移） |
| 10 | `f82f3d1d` | S08 六轮根治：flyout 根级 portal/关闭器白名单/玻璃 blur16 单源/字体栈钉死/死规则清理 | B | overrides（玻璃单源块——外置时必须保住唯一源语义） |
| 11 | `9b11eee9` | 参数面板密度 + 滚动条权威规则：`canvas-settings-scroll` 细胶囊滚动条成为多面板共用唯一源（Chromium webkit 定制） | B | overrides（滚动条权威块，多面板共用） |
| 12 | `0a395a83` | 参数面板质感层：统一玻璃 surface（dark .9+blur16/亮 .94）+radius16+无阴影+命中区 40px+按下 scale | B | overrides（玻璃 surface 族——与 #10 同族合并迁移） |
| 13 | `ba9df528` | 选项亮度语义+时长步进刻度：选中=内部提亮+字纯白，全部 `!important` 对抗 antd unlayered reset | B | overrides（antd 对抗块，外置时评估 Celadon 后是否可删） |
| 14 | `019dcaf9` | 刻度线性对位/份数纯列表/组卡片/开关降亮：SettingsStepper 线性分布、`canvas-settings-group` 卡片（radius12+groupFill token）、Switch 开态降亮 | B | overrides（组卡片块——已引用 token，迁移成本低） |
| 15 | `fe1fc40e` | 微供给接线+玻璃质感：hover 锚定单例/选中常驻 full/dock 材质换 flora 玻璃族 | B | overrides（AffordanceSurface dock 材质块） |
| 16 | `28c62c00` | AffordanceSurface 原语三级容器：hidden/micro/full，只动 opacity/filter，reduced-motion 直切 | B | overrides（微供给三级规则——组件逻辑在 TSX，CSS 侧是等级视觉） |
| 17 | `52b883bc` | 面板开合动画偏移根修：leave-active 移出 prepare important 块、hidden 注入改 afterOpenChange 门控、微浮方向锚定 `--panel-float-y` | B | overrides（开合动画块；`--panel-float-y` 属 A 级 token） |
| 18 | `fc76db5c` | rc-motion appear 过渡态补入禁交互防线：首开冻结（CDP rAF/后台 tab）时透明浮层不可交互——安全边界非纯视觉 | B | overrides（幽灵防御块，标注「安全边界，迁移时逐条核对覆盖 appear/enter/leave」） |
| 19 | `a6303130` | S04 生成中状态对齐 flora：旋转渐变边框+媒体区骨架脉动+底部安静状态行 | B | overrides（生成态视觉块） |
| 20 | `a97122ce` | W2 review 清删上游 v1.5 自动并入的双栏菜单死 CSS 138 行（JSX 零消费；冲突人审盲区教训本体） | C | 保留直改（同步卫生，随上游演进可整块消失） |

## 回填清单（其余 55 条）

- 模型菜单 S08 长尾 ~10 条（48db3333→77ef2aea 轮次修复，多数已被 Top20 的权威值块吸收，回填时按「已被吸收/独立残留」二分）；
- 微供给 09-12 批 ~8 条（b871be1e/18e51c14/64a746be/0ad9e40a/9ea3cedc/8dbf2fe6/bba8d6df/f675a485/cc11548f/e66b22c9/8f781d58，多数为 AffordanceSurface 迭代中间态，终态已并入 #15/#16）;
- 挂件动画中间态 ~8 条（be90fb3b/75b8af9d/5ea75579/b5a79fa8/91486e28/c635e3bb/865017d0/e1f3945a/934e901d，中间态已被 #1-#6 终态覆盖）;
- 参数面板长尾 ~8 条（ca446eb1/7da29c2b/eb16be42/8f2c9103/55a33bc8/4d14a565/da3f3260/442539ef 等）;
- W1/W2 同步卫生 3 条（2cc4f313/76e28952/065ecf13 的 globals 裁决段，C 类）;
- 其余杂项（500a16ca 安静化令牌=A 类代表、852d8e3d 字号、b8f50813/composer 底栏批等）。
- 回填排期：不阻塞族 3；在下次上游同步仪式（双周/事件触发）前完成二分登记，外置重构（W3 起）动工前必须全量回填。
