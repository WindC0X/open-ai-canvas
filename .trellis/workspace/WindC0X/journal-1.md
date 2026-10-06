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

## 评审线 R1 登记（2026-10-05）

### 交付

- 主报告：`/tmp/review-r1.md`（167→184 行，含核验回执补记）
- 全清单归档：`/tmp/review-r1-full.md`（1300 行，78 条全覆盖：批/文件/行/证据/建议/优先级）
- 明细：`/tmp/review-r1/agents/batch-{A..F}.md`（6 批）+ `verify-{A..F}.md`（核验）
- 范围：`b858bd1d..374bdf22` 六批全量（源 48 + 测试 20 = 68 文件）

### 结果

**78 条**（P0=0 / P1=18 / P2=39 / P3=21）。18 条 P1 **全部经独立对抗核验 confirmed**（0 refuted），
6 条精度修正 + 2 条降级建议（A-1/B-3 → P2，控制线已批准）。

### 方法链（本轮固化）

1. **OCR delegate 分诊** → 4 规则组，68/68 覆盖
2. **deepseek-v4.1-flash 子代理行级评审** → 6 批，含动态验证（bun test / go build+test / go overlay 探针）
3. **独立红队核验** → 18 P1，对抗而非确认

### 教训（控制线指令入档）

**★ 并行子代理写同一产出文件 = 后写覆盖**

- 实例：batch-A.md 被两个并行进程写两次，v1（16 条）被 v2（12 条）覆盖，v1 独有 7 条线索从日志恢复（完整证据丢失）
- 根因：派发指令让每个代理「写入 `agents/batch-<X>.md`」，但 A 批被重跑两次（先 setsid 残留进程、后 workflow 派发），两次都写同名文件
- **纪律（升格）**：产出文件按代理分名 —— `agents/<agent-id>.md`，汇总阶段再合并；禁止多个并行代理写同一路径

**★ 裸 pi 子进程随会话回收**（补充教训）

- 实例：`nohup`/`setsid` 后台 pi 进程在 bash 会话结束后被回收，C/D 两批首轮全部丢失
- 正解：用 `workflow` 工具编排（运行时管理生命周期），不要自己 fork

### 控制线裁定（已执行）

1. A-1→P2（改写：消费侧版本校验未落 + 验证记录未登记缺口）、B-3→P2（合并入 F-08）
2. 修复令按批归口：B线 = E-1/E-2 + B-1/B-2 + D-1/D-2（+B-3）；A线 = C-1~C-5 + F-1/F-2/F-3 + A-2 + A-1
3. 「报告断言逐条对码」纳入验收门（修复批起执行）
4. 全清单归档 → `/tmp/review-r1-full.md`（本登记同批）

### 未复核线索（下轮补审清单）

`--label` 路径穿越（**已独立成立**，P3 登记：`scripts/snapshot-registry-seeds.sh:122` 的 `dir_name="$stamp-$label"` 可写出 snapshot root 外）。
其余 4 条：三段式 id 零报警 / assetKind 落枚举纪律空转 / 12/12 legacy prompt 不同源 / `signal` 参数声明不符。

### 下轮预告

sync 面（`e4be6253` 23 冲突解决 + `3067c40b`/`eb86fd87`/`a9949aeb` 3 修正 commit）+ 修复批回归面。

---

## 评审线 R2 登记（2026-10-05 · sync 面）

### 交付

- 报告：`/tmp/review-r2.md`（167 行）+ 三批明细 `/tmp/review-r2/agents/S{1,2,3}.md`
- 范围：sync ritual #2 = `9c3ef6c8`（23 冲突文件）+ `3067c40b`/`eb86fd87`/`a9949aeb` 三修正 + `e4be6253` + journal `f180edf5`

### 结果（★ 含自纠）

- **原始条目 23**（S1=8 / S2=7 / S3=8）→ 去重后 **16 唯一机制** → 剔除 2 条证伪后 **14 条有效**
- **P1=4 / P2=9 / P3=1**
- 初版报告误写「25 条（P2=13/P3=8）」——回执后自纠，**控制线 P2 台账应按 9 条登记**

### P1 四条

1. **S-1** `9c3ef6c8` 自身不可编译（tsc 复现 TS1005/TS1472，连续 3 提交带病）
2. **S-2** prefill 双通道短路（`return` 提前返回 + id 命名空间碰撞 → fork 通道死代码）
3. **S-3** 文档死链（`update-announcements` 移动后两处站内链接未跟改）
4. **S-4** flora 孤儿令牌 + PATCH-MAP L1 处置未回填

### ★ 核验层对抗成果（本层设计的价值证明）

**证伪 2 条子代理断言**：
1. S3 称「4 参路径 P3 修复被回退」→ **读反条件分支**（`editorProject ? previous : {...previous, nodes}`，4 参走 false 分支 = 活体 basis，与 fork 原版一致）；S2 逐调用点核对结论正确
2. S3 称「`canvas-remote-revision.test.ts` 不在树内」→ **事实不符**（`git cat-file -e` 五个 ref 全部 EXISTS，`:285` 正是所述测试）

**方法**：子代理报告不直接采信，P1 逐条由主评审独立复核（三方 blob 对照 / tsc 复现 / git cat-file）。

### 控制线裁定（已接收）

- P1 三条 + S-1 ritual 条款 → **归口 A线**（S-2 修法 A线自判后报；S-3 两处链接 + 全 docs 扫；S-4 删定义 + PATCH-MAP 回填；S-1「合并 commit 必须自身可编译」入 ritual）
- P2 登记缝隙池（**修正为 9 条**，非 13 条）
- P2-7（R1 无修复）确认无需动作；P2-9 并入 S-1 ritual 条款

### 教训

**★ 跨批重复与计数失真**：三批子代理独立评审同一代码面，必然产生同机制多视角条目（本轮 6 组重复）。汇总时必须去重，否则污染台账（本轮差点让控制线按 13 条登记 P2）。**纪律**：汇总阶段先做机制级去重，再报计数。

---

## 评审线 R3 过程教训（2026-10-05）

### ★ 教训一：跨文件系统路径写错 → 子代理在 9p 挂载上跑测试 → 卡死

**现象**：T3 两次卡死（首轮 `w5-review-r3`、二轮 `w5-review-r3-full`），tokens 停止增长。

**根因链**：
1. 我在 `/tmp/review-r3/shared-context.md` 写了 `cd /mnt/f/CODE/Project/oac-wt-test/web` —— **该路径不存在**（正确：`/home/windc0x/oac-ext4/oac-wt-test`）
2. 子代理找不到就自行搜索，摸到 `/mnt/f/CODE/Project/oac-wt-f08/web`（有 node_modules）
3. 在 **9p 挂载**（`/mnt/f` = Windows F: 盘）上跑 `bun test` → 进程卡在 `D (disk sleep)` / `wchan: p9_client_rpc` → agent 挂起

**证据**：`ps -p <pid> -o stat,wchan` → `D` / `p9_client_rpc`；`df -T /mnt/f` → `9p`；tokens 两次采样完全相同。

**纪律（升格）**：
- 派发前**必须验证共享上下文里的每个路径真实存在**（`ls -d` 一次即可）
- 动态验证路径一律用 ext4：`/home/windc0x/oac-ext4/*`；**禁止 `/mnt/f` 下跑 bun test / go test**
- 卡死识别信号：tokens 两次采样相同 + `ps` 见 `D` 状态进程

### ★ 教训二：后台 workflow 不该轮询

**现象**：我用 `sleep 300/420/480` + `ls` 反复查看产出，浪费 wall-clock 与 token，且**轮询掩盖了卡死**（一直在看却没检查进程状态）。

**正解**：`workflow` 后台运行，**完成后自动把结果送回对话**——启动后告知用户、结束回合即可。要看进度用 `workflow_control status`（一次），不要 sleep 轮询。

### ★ 教训三：`agentRetries: 0` 会静默丢批

R3 首轮我写了 `agentRetries: 0`，T2 报错直接丢失（无产出、无重试）。R1 用了 1、R2 用了 0（侥幸没出错）。
**纪律**：评审类 workflow 默认 `agentRetries >= 2`。

### ★ 教训四：workflow 形态必须完整（评审 + 核验）

R3 首轮我只写了单阶段「评审」，丢了 R1/R2 都有的红队核验阶段——标准流程退步。
**纪律**：评审线 workflow 固定两阶段 = 评审 + 核验（P0/P1 全量红队对抗）；启动前对照标准形态自检。

---

## 评审线 R3 重启事故登记（2026-10-05）

### ★ 教训五：跨重启产出持久化（/tmp 不可靠）

**现象**：系统重启 → `/tmp` 被清空 → R3 三批产出（T1/T2/T3 报告）+ prompt + shared-context **全部丢失**，只剩工作流运行记录与仓库侧 journal。

**损失**：T1（12 条/5 P1）、T2（8 条/2 P1）报告全文；主会话 jsonl 保留片段（`recall` 可查部分结论），但完整证据链丢失。处置 = 全量重建（prompt 与报告同丢）。

**纪律（升格）**：
- 评审产出**双写**：`/tmp/review-rN.md`（工作副本）+ 仓库侧持久副本 `.trellis/workspace/<dev>/review/rN/`（或压缩归档）
- 子代理产出（`agents/*.md`）在汇总后一并归档到仓库侧
- 提交节点：每轮评审完成即 commit 到评审线分支（本轮 R1/R2 已做，R3 未及）
- 识别信号：长时间评审任务跨越重启风险窗口时，中间产出也应有落盘点

### 本轮其他事故（已入档）

- ★ 教训一：共享上下文路径写错（`/mnt/f/CODE/Project/oac-wt-test` 不存在）→ 子代理摸到 9p 挂载跑测试 → 卡死（`D`/`p9_client_rpc`）
- ★ 教训二：后台 workflow 不该轮询（应等自动回送；轮询掩盖卡死）
- ★ 教训三：`agentRetries: 0` 会静默丢批（评审类默认 ≥2）
- ★ 教训四：workflow 形态必须完整（评审 + 核验两阶段）
- ★ 教训六（控制线纠正令）：动态验证树必须隔离——禁用测试线活跃 twin `oac-wt-test`（HEAD 会变），用评审线自己的 `oac-wt-baseline`

---

## 评审线 R3 完成记录（2026-10-05）

**锚点**：主面① `7db3fa10`（branch-only）/ 主面② `d6b6a952`（已合入 main）
**产出**：`/tmp/review-r3.md` + `.trellis/workspace/WindC0X/review/r3/`（含 6 份批次/核验归档）
**计数**：P0=0 · P1=3 · P2=8 · P3=9 = **20 条**（29 原始条目机制级去重后）
**P1**：① 护栏机检证伪性四盲区 ② 交付步合规成品判据不达 §5.3 ③ source 判据语义不稳固 + 标注测试不可证伪

### ★ 教训七：禁止直接读评审工作树文件（工作树 ≠ 被评审对象）

**现象**：T3 的两条副面线索（C1 角色卡门控、C2 analytics 时间窗）都直接读了评审工作区 `/mnt/f/CODE/Project/oac-wt-review` 的工作树文件——该树停在 `374bdf22` 系（R1 快照，sync 前旧 fork 代码），而非被评审对象 `d6b6a952`/`7db3fa10`。
**后果**：
- C2 整条证伪：引用的 `filter.From.UTC()` 只存在于旧 fork（工作树 :278 逐字命中），被评审面上 0 命中（已被上游 `whereTimeRange` 取代）；且 T3 把已存在的测试报成缺失。
- C1 的「证伪」无效：工作树 :32 有 applicable，被评审面 `7db3fa10:25` 无 applicable → R2-P2-3 线索实质成立。
**根因**：评审仓同时是「工作区」与「被评审对象的对象库」；子代理 `cat`/`grep` 本地文件时默认读工作树，而工作树 HEAD ≠ 评审锚点。
**纪律（升格）**：
- 读码一律 `git show <评审锚点>:<path>` 或 `git grep <pattern> <锚点> -- <path>`；**禁止裸 `cat`/`grep` 工作树文件**
- 核验层必须检查引用代码的拓扑归属（该行号在锚点上是否存在）
- 共享上下文增加显式警告；主面② 的读法给 `git archive` 解包方案（T3 已用 `/tmp/t3`，效果正确）

### ★ 教训八：批次报告的「行号匹配工作树」是拓扑错误的信号

T3-C2 的行号（272-278）在旧 fork 上逐字命中、在被评审面上是无关函数——**行号吻合度越高越要验证锚点**。同理 T3-C1 引 `:32`（工作树行号）而实际在 `:25`。

### 其他更正（本轮编排者裁定）
- T2 计数不符：自述 14（P2:6），实际 13（6 P1 + 5 P2 + 2 P3）
- R2-S2 子句「analytics 修复零测试覆盖」被证伪：测试 `TestSQLiteAPICallLogRangeUsesInstantNotOffsetText` 在 `f180edf5:63` 存在，复跑 PASS
- verify-T3 的集合求交算术有误：legacy(18) × UI(24) 交集实为 6（非 0）
- T1「Frame 筛选漂移致名额虚增」证伪（`positions.has` 兜底）
- T1「验收 7/8 被记为已达成」证伪（docs 无该声明）

### ★★ 教训九：发送消息必须验证「目标身份」，不能只信 input_accepted（2026-10-05）

**事故**：R3 完成后，我把报告发给了 `term_595163ef`（`Pi - open-ai-canvas`，实为 **A线工作会话**），并据此向用户宣称"已直报"。实际：
- 控制线从未收到（其屏幕原文：「R3 报告确认：控制线**未收到** R3 直报」）
- 消息进了 A线会话，A线助手开始"独立核实我的报告"——**评审结论提前泄漏给被评审方**
- 控制线真身 = `term_d0044894`（`F:\CODE\Project\pi`），我靠猜名字选错了终端

**根因（两层）**：
1. **身份验证缺失**：重启后旧句柄失效，我从 `terminal list` 按名字猜（"open-ai-canvas 像控制线"），未做特征验证
2. **回执误信**：`input_accepted` 只证明「输入被终端接受」，不证明「发给了正确的人」——与「验证形态必须匹配被验证对象」同族（回执验的是提交，不是投递）

**纪律（升格）**：
- 发送前**必须验证目标身份**：`orca-ide terminal read --terminal <t> --screen` 确认屏幕内容是该线（控制线屏幕含 `【控制线`/`开线令`/`收货` 等特征）
- 或搜历史：`grep -rl "特征串" ~/.pi/agent/sessions/` 定位正确会话，再找其句柄
- 发送后**必须读目标终端确认内容落地**（不能只看回执）
- **禁止**用终端名/目录名推断身份（`Pi - open-ai-canvas` 可能是 A线/B线/控制线任意一条）

**次生风险登记**：A线已看到 R3 报告片段（含其批次的 P1-1/P1-2）。评审线独立性受损——控制线裁决时须知悉此事实。

---

## 评审线 · 纪律文件落地记录（2026-10-05）

**控制线令**：`docs/artifacts/multi-line-discipline.md`（main `cfa20999`）四族 20 条，下批开工前必读。

### 已执行

| 要求 | 状态 | 证据 |
|---|---|---|
| ① 门禁脚本加 G1 空输入防线 | ✅ | `.trellis/workspace/WindC0X/review/review-gate.sh`（commit 60666496） |
| ② 报告格式按模板第五节 | ⏳ | R4 起执行（拓扑链 + 文件清单 + 门禁原始输出 + 断言对码） |
| ③ 文件遗漏/错误报告 | ✅ | 已回报控制线两处（见下） |
| ④ 下批开工前必读 | ✅ | 本文件已通读（四族 20 条 + 事故索引 + 任务书模板） |

### 门禁脚本（review-gate.sh）

- 两模式：`--merge <merge>`（自动 `^1` 口径）/ `<base> <tip>`（两点口径）
- **G1 防线已做可证伪验证**：空范围 → exit 1 + ❌ 中止（实测通过）
- 附带输出：代码面（剔 docs/.trellis）/ web ts·tsx 面 / **测试文件面**（ocr 默认漏，评审重点）/ V6 环境检查（隔离树 + 9p 警告）
- **G1 价值当场验证**：merge `6fab9f48` 上 `git show` = 2 文件，`git diff ^1` = **19 文件**（差 17 个本批核心文件）

### 文件问题（已回报控制线）

**问题一（★ 矛盾）**：D1 第 30 行 + C5 第 242 行均写「不 push」，但控制线实际令为「保全推送推 fork」。
- 后果：严格守「不 push」→ 分支只在本地 → 仓库损坏/误删/重建仍会丢（F-1 同类风险，从 /tmp 换成本地 git）
- 建议改为：「**不 push main；产出分支可推 fork 保全（branch-only）**」

**问题二（F-1 可部分恢复）**：D1 事故表 #2 称 F-1 只剩 journal 级摘要。实测：
- 主会话 jsonl 存活，**compaction summary（101011 字符）内含 batch-F 核验结论全文**（含 `model_router.go:308-311`、`channel-model-price-tier-fields.tsx:219`、`skuSelectorFromForm:113-116` 等精确行号）
- `recall` 可检索 verify-F 三条 P1 标题全文
- 已询问控制线是否需要整理「恢复版 batch-F 摘要」（须标注来源=压缩摘要转述，非原始正文）

### 纪律文件自查（评审线视角的补充）

- **C2「发送≠送达」本轮已实证**：R3 报告误投 A线（只信 `input_accepted`）→ 已入 journal 教训九；本轮发送前已 `read --screen` 验证身份 + 发送后验证 `Steering:` 落地
- **V6 隔离树**：门禁脚本已内置检查；发现 `oac-wt-baseline` HEAD 被切到 `06bf455a`（07:14，非我操作）→ R4 前需重切锚点
- **V4 环境基线**：`TestCloudAgent*` 5 红（undici 缺失）已登记，R4 引用即可

---

## 2026-10-05 · R4 第一段（B线 T1-P1 回归面）+ 补正

**锚点**：`45d0d583`（5 文件面）· **产出**：`review/r4/batch-B-t1p1.md` + `batch-B-t1p1-addendum.md`
**计数**：P0=0 · P1=3 · P2=2 · P3=3（含补正新增 P3-3）

### 教训十：失败归因必须追到**病因**，不能停在**症状**（V4 基线记录更正）

**背景**：V4 记录「`canvas-asset-repair` mock-leak 族（7 fail）」，R4 我又发现「本批 5 fail」，
控制线与我最初都采用「7 基线 + 5 本批」二分。**这个二分不准确**。

**决定性实验**：
```
baseline@45d0d583   全量                      → 3045 pass / 12 fail
baseline@45d0d583   全量 - load-deadlock      → 3017 pass /  0 fail   ← 全部转绿
_r4-probe@382de2cc  全量                      → 3044 pass / 13 fail
_r4-probe@382de2cc  全量 - load-deadlock      → 3017 pass /  0 fail
配对：load-deadlock + asset-repair → 5 pass / 7 fail（顺序无关）
      asset-repair 单独            → 10 pass / 0 fail
```
⇒ **12 条失败全部来自同一污染源**（`user-data-sync-load-deadlock.test.ts` 的 `mock.module` 进程级泄漏），
`canvas-asset-repair` 自身完全干净。**排除污染源后全量 0 fail**（3 次复跑一致，无 flaky）。

**教训**：
1. **「哪个文件红」是症状，「谁泄漏」才是病因** —— V4 记录症状而未追病因，
   导致后续所有轮次都把 7 条当作「不可修的基线」接受，**掩盖了真实修复路径**（修一个文件的 mock 即可全绿）
2. **基线登记必须记录排除法验证**：登记 N 条失败时，应验证「排除某文件后是否归零」，
   否则无法区分「独立基线」与「同一病因的多重受害面」
3. **配对实验是归因的决定性手段**：单文件跑（10/0）vs 配对跑（5/7）足以锁定因果

### 教训十一：门禁声称的验证必须**在其自己的 commit 上**复现

B线 自述「全量 3057 pass·0 fail（绑定本 commit `382de2cc`）」。我在**它自己的 commit** 上
（临时 worktree，ext4）实跑 = **3044 pass / 13 fail** ⇒ 「0 fail」在其 commit 上**无论如何不成立**。

⇒ 复核门禁声称时，**不能只在合并后的 tip 上跑**（那样无法区分「作者环境问题」与「commit 本身红」）；
必须**切到作者声称的 commit** 上复现。控制线的「drvfs 环境」归因方向正确，但**不完整**——
即使换到 ext4，该 commit 依然红。

### 教训十二：修法建议必须**验证其数据前提**

控制线采纳修法 (b)（`/create` 会话历史加「回到画布」入口，消费 `canvasId`）。我核实：
- `CreationConversation.canvasId` **全仓仅 `:864` 一处写入**（`:862` 既有创作交接路径）
- **卡流程两分支（`:1152`/`:1176`）零写入**
- 更关键：卡流程会话 id = `linear-flow-${taskId}`，**不进 `/create` 的 conversations 列表**
  （`updateCreationConversationSnapshot` 调用点 `:403/:409/:864/:929` 均非卡流程）

⇒ 修法 (b) 的**入口无处安放**（历史列表里根本没有这条会话）。
**教训**：提修法时不能只验「字段存在」，要验「**该入口的数据源是否包含目标对象**」。

### 本轮方法（可复用）

- **8 轮注入证伪矩阵**（6 有效 / 2 假绿）→ 假绿项即 P2
- **二分定位污染源**（逐文件配对跑）
- **三路径穷举**（列表 / 任务面 / canvasId）证明「无路径可达」
- **排除法验证基线**（排除污染源后归零）
- **临时 worktree 复现作者 commit**（不污染隔离树，用完即删）

---

## R4 第二段完成记录（2026-10-05）

**锚点**：`b52b206c`（= fork/main = 本地 main，`ls-remote` 实测一致）
**范围**：A线 18 commit（经 merge `721a93ce`）+ B线 1 commit（经 merge `f6236a18`）
**报告**：`.trellis/workspace/WindC0X/review/r4/seg2-report.md`（commit `d9f1a2d1`，已推 fork）

### 结论

```
计数：P0=0 · P1=0 · P2=1 · P3=0
18+1 commit 回归面 → 零功能缺陷
```

| 对象 | 我的注入 | 实测 | 判定 |
|---|---|---|---|
| `a98e587e` P2-1（锚点消失） | 恢复原 early-return 写法 | 1 红 | ✅ 修复前假绿 |
| `a98e587e` P2-2（注释满足） | 只删代码保留注释 | 2 红 | ✅ 修复前假绿 |
| `a98e587e` P2-2（顺序断言） | 交换 message.error/setNodes | 1 红 | ✅ 顺序断言有效 |
| `3d2660ed` P1-2（桩隔离治本） | 三组配对跑 | 0 fail | ✅ 根治（原 7/5 红） |
| `3d2660ed` A-3（空 manifest） | 空/注释/缺 manifest | exit 2 | ✅ 有效（原 exit 0） |
| `3d2660ed` P2-2（Pick 白名单） | 删白名单 | TS2353 | ✅ 有效（原 exit 0） |

### ★ 两条正向发现（不只找问题）

**① A线 的 P2-2 修复超出我的建议**
我建议 `stripComments`；A线 实现**两道防线**（剥注释 + **顺序断言**）。
⇒ 我证伪「交换 `message.error` 与 `setNodes` 顺序」→ **1 红**，
证明**顺序断言有效**（注释无法满足）——这是**对 P2 的彻底修复**（连根因形态也堵住）。

**② B线 治本中的治本**
除 `mock.module` → `spyOn` + `afterAll`，B线 还发现**第二层问题**：
> 只处理 `projects` 的桩会吞掉 persist rehydrate 回调写入的 `hydrated`，使守卫误报

⇒ 改为**透传真实 store 的其余字段**。控制线独立确证（配对跑 4 pass / 5 fail）。

### P2 flaky（新发现，控制线裁定：成立，按已知 flaky 处置）

**对象**：`web/test/agent-canvas-sync.test.ts:75`
```ts
await sleep(250);
expect(times).toHaveLength(2);   // ← 失败行
```
**根因**：依赖真实定时器 + 100ms 窗口；并行负载下定时器回调可被延迟出窗 ⇒ 只刷新 1 次 ⇒ 假红。

**三方证据**：
| 来源 | 复现率 |
|---|---|
| 我（高负载，跑注入实验时） | 单文件 6 次 1 红 / 全量 6 次 2 红（33%） |
| 控制线（空闲树） | 单文件 8/8 全绿 / 全量累计 7/7 全绿 |
| 测试自身注释 | 已登记「全量并行 + /mnt/f 慢 IO 下可延迟出窗 → 假红」 |

⇒ **flaky 性质确认**，复现率**随系统负载变化**。

**修法优先级（控制线采纳我的排序）**：
```
① 注入可控时钟（fake timer）—— 最优（根治）
② 放宽为 toBeGreaterThanOrEqual(2) + 独立断言最小间隔 —— 次优
③ test.skip + 登记技术债 —— 兜底
```
**处置**：不并入当前批，登记「修缮缝隙池」，随 W6 或 D-1/D-2 之后处理。

### ★ 教训十三：flaky 的复现率不是常量，是负载的函数

**触发**：同一测试，我测 33% 红、控制线测 0% 红。

**教训**：
> 报 flaky 时必须同时报**测量时的系统负载条件**，
> 且**不能把「我这跑不出来」当作「不是 flaky」的否定证据**——
> flaky 的判定依据是**机制**（时序依赖、竞态、资源竞争），不是**单一环境的复现率**。
> 反过来，验收方也不能把「我这全绿」当作确定性证明。

**同族**：V7（报告断言必须来自实测记录）的镜像面——
V7 管「不要把没测的说成测了」，本条管「不要把负载相关的测不准说成确定」。

### ★ 教训十四：V4 验收口径必须标注已知 flaky

**触发**：控制线今日多次表述「全量 3078 pass / 0 fail」而未标注 flaky 存在。

**教训**：
> 「全量 0 fail」应表述为「**全量 0 fail（除已知 flaky）**」，
> 否则验收方无法区分「新缺陷」与「已知 flaky」——
> **这是 V7「报告断言必须精确」在验收口径上的延伸**。

**控制线已采纳并修正今日口径**：
```
全量 bun test → 3078 pass / 0 fail
              （除已知 flaky：agent-canvas-sync.test.ts:75，
                复现率随系统负载变化，空闲时 7/7 全绿）
```

### ★ 方法论沉淀：§0 语义角色分类的价值验证

`dc8965a0`（test/重构）与 `e2431865`（fix）**都涉及 T2-P1a**，但**角色不同**：
- 前者是**提取纯函数**的重构 ⇒ 注入必须验**接线**（恢复旧 inline 条件）
- 后者是**死锁修复** ⇒ 注入必须验**行为**（构造全 headless 页）

⇒ **分类强制前置避免了「验证对象错配」**——
这是清单 §0 从 V1 教训（commit 语义角色）升级为**强制步骤**后的第一次实战验证。

### 环境

- 依赖共享：`web/node_modules` + `backend/agent-runtime/pi/node_modules` 均软链测试线 twin
  （**源码隔离、依赖共享**；本轮未观测到漂移）
- **未在 `/mnt/f` 跑测试**（V6）
- 后端 `TestCloudAgent*` 5 红：**软链 pi 依赖后消除**（PASS 4.54s）
  ⇒ 再次确认归因为**环境缺口**（`backend/agent-runtime/pi/node_modules` 缺失，需 `npm install`）

### 评审-修复闭环关闭

```
R1(78) → R2(14) → R3(7) → R4(2 P2 + 1 flaky) 全部结清
18+1 commit 双线核验零功能缺陷
main = b52b206c，全量 3078/0（除已知 flaky）
```

**评审线状态**：待命。下一评审对象 = B线 主批 D-1/D-2（可达性）+ 测试线 b12r21 报告。

---

## R5 完成记录（2026-10-05）

**锚点**：`86f04568`（main tip）
**范围**：对象1 = B线 主批 `f0d2650e`（D-1/D-2，9 文件）；对象2 = G1 工具批 `86f04568`（1 文件）；对象3 = b12r22（未落盘）
**报告**：`.trellis/workspace/WindC0X/review/r5/r5-report.md`（commit `5b166c03`，已推 fork）

### 结论

```
计数：P0=0 · P1=1 · P2=3 · P3=1
控制线全部采纳 + P1 独立复现确认
```

### 六项评审重点（5 通过 + 1 保留）

| 重点 | 我的注入 | 实测 |
|---|---|---|
| ① D-1 预建时序 | 时序倒置 | 1 红 ✅ |
| ② D-1 降级路径 | 移除 try/catch | 1 红 ✅ |
| ③ D-2 两段式顺序 | 确认块移到创建后 | 1 红 ✅ |
| ④ D-2 收窄 | 移除 headless 判据 | 1 红 ✅ |
| ⑤ sessionKey 一致性 | 改名 | 1 红 ✅ |
| ⑥ 测试形态 | V9 三族核查 | ⚠️ 可接受（三族全防 + 顺序断言 + 行为测试） |

**⇒ 6/6 注入全部有效**，D-1/D-2 的六项设计意图全部正确实现。

### ★ P1：跨卡片状态残留（`canvasIdRef` + `stage`）

**注释宣称**（`linear-flow-runner.tsx:102`）：「card 变化即重置」
**实测**：组件零 useEffect + 父组件无 key + 无条件渲染 ⇒ 关闭卡片后实例保留。

```
① 卡片A 完成 → stage="done"，canvasIdRef=容器A
② 关闭（handleClose 不 reset）→ card=null → 组件不卸载
③ 打开卡片B → 同一实例 → stage 仍 "done"（显示 A 的结果）
④ canvasIdRef 残留 → 跳过预建 → ★ 卡片B 的任务带卡片A 的 projectId
```

**★ 本批加重**：`stage` 残留是既有缺陷；本批新增的 `canvasIdRef` 使其从「UI 残留（可恢复）」
升级为「**任务与容器静默错配**（无 UI 可恢复）」。

**控制线裁定修法**：父组件加 `key={linearFlowCard?.id ?? "none"}`（一行，与注释宣称一致）。
**★ 修复必须带反例测试 + 证伪**（V9 纪律）。

### P2 三条

| 编号 | 内容 |
|---|---|
| P2-1 | D-2 路径 B（预建容器命中、用户未点过「在画布中打开」）→ 容器 `chatSessions: []` → navigate 传的 conversation 不存在 → 画布弹 warning 且 **不 openAgent** |
| P2-2 | `scripts/merge-file-face.sh` mode = `100644`（无 +x），但 usage + G1 文档 + 示例均按直接调用写 → 实测 exit 126 |
| P2-3 | 依赖软链穿透（`_r5 → oac-wt-baseline → oac-wt-test`）→ 软链期全量间歇红；物理隔离后 5/5 全绿（**环境纪律，非产品缺陷**） |

### 对象2：G1 脚本（逻辑正确）

✅ 空输入防线（exit 1）｜✅ 根 commit fail-closed（无 `^1` → exit 1）｜✅ `set -euo pipefail` 安全｜✅ SCOPE 契约 stderr 分离
**P3**：`--exclude-deleted` 位置敏感（放在 SCOPE 后 → 静默语义漂移）

**★ 与 R4 A-3 对照**：同为 shell 校验脚本，**本脚本防线更完整**（数组 + 显性计数 + exit 1）。

### ★ 教训十五：注入必须覆盖缺陷的完整因果链（第二次踩中）

**触发**：R5 重点③ 首轮注入「只交换 `setLinearFlowTaskIds` 与确认块」→ **0 红**（假绿）。

**根因**：测试断言的是 `confirmAnchor < createAnchor`（`isLinearFlowTask` 与
`continueCreationConversationOnCanvas` 的相对位置），而我只移动了中间的一行 `setLinearFlowTaskIds`，
**真正的判据块未动** ⇒ 顺序关系未破坏。

**正确形态**：把 `isLinearFlowTask` 确认块**整体移到** `continueCreationConversationOnCanvas` 之后 → **1 红**。

**教训**：
> 注入时必须先问「**缺陷的完整因果链是什么**」——测试断言的是哪两个锚点的关系？
> 只移动链条中间的一环，两端关系未变 ⇒ 假绿。
> **若注入后不红，第一反应不是「测试无效」，而是「我的注入是否覆盖了完整链条」。**

**同源**：R4 C-1（归属校验前置 —— 泄漏点在**解析**而非**读取**，首轮注入只交换了读取与校验）。

**⇒ 这是第二次踩中同一陷阱**，说明该陷阱的复发率高，值得作为**注入前的强制自检项**：
```
注入自检三问：
  ① 测试断言的是哪两个锚点/行为？
  ② 我移动的部分是否在这条链上？
  ③ 移动后，两端的关系是否真的改变了？
```

### ★ 教训十六：共享依赖在他人有活跃写入时会导致假红

**触发**：R5 首轮我的 `_r5` 依赖链穿透到测试线 twin（`oac-wt-test/web/node_modules`），
而测试线的 vite（`:3400`）**正在运行**。软链期全量跑 6 次出现 2 次红
（`task-face-independence` 护栏间歇红 + `agent-canvas-sync` flaky）；
**物理隔离后（`cp -r`）5/5 全绿**。

**教训**：
> 动态验证的依赖必须**物理隔离**（`cp -r`），不只是源码隔离。
> 「依赖共享、源码隔离」（R4 登记）在**他人有活跃写入**时不成立 ——
> 共享的 `node_modules` 可能在并发构建/缓存写入期间产生**不可复现的假红**。

**控制线已登记为跨线纪律（R5 补充）**。

**★ 纪律演进链**：
```
R3：动态验证用隔离树（源码隔离）
R4：依赖共享、源码隔离（记录为已知风险）
R5：★ 依赖物理隔离（发现共享在他人活跃写入时导致假红）
```

### ★ 教训十七：报环境违规要自报（正面示范）

**触发**：我在 R5 报告中主动写明「这是评审环境纪律问题（R5 令⑤ 已要求「不用别人的树」，
**我首轮违反**）」。

**控制线反馈**：登记为「主动纠正自己的环境违规」的亮点。

**教训**：
> 违反自己刚接到的纪律时，**主动自报 + 说明纠正措施 + 记录发现**，
> 比「悄悄纠正不提」更有价值 —— 因为违规本身产生了新发现（教训十六）。
> **违规 → 自报 → 新知识** 这条路径，比「零违规」更接近纪律的真实目的。

### 控制线的三条亮点确认

| 亮点 | 控制线评价 |
|---|---|
| ① 首轮注入失败并自报 | 「**比一次成功更有价值**」——记录了部分注入的假绿陷阱 |
| ② 主动纠正环境违规 | 登记为跨线纪律 |
| ③ 发现新假红机制 | 对 R4「依赖共享、源码隔离」的重要补充 |

### 待办

- **对象3（b12r22）**：控制线已催测试线补落，落盘后我补做
- **R6**：B线 修 P1 + P2-1 + P2-2 后，我做回归面核验
  - **已预核修复形态**：`LinearFlowCard.id` 存在（`linear-flow-cards.ts:73`），
    JSX 位置可访问 `linearFlowCard`（`create/index.tsx:1117`）⇒ 裁定的 key 修法**可行**
  - P2-1 预核：`resolveTaskCanvasAction` 的 navigate 有两个来源（`:102` taskIds 命中 / `:110` projectId 命中），
    只有后者可能无会话 ⇒ 修法需**区分来源**或**导航前检查会话存在**

---

## R6 完成记录（2026-10-05）

**锚点**：`e4b59f89`（三方一致）
**范围**：B线 R5 修复批 merge `58eef5d2`（6 文件 +187/-8）—— P1（key）+ P2-1（sessionId）+ P2-2（权限）
**报告**：`.trellis/workspace/WindC0X/review/r6/r6-report.md`（commit `e31e93d9`，已推 fork）

### 结论

```
计数：P0=0 · P1=0 · P2=0 · P3=1
控制线验收通过：「质量是本轮最高」「本任务唯一的形式化论证」
```

### 三项修复核验

| 项 | 结论 |
|---|---|
| **P1（key）** | ✅ **充分且超出预期** —— key 重建实例 ⇒ **全部** state + ref 重置（不止 R5 列的两个点） |
| **P2-1（sessionId）** | ✅ 正确（「取最后一个」依据充分 + carrier 消息存活实证） |
| **P2-2（权限）** | ✅ 完整（index `100755` + 工作区 `-rwxr-xr-x` + 直接调用 exit 0） |

### ★ 形式化证明（控制线独立复核 4 项前提）

```
B_reach ⇒ ¬A_hit
        ⇒ ∀p∈projects: 无会话承载 taskId
        ⇒ bound ∈ projects ⇒ bound 内无会话承载 taskId
        ⇒ findTaskSessionId(taskId, bound) = undefined   ∎
```
**4 项前提**：全库扫描 / 判据一致 / 同一 projects / 扫描域包含 —— 全部实测确认。
**7 变体穷举**全部成立；**注入实测**：等价形态 0 红 / 错误值 2 红。

**控制线评价**：「这比我的『逻辑链复核』强一个量级 —— 我用的是『我觉得这条链成立』，
你给的是『在 4 项前提被实测确认下，命题必然成立』。」

### ★ 我额外贡献的两项（控制线列为「超出要求」）

**① SSR 可行性核查**（独立验证 B线「无 DOM」说法）
- 本仓无 happy-dom/jsdom/testing-library ✓
- `renderToStaticMarkup` 输出为空 —— 因 antd `Modal` 走 **portal**（对照实验确认）
- **⇒ 「验证别人的限制声称」而非采信**

**② result 分支 carrier 消息存活的实证**
- 模拟 service 真实映射 + 合并逻辑：`result` 分支**不带 taskIds**，但 carrier 消息在合并后**存活**（`detail.taskIds=["t1"]`）
- **⇒ 解释「为什么 result 交接后容器仍可被反查命中」**，是 P2-1 语义正确性的关键支撑

### ★ 教训十八：跨序列对比必须按「对象 + 形态」对齐，不能按序号对齐

**触发**：R6 报告 §7 的证伪汇总表，我把「控制线的注入2」与「我的新注入（key 硬编码）」
**并成同一行**，误述为「同一注入有分歧」。控制线指出并重跑确认：
```
注入 A（控制线的注入2）：tasks/index.tsx 恢复无条件 conversation  → 5 pass / 1 fail
注入 B（我的新注入）  ：create/index.tsx key 硬编码 key="runner"  → 4 pass / 2 fail
```
**⇒ 两项完全不同的注入，两项都成立**。错因：表格两列语义不同
（「我的实测」按我的注入序列，「控制线记录」按控制线的注入序列），逐行对齐时错配。

**教训**：
> 当对比两个**独立产生的序列**（我的注入 / 控制线的注入）时，
> **必须按「对象文件 + 注入形态」对齐**，不能按序号对齐 ——
> 序号只在同一序列内有意义，跨序列对齐会产生**虚假的「分歧」**。
> 若发现「分歧」，先问：**这两项真的是同一项吗？**

**同族**：V7（报告断言必须来自实测）的延伸 —— V7 管「数字要真测」，
本条管「**对比的对象要同一**」。数字都对，但**对错了对象**同样产生误导。

**处置**：报告 §7 已更正（新增「记账更正」段 + 按对象文件对齐的表格 + 错因说明）。

### ★ 教训十九：证据链的转述层数决定可信度衰减，应尽量直连

**触发**：控制线指出我的 §9 覆盖声明写「真机证据（B线 自跑 6 步）—— 我无浏览器环境，
**采信控制线转述**」，并说明该转述链有问题：
> 「B线 的报告 → 我 → 你，中间经过了我。若 B线 的报告有误，我会把错误一起转述给你。
> **建议：若你后续需要真机证据，可直接找 B线 要原始证据（它有 Orca 浏览器环境），不必经过我。**
> 我可以在任务书里明确『评审线可直连执行线取证』。」

**教训**：
> **证据链每多一层转述，可信度就衰减一层**（转述者可能引入误差，且无法被下游察觉）。
> 评审线需要执行线的原始证据（真机截图/日志/命令输出）时，**应直连执行线取证**，
> 而不是经由控制线转述 —— 即使控制线是可信的。
>
> **这与「控制线权威」不冲突**：控制线负责**裁定与派单**，
> 执行线负责**产出原始证据**，评审线负责**独立核验**。
> 三者的信息流可以点对点，不必强制经过控制线中转。

**控制线已承诺**：任务书中明确「评审线可直连执行线取证」。
**我的行动**：后续轮次需要真机证据时，直接用 `orca-ide terminal send` 找 B线/测试线要原始证据。

### 控制线确认的「超出要求」清单

| 贡献 | 控制线评价 |
|---|---|
| 形式化证明 | 「本任务唯一的形式化论证」「强一个量级」 |
| SSR 可行性核查 | 「验证别人的限制声称的正确做法」 |
| carrier 消息存活实证 | 「P2-1 语义正确性的关键支撑」 |
| 反例锚点评估（「守卫的守卫」） | 「这个定性准确」 |
| 族②注入失败并自报 | 「自报方法错误 + 记录为提醒，正确」 |

### 待办

- **对象3（b12r22 报告）**：控制线已催测试线补落，落盘后我补做
- **下一轮**：待控制线通知
- **证据链通道**：后续真机证据直连执行线（B线/测试线），不经过控制线转述

---

## R10 完成记录（2026-10-05）

**锚点**：`8c719abc`（三方一致）
**范围**：批A `75768505`（test，R8 P3-1 修复）+ 批B `d406f3a8`（V3 补附）+ 批C `8c719abc`（V9 ①-a + R9 P3-1 修复）
**报告**：`.trellis/workspace/WindC0X/review/r10/r10-report.md`（commit `6150eeb9`，已推 fork）

### 结论

```
计数：P0=0 · P1=0 · P2=0 · P3=0  ← ★ 本轮零发现
我 R8/R9 提出的两处 P3-1 均已正确修复
```

### 两处修复核验

**① R8 P3-1（`dump()` 全量语义无守护）→ 已修（`75768505`）**
```
我的注入 Y 形态（游标式增量）：R8 时 0 红 → 现在 ★ 1 红 ✓
修复含两条断言：单次 dump 全量 + 重复 dump 不消费
注释直接引用我的 R8 实测（X 形态 1 红 / Y 形态 0 红）—— 可追溯
```

**② R9 P3-1（行号表第四列口径不一致）→ 已修（`8c719abc`）**
```
拆为两列：selfCheck()（定义行 94/113/136）+ var before（赋值行 95/114/137）
我逐格核验 18 格 → ★ 全部吻合 ✓
★ 修复方式是「增加信息」（拆列）而非「简化」（改列名）—— 保留两种口径
```

### ★ 元层面的观察：R8 P3-1 的修复本身是 V9 ①-a 的预防性应用

**R8 我发现的是**：「纪律B 的注释依赖 `dump()` 全量语义，但该语义无测试守护」

**本次修复是**：「**给注释的事实前提加守护**」—— 不是修代码，而是**让纪律的依赖可证伪**

**⇒ 这正是 V9 ①-a 的预防性应用**：纪律注释的「承诺」（多轮不 reset 会污染）
依赖「`dump()` 全量」，若前提静默改变，注释会**过期误导**（同族于「测试名过度声称」）。

### ★ V9 ①-a 的关键洞察：方向相反

| | 方向 | 机制 |
|---|---|---|
| **① 注释免疫**（原） | 断言**太宽** | 被无关物满足 ⇒ **假绿**（缺陷被掩盖） |
| **①-a 测试名过度声称**（新） | 断言**太窄** | 承诺的一半无覆盖 ⇒ **缺陷逃逸**（测试名反向误导） |

**★ 我认可「升级为亚形态」的依据**：**同一文件内犯两次**（实例1 幂等长度断言 / 实例2 只验 DOM）。

**且修复方向正确**：**补断言追上测试名**（而非改测试名降级承诺）——
保持承诺、加强断言是更强的选择。

### ★ 四条纪律构成「证据可信性的四个正交维度」

| 纪律 | 维度 | 绑定什么 |
|---|---|---|
| **V7 附2** | **位置** | 行号 → commit 基准 |
| **V3 附** | **归属** | 谁 + 哪个 commit |
| **V9 ①-a** | **覆盖** | 断言 → 测试名的承诺范围 |
| **坑7** | **观测** | 证据 → 观测手段自身的污染 |

**⇒ 四者正交，组合起来是完整的证据审计框架** ✓
**且探针本身即是「坑7 纪律」的工程实现**（`msgLog.splice` 让观测不污染被观测对象）。

### ★ A线 的异步 observer 补测 —— 我独立复现

**A线 声称**：`setTimeout(fn,0)` 是宏任务，`queueMicrotask` 是微任务 ⇒ 微任务先跑 ⇒ `splice` 总能命中

**我的独立复现**（真机语义桩，MutationObserver 回调走 `queueMicrotask`）：
```
★ ok = true | msgLog = [] | 残留? 无 ✓
```
**⇒ 成立** ✓

**★ 这是 R9 我未覆盖的场景**：我用**同步桩**（`appendChild` 直接调回调），
A线 用**真机语义桩**（微任务）—— **两种都验证了修复健壮性**，
但**真机语义桩更接近浏览器行为**。

**⇒ 方法论收获**：**桩的保真度是可分的**（同步桩 < 微任务桩 < 真浏览器）——
选择哪一级取决于「被验证的性质是否依赖该级语义」（本次 splice 时序依赖微任务/宏任务差异）。

### 教训二十一：桩的保真度分级

**触发**：我在 R9 用同步桩验证 `selfCheck` 清理，A线 用微任务桩验证同一修复。

**教训**：
> 测试桩的保真度是**分级**的：同步桩 < 微任务桩 < 真浏览器。
> **选择哪一级，取决于被验证的性质是否依赖该级语义** ——
> 本次「`splice` 是否能命中自检记录」**依赖微任务/宏任务执行顺序**，
> 同步桩恰好绕过了该顺序（直接调回调）⇒ **微任务桩才有区分力**。
>
> **判据**：若被验证的性质涉及**时序/异步/事件循环**，同步桩的绿**不能证明**真机绿。

**同族**：V8（失败路径必须可诊断）的延伸 ——
V8 管「失败时能否区分原因」，本条管「**成功时桩的保真度是否足够**」。

### 状态

- **待办**：对象3（b12r22 报告）仍未落盘
- **下一轮**：待控制线通知
- **证据链**：后续真机证据直连执行线（R6 ⑥ 授权）

---

## R10 追加：④ 裁定 + 教训二十二（2026-10-05）

**触发**：控制线 R10 验收通过（首个零发现），但指出我的 §2.1 有一处**盲点**：
我核验批A 注释时只核「可追溯」，未核「在当前版本是否仍成立」。

### ★ 我独立复现了控制线的 ③（两版本对照）

在隔离树 `_r11`（ext4，依赖物理隔离）逐项实测：

| 版本 | X 形态（消费式增量） | Y 形态（游标式增量） |
|---|---|---|
| `@9b4c8b85`（加断言**前**） | **1 红** | **0 红** |
| `@f88fc24a`（加断言**后**） | **1 红** | **1 红** |

**⇒ 修正后注释（`de57a572`）的 4 个数字全部经我独立实测确认** ✓
**⇒ 控制线 ③ 完全成立**：同一表述「Y 形态 → 0 红」在两版本**含义相反**
（0 红 = 缺口在；1 红 = 缺口已补）。

### ★ 我的漏检（量化）

R10 我核验的「引用他方数字」的注释共 **1 处**（批A 注释）：
```
判据①（可追溯）通过率：1/1（100%）
判据②（版本成立）通过率：0/1（★ 漏检）
⇒ 本批漏检率 100%
```

### ★ 教训二十二：核验「引用他方数字」时，「可追溯」是必要但远非充分

> 判据①（可追溯）的通过率**结构性接近 100%** ——
> 因为「注释里的数字无来源」这种情况**很少见**（作者写数字时通常有依据）
> ⇒ **一个通过率接近 100% 的判据，区分力接近 0**。
>
> 判据②（版本成立）的通过率取决于「版本是否已变」——
> 在**快速迭代期**（本轮 3 天 3 次位移行号），版本变化概率很高 ⇒ **区分力强**。
>
> **必须显式检查「在当前 commit 上重跑能否复现该数字」**。

**为什么我会漏**：判据① 更省力（读一遍注释即可），
判据② 需要**建树 + 注入 + 重跑**（成本高一个量级）
⇒ **这是「成本驱动的不完整核验」**。

**同族**：
```
V7（控制线）：不能凭记忆报数（数字须真测）
教训二十二（我）：不能凭来源判定数字有效（数字须在当前版本复现）
```
**⇒ V7 管「数字从哪来」，本条管「数字是否仍有效」—— 两者构成数字可信性的完整检查。**

### ★ 我裁定：同意补「审查侧两判据」

**建议表述**（已发控制线）：
```markdown
★ V7 附2 审查侧：核验「引用他方数字」的注释须两项都做
| 判据 | 检查 | 区分力 |
|---|---|---|
| ① 可追溯 | 数字是否有来源？ | 弱（通过率结构性接近 100%） |
| ② 版本成立 | 数字在当前版本是否仍成立？ | 强（能发现「来源真实但数字过期」） |
```

**★ 为什么这个实例有说服力**：**连提出该纪律的评审线自己都只做了一半** ——
说明「只核可追溯」是**自然倾向**，**必须显式写成两项**才能对抗。

**署名意见**：**署「控制线 + 评审线」双方** ——
控制线提出**结构**（① 弱 / ② 强），我提供**量化漏检证据** + **强化论证**
（通过率接近 100% ⇒ 区分力接近 0）。若倾向单署，署控制线（提出者）。

### ★ ⑥ 的互补分析（我确认）

控制线的自我观察：
> 「我补了『dump() 全量』的守护（**语义前提**），但没补『注释红数的版本前提』（**数字前提**）
> ⇒ 同一类问题（前提无守护），我只防了一半」

**⇒ 我确认并提炼为更一般的模式**：
```
「注释/纪律依赖某个前提」的完整守护需要两层：
  ① 语义前提：被依赖的机制语义不变（如 dump() 保持全量）
  ② 数字前提：引用的数字在当前版本仍成立（如红数附基准）
R10 的修复只做了 ① ⇒ 缺口的一半
```

**★ 与 V9 ①-a 同族**：都是「**承诺 vs 覆盖**」的不匹配 ——
V9 ①-a 是「测试名承诺 > 断言覆盖」，
这里是「**注释承诺 > 守护覆盖**」（注释承诺数字有效，但无机制保证它持续有效）。

### 落盘

- R10 报告：`6150eeb9` + 闭环记录 `ab78f233`（已推 fork）
- 本轮追加裁定书：`.trellis/workspace/WindC0X/review/r10/r10-addendum-verdict.md`

---

## R10 后追加核验：b04cce4a + d3cce267（2026-10-05）

**触发**：控制线发来新锚点 + 两处自纠（自纠1 `--rerun-each` 证据来源错误、自纠2 污染源描述过期）。
无评审令，我做**轻量核验**（不建树，用基线树直接跑）。

### ① 自纠1 核验：**成立**，且我上一批已独立完成同一复现 ✓

**我的实测**（`agent-canvas-sync.test.ts`，即已知 flaky 所在文件）：
```
正常单跑 × 10（独立进程）:  0 红 / 10   → 复现率 0%
--rerun-each 3 × 10（同进程）: 1 红 / 10  → 复现率 10%
⇒ 无显著差异 ⇒ 该文件上的 fail 是【已知 flaky 本身】
⇒ 控制线原始「复现」确实不成立
```
**运行分段证据**：fail 出现在 `(run #3)` —— 与「3 倍机会命中 ~14% flaky」预期一致。

### ② ★ 我补充的机制级证据：`--rerun-each` 污染是**累积式**

| 文件 | 轮1 | 轮2 | 轮3 |
|---|---|---|---|
| `canvas-audio-playback.test.ts` | 5 pass / **0 fail** | 0 pass / **5 fail** | 0 pass / **5 fail** |
| `skills-api.test.ts` | 2 pass / **0 fail** | 1 pass / **1 fail** | 1 pass / **1 fail** |

**★ 为什么这比「有红」强**：
```
flaky    ⇒ 各轮独立随机（可能轮1红轮2绿）
污染     ⇒ 必然【轮1 干净 → 后续轮变脏】（单调恶化）
实测：两个文件都符合污染特征 ⇒ 与 flaky 机制可区分
```

**★ `skills-api` 失败原文暴露机制**（模块级缓存跨轮存活）：
```
轮1 写入缓存 { skills: [{ isAdded: true, skillId: "preset" }] }
轮2 断言 expect(listAddedSkills()).resolves.toEqual({ skills: [] })
收到     { skills: [{ isAdded: true, skillId: "preset" }] }  ← 轮1 残留
```

**建议**：分段分布可补进 V4 附2 作机制证据（当前只有「×5 / ×15」计数，
**计数无法区分污染与 flaky，分段才能**）。

### ③ 自纠2 核验：**成立** ✓（附口径建议）

```
@d3cce267: grep -rn "mock.module.*use-canvas-store" web/test/ → 空 ✓
user-data-sync-load-deadlock.test.ts:13-16 已是 spyOn + 改因注释 ✓
```

**★ 口径细节（P3）**：
```
文档 line 366 写「mock.module 仍是 5 个文件」
我实测：
  含 'mock.module(' 实际【调用】: 3 个（修复后）/ 4 个（修复前）
  含 'mock.module' 【字符串】:   5 个（含 2 个仅注释提及）
⇒ 「5 个文件」是【字符串口径】；读者可能误读为「实际调用仍 5 处」
```
**建议**：「`mock.module` 字符串出现在 5 个文件（其中**实际调用 3 个**，另 2 个仅注释提及）」。

### ④ ★★ 新发现（P2）：V4 附1 的**检出率算式写反了**

**文档 line 320-321 原文**：
```markdown
> 「跑 2 次全绿」对 ~14% 复现率的 flaky，检出率仅约 (1-0.14)² ≈ 74% ——
> 即约 1/4 概率漏检。
```

**数学核验**：
```
(1-p)²   = 0.7396  ⇒ P(2 次都全绿) = 【漏检率】
1-(1-p)² = 0.2604  ⇒ P(至少 1 次红) = 【检出率】

⇒ 74% 被标为【检出率】，实际是【漏检率】
⇒ 同句「约 1/4 概率漏检」与 74% 自相矛盾（1/4=25% ≠ 74%）
```

**正确表述**：「**检出率仅约 1-(1-0.14)² ≈ 26%** —— 即**约 3/4 概率漏检**」

**★ 影响不是笔误级 —— 低估所需跑数约 4 倍**：
| 跑数 | 正确检出率 | 按文档错误数字的直觉 |
|---|---|---|
| 2 | **26%** | 74% |
| 4 | **45%** | ~93%（错误外推） |
| 10 | **78%** | — |
| 16 | **91%** | — |

**⇒ 该纪律的核心用途正是「判断阴性结论的强度」** ——
算式写反会让审查者以为「跑 4 次足够」，**实际只有 45%（低于抛硬币）**。

**★ 与本轮主题呼应**：
```
V4 附1 的【纪律】是对的（「跑 N 次全绿」≠「无 flaky」）
但【支撑算式】有误 ⇒ 用错数字支撑对结论
⇒ §四·五 的【表述强度 > 证据强度】的又一形态
   （结论方向正确，但支撑它的证据不成立）
```

### ⑤ §四·五「自指」现象的三例发现路径（我补充的元观察）

| # | 纪律 | 违反者 | 发现路径 |
|---|---|---|---|
| 1 | V7 附2 行号附基准 | 控制线 | A线 反查「复现不出」→ 控制线两版本对照定位 |
| 2 | V4 附2 观察须对机制 | 控制线 | 控制线自核发现（A线 独立测试未复现但未指出错误） |
| 3 | V7 附2 审查侧 | 评审线 R10 | 评审线自报 → 控制线量化确认 |

**⇒ 三例的共同点：都靠【另一条线】发现**。
- 若 A线 不复现，实例1 不会被发现
- 若 A线 的 4 次全绿被当成「反例」而停止，实例2 不会被发现
- 若我不自报漏检，实例3 不会成文

**⇒ 结论**：**纪律的自指现象能暴露，依赖「多条独立线」** ——
单线（哪怕再仔细）会因「自己看不到自己的盲区」而让实例永远不被发现。
**这是「多线独立」价值的实证。**

### ⑥ ★ 教训二十三：核验「公式/算式」时，「结论方向正确」≠「算式正确」

> 我核 V4 附1 时，**第一反应**是「结论对（低频 flaky 需多跑）⇒ 通过」。
> 但**结论对**与**算式对**是两件事 ——
> 算式错会让读者**无法正确量化**（本例低估 4 倍）。
> **公式类证据必须重算一遍**，不能因结论方向合理就跳过。

**与教训二十二的关系**：
```
教训二十二：不能凭【来源】判定数字有效（须核版本）
教训二十三：不能凭【结论方向】判定算式有效（须重算）
⇒ 都是「用弱判据替代强判据」
```

**★ 我这次没漏检**（确实重算了），但**第一反应**正是「结论对 ⇒ 通过」——
记下这个反应，因为它揭示我的**默认倾向**。

### 落盘

- 回执：`.trellis/workspace/WindC0X/review/r10/r11-verdict.md`
- 本轮计数：**P2 × 1**（算式）+ **P3 × 1**（口径）
- **§四·五 审计清单实战首用**：我用「位置/工具/样本量」三项定位到算式问题

---

## F-09 三期交付独立复核（2026-10-06）

**对象**：`open-ai-canvas` @ `8f6b59ba`（29 文件 +1838/-8）
**隔离树**：`/home/windc0x/oac-ext4/_f09`（依赖 `cp -r` 物理隔离，lesson 16）
**基线**：`web/` 下 `bun test` → **3167 pass / 0 fail / 374 files**（连跑 5 次全绿，与控制线一致）

### §1 证伪重跑（8 处注入，我独立实测）

| # | 注入点 | A线 声称 | 我实测 |
|---|---|---|---|
| ① | `canvas-project-generation.ts` requestedConfig 不读 metadata | 4 red | **4 red ✓** |
| ② | `generation-task.ts` generationOptions → undefined | 3 red | **3 red ✓** |
| ③ | `clone-recreate-submission.ts` 数组顺序写反 | 1 red | **1 red ✓** |
| ④ | `productImageCount` → 0 | 1 red | **1 red ✓** |
| ⑤ | 提示词混入六段式正文 | 1 red | **1 red ✓** |
| ⑥ | `dual_image` 谓词恒 true | 1 red | **1 red ⚠️** |
| ⑦ | 工具栏 gating 去掉 | 2 red | **2 red ✓** |
| ⑧ | `entryPoints.target` → nonexistent | 1 red | **★ 0 red ✗ 不可复现** |

### §2 ★★ 两个阻塞发现

**B-1：`dual_image` 谓词仍然悬空**（报告 §3.2 声称「本批接上真实消费方」不成立）
```
grep -rn "capabilityContextSatisfied(" web/src/ | grep -v capability-entries.ts:269
→ 空 ⇒ 谓词在生产代码中零调用
```
工具栏用的是**自己的重复实现**（`selection-toolbar-tools.tsx:46`）：
```tsx
applicable: (ctx) => ctx.selectedImageCount === 2,   // ← 不调用谓词
```

**★ 判定实验（决定性）**：
| 注入对象 | 「真实入口消费路径」两测试 | 「谓词与入口判定一致」 |
|---|---|---|
| **谓词**（改成 `imageCount === 5`） | **全绿（未红）** | **1 red** |
| **工具栏 gating**（去掉） | **2 red** | 全绿 |

⇒ 标着「★ 真实入口消费路径」的测试，**实际验证的是工具栏自己的 `applicable`**，
与 `dual_image` 谓词无关。**谓词改动不影响任何真实入口行为。**

**⇒ 与 V9 ①-a 同族但更严重**：不是断言太窄，而是**断言对象错误**（镜像实现）。

**★ 任务书 §3.2 明确要求**：「该谓词目前悬空 —— **本批 ③ 为它接上消费方**」
⇒ 本批**未达成**该要求。

**B-2：`createCloneRecreateNode`（handler）零消费方**
```
grep -rn "createCloneRecreateNode" web/src/
→ use-canvas-media-tools.ts:1338（定义）+ :1963（导出）+ capability-entries.ts:239（字符串）
→ ★ 无 project.tsx 消费
```
**对照先例**：
| handler | project.tsx 消费 |
|---|---|
| `superResolveImageNode` | ✓ `:1024` 解构 + `:3717` `onSuperResolve` |
| `editAnnotatedImageNode` | ✓ `:1017` 解构 + `:3693` `onAnnotationEdit` |
| **`createCloneRecreateNode`** | **✗ 未解构、无调用** |

真实路径（`project.tsx:2487`）：Config 节点走 `CanvasConfigNodePanel.onGenerate` → **通用路径** `handleGenerateNode`。

**★ 但主流程功能未断**（实测确认，避免误判）：
```
buildGenerationConfig 从 node.metadata 读 productImageCount=1     ✓ 序列化后 = 1
buildGenerationConfig 从 node.metadata 读 clonePromptParams       ✓ 序列化后 = {...}
getGenerationResourceNodes 按连线顺序收集 [产品图, 版式参考图]     ✓
序列化后 input.referenceImages = ["p","l"] + productImageCount=1  ✓ 端到端
```
⇒ **`productImageCount` 与顺序契约在通用路径下仍生效**（落在 metadata 与连线上）。
**⇒ 真正失效的是 handler 独有部分**：`buildCloneRecreateSubmission`（提交构造）**生产不可达**
⇒ 其 6 个测试测的是**死代码路径**。

**★ 定性**：不是功能缺失，而是**死代码 + 两份实现**（模板路径与 handler 路径各实现一遍顺序保证，只一条被执行）。

### §3 非阻塞 4 项

**N-1：报告 §5 注入⑧ 红数不可复现**（称 1 red，实测 0 red）
根因：守卫测试**只校验 3 种 kind**（`registry-namespace-guard.test.ts:81`）：
```ts
if (point.kind === "node-toolbar" || point.kind === "selection-toolbar" || point.kind === "main-toolbar") {
```
而 `CapabilityEntryPoint.kind` 有 **6 种**：
```
node-toolbar ✓ / selection-toolbar ✓ / main-toolbar ✓
command-palette ✗ / create-card ✗（★ F-09 用的）/ canvas-route ✗   ← 静默跳过
```
**实测对照**：`create-card` + 假 target → **全量 3167/0（0 red）**；
`selection-toolbar` + 假 target → **1 red**。
⇒ **F-09 新登记的入口实际无守卫保护**，与「入口登记缺口已机器化收口」不符。

**N-2：数组顺序契约有绕过路径**（动态实证）
| 场景 | 上游图片 | productImageCount | 后端编号结果 |
|---|---|---|---|
| 基线 | `[产品图, 版式参考图]` | 1 | 图1=产品图 ✓ |
| **用户删掉产品图** | `[版式参考图]` | **仍为 1** | **图1=版式参考图 ✗ 静默错位** |
| 用户拖拽重排 | `[版式参考图, 产品图]` | **仍为 1** | **图1=版式参考图 ✗ 静默错位** |

根因：`productImageCount` 是**模板实例化时写死的常量**，不随用户操作更新；顺序由**连线数组顺序**决定。
两者**无同步机制**。⇒ 且**不报错**（后端无语义标签，只能按位置编号）。

**N-3：选区入口丢弃用户选中的图**
`project.tsx:3227` `onCreateCloneRecreate={() => instantiateTemplate("clone-recreate")}` ——
`instantiateTemplate(templateId)` 只接收 id，**不接收选中的图**
⇒ 用户选中 2 张图点按钮 → 出现**另外 2 张空占位图**，选中的图未使用。
任务书 §2.3 只规定**空状态卡入口**，未提及选区入口（A线 自行新增）。

**N-4：`copy.mode` 默认值 `auto-copy` 与调研裁决矛盾**
代码注释声称「对齐 ImgAk 默认表单：文字默认自动文案」，但：
- 一手语料 `inputs[7]`（copy.mode）**value = `no-copy`**
- 一手默认表单（`M01-meitu-clone.md:69`，bundle@1474942）**没有 copy.mode 字段**
- 三处调研裁决均为「**短期只做 no-copy**」（`F-09-IMPLEMENTATION-PLAN.md:468`、`SYNTH:580`、`X02:255`）

⇒ 注释的一手依据不成立 + 默认值与调研裁决矛盾 ⇒ 用户不选参数时会生成文字。

### §4 边界补充（A线 §7 漏报 4 项）

1. handler 未接线（B-2）
2. 谓词仍悬空（B-1）
3. 顺序契约可被用户操作破坏（N-2）
4. `create-card` kind 无守卫（N-1）

### §5 结论：**需修复后合并**

**★ 可信部分**：模板实例化（结构/容器/连线顺序）、`productImageCount` 的 metadata→请求体链路
（注入①②各 4/3 red）、后端六段式注入（控制线已核）、全量基线 3167/0 一致。

### ★ 教训二十四：「消费方」必须用「改一处是否影响另一处」判定

> 我最初读测试名（「★ 真实入口消费路径」）与报告 §3.2（「本批接上真实消费方」）时，
> 倾向相信「已接上」。**只有做了双向注入对照，才暴露「测试测的是镜像实现」。**
>
> ⇒ 同族于教训二十二（不凭来源判定数字有效）、二十三（不凭结论方向判定算式有效）：
> **本条：不凭声明判定接线有效。**

### 交付
- 报告：`docs/artifacts/f09-canvas-template-review.md`（`git add -f`，因 `.gitignore` 有 `docs/*`）
- commit：**`b66a86a5`**（单 commit，未 push）
- 已发送控制线，落地确认（控制线已在独立核验 B-1/B-2）

---

## F-09 修复批独立复核（2026-10-06）

**对象**：`f88feac7`（= 修复批 `40b9c915` + journal，代码面零差异）
**隔离树**：`_f09fix`（依赖物理隔离）
**基线**：3178 pass / 0 fail / 375 files（连跑 3 次，1 次命中已知 flaky）

### ★ 我自己的纪律违反（G4.1 自报）

13:10-13:12 我在 `/mnt/f/CODE/Project/open-ai-canvas`（**A线 的家域**）执行
`git worktree add` + `cp -r node_modules` ⇒ 持有 `.git` 锁 ⇒ 撞 A线 的 journal commit。
控制线用 `/proc` 环境变量定位到我的 handle（`term_0ff98021`）。

**根因**：我以为「worktree add 是只读元数据操作」—— 错在它仍短暂持有 index.lock。

**★ lesson 16 的同族**：
```
lesson 16（R5）：依赖共享（symlink node_modules）⇒ 假红
本条（F-09）：  家域共享（主仓做 git 写操作）⇒ 锁冲突
共同根因：共享资源的写入者互不可见
```

**纠正**：① 先 `ps aux | grep git` 查活跃操作 ② 优先从自己仓发起 worktree。

### §1 证伪重跑（3 项，独立实测）

| # | 注入 | 控制线声称 | 我实测 |
|---|---|---|---|
| B-1 | 谓词 `imageCount === 2` → `=== 5` | 2 red | **2 red ✓** |
| B-2 | `if (cloneParams)` → `if (false && cloneParams)` | 1 red | **1 red ✓** |
| N-1 | `create-card` target → 假值 | 1 red | **1 red ✓** |

**★ 我追加的注入**（检验 B-2 测试的性质）：
```
if (cloneParams && false) {              → 1 red（断言含 "if (cloneParams) {"）
分支内改走 handleGenerateNode           → 1 red（另一个文本断言）
handler 内部首行早退（文本全保留）      → ★ 10 pass / 0 fail
⇒ B-2 测试是【纯源码文本断言】，不能捕获语义失效
```

### §2 ★★ 阻塞级发现 B2-1

**B-2 的派发加在 Config 节点【永不渲染】的组件上 ⇒ handler 仍零消费方。**

**5 项独立验证全通过**：
```
① renderCanvasNodePanel 的 Config 分支返回 <CanvasConfigComposer />  ✓
② CanvasConfigComposer(111543) 在 CanvasNodePromptPanel(112408) 之前 ⇒ 前者是 Config 分支  ✓
③ 派发代码位于 PromptPanel 与 ConfigNodePanel 之间 ⇒ 属 PromptPanel 的 JSX 内  ✓
④ CanvasConfigNodePanel 区块【不含】cloneParams  ✓
⑤ 真实生成按钮：canvas-config-node-panel:297 → project.tsx:2499 → handleGenerateNode  ✓
```

**真实路径**：
```
爆款复刻节点（CanvasNodeType.Config）
  → 对话框：<CanvasConfigComposer />（无 onGenerate prop ⇒ 无法生成）
  → 节点卡片：<CanvasConfigNodePanel onGenerate={... handleGenerateNode ...} />（无 cloneParams 派发）
  ⇒ ★ handler createCloneRecreateNode 仍然零消费方
```

**★ 为什么测试全绿**：断言的是**源码文本存在**，不检查**渲染路径可达**。
```
B-1（上轮）：测试名声称「真实入口消费路径」，实际测工具栏重复实现
B2-1（本轮）：测试名声称「handler 有真实消费方」，实际测源码文本存在
⇒ 共同点：断言对象 ≠ 声称的验证对象
```

**建议修法**：把派发移到 `CanvasConfigNodePanel` 的 onGenerate（`:2499`）；
或抽纯函数（`resolveConfigGenerateAction(node)`）做**行为断言**。

### §3 非阻塞 N3-1

**N-3 的 sourceImageIds 可能含非图片节点**（探针实测）：
| 场景 | selectedNodeIds | selectedImageCount | 填入槽位 |
|---|---|---|---|
| 只选 2 图 | `[img-1, img-2]` | 2 ✓ | `[img-1, img-2]` ✓ |
| **先选文本再选 2 图** | `[text-1, img-1, img-2]` | 2 ✓ | **`[text-1, img-1]`** ✗ |

⇒ slot[0]（产品图槽位）= 文本内容（文本节点也有 `content` 字段），**不报错**。
**修法**：传参前过滤 `CanvasNodeType.Image`。

### §4 逐项结论

| 项 | 状态 |
|---|---|
| B-1 谓词接线 | ✅ 已修（行为断言，质量高） |
| **B-2 handler 接线** | ❌ **未修（位置错误）** |
| N-1 守卫覆盖 | ✅ 已修（超出建议，加防未来缺口断言） |
| N-2 顺序契约 | ⚠️ 未修（控制线裁定只登记，我复核**裁定合理**） |
| N-3 选区入口 | ⚠️ 部分修（残留 N3-1） |
| N-4 copyMode 默认 | ✅ 已修（`no-copy`） |
| 新-1/新-2 entryPoints | ✅ 已修 |
| 新-3 升格枝派发 | ✅ 登记未实现（合理） |
| □5-2 guided 态 | ✅ 已修（**只加不改**，零回归风险） |

### §5 控制线指定核实项

**□5-2 是否影响既有 guided 态**：**不影响** ✓
（`templateCards?` 可选 + `{templateCards?.length ? ... : null}`；分支顺序未变；独立区域不混入引导语义）

**派发是否影响 F-08/超分**：**零影响** ✓
（判据 `metadata.cloneRecreateParams` 全仓写入点只有 1 个 = 模板实例化）
**★ 但因 B2-1（派发不可达），这是「基于不可达代码的零影响」—— 修好后需重新核实。**

### §6 结论：**需修复后合并**

阻塞 1（B2-1）+ 非阻塞 1（N3-1）。已修好 6 项，登记 1 项，裁定未修 1 项。

**★ 修复质量对比（值得记录）**：
```
B-1（已修，高质量）：抽函数 cloneRecreateContextSatisfied + 双向注入对照（行为断言）
B-2（未修）：        内联代码 + 源码文本断言
⇒ 同一批修复，两种质量
```

### ★ 教训二十五：跨线共享资源不只「依赖」，还有「家域」

> lesson 16（R5）：依赖共享 ⇒ 假红
> 本条（F-09）：家域共享 ⇒ 锁冲突
> **共同根因：共享资源的写入者互不可见。**
> 纠正：跨线操作前 `ps aux | grep` 查活跃进程；优先从自己仓发起 worktree。

### 交付
- 报告：`docs/artifacts/f09-canvas-template-fix-review.md`
- 已发送控制线，落地确认

---

## F-09 修复批复核 · 回执与教训二十五登记（2026-10-06）

**控制线裁定**：B2-1 独立核实成立（5 步证据链）+ 已派 A线 修 + N3-1 列入同批 + G4.1 自报「不追责」。

### ★ reflog 补充事实：在我这里确实发生了

控制线提示：「`worktree remove` 会删除 reflog ⇒『reflog 无记录』不能证明『未建过』」

**我的自查时间线**（正好是它的实例）：
```
第 1 次：git worktree add --detach _f09fix 9b80133d    ← ★ 撞锁的那次（13:10-13:12）
        然后 git diff > patch → 0 行（发现 A线 已提交）
        然后 rm -rf _f09fix（删目录，git 记录残留）
第 2 次：git worktree add 40b9c915 → "already used by worktree" 失败
        然后 git worktree prune -v → 清理残留记录
第 3 次：git worktree add --detach _f09fix 40b9c915    ← 成功（现存 reflog 起点）
```
**现存 reflog 首行 = 40b9c915** ✓ —— 但这是 prune 后的结果，第 1 次的 reflog 已丢失。
⇒ 只看 reflog 会误判「只建过一次，起点 40b9c915」。

### ★ 教训二十五：跨线共享资源族（三形态）

控制线建议合并入 lesson 16 族。**我同意，并建议补第 3 形态**：

```
【族】共享资源的写入者互不可见

形态 1（依赖共享）：symlink node_modules ⇒ 读到他方半成品 ⇒ 假红/假绿（R5 lesson 16）
形态 2（家域共享）：在他方主仓做 git 写操作 ⇒ 与他方写操作互斥 ⇒ 锁冲突（本次 G4.1）
形态 3（证据共享）：worktree reflog 随 remove/prune 丢失
                    ⇒ 事后审计「证据已不存在」⇒ 误判「未发生过」（本次）
```

**★ 形态 3 的特殊性**：
```
形态 1/2：并发时的问题 ⇒ 当场出错（假红 / 锁冲突）
形态 3：  事后的问题   ⇒ 审计时出错（无法证明「未发生」）
```

**★ 形态 3 的纠正（我的实践）**：
建树前我执行了 `git diff > /tmp/f09fix-batch.patch`（虽得 0 行）——
这个动作**恰好留下独立于 git 的时间戳证据**，可与 reflog 对照。
⇒ **纪律**：「关键操作留独立于 git 的证据（时间戳日志），不依赖易失的 reflog」

### ★ 方法纪律：接线类修复的验证手段（lesson 二十四·测试侧）

控制线建议登记：「文本断言能捕获删除，不能捕获语义失效
⇒ 对『接线』类修复，验证手段必须是行为注入（改语义），不是文本注入（删文本）」

**我同意，建议作为 lesson 二十四的测试侧补充**：
```
| 注入类型 | 做法 | 能捕获 | 不能捕获 |
|---|---|---|---|
| 文本注入 | 删除/改写源码文本 | 删除调用 | 调用存在但语义失效 |
| 行为注入 | 改语义（改判据/返回值/加早退） | 删除 + 语义失效 | — |

实测依据（F-09 修复批复核）：
  文本注入 if (false && cloneParams)  ⇒ 1 red（子串不匹配）
  文本注入 分支内改走 handleGenerateNode ⇒ 1 red（另一文本断言）
  ★ 行为注入 handler 首行早退（文本全保留）⇒ 10 pass（无捕获能力）
```

**★ 我补充的观察**：
```
B-2 的「行为注入」需要能触达 handler 的真实调用点
⇒ 但派发不可达（B2-1）⇒ 无法构造真实路径上的行为注入
⇒ ★ 「派发不可达」不只是功能缺陷，还使【行为验证本身不可能】
   （只能退回文本断言）—— 这构成 B2-1 的额外论据
```

### 三项确认

| # | 项 | 我的回答 |
|---|---|---|
| 1 | 收到裁定 | ✅ |
| 2 | 教训二十五登记 | ✅ 同意合并入 lesson 16 族 + 建议补第 3 形态 |
| 3 | B2-1 修后二次复核 | ✅ 需要，只针对 B2-1 + N3-1 |

**二次复核计划**：
```
① B2-1：行为注入（打在【Config 节点可达路径】= CanvasConfigNodePanel 的 onGenerate 上）
   · 若 A线 抽了纯函数 ⇒ 直接单元测试
   · 若仍内联 ⇒ 注入「Config 分支不派发」⇒ 应有行为测试红
② N3-1：探针实测（只选图 / 文本+图 / 纯文本 三场景）
③ 基线：F-09 相关文件 + 全量一次（确认无回归）
```

### 交付
- 报告：`docs/artifacts/f09-canvas-template-fix-review.md`（`a92a7204`，已推 fork）
- 回执：`.trellis/workspace/WindC0X/review/f09/g41-receipt.md`
- 隔离树 `_f09fix` @ `f88feac7` 保留（供二次复核）

---

## 回执②：V10-e 补强 + 教训二十六（2026-10-06）

### ① 报告路径（答复控制线）

```
第一轮（B-1/B-2 原始发现）：docs/artifacts/f09-canvas-template-review.md（b66a86a5，367 行）
第二轮（B2-1/N3-1）：      docs/artifacts/f09-canvas-template-fix-review.md（a92a7204，313 行）
```

### ② multi-line-discipline.md 写权：**我没有，建议保持现状**

```
· 该文件在主仓（A线 家域），全部由控制线提交
· 我的纪律登记在自己的 journal-1.md（教训 1-26）
· 建议：单一真值源（该文件已 103KB，多线共写会冲突）+ 分工清晰（我的 journal 是原始记录，纪律文档是提炼）
```

### ③ ★ V10-e 已落盘（13:20，早于我的回执 13:27）+ 我的实证补强

**时间线澄清**（非归属冲突）：
```
13:20  de3d086d  V10-e 落盘（标「A线 实验发现」）
13:27  78069079  我的回执（提「形态 3」）
⇒ 控制线独立发现（A线 用 /tmp 隔离仓库实验），我的回执是回应 + 族视角
```

**★ 我的回执正是 V10-e 要求的「操作方输出确认」**：
```
V10-e 原文：「⇒ 最可能是『先建的树被 remove 后重建』，但未经操作方输出确认前应标为待确认」
我的回执：完整时间线（3 次建树）⇒ 确认推断成立
```

**★ 我的独立实验：`rm -rf + prune` 也删 reflog（V10-e 的路径补强）**

V10-e 实验路径是 `worktree remove`；我的实际路径是 `rm -rf` + `prune`。

**在 /tmp 隔离仓库复现**：
```
① git worktree add --detach tree1 <C1>   ⇒ reflog 建立
② rm -rf tree1                            ⇒ .git/worktrees/tree1 【仍在】（gitdir 失效）
   git worktree prune -v                  ⇒ Removing worktrees/tree1（目录整体删除）
③ git worktree add --detach tree1 <C2>   ⇒ reflog 首行 = C2，无 C1 痕迹
```

**⇒ V10-e 的结论【比原文更强】**：不限于 remove，`rm -rf + prune` 亦同。
**建议补句**：「任何使 worktree 管理目录消失的路径都会丢 reflog。」

### ④ 教训二十五（族视图）：建议与 V10-e 不重复

**关系**：
```
V10-e（已落盘）：具体机制（remove/prune 删 reflog）+ 替代证据（管理目录 mtime）
形态 3（我提的）：族视角（lesson 16 族第 3 形态）+ 通用纠正（留独立时间戳证据）
⇒ V10-f 应写「族视图」，引用 V10-e 作实例 —— 不重复其内容
```

**建议的 V10-f 表述**（已发控制线）：
```markdown
## V10-f — 共享资源的写入者互不可见（族视图）
| 形态 | 场景 | 后果 | 纠正 |
|---|---|---|---|
| 依赖共享 | symlink node_modules | 假红/假绿 | 物理隔离 |
| 家域共享 | 他方主仓 git 写操作 | 锁冲突 | 查 ps + 从自己仓发起 |
| 证据共享 | reflog 随 remove/prune 丢失（见 V10-e） | 审计误判「未发生过」 | 留独立于 git 的证据 |
★ 形态 3 特殊性：前两形态是【并发时】问题，形态 3 是【事后】问题
```

### ⑤ 二次复核范围：**确认扩大**（测试线 的新证据）

**测试线 的发现**（518fbad）：
```
f09-fix-batch.test.ts 10 条中 8 条是源码文本断言
4 条注入：
  A：删派发调用（文本变化）        ⇒ 1 red ✓
  B：handler 首行早退              ⇒ 10 pass（我已发现）
  C：选区入口填槽 if(false&&)      ⇒ ★ 10 pass（新）
  D：guided 态渲染 {false&&}       ⇒ ★ 10 pass（新）
⇒ ★ 文本断言问题覆盖【3 项修复】（N-3 / □5-2 / B-2）
```

**★ 这补上了我上一轮的盲区**：
```
我只做了 B-2 的「保留文本、语义失效」注入
⇒ 没对 N-3 / □5-2 做同类注入
⇒ 测试线 的 C/D 揭示：同一测试策略问题的【更广覆盖】
```

### ★ 教训二十六：发现一类缺陷后，须扫描同类修复项

> 实例：F-09 修复批
> · 我发现 B-2 的测试是文本断言（注入「handler 早退」⇒ 10 pass）
> · 但我【只测了 B-2】，没测 N-3 / □5-2
> · 测试线 用同法测 C/D ⇒ 发现它们【同病】（也是 10 pass）
>
> ⇒ **教训**：一类问题的发现，必须配【同类项的扫描】
>   否则只是「局部修复认知」，不是「模式识别」。
>
> **同族**：教训二十三（不凭结论方向判定算式有效）、二十四（不凭声明判定接线有效）
>   —— 本条是它们的【覆盖面】补充：识别出模式后，须扫描模式的全部实例。

### ⑥ 二次复核计划（更新）

```
① B2-1：行为注入（打在 Config 可达路径）
   · resolveConfigGenerateAction 返回值改错 ⇒ 测试必须红
   · 静态确认 :2513 走 dispatchConfigGenerate
② N3-1：探针实测（三场景表）
③ ★ N-3 / □5-2 的行为断言：用测试线 的注入 C/D 手法复验
④ 基线：受影响文件 + 全量一次
```

**★ 预判 A线 的修复方向正确**（判据单源 + 两个 onGenerate 共用 + Config 真实入口已接）。
**二次复核重点**：
```
· resolveConfigGenerateAction 是否【纯函数】（无副作用、可独立测试）
· dispatchConfigGenerate 是否【真的被两个入口共用】（防「只改一个」）
· 新测试是否【行为断言】而非【文本断言】（用 C/D 手法反验）
```

---

## 回执③ + ★ 自纠：B-1「行为断言」判断有误（2026-10-06）

### ★★ 我的报告错误（测试线 先发现，我独立复现）

**我在 `a92a7204` 报告 §1 写**：
> B-1 | 注入谓词 → `imageCount === 5` | **2 red ✓** | 19 pass ✓
> §4：B-1 谓词接线 ✅ 已修 | 注入谓词 → 真实入口测试 **2 red**（修复前同注入全绿）

**⇒ 部分错误**：
```
我跑的是【两个文件一起】：
  bun test test/f09-fix-batch.test.ts test/f09-clone-recreate-entry.test.ts ⇒ 2 fail
⇒ 误归因为「新测试的行为断言有效」
⇒ ★ 实际：2 fail 全来自 f09-clone-recreate-entry.test.ts（旧文件）
   而新文件 f09-fix-batch.test.ts 的「★ 行为：谓词与入口同源」是【恒真断言】
```

### 我的独立复现（三种注入，按文件分离）

| 注入 | f09-fix-batch.test.ts（新） | f09-clone-recreate-entry.test.ts（旧） |
|---|---|---|
| 谓词 → `imageCount === 5` | **10 pass / 0 fail** | **2 fail** |
| 谓词 → `Math.random() > 0.5` | **10 pass / 0 fail** | （未跑） |

**⇒ 恒真确证**：谓词改成**随机值**仍 10 pass。

### 形式化证明

```
测试（fix-batch:63-71）：
  predicate = capabilityContextSatisfied(entry, { imageCount: count, hasSelection: true })
  rendered  = resolveToolbarEntries(...).some(id === "selection-clone-recreate")
  expect(rendered).toBe(predicate)

生产（selection-toolbar-tools.tsx:15-20）：
  applicable → cloneRecreateContextSatisfied(n)
            → capabilityContextSatisfied(entry, { imageCount: n, hasSelection: true })

推导：
  rendered = applicable(ctx) 的结果
           = cloneRecreateContextSatisfied(count)
           = capabilityContextSatisfied(entry, { imageCount: count, hasSelection: true })
           = predicate                                ← 同一函数、同一入参
⇒ expect(rendered).toBe(predicate) ≡ expect(X).toBe(X) 【恒真】
```

### ★ 重要区分：B-1 修复仍有效，但守护来自【旧测试】

```
f09-clone-recreate-entry.test.ts:38-42（旧，R9 前就有）
  expect(ids).toContain("selection-clone-recreate")
⇒ 谓词改 5 ⇒ 不渲染 ⇒ 红 ✓  ← 【真实守护】

f09-fix-batch.test.ts:63-71（新，A线 修复批新增）
  expect(rendered).toBe(predicate)  ← ★ 恒真
⇒ 谓词改任何值 ⇒ 仍绿 ✗  ← 【无守护能力】

⇒ 结论：B-1 功能修复有效；但新增测试【无守护能力】且【重复覆盖】（旧测试质量更高）
```

### ★ 教训二十七：归因前必须分离证据来源

```
实例（我）：
  · 跑 `bun test <新测试> <旧测试>` ⇒ 2 fail
  · 归因为「新测试的行为断言有效」
  · 实际：2 fail 全来自旧测试；新测试是恒真断言（10 pass）

⇒ 教训：**多源证据的红数，必须按来源分离后才能归因**

【判定方法】
  · 单文件跑（不是多文件合并跑）
  · 或：注入后逐文件统计

【同族】
  · V10-a：归因前核实【执行者身份】（进程 ID / context ID）
  · lesson 18（R6）：对齐两条注入序列时，按【对象+形式】而非【序号】
  · 本条：归因红数时，按【文件来源】分离
  ⇒ 共同点：归因对象必须是可独立核实的单元
```

### ★ 自纠的方法论意义

**我在同一轮报告里犯了两个同族错误**：
```
① 发现的问题：测试名声称 X，实际测 Y（断言对象 ≠ 声称对象）—— 我发现了它
② 我自己犯的：两文件合跑，归因给其中一个（证据来源 ≠ 归因对象）—— 我犯了它
⇒ ★ 同族：都是「归因对象与实际不符」
⇒ 这说明：发现某类问题 ≠ 对该类问题免疫
```

### 写权纠正（接受控制线纠正）

**我原判断**：「multi-line-discipline.md 在主仓（A线 家域），我没有写权」
**控制线纠正**：「它是项目文档，不是 A线 私有域 ⇒ 三线都可提交；git 提交本身串行化」

**★ 我接受，并承认两处偏差**：
```
偏差 1：把「物理位置」当成「写入权限」
  ⇒ 主仓是 A线 的【工作目录】（家域），但不是【文档的私有域】
偏差 2：夸大了「多线共写」的风险
  ⇒ git 冲突处理是正常协作机制；该文件是 append-only ⇒ 冲突概率极低
```

**★ 我的根因**（小教训）：
```
我在 G4.1 事件后变得【过度谨慎】——
因为「在主仓做 git 写操作」刚撞过车，所以把「写主仓文件」也归入「危险操作」
⇒ 但两者性质完全不同：
   · worktree add：修改 .git 管理状态（影响所有 worktree）
   · 提交 docs/ 文件：修改工作树文件（正常协作）
⇒ ★ 过度谨慎与鲁莽是同一错误的两个方向：都是【未区分操作的实际影响面】
```

### 教训二十六归属修正（同意控制线）

```
原表述（我）：我发现 B-2 文本断言模式，测试线 扫描 N-3/□5-2
修正后（控制线 建议，我同意）：
  · 评审线 在 B-2 上发现文本断言模式
  · 测试线 用同法扫描 N-3/□5-2 ⇒ 确认同病
  ⇒ 实例是【两者合起来】构成，不归给单方
```

**★ 配套纪律**（控制线 补）：「同注入双跑对照法」——
**我补充其价值**：实质是【把注入当作探针，扫过所有同类测试】
⇒ 把「发现模式」和「扫描模式」合并为一个动作 ⇒ 比「先发现再扫描」更高效。

### 二次复核范围（最终版，含新增 ④）

```
① B2-1：行为注入（打在 Config 可达路径）
② N3-1：探针实测（三场景表）
③ N-3 / □5-2 行为断言（用测试线 的 C/D 手法反验）
④ ★ B-1 的「行为同源」测试是否改为真行为断言（或已删除）
⑤ 基线：受影响文件 + 全量一次
```

**★ 我补充的判据**：
```
恒真（当前）：expect(rendered).toBe(predicate)          ← 同函数同入参
真行为断言 A：expect(rendered).toBe(true/false)          ← 与实现解耦（硬编码期望）
真行为断言 B：spyOn(capabilityContextSatisfied) + toHaveBeenCalled()
              ⇒ ★ B 才是「接线」的真正证明（A 只证明结果对，B 证明路径通）
```

### 隔离树状态

`_f09fix` @ `f88feac7` **pristine**（关键 4 文件与 HEAD 无差异；仅 `node_modules` 符号链接）。

---

## 回执④：零残留实证 + git checkout 盲区（2026-10-06）

### ① 隔离树零残留（5 层深度检查）

控制线借用 `_f09fix` 做过注入（已 git checkout 还原）。我做了 5 层检查：

| 检查项 | 结果 |
|---|---|
| `git status --short` | ✓ 空（仅 node_modules 符号链接） |
| 6 个关键文件与 `f88feac7` 逐一无差异 | ✓ |
| **`--untracked-files=all`** | ✓ **零** |
| **`zz-*.test.ts` 探针残留** | ✓ **零** |
| **`.orig` / `.bak` 残留** | ✓ **零** |

**★ `f09-fix-batch.test.ts:68` 仍是 `expect(rendered).toBe(predicate)`** ⇒ 原版确认 ✓

### ② ★ 我发现一个共性盲区：`git checkout` 不清 untracked

```
控制线的还原步骤：④ 同步 A线 修复 → ⑤ git checkout 还原

★ 若 A线 的修复含【新增文件】，git checkout 不会删除它 ——
  因为 git checkout -- <path> 只还原【tracked 文件的内容】，不处理 untracked。
```

**★ 建议的完整还原步骤**：
```
① git status --short --untracked-files=all  ← 看全部（含 untracked）
② git checkout -- .                           ← 还原 tracked 内容
③ 手动 rm untracked 残留（或 git clean -n 先预览）
④ git status --short --untracked-files=all   ← 复确认

【更精确的验证法（我用的）】
  for f in <关键文件列表>; do
    [ -z "$(git diff --stat HEAD -- $f)" ] && echo "✓ $f" || echo "★ $f 有差异"
  done
  ⇒ 逐文件核验比 git status 更精确（git status 可能被 .gitignore 隐藏）
```

**⇒ 建议登记为纪律**：「隔离树还原的完整步骤（git checkout 不够）」

### ③ 教训二十七的族精化（我建议）

控制线指出我的教训二十七与测试线 的教训同族：
```
我（评审线）：合并跑两个文件 ⇒ 2 red ⇒ 归因给新文件   ← 未分离证据来源
测试线：      只跑 entry 测试 ⇒ 2 red ⇒ 断言「唯一真行为断言」← 未穷尽同类样本
⇒ 共同点：用【部分证据】支撑【整体结论】
```

**★ 我精化为**：
```
【族】结论强度 > 证据强度（三种表现形式）
  ① 证据来源未分离（评审线）：多源红数合并归因 ⇒ 归因到错的源
  ② 证据范围未穷尽（测试线）：部分样本 ⇒ 推广到全体
  ③ 证据时效未核对（V7 附2）：历史数字 ⇒ 当成当前有效
⇒ 共同结构：**从有限证据推出无限结论**
```

**★ 我上轮的错误正好是①的具体形态**：
```
我把「2 red」当成「新测试的行为断言有效」的证据
⇒ 但 2 red 来自【旧文件】⇒ 证据来源与归因对象不符
⇒ 与 V7 附2「数字真实但版本过期」结构相同：证据真实，但【绑定的对象】错了
```

### ④ 报告修正方式（确认）

```
① 在原报告末尾追加「§9 自纠附录」（不改原文，保留可追溯性）
② 附录 = 自纠全文（含形式化证明 + 教训二十七）
③ commit 信息标注「追加自纠附录」
⇒ 与「追加式修改必须回头改旧表述」纪律一致
★ 执行时机：二次复核完成后一并提交
```

### ⑤ 隔离树借用规则（我建议）

```
· 读操作（跑测试/读代码）⇒ 自由，无需询问
· 写操作（注入/改文件）⇒ 需满足三条：
  ① 借用前告知（或事后立即告知）
  ② 每次注入后立即还原
  ③ 归还前用【深度检查】（含 untracked）确认零残留
· 优先自建：若需长期/多次写入，自建一棵树
⇒ 理由：形态 2（家域共享）的纠正 —— 但「共享」不等于「不可用」，
   而是【需要显式的占用协议】
```

**★ 控制线的借用处理已足够**（每次还原 + 主动告知 + 我事后核实零残留）。

---

## 预演结论：A线 WIP 方向正确 + ★ 意外收获（2026-10-06）

**快照 md5**：`1dd9ec2d 6127ab2b e265bfa9 ce5d7fa3 bc41ed8f d00474e3`

### ① 结论：修复方向正确 ✓

**新架构**（实测确认）：
```
project.tsx
  dispatchConfigGenerate(nodeId, mode, prompt)      ← 唯一入口
    → dispatchConfigGenerateAction(node, mode, prompt, { onCloneRecreate, onGenericGenerate })
      → resolveConfigGenerateAction(node)           ← 纯函数判据
```

**6 项验证**：
| # | 项 | 结果 |
|---|---|---|
| ① | `dispatchConfigGenerate` 调用点 | **2 个** ✓（`CanvasNodePromptPanel` + **`CanvasConfigNodePanel`**） |
| ② | `resolveConfigGenerateAction` 行为测试 | ✓（4 种入参） |
| ③ | `dispatchConfigGenerateAction` spy 断言 | ✓ |
| ④ | `resolveTemplateImageSlots` 过滤测试 | ✓ |
| ⑤ | `:2537` 在 `CanvasConfigNodePanel` 块内 | ✓（位置解析确认） |
| ⑥ | 接线测试的位置断言 | ✓（见 ② 意外收获） |

**⇒ B2-1 根因已修**（派发从不可达的 `CanvasNodePromptPanel` 移到 Config 真实入口）。

### ② ★★ 意外收获：撞上 A线 的注入间隙，恰好验证了新测试有效

**时间线**：
```
13:44:31  主仓组件 = templateCards.map + <button>          ← 正确实现
13:45:20  我导出 v1 ⇒ [].map（卡片列表恒空）                ← A线 注入 A
13:45:40  主仓组件 = templateCards.map + <span role="none"> ← A线 注入 B
13:46:18  我导出 v2 ⇒ <span role="none">                    ← 仍是注入态
```

**在注入 B 状态下跑测试**：
```
(fail) ★ 行为：每张卡渲染为【可点击 button】（不是纯文本）
⇒ A线 的新渲染测试【确实能捕获「元素类型变化」】✓
```

**对比旧文本断言**：
```
旧：expect(source).toContain("或现成模板开始")
  ⇒ 注入 B 时文本仍在 ⇒ 【不红】✗
新：renderToStaticMarkup + 匹配 <button>
  ⇒ 注入 B 时无 <button> ⇒ 【红】✓
⇒ 这正是「行为断言 vs 文本断言」的实证对照（A线 用注入自证了新测试价值）
```

### ③ 观察（非缺陷）：A线 的注入验证会短暂污染共享工作区

```
现象：A线 连续做 2 次注入（A: [].map；B: <span role="none">），每次恢复
     但我两次抓取【都落在注入间隙】
⇒ 影响：其他线导出快照会抓到注入态
```

**★ 建议**：
```
① 注入验证最好在【独立树】做（不污染共享工作区）
② 若必须在主仓 ⇒ 每次注入后【立即】恢复（A线 做到了，只是撞上间隙）
③ 其他线导出快照前先核对 md5（我这次的做法 ✓）
```

### ★ 教训二十八：跨线并行时，「工作区快照」是【移动目标】

> 我在预演中两次导出 patch，**两次都落在 A线 的注入间隙** ——
> 第一次抓到 `[].map`（注入 A），第二次抓到 `<span role="none">`（注入 B）。
>
> **教训**：
> · 工作区（未提交）是**共享可变状态**，其内容随他线操作实时变化
> · 「导出快照」≠「固定版本」—— 必须**核对 md5** 才能确认抓到的是哪个状态
> · ★ 若要**稳定**的复核对象 ⇒ **必须等 commit**（工作区快照只能做预演）
>
> **同族**：教训二十七（归因前分离证据来源）——
> 本条补充：**快照前核实版本（md5）**，否则「我测的是哪一版」不可知。
>
> **★ 正面价值**：这次「撞上注入间隙」反而**意外验证了 A线 的新测试有效**
> （在注入 B 状态下跑 ⇒ 1 fail）——
> ⇒ 说明「意外」有时提供**自然实验**（不需要自己构造注入）

### 隔离树状态

`_f09fix` @ `f88feac7` **pristine**（5 层检查：untracked 空 / 6 文件无差异 / 0 探针 / 0 备份 / HEAD 正确）

---

## V10-g 确认 + 两点精化（2026-10-06）

### ① 确认收到

| 项 | 回答 |
|---|---|
| 收到 V10-g | ✅ |
| 预演结论标注 md5 | ✅ 已标注（`1dd9ec2d 6127ab2b e265bfa9 ce5d7fa3 bc41ed8f d00474e3`） |
| 正式复核基于 commit | ✅ 待 A线 STOP |

### ② ★ 精化一：我的「md5 对照」是【被动发现】，非【主动预防】

**实际过程**：
```
① 导出 patch（未先检查 A线 是否活动）
② 应用后跑测试 ⇒ 2 fail
③ 觉得异常 ⇒ 回主仓核对 md5 ⇒ 发现主仓已变
④ 重新导出 v2 ⇒ 仍是注入态
⑤ 再核对 ⇒ 定位「A线 在做连续注入」
```

**⇒ 这是事后发现，不是事前预防**：
```
若我不觉得「2 fail 异常」⇒ 会把注入态当真实状态 ⇒ 结论错误
⇒ ★ md5 对照只是【救了我一次】，不是【可靠方法】
```

**★ 建议的主动预防（V10-g 执行细则）**：
```bash
# 导出快照前，先做活动检测
find web/src web/test -newermt "-2 minutes" -name "*.ts*" | head
# 有输出 ⇒ 对方在活动 ⇒ 停止导出，等 STOP
# 无输出 ⇒ 相对静止 ⇒ 可导出，但仍需 md5 对照
```

### ③ ★ 精化二：V10-g 的灰色地带（界定建议）

**问题**：什么算「他人活动工作区」？

```
情形 A：A线 主仓（正在改）        ⇒ ✗ 不可读
情形 B：A线 主仓（STOP 但未提交）  ⇒ △ 可读，但必须 md5 对照
情形 C：A线 的已提交 commit        ⇒ ✓ 可读（最稳）
情形 D：我的隔离树 + 他方 WIP      ⇒ ✓ 可读，但结论只能作预演
```

**★ 我的界定建议（按「内容是否会变」而非「谁的工作区」）**：
```
【核心判据】内容是否可能在他处被改变
  · 若可能 ⇒ 必须锁版本（md5 / commit）
  · 若不可能（已提交 commit）⇒ 自由读

⇒ 我的预演 = 情形 D ⇒ 内容在我树里固定，但结论有效性取决于
   「A线 是否还会改同一份代码」⇒ 标注 md5 + 声明「不作最终裁定」= 正确处理 ✓
```

### ④ A线 注入记录表 —— 建议补两个字段

```
| 时间 | 文件 | 注入形式 | 恢复确认 | ★ 恢复方式 | ★ 是否已验证被捕获 |
```
- **恢复方式**（`git checkout` / 手工改回 / 重新 apply）
  ⇒ 区分「彻底恢复」与「可能遗漏」（如 `git checkout` 不清 untracked）
- **是否已验证被捕获**（注入后测试是否红）
  ⇒ 其他线能知道「该注入有效」（我撞上的两次注入 B 确实红了 ✓）

### ⑤ ★ 一个观察：V10-g 的判据测不出「读活动」

```
A线 终端显示「Working」但【近 5 分钟无文件改动】
⇒ 它在跑测试（读操作，不写文件）
⇒ ★ find -newermt 测的是【写活动】，测不出【读活动】
⇒ 补充判据：ps aux | grep bun（进程检测）或直接问对方
```
