# PRD — P4 生视频族：视频面 flora 语法对齐 + 份数>1 批量提交管线

> 任务：09-14-p4-video-family · P4 族序第 2 族（文本族 S08 已归档）
> 日期：2026-09-14 · 证据优先级：flora-evidence-kit 语料 > og-canvas atlas > 现采补缺

## 1. 背景与目标

P4 按族铺开 flora 画布语法，文本族已完成。本族把**视频节点面**对齐 flora 语法（生成中→完成→播放生命周期），并清偿 S08 拍板"UI 先行"留下的债务——`videoGenerationCount` 存而不消费。

**目标（D3 族序语境）**：
1. 视频节点生成中/完成/播放三态对齐 flora 语法（以 atlas DOM 级证据为准）。
2. 视频/音频份数>1 批量提交管线落地，与图像 batch 链同构。
3. 不引入新依赖；不破坏 S04/S07/micro-affordance 已验收行为。

## 2. 现状盘点（已核实，2026-09-14）

| 面 | 现状 | flora 语法（证据） |
|---|---|---|
| 生成中 | S04 `CanvasNodeLoadingFill` 已覆盖视频空节点（canvas-node.tsx:386）；渐变边框+徽章 | phase43：ETA 进标题、骨架只在依赖缩略图；Queue 计数（影策有 active-task-panel） |
| 完成/播放 | 静态首帧预览+hover 绑定预览+点击激活播放（mediaActive 门控）+VideoPlayer+字幕覆盖 | resultVideoBlock：radius24 壳、muted、**无原生 controls**、产品自持 transport；phase143：按钮→hover chrome→hydrate 后 muted 循环自动播放 |
| 空态 | `EmptyMediaContent "空视频节点"` | videoBlock：中央 PlayOverlay（size-16 圆钮）+引用 chip 行 |
| 份数 | `videoGenerationCount` 仅存储（canvas-node-prompt-panel.tsx:468）；executeVideoGeneration 单任务单节点 | 影策图像链已有完整 batch（canvas-image-generation-executor.ts：childIds/batchRoot/展开/重试） |
| 版本族 | 已有（versionOfNodeId/versionPrimary/label） | atlas 未采版本族视频差异 |
| 失败/重试 | 已有 errorDetails/generationErrorCode + 重试 | 与文本/图像共用 |

**og-canvas 语料库无视频面**（CanvasNodeType 仅 Image/Text/Config）——视频证据全靠 atlas + 现采，已获用户确认（优先库存、缺口现采）。

## 3. 证据清单（atlas 已有 vs 需现采）

已有（DOM 级，直接引用）：
- `node-videoBlock-min-grain.md`：壳结构/中央播放钮/引用 chip/创建 chrome（Play/Unmute/Qty/Generate）/selected HUD（模型+Duration+Aspect+Cost）
- `node-resultVideoBlock-min-grain.md`：完成态壳（R-RV1~5）、muted 无 controls、round play 兜底
- `phase143-public-video-comment-state-authority.md`：视频生命周期状态机（button→hover atoms→hydrate 循环播放→hover chrome 退出媒体保留→reload 回按钮态）
- `phase144-owner-reload-video-data-rejoin-authority.md`：loading/hasData/noData 三态映射 + data.videoUrl 输出能力
- `generation-lifecycle.md`：生成状态机全景（ETA/Queue/标题改写/Variant rail 3 of 3）
- 动效速查：generating-border-rotate（已实现）、GENERATION_REVEAL 400ms、pulse 骨架

需现采（atlas 明确 Gap 或证据薄弱）：
- G1：videoBlock **生成中**状态（atlas 只采到 scaffold 空态；生成中视频节点的骨架/进度/ETA 位置无实证）
- G2：resultVideoBlock **完整播放器 HUD**（时间轴 scrub/音量/全屏——atlas Gap 原文记录"not captured"）
- G3：videoBlock hover 工具条全原子清单（Unmute/Qty 与我们的 supply 体系如何对应）
- G4：视频 Variant rail（3 of 3）在多份数视频上的形态——与图像 batch 展开对齐的直接参照

现采方式：用户在 flora.ai 操作（chrome 现采 tmwd CDP 或用户截图），采集清单在 design 阶段给出。

## 4. 需求（用户可验收）

### R1 份数>1 批量提交管线（视频+音频，含 UI 先行债务清偿）
- `videoGenerationCount`/`audioGenerationCount` >1 时，视频按图像 batch 同构拆分：batchRoot + childIds + 并行任务提交 + 展开预览 + 失败项重试（复用 canvas-image-batch-retry 语义）。
- count=1 保持现行为不变（单节点，版本族逻辑不动）。
- 音频份数同管线（audioGenerationCount 已存），若音频节点无 batch 视觉面则评估最小形态（列表/计数徽章）后再实现。
- 上游/配额约束：逐任务独立提交，沿用图像链的取消/批清理语义。

### R2 完成态播放面对齐 resultVideoBlock 语法
- 静态壳保留 radius/overflow-hidden；点击播放后 muted 自持（不自动出声）；transport 由产品自持（已有 VideoPlayer）。
- phase143 语义校准：hover 预览 chrome 退出时媒体状态保留；播放激活不被 micro-affordance 误退场（hover 归属域需把播放中的视频节点面视为 supply 或豁免）。

### R3 生成中面对齐（以现采 G1 证据为准）
- 视频 loading 面已有 S04 填充；需补的仅是证据显示缺的差异项（ETA 位置/标题改写/Queue 计数对齐），以 G1 采集结果裁剪，无证据不发明。

### R4 播放器 HUD（以现采 G2 证据为准）
- 若 flora 视频播放 HUD 有时间轴/全屏等差异项且影策 VideoPlayer 缺失，按证据对齐；VideoPlayer 已有 compactControls，先盘点差异再定。

### 边界（不做的）
- 视频 5-chip 生成模式（文生/图生灰显）——capabilityConfig 消费链未建（S08 已拍板 out of scope）。
- 拼接/分镜/时间线编辑面（canvas-video-segment/frame-dialog 独立域）。
- 音频族本体（P4 后续族）。
- 视频成本显示（影策计价体系与 flora $ 不同源，不在本族）。

## 5. 验收标准

- A1：count>1 视频生成真机验证：N 个子节点并行提交、batch 展开预览、单任务失败不拖垮整批、失败项重试、取消清理。
- A2：count=1 回归不变（版本族/单节点路径）。
- A3：完成态播放：点击激活→muted 播放→hover 离开媒体保留；micro-affordance/hover 归属不因播放态误退场（真机）。
- A4：生成中/播放面与 atlas 证据逐项对照表（pending-test.mdx 登记）。
- A5：`bunx tsc`、`bun run build`、`go test ./...`（若动后端）全绿；bun test 不超基线。
- A6：文档同步（pending-test.mdx + 07 号快照）。

## 6. 约束

- 每切片一个 commit；闸门流程走 spec/implement.jsonl。
- 现采前不得凭空发明视觉（教训：生成视觉以语料为准）。
- 复杂任务：design.md + implement.md 齐备后 task.py start。
