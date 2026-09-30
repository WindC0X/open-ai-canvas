# merge-v1.6.1 recon — rider 2（e0a2697c..eb13f736）

> 控制线侦察档，2026-09-30。用户已拍板：v1.6.1 W4 初执行、先于 F-01 开枝。
> 上游自 09-30 fetch 后无新增（origin/main 仍 eb13f736，本文写作时复核）。

## 一、范围

12 commits / 227 files。主体 = `7f5d87ef` 平台架构拆分（后端领域模块 + 画布前端组件）；
其余 11 笔 = v1.5.9/v1.5.9.1 两笔发布 + Agent 思考误判修复 + 媒体恢复 + IndexTTS2 情感参数
+ 角色卡三视图 ×2 + 分镜拆镜契约 ×2 + Web 检查格式化。

## 二、拆分结构（落位目标）

7f5d87ef 产出 7 个直接相关新文件：

| 新文件 | 抽自 | 体量 |
|---|---|---|
| `canvas-cloud-agent-panel-parts.tsx` | panel.tsx（−1033）| +685 |
| `canvas-cloud-agent-events.ts` | panel/chat-ui | +348 |
| `canvas-cloud-agent-composer.tsx` | panel/chat-ui（chat-ui −607）| +539 |
| `canvas-cloud-agent-attachments.ts` | chat-ui | +21 |
| `canvas-node-media-content.tsx` | node-content.tsx（−825）| — |
| `canvas-node-status-content.tsx` | node-content.tsx | — |
| `services/user-data-sync-media.ts` | user-data-sync.ts | +123 |

另：`canvas-script-node-parts.tsx`（script-node −122）、`model-capabilities-workflow.ts`
（model-capabilities −501，workflow 字段族）、后端领域模块族（`cloud_agent_runtime.go` −2389，
struct 定义保留原文件 :118）。

**card06 域整文件迁移**：`web/src/pages/canvas/user-data-sync.ts` → `web/src/services/user-data-sync.ts`
（旧路径在 origin/main 已不存在）。

## 三、fork 增量逐域落位表（merge 执行的操作面）

| 域 | fork 增量（批树位置） | 上游新家 | 落位策略 |
|---|---|---|---|
| F1 panel | panelLayout ×9：:109 类型 / :114 签名 / :119-122 pointerHandlers / :183 架构注释（组件根）；**:1016 style spread / :1034 onResizeKeyDown / :1116 onResetLayout（渲染段）**；prefillPromptId ×4 | 渲染段随 −1033 抽入 panel-parts；组件根仍在 panel.tsx | 根部 5 处原位；渲染段 3 处落 parts；G3 的 canvasNodes/runningNodeId 双保不变 |
| F2 chat-ui | AgentUndoBar（chat-ui:1022 定义 / panel:75 import / panel:1159 渲染点）| chat-ui 仍在；渲染段去处 = parts | 定义原位；渲染点落位后核 |
| F4 project | agentPanelLayout lift + 双挂载去重成果 | project.tsx 仍在（83 行变化）| 原位落位 |
| F5 node-content | loop 属性行（:618，preload 之后）| → `canvas-node-media-content.tsx` | 迁移 + 守卫断言路径同步 |
| G2 runtime | StepFullSnapshotHash（:172-175 注释+字段 / :1149 赋值）| struct 仍在 runtime.go:118 | 原位插回，双口径语义不变 |
| E4 咽喉 | outpaintTier（model-capabilities.ts :67 / :214-217 / :223）| modelCapabilityConfigFor 仍在 :408；迁走的只有 workflow 族 | 原位落位，无上游交叉 |
| card06 | 水位门访问器 openLocalProject/watermarkProjects + G5 校准分支 | **services/user-data-sync.ts 新家** + media 键族在 user-data-sync-media.ts | 路径重定位 + 访问器/校准分支落新家；水位门逻辑本体未被 rider 触碰（media.ts 抽的是键收集/上传函数）|
| F3 CSS | canvas-cloud-agent.css fork 增量 | **rider 2 零触碰**（范围 diff 无此文件）| 零冲突直接保留 |

## 四、11 笔 rider 逐笔定级

| commit | 主题 | fork 交集（实证） | 处置 |
|---|---|---|---|
| eb13f736 | Agent 思考误判（pi_model + runtime.mjs + truncated_args_test）| 无 | 取上游 |
| 4c0aa682 | 媒体恢复音频多结果 | 无 | 取上游 |
| b0806745 | IndexTTS2 情感参数 | 无（config-store/generation-task 域零 fork 增量）| 取上游 |
| d01e60d8 + 6bbc2849 | 角色卡三视图 | **零交集**：E1/E2 域 = grid-split-picker.css + use-canvas-render-model.ts + 2 test；角色卡动 character-reference / resource-references | 取上游 |
| e2a05390 + 45e51b1d | 分镜拆镜输出契约 | script-node 无 fork 登记增量（M1 域）；拆镜契约亦上游侧 | 取上游；M1 结论不受影响 |
| fda3b842 | Web 检查格式化 + 源码断言修正 | 触 3 个 web/test（create-library-button / director-template-mode-wiring / zz-frame-check −11），均非 fork 守卫 | 取上游；守卫回归风险见 §五 |
| 123c7cd2 + 74e7ebed | v1.5.9 / v1.5.9.1 发布 | CHANGELOG/版本记录 | keep-both（G9 惯例）|
| b2184a6e | 部署 updater 兼容 | 无 | 取上游 |

## 五、守卫测试面（隐蔽成本，任务书必含）

12+ fork 守卫测试引用被拆/迁文件：agent-panel-overlay-zorder / agent-send-prefill-command /
agent-canvas-refresh / agent-interjection / agent-model-picker / agent-starter-command /
agent-tool-retry / canvas-media-node-initial-size / canvas-media-performance /
canvas-model-policy / agnes-video / asset-batch-delete。
凡断言锚在被抽走代码段的，需同步迁移断言路径/锚文本。**门禁清单新增一项：守卫全量跑 + 断言锚点迁移表**。

## 六、门禁与测试线计划

- 门禁：v1.6.0 全套（tsc / eslint / build / web bun 全量 / go 全量 / e2e 五跑门 / 聚焦守卫）**+ 守卫锚点迁移项**
- 测试线：S1 迁移冒烟 + S2 五跑 + VRT 三面（Agent 面板 = 拆分敏感面，必采）
- 顺序（已拍板）：W4 初 merge → 全绿 → F-01 从干净底座开枝

## 七、估算

| 项 | 量 |
|---|---|
| merge 落位 | 序2 规模 hunk 映射，0.5-1 人日（7 域落位 + 守卫锚点迁移）|
| gates 机器时间 | ~2-3 小时串行（build 1m06s 实测 / go internal-app 24min 实测 / web 全量 / e2e）|
| 测试线整轮 | ~3 小时（序6 实测 12:37→15:25 含补跑）|
| 全批 wall-clock | **1.5-2 天**（对照 v1.6.0 三天 1143 文件）|

---

## 八、recon 更新：范围扩至 d328a257（2026-09-30 · 控制线，响应 A线 STOP 报告）

### 越界增量核验（控制线独立复核）

- `d328a257`（2026-09-30 18:28）= **纯格式化**：AudioSettingKey 14 键联合拆行（键集零变化）、emotion `<input>` 属性逐行展开（属性零变化）、emotionFields 数组换行（元素零变化）。39 行改动目检 + git show 全文复核 ✓
- 文件面：仅 `web/src/components/audio-settings-panel.tsx`，该文件已在 b0806745（rider 2 内）触面 → **`e0a2697c..d328a257` 仍为 227 文件**（实测）✓
- A线锚点分析验证：fork 侧 AudioSettingKey = 4 键（:11，audioVoice/audioFormat/audioSpeed/audioInstructions）vs 上游 14 键（+10 emotion 键）✓；emotion 族 fork 侧零存在 ✓。小勘误：fork 侧该文件改造笔数实测 11 笔（A线报 12，口径差异疑含 merge 计数，不影响结论）
- **未解释项 #1 消除**：`theme.node.muted` 在 fork 树 321 处现行使用（含 audio-settings-panel.tsx:76 自身）——存在性确证，上游 `SettingGroup color={theme.node.muted}` 融合无障碍

### 裁决：选项 a（并入，范围 = e0a2697c..d328a257，13 commits / 227 files）

理由：d328a257 是 rider 2 内 b0806745 的格式化尾随（同功能域补刀）；留到下批 = 同一冲突点（AudioSettingKey 行）下批再吃一次且批距更长；A线 已给融合方案（fork SettingGroup 增强版 extra 可选 prop 兼容上游调用）。

### 批内纪律增补（防无限 STOP 循环）

**merge-base 锚定 = d328a257（开工时点 origin/main）**。批内上游若再进新提交：不追、不再 STOP（除非触本批落位域的语义冲突），滚动增量留下批——否则上游连续推送日（今日 18:28 还在动）会让批永远开不了工。

### 落位表增补（§三 追加一行）

| 域 | fork 增量 | 上游面 | 落位策略 |
|---|---|---|---|
| 音频设置面板 | fork SettingGroup 私有组件（extra?: ReactNode 增强 + theme.node.groupTitle 配色，11 笔改造）| b0806745 IndexTTS2 情感段（14 键 + emotionFields + 情感权重 input）+ d328a257 格式化 | AudioSettingKey 取上游 14 键（fork 4 键为子集）；情感段用上游结构、SettingGroup 用 fork 增强版（extra 可选兼容）；theme.node.muted 已证存在 |

---

## 九、控制线独立验收（2026-09-30 22:40 · merge-v1.6.1 @ 5e14fbc5）

### 复核结果（全部独立执行，非转述）

| # | 项 | 结果 |
|---|---|---|
| 1 | 拓扑链 5e14fbc5←735f917d←d5082565←905d7c9b / 干净 | ✓ |
| 2 | d328a257 为 HEAD 祖先 | ✓ |
| 3 | H1 系：opProperties x/y（number + min/max 0-1）在场 | ✓ |
| 4 | card06：水位门访问器 25 处 + saveRemoteUserDataBatch ×2 落 services 新家 | ✓ |
| 5 | G2：StepFullSnapshotHash 字段 runtime.go:164-167 + 赋值点 cloud_agent_runtime_scheduler.go:323 | ✓ |
| 6 | E4 三处：outpaintTier（web 7 处 / defaults.go:74 播种 / validate.go:43-44 白名单）| ✓ |
| 7 | SSRF：upstream_address_blocked 分支 errors.go:38 | ✓ |
| 8 | 音频融合：audioEmotion 22 处（14 键型）+ SettingGroup extra 增强版（:57/:175）| ✓ |
| 9 | 4 处静默丢失修复 = 735f917d（4 文件 +49/−2，含 5 项定向复跑记录）| ✓ |
| 10 | 锚点迁移 3 处实核（composer ×3 / panel-parts ×2 引用在场）| ✓ |
| 11 | fork 守卫三文件存活（上游侧无此三文件，merge 保全）| ✓ |
| 12 | bun test 独立复跑：**2444 pass / 0 fail / 318 files / 59.62s**（与报告逐字吻合；2438→2444 = +6 来自 rider 2 上游测试修改）| ✓ |

### 裁定

**① 验收通过。** 门禁全绿 + 语义面 12/12。

**② e2e 口径裁定（未解释项 1）**：A线 解释正确——S1-S7 为测试线 Playwright 场景编号，任务书 §三.4 措辞混入了测试线门名（控制线拟书笔误，入账）。开发线口径 = Go e2e 族（Pi runtime 5 条，隔离全 PASS）+ 聚焦守卫；S1-S7 五跑门属测试线轮次（ext4 twin，同 序6 惯例）。串行第 4 条超时 = drvfs 特性（v1.6.0 批树同位失败先例），隔离通过即收，测试线 ext4 复证。

**③ A线 重大贡献记档**：4 处拆分增量静默丢失的发现与「逐注释/逐 case/逐中文文案全树比对」方法学——这是 H1 教训（schema 与描述两个事实面）的泛化：**拆分类 refactor 中「函数名在场 ≠ 增量在场」**。此方法学进后续所有 merge 任务书模板。

**④ 后续序列**：用户真机抽验（Agent 面板拆分面，需将 :3010 栈切至 v161 worktree）→ push → 测试线整轮（S1 迁移冒烟 + S2 五跑 + VRT 三面，Agent 面板必采）→ F-01 开枝。
