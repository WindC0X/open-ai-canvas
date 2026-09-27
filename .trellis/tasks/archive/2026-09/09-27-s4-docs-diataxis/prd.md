# S4 文档 Diátaxis 重排（Quickstart / 四分组 / llms.txt / D6 清账）

## Goal

在本仓**内容层**落地文档 Diátaxis 重排（仓库无文档站构建工程——开源发布时剔除；只做 `docs/content/docs` 内容树 + meta.json + llms.txt + 引用全量同步）：Quickstart 一页（注册 → 首节点 → 首图 → Agent，10 分钟口径）；四分组目录「先认识 / 与 Agent 共创 / 在画布中制作 / 画布与资产」+ Reference 象限；静态 llms.txt；修 README 死链；`pending-test.mdx` 迁出用户文档树（**D6 清账**）。

## 裁决3 落实（2026-09-27 控制线）

- a) 四分组目录 + meta.json：照仓库既有惯例（`docs/content/docs/backend/meta.json` 先例），新目录各补 meta.json。
- b) llms.txt：**静态手工文件，不建生成工程**；内容基准 = `docs/index.md` + content 树页面索引；文件头注释「手工维护，结构变更时同步」。
- c) pending-test.mdx 迁出：脱离 content/docs 用户树即达成；落点自定（拟 `docs/plans/`）；**必须全量重定向**——grep 全仓确认无 `content/docs/progress/pending-test` 残留（活跃面；历史任务/日志记录豁免并明列）。
- d) README 死链顺手修（README:197 `cd docs && bun run types:check` 删/改指 docs/index.md）。
- 额外验收（必做）：16 个 mdx 的移动/重排 = 链接面变更 → README、docs 互链、in-app 引用全量同步并**自证（grep 证据贴终报）**。

## 已核实事实（证据锚）

- 现状树（17 文件）= `backend/`（10 mdx + meta.json）+ `overview/features.mdx` + `plugins/`（4 mdx）+ `progress/pending-test.mdx`（在 `.gitignore` 白名单体系下跟踪；`docs/*` 默认忽略）。
- README 死链（3 处 + 1 处工程）：`overview/quick-start.mdx`（:12/:175）、`canvas/canvas-node-manual.mdx`（:180）、`progress/todo.mdx`（:182）、`cd docs && bun run types:check`（:197）；`docs/index.md` 同样含 todo.mdx 死链。
- 预发布快照（对象库 `ae54dc7f`，非本分支谱系）：曾含 `overview/quick-start.mdx`、`canvas/*`、根 meta.json 等——路径先例可参考，但**以本分支现状为准做重排**。
- llms.txt 历史实现：`docs/src/app/llms.txt/route.ts`（serve = `index.md` + `llms(source).index()`）——静态文件口径照此。

## 目标结构（评审版；含低 churn 备选）

```
docs/content/docs/
  meta.json                        # {title:"文档", root:true, pages:[getting-started, agent, canvas, assets, reference]}
  getting-started/                 # 「先认识」
    meta.json                      # pages: [quick-start, features]
    quick-start.mdx                # 新建（注册→首节点→首图→Agent）
    features.mdx                   # ← overview/features.mdx（git mv）
  agent/meta.json                  # 「与 Agent 共创」（结构占位，内容后续波次）
  canvas/meta.json                 # 「在画布中制作」（结构占位）
  assets/meta.json                 # 「画布与资产」（结构占位）
  reference/                       # 「参考」（dev 向）
    meta.json                      # pages: [backend, plugins]
    backend/  (10 mdx + meta.json) # ← docs/content/docs/backend/*（git mv）
    plugins/  (4 mdx + meta.json)  # ← docs/content/docs/plugins/*（git mv；meta.json 新建）
docs/plans/pending-test.mdx        # ← docs/content/docs/progress/pending-test.mdx（迁出，D6）
docs/llms.txt                      # 新建（静态手工）
```

- `overview/`、`progress/` 清空后移除。
- **备选（低冲突面）**：backend/plugins 不移动，仅在根 meta 以节段分组（W6 同步省 ~14 文件 rename 面）。评审选定；默认推荐当前版（结构更贴四分组+Reference 表述、控制线已预期"16 mdx 移动/重排"）。

## Requirements

- R1 结构：如上；每个新目录 meta.json 照 `backend/meta.json` 键形（title/root/defaultOpen/pages）；现有 backend/meta.json 中不在公开树的条目（protocol-plugins、canvas-data-structure）**保留不动**（可能服务完整站构建，未核实不清理）。
- R2 Quickstart：`getting-started/quick-start.mdx` 新页——结构：目标（10 分钟）/注册进入/创建首节点/生成首图/与 Agent 协作/下一步导航（互链 features 与帮助入口）；文案对照真实 UI 逐条核，宁少勿虚。
- R3 llms.txt：`docs/llms.txt` 静态；头注释「手工维护」；含 docs/index.md 索引指针 + 全部页面清单（路径 + 一句话）。
- R4 引用全量同步：README（导航块 + 验证命令块）、`docs/index.md`、`AGENTS.md` §9 路径行、mdx 互链、in-app 引用（如 S3 的 `DOCS_QUICKSTART_URL`）——一律指向新路径；**历史记录（.trellis/tasks/archive、journal）不动**。
- R5 gitignore 白名单：随新结构更新（新文件可被跟踪；`git status` 自证）；`docs/plans/` 已白名单（pending-test 落点零改动）。
- R6 验证：新增轻量一致性测试（`web/test/docs-diataxis-consistency.test.ts`，读仓库文件）：llms.txt 所列路径存在；各 meta.json pages 均可解析；无活跃面残留旧路径（对白名单文件集断言）。+ 交付时 grep 证据。
- R7 样式/工程纪律：零 `globals.css`；无 web 产品代码改动（允许 S3 常量路径同步）；无新增依赖。

## Acceptance Criteria

- [ ] AC1：四分组目录 + reference 结构落地；meta.json 齐；`overview/`、`progress/` 移除；`git status` 全部变更可见（白名单自证）。
- [ ] AC2：Quickstart 上线且与 UI 实况对照（实现记录核对清单）；README 三处死链与 197 行工程死链处理完毕（README 导航全部指向存在文件）。
- [ ] AC3：llms.txt 存在、内容与树一致（一致性测试绿）；头注释就位。
- [ ] AC4：**D6 清账**：`grep -rn "content/docs/progress/pending-test"` 活跃面 0 命中（白名单：`.trellis/tasks/archive/`、`.trellis/workspace/`、`.trellis/tasks/09-18-f06*` 历史记录豁免并明列）；`docs/plans/pending-test.mdx` 就位。
- [ ] AC5：引用全量同步清单 + grep 证据（README / docs/index.md / AGENTS.md / mdx 互链 / in-app 常量）齐。
- [ ] AC6：**门禁四件**：① `cd web && bun run typecheck` 0 ② `cd web && bun run build` 通过 ③ focused 测试绿（含新一致性测试）④ `bun test` 全量对照测试仓 `open-ai-canvas-testing/docs/env.md` 冻结红基线（15 条 @5a567238）：基线内放行，名单外红 = stop 报控制线。
- [ ] AC7：终报附：结构树快照 + 引用同步 grep 证据 + D6 勾销声明 + 组 2–4「内容待后续波次」明示。

## Out of Scope

- 文档站构建工程重建 / 站点部署 / 重定向基础设施；正文改写（除 Quickstart 新页与必要的链接行）；Changelog 独立页（任务书未列；S3 已链 in-app 弹窗）。
- 历史记录文件（archived tasks/journals）的追改。

## Open Items（评审门报控制线）

1. 目标结构「全移动」vs「低 churn 备选」（§目标结构）——默认推荐全移动版。
2. pending-test 落点 `docs/plans/`（备选 `docs/dev/`）——默认 plans。
3. 组 2–4 空组处理：仅 meta.json（pages:[]）——判定可接受 or 需最小组导语页（后续波次另卡）。


## 产品裁定同步（来自 S3，2026-09-28 控制线）

- **不向用户暴露项目仓库（含上游）**：S4 的 llms.txt / 教程链接口径不得指向 GitHub；教程链接以 `DOCS_BASE_URL`（产品域名文档站待定，单源：`web/src/lib/canvas/canvas-help-links.ts`）为基址拼装 `${DOCS_BASE_URL}/docs/getting-started/quick-start`，S4 文档路径定稿后同步该常量（DOM 实测禁用态 + 「教程编写中」提示已在 S3 落地）。
- 反馈渠道已改为邮件（fengw5774@gmail.com）+ 用户群，S4 文档中如有反馈指引按此口径。


## S4 实现与验证记录（2026-09-28 · 完成）

- 结构：17 个文件 git mv 全部 rename 识别（features→getting-started；backend/plugins→reference/；pending-test→docs/plans/）；五组 meta.json + 根 meta.json + reference/plugins/meta.json 新建；overview/progress 退场。
- 新增：getting-started/quick-start.mdx（10 分钟链路，对齐真实 UI 措辞）；docs/llms.txt（静态手工，16 页索引，文件头注明手工维护）。
- 引用同步（活跃面全量）：README（头部双链 + 3 处正文链 + 导航块 + :197 工程死链清理）/ docs/index.md / AGENTS.md §9 与 3 处 backend 路径 / mdx 互链 7 处（/docs/backend→/docs/reference/backend、/docs/progress/pending-test→/docs/plans/pending-test）/ canvas-help-links 注释对齐 S4 结构。
- .gitignore：docs 内容块按五组重写 + `!docs/llms.txt` + 根 meta.json 白名单；git check-ignore 逐文件核验（全部 trackable）。
- 守卫测试：web/test/docs-diataxis-consistency.test.ts（结构 / meta 可解析 / llms 路径存在 / 活跃面旧路径零命中；遗留豁免与白名单在注释）。
- 门禁：tsc 0 / build ✓ / 全量 2324 测试 → 15 红逐名=冻结基线、零额外。
- 豁免明列（历史记录，不随重排改动）：.trellis/tasks/**（含 archive 与 S4 自身任务书）、docs/design/admin-ui-change-log.md、docs/upstream-sync-recon-*.md、web/dist（构建产物）。
- 产品裁定同步：不向用户暴露仓库已落 S4 口径（教程链接单源 DOCS_BASE_URL + getting-started/quick-start；llms.txt 无 GitHub 指向）。
- 待填充明示：agent / canvas / assets 三组为结构占位（控制线既定，后续波次补内容）。
