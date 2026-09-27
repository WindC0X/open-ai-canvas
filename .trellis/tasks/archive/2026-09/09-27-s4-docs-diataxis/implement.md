# S4 执行计划

> 前置：先读 `design.md` + prd §Open Items（结构选型评审结论到位后执行）。提交信息建议 `docs(diataxis): 文档重排 - 四分组 + Quickstart + llms.txt + pending-test 迁出（D6 清账）`。

## Step 0：核对
- [ ] 0.1 评审结论确认（结构全移动版 / 备选；pending-test 落点）。
- [ ] 0.2 `git status` 干净；记录既有 docs 跟踪集（17 文件）作为移动前快照。

## Step 1：结构移动 + 新文件
- [ ] 1.1 `git mv` 四组移动（features / backend / plugins）；`git mv` pending-test → `docs/plans/pending-test.mdx`。
- [ ] 1.2 新建 getting-started/agent/canvas/assets/reference meta.json + reference/plugins/meta.json + 根 meta.json。
- [ ] 1.3 新建 `getting-started/quick-start.mdx`（大纲见 design §3；逐条对照 UI 填写）。
- [ ] 1.4 新建 `docs/llms.txt`（design §4 格式，全量页面）。
- [ ] 1.5 `.gitignore` 白名单更新；`git check-ignore -v` 逐新文件验证（应显示未忽略）。

## Step 2：引用同步
- [ ] 2.1 README 导航块 + :12 + :197 处理（三死链全清）。
- [ ] 2.2 docs/index.md 路径更新 + todo 死链处理。
- [ ] 2.3 AGENTS.md §9 路径行。
- [ ] 2.4 mdx 互链 + in-app（S3 常量）grep 全量核对。
- [ ] 2.5 留证据：`grep -rIn "content/docs/(progress|overview|backend|plugins)/" --exclude-dir={.git,node_modules}` 活跃面清单 → 修正至白名单外零命中。

## Step 3：一致性测试 + 门禁
- [ ] 3.1 `web/test/docs-diataxis-consistency.test.ts`。
- [ ] 3.2 `bun run typecheck`（=0）→ `bun run build`（通过）。
- [ ] 3.3 `bun test` 全量对照红基线（15 条内放行；名单外红=stop）。

## Step 4：交付
- [ ] 4.1 独立 commit（仅 S4 文件集：docs/ + README + AGENTS.md + 测试 + .gitignore）。
- [ ] 4.2 汇报：结构树快照 + 引用同步 grep 证据 + **D6 清账声明** + 组 2–4 待填充明示。

## 回滚点
- 单 commit revert；git mv 全链可逆。


## S4 执行记录（2026-09-28 · 完成）

- Step 0：移动前跟踪集快照 17 文件；git status 起始干净。
- Step 1：.gitignore 重写先行（避免 rename 被 ignore 拦截）→ 17 个 git mv（全部 R 识别）；meta.json ×8（含随迁）；quick-start.mdx；llms.txt。
- Step 2：引用同步见 prd 记录；grep 旧路径活跃面零命中（豁免：历史任务/日志/构建产物，明列于 prd 记录与终报）。
- Step 3：新守卫测试 4 用例绿；门禁四件：tsc 0 / build ✓ / 全量 15 红=基线零额外。
- Step 4：正文 + 落卡双 commit，不 push。
