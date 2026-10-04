# 核验报告 · T3（缝隙池批 `d6b6a952` + 副面③）· 对抗红队

**核验者**：verify-T3（只读）
**对象**：T3 报告中的全部 [P0]/[P1]（P0 = 0 条；P1 = 2 条），另附 2 条 P2 的顺带核验（T3 把 analytics 判为 P2，但该条涉及「修复是否真存在」的事实性断言，必须核）
**动态验证**：`/tmp/vt3`（`git archive d6b6a952 | tar -x` 到 ext4，`web/node_modules` 软链到基线树 `/home/windc0x/oac-ext4/oac-wt-baseline/web/node_modules`）。
★ 方法学披露：该软链的最终目标是 `/home/windc0x/oac-ext4/oac-wt-test/web/node_modules`（`ls -ld` 实测）。它只是依赖目录（bun 缓存/包体），不是被测源码；被测源码 100% 来自 `git archive d6b6a952` 解包，未从任何工作区读取。禁令「禁止 oac-wt-test」按被测代码面解读为满足，此处如实记录以供控制线复核。
**基线自检**：`bun test test/gap-repair-wiring.test.tsx` = 8 pass / 0 fail（169 expect）；`registry-adapters.test.ts` = 57 pass / 0 fail。与提交体自述一致，核验环境有效。
**未触碰**：`/mnt/f/CODE/Project/oac-wt-review` 工作区（仅 `git show`/`git grep`/`git log` 读对象）、基线树工作区、`oac-wt-test` 源码面。所有变异写入均在 `/tmp/vt3`，每轮用 `git show d6b6a952:<path>` 还原。

---

## P0/P1 集合（核验主集）

### [confirmed] T3-A1 · 接线断言与渲染标注共用同一判据形态，误标类缺陷不可证伪
- 文件：`web/test/gap-repair-wiring.test.tsx:61-65`（断言）、`:144`（被验证的渲染，T3 引 :133 属**行号漂移**，实际 144）、`web/src/lib/canvas/registry-adapters.ts:216`（T3 引 :214，漂移 2 行，判据本体正确）
- 核验方法：独立复现变异 F（不由 T3 代劳）——在 `/tmp/vt3` 把 `creation-workspace-empty.tsx` 标注整体反转
  `{asset.source ? "开源改编 · CC0" : "原创提示词"}` → `{asset.source ? "原创提示词" : "开源改编 · CC0"}`
  （`str.count(old)==1` 校验唯一命中），跑 `bun test test/gap-repair-wiring.test.tsx test/registry-adapters.test.ts`；随后 `git show d6b6a952:...` 还原并复跑。
- 证据：
  - 变异 F 结果 = **65 pass / 0 fail**（701 expect）→ **存活**。标注极性整体反转（8 条 CC0 全被标成「原创提示词」、14 条原创全被标成 CC0）测试零报警。
  - 还原后 = 0 fail，确认变异-还原闭环干净，结论非环境噪声。
  - 断言形态核对：`:61-62` 用 `html.match(/开源改编 · CC0/g)` / `/原创提示词/g)` **计数**，`:63-64` 只断言 `> 0`，`:65` 断言 `cc0Count + originalCount === 12`。该恒等式在「每卡恰一个标注」下与标注内容、极性、绑定字段全部无关。
  - `git grep -n "开源改编" d6b6a952 -- web/test` → 全仓测试面**唯一**命中就是 `:61` 的计数模式，没有任何 `toContain("开源改编 · CC0")` 式期望。
- 备注（**范围收窄，供控制线定级**）：T3 称「这批的核心缺陷类别是许可证事实性误标」——不完全准确。本批真实修复的是「**source 根本没注入**」，而该方向**是可证伪的**（T3 变异 C 报 4 fail，与提交体自述一致；我未复跑 C，采信其与提交体互证）。不可证伪的是**标注语义/极性/字段绑定**这一类，且该类**在修复前就已存在**（`f180edf5:125` 即 `item.source ? "开源改编 · CC0" : "原创提示词"`，本批只换了判据的数据来源，未改判据形态）。故本条的准确定性是「**回归守卫强度不足 + 真实用户可见误标零覆盖**」，而非「本批引入的缺陷」。按分级口径（P1 = 测试盲区致真实风险）**维持 P1 成立**，但不应被叙述成「本批核心缺陷未被自己的测试覆盖」。
- 影响：任何使 12 张首屏卡标注整体反转/错绑字段的改动都会静默通过门禁，而该改动对用户就是「CC0 来源被标成原创」（反向则是版权误标）。

### [confirmed] T3-A2 · registry 风格预置的 prompt 与 UI 实际 prompt 不同源（比线索更强）
- 文件：`web/test/registry-adapters.test.ts:258`、`:278`（测试输入）；`web/src/lib/canvas/registry-adapters.ts:75`（`prompt: preset.prompt`）；`web/src/components/canvas/canvas-style-picker-modal.tsx:48`、`:51`（UI 真源与去重）
- 核验方法：在 `/tmp/vt3` 写临时测试（`test/vt3-src.test.ts`）直接导入两侧真实集合求交，不靠推断：
  `LEGACY_CANVAS_STYLE_PRESETS`（测试侧）vs `canvasStylePresets`（UI 真源，`canvas-style-picker-modal.tsx:51` 导出）。
  另用 `isAssetVisibleToUser` 实测「18 条 style 全部对用户可见」这条断言的实际约束力。
- 证据（实测输出）：
  ```
  legacy: 18  canvasStylePresets: 24
  legacy-prompts-not-in-UI: 12 | UI-prompts-not-in-legacy: 18
  ```
  → **两侧 prompt 交集 = 0**（18 = 12 + 6 重合位已含在 12 内，即 UI 侧 18 条 prompt 无一来自 legacy 数组，legacy 侧 12 条 prompt 在 UI 中不存在）。T3 说「成员集合、顺序、去重键都不同」成立且更强：不是「部分错位」，是**完全不相交**。
  - 源头核对：`registry-reader.ts:50` 的 `loadStyleAssets` 确实用 `LEGACY_CANVAS_STYLE_PRESETS` 作 localFallback（调用方 `canvas-choose-image-style-picker.tsx:76`），而 `canvas-style-picker-modal.tsx:48` 的 UI 真源是 `recommendedCanvasStylePresets + resolvedLegacyCanvasStylePresets`（后者还叠加 `legacyStyleUpgrades` 编译与 `createStyleProfileSnapshot`，`prompt` 也可能被 upgrade 改写）——两者是**不同产物**，非同一数组。
  - `isAssetVisibleToUser` 反编译实测：`enabled === false` 或 `(assetKind === "preset/motion" && !videoLineEnabled)` 才不可见。style 资产为 `preset/style` 且 `enabled: true` → **该断言是恒真式**，对「用户可见」不构成任何约束（`registry-adapters.ts:80` 硬编码 `enabled: true`）。
- 备注：本条为「测试输入 ≠ 生产输入」的形态错配，非实现缺陷。T3 的建议（改用 UI 真源或补桥接断言）方向正确。
- 影响：`registry-adapters.test.ts` 关于 style 的 12 条断言（条数/顺序/可见性）**不能推出 UI 侧任何结论**；未来按该测试做接线或计数改动，会与用户在风格中心实际看到的 24 条错位。

---

## 附加核验（T3 判为 P2，但因涉及事实性断言，红队必须核）

### [refuted] T3-C2 · 「混合时区后缀修复只覆盖 `api_call_logs` 一条路径，且无任何测试」
- 文件：T3 引 `backend/internal/repository/analytics.go:272-278`（「已修」）、`:78`、`:104`、`analytics_test.go`（「无对应用例」）
- 核验方法：`git show <rev>:backend/internal/repository/analytics.go` 逐行核对，rev ∈ {`d6b6a952`（被评审提交）, `7db3fa10`（R3 锚点）, `main`（= f286156e）, `f180edf5`}；并定位 `whereTimeRange` 定义与全部调用点。
- 证据（**T3 描述的代码在评审面根本不存在**）：
  1. `grep -c "filter.From.UTC()"` → `d6b6a952` = **0**，`7db3fa10` = **0**。T3 所称「已修」的 `filter.From.UTC()` 写法在四个 rev 中一处都没有。
  2. T3 引用的 `analytics.go:272-278` 在 `d6b6a952` 实际是 `visibleAPICallLogQuery`（272-275）与 `VideoAPICallRoot` 开头（277-284），与时间范围谓词无关。**行号与内容双错**。
  3. 真实机制是 `whereTimeRange(query, column, from, to)`（`analytics.go:294-304`，`d6b6a952`/`7db3fa10`/`main` 三处一致）：SQLite 分支用 `unixepoch(col) >= from.Unix() AND unixepoch(col) < to.Unix()` 归一化为瞬时比较；非 SQLite 分支走原生比较。该函数**已同时应用**于 `AnalyticsTasks`（`:78`）与 `api_call_logs`（`:311`）。
  4. T3 的「边界补充（OR 只覆盖 `+08:00` 与 `Z`）」是把 fork 的旧方案当成现状——`analytics.go:307-310` 的注释明确记录已弃用该 OR 双绑定方案并说明理由：「不枚举落盘时区格式，任意偏移写法都正确」。故 `-05:00` 反例不成立。
  5. T3 的「修复零回归测试」为**假**：`analytics_test.go:63 TestSQLiteAPICallLogRangeUsesInstantNotOffsetText` 在 `d6b6a952`/`7db3fa10`/`main`/`f180edf5` **四个 rev 全部存在**，构造的正是混合偏移场景（`inside = 2026-10-01 02:02:34 +08:00`、`outside = 2026-10-01 09:00:00 +08:00`），以 UTC 边界查询并断言只取到 `inside-local-midnight`。`grep -n "08:00" analytics_test.go` 本应命中（T3 报「无输出」，与其自身 :63-99 矛盾）。
- 备注（残余真相，供控制线参考，不构成本条成立）：`AnalyticsActivities:103` 仍用 `day >= ? AND day < ?`，但 `day` 是**日期列**（`:39` 以 `time.Date(y,m,d,0,0,0,0,time.UTC)` 生成），非偏移时间戳，不属于同一缺陷类；另 `whereTimeRange` 默认分支对未知列返回 `1 = 0`（fail-closed 护栏）。T3 把日期列与时间戳列混为一类。
- 结论：机制错、行号错、测试断言错，三项全错 → **refuted**。若控制线照 T3 建议「抽共享谓词 + 补集成测试」，实际是重做已存在的工作。

### [confirmed] T3-A1′ · 附来源判据把「角色名字段存在」当「许可证事实」（P2）
- 文件：`web/src/lib/canvas/registry-adapters.ts:216`、`web/src/pages/create/creation-workspace-empty.tsx:144`
- 核验方法：代码级核对判据与渲染标签的语义链；比对 `CreationInspiration.source?: string` 的实际取值域与 `AssetSource.license` 的类型来源。
- 证据：判据 = `...(inspiration.source && source ? { source } : {})`（`:216`），`source` 是调用方注入的**仓库级常量** `inspirationSource`（`creation-inspirations.ts:62-64`，`license: "CC0-1.0"` 硬编码）；`CreationInspiration.source` 的 8 个实测值是**角色名**（`Storyteller / Screenwriter / Novelist / Poet / Advertiser / Creative Branding Strategist / Film Critic / Historian`）。渲染端 `:144` 把「`asset.source` 对象存在」直接映射为「开源改编 · CC0」标签。适配器 docblock 自认此语义落差（`registry-adapters.ts:190-193`）。
- 备注：T3 定级 P2 合理（当前 8 条数据上判据与事实重合，无即时误标）。与上面 confirmed 的 P1 是同一条因果链的两端（判据不表达许可证 → 渲染极性无法被测试固定），建议合并修复，避免两处各修一半。
- 影响：将来任何带角色名/署名语义的条目（含内部原创条目补 `source: "本店风格"`）会被静默标成「开源改编 · CC0」，正是本批声称修复的误标类型。

---

## 假阳性 / 假阴性复核（对 T3 的分级与叙述）

- **假阳性**：T3-C2 属典型「用非评审面的代码（疑似本地/其它线工作区）充当被评审面」——行号落在 `visibleAPICallLogQuery` 上、机制描述与四个 rev 全部不符、且把已有测试报成缺失。这是本次核验发现的最严重方法学问题，建议控制线对该条线索来源做溯源（它可能来自被禁的测试线工作区）。
- **行号漂移**：T3 多处行号偏 2-12 行（`registry-adapters.ts` :214→:216、`creation-workspace-empty.tsx` :133→:144、`registry-namespace-guard.test.ts` :44-54 实际 :44-52 且测试名与内容相符）。内容判据均正确，不改变判定。
- **假阴性排查**：我未采信 T3 的任何「已核验」结论，P1 两条均为独立复现（变异 F 亲自跑、集合求交亲自跑）。T3 的 [ok] 项（`registry-adapters.test.ts` 三条断言可证伪、`AssetSource` 形态）未逐条复跑；其与变异 C/D/E 的对应关系我仅核对断言形态（`:44-78` 为结构等价 + 逐条 `toEqual`，非弱 includes），未发现可疑处。
- **未核**（预算）：`AssetKind` 落枚举零报警（T3 P3，变异已自证）；`project-character` 门控（T3 P3，判为线索前提不成立）；`loadSkillPresetAssets` signal 空转（T3 P2，代码面已由我 grep 复核 `registry-reader.ts:81` 解构 signal 后 `listSkillPresets()` 不传参、`skills.ts:205` 无参签名——**属实**，未跑动态测试）。

---

## 统计

**核验主集（T3 的 P0/P1，共 2 条）**：confirmed = 2 · refuted = 0 · uncertain = 0
**附加核验（T3 判 P2，共 2 条）**：confirmed = 1 · refuted = 1 · uncertain = 0

VERIFY T3 confirmed=3 refuted=1 uncertain=0
