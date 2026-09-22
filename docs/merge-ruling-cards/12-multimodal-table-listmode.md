# 裁决卡 12：多模态表格 / 列表模式链（增量最大冲突簇）

> 状态：**已立卡（2026-09-22 签署）**，待"预先语义分析"后拍板融合口径。控制线未列入本卡，由批次七增量证据提出。

## 事实（批次七三方模拟实测）

6 个提交合计 **92 冲突 hunk**（增量 241 hunk 中的最大簇）：

| 提交 | hunk | 冲突文件分布 |
| --- | --- | --- |
| `a3bf0bd8` 多模态表格 - 合并 PR #549 | 21 | project.tsx(13)、use-canvas-media-tools.ts(3)、canvas-node-prompt-panel.tsx(3) |
| `6d355380` 多模态视频分镜表 | 17 | project.tsx(13)、use-canvas-media-tools.ts(3)、types/canvas.ts(1) |
| `d87c3944` 合并 v1.5.6 多模态分镜 | 16 | project.tsx(13)、canvas-node-prompt-panel.tsx(3) |
| `5843d489` 列表模式入口 | 15 | project.tsx(12)、canvas-node-prompt-panel.tsx(3) |
| `7985dbec` 批量生成设置对话框 | 12 | project.tsx(12) |
| `27bcca62` 批量创作表设置对话框 | 11 | project.tsx(11) |
| （`e921deac` 3、`cf4d2ab1` 2 同族小项） | 5 | prompt-panel / types / shared |

- 上游批量表**专有文件**（`list-mode-generator.ts`、`canvas-batch-table*.ts(x)`、`use-canvas-batch-table.ts`）与我方 566 提交**零碰撞**（我方从未触碰）。
- 冲突全部落在**共享宿主**：`project.tsx`（我方 71 次热改）、`canvas-node-prompt-panel.tsx`（我方 18 次）、`use-canvas-media-tools.ts`（我方 14 次）、`types/canvas.ts`。

## 待做的预先语义分析（签署指定）

把 92 hunk 逐条分类为两类，形成 `12-...-analysis.md`：

1. **纯新增直收**：上游新增能力（列表模式/多模态分镜/生成设置对话框）落在我方未改区域的 hunk → 直接接受。
2. **压我方改动**：hunk 与我方既有改动同区（宿主文件的我方热改面）→ 逐条标注我方原意图 + 上游意图，交拍板。

## 已知风险

- `project.tsx` 单文件在 5 个提交中各压 11–13 hunk —— 该文件是我方 HUD/面板挂载/落位的主战场，冲突语义需逐条读，不可批量取边。
- 上游多模态分镜与我方 P4 角色/分镜族（09-18 任务）在**分镜表宿主**上可能重叠（我方 S1 chip 挂在 `canvas-script-node.tsx`，需核对是否同文件）。
