# F-06 二期硬贴回 执行记录（2026-09-27）

> 裁决输入：控制线 2026-09-27（共存默认开启 + metadata 关断、映射归一不动尺寸、8% 失真阈、
> rect 前端为几何唯一真源、账单链零改动、hardBlend 不进 Agent 工具 schema）。设计见 design.md。

## 基线复验（改动前，真实 ddcat ×3）

任务 ab783bdb / b51f860e / 1979001e 等：贴回区 changed>24 ≈ **76.2 / 74.6 / 75.9%**，mean ≈ 50；
结果 1536x1024，rect 映射 (90,85)-(1446,939)（= 蒙版不透明 bbox）。

## 完成项

### 1. 前端几何（提交 4ff30b2d）
- `resolveOutpaintSubmitGeometry`（canvas-outpaint-geometry.ts）：target/free 两模式复刻 pad 取整，
  frame+归一化 rect；`buildOutpaintSubmitVariants` 返回 `{source, mask?, geometry}`。
- 提交链 mode=image 时任务 metadata 写 `outpaint{sourceStorageKey, rect, frame}`；结果节点持久化
  `outpaintSourceStorageKey/outpaintGeometry`；重试链按节点 metadata 重建 outpaint 块（legacy 节点跳过）。

### 2. Agent 链（提交 68f59b56）
- 抽 `cloudAgentOutpaintLayout`（paint/geometry 同源取整）；materialize 返回 frame；
  `prepareCloudAgentMedia` 写同一 metadata.outpaint 块（sourceStorageKey=源资源）；
  `TestCloudAgentOutpaintLayoutMatchesPaintAndGeometry` 证明 mask 不透明区往返 = rect 像素。

### 3. 后端贴回（提交 37675d30 + 47c9ae5e）
- `task_outpaint_hardblend.go`：纯函数贴回（画布尺寸不变 / rect 直接映射 / 8% log 失真阈跳过 /
  2px 过渡带随映射因子缩放 / 全路径 fail-open + 日志）；识别 = `metadata.outpaint` 块存在，
  缺省 hardBlend=开启、显式 false 关断。
- **47c9ae5e 修复「贴回从未执行」根因**：v1.5.8 媒体检查点架构下，image 结果在 execute 期间经
  `recoverProtocolMedia → materializeTaskMedia`（下载→入库）完成物化；worker 端 L211/L251 两处
  均因 `MediaRecoveryJSON != ""` 走 `finishTaskMediaRecovery` 分支，绕过 worker 注入点。
  修复 = 贴回改挂 **materializeTaskMedia 单品入库前（storeTaskMediaFile 之前）**——正常执行与
  断点恢复共用的唯一媒体漏斗；worker 注入点保留为非检查点路径兜底。
  新增 `prepareOutpaintHardBlend` / `applyOutpaintHardBlendToMediaFile` + 物化路径单测。

## 验证证据（同节点同参：原图比例+AUTO → 1536x1024；验算对齐搜索最优偏移恒 (0,0)）

| # | 渠道 | 任务 | inset4 changed>24 | mean\|d\| | inset0 |
|---|---|---|---|---|---|
| r1 | mock | 30356b5de099 | 0.00% | 0.74 | 0.54% |
| r2 | mock | e6e71dd21e17 | 0.00% | 0.74 | 0.54% |
| r3 | mock（终版代码） | 5e6f1b49cdd1 | 0.00% | 0.74 | 0.54% |
| r6 | ddcat 真实 | cdcf1902e831 | 0.00% | 0.69 | 0.49% |
| r7 | ddcat 真实 | b244cd10e899 | 0.00% | 0.67 | 0.40% |
| r8 | ddcat 真实 | 43edf23a3625 | 0.00% | 0.79 | 0.58% |

- 目视复核：结果区 vs 原图映射双栏逐像素一致（evidence r1/r7 compare）。
- 扩展区未被越贴（vs 纯白 changed 95.8%，生成内容保留）；结果尺寸恒 = 模型输出尺寸（1536x1024）。
- 素材物化日志「扩图硬贴回完成：结果已回贴原图区像素」按单落账。
- 门禁：`go test -count=1 -timeout 30m ./...` 全绿；web 专项 56 pass / 0 fail；gofmt/build 绿。

证据文件：`/tmp/f06hb-evidence-after/`（r1/r2/r3/r6/r7/r8 的 result/compare/e2e 截图）。

## 环境与遗留

- ddcat 上游 07:13–08:1x 间歇 nginx 500；重试于 08:19 恢复，真实渠道 after 证据补齐（r6-r8）。
- 积分结算 `database is locked` 抖动（uncertain → 待核对）为既有现象（07:07/07:08 改动前任务同款），
  账务链零改动；失败任务自动退款、r6/r7 正常 settled、r8 uncertain（锁抖动）。
- mock 临时环境：ddcat base_url 已还原 `https://api.ddcat.pronhubcn.com`；CHANNEL_000007 f06-mock
  留存于测试库（不进 UI 菜单）；mock 进程已停止。
- 待用户/控制线：真机主观确认贴回效果；上游恢复期偶发 500 属外部依赖。

## 验收期发现（2026-09-27 下午·用户真机反馈，均带证据待裁定）

### N1. nano-banana2 默认「原图比例」回落 1:1 → 上游出方图、贴回按纪律跳过（前端行为待裁定）
- 链路：overlay `submitSize`（aspect_ratio 制）对 `ORIGINAL_RATIO_KEY` 不在枚举内 → 回落 `sizeFallback`=模型默认 `"1:1"`
  （canvas-node-outpaint-overlay.tsx:~252）→ 后端 gemini 桥 `geminiImageConfigFor` 把 `"1:1"` 映射 `imageConfig.aspectRatio`
  （provider_image.go:194）→ 上游严格出 1:1 方图。nano 枚举实际含 `3:2`（= 1536x1024 原图比例，model_capability.go GeminiImage 段）。
- 实测（助手跑单 34c5977d → 节点 eh4sgvtNfOa5o1dKjS0bl；及用户两单）：
  | 运行 | 提交 size | frame | 上游返回 | 比例偏差 | 贴回 |
  |---|---|---|---|---|---|
  | 用户 09:18 | "1:1"(回落) | 1536x1025 | 2048x2048 | 0.405 | 跳过（纪律） |
  | 用户 09:35（手选 3:4） | "3:4" | 1151x1536 | 1792x2400 | 0.0036 | ✅ 0.00% |
  | 助手 09:5x（默认） | "1:1"(回落) | 1536x1098 | 2048x2048 | 0.336 | 跳过（纪律） |
- 结论：上游「听话」（手选 3:4 严格出 3:4 + 贴回生效），问题=默认档把"原图比例"静默换成模型默认 1:1。
  候选修复：原图比例在 aspect_ratio 制下按最近枚举值提交（1.5→3:2），而非模型默认。
- 附带：结果节点「画幅偏差」角标对 aspect 制模型显示像素推算值（如 2161x1442），而实际提交的是比值串 "1:1"，口径不一致易误读。

### N2. composer 引用缩略图「裂图」= 过期签名 URL 被前端永久缓存（前端 bug，证据实锤）
- 展示用资源访问签名 TTL=5 分钟（internal/assets/access.go:105 `ttl := 5 * time.Minute`）。
- `use-resolved-canvas-resource-references.ts` 的 `previewPromiseCache` 对每个引用永久缓存首个解析结果，
  超过 TTL 后新打开 composer 复用过期签名 URL → 403 → 浏览器裂图。
- 证据：后端日志 09:37–09:39 同一过期签名（expires=1790472178 即 09:22:58 到期）被反复请求 26 次 403
  （该签名约 09:17:58 签发给源图资源 a62dabce…，正是首次打开引用面板的时刻）。
- 修复方向：解析 promise settle 后即从缓存移除（下游 `getResourceAccess` 的 accessCache 已按 expiresAt 处理 TTL）。

### N3. gpt-image-2.5「黑色晕影」= 上游生成产物，贴回本身正确
- 该单内区回贴 0.00%（inset4，(0,0) 对齐，双副本一致）；黑边/纯黑四角（角落 [0,0,0]、边缘带 49% 亮度<30）为上游 2.5 输出形态。
- 处理建议：换模型档或渠道反馈；本链无需改动。

## 三模型 × 三路由矩阵实测（2026-09-27 下午·直连 API 实验台）

方法：克隆失败任务完整 input 直连 `POST /api/tasks`（前端零参与），全部 `metadata.outpaint.hardBlend=false`（测模型原始输出）；
帧几何 = r6-r8 实证版（1536x1024，源图 1356x854 @ (90,85)）；源 = 金毛原图资源 a62dabce；证据 `.local/f06hb-evidence-after/matrix-20260927/`。

| 运行 | 任务 | 结果 | 尺寸 | 原图区 >48 灰度差占比 | mean\|d\| | 扩展区填充 | 任务 |
|---|---|---|---|---|---|---|
| 2.5 mask | e4daea1c | ✅ | 1536x1024 (ratio_dev 0) | **43.2%** | 41.9 | 99.9% | mask 在请求内（body>1MB） |
| sunburst mask | 70d009df | ✅ | 1536x1024 | **40.6%** | 40.1 | 97.4% | mask 在请求内 |
| nano mask | 4ef51df1 | ✅ | 2528x1696 (0.006) | **67.1%** | 65.0 | 97.8% | mask 图被塞给 gemini（body>1MB，协议无 mask 概念，添乱） |
| nano white(无 mask) | 0fec9b26 | ✅ | 2528x1696 | **8.0%** | 12.8 | 96.4% | pad-only 436KB 对照 |
| nano transparent pad | 86b9e0d7 | ✅ | 2528x1696 | **68.6%** | 63.5 | 97.6% | 透明底大翻车 |
| 2.5 white / transparent | 32f66506 / 7aa20306 | ❌ | — | — | — | — | "生成参考素材地址失败"：openai 链**无 mask 时要求公网素材 URL**（本部署未配 CANVAS_PUBLIC_BASE_URL，本地存储无法出 URL；带 mask 走字节通道才可跑） |
| sunburst white / transparent | d5896b7c / 8e6816ff | ❌ | — | — | — | — | 同上 |

结论：
1. **三家均不"真支持"蒙版编辑**（mask 确已发出：请求 body>1MB vs 无 mask 对照 436KB）——原图区被重绘 40~67%，与 pre-hardblend 基线（72-76%）同族。硬贴回仍是唯一保真保障。
2. **nano 正确姿势 = 白底 + 无 mask + 保持提示词**（8.0% vs 带 mask 67.1%）；建议渠道配置把 nano 的 maskSupported 设为 false（用户侧配置操作）。
3. 透明底 pad：nano 实锤更差（68.6%）；产品维持白底路线正确。
4. 2p5/sunburst 的无 mask/透明底对照被部署约束挡住（需公网素材地址）；如要补齐需 CANVAS_PUBLIC_BASE_URL 或 OSS。

### 接缝观感与羽化事实（对应用户"割裂感"反馈）
- 现行羽化 = 2px 基准 × 映射因子，clamp[1,8]（裁决①口径），用户实测那张≈3px → 目视"无羽化"属实；设计目标仅为防 1px 硬边噪点。
- 本地粗模拟（32/64px 对称 cross-fade，feather-demo.png）：能柔化硬线，但结构错位处产生鬼影/涂抹，且不解决内容不连续——**宽羽化不是解**，生成端续接质量才是主因。
- 模型扩展区共同病征：结构错位（栅栏/门框被切）+ 色调漂移（上冷下暖）；接缝比（边界梯度/基线梯度）1.1~1.4。
