# PRD · F-01 智能抠图/白底图一键生成

> 来源：控制线任务书 `docs/artifacts/f01-cutout-task-book.md`（2026-09-30）+ spec of record
> `/mnt/f/CODE/Project/canvas/analysis-2026-09-12/ecom-design/impl/F-01.md`（路线三，2026-09-12 修订版）。
> 控制线开工令：2026-10-01，B线 Wave2 首枝。

## 1. 背景与目标

电商平台（淘宝/Amazon 等）强制要求白底主图，抠图/白底是商家上架第一步。影策 B 侧 cutout 桩
已就位（`MEDIA_CONVERSION_OPERATION_LABELS.cutout = "透明抠图"`）但落入 `model_missing` 通用桩，
未实现。本枝点亮该桩，交付**零安装、零边际成本、源图不出浏览器**的抠图能力。

Flora 需求验证：Background Remover = 112 技法运行量第一（52,399 runs，cost=2 ≈ 免费引流件）——
抠图是电商最重刚需，F-01 优先级无误。

## 2. 范围

### 本枝做

1. **浏览器 WASM 抠图基线**：BiRefNet-lite-512 自托管权重 + WebGPU fp16 / WASM q8 双 dtype 回落。
2. **白底合成导出**：透明 PNG → Canvas 合成纯白 RGB + 1:1 补边/裁切（复用 `ECOM_CHANNEL_PRESETS`
   的 `amazon-main`，1:1 / ≥1600px）。
3. **COOP/COEP 响应头**：解锁 SharedArrayBuffer → WASM 多线程。
4. **模型权重自托管分发**：对象存储/静态资源 + `models-manifest.json` + sha256 校验。

### 本枝不做（只留 capability 钩子，不实现）

- 云端精修档（remove.bg / Bria API 插件通道）
- agent 加速档（canvas-agent matting 模块）
- 批量抠图（F-12 云端队列）
- SAM2 / MediaPipe 交互修正（二期）

## 3. 硬约束（违反即 STOP）

| # | 约束 |
|---|---|
| C1 | **修-9 三级路由**：本地 AI 能力按「浏览器 WASM 基线 → agent 可选加速 → 云端付费精修」设计。本枝实现基线档，上两档只留路由位与 capability 声明。 |
| C2 | **权重自托管**：对象存储 + 版本清单 JSON + sha256；`env.allowRemoteModels=false` + `localModelPath` 指向自有 CDN。**严禁 HF Hub / jsDelivr 直连**。 |
| C3 | **许可**：只用 MIT 的 BiRefNet 官方权重。**严禁 RMBG-2.0**（CC-BY-NC 4.0）；transformers.js 依赖选型照 dramaclaw AGPL 教训核查。 |
| C4 | **咽喉纪律**：`use-canvas-media-tools.ts` / `canvas-image-toolbar-tools.tsx` / `routes.go` 零触碰。 |
| C5 | **PATCH-MAP**：globals.css 零改动预期。COOP/COEP 改 `nginx.conf` + `vite.config.ts` 属配置面，登记任务卡 Notes 即可。 |
| C6 | **文案红线**：上线文案不承诺「发丝级」（透明/高反光为已知弱项，云端精修档承接）。 |

## 4. 用户可见行为

1. 用户在画布放 media-conversion 节点，operation 选「透明抠图」，连接一张图片，点执行。
2. **首次使用**：三段进度（正在下载模型 → 正在识别主体 → 正在生成透明 PNG），约 50MB 模型下载；
   文案说明「首次下载后会缓存，不消耗 API 积分，也不会上传原图」。
3. **二次使用**：模型已缓存，离线可用，无下载阶段。
4. 完成后节点产出透明 PNG；用户可触发**白底合成导出**得到 1:1 白底图（Amazon 主图规范）。
5. 失败路径：worker 崩溃 / 模型下载失败 / 图片不可读 → 明确错误码与文案，不静默失败。

## 5. 验收标准

### 门禁（house style，任务书 §五）

1. `web/` 目录内 `bun test` 全量绿（**必须在 web/ 内跑**，仓根跑静默丢 24 条）。
2. `tsc --noEmit` / `eslint` / `build` 全绿。
3. **新增单测（纯逻辑零 DOM）**：
   - 进度状态机（三段映射）
   - dtype 回落判定（WebGPU 探测 → fp16 / q8）
   - 权重清单 sha256 校验
   - 白底合成几何（补边/裁切 clamp）
4. focused guards：media-conversion 既有测试 + `image-size-presets` 相关。
5. 真机自验：首次下载三段进度 → 二次离线可用 → 白底导出 Amazon 1:1 规范。
6. COOP/COEP 上线后全站回归核心页（第三方资源被 COEP 拦截的风险面）。

### 交付物

- 拓扑链
- 文件清单实录（新增/修改逐条，含锚点实核）
- 门禁原始输出截段
- 未解释项清单
- **真机截图一张**（导演台 3D 视图，新默认角色）
- **模型留档**：来源 URL + 许可声明截证 + 文件 sha256（进任务卡 Notes）
- 单 commit 不 push

## 6. 决策记录

### 2026-10-01 开工 spike 阶段（用户确认）

| 决策点 | 选定 |
|---|---|
| 权重来源 | HF 下载后转存自有 CDN（本地转换 + 上传） |
| 分发落点 | 静态资源 + `models-manifest.json` |
| COOP/COEP | 本枝完整实现（nginx.conf + vite.config.ts + 第三方 CORP 审计） |

### 2026-10-01 控制线裁定（Q-1~Q-5）

| # | 裁定 |
|---|---|
| **Q-1** | 接受实测 **94MB**（非任务书假设的 50MB）；文案改实测值 + 三段进度条；INT8 减重登记后续优化档（manifest 版本字段预留） |
| **Q-2** | 回落档 = **fp16 WASM**（无 q8/INT8 变体）；单一权重文件同时服务 WebGPU 档与 WASM 回落档（一个 manifest 条目 / 一个 sha256） |
| **Q-3** | 权重落 `web/public/models/`（gitignore，不入 git）+ `scripts/fetch-cutout-models.sh`（下载+sha256 校验，源 URL 可配）；Docker 构建 RUN 该脚本；运行期永远同源 |
| **Q-4** | 缩 512 推理 → alpha 上采样 → **与原图合成，输出保持原分辨率**（remove.bg 类管线标准做法） |
| **Q-5** | **Xbot 路径 = (a) 换 CC0 人形模型**（用户拍板）—— 选型 `RobotExpressive.glb`（three.js 内，README 明示 CC0 1.0，453KB，43 skin joints，14 动画） |

**红线 ② 判定**：控制线确认「自托管 Xbot 不算扩域——它是 COOP/COEP 完成的最小必要件（全站唯一外链）」，任务卡 Notes 登记。

## 7. 已知风险

1. **透明/高反光材质边缘**：BiRefNet 二值分割范式偏弱 → 云端精修档承接；文案不承诺「发丝级」。
2. **低配机性能**：无 COOP/COEP 时 onnxruntime-web 单线程 → i5-9400 约 10-30s/张；COOP/COEP 后 3-8s。
3. **模型分发国内可达性**：必须自托管（本枝核心前置）。
4. **WebGPU 兼容性**：老驱动黑名单边缘，探测失败回落 **fp16 WASM**。
5. **首次下载体验**：**实测 94MB**（非预估 50MB）必须有全程进度条 + 诚实文案。
6. **COOP/COEP 回归面**：第三方子资源需补 CORP；**已审计：全站仅 1 处外链**（导演台默认模型），随本枝自托管解决。
7. **512 输入质量限制**：模型卡明示「512×512 input limits edge detail on large images」；本枝按 Q-4 裁定（缩 512 推理 → alpha 上采样 → 原分辨率合成）承接主体保真，边缘细节受模型限制。
8. **默认角色替换后姿态轴向**：`directorPoseBoneDeltas` 的旋转参数原按 Mixamo 轴向调校；RobotExpressive 轴向不同，需真机核 21 种姿态。
9. **骨骼别名表扩展**：需追加 Blender 点号风格模式（实测：现有命中 15/核心 2 → 扩展后 27/核心 13）；`leftHand`/`rightHand` 存在已知缺口（GLB 中为独立根节点）。

## 8. 红线（STOP 条件）

- 咽喉文件（C4 三文件）必须触碰时
- COOP/COEP 第三方子资源无法补 CORP
- 模型分发国内不可达
- 权重非 MIT
