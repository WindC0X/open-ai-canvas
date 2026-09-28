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

## B 轮消缝实验：pad 策略对比（2026-09-27 晚，用户批准开轮）

方法：同帧几何（1536x1024，源 1356x854@90,85）；pad 变体 = mirror(反射延伸) / stretch(边缘拉伸) / 0.5灰 vs 白底基线；
nano 走新无蒙版路由（用户已在渠道编辑器关闭其蒙版编辑，DB 实证 maskSupported=False），2p5/sunburst 走 mask 路由；全部 hardBlend=false。
结果（原图区改动% / 接缝比，接缝比越低越连续）：

| 模型 | 白底(基线) | mirror | stretch | gray |
|---|---|---|---|---|
| nano | 8.0% / 0.94 | 82.4% / 1.03 | 13.5% / 0.89 | 14.3% / 0.91 |
| sunburst | 64.4% / 1.12 | 85.3% / 1.09 | 77.9% / 1.14 | 64.1% / 0.96 |
| 2p5 | 68.1% / 1.28 | 84.2% / 1.17 | 83.5% / 1.58 | 77.2% / 0.91 |

结论：① **0.5 灰底三模型一致不低于白底（接缝 0.91/0.96/0.91），是唯一一致小赢家**；② mirror 让全模型中招（原图区重绘 82-85%，模型对镜像伪影敏感）；③ stretch 对 2p5 接缝最差(1.58)；④ mirror/stretch 不推荐；灰底作为低成本微升级待裁定（前端合成 fill + prompt 文案 + 后端 Agent 合成 pad 共约 3 处小改）。
环境：2.5 通道当晚间歇性 nginx 500（重试后跑通）；证据 `.local/f06hb-evidence-after/matrix-20260927/round2/`。

## 配套小修（2026-09-27 晚，提交见 git log）
- 用户关闭 nano 蒙版编辑（maskSupported=False）后，重试链对旧节点仍会恢复残留 maskKey → 后端能力校验「当前图片模型不支持蒙版编辑」硬失败。
  修 = `use-canvas-generation-retry.ts` 按当前能力域门控 mask 恢复；tsc + canvas-image-batch-retry 12 例全绿。

## C 公网素材地址（资料整理，待用户配置后可补跑 2p5/sunburst 无蒙版/透明底 4 组）
- 入口一：管理后台 → 设置 →「存储服务」(/admin/settings/storage) → 「服务器访问地址」publicBaseUrl；或切换「阿里云 OSS」等对象存储模式。
- 入口二：env `CANVAS_PUBLIC_BASE_URL`（后台未配置时的回落；需重启后端）。
- 规则：根地址、不得带 query、不得以 /api 结尾、必须上游（公网）可达；本地测试可隧道（cloudflared 等）映射 127.0.0.1:8181 后填隧道 HTTPS 域。

## 多底图泛化轮（2026-09-27 晚，用户提议"换底图试试"）

动机：此前所有结论来自单张狗狗照（甲板横线，对接缝最不利的结构）；换结构迥异的底图检验泛化。
底图：**湖泊晨雾照（896x1200→帧 1024x1280/4:5）**、**动漫少女（720x1280→帧 1024x1824/9:16）**；几何按渠道尺寸档位（预设像素，非自定义）重建；
每组按 2p5/sunburst 的 gray+mask、white-nomask 与 nano 的 white/gray-nomask 六格跑，全部 hardBlend=false 测原始。

**基础设施（C 项落地）**：cloudflared 隧道 → 127.0.0.1:8181；管理后台存储设置 PATCH publicBaseUrl=隧道地址；实测：签名素材经隧道拉取 200、四组曾被"公共素材地址"卡住的无蒙版任务（2p5/sunburst white/transparent-nomask）全链贯通 ✓。

**跨底图 seam 汇总（均值，n=成功次数；越低越连续，差值 ≤0.1 视为运行噪声）**：

| 组 | 狗狗(n) | 湖泊(n) | 少女(n) |
|---|---|---|---|
| 2p5 gray+mask | 0.91(1) | 0.96(3) | 1.00(3) |
| 2p5 white-nomask | 1.07(3) | 0.97(3) | 1.02(2) |
| sunburst gray+mask | 1.20(3) | 0.96(3) | 1.00(2) |
| sunburst white-nomask | 0.92(3) | 1.03(3) | 1.05(1) |
| nano white-nomask | 0.94(1) | 1.00(2) | —（余额阻断） |
| nano gray-nomask | 0.91(1) | 0.96(1) | —（余额阻断） |

**结论修正**：① 换底图后各配置接缝全部落在 0.91-1.05，**"灰底优于白底"在扩大采样后降级为噪声内差异**（同格重复间极差 0.03-0.61，均为模型随机性；round2 的"灰底小赢"是白底基线抽到高方差样本所致）；② nano 仍是区域保真最稳的模型（湖泊 2.5%-5.8% vs 2p5/sunburst 4%-70%），这是它作为推荐路线的核心理由；③ 透明底/镜像继续不推荐（前轮记录）；④ **推荐产品配置不变**（nano 去蒙版已生效 + 硬贴回保区域；白底保持现状，灰底非必要）。
**阻塞**：ddcat/八方两个中转账号余额见底（nano 剩 KFC0.002/需 0.04；edits 剩 $0.03/需 $0.06）→ 少女图 nano 两格与少量重复待充值后补跑（~10 分钟）。
证据：`.local/f06hb-evidence-after/matrix-20260927/multisrc/`（23 文件）。

## a6api 渠道双 key 整备（2026-09-27 晚，用户授权直连操作）

背景：ddcat 失联、八方与 ddcat 余额双见底 → 实验阻塞；用户迁往 a6api（聚合市场，user id 12288），把 7 个模型的手动路由池全放在单令牌「123」（id 17862）。
需求：按分辨率能力拆两把 key（避免 4K 请求被路由到仅 1K 渠道）；用户裁定：明确4K+市场精选补充（价格从优）、123 不动、授权代做。

已执行并验证：
- 新建令牌「4k」id=85450（无限额度、永不过期；routing cheap/auto/fallback 字段与 123 同款式）。
- 7 份订阅（token_id=85450，channels 内联直建）：gpt-image-2.5=108747 [4957,4922]；flare=108748 [269,4957,4922]；sunburst=108749 [4957,4329]；gpt-image-2=108750 [2702,4928,4957]；gemini-3.1-flash-image=108751 [624]；nano-banana-2=108752 [4783,4697]；nano-banana-pro=108753 [624,4783,4683]。
- 价格口径（真实 ¥/次）：市场补充渠道 4957/4922/4928 = ¥0.0128–0.0137；既有 269 ¥0.0598、2702 ¥0.0196、624 ¥0.0418、4783 ¥0.0547、4683 ¥0.0555、4697 ¥0.0555；4329 ¥0.0683（样本少 n=6，已向用户声明可删）。
- /api/token/{id}/routes 双令牌对照：新池 7/7 与规划一致；123 的 7 池原样未动（对照快照留证于会话）。
- 界面核对方式：市场页选择令牌「4k」→ 路由状态/个人路由设置。
- 备查：key 读取 = POST /api/token/{id}/key（读操作，另支持 batch/keys）；a6api 计费含 markup_percent:20（以账单为准）。
- 后续（待充值）：两把 key 接入测试库渠道 → 补跑少女图 nano 两格 + 全链验证。

## a6api 接入 + 补跑轮（2026-09-28 凌晨；用户充值 $1 后）

- 双 key 实证：123/4k 两把 key 均 200（/v1/models）；无 auth 与垃圾 key 均 401（对照组）。
- 测试库接入（本地 SQL，克隆八方渠道行）：CHANNEL_000009「a6api」(key=123) + CHANNEL_000010「a6api-4k」(key=4k)，base_url=https://api.a6api.com；channel_models MODEL_000026-31（gpt-image-2.5 / nano-banana-2 / gpt-image-2.5-sunburst ×2 渠道）；PTIER_000013-18；id_sequences 抬至 CHANNEL=10 / MODEL=31 / PTIER=18（防未来 ID 冲突）。
- 协议选型踩坑与修复（提交 bb2e549f，plugin-packages/a6api.yingce-plugin + 解包目录三文件）：
  - 初版误克隆 ddcat 的 gemini-image/openai-image 协议 → nano 报「声明式协议已完成但没有返回媒体地址 / 没有返回结果」。
  - 根因：a6api 对 nano-banana-2 的回包为非标准形态——/v1beta 与 /v1/images/edits 均为 chat 壳，图片以文本 URL 呈现（parts[].text / choices[0].message.content）。
  - 修复：渠道模型切到本仓定制插件 a6api-image 协议（有参考图自动走 /v1/images/edits multipart）；扩展其 response.images = $concatArrays{原 data[] 分支, 无标准 data 时取 choices 文本为 {url}}；同步 README/docs 合同镜像（逐字段契约规则）。
  - 验证：官方插件全量测试 TestOfficialProtocolPackagesAreSelfContainedDeclarativePlugins 绿（196 包，5.2s）；重启后注册表重建含补丁；nano 冒烟 45s 出图成功。
- 补跑结果（hardBlend=false 原始输出；全部经产品全链）：
  | 格 | 新增 | 累计 n | seam | region% |
  |---|---|---|---|---|
  | girl 2p5 white-nomask | +2（123 key ×1 + 4k key ×1） | 4 | 0.99–1.18 | 50–61 |
  | girl sunburst white-nomask | +2 | 3 | 1.01–1.12 | 53–65 |
  | girl nano white-nomask | +2 | 2 | 0.98–1.00 | 5.5 |
  | girl nano gray-nomask | +3 | 3 | 0.91–1.00 | 5.2 / 5.2 / 79.8（第三发高重绘出格，记录不剔除） |
  | lake nano gray-nomask | +1 | 2 | 0.96–1.04 | 1.6–3.7 |
- 双 key 产品链验证：4K key 独立跑通 nano（任务 e6fd7f8d）与 2.5（任务 41b60fd2）各一格。
- 结论：因余额阻塞的格子全部补齐；跨底图结论不变（pad/mask 差异 ≤0.1 属噪声；nano 区域保持最稳；白底默认不变）。
- 证据：.local/f06hb-evidence-after/matrix-20260927/a6api-round/（a6-summary.jsonl 22 条含调试期失败留痕、各格 crop/result、a6-contact-sheet.png）。
- 备注：调试期 12 次失败尝试（协议修复前）保留于 a6-summary.jsonl；消息面余额消耗未取到（浏览器标签被占），按市场价估算本轮成功 10 发 ≈ $0.06–0.08。

## 验收收口与封版（2026-09-28 控制线）

### 用户真机裁决（三项，全部通过）

1. **硬贴回衔接带**：大体 OK、细看可见衔接——定性为**生成式扩图上限**（重绘内容与原图天然不连续），非缺陷；验收通过、不做后续优化。备注：彻底无接缝的替代路线只有纹理合成型扩图，但语义上画不出新物体，不满足电商「补场景」需求——产品边界，不列待办。
2. **扩图档位 4 项真机**：全部正常，验收通过。
3. **a6api 余额**：充足，无运营动作，悬案销。

### 红基线对账（口径统一：15 红逐名 = 冻结基线）

早前轮次报告「全量 2279/18 vs stash 基线 2277/17」，与冻结基线 15 项存在 2 条口径差。逐名对账：

**冻结基线（15 红逐名；2026-09-28 全量 2284 pass / 15 fail 的确定集合，此后全量口径）**
1. 运行中不再锁死输入框，发送走插话而不是新建轮次
2. shared action colors and focus feedback > workspace density overrides inherit action colors and shadow-free focus
3. auth scene consumes resolved appearance instead of hardcoded media constants
4. DEV director lab loads without calling the appearance backend
5. appearance still blocks normal startup: dev=false path=/dev/director-repro
6. appearance still blocks normal startup: dev=true path=/login
7. appearance still blocks normal startup: dev=false path=/login
8. appearance still blocks normal startup: dev=true path=/dev/director-repro/
9. appearance still blocks normal startup: dev=true path=/dev/director-repro-other
10. public film entry remains independent: /welcome
11. public film entry remains independent: /welcome/
12. large canvas media rendering > keeps inactive video nodes on a viewport-gated static first frame
13. 并发生成结果经真实持久化消费链路及重新读取后保留成功、失败和用户编辑
14. menu surfaces are explicitly scoped and old account inner overrides are removed
15. shared single-select popup uses a borderless surface instead of a bright focus frame

**「stash 基线 17」= 上述 15 + 2 条**（唯一差集）：
- `axios.create stays in the shared request client`（超时）
- `copied flush Modal padding lives only in AppModal`（超时）

**归因**：属**已知 flake 家族**（全 src 快扫描守卫类，5s 默认超时的边缘耗时——本机实测 4.4–6.3s，`axios.create` 复跑实录 6.08s）；隔离 `--timeout 20000` 复跑全过；非分支固有、非确定性。同一家族在门控轮 after 口径里另报过 3 条临时超时（copied flush / command confirms / flush modal drawer），随负载出现/消失（徽章轮 15/15 与冻结基线完全一致）。**结论：17 与 15 无实质差异，2 条差集全部为超时家族波动。**

**口径（此后统一）**：本枝全量门禁 = 「15 红逐名 = 冻结基线」；守卫超时家族已由 rider 消除（见下），后续轮次不应再出现该家族。

### 封版前行政项 2：轻量枝超时 rider 移植（提交 4db8b876）

- 来源：轻量枝 `3b1f49a1` 中对 `web/test/http-ownership.test.ts`、`web/test/ui-kit-retirement.test.ts` 的修订——5 个全 src 快扫描用例追加 `per-test 20000ms`（含说明注释）。
- 方式：**部分补丁移植**（`git diff 3b1f49a1^..3b1f49a1 -- <两文件>` + `git apply --3way`，两文件基版一致、clean apply）；未整提交 cherry-pick（该提交另含轻量枝 S3 反馈渠道改造等功能，不属本枝范围）。
- 验证：`bun test http-ownership ui-kit-retirement` → **6 pass / 0 fail**（axios.create 6.08s、copied flush 5.03s——越 5s 线实证，20s 下稳定通过）。

### 封版声明

- `feat/ecom-f06-hardblend` 封版：五轮成果一次冻结——① 硬贴回（服务端 apply_overlay）② 扩图档位门控（白名单/徽章/空态）③ 真机反馈修复轮 ④ a6api 双 key 接入与插件适配 ⑤ 多底图泛化实验轮。
- 封版 HEAD = 本卡封版节所在提交（分支末位提交，`git log -1` 即得）；工作区干净；推 fork（github.com/WindC0X/open-ai-canvas）。
- 环境释放：:3001 vite、:8181 测试后端、cloudflared 隧道（B 线自建）停用；:3010 家族走查环境不动。
- 待合并批次（flora + 轻量枝 + B 线 F-06 三枝），合并任务书由控制线下发，合入动作在 main checkout 执行。
