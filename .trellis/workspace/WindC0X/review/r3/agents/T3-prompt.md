你是独立代码评审员。任务：缝隙池批补审（主面②）+ 副面③（T3）。只读，不改代码。

先读 /tmp/review-r3/shared-context.md（★ 环境禁令必须遵守）。

## T3-A 主面② 缝隙池批（`d6b6a952`，已合入 main）
读代码：`git -C /mnt/f/CODE/Project/oac-wt-review show d6b6a952:<path>`

文件：
1. `web/src/lib/canvas/registry-asset.ts`（+20）—— 新增可选 source 对象（repository/revision/license/notice）
2. `web/src/lib/canvas/registry-adapters.ts`（+12）—— 注入判据
3. `web/src/pages/create/creation-workspace-empty.tsx`（接线）
4. `web/test/gap-repair-wiring.test.tsx`（新增，测试）
5. `web/test/registry-adapters.test.ts`（+3 测试）
6. `docs/artifacts/w5-gap-repair-scope.md`（新增 183）
7. `docs/artifacts/issue-13-partial-capability-audit.md`（+47 勘误）

**重点①：§3.4 source 字段注入判据的语义稳固性**
- 判据原文：「以单条角色名 source 存在为判据附结构化来源（实测恰 8 条 = CC0 改编清单）」
- **语义质疑**：`inspiration.source` 的实际值是什么？（读 `web/src/pages/create/creation-inspirations.ts`）它真的等价于「CC0 改编」吗？
  - source 存在但非 CC0 的条目会被误标吗？
  - CC0 改编但 source 不存在会漏标吗（仍显示「原创提示词」）？
- **动态验证**：构造反例（source 存在但语义不是许可证标记）看是否被误标

**重点②：UI 判据等价性**
- 批称「SSR HTML 长度 16713 前后逐字节一致」——**长度相同 ≠ 内容相同**，核对内容
- 检查 `creation-workspace-empty.tsx` 渲染逻辑：适配器产出字段（mode→group / title / image→coverUrl / description / prompt / source）是否与原来逐字对应

## T3-B 副面③：R1 四条未复核线索（容量允许）
1. 三段式 id 零报警（`image.annotate.edit` 变异 → 测试是否全绿）
2. `assetKind` 落枚举纪律空转（改成留槽值 `asset/audio` 是否零报警）
3. 12/12 legacy prompt 与 UI 实际 prompt 不同源
4. `signal` 参数声明与实现不符
（范围：`web/src/lib/canvas/registry-*.ts` + `web/test/registry-*.test.ts`）

## T3-C 副面③：R2 两条动态验证（容量允许）
1. P2-3 角色卡门控可达性：`add-node-menu-tools.tsx` 的 project-character 条目无 `applicable: isProjectLinked`——非项目画布下点击会怎样？（读 `onOpenProjectCharacters` 实现）
2. P2-6 analytics 时间窗：`backend/internal/repository/analytics.go` 的 `whereTimeRange`——补测试验证 `+08:00` 与 `Z` 两种落盘写法在同一时间窗都能取到

预算纪律：T3-A 必须完成；T3-B/T3-C 容量允许时做，做不完标注「未做」。
动态验证：`cd /home/windc0x/oac-ext4/oac-wt-baseline/web && bun test <file>`

## 输出
严格按共享上下文格式。写到 `/tmp/review-r3/agents/T3.md`。
最后一行：DONE T3 <发现数>。
