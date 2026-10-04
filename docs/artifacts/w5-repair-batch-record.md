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

---

## 任务 1：AST-08 双向引用只读 API（完成）

**commit**：`85ff494d`（branch `fix/w5-repair-gaps`）

### 交付内容

**后端**（`backend/internal/app/resource_reference_query.go`，新文件）
- `ResourceReferences(userID, resourceID)` —— 方向一「资源被谁引用」
- `AssetResourceOccupancy(userID, assetID)` —— 方向二「素材占用哪些资源」
- 路由：`GET /api/resources/:id/references`、`GET /api/assets/:id/resource-occupancy`
- service aliases 三类型导出（稳定导入面纪律）

**前端**
- `resources.ts`：`getResourceReferences` / `getAssetResourceOccupancy` + 类型
- `assets/index.tsx`：删除确认框加 `ResourceReferencePreview` 引用预检

### 设计要点

| 要点 | 处理 |
|---|---|
| **与删除路径同源** | 复用 `ResourceReferenceSnapshotExcludingAssets` + `assets.CollectDocumentResourceReferences`，预检数字与删除被拒提示不会漂移 |
| **只读保证** | 不进入删除事务、不产生 deletion job（测试断言） |
| **归属校验** | 非本人资源按 `NotFound` 处理（不泄露存在性） |
| **超限保护** | 200 条上限 + `Truncated` 标记 |
| **解析容错** | 单文档解析失败 skip 而非 abort（不因一条脏数据拖垮整体查询） |
| **「给而不要求」** | 预检加载中/失败都不阻塞删除 —— 是信息不是门禁 |

### 测试

- **Go 6 例**：引用返回（含 nodeId）/ 只读性 / 归属隔离 / 空引用不报错 / 素材占用 / 素材不存在
- **前端 6 例**：GET 路径 / ID 转义 / 空列表 / 截断透传 / code!==0 抛错 / 占用端点

### 门禁

| 项 | 结果 |
|---|---|
| `go build -buildvcs=false ./...` | exit 0 |
| `go test ./internal/app/ -run Resource` | ok (97s) |
| `tsc --noEmit` | exit 0 |
| `eslint`（改动文件） | exit 0 |
| `bun test`（全量） | **2744 pass / 1 fail** |

**1 fail 定性**：`web/test/agent-canvas-sync.test.ts:61` 的
「fallback snapshots obey the configured minimum refresh interval」——
**已知 flaky**（该文件内 rider 注释自述「本批全量 3 跑 1 现」，flora 验收期首现的观察名单二次复现），
单独复跑 **1 pass / 0 fail**。与本次改动零关联（画布同步 vs 资源引用）。

---

## 任务 3：片 3-4 UI 降级提示条（★ 遇设计矛盾，已上报裁定）

### 控制线令
> 3. 片 3-4 UI 降级提示条（光照/机位/镜头弹窗消费 registry-reader 的降级标注，R25m 收尾债）。

### 实测四项事实（与令的前提冲突）

| # | 事实 | 证据 |
|---|---|---|
| ① | **服务端无片 3-4 数据源** | `tools.json` 的 type 仅 `[style, motion, nine_grid]` |
| ② | **三个弹窗直连本地常量** | `canvas-node-lighting-dialog.tsx` / `canvas-node-camera-dialog.tsx` 的 registry 引用 **0 处** |
| ③ | **registry-reader 无片 3-4 读取函数** | `loadLighting/Camera/Lens` 函数数 = 0 |
| ④ | **片 3-4 适配器存在但无消费者** | `registryAssetFromLegacyLightingPreset` / `FromCameraProfile` / `FromLensProfile` 消费点仅 `registry-adapters.test.ts` |

### 矛盾实质

「降级提示条」的语义前提是**「服务端是主、本地是兜底」**。
但片 3-4 是**纯前端常量** —— 本地**就是**真值，**没有「降级」这回事**。
加提示条等于告诉用户一个不存在的降级状态。

R25m 验证记录 L437 早已写明此点（「无降级态可言（本地即真值）」），
且控制线 2026-10-04 09:07 的裁定也认可了这一分离。

### 待裁定（已上报）

- **A**（助手推荐）：改判为「不接」，验证记录补说明，本项关闭（符合 §3.2 纪律 + 09:07 裁定）
- **B**：补服务端源再降级（新功能开发，超出「收尾债」量级）
- **C**：仅统一数据通路不加提示条（重构而非收尾债）

**状态**：任务 3 暂停，等待控制线裁定。
