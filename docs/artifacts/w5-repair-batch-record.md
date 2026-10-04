## 任务 2：IMG-06 引用更新 + B-2 注记更正（2026-10-04）

### 背景
控制线 2026-10-04 批准项（#13 关闭时的 side-fix）：
> 批准 side-fix = 更新 工具页候选清单 v3 IMG-06「已有」引用 和 B-2 L297
> 「超分后端未挂计费」note（O-03 已经挂计费）within W5。

### 改动（两处，均为工作稿，非 git 追踪）

**① 工具页候选清单 v3**（`/mnt/f/CODE/Project/canvas/竞品深拆-工具页候选清单-2026-10-03-v3.md`）

| 行 | 原文 | 更正后 |
|---|---|---|
| L436 | `O-03 层2 🔨W5（superResolveImageNode+占位换真+计费）；对话框已接线、计费映射未落地` | `O-03 层2 ✅ 已交付（superResolveImageNode + 占位换真 + image_upscale 计费已挂，2026-10-03 合入 main）；★ 2026-10-04 更正：原「计费映射未落地」已过时` |
| L1990 | `超分对话框已接线（计费映射未落地）` | `超分对话框已接线（★ 2026-10-04 更正：image_upscale 计费已挂，原「计费映射未落地」表述作废）` |

**② B-2 表口径声明**（`docs/artifacts/_synthesis/S12-FEATURE-CATALOG.md` L297）

原文把「超分后端未挂计费」当作「影策有 ≠ 已全渠道上线」的示例。更正为：

```
- 「影策有」= 代码/规划落地，不代表已全渠道上线（如抠图本地模型仍在验证，已在 B-2 注明）。
- ★ 2026-10-04 更正：原「超分后端未挂计费」已过时 —— O-03 层2（2026-10-03 合入 main）已挂
  image_upscale 计费（superResolveImageNode → canvasEditOperation=image_upscale →
  model_router.go skuSelectorForIntent 保留分支 + 传输层 generation-task.ts operation 直传）。
  超分不再是「代码在但未上线」的示例；剩余边界仅为真实超分渠道未接（veImageX/Replicate 预留 W5 B 线）。
```

### 断言核实（防误写，三处逐条）

| 断言 | 实测 |
|---|---|
| `superResolveImageNode` → `canvasEditOperation=image_upscale` | ✅ `use-canvas-media-tools.ts:1593` |
| `model_router.go` skuSelectorForIntent 保留分支 | ✅ `model_router.go:307-309` |
| 传输层 `generation-task.ts` operation 直传 | ✅ `generation-task.ts:294` `const operation = generationOperation(options)` |

### 处置说明（为何不提交）

- 工具页候选清单在 `/mnt/f/CODE/Project/canvas`（**非 git 仓**，纯工作稿目录）
- B-2 表在 `docs/artifacts/_synthesis/`（**被 gitignore 忽略**，整目录 40 文件均为未追踪工作稿）
- 按既有惯例：保持工作稿，不用 `git add -f`
- ★ 诚实边界：这两处更正在本地生效，但**不在版本控制内** → 若目录丢失，更正随之丢失
