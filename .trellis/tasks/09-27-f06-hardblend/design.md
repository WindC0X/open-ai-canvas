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
    "rect": { "x0": 0.0586, "y0": 0.0830, "x1": 0.9414, "y1": 0.9160 }  // 原图区在提交画布中的归一化矩形
  }
}
```

- `rect` 由合成函数同源算出（提交画布为基准，0–1），是几何的**唯一真源**；后端不做二套公式。
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

## 3. ⚖️ 待裁决点

### 3.1 共存策略（任务书指定：先给建议）

**建议：默认开启 + metadata 级关断通道，不做 UI。**

- 默认开启：扩图语义 = "生成区由模型扩展、其余保持"，贴回即该语义的实现；F-06.md / MASTER-PLAN 均定为"双通道通用必做步"。
- 关断通道：`metadata.outpaint.hardBlend === false` 时跳过（给未来渠道/场景级配置留口，不引入现在的前端 UI）。
- 不做 UI/设置项：R4 纪律（前端无新 UI）。

### 3.2 归一策略（附带报备）

**建议：贴回不改变结果图尺寸——rect 映射到结果图坐标系贴回。**

- 理由：占位尺寸合同 + 尺寸偏差角标（已验收行为）保持不变；上游改幅仍由角标明示；贴回职责单一（非生成区保真）。
- 备选：强制归一到提交画幅（上游改幅时拉伸对齐）——会改变既有已验收行为（角标不再触发/内容被非等比拉伸），不建议。
- 上游改幅场景下：rect×结果尺寸 的映射矩形吸收两轴差异，非生成区内容=原图（可能非等比映射），生成区保留上游几何。

## 4. 验收与证据设计

- **非生成区像素级不变**：修复后同图同参复跑 ≥2 单，`Diff(结果图原图区, 原图按 rect 映射)`：过渡带外要求像素级一致（diff=0 / 或 8-bit 舍入内 ≤1）；对照修复前基线（~75% 显著差异）。
- **主体漂移归零**：同口径关键点对位（上述 diff 即主判据）。
- **纹理连续性**：生成区目视对照（修复前 run2 暗角案例留档）。
- **双通道**：maskSupported 模型（ddcat/gpt-image-2）+ 一个指令通道样本（如 grok 或 seedream 类，如环境可用；不可用则记录测试缺口）。
- **门**：go full suite（-timeout 30m）/ web focused / 扩图链 focused / 真机前后同图对照。

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
