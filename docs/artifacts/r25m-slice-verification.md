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

---

## 九、★ 跨枝约束核查（控制线 2026-10-04 知会项）

控制线知会：F-08 已裁定 **A 合并路线**（既有 annotationEdit 链的工程化增强），
`capability-entries.ts` 将出现第三个条目 `image.annotateEdit`，R25m 分片验收时
「条目可查」检查以**最终条目数 3** 为口径。

### 9.1 实测：条目数口径需澄清

**全 refs 实测**（`git for-each-ref` 遍历，含远端）：

| ref | capability-entries.ts 条目数 | 条目 id |
|---|---|---|
| `main` | 1 | `image.superResolve` |
| `fork/main` | 1 | `image.superResolve` |
| `feat/r25m-registry-collection`（本枝） | 1 | `image.superResolve` |
| `feat/ecom-f08-annotate`（F-08，**未提交**） | **2** | `image.superResolve` + `image.annotateEdit` |
| `feat/o03-l2-superresolve` | 1 | `image.superResolve` |

**F-08 侧证据**：
- `web/src/lib/canvas/capability-entries.ts` 为 **`M`（已修改未提交）**，含 `image.annotateEdit`（L123）
- `web/test/annotate-edit-entry.test.ts` 为 **`??`（未跟踪）**，其断言原文（L163）：
  「档 1 筛选包含**两个**原生条目（superResolve + annotateEdit）」
- F-08 任务书原文（`/tmp/f08-recon-draft.md` L89）：`capability-entries.ts` → **+1 条目**

⇒ **F-08 交付后总数 = 2 条**（1 既有 + 1 新增），**不是 3 条**。
「3 条」口径与 F-08 任务书（+1）和 F-08 测试（两个）**均不一致**。

**处置**：本枝按**实测口径**推进（当前 1 条，F-08 合入后 2 条）；
若控制线确需 3 条，请指明**第三条的来源**（本枝未发现任何第三条目规划，
全 refs 搜索 `image.annotateEdit` 仅命中 F-08 一处）。

### 9.2 ★ 跨枝阻断风险（R25m 门① 与 F-08 条目不兼容）

**风险**：R25m 门① 把 `entryPoints` 与 `registryVersion` 升为 **`CapabilityEntry` 必填字段**，
而 F-08 的条目（在 F-08 枝上编写，早于 R25m 合入）**不含这两个字段**：

| 条目 | `entryPoints` | `registryVersion` |
|---|---|---|
| `image.superResolve`（R25m 本枝） | ✓ | ✓ |
| `image.superResolve`（F-08 枝，旧 schema） | **✗ 缺失** | **✗ 缺失** |
| `image.annotateEdit`（F-08 枝） | **✗ 缺失** | **✗ 缺失** |

⇒ **F-08 需补两条**（其 `superResolve` 条目也基于旧 schema，非仅新增的那条）。

**合入后果（无论先后）**：
1. `tsc --noEmit` 报错：`Type '{ id: ... }' is missing 'entryPoints' / 'registryVersion'`
2. `registry-namespace-guard.test.ts:80` → `expect(entry.entryPoints.length)` 抛 TypeError
3. `registry-namespace-guard.test.ts:91` → `expect(Number.isInteger(undefined))` 失败

**这是门①「回改实码」的必然跨枝外溢** —— 架构方案 §1.4 把两字段列为「待建（需回改实码）」，
但**未写明「既有/在飞条目需同步补字段」**。本枝发现并登记。

### 9.2.1 ★ 实测确证（2026-10-04，控制线裁定后补）

**F-08 tip 已移至 `b182ef97`（C3 注册表与入口已落地）**，本枝做了**临时试合并实测**：

| 步骤 | 命令 | 结果 |
|---|---|---|
| ① 试合并 | `git merge --no-commit --no-ff b182ef97` | **文本无冲突**（两处 auto-merging 自动完成） |
| ② 合并态 tsc | `tsc --noEmit` | **`TS2739` 报错**（见下） |
| ③ 回退 | `git merge --abort` | 恢复 `6a8be55a`，树干净 ✓ |

**tsc 原文**：
```
src/lib/canvas/capability-entries.ts(155,5): error TS2739: Type '{ id: string; name: string;
tier: 1; contextRequirement: "single_image"; assetKind: "capability/tool"; parameterSurface:
[...]; executionChain: {...}; zeroParameterPreset: string; }' is missing the following
properties from type 'CapabilityEntry': entryPoints, registryVersion
```

**三点确证**：
1. **文本层零冲突 ≠ 语义层兼容** —— git 自动合并成功，但类型层阻断。
   这正是「机器护栏」的价值：文本合并会静默通过，只有类型系统/守卫能抓住。
2. **阻断点精确定位** —— `capability-entries.ts:155`，F-08 的 `image.annotateEdit` 条目。
3. **F-08 tip `b182ef97` 的两个条目均缺字段**（不只是 annotateEdit）——
   F-08 基于 `b858bd1d` 起枝，早于 R25m 的门①，因此其 `image.superResolve` 条目
   也是旧 schema 版本（**F-08 需补两条，不只是新增的那条**）。

**建议处置（交控制线裁定，本枝不擅自改 F-08 枝）**：
- **方案 A（推荐）**：F-08 合入前，在其枝上补两字段 ——
  `entryPoints: [{ kind: "node-toolbar", target: "annotationEdit" }]`（F-08 实测工具栏 id）
  + `registryVersion: 1`。R25m 门① 的类型定义与守卫即自然通过。
- **方案 B**：两字段改为可选 + 守卫跳过缺失项 —— **不推荐**（会让「待建字段」失去强制力，
  违背控制线「不许缺字段」的裁定精神）。

**F-08 入口 id 实测**（供方案 A 使用）：`canvas-image-toolbar-tools.tsx` L124 `id: "annotationEdit"`，
label「圈选改图」，group `process`，order 45。

### 9.3 本枝对「条目可查」的现状

R25m 的守卫（`registry-namespace-guard.test.ts`）对 `CAPABILITY_ENTRIES` **逐条遍历**，
不硬编码条目数 —— 因此 F-08 补字段后合入时，守卫**自动覆盖**新条目，无需改守卫代码。
⇒ R25m 侧对条目数**无硬编码约束**，「条目可查」检查天然适配最终条目数。

---

# 片 3-9 逐片验证记录（2026-10-04）

> **依据**：架构方案 §6 收编清单；控制线解锁令（F-08 合入后）
> **分支**：`feat/r25m-registry-collection`（worktree `oac-wt-r25m`，起点 `478cbeea`）
> **纪律**：快照防线先行、逐片验证记录、branch-only、门禁全套
> **收编源以 main 为准**（annotate-edit-* 系列已进 main）

---

## 一、快照防线（防线先行，控制线抽验通过）

| 步骤 | 结果 |
|---|---|
| 收编前快照 | `.local/registry-snapshots/20261004T004149Z-pre-slice3-9` |
| tools.json | sha256 `5f7bff30d2b07bcbe9766deaeb50871b424a4b71ca5d680ecb6939da0703382c` |
| presets.json | sha256 `3551744b3bfb940b2aadfb986115329072b734e73a9be492240b49647ee27156` |
| 基线 | main `478cbeea`（F-08 合入后） |
| 控制线抽验 | 两枚 sha256 与源文件、快照副本**三方逐字吻合** ✓ |

---

## 二、片 3：光照预设 8 条 → `preset/lighting`

| 环节 | 验证方式 | 结果 |
|---|---|---|
| 数据源提取 | 新增 `lib/canvas/legacy-lighting-presets.ts`（46 行） | 8 条逐字搬迁自 dialog 私有 `STYLE_PRESETS` ✓ |
| 消除双份真值 | dialog 改为 `const STYLE_PRESETS = LEGACY_LIGHTING_PRESETS` | dialog 662 行（原 667）✓ |
| 适配 | `registryAssetFromLegacyLightingPreset` | `assetKind=preset/lighting`、`origin=local-fallback`、prompt 非空 ✓ |
| 同源断言 | 源码断言 dialog 引用 lib + 不再内联提示词 | `includes("LEGACY_LIGHTING_PRESETS")===true` / `includes("overexposed film aesthetic")===false` ✓ |
| 提示词逐字 | 抽查 rembrandt | `"Rembrandt lighting, 45-degree angle key light"` ✓ |

**片 3 结论**：24 条中 8 条落地。**搬迁非重设计**（头注明写），`origin: local-fallback` 降级语义正确。

---

## 三、片 4：机位 8 条 → `preset/camera` + 镜头 8 条 → `preset/lens`

| 环节 | 验证方式 | 结果 |
|---|---|---|
| 适配（机位） | `registryAssetFromCameraProfile` | title 取 `zhName` 回落 `label`；group 取 `useCase` ✓ |
| 适配（镜头） | `registryAssetFromLensProfile` | 同上 ✓ |
| **★ §3.3 契约** | 提示词取 `profilePrompt`（**模型面**） | 源码 `registry-adapters.ts` 注释明写模型面/人面之分 ✓ |
| 跨类防撞 | 16 个 slug 去重 | 无重复 ✓ |
| 三值互异 | AssetKind 断言 | `["preset/lighting","preset/camera","preset/lens"]` ✓ |

**片 4 结论**：16 条落地。**零新文件**（直接引既有常量），控制线抽验认可。

---

## 四、片 5：技能场景预设 8 条 → `spec/prompt-template`

**数据源**：`GET /api/skills/presets`（服务端只读目录，与片 1 同构的服务端源）

| 环节 | 验证方式 | 结果 |
|---|---|---|
| 适配 | `registryAssetFromSkillPreset` | `assetKind=spec/prompt-template`、`origin=server` ✓ |
| **★ 形状差异** | 本源是「场景组合」（skillIds/rationale/evidence/upgrade） | 与 tools.json 三组**不同构** —— 已识别并处理 ✓ |
| **★ prompt 留空** | 断言 `prompt === ""` 且 `not.toContain("新手第一站")` | rationale 是**人面**说明，不冒充模型面 ✓ |
| 语义不丢 | skillIds/evidence/upgrade 并入 description | 断言含「技能组合：4 项」「证据等级：E4」✓ |

**★ 降级分支（控制线要求必带）**：

| 测试 | 结果 |
|---|---|
| 服务端不可达 + 无降级源 → `degraded=true` 且空列表 | ✓ **不造数据** |
| 服务端不可达 + 有降级源 → 只收 `origin=local-fallback` 记录 | ✓ |
| 降级文案可读（沿用 `degradedNoticeText`） | ✓ |
| **混入 server 记录被过滤**（防 fallback 冒充服务端数据） | ✓ |

**★ 降级源纪律判定**：skills presets **前端无既有常量**（`grep short-drama-starter` 命中 0）→ 按架构方案 §3.2「禁止把 fallback 当默认路径」「禁止为降级新造第二份真值」，`localFallback` 参数**默认缺省**，服务端不可达时返回空列表 + degraded 标记。与片 1（纯服务端源）同类。

**可证伪性验证**：注入 `degraded: false` → **4 fail**；还原 → 41 pass ✓

---

## 五、片 6：灵感卡 22 条 → `spec/generation`

| 环节 | 验证方式 | 结果 |
|---|---|---|
| 适配 | `registryAssetFromCreationInspiration(inspiration, index)` | 22 条逐条 ✓ |
| slug 构造 | 中文标题不宜作 slug → `creation-<mode>-<NN>` | 22 个 slug 无重复 ✓ |
| 三 mode 覆盖 | video / image / text | 各≥1 ✓ |
| **★ CC0 来源** | `inspirationSource` 断言 | `license=CC0-1.0`、`repository` 含 awesome-chatgpt-prompts、`revision` 为 40 位 hex ✓ |

**★ 口径**：实测 **22 条**（非规格的 23）—— 第 23 条数据不存在，根因是 `grep -c 'title:'` 误计类型定义行（详见主验证记录 §2.3）。

---

## 六、片 7：运镜 33 条 → `preset/motion`（★ 视频域窗口标注）

**判定**：走**既有服务端适配器**（`assetKindFromToolType` 已支持 `motion`），**零新代码**。

| 测试 | 结果 |
|---|---|
| `motion` → `preset/motion`，`origin=server` | ✓ |
| **视频线未启动 → 对用户不可见**（窗口标注生效） | ✓ `videoLineEnabled: false` → `false` |
| **视频线启动后 → 可见**（窗口放开） | ✓ `videoLineEnabled: true` → `true` |
| **★ 收编但不丢弃 —— 数据仍在** | ✓ prompt/title 完整，只是可见性受控 |

**★ 正式口径落地**（架构方案 §6.2）：**数据结构照收编，用户面不下发**。测试明确断言「收编但不丢弃」—— 防「因窗口跳过收编导致视频线启动时返工」。

---

## 七、片 8：九宫格 9 条 → `template/canvas`

**判定**：走**既有服务端适配器**（已支持 `nine_grid`），**零新代码**。

| 测试 | 结果 |
|---|---|
| `nine_grid` → `template/canvas`，`origin=server` | ✓ |
| `aspect` 映射（`ratio` → `aspect`） | ✓ `3:4` |
| **template/canvas 不受视频域窗口影响**（仅 motion 受控） | ✓ |

---

## 八、片 9：渠道规格 3 条 → `preset/channel-spec`

| 环节 | 验证方式 | 结果 |
|---|---|---|
| 适配 | `registryAssetFromEcomChannelPreset` | 3 条逐条 ✓ |
| **★ minPixels 不丢** | 结构化对象（宽/高/说明）并入 description | 断言含「1600×1600」「目标档：4K」✓ |
| **★ prompt 留空** | 同片 5 纪律（不拿人面说明冒充模型面） | 3 条全空 ✓ |
| slug 防撞 | 3 个去重 | ✓ |

---

## 九、片 3-9 汇总

| 片 | AssetKind | 条数 | 源类型 | 交付 |
|---|---|---|---|---|
| 3 | `preset/lighting` | 8 | 本地（搬迁自 dialog） | 新 lib 文件 + 适配器 + dialog 接线 |
| 4 | `preset/camera` | 8 | 本地（既有常量） | 适配器（零新文件） |
| 4 | `preset/lens` | 8 | 本地（既有常量） | 适配器（零新文件） |
| 5 | `spec/prompt-template` | 8 | **服务端**（`/api/skills/presets`） | 适配器 + 读取器 + 降级分支 |
| 6 | `spec/generation` | **22** | 本地（灵感卡） | 适配器（含 CC0 来源断言） |
| 7 | `preset/motion` | 33 | **服务端**（tools.json） | **零新代码**（窗口标注已验证） |
| 8 | `template/canvas` | 9 | **服务端**（tools.json） | **零新代码** |
| 9 | `preset/channel-spec` | 3 | 本地（渠道规格） | 适配器 |
| **合计** | | **99 条** | | 3 commits |

**累计收编进度对照**（架构方案 §6.1 全量清单）：

| §6.1 条目 | 条数 | 状态 | 落点 |
|---|---|---|---|
| tools.json style | 45 | ✅ 片 1 | `registryAssetsFromToolSummaries` |
| legacyCanvasStylePresets | 18 | ✅ 片 2 | `legacy-style-presets.ts` |
| **recommendedCanvasStylePresets** | **8** | ⏳ **未收编** | `canvas-style-system.ts` → `recommendedSelections` |
| 光照 STYLE_PRESETS | 8 | ✅ 片 3 | `legacy-lighting-presets.ts` |
| 相机 CAMERA_PROFILES | 8 | ✅ 片 4 | 适配器直引 |
| 镜头 LENS_PROFILES | 8 | ✅ 片 4 | 适配器直引 |
| skills presets | 8 | ✅ 片 5 | `/api/skills/presets` |
| creationFeaturedWorks | 22 | ✅ 片 6 | 适配器 |
| tools.json motion | 33 | ✅ 片 7 | 既有适配器（零新代码） |
| tools.json nine_grid | 9 | ✅ 片 8 | 既有适配器（零新代码） |
| ECOM_CHANNEL_PRESETS | 3 | ✅ 片 9 | 适配器 |
| **小计** | **170** | **162 ✅ / 8 ⏳** | |
| 评审资产 | 待界定 | ⏳ 边界未定 | `lib/art-critique/` + `components/canvas/art-critique/` |

**★ 唯一未收编项**：`recommendedCanvasStylePresets`（8 条，`canvas-style-system.ts` 的
`recommendedSelections`）—— 它是**推荐选中集**（引用其他 style 预设的 id），
与 style 45 同域。是否收编为独立 AssetKind 或并入 `preset/style` 需判定（**本批未动**，
登记为待办，不静默跳过）。

**评审资产**：边界未界定（架构方案 §2.5 已标注「收编前需先界定」），本批未动。

---

## 十、门禁

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | 0 |
| `eslint src/` | 0 |
| 全量 `bun test` | **2681 pass / 0 fail**（334 文件，+30 vs 片 3-4 的 2660） |
| 适配器单文件 | 55 pass / 0 fail（+30） |

**可证伪性**：降级分支注入假 → 4 fail；还原 → 55 pass ✓

---

## 十一、诚实边界

1. **片 3-4 的 UI 降级态未接** —— 光照/机位/镜头弹窗仍直接消费本地常量（无服务端下发路径），
   因此**无降级态可言**（本地即真值）。降级提示条统一处理归**片 3-9 收口**（控制线认可此分离）。

   ★ **2026-10-04 复核改判：本项关闭（不接）** —— 控制线 2026-10-04 下午批曾将「降级提示条统一收口」
   误写成无条件任务，A 线实测四项事实后提出矛盾（① `tools.json` 无 lighting/camera/lens 类型
   ② 三弹窗 registry 引用 0 处 ③ `registry-reader` 无片 3-4 读取函数 ④ 适配器存在但消费点仅测试）。
   矛盾实质：「降级提示条」语义前提是「服务端主 / 本地兜底」，片 3-4 是纯前端常量（本地即真值），
   提示条会向用户宣告一个不存在的降级状态。控制线复核后裁定 **A（不接，关闭）**，
   并承认下令错误（机械搬运上午记档时未做语义复核）。
   **B（补服务端源）驳回**：新功能开发，量级超 0.5 人日数倍且与 R25m 采集口径冲突；
   **C（统一通路不加条）驳回**：无消费者的重构，将来服务端化需求出现时做才有意义。

   ★ **UI 债台账结转（控制线 2026-10-04 收口令第 3 条）**：
   本项债务状态 = **「不接」**（**不是完成，也不是丢弃，是判明不适用的显式关闭**）。
   结转理由：片 3-4 无服务端源 ⇒ 「降级态」这一概念在片 3-4 上**不存在**，
   债的定义（「UI 未接降级态」）本身不成立。
   **将来重开条件**：片 3-4 若出现服务端化需求（运营改预设不发版），
   届时「降级提示条」才成为真债 —— 重开时按 §3.2 走「服务端优先 + 降级标注」。
2. **片 6/9 的 UI 未接线** —— 灵感卡与渠道规格的适配器已就绪，但页面消费路径未改
   （本批为**数据层收编**，UI 接线归后续）。
3. **片 7/8 零新代码** —— 走既有适配器，本批只补测试覆盖（含窗口标注验证）。
4. **片 5 无降级源** —— skills presets 前端无既有常量，按 §3.2 纪律不新造第二份真值；
   服务端不可达时返回空列表 + degraded 标记。
