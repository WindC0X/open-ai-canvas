# 合并签字单：A线 v1.5.1→origin/main（批次八 · 2026-09-22）

> **用途**：用户逐卡签署。**规则**：①卡片结论只呈现不改写（原文见 `docs/merge-ruling-cards/*.md`，本单仅压缩引用）；
> ②「增减修正点」= 批次七增量侦察（`150f9cf2..6f452405`，49 提交）实测 delta，**与卡原结论分开列**；③两者冲突时**标差异不调和**，由用户裁。
> **数据来源**：`docs/merge-lock-v1.5.7.md`（锁版）、`docs/upstream-sync-recon-v1.5.1-v1.5.6.md`（批次〇，80 提交）、
> `docs/upstream-sync-recon-increment-150f9cf2-f6f452405.md`（批次七增量，含三方模拟 241 hunk 明细）。

## A 区：原九卡（原结论照录）

| 卡号 | 结论方向（卡原建议） | 增减修正点（批次七 delta） | 签署建议 |
| --- | --- | --- | --- |
| **01** canvas_state hash 口径 | **三口径分工**：模型可见=我方 contentHash（剔 position）；账本/undo=fullHash（双方一致，不动）；mediaHash=采纳上游字段集（剔 position/width/height/时间戳）。备选 B1 全盘上游（不推荐）/B2 全盘我方/B3 模型可见也剔尺寸（过度） | **无**——增量 49 提交未触碰 `cloud_agent_canvas_state.go`（三方模拟 0 hunk） | 可快签 |
| **02** step_hash 接力 | **融合=上游链式证明+我方截断修复**：①relay 段取上游（含 repo 层两个链查询函数）②保留我方 `repairAgainst`/`repairTruncated` 两函数与两处调用点 ③hash 口径随卡 01（链内校验用 fullHash、仅最终重写取 contentHash）。B2 全盘上游=5 连败回归（不可接受） | **无**——增量未触碰 `cloud_agent_step_hash.go` | 可快签（依赖卡 01） |
| **03** runtime 409 容错分支 | **机械嫁接，无真分歧**：取上游全量结构（媒体审批重排/preparedMedia/image_layer_split 门/终态诊断合同），在新版 mutationErr 段原样嫁接我方 4 行 409 分支；嫁接后核对两点（`image_layer_split` 媒体失败路径是否同需 409 语义；`failCloudAgentAdmission` 新签名下分支顺序） | **无**——增量未触碰 `cloud_agent_runtime.go` | 可快签（保留两点核对） |
| **04** 模型选择严格校验 vs 静默忽略 | **正交共存**：上游严格校验照取；我方 normalize 仅保留视频专属参数（videoGenerateAudio/durationSeconds）；合并时上游校验先落、我方 normalize 后置。B1 全盘上游=不可自愈重试循环回归（不可接受） | ⚠️**有 delta，且语义同域**：增量新增 `85de9907`（参数错误**有限重试并折叠中间失败**，cloud_agent_tools 4 hunk + approval_preview 1 + agent_panel 3）、`fd3fc44d`（**漏 patch 按参数错误回给模型**而非终止整轮，approval_preview 1）、`13707c06`（工具 schema 瘦身去 oneOf，tools 4） | 需讨论：上游"参数错误回给模型 + 有限重试"与我方"拒绝会陷入不可自愈重试循环"的既有结论**方向相抵**（差异标注，不调和） |
| **05** 删除 patch 语义双实现 | **融合**：取上游 patch 语言（baseRevision/revision 字段+删除传播，服务版本历史），但 `mergeItems` 保留**来源约束**——after=null 仅①撤销采纳路径②历史恢复路径合法，`canvas_updated` 实时增量维持禁删。B1 全盘上游=已实证的复活/误伤缺陷面回归（不可接受） | **无**——增量未触碰 `agent-canvas-patch.ts` | 可快签 |
| **06** S08 同步合并策略 | **结构取上游 + 水位门重放**：①上游 mergeValue/mergeRecord/快照/草稿全取 ②我方水位判据保留在 `loadCanvasProjectForEditing` 入口（水位后本地改过且远端也变 → 仍走 diverged 冲突门）③"保留整条编辑分支交服务端拒绝"仅**水位一致**时生效 ④`backend-database.mdx` 随 schema v23 同步。B1 全盘上游=跨会话残留静默丢失（不可接受） | ⚠️**有 delta**：`dc1ad680`（31 hunk，增量最重）= `user-data-sync.ts` **12 hunk** + `use-canvas-render-model.ts` 4 + globals.css 9 + prompt-panel 3；`6f452405` 亦触 `canvas-generation-task-sync.ts` 1 | 需讨论：`user-data-sync.ts` 上游本轮又大改（12 hunk），卡 06 的"结构取上游"须按 **dc1ad680 后**的新结构重核水位门落点 |
| **07** canvas_undone 无条件刷新 | **取我方语义**：保持 `!supportsPatches` 门 + 终态回放不喂同步 + 专用 `adoptRemoteCanvasAfterUndo`；合并后核对一件事——上游 `canvas_undone` payload 若新增 canvasPatch，则把 undone 接进 patch 通道。B1 随上游=终态回放复活已删节点（真机实证，不可接受） | **无**——增量未触碰 `agent-canvas-sync.ts` | 可快签（保留事后核对项） |
| **08** frontend 模型目录来源删除 | **A 取上游（收窄为 system）**；爆炸半径 4 条（frontend 目录形态失去来源 / 4 个前端 managed 分支按纪律清理 / Agent 媒体审批模型枚举改走 system / 计费一致性提升）；**唯一运维前置**=部署侧确认系统渠道已配置（否则目录为空）。备选 B 保 frontend 分支（长期成本更高） | ⚠️**有 delta**：`b8eefdad` 触 `model_catalog.go`（+2 行）与 `user-session.ts`（+1 行）；`19c9a207` 触 model-picker（16 hunk） | 需讨论：A 方案落地时须与 `b8eefdad` 的目录/标签字段一并处理；4 文件清理清单在增量后新增标签消费面 |
| **09** globals.css 债区吸收策略 | **逐条对账后执行**：①落入我方已有唯一源规则 → 并入；②上游新增全局 `.ant-* !important`（772c5519）→ **不照搬**，等效由组件/唯一源承担；③中性新选择器族（.app-workspace-*）→ 接受；④focus→outline（46a32a95）→ **采纳**；另 5eab8126 拆分母题随迁 + 复核结论回写 PATCH-MAP。B1 机械合入（不推荐）/B2 全拒（不成立） | ⚠️**有 delta（小幅）**：`dc1ad680` 触 globals.css **9 hunk**；`b8eefdad` 触 `workspace-product.css` 1 hunk → 逐条对账清单新增两项 | 可签（对账清单 +2 项） |

## B 区：新增卡 10/11（拟议方向，待拍板）

| 卡号 | 结论方向（拟议） | 增减修正点（实测事实） | 签署建议 |
| --- | --- | --- | --- |
| **10** 批量生成一致性域（`6f452405` 系） | 拟议：**先读上游设计文档再定融合口径**——`6f452405` 自带 `docs/design/canvas-consistency-repair.mdx`（节点丢失/资源引用/刷新状态三处修复），须与我方批链收敛语义（空收敛摘字段、失败重试 reconcile、primary 提升）逐条对照 | `6f452405` **26 hunk**：project.tsx 13 / use-canvas-render-model 5 / **canvas-image-batch-retry.ts 3** / canvas-image-generation-executor.ts 2 / canvas-generation-task-sync.ts 1；新增 `canvas-generation-result.ts`(32)、`canvas-node-visibility.ts`(32) | 立卡：证据充分（直压我方 image/video 批链），但**结论待读上游设计文档后定** |
| **11** 模型展示标签域（`b8eefdad`+`19c9a207`） | 拟议：**后端 tags 直接采纳**（纯展示，不参与路由/报价/权限）；**前端手工接入**——我方 `model-picker.tsx` 813 行全量重写，与上游 37 hunk（21+16）机械合并必炸，须把标签渲染与报价交互接进我方行结构 | `b8eefdad` **25 hunk**：model-picker.tsx **21** / user-session.ts 1 / workspace-product.css 1；`19c9a207` **18 hunk**：model-picker.tsx **16** | 立卡：与卡 04/08 交叉（模型选择域同一战场） |

## C 区：增补建议（控制线未列入，证据要求）

| 项 | 事实 | 建议 |
| --- | --- | --- |
| **卡 12（拟议）多模态表格/列表模式链** | 6 提交 **92 hunk**：`a3bf0bd8` 21（project.tsx 13/media-tools 3/prompt-panel 3）、`6d355380` 17（project.tsx 13）、`d87c3944` 16、`5843d489` 15、`7985dbec` 12、`27bcca62` 11（后三均为 project.tsx 单文件 11-13 hunk）；我方批量表专有文件零碰撞，但 **project.tsx/媒体工具/提示面板冲突真实** | 立卡（这是增量最大冲突簇；控制线只列了 10/11，本项由证据提出） |
| Live2D `c5b81f69`（告知项） | 7 hunk：canvas-cloud-agent-panel.tsx 4 / .gitignore 1 / pending-test.mdx 2；新域文件为主（`appearance_live2d.go` 294 行等） | 不立卡，并入 Agent 面板域处理（低-中） |

## D 区：增量统计（三个数字，供签署参考）

- 增量 49 提交 → **24 个有真实冲突 / 241 冲突 hunk**；主战场 `project.tsx`（我方 71 次热改）与 `model-picker.tsx`（我方 813 行重写）。
- **零碰撞先遣队 25 提交**（模拟定稿，可先放行）。
- 红线：增量**未见** `237f2e2a` 同级语义破坏型；需盯的语义项 = `fd3fc44d`/`85de9907`（已并入卡 04 delta）/`6f452405`（卡 10）。

## E 区：签字记录（用户填写）

| 卡号 | 签署 | 备注 / 附加条件 |
| --- | --- | --- |
| 01 | | |
| 02 | | |
| 03 | | |
| 04 | | |
| 05 | | |
| 06 | | |
| 07 | | |
| 08 | | |
| 09 | | |
| 10 | | |
| 11 | | |
| 12（拟议） | | |
