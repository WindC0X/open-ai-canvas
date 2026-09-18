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
