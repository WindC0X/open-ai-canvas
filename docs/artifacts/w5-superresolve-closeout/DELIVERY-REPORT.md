# 超分收口批 · 交付报告

**批次**：超分收口批（八件）
**分支**：`feat/w5-superresolve-closeout`
**起点**：`fa54be95`（修缮缝隙批合入后的 main）
**tip**：`419c5c7c`
**规模**：16 文件 **+631/−33**（6 commits）
**交付日**：2026-10-04

---

## 一、八件完成状态

| # | 项 | 状态 | 落点 |
|---|---|---|---|
| 0 | 决定性探针（计费行为实测） | ✅ | `aa6e6c9e` |
| 1 | 管理端下拉补 `image_upscale` | ✅ | 已随 `4e7d36ec` 入库 |
| 2 | mode → 提示词语义翻译 | ✅ | `4e7d36ec` |
| 追加 A | size 继承污染修复 | ✅ | `4e7d36ec` |
| 追加 B | faithful 语义强化 | ✅ | `4e7d36ec` |
| 3 | 链路验证（三段式） | ✅ | `419c5c7c` |
| 4 | UI 样板件（弹窗 token 化） | ✅ | `06a7f957` |
| 5 | `executionChain.requiredOperations` | ✅ | `65d277a2` |
| — | 全量门禁 + 交付报告 | ✅ | 本文档 |

**八件全绿**，零遗留。

---

## 二、step 0 决定性探针（`aa6e6c9e`）

### 控制线疑虑：静默落通配价

**结论：机制确认，具体金额未复现。**

两场景对照实验（真实后端 `:8080` + 真实 `POST /api/tasks`，o03-chain DB 的
CHAIN_001 / CM_001）：

| 场景 | 精确档状态 | 选中档 | 计费 |
|---|---|---|---|
| A | `T_UPSCALE` `sel={"operation":"image_upscale"}` 启用 | ✅ **精确档** | 777 microcredits |
| B | 精确档**禁用**，仅留通配 `T_DEFAULT` `sel={}` | ⚠️ **静默落通配** | 100 microcredits，**无任何报错** |

**机制根因**（代码证据）：`matchSKUSelector`
（`backend/internal/app/model_router.go:375-388`）对空键与 `"*"` 直接 `continue`，
通配档因此匹配任意 operation。

**诚实边界**：探针证明**机制**，未复现控制线提到的具体 `0.005` 金额。

**控制线评语**：探针「质量极高」，并据此新立教训族
**「机制性静默降级」**（系统按设计工作，但设计本身有洞，无告警面）。

---

## 三、任务 1：管理端 `image_upscale` 支持

四个同步点（缺一即 admin 校验拒绝或展示不完整）：

| 文件 | 位置 | 内容 |
|---|---|---|
| `channel-model-price-tier-fields.tsx` | `~215` `operationOptions` image 分支 | `{ label: "AI 超分", value: "image_upscale" }` |
| `channel-model-editor-form.ts` | `:83` `validateChannelModelPrices` 白名单 | image 数组加 `image_upscale` |
| `channel-model-cost-summary.tsx` | `:46` `specificationLabel` | `image_upscale: "AI 超分"` |
| `model-picker.tsx` | `:1031` `tierSpecificationLabel` | `image_upscale: "AI 超分"` |

全仓 grep `text_to_image` 未发现其他枚举点。

**测试**：`channel-model-price-tier-form.test.ts` +3 例（11 pass / 0 fail），
可证伪性已证（移除白名单项 → 1 fail → 还原 → 11 pass）。

**占位定价**：`0.1/次` = 0.1 积分 = **100,000 microcredits**
（`CreditScale = 1_000_000`，`finance.go:21`）。

### 已裁定（控制线 2026-10-04 审后裁定）

1. **「0.1/次」= 0.1 积分**（= 100,000 microcredits）。
   理由：用户面计价全线用积分（钱包/账单/展示），元只是渠道成本侧概念。
   0.1 积分/次作为占位价继续有效，正式定价用户随时拍板一键改。
2. **不加列、不加默认档工厂**（`PriceVersion` 语义是版本号，复用会污染）。
   占位状态记在两处（零 schema 改动）：
   ① journal 登记一行「image_upscale 占位价 0.1 积分/次，正式定价待用户」
   ② 管理端描述性字段写「占位价，待定价」
   加列是 schema 决策，挂**渠道接线批**评估（低优先）。

### 越界缺陷（已上报，未擅修）

前端预估**永远算不出 `image_upscale`**：
`imagePriceOperation`（`model-pricing.ts:159-163`）只返回
`image_to_image` / `text_to_image`，且 `ModelRequirements`
（`model-selection.ts:15-22`）有 `videoOperation` 却**无 `imageOperation`**。

**后果**：超分运行的前端预估价按 `image_to_image` 算，后端按 `image_upscale` 收
—— **用户看到的价格与实际扣费不一致**。已按范围纪律止于上报。

---

## 四、任务 2：mode → 提示词语义翻译（`4e7d36ec`）

### 修复前

`prompt` 就是标题字符串「AI 超分 · 4K · 保真放大」，**无语义约束**，
模型不知道要「保持什么」。

### 修复后（`super-resolve-params.ts`）

```
SUPER_RESOLVE_PROMPT_FRAGMENTS
  faithful → 逐项枚举不变量：构图 / 取景 / 色调 / 白平衡 /
             元素位置·数量·形状 / 光影方向，
             并禁止增删元素、禁止改天空与背景颜色
  enhance  → 允许重绘细节质感，保持构图
superResolvePromptFragment(mode)   // 未知 mode 回退 faithful（保守优先）
```

`use-canvas-media-tools.ts` 两处 `prompt: title`（提交与终态）改为
`title + fragment`，使**节点 metadata / 提交 / 终态**三处一致携带完整提示词。

### 追加 B：faithful 语义强化

测试线 ③R 实测**像素相关度 0.6087 / 差异 6.7%**，faithful 语义未完全兑现。
本批强化提示词逐项枚举不变量。

**诚实边界（控制线已认可）**：若强化后仍 >5% 漂移，
弹窗文案降级为「细节尽量保持」—— **文案与真实能力对齐**。

---

## 五、追加 A：size 继承污染修复（`4e7d36ec`）

### 症状

960×960 源图超分 → 产出 **1445×1088**（≈4:3，长边 < 2048）。

### 根因

`buildGenerationConfig`（`canvas-project-generation.ts:409`）：

```ts
size: workflowProvider === "model"
  ? node?.metadata?.size ?? config.size ?? defaultConfig.size  // ← 继承源节点历史 size
```

超分调用时源节点 metadata 携带历史 `"1360x1024"`，**覆盖了应有的 2048×2048**。

### 修复

`superResolveSize(sourceWidth, sourceHeight, targetResolution)` ——
**长边锁定** 2048/4096，短边按比例，退化输入钳位为正数。

源图实际像素读自 `node.metadata.naturalWidth/naturalHeight`
（`canvas-generation-task-sync.ts:51`，由 `imageMetadata` 写入），
`node.width/height` 兜底 —— **不再继承 `metadata.size`**。

**测试**：`super-resolve.test.ts` +11 例（29 pass / 0 fail），
可证伪性已证（注入假 size `1360x1024` → 6 fail → 还原 → 29 pass）。

---

## 六、任务 3：链路验证（三段式，`419c5c7c`）

**控制线裁定双段拆分**：本线做**链路验证**，真机**出图段**交测试线
`b12r16-③R`（零边际成本；渠道密钥按 key 隔离无法复制）。

用**本分支代码**构建后端（`feat/w5-superresolve-closeout`），
DB 复制至 `.local/sr-verify`（复用 CHAIN_001 / CM_001 配置）：

| 段 | 证据 |
|---|---|
| ① 任务创建 | `tasks.operation = image_upscale` ✅ |
| ② 计费 | `billing_orders.price_tier_id = T_UPSCALE`，777 microcredits（**精确档**）✅ |
| ③ 上游请求 | 请求已构造并发出，错误 `外部服务域名解析失败`（假域名 `relay.example.com`，**预期**）✅ |

**证据**：`docs/artifacts/w5-superresolve-closeout/task3-chain-report.md` +
`task3-chain-verification.json`。

### 过程中一个意外发现（已记档）

首次跑测时 `price_tier_id = T_DEFAULT`（通配档）—— 排查发现是**我复制 DB 的时机问题**：
复制发生在 `T_UPSCALE` 恢复启用**之前**（探针 B 场景的遗留状态）。
修正后重跑即得精确档。**非代码缺陷**，是环境复现顺序问题。

### 诚实边界

- 真机**出图段**由测试线 `b12r16-③R` 顺带覆盖
- 渠道真实可用性（a6api 的 `nano-banana-2` 作为超分改图模型）**未实测** ——
  `nano-banana-2` 是改图模型，超分=改图+提示词约束，理论可行但未经真机验证，
  该不确定性由测试线真机跑解决

---

## 七、任务 4：UI 样板件（`06a7f957`）

W6「画布弹窗家族 UI 统一批」的**先行样板**。

### 改动

`canvas-node-super-resolve-dialog.tsx` **全量 token 化**：

| 类别 | 修复前 | 修复后 |
|---|---|---|
| 字号 | `text-sm` / `text-xs` / `text-xl` | `var(--fs-*)` |
| 圆角 | `rounded-xl` / `rounded-lg` | `var(--r-*)` |
| 间距 | `gap-N` / `p-N` | `var(--space-*)` |
| 动效 | 无 | `var(--motion-dur-fast-calc)` |
| 颜色 | `text-[#ef4444]` | 语义 token |

样式集中于文件顶部 `DIALOG_STYLE` 常量
（`section/title/description/panel/canvas/label/field/column/value/muted/hint/interactive`），
作为弹窗家族的**对齐入口**。

**布局骨架与逻辑分支零改动**（控制线硬约束）。

### 动效规格表对齐

`DESIGN.md` L25 三档：
**微 fast 100–150ms ease-out / 标准 base 200–250ms（弹窗归此档）/ 大 reveal 300–400ms**，
且 globals.css 已有完整 `--motion-dur-*` / `--motion-ease-*` Primitive 集。
本样板取 **fast 档**（弹窗内交互元素），并**不自建** `prefers-reduced-motion`
—— 全局 `--motion-scale` 统一处理（守卫测试断言此点）。

### 守卫测试（`dialog-family-token-guard.test.ts`，9 例）

机器可查契约：
- 无裸字号/圆角/间距/动效字面值
- token 确实被消费（非定义即忘）
- 逻辑符号保留（含 `onConfirm(params)`）
- 不自建 `prefers-reduced-motion`

**可证伪性已证**（注入裸值 `text-xl` → 1 fail → 还原 → 9 pass）。

---

## 八、任务 5：`executionChain.requiredOperations`（`65d277a2`）

`CapabilityEntry.executionChain` 新增**必填**字段 `requiredOperations: string[]`
（允许空数组，**不许缺字段** —— 延续「不许缺字段」纪律）。

| 条目 | 声明 |
|---|---|
| `image.superResolve` | `["image_upscale"]` |
| `image.annotateEdit` | `[]`（普通图片编辑按图生图计价） |

**仅声明侧**；前端模型筛选消费留待门控批（控制线原令）。

**测试**：`registry-namespace-guard.test.ts` +2 例
（必须是非空字符串数组；superResolve 必须等于 `["image_upscale"]`）。

---

## 九、全量门禁

在批分支 tip `419c5c7c`：

| 门 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `eslint`（8 个改动源文件） | ✅ exit 0 |
| 专项测试（4 文件） | ✅ **66 pass / 0 fail** |
| 全量 `bun test` | ✅ **2773 pass / 0 fail**（341 文件 / 14554 expects） |
| `go build -buildvcs=false ./...` | ✅ exit 0 |
| `go test ./internal/app/...` | 5 项失败（**已知基线**，逐条同名） |

**基线说明**：批分支 2773 vs 合入后 main 2834，差值 61 = linear-entry 的测试
（批分支未含该批）。**本轮无 flaky 复现**。

---

## 十、诚实边界汇总

1. **step 0 探针**证明计费机制，**未复现**具体 `0.005` 金额
2. **真机出图段**由测试线 `b12r16-③R` 顺带覆盖，本线只做链路验证
3. ~~渠道真实可用性未实测~~ → **已闭环**（控制线裁定）：测试线 `b12r16-③R`
   已真机出图成功（1445×1088 succeeded），`nano-banana-2` 作为超分改图模型
   **真机验证通过**，本条已由 `b12r16-③R` 覆盖。

   **附精确说明**：`1445×1088` 恰是**修复前**的尺寸继承污染症状
   （960×960 源 → 继承 4:3 的 `1360x1024`）。本批 size 修复（`4e7d36ec`）
   **仍在 branch-only 分支上**，测试线 ③R 跑的是**不含该修复**的代码。
   故：**渠道可用性闭环成立**；**size 修复的真机效力**待分支合入后另跑验证。
4. **faithful 语义**：强化提示词后仍可能 >5% 漂移，届时文案降级「细节尽量保持」
5. **前端预估缺陷**（越界未擅修，控制线裁定**登记为渠道接线批正式项**）：
   预估价按 `image_to_image`，后端按 `image_upscale` 收，**存在价差不一致**。
   修法：`ModelRequirements` 加 `imageOperation` + `imagePriceOperation` 按 operation 返回。
   控制线原话：「不许它变成隐性账单偏差」。
6. **占位定价未决**：`0.1/次` 单位歧义 + 无 note 列可标注占位
7. **任务 4 是样板件**：仅覆盖超分弹窗一个，W6 其余 11+ 弹窗待批量统一
   （控制线确认：超分弹窗是 W6 家族统一批的样板）
8. **任务 5 仅声明侧**：前端筛选消费未接（控制线确认：门控批消费）

---

## 十一、跨批协作与纪律

- **零重叠**：与 B 线 `feat/w5-linear-entry`（13 文件）零交集，并行无干扰
- **分支制**：全程 branch-only，main 未受污染
- **commit 卫生事故与修正**：`4e7d36ec` 因 `git add -A` 误入
  `backend/cmd/srprobe/main.go`（探针脚手架）与两个 `.trellis/tasks/` 目录，
  已由 `08c8024e` 清理。**教训：本工作区禁用裸 `git add -A`，必须显式列路径。**
- **环境清理**：探针脚手架 `backend/cmd/srprobe` 已删除；验证后端已停
  （`:8080` 空闲）；`.local/sr-verify` 保留供后续复用
- **DB 修改告知**：o03-chain DB（`oac-wt-o03/.local/o03-chain/open_ai_canvas.db`，
  原为链路验证洁净数据）的 `CM_001.capability_config_json` 曾被注入默认配置
  （`UPDATE channel_models SET capability_config_json=..., capability_version=1`）

---

## 十二、控制线验收（2026-10-04）

**八件验收通过。** 重点表扬三处：

1. **探针→修复→验证的完整闭环**（step0 定性 → 任务1-2 修复 → 三段式验证）
   —— 「活着的半成品」今天正式活成了
2. **可证伪纪律成为标准动作**：任务 A（注入假 size → 6 fail → 还原 29 pass）
   与任务 4（注入 `text-xl` → 1 fail）—— 可证伪性不是口号，是每个修复件的标准动作
3. **任务 4 的动效判断正确**：「不自建 `prefers-reduced-motion`，全局
   `--motion-scale` 统一处理」—— 按既有机制走，不另造轮子

**纪律收货**：
- `git add -A` 事故清理认可，「禁用裸 add -A」进**开书令模板候选**
- DB 注入告知规范（改了什么/现状/恢复状态）收货

**状态**：branch-only 保持，等合入令。
