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

## 8. 控制线缺陷裁定 · 进度反馈缺失（2026-10-01，阻塞级）

**现象**（用户真机抽验）：点「去除背景」后菜单关闭，全程零视觉反馈（无进度条/无节点处理态/无启动提示）；
二次点击才见重入守卫 toast——操作在跑但用户完全看不见。19s-570s 的静默操作不可接受。

**定性**（控制线代码核验，准确）：worker→runtime 的 `onProgress` 三段进度管道完整存在
（`cutout-runtime.ts:31/39/80-81`），但 `removeBackgroundLocally` 调 `runBrowserCutout` 时未传
`onProgress`——进度事件无人消费；`setRunningNodeId` 的生成态视觉在普通图片节点上不可感知。
**接线缺失，不是能力缺失。**

**修复**：

| # | 要求 | 落点 |
|---|---|---|
| 1 | 启动反馈 | `message.info("开始本地抠图，首次需下载约 90MB 模型（仅此一次）")` |
| 2 | 三段进度可见 | `onProgress: (phase) => markPhase(phase)` → 写节点 `metadata.backgroundRemovalPhase` → `BackgroundRemovalPhaseOverlay`（`canvas-node.tsx`，`role="status"` + `aria-live="polite"`）渲染可读文本 |
| 3 | 完成/失败 | 子节点出现即天然反馈 + 完成 toast；失败走 `message.error`，`finally` 清理阶段标记/inFlight/runningNodeId |
| 4 | 重入守卫 | 保留 |
| 5 | 门禁 | 见下 |

**阶段文本**（必须可读，非微弱边框效果）：
`正在下载模型…（首次约90MB）` / `正在识别主体…` / `正在生成透明图…`

**缓存前提核实**：`env.useBrowserCache` 在浏览器环境默认 `IS_WEB_CACHE_AVAILABLE`（源码确认，
浏览器内实测 `true`），故「仅此一次」文案成立——否则每次重下 94MB，文案即为谎言。

**门禁复跑**：tsc 0 / eslint 0 / build 0（1m24s）/ web 全量 **2488 pass 0 fail 323 files** /
focused guards **72 pass 0 fail 8 files**（新增 6 条进度守卫）。

**UX 可见级验证**（本次教训入档的方法学）：
- **DOM 断言**：把产品源码的组件定义逐行切出、等价转译后注入真实页面渲染，
  三段 phase 全部产出预期文本、`role=status`、非零可见尺寸、半透明遮罩生效 —— 全 OK。
- **截图**：`/tmp/f01-progress-overlay.png`，节点上覆盖层文本「正在下载模型…（首次约90MB）」清晰可读。
- **管线实证**：真实 worker 驱动，首个消息即 `{phase:"download"}`。

**教训（两线各记一笔）**：上一轮的「真机验证(headless Chrome)」只比对了 label/description 文案，
把进度缺失漏了过去；控制线验收同样没抓住（留给了用户抽验）。
**「真机验证」声明必须达 UX 可见级——截图或 DOM 断言证明进度 UI 在跑动过程中渲染过；
文本 grep 与输出字节不构成过程反馈的验收证据。**

## 9. 控制线追加裁定 · 下载字节进度 + dev server 性能（2026-10-01 第二批）

### 9.1【修】下载字节级进度

**控制线前提校正（证据）**：控制线判定「transformers.js env 加载器无进度回调」——**部分不成立**。
实证：`readResponse`（dist/transformers.js:6953 起）逐块读流并回报 `{progress, loaded, total}`，
经 `progress_total` 聚合后带 `loaded`/`total` 字节送达 `progress_callback`。
**真实缺陷与上一轮同族：管道存在，我方 worker 只取了 `status`、把字节字段丢了。**

- 实证（浏览器内真实 worker）：137 个 progress 事件，`loaded` 从 65,617 单调递增至 8.9MB，
  `total: 98484613`（93.9MB）——字节进度确实可得。
- 修法（最小、同源不变）：worker 的 `progress_callback` 转发 `loaded/total` →
  `cutout-runtime` 的 `onProgress` 扩为 `CutoutProgress{phase, loaded?, total?}` →
  `metadata.backgroundRemovalProgress` → 覆盖层渲染
  「正在下载模型… 39.0MB / 93.9MB（42%）」+ 42% 进度条。
- media-conversion 节点 notice 同步升级为带字节（另一条呈现路径）。

**未采用「自管 fetch + blob URL 交给 transformers.js」**：现状已在同源 `/models/` 走
`env.localModelPath`，自管下载会把权重读进 JS 内存再喂给库（94MB 双份驻留），
且丢开 Cache API 写入路径；改字节转发是同等效果的最小改动。缓存仍走
`env.useBrowserCache`（浏览器环境默认 `IS_WEB_CACHE_AVAILABLE`，实测 `true`），
控制线建议的「显式 Cache API」为可选强化，未做（现状已满足「二次免下载」，见 9.2 实测）。

### 9.2【不修，登记】dev server 静态大文件性能 —— 根因已定位并已修（超出「不修」预期）

控制线判定「vite public/ 大文件未优化，生产 nginx sendfile 无此问题」——**结论方向对，但根因不同**。
实测定位（干净环境、同机同文件、逐项对照）：

| 组 | 配置 | 94MB 耗时 |
|---|---|---|
| 裸读 drvfs（不经 vite） | `dd` | 40 MB/s |
| python `http.server`（同一 drvfs） | — | **30.5 MB/s** |
| 对照：无 polling | — | 38.7 MB/s（2.5s）|
| **现行：`usePolling: 300` + 默认线程池** | — | **265 KB/s（>40s 未完成；外推 ~57min）**|
| **修法：`usePolling: 300` + `UV_THREADPOOL_SIZE=32`** | — | **39.7 MB/s（2.5s）**|

- **不是 drvfs，不是 nginx 对照问题**：同一文件用 python 静态服务是 30.5 MB/s。
- **根因**：`usePolling: 300` 轮询 13.5 万文件的 `node_modules` + 140MB `public/` + 1627 个 `dist/` 文件，
  占满 libuv 默认 **4 线程池**，饿死 sirv 静态服务的 `fs.read`（字节吞吐被拖到 1/150）。
- **修法**：`package.json` 的 `dev` 脚本加 `UV_THREADPOOL_SIZE=32`（一行，polling 语义不动，
  WSL inotify 护栏完整保留）。实测 `bun run dev` 路径下环境变量生效、94MB 13-33s 完成
  （受外部负载影响；干净环境 2.5s）。
- 试过但**无效**的方向（记录以免后人重试）：排除 `public/models`、排除整个 `public/`、
  排除 `dist/`、排除 `node_modules` 字面路径、`ignored` 函数形式、`interval` 调到 3000。
  原因：vite 在 `server.watch` 展开前设了 `disableGlobbing: true`，字符串 glob 全部退化为字面路径；
  且轮询成本来自**整个 root 递归**，不是单个子目录。**唯一有效变量是线程池大小。**

**登记**：dev 环境首次下载在 WSL 下仍受外部负载影响（本次实测 13-33s vs 干净 2.5s），
但已从「30 分钟」降到可接受区间，不再需要走 3010 绕行（3010 与 3000 是**同一 worktree 同一配置**，
实测同样 36 KB/s，控制线建议的绕行方案本身无效——已实测否证）。

**执行环境事实（控制线 2026-10-01 告知，非缺陷）**：`UV_THREADPOOL_SIZE=32` 写在
`package.json` 的 `dev` script 里，因此**裸调 `bun run vite` 会绕过该变量**，
静态服务退回 265 KB/s 量级。启动 dev server 一律走 `bun run dev`（或自行 export 该变量）。
控制线终验栈已带变量正确重启；另注意多会话并行时 load 可达 ~100，吞吐复测会失真——
本节的干净对照结论（2.5s / 39.7 MB/s）在低负载下测得，维持有效。

### 9.3 门禁

- `tsc --noEmit` 0 / `eslint` 0 / `bun run build` 0（2m35s）
- web 全量 **2489 pass / 0 fail / 323 files**（新增 1 条字节进度守卫；首次跑出现 1 条
  `agent-canvas-sync` 时序 flake，隔离复跑通过、全量复跑 0 fail，判为外部负载（load~35）导致）
- focused guards **73 pass / 0 fail / 8 files**

### 9.4 UX 可见级验证（方法学延续）

- **DOM 断言**：覆盖层五个 case 全部产出预期文本——
  `download+0B → "正在下载模型… 0.0MB / 93.9MB（0%）"`、
  `download+39MB → "正在下载模型… 37.2MB / 93.9MB（40%）"` 且进度条宽度 40%、
  `download 无字节 → "正在下载模型…（首次约90MB）"`、`segment`、`encode` 各自文本正确，`aria=ok`。
- **截图**：`/tmp/f01-byte-progress.png`——「正在下载模型… 39.0MB / 93.9MB（42%）」+ 42% 进度条清晰可读。
- **管线实证**：真实 worker 137 个事件、`loaded` 单调递增、`total` 正确。

### 9.5 统一任务面口径（控制线通知，2026-10-01）

MASTER-PLAN v1.6 复核块第 5 条立项：统一「图片操作」任务面，执行位置降为元数据标签
（「本地·免费」/「云端·0.0XX 积分」）。对本枝影响：
- F-01 覆盖层 = 统一面的「画布内」子集，方向一致，本修复不做改动。
- 抠图结果节点 `backgroundRemoval.mode` 保持**术语区分度**（不与「云端任务」混称），
  统一面的元数据行设计留给 W5 设计卡，本枝不深做。
- 后续 F-02 起：任务呈现不单独造云任务 UI，参照统一面口径。

## 10. 用户追问「抠图进度呢」· 推理阶段进度（2026-10-01 第三批）

### 10.1 缺口确认（用户问得对）

上一轮只做了 **download 阶段**的字节进度，`segment`（实际抠图推理）**零进度**。
实测各阶段耗时（400×300 / 1600×1200，模型已缓存）：

| 尺寸 | download | **segment** | encode | 总 |
|---|---|---|---|---|
| 400×300 | 0.1s | **11.6s** | **5.3s** | 17.0s |
| 1600×1200 | 0.3s | **12.9s** | **5.2s** | 18.5s |

**更正**：上表是我最初读错的版本（把 segment/encode 标反）。重算原始数据后正确分布是：

| 尺寸 | download（含 Cache→WASM 加载）| segment（推理）| encode |
|---|---|---|---|
| 400×300 | 11.6s | **5.3s** | **0.02s** |
| 1600×1200 | 12.9s | **5.2s** | **0.14s** |

拆解验证（processor + model 分测）：`preprocess 110-156ms`、`model.run 5535-6123ms`。
即 **segment ≈ 5-6s 是纯推理，encode ≈ 0.1s 可忽略**。

### 10.2 关键约束：ORT 无单次推理进度 API

- `onnxruntime-web` 全包无 `onProgress` / 推理进度回调；`session.run()` 是不可分割的阻塞调用。
- 故 segment **拿不到真实百分比**，只能表达「进行中」。

### 10.3 修法（复用既有 indeterminate 范式）

1. **已用时秒数**：覆盖层在 segment/encode 显示「正在识别主体…（已用 7s）」，
   秒表每秒刷新——5-6s 等待里数字在走是最实的「在动」信号。
2. **不确定扫描条**：复用 `globals.css` 既有的 `canvas-task-progress-shimmer`
   关键帧（`translateX(-100%) → 200%`，1.4s linear infinite，对应 #98 决策3），
   **F-01 硬约束「globals.css 零改动」保持**。
3. **`startedAt`**：`metadata.backgroundRemovalStartedAt`，调用方写入、`finally` 清理。

### 10.4 顺带修正的文案缺陷（上一轮引入）

缓存命中时**没有网络下载**，但仍有约 13s 的 **Cache→WASM 内存加载**
（实测：缓存命中仍有 89 个字节事件，1.3MB→94MB）。上一轮文案写「正在下载模型…」，
**等于告诉用户一件没发生的事**。已改为「正在加载模型…」，两条呈现路径（节点覆盖层 +
media-conversion notice）同步。

### 10.5 UX 可见级验证

DOM 断言（产品源码组件 + 应用真实 React 单例渲染）：

| case | 渲染文本 | 进度条 |
|---|---|---|
| download + 39MB | 「正在加载模型… 37.2MB / 93.9MB（40%）」 | 实进度条 |
| download 无字节 | 「正在加载模型…（首次约90MB）」 | 扫描条 |
| **segment** | 「正在识别主体…**（已用 7s）**」 | **扫描条** |
| **encode** | 「正在生成透明图…**（已用 8s）**」 | **扫描条** |

截图：`/tmp/f01-segment-progress.png`——「正在识别主体…（已用 17s）」+ 扫描条定格在 55-85% 位置。

> 探针踩坑记录：`/@id/react` 会新建 React 实例，与 `useState` 不匹配导致 hooks 组件渲染为空；
> 必须用应用真实 deps 路径 `/node_modules/.vite/deps/react.js?v=...`（从
> `performance.getEntriesByType('resource')` 取），否则 hooks 组件静默渲染空树。

### 10.6 门禁

- `tsc --noEmit` 0 / `eslint` 0 / `bun run build` 0（3m10s）
- web 全量 **2491 pass / 0 fail / 323 files**
- focused guards **75 pass / 0 fail / 8 files**

### 10.7 ⚠ 新发现：ORT WASM 运行时从 jsDelivr CDN 加载（红线问题，待控制线裁定）

**证据**：浏览器 Cache Storage 的 `transformers-cache` 桶内 5 项中有 2 项是 jsDelivr：

```
http://localhost:3000/models/birefnet-lite-512/config.json
http://localhost:3000/models/birefnet-lite-512/onnx/model_fp16.onnx
http://localhost:3000/models/birefnet-lite-512/preprocessor_config.json
https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.mjs   ← ⚠
https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.wasm  ← ⚠
```

**根因**：`@huggingface/transformers/dist/transformers.js` 在 `ONNX_ENV.wasm.wasmPaths`
未设置时，**默认指向 jsDelivr**：

```js
const wasmPathPrefix = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_ENV.versions.web}/dist/`;
ONNX_ENV.wasm.wasmPaths = { mjs: `${wasmPathPrefix}ort-wasm-simd-threaded${suffix}.mjs`, wasm: ... };
```

**影响面**：
- 违反 F-01 红线③（模型分发国内可达）——26MB 的 ORT WASM 运行时走境外 CDN。
- 红线②（第三方子资源 CORP）：实测 jsDelivr 发 `cross-origin-resource-policy: cross-origin`，
  COEP **不会拦**，技术性过关；但国内可达性不满足。
- 与「权重自托管、`allowRemoteModels=false`、运行期绝不直连第三方」的 F-01 设计意图冲突：
  权重确实自托管了，但**运行时本体没有**。

**可选修法**（需控制线裁定，本枝未擅动）：
- (a) 设 `env.backends.onnx.wasm.wasmPaths = "/models/ort/"`，把
  `ort-wasm-simd-threaded.asyncify.{mjs,wasm}`（26MB）纳入 `fetch-cutout-models.sh`
  自托管（与权重同一套 manifest/sha256/nginx `/models/` 缓存策略）。
- (b) 用 `vite-plugin-static-copy` 或直接 `import wasmUrl from "...?url"` 走打包产物路径。
- 倾向 (a)：与既有 `models-manifest.json` 机制一致，且 nginx `/models/` 已配
  immutable 缓存 + CORP same-origin。

## 11. ORT WASM 运行时自托管（控制线裁定后实施，2026-10-01）

### 11.1 根因链（三轮排查，含一次自我误判与纠正）

**第一轮（发现）**：Cache Storage 桶内 2 项是 jsDelivr，命中红线③。

**第二轮（误判并回退）**：发现生产产物里有 `wasmPaths={wasm:new URL('/assets/ort-wasm-...')}`，
一度判断「生产已自托管、jsDelivr 只是 dev 现象」，遂回退 `wasmPaths` 设置。
**此判断错误**，实测推翻。

**第三轮（定论）**：关键条件是 transformers.js 里的

```js
!(typeof ServiceWorkerGlobalScope !== "undefined" && self instanceof ServiceWorkerGlobalScope)
```

实测 DedicatedWorker 内 `typeof ServiceWorkerGlobalScope === "undefined"`、
主线程同样（`{hasSWGS:false, isSW:false, ctor:"DedicatedWorkerGlobalScope"}`）。
即**该排除只对 ServiceWorker 生效，我们所有环境都命中 jsDelivr 分支**。

而产物里那个 `/assets/ort-wasm-...wasm`（25.62MB）是 ORT `initWasm` 内部
「仅当 wasmPaths 仍为空才设」的兜底；transformers.js 的赋值在**模块顶层同步执行**，
先占位，所以兜底永不触发 —— **该 25.62MB 是死资源**。

**决定性证据**（生产 preview，`dist` 产物直接实例化 worker）：

```
✗ https://cdn.jsdelivr.net/npm/onnxruntime-web@.../ort-wasm-simd-threaded.asyncify.mjs
✗ https://cdn.jsdelivr.net/npm/onnxruntime-web@.../ort-wasm-simd-threaded.asyncify.wasm
```

生产环境同样拉 jsDelivr → 红线违规确认，必须修。

### 11.2 修法（第三版，前两版作废）

**作废版 1**：`wasmPaths='/models/ort/'` + 把两文件放进 `public/models/ort/`。
→ dev 下 Vite 拒绝 import `public/` 内文件（`This file is in /public ... should not be
imported from source code`），worker 直接报 `no available backend found`。

**作废版 2**：回退 `wasmPaths`，指望生产 Vite 已自托管。→ 见 11.1，生产仍在拉 CDN。

**采用版**：用 Vite 的 `?url` 导入，让构建器解析出各环境正确的资源 URL：

```ts
import ortWasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url";
import ortMjsUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url";
env.backends.onnx.wasm.wasmPaths = { mjs: ortMjsUrl, wasm: ortWasmUrl };
```

- 不能用包名深导入（`onnxruntime-web/dist/...`）：包的 `exports` 字段拒绝该子路径。
- dev → `/node_modules/onnxruntime-web/dist/...`（实测两个 URL 均 HTTP 200）
- 生产 → `/assets/ort-wasm-simd-threaded.asyncify-<hash>.{mjs,wasm}`（Vite 哈希产物）

**顺带删除**：`public/models/ort/` 方案整体作废（26MB 冗余静态副本 + fetch 脚本双清单
+ .gitignore/.dockerignore/Dockerfile 三处改动全部回退），`?url` 已覆盖两环境。

### 11.3 Cache Storage 桶清单证明（控制线要求）

**dev（localhost:3000）**——5 项，零第三方：
```
✓ http://localhost:3000/models/birefnet-lite-512/config.json
✓ http://localhost:3000/models/birefnet-lite-512/onnx/model_fp16.onnx
✓ http://localhost:3000/models/birefnet-lite-512/preprocessor_config.json
✓ http://localhost:3000/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs
✓ http://localhost:3000/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm
→ 第三方项: 0  ✓
```

**生产（vite preview :4173，dist 产物）**——5 项，零第三方：
```
✓ http://localhost:4173/models/birefnet-lite-512/config.json
✓ http://localhost:4173/models/birefnet-lite-512/onnx/model_fp16.onnx
✓ http://localhost:4173/models/birefnet-lite-512/preprocessor_config.json
✓ http://localhost:4173/assets/ort-wasm-simd-threaded.asyncify-DXIbolS2.mjs
✓ http://localhost:4173/assets/ort-wasm-simd-threaded.asyncify-CxOG5pUO.wasm
→ 第三方项: 0  ✓
```

两环境均走本地，抠图全流程（download → segment → encode → done）正常出图。

**登记为已知事实**：jsDelivr 发 `cross-origin-resource-policy: cross-origin`，
技术性可通过 COEP require-corp；该事实不作为保留 jsDelivr 的依据（控制线裁定）。

### 11.4 门禁

- `tsc --noEmit` 0 / `eslint` 0
- `bun run build` 0（4m33s；产物含 `dist/assets/ort-wasm-simd-threaded.asyncify-{mjs,wasm}`）
- web 全量 **2492 pass / 0 fail / 323 files**（首跑 1 条时序 flake，复跑 0 fail）
- focused guards **76 pass / 0 fail / 8 files**

### 11.5 探针方法学（入档；控制线 2026-10-01 指定第 1 条为**通用方法**）

- **[通用方法] worker 内发起的网络请求不产生 `Network.requestWillBeSent`** ——
  只看 CDP 网络层会误判「零请求」。**判定第三方直连必须查 Cache Storage 桶清单**
  （Cache Storage 由 worker 与主线程共享，网络层监听不覆盖 worker 作用域）。
  适用面：任何「资源是否直连第三方 / 是否被浏览器缓存」的验证，不限于 F-01。
- [本轮特有] 一处自我误判纠正：曾据「产物里有 `/assets/` 路径」判定生产已自托管，
  未验证「两处 wasmPaths 赋值谁先生效」就下结论。**教训：看到某个赋值存在，不等于
  它生效；必须确认条件分支与实际执行顺序。**

### 11.6 F-01 冻结

控制线裁定：本项完成后 F-01 冻结，不再接受新的顺带发现扩域。
ORT 自托管为最后一个扩域项（因其本身即红线项）。

**冻结口径（控制线 2026-10-01 更正）**：**代码面冻结于 `f3693006`，docs 记账 commit 允许**。
原「6 commits 收口」表述作废 —— 理由：① 干净树纪律高于 commit 计数（未提交工作稿要跨越
用户终验 + 测试线整轮 + 合并三道关卡，期间 worktree 切换/合并有丢失或混入风险）；
② 若终验通过直接进合并，「随下次任务提交带入」的下次不存在，标注会悬死；
③ 任务卡本来就在枝内跟踪（`f3693006` 自身即含 implement.md 改动），先例一致。

**代码面拓扑链（冻结态，6 commits）**：
```
f3693006 ← 4e82d705 ← 5441f2a8 ← 2c2dbf56 ← d510be32 ← 468f7cb5 ← 07c1a604（本地 main 基线）
```

---

## 12. 用户终验不通过 → 三项回修（2026-10-01，控制线裁定「换官方轮子」）

用户真机终验（:3010）报三项，控制线一手定性全部成立，代码面解冻回修。

### 12.1 缺陷1（阻塞）抠图结果错位/全黑 —— 改用官方 pipeline

**现象**：6 次操作 4 次全黑（整图 alpha=0）+ 1 次丢主体（花束图只保留杯子）。

**定位过程（一手测量，全部可复现）**：
- processor 几何是**纯拉伸**（1024x512 输入 → 红色边界精确落在 64/512，非 letterbox）→ 几何错位假设证伪。
- logits dims 恒为 `[1,1,512,512]`，NaN=0 / Inf=0（真实照片全部健康）→ 数值退化假设证伪。
- 同一张图连续 3 次结果**逐位相同** → 「随机两极」实为**按图内容分化**，不是执行非确定性。
- 并发 3/6 次（同一 worker 单例）结果与串行完全一致 → 单例污染假设证伪。
- 真实照片批量（11 张，含 4000x6000）全部正常 → 尺寸/宽高比假设证伪。
- 决定性对比：**同一用例下官方 pipeline 与手搓路径输出一致**（含小主体图同样全黑）
  → 小主体全黑是 BiRefNet 显著性检测的模型边界，不是手搓 bug。

**结论与处置**：控制线裁定换入官方 `pipeline("background-removal", MODEL_ID, { progress_callback })`。
官方 `BackgroundRemovalPipeline._call` 只有 9 行（transformers.js:34639），
蒙版在 `ImageSegmentationPipeline` 内部 resize 到「从原图捕获的尺寸」再 `putAlpha`
贴回原图克隆，**对齐是构造性保证的**；手搓段（`logitsToMask` 手动 dims 解析 +
手动 ImageData 布局 + `destination-in` 合成）每一处都是一次坐标数学的机会，
已被整体删除（净 -83 行）。

**兼容性一手验证**：`pipeline()` 工厂直接接受 `progress_callback`，实测 520 个
`progress_total` 字节事件 / 93.9MB —— 字节级进度能力不损失。birefnet-lite-512 走
通用路径兼容（模型类 `AutoModelForImageSegmentation` 与 `SUPPORTED_TASKS["background-removal"]`
的 `model` 列表一致）。mask 质量反而更好：输出 alpha 呈双峰分布（54.96% 透明 /
44.14% 实心，中心 254、角落 0），边缘为软边。

### 12.2 缺陷2（阻塞）处理中源节点画面错乱（四象限镜像万花筒）

**根因**：覆盖层 `backdrop-blur-[1px]` 位于 `canvas-world-layer` 的
`transform: translate3d(...) scale(k)` 之内（canvas-live-viewport.ts:48），
Chromium 对缩放祖先内的 `backdrop-filter` 做**分块重采样**，源节点画面呈四象限
镜像态；覆盖层卸载即恢复，与用户描述完全一致。仓库本就知此问题并在交互态对节点
面板统一 `backdrop-filter: none !important`（globals.css:11154），覆盖层不在该白名单内。

**处置**：移除覆盖层的 `backdrop-blur-[1px]`，只靠 `bg-black/45` 压暗（覆盖层
职责是「遮罩 + 报进度」，背景模糊非必需）。守卫断 `className` 面而非整段源码
（注释会合法引用 `backdrop-filter` 说明原因）。

### 12.3 缺陷3（轻）toast 文案撒谎

**现象**：`message.info("开始本地抠图，首次需下载约 90MB 模型（仅此一次）")` 无条件弹，
缓存命中（实测约 1s 直达识别段）也说「首次下载」。

**处置**：新增模块级 `isCutoutModelCached()`，读 Cache Storage 的
`transformers-cache` bucket（transformers.js `env.cacheKey` 默认值，键为完整 URL）
`match` onnx 文件；命中时只报「开始本地抠图」，未命中才提首次下载。判定失败一律
按未缓存处理（多提示比漏提示安全）。不引 transformers.js 内部状态。

### 12.4 门禁与验证

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | 0 |
| `bun run lint` | 0 |
| `bun run build` | 成功（1m22s） |
| 全量 `bun test`（web/ 内跑） | **2496 pass / 0 fail**（323 文件） |
| 守卫（cutout-entry-integration + cutout-wiring） | 28 pass / 0 fail |
| 生产产物 | `dist/assets/background-removal.worker-DrV01EF7.js` 无 `logitsToMask`/`destination-in`/`output.logits` |

**UX 可见级验证**（控制线方法论要求，用应用真实 React 实例 + 真实画布缩放祖先结构）：
5 个阶段用例全部渲染成功且文本精确匹配 ——
`正在加载模型… 0.0MB / 93.9MB（0%）` / `正在加载模型… 37.2MB / 93.9MB（40%）` /
`正在加载模型…（首次约90MB）` / `正在识别主体…（已用 7s）` / `正在生成透明图…（已用 8s）`；
`role=status` 可见、进度条随字节推进、`backdrop-filter` 计算值为 `none`（缺陷2 修复生效）。
截图 `/tmp/f01-fix-ux.png`。

**端到端验收**（官方 pipeline，dev :3000）：竖图 3 次结果**完全一致**（1024x1536，
透明 52.4% / 实心 44.1% 双峰）、横图正常、透明源图正常。

### 12.5 环境事故（如实记录）

排查期间 WSL 内存被灌满至 20GB 上限并卡死（当晚 20:30 前后强关一次）。
**责任在 A 线**：探针脚本用 `json/new` 新建标签页后只 `ws.close()` 而**从不关闭
标签页**，25+ 个跑过抠图的页面各自常驻 98MB 模型 + ORT WASM 线性内存（只增不减），
叠加 13 个独立 profile 的 Chrome 实例与 4000x6000 大图推理。journal 持久化已生效，
下次有法医证据。

### 12.5.1 验证副产物纪律（控制线补丁 2026-10-01，本轮教训）

1. **清理范围按「我起过的进程」计，不按「我以为的类型」计**。看门狗覆盖面从
   Chrome 扩到全部验证副产物：vite / preview server / 独立 Chrome profile /
   图片服务 / 后台脚本，任务结束统一清点关闭。13 个 Chrome 实例的教训同族——
   只清「我以为的那类」会漏掉同族副产物。
2. **同一 worktree 同时只允许一个 dev server**。做 UX 验证优先复用终验栈
   `:3010`（同一 worktree、同一份代码），确需独立端口时**用完即杀**。
   本轮事故：`:3000` 验证残留 58-73% CPU 与终验栈 `:3010` 并行轮询同一 worktree，
   load 冲到 73，控制线排查后 kill `:3000`。
3. **重活启动前先看 `free -h` 与 load**（可用 <6GB 或 load >30 就等待或协调）
   —— 三线（A 线 / 深拆线 / 控制线）错峰总纪律。
4. 探针脚本模板固化：结束必 `json/close` 每个标签页，批量后确认内存回落
   （实测探针后 used 5.9GB / avail 14GB）。
