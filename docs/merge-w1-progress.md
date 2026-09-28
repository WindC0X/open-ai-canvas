# W1 处置进度（实时追加 · 批次九）

> 规则：**每处置完一个冲突文件追一行**（含所在分段的合并提交点）。新会话可据此恢复：先看"未决"段，再看 git 状态（`git -C /mnt/f/CODE/Project/oac-wt-merge-v157 status`）与 rerere 记录。
> 分段（每段一次合并提交）：**W1-a** = `git merge 35ebed30`（1 上游提交，30 hunk，卡 05）→ 门 → 提交；**W1-b** = `git merge 9eb2fcd4`（32 上游提交，~70 hunk，卡 05/06/07/09）→ 门 → 提交。
> **前置门（W1-b 开前必须完成）**：卡 06 水位门重核——先读透 `origin/main` 的 `user-data-sync.ts`（dc1ad680 后新结构），重核结论落盘 `docs/merge-card06-watermark-recheck.md`，然后才处置同步域冲突。

## 分段状态

| 分段 | 状态 | 合并提交 | 门（tsc/build/go） | 备注 |
| --- | --- | --- | --- | --- |
| W1-a `35ebed30` | **进行中**（12 冲突文件：已处置 4 / 未决 8） | — | 未跑 | 合并已起（worktree merge-v1.5.7），rerere 已记录 preimage |
| W1-b `9eb2fcd4` | 未开始 | — | 未跑 | 开前先做卡 06 重核前置 |

## 处置记录（逐文件追加）

| # | 文件 | hunk | 按卡 | 结果 | 时间 |
| --- | --- | --- | --- | --- | --- |
| 1 | `web/src/lib/canvas/agent-canvas-patch.ts` | 3 | 卡 05 | **已处置**：①mergeItems 取上游通用删除结构（after=null→delete）+ 保留我方"唯一合法来源=撤销采纳"不变式注释；②任务守卫豁免保留我方窄口径 `after === null`（不用上游 `!change.after`，缺省 undefined 仍走守卫）；③removals/updates 顺序取我方（两者 id 互斥，顺序无副作用，已加注释） | W1-a |
| 2 | `web/src/services/agent-canvas-sync.ts` | 1 | 卡 07 + **卡外补充** | **已处置（含语义发现）**：我方 canvas_undone 已由 2026-09-21 review 修成"无条件刷新"（卡 07 原结论"取我方语义"在此项上已被我方自身修复部分覆盖）；本次融合 = 保留我方 `!supportsPatches` 门（canvas_updated 在增量模式不盲刷）+ 新增尊重上游 `payload.requiresRefresh` 显式信号（防止"每次 canvas_updated 都刷"回退，同时覆盖上游测试断言） | W1-a |
| 3 | `web/test/agent-canvas-patch.test.ts` | 1 | 卡 05 | **已处置**：两侧测试互补（我方=撤销删除语义；上游=整刷删除 + 本地编辑冲突抛错），**全收** | W1-a |
| 4 | `web/test/agent-canvas-sync.test.ts` | 1 | 卡 07 | **已处置**：两侧测试全收（我方 canvas_undone 刷新；上游 requiresRefresh 后 delta 模式仍刷）+ 我方新增 requiresRefresh 分支使其通过 | W1-a |

## W1-a 未决（8）

| 文件 | hunk | 备注 |
| --- | --- | --- |
| `web/src/services/user-data-sync.ts` | 12 | **前置门**：先做卡 06 水位门重核（读透 dc1ad680 后新结构）并落盘，再处置 |
| `web/src/pages/canvas/project.tsx` | 4 | 我方 71 次热改主战场，逐 hunk 读 |
| `web/src/pages/canvas/use-canvas-project-lifecycle.ts` | 2 | 卡 06 同域（loadCanvasProjectForEditing 入口） |
| `backend/internal/app/cloud_agent_undo.go` | 1 | 撤销域，卡 05 关联 |
| `backend/internal/database/migrations.go` | 1 | schema（35ebed30 侧新增） |
| `backend/internal/database/migrations_test.go` | 1 | 同上 |
| `docs/content/docs/backend/backend-database.mdx` | 1 | 随 schema 同步（卡 06 ④） |
| `docs/content/docs/progress/pending-test.mdx` | 1 | 登记合并 |

## W1-a 未决明细：user-data-sync.ts 12 块（卡 06 域，地形已探明 2026-09-22）

上游 `35ebed30` 侧 = **整函数重写**（新增/改写）：
- `loadCanvasProjectForEditing(id, { latest?, historyRestore?{snapshotId,revision}, onLoad? })` —— 签名扩展（块 1）；
- `preserveAgentConflict(project)` + `preserveCanvasSyncDraft(project)`（块 4，「云端画布已有更新，请保留草稿并加载最新版本」）；
- `flushCanvasStorePersistence()` 调用点（块 3）、`repairMissingCanvasAssets(changedProjectIds, incrementalSession)`（块 7）；
- revision 校验：`saved.revision !== source.revision! + 1` → 抛 409「服务端未返回有效画布版本，请加载云端最新版本」（块 9）；
- 同步进度 store：`setProjectProgress(id, { phase, message })`（块 3/4）；media/asset 绑定修复与「素材先于画布」保存顺序（块 6）。

我方侧 = **水位门 + 临界区**：
- 水位判据注释「本地在'上次确认同步'之后修改过（含上一会话同步失败的残留）时，不得静默采纳远端覆盖；远端在水位之后也变了 → 双向分歧抛冲突；仅本地领先 → 保留本地交既有防抖同步」（块 2）；
- `flush` 的无锁变体（调用方必须已持 `withRemoteUserDataSyncExclusive` 临界区；撤销事务 flush→POST→adopt 三步同区，review 2026-09-21 P2）（块 6）；`discardLocalCanvasProject`（块 1）。

**重核要点（下一轮执行）**：把"水位门"落在上游新签名 `loadCanvasProjectForEditing` 的新分支结构里（latest/historyRestore/onLoad 之外），并确认上游 `preserveAgentConflict` 草稿路径不与水位门双重拦截；块 5/8/10 为缩进/格式与尾部收尾差异（机械取上游或我方缩进一致侧）。
