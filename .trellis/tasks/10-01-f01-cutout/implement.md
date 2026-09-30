# Implement · F-01 智能抠图/白底图

> 执行计划。需求见 `prd.md`，设计见 `design.md`。**含开工 spike 的实测结果与偏差上报项。**

## 0. 开工 spike 结果（2026-10-01，已完成）

### 0.1 技术可行性 ✅

| 项 | 实测 |
|---|---|
| transformers.js 支持 BiRefNet | ✅ 支持（ONNX 权重 + `birefnet`/`swin` 架构路径） |
| 任务书点名模型 `studioludens/birefnet-lite-512` | ✅ 存在，专为浏览器优化（512×512，解 1024 变体 OOM） |
| 许可 | ✅ **MIT**（`license: mit`，base_model `ZhengPeng7/BiRefNet_lite` 亦 MIT） |
| HF 可达性（本机） | ✅ 可达（302 重定向确认文件存在） |
| 生产验证 | ✅ Repper（repper.app）用于前景提取的 matte refinement |

### 0.2 实测偏差（**已由控制线裁定，见 §3**）

| # | 任务书/spec 假设 | 实测 | 裁定 |
|---|---|---|---|
| **D-1** | 权重「约 50MB」 | **fp16 = 93.9MB / fp32 = 183.0MB** | ✅ Q-1：接受 94MB，文案改实测值 |
| **D-2** | 「WebGPU fp16 / WASM **q8** 双 dtype 回落」 | **无 INT8/q8 变体**；只有 fp32 + fp16。README 明示「No INT8 quantization yet」 | ✅ Q-2：回落 = fp16 WASM（单一文件双档） |
| **D-3** | 512 输入「质量与高配机无差别」 | README 明示「**512×512 input limits edge detail on large images**」 | ✅ Q-4：缩 512 推理 → alpha 上采样 → 原分辨率合成 |
| **D-4** | COOP/COEP 解锁多线程提速 2-4 倍 | 未实测（待实现后验证） | 保持任务书口径 |

### 0.2b COEP 审计发现（已由控制线裁定 Xbot 路径 a）

全站外链资源审计：**仅 1 处**

```
web/src/lib/canvas/director/director-scene.ts:6
DIRECTOR_DEFAULT_ACTOR_URL = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r185/examples/models/gltf/Xbot.glb"
```

- jsDelivr 不返回 CORP 头 → COEP `require-corp` 下被拦截
- 且本身违反「严禁 jsDelivr 直连」原则（国内不可达）
- **控制线判定**：红线 ② 命中；自托管不算扩域（COOP/COEP 完成的最小必要件）；**用户拍板路径 a：换 CC0 人形模型**
- **选型结果**：`RobotExpressive.glb`（three.js 内，README 明示 CC0 1.0，453KB，43 skin joints）
- **附带必要件**：骨骼别名表需扩展 Blender 点号风格（实测：现有命中 15/核心 2 → 扩展后 27/核心 13）

### 0.3 模型规格（manifest 用）

```
id: birefnet-lite-512
task: image-segmentation (background-removal)
library: transformers.js 4.3.0 (Apache-2.0)
model_type: swin (config.json)
preprocessor: ViTFeatureExtractor, 512×512, ImageNet norm (mean .485/.456/.406, std .229/.224/.225), rescale 1/255
input: NCHW tensor named "input_image"
output: single-channel logits 512×512 → sigmoid → alpha matte → bilinear resize to original
files:
  config.json               81 B
  preprocessor_config.json  389 B
  onnx/model_fp16.onnx      98484532 B   (default per transformers.js_config.dtype=fp16)
  onnx/model.onnx           191877254 B  (fp32 fallback)
```

## 1. 实施顺序

> **控制线裁定已落定（2026-10-01）**：Q-1 接受 94MB / Q-2 fp16 单档双服务 / Q-3 `web/public/models/` + fetch 脚本 / Q-4 缩 512 推理 + alpha 上采样 / Q-5 Xbot 路径 a（换 RobotExpressive + 自托管）。

### 阶段 A：权重自托管（前置，任务书「步骤 0」）

1. 下载 4 个文件到 `web/public/models/birefnet-lite-512/`（目录结构照 HF 原样：`onnx/` 子目录）。
   - 只需 `onnx/model_fp16.onnx`（93.9MB，Q-2 裁定单档）
   - fp32 `model.onnx`（183MB）**不下载**
2. 写 `scripts/fetch-cutout-models.sh`：下载 + sha256 校验 + 源 URL 可配（默认官方源，文档化镜像备选）。
3. 计算 sha256，写 `models-manifest.json`（含 `schemaVersion` 为 INT8 后续档留位）。
4. `.gitignore` 排除权重二进制（只提交 manifest + config + 脚本）。
5. Docker 构建 `RUN` 该脚本（构建期依赖，部署者可配代理）。

**验收**：`bash scripts/fetch-cutout-models.sh` 幂等可重跑；sha256 校验通过。

### 阶段 B：worker + runtime

1. `web/src/workers/background-removal.worker.ts`（照 `canvas-face-detector.worker.ts` 同构）。
2. `web/src/services/cutout-runtime.ts`（照 `canvas-face-detection.ts` 同构）。
3. 依赖：`bun add @huggingface/transformers@4.3.0`（精确版本，Apache-2.0）。
4. worker 内 `env.allowRemoteModels=false` + `env.localModelPath="/models/"`。
5. dtype 回落：`navigator.gpu?.requestAdapter()` → webgpu，否则 wasm；**两者都用 `model_fp16.onnx`**（Q-2）。
6. `crossOriginIsolated === false` → `numThreads = 1`。
7. **Q-4 实现**：原图长边 >512 → 缩到 512 推理 → alpha 上采样回原分辨率 → 与原图合成。

**验收**：单测（进度状态机、dtype 判定）+ 手动 spike（真实推理一张图）。

### 阶段 C：节点接线

1. `media-conversion-node.tsx:155` 守卫条件加 `cutout`。
2. 执行链 `:171-177` 加 cutout 分支 → `runBrowserCutout`。
3. 进度 → `setNotice()`（D2 决策：不改 schema）。
4. `contracts.ts:43` 描述文案更新（**Q-1：体积写实测 90MB**）。

**验收**：focused guards（media-conversion 既有测试）。

### 阶段 D：白底合成

1. `web/src/lib/media-conversion/cutout-white-background.ts`：`planWhiteBackground` 纯函数 + 绘制函数。
2. 导出路径：透明 PNG → 白底 1:1（复用 `ECOM_CHANNEL_PRESETS.amazon-main` 的 1600px 下限）→ blob → `setImageBlob`。

**验收**：几何单测（补边/裁切 clamp）。

### 阶段 E：COOP/COEP + 默认角色替换

1. `vite.config.ts` server.headers 加 COOP/COEP。
2. `nginx.conf` server 块加 COOP/COEP + `/models/` 缓存策略。
3. **默认角色替换（Xbot 路径 a）**：
   - 下载 `RobotExpressive.glb`（453KB，CC0）到 `web/public/models/`（**小文件入 git**，与 94MB 权重不同待遇）。
   - `director-scene.ts:6` 改为自托管路径，清掉 jsDelivr URL 与注释。
   - **骨骼别名表扩展**（`director-viewport-rig.ts:88-136`）：追加 Blender 点号风格模式（`upperarml`/`lowerarml`/`upperlegl`/`lowerlegl`/`shoulderl`/`shoulderr`/`footl`/`footr`），注意 `lowerlegl` 优先级高于宽松 `legl`。
   - `director-scene.ts:269` 注释「Soldier」改为新模型。
   - 真机核 21 种姿态（轴向可能失配）。

**验收**：dev 环境 `crossOriginIsolated === true`；导演台 3D 视图渲染新角色 + 姿态切换正常；全站核心页回归。

## 2. 门禁（任务书 §五）

1. `cd web && bun test`（**目录敏感**）
2. `tsc --noEmit` / `eslint` / `build`
3. 新增单测：进度状态机 / dtype 回落判定 / sha256 校验 / 白底合成几何
4. focused guards：media-conversion + image-size-presets
5. 真机自验（用户）：首次三段进度 → 二次离线 → 白底 Amazon 1:1
6. COOP/COEP 全站核心页回归

## 3. 待决项（**已全部裁定**）

| # | 事项 | 裁定 |
|---|---|---|
| Q-1 | 权重体积偏差 | ✅ 接受 94MB；文案改实测值；INT8 登记后续档 |
| Q-2 | 回落档定义 | ✅ fp16 WASM（单一权重文件双档服务）|
| Q-3 | 权重部署方式 | ✅ `web/public/models/`（gitignore）+ `scripts/fetch-cutout-models.sh` + Docker 构建 RUN |
| Q-4 | 512 输入质量策略 | ✅ 缩 512 推理 → alpha 上采样 → 原分辨率合成 |
| Q-5 | Xbot 外链处置 | ✅ 路径 a：换 RobotExpressive（CC0）+ 自托管 + 别名表扩展 |

## 4. 红线自检

- ✅ 咽喉三文件零触碰（grep `cutout` = 0）
- ✅ globals.css 零改动
- ✅ 后端零改动
- ✅ 权重 MIT（三重证据：HF API / 上游 GitHub LICENSE / 上游 HF 卡）
- ✅ transformers.js Apache-2.0（npm view 实测）
- ✅ 新模型 RobotExpressive **CC0 1.0**（three.js 仓内 README 明示）
- ✅ 无 HF 直连 / 无 jsDelivr 直连（两者均自托管）
- ⚠ COOP/COEP 全站影响面 → 审计确认仅 1 处外链，随本枝解决

## 5. 回滚点

| 阶段 | 回滚方式 |
|---|---|
| A（权重） | 删目录 + manifest + 脚本，无代码依赖 |
| B（worker/runtime） | 删两文件 + 依赖 |
| C（节点接线） | revert `:155` 守卫与执行链分支 |
| D（白底） | 删文件，无外部依赖 |
| E（COOP/COEP + 角色） | revert 两个配置文件的 header 行 + `director-scene.ts:6` 一行 URL + 别名表追加（**唯一有全站影响的阶段，单独 commit**）|

## 6. 模型留档（控制线细则 4）

### BiRefNet 权重

| 项 | 值 |
|---|---|
| 来源 | `https://huggingface.co/studioludens/birefnet-lite-512` |
| 上游 | `https://github.com/ZhengPeng7/BiRefNet`（MIT，Copyright (c) 2024 ZhengPeng）|
| 许可 | **MIT**（三重证据：HF API `license: mit` / 上游 GitHub LICENSE / 上游 HF 卡 `license: mit`）|
| 文件 | `onnx/model_fp16.onnx` 98484532 B |
| sha256 | 落盘后回填任务卡 Notes |

### 默认角色模型

| 项 | 值 |
|---|---|
| 来源 | `https://github.com/mrdoob/three.js/blob/r185/examples/models/gltf/RobotExpressive/RobotExpressive.glb` |
| 许可 | **CC0 1.0**（同目录 README.md 原文：「Model by Tomás Laulhé (quaternius). ... CC0 1.0.」）|
| 体积 | 453.1 KB |
| 骨架 | 43 skin joints |
| sha256 | 落盘后回填任务卡 Notes |

## 7. 控制线追加裁定 · 入口整合（2026-10-01，用户拍板选项 A）

**问题**（用户真机抽验）：工具栏「去除背景」走上游原生生成式重画（扣积分），
本枝的浏览器 WASM 本地抠图挂在 media-conversion 的 cutout 桩——两条链并存，
最直觉点的入口不走本地推理，违背三级路由形态。

**裁定**：入口整合（本枝内完成）。**咽喉文件授权例外**：`canvas-image-toolbar-tools.tsx`
（该文件本职就是工具定义与 handlers），改动限「去除背景」一项。

**实现**：

| 项 | 做法 |
|---|---|
| 默认档 | `removeBackground` 工具项的 `label`/`description`/`run` 改为 node-aware；普通图片 → `onRemoveBackgroundLocal`（本地 WASM，不弹对话框）|
| 精修档 | `metadata.backgroundRemoval.mode === "local"` 的结果节点 → `onRemoveBackgroundGenerative`（既有 image-edit 对话框，preset=remove-background）|
| 执行链 | `removeBackgroundLocally`：`resolveCroppableImageSource`（同源化避 CORS）→ `runBrowserCutout` → `uploadImage` → 子节点落画布 + 连线 + 选中（裁剪/标注同范式）；`localCutoutInFlightRef` 重入守卫 |
| 文案 | 本地「本地识别，免费离线，逐像素保真」；生成式「AI 模型重画，适合复杂边缘，消耗积分」；均不承诺发丝级 |
| 访客态 | `shared.tsx` 三档全部 `unauthorized`，整合不放行 |
| 类型 | `CanvasNodeMetadata.backgroundRemoval?: { mode: "local" \| "generative" }` |
| PATCH-MAP | J 系列 4 条登记 |

**配套修正**：`ImageToolDefinition.description` 类型放宽为 `string | ((node) => string)`，
并在 `buildImageToolbarTools` 里用 `resolveToolText` 解析（原先直接透传，函数会被当字符串渲染）。

**门禁复跑**：tsc 0 / eslint 0 / build 0 / web 全量 2482 pass 0 fail 323 files /
focused guards 66 pass 0 fail 8 files。

**真机验证**：浏览器内实测工具项分档正确（普通图片 → 「去除背景」本地档；
抠图结果 → 「用 AI 模型重新去除」生成式档），工具项总数一致；
本地抠图 → 白底导出端到端跑通（输出多次运行字节一致）。

**未解释项**：本地推理墙钟时间在 drvfs/WSL 上波动极大（19.8s / 139.4s / 457.7s / 571.6s），
但输出字节完全一致（6357B，透明 87.6% / 主体 11.7%）。判定为环境特性（同 drvfs Pi 导入
65907ms vs ext4 729ms 的既有教训），非代码缺陷；**未做性能验收**。
