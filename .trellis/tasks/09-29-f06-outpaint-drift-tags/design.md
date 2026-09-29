# 设计 · 扩图画幅偏差处置 + 模型行标签布局（2026-09-29）

## 边界与合同

- 单一事实：画幅偏差阈值 = **0.02（log 域）**，贯穿前端角标与后端贴回——"角标亮 = 不贴回"。
- 呈现原则：偏差场景"结果即事实"（节点按实返图比例重算）；非偏差保持既有合同链（扩图占位 manualSize / userResized / freeResize / edit+auto 全部不动）。
- 标签布局：侦察后定 **方向 a**（全行统一 3 行高）。理由：验收"重心不漂移 + 行高不跳变"两条件仅 a 全部满足；上游描述"标题+副标题+标签三行固定结构"与 a 同构；b（顶部锚定）仍保留行高落差。上游 origin/main 实现（`b8eefdad` 标签系统）无占位预留，其"固定结构"靠行承载，我方按 a 收紧。
- 改动面最小化：**不碰** model-tags.css / model-tags.tsx（上游文件零改）；slot 规则落已分叉的 model-picker.css（fork 已 687 行差异，冲突面本就在此）。
- 偏差呈现的落点是**两处写回**（任务同步链 + 直连成功链）：任务书点名 sync 文件；直连链存在同一合同语义，只改一处会导致两条链路行为不一致（新生成立刻经直连写回可见）——同口径落地，卡内与报告注明供审。

## 修项 1（后端 · task_outpaint_hardblend.go）

- 常量 `outpaintHardBlendMaxAspectDelta` 0.08 → 0.02；三处注释统一"角标亮=不贴回（②a 修订 2026-09-29）"（常量 / 函数 doc ③ / 超阈分歧点）。
- 超阈跳过日志行为保持（调用方 warn，已有）。
- 测试：`TestHardBlendOutpaintImageRejectsAspectDistortion` 中"1.06 倍允许"改为"1.06 倍（drift≈0.058）必须拒绝"；新增边界对：frame 1000×800，结果 2043×1600（drift≈0.0213）跳过、2039×1600（drift≈0.0193）贴回。

## 修项 2（前端 · 两处写回同口径）

- 判定：`mismatchRefit = sizeMismatch && !userResized && !freeResize`——让位的只有"提交框合同"；人工尺寸（手动框/自由比例）仍受保护。
- `canvas-generation-task-sync.ts`：submittedSize/sizeMismatch 计算前移到 imageSize 之前；`imageSize = mismatchRefit ? fitNodeSize(uploaded.width, uploaded.height) : 既有链`。
- `use-canvas-media-tools.ts`（直连）：sizeMismatch 先算；`size = mismatchRefit ? fitNodeSize(uploaded) : 占位框逻辑`；非偏差零改动。
- 守卫（新测试文件 `web/test/outpaint-drift-node-size.test.ts`，mock image-storage 保留全导出 + 动态 import 消费方，沿用 canvas-video-batch-executor 防泄漏惯例）：
  1. drift 0.0522 节点（1003×1275 提交 / 896×1200 实返）→ 宽高 = `fitNodeSize(896,1200)` 且 `outpaintSizeMismatch` 写入；
  2. 非偏差 manualSize → 保持 1003×1275 且角标清空（回归）；
  3. userResized + 偏差 → 现框保留（保护语义存档）。

## 修项 3（前端 · 方向 a）

- ModelLabel 内 tags 行套 `<span className="canvas-model-picker-tags-slot">`（picker 独有，不进 model-tags 组件）。
- model-picker.css 加 slot `min-height: 27px`（= chip 高 21px〔fs-tiny 10px×1.5 + 上下 padding 4px + 上下 border 2px〕+ model-tags margin-top 6px；注释注明来源与联动关系）。
- 验收口径：混排列表（无/单/双标签）行高一致、logo 与价格徽章纵向锚定不漂移（headless 实测：行高测量 + 截图）。

## PATCH-MAP 冲突预判（要点）

- **C1 高**：`model-picker.tsx` + `model-picker.css` 本批再动 tags 行附近区块；fork 已大幅分叉（vs origin/main 860+ 行），上游 tags/价格仍在演进 → 同步时以 fork 结构为底逐条并入。
- C2/C3 低：sync / media-tools 上游近期未动。
- C4 无：hardblend 为 B 线独有，上游无对应面。

## 回滚

- revert 提交1 = 阈值回 0.08（恢复盲区带，不推荐）；revert 提交2 = 偏差呈现与标签布局回旧行为（两处写回 + slot 同 revert）。
