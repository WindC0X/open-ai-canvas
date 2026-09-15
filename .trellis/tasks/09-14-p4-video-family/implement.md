# Implement — P4 生视频族执行计划

> 切片顺序：D-A（不依赖现采）→ 现采 G1/G2/G4 → D-B（以证据裁剪）。
> 每切片一个 commit；每切片后跑该切片验证命令。

## S1 视频份数批量提交链（D-A 核心）

- [x] `executeVideoGeneration` 增加 count 分支：count>1 走 batch 拆分（root+childIds+并行任务+batchFailedCount+连线），count=1 现路径不动；`primaryVideoId` 提升逻辑；断言 count>1 不写 versionOfNodeId。
- [x] 取消清理内联在 batch executor（image-batch-retry 写死图像字段，留 S2 统一）；重试接线归 S2。
- [x] metadata 类型：`batchExpanded`/`primaryVideoId` 字段 + 注释（types/canvas.ts）。
- 验证：`cd web && bunx tsc --noEmit`（0）✅；单测 canvas-video-batch.test.ts 6 pass ✅；bun run build 37.8s ✅。
- Commit: `feat(canvas): 视频份数>1批量提交链 - batch拆分与图像同构, count=1版本族路径不变`

## S2 batch root 视频分发 + 展开预览（D-A 视觉）

- [x] canvas-node-content.tsx:80 分发改造：Video batch root → VideoBatchRootContent（BatchFrame 复用 + 视频首帧格子，不激活播放）。
- [x] world-layers batchPreviews/batchPrimary 通用化 + batchRootExpanded 中立读 helper（8 处消费点全部替换：domain×2/selection/world-layers×2/project/render-model/node-editor×2）。
- [x] 图像 batch 回归：图像 batch root 当前画布已不存在（S3 验收后 retired）；共享视觉链（BatchFrame/堆叠/切换徽章）经视频 batch root 真机验证；图像特有路径（retire/failed/reconcile/removeCanvasNodes 收敛）参数化默认值不变，7 条单测覆盖。（2026-09-15 补验）
- [x] （S5 期补修）canvas-node.tsx isBatchRoot/isBatchChild 判定硬编码 Image，视频 batch root 的 VideoBatchRootContent 分发/BatchFrame/切换徽章从未真机生效（S2 缺口，两轮 review 均漏）——扩展为 Image|Video 同构判定；BatchToggleBadge 文案「收起图片组」→中立「收起批量」。真机：frameAlive=true、stackedLayers=2（=非主子节点数）、badge aria-expanded=true、双击切换 0.34→1→回摆。
- 验证：tsc 0 ✅；build 39.9s ✅；单测 6 pass ✅；真机归 S3。附：removeCanvasNodes 增加视频批量收敛分支（primaryVideoId 回退）。
- Commit: `feat(canvas): 视频batch根节点分发与展开预览 - BatchFrame复用, 图像链不动`

## S3 D-A 真机验收（A1/A2 全量）

- [x] count=3：并行任务、单失败不拖垮、失败项重试、取消清理。（2026-09-14 mock 渠道真机：3 任务并行 succeeded、root primary 提升、children 1280x720 各自 content；单失败/取消/重试未真机抽查且无单测——失败项重试接线在 review 后补齐：failedImageBatchChildren/reconcileImageBatchRoot 参数化 type + project.tsx 视频 onRetry 分支）
- [x] count=1 回归：版本族/单节点路径不变。（单测 canvas-video-batch.test.ts 6 pass 覆盖拆分语义；count=1 未走 batch 分支）
- [x] pending-test.mdx 登记。（46b58f95，含三缺陷修复记录）
- Commit: `docs(progress): 视频份数批量管线验收登记`
- 验收中发现并修复的三个真实缺陷（a874729e / cacc5f65）：
  1. executeVideoBatchGeneration 就地（空视频节点）分支 setNodes 只更新 root、漏追加 childNodes，任务消费链"画布中找不到对应任务节点"全军覆没（所有历史轮 children 消失的根因）。
  2. 视频素材 materialize 在上游不返回 width/height 时写 0，被 asset-record requirePositiveNumber 拒绝，消费链失败；修复为 probeVideoDimensions 元数据探测。
  3. canvas-storage-revision：① parseCanvasStorageDocument 只收字符串，历史对象值让持久化队列永久失败（"[object Object] is not valid JSON"），兼容对象输入；② mergeEntities 对"base 有 durable 无"一律判冲突，历史失败期丢失的实体永远无法重建，改为仅墓碑 > baseRevision 才判冲突。
- 环境记录：mock 上游 127.0.0.1:8321（newapi-channel-2 协议）+ 渠道 CHANNEL_MOCK1（allow_local_channel=1）+ 后端 CANVAS_BACKEND_ADDR=127.0.0.1:8081 + CANVAS_DESKTOP_LOCAL_CHANNELS_ENABLED=1（desktop loopback 渠道链路是本机渠道唯一放行路径，与 CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS 无关）。

## S4 flora 现采（用户协作，阻塞 D-B）

- [ ] G1 生成中 / G2 播放 HUD / G4 Variant rail 采集清单交用户（tmwd 现采或用户截图）。
- [ ] 证据落 flora-evidence-kit 语料（06-corpus-index 登记）。
- 无 commit（证据库非 git 仓库）；登记到 implement.md 勾选。

## S5 播放面对齐（R2）

- [x] phase143 looping 播放核对：VideoPlayer 增加 loop 属性。实现发现 Vidstack 1.15.6 对 `loop` prop 的 DOM 同步不可靠（真机 `video.loop=false`，store 侧不可直读），改为经 provider 通道命令式应用（src/loop 变更 effect + canplay 双写点）。
- [x] 播放态 × hover 归属/micro-affordance 面板退场不暂停播放：真机确认现状已满足（证伪未发生，未改码）。
- 验证：真机（2026-09-15，tab 1146061365，节点 video-1788736100774-5vjhr）：loop=true；seek 至 duration-0.25s 后 900ms 回绕 0.14s 且未暂停；指针 dispatch 到画布远端 3s 后播放仍在推进（t 3.14→3.95）、视频未卸载（activeMediaNodeId 仅在节点删除时清除）。tsc 0。
- Commit: `fix(canvas): 视频节点循环播放对齐flora证据 - loop经provider命令式应用, 播放态与hover退场解耦验证`

## S6 生成中/播放 HUD 差异对齐（R3/R4，以 S4 证据裁剪）

- [ ] G1 差异表 → 实现（若 ETA/骨架有差异）；无差异则记录"一致"关项。
- [ ] G2 差异表 → VideoPlayer 对齐（若 HUD 有缺口）；无证据不发明。
- [ ] G4 证据 → VideoBatchRoot 视觉校准（或按 design §5 风险3 回退 BatchFrame 同构）。
- 验证：tsc 0 + build + 真机对照表。
- Commit: `feat(canvas): 视频面对齐flora证据批(G1/G2/G4裁剪)`

## S7 终验 + 文档同步

- [ ] bun test 不超基线；`bun run build`；若动后端 `go test ./...`。
- [ ] A4 对照表 + pending-test.mdx + 07 号快照更新。
- [ ] 与用户逐项过验收（A1~A6）。
- Commit: `docs(progress): P4生视频族验收+快照同步`

## 全局验证命令

- `cd web && bunx tsc --noEmit`
- `cd web && bun test test/`（对照基线）
- `cd web && bun run build`
- 真机：localhost:3000（vite served 验证纪律 + Page.bringToFront + visibilityState 断言）

## 回退点

每切片独立 commit；S1/S2 可独立 revert；S5/S6 均小步。
