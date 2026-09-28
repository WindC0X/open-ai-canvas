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

---

## 工作增补：A线复工 62-68（2026-09-29 归位补录）

> 归位说明：㊵-61 区段工作增补（原 306 行工作副本）于 2026-09-29 03:56 主 checkout 换代事件中丢失；其中 55-61 依控制线裁定暂不补（会话可回溯）；62-67 为逐字恢复件、68 为关账条目（事件定论见 68）。

### A线复工 62：merge-v1.5.9 三枝合入执行完毕 + fork 推送（2026-09-28）

- 基底 merge-v1.5.8（5a567238 冻结）→ 批次枝 `merge-v1.5.9`（worktree oac-wt-merge-v158）：序1 flora-tokens **6a992438** / 序2 轻量枝 **e09aa903** / 序3 F-06 **e7c24605**；**三枝均零冲突**（PATCH-MAP 双段自动并存；f06∩轻量枝两 rider 文件同源自动合；globals.css 无人越界）。
- 每枝四门禁：序1 = tsc0 / build0 / 全量 **2276-15 全基线** / focused 31-0；序2 = tsc0 / build0 / focused(11件) 94-0 / 全量首跑 16 红 → **控制线裁决 b**：名单外红 = agent-canvas-sync 计时 flake（三枝零触碰；隔离×3 绿；频度 1/3）→ rider **a16924c0**（正等待窗 120→250ms；负窗口语义原样保留）→ 全量 **2355-15 全基线**；序3 = tsc0 / build0 / focused 45-0 / 全量 **2367-15 全基线**。
- **go full（backend）**：首跑默认 10m 超时斩杀 internal/app（600s）；定性=主机负载（包 alone 893s 全绿；三枝零触碰；单测隔离 9.9s pass）→ `-timeout 30m` 复跑 **25 包全 ok / 0 FAIL**（internal/app 861.8s）。口径记：慢主机后端全量须加长超时。
- **PATCH-MAP 增量总账** `d36dcee2`：E1-E7 七行（域外修复 / tool 徽章 / 画质行 / outpaintTier / 硬贴回 / S3 渠道 / O-03；D1/D2 已由轻量枝自登）。
- **fork 推送 + 远端核验**：`fork/merge-v1.5.9=d36dcee2`、`feat/flora-tokens=5ee45989`、`feat/onboarding-ecom-presets=ac12de10`、`feat/ecom-f06-hardblend=4711e5a1` 与本地逐一吻合；main 未动（等终审）。
- 待办：控制线终审 → main 推送；终验 ①-④ 与 test-line batch-12 任务书待点心。

### A线复工 63：hotfix 进树（hover 卡 clamp 侧移 · batch-12 阻断项）（2026-09-28）

- 控制线指令：轻量枝 hotfix（`feat/onboarding-ecom-presets @830b1381`，正文 90e6218d）合入批次树。
- 合并 **bbb8349b**（零冲突；改动面：tool-hover-card.tsx +20 / 测试 +55 / prd +8 / pending-test +7）。
- 四门禁：tsc 0 / build 0 / focused 定位组（hover 族 3 件）37-0 / 全量 **2368-15 逐名全基线**（+1 测试来自 hotfix）。
- fork/merge-v1.5.9 已推送更新（d36dcee2 → bbb8349b），远端核验吻合；回待命，等 batch-12 复验。

### A线复工 64：hotfix-2 进树（expands 命令 active 态禁卡 · batch-12 阻断项）（2026-09-28）

- 控制线指令：轻量枝 hotfix-2（`feat/onboarding-ecom-presets @b4dd17c3`，正文 9a028a02）合入批次树。
- 合并 **06bc4a1c**（零冲突；改动面：floating-dock.tsx +4/-1 单行挂点 + 守卫测试 +12 / prd +7 / pending-test +7）。
- 四门禁：tsc 0 / build 0 / focused hover 族 38-0 / 全量 **2369-15 逐名全基线**（+1 测试来自 hotfix-2）。
- fork/merge-v1.5.9 已推送更新（bbb8349b → 06bc4a1c），远端核验吻合；回待命。

### A线复工 65：终批合树（hotfix-3 + B线 micro-rider）+ 双全量门（2026-09-28）

- 控制线终批合树令：两枝依次进树（零冲突预期→实零冲突）。
- merge ① hotfix-3 **6e8187e2**（双父 06bc4a1c + eada7ccb；9 文件 +129/-6）；merge ② B线 micro-rider **7b373abb**（双父 6e8187e2 + 22e789d0；10 文件 +296/-13）。
- 门禁：tsc 0 / build 0 / focused hover 族+新增守卫 76-0（另关联守卫 24-0）/ web 全量 **2374-15 逐名全基线**（2389 tests）/ **go full（-timeout 25m 必带）25 包全 ok、0 FAIL（internal/app 844.0s）**。
- PATCH-MAP 终批增量 **7a0e5ce1**（E8 hotfix-3 三文件语义 / E9 B线 rider 归一化+mask 通道）。
- fork/merge-v1.5.9 推送（06bc4a1c → 7a0e5ce1），远端核验吻合。
- 下一步：测试线从新 HEAD（7a0e5ce1）重跑 batch-12 全流程 → 全绿报控制线终审 → 推 main。

### A线复工 66：dock 让位 rider 进树（web-only 微增量）（2026-09-28）

- 控制线微增量令：light @5a5ac8f1（正文 4dc8c251）进树。
- merge **72001f6a**（双父 7a0e5ce1 + 5a5ac8f1；零冲突；4 文件 +84/-1，含新守卫 canvas-panel-dock-clearance.test.ts）。
- 门禁（web-only 口径，go full 免）：tsc 0 / build 0 / focused 43-0（新守卫 3/3 + hover 族）/ web 全量 **2377-15 逐名基线**（2392 tests/312 files）。
- PATCH-MAP **E10** 登记提交 6b9b2ebd；fork/merge-v1.5.9 推送（7a0e5ce1 → 6b9b2ebd），远端吻合。
- 下一步：测试线复验 A/B 位 + VRT 受影响面（非全流程）→ 终审 → main。

### A线复工 67：rider-2 进树（dock-clamp 撤回 + z 梯级 + hover 卡 1150 + 看门狗）（2026-09-29）

- 控制线合树令：light @903851f9（正文 925dae87 + 修正轮 d66f3aaf）进树。
- merge **93856ffd**（双父 6b9b2ebd + 903851f9）；**PATCH-MAP.md 单点真冲突**（D3 插入点 ↔ 批次节同位）→ 解：D3 归位形态偏离表（header 保留「另含 D3」版）/ E10 标注「已被 E11 取代」（保留登记不删除）/ E11（`--z-global-tools:160`）与 globals.css 增量对账一致；其余全自动合。
- 门禁（web-only 口径，go full 免）：tsc 0 / build 0 / focused 51-0（dock-clearance + hover 卡 + hover 族 + image-source）/ web 全量 **2380-15 逐名基线**（2395 tests）。
- fork/merge-v1.5.9 推送（6b9b2ebd → 93856ffd），远端吻合。
- 下一步：测试线一次性复验（A/B 新语义 + 纯贴附回归 + dock 穿越 + 卡层级 1150 vs 弹层 1100 + 看门狗 + VRT 受影响面）→ 终审 → main。

### A线复工 68：batch-12 / merge-v1.5.9 终审通过 · main 推送（含非 ff 处置）+ 台账归位 rider（2026-09-29）

- 控制线终审通过（测试线四跑全绿 @7a0e5ce1 + 五跑行为位五项/守卫 35 @93856ffd + VRT 24 全量复跑全绿〔685bc1a 适配〕；rider-2 语义留档 b12r6-verify）。
- main 推送预检非 ff → 停报；控制线裁决 a：main 侧 4 个批次九历史 docs（merge-batch9-plan / conflict-map-129 / ruling-cards/07 / merge-w1-progress，自 1d252642）属正当内容，integrate 并入；force 红线维持。
- integrate merge fe7763dc（双父 93856ffd + 1d252642；零冲突；+4 docs / 229 行；tsc 0）。
- 推送（ff）：fork/main: 1d252642 → fe7763dc；fork/merge-v1.5.9 同步；远端核验双 ref = 本地 ✓。
- **03:56 换代事件定论**（控制线会话取证）：执行者 = 7dot 项目 pi 会话（处理 CPA thinking 耗时问题期间做画布 v1.5.8 更新，在主仓 checkout v1.5.8，被台账本地改动阻挡后清 index.lock 强切）——非用户 / 非控制线 / 非 A线；台账 55-61 增补丢失根因即此。主 checkout 已由控制线复位 `main @ fe7763dc`。**教训：跨项目仓库操作须先确认归属。**
- 台账归位 rider（本条目落卡）：62-67 逐字恢复件归位 + 55-61 缺口显式标注 + flowith 思考档（5c2e860d）过继（内容原样）。
- 回待命。
