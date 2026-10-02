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

---

## 七、控制线验收（2026-10-01 · feat/ecom-f01-cutout @ 468f7cb5）

### 独立核验（非转述）

| # | 项 | 结果 |
|---|---|---|
| 1 | 咽喉红线（use-canvas-media-tools / canvas-image-toolbar-tools / routes.go / globals.css）| ✓ 四文件零触碰 |
| 2 | 后端零改动 | ✓ backend/ 0 文件（任务书口径） |
| 3 | Xbot/jsDelivr 外链清除 | ✓ 仅存替换注释 |
| 4 | RobotExpressive 选型审计 | ✓ design.md 候选淘汰表（Kenney 系骨骼过简）+ README 原文 CC0 1.0 + 来源 URL + 43 skin joints |
| 5 | bun test 独立复跑 | ✓ **2474 pass / 0 fail / 322 files**（main 2444 + 新增 30） |
| 6 | tsc --noEmit | ✓ exit 0 |
| 7 | COOP/COEP 落点 | ✓ nginx.conf(+21) + vite.config(+6)，全站唯一外链随枝自托管 |

### 裁定

**① 开发线验收通过**——进入用户真机抽验（F-01 验收标准=「白底主图一眼验收」）。

**② 真机抽验清单**（用户执行，5-10 分钟）：
- 抠图：图片节点 → 透明抠图 → 三段进度条（首次下载 94MB）→ 透明 PNG
- 二次使用：关页重开 → 模型缓存生效（不再下载）
- 白底导出：抠图结果 → 白底图 → Amazon 1:1 档 → 下载白底主图
- COOP/COEP：`crossOriginIsolated === true`（控制台验证）；导演台 3D 默认人物（RobotExpressive 机器人，CC0）正常加载
- COEP 对自配 OSS 的拦截风险（A线 未解释项 #5）：默认自部署同源不受影响，自配 OSS 用户真机专项核

**③ 挂账（非阻塞）**：
- 首次推理 19.8s（drvfs，含下载未分离）——真机抽验时分离测量「下载/推理」两段耗时
- INT8 量化减重（94MB→~25MB）登记后续优化档
- 测试线整轮（合入 main 后按批次惯例）

### 后续序列

真机抽验 → 测试线整轮 → 合入 local main → push → W4 剩余（flora-overrides 迁移 / F-02）。

## 八、终验驱动的回修批次与 R-4 分层架构终裁（2026-10-01）

用户四轮真机终验（:3010，含 localhost 切换）驱动。回修链：2c2dbf56（进度反馈）→ 5441f2a8（字节进度+dev 大文件）→ 4e82d705（推理段秒表）→ f3693006（ORT 自托管消 jsDelivr 红线违规）→ 6cdba400（冻结口径 docs）→ 442dea0b（三缺陷：官方 background-removal pipeline 换入手搓段净删 83 行；覆盖层去 backdrop-filter 解四象限镜像；toast 缓存区分）。

**关键认知修正**：用户失败图（多主体静物，连续 3 次全黑）定性为 BiRefNet 显著性盲区第二类——无主导主体的多体构图（第一类为小主体 <8%）。官方 pipeline 与手搓路径输出一致（A线 实验实证），故黑图非实现对偶 bug 而是模型能力边界。

**R-4 终裁（用户确认，取代此前所有版本）**：识别/抠图分层 + 四级兜底，全本地——
- L0 BiRefNet 全图单遍（现状不动，覆盖率 ~5% 阈值判定）
- L1 magic_touch（MediaPipe InteractiveSegmenterLegacy，6MB tflite 懒加载）自动多点探测：网格试探（VOZEB 网格蓝本）→ 逐点打分 → 强候选 → 泛洪清洗 → 多部件合并 → 区域外扩 30% 裁剪 → BiRefNet 区域精修 → 原位贴回
- L2 用户点选（W5，本期仅管线钩子）
- L3 显式提示不黑图（LibTV「未返回抠图结果」同构）；云端精修档留修-9 三级路由位

依据链：DisyLab-Beta/dramaclaw/VOZEB-PRO 本地仓源码实读（DisyLab 同款模型同款盲区实证；dramaclaw MODNet 人像特化；VOZEB magic_touch 生产实证）+ 11 站竞品语料（Magnific SAM-3 分层 / Lovart segment_anything 独立工具 / 竞品全云端无本地先例、本地是我们的差异化）+ 用户多主体静物图为指定验收用例。

阻塞前置：magic_touch 模型文件 + MediaPipe WASM 分发许可核验（红线流程）；实验先行（指定图探测命中率 + 区域精修假设验证，不成立则降级 magic_touch 原生蒙版直接合成）。

排期档位丙：L1+L3 修缮期（+1.5-2 人日），L2+统一任务面+性能预期文案 W5。同批 rider：R-1 HUD 让位接线（project.tsx onHeightChange 断线，上游同病）+ R-2 MediaConversion 节点不弹 prompt panel + R-3 secure-context 依赖审计（IP 访问致 crypto.randomUUID/caches 静默失效，本日实证）。

## 九、R-4 分层管线交付验收（2026-10-01 · feat/ecom-f01-cutout @ 13b71c51）

回修批次第二批：R-1 HUD 让位接线（project.tsx:2908 onHeightChange，上游同病 fork 补全）+ R-2 MediaConversion 节点排除对话面板（:2187）+ R-3 secure-context 依赖审计 + R-4 分层管线（13b71c51）+ 纪律补丁 docs（0c8b7097）。拓扑 11 commits。

R-4 最终形态：L0 全图单遍（≥5% 直出）→ 弱 logits 质心 + 窗宽比值判别器（>1.3 大构图 / <0.7 小主体，分离度 4.45/0.00 vs 1.06-1.20 无重叠，+2 次推理）→ 大构图 4×4@50% 十六窗网格 max 合并（t1 37.04% / t2 25.38%，实测成本-召回拐点；5×5 否决：+56% 成本换非单调召回，漏检由网格-物体对齐运气决定）→ 小主体 15%→35% 升序扫描早停 → L3 no_subject 错误通道不回传空白图。

实验链五轮（magic_touch 依赖→扫描禁令→早停判据→网格勘误→判别器+补窗），三处控制线裁定被 A线 实验数据纠错并各自认领入档；magic_touch 6MB 零引入（Apache-2.0 已核验，点提示能力预留 W5 L2 点选档路径位）。已知边界（验收①重定界）：透明玻璃/无对比书页为 BiRefNet 代际极限，紧裁剪 0% 不可恢复，L3 引导云端精修；主要实体抠出=过，碎片=不过，缺边界对象≠不过。

端到端：报告覆盖与实输出完全一致（无虚报）、防假阳用例走文案、判别器分流正确。耗时：特写 ~20s / 小主体 25-30s / 大构图 85-90s / 病态 L3 ~40s。门禁：tsc 0 / lint 0 / 全量 2502 pass 0 fail / build 1m39s / focused 53 pass（控制线独立复跑一致）。PATCH-MAP J13/J13b/J13c/J13d。§12.6 验证副产物硬约束（三次泄漏后立，timeout 前缀/命令内清理/:3000 禁用/按端口清理）三轮完整跑通。

下一步：用户终验（静物图预期主要实体可出）→ 测试线整轮。
## 十、测试线整轮与门2 合入（2026-10-02 · main @ 4a33355e）

### 测试线整轮记录

**S1 冒烟 5/5 过**，同时暴露一个门2 阻塞级新缺陷（详见下节修复链）。

**S2 五轮全绿**；VRT 24/24 **零 diff**（增量基线物理隔离形态：独立 spec/脚本/snapshots，
既有 24 基线 mtime 未动、零 diff，防污染且 F-01 视图可随分支走）；
**e2e 5/5**（drvfs 疑云正式消解）；后端零触碰。

> 数据来源：控制线裁决转述（2026-10-02），A线未亲跑测试线；S1 现象与三定位为控制线修复令原文。

### S1 阻塞缺陷与三笔修复链

**现象**：重开画布后 `status=success` 的抠图节点永久显示
「正在生成透明图…（已用 1790957281s）」——phase 残留跨会话且已落库（另一例 4537s）。

**三笔修复链**（`442dea0b → e4d385ba → 82b51351`）：

| commit | 批次 | 内容 |
| --- | --- | --- |
| `442dea0b` | 三项回修 | 换官方 `background-removal` 管道（手搓 9 行坐标数学删除）/ 覆盖层去 `backdrop-filter`（缩放祖先内分块重采样 → 四象限镜像）/ toast 缓存区分（命中时不提「首次下载」）|
| `e4d385ba` | 终验五轮 P1+P2 | P1 hover 浮层排除（R-2 只堵了 dialog 态，hover 态漏排；本地抠图结果实为 `CanvasNodeType.Image`，加 `mode === "local"` 指纹）/ P2 并发 1→2（计数器 + 排队态可见）|
| `82b51351` | S1 残留态 | phase/startedAt 单次写入 + 会话标记守卫（详见下）|

**S1 三定位**（控制线）：① 写侧两次独立 `setNodes` 落库不一致窗口；
② 显示侧 `startedAt ?? 0` → `(Date.now()-0)/1000` = Unix 秒；
③ 无终态清理（显示条件只看 phase 存在）。

**A线对定位③的方向修正**（控制线裁决①：认可，技术反驳优先于命令）：
裁定要求「加 status 守卫（非进行中不显示）」，但源码事实推翻该定位——
抠图源节点是「有内容的成品图」，其 `metadata.status` 全程为 `"success"`
（`imageMetadata` 固定写入；抠图链路 status 写入次数 0），**残留态与运行态 status 完全相同**，
加 status 守卫会连正常运行态一起隐藏、摧毁「三段进度可见」核心验收。

改用**会话标记**（数据兼容路径，不做迁移）：
`CUTOUT_SESSION_ID = nanoid()` 模块级内存值 → 写侧随 phase 一并落库 →
显示侧只在「节点 id === 当前会话 id」时渲染 → 页面重开模块重求值，
存量脏数据（用户 twin 库已有）比对不等即不渲染，**自动治愈**。
`startedAt` 缺失时显示 `null`（不显示秒数）而非 0——「不显示」与「显示 0」
是两种不同的诚实度：前者是不知情，后者是编造。

### 门2 裁定

**PASS**（控制线 2026-10-02）。依据：S1 5/5 + S2 五轮全绿 + VRT 24/24 零 diff +
e2e 5/5 + S1 阻塞项闭环复验过 + 用户真机终验过 + 后端零触碰。门3 不适用（flora 域）。

### 合入

```
4a33355e merge(batch): F-01 抠图并入 main——分层管线+判别器+网格基座+边界清单+终验五轮回修+残留态回修（12 commits · 门2 PASS）
```

分支 `feat/ecom-f01-cutout @ 82b51351` 合入 main（`--no-ff` 保留分支拓扑，
照 F-06/merge-v161 惯例）。合入前文件重叠分析：main 独有 4 commits（纯 docs 台账）
与分支增量 **零交集**，合并无冲突。

**合入后门禁快验**（tsc/lint 免——分支 tip 已过）：
全量 `bun test` **2513 pass / 0 fail**（324 文件 / 13387 expects）；
`bun run build` ✅（首次失败因 main 的 `node_modules` 未含分支新增的
`@huggingface/transformers@4.3.0`，`bun install` 后通过，`bun.lock` 无变化）。

**PATCH-MAP 终查**：J 段 21 条（J1-J17c）覆盖分支全部增量，零漏登。
