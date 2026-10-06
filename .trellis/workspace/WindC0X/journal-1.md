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

## 2026-09-11 S08 闭环归档

**任务**：09-06-s08-text-generation-lifecycle（#15-#17 + 四个验收问题 + #18 逐面验收）已 archive 至 archive/2026-09/。

**本轮收尾要点**：
- 底栏质感收尾批（708e0b0/bc631bb/17c1573）：三按钮 13px 统一（用户明确按主题基准而非 fs-tiny）、分隔符统一类、antd Button 内容包装 span block 折行根修（inline-flex）、份数行高 36→32 消滚动条、选中边框 #d9d9d9+1.5px。
- wheel 关闭同步批（b3a78c3）：image 气泡 closeOnCanvasWheel 补 onOpenChange(false)，修 nodeImageSettingsOpen 残留致节点工具栏永久隐藏。
- #18 逐面验收（c6a9ae1）：rebase 后面 1-6 回归 + 面 7 视频 + 面 8 mask-edit(default 变体) + 面 9 亮色主题，全过。
- **appear 防线缺口修复（c615210）**：rc-motion 禁交互规则原只写 enter/leave，漏 appear 三态——首开菜单在 rAF 冻结环境重现幽灵层。补齐后冻结态 pe:none 实测生效。教训：rc-motion 状态机防线必须 appear/enter/leave 全覆盖，只写 enter/leave 是不完备的。
- **DPR=1 亚像素事实**：1.5px 边框实绘 2px 实色像素列（无抗锯齿混合）；getComputedStyle 报 1px 是 CSSOM resolved 取整假象——验证真实绘制宽度用 offsetWidth-clientWidth 或截图数像素。
- 遗留：video/audio count>1 批量提交管线（UI 先行，独立任务）。


## Session 1: 2026-09-14 微供给质感化任务归档
<!-- trellis-session: v=2 fp=15f8816985e04b8e -->

**Date**: 2026-09-14
**Task**: 2026-09-14 微供给质感化任务归档
**Branch**: `main`

### Summary

节点工具栏/composer 微供给质感化(09-12~09-14)收尾归档:AffordanceSurface 原语+微供给状态机替换 220ms timer;四视角审计裁决后完成 hover 归属单一权威迁移(attributeHover 纯函数+状态机 hook,校准/回调链/宽限计时器全退役);hover→selected 体感四连根修+层级遮挡门(含门截杀 composer 升级的回归修复);code-review-expert 两轮 A 级。用户四轮复验收敛,任务归档 archive/2026-09/。07 号 flora-evidence-kit 快照同步更新至 09-14。遗留:遮挡门 hook 单测、fork 推送、PR #488 跟进、生视频族。

### Git Commits

| Hash | Message |
|------|---------|
| `0a38a05e` | docs(progress): 遮挡门供给域放行回归修复+P3收敛登记 |
| `3556445b` | fix(canvas): 遮挡门放行几何供给域 - micro composer 面板体 pe:none 被 elementFromPoint 跳过命中画布背景, 门判空截杀面板体升级路径(300b8b9b 语义回归, 用户复验 hover→composer 触发失效); 门移到归属计算前并增加 supply rect 覆盖放行, 指针在任一供给矩形内交回 attributeHover 决胜; 附带 P3 收敛: 豁免类名常量单一来源(MODEL_PICKER_*_CLASS)+域判定纯函数化 pointerInSupplyDomainExtension+补单测 |
| `0363331e` | refactor(canvas): 遮挡门豁免类名单一来源+纯函数化 - MODEL_PICKER_POPOVER/FLYOUT_CLASS 常量导出, 域判定抽 pointerInSupplyDomainExtension 纯函数并补单测(无关浮层/遮罩/空链均判域外) |
| `c892b5e2` | refactor(canvas): 遮挡门与归属空的grace定时器搭建抽取enterLeavingPhase - 两处同构块收敛防grace/相位机调整漂移 |
| `bb1b71a3` | docs(progress): hover归属遮挡门登记(全局面板不再误触发底层hover) |
| `412f0ef8` | fix(canvas): hover归属遮挡门 - 归属采样是纯几何无DOM命中感知, 指针悬在画布命令面板/拉线创建菜单/相机对话框遮罩/底部dock弹层等全局面板上时坐标仍落在下层节点矩形内误触发底层hover态; elementFromPoint命中元素不在节点/供给/模型菜单豁免子树内则本帧归属判空(leaving grace保留, pe:none元素天然不命中不误伤供给) |
| `48192c16` | docs(progress): 供给与节点同步全显根修登记(按下即full, level与面板内容解耦) |
| `7e0d7303` | fix(canvas): 供给与节点本体同步全显 - mousedown 选中瞬间(单选集合)供给即 full, 不等 mouseup 的 dialog 打开: 节点描边 selected 与工具栏/composer full 曾分两拍(按下亮边/抬起才全显), 用户感知供给慢半拍; 真机按住不抬实测 sel=selected+双供给full 同帧, 完整点击流终态不变 |
| `95341acc` | docs(progress): review 范围勘误扩围(19文件+286/-80)与扩围复审结论登记 |
| `fdf4fa23` | docs+chore: review P2 落地 - 拖拽视觉态ref复位点清单注释(防新增退出路径漏复位), toolbar双槽位去重语义在派生层显式声明(与composer JSX filter同语义异位置的收敛说明) |
| `53bc9479` | docs(progress): 微供给后续修改 code-review 产出登记(Esc原地卡死根修) |
| `57b475f7` | fix(canvas): Esc反选后原地hover卡死根修 - 归属状态机公开resetBoundary并接线反选边界: mirror直清后状态机停留active且归属采样不再变化, 单向mirror effect永不重跑(指针原地时hover永久无法重建, hoverMachineResetRef伪reset是死代码未接线) |
| `4fd51fc2` | docs(progress): 慢半拍量化与150ms对齐登记(含探测点打空假警报教训) |
| `a6ed818f` | fix(canvas): 微供给 micro↔full 过渡时长对齐确认感 - base 250ms 在 hover→selected 确认瞬间被感知为慢半拍(真机采样 op 0.45→1.0 需~300ms), 改用 --motion-dur-fast 150ms 后实测 ~200ms 完成, 与 canvas-panel-in 同速 |
| `034efc32` | Reapply "fix(canvas): hover→selected同节点duplicate-key重挂根修 - 转换帧hover镜像滞后于dialogNodeId同步setState, selected/hover两槽位同id双实例以duplicate key强制React重挂→canvas-panel-in重播(闪), 同id去重保留selected槽位使实例连续存活(真机DOM引用恒等验证sameDomInstance=true)" |
| `1a3954fc` | Reapply "fix(canvas): hover→selected跳闪双根修 - (1)选中描边1→1.5px宽度突变改恒1px+inset阴影环合成(零重排,颜色平滑过渡); (2)纯点击mousedown曾立即进入拖拽视觉态(isNodeDragging/dragPreview)触发供给guard隐藏→mouseup恢复=工具栏/composer闪隐一次, 改为越过3px拖拽阈值才进入视觉态, 点击路径不再经过" |
| `2ade2b97` | Revert "fix(canvas): hover→selected跳闪双根修 - (1)选中描边1→1.5px宽度突变改恒1px+inset阴影环合成(零重排,颜色平滑过渡); (2)纯点击mousedown曾立即进入拖拽视觉态(isNodeDragging/dragPreview)触发供给guard隐藏→mouseup恢复=工具栏/composer闪隐一次, 改为越过3px拖拽阈值才进入视觉态, 点击路径不再经过" |
| `f2d3cd04` | Revert "fix(canvas): hover→selected同节点duplicate-key重挂根修 - 转换帧hover镜像滞后于dialogNodeId同步setState, selected/hover两槽位同id双实例以duplicate key强制React重挂→canvas-panel-in重播(闪), 同id去重保留selected槽位使实例连续存活(真机DOM引用恒等验证sameDomInstance=true)" |
| `fea73e1f` | docs(progress): hover→selected duplicate-key 重挂根因三补登(真机DOM引用恒等验证) |
| `9a0cc6a6` | fix(canvas): hover→selected同节点duplicate-key重挂根修 - 转换帧hover镜像滞后于dialogNodeId同步setState, selected/hover两槽位同id双实例以duplicate key强制React重挂→canvas-panel-in重播(闪), 同id去重保留selected槽位使实例连续存活(真机DOM引用恒等验证sameDomInstance=true) |
| `759426db` | docs(progress): hover→selected跳闪双根修登记(描边宽度恒定+拖拽视觉态延后) |
| `277960a4` | fix(canvas): hover→selected跳闪双根修 - (1)选中描边1→1.5px宽度突变改恒1px+inset阴影环合成(零重排,颜色平滑过渡); (2)纯点击mousedown曾立即进入拖拽视觉态(isNodeDragging/dragPreview)触发供给guard隐藏→mouseup恢复=工具栏/composer闪隐一次, 改为越过3px拖拽阈值才进入视觉态, 点击路径不再经过 |
| `a3549328` | docs(progress): 面板动画语义澄清登记(契约范围纠偏+affordance属性两用冲突根修+scale锚origin终形态) |
| `9a8701b7` | fix(canvas): 面板开合动画改fade+scale(0.96)锚定触发器origin - 用户澄清渐显不变形仅约束供给本体, 选项面板应有可感知开合; scale以origin为锚对称收放(贴近触发器的边零位移)替代绝对translateY, 终态=静止态不可偏移; 恢复自建气泡transformOrigin(上轮误删); 供给归属data-affordance与affordance-in视觉规则解耦(裸属性选择器曾覆盖气泡开合动画为纯淡入) |
| `7d8f5f93` | docs+chore: rAF可见性判据闭环(激活标签+非全遮挡, 焦点无关, 8-100px阈值浮动不背) + timer节流同归因hidden修正(注释) |
| `4bbeaf0d` | docs(progress): CDP冻结rAF归因修正 - debugger附着不冻结rAF(实测61Hz), 真因是hidden标签停发rAF+awaitPromise探针attach死锁; 动画验收姿势修正 |
| `8ad125d3` | docs(progress): 面板位移偏移根修登记(纯淡入淡出+gap4) |
| `ff75fb14` | fix(canvas): 面板开合动画去位移改纯淡入淡出 - 6px微浮在贴合几何下被读作瞬间偏移盖住工具栏/向下错位(用户三组截图症状统一根因), 准备帧不再钉transform防类序列异常残留; 自建气泡gap 8→4贴合触发器 |
| `d18ad0ac` | docs(progress): 面板开合动画偏移错位根修登记 |
| `5b3b8435` | fix(canvas): 面板开合动画偏移错位根修 - leave-active移出prepare语义important块(收起动画复活), hidden注入改afterOpenChange门控, 微浮方向锚定触发点(--panel-float-y), 设置气泡纳入归属域+开气泡钉composer full |

### Status

[OK] **Completed**

## Session 2: 2026-09-16 composer 归属节点重构 + P4 生视频族双任务归档
<!-- trellis-session: v=2 fp=20260916-composer-video -->

**Date**: 2026-09-16
**Task**: 09-15-composer-inline-hover-chrome + 09-14-p4-video-family（双双归档 archive/2026-09/）
**Branch**: `main`

### Summary

双任务收尾归档。①composer 归属节点重构（09-15）：外部浮动 composer 面板是堆叠节点误触类缺陷的结构性根源，用户裁决混合方案——hover 显示节点内信息态（只读提示词+引用横滚行，零按钮），selected 保持底部挂件面板；S1-S4 全落地，经历三轮用户量化反馈（缩略 74px→flora 42px 量级、裂图文本引用、字号 hover/selected 一致），终局照 flora AssetChip 源码（0_di9:9952-9982）逐条重写缩略胶囊（壳 h-10 自由宽/hover 底色 58,58,58,.95/缩略 scale-0.8/meta 仅过渡 max-w 0→80/引用行容器 min-w-0）。教训：此前多轮"已修"为探针假阳性（读 meta 计算样式未量容器实际宽度）；CSS 探针 walker 需检查 r.cssRules.length 防空递归漏计。②P4 生视频族（09-14）：D-A count>1 批量提交链（executeVideoBatchGeneration 与图像同构，mock 频道真机 A1/A2 验收）+ D-B 播放面 S5 loop（Vidstack provider 命令式）+ S6 差异裁剪（完成瞬间 1.5s 信息态保护）+ S7 终验（A5 全量门绿 31 fail 全在基线、A3 代码链复核、A4 五点对照表）。附带修复画布存量 "[object Object]" 持久值自愈。07 号快照刷新至 09-16。遗留:PR #488 CI 待上游触发、fork 推送、P4 下一族(角色引用)。

### Git Commits

| Hash | Message |
|------|---------|
| `82a7f6c2` | fix(canvas): hover缩略照flora AssetChip源码重写 - 壳h-10自由宽/hover底色58透明起步, 缩略hover scale0.8, meta max-w-0→20仅过渡max-width, 引用行容器w-max改min-w-0(flora 0_di9:9952) |
| `e497f481` | docs(progress): 缩略flora源码级重写登记 |
| `ae99b7c0` | docs(canvas): 修正hover缩略失实注释 - flora ×Remove按钮未引入属信息态只读约定, 非遗漏(review P2) |
| `fc527ae5` | chore(task): archive 09-14-p4-video-family |
| `f4f4e096` | chore(task): archive 09-15-composer-inline-hover-chrome |

### Status

[OK] **Completed**

## Session 3: v1.3.0 rebase 尾声修复（2026-09-16）

### 完成内容

**v1.3.0 rebase 收尾**（承接本 session 早段的重放与污染事故）：

1. **project.tsx 结构修复**：`{!focusMode}` 残留悬空块（CanvasOverlayLayerContainer 碎片 11 行）删除、assistant 三元后缺失的外层 `</div>` 补齐、旧 CanvasNodeToolbar 第三实例（onKeep/onLeave 时代，29 行）整体删除、HUD「分割」action 移除（上游已收敛进 toolbar picker）、toolbar `onSplit` 对齐上游 `(node, params)` 签名。
2. **union 污染行清除**：shared.tsx / canvas-node-toolbar.tsx / use-canvas-node-operations.ts / settings/index.tsx 四文件散落的裸 commit-subject 行删除。
3. **portrait-clearance 恢复**（上游 9727656b 删除 → 按既定方针从 backup 恢复）：lib/contracts、input-bindings、vision、modal、icon、services/portrait-clearance-runtime、local-runtime-bootstrap，`CanvasNodeMetadata.portraitClearance` 字段回补，project.tsx 的 state/inputs/addPortraitCandidateToCanvas/Modal 挂载四处接回。
4. **agent 体系换云**：上游 v1.3.0 以 cloud-agent 整体替换旧 assistant 面板（codex 本地直连/agentMode/skill-runtime 的 onlineAgent/localAgent profile 全废）。旧体系 19 文件（canvas-assistant-panel、local-agent-panel、agent-session/protocol/tools/ops/context 等）随上游删除；project.tsx 挂载点换 `CanvasCloudAgentPanel`；visibility hook 回上游简版；model-picker 的 channelMode==="local" 判断对齐上游。
5. **上游拖柄合入**：NodeExternalHeader 增加 GripVertical 拖柄 button（onDragStart + locked/disabled 语义 + setPointerCapture），canvas-node.tsx 调用点接线——修复 canvas-node-title-interaction 测试。

### 教训

- **恢复依赖链要一次到位**：从 backup 恢复文件时先 `git ls-tree -r` 确认准确路径/扩展名（canvas-assistant-online-tools 是 .ts 不是 .tsx，猜错扩展名白跑一轮 tsc）。
- **删码前先判"时序错配 vs 真冲突"**：canvas-assistant-online-tools/cinematic-continuation 在 git 全历史无创建记录（是重放队列后段才建的文件），备份恢复版引用它们只是重放中间态现象。
- **上游债识别要实测**：go test 失败先在 origin/main worktree 复跑——TestCloudAgentNodeTypesExposeExecutableAllowList 上游自测同样失败（9868f5e8 注册 batch-table 后期待数 7 未改 8），不是重放错误，登记基线即可。
- **测试断言"源码串包含"是化石**：storyboard-panel/mention-editor 的源码字符串断言在上游 HEAD 自身就失败，全部基线化。

### 提交

| Commit | 内容 |
| --- | --- |
| `5adc9b89` | 重放污染清理 + portrait/agent 体系重建 + 拖柄合入 |
| `4803cacf` | 删除旧 assistant 面板残留探索副本 |
| `docs` | pending-test.mdx 登记 v1.3.0 尾声修复批 |

### 验证

- tsc 0 errors；vite build 通过（47.46s）
- bun test 1732 pass / 21 fail 全部在已登记基线内（较 v1.2.9 基线 ~35 还收敛了）
- go test 除上游债 1 测试外全绿（app 包 153s 全跑确认）
- fork WindC0X 已 force-with-lease 推送至 5c67f51b（fork/main 零独有提交复核后）

### Status

[OK] **Completed**（待用户真机过一遍 v1.3.0 界面回归）

## Session 2026-09-18（下午）：P4.5 横切插入 + P5 fork 推送

**执行内容**（canvas/MASTER-PLAN v1.1 指令三任务 + P5）：
1. **P5 fork 推送**：fork/main 3b449ccb → 43253b44，115 提交 fast-forward 实证（merge-base --is-ancestor FF-OK），远端备份与 PR #488 头同步。
2. **PATCH-MAP.md Top20**（位置：**仓库根**，供同步 SOP §4.3 步骤 3 对照）：fork 独有 globals.css 直改提交实测 **75 条**（canvas 侧记 69 系 W2 前口径）。按三层令牌体系分类框架（A 纯令牌值 / B 结构性 / C 保留直改）登记热区权重 Top20——挂件/composer 6 条（含 P1.5 最新批 5e0c3c67/095b1f72/cc383e14）、模型菜单 S08 5 条（权威值 P51-030 族）、微供给 2 条、参数面板 4 条、appear 幽灵防线 1 条、S04 生成态 1 条、同步卫生 1 条（a97122ce 死 CSS 清删=C 类代表）。其余 55 条按族分组列回填清单：不阻塞族 3，下次同步仪式前完成二分登记，外置重构（W3 起）动工前全量回填。
3. **纪律落地**：「新增 UI 一律走三层令牌，不再直改组件规则」写入 .trellis/spec/frontend/component-guidelines.md；**fork 版本后缀**自下个发布起用 `v<上游版>-flora.<n>`（v1.5.0 撞号不追改历史，package.json 0.1.0 不涉及）。
4. **口径统一**：flora-evidence-kit/00-MASTER-PLAN.md 三处「每周 rebase」统一为「双周仪式 + 事件触发（积压超 1 个 minor 周期即同步）+ merge 式」，与 canvas/MASTER-PLAN §4.3 对齐；07-TOTAL-SCHEME-STATUS 快照已刷新至 09-18（族序 3.5/4、W1-C/W2 同步、挂件验收、viewport 定性）。

**冲突裁决记录**：flora-evidence-kit 分支设计（flora/quiet+flora/grammar）从未启用、实际 main 直做——与 canvas MASTER-PLAN「main checkout」实质一致，旧文未改（仅口径统一，分支设计注记于此存档）。

**下一步**：族 3（角色引用/分镜）开工——上游侦察 → Trellis 立任务。同步 SOP 新增的「自动并入段审计」（tsc+死 CSS 扫描+DOM 抽审）自下次同步生效。

## Session 2026-09-20：Agent 撤销面板收尾 + 执行容错/HUD 归宿批次

**任务**：09-18-agent-undo-panel 归档（archive/2026-09/）。撤销链 A1-A4 真机全通，A5/A6 撤销阻断语义经真机与截图确认，缺陷全部登记后逐项修复。

**修复批次**（全量提交，pending-test.mdx 均有登记）：
1. **撤销链双根修**：hash 剔除对话外观字段（chatSessions/activeChatId）与节点级时间戳（反射归一，type-switch 在 []map 执行链失配导致口径分叉 4.7KB）——链式撤销自毁根除，A3 双连撤真机全通。
2. **内容口径 hash**：模型可见 snapshotHash 剔除节点 position（拖动不再使写入失败），账本/undo 保持完整口径保住 A5；409 冲突转工具结果让模型重读重试；63 位抄断 hash 自动补全（真机 5 连败实锤）；Agent 创建节点补 createdAt/updatedAt（HUD 创建行不再回退画布级误导时间）。
3. **媒体参数错位静默忽略**：图片/音频模式携带 videoGenerateAudio/durationSeconds 不再拒绝（模型坚信音频开关必填、重试循环无法自愈，真机 2 轮实锤）；validate 同分支标注防御层语义。
4. **review P2-1**：同轮第 2+ 次写调用的截断哈希补全（复用已加载文档零额外 DB 读），新增用例⑥。
5. **HUD 归宿三轮演进**（用户逐轮拍板）：几何让位 → 相交淡出（否决）→ **纯层叠**：HUD 固定右上角家 right:16 零漂移，z 降 panel-floating(80) 低于面板基线 110，面板路过自然盖住移开即露；hudRightInset 几何让位/min() 钳制整段删除。真机验证含正常/超宽双分支（2016px 精确命中）与层叠三态。

**环境教训**：Chrome 原生窗口遮挡检测使后台标签 visibilityState=hidden、CDP 输入静默丢弃——桥 tabs switch 只聚焦窗口不解除遮挡，需 PowerShell SetForegroundWindow + 确认 vis=visible 后再真实输入；同画布双开标签会被误当操作目标。

**挂账**：Agent 生成媒体成功态 HUD「大小/格式」行复核（前端补全链路代码级确认等价，钱咖渠道已关停，待渠道可用）；上游 v1.3.x 积压 19 提交待下轮同步仪式。

**Status**：[OK] Completed（任务归档，撤销面板与执行容错批次交付）

## Session 2026-09-20（晚）：控制线批次〇/一/二执行中

**批次〇 上游侦察**（docs/upstream-sync-recon-v1.5.1-v1.5.6.md）：fetch 实测 80 提交（merge-base 8d60a516，882 files +53k/−42k）。五高危亲读：cfcc53a9（chat-ui/panel class 化重构撞撤销条质感现场, 高）、8d94bde1（多规格调价新体系+入口球可拖动, 中）、0ea9f7d9（模型选择严格校验 vs 我方 799e5503 静默忽略——语义正交可共存, 拍板项）、33908ed1+cb68476e（连线/字号/F-02 域, 中）、易支付链（新文件为主, 低-中）。**控制线未点名的实为最大冲突：adf3a5be**（61 文件 +3510, Agent 执行链重写：上下文预算/prepared_media/终态恢复/resource lease——canvas_state ±113 上游仍全口径 hash、step_hash +36 mutation-chain 走链中继、runtime ±354 撞我方 409 容错分支；我方三修复须重放, 建议单独人审会话 0.5-1 天）。025b5e84+f3875357 vs S08：上游 revision CAS+schema v23 历史快照+草稿保留, 我方跨会话水位门——结构取上游、水位语义重放, 高危手术区。5eab8126 样式拆分（globals.css −1031 行→shared/model-picker.css 843 等）改写 W3 加载序假设（整个 styles import 链末端）+ P51-030 flora 值随迁。58 提交 bulk 分类由 4 并行子代理完成, 结果回传后回填笔记 §五。
**批次一①**：flora 暗色"重置"代码级定性完成——use-canvas-project-lifecycle.ts:123 加载画布时 setTheme(文档外观) 是"每个画布自带外观"的产品语义（文档态/可撤销/分享跟随）；缺陷成分=无"未自定义"判据导致派生默认值被钉死+无过渡提示；当场修需 schema 加 custom 标记（非小修）→ 结论报用户拍板（A 维持+门3补采走画布外观路径 / B 立跟随开关卡）。
**批次一②**：卫生清单已报用户（4 分析文档 / ComfyBridge×3 共 18MB 零引用 / .workbuddy-ai/ / 新发现 agent-panel-overlay-zorder.test.ts 未跟踪但 5/5 绿建议提交）。
**批次二**：09-20-flora-w3-tokens 卡已立（prd.md+design.md 落盘, 覆盖表/加载序/取舍/风险段含基线时效缺口; 任务保持 planning, 代码等同步落地）。

**批次〇收尾（bulk 回填）**：4 子代理（347K tok/$0.0081/708s）以 merge-file 三方模拟实测各提交冲突 hunk。关键增量：①adf3a5be 上游把 mediaSnapshotHash 也重写为内容口径（fail-closed 白名单，剔 position/width/height/时间戳）——与我方 cloudAgentContentHash 平行演进但字段集不同，模型可见 snapshotHash 上游仍全口径（canvas_state:247 vs 我方 :237 交叉验证）；②agent-canvas-patch.ts 删除语义双实现撞车（我方 211e4495 撤销守卫 vs 上游通用删除 patch）；③237f2e2a 端到端删 frontend 模型目录来源，我方后端仍实现且前端仍消费（语义破坏型）；④canvas_undone 无条件刷新 vs 我方终态回放不喂同步；⑤17ffdda0/8e3692ea/9148ceab/af5b5b20/506f463d/b99ad798 project.tsx 全中；⑥零碰撞先遣队 19 提交可先放行；⑦4 组原版/合并版同内容对按合并版取一次；⑧image_layer_split 写工具必须纳入我方撤销/step_hash 白名单。拍板清单 8 项已入笔记 §六。合并人审预估 2-3 天。

## Session 2026-09-20（夜）：控制线新一轮——拍板执行 + adf3a5be 专项 + 合并日材料

**拍板执行①（用户已拍板，勿再议）**：
1. flora 暗色 = A 维持现状。定性收敛：use-canvas-project-lifecycle.ts:123 加载画布时 setTheme(文档外观) 是"每个画布自带外观"的产品语义（文档态/可撤销/分享页跟随），测试线探针 result.md 互证"设计使然"；缺陷成分仅是无"未自定义"判据（需 schema 加标记，非小修）。B 选项（画布外观跟随工作台开关）登记 backlog 候选（不立卡）。
2. 卫生四项已执行：①4 份分析文档（117K）mv 至 F:/CODE/Project/canvas/analysis-2026-09-20-control-batches/（untracked 文件无法 git mv，用 mv）；②ComfyBridge×3（18.8MB）mv 至 F:/CODE/Project/canvas/comfybridge-bin/（移出 web/public 防静态资源下发）；③.workbuddy-ai/ 写入 .git/info/exclude（本地生效，合并日后上游 .gitignore 未盖再升级）；④agent-panel-overlay-zorder.test.ts 提交收编（5/5 绿）。工作区 0 untracked。
**undo 接线自报**：已闭环（归档+真机自验证据 pending-test.mdx A3 链式双连撤+根修代码在盘），批次三前无需补课。

**批次三（bulk定稿）**：抽查两处高危亲证——①hash口径（canvas_state 上游:247 fullHash vs 我方:237 contentHash）②删除语义双实现（上游 agent-canvas-patch:52 通用删除 vs 我方:48-50 撤销权威守卫）。笔记 §五 定稿。
**批次四（adf3a5be 专项三卡）**：docs/merge-ruling-cards/01-03 落盘。卡1 hash口径=三口径分工（模型可见取我方 contentHash、账本不动、mediaHash 采上游字段集）; 卡2 step_hash=融合（上游链式证明+我方截断修复, 二者正交）; 卡3 runtime=取上游全量+409分支4行嫁接（上游:1104 无特例, 我方唯一hunk恰落其媒体重排区, 嫁接点同构明确）。
**批次五（拍板清单裁决卡）**：04-09 落盘——04 模型校验正交共存; 05 删除语义融合（上游patch语言+我方来源约束）; 06 S08结构取上游+水位门重放（跨会话硬门不可被"保留编辑分支"吞掉）; 07 canvas_undone取我方门语义（回放复活已实证）; 08 frontend目录删除=建议取上游收窄, 4消费文件清单+运维前置（系统渠道须已配置）; 09 globals直改逐条对账（新选择器收, .ant-*全局!important不搬, outline策略采纳）。
**白名单机械项**：cloudAgentWrite（tools.go:279）预置 image_layer_split（合并前不可达, 合并后进 step_hash 接力/审批门）; 撤销账本经 recorder 内容式记账（media.go:557+runtime:894/1102）无需改; go build+相关测试绿; commit ac485844。
**批次六**：先遣队19提交三方复验顺延（时间富余项, 子代理已做过 merge-file 模拟, 复验归入合并日执行）。

**插入项：F-06 合入（门2绿信号）**：防御自查空（feat/ecom-f06-outpaint..main 无独有提交，分支头 d9fa9d0f 已含 a0cf2155）→ merge --no-ff 零冲突 efa1c4f9（含 outpaint 后端域 media_outpaint+前端 overlay/geometry+geometry 测试）→ 推送：origin(ddcat-ai) 403 按历来权限形态映射为推 fork（eab151bd..efa1c4f9 fast-forward）→ 栈重启（旧 vite/后端为合入前代码）：后端 GOSUMDB+GOTOOLCHAIN=auto+buildvcs=false 组合（go1.26.0 toolchain 下载成功），数据目录 .local/project-workbench-debug；vite 清 .vite 缓存 + VITE_API_PROXY_TARGET=8081。健康：3000/8080 双 200，/api/health ready=true go1.26.0。待用户真机复验扩图框开合。

**F-06 真机复验缺陷定性（用户 4 截图，2026-09-20 21:26）**：
①"所选模型不支持当前请求: 参数 生成质量超出支持范围"（Gpt Image 2+16:9+2K）——**根因实锤**：overlay 的 submitQuality（域内 "auto"）在 outpaintImageNode（use-canvas-media-tools.ts:814）被 normalizeMaskEditQuality(:52) 改写——该函数对 auto+像素 size 猜测 tier（"2752x1536"=4.2Mpx→"2k"），gpt-image-2 quality 域 [auto,low,medium,high] 不含 "2k" → MatchCapability 拒绝（model_router.go:298）。该函数为 mask-edit 写的猜测逻辑误伤扩图链。
②价格 pill 溢出/截断/0.00——quote 失败（catch→null）回落 configuredCredits??0 显示 "0.00"；grok 场景空槽=quote 未命中且无占位宽度保护；cost span（canvas-node-composer-submit-cost）无 min-width。
③maxImages=0 模型入扩图列表——DB 实证 grok-imagine-image-2.0 maxImages=0；overlay canExecute 有 >=1 门但模型候选列表未过滤（ModelPicker 全量 image 模型）。
④单独节点 hover 未到工具栏已全显——截图显示 hover info-state（底部 frosted 面板）活跃+toolbar full；需真机 DOM 探针查归属状态机 stuck 或 supply pin（疑似扩图源节点特有态），登记待真机查。
**检索纪律违纪自查**：本轮缺陷调查用连续 grep 硬凿代码链（违反 09-18 检索纪律升级），用户点名后纠偏——codegraph 3 步完成此前 10+ 次 grep 的链路（MatchCapability 14 callers/capabilityOptionsFromConfig 唯一 caller/ModelRequestIntentFromTaskInput 节点）。教训：混合调查（DB/git show/系统取证）不构成对代码链也用 grep 的理由，layer 判定应在每次探查前做。

**扩图四修（用户拍板"开始吧"+新增画质槽需求，2026-09-20 晚）**：①quality 透传——outpaintImageNode 对 overlay 显式提供的 quality 直传（:659 mask-edit 路径不动），normalizeMaskEditQuality 的 auto→像素档猜测不再误伤扩图链；②价格精度——formatOutpaintCredits 最多 6 位去尾零（0.001 不再显示 0.00）；③ModelPicker 新增 hideIncompatible prop（默认 false 零影响）+ overlay 传 requirements.imageCount=1 → maxImages=0 模型不进扩图列表；④size 制+quality 域并存模型（gpt-image-2）新增画质槽（AUTO/LOW/MEDIUM/HIGH），与分辨率档槽并存；quality 制模型（grok）不重复展示。tsc 0 / 26 tests / build 53.85s，commit 3 files +52/-5，vite 重启新代码已服务（POST-transform 探针命中）。待用户真机复验：扩图不再报越域错、价格显示 0.001、列表无 grok-imagine-image-2.0、gpt-image-2 出现画质槽。④号缺陷（hover 全显）仍登记待真机探针。

**扩图复验第二轮四缺陷（2026-09-20 深夜）**：①任何比例切回"原图比例"框不变——onClick 对 ORIGINAL_RATIO_KEY 提前 return 未重置 padding，修=显式重置 DEFAULT_PADDING+展开动画；③④模型列表 L2 flyout 靠近底部不停上下抽动/hover 切 provider 抽闪——**通用缺陷不限扩图（用户纠正）**，定位循环减法项以上一帧渲染位测溢出（gBCR），溢出边界在两值间双稳态振荡、stable 永不满足 → rAF 永不停；修=贴底钳制改 offsetHeight 布局高度一帧收敛（与当前 top 无关）；②两个"一直进行中"任务——非扩图链缺陷：上游 api.ddcat.pronhubcn.com/v1/images/edits 对大 multipart body（pad PNG >1MB）读超时（单次请求挂 4.2/6.8 分钟后 400），且错误体 INVALID_IMAGE_EDIT 误落 invalid 归因显示"拒绝了请求"——修=providerPayloadErrorCategory 增网络超时类目（read tcp/i-o timeout/connection reset 先于 invalid 判定），真正修复在渠道侧网关。tsc 0/26 tests/go build+test 绿/前端 build 62s。vite 重启新代码已服务（flyoutClampedY 探针命中）；8081 用户栈后端未动（文案修复需其重启生效）。待真机：比例回切/flyout 悬停稳定/扩图换渠道重试。

**扩图第三轮（2026-09-20 深夜）**：①任何比例切回"原图比例"框不变——onClick 对 original 键提前 return，修=重置 DEFAULT_PADDING+展开动画。②占位/成功后尺寸跳变——活体库实锤同 metadata.size 节点尺寸 811×452 vs 422×236（2 倍差），机制=四条几何写入路径三个基准（占位 fitNodeSize 全局 720/520、任务回写 fitNodeSize(上游实际, bounds=nodeSizeFromRatio(NODE_DEFAULT))、fitToImage 全局、ensureMediaNodeMinimumSize base=node 自身）+上游不按提交像素出图（1679 vs 1824，outpaintSizeMismatch 角标机制存在的原因）；**修=扩图占位框 manualSize 合同**：占位 metadata.manualSize=true，回写（edit+manualSize 保持 node 尺寸）/ensureMediaNodeMinimumSize 偏差分支/fitToImage（已尊重）全链不改框，偏差走角标。tsc 0/36 tests/build 115s。vite 已重启（探针命中）。CANVAS_PUBLIC_BASE_URL 报错定性=上游 openai-images 插件 manifest requiresPublicMediaUrls:true 合同（带参考图需公网 URL），非存储故障；mask 类工具不受影响，fork 侧改合同登记 backlog 待用户拍板。

**扩图第四轮·真机自验（2026-09-21 00:07-00:30）**：用户报"修复后依旧变小+hover工具栏全显"，要求自验（影策渠道 gpt-image-2）。tmwd 真机走查：①活体 DOM 复证根因——同 metadata.size=1824x1024 两个成功节点画布尺寸 811×452 vs 422×236（viewport 52.6% 下 425×237/222×124），铁证 :931 执行链 `fitNodeSize(输出, node.width, node.height)` 的 node 是**源图节点**而非占位（竖版源图把横版结果钳到源宽）→ 修=:746/:931 成功回写保持占位框（commit a973fe62）。②真机提交链全通：扩图 overlay→ModelPicker 影策 Provider 分组 hover L2 flyout→gpt-image-2 选中（计费 0.005 影策价✓）→任务创建 CHANNEL_000006 ✓。③上游 /v1/images/edits 连接层 4 连败（3×EOF+1×TLS handshake timeout，00:19-00:25）——真机"成功后尺寸比对"未闭环，等上游恢复。④发现重试链（任务中心"重新生成"）与执行链语义分叉：重试 input 带 referenceImages.storageKey 撞 requiresPublicMediaUrls 水合合同，首跑执行链不带不触发——已登记 pending-test。⑤"被 capability 过滤"是我定位行时正则漏匹配的错误归因，用户纠正正确（影策项在 Provider 分组 flyout 内可见可选）。

**请求明细"少账"根因（2026-09-21 01:0x）**：用户报明细停在 23:56:07 强刷无效——实为后端 bug 非前端/缓存：api_call_logs 列以 mattn 驱动本地时区字符串落盘（"+08:00"后缀），normalizeAnalyticsFilter 的 From/To 是 UTC time.Time，mattn 绑定输出 "+00:00" 后缀字符串，SQLite 字典序比较下 to="2026-09-21 00:00:00+00:00" 恰好卡在本地 9/21 00:00-00:11 之间，把本地 9/21 00:00 后记录整批排除（实测 API total=475 vs 表内 484 非 download，差 9 条=9/21 00:11-00:34 全部）。修复=filter 转 .Local() 同格式比较（commit 待查号）。教训：①多实例环境（A线3000/8081、B线3001/8181、F-06 172.24.183.185:8080）先分清数据源再下结论——本轮把 B 线/主线/本地栈混为一谈绕了三大圈；②cookie 同名互踢（3000/3001 同 host 不分端口共享 open_ai_canvas_session）是用户"一天登 800 回"的根因，修法=给 B 线配 CANVAS_SESSION_COOKIE_NAME（auth.go:25 原生支持），待用户拍板接线；③8081 重启后才生效，留给用户操作。

**图片生成/扩图四连反馈（2026-09-21 09:3x）**：①auto 参数 1:1 结果节点比同图小一号——task-sync:146 回写 bounds 在 auto 时取占位框（旧比例），把 1:1 输出钳小；修=auto 时 bounds 改全局标准 imageConfig，结果按输出 fit（显式比例行为不变）。②扩图结果外圈黑圈+半透明——定性=上游 gpt-image-2 对 edits 端点输出自带透明 alpha 通道（PNG），feathered mask 是上游生成特性非前端渲染缺陷；canvas-node-content 的 img object-contain 不加底色，透明区域透出深色画布底即"黑圈"观感；不修（上游语义，且"叠在原图上查看重合"恰好可用）；若要白底/棋盘格占位是独立 UI 决策。③扩图结果节点内部 composer 去除——hoverComposerNodeType 门控补 metadata.edit !== "outpaint"，types/canvas.ts 补 edit?: "outpaint"|"mask" 正式声明。④用户顺带确认 auto 占位合同修复生效（占位保持生成前比例 ✓）。commit e46780ce。tsc 0/相关测试绿/build 47.6s/vite 探针 1。

## 2026-09-21 扩图结果内部 composer 消除（两轮）

用户指出扩图结果节点 hover 仍有内部 composer。第一轮修复（e46780ce）写错链路：`edit: "outpaint"` 写进任务提交 metadata（落 task.inputJson），但门控 `canvas-node.tsx:313` 读节点 metadata——任务回写链 `completedTaskMetadata()`（canvas-generation-task-sync.ts:304）只透传簿记字段不透传 inputJson.metadata，门控从未命中。tsc 通过掩盖了数据流断裂，验证止步编译未走运行时链。

第二轮修正（ab0a627f + 43b26edc）：
1. 占位链真写：`use-canvas-media-tools.ts:889` 扩图占位节点 metadata 写入 `edit: "outpaint"`，随占位进结果节点（回写靠 `...node.metadata` 保留字段）。
2. 历史节点指纹回退：存量扩图节点无 edit 标记，用 `generationType === "edit" && manualSize === true` 组合判别——该组合仅扩图占位写入（图生图/局部重绘占位无 manualSize，宫格子节点无 generationType），不迁移旧数据即覆盖。

教训沉淀：改"标记驱动"的门控前必须画清三条链（写入链→存储→读取链）确认合流点；类型补声明会让 tsc 通过一个运行时永远为空的字段。

另：透明扩图（alpha 渐隐）定性为上游 gpt-image-2 模型行为，B 线 gpt-image-2.5 同链路内容实——建议用户换渠道模型验证，未改代码。

## 2026-09-21 双域 review 修复批（扩图+撤销，全部修正）

Review 报告（工作流 4 代理 + 人工复核，OCR 通道失败放弃）后执行"全部修正"，5 批提交（dca4b909 / 3d?→62c3bd67 链）：

1. **扩图前端**（dca4b909）：批量子节点 edit/manualSize 合同、提交 try/重入/onerror、aspect_ratio submitSize、ratio 小数+拒绝、mask 物化重试恢复、mismatch 下沉回写链。
2. **扩图后端**：40MP 解码上限、配额补三段式、ratio 0.2-5、prepare 能力预检、scale 按轴、snap16 钳 0、预览 size 一致、meta.outpaint→edit、网络分类限引号外。
3. **撤销后端**：恢复粒度对齐 hash 口径（排除字段移植）、运行中任务节点拒绝删除、非终态禁 undo、appearance 排除、preview 5xx、currentSnapshotHash 改名、账本 200 条有界、死分支注释、mediaContentHash 去重。
4. **撤销前端**：flush→POST→adopt 同临界区、adopt 失败 discard 哨兵、canvas_undone 无条件刷新+穿透 replayOnly、预检归一、busy 生命周期、removals 活体 basis。
5. docs/env 登记。

**误报澄清（重要）**：review P1"replayOnly 固化"经核查为误报 —— 后端每轮消息创建新 run ID（handler 注释 "Each additional message starts a new immutable turn and returns its ID"），panel setRun 换 id → 订阅 effect 重跑 → 门控按新 run 状态重算。未实施改动。

**验证**：tsc 0 / build 44s / go vet+build+test ./... 全绿 / bun test 1874 项 19 失败全部 stash 对照实锤 pre-existing（断言漂移×3 + 并行抖动 + 诊断缓冲区基线）。零新增失败。

**教训**：判定"回归"前必须验证协议事实（run ID 生命周期），不能凭代码片段推断。

### 2026-09-21 扩图"改原图内容"诊断（登记不改）

用户报扩图结果改动原图内容。实据链：① 上游请求逐字核对 → pad 底图(1024² JPEG) + mask(1024² PNG，74% 全透明) + 透明区 prompt + size 均正确送达；② 修复批对扩图链的改动面最小（mask 物化/onerror 仅错误路径；后端 scale 仅 Agent 链，本次走画布直连）；③ 修复前后各两次扩图的"原图区保真度"模板匹配 MAD 16–29（像素保真应 ≈0–5）→ 全都重绘，无回归；④ 渠道 CHANNEL_000006 是 ChatGPT Web 中转（下载域 chatgpt2api、route: 算法超分/direct transfer），无 mask 输入 → mask 被丢，模型整幅重画。用户裁定"先只登记不改"，备选方案（保真合成/换渠道/档位下限）落 pending-test。

### 2026-09-21 二次 review（4 路独立对抗）与 P1/P2 修复

四路复核首轮修复批（39e1e037..HEAD）：36 项判定"落地且正确"，**2 个 P1 回归 + 3 个 P2 为我引入**，已全部修复（c1bfc149 链）：
1. **P1 撤销事务结构性死锁**（复核人已真实复现）：`waitForRemoteProjectLoads` 读实时 map，会等排队在事务之后的 load → 自锁、尾随队列永久卡死。修复 = 临界区入口同步快照 pending load，只等快照。回归测试双向验证（旧代码 timeout/新代码 resolved）。
2. **P1 渠道模型扩图 prepare 全量失败**：`CapabilitySpecFromModelCapabilityConfig(&normalized, string(m.Protocol))` 传协议串 → default 分支「未知模型能力类型」。修复 = `normalizeCapability(m.Capability)` + 契约测试。
3. P2×3：undo POST 补 15s 超时；Agent 扩图 ratio 补 0.2–5 边界；扩图重入守卫改可见提示；`storeResourceFromBytes` 补 Pending/Failed 分支；`containsOutsideQuotes` 逐字符扫描防转义引号击穿。

方法论收获：**修复即引入回归**——把长网络调用（POST）塞进串行临界区必须同时检查区内所有"等待外部状态"的调用（本次是 flush 里的 load 等待）。复核用真实运行（死锁复现脚本、能力反解实调）而非只读代码，才抓到这两个 P1。

---

## 2026-09-28 S2 hover 说明卡封版（轻量枝 · fc18a40d→572f32ca 六提交链）

- v1（`fc18a40d` + `22708b60`）：数据驱动 hover 卡覆盖左栏 Dock 10 项 + 节点菜单 16 项（26/26）；状态机 200ms/140ms/Esc/指针入卡；门禁四件绿；真机矩阵 `.local/s2-walkthrough/`。
- S2.1（`582220d2` + `858aec8c`）：控制线判「形态简陋」后一轮重写为 flora 四层配方（41px 头/长句/366×229 预览盒/footer）；位图预览退场 → 15 大图标 + 11 手写 SVG mockup；偏离登记 PATCH-MAP D1（#949494 AA）/D2（footer 中文化）；现场捕获 2 缺陷（CSS 漏 position:fixed、进场帧测量吃 transform）并补回归断言。
- 加固（`b5dc75e7` + `572f32ca`）：用户复核发现双卡叠放 → 逻辑级复现失败、环境硬数据（节流 435-955ms vs 60ms 余量）→「全局单卡不变式」（layout 先关后画，escape 语义保再武装）；+2 单测、:3013 真机冒烟绿。控制线方法账收录（与 F-06「钩进单一漏斗」同方法论）。
- 控制线封版回执（2026-09-28）：通过——独立核证（numstat 对账 / 三处必改实证链 / focused 重跑 / 红队五路推演）全绿。Detector 3 处置：①② 矮视口叠压触发器 + 滚区键盘不可达（同根）→ 修缮期 backlog（清单已登记）；③ reduced-motion data-entering 挂死 → 代码核验误报，不修。
- 归档：`67fbe8aa`（chore task archive，含清单登记）；用户侧 3 项真机复核挂 pending-test 不阻塞。环境：:3010/:8483 保持；:3013 用户标签待自行刷新。

---

## 2026-09-28 S3 ? 帮助菜单四件套（轻量枝 · f19720e0→43736e44 四提交链，含 micro-fix 轮）

- 交付：顶栏「?」四件套（教程 / 快捷键复用 / 反馈聚合 / changelog 复用）；反馈 = 纯前端聚合（描述+截图本地预览+分享 toggle+「将包含以下信息」明示区；复制写剪贴板；零后端）。
- 首轮门禁：全量出现 5 条超时型波动（ui-kit-retirement/http-ownership 全 src 快扫描，基线期 3.0-3.4s、当日 5.1-6.3s 越 5s 线）→ 控制线独立复验定性环境变慢、非回归。
- micro-fix（控制线收编 1-7 + 产品裁定 8-10，改完不再回审）：渠道去 GitHub 化（DOCS_BASE_URL 空置待产品域名 + 教程项禁用「教程编写中」；邮箱 fengw5774@gmail.com + 用户群 qm.qq.com 双通道，复制为第一公民）；明示区条件行（buildFeedbackManifest）/ 分享时效提示 / 剪贴板失败降级只读文本框 / 关闭焦点归还「?」/ 对比度提亮 / alt+aria-describedby / 快扫描测试超时 20s rider。
- 验证：tsc 0 / focused 94 绿（12 文件组）/ build ✓ / 全量 2320 → 15 红逐名=冻结基线、零超时波动；fix 轮走查（.local/s3-walkthrough/ s8-s10）：禁用项零动作、注入拒绝→降级文本框→恢复成功清除闭环、分享条件行+时效提示、焦点归还实测。
- 提交：f19720e0 + ac180b47（首轮）→ 3b1f49a1 + 43736e44（micro-fix），不 push；S3 封版，转 S4（产品裁定已同步 S4 prd 口径）。


---

## 2026-09-28 S4 文档 Diátaxis 重排封版（轻量枝 · 7f527424 + 0083403f）

- 交付：内容层四分组（getting-started/agent/canvas/assets/reference）+ Quickstart 新页 + 静态 llms.txt（16 页索引，手工维护头注）+ pending-test 迁 docs/plans（D6 清账）；17 文件全 R 识别 rename；meta.json ×8（含根与 plugins 新建）。
- 引用同步：README（3+1 死链全清 + 导航块）/ docs/index.md / AGENTS.md §9 与 3 处路径 / mdx 互链 7 处 / S3 常量注释对齐；活跃面旧路径零命中（豁免明列：.trellis 历史、设计变更日志、recon 快照、构建产物）。
- .gitignore 五组白名单重写 + `!docs/llms.txt`；曾捕获根 meta.json 被 `docs/content/docs/*` 吞并修正；git check-ignore 逐文件核验。
- 验证：守卫测试 `docs-diataxis-consistency.test.ts` 4 用例；门禁 tsc 0 / build ✓ / 全量 2324 → 15 红逐名=基线零额外。
- 控制线封版（2026-09-28）：37 文件对账 / D6 双面 grep 独立复验 0 命中 / 守卫重跑 4 pass / llms 零 GitHub 指向 / quick-start 抽查 全绿；S3 micro-fix 轮一并核证通过。
- 行政：S1 任务卡归档（`2d1ec7c0`，回执批准）；S4 归档随封版；转 O-03（本枝最后一项）。

---

## 2026-09-28 O-03 层1 直出引导封版（轻量枝 · 1b3cd2df→fc78f10e 五提交链，含 polish + 域外修复轮）

- 交付（`1b3cd2df` + `ecd02c4c`）：渠道预设组（Amazon 主图 1:1 ≥1600 / 详情长图 3:4 ≥1440×1920 / 抖音竖版 9:16 ≥1080×1920，`desiredResolution` 预留）+ min(预设,能力) 四态交集（full / capped+徽标 / short+缺口+换模型建议 / unconstrained，绝不静默）+ 价目档一致性降级链 + 药丸预设态（`1:1 · 4K` + 渠道小标 + ✕ 取消回自动）+ 默认画质档位（经济/标准/旗舰，吸附于 `defaultImageParamsForModel`，不可得不应用）；纯前端、零依赖、零 globals。四态/吸附/取消/建议全分支 +30 单测；真机走查 s1-s6。
- 首轮验收（控制线 2026-09-28）：功能主体通过；UI polish 一轮后封版（① 两条常驻说明行收 tooltip；② 比例角标补 hover 说明——design 明文 title 因 pointer-events-none 实际不可达；③ s5 长文案判断权下放）。
- polish + 域外修复（`d265f86e` + `32cfb3db`，预算 0.5+0.3 人日内）：S2.1 hover 卡新增 mini 变体（`ToolHoverCardMiniContent` + `useToolInfoCard`，共用状态机/定位/单卡不变式，z1150 高于设置浮层）承载「已应用 / 档位说明 / 角标释义（预设名+最低像素）」；s5 文案判定保留可见不收起。域外修复（控制线特批，根因报告在案）：A 节点引用表去 skill 混入（技能仅留 Agent 面）；B hover composer 补 ✦/Skill 分支；真机全量扫描 65 节点 22 条引用、技能标记 0 命中（账号实装 2 技能）。
- 验证：tsc 0 / build ✓ / 全量 2361 测试（309 文件）→ 15 红逐名=冻结基线零额外（+7 新测试）；走查 s7/s7a/s8（`.local/o03-walkthrough/`）。
- 报备：缺口 G1-G4 未修（上报制）；同 fallback 链 tool 类引用仍落 T/Image 缺省（授权范围外，观察项）；环境注记（本环境「小白鼠 Gpt Image 2」含 4K）。
- 行政：`fc78f10e` 落卡；`5af47ab4` 归档；全枝功能项完结，待合并批次任务书（flora + 轻量枝一批合入）。

---

## 2026-10-03 F-02 商拍场景图合入 main（10-commit 批次 · --no-ff · 53af70b2）

- **合入拓扑**：`git merge --no-ff feat/ecom-f02-scene`（@ `8cb02bf9`）→ `53af70b2`。
  **merge-base 登记**：F-02 起点 `7e19af47`，其祖先含上游同步 `d328a257`；
  `7e19af47..53af70b2` 区间**无新的上游同步合并**（仅本次 F-02 merge）——本次为纯内部合入。
  合入前文件重叠检查：F-02 批次 vs 同期文档批（`7079fca4`）零重叠文件，合入零冲突。
- **批次构成（10 commit）**：任务书 `eb2873ec` → 两段式管线 `09f71614` → 场景库 `b32fa4f0`
  → 入口过渡形态 `f581a25e` → 统一任务面 `d81a22db` → 执行记录 `3e3a8b74`
  → 生成链路接线 `579fc853` → 执行记录补齐 `37adc98c` → 双冠词修正 `1b81aec6`
  → 验收②记录 `8cb02bf9`。
- **批次统计**：15 文件 +1945/−10（含 8 个新文件：4 个 lib + 4 个 test）。
- **同期文档批（先于合入）**：`7079fca4` docs(design) 前端吸收 26 条落笔——
  DESIGN.md 四节 19[D] + docs/design 细则 7[d] + globals.css D8 纪律注释 + PRODUCT.md
  Anti-references 补句（措辞=裁定原文逐字）。
- **合入后门禁**：`bun run build` ✓ 2m13s；全量 `bun test 2>&1` **2596 pass / 0 fail**
  （331 文件）。控制线点名的 `canvas-asset-repair` 7 红：单文件复跑 **10 pass / 0 fail**，
  确认基建归因（非本次合入引入）。
- **push**：`fork`（WindC0X）`7e19af47..53af70b2 main -> main`；
  local `main` == `fork/main` == `53af70b2` ✅；`origin`（ddcat-ai，只读）未动。
- **环境收尾**：:3021 / :3020 / :8080 / :9230 / :9231 全空闲；:3010 归测试线 twins 独占
  （PID 1125057，oac-wt-f01 vite），未触碰。
- **验收依据**：门2/门3 GO（测试线轻量门 `23209f4`：链路 6/6 + VRT 24/24 零 diff +
  bun 2589/7 既有基线）；控制线独立抽查通过（fast-forward 拓扑确认 +
  canvas-asset-repair 单文件复跑 10/10 绿）。

---

## 2026-10-03 O-03 层2 图片超分合入 main（8-commit 批次 · --no-ff · de63c0aa）

- **合入拓扑**：`git merge --no-ff feat/o03-l2-superresolve`（@ `44dead1e`）→ `de63c0aa`。
  merge-base `7e19af47`；合入前文件重叠检查**零重叠**（O-03 侧 13 文件 vs main 侧
  22 文件无交集）；语义交叉检查：main 侧 `types/canvas.ts` 仅新增可选字段
  `scenePresetId?`（F-02），O-03 不依赖其变更 —— 无语义冲突。
- **批次统计**：8 commit / 13 文件 +1062/−9（含 4 新文件：`capability-entries.ts`、
  `super-resolve-params.ts`、`canvas-node-super-resolve-dialog.tsx`、
  `super-resolve.test.ts`；1 新任务书 `docs/artifacts/o03-l2-task-book.md`）。
- **批次内容**：注册表原生条目**首例**（`image.superResolve` 全字段独立 seed）+
  入口可达修复（`onSuperResolve` 死 prop → 补工具条目）+ 计费 selector 修复
  （`image_upscale` 独立价格档）+ **传输层覆盖缺陷回修**（`backendGenerationTaskInput()`
  按 mode 二次覆盖 operation，超分在 HTTP 层之前被丢回 `image`）。
- **★ 本批最大产出 = 教训库三族假命中集齐**（任务书 §12）：
  ① 中文文案子串双向失真（`/AI 超分/` 误中「调整尺寸」描述「不是 AI 超分」= 假命中；
  `!includes("调整尺寸")` 因自己正文引用该词 = 假失败）；
  ② 注释引用旧代码致 `not.toContain` 假失败（既有）；
  ③ **`includes` 弱断言 + 跨层断层**（本次新增：字符串断言只证明代码存在，
  无法证明运行时行为；go test 绕过 HTTP 层）。
  统一处置：行为断言落函数返回值/渲染结果；源码结构断言先剥注释再精确匹配。
- **合入后门禁**：`bun run build` ✓ 2m21s；全量 `bun test 2>&1` **2614 pass / 0 fail**
  （332 文件）。计数核对：2596（F-02 后）+ 18（O-03 新增）= 2614 ✓。
- **★ 跑法口径差异说明（控制线裁定，不必追改）**：本地全量报 **0 fail**，测试线报
  **7 fail**（mock-leak 基建），差异 = **单文件隔离跑法 vs 同盘全量跑法**；
  本批无引入性失败已双方确认（测试线 450dd45：DB 实测 `tasks.operation=image_upscale`
  修复后贯通 ✓ / 修复前 `image` 对照 ✓ / `go TestSKUSelector` 7/7 无回归 ✓ /
  结构断言可证伪性独立复验 ✓）。本地 `super-resolve.test.ts` 单文件复跑 18/0 ✓。
- **push**：`fork`（WindC0X）`809387b1..de63c0aa main -> main`；
  local `main` == `fork/main` == `de63c0aa` ✅；`origin`（ddcat-ai，只读）未动。
- **验收依据**：门2/门3 GO（测试线复验 450dd45）。

## 2026-10-03 W4 硬点收官

W4 硬点全部闭合：**F-01 合入 + flora 外置 + F-02 合入 + O-03 层2 合入 + 文档批落笔**。
下一任务 = **W4 架构方案正式化**（《能力组织层架构方案》，五件硬清单见
`canvas/能力组织层方案-2026-10-03.md` §9），本合入收尾后即开，不再等窗口。

---

## 2026-10-03 架构方案正式化合入（W4 收官件）

**合入**：`docs/capability-registry-architecture` @ `85343d10` → main `f8a15f23`（--no-ff，2 commits，单文件 659 行，零冲突）

**批次统计**：merge-base `b858bd1d`（= main tip，main 侧 0 新提交）；分支侧 1 文件 +659；合并后 main 21 文件（docs 单提交）

**内容**：能力组织层架构文档 —— 五件硬清单（① schema 字段表 ② AssetKind 15 值全集+归类映射 ③ 真值源裁定 ④ ID 命名空间防撞 ⑤ 收编回滚策略）+ 收编清单（167+3 渠道规格+评审资产）+ routeSlug 规格

**★ 三处实测修正（控制线采纳）**：
1. 收编基数 **81 → 80**（creationFeaturedWorks 实为 22）—— 差 1 根因=**计数方法陷阱**：`grep -c 'title:'` 误计类型定义行（第 3 行 `export type CreationInspiration = { title: string; ... }`），第 23 条数据不存在；同类污染审计：legacyCanvasStylePresets +5 / recommendedSelections +16 / CAMERA_PROFILES +10 / LENS_PROFILES +10 / 光照 clean
2. motion 33「收编但用户面不下发」升为**正式口径**（收编解决数据结构统一，跳过会让视频线启动时返工）
3. 待回改实码两项（`entryPoints` 入口登记 + `registryVersion` 版本锚点）列入 R25m 开工检查表

**教训入库（计数纪律，与「源码断言命中注释」indexOf 假命中家族合并登记）**：
资产计数**必须用数组元素配对**（或 AST），**禁止** `grep -c '<字段名>:'` —— 类型定义行/注释/样例代码均污染计数。

**两处纪律（控制线提示）**：§2.1 落枚举纪律（本枝不全落 15 值，防「定义了但没人用」反模式 #11 同族，audio/checkpoint 留槽）；§6.3 开工检查表 6 项设为 R25m 验收门。

**push**：`b858bd1d..f8a15f23` → fork WindC0X（fork/main == local main）；origin（ddcat-ai）未推。

**下一步**：R25m 收编枝开工令已下 —— 验收门=§6.3 六项检查表；范围=最小切片片 1-2（tools.json style 45 + legacyCanvasStylePresets 18）；只交分支不合入，门后合。

---

## 2026-10-04 R25m 收编枝合入（片 1-2 最小切片 + 门六项）

**合入**：`feat/r25m-registry-collection` @ `707231ae` → main `7e18af3c`（--no-ff，13 commits）

**批次统计**：merge-base `980fdef2`（= main tip，main 侧 0 新提交，0 上游同步 merge）；17 文件 **+1727 / −352**；合并后 main tip `7e18af3c`

**验收门六项（架构方案 §6.3 检查表，独立复验非采信记录）**：
| # | 检查项 | 独立验证 | 结果 |
|---|---|---|---|
| ① | 统一 schema 回改实码（`entryPoints` + `registryVersion` 升必填） | 读类型定义 | ✅ |
| ② | AssetKind 按**落枚举纪律** | 提取 union 实测 | ✅ **13 值**（非全落 15）；`asset/audio`、`model/checkpoint` 未落 |
| ③ | 命名空间守卫 L1 | 跑测试 | ✅ 12 tests / 103 expects |
| ④ | Go seed schema 对齐（`version` + 启动期校验） | 读 `tools.json` + go test | ✅ `version: 1` |
| ⑤ | 快照脚本 + sha256 | **实战三步** | ✅ 退出码 0/2/0 |
| ⑥ | docs 同步点 | 读 `code-map.mdx` | ✅ 登记注册表层 |

**片 1-2 全链**：
- 片 1：`tools.json` style(45) → seed → DB → API → 统一 schema（改动逐字透传验证）
- 片 2：`legacyCanvasStylePresets`(18) 页面私有常量 → lib 数据源 → 统一 schema → 降级态 UI
- 读取器语义：**服务端优先 + 降级必须标注 + 空列表不降级**（空态 ≠ 降级）

**门禁（合入后复跑）**：`build` 2m52s ✓ / 全量 `bun test` **2651 pass 0 fail**（334 文件，与合入前逐字一致）/ `go build 0` / `go test ./internal/tools/...` ok
**`internal/app` 5 失败**：main 基线独立复跑，失败测试名逐字相同（5/5）→ 既有基建（cloud agent runtime E2E，需 Node），非本批引入

**★ 教训入库（合并纪律族 —— 与假命中家族并列，控制线指定单独成行）**：
**文本零冲突 ≠ 语义兼容**。`git merge` auto-merge 静默通过（R25m 与 F-08 两个重叠文件均自动合并成功），但合并态 `tsc --noEmit` 报 **`TS2739`**：
```
src/lib/canvas/capability-entries.ts(155,5): error TS2739: Type '{...}' is missing
the following properties from type 'CapabilityEntry': entryPoints, registryVersion
```
文本合并会静默通过，**只有类型系统/机器护栏能抓住阻断**。这是门①字段强制（把 `entryPoints`/`registryVersion` 升为必填）**第一次在跨枝场景实战得手**。

**试合并实测三步（临时，已回退）**：① `git merge --no-commit --no-ff b182ef97` → 文本零冲突 ② 合并态 `tsc` → TS2739 ③ `git merge --abort` → 恢复 `6a8be55a` 树干净。

**跨枝条款入档**（架构方案 §1.4）：在飞条目合入前须同步补齐门①字段 —— 补字段是各枝自己的事，不由先合入方代改。
**F-08 需补两条**（非一条）：其 `image.superResolve` 条目也基于旧 schema（F-08 从 `b858bd1d` 起枝，早于 R25m 门①）；方案 A 修订版已发 B 线。

**两处口径澄清（控制线裁定）**：
1. 最终条目数 **= 2**（superResolve + annotateEdit），控制线原「3」口径已修正 —— 本枝全 refs 实测 + F-08 任务书（+1）+ F-08 测试（「两个原生条目」）三重证据
2. 方案 A 采纳（F-08 补字段），方案 B（可选化）否决 —— 可选化让待建字段失去强制力

**本枝附带修正**：架构方案 §2.1 落枚举计数 **7 → 9**（纪律提示文字与值列表不符）

**push**：`980fdef2..7e18af3c` → fork WindC0X（fork/main == local main）；origin（ddcat-ai）未推

**下一步**：片 3-9 待 F-08 合入、条目稳定后按序推进；明天双卡规格（统一任务面 / 直线入口）。

---

## 2026-10-04 F-08 合入（圈选改图 + 注册表第二原生条目 + 条目数 2 正式落地）

**合入**：`feat/ecom-f08-annotate` @ `021dc90c` → main `d924884e`（--no-ff，6 commits）

**批次统计**：merge-base `bca10aaa`（= main tip，纯 rebase 0 merge commit）；25 文件 **+2395 / −22**；19 新增 + 6 修改；合并后 main tip `d924884e`

**★ 能力条目数正式落地为 2**（控制线口径修正后的最终值）：
| 条目 | 来源 | entryPoints | registryVersion |
|---|---|---|---|
| `image.superResolve` | O-03 | `[{node-toolbar, superResolve}]` | 1 |
| `image.annotateEdit` | F-08 | `[{node-toolbar, annotationEdit}]` | 1 |

**F-08 全链（C1-C4）**：
- **C1 标注交互与几何**：矩形/箭头标注弹窗 + 纯函数几何（bounds+32px padding / 动态像素比 / 4096+16M 钳制）
- **C2 执行链换引擎**：提交构造/提示词/导出合成三模块 + `editAnnotatedImageNode` 模块化（替代内联硬编码）+ 弹窗双模式（形状+画笔）
- **C3 注册表与入口**：`image.annotateEdit` 条目（single_image）+ 工具条文案统一「圈选改图」+ 条目/谓词/入口可达性测试
- **C4 兜底路径与实测修复**：标注转蒙版降级（**真机验证一次**，非纸面备胎）+ 两处实测缺陷修复

**三裁定遵守**：① `contextRequirement = single_image`（圈选是弹窗内交互，入口前提只需单图）② 临时态 + 关闭确认 ③ 4096 + 16M 钳制

**★ B 线 rebase 解冲突记录（跨枝协调闭环）**：
F-08 原枝从 `b858bd1d` 起枝（早于 R25m 门①）。R25m 合入 main 后，`capability-entries.ts` **单文件真冲突**：main 侧 `assetKind` 已类型化为统一 schema 的 `AssetKind` 引用，F-08 侧是旧内联联合类型。
**B 线 rebase 解法**：保留 main 的 AssetKind 类型版（`import type { AssetKind }` + `assetKind: AssetKind;`）+ 追加 `annotateEdit` 条目 → 本次合入零冲突（由 rebase 保证）。
**独立核验三项**（合入前）：① 拓扑正确（6 commits 全落 `bca10aaa` 之上，0 merge commit）② 解冲突正确（AssetKind 类型版保留 + annotateEdit 追加 + 两字段齐全）③ 三处一致（fork remote = 本地 = worktree = `021dc90c`）

**跨枝条款实战闭环**：R25m 门① 把 `entryPoints`/`registryVersion` 升必填 → 架构方案 §1.4 补跨枝条款 → F-08 按条款补齐两字段（含 `superResolve` 旧版条目，非仅新增那条）→ 类型层兼容核验通过后合入。**这是「文本零冲突 ≠ 语义兼容」教训的完整正向闭环**。

**门禁（合入后）**：`build` 6m11s ✓ / 全量 `bun test` **2709 pass 0 fail**（339 文件，+58 vs R25m 的 2651）/ `go build 0` / `go test ./internal/tools/...` ok

**★ 本次重启事故一行（控制线主仓试合并超时）**：
控制线在主仓做 B线↔新 main 语义兼容试合并，命令撞 300s 超时被杀，遗留 `index.lock` + 半中断合并态；已 `reset --hard bca10aaa` 完全恢复。A 线独立核验：HEAD 正确 / 无 `index.lock` / 无 `MERGE_HEAD` / 工作区干净 / 9 个关键提交全部可达（零丢失）；悬空 `5e149e02`（`On main: review-fixes-temp`，2026-09-21）为历史残留非本次产物。**根因**：drvfs 上试合并成本被低估（上次测得快是因基线旧、对象少）→ **后续试合并只在 ext4 克隆做**（与既有「drvfs 慢 IO」教训同族）。

**push**：`bca10aaa..d924884e` → fork WindC0X（fork/main == local main）；origin（ddcat-ai）未推

**下一步**：等片 3-9 解锁令；明天双卡规格（统一任务面 / 直线入口，统一任务面需带 `workspace_type: headless_task` + TaskID 锚定工程约束，教训来源 `docs/plans/pending-test.mdx:3763` 撤销反噬实测）。

---

## 2026-10-04 R25m 片 3-9 合入（收编枝闭环 162/170 + 两项待办裁定）

**合入**：`feat/r25m-registry-collection` @ `97e4c2ac` → main `57714bb1`（--no-ff，4 commits）

**批次统计**：merge-base `707231ae`；6 文件 **+780 / −13**（1 新增 lib）；合并后 main tip `57714bb1`

**★ 起点口径勘误（控制线指出，一行记录）**：
交付报告曾称「起点 478cbeea」——**错误**。git 实测 `merge-base(main, HEAD) = 707231ae`，本枝不含 F-08（`021dc90c` 不在祖先链）。证据自洽：本批门禁 **2681 = 2651（R25m 片1-2 合入基线）+ 30（本批）**，F-08 的 +58 从未进过这条枝的测试跑。误因：把**快照基线**（`478cbeea`，那是主仓 HEAD）误记成了**枝基**。不返工。

**片 3-9 全量统计（99 条）**：
| 片 | AssetKind | 条数 | 源类型 | 交付形态 |
|---|---|---|---|---|
| 3 | `preset/lighting` | 8 | 本地 | lib 搬迁 `legacy-lighting-presets.ts` + dialog 接线（消除双份真值） |
| 4 | `preset/camera` | 8 | 本地 | 适配器直引既有常量（**零新文件**） |
| 4 | `preset/lens` | 8 | 本地 | 同上 |
| 5 | `spec/prompt-template` | 8 | **服务端** | 适配器 + 读取器 + 降级分支 |
| 6 | `spec/generation` | 22 | 本地 | 适配器（含 CC0 来源断言） |
| 7 | `preset/motion` | 33 | **服务端** | **零新代码**（窗口标注验证） |
| 8 | `template/canvas` | 9 | **服务端** | **零新代码** |
| 9 | `preset/channel-spec` | 3 | 本地 | 适配器 |

**★ 片 5 降级缺省裁定记录**：
skills presets **前端无既有常量**（`grep short-drama-starter` 命中 0）→ 按架构方案 §3.2
「禁止把 fallback 当默认路径」「禁止为降级**新造**第二份真值」，`loadSkillPresetAssets` 的
`localFallback` 参数**默认缺省**：服务端不可达时返回**空列表 + degraded 标记**，不凭空造数据。
降级分支 4 项测试（无源→空列表 / 有源→只收 local-fallback / 文案可读 / 混入 server 记录被过滤）
+ 可证伪性验证（注入 `degraded:false` → 4 fail；还原 → 55 pass）。

**★ recommendedCanvasStylePresets 待办移交（控制线裁定）**：
8 条（`canvas-style-system.ts` 的 `recommendedSelections`）**不收编为资产** —— 它是**引用型策展数据**
（选中集引用其他预设 id），不是新资产族；收编会造成「**资产引用资产**」的循环模型问题。
**归属裁定**：R25f-0（W7 用户层/推荐机制）的实现输入；架构方案 §2.2 收编清单备注一行
「引用型例外，移交 R25f-0」。**不静默、不新增 AssetKind。**

**评审资产**：边界未界定，维持 §2.5 标注不动，**W8 完成度盘点时一并处理**。

**★ 收编收官口径**：本批合入后 R25m 收编枝整体闭环 ——
**162/170 + 8 引用型例外移交 + 评审资产留观 = 收编清单全账清**。
两笔 UI 债（片 3-4 UI 降级条、片 6/9 页面接线）记入 **W5-W6 修缮缝隙候选**。

**门禁（跑在合并后的树上 —— 两线工作共存无干扰的最终证明）**：
`build` 5m16s ✓ / 全量 `bun test` **2739 pass 0 fail**（339 文件）—— 与控制线预期**逐字吻合**
（**2709 含 F-08 + 30 本批 = 2739**，比任何分支侧数字都有分量）/ `go build 0` / `go test ./internal/tools/...` ok

**合入前重叠核验（我方口径修正）**：首次用 `b858bd1d...021dc90c` 比较，误报 4 文件交集 ——
因 F-08 已 rebase 到 `bca10aaa`，其 diff vs **原始 base** 会把 R25m 片1-2 的文件算进来。
改用**正确口径** `bca10aaa..021dc90c`（F-08 自有 25 文件）vs 本枝 6 文件 → **零交集**，控制线核验正确。

**push**：`478cbeea..57714bb1` → fork WindC0X（fork/main == local main）；origin（ddcat-ai）未推

**下一步**：明天双卡规格（统一任务面 / 直线入口）。

---

## 2026-10-04 教训家族归并记档：跨枝比较纪律（三实例，控制线指定）

**家族名**：**跨枝比较必须用当前拓扑**（与「假命中家族」「计数纪律」并列的独立纪律族）

**共同根因**：把「某个时刻/某种口径下的比较结论」当成**恒定事实**使用，而拓扑或口径已经变了。

### 实例 1：文本零冲突 ≠ 语义兼容（2026-10-04）

`git merge --no-commit --no-ff b182ef97` → **auto-merge 静默通过**（两处重叠文件均自动合并），
但合并态 `tsc --noEmit` 报 **`TS2739`**：`image.annotateEdit` 条目 missing
`entryPoints`, `registryVersion`（门① 把这两字段升为必填后的跨枝外溢）。

**结论**：文本层无冲突**不等于**类型层/语义层兼容。文本合并会静默通过，
**只有类型系统/机器护栏能抓住阻断** —— 这是门①字段强制第一次在跨枝场景实战得手。

### 实例 2：零冲突结论过期（2026-10-04）

我在 `707231ae`（R25m 未合入 main 时）做过试合并，测出**零冲突**并记档。
R25m 合入 main 后，F-08 枝直接试合并 main 会出**真冲突**（`capability-entries.ts`：
main 侧 `assetKind` 已类型化为统一 schema 的 `AssetKind` 引用，F-08 侧是旧内联联合类型）。

**结论**：试合并结论**只在被测的拓扑上有效**，拓扑一变即失效。
记档时必须写明**被测拓扑**（如「测于 `707231ae` 上的 main」），否则后续误用。

### 实例 3：重叠核验口径错误（2026-10-04）

合入前重叠核验，我首次用 `git diff --name-only b858bd1d...021dc90c` 比较（F-08 的**原始 base**），
**误报 4 文件交集**。实际 F-08 已 rebase 到 `bca10aaa`，该 diff 把 R25m 片1-2 的文件算进了 F-08 侧。
改用正确口径 `bca10aaa..021dc90c`（F-08 **rebase 后**自有 25 文件）→ **零交集**。

**结论**：跨枝重叠比较**必须用 rebase 后的 base**，不能用原始 base。

### 纪律（三实例归纳，可复用）

1. **比较结论必须绑定被测拓扑** —— 记档时写明 base/tip（如「测于 X 上的 Y」），
   拓扑变更后结论自动失效，需重测
2. **比较必须用当前拓扑** —— 跨枝重叠核验用 rebase **后**的 base；
   试合并前先确认 main tip 是否已变
3. **文本层通过 ≠ 语义层通过** —— 文本合并静默通过是**常态**，
   必须叠加类型检查/守卫测试才能确认兼容
4. **drvfs 上试合并成本随对象数增长** —— 只在 ext4 克隆做（控制线事故根因）

**关联前科**：drvfs 试合并超时事故（控制线主仓，300s 被杀 + `index.lock` 遗留）；
「假命中家族」（源码断言命中注释）；「计数纪律」（`grep -c '<字段名>:'` 误计类型定义行）。

---

## 2026-10-04 · 控制线两条记档（R25n / R25d 审查）

### 记档 1：R25n 验收第 9 项 = 例外性硬门槛

控制线裁定（2026-10-04）：**「验收第 9 项（模型真实输出符合三态的真机门槛）是全卡最硬的一条
—— rubric 改了模型不遵守 = 机制失效」**。

**例外性**：R25n 的 1.5 人日中，**真机验证占核心权重**（非附属步骤）；
届时需要**测试线配合真机轮**（不是纯单元测试可覆盖的）。

**登记理由**：这是**首个「rubric 内容改动」类任务**，其验收面天然包含「模型是否遵守」，
与纯代码任务的验收面（类型/测试/构建）不同。

### 记档 2：★ 第五族教训 —— 文档时效族

控制线裁定（2026-10-04）：R25d 实勘发现深拆说「三件小事」实为两件
（`options` 升 chips **已兑现**，深拆基于数据层推断未追渲染层）
—— **归档为第五族「文档时效族」**：

> **消费深拆结论前先核实实现层。**

**与既有四族的性质区别**（控制线明确定性）：

| 族 | 性质 | 例 |
|---|---|---|
| 计数纪律族 | **我的误判**（工具用法） | `grep -c 'title:'` 误计类型定义行 |
| 假命中族 | **我的误判**（断言面） | `source.includes` 命中注释 |
| 跨枝比较族 | **我的误判**（口径） | 用原始 base 比较 rebased 枝 |
| 样本偏差族 | **我的误判**（抽样） | 5 样本外推全量 |
| **文档时效族** | ★ **既有文档的判断随代码演进而过时** | 深拆说缺 chips，实为已兑现 |

**⇒ 关键区别**：前四族是**我判断错**；第五族是**文档过时**（当时可能正确）。
**处置不同**：前者需改我的方法，后者需**核实流程**（消费前先验实现层）。

**适用范围**：**后续所有 R25 系列消费**（深拆吸收落地方案的 30+ 项 R 任务）。

---

## 2026-10-04 · PATCH-MAP 复盘完成（W5 垫尾项）

**结论**：flora 外置承诺**已兑现** —— `globals.css` 在真实试合并中**自动合并成功**（零冲突）。

**关键数据**：
- 试合并：我方 `c68b595a` × 上游 `125864f6`（merge-base `d328a257`）
- 冲突 23 / 自动合并 242；**23 个冲突中样式类为零**
- globals.css diff 面：`+1220/−85` → `+850/−41` → **`+309/−41`**（−64%）

**★ 最大发现（新增 PATCH-MAP L 系列）**：上游**去令牌化**趋势 ——
上游把 `var(--canvas-mention-chip-offset-y)` 内联为字面值 `-0.08em`（令牌定义保留、使用点删除）。
核实：令牌是**上游原生**（非 fork 引入）。
影响：flora 外置**依赖令牌层**，上游去令牌化会**缩小可覆盖面**（不改变当前方向，但需关注）。

**纪律遵守**：试合并只在 ext4 clone 做；abort + stash pop 环境复原；不 push。

**产出**：`docs/artifacts/patch-map-review-2026-10-04.md` + `PATCH-MAP.md` L 系列 + 冲突面基线（供下次同步对比）。

---

## 2026-10-04 · W5 修缮缝隙批合入登记（AST-08 首个第三类兑现）

**合入**：`--no-ff` merge commit **`5c6be4fc`**（parents `124144b1` × `96883521`）
**分支**：`fix/w5-repair-gaps`（6 commits：85ff494d 实码 + 5 docs）
**规模**：9 文件 **+743/−0 纯新增**（无删除行）
**push**：fork WindC0X（`124144b1..5c6be4fc`），origin 未触碰

### 交付内容

| 项 | commit | 内容 |
|---|---|---|
| 任务 1 | `85ff494d` | **AST-08 双向引用只读 API** —— 判据第三类「数据在但未产品化」**首个兑现** |
| 任务 2 | `29d808cc` | IMG-06 引用 + B-2 注记更正（三处陈旧表述 + 三处断言实码核实） |
| 任务 3 | `5fd31efb` 等 | 片 3-4 降级提示条 **改判 A（不接，关闭）** |

### ★ AST-08 的意义（判据第三类的首个实例）

#13 审计的核心方法论贡献是**判据三类化**（在「前端缺出口 / 后端缺实现」之外补第三类
「**数据在但未产品化**」，最低成本档）。AST-08 是这一类**从概念到交付**的首个实例：

- **数据已在**：`resource_delete.go` 的 `resourceUsage{Kind,ID,Title}` 早已采集引用
- **缺的只是出口**：数据仅用于「删除被拒时的提示文案」
- **本次补齐**：同一套扫描**只读地**暴露（`ResourceReferences` / `AssetResourceOccupancy`）

**★ 最值钱的设计决策（控制线审查语）**：**同源复用** —— 查询与删除判定走同一套
repository 扫描 + `assets` 引用解释器，保证「预检数字」与「删除被拒提示」**不会漂移**。
这是「一套逻辑两处使用」而非「两处各写一遍」的典型。

**★ 最需守住的一条（控制线明令）**：**「给而不要求」** —— 引用预检是**信息不是门禁**，
加载中/失败都不阻塞删除。与设计卡 G4「在画布中打开」同哲学（给而不要求）。
**回改时谁都不许把它改成阻塞式门禁。**

### 门禁

| 项 | 结果 |
|---|---|
| `bun run build` | exit 0（5m42s） |
| 全量 `bun test` | **2743 pass / 2 fail**（340 文件，2745 总数） |
| `go build -buildvcs=false ./...` | exit 0 |
| `go test ./internal/app/...` | 5 项失败（**已知基线**，逐条同名） |
| AST-08 专项（Go 6 例） | **6 pass / 0 fail** |

### ★ flaky 2 例的定性（环境证据，非代码）

`web/test/ui-kit-retirement.test.ts` 的 2 个**文件扫描型**测试超时（20s 线）。

**决定性对照实验**：

| 环境 | 耗时 |
|---|---|
| `/mnt/f`（drvfs） | 19753ms / 22198ms / 21485ms |
| `/home/windc0x/oac-ext4/oac-wt-test`（ext4） | **46ms / 31ms / 27ms** |

**⇒ 约 500 倍差异，纯环境（drvfs 慢 IO），与代码零关联。**

**辅助证据**：本批**未新增 `web/src` 文件**（990 → 990 未变），只改 2 个已有文件
—— 扫描成本完全不变，不可能是本批引入。

**⇒ 记档：drvfs 上 src 全扫描测试的 20s 线不足，ext4 上同一测试 <50ms。
将来该测试在 /mnt/f 全量跑中会周期性假红，属环境基线，非回归。**

### 控制线裁定要点

1. **合入 GO 即入 main 不等 B 线** —— 修正了 A 线对口头意向的「转述升级」
   （A 线曾理解为「等 B 线批完成后测试线一轮覆盖两批再按序合入」，控制线澄清从未如此说过）。
   **理由**：本批 9 文件纯新增、与 B 线在飞枝零交集、含 backend 新文件独立验证价值高。
2. **B-2 gitignore 缺口记档不动手** —— `_synthesis` 整目录被忽略（40 文件未追踪），
   任务 2 的更正不在版本控制内。**今天不动**：`git add -f` 或改 gitignore 都是独立小决策，
   挂 W5-W6 缝隙批（候选：`_synthesis` 去 ignore 化或迁 docs/ 正规化，与 journal 化同步评估）。
3. **教训记档（控制线）**：**给线下令前，先检索该线此前的诚实边界声明是否与本令冲突。**
   （任务 3 的下令错误根源：机械搬运上午记档时未做语义复核，
   而 A 线 09:07 交付片 3-4 时的诚实边界声明正是那四项事实的来源。）

### 今日 A 线收官（八件全绿）

#13 关闭（含判据三类化）+ 双设计卡 + R25n + R25d + PATCH-MAP 复盘
+ AST-08 + 文档更正 + 任务 3 收口。
**明日**：统一任务面实现批（守卫测试首件）。

---

## 2026-10-04 · W5 直线入口卡合入登记（全周期闭环）

**合入**：`--no-ff` merge commit **`7da08b2a`**（parents `fa54be95` × `8459b42e`）
**分支**：`feat/w5-linear-entry`（3 commits：be41808d C1-C3 + 2e9805f9 一轮修复 + 8459b42e 二轮修复）
**规模**：13 文件 **+2049/−9**（5 个新测试文件 841 行）
**merge-base**：`5c6be4fc`（我方 main tip），**零重叠**
**push**：fork WindC0X（`fa54be95..7da08b2a`），origin 未触碰

### 全周期（设计卡 → 实现 → 两轮真机修复 → GO）

| 阶段 | 内容 |
|---|---|
| 设计卡 | `06a24ad0` W5 直线入口设计卡（四层梯度 + scenePresetId 显式传递 + 首批卡 ≤8 约束） |
| C1-C3 | `be41808d` 可执行卡网格 + 卡定义/门控 + 卡流程执行器 + scenePresetId 显式传递 |
| 一轮修复 | `2e9805f9` 卡流程模型接线与比例语义（b12r16 NO-GO 修复） |
| 二轮修复 | `8459b42e` size 传模型可接受值（1:1→1024x1024 / 3:4→1024x1360） |
| 验收 | 测试线 b12r16-③R2 **GO**（尺寸面缺陷闭合，两卡 succeeded，console 0） |

### ★ 教训 1：「纯函数测试全绿 ≠ 接线可用」

B 线 C1-C3 交付时单元测试全绿（`linear-flow-cards` / `linear-flow-gate` /
`linear-flow-runner` 等纯函数覆盖充分），但**真机一跑就 NO-GO** ——
问题不在纯函数逻辑，在**接线**：
- 卡流程未正确把模型配置传给执行链
- 比例语义（`size`）未按模型可接受值传递（1:1 传成了模型不认的格式）

**⇒ 归入既有教训族「有代码≠能用」（反模式 #12）的真机变体**：
单元测试证明「函数正确」，不证明「接线正确」。
**验证形态必须包含真机端到端**，纯函数测试只是必要条件不是充分条件。

**与前科的关联**：O-03 的 `source.includes` 弱断言教训（字符串断言只证明代码存在）
→ 本条是它的**上游变体**（纯函数断言只证明函数正确，不证明被正确调用）。

### ★ 教训 2：双 size 协议发现

比例语义修复暴露了一个**双 size 协议**：
- **前端画布尺寸**（节点 width/height，用于渲染与布局）
- **模型输入尺寸**（`size` 参数，模型实际接受的枚举值）

二者**不是同一个概念**，此前被混用 —— 卡流程把画布尺寸直接当模型尺寸传，
模型不认（1:1 是画布概念，模型要 `1024x1024` 这类具体值）。

**⇒ 纪律**：跨层传递尺寸时必须明确是「画布尺寸」还是「模型尺寸」，
命名与字段都要区分。这条对未来所有涉及生成的卡/预设都适用。

### 门禁

| 项 | 结果 |
|---|---|
| `bun run build` | exit 0（4m53s） |
| 全量 `bun test` | **2834 pass / 0 fail**（345 文件） |
| `go build -buildvcs=false ./...` | exit 0 |
| `go test ./internal/app/...` | 5 项失败（**已知基线**，逐条同名） |

**基线口径**：控制线预期 ≈2833，实测 **2834**（+1，无 flaky 本轮）。
对比修缮批合入时的 2743 pass + 2 fail（flaky）→ 本轮**无 flaky 复现**。

### 附：B 线毕业机制接线开工

控制线令：合入完成后直发 B 线毕业机制接线开工令。
## 2026-10-04 · 超分收口批验收 + 两项裁定登记

**验收**：八件验收通过（控制线 2026-10-04）。表扬三处：探针→修复→验证完整闭环、
可证伪纪律成为标准动作、任务 4 动效不自建 prefers-reduced-motion 的判断正确。

### 裁定①：「0.1/次」= 0.1 积分

**image_upscale 占位价 = 0.1 积分/次 = 100,000 microcredits，正式定价待用户。**

理由（控制线）：用户面计价全线用积分（钱包/账单/展示），元只是渠道成本侧概念。
占位价继续有效，正式定价用户随时拍板一键改。

### 裁定②：占位标注不加列、不加默认档工厂

**理由**：`PriceVersion` 字段已存在但语义是版本号，复用会污染。

**前提核查结果（与裁定表述有出入，已上报）**：

| 层 | 是否有描述位 | 实测 |
|---|---|---|
| 价格档级 `ChannelModelPriceTier` | ❌ **无** | 字段仅 CostPricing/ID/ChannelModelID/SelectorKey/SelectorJSON/Selector/Resolution/VideoSeconds/ProviderModelKey/BillingMode/UnitPrice*/PriceConfigured/Enabled/PriceVersion/时间戳 |
| 价格档表单 | ❌ **无** | Form.Item name 仅 billingMode/cachedTokenPrice/enabled/inputTokenPrice/matchMode/operation/outputTokenPrice/priceConfigured/providerModelKey/quality/resolution/size/unitPrice |
| 模型级 `ChannelModel.Description` | ✅ 有（size:500） | 但表单自述「**在创作端二级渠道选项中常驻显示**」→ **面向终端用户可见** |

**⇒ 裁定②的两条路径实际只有路径①可执行**：
- 路径① journal 登记 ✅ **已执行**（本条）
- 路径② 「管理端该价格档的描述性字段」——**价格档无描述位**，条件不成立；
  模型级 Description 虽存在但**用户可见**，写入「占位价，待定价」会把内部
  占位状态**泄露给终端用户**，不宜使用

**加列是 schema 决策**，挂渠道接线批评估（低优先）—— 控制线原令。

### 边界 #3 更新（渠道可用性已闭环）

报告已更新为「已由 b12r16-③R 覆盖」：测试线真机出图成功（1445×1088 succeeded），
`nano-banana-2` 作为超分改图模型**真机验证通过**。

**附精确说明（已上报）**：`1445×1088` 恰是**修复前**的尺寸继承污染症状
（960×960 源 → 继承 4:3 的 1360x1024）。我的 size 修复（`4e7d36ec`）**仍在
branch-only 分支上未合入**，测试线 ③R 跑的是**不含该修复**的代码。
故：**渠道可用性闭环成立**；**size 修复的真机效力**待分支合入后另跑验证。

### 边界 #5 升级为正式项

控制线裁定：前端预估价差**登记为渠道接线批正式项**，修法
`ModelRequirements` 加 `imageOperation` + `imagePriceOperation` 按 operation 返回。
原话：「**不许它变成隐性账单偏差**」。

### 控制线复核裁定（2026-10-04，两处均成立，处置采纳）

**复核一：裁定②修正为单路径。** 控制线认可枚举核查推翻其指令：
- 占位状态**只记 journal**（已执行，认可）—— 单路径足够，占位期短（定价后即删）
- 模型级 `description` 驳回理由扎实：用户可见，写入会**内部状态泄露给终端用户**，
  违反自家「形状标签不是用户概念」原则
- **管理端硬编码提示文案：否决**（为一行占位状态改 admin 组件不值当）
- 加列维持挂渠道接线批低优先

**复核二：边界 #3 拆两个命题。** 控制线承认其「闭环」说法过宽：
| 命题 | 状态 |
|---|---|
| 渠道可用性（nano-banana-2 能出图） | ✅ **已闭环** |
| size 修复真机效力 | ⚠️ **未验证** |

**控制线原话**：`1445×1088`「**反而是 bug 的复现实证**」。
「不夸大不冒充证据」正是这条纪律该有的样子。

**size 修复真机验证排入下轮**（合入后测试线轮次顺带）：
验证点 = **1:1 源图 → 长边 2048 精确达成 + 比例保持**。

### 合入安排与待命

**两批一起排一轮验证**：本批（超分收口批）+ B 线接线批（在飞），
两批文件面**零交集**，一轮覆盖两批省一次全量。

**imageOperation 预研不做**：渠道接线批开工时随批侦察
（核心是 `ModelRequirements` 加字段，半小时的事，不值得单独预研）。

---

## 2026-10-04 · W5 两批按序合入（b12r17 GO）· B线毕业机制 + A线超分收口

**合入**：`--no-ff` 两枚 merge commit，最终 **`d60519e3`**
**顺序**：先 B 后 A（测试线 twin 实测顺序已验证，5b000de0）
**push**：fork WindC0X（`29892dfa..d60519e3`），origin 未触碰

| 步 | 批次 | merge commit | 父 | 规模 |
|---|---|---|---|---|
| 1 | B 线 `feat/w5-graduation` @ `53f032cf` | `0e1f111f` | `29892dfa` × `53f032cf` | 11 文件 +964/−6 |
| 2 | A 线 `feat/w5-superresolve-closeout` @ `30a97b5a` | `d60519e3` | `0e1f111f` × `30a97b5a` | 18 文件 +1029/−33 |

**零冲突**：两批文件面交集为空（合入前 comm 核验）；A 线基点虽旧（`fa54be95`），
journal 自动合并成功，无冲突标记，两段完整保留。

### 门禁（一轮覆盖两批）

| 门 | 结果 |
|---|---|
| `bun run build` | exit 0（4m39s） |
| 全量 `bun test` | **2908 pass / 0 fail**（348 文件 / 14957 expects） |
| `go build -buildvcs=false ./...` | exit 0 |
| `go test ./internal/app/...` | 5 项已知基线（逐条同名） |

**基线口径**：控制线预期 ≈2908，实测 **2908** —— **精确命中**。

---

### B 线毕业机制全周期（设计卡 → 接线 → 两轮真机修复 → GO）

| 阶段 | 内容 |
|---|---|
| 设计卡 | 直线入口卡的同族（四层梯度 tier-1 `LinearFlowGate` allowed/locked/hidden） |
| 纯函数层 | `graduation-state.ts` 状态机 + 6 动作白名单 + B1 分组 |
| 接线四件 | `types/canvas.ts` 加 `"guide"` + `graduated?`；`project.tsx` 入口推导；`tool-registry` 判据扩展；顶部「完整画布」出口 |
| 真机修复 | 两轮（b12r16 NO-GO → b12r17 GO） |
| 验收 | 测试线 twin 顺序实测 `5b000de0` |

#### ★ 接线双纪律（本批教训，控制线指定登记）

**纪律一：纯函数测试全绿 ≠ 接线可用**（A 线同批独立发现，两线同族）

C1-C3 纯函数层测试全绿，真机一跑 NO-GO —— 问题不在纯函数逻辑，在接线
（模型配置传递 + size 格式）。归入「有代码≠能用」（反模式 #12）真机变体，
且是 O-03 `source.includes` 弱断言的**上游变体**
（字符串断言证存在 → 纯函数断言证正确 → **都不证接线/调用**）。

**纪律二：接线新增 import 可能引入循环依赖 → 必须跑关联测试**

| 项 | 内容 |
|---|---|
| 现象 | `canvas-node-toolbar.test.ts` 报 `ReferenceError: Cannot access 'registry' before initialization` |
| 根因 | 白名单原在 `graduation-state.ts`，`tool-registry.ts` 需消费它 → `tool-registry → graduation-state → node-hover-tools → tool-registry` **循环** |
| 修法 | 白名单抽到**零依赖叶子模块** `graduation-tools.ts`；`tool-registry` 只 import 叶子；`graduation-state` re-export 保持既有导入面 |
| 防线 | 新增 4 条测试（源码断言 + **运行时验证注册表可用且无重复**） |

**教训**：单跑目标测试**不够**，必须跑**关联测试** —— 本轮靠
`canvas-node-toolbar.test.ts` 抓到，若只跑 `graduation-*.test.ts` 会漏网。

**附语义澄清（B 线实测修正）**：`GUIDE_VISIBLE_TOOL_IDS` 是**上限不是固定值** ——
`generateImage`/`editText` 仅文本节点适用，`uploadImage` 仅无图时适用；
各节点类型下是它的子集，**绝不超出**（guide 态实测：图片 2 项 / 文本 4 项 / 视频 3 项）。

---

### A 线超分收口批全周期（八件全绿）

**step 0 探针**（控制线评「质量极高」）：静默落通配价**机制确认**
（`matchSKUSelector` 对空键与 `"*"` 直接 `continue`），具体 `0.005` 金额未复现。

**任务 1-5 + 两项追加**：
- 任务 1 管理端 `image_upscale` 四同步点
- 任务 2 `mode`→提示词翻译 + 追加 A（size 继承污染）+ 追加 B（faithful 强化）
- 任务 3 链路验证三段式（任务创建 / 计费精确档 777 / 上游请求构造发出）
- 任务 4 UI 样板件 token 化（W6 弹窗家族先行样板）
- 任务 5 `executionChain.requiredOperations`

#### ★ 双 size 协议（本批独立发现）

比例语义修复暴露**双 size 协议**：
- **前端画布尺寸**（节点 `width/height`，渲染布局用）
- **模型输入尺寸**（`size` 参数，模型接受的枚举值）

二者**不是同一概念**，此前被混用（卡流程把画布尺寸直接当模型尺寸传，模型不认）。

**⇒ 纪律：跨层传递尺寸时必须明确是「画布尺寸」还是「模型尺寸」，命名与字段都要区分。**
适用于未来所有涉及生成的卡/预设。

#### ★ 占位价单路径裁定（控制线两轮修正）

| 轮次 | 裁定 |
|---|---|
| 初令 | 占位状态记两处：journal + 管理端价格档描述性字段（若有） |
| **前提核查（推翻）** | 价格档级 `ChannelModelPriceTier` **无** remark/note/description（全字段枚举）；价格档表单**无**描述位（Form.Item name 全枚举）；模型级 `ChannelModel.Description` 存在但表单自述「**在创作端二级渠道选项中常驻显示**」（`channel-model-editor.tsx:281`），`model-picker.tsx:827` 实际消费 → **用户可见** |
| **终裁** | **单路径**：占位状态只记 journal。模型级 description 因**用户可见**不可用（内部状态泄露给终端用户，违反「形状标签不是用户概念」原则）；管理端硬编码文案**否决**（为一行占位改组件不值当，占位期短）；加列挂渠道接线批低优先 |

**image_upscale 占位价 = 0.1 积分/次 = 100,000 microcredits，正式定价待用户。**

#### 边界 #3 拆两命题（控制线复核采纳）

| 命题 | 状态 |
|---|---|
| 渠道可用性（`nano-banana-2` 能出图） | ✅ **已闭环**（③R 真机出图成功） |
| size 修复真机效力 | ⚠️ **未验证** |

**关键时序发现**：③R 出的 `1445×1088` **恰是修复前的症状值**
（960×960 源按 4:3 继承 `1360x1024` → 长边 2048 对齐 = 1445×1088）——
控制线原话「**反而是 bug 的复现实证**」。本批 size 修复当时仍在 branch-only
分支未合入，③R 跑的是不含该修复的代码。

**size 修复真机验证排入下轮**，验证点：**1:1 源图 → 长边 2048 精确达成 + 比例保持**。

#### 边界 #5 升级为正式项

前端预估价差（`imagePriceOperation` 只返回 `image_to_image`/`text_to_image`，
`ModelRequirements` 无 `imageOperation`）→ 预估按图生图算、后端按 `image_upscale` 收。
控制线裁定**登记为渠道接线批正式项**，修法 `ModelRequirements` 加 `imageOperation`
+ `imagePriceOperation` 按 operation 返回。原话：「**不许它变成隐性账单偏差**」。

---

### 本批教训汇总（三族）

1. **接线双纪律**（B 线 + A 线同批独立发现）
   - 纯函数测试全绿 ≠ 接线可用
   - 接线新增 import 可能引入循环依赖 → 必须跑关联测试
2. **双 size 协议**：画布尺寸 vs 模型尺寸，跨层传递必须区分命名与字段
3. **占位价单路径**：内部状态不得写入用户可见字段（前提核查推翻初令，
   枚举式核查 > 抽样判断）

**方法论共同点**：三条都源于**「验证形态必须匹配被验证对象」** ——
纯函数测试匹配不了接线，单文件测试匹配不了循环依赖，
抽样判断匹配不了字段有无。**枚举式核查与关联测试是必要动作。**

---

## 2026-10-04 · A线收官（控制线终验通过）

**终态**：`main = fork/main = 419e5723`，origin（`125864f6`）未触碰。

### 控制线收官回执要点

- 双 merge 拓扑确认：`0e1f111f` 双亲 `29892dfa × 53f032cf`；
  `d60519e3` 双亲 `0e1f111f × 30a97b5a`
- 两批产物在 main 实证：`graduation-tools.ts` 落位 / `super-resolve-params` 9 处命中
- journal 三族教训在案（8 处命中）

### ★ 方法论教训获控制线收尾认可（升格为验收设计前置问句）

**「验证形态必须匹配被验证对象」** —— 控制线评语：

> 这是今天全部教训的最小公约数……**这条方法论级的提炼比任何单条教训都值钱**，
> **后续所有批次的验收设计先问这一句**。

三实例：
| 被验证对象 | 匹配不了的验证形态 |
|---|---|
| **接线** | 纯函数测试 |
| **循环依赖** | 单文件测试 |
| **字段有无** | 抽样判断 |

⇒ **纪律（升格）**：任何批次的验收设计，先问「验证形态是否匹配被验证对象」；
不匹配则补枚举式核查或关联测试。

### 今日 A线账目（控制线口径）

**六件交付**（全部实证在 main）：
1. #13 零成本自查
2. 统一任务面设计卡
3. 直线入口设计卡
4. R25n 证据三态卡
5. R25d 设计 brief 卡
6. PATCH-MAP 复盘

**外加四批实现合入**：W5 修缮缝隙批（`5c6be4fc`）、直线入口卡（`7da08b2a`）、
B 线毕业机制接线（`0e1f111f`）、A 线超分收口批（`d60519e3`）。

**两轮对控制线的有效纠错**：
1. 裁定②前提不成立（价格档无描述位；模型级 description 用户可见不可用）
2. 边界 #3 时序问题（`1445×1088` 是修复前症状值，非修复后证据）

### 明日排程（等排程单）

统一任务面实现批（首件 = 守卫测试 `web/test/task-face-independence.test.ts`）
+ size 修复真机验证轮（验证点：1:1 源图 → 长边 2048 精确达成 + 比例保持）。

---

## 2026-10-04 夜 · F-08 P1 修复批合入（`5de5e9c0`）

### 合入

`fix/f08-annotation-note`（tip `a4208a66`，自 `374bdf22`，6 文件 +436/-4）
→ `--no-ff` merge `5de5e9c0`（parents `374bdf22` × `a4208a66`）。

**交叠实测**：F-08 6 文件 × sync 枝 341 文件，`comm -12` 零交集 —— 先于 sync 合入无顺序风险。

**内容**：圈选改图 P1 标注文字（note）双通道贯通 ——
`annotate-edit-prompt.ts`（提示词通道）、`annotate-edit-render.ts`（截图渲染通道，
`drawAnnotationShape` 两种形状都调 note 渲染）、`annotate-edit-submission.ts`、
`use-canvas-media-tools.ts` 接线、`annotate-edit-note.test.ts`（15 测试）。

### 门禁（**绑定 commit `5de5e9c0`**）

| 门 | 结果 |
| --- | --- |
| tsc --noEmit | exit 0 ✅ |
| eslint（本批 5 文件，全仓 drvfs 超时） | exit 0 ✅ |
| 全量 bun test | **2918 pass / 5 fail**（2923 = 2908 + 15，与控制线预期精确一致）✅ |
| go build | exit 0 ✅ |
| go test ./internal/app/... | 5 项已知基线 + 1 项 flaky（见下） |

**5 项 bun 失败定性**：全为 `ui-kit-retirement.test.ts` 文件扫描族
（copied flush Modal padding / App.useApp().modal / generic empties /
flush modal drawer spacing / axios.create）。
**决定性 A/B**：同文件 ext4 `185ms / 3 pass` vs drvfs `76.25s / 3 fail`（~400x 纯 IO），
F-08 零触及该文件 ⇒ 环境假红，非回归。

**go test 第 6 项** `TestCloudAgentMediaFailedTaskUpdatesNode`：隔离 3 次全 pass
（含 `-count=1`），F-08 **零 backend 文件** ⇒ 定义上不可能由其引起，负载敏感 flaky。

### 教训 · 报告脱钩追因（控制线令查，根因 (a)）

**现象**：23:34 报告「门禁（tip `eb86fd87`）tsc 0 / build 0」，而 `eb86fd87` 实测
PARSE ERROR（TS1005 'try' expected）—— 控制线与测试线双重独立复现
（测试线 4-commit 归因：`374bdf22` OK / `125864f6` OK / `9c3ef6c8` 坏 / 继承链坏）。

**根因判定 (a)**：括号修复当时在**工作区未提交**，门禁跑在「含未提交修复的树」，
报告引用的却是提交后 hash。证据链：

1. `3067c40b` 与 `eb86fd87` 两个修正 commit **都不含** `user-data-sync.ts`（`--stat` 计数 0）
2. 报告时刻 23:34:06 < 文件 mtime 23:35:46 < `a9949aeb` 提交 23:36:01
3. 门禁命令序列在 `eb86fd87` 提交后、`a9949aeb` 前执行，HEAD=`eb86fd87`、工作树含修复

**实质有效性**：`eb86fd87 + 括号修复 ≡ a9949aeb` 的树（`git diff --stat` 恰 1 insertion），
故报告数字对 `a9949aeb` **成立（非假绿）**，但 **hash 绑定错位** —— 报告的树与引用的 commit 不是同一棵。

**纪律（控制线裁定，本仓生效）**：**门禁结果与 hash 绑定** ——
门禁只在被报告/被推送的那个 commit 上跑，跑完即报该 hash。
这是「跨枝比较必须用当前拓扑」的**镜像条款**：门禁结论必须绑定被门禁的那棵树。

**操作层根因**：`git add <paths>` 与后续 `python3` 脚本编辑**交错**执行 ——
编辑发生在 `git add` 之后的文件上，该文件从未进入暂存区。
**纪律**：多文件脚本化编辑后，`git status` 复核 + `git diff --cached --stat` 确认暂存集
与预期文件集一致，再 commit。

### 附带确认

`a9949aeb`（23:36 补括号）控制线已核：diff 恰一行、PARSE OK、推送及时。
sync 枝 tip `a9949aeb` 已 push fork（`sync/v1.6.1-ritual2`），待测试线 b12r19 GO。

---

## 2026-10-05 凌晨 · upstream sync ritual #2 合入（`e4be6253`）

### 合入

`sync/v1.6.1-ritual2`（tip `a9949aeb`）→ `--no-ff` merge **`e4be6253`**
（parents `01ec50ce` × `a9949aeb`）。

**树核实**：合并树 = `eb86fd87` 的树 + 1 行括号修复 + F-08 的 7 文件
（与自验声明一致；控制线已独立复验）。

### 范围勘误：13 → 20

| 区间 | 笔数 | 说明 |
| --- | --- | --- |
| `d328a257..24cba765` | 13 | PATCH-MAP 复盘时的口径 |
| `24cba765..125864f6` | 7 | 复盘后新落 |
| `d328a257..125864f6` | **20** | 实际全量吸收（不 cherry-pick） |

### 冲突面

**340 文件自动合并 + 23 冲突文件**（与 PATCH-MAP 基线构成完全一致 ——
中途六个 merge（F-08/R25m/AST-08/直线入口/毕业/超分收口）未改变冲突集）。

**`globals.css` 自动合并成功**（不在冲突清单）—— **flora 外置承诺再次实证**。

### 23 冲突逐块判定（要点）

| # | 文件 | 判定 |
| --- | --- | --- |
| 1 | `agent-canvas-patch.ts` | **双契约**：4 参（fork 撤销）basis=活体；5 参（上游三方合并）basis=baseline。不这样分会**丢本地编辑**（首轮实测丢 `local-video`） |
| 2 | `project.tsx` | fork P0 双挂载根修保留（上游重加的挂载点删除）；上游 character 排除移植入 `isPanelCarrier` |
| 3 | `user-data-sync.ts` | 上游 3 次自动合并重试 + fork 水位门写入（`watermarkProjects`）并存 |
| 4 | `audio-settings-panel.tsx` | 上游 Doubao config-aware + fork `SettingsStepper`/`SettingGroup` 增强版 |
| 5 | `cloud_agent_media.go` | fork 容错判定（`&& *true`）+ 上游错误类型 |
| 6 | `analytics.go` | 采用上游 `whereTimeRange`（unixepoch 归一化，比 fork OR 双匹配更彻底） |
| 7 | `cloud_agent_test.go` | fork 集合断言（含 character 9 类）+ 上游 character 发现性断言 |
| 8 | `canvas-generation-task-sync.ts` | fork `outpaintSizeMismatch` + 上游 `generationOutputCount` 并存 |
| 9 | `add-node-menu-tools.tsx` | 跟随上游：角色卡从 resource 段迁到 node 段 |
| 10 | docs 路径 | fork `reference/backend/` 重组保留；上游新文件落 fork 结构 |

### L1 flora 侵蚀块（三方差分）

| 版本 | vertical-align | transform |
| --- | --- | --- |
| merge-base `d328a257` | baseline | `translateY(var(--canvas-mention-chip-offset-y))` |
| **fork `374bdf22`** | baseline | `translateY(var(--canvas-mention-chip-offset-y))` |
| upstream `125864f6` | middle | `translateY(-0.08em)` |

**fork == merge-base ⇒ fork 从未改动该块 ⇒ 非 fork 承重**。
令牌上游原生（ddCat `6c1d17db`），上游 `c83525b1` 单方改两属性。

**判定：接受上游值，不设 `flora-overrides` 覆写**（fork 无投入 + 接受后与上游一致 ⇒ 缩小未来冲突面）。
**孤儿 token 定义保留**（上游 L1283 亦保留 ⇒ 与上游一致）。
**趋势**：上游**第二次**去令牌化 —— flora 可覆盖面持续被侵蚀，biweekly 同步成本将上升，
`24ba765` 时代的 13-commit 低冲突窗口不会永续。

### ★ 用户面能力变更（控制线已向用户直报）

**IndexTTS2 音频能力移除**（跟随上游）：provider `autodl-comfyui-audio` + workflow
`indextts2-v1` 删除、`autodl_indextts2_test.go` 删除、`audio-settings-panel.tsx`
「情感控制（IndexTTS2）」UI 段删除。**fork 未自建该能力**（从 merge-base 继承）⇒
不回补，跟随上游移除（保留情感 UI 会变成无后端支撑的死 UI）。
**Doubao 音频新增**（voice/format/language/dialect config-aware）。
若用户要求回补再立项。

### 门禁（**绑定合并 commit `e4be6253`**）

| 门 | 结果 |
| --- | --- |
| tsc --noEmit | exit 0 ✅ |
| 全量 bun test | **2983 pass / 4 fail**（2987 = 2972 + 15） |
| go build | exit 0 ✅ |
| go test ./internal/app/... | **5 项已知基线** ✅ |

**计数核对**：`2980 + 7 = 2983 + 4 = 2987` ——
总数精确吻合；**分账差异源于 ext4/drvfs 失败族不同**：
ext4 → asset-repair mock 泄漏族（7）；drvfs → ui-kit 文件扫描超时族（4）。
两类均为环境假红，与合入无关。

**另修一个真失败**：`TestCloudAgentToolSchemaStaysCompact` 合并后 25 工具
**31,246 字节**超临时预算 31000 → 按 fork 一贯 ~4.3% 余量重算 **32,600**
（`eb86fd87`）。该测试价值在**趋势预警**：后续每次触碰记增幅入 journal。

### 教训 · 报告脱钩追因（根因 (a)）

**现象**：23:34 报告「门禁（tip `eb86fd87`）tsc 0 / build 0」，而 `eb86fd87` 实测
PARSE ERROR（TS1005 'try' expected）—— 控制线与测试线双重独立复现
（测试线 4-commit 归因：`374bdf22` OK / `125864f6` OK / `9c3ef6c8` 坏 / 继承链坏）。

**根因 (a)**：括号修复当时在**工作区未提交**，门禁跑在「含未提交修复的树」，
报告引用的却是提交后 hash。证据链：① 两个修正 commit `--stat` 计数 0；
② 报告 23:34:06 < mtime 23:35:46 < 提交 23:36:01；③ 门禁 HEAD=`eb86fd87` 且工作树含修复。

**实质有效性**：`eb86fd87 + 修复 ≡ a9949aeb` 的树（恰 1 insertion）
⇒ 报告数字**成立、非假绿**，但 **hash 绑定错位**。

**操作层根因**（比 (a) 更具体）：`git add <paths>` 与后续 python3 脚本编辑**交错** ——
编辑落在 `git add` 之后的文件上，该文件从未进暂存区。

**两条纪律（本仓生效）**：

1. **门禁结果与 hash 绑定** —— 门禁只在被报告/被推送的那个 commit 上跑，跑完即报该 hash。
   这是「跨枝比较必须用当前拓扑」的**镜像条款**：门禁结论必须绑定被门禁的那棵树。
2. **暂存集复核** —— 多文件脚本化编辑后 `git status` + `git diff --cached --stat`
   确认暂存集与预期文件集一致，再 commit。

### b12r19 验证结论

测试线窄口径三项（全量 bun / build / VRT）复验 **GO**。

### 环境

控制线原令的 ext4 clone `oac-wt-test` 被测试线 b12r18 真机轮活跃占用
（vite :3400 + Playwright），未扰动；新建独立 ext4 工作区 `oac-wt-sync2`
（branch `sync/v1.6.1-ritual2`，基点 `374bdf22`）。

### 依赖清单

`bun.lock` / `web/package.json` / `backend/go.mod` / `go.sum` **无变更** ✅。

---

## 2026-10-05 · B线缝隙池批合入（`65c51953`）

### 合入

`feat/w5-gap-repair`（tip `d6b6a952`）→ `--no-ff` merge **`65c51953`**
（parents `f180edf5` × `d6b6a952`）。

**交叠预检**：B 线 7 文件 × 统一任务面批 15 文件，`comm -12` **零交集** ⇒ 直接合，无需报备。

### 内容（7 文件 +448/-23）

R25m **片 6 页面接线** —— 灵感卡走适配器：
- `registry-adapters.ts` / `registry-asset.ts`（适配器层）
- `creation-workspace-empty.tsx`（页面接线，62 行改动）
- `gap-repair-wiring.test.tsx`（117 行接线测试）+ `registry-adapters.test.ts`（+30）
- §3.4 补门禁 + B1 显式关闭

### 门禁（**绑定合并 commit `65c51953`**）

| 门 | 结果 |
| --- | --- |
| tsc --noEmit | exit 0 ✅ |
| 全量 bun test | **2996 pass / 1 fail**（2997 tests，与控制线预期精确一致） |
| eslint（本批 5 文件） | exit 0 ✅ |
| go build | exit 0 ✅ |
| go test ./internal/canvas/... ./internal/app/ | ok ✅ |

**1 项失败定性**：`admin-channel-workspace.test.tsx` 的
「real model manager renders inline」在**全量跑 17782ms 超 5000ms 阈值**，
**隔离跑 6 pass / 0 fail（3.81s）** —— drvfs 慢 IO 负载敏感假红，
B 线批**零触及**该文件（`git diff` 计数 0）。属既有环境族（与 ui-kit 扫描族同源）。
## 2026-10-05 · B线：缝隙池批（片 6）+ 评审 R1 修复批

### 缝隙池批（`d6b6a952` @ `f180edf5`）

片 6 接线（灵感卡走适配器）+ A1（§3.4 来源字段补门禁缺口）+ 片 9 B1（显式关闭）。
7 文件 +448/-23。tsc 0 / eslint 0 / 关联 111 pass / 全量 **2997 pass 0 fail**（360 文件）。

**开工前字段映射核对抓到两处结构性问题**（控制线裁定 A1+B1）：

- 片 9 **结构性不可接线**：4 处消费点中 3 处是计算面（`planEcomPresetApplication`
  入参是结构化 `EcomChannelPreset`），而适配器把 `minPixels`/`desiredResolution`
  压进 `description` 字符串、`shortLabel` 完全未映射 —— 按现 schema 无损接线三选一
  皆不可接受（丢信息 / 扩 schema / 反解析字符串）。裁定显式关闭（同片 3-4 先例），
  重开条件入 scope doc。
- 片 6 缺 1 字段：UI 的「开源改编 · CC0」vs「原创提示词」许可证标注依赖 `item.source`，
  适配器未映射 → 8 条 CC0 会被误标为「原创提示词」（**事实性误标，非显示细节**）。
  修复：`RegistryAsset` 增 §3.4 形态 `AssetSource`（repository/revision/license/notice）。

**方法固化**：「逐消费点 × 逐字段」核对表（scope doc §五）作为后续接线批模板 ——
开工前先列消费面字段需求，逐项对照适配器产出，任一项无承载即 STOP 报裁定。

### 评审 R1 修复批（7 条 P1）

| 条目 | 缺陷 | 修复 |
|---|---|---|
| E-1 | 图片工具层（30 项）整条旁路 guide 白名单 → guide 态 32 项 | 走叶子模块 `filterToolsForGuide`（与 registry 同源真值） |
| E-2 | 白名单无条件应用于所有 toolbar → main 9→0 | 显式白名单 `GUIDE_FILTERED_TOOLBARS = ["node-hover"]` |
| B-1 | 徽标 clamp 用 `context.canvas` 尺寸（导出坐标系错位）→ 跑出画布左侧 | clamp 用原图像素空间；提取 `badgeCenter` 真接缝 |
| B-2 | 标注图纯 dataUrl 被 `referenceUrl` 过滤 → 重试链只剩原图单图 | 物化 storageKey（照 outpaint maskUpload 先例） |
| B-3 | 注释称「保留完整标注供审计」但 metadata 仅 5 字段 | 补 `annotations` 明细进 metadata（兑现承诺） |
| D-1 | runner 防御层无条件以 `model` prop 覆写（= selectedModel）→ 文本/视频页面开图片卡重新引入 HTTP 400 | 单一真值 `resolveLinearFlowModel`（config 与 prop 同源）+ 防御层按 mode 族判定 |
| D-2 | `...generationConfig` 打底让**视频比例**透传进图片请求（scene-shot → size=16:9） | `resolveLinearFlowConfig` 真接缝：显式剥离继承 size，由卡流程唯一决定 |

**接线级测试**（`web/test/review-r1-wiring.test.ts`，33 tests / 90 expects）：
每条附**真接缝行为断言**（非镜像实现）+ **反例**。E-1/E-2 断言 guide 态实际项数 ≤6。

**可证伪性验证（逐条注入缺陷）**：
- E-2 注入 → 3 fail（main 被清空 / selection 受影响 / 源码断言）
- E-1 注入 → 2 fail（实际项数 32 / 接缝三态）
- B-1 注入 → 2 fail（**行为断言抓到**：图内锚点被错误 clamp）
- B-2 注入 → 2 fail（storageKey 断链 / 反例）
- D-1 注入 → 2 fail（图片卡取错模型）
- D-2 注入（原缺陷精确形态）→ 3 fail（真接缝行为断言）

**测试质量教训应用**（评审线 R1 §4「测试镜像实现」）：
初版测试复刻了实现表达式（评审线 D-4 批评的同形缺陷），改为提取**真接缝**
（`filterToolsForGuide` / `badgeCenter` / `resolveLinearFlowConfig`），
测试直接断言生产函数的返回值。B-1 与 D-2 的行为断言经注入验证确实能抓到缺陷。

**既有断言更新**：`linear-flow-wiring.test.ts` 4 条「镜像实现」断言
（断言旧实现的表达式文本）随重构更新为契约级断言 —— 这正是评审线指出的
「改实现即红，改契约不红」形态。

### 门禁

tsc 0 / eslint 0（12 改动文件）/ 关联回归 237 pass / 全量 **3020 pass 0 fail**（360 文件）。

---

## 2026-10-05 · B线 R1 修复批合入（`cdfa12c1`）

### 合入

`fix/w5-review-r1-b`（tip `66512736`）→ `--no-ff` merge **`cdfa12c1`**
（parents `c94d14e7` × `66512736`），13 文件 +807/-39。

**顺序裁定**（控制线）：R1 批**先合**（P1 修复不等验证轮）；统一任务面批
（`7db3fa10`）等 b12r20 GO 后合。

### ★ 交叠补报（控制线干跑之外多查出的两点）

控制线双向 merge-tree 干跑报「零冲突，唯一交集 linear-flow-runner.tsx 区域相邻不重叠」。
我方复测**多查出两点**，如实补报：

| # | 发现 | 处置 |
| --- | --- | --- |
| 1 | 交叠文件除 `linear-flow-runner.tsx` 外还有 **`.trellis/workspace/WindC0X/journal-1.md`**（控制线干跑未列） | journal 是**追加式**文件，两批各自在尾部追加不同段落 ⇒ 结构上不冲突；实测 `merge-tree` 零冲突 |
| 2 | 首次交叠测算**基数错**（用 `c94d14e7` 对比我的批，但我的批 base 是 `f180edf5`）⇒ 我的批文件数虚报 26（实际 18） | 已按正确 merge-base 重算；结论不变（真实交集仍仅 1 文件 + journal） |

**决定性验证**（不只依赖控制线的干跑）：真实干跑三步 ——
① 临时分支合 R1 → ② 再试合我的批 `7db3fa10` → **自动合并零冲突**
（含唯一交集文件 `linear-flow-runner.tsx`）→ ③ 清理干跑分支。
⇒ 确认 R1 合入后我的批仍可干净合入（未来 GO 时无需重做冲突分析，只需按
纪律对**新 main** 复跑一次 merge-tree）。

### R1 七条 P1 修复（评审线 R1 报告，全部 confirmed）

**E 组（毕业机制 —— 门控核心承诺）**：
- **E-1** 图片工具层 30 项整条旁路 guide 白名单 → guide 态实测 32 项。
  修：叶子模块新增 `filterToolsForGuide`（与 registry 侧同一真值），
  `canvas-node-toolbar` 合并路径走该接缝。
- **E-2** 白名单无条件应用于所有 toolbar → main 9 项被清空为 0。
  修：显式白名单 `GUIDE_FILTERED_TOOLBARS = ["node-hover"]`（清单包含判断，
  防未来新 toolbar 隐式继承）。

**B 组（F-08 圈选改图）**：
- **B-1** 徽标 clamp 用 `context.canvas` 尺寸（导出路径有 scale+translate，
  坐标系错位）→ 徽标跑出画布左侧且多条重合。
  修：clamp 改用原图像素空间 `imageWidth/imageHeight`；提取 `badgeCenter` 真接缝。
- **B-2** 标注图纯 dataUrl 被 referenceUrl 过滤 → 重试链只剩原图单图，
  而 prompt 仍宣称「第二张图是带标注的截图」。
  修：提交前物化 storageKey（照 outpaint maskUpload 先例，失败不阻断+可见提示）。
- **B-3** 注释称「元数据保留完整标注供审计」但 `annotateEdit` 仅 5 字段。
  修：补 `annotations` 明细（shape+note）进 metadata，兑现承诺。

**D 组（直线入口卡）**：
- **D-1** runner 防御层无条件以 `model` prop 覆写 → 文本/视频页面开图片卡时
  重新引入「提交文本模型 → HTTP 400」。
  修：单一真值 `resolveLinearFlowModel`（`index.tsx` 的 config 与 prop 同源）；
  防御层判据改为「`config.model` 与 `card.mode` 对应模型族字段」比较。
- **D-2** `...generationConfig` 打底让视频比例透传进图片请求
  （scene-shot → `size=16:9`）。
  修：`resolveLinearFlowConfig` 真接缝显式剥离继承 `size`，由卡流程唯一决定。

### 真接缝测试设计（本批最值钱的工程决策）

新增 `web/test/review-r1-wiring.test.ts`（33 tests / 90 expects）：
**每条附真接缝行为断言 + 反例**。

**关键教训**：初版测试**复刻实现表达式**（断言旧表达式文本）—— 这正是评审线
D-4 批评的**同形缺陷**（测试镜像实现，实现改了测试跟着改，证明力为零）。
改为**提取真接缝**（`filterToolsForGuide` / `badgeCenter` / `resolveLinearFlowConfig`）
后，测试直接断言**生产函数返回值**。

**可证伪性验证（逐条注入缺陷）**：E-2→3 fail / E-1→2 fail /
B-1→2 fail（行为断言抓到）/ B-2→2 fail / D-1→2 fail / D-2→2 fail。

**既有断言更新**：`linear-flow-wiring.test.ts` 4 条**镜像实现断言**（断言旧表达式文本）
随重构改为契约级断言。

### 门禁（**绑定合并 commit `cdfa12c1`**）

| 门 | 结果 |
| --- | --- |
| tsc --noEmit | exit 0 ✅ |
| eslint（本批 12 文件） | exit 0 ✅ |
| 全量 bun test | **3030 pass / 0 fail**（361 文件）✅ |
| go build | exit 0 ✅ |
| go test ./internal/canvas/... | ok ✅ |

（R1 批零 backend 文件，go 侧为基线回归确认。）

### 环境

会话中途电脑重启；重启后先核实合并态（`cdfa12c1` 双亲正确、工作树干净）再续跑
门禁，未重复已完成的合并动作。

---

## 2026-10-05 · T1-P1 归 B线登记（待命期，未动工）

**来源**：控制线 R3 评审归口令（05:10 通道）—— 「全仓无 workspaceType 写入者」裁定归 B线。
理由：写入动作在直线流程创建容器路径 = 直线入口卡领地；B线是「在画布中打开」交接链既有作者。

### 登记时实勘（非仅采信，逐项核）

| 项 | 实测（main `f286156e`） |
|---|---|
| `workspaceType` 全仓命中 | `web/src` / `web/test` **零命中**（0 文件）；仅设计卡文档命中 |
| 读侧现状（姊妹卡 `7db3fa10`） | 读侧**已完整落码**：`workspace-type.ts`（`isHeadlessTaskWorkspace` / `filterVisibleCanvasProjects`）+ `headless-tidy.ts`（`shouldTidyHeadlessCanvas` / `planHeadlessTidyBatches` / `applyHeadlessTidyPositions`）+ 后端 `user_data_page.go:50` 透出 `workspaceType` + `canvas/index.tsx:106` 顶层过滤 + `use-canvas-project-lifecycle.ts:167` 首入整理触发 |
| **写入者** | **确认零写入者**（grep 赋值式 `workspaceType\s*[:=]` 仅命中读侧比较行）—— 读侧/后端全部就位，唯独没人写 ⇒ T1-P1 描述准确 |
| 类型面 | `7db3fa10` 已立 `CanvasWorkspaceType = "standard" \| "headless_task"`（types/canvas.ts:71）且 `updateProject` 白名单已含 `workspaceType`（use-canvas-store.ts:68）—— **写入机制已就位，缺的是调用** |
| 写入点候选 | ~~`create/index.tsx:1120` `onOpenInCanvas`~~ → ★ **控制线裁定（05:50）：写入点 = service 层**（`creation-canvas-conversation.ts` 新建分支），非 onOpenInCanvas 内联 |

### 关键结构发现（影响修法）

`creation-canvas-conversation.ts` 的既有分支语义与修法要求天然对齐：

- `:34` `existingId = source.canvasId || local?.id` → `:37-56` 命中既有画布走**合并分支**；
- `:58-68` 未命中走 `createCanvasProjectWithRemoteSync` **新建分支**；
- 修法要求「existingId 分支不覆盖既有画布」⇒ 写入须只在**新建分支**（或对既有画布仅在 `workspaceType` 缺失时补写）。

### ★ 写入点裁定（控制线 2026-10-05 05:50，更新首版登记）

**裁定：写入点 = service 层（`creation-canvas-conversation.ts` 新建分支），非 `onOpenInCanvas` 内联。**

理由（控制线，三条）：
1. 新建分支是唯一确定「容器刚创建」的位置，天然满足「existingId 不覆盖」；
2. **两个调用方都该打 headless 标记**（`:854` 既有创作交接 + `:1130/:1154` 卡流程 carrier/result 两分支）——内联覆盖不到前者；
3. A线刚重构 `onOpenInCanvas` handler（`191b39b6`，T2-P1b 修复，+51 行改 `create/index.tsx`）——内联会撞同一函数体。

**裁定依据核验（实勘，非仅采信）**：
- `191b39b6` 实况：父 = `7db3fa10`，改 3 文件（`linear-flow-runner.tsx` / `create/index.tsx` / `linear-flow-runner.test.ts`），
  `create/index.tsx` 的 `onOpenInCanvas` 重构为判别联合 `LinearFlowCanvasHandoff`（`kind: "result" | "carrier"`），
  新增 carrier 分支（生成中开承载画布）——裁定理由③ 实证成立；
- 该枝上 `continueCreationConversationOnCanvas` 有 **3 个调用点**（`:854` / `:1130` / `:1154`），
  证实「两个调用方」表述（卡流程内 carrier/result 两分支共用同一 service 调用）；
- `git merge-tree --write-tree main 191b39b6` 干跑 = **零冲突**（exit 0）。

**实现面（控制线指定，细节自定报备）**：
① `creation-canvas-conversation.ts` 增可选参数 + 新建分支透传；
② `user-data-sync.ts` `createCanvasProjectWithRemoteSync` 的 `initialContent` Pick 白名单扩 `workspaceType`
   （现签名 `:710` 只 Pick `nodes | connections | chatSessions | activeChatId`——已核实，确需扩）。

**时序不变**：等统一任务面批（新 tip `191b39b6`）合入后从新 main 开枝（`fix/w5-headless-writer`）。

**调用方全貌**：`continueCreationConversationOnCanvas` 在 `191b39b6` 上有 **3 个调用点**——
`:854`（既有创作交接，画布页转入）、`:1130`（卡流程 carrier，生成中开承载画布）、`:1154`（卡流程 result，交付结果交接）。
★ 裁定后语义（覆盖首版「只覆盖卡流程」的推断）：**全部 3 处都走 service 新建分支** ⇒ 都该打 headless 标记，
`existingId` 命中既有画布时不覆盖（合并分支不动 workspaceType）。

### 交叉核验（姊妹批在飞）—— ★ 首版误报已自查纠正

**误报内容（已作废）**：登记首版曾写「`7db3fa10` 把 R1 的 D-1/D-2 修复还原成旧内联表达式，
合入后会被静默回退」——**该判断为假**，已纠正，未上送控制线。

**误报根因**（同族教训，值记）：用**两点快照 diff** `git diff main 7db3fa10` 读差异——
`7db3fa10` 的 merge-base 是 `f180edf5`（不含 R1 合入 `cdfa12c1`），所以快照 diff 把
**main 相对枝多出的 R1 增量**渲染成了「枝的删除」（`-resolveLinearFlowConfig({...})`）。
这与已登记的「merge commit 文件面必须用 first-parent diff」是**同一族 diff 语义错误**：
**两点 diff 只描述两棵树之差，不描述任一方做了什么**。

**真实核验（干跑合并树，已执行）**：`git merge-tree --write-tree main 7db3fa10` → 合并树 `2964ad51`，
零冲突；`git diff main 2964ad51` 显示：
- R1 独占文件（`create/index.tsx` / `linear-flow-cards.ts` / `linear-flow-wiring.test.ts`）**零差异**
  ⇒ D-1/D-2 修复完整存活（`resolveLinearFlowModel` / `resolveLinearFlowConfig` 均在）；
- 枝真实触碰面 = 其 base 起的 18 文件（**不含**上述三个 R1 文件），`linear-flow-runner.tsx`
  合并后同时保留 R1 的 `config.model === modeModel` 防御与枝的 `onTaskUpdate` 行。

⇒ 结论：**合入零冲突且 R1 修复安全**，无存活风险，无需上报。
**纪律修正**：判「某枝是否回退他人修复」必须看「枝 vs 其 merge-base」或干跑合并树，
不得用「枝 vs 已前进的 main」两点 diff。

### 修法要点（收令登记，已按 05:50 裁定更新）

- 写入点 = service 层新建分支：`continueCreationConversationOnCanvas` 新建容器时带
  `workspaceType: "headless_task"`（增可选参数透传，细节自定报备）；
- `existingId` 分支**不覆盖**既有画布（既有画布可能是用户正常画布，不能因一次转入就打成 headless）；
- 验收：真机建 headless 容器 → 画布库不显示 + 首入整理触发；测试：写入点结构断言 + 不覆盖断言。

### 时机与批名

等统一任务面批合入后从新 main 开枝（避免与 A线枝交叠）。候选批名 `fix/w5-headless-writer`。
**现在不动**，转待命。

---

## 2026-10-05 · T2-P1b 修复（直线流程生成中画布可达）+ R3 三条 P1 独立核实

**来源**：评审线 R3 三批产出（T1/T2/T3）+ 控制线终裁三条。
**枝**：`feat/w5-unified-task-face`，tip `7db3fa10` → **`191b39b6`**。

### R3 三条 P1 独立核实（不盲信报告，逐条查码）

| # | 评审线结论 | 我方核实 | 关键证据 |
|---|---|---|---|
| T1-P1 | workspaceType 全仓无写入者 | ✅ **属实** | 10 处出现点**全是读取/类型/判定**，零写入者；且 `"headless_task"` 字面量仅存在于类型定义与判定函数 |
| T2-P1a | 分页层过滤致「加载更多」死锁 | ✅ 属实（**措辞修正**） | 我在**分页后**数据上过滤，`hasMore` 用服务端游标 ⇒ 实为**计数/内容不一致 + 空页体验**，「死锁」偏重 |
| T2-P1b | 生成中钉死 showOpenInCanvas=false | ✅ **属实** | `linear-flow-runner.tsx:269` 与硬验收②「画布在**任一步**可达」直接冲突 |

**T1-P1 的额外发现（跨卡接缝，非单卡缺陷）**：A线设计卡 §八明写「❌ 不做 headless
创建流程（那是直线入口卡的事）」；B线直线入口卡设计卡 L244 明写「`web/src/types/canvas.ts`
（改）**消费姊妹卡的 workspaceType**」—— 但 B线实现**零命中**。
⇒ **两卡各自完成，中间的「消费」动作无人做**。控制线据此裁定归 B线（写入动作在直线流程
创建容器路径 = 直线入口卡领地）。

### 控制线三条终裁

1. **T1-P1 → 归 B线**（随 R4 面或缝隙池二批）；A线批**不动**，不因跨卡接缝扩围。
2. **T2-P1a → 选修法 ②**「前端计数改按过滤后算」，随 R1+R2 修复批（不阻塞本批合入）。
   理由：下推服务端跨批且触碰后端分页契约；且该缺陷当前**根本触发不了**（headless
   容器不存在，过滤恒不触发），修它是防未来空页体验。
3. **T2-P1b → 本批补**（合入前修）。理由：「画布在任一步可达」是**产品红线**
   （PRODUCT.md 反参考同源：不做把画布藏起来的一站式向导）；我的反驳理由
   「生成中打开画布无意义」已被 headless 语义推翻 —— **承载画布提前可见是特性**。

### T2-P1b 实现（191b39b6，3 文件 +120/-14）

**判别式类型强制分流**（控制线明确认可为「超出裁定范围的正确加固」）：

```ts
export type LinearFlowCanvasHandoff =
  | { kind: "result";  prompt; resultUrl; taskId?; metadata }   // 交付阶段：结果交接
  | { kind: "carrier"; prompt; taskId;            metadata }   // 生成阶段：承载画布
```

- **理由**：生成阶段**不可能拿到 resultUrl** —— 类型钉死，调用方无法写混。
  若只用两个布尔/回调，未来改动容易让生成中走进结果交接路径，产生
  「无结果的结果交接」伪装。
- 生成阶段：去 `showOpenInCanvas={false}` → 默认 `true` + `handleOpenCarrierCanvas`
- 交付阶段：原逻辑不变，改发 `kind: "result"`
- **双容器防护**：两分支共用 `sessionKey = handoff.taskId ? \`linear-flow-${taskId}\` : \`linear-flow-${Date.now()}\``
  ⇒ 生成中先开画布、完成后再交接，**合并进同一容器**；测试含反向断言（承载分支不得自造 Date.now 会话 id）

### ★ 主动纠正：文案承诺必须有代码面证据

初版承载分支文案写「完成后结果会写入这里」——**过度承诺**。
核实画布侧渲染面：`canvas-creative-interaction.tsx` 只认 `creative-interaction` detail；
handoff 的 attachments 渲染通道存在（`canvas-cloud-agent-chat-ui.tsx:534/1404`）但
**没有自动落结果机制** —— 结果写入实际靠交付阶段再点一次「在画布中打开」。
⇒ 已改为「成品完成后在卡流程里点『在画布中打开』即可带入这里」（不承诺自动行为）。
**控制线评：本轮最有价值的自我发现。**

### 两个已知缺口（随 B线 T1-P1 落，代码注释已标）

① 任务创建时未带 `projectId` ⇒ 画布任务面板暂看不到运行中任务
   （`CreateTaskInput.projectId?` 存在但直线流程未传；无事后关联接口）
② 容器未写 `workspaceType` ⇒ 暂以 standard 出现在画布列表
⇒ 本次修的是**入口可见可达**（产品红线）；容器语义完整性仍归 T1-P1。

### 门禁（**绑定 191b39b6**，工作树 0 个已跟踪改动）

tsc `--noEmit` 0 / eslint（3 改动文件）0 / **全量 bun test 3007 pass · 0 fail**
（基线 3004 + 本批新增 3）/ 15281 expect calls / 361 files。

**可证伪性**（按纪律必做）：注入 `showOpenInCanvas={false}` 复现原缺陷 →
**恰好 1 红**（★ 生成阶段不隐藏画布入口），还原后 23 pass。

### 跨重启持久化纪律（采纳评审线 R3 教训）

评审线 R3 报告 `/tmp` 被重启清空、三批产出全丢。**我方实测确认该教训成立**：
`/tmp/rider-queue-r1-fix.md`（我此前登记的 R1+R2 队列）重启后**已消失**。
⇒ 队列落盘仓库侧 `.trellis/workspace/WindC0X/queues/r1-r2-fix-queue.md`（76 行，20 条），
**落 main 而非批分支**（流程文档不属批交付物；批若被拒也不丢），commit `f286156e` 已推。

### ★ 交叠预警：T1-P1 写入点与本批 handler 同区

B线 T1-P1 登记的写入点候选 = `create/index.tsx:1127` `onOpenInCanvas` ——
**正是我 191b39b6 重构的同一 handler**（我改 @@ -1109,24 +1109,59 @@）。
B线目前**仅登记未动工**（c7834744 只改 journal），当前零冲突。
已直报建议：① 写入点更优落点是 `creation-canvas-conversation.ts` 的**新建分支**
（唯一确定「容器刚创建」处，天然满足他们自写的「existingId 不覆盖」，且两调用方都覆盖）；
② 若仍内联，建议只写 carrier 分支；③ **时序上建议 T1-P1 等本批合入后开枝**。

### B线自查纠正的同族教训（值记）

B线首版误报「7db3fa10 把 R1 的 D-1/D-2 修复还原」——根因：用**两点快照 diff**
`git diff main 7db3fa10`，而该枝 merge-base 是 `f180edf5`（不含 R1 合入 `cdfa12c1`），
于是把 main 相对枝多出的 R1 增量**渲染成「枝的删除」**。
⇒ 与「跨枝比较必须用当前拓扑」**同族**（这是 diff 语义版）：
**两点 diff 只描述两棵树之差，不描述任一方做了什么** ——
判「某枝是否回退他人修复」必须看「枝 vs 其 merge-base」或干跑合并树。
我已独立复验其纠正结论正确（merge-tree 干跑零冲突，R1 修复完整存活）。

### ★ 自查：journal 落错分支（拦下一次回退级事故）

**事故**：本段 journal 首版提交 `21a77bcb` 落在**批分支** `feat/w5-unified-task-face`
（应落 main），且 `git push fork main` 成空操作（本地 main 落后）。
**更严重的一层**：该提交的 journal 基线是 **f180edf5 旧版（1284 行）**，
而 main 已含他线三次追加（`c94d14e7`/`d480062b`/`c7834744` → **1527 行**）——
若随批合入，会**回退他线三次 journal 追加**。

**纠正**：`git reset --hard 191b39b6`（批分支回到 b12r20 锚点）；
内容备份双份（`/tmp/my-section.txt` + 仓库侧 `queues/journal-pending-t2p1b.md`）；
待 main 释放后（B线 worktree `oac-wt-f08` 曾占用且正在写 journal，未扰动）
以当前 main tip `2cfa465a`（1552 行）为基线重落。

**根因**：`git checkout <branch>` 前未核实 **workspace 归属**（哪个 worktree 持有该分支），
且 `push` 前未核实**本地 tip 与远端一致**。
⇒ 与 `:3010` 事件（测试线 pkill 前未核进程归属）**同族** ——
控制线已合并为「**操作前核归属**」族纪律，同步写入开线令模板。

**价值**：控制线评「本轮最有价值的自查 —— 拦下了一次回退级事故」。
**注**：这是「跨枝比较必须用当前拓扑」的**写侧镜像** ——
跨枝写入必须绑定目标分支的**当前**基线，不能用开枝时的旧基线。

---

## 2026-10-05 · W5 统一任务面批合入（merge `6fab9f48`）

**合入令**：控制线 b12r20 GO 放行（测试线 ✅ GO：3007 精确命中 / VRT 31 面全绿 + 6 新基线 /
真机四项通过含**双容器 sameId 防护** / 四 rider 落地）。
**配额阻塞说明**：PUT 403 `quota_exceeded` 为**环境级**（DB 1002 行测试残留），非本批缺陷，
测试线清理中，不阻塞合入。

### 合入拓扑

| 项 | 值 |
|---|---|
| merge commit | **`6fab9f48`** |
| 双亲 | `5da4a6f4`（main）× `191b39b6`（批 tip） |
| merge-base | `f180edf5` |
| merge-tree 干跑 | **零冲突**（exit 0，合并树 `344b247dbe9b`） |
| 文件面 | 19 files, **+1128 / -52** |

### 门禁（绑定 `6fab9f48`，工作树 0 个已跟踪改动）

| 门 | 结果 |
|---|---|
| tsc --noEmit | **0** |
| eslint | **0**（★ 重跑后，见下「口径事故」） |
| 全量 bun test | **3050 pass / 0 fail** / 15575 expect calls / 363 files |
| go build | **0** |
| go test ./internal/canvas/... | **ok** |

**数字对账**：控制线预期 3007（= 我批 tip 实测），实测 **3050** —— 差额 = 合入后
**两批测试并存**（main 侧 B线 R1 批的 `review-r1-wiring.test.ts` 等 + 我批三个新测试文件），
非回归。⇒ 3050 是合并树真实数，非异常。

### ★ 口径事故：merge commit 文件面用错口径（控制线现场纠正）

**事故**：门禁② 我用
```bash
FILES=$(git show --name-only --format="" HEAD | grep -E "^web/.*\.(ts|tsx)$")
```
⇒ 输出 **2 个文件**（漏 14 个，含 `unified-task-face.tsx` / `headless-tidy.ts` /
`task-face-download.ts` / `project.tsx` / `create/index.tsx` 等**本批核心文件**）。

**根因**：`git show --name-only <merge>` 只读**合并自身的冲突解决面**，
读不到被合入分支的改动面 —— 这正是已写入模板的「merge commit 文件面」陷阱。

**纠正**：改用
```bash
FILES=$(git diff --name-only <merge>^1 <merge> | grep -E "^web/.*\.(ts|tsx)$")
```
⇒ **16 个文件**，重跑 eslint **exit 0**（全过）。

**自查范围**（不遗漏地查了同类风险）：
- `191b39b6` 是**普通提交**（非 merge）⇒ 当时 `git show` 口径**正确**，无需重跑 ✓
- 门禁③ 全量 bun test **无文件面派生**（全量跑）⇒ 不受影响 ✓
- 门禁④ go 面本批 2 文件（`user_data_page.go` + `user_data_page_workspace_test.go`），
  实测 ok ✓
- 更早的 R1 合入 `cdfa12c1`（merge commit）：`git show` 口径得 0、正确口径得 12 ——
  当时我用的口径需另行回溯（本次未追）。

**纪律（固化）**：**合并 commit 的文件面一律用 `git diff <merge>^1 <merge>` 或 `git show -m`**，
写进门禁脚本模板，不每次手写。控制线指出「这条纪律上次是 B线 预检踩过，今天是第二次
出现在门禁脚本里」—— 属高频陷阱，模板化是唯一解。

### 本批交付内容（19 文件）

- **UnifiedTaskFace**（`web/src/components/task/unified-task-face.tsx`）：零画布依赖 +
  订阅契约锚定 TaskID（`subscribeGenerationTasks`）+ 预览/下载/取消/在画布中打开
- **验收 4**：`CanvasWorkspaceType`（`types/canvas.ts`）+ store 白名单（undefined = standard 零迁移）
- **验收 5/6**：零依赖护栏 + TaskID 锚定护栏（`web/test/task-face-independence.test.ts`）
- **验收 7**：headless 不进主列表（后端 `CanvasLibrarySummary.WorkspaceType` 透出 +
  `user_data_page_workspace_test.go` 真接线级测试 + 前端 `workspace-type.ts` 过滤）
- **验收 8**：headless 首入流式整理（`headless-tidy.ts` 只投影 position + lifecycle 接线）
- **验收 3**：交付步（`task-face-download.ts` 原始字节优先 + previewUrl 回退）
- **验收 2**：`/create` 真实挂载（`linear-flow-runner.tsx` 进度面）+ §9.3 债务部分兑现
- **T2-P1b**：生成中画布可达（判别式 `LinearFlowCanvasHandoff` result/carrier + 双容器防护）
- 画布面板交付步（`canvas-active-task-panel.tsx` 保持外壳 + 加交付能力）+ 画布页接线（`project.tsx`）

### 已知边界（入下批或他线）

| 项 | 归属 |
|---|---|
| R3 三条 P1（护栏四盲区 / 下载判据口径 / 注释免疫） | **R1+R2 修复批** |
| T2-P1a 分页过滤计数/内容不一致 | **R1+R2 修复批** |
| M8 交付面双实现分叉（判据同源收口） | **R1+R2 修复批**（与 P1-2 同源） |
| workspaceType 无生产者（T1-P1） | **B线** `fix/w5-headless-writer`（从新 main 开枝） |
| M12 文本结果通道（W6+ 候选卡） | 已记档，待 §9.3 全量回改时评估 |
## 2026-10-05 · T1-P1 交付（fix/w5-headless-writer @ 382de2cc）

**任务**：workspaceType 写入者（评审线 R3 T1-P1，控制线裁定归 B线）。

### 实现（4 文件，+211/-9）

| 文件 | 动作 |
|---|---|
| `creation-canvas-conversation.ts` | 增 `options?: { workspaceType?: CanvasWorkspaceType }`，**只在新建分支**透传（existingId 一律不覆盖） |
| `user-data-sync.ts` | `createCanvasProjectWithRemoteSync` 的 initialContent Pick 白名单扩 `workspaceType` |
| `create/index.tsx` | 卡流程 carrier(:1152)/result(:1176) 传 `headless_task`；既有创作交接(:862) 保持无参 |
| `web/test/headless-workspace-writer.test.ts` | 新建 7 tests |

### 打标范围（控制线裁定 + 依据）
只卡流程两分支打标，`:862` 保持 standard。依据：设计卡 §4.2 定义 headless =
「用户未主动进入画布，画布只是产物承载方式」；`:862` 是用户显式「转入画布」且
画布即目的地 ⇒ 不符合。**反向验收③（防过度打标）是可证伪性落点，不能省。**

### 测试策略（避开 mock 泄漏）
真实 service + 真实 store + **mock 网络适配器**（`apiClient.defaults.adapter`），
不用 `mock.module` —— 后者是进程级跨文件泄漏（实测 bun 1.4：先加载的文件 mock 后
加载文件可见）。断言落在 **store 实际字段 + 远端 payload**，非源码文本。

**可证伪性（逐条注入）**：
- 注入「新建分支不传 workspaceType」→ 2 fail
- 注入「existingId 也覆盖」→ 2 fail（含反向断言：既有 headless 不因传 standard 变回 standard）
- 还原后 7 pass

### 真机验收（三条全过 + 一条补验）

**① 画布库不显示** ✅ 真实任务 6e90f72a（gpt-image-2.5，succeeded）→ carrier 点
「在画布中打开」→ 容器 i1VKWWDcIPqffPeI_jtlb 建成；列表 API 返回
`workspaceType=headless_task`；DB payload 落库实测同值；画布库只显示 1 个普通画布。

**② 首入整理** ✅ 首轮（容器无节点）：标记 null → 1（路径走通）。
**补验（带节点，我主动补做）**：注入 3 节点全 (0,0) → 清标记 → 重载 →
坐标变为 (0,0)/(272,0)/(0,152)（真实排布），标记置 1。⇒ 升级为「坐标真实变化」。

**③ 反向（防过度打标）** ✅ 无参调用 → 新画布 `workspaceType` 空（standard）
+ 正常出现在画布库；`shouldTidyHeadlessCanvas(standard)` = false。验证后清理临时画布。

### ★ 环境陷阱（值记，跨线通用）
**旧后端进程不含新批的后端改动**：:8488 上跑的是 04:39 启动的进程（早于
`4d535b57` 合入），导致列表 API 一度返回空 `workspaceType`；我一度怀疑前端写入
未生效（store 内实际已有值）。重启后端（07:17 新代码）后正常。
⇒ **纪律：凡在旧进程上验证跨批功能，先确认后端进程启动时间晚于相关 commit。**
（诊断路径：store 有值 + 单项目 API 有值 + 列表 API 无值 → 锁定后端进程陈旧。）

### 门禁（绑定 382de2cc）
tsc 0 / eslint 0（4 文件）/ 关联回归 53 pass / 全量 **3057 pass·0 fail**（364 文件）。

### 待控制线裁定
① 合入安排 ②（已自行补做，撤回）验收②带节点补验。

---

## 2026-10-05 · B线 T1-P1 批合入（merge `45d0d583`）

**合入令**：控制线 2026-10-05（B线批冻结待合，与我批零交叠；建议 C 组收口后或 F 组前合入，
「不要拖到整批结束」）。裁定执行顺序为 (b)：先 commit 我批进度 → 再合 B线。

### 合入拓扑

| 项 | 值 |
|---|---|
| merge commit | **`45d0d583`** |
| 双亲 | `06bf455a`（main）× `9bacde62`（B线批 tip） |
| 内容 | `382de2cc`（T1-P1 workspaceType 写入者）+ `9bacde62`（journal） |
| 文件面 | 5 files, **+264 / -9** |
| merge-tree 干跑 | **零冲突**（exit 0） |

### B线批内容（T1-P1 归 B线的兑现）

`continueCreationConversationOnCanvas` 增可选参数 + 新建分支透传 `workspaceType`；
卡流程两个调用点（carrier/result）带 `headless_task`；新增
`web/test/headless-workspace-writer.test.ts`（194 行）。
⇒ 这兑现了控制线裁定 1（T1-P1 归 B线）+ 我 2026-10-05 的建议 1（写入点落 service 层）。

### 门禁（绑定 `45d0d583`，工作树 0 个已跟踪改动）

| 门 | 结果 |
|---|---|
| tsc --noEmit | **0** |
| eslint | **0**（4 文件，正确口径） |
| 全量 bun test | **3057 pass / 0 fail** / 15590 expect / 364 files |
| go build | **0** |
| go test ./internal/canvas/... | **ok** |

**数字对账**：3050（前一基线）+ 7（B线新测试）= **3057** ✓

### ★ 门禁脚本新模板（控制线要求的空输入防线）

本次已按控制线补充的模板执行 —— 文件面用 `git diff <merge>^1 <merge>`，
**并打印文件数 + 空则中止**：

```bash
FILES=$(git diff --name-only <merge>^1 <merge> | grep -E "^web/.*\.(ts|tsx)$" | sed 's|^web/||')
echo "web 文件数: $(echo "$FILES" | wc -l)"   # ← 空输入必须显性可见
[ -z "$FILES" ] && { echo "❌ 文件面为空，中止"; exit 1; }
```

实测输出「web 文件数: 4」+ 文件清单，非空校验通过。
**理由（控制线原话）**：空输入产生的 exit 0 与真检过的 exit 0 是不同东西。

### 我批进度落盘（裁定 (b) 的附带收益）

合 B线前，我批（`fix/w5-review-r1-r2`）已分三个 commit 落盘（防重启丢失）：
- `8594667a` fix(backend): AST-08 查询面与删除面同源收口 - C 组五条
- `63df7eff` fix(web): 计费 NaN/Infinity 守卫 + 超分 size 真接缝（F-2/F-3）
- `d3f18b28` chore(web): 删除孤儿令牌 --canvas-mention-chip-offset-y（S-4）

### F-1 处置（控制线裁定 3）

**降级为「登记待查」，不阻塞本批**。理由：
- 原证据（`/tmp/review-r1/agents/batch-F.md`）已随重启丢失，控制线找回的仅 journal 级摘要
- 控制线亲自读码**未复现确定性缺陷**（`image_upscale` 链前后端对齐：
  前端 `canvasEditOperation` → 后端 selector → 独立价格档）
- 裁定原文：「F-1 的**归属语义**本身就是「后端零改动」，所以「不动」符合原文」
⇒ 交付报告登记「F-1 证据不可得 + 未复现确定性缺陷 → 未执行，登记待查」；
缝隙池登记复核项。★ 纪律：**转述证据必须标注来源，不得当作实测**
（控制线采纳我的实测更正：`Infinity` 序列化为 **null** 而非 NaNxNaN）。

---

## 2026-10-05 · A线 R1+R2 修复批合入（merge `721a93ce`）+ B线 R2 工具批（`f6236a18`）

### 合入拓扑

| 项 | 值 |
|---|---|
| A线 批 merge | **`721a93ce`**（双亲 `dec88db1` × `a98e587e`），28 files **+1223/-101** |
| B线 工具批 merge | **`f6236a18`**（双亲 `721a93ce` × `3d2660ed`），4 files +69/-27 |
| main / fork/main | `f6236a18`（ls-remote 实测一致） |
| merge-tree 干跑 | 两次均**零冲突** |

### A线批内容（17 commit，评审 R1/R2/R3/R4 全结清）

| 组 | 内容 |
|---|---|
| C 组 5 条 | AST-08 查询面与删除面同源收口（C-1 归属前置 / C-2 自引用标记 / C-3 历史跳过 / C-4 裸标量回退 / C-5 Unreadable 通道） |
| F 组 3 条 | F-1 超分档 break 致静默落通配档（**计费错误**）/ F-2 NaN/Infinity 守卫 / F-3 size 真接缝 |
| A 组 2 条 | A-2 片 7 列表链路断言 / A-1 登记待链路就绪（含契约字段名修正） |
| R2 四条 | S-2 prefill 双通道短路 / S-3 文档死链 4 处 / S-4 孤儿令牌 |
| R3 三条 | P1-1 护栏模块图判定（四盲区 0/4 → 4/4）/ P1-2 交付判据同源 / T1-P2 注释免疫 |
| 其他 | T2-P1a 分页死锁 + superres rider 失败可见 + V9 两个 P2（锚点消失 / 注释满足） |

### 门禁（绑定 `721a93ce`，工作树 0 改动）

tsc **0** / eslint **0**（17 文件，正确口径）/ 全量 bun test **3070 pass · 0 fail**（合并前）/
go build **0**；go test 5 条 `TestCloudAgent*` = **undici 环境基线**（非本批）。

### 合入 B线 工具批后（绑定 `f6236a18`）

全量 bun test **3077 pass / 1 fail**（我实测）——
唯一红 = `fallback snapshots obey the configured minimum refresh interval`（**已知 flaky**，
自述「全量 3 跑 1 现」，隔离跑 3 次全过）。
控制线独立跑 3 次 **3078 / 0 fail** ⇒ 污染源已被 B线 P1-2 治本（spyOn 替代 mock.module）**根治**。

### ★ V9 纪律实践（本批两个 P2 促成）

**断言可靠性三族**：① 注释免疫 ② 锚点消失 ③ 失败路径不可诊断。
两个 P2 都是**回归注入**（改回缺陷前写法）才暴露 —— 我原先只做「人为破坏注入」。
实践要求：**切片前锚点存在性断言 + 断言前剥注释 + 顺序断言（注释无法满足）**。

### 我的自我纠错（本批内，全部由测试抓到）

1. C-2 首版用 asset ID 建映射（应为 `representation.ID`）→ 测试红
2. C-4 首版一致性测试场景写错（删不拥有该资源的素材）→ 测试红
3. S-2 首版测试用 `not.toContain` 直查旧 ref 名（是新名子串）→ 词边界正则
4. F-1 首版反例前提错（通配档命中是既有设计）→ 改为正确契约
5. P2-2 首版修法只取 `error.message`（丢原因，真因在 `errors[].message`）→ 测试红

---

## B线 · W5 headless 可达性主批（D-1/D-2）交付登记（2026-10-05）

**分支**：`fix/w5-headless-reachability` @ `e6061c6b`（2 commit，基点 `cb8d8dc4`）
**裁定**：控制线验收通过（独立核验全绿：静态拓扑 / 动态 3106 pass 0 fail /
5 项注入 5/5 复现 / 代码级读码）——准予合入 main。

### 交付内容

| # | 项 | 要点 |
|---|---|---|
| 1 | **D-1 预建承载容器** | 新 helper `createCanvasProjectLocal`（本地创建 + 防抖同步，**不 await 云端往返**——避开实测 7.7s 关键路径阻塞）；runner 新增 `onPrepareCanvas` 回调，提交前预建 → 任务带 `projectId` → handoff 两分支带 `canvasId` → 交接走 existingId 分支写进同一容器；预建失败/hydrated 未完成 ⇒ 降级为既有行为不阻塞生成 |
| 2 | **D-2 /tasks 画布入口** | 新纯函数模块 `linear-flow-task-link.ts`：按消息 `detail.taskIds` 反查（**不按 session id 字符串匹配**——service 内部加 `creation:` 前缀、消息 id 双重前缀，按拼接约定匹配会在任一侧改前缀时静默失配）；`inputJson.metadata.source` 判据 + 严格类型守卫；两段式（本地反查零请求 → 详情确认带 ref 缓存） |

### 真机验收（Orca 浏览器 + :8488 + :3020）

| 验收项 | 结果 |
|---|---|
| D-1 容器预建 | ✅ `-k-i5P60O1zAeru2GFZeC`（title=白底主图，workspaceType=headless_task） |
| D-1 任务带 projectId | ✅ 任务 `1a77cf1d55a2bbf446fa956fb08610df` 的 projectId = 预建容器 id |
| D-1 生成中面板可见 | ✅ 容器页「生成任务 · 当前画布 · 1 个进行中」 |
| D-1 完成后消失 | ✅ 任务 succeeded 后面板无该任务（activeOnly 语义，预期行为） |
| D-2 入口 + 跳转 | ✅ /tasks 双态按钮（「在画布中打开」/「创建画布并打开」）→ 导航到 `/canvas/i1VKWWDcIPqffPeI_jtlb` |

### ★ 真机自发现的两处交界缺陷（第二个 commit 修复）

1. **预建容器反而不达**（与 P1-1 原意相反）：用户未点「在画布中打开」时容器无会话 ⇒
   本地按 taskIds 反查落空，而任务已带 projectId ⇒ `resolveTaskCanvasAction` 返回 none。
   修法：按 id 命中本地画布同样直接跳转。
2. **①初版修法过宽**：30 条历史任务里 **19 条**都长出画布按钮（普通画布任务在画布页本就有入口）。
   收窄为只认 headless 容器（`isHeadlessTaskWorkspace`）⇒ 真机复测降到 **4 个**。

### 可证伪性（5 项注入，控制线独立复现 5/5）

| 注入 | 实测 |
|---|---|
| runner 不传 projectId | 1 fail |
| 预建挪到任务创建之后（时序回归） | 1 fail |
| handoff 不带 canvasId | 1 fail |
| D-2 去掉详情确认 | 1 fail（初版测试假绿——被详情 effect 的同名调用满足；已强化为切片内顺序断言） |
| D-2 用不同 sessionKey | 1 fail |

### 门禁（绑定 `e6061c6b`）

- 全量 `bun test`（ext4）：**3106 pass / 0 fail / 15709 expect / 367 files**
- `tsc --noEmit`：exit 0；`eslint` 9 文件：exit 0
- 诚实边界：中途 1 次 flaky（`agent-canvas-sync` 的 minimum refresh interval）——
  **非本批引入**（隔离跑 8 pass 0 fail；stash 本批改动后基线全量同样 3 跑 1 现；V4 已登记）

### G1 precheck

- 文件面 vs main：9 文件
- `merge-tree main × e6061c6b`：exit=0 tree=296e0392（零冲突）

### 教训：G4 占用核查（控制线侧）

控制线裁定书写「main 当前无人占用」但实测被其自身 worktree（`oac-wt-ctrl`）持有；
我报告后控制线核实、释放并认领为「未经核实就下结论」的同类错误。
⇒ 纪律：**裁定中涉及环境状态（worktree 占用 / 分支持有）必须先实测再写**。

---

## 2026-10-05 · B线 R5 修复批合入（merge `58eef5d2`）

### 合入拓扑

| 项 | 值 |
|---|---|
| 合入对象 | `cf8fbf52`（分支 `fix/w5-runner-reset`，基点 `86f04568`） |
| 合入前 main | `525532ef`（+C8 纪律 commit，文件面零重叠） |
| **merge commit** | **`58eef5d2`**（双亲 `525532ef` × `cf8fbf52`） |
| 文件面 | 6 files **+187/-8** |
| merge-tree 干跑 | **exit 0**（tree `bfef4320`） |
| main / fork/main | `58eef5d2`（ls-remote 实测一致） |

### 内容

| 项 | 修复 |
|---|---|
| P1 | `LinearFlowRunner` 挂载加 `key={linearFlowCard?.id ?? "none"}` 根治跨卡片状态残留 |
| P2-1 | D-2 路径B 会话缺失判断改按 taskId 精确判断（消除 `findTaskSessionId` 死代码） |
| P2-2 | `scripts/merge-file-face.sh` 补执行权限（100644 → **100755**） |

### 门禁（绑定 `58eef5d2`，工作树 0 改动）

| 门 | 结果 |
|---|---|
| 文件面（G1 口径 `git diff HEAD^1 HEAD`） | 6 文件（含空输入防御 ✓） |
| P2-2 自证 `./scripts/merge-file-face.sh 58eef5d2` | **exit 0** ✓（脚本已可执行） |
| tsc --noEmit | **0** |
| eslint（web 5 文件） | **0** |
| 全量 bun test | **3114 pass / 0 fail / 15727 expect / 368 files**（222.51s） |
| git ls-files -s 权限位 | `100755` ✓ |

### ★ 本批的两处纪律实践

1. **P2-2 自证闭环**：`merge-file-face.sh` 本批自己获得了执行权限 —— 门禁第 ② 步用它
   验证自己的合入 commit，是「工具与产出同批交付」的自洽验证。
2. **真机前置校验（B线）**：过程中发现 vite 服务跑的是**旧代码**（drvfs watcher 失效），
   重启后确认 `transformed` 含新代码才继续 —— 避免了 V3 类的假绿。

### 三线状态

main 推进至 `58eef5d2`，测试线 / 评审线新锚点以控制线通知为准。

---

## 2026-10-05 · B线 SPA 导航探针小批合入（merge `0dcd507d`）

### 合入拓扑

| 项 | 值 |
|---|---|
| 合入对象 | `9578c2e3`（分支 `chore/spa-nav-probe`，基点 `e4b59f89`） |
| 合入前 main | `e4b59f89` |
| **merge commit** | **`0dcd507d`**（双亲 `e4b59f89` × `9578c2e3`） |
| 文件面 | 2 files **+322** |
| merge-tree 干跑 | **exit 0**（tree `799f1d13`） |

### 内容

新增 `web/test/helpers/spa-navigation-probe.js`（123 行）+ `web/test/spa-navigation-probe.test.ts`（199 行）：
**SPA 导航探针 —— 让「无警告/无导航」类阴性结论可证伪**。
此前「页面无跳转/无警告」类结论只能靠人眼或日志缺席证明（阴性结论不可证伪，属 V8 家族）；
本探针把它转为可注入、可观测的阳性证据。单文件 10 pass / 22 expect。

### 门禁（绑定 `0dcd507d`，工作树 0 改动）

| 门 | 结果 |
|---|---|
| G1 文件面（含空输入防御） | 2 文件 ✓ |
| `./scripts/merge-file-face.sh 0dcd507d` | **exit 0** ✓ |
| tsc --noEmit | **0** |
| eslint（web 2 文件） | **0** |
| 单文件 bun test | **10 pass / 0 fail / 22 expect** |
| 全量 bun test | **3124 pass / 0 fail / 15749 expect / 369 files**（229.85s） |

**新全量基线：3124 pass / 0 fail / 369 files**（较前批 3114 增 10）。

### 证伪注入对照（控制线独立复现）

| 注入 | 控制线实测 | B线 自报 | 说明 |
|---|---|---|---|
| A | 1 红 | 1 红 | 一致 |
| B | 3 红 | 3 红 | 一致 |
| C | **5 红** | 4 红 | ★ **均为改源文件、位置不同**（控制线改 `MESSAGE_KEYWORDS` 数组 / B线 改 `captureNode` push 行）；差 1 红 = 测试 `:161` 锚点前置断言主动报警 |
| D | 1 红 | 1 红 | 一致 |
| E | **5 红** | 1 红 | ★ **注入层级不同**（控制线改源文件 / B线 改测试内部 `anchor` 常量 = 测试内自证伪） |

★ **归因修正记录（2026-10-05，控制线指出 + A线 独立复现）**：
本条初版把 C 项也写成「控制线改源文件 / B线 改测试内部字符串」——**该归因错误**，
对 E 成立、对 C 不成立。经隔离环境实测复现（`/tmp` ext4，两文件无项目依赖）：

| 注入形态 | 实测红数 | 差额原因 |
|---|---|---|
| 改 `MESSAGE_KEYWORDS` 数组（控制线） | **5 fail** | 多 1 红 = `:161` 锚点前置断言报「关键词锚点消失 —— 证伪测试失效，需同步更新」 |
| 改 `captureNode` push 行（B线） | **4 fail** | — |
| 改测试内 `anchor` 常量（B线 E 项） | **1 fail** | 测试内自证伪 |

**★ 差额的那 1 红正是 V9 ② 防护的真实收益**：测试主动检测「我依赖的锚点消失了」，
而非静默失效。若无该前置断言，改关键词数组同样只会红 4 条，
「证伪测试失效」将被静默吞掉 —— 这是 V9 ② 的可测量价值证明。

**C7 实例（修正后仍成立）**：同一结论（探针可证伪）在不同注入点下红数不同，不构成分歧；
**报告红数时必须附带注入点/注入方式**（V9 的「实测 N 红」需补注入层级才完整）。

### 三线状态

main 推进至 `0dcd507d`；测试线已用该锚点跑完 b12r25（GO，3124/0/369 逐数吻合）。

---

## 2026-10-05 · F-09 二期提示词前置注入层合入（merge `d2809237`）

### 合入拓扑

| 项 | 值 |
|---|---|
| 合入对象 | `0c0059c8`（分支 `feat/f09-prompt-injection`，基点 `28d1e46e`） |
| 合入前 main | `01d3997c`（C1 附纪律 commit，非原计划的 81bf61e6） |
| **merge commit** | **`d2809237`**（双亲 `01d3997c` × `0c0059c8`） |
| 文件面 | 3 files **+323** |
| merge-tree 干跑 | exit 0 |
| main / fork/main | `d2809237`（ls-remote 实测一致 ✓） |

### 内容（F-09 二期：提示词前置注入层）

| 文件 | 内容 |
|---|---|
| `prompt_image_role.go`（新，97 行） | `buildImageRolePrompt` 生成角色清单段 / `prependImageRolePrompt` 实现 prepend / `applyImageRolePrompt` 接线 |
| `prompt_image_role_test.go`（新，212 行） | 10 项测试 |
| `provider.go`（+14） | `providerConfig.ProductImageCount` + 前置条件声明 |

**三个实现要点**（方案 §7 四条实施要求）：
1. `position: prepend` —— 角色清单在提示词最前
2. **编号对齐 API 数组** —— 接线在 `hydrateGenerationMedia` **之后**，
   `totalImages = len(input.ReferenceImages)`（已定序）⇒ 从接口设计上消除写反可能
3. 测试覆盖编号顺序（多重守护）
4. 空槽位注入 `emptyText`（文案逐字对齐方案 §1.1①）

### 门禁（绑定 `d2809237`，工作树 0 个已跟踪改动）

| 门 | 结果 |
|---|---|
| G1 文件面 | 3 文件 +323 ✓ |
| gofmt -l | 空 ✓ |
| go build ./... | exit 0 |
| go vet ./internal/app/ | exit 0 |
| go test -run "ImageRole\|Prepend" | **10 pass / 0 fail** |
| go test -run "Workflow\|Provider\|Image" | ok（57.071s 相关面回归） |

### ★ 契约显式化（合入前加强，控制线裁定 B + 三加强）

**背景**：B线 渠道实测的数组是 `[参考图, 产品图]`，与其手工清单声明（图1=产品图组）**相反** ——
模型看到的图1 实际是参考图。这正是方案 §1.1⑦ 陷阱（写反不报错，只有静默偏差）。

**发现链**：控制线核 B线 请求体时发现注入层未被调用（B线 未传 `productImageCount`），
进而发现数组顺序问题 → A线 核实成立 → 追加契约显式化。

**三加强**：
1. `ProductImageCount` 注释补**前置条件声明**（产品图须在数组前 N 位，后端无法校验 ——
   `providerMedia` 无语义标签，只能按位置编号）
2. 新增 `TestImageRolePromptRecordsPositionContractNotSemantics`：
   **记录**（而非阻止）契约 —— 编号按位置、非语义；含反向断言「注入层不得猜测语义」
3. 方案登记三期前端要求（控制线完成，canvas 仓 `76e0842`）

**为何不做 `productImageIndices`**（控制线裁定，A线 撤回原倾向）：
角色清单是**连续区间格式**（`图1～N` / `图N+1～M`），表达不了交错顺序 ⇒
除非同时实现重排，否则索引只用于算计数，收益不足。

### ★ 注入点矩阵（V7 附1-a：红数必须附注入点 + 缺陷类别）

基准 `@ feat/f09-prompt-injection / 4a448e06`（V7 附2-a：未合并分支须附分支）：

| # | 注入点 | 红数 | 能暴露的缺陷类别 |
|---|---|---|---|
| 1A | `prompt_image_role.go:54` 函数体 | 4 红 | 编号语义错 |
| **1B** | `:96` **调用点** | **0 红（旧）→ 1 红（补断言后）** | ★ **测试覆盖缺口** |
| 2A | `:81` 函数体 | 2 红 | prepend 失效 |
| 2B | `:96` 调用点 | 1 红 | 同上（弱覆盖） |
| 3A | `:53` 函数体 | 3 红 | 总数错 |
| 3B | `:96` 调用点 | 1 红 | 同上（弱覆盖） |
| 4 | `:55` 函数体 | 1 红 | 空槽位缺失 |
| 5 | `:96` 调用点 | 1 红 | 接线失效 |
| 6 | `:57-60` 函数体 | 1 红 | 契约漂移 |

**★ 1B 是本轮方法论发现**：同一注入意图在不同层级，不只红数不同，
**能发现的缺陷类别也不同** —— 函数体注入抓不到调用点误用，
而调用点注入暴露了接线测试的覆盖缺口（V9 ①-a 形态，已补断言修复）。

### 遗留（明确登记，非欠账）

- **端到端未验**：注入层的「模型是否按角色清单执行」属**渠道实测**（B线 范围）。
  B线 当前矩阵用手工拼装角色段（因本分支未合并），**合并后仍需单独一格**验证注入层端到端。
- **`ProductImageCount` 赋值方未实现**：三期前端（`use-canvas-media-tools.ts` 加
  `createCloneRecreateNode`）负责赋值，二期只提供接口。
- **`git merge` 首次失败**（`fatal: stash failed`）：与另一线的 git 操作并发导致索引瞬态不一致；
  未删 lock、未 kill 进程，等待后核实状态干净（MERGE_HEAD 无 / index.lock 无 / stash 0 条）
  再重试成功。这是多线并发 git 操作的第 2 次（第 1 次是 index.lock）。

## 2026-10-06 · F-09 画布工作流承载性验证（A线，提交 b2a3523b）

- **任务**：任务书 `docs/artifacts/f09-canvas-workflow-validation-task-book.md`（main @ 8f05b71a）。
  核心问题：画布单独能否承载 F-09（换图 + 生成），Q1（@提及顺序 → referenceImages 数组顺序）为决定性子问题。
- **结论**：**画布能承载 F-09**，Q1 成立，唯一缺口是 `productImageCount` 字段透传（三期前端），无需独立 F-09 页面。
- **Q1 实测**（隔离探针，连线顺序固定 `[product, layout]`）：
  `@图片1 是产品，@图片2 是版式` → `[product, layout]`；
  `@图片2 是版式，@图片1 是产品` → `[layout, product]` ⇒ **数组顺序 = @提及首次出现顺序**。
- **机制细节**（任务书 §2.1 未覆盖）：`@图片N` 是**槽位 token**，槽位由 `generationSlotEntries`
  按**连线顺序**分配（`canvas-node-generation.ts:346`）；而**数组顺序**由 `matchAll` 循环里
  `selectedInputs.push`（:229）的首次出现顺序决定 ⇒ **两个独立杠杆**。
- **★ 工作流渠道边界**（控制线裁定②要求登记）：`canvas-node-generation.ts:96`
  `autoIncludeWorkflowMedia` 为真时（RunningHub 工作流节点），数组**先按连线顺序**放入媒体、
  显式 @ 只追加（:239-255）⇒ **「@提及顺序优先」不外推到工作流渠道**。已用 2 条对照测试锁定
  （同一提示词 + 同一连线，工作流节点得连线顺序、普通节点得 @提及顺序）。
- **证伪**（红数附注入点）：
  ① `buildComposerGenerationContext` 的 `selectedInputs` 改为按连线顺序 → **12 fail**（含 5 条 F-09）；
  ② `:239` `if (autoIncludeWorkflowMedia)` 改 `if (false && ...)` → **5 fail**（含边界锁）；恢复后均 24 pass。
- **Q2 已验**：全仓 grep 显示前端**仅注释提及** `ProductImageCount`（`capability-entries.ts:49`），
  **无赋值来源** ⇒ 后端 `applyImageRolePrompt` 早返回，角色清单不注入 —— 任务书 §3 步骤 2 缺陷已确认。
- **Q3/Q4 不做**（控制线裁定）：Q3（透明 PNG 引导层 + `metadata.locked`）登记为三期设计输入；
  Q4（端到端出图）由 B线 一期门覆盖，重复验证违反 V1。
- **交付物**：报告 `docs/artifacts/f09-canvas-workflow-validation-report.md`（205 行，含 8 节）+ 7 条测试。
- **门**：tsc 0 / eslint 0 / bun test **3132 pass 0 fail**（基线 3125 + 7）。
- **方法调整**（控制线裁定③）：原计划纯 UI 手工验证（拖拽/连线/点生成），因画布 UI 交互成本远超预期
  （右键菜单 CDP 与 JS 派发均无法触发）改为**代码级验证**（直测 `buildNodeGenerationContext`）——
  Q1 本质是前端逻辑，UI 拖拽方式不影响该逻辑。
- **环境障碍与解法**（供后续复现）：任务书 §7 的 :3020/:8488 被 B线 占用 → 改用 :8489/:3030；
  浏览器标签建不出 → CDP `Target.createTarget`；`exec` 被其他 debugger 占用 → `Runtime.evaluate` 直连。
- **★ 工作区残留（非本次改动）**：`web/src/lib/canvas/capability-entries.ts` 有未提交的
  `dual_image` 谓词改动（2026-10-05 23:12，标注「F-09 双图复刻」），**未提交**，
  已报控制线确认归属。

## 2026-10-06 · F-09 三期（画布模板化）交付（A线，main = fd2b1f53，待门 2）

- **任务**：任务书 `docs/artifacts/f09-canvas-template-task-book.md`（393 行），基线 main @ b2a3523b。
  产品代码批，五块内容，单 commit 不 push（C5）。
- **交付**：`8f6b59ba`（29 files +1838/-8）+ `fd2b1f53`（修 3 处语料索引注释）。
  main = fd2b1f53，fork/main = c28b7de6（未 push，等门 2）。
- **五块**：
  ① `productImageCount` 前端赋值（metadata → buildGenerationConfig → backendProviderConfig → 请求体）
  ② handler `createCloneRecreateNode` + `clone-recreate-submission.ts` 纯函数（数组顺序契约）
  ③ 条目 `image.cloneRecreate`（tier 0 / dual_image / 3 参数面）★ 接上 `dual_image` 的真实消费方
  ④ 节点图模板（F-2 扩 `canFrameContain` +1 行，未新增 CanvasNodeType）+ 空状态卡入口
  ⑤ 提示词层2 六段式 + 3 条 concatRules（C-2：全后端，des 文本后端单点存放）
- **门禁**（绑 8f6b59ba / fd2b1f53）：tsc 0 / eslint 0 / bun test **3167 pass 0 fail**（基线 3132 + 35）
  / registry-namespace-guard 14 pass / go build 0 / go vet 0 / gofmt clean / go test Clone 7 pass。
- **证伪**：8 处注入，实测 4/3/1/1/1/1/2/1 red（红数附注入点，V7 附1-a）。
  ★ 其中「真实入口消费路径」测试（非谓词自证）：选区工具栏 `selection-clone-recreate`
  在选中恰好 2 张图时渲染、1/3 张时不渲染；注入 `applicable: () => true` → 2 red。
- **控制线独立核实**：文件面 / 五段正文逐字 / 11 条 des 逐字 / C-2 前端无真值 / F-2 +1 行 /
  全量 3167 / guard 14 / F-09 35 / Go 7 / 接线两处消费 —— **全部一致**。
- **★ 控制线发现 1 处可追溯性缺陷（已修）**：注释里的语料索引 `inputs[8]` 应为 `inputs[7]`。
  实测：`inputs[5]=clone.degree` / `[6]=clone.scope` / **`[7]=copy.mode`** / `[8]=copy.text`（text 型无 item）。
  代码值不受影响（提取按 `field_path` 匹配而非索引），仅注释索引错 —— 但后人按注释查语料会找不到。
  同族：V7 附2（引用溯源维度）。修于 `fd2b1f53`（3 行，2 文件）。
- **门 2（合入门）**：控制线派测试线独立跑（被测 = fd2b1f53，分身 oac-wt-test，判据连续两轮全绿、retries=0），
  **门 2 结果出来前不 push fork**。评审线并行做代码面复核（8f6b59ba）。
- **flakes 说明**：全量测试首轮 1 red（`fallback snapshots obey the configured minimum refresh interval`，
  agent-canvas-sync.test.ts 计时窗口），隔离跑 8/0 ×3，第二轮全量 0 fail —— 已知 flake，与本批无关。
- **诚实边界**（报告 §7）：不含引导标记（步骤 3）；不含模板市场/跨用户复用；
  **参数面 UI 未实现**（只落地数据结构与提交链路，用户当前拿默认参数）；
  只实现 3 条 concatRules（其余 8 条无 UI 可填值）；未做浏览器实测；未做真实生成。
- **报告落盘**：`docs/artifacts/f09-canvas-template-delivery-report.md`（9 节）。

## 2026-10-06 · F-09 三期修复批（A线，40b9c915，已 push）

- **背景**：门 2 绿（测试线 14 passed / 0 failed ×2）；评审线复核发现 2 阻塞 + 4 非阻塞；
  控制线另查 3 项 + □5-2 定性为缺陷。
- **缺陷性质**：**登记层与运行时接线脱节**（非功能失效）。
- **交付**：`40b9c915`（10 files +469/-17），已 push fork，三方一致（local = fork = 40b9c915）。
- **★ B-1（核心修复）**：`dual_image` 谓词悬空 —— 入口原先内联 `ctx.selectedImageCount === 2`
  （谓词的第二份实现）。改为调用 `capabilityContextSatisfied` ⇒ 单一真值。
  **判据（决定性）**：注入「谓词 `===2` → `===5`」——
  **修复前**：真实入口测试**全绿（未红）** ⇒ 入口不经过谓词（控制线独立验证）；
  **修复后**：真实入口测试 **2 red** ⇒ 改谓词入口随之改变 ⇒ 接线成立。
  架构合规：不违反「禁止把能力层字段塞进 ToolDefinition」—— 是按钮层**调用**能力层**谓词函数**，
  不是搬字段（架构方案 §1.1 的唯一契约仍是 `executionChain.handler` ↔ `ToolbarHandlers.onXxx`）。
- **B-2**：handler `createCloneRecreateNode` 零消费方 ⇒ `project.tsx` `onGenerate` 按
  `metadata.cloneRecreateParams` 派发（只有模板产出的生成节点走专属链，其他 Config 零影响）。
- **新-1/新-2**：`entryPoints` 两个入口分开登记（`create-card` → 模板 id；`selection-toolbar` → 真实 tool id）。
- **新-3**：升格枝无运行时派发机制（`grep entryPoints web/src/` 除定义外零命中）⇒ 登记为架构缺口，本批不实现。
- **N-1**：守卫扩 `create-card` 校验源（`CANVAS_TEMPLATES`）+ 新增「kind 必在 `GUARDED_ENTRY_KINDS` 内」
  断言（未来新增 kind 会被强制同步，防静默跳过）。
- **N-3**：选区入口填入选中图（`instantiateTemplate(id, sourceImageIds?)`，按模板顺序填槽位）。
- **N-4**：默认 `copyMode` 改 `no-copy`（依据 `F-09-IMPLEMENTATION-PLAN.md:468`「短期只保留 no-copy」）。
- **□5-2**：模板卡在 guided 态不可达（默认新建画布 = guided）⇒ 控制线裁定为**缺陷**
  （任务书 §2.3 判据①写的是「空状态出现」而非「freeform 态出现」）。方案 D：guided 态加**独立区域**
  （不混入短剧引导语义）。
- **未修并上报**：**N-2** 顺序契约可被用户操作破坏（`productImageCount` 写死 1，删图/重排后静默错位；
  后端无法校验 —— `providerMedia` 无语义标签）。评估过三条修法（动态计算/监听删除/槽位锁定）均有代价，
  倾向只登记边界，等控制线裁定。
- **门禁**：tsc 0 / eslint 0 / bun test **3178 pass 0 fail**（起点 3167 + 11）
  / registry-namespace-guard 15 pass / F-09 测试组 55 pass / go build 0。
- **证伪**：8 处注入，实测 **3/1/1/1/1/1/1/1 red**，恢复后全绿。
- **★ V9 ①（注释免疫）实例**：`f09-fix-batch.test.ts` 首版用
  `expect(source).not.toContain("ctx.selectedImageCount === 2")` 反证内联比较已移除，
  但**被修复注释里引用的旧代码满足**（注释写了 `原先这里写 ctx.selectedImageCount === 2`）
  ⇒ 改为**剥离注释后断言**（先 `replace` 掉块注释与行注释）。这是 V9 ① 家族的新实例。
- **报告落盘**：`docs/artifacts/f09-canvas-template-fix-report.md`（7 节）。

## 2026-10-06 · V10 归因纪律（A线 3 处错误 + 2 处控制线修正）

- **背景**：G4.1 事件（index.lock 撞车）后 A线 报告归因，控制线用 /proc 核实后指出归因错误。
- **★ A线 3 处错误**（均已认错并登记）：
  1. **归因未经 ID 核实**：抓到 ps 输出（含 `TRELLIS_CONTEXT_ID`）却**没比对**，
     凭脚本内容（"建修复批隔离树"、"把 A线 的未提交修复同步进隔离树"）推测是控制线，
     实为**评审线**（context ID 前缀 `pi_01a10788-...` 一致）。
     ⇒ **C8 同族错误**（C8：投递前核实 handle；本次：归因前核实 context ID）。
  2. **说「patch 0 字节不是已提交」**：主因**就是**已提交 —— 修复批 `40b9c915` 在
     13:08:24 提交，patch 生成于 13:10:48（晚 2m24s）⇒ `git diff` 永远看不到已提交内容。
     控制线的推论「0 字节 ⇒ 已提交」**正确**。A线 用「journal 已暂存」解释属**附带原因**误作主因。
     ⇒ 已自查修正（commit `53aad656`）。
  3. **说「并发建树」**：实为**串行**（先建后删重建），用词错误。
- **★ 控制线 1 处修正**（A线 核实后指出）：
  - 控制线据「reflog 无 `9b80133d`」推断「PID 980725 那次 worktree add 失败/或路径不同」。
    **A线 做了隔离实验**（/tmp 仓库）：
    ```
    ① worktree add tree1 <C1>   ⇒ reflog 首行 = C1
    ② worktree remove --force   ⇒ ★ .git/worktrees/tree1 目录【整体删除】（含 reflog）
    ③ worktree add tree1 <C2>   ⇒ reflog 首行 = C2，★ 无 C1 任何痕迹
    ⇒ 「reflog 无记录 X」不能证明「从未以 X 建过」
    ```
    ⇒ 正确结论：只能断言「**当前**树的起点是 40b9c915」；「先建后删重建」标为**待确认**
    （管理目录 mtime 13:13 晚于 PID 980725 启动 13:09，但无操作方输出确认）。
- **★ V10 纪律已登记**（`docs/artifacts/multi-line-discipline.md`，commits `aaa72d90` + `53aad656` + `de3d086d`）：
  ```
  V10-a 报告归因前必须用进程身份（context ID / handle）核实，不得凭脚本内容/时间邻近/行为模式推测
  V10-b git diff 导出他人未提交改动时用 git diff HEAD（含暂存区）
  V10-c 判断某次 git 操作是否失败以操作方输出为准，reflog 只反映成功状态
  V10-d（控制线建议）隔离树创建起点以 .git/worktrees/<name>/logs/HEAD 为准
  V10-e（A线 实验）worktree remove 会删除 reflog ⇒「reflog 无记录」不能证明「未建过」；
        须配合管理目录 mtime 与进程启动时间对照
  ```
- **★ 本轮共性**：3 处错误都在【未穷尽证据】时就下结论（V7 附2-e 同族）。
  - 错误 1：有证据（ps 含 ID）但**没用**
  - 错误 2：有反证条件（时间戳）但**没查**
  - 错误 3：有验证手段（worktree reflog 语义）但**没试**
- **当前状态**：`local main = fork/main = de3d086d`（三方一致）；被测对象 `f88feac7`
  （`git diff f88feac7..de3d086d --name-only` 仅 1 个 docs 文件，代码面命中 0）。

## 2026-10-06 · F-09 修复批第二轮（A线，a492b089，未 push）

- **起点**：main @ a7c2575c（第一轮修复批 40b9c915 的代码面）
- **评审线发现**：B2-1（B-2 派发在不可达路径，handler 仍零消费方）+ N3-1（非图片节点可占产品图槽位）
  + 断言质量（多项是源码文本断言，无捕获语义失效能力）
- **★ B2-1 根因**（评审线 5 步证据链，A线 独立复核成立）：
  ```
  爆款复刻节点 type = CanvasNodeType.Config
  Config 渲染分支 = CanvasConfigComposer（Props 无 onGenerate）
  第一轮的 createCloneRecreateNode 调用在 CanvasNodePromptPanel.onGenerate
  ⇒ Config 节点永不渲染该组件 ⇒ 调用不可达
  Config 的真实生成入口 = CanvasConfigNodePanel.onGenerate（project.tsx:2505）
  ```
  ⇒ **代码本身正确，只是挂错了组件**。
- **修法（方案 ②+③）**：
  - 新增纯函数 `resolveConfigGenerateAction`（判据）+ `dispatchConfigGenerateAction`（分支）
  - `project.tsx` 派发退化为**无分支纯接线**，两个 onGenerate 共用同一入口
  - **★ 为什么把分支搬进纯函数**：分支留在组件内时测试只能文本断言；
    搬出后可用 spy handler 行为断言，且「改分支条件」注入点在 project.tsx **物理消失**
- **★ 自我发现（最有价值的一条）**：第一版行为断言只覆盖纯函数，**未覆盖派发点分支** ——
  注入「`&& false`」⇒ **0 red**（未被捕获）。修正后分支搬进纯函数，spy 断言覆盖。
  ⇒ 控制线的批评（文本断言无捕获能力）在**更深的层次**上同样适用于我第一版的「行为断言」：
  **我只行为化了纯函数，没行为化调用点**。
- **N3-1 修法**：新增纯函数 `resolveTemplateImageSlots`（过滤图片节点 + 位置配对 + 只填有内容的源）
- **★ 语义判定（测试初版假设错误，已修正）**：
  ```
  sourceImageIds = [img-empty(无内容), img-ok(有内容)]
  · 位置配对（当前实现）：img-ok → slot-layout，slot-product 保持空  ✓
  · 压缩填充（初版假设）：img-ok → slot-product                     ✗ 错位
  为什么位置配对对：模板契约是「位置即角色」；压缩会把版式参考图
  【静默提升为产品图】，后端按位置编号无法察觉。保持空则占位可见。
  ```
- **□5-2 采用【选项 C】**（比控制线给的 A/B 都强）：
  - A：保留文本断言 + 如实标注（控制线推荐）
  - B：抽纯函数 `shouldRenderTemplateCards`（只验证判据，不验证渲染）
  - **C（A线 采用）**：`react-dom/server` 的 `renderToStaticMarkup` **真实渲染**组件
    （项目已有 react-dom 依赖，**无新增**），断言输出 HTML
  - 新文件 `web/test/f09-guided-template-cards-render.test.tsx`（5 测试）
  - **为何选 C**：B 只验证判据不验证渲染（无法覆盖「判据对了但渲染没挂」）；A 是承认无法验证
- **★ 注入记录（8 条，V10-g 要求）**：判据恒 generic 2 red / 判据恒 clone 1 red /
  `&& false` **0 red（失败，已修）** / 去掉类型过滤 2 red / `false && templateCards?.length` 3 red /
  **★ `[].map` 保留文本渲染为空 2 red** / 卡片改 span 1 red / 首次 div 闭合不匹配**语法错误作废重做**
  - **★ 第 6 条是关键**：`[].map`（文本全保留、渲染为空）⇒ 2 red
    —— 这正是控制线对 N3-1 用的同类注入形式 ⇒ 证明 □5-2 的**渲染测试能捕获**该形式
- **门禁**：tsc 0 / eslint 0 / bun test **3191 pass 0 fail**（起点 3178 + 13）
  / F-09 测试组+守卫 68 pass / go build 0
- **报告落盘**：`docs/artifacts/f09-canvas-template-fix-report-round2.md`（7 节，含注入记录表 + 失败登记）
- **★ V10-g（控制线登记）**：他人活动工作区不可读 —— 控制线在 A线 注入窗口跑测试得三次不同结果；
  评审线两次导出快照落在注入间隙（靠 md5 对照发现）。**A线 的义务**：STOP 报告附注入记录表 +
  每次注入后立即恢复（已做到，本次 8 条全登记）。
