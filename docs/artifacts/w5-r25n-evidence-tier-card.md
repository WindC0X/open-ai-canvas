# R25n 证据三态接入 art-critique（W5 搭车件）

> **依据**：`竞品深拆-吸收落地方案-2026-10-01.md` §3.4.3（最高性价比三项之一）
> **定位**：W5 搭车件（S 级，零模型成本，实体已在位）
> **状态**：设计卡（控制线 2026-10-04 裁定「搭车件继续」）
> **日期**：2026-10-04
> **执行**：A 线

---

## 一、任务定义（深拆原文）

> **R25n 证据三态接 art-critique** | 借鉴 **TapNow `explain-how-it-made`**：
> `Confirmed`/`Supported interpretation`/`Unknown` 三态 + 六条防推理谬误纪律 + 七节输出结构（16,293 字符）
> | 为什么：影策 `art-critique` **已在位**（4 类 rubric + strict JSON `submit_art_critique` 8 必填字段 + 3 渲染组件 + 双版本号），**只改 rubric 内容与一个字段** `evidenceTier`

**关键定性**：**「只改 rubric 内容与一个字段」** —— 不是新建能力，是**现有实体的增强**。

---

## 二、现状实勘

### 2.1 art-critique 实体（已在位）

| 层 | 文件 | 规模 | 说明 |
|---|---|---|---|
| 契约 | `lib/art-critique/contracts.ts` | 199 行 | 8 必填字段 + 双版本号（schema v1 / rubric `2026-08-v1`） |
| rubric | `lib/art-critique/rubrics.ts` | — | 4 类 rubric（composition/color/lighting/proportion） |
| 管道 | `lib/art-critique/pipeline.ts` / `pipeline-parse.ts` / `pipeline-messages.ts` | — | 多阶段（preparing/scene/reviewing/aggregating/grounding/verifying/annotating） |
| 评审 | `lib/art-critique/review.ts` | — | — |
| 标注 | `lib/art-critique/annotation.ts` | — | — |
| 渲染 | `components/canvas/art-critique/ai-art-critique-modal.tsx` / `-report.tsx` | — | 3 渲染组件（modal + report + node） |

### 2.2 已有「类证据」机制（★ 关键发现）

实勘发现 art-critique **已有两个接近「证据」的字段**：

| 字段 | 位置 | 语义 | 与 R25n 三态的关系 |
|---|---|---|---|
| `confidence: number` | `ArtCritiqueIssue` | 0-1 置信度（**数值**） | 三态是**离散分类**，confidence 是**连续量** —— **不冲突，互补** |
| `verification?: ArtCritiqueVerification` | `ArtCritiqueIssue` | verdict: `confirmed`/`uncertain`/`rejected` | **已有三态雏形！** 但语义是「**验证结果**」不是「**证据等级**」 |
| `groundingConfidence?: number` | `ArtCritiqueIssue` | 定位置信度 | 定位层，非证据层 |
| `targetSource?: ArtCritiqueTargetSource` | `ArtCritiqueIssue` | `model`/`reference`/`global` | **这是证据来源！** 但只标来源不标等级 |

### 2.3 ★★ 更深的关键发现：已有 `evidenceRequired`（布尔）

实勘 `rubrics.ts` 发现**每个 check 已有 `evidenceRequired?: boolean`** 字段：

| 项 | 现状 |
|---|---|
| 语义 | 「这个 check **需不需要**证据」（布尔） |
| 默认 | `true`（除显式设 `false`） |
| 校验 | `pipeline-parse.ts:148`：`rule.evidenceRequired !== false && evidence.length === 0` → **丢弃该意见** |
| rubric 注入 | `rubrics.ts:102`：`需要证据：${item.evidenceRequired !== false ? "是" : "否"}` 写进 prompt |

**⇒ 现有机制是「证据**有无**」的硬门（没有证据 → 意见被丢弃），
而 R25n 要的是「证据**强度**」的分级（有证据，但强到什么程度）。**

| | `evidenceRequired`（既有） | `evidenceTier`（R25n 新增） |
|---|---|---|
| 类型 | `boolean` | 三态枚举 |
| 问的是 | 「**有没有**证据？」 | 「证据**有多强**？」 |
| 作用时机 | 解析校验（丢弃不合格） | 意见生成（reviewer 标注） |
| 失败后果 | 意见**被丢弃** | 意见**保留但标注等级** |

**⇒ 二者互补，不替代**：`evidenceRequired` 是**门禁**，`evidenceTier` 是**分级**。
**R25n 的价值**：把「有证据」这一档**再细分**为「事实/解读/不可判断」。

### 2.4 `verification.verdict` 与 `evidenceTier` 的区别

`ArtCritiqueVerification` 的 `confirmed`/`uncertain`/`rejected` 与 R25n 要的
`Confirmed`/`Supported interpretation`/`Unknown` **形似而神不同**：

| | `verification.verdict`（既有） | `evidenceTier`（R25n 新增） |
|---|---|---|
| 问的是 | 「这条意见**验证通过**了吗？」 | 「这条意见**有多强的证据支撑**？」 |
| 取值 | confirmed / uncertain / rejected | Confirmed / Supported interpretation / Unknown |
| 时机 | 验证阶段（pipeline 后段） | 意见生成时（reviewer 输出） |
| 对象 | 整条 issue | 整条 issue（**新增独立维度**） |

⇒ **不能复用 `verification`** —— 二者是**不同维度**（验证结果 vs 证据等级），
强行复用会让「验证未做」与「证据不足」混淆。

---

## 三、设计（最小改动）

### 3.1 新增字段 `evidenceTier`

```ts
// web/src/lib/art-critique/contracts.ts（ArtCritiqueIssue 内）

/**
 * 证据等级（R25n，借鉴 TapNow explain-how-it-made 证据三态）。
 *
 * ★ 与 verification.verdict 的区别（不可混淆）：
 * - `evidenceTier`：这条意见**有多强的证据支撑**（reviewer 生成时判定）
 * - `verification.verdict`：这条意见**验证通过**了吗（pipeline 验证阶段判定）
 *
 * 二者独立：一条意见可以「证据确凿但验证未做」，也可以「验证通过但证据薄弱」。
 */
export type ArtCritiqueEvidenceTier =
    /** 可直接观察/测量的事实（如「主体位于画面 1/3 分割线上」） */
    | "confirmed"
    /** 有依据的解读（如「低机位暗示权威感」—— 有构图学依据但非事实） */
    | "supported"
    /** 无法从画面判断（如「作者想表达孤独」—— 意图不可观测） */
    | "unknown";

// ArtCritiqueIssue 新增：
export type ArtCritiqueIssue = {
    // ...既有字段
    /** 证据等级（R25n）。★ 必填 —— 强制 reviewer 为每条意见标注证据强度。 */
    evidenceTier: ArtCritiqueEvidenceTier;
};
```

**必填 vs 可选**：**必填**。理由：三态的价值就在于**强制标注** ——
若可选，reviewer 会倾向省略，机制失效（与「零参数预设显式写『暂无』」同族纪律）。

### 3.2 六条防推理谬误纪律（rubric 内容增强）

**TapNow 蓝本的六条纪律**（深拆记录），落到影策 rubric：

| # | 纪律 | 影策落地 |
|---|---|---|
| 1 | **不把解读当事实** | `supported` 级意见必须用「可能/倾向于/暗示」措辞，不用「就是/说明」 |
| 2 | **不推断作者意图** | 意图类判断一律 `unknown` |
| 3 | **不引入画面外信息** | 不得引用「同类作品通常…」作为证据 |
| 4 | **区分观察与推论** | 每条意见的 `explanation` 须先陈述观察，再给推论 |
| 5 | **证据不足时明说** | `unknown` 是**合法答案**，不是失败 |
| 6 | **不夸大确定性** | `confidence` 与 `evidenceTier` 不得矛盾（如 `unknown` + confidence 0.9） |

**第 6 条可机检**（建议守卫）：

```ts
// unknown 等级的意见不得有高 confidence
if (issue.evidenceTier === "unknown") expect(issue.confidence).toBeLessThan(0.5);
```

### 3.3 rubric 内容增强（4 类 → 带证据等级）

**现状**：4 类 rubric（composition/color/lighting/proportion）各自出意见。

**增强**：每类 rubric 的 prompt 中**加入证据分级指令**：

```
对每条意见，必须标注证据等级（evidenceTier）：
- confirmed：可直接观察/测量的事实
- supported：有依据的解读（须用「可能/倾向于」措辞）
- unknown：无法从画面判断

★ 纪律：不把解读当事实；不推断作者意图；不引入画面外信息；
        区分观察与推论；证据不足时明说；不夸大确定性。
```

**改动面**：`rubrics.ts` 的 4 个 rubric 文本 + `contracts.ts` 的 1 个字段。

### 3.4 渲染（三态可视化）

**现状**：3 渲染组件（modal / report / node）。

**改动**：在意见条目上显示证据等级徽标：

```
┌─────────────────────────────────────────────┐
│ ⚠ 主体偏离三分线          [证据：确凿]        │  ← confirmed
│   主体中心位于画面 47% 处，…                  │
├─────────────────────────────────────────────┤
│ ◆ 低机位暗示权威感        [证据：解读]        │  ← supported
│   机位低于视线，可能…                         │
├─────────────────────────────────────────────┤
│ ? 作者意图                [证据：不可判断]    │  ← unknown
└─────────────────────────────────────────────┘
```

**色彩纪律**：用**语义 token**（不是新色值）；`unknown` 不得用警告色（它不是错误）。

---

## 四、文件清单

| 文件 | 动作 | 说明 |
|---|---|---|
| `web/src/lib/art-critique/contracts.ts` | 改 | 新增 `ArtCritiqueEvidenceTier` + `ArtCritiqueIssue.evidenceTier`（必填） |
| `web/src/lib/art-critique/rubrics.ts` | 改 | 4 类 rubric 加证据分级指令 + 六条纪律 |
| `web/src/lib/art-critique/pipeline-parse.ts` | 改 | 解析 `evidenceTier`（缺失时降级策略） |
| `web/src/components/canvas/art-critique/ai-art-critique-report.tsx` | 改 | 证据等级徽标 |
| `web/src/components/canvas/art-critique/ai-art-critique-modal.tsx` | 改 | 同上（如需要） |
| `web/test/art-critique-evidence-tier.test.ts` | **新增** | 三态解析 + 第 6 条机检 + 降级 |

**★ 版本号纪律**：`ART_CRITIQUE_RUBRIC_VERSION` 从 `2026-08-v1` → **`2026-10-v2`**
（rubric 内容变了，版本号必须递增 —— 双版本号机制的存在意义）。

---

## 五、兼容性（★ 必答）

### 5.1 既有报告怎么办

`evidenceTier` 设为**必填**会破坏既有报告（无该字段）。处置：

| 场景 | 处置 |
|---|---|
| 旧报告（`rubricVersion: 2026-08-v1`） | **不回溯**，渲染时缺失 → 不显示徽标（不是报错） |
| 新报告（`2026-10-v2`） | 必须含 `evidenceTier` |
| 解析降级 | 模型未输出 `evidenceTier` 时 → 默认 `unknown`（保守，不猜） |

**★ 降级纪律**：缺失时默认 `unknown` 而非 `supported` —— **保守优先**（防夸大）。

### 5.2 与「只改 rubric 内容与一个字段」的对照

| 深拆原文 | 本卡实际 | 差异说明 |
|---|---|---|
| 只改 rubric 内容 | ✅ `rubrics.ts` 4 处 | 一致 |
| 只改一个字段 | ✅ `evidenceTier` 1 个 | 一致 |
| — | ⚠️ **+ 渲染徽标 + 解析降级 + 测试** | **必要的配套**（否则字段无出口 = 反模式 #12） |

**★ 诚实说明**：深拆说「只改 rubric 内容与一个字段」是**改动面描述**，
但**出口必须配套**（渲染 + 解析），否则违反反模式 #12「有代码≠能用」。
本卡把配套列出，不隐藏工作量。

---

## 六、验收

| # | 验收 | 验证方式 |
|---|---|---|
| 1 | `evidenceTier` 字段在位且必填 | 类型定义 + tsc |
| 2 | 三态取值正确 | 单元测试（confirmed/supported/unknown） |
| 3 | 六条纪律入 rubric | rubric 文本断言 |
| 4 | **第 6 条可机检** | 测试：`unknown` 不得有高 confidence |
| 5 | 解析降级（缺失 → unknown） | 单元测试 |
| 6 | 渲染徽标可见 | 组件测试 + 真机截图 |
| 7 | 旧报告不报错 | 兼容测试（v1 报告渲染无徽标） |
| 8 | 版本号递增 | `2026-10-v2` 断言 |
| 9 | **模型真实输出符合三态** | 真机跑一次 art-critique，检查输出含 evidenceTier |

**★ 第 9 项是硬门槛**：rubric 改了但模型不遵守 = 机制失效。
必须真机验证一次（有渠道可用：a6api）。

---

## 七、不做

- ❌ **不新建能力**（深拆明确定位「实体已在位」）
- ❌ **不改 pipeline 阶段**（只加字段，不改流程）
- ❌ **不复用 `verification.verdict`**（§2.2 已论证是不同维度）
- ❌ **不做七节输出结构**（TapNow 的 16,293 字符结构是**其产品形态**，
  影策已有自己的报告结构 —— 只借鉴**证据三态**这一机制，不照搬结构）
- ❌ **不回溯旧报告**（§5.1）

---

## 八、工作量

| 项 | 估时 |
|---|---|
| contracts + rubrics 改动 | 0.5 人日 |
| 解析 + 渲染 + 测试 | 0.5 人日 |
| 真机验证（第 9 项） | 0.5 人日 |
| **合计** | **~1.5 人日**（S 级搭车，可中断） |

**★ 可中断性**（控制线裁定「搭车件天然可中断」）：三块独立，
contracts+rubrics 可先落（不影响既有），解析+渲染次之，真机验证最后。
