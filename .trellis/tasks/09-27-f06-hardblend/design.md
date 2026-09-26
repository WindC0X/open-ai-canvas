# F-06 二期硬贴回 技术设计（首日侦察版）

> 基线 `5a567238`，2026-09-27 侦察（任务链实读 + 3 单真机复验）。待裁决点已标注 ⚖️。

## 1. 现状链（侦察实读）

### 提交链（前端）

- 工具链扩图提交：`use-canvas-media-tools.ts executeOutpaintImageNode` → `runBackendCanvasGenerationTask`：
  - `referenceImages[0]` = pad 底图（物化 resource，JPEG 提交压缩）
  - `mask` = 物化 resource（maskSupported 时；dataURL 上传后 storageKey 引用）
  - `metadata = { edit: "outpaint", sourceNodeId, ... }`（进任务 input.metadata）
  - `config.model` = 所选模型（`CHANNEL_xxxxx::model` 编码，经 `backendProviderConfig` 解析为 channelId+model+baseUrl+apiKey）
- Agent 链：`cloud_agent_media.go` prepare → `applyCloudAgentOutpaint`（服务端 pad+mask 合成与物化）→ 任务 operation=`image_outpaint`，metadata=`{nodeId, source:"cloud_agent"}`（**无 outpaint 标记**）。
- 重试链：`use-canvas-generation-retry.ts` 从节点 metadata 恢复 pad/mask（outpaintMaskStorageKey），重新提交任务。

### 执行链（后端）

```
POST /api/tasks → task_creation（admission / resolveTaskModelSelection / 内嵌媒体校验）
  → worker（task_worker.go processClaimedTask）
    → processTask → processCanvasGenerationTask（provider.go:346，input 解析/模板/路由）
      → runXxxImageTask（provider_image.go 等）→ 结果统一为 { mode:"image", images:[{dataUrl}] }
    → task_worker.go:256 persistGeneratedMediaResult（resource.go:525）
      → dataURL 解码 → storeResource 落资源 → 替换 URL/storageKey/宽高
    → 任务终态
```

- 结果图统一 dataURL 形式（各协议已在 provider 层归一）；**贴回挂点 = `persistGeneratedMediaResult` 之前**（worker 层，一处覆盖工具链 + Agent 链 + 重试链）。
- 上轮合并修缮触碰点（勿踩）：`canvas-node-content.tsx` L884 尺寸偏差角标 / `cloud_agent_media.go` CallHash @L637 / `image-batch-retry` producedModel 链 / `getResourceAccess` 资源访问契约。

### 几何真源（前端合成函数）

- `buildOutpaintSubmitVariants` / `padImageToDataUrl`（web/src/lib/canvas/canvas-image-data.ts）：
  - target 模式（锁定档位）：两轴 k（kx/ky 分别解，吸收框-档比例差）；原图区 = `(round(left·kx), round(top·ky))`，尺寸 `(imageW·kx, imageH·ky)`。
  - free 模式：单一 scale = min(1, maxLongEdge / max(fullW, fullH))；原图区 = `(left·scale, top·scale)`。
  - 实测（三单）：提交画布 1536×1024，原图区 (90,85)-(1445,938) = 1356×854（kx 0.883 / ky 0.834）。
- mask（maskSupported 通道）= 同几何合成（透明=生成区）；**mask 不透明区 bbox ≡ 原图区**（三单实证）。

## 2. 贴回方案

### 2.1 数据契约扩展（前端 → 任务 metadata）

工具链提交时在 `metadata.outpaint` 写入：

```jsonc
{
  "edit": "outpaint",
  "outpaint": {
    "sourceStorageKey": "resource:<原图>",   // 原图像素源（必须是本用户已物化资源）
    "rect": { "x0": 0.0586, "y0": 0.0830, "x1": 0.9414, "y1": 0.9160 },  // 原图区在提交画布中的归一化矩形
    "frame": { "width": 1536, "height": 1024 }   // 提交画布尺寸（失真判断基准；裁决②a）
  }
}
```

- `rect` 由合成函数同源算出（提交画布为基准，0–1），是几何的**唯一真源**；后端不做二套公式。
- `frame` = 提交画布（合成画布）像素尺寸，供后端做纵横比失真判断（`delta > 0.08` → 跳过贴回）。
- `hardBlend` 可选字段：缺省 = true（开启，被测事实）；`false` 时跳过（仅 metadata 直写，不进任何 UI/schema）。
- Agent 链：`applyCloudAgentOutpaint` 侧按其 padding/scale 同源算出并写入任务 metadata（服务端自己有几何）。
- 重试链：重试提交同样带 `metadata.outpaint`（从节点持久字段恢复原图 storageKey；rect 由重试路径的同源合成参数重算或持久化）。

### 2.2 后端处理（新增 `task_outpaint_hardblend.go`）

```
worker: err == nil && isOutpaintTask(task) && hardBlendEnabled(input):
    result = s.hardBlendOutpaintResult(task, input, result)   // 失败时降级＝原样返回（记录日志），不阻断任务
    ↓ 然后才 persistGeneratedMediaResult
```

算法（Go，`image` / `golang.org/x/image/draw`，与 cloud_agent_media_outpaint.go 同栈）：

1. 解析 `metadata.outpaint`：`sourceStorageKey`（`OpenResource(userID)` 读取+校验归属）、`rect`（校验 0≤x0<x1≤1 等）。
2. 解码原图（`image.Decode` + `DecodeConfig` 像素上限预检，防解压炸弹——复用 Agent 合成先例：40MP 上限）。
3. 对 `result["images"]` 每项：
   a. 解码结果图（dataURL）。
   b. 原图区 px = `rect × (W,H)`（round，边界钳制）。
   c. 原图 resize 到该区域尺寸（`draw.CatmullRom`，等比映射至映射矩形——映射矩形本身承载上游改幅时的两轴差异）。
   d. 贴回：区域像素 ← 原图；边界 2px 过渡带做 alpha 线性混合（防接缝；非过渡带像素零改动）。
   e. PNG 编码 → 替换 `dataUrl`；宽高字段不变（保持结果图原尺寸）。
4. 返回修改后的 result。`skipInvalidDataURL`/配额等既有逻辑不变。

### 2.3 识别扩图任务

- 工具链：`metadata.edit == "outpaint"` 且 `metadata.outpaint` 有效。
- Agent 链：`task.Operation == "image_outpaint"` 且 `metadata.outpaint` 有效。
- 两者共用同一处理；metadata 不完整 → 跳过贴回（安全降级）。

## 3. 裁决落实（控制线 2026-09-27，全部批准）

### 3.1 共存策略：批准「默认开启 + metadata 关断 + 无 UI」

- 默认开启：扩图语义 = "生成区扩展、其余保持"；贴回是扩图本义实现，不设用户开关。
- **附加条款 a**：`hardBlend` **不进 Agent 工具 schema**（22 工具 union 预算不动，Agent 不可自行关断）；关断通道仅限 metadata 直写（`metadata.outpaint.hardBlend === false`，调试/运维后门）。
- **附加条款 b**：metadata 缺省 `hardBlend` 字段 = **开启**；默认路径须有测试钉死（默认开启是被测事实）。

### 3.2 归一策略：批准「贴回不改结果图尺寸，rect 直接映射结果坐标系」

- 「强制归一到提交画幅」否决（拉伸内容 + 吞角标语义）。
- **附加条款 a（偏差单行为，阈值定死）**：
  - 结果尺寸 = 提交画幅 → rect 直接映射；
  - 等比偏差 → rect 等比映射进结果坐标系（贴回照做，角标照常亮，二者不冲突）；
  - **纵横比失真率** `delta = |log((W_r/H_r) / (W_s/H_s))|`（log 域，与前端角标 0.02 同量纲）；**`delta > 0.08` → 放弃贴回 + 日志记录**（该单角标本来就会亮；不用拉伸贴图制造新缺陷）。
- **附加条款 b**：过渡带宽度随映射因子缩放——提交画布坐标系 2px 换算至结果坐标系：`fX = 2 × (W_r / frame.w)`、`fY = 2 × (H_r / frame.h)`（防偏差单硬接缝）。

### 3.3 边界条款

- 无 rect 的存量/在途任务：跳过贴回 + 日志记录（几何真源缺失，mask 不可靠），不报错不阻塞。
- 重试链：复用原任务 metadata → rect 在 → 贴回必须在（重试不得丢贴回）。
- billing 链零改动（贴回是生成后像素处理，无新增模型调用）。

## 4. 验收与证据设计（阈值定死，2026-09-27 裁决口径）

1. **头条指标**：同一探针同一画幅复跑 **3 单**，mask 区被改像素占比 **~75% → <2%**。
   - 口径：mask 区四边内缩 4px（=2×过渡带，排除边界）后，`diff(结果图, resize(原图→原图区)) > 24` 的像素占比；对照 before 锚 76.2/74.6/75.9%。
2. **扩展区反向判据**：扩展区（mask 透明区条带）vs 提交 pad 底图同区域，`diff > 24` 占比 **> 30%**（证明模型生成内容在、rect 映射未过界），同时目视复核为合理场景内容。
3. **尺寸**：结果图尺寸**逐字节 = 模型返回原尺寸**（贴回永不 resize 画布）。
4. **偏差单**：mock 结果尺寸的单测证明「角标亮 + 等比贴回」同时成立（前端角标逻辑不变 + 后端 delta ≤ 0.08 时贴回）。
5. **三链覆盖**：工具链 / Agent 链 metadata 均带 rect 端到端，重试链不丢贴回。
6. **门禁**：focused 52 基线保持 0 fail + 新增测试全绿 + tsc/build 双绿。

- 主体漂移归零 = 判据 1 的主述；纹理连续性 = 判据 2 + 目视（对照修复前 run2 暗角案例）。
- 双通道：maskSupported 模型（ddcat/gpt-image-2）实跑 + 指令通道样本（环境可用时；不可用记录测试缺口）。
- 门：go full suite（`-timeout 30m`）/ web focused / 扩图链 focused / 真机前后同图对照。

## 5. 实施分解（裁决后开工）

1. 前端：`buildOutpaintSubmitVariants` 增算 `rect` + `executeOutpaintImageNode` 写 `metadata.outpaint`（含原图物化复用）+ 重试链同步。
2. Agent 链：`applyCloudAgentOutpaint` 写任务 metadata 的 `outpaint` 块。
3. 后端：`task_outpaint_hardblend.go`（识别/读取/贴回/降级）+ worker 插入步骤 + 单测（几何映射/边界/降级路径；Go 侧可测 image 合成，无需浏览器）。
4. 门与证据：全量测试 + 真机对照（≥2 单修复后证据 + 修复前基线对照）。

## 6. 风险

- 上游改幅大时 rect 映射的近似性（不可约；角标仍明示）。
- maskSupported=false 指令通道的原图区依赖 rect 而非 mask——rect 精度由前端合成同源保证。
- 大面积结果图（>40MP）解码内存——沿用上限预检与降级。
- 重试/历史节点无 outpaint 块 → 跳过贴回（行为与修复前一致，不劣化）。
