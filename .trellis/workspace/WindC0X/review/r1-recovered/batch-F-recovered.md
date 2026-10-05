# batch-F 恢复版摘要（R1 · 超分收口 `d60519e3`）

> **来源标注（C4）**：本文件内容 = 评审线 2026-10-05 从**主会话压缩摘要（compaction summary）**中检索恢复，
> 属**压缩摘要转述**，**非原始报告正文**（原文 `/tmp/review-r1/agents/batch-F.md` 16735 字节已随 /tmp 丢失）。
> 恢复内容中，**凡带 `文件:行号` 的段落均可在会话记录中逐字命中**；无标注处为原文缺失。
> 恢复人：评审线（第四线）· 恢复日期：2026-10-05

---

## 一、批次元信息

| 项 | 值 | 来源 |
|---|---|---|
| 批次 | batch-F（R1 六批之一） | 会话记录 |
| 对象 | `d60519e3` 超分收口（计费修复 + 提示词 + size 修复 + UI 样板） | 控制线 R1 令 |
| 父提交 | `0e1f111f` | 会话记录 |
| 范围 | 12 文件 403+/33-（代码面口径） | 会话记录 |
| 报告原文大小 | 16735 字节（`/tmp/review-r1/agents/batch-F.md`） | `#336` 产出清单 |
| 发现计数 | **11 条 = P0:0 / P1:3 / P2:6 / P3:2** | 会话记录（原文统计段） |
| 核验结果 | 3 条 P1 **全部 confirmed**（0 refuted / 0 uncertain） | verify-F |

---

## 二、P1 三条（全部 confirmed，含完整证据链）

### F-1 [P1] 计费修复不完整：管理端可把 quality/size 组合进「AI 超分」档，后端永不命中 → 静默落通配档

> **可定位性：达到**（含入口 + 后端语义不一致点 + 分叉点，见下）

**核验方法**（verify-F 原文）：读 `skuSelectorForIntent` 的 image 分支、`matchSKUSelector`、
`channelModelPriceTierForIntent`、`eligibleLogicalRoutes` 的 requirePriceTier 过滤，
以及管理端 `operationOptions` / `skuSelectorFromForm` / `defaultPriceTier` 的默认值；
用 `git show --stat d60519e3` 判定归属。

**证据链（逐条可定位）**：

1. **后端分叉点**：`backend/internal/app/model_router.go:308-311`
   ```go
   // 独立价格档，不能归并到 image_to_image，否则超分与普通改图同价。
   // 归一化以 intent.Operation 为准（前端经 canvasEditOperation=image_upscale 传入）。
   if strings.EqualFold(strings.TrimSpace(intent.Operation), "image_upscale") {
       selector["operation"] = "image_upscale"
       break
   }
   ```
   `break` 直接跳过后面的 quality/size 归一化（`normalizeImagePriceQuality` 只在 `:335-353` 被普通图片分支调用）。
   ⇒ **请求 selector 永远只有 `{"operation":"image_upscale"}`**，不含 quality/size。
   （★ 编排者实测复核：该行号与代码在 `374bdf22` 逐字命中——压缩摘要转述为 `operation == "image_upscale"`，实际是 `strings.EqualFold(strings.TrimSpace(intent.Operation), ...)`）

2. **匹配失败点**：`model_router.go:375-388` `matchSKUSelector`
   档位 selector 中 `quality:"4k"` 非空非 `*` → `requested["quality"] != "4k"`（requested 无此键，取零值 `""`）
   → `return false`。**带条件的超分档永不命中。**

3. **静默降级点**：通配档 `{"operation":"*"}`（或空 selector）全部键 `continue` → `matched=true, score=0`
   → `channelModelPriceTierForIntent` 返回它 → `model_router.go:213-219` **不报错，静默按通配价计费**
   （正是本批要关闭的机制）。

4. **无通配档时的错误文案修正**（batch-F 原文归因需修正）：
   不是「价格未配置」，而是更早失败——`model_router.go:229-233`
   `eligibleLogicalRoutes(..., requirePriceTier = PricePolicy=="channel")` 先滤掉 nil-tier 路由
   → 返回「当前模型暂时无法满足这组输入和参数」（`model_router.go:202-204`）。

5. **可达性（★ 关键，回答「哪个下拉入口」）**：
   - `web/src/pages/admin/components/channel-model-price-tier-fields.tsx:219` —— **本批新增** `{ label: "AI 超分", value: "image_upscale" }`
     （★ 编排者实测复核：`374bdf22` 逐字命中，且该行上方注释已自述「不配则静默落『任意生成方式』通配档」）
   - 同文件 `:117-131` 的「质量/分辨率」「画幅/尺寸」对 image 档位**无条件渲染**（`isImage` 只判能力）
   - `channel-model-editor-form.ts:83` 白名单同步放行
   - `skuSelectorFromForm`（`channel-model-price-tier-form.ts:113-116`）对 image 能力无差别带上 quality/size
     （★ 编排者实测复核：`:113-116` 逐字命中 `if (capability === "image") { if (tier.quality && tier.quality !== "*") selector.quality = ...; if (tier.size && tier.size !== "*") selector.size = ...; }`）
   - 默认 `quality:"*"`（`channel-model-price-tier-form.ts:41`）安全
   ⇒ **确为「选了具体质量/尺寸才掉坑」的两点击陷阱**

6. **★ 归属修正（verify-F 原文）**：
   `git show --stat d60519e3 -- backend` **为空** ⇒ backend 本批零改动，`model_router.go:308-311` 是**既有代码**；
   本批只是**新开了这个配置入口**（此前下拉无该项且白名单拒绝）。
   ⇒ 表述应为「**本批新增的下拉使既有后端语义不一致变为可达**」，**不是**「本批改了后端」。

**修复方向建议**（verify-F 备注）：(a)/(b) 二选一时，(b) 会把 4K 档的语义从「超分目标档」变成「请求 quality」，
**需先定口径**。

**状态**：控制线 2026-10-05 曾因「证据不可得」降级为「登记待查」。
**本恢复件已补全到可定位**（入口 + 语义不一致点 + 分叉点 + 归属）⇒ **可重启 F-1 修复**。

---

### F-2 [P1] 计费修复没有回归测试覆盖：新增 3 例全是表单纯函数，没有一条验「配好的档能被命中」

**核验方法**：读 `web/test/channel-model-price-tier-form.test.ts:94-112`；
`git show --stat d60519e3` 清点本批全部测试改动；grep 全仓 `image_upscale` 的测试落点；
读 `backend/internal/app/model_router_test.go:129-158`。

**证据**：
- 三例分别是 `validateChannelModelPrices` 不抛（`:97-100`）、`skuSelectorFromForm` 输出 `{operation:"image_upscale"}`（`:102-105`）、video 能力拒绝（`:107-110`）
  —— **全部只到「表单产出 selector」这一层**。
- 本批测试改动只有 4 个前端文件（channel-model-price-tier-form +19、registry-namespace-guard +20、super-resolve +121、dialog-family-token-guard +85），**backend 侧零改动零新增测试**。
- 既有 `model_router_test.go:129-158` 的 `TestSKUSelectorKeepsImageUpscaleOperation` 只断言裸 operation
  （且只读 `selector["operation"]`，对 quality/size 是否随行不置一词）；
  `TestImagePriceTiersMatchResolutionAndActualReferences` 只覆盖 text_to_image / image_to_image 的 quality 档。
  ⇒ **全仓无「表单 selector → channelModelPriceTierForIntent 命中」的闭环断言。**

**备注**：此条与 F-1 **强耦合**（F-1 成立则本条成立）。作为独立「测试盲区」发现成立，
但**报告里应与 F-1 合并表述以免重复计数**（verify-F 原文建议）。

---

### F-3 [P1] 「size 修复贯通」用例是测试镜像实现，不是接线验证

**核验方法**：读 `web/test/super-resolve.test.ts:203-216` 与 `web/src/pages/canvas/use-canvas-media-tools.ts:1561-1580`；
grep 全 `web/test/` 中 `superResolveSize` 与 `naturalWidth` 的落点。

**证据**（恢复件中该条正文在会话记录中被截断，以下为可检索到的部分）：
- 测试镜像实现：`web/test/super-resolve.test.ts:203-216`
- 真接线落点：`use-canvas-media-tools.ts:1572-1576`（另一处记录为 `:1561-1580`）
- 判定：测试自己算好 size 传入，**真接线从未被经过**（与 V1「验证形态必须匹配被验证对象」同族）

**缺口**：该条的完整正文（含逐行证据）在压缩摘要中**未完整保留** ⇒ **原文缺失**，
如需可定位证据需重跑一次该条核验（范围小：两个文件）。

---

## 三、P2 六条（标题级恢复，正文原文缺失）

| # | 发现 | 文件线索 |
|---|---|---|
| F-4 | `DIALOG_STYLE.interactive` 定义即忘（死代码，且报告把它列为家族契约） | （原文缺失） |
| F-5 | 报告 §七「颜色 → 语义 token」与代码不符；`--elevation-overlay` 只存在于注释 | （原文缺失） |
| F-6 | `dialog-family-token-guard` 是源码文本 + 抽样正则的护栏，非报告所称的「无裸字面值」契约 | `web/test/dialog-family-token-guard.test.ts`（+85） |
| F-7 | `superResolveSize` 对 NaN/Infinity 产出非法尺寸串（`"NaNxNaN"`） | `web/src/lib/canvas/super-resolve-params.ts`；探针 `/tmp/sr-nan.test.ts` |
| F-8 | 超分失败节点的「重新生成」不走超分链：operation 丢回 image（计费口径漂移） | `web/src/pages/canvas/use-canvas-generation-retry.ts` |
| F-9 | 报告 §三「已裁定」的两处落点与实际执行不符（②未落地且已被 journal 推翻） | （原文缺失） |

**F-7 补充证据**（verify-F 原文可检索到）：`Infinity` 能穿过 `>0` 守卫，`Infinity` 组合产出 `NaNxNaN`；
探针 `/tmp/sr-nan.test.ts` → 临时拷入 baseline 后即删；NaN/Infinity/undefined 产出 `"NaNxNaN"`/`"NaNx1"`。

---

## 四、P3 两条（标题级恢复）

| # | 发现 |
|---|---|
| F-10 | faithful 提示词与「漂移超标则降级文案」承诺之间无判定落点 |
| F-11 | `superResolvePromptFragment` 的未知 mode 回退分支在类型下不可达，测试用 `as never` 自证 |

**F-11 补充证据**（会话记录可检索）：
- 文件：`web/src/lib/canvas/super-resolve-params.ts:74-76`；测试 `web/test/super-resolve.test.ts:329-331`
- 证据：`SUPER_RESOLVE_PROMPT_FRAGMENTS` 是 `Record<SuperResolveMode, string>`，TS 下索引不会 undefined；测试靠 `as never` 才走到 `??`
- 影响：运行时防御对历史节点持久化的非法 mode 确实可能生效，但用例断言的是测试自己构造的非法值，**对真实输入零覆盖**（P3，记录即可）
- 建议：保留防御但把注释/用例名改成「历史节点可能持久化非法 mode」；或删除 `??` 与用例

---

## 五、[ok] 文件（7 条，原文统计段可检索）

- `web/src/components/model-picker.tsx:1031`（`image_upscale: "AI 超分"` 标签加法正确；同文件 `:912` 的 video operation 映射不含它，用途不同不构成遗漏）
- `web/src/lib/canvas/capability-entries.ts:94-109、:157-163、:186-192`（`requiredOperations` 必填声明，两条目均补齐；本批只声明不消费，已在报告 §八 与代码注释明示，非隐瞒缺口）
- `web/src/pages/admin/components/channel-model-cost-summary.tsx:46`
- `web/src/pages/admin/components/channel-model-editor-form.ts:81-84`（白名单与下拉同步；`validateChannelModelPrices` 的 image 数组三值一致）
- `web/test/registry-namespace-guard.test.ts:95-114`（结构断言 `toEqual(["image_upscale"])`，非 grep 计数；通用循环覆盖空数组契约）
- `docs/artifacts/w5-superresolve-closeout/step0-probe-report.md`（双场景对照设计合理；主动声明「机制证实、金额未复现」，与 step0-probe.json 数据自洽）
- `docs/artifacts/w5-superresolve-closeout/task3-chain-report.md`（三段证据自洽，且主动记档「意外落 T_DEFAULT 是复制时序问题」并自证非代码缺陷）

---

## 六、动态验证记录（原文可检索）

1. 指定命令 `bun test test/super-resolve.test.ts test/dialog-family-token-guard.test.ts test/channel-model-price-tier-form.test.ts` → **52 pass / 0 fail**；
   四文件（含 registry-namespace-guard）→ **66 pass / 0 fail**，与报告 §九「专项测试 66 pass」一致。
2. 全量 `bun test`（348 文件）→ 2901 pass / **7 fail**。定位：7 例全部在 `web/test/canvas-asset-repair.test.ts`；
   该文件**单独跑 10/10 通过**，与 4 个本批测试文件配对跑也全通过。
   ⇒ **报告 §九「全量 2773 pass / 0 fail」在当前 HEAD 已不成立，但失败与本批无关**
   （源码 `web/src/services/canvas-asset-repair.ts` 与测试在本批范围内零改动，属顺序/环境敏感的既有 flaky）。
   建议后续批次复核该 flaky，不要计入本批。
3. 反例验证（临时文件，均已从副本删除，未触碰任何仓库）：
   `/tmp/sr-verify/backend/internal/app/zz_tmp_review*_test.go` 三个用例，
   复现「带 quality/size 的超分档永不命中 → 落通配档 / 直接 nil」，
   并验证裸 `{"operation":"image_upscale"}` 档可正常命中（对照组通过）。
4. 边界值探针（`/tmp/sr-nan.test.ts` → 临时拷入 baseline 后即删）：NaN/Infinity/undefined 产出 `"NaNxNaN"`/`"NaNx1"`。

---

## 七、批次结论（原文可检索）

> **本批核心问题一句话**：计费修复止于「管理端能选 image_upscale」和「裸档能命中」两层，
> 缺「配置条件与命中条件一致」的闭环，也缺任何能发现该不一致的回归测试；
> size 修复的真实落点则无接线级验证。

---

## 八、恢复件覆盖度声明（诚实边界）

| 部分 | 恢复程度 |
|---|---|
| 批次元信息（对象/父/计数/报告大小） | ✅ 完整 |
| P1-A（F-1） | ✅ **完整到可定位**（入口 + 语义不一致点 + 分叉点 + 归属修正 + 修复方向） |
| P1-B（F-2） | ✅ 完整（含 4 处行号 + 既有测试分析） |
| P1-C（F-3） | ⚠️ 部分（两个文件行号 + 判定；逐行正文缺失） |
| P2 六条 | ⚠️ 标题级 + 1 条（F-7）含补充证据 |
| P3 两条 | ⚠️ 标题级 + 1 条（F-11）含完整证据 |
| [ok] 7 条 | ✅ 完整 |
| 动态验证记录 | ✅ 完整（4 项） |
| 批次结论 | ✅ 完整 |

**未恢复项**：P2 五条（F-4/F-5/F-6/F-8/F-9）的逐条正文、P1-C（F-3）的逐行证据 —— **原文缺失**。
**补全方式**（如需）：重跑该条核验（范围小：`super-resolve.test.ts:203-216` + `use-canvas-media-tools.ts:1561-1580`）。

**纪律声明**：本恢复件**未做任何推断或补全**（C3「不猜」）；
所有内容均可回溯到会话记录中的压缩摘要或 recall 检索结果；
缺口处已显式标注「原文缺失」。
