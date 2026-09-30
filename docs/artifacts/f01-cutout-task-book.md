# F-01 智能抠图/白底图 任务书（B线 Wave2 首枝）

> 控制线拟，2026-09-30。转发 A线执行。
> 设计输入：`analysis-2026-09-12/ecom-design/impl/F-01.md` 路线三（spec of record，2026-09-12 修订版）+ 本任务书。
> 排期锚点：W4，v1.6.1 合批之后开枝（用户已拍板顺序）。

## 一、范围

**本枝做**：浏览器 WASM 抠图基线（BiRefNet-lite-512 自托管权重）+ 白底合成导出 + COOP/COEP 头。
**本枝不做**（留 capability 钩子，不实现）：云端精修档（remove.bg/Bria API 插件通道）、agent 加速档（canvas-agent matting 模块）、批量抠图（F-12 云端队列）、SAM2/MediaPipe 交互修正（二期）。

## 二、硬约束（红线，违反即 STOP）

1. **修-9 三级路由**：本地 AI 能力一律按「浏览器 WASM 基线 → agent 可选加速 → 云端付费精修」设计。本枝实现基线档，上两档只留路由位与 capability 声明。
2. **模型权重自托管**：对象存储（四 provider 体系现成）+ 版本清单 JSON + sha256 校验；`env.allowRemoteModels=false` + `localModelPath` 指向自有 CDN。**严禁 HF Hub / jsDelivr 直连**（国内不可达）。
3. **许可**：只用 MIT 的 BiRefNet 官方权重。**严禁 RMBG-2.0**（CC-BY-NC 4.0 非商用）；transformers.js 依赖选型照 dramaclaw AGPL 教训核查。
4. **咽喉纪律**：`use-canvas-media-tools.ts` / `canvas-image-toolbar-tools.tsx` / `routes.go` 零触碰（已验证 F-01 落点与咽喉零交集；白底合成走 media-conversion 子树 + crop 对话框复用）。
5. **PATCH-MAP**：globals.css 零改动预期。COOP/COEP 改 `nginx.conf` + `vite.config.ts` 属配置面，登记本任务卡 Notes 即可。
6. **文案红线**：上线文案不承诺「发丝级」（透明/高反光是已知弱项，云端精修档承接）。

## 三、文件清单（锚点 2026-09-30 实核，v1.6.0 树）

**新增**：
| 文件 | 职责 |
|---|---|
| `web/src/workers/background-removal.worker.ts` | dramaclaw `matteWorker.ts` 同构：单例懒加载、三段进度（下载模型→识别主体→生成透明 PNG）、WebGPU fp16 / WASM q8 双 dtype 回落（`navigator.gpu.requestAdapter()` 探测）、`crossOriginIsolated=false` 强制单线程 |
| `web/src/services/cutout-runtime.ts` | worker 调用封装：单例 + pending Map、worker 崩溃拒绝在途并重建、`preloadCutoutWorker()` 预热、abort 支持 |
| 模型分发清单 | 权重上传对象存储 + `models-manifest.json` + sha256 |

**修改**：
| 文件 | 改动 |
|---|---|
| `web/src/components/canvas/nodes/media-conversion-node.tsx:155` | cutout 从 `model_missing` 通用桩改调 `runBrowserCutout()`（impl 原文 :154-157 锚点勘正为 :155——v1.6.0 合并后行号） |
| `web/src/lib/media-conversion/contracts.ts:41,43` | 描述更新：「本地浏览器抠图，首次使用需下载约 50MB 模型，之后离线可用」；名称「透明抠图」保留 |
| `nginx.conf` + `vite.config.ts` | COOP/COEP 头（排期修订 #1 顺延至今，本枝承接）+ 第三方子资源 CORP 审计 |

**白底合成导出**（纯前端）：透明 PNG → Canvas 合成纯白 RGB + 1:1 补边/裁切（复用 crop 对话框、`image-size-presets.ts` 的 `ECOM_CHANNEL_PRESETS`〔Amazon 主图 1:1 ≥1600px 已在树〕、blob 存储链路）。

## 四、Flora 接线（借鉴点，非硬约束）

- **需求验证**：Flora Background Remover = 112 技法运行量第一（52,399 runs，cost=2 ≈ 免费引流件）——抠图是电商最重刚需，F-01 优先级无误。
- **文案范式**：工具/输入描述照 Flora inputItems 句式——「场景 + 最佳条件」（原文：*"Upload any photo you'd like the background removed from — product shots, portraits, or objects. Works best with clear subject distinction."* 中文化照此结构）。
- **诚实缺口注记**：Background Remover 在 Flora 语料中为 legacy 空图技法（无节点提示词可抄）——无关紧要，基线档是本地分割模型不用提示词。

## 五、门禁（house style）

1. `web/` 目录内 `bun test` 全量（目录敏感教训：仓根跑会静默丢 24 条）
2. `tsc --noEmit` / `eslint` / `build` 全绿
3. 新增单测（纯逻辑零 DOM）：进度状态机 / dtype 回落判定 / 权重清单 sha256 校验 / 白底合成几何（补边/裁切 clamp）
4. focused guards：media-conversion 既有测试 + `image-size-presets` 相关
5. 真机自验：首次下载三段进度条 → 二次离线可用 → 白底导出 Amazon 1:1 规范
6. COOP/COEP 上线后全站回归一遍核心页（第三方资源被 COEP 拦截的风险面）

## 六、纪律

- worktree `feat/ecom-f01-cutout`；单逻辑单 commit；STOP-report（遇结构性阻碍停报告，不自行扩域）
- 预计工作量：M，3–5 人日（impl 修订版口径：worker+分发+COOP/COEP 2–3.5 + 白底导出/进度打磨 1–1.5）
- 验收：门禁全绿 + 用户真机抽验（白底主图一眼验收）
