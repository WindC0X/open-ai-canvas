# P4 族3 角色引用与分镜 flora 化

> 2026-09-18 立项。D3 族序最后一族（生图✅ → 文本✅ → 生视频✅ → **角色引用/分镜**）。

## Goal

把角色引用与分镜的画布 UI 对齐 flora 交互语法：角色引用 UI 从数据层（已有类型）落到交互层，分镜表格/batch-table 完成 flora 化对齐。收口 P4 族序。

## 侦察现状（2026-09-18，三路证据）

### flora 证据（atlas 语料）
- **R17**（canvas-generative-assembly-rules.md:293）：Reference chip 是文本/图默认跨节点依赖 UI——`Chip(title, kind)` + `button[aria-label="Remove <title>"]`，remove 图标默认 opacity:0；样本：Untitled 项目 7 chips，rich text 节点同时持有 Text+Image chips。
- **R18**（同文件 :297）：Technique 端口契约——Character Lock 需要 Character Image 槽位；左侧 target handle id = 槽位名（`character-image`），空时 helper 文案 "Connect an Image Node"；右侧 source handle UUID + `cursor:not-allowed` 直到有输出。
- **R20**：选中节点右侧 inspector 有 Model/Characters/Created/Cost/Creator 槽。
- **minimum-units**：Character Image 实测 306×40px（横向小卡）。
- **缺口**：语料中**无**角色卡大面板/角色库证据（phase143/144 为视频态）→ 超出部分按八原则 4 标「自行设计，无 flora 参照」。

### 影策现状
- **数据层已备**：`canvas.ts:56-130` 有 StoryboardRow 20 列 / StoryboardCharacterReference（characterName/characterAssetId/characterVersionId/characterDescription/characterImageNodeId）/ StoryboardAssetBinding（nodeId+role+priority，role 8 类）/ CanvasWorkflowKind 含 character。
- **UI 层零消费**：`rg StoryboardCharacterReference|StoryboardAssetBinding|assetBindings web/src` 无 tsx 命中——角色引用只有类型没有交互。
- **分镜骨架在**：use-canvas-storyboard.ts 572 行、use-canvas-batch-table.ts 153 行、canvas-batch-table-node.tsx 表格节点已在（上游实现，W1-C 取上游侧）。
- **上游 v1.5 增量**：Agent 计划插话/结构化分镜（cloud-agent-panel planMinimized/planItems）、AgentLessons 记忆——已在 W2 嫁接。

## Requirements

- R1 角色引用交互：按 R17 chip 语法实现节点间角色/资产引用（引用行 + Remove 按钮 + typed label），接通 StoryboardCharacterReference/StoryboardAssetBinding 数据层。
- R2 角色槽位端口：按 R18 端口契约给分镜/批量节点加角色槽位连线（空槽 helper 文案 + 连线绑定 assetBindings）。
- R3 分镜表格 flora 化：batch-table 节点视觉/交互对齐 flora 语料（玻璃 surface/微供给/安静化令牌，复用族 1-2 既有原语与令牌）。
- R4 「无证据不发明」边界：语料未覆盖的面（如角色库管理面板）标记自行设计并先问用户。

## 已拍板（2026-09-18）

- Q1 = **chip+端口组合**（R17 引用 chip + R18 槽位端口；不做独立角色卡节点/角色库）。
- Q2 = **不纳入** Agent 结构化分镜（W2 已嫁接，本族只做画布侧）。
- Q3 = **角色先行**：S1 chip → S2 端口 → S3 表格 flora 化 → S4 终验（A1-A4）。
- Q4 = 语料缺口面（角色库面板等）按八原则 4 标自行设计，出现时先问用户。

## Acceptance Criteria

- [ ] A1 角色引用 chip：分镜行内增删角色（缩略+名+Remove aria-label），删 chip 仅移除绑定不删节点
- [ ] A2 端口连线：`character:` handle 连图像资产节点，空槽 helper 文案，非法 source cursor:not-allowed，去重+上限
- [ ] A3 生成闭环：绑定角色后行生成的 prompt/references 含角色图（mock 渠道验证）
- [ ] A4 表格 flora 化：玻璃 surface/滚动条/微供给接线 + 明暗主题过检

## Boundaries

- 不动 backend 分镜存储结构（StoryboardRow 已在）；不改模型渠道协议；角色库 CRUD 若需要独立面板另立任务。
