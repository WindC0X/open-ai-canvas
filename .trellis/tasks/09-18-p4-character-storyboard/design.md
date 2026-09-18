# design — P4 族3 角色引用与分镜 flora 化

> 依据：prd.md（Q1-Q3 已拍板：chip+端口组合 / Agent 分镜不纳入 / 角色先行）。

## 1. 基建复用盘点（2026-09-18 实测）

| 能力 | 现状 | 复用方式 |
|---|---|---|
| typed handle 连线 | `batch-reference:<colId>` 前缀 + `planBatchConnections` + `onConnectStart/Drop`（canvas-batch-table.ts:7-57, batch-table-node.tsx props） | 角色槽位新前缀 `character:` 完全同构复用 |
| chip 视觉语法（R17） | hover 信息态引用缩略行已按 flora AssetChip 源码重写（e1f3945a：壳 h-10 自由宽/hover 底色 58 透明/mask fade 行） | 角色 chip 复用同一 AssetChip 族视觉 |
| mention 引用 | `canvas-resource-mention-textarea` + `CanvasResourceReference` + `canvasResourceMentionToken` | prompt 内角色 token 引用与 chip 行共用 resolve 链 |
| 分镜数据层 | `StoryboardRow.characters[]`（StoryboardCharacterReference）+ `assetBindings[]`（StoryboardAssetBinding: nodeId+role+priority） | 本族首次接通 UI 写入 |
| 分镜表格 | canvas-batch-table-node.tsx（antd 基建 + BatchReferenceColumn 已有多列引用列） | S3 flora 化对象 |

## 2. 技术方案

### S1 角色引用 chip（R17）
- **挂载点**：batch-table 分镜行内 + 分镜相关节点体（画布节点行内引用行），chip = 角色资产节点缩略 + 角色名（characterName）+ role 徽章 + Remove 按钮（`aria-label="Remove <角色名>"`，remove 图标 hover 显）。
- **数据流**：chip 增删写 `row.characters[]`（name/description/characterImageNodeId）+ `assetBindings[]`（nodeId + role="character" + priority）；删除 chip = 移除对应 binding（先查引用守则：仅行内移除不删节点）。
- **视觉**：复用 e1f3945a 的 AssetChip token（圆角/底色/mask），零新令牌。

### S2 角色槽位端口（R18）
- **handle**：batch-table 节点左缘新增角色槽位 handle（id 前缀 `character:`），几何沿用 `BATCH_REFERENCE_HANDLE_TOP/GAP` 常量模式；空槽 helper 文案「连接角色图像节点」（R18 语法中文化）；连线 commit 走 `planBatchConnections` 同构扩展（planBatchCharacterConnections 或参数化）。
- **校验**：source 必须是图像资产节点（R18 cursor:not-allowed 语义）；重复绑定去重；上限按 MAX_BATCH_REFERENCE_COLUMNS 模式设常量。
- **归属**：角色槽位 handle 是供给域延伸（MODEL_PICKER 同款豁免链，防止 hover 归属被截杀）——接 canvas-batch-table 现有 handle 域即可，无新豁免。

### S3 分镜表格 flora 化
- antd 基建保留（表格语义），视觉层换族 1-2 既有令牌：玻璃 surface（0a395a83 族）、canvas-settings-scroll 滚动条、微供给 AffordanceSurface 接线（表格节点 hover 态）。
- 行内 chip 行在表格 flora 化后回嵌。

### 不做
- Agent 结构化分镜流转面（用户拍板不纳入）；角色库管理面板（语料无证据，需要时另立任务）；backend 存储结构变更。

## 3. 风险

- `planBatchConnections` 的角色扩展需保证 batch 生成提交链（references 组装）把角色图注入 prompt——S1 实现时先读生成提交链再动数据流，避免"绑了不生效"。
- chip 行嵌表格行内可能与表格横向滚动冲突——chip 行放表格节点体（行外）或行内固定列，S1 实测定。
