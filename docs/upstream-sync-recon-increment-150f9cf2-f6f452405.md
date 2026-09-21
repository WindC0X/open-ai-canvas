# 增量侦察笔记：150f9cf2 → origin/main（49 提交 · A线批次七 · 2026-09-22）

> 锁版：`origin/main` HEAD = **6f452405**（用户裁定选 2）。全区间 `8d60a516..origin/main` = **129** 提交；
> 本文件只覆盖**增量 49 提交**（`150f9cf2..origin/main`，批次〇末点之后的段）。参考 tag v1.5.7 = `0e3fb79b`（在增量内）。
> 方法：文件级交集对照（上游 49 提交触碰 vs 我方 566 提交触碰）+ 三个点名域逐项读 diff；三方模拟（merge-file）待补。

## 一、增量构成（按域）

- **批量表 / 列表模式链（最大宗，~20 提交）**：`d87c3944`（合并 v1.5.6 多模态分镜）→ `6d355380`/`7985dbec`/`0e61fb00`/`10b85962`/`5843d489`/`3f5b0bd3`/`cce2d2d3`/`f9dc1c56`/`0e5fb27f`/`af968240`/`e94eab88`/`baddbc2f`/`944a2209`/`937f2b7a`/`cf4d2ab1`/`e921deac`/`6f1b4577`/`27bcca62` + `6f452405`（一致性修复）+ `dc1ad680`
- **模型选择**：`b8eefdad`（彩色展示标签）、`19c9a207`（候选报价/同渠道跳回）
- **Live2D 新域**：`c5b81f69`
- **技能**：`73ef84ff`（72 个方法论技能）、`d5ff2225`（元数据截断修复）
- **Agent 链**：`85de9907`（参数错误有限重试并折叠中间失败）、`fd3fc44d`（漏 patch 回给模型而非终止整轮）、`13707c06`（工具 schema 瘦身去 oneOf）
- **稳定性/CI**：`04d8b85e`（租约续租不被自己时限打断）、`76e02734`（测试库改 WAL 文件库）、`5045f7a7`（CI 备 Postgres/Redis）、`8b8ea291`
- **前端小修**：`4ab43ca6`/`5e3bc011`/`22d65d01`/`edcf7bc7`/`c09304d9`/`6c92c3be`/`13d8f629`/`93bc079b`/`15946e5a`
- **版本/插件**：`fd4872a4`（v1.7.0 标记）、`4066be73`（插件包更新）、`0e3fb79b`（v1.5.7 标记）

## 二、冲突热区对照（上游增量触碰 × 我方 566 提交触碰）

| 文件 | 上游(49内) | 我方 | 判读 |
| --- | --- | --- | --- |
| `docs/.../pending-test.mdx` | 11 | 188 | 文档，逐段并入 |
| `web/src/pages/canvas/project.tsx` | 7 | 71 | **热**（我方 HUD/落位/面板挂载区） |
| `backend/internal/app/cloud_agent_tools.go` | 3 | 6 | 中（fd3fc44d/13707c06 域） |
| `backend/internal/app/resource_delete_test.go` | 3 | 2 | 低（测试） |
| `web/src/components/canvas/canvas-node-prompt-panel.tsx` | 3 | 18 | **热** |
| `web/src/types/canvas.ts` | 3 | 9 | 中 |
| `backend/internal/app/cloud_agent_approval_preview.go` | 2 | 9 | 中（我方落位口径新域） |
| `docs/content/docs/backend/code-map.mdx` | 2 | 1 | 文档 |
| `web/src/components/canvas/canvas-cloud-agent-panel.tsx` | 2 | 14 | **热**（撤销条/审批卡） |
| `web/src/components/model-picker.tsx` | 2 | 32 | **最热**（我方 813 行重写） |
| `web/src/lib/model-capabilities.ts` | 2 | 3 | 中 |
| `web/src/pages/canvas/use-canvas-render-model.ts` | 2 | 3 | 中 |

**零碰撞观测**：批量表/列表模式链主体文件（`list-mode-generator.ts`、`canvas-batch-table*.ts(x)`、`use-canvas-batch-table.ts`）**不在交集内**——我方从未触碰，属上游独占新域。

## 三、三个点名域逐项结论

### 1. `b8eefdad` 模型选择彩色标签（用户指定重点）
- **后端**：schema 加 `channel_models.tags`（TEXT/JSON `[{text,color}]`）；`ChannelModelTag{Text,Color}`；校验 = ≤5 个、文字 1–12 字去空白、不可重复、颜色限 `purple/blue/green/gold/orange/pink`（非法整单拒绝）；admin 编辑；模型接口返回 `tags`；**展示专用，不参与路由/价格/权限**；`model_catalog.go` 亦被 +2 行。
- **前端**：新 `model-tags.tsx`(+9)、`lib/model-tags.ts`(+10)；`model-picker.tsx` 48 行（选项勾选结构改写 + 标签渲染）；`user-session.ts` +1（目录字段）。
- **对我方影响**：我方 `model-picker.tsx` 为 flora 双栏全量重写（813 行）→ **机械合并必炸，须手工把标签渲染接进我方行结构**；`model_catalog.go` 与 ⑥ 卡（frontend 目录来源去留）同域；schema 版本号与 `237f2e2a` 一并处理。

### 2. `c5b81f69` Live2D（新域）
- 新文件为主：`backend/internal/app/appearance_live2d.go`(+294)、`appearance_canvas.go`(+64)、`handler/appearance_live2d.go`(+72)、`openapi.yaml`(+62)、测试 252 行。
- 与我的重叠：`.gitignore`、`resource.go`(5 行)、`service/aliases_consts.go`(1 行)、`canvas-cloud-agent-panel.tsx`/`canvas-cloud-agent.css` 少量、两份文档。
- **判读：低-中**（新域，注册点级冲突；面板/css 那几处需人眼过一遍）。

### 3. `6f452405` 画布批量生成一致性修复（**真热区**）
- 触碰：`canvas-image-batch-retry.ts`(34)、`canvas-generation-task-sync.ts`(5)、`canvas-project-generation.ts`(29)、`canvas-image-generation-executor.ts`、`project.tsx`、`use-canvas-render-model.ts`；新增 `canvas-generation-result.ts`(32)、`canvas-node-visibility.ts`(32)；`docs/design/canvas-consistency-repair.mdx`(40)。
- **与我方直接同域**：我方图像/视频批链（`canvas-image-batch-retry` 复用、`canvas-generation-task-sync` 6 次热改、video batch 执行器）→ 须逐条对照"节点丢失 / 资源引用 / 刷新状态"三处修复与我方收敛语义。

## 四、零碰撞先遣队（文件级首过，22/49）

`d5ff2225`、`5045f7a7`、`c09304d9`、`73ef84ff`、`04d8b85e`、`f7a8b9ed`、`22d65d01`、`6c92c3be`、`5e3bc011`、`edcf7bc7`、`0e3fb79b`、`0e61fb00`、`3f5b0bd3`、`cce2d2d3`、`f9dc1c56`、`0e5fb27f`、`e94eab88`、`baddbc2f`、`944a2209`、`937f2b7a`、`6f1b4577`、`fd4872a4`、`4066be73`
（判据 = 该提交触碰文件**完全不在**我方 566 提交改动集内；精确零碰撞仍需三方模拟复核）

## 五、我方 delta（侦察基线 `8d60a516` → `bb1db672`）

| 文件 | 改动量（±行） |
| --- | --- |
| `web/src/components/model-picker.tsx` | 813 |
| `backend/internal/app/cloud_agent_media.go` | 174（含本轮落位三笔修复） |
| `web/src/components/canvas/canvas-node.tsx` | 156（已叠 F-06 合取改动） |
| `backend/internal/app/cloud_agent_canvas_state.go` | 86 |
| `cloud_agent_approval_preview.go` | 落位口径（本次新增锚点/视野/占位助手） |

## 六、拟议裁决卡（签名制材料，不自裁）

- **新增卡 10｜批量生成一致性域**：`6f452405` 系（节点丢失/资源引用/刷新状态）与我方 image/video 批链收敛语义的融合口径。
- **新增卡 11｜模型展示标签域**：`b8eefdad` 后端 `tags` 采纳 + 我方 model-picker 重写体手工接入；与 04/08 卡交叉。
- **修订卡 04**：增量追加 `19c9a207`（报价显示）与 `13707c06`（工具 schema 瘦身）→ 影响我方模型选择面与工具 schema 面。
- **修订卡 09**：增量侧 `globals.css` 仅 1 次触碰 → 债区扩张有限，吸收策略不变。

## 七、红线检查（批次七）

- 增量 49 提交**未见 `237f2e2a` 同级"端到端裁断我方依赖链"的语义破坏型提交**；需重点盯的语义项为 `fd3fc44d`（漏 patch 改回给模型）、`85de9907`（参数错误有限重试）、`6f452405`（批链一致性）——三者均与我方既有语义可能相抵，进卡内裁决。
- 待办：对 49 提交逐个 `git merge-file` 三方模拟 → 精确冲突 hunk 数与先遣队定稿。
