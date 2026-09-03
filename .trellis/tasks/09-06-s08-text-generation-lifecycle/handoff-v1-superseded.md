# S08 Handoff（2026-09-10，由 pi 主会话代崩溃会话撰写）

> 写入纪律：本文件全部内容已对照 git/journal 实况核验（baton 铁律）。
> 用途：崩溃会话（193MB / 63 次 compaction / 最终摘要 314k tok）不可作为续接基线，
> 新会话以本文件 + journal + git 为准，不 resume 旧会话。

## 1. 当前目标（≤5 行）

- **主任务**：S08 文本生成生命周期 flora 语法对齐（`.trellis/tasks/09-06-s08-text-generation-lifecycle/`，status=in_progress）。
- **当前焦点**：S08 模型菜单两问题——① L2 flyout 选行后 DOM 残留；② L1/L2 行 UI 不一致。五轮修复（aa34fd7→925d338）用户仍未确认修好。
- 完成定义见 `prd.md`；最新完成项 **S08 #17 composer 底部布局已提交**（86f00c9 + e9c4429/ece6b1f 登记批次）。

## 2. 已核验状态（[V]=已验证, [?]=未验证）

- [V] HEAD = `86f00c9`（S08 #17 composer 底部布局），工作树干净（staged/unstaged 均无；未跟踪仅 DESIGN.md/PRODUCT.md/agent 配置目录）。
- [V] 五轮修复全记录存档于 `.trellis/workspace/WindC0X/journal-1.md` 的 2026-09-09 节——含逐轮失败机制表、系统性模式（病灶在状态机上游、修复全打下游、四层关闭机制叠存、CDP 探针失真）、架构级修复方向 A/B/C。
- [V] 独立代码审查（workflow canvas-s08-block-review-v2，46 条存活发现全数 CONFIRMED/PLAUSIBLE）完成，全量结果：
  `/home/windc0x/.pi/workflows/projects/pi-547bddf24405/runs/canvas-s08-block-review-v2-mts53wb7-l45imb.json`
  （P0 三条见 §5；审查基线 aa34fd7，开发会话后续五轮提交已独立修复其中部分发现）。

## 3. 决策与理由（含被拒备选）

- 拒绝：继续在被压死的旧会话里续接——63 次 compaction，最终摘要 1.25M chars（≈314k tok，99% 是 1703 条 Reflections 记忆层），已进入"压完即到压缩边缘"死亡螺旋。
- 拒绝：修复方向继续打下游（动画/类/卸载端）——journal 已论证病灶在状态机上游（flyout 归类错误 + 时序巧合）。
- 待决策：修复方向 A（根治：flyout 并入 L1 Popover / 两级全自研，改动大、9 消费方回归）vs B（最小止血：hidden 语义改 visibility + flyoutRef 白名单 + 400ms 窗收窄）vs C（只治 CSS 唯一源）——**尚未拍板，这是新会话的第一个决策点**。

## 4. 已试失败与禁重试清单（最高价值段，永不删除）

| 已试 | 失败原因 | 禁止 |
|---|---|---|
| aa34fd7: mousedown 只选 + 400ms 挡关闭 | 把关闭延迟到 click，制造 detach 窗口 | 勿再"延迟关闭到 click" |
| 40d4854: mousedown 即选即关 + 双向 400ms | 修掉自造窗口但 400ms 窗成新特例；上游归类错误未动 | 勿再加双向时间窗 |
| b12616d: 字号显式化/去双色带 | "双色带"是上轮自引入；未查同名选择器 | 改样式前先 grep 同名选择器全集 |
| b449f84: 0s hack + DOM 加类 + destroyOnHidden | 加的类被 rc-motion 重算抹掉；motionDeadline 断言为错 | 勿依赖 rc-motion 后追加类存活 |
| 925d338: props 注入 hidden 类 | 引出卸载链死锁；玻璃未真同源 | 勿用 hidden 类路线解卸载死锁 |
| 全程: CDP 合成事件 + DOM 探针验证 | 探针失真已在 b449f84 轮自记，在失真证据上宣布闭环是"修好了→没修好"循环主因 | **结论必须真机浏览器验证，勿用 CDP 合成事件下结论** |

## 5. 已知陷阱（独立审查补充，全部 [V] 源码级核验）

- `canvas-image-settings-popover.tsx:66` wheel 关闭只 `setOpen(false)` 漏 `onOpenChange` → `nodeImageSettingsOpen` 泄漏 → 全画布工具栏失效（唯一运行时高危，未见对应修复提交）。
- flyout body portal 不在 menuRef/triggerRef 白名单内，window 捕获层 pointerdown 直接杀——与 §4 第 6 行同根。
- 浅色主题"黑上黑"：主面板 `!important` 硬编码暗玻璃无浅色覆盖（flyout 有、主面板漏）。
- `max-height: min(420px, 384px)` 恒 384px，视口守卫死亡；`--workspace-foreground` 未定义 12 处 IACVT。
- 尺寸过渡契约测试恒真空转（断言 grep 旧实现字符串，bun test 全绿）。

## 6. 有序下一步（新会话从这里开始）

1. 读 `.trellis/workspace/WindC0X/journal-1.md` 2026-09-09 节（五轮失败根因分析，只存档未动代码）。
2. 拍板修复方向 A/B/C（§3）——建议先跑 journal 末尾的 5 项真机验证清单缩小问题面。
3. 按方向实施；涉及 model-picker/globals.css 时对照 §5 陷阱与审查 JSON。
4. 真机验证 + 更新 pending-test.mdx + 收尾（commit + 本文件状态更新）。

## 7. 开放问题

- 方向 A/B/C 未拍板（§3）。
- 独立审查 P0 三条的修复归属：并入方向 A/B，还是独立先行（C1 是独立文件的一行修复，可先行）。
- 旧会话（193MB）处置：不 resume；如需考古用 /tree 跳早期节点或 recall 检索。

---
*Handoff by: 主会话 pi（glm-5.3-flash）2026-09-10；核验手段：git log/status 实测 + journal 直读 + workflow JSON。*
