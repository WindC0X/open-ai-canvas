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
