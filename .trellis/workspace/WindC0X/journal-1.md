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
