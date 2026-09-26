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
