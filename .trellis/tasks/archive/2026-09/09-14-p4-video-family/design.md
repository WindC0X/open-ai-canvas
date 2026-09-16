# Design — P4 生视频族：视频面 flora 对齐 + 份数批量管线

> 前置阅读：prd.md（现状盘点/证据清单/边界）。本文只写技术决策。

## 1. 总体结构

两个独立可验交付（同任务内分切片，不拆父子任务——共享证据与验收面）：

- **D-A 份数批量管线**（R1，纯执行链 + batch 视觉复用）
- **D-B 播放/生成面对齐**（R2/R3/R4，以现采 G1/G2 证据裁剪后实现）

依赖关系：D-A 不依赖 D-B；D-B 的 G4（Variant rail）参照图像 batch 展开面，若 D-A 先落则 G4 直接对齐实现，故实现顺序 D-A → D-B。

## 2. D-A 份数批量管线设计

### 2.1 提交链（canvas-media-generation-executors.ts）

`executeVideoGeneration` 增加 count 分支，与 `canvas-image-generation-executor.ts` 同构：

```
count = Number(sourceNode?.metadata?.videoGenerationCount) || 1
（份数存节点 metadata，不在 generationConfig——canvas-node-prompt-panel.tsx:468 写 metadata；
`generationConfig.videoCount` 是"引用视频条数"（use-canvas-generation-executor.ts:392 hydrated context），语义不同，勿混用。）
```

- **count=1**：现有路径原样保留（单节点 + 版本族逻辑不动）——A2 回归保证。
- **count>1**：
  - batchRoot = 空/源节点（`canGenerateMediaInPlace` 语义与图像一致：空视频节点就地变 batch root）；childIds = `Array.from({length: count}, nanoid)`。
  - root 元数据：`isBatchRoot: true, batchChildIds, batchFailedCount: 0, imageBatchExpanded → 通用化 batchExpanded`（见 2.3），子节点 `batchRootId`。
  - 每个子任务独立 `runCanvasGenerationTaskToConsumer`（`config.count` 不下发——份数是画布层概念），`Promise.all` 并行，单任务失败只标 `batchFailedCount+1`，不拖垮整批。
  - 成功首子节点提升为 root 主内容（`primaryImageId` 图像专用字段 → 视频用 `primaryChildId` 通用命名？——**否**：沿用 `primaryImageId` 字段名会语义错位；新增 `metadata.primaryVideoId`，batchPreviews 过滤逻辑同步通用化）。
  - 连线：源节点→各 childId（与图像 batchConnections 同构）。
- **版本族交互**：count>1 与版本族互斥——已有内容的视频节点重新生成时若 count>1，走 batch 新族（不挂 versionOfNodeId），batch 成功不自动替换源节点内容（用户从 batch 预览选定后才替换，替换动作复用图像的 child→primary 语义扩展到视频）。

### 2.2 batch 通用化清单（图像字段 → 中立字段）

图像 batch 字段名带 `image` 前缀的（`imageBatchExpanded`、`primaryImageId`）**不改名**（图像链已验收，避免牵动），视频新增中立字段：

| 视频新增 | 复制自 | 消费点改造 |
|---|---|---|
| `batchExpanded?` | imageBatchExpanded | world-layers batchPreviews memo（node.metadata?.isBatchRoot 过滤本就中立，只需加 batchExpanded 读点） |
| `primaryVideoId?` | primaryImageId | executor 成功提升逻辑 + batchPreviews 过滤 `id !== primaryVideoId` |

`canvas-image-batch-retry.ts` 的三个函数（liveChildren/retire/cancelIncomplete）**签名本就中立**（参数是 root/nodes/connections，读 `batchChildIds/batchRootId`）——直接复用，函数名带 Image 前缀不改（登记技术债：重命名一次性 clean-up，不混入本任务）。

### 2.3 batch root 渲染分发（canvas-node-content.tsx:80 缺口）

现状 `if (props.isBatchRoot) return <ImageNodeContent/>` 硬编码。改：

```tsx
if (props.isBatchRoot) {
    if (node.type === CanvasNodeType.Video) return <VideoBatchRootContent {...props} />;
    return <ImageNodeContent {...props} />;
}
```

`VideoBatchRootContent` 最小形态：BatchFrame 复用（展开预览/计数/恢复 UI 与图像同构），媒体格子渲染视频静态首帧（InactiveVideoPreview 逻辑提取复用，不激活播放）。

### 2.4 音频份数（R1 尾项）

音频节点无 batch 视觉面；最小形态 = **顺序串行**提交 count 个任务到同一音频节点？——否，音频节点单内容体。决策：**音频份数 UI 暂保留但提交仍为单次**（与现状一致），PRD 的"最小形态评估"结论登记为：音频 batch 需要"音频条目列表"视觉面，属于音频族（P4 第 4 族前不属视频族），本任务不做，`audioGenerationCount` 债务顺延到音频族任务销项。

### 2.5 UI 入口

canvas-node-prompt-panel.tsx 份数 pill 已存在（:468 写 `videoGenerationCount`）；提交链读取即可，UI 零改动。

## 3. D-B 播放/生成面对齐设计

### 3.1 R2 完成态（resultVideoBlock 对齐）

已核实结构性满足的（不改）：
- muted/无原生 controls/产品自持 transport（VideoPlayer compactControls）✓
- radius 壳/overflow-hidden ✓
- mediaActive 门控：`activeMediaNodeId` 在 world-layers 本地，仅节点删除清空——phase143"hover chrome 退出媒体保留"天然满足 ✓

需对齐的差异（依据 atlas 原值）：
- resultVideoBlock radius 24px（rounded-3xl）vs 影策 `var(--node-radius)`——**不改**：影策节点族统一 radius token 是 P2 安静化决策，族内一致性优先于单面复刻（登记对照表说明）。
- phase143 的"muted **循环**自动播放"：现 VideoNodeContent autoPlay 但未确认 loop——补 `loop` 属性（证据 phase143 "muted looping autoplay"）。
- 播放激活与 hover 归属：播放中的视频节点若 hover 退场，面板 micro 化不暂停播放（媒体状态独立于 affordance，现状已满足，验收确认即可）。

### 3.2 R3 生成中面（G1 现采后裁剪）

已有 S04 LoadingFill 覆盖视频。候选差异项（以现采定去留）：
- ETA 进标题（phase43 语法）——S04 已实现 ETA（96s 缓爬兜底），核视频频分支是否复用同一 ETA 面即可。
- Queue 计数——active-task-panel 已有，无差异不动。

### 3.3 R4 播放器 HUD（G2 现采后裁剪）

VideoPlayer compactControls 现状盘点（时间轴/音量/全屏覆盖度）与 flora HUD 对照后出差异表；**差异实现以证据为限，无证据不发明**。

## 4. 现采清单（design 产出物，用户执行）

| # | 场景 | 采什么 | 用途 |
|---|---|---|---|
| G1 | flora 视频节点提交生成后 | 生成中节点 DOM 截图 + class/结构（ETA 位置/骨架范围） | R3 差异表 |
| G2 | flora 完成视频播放中 | 播放 HUD 展开态 DOM（时间轴/音量/全屏原子与 class） | R4 差异表 |
| G4 | flora 多份数视频（若可触发 Qty>1） | Variant rail 形态（3 of 3 控件结构） | 2.3 VideoBatchRoot 视觉参照 |

采集方式：用户操作 flora.ai，浏览器截图发会话（tmwd CDP 现采由助手执行，用户仅授权操作面）；或用户手动截图。**采集完成前 D-B 不动码**；D-A 不依赖现采，可先行。

## 5. 回退与风险

- 每切片独立 commit，D-A/B 可独立 revert。
- 风险1：batch 通用化触碰 world-layers batchPreviews/图像重试链——回归门：图像 batch 全场景复测（生成/展开/重试/取消）。
- 风险2：视频子节点成功提升与版本族互斥逻辑边界——设计上互斥（2.1），实现断言 count>1 时绝不写 versionOfNodeId。
- 风险3：G4 无证据（flora Qty 对视频不可用）——回退：VideoBatchRoot 直接复用图像 BatchFrame 视觉（同源组件），不发明新形态。

## 6. 验证面

- 纯函数/链路：bun test（executor 拆分/字段读写）。
- 真机（tmwd）：A1 全场景 + A3 播放语义 + 图像 batch 回归。
- build：tsc 0 + vite build + bun test 不超基线。
