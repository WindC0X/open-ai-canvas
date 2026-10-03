# R25m 收编枝 · 逐片验证记录

> **任务**：能力组织层收编枝最小切片（片 1-2）
> **依据**：`docs/artifacts/capability-registry-architecture.md`（架构方案，已合入 main `f8a15f23`）
> **分支**：`feat/r25m-registry-collection`（worktree `oac-wt-r25m`，起点 `980fdef2`）
> **纪律**：只交分支不合入，门后合
> **日期**：2026-10-04

---

## 一、验收门六项（§6.3 检查表）逐项打勾

| # | 检查项 | 状态 | 交付 commit | 证据 |
|---|---|---|---|---|
| ① | §1 schema 定稿（含 `entryPoints` / `registryVersion` 回改实码） | ✅ | `6ca33bc1` | `capability-entries.ts` 补两字段 + `registry-asset.ts` 统一 schema |
| ② | §2 AssetKind 按**落枚举纪律**落进实码（不是全落 15 值） | ✅ | `6ca33bc1` | 落 13 值（capability 2 + asset 2 既有 + preset 6 + template 1 + spec 2）；`asset/audio` 与 `model/checkpoint` **留槽不落** |
| ③ | §4 防撞守卫 L1 落地（`web/test/` 新增） | ✅ | `6ca33bc1` | `registry-namespace-guard.test.ts` 12 tests / 103 expects |
| ④ | Go seed schema 对齐（补 `desc`/`ratio` 可选说明 + 补 `version` 字段） | ✅ | `41579d35` | `tools.json` 补 version=1；`tools_seed.go` 启动期校验 + `TestBuiltinToolsSeedVersionMatchesCode` |
| ⑤ | 快照脚本就绪（§5.2 防线 1） | ✅ | `711cf4fd` | `scripts/snapshot-registry-seeds.sh`（sha256 + `--verify`） |
| ⑥ | docs 同步点确认 | ✅ | `fcfcceb8` | `code-map.mdx` 补注册表层登记；`backend-database.mdx` 无需同步（未碰表结构） |

**★ 门①③ 的实现中发现的真实缺口（守卫当场证实）**：
守卫首跑即失败 —— `superResolve` **不在** tool-registry 的 4 个定义文件里，而在**手工接线层**
`canvas-image-toolbar-tools.tsx` 的模块私有 `imageToolDefinitions` 中。这正是架构方案 §1.4
预言的「能力条目与按钮层只有注释约定，无机器可校验关联」缺口，被机器护栏当场证实。
处置：导出 `imageToolDefinitions`，守卫枚举面覆盖手工接线层 + registry 定义层。

---

## 二、片 1：tools.json style(45) 全链

**链路**：`seed → DB → API → 统一 schema`

| 环节 | 验证方式 | 结果 |
|---|---|---|
| seed 改动 | 把 `style[0].label` 改为「古装偶像·全链演示」，重启后端 | — |
| ① seed → DB | sqlite 直读 `tools` 表 | 87 条（style 45 / motion 33 / nine_grid 9）；`id=1 label='古装偶像·全链演示'` ✓ |
| ② DB → API | 注册 `r25mcheck` + 登录 + `GET /api/tools?type=style` | `code=0 total=45`；`id=1 label='古装偶像·全链演示' labelEn='period_idol' tag='period'` ✓ |
| ③ API → 统一 schema | 真实 API 响应喂 `registryAssetsFromToolSummaries` | `{slug: period_idol, title: 古装偶像·全链演示, group: period, assetKind: preset/style, origin: server}` —— **改动逐字透传** ✓ |

**片 1 结论**：全链贯通。映射契约（§3.3）逐字段验证通过（`id→assetId` / `label_en→slug` /
`label→title` / `tag→group` / `cover→coverUrl` / `ratio→aspect` / `visibility+favorited→scope`）。

---

## 三、片 2：legacyCanvasStylePresets(18) 全链 + 离线降级

**链路**：`页面私有常量 → lib 数据源 → 统一 schema → 降级态 UI`

| 环节 | 验证方式 | 结果 |
|---|---|---|
| 提取 | 18 条从 `canvas-style-picker-modal.tsx`（L26-369）提取到 `legacy-style-presets.ts` | 18 条 ✓；modal 715 → 369 行（原块删除，无双份真值） |
| 逐条适配 | **逐条**（非抽样）过 `registryAssetFromLegacyStylePreset` | 18/18：`assetKind=preset/style`、`origin=local-fallback`、slug/title/group/prompt 全非空 ✓ |
| 撞车检查 | slug 去重 | 18 个 slug 无重复 ✓ |
| 窗口标注 | 18 条 style 过 `isAssetVisibleToUser` | 全部可见（窗口标注不误伤 style）✓ |
| **降级态** | 后端不可达（端口 59999）→ `loadStyleAssets({localFallback: 18条})` | `degraded=true` / 18 条 / 全 `local-fallback` / 文案「已离线展示内置预设（18 项），未能连接服务端」✓ |
| 接线 | `canvas-choose-image-style-picker.tsx` 的 `isError` 分支 | 渲染降级提示条 + 18 条清单（`opacity-80` 视觉区分），不再只显示「加载失败请稍后重试」✓ |

**★ 接线发现（自身缺陷，已修）**：片 1-2 首提交的读取器 `loadStyleAssets` **无生产消费者** ——
与 F-02 pipeline 同类缺口（模块写完但没接线，功能不可达）。`ba2ec15d` 收口。

---

## 四、★ 快照防线实战验证（防线 1 的第一次真实使用）

| 步骤 | 结果 |
|---|---|
| 收编前快照 | `bash scripts/snapshot-registry-seeds.sh --label pre-r25m` → 两文件 sha256 入 manifest ✓ |
| 篡改检测 | 全链演示改动 seed 后 `--verify` → **当场抓到**（双 hash 对照，退出码 2）✓ |
| 快照还原 | `cp` 快照覆盖 seed → `--verify` 通过（逐字节一致）✓ |
| 可证伪性（三次） | ① 初始通过 ② 篡改报 ✗ + 双 hash ③ 还原通过 —— 退出码 0/2/0 ✓ |

**实战发现**：快照是**收编前状态**（无 `version` 字段），用它还原会把门④的 `version` 交付一起回退。
处置：`version` 是已提交交付，还原后改用 `git checkout` 恢复。**教训**：快照用于「收编前状态回滚」，
不用于「代码交付回滚」——二者边界需在收编流程中写清。

---

## 五、守卫可证伪性验证（L1 三条断言各注一次假）

| 断言 | 注入 | 结果 |
|---|---|---|
| 能力层 id 全部含点 | `image.superResolve` → `imageSuperResolve` | 11 pass / **1 fail** ✓ |
| 工具层 id 全部不含点 | `tool-undo` → `tool-undo.bad` | 11 pass / **1 fail** ✓ |
| entryPoints.target 真实存在 | `superResolve` → `nonexistentTool` | 11 pass / **1 fail** ✓ |
| 还原后 | — | 12 pass / 0 fail ✓ |

**★ 验证过程中的一个反证**：首次注入②时误命中同文件的私有 `canvasModeOptions` 数组
（非 `mainToolbarTools`），守卫**正确未报错** —— 反证守卫枚举的是**导出面**而非文件内任意数组。

---

## 六、门禁

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | 0 |
| `eslint src/` | 0 |
| 全量 `bun test` | **2651 pass / 0 fail**（334 文件，+25） |
| `go build -buildvcs=false ./...` | 0 |
| `go test ./internal/tools/...` | ok（含新增版本漂移测试） |
| `gofmt -l` | 无待格式化 |
| `go test ./internal/app/...` | **5 fail（既有基建，非本批引入）** ↓ |

**★ `internal/app` 5 个失败的性质认定**（预存在，非本批引入）：
- 失败集：`TestCloudAgentRuntimeCompletesToolRoundTrip` / `TestCloudAgentRuntimeApprovalWriteRoundTrip` /
  `TestCloudAgentLiveRecallLessonsStreamingRoundTrip` / `TestCloudAgentLiveRetriesTransientUpstreamFailure` /
  `TestCloudAgentLiveDoesNotRetryRejectedRequest`（均为 cloud agent runtime E2E，需 Node runtime）
- 判定依据：在**未改动的 main 基线**上跑同一包，失败测试名**逐字相同**（5/5 一致，仅耗时不同）
- 本枝 backend 改动面 = `tools.json` / `tools_seed.go` / `tools_integration_test.go`（与 cloud agent 零交集）

**途中发现并修复的自身回归**：门①为导出 `imageToolDefinitions` 写的注释里提到了登记处文件名，
触发 O-03 既有守卫 `test/super-resolve.test.ts:92`（「登记位独立」断言不含该字符串）。
判定：守卫意图是「按钮定义文件不承载能力元数据」，注释不构成元数据承载 —— 但守卫是控制线
裁定的机器护栏，**不改守卫语义**，改注释措辞（`f7285913`）。

---

## 七、交付清单

| commit | 内容 |
|---|---|
| `711cf4fd` | 门⑤ 快照脚本（防线 1 实码化） |
| `6ca33bc1` | 门①③ 统一 schema 回改实码 + 命名空间守卫 L1 |
| `41579d35` | 门④ Go seed schema 对齐（version 字段 + 启动期校验） |
| `fcfcceb8` | 门⑥ docs 同步点（code-map.mdx 登记） |
| `f7285913` | 修自身回归（守 O-03 登记位独立裁定） |
| `478c5c1a` | 片 1-2 适配器 + 读取器 |
| `ba2ec15d` | 片 2 接线（legacy 提取 + 降级态接入真实 picker） |

**新增文件**：
- `web/src/lib/canvas/registry-asset.ts`（统一 schema）
- `web/src/lib/canvas/registry-adapters.ts`（两条源适配器）
- `web/src/lib/canvas/registry-reader.ts`（读取器 + 降级标注）
- `web/src/lib/canvas/legacy-style-presets.ts`（18 条离线兜底源）
- `web/test/registry-namespace-guard.test.ts`（命名空间守卫）
- `web/test/registry-adapters.test.ts`（全链测试）
- `scripts/snapshot-registry-seeds.sh`（快照脚本）

**修改文件**：`capability-entries.ts`、`canvas-image-toolbar-tools.tsx`（导出）、
`canvas-style-picker-modal.tsx`（改为 import）、`canvas-choose-image-style-picker.tsx`（降级接线）、
`tools.json`（version）、`tools_seed.go`（版本校验）、`tools_integration_test.go`、`code-map.mdx`

---

## 八、诚实边界

1. **降级态未做浏览器真机验证** —— 降级逻辑经真实网络失败（端口 59999）验证 + 单元测试覆盖，
   但「降级提示条在真实浏览器里的视觉呈现」未截图。理由：本枝为数据链路层，视觉呈现属 UI 验收，
   留给测试线或后续 UI 任务。
2. **片 3-9 未收编** —— 本枝按控制线令只做最小切片片 1-2（打通全链），其余 7 片待后续。
3. **`entryPoints` 目前只有 O-03 一条** —— F-08 的 `image.annotateEdit` 尚未合入 main（B 线在飞），
   合入后其条目需补 `entryPoints`（否则守卫会报「entryPoints.length > 0」失败）。这是**预期的**
   跨枝约束，非缺陷。
4. **`asset/audio` 与 `model/checkpoint` 留槽未落** —— 按落枚举纪律，等真实消费者。
