# S4 设计：内容层 Diátaxis 重排

## 1. 移动清单（git mv，一次提交内完成）

| 源 | 目标 | 说明 |
|---|---|---|
| `docs/content/docs/overview/features.mdx` | `getting-started/features.mdx` | 用户树 |
| `docs/content/docs/backend/*`（10 mdx + meta.json） | `reference/backend/` | dev 象限 |
| `docs/content/docs/plugins/*`（4 mdx） | `reference/plugins/` | dev 象限 |
| `docs/content/docs/progress/pending-test.mdx` | `docs/plans/pending-test.mdx` | D6 迁出（`docs/plans/` 已在白名单） |
| `overview/`、`progress/` 空目录 | 移除 | git 不跟踪空 dir，随之消失 |

## 2. meta.json（照 `backend/meta.json` 键形）

- 根：`{"title":"文档","root":true,"pages":["getting-started","agent","canvas","assets","reference"]}`
- `getting-started/`：`{"title":"先认识","root":true,"defaultOpen":true,"pages":["quick-start","features"]}`
- `agent/`：`{"title":"与 Agent 共创","root":true,"defaultOpen":true,"pages":[]}`
- `canvas/`：`{"title":"在画布中制作","root":true,"defaultOpen":true,"pages":[]}`
- `assets/`：`{"title":"画布与资产","root":true,"defaultOpen":true,"pages":[]}`
- `reference/`：`{"title":"参考","root":true,"defaultOpen":true,"pages":["backend","plugins"]}`
- `reference/plugins/`：新建（title 插件；pages = 4 mdx 顺序）。
- `reference/backend/meta.json`：随移动保留；**未核实条目不清理**（protocol-plugins / canvas-data-structure 保留/或不保留？——保留，注释说明见交付）。

## 3. Quickstart 内容大纲（实现时逐条对照 UI）

1. 这篇文档帮你 10 分钟跑通：注册 → 首节点 → 首图 → Agent。
2. 注册与进入：打开站点 → 注册/登录 → 进入画布（已有账号直接登录）。
3. 创建第一个节点：左栏「添加节点」或空白画布引导（对齐实况：文本/图片等）。
4. 生成第一张图：选模型 → 写提示词 → 参数（比例/分辨率）→ 生成 → 查看结果（对齐现 UI 措辞）。
5. 和 Agent 一起创作：右侧 Agent 面板 → 新对话 starter 卡（如「白底产品图」）→ 描述 → 审批 → 结果落画布。
6. 下一步：功能清单（互链）/帮助菜单（快捷键、反馈）/文档四分组导览。
- 纪律：不写未验证能力；不承诺价格/速度数字；中文。

## 4. llms.txt 格式（静态）

```
# 影策 · llms.txt
<!-- 手工维护：文档结构变更时同步更新（不建生成工程） -->

> 影策（open-ai-canvas）用户与开发文档的机器可读索引。文档总索引见 docs/index.md。

## 用户文档
- [快速开始](content/docs/getting-started/quick-start.mdx)：10 分钟跑通注册→首节点→首图→Agent
- [功能清单](content/docs/getting-started/features.mdx)：…
## 参考文档
- [本地开发](content/docs/reference/backend/local-development.mdx)：…
（全量页面 × 一句话）
```

## 5. 引用同步面（grep 清单）

| 文件 | 动作 |
|---|---|
| `README.md` | 导航块重写（Quickstart/features/code-map/本地开发/数据库/插件系统/待测试=plans）；:12 链接改 `getting-started/quick-start.mdx`；:197 工程死链删或改指 docs/index.md；canvas-node-manual/todo 死链移除或改指现有页 |
| `docs/index.md` | 路径更新（features→getting-started、backend→reference/backend、pending-test→plans）；todo 死链行移除 |
| `AGENTS.md` §9 | "功能/代码地图/待办/待测试"路径行更新（去 todo 或标暂缺；pending-test→docs/plans/） |
| `web/src/lib/canvas/canvas-help-links.ts`（S3 产物，如已存在） | Quickstart 路径与新结构核对 |
| mdx 互链 | 全量 grep `docs/content/docs/` 引用点逐一改 |

证据留存：终报贴 `grep -rIn` 输出（活跃面白名单注明）。

## 6. .gitignore 白名单更新（示意；实现时以 `git check-ignore` 逐文件验证）

- 头部新增：`!docs/llms.txt`。
- docs/content 白名单块重写为五组结构（getting-started / agent / canvas / assets / reference 及各文件）；删除 overview/plugins/backend 旧条目或保留按需。
- `docs/plans/` 已白名单 → pending-test 零改动。

## 7. 一致性测试（新）

`web/test/docs-diataxis-consistency.test.ts`（bun test，仓库根相对读取）：
- llms.txt 中每个 `content/docs/...` 路径存在；
- 每个 meta.json 的 pages 条目在对应目录可解析（文件或子目录）；
- 目标树的顶层五目录齐全；`overview`/`progress` 不存在；
- 活跃面旧路径零命中（对指定文件集做读文件断言，白名单在测试内注释）。

## 8. 风险与回滚

- 风险1：外部站点消费 meta.json 的行为不可本仓验证 → 遵守既有文件形态，结构变更集中在"新增目录+平移"（可逆）。
- 风险2：移动面 W6 同步冲突成本（rename detection 通常可判）→ 备选方案已列（prd §目标结构），评审可切换。
- 回滚：单 commit 全量 revert（git mv 可逆）。
