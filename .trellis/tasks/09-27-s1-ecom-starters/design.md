# S1 设计：starter 卡点击 → 命令通道 → 立即执行

## 1. 机制（裁决2-a 落实）

扩展 `project.tsx` 的 prefill 命令通道为三态命令：

```ts
// project.tsx（现 {id, prompt} → 扩展）
const [agentPrefill, setAgentPrefill] = useState<{ id: number; prompt: string; submit?: boolean }>({ id: 0, prompt: "" });

// 新增 starter 入口（与 sendSelectionToAgent 同构，仅 submit:true）：
const runAgentStarter = useCallback((prompt: string) => {
    agentPrefillIdRef.current += 1;
    setAgentPrefill({ id: agentPrefillIdRef.current, prompt, submit: true });
    openAgent();
}, [openAgent]);
```

面板侧（`canvas-cloud-agent-panel.tsx`）：
- props 增 `onStarterPrompt?: (prompt: string) => void`（由 `project.tsx` 注入 `runAgentStarter`）；`CanvasCloudAgentPanel → AgentConversation → AgentWelcome` 透传。
- prefill effect（:277-283）扩展：命令送达后 `setPrompt(value); setView("chat")`；若 `submit === true` → 调 `resolveStarterRunDecision({ value, busy, running })`：
  - `"submit"` → `void submitRef.current(value)`（**复用现有 submit() 发送路径**，不另造）。
  - `"busy-toast"` → `message` 提示「正在创作中，请稍候」（沿用面板/画布现有全局提示通道；输入框保留文案）。
  - `"ignore"` → 空值直接返回。
- `submit` 定义在 effect 之后：用 `submitRef`（`useRef` + 每次 render 更新）桥接，避免闭包/时序问题。
- `sendSelectionToAgent` 命令不带 `submit` → 行为与现状完全一致（仅填充）。

## 2. 纯函数（可测）

新文件 `web/src/lib/canvas/canvas-ecom-starters.ts`：

```ts
export type EcomStarterCard = { id: string; title: string; subtitle: string; prompt: string; icon: "image" | "detail" | "batch" | "scene" };
export const ECOM_STARTER_CARDS: EcomStarterCard[] = [ ...4 张草案... ];
export function resolveStarterRunDecision(input: { value: string; busy: boolean; running: boolean }):
    "submit" | "busy-toast" | "ignore";
```

- 卡片数据（标题/副标题/prompt）集中于此，文案以 prd §卡面草案定稿为准（控制线 2026-09-27：副标题统一「约消耗 1 张图档 / 纯文本 · 小额」相对档位；无价格数字）。
- `resolveStarterRunDecision`：空值→`ignore`；`busy || running`→`busy-toast`；否则→`submit`。

## 3. 卡面 UI（`canvas-agent-welcome.tsx`）

- 现有三卡保留；新增分组（可选小标题「电商快捷开始」）渲染 `ECOM_STARTER_CARDS`；按钮结构复用 `.agent-welcome-actions` 样式族（图标 + strong + small + arrow），图标用 lucide（`Image` / `LayoutPanelTop` / `ListChecks` / `Mountain` 等待定）。
- 点击 `onClick={() => onRunStarter(card.prompt)}`；「免费体验」标注：运行时判定（若默认模型渠道免费/低价比 -> 副标题替换），判定链路可用时接入，否则记录降级。
- 样式：只加组件级 Tailwind/现有 `.agent-welcome` 类；**不碰 `globals.css`**。新增类名（如 `.agent-welcome-actions-label`）追加到 `canvas-cloud-agent.css`（组件级 CSS，可接受）。

## 4. 数据流

```
点击卡 → runAgentStarter(prompt)                    [project.tsx]
  → agentPrefillIdRef++（新命令 id）
  → setAgentPrefill({id, prompt, submit:true})
  → openAgent()
  → 面板 effect（按 id 去重）送达：
      setPrompt(value) + setView("chat")
      submit===true → resolveStarterRunDecision
          → submit(value)  [现有发送路径；running→interject 既有语义]
          → busy/running → toast「正在创作中，请稍候」
```

## 5. 取舍与风险

- **为何走通道而非面板本地 submit**：裁决 2a 明令"不另造发送路径"+"自增 id 语义"；通道化后重复点击天然是新命令，且未来其他入口（hero 等）可复用同一命令面。代价：一次 props 上行（panel→project→panel），队形绕但语义单一。
- 风险1：effect 里调 submit 的时序（submit 后定义）→ `submitRef` 桥接。
- 风险2：快速连点与 `submissionRequestRef` 内部守卫交互——`submit` 自身已有幂等守卫，决策层只负责忙态 toast，不新增队列。
- 风险3：`busy` 状态在点击瞬间可能尚未置位（React 批处理）→ 决策函数以调用时刻状态为准；文档注明"连点=两次命令，第二次按当时守卫结果处理"，不承诺排队。

## 6. 兼容与回滚

- 兼容：`submit` 字段可选；`sendSelectionToAgent` 零改动；现有三卡零改动。
- 回滚：单 commit 整体 revert（新增文件 + 两处扩展）。

## 8. 真机走查记录（v1 · 2026-09-27；已按退回裁决重构，设计见 §9）

- 环境：vite :3010（代理 → 后端 :8483，数据目录用 floracheck 副本）＋ Orca 内嵌浏览器。
- 卡面：4 张电商卡文案逐字正确（含「电商快捷开始」分组标题）；既有三卡与场景胶囊无回归。
- 点击链路：「白底产品图」→ 提示词入框 → 立即起跑 → Agent 读画布 64 节点并回复；「3:4 详情图」跑通且真实产出 3:4 图像节点。
- 忙态守卫：运行中二次点击 → toast「正在创作中，请稍候」（非静默）。
- 免费标注：本环境文本模型均 0.001 档（无免费通道）→ 卡面正确地不显示；命中路径由单测覆盖。
- 加固：同 tick 二次命令会被 submit 内部 submissionRequestRef 静默挡下 → 决策函数增 `pending` 分支（→ busy-toast），「禁止静默吞」全覆盖。
- 备注：被拒文案受首跑成功路径常规清空影响（与手动发送一致）；同卡场景无信息损失。

## 7. 测试与验证

- `web/test/canvas-ecom-starters.test.ts`：卡数据完整性（≥3 张、字段齐、无价格数字字面值正则断言）+ `resolveStarterRunDecision` 全分支。
- `web/test/agent-starter-command.test.ts`（静态护栏，沿用 `agent-send-prefill-command.test.ts` 风格）：project.tsx 含 `submit: true` 命令语义；panel 含 toast 文案与 `resolveStarterRunDecision` 消费。
- 门禁四件 + 真机走查（见 prd AC6/AC7）。

## 9. 重构设计（控制线 2026-09-27 退回裁决，替代原「点了就跑」直发语义）

- 卡片语义 =「意图卡」：点击仍走 3b3fe456 自增 id 命令通道（保留件），但发送内容改为「意图 + 澄清指令」复合 prompt：要求 Agent 先不生成、单条消息选择题式确认（①实拍图 @/上传 · ②无图直出（等权）· ③参考图混合）+ 默认规格确认；用户任意回复即视为齐备（含「没有图，商品是XX，直接生成」），先复述方案再生成，不再追问、不强制附图。
- 布局三级（按 Agent 浮窗高度，复用 panelLayout 既有状态）：`resolveAgentWelcomeTier(panelHeight)`（`agent-panel-layout.ts`，标准 1000 / 全量 1160）→ `.agent-welcome--compact|standard|expanded`；compact=单行欢迎语+四卡紧凑行（CSS 变体）+「更多开始方式」折叠；standard=四卡带副标题+通用三卡；expanded=全量。技能组合推荐胶囊由面板按同一 tier/展开态渲染。
- 组件接线：AgentWelcome 新增 tier/moreOpen/onMoreOpenChange；AgentConversation 透传；面板持有 welcomeMoreOpen（新建对话复位）+ tier 计算；capsules 渲染条件 = expanded 或 moreOpen。
- 保留件（原样）：自增 id 通道、busy/running/同 tick 守卫 + toast、相对成本档、免费体验运行时判定。
- 验收口径见 prd「重构裁定」段；真机证据见 `.local/s1-walkthrough-v2/`（01–11 + evidence-notes.md）。

## 10. S1.1 渲染层 polish（控制线 2026-09-27）

- P0 chip：`findEcomStarterCardByPrompt`（canvas-ecom-starters.ts，纯内容匹配）→ AgentChatMessage 用户消息命中卡片原文时改渲染 `AgentStarterChip`（chat-ui 私有组件；图标表 ECOM_STARTER_ICONS 迁至 lib 共用）；展开原文走本地 state；样式组件级 CSS（canvas-cloud-agent.css）。数据层/导出/历史零改动。
- P1：welcome standard 分支补回 footnote；副标题与球体 compact 隐藏、standard/expanded 显示（核查确认球体未丢）。
- P2：AgentConversation 自动贴底加「有消息」守卫（layout effect + RO 回调，ref 带最新值）——welcome 展示中锚点不动。
- 验证：`.local/s1-walkthrough-v3/`（12–16 + evidence-notes.md）。

## 11. v3.2 结构重排与静默挂载（控制线终版任务书，2026-09-27）

- 布局：`AgentSceneCards`（新组件，面板级，胶囊条下方）+ `drilledScene` 状态（AgentSceneCapsules 增可选 `onActiveChange` 上报，条内交互上游原样）；welcome 增 `drilledScene` prop（真值时隐藏通用三卡与辅助行）；无折叠钮（welcomeMoreOpen 全面移除，胶囊条所有 tier 常显；旧电商组/折叠类清删）。
- 静默挂载：`applyScenePreset`/`applySingleSkill` 的 `setMessages` 系统消息 → `message.info` toast（Skills 计数照常；错误路径 `message.error`，避免异常路径重新卸载 welcome；归属上游 → PATCH-MAP B1）。
- a11y：面板 effect 按 drilledScene 迁移焦点（卡区首卡 / 无卡退 back / 返回归位场景胶囊）。
- CSS：compact（18px 单行、单行卡、footnote 常显）、卡区 `min-height:148px` 锁定 + 入场淡入（cross-fade）、reduced-motion 关断。
- 验证：`.local/s1-walkthrough-v4/`（01–13 + evidence-notes.md）。

## 12. v4 基线不减（控制线终版，2026-09-27）

- `canvas-agent-welcome.tsx` = 基线原文（`git show 5a567238` 还原；零 fork 痕迹）；面板侧移除 welcomeTier/AgentWelcomeTier/resolveAgentWelcomeTier 与 P2 贴底守卫（折叠钮时代产物），滚动段回归基线原文；welcome 调用签名回归基线。
- 保留：AgentSceneCards（面板级、胶囊条下方）、drilledScene 联动、静默挂载 toast、焦点迁移、chip、四段澄清文案、busy 守卫。
- CSS：删除全部 `.agent-welcome--*` 变体规则；保留 chip + 卡区样式（对基线仅新增）。
- 对照验证法：同 commit 独立只读实例（:3012）作基线参照 + fresh origin（:3013）测我方，方法见 v5 evidence-notes。
