# S08 Handoff v2（2026-09-10 定稿，取代 v1）

> v1 写于崩溃会话刚结束时，只知道 journal 存档（五轮失败链），**不知道会话其后又提交了六~九轮（含 A 路线根治）与十~十六轮**。v2 以 git HEAD 实况 + 原始条目核验全面改写。
> 证据标注：[V] = 本定稿在 HEAD（86f00c9）实测核验；[?] = 有记录但未独立复核。
> 背景与完整证据链见同目录 `session-autopsy.md`。崩溃会话（193MB/63 次压缩/摘要 99.5% 为反射堆叠）**不可 resume**——其摘要含幻觉文件、悬垂哈希（e39965f/ebd6927/6e4c665）与五天前的状态标记。

## 1. 当前目标

- S08 文本生成生命周期 flora 对齐（`.trellis/tasks/09-06-s08-text-generation-lifecycle/`）。工作清单四项：#15 模型列表 / #16 三个设置面板重排 / #17 composer 底部布局 / #18 浏览器逐面实测验收。
- **[V] #16 完成**（5e001c4+e9c4429，09-10 01:28，份数迁出独立气泡）。**[V] #17 完成**（86f00c9+ece6b1f，09-10 02:02，composer 左组=模型pill+分隔线+摘要+图标触发器，右组=份数+生成）。**[V] #18 进行中**：面 1-6 已实测通过（09-10 03:16-05:34），验收未收尾、无 commit。

## 2. 已核验状态（HEAD = 86f00c9）

- [V] main HEAD = 86f00c9（S08 #17），09-10 02:02:53；跟踪文件零改动，仅 24 个未跟踪路径（.trellis/.agents/.codex/.pi/DESIGN.md/PRODUCT.md，代理配置产物）。
- [V] 模型菜单修复史：一~四轮失败链（aa34fd7 09-08 09:36 → 925d338 09-09 00:06）→ 85004c8 根因存档（09-09 05:44，journal-1.md）→ **六轮 A 路线根治 edf1410（09-09 07:08：flyout 根级 portal、关闭器白名单含 flyoutRef、MenuBody 内联、玻璃 blur16 单源）** → 七/八/九轮（d0e4393/21fdede/763cd28）→ 十~十三轮滚动条（6a3ca9c/1a4aa48/88d8166/60918a5）。用户 09-09 21:22 确认"OK了"。
- [V] 独立深度审查（9-agent workflow）结论存档于 `.trellis/workspace/WindC0X/journal-1.md` 2026-09-09 节；五轮失败机制与系统性模式（病灶在上游、修复打下游、CDP 探针失真）逐条可查。
- [?] #18 面 1-6 实测通过只存在于被压缩打断的会话尾段（未入任何摘要，来源=原始条目 L10594-10667）；第 7 面起的验收与 L2 缺陷根因定位均未完成。

## 3. 决策与被拒备选

- [V] 已决：模型菜单修复走 **A 路线根治**（flyout 独立根级 portal + 单一关闭协议白名单），edf1410 落地；B（hidden→visibility 止血）/C（仅 CSS 唯一源）未单独执行，但 C 的死类死规则清理已并入 edf1410。
- 被拒：继续打下游（动画/类/卸载端）——五轮实践证明病灶在状态机上游（journal 论证）。
- 被拒：resume 崩溃会话或信任其压缩摘要（autopsy §3）。
- [V] 勘误纪律：journal 旧登记"Popover 有 motionDeadline:1000 兜底"经 antd 6.5.1 源码逐行核实为错——**凡引 antd 内部行为先查 node_modules 源码，不引记忆**。

## 4. 已试失败与禁重试清单（ground truth，永不删除）

| 已试（哈希均在 main） | 失败原因 | 禁止 |
|---|---|---|
| aa34fd7 一轮：mousedown 只选+400ms 挡关闭 | 关闭延迟到 click，自造 detach 窗口 | 勿再"延迟关闭到 click" |
| 40d4854 二轮：mousedown 即选即关+双向 400ms | 修掉自造窗口但 400ms 窗成新特例；上游归类未动 | 勿再加双向时间窗 |
| b12616d 三轮：字号显式化/去双色带 | "双色带"是上轮自引入；未 grep 同名选择器 | 改样式前先 grep 同名选择器全集 |
| b449f84 三轮修订：0s hack+DOM 加类+destroyOnHidden | 加的类被 rc-motion 重算抹掉（当轮自认）；motionDeadline 断言为错 | 勿依赖 rc-motion 后追加类存活 |
| 925d338 四轮：props 注入 hidden 类（display:none） | display:none 阻断 animationend→无 deadline 兜底→leave 永挂→卸载链死锁 | 勿用 display:none 类做隐藏保险丝 |
| 全程：CDP 合成事件+DOM 探针下结论 | 探针失真（b449f84 轮自记）；"修好了→用户说没修好"循环主因 | **结论必须真机浏览器验证** |

## 5. 已知陷阱（审查 P0 并入，逐条按 HEAD 复核——v1 半数已过时）

- **[V] 仍在·高危**：四个设置气泡（canvas-image/text→text 封装、audio、video、count-settings-popover）的 wheel 关闭 handler 只 `setOpen(false)` 漏 `onOpenChange?.(false)` → project.tsx 的 `nodeImageSettingsOpen` 等状态泄漏（:280/:1117/:2580 以它 gate 工具栏）→ 画布工具栏失效。v1 只记 image 一处，实为四个同型。仓库内现成正确写法：`closeOnOutsidePointer`（同文件）就是 setOpen+onOpenChange 双调。
- **[V] 仍在**：浅色主题"黑上黑"——globals.css :7285 `.canvas-model-picker-popover…surface` 硬编码 `rgba(32,32,32,.9) !important` 无 `:root:not(.dark)` 覆盖（flyout 有 :7720、滚动条有 :7562，主面板独缺）。
- **[V] 仍在**：契约测试按源文本断言——web/test/canvas-node-size-transition.test.tsx 全部断言为 `nodeSource.includes(旧实现字符串) === false`，是 grep 式源码契约而非行为测试；重构源码措辞即可翻绿/翻红，与运行时无关。
- **[V] 仍在**：model-picker.tsx:273 `setPickerOpen` 的 400ms 双向时间窗仍在（A 路线未摘除）；正常流无害，但窗内合法 onOpenChange 会被吞，排障时勿忽略。
- **[V] 已修（勿再报）**：flyout portal 误杀——edf1410 已把 flyoutRef 纳入 pointerdown/wheel 白名单（model-picker.tsx:240/245/249 附近）。v1 将其列为现行陷阱，过时。
- **[V] 已修（勿再报）**："恒 384px 视口守卫"——:7485 残留 `min(420px,384px)` 已随 1a4aa48 删除（:7489 现为注释，唯一高度源 :7301 的 560）。v1 过时。
- **[V] 已修（勿再报）**：`--workspace-foreground` 未定义 12 处 IACVT——已在 :633/:668 定义（注释自记 09-09 实测根因）。
- [V] 已知外观残余：L1/L2 材质分叉（L1 blur16 无 saturate vs L2 blur18+saturate1.2、亮色 .94 vs .92、default 变体从未 eyeball）——A 路线后未逐一回归，验收时须覆盖。

## 6. 有序下一步

1. 读 `journal-1.md` 2026-09-09 节 + 本文件 §4/§5，建立禁重试边界。
2. 完成 #18：真机逐面验收第 7 面起 + 回归 L1/L2 材质分叉与亮色/default 变体（§5 末条）。
3. 定位 **L2 行点击缺陷**（onChange 不触发）：09-10 04:40 与 05:30 两次受控坐实、04:55 一次假阴性（复现非确定）；探针显示 handler 根本没跑；已排除 compatibleModelInGroup 守卫。**未定位，勿凭推测改码。**
4. 排查份数 pill gating 矛盾：prompt-panel:425 gate `mode==="image" && maxOutputs>1` 应隐藏"2 张"pill 而实际渲染——嫌疑渠道 capabilityConfig 覆盖路径。
5. 修 §5 前三条现行陷阱（wheel 双调是四文件同型小修，可先行）。
6. 收尾：pending-test.mdx 登记 + commit + 更新本文件；然后处置 origin/main 落后 39 commit 的 rebase 欠账（含 65f4339 v1.2.8.rc1），需用户拍板。

## 7. 开放问题

- L2 行点击缺陷根因（下一步 3）——为什么复现非确定？时序翻转假设（后台 tab/慢设备）未证。
- 份数气泡与设置气泡同开重叠（同 z=1100、无互斥，模型菜单有 sibling-close 而设置气泡没有）——是否补互斥，待用户定。
- origin/main 39 commit 欠账的 rebase 时机（#18 收尾前/后）。
- 193MB 崩溃会话本体处置：不 resume；考古用 /tmp/autopsy/ 切片语料。
- 反射记忆层（om.reflections）回灌是本次崩溃根因——后续长会话是否关闭该层/加体积上限，属 pi 配置决策，待用户定。

---
*定稿：pi finalize（2026-09-10）。核验手段：git log/show/cat-file/merge-base 实测 + 源码直读（陷阱逐条）+ 原始 JSONL 审查结论引用。v1 已存为 handoff-v1-superseded.md。*
