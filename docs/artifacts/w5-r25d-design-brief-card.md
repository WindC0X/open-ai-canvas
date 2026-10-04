# R25d 设计 brief 补全（W5 搭车件）

> **依据**：`竞品深拆-吸收落地方案-2026-10-01.md` §3.4.3（最高性价比三项之一）
> **定位**：W5 搭车件（S 级，零模型成本，实体已在位）
> **状态**：设计卡（控制线 2026-10-04 裁定「搭车件继续」）
> **日期**：2026-10-04
> **执行**：A 线

---

## 一、任务定义（深拆原文）

> **R25d 设计 brief** | 借鉴 **Magnific `DESIGNER`** 全链（`plan-prompt` → `compose-brief`）
> | 为什么：`creative-scenarios.ts` 已同构，**缺三件小事**：`design_system` 分组、`options` 升 chips 控件、`deliverables` 字段

**关键定性**：**「缺三件小事」** —— 不是新建能力。

---

## 二、现状实勘

### 2.1 实体（`web/src/lib/creation/creative-scenarios.ts`，100 行）

```ts
export type CreativeScenarioId = "general" | "short-film" | "marketing" | "ecommerce";

type QuestionGuide = { field: string; when: string; title: string; options?: string[] };

export type CreativeScenario = {
    id: CreativeScenarioId;
    label: string;
    instruction: string;
    fields: Record<string, string>;
    questionGuides: QuestionGuide[];
    proposalSections: string[];
    workflowRules: string[];
};
```

**4 个场景**：general / short-film / marketing / ecommerce（各含 fields + questionGuides + proposalSections + workflowRules）

### 2.2 三件小事的现状核实

| # | 深拆说的缺口 | 实勘结果 |
|---|---|---|
| 1 | `design_system` 分组 | ⚠️ **部分存在**：`ecommerce` 有 `brand` 字段（"品牌和包装标识"）、`marketing` 有 `brand`（"品牌名、Logo、品牌色及口吻"）—— 但**无独立分组**，散在 fields 里 |
| 2 | `options` 升 chips 控件 | ✅ **★ 已兑现**：`options` 已渲染为可点选项（见 §2.3） |
| 3 | `deliverables` 字段 | ❌ **不存在**：`proposalSections` 有「交付清单」文本，但**无结构化 `deliverables`** |

### 2.3 ★★ 关键发现：`options` 的 chips 渲染**已存在**（深拆判断已过时）

实勘 `creative-agent-cards.tsx`：

```tsx
// L23：options 被取出
const options = question.type === "asset" ? assets : question.options;
// L44：渲染进「可点选项」容器
<div className="creative-agent-options">
```

**⇒ `options` 已经是可点选项**（`creative-agent-options` 容器），
**深拆说的「升 chips 控件」在数据层与渲染层均已存在**。

**★ 深拆判断过时的可能原因**：深拆基于 `creative-scenarios.ts` 的**数据结构**推断
（那里只有 `options?: string[]`），未追到 `creative-agent-cards.tsx` 的渲染层。

**⇒ 修正后的三件小事**：

| # | 深拆说的缺口 | 修正后的实况 |
|---|---|---|
| 1 | `design_system` 分组 | ⚠️ **真缺口**（品牌信息散在 fields，无独立结构） |
| 2 | `options` 升 chips | ✅ **已兑现**（渲染层已有 `creative-agent-options`）—— **本卡无需动** |
| 3 | `deliverables` 字段 | ❌ **真缺口**（无结构化交付物） |

**⇒ 实际只剩「两件小事」**（小事二已兑现）。

---

## 三、设计（两件小事 + 一项已兑现）

### 3.1 小事一：`design_system` 分组

**现状**：品牌信息散在 `fields`（`brand` 键）。

**目标**：独立 `designSystem` 结构，承载**品牌套件**语义（与 R25e 品牌套件对接）：

```ts
/**
 * 设计系统（R25d，借鉴 Magnific DESIGNER 的 design_system 分组）。
 *
 * ★ 与 R25e 的关系：R25e 的 design_system 分组是本字段的**前置**
 * （深拆 L628：「R25e 的 design_system 分组是 R25d 设计 brief 的前置」）。
 * ★ 与 style-profile.ts 的区别：后者是**画布内风格资产**，本字段是**品牌套件**
 * （深拆 L628 明记：「影策 style-profile.ts 是画布内风格资产、非品牌套件，
 * 需新增品牌套件结构（AST-06 已在 FINAL-REPORT §3.5.1 判 P1）」）。
 */
export type DesignSystem = {
    /** 品牌名 */
    brand?: string;
    /** Logo 资产引用 */
    logoRef?: string;
    /** 品牌色（语义 token 名或色值） */
    colors?: string[];
    /** 字体族 */
    typography?: string;
    /** 品牌口吻（文案调性描述） */
    tone?: string;
};
```

**挂载**：`CreativeScenario` 新增 `designSystem?: DesignSystem`（可选，未填则不注入 brief）。

### 3.2 小事二：`options` 升 chips 控件 —— **已兑现，本卡无需动**

**实勘结论**：`options` 已渲染为可点选项（`creative-agent-cards.tsx:23/44`
的 `creative-agent-options` 容器）。

**⇒ 本卡对此项的动作：无**（不重复造）。

**★ 但与直线入口卡的关系仍需注意**：直线流程的「≤3 问」要复用**同一套**选项渲染
（`creative-agent-options`），**不新建 chips 组件** —— 保持单一实现。

### 3.3 小事三：`deliverables` 字段

**现状**：`proposalSections` 有「交付清单」**文本**，无结构化字段。

**目标**：结构化交付物描述：

```ts
/**
 * 交付物（R25d）。
 *
 * ★ 为什么结构化：直线入口卡（档 0）的「交付步」需要知道**交付什么**
 * （图片？视频？几张？什么规格？），才能生成正确的下载/交付 UI。
 */
export type Deliverable = {
    /** 交付类型 */
    kind: "image" | "video" | "text" | "mixed";
    /** 数量（可选） */
    count?: number;
    /** 规格（比例/分辨率等） */
    spec?: string;
    /** 用途说明 */
    purpose?: string;
};
```

**挂载**：`CreativeScenario` 新增 `deliverables?: Deliverable[]`。

---

## 四、★ 与直线入口卡的接口（本卡的实际价值）

**R25d 不是孤立的美化** —— 它是**直线入口卡（档 0）的数据基础**：

| 直线入口卡需要 | R25d 提供 |
|---|---|
| 卡流程的「≤3 问」 | `questionGuides` + **chips 控件**（小事二） |
| 卡流程的「出图」目标 | `deliverables`（小事三）—— 知道要出几张什么 |
| 卡流程的品牌一致性 | `designSystem`（小事一）—— 品牌套件注入 |

**⇒ 两卡协同**：直线入口卡消费 R25d 增强后的 `CreativeScenario`。

---

## 五、文件清单

| 文件 | 动作 | 说明 |
|---|---|---|
| `web/src/lib/creation/creative-scenarios.ts` | 改 | 新增 `DesignSystem` / `Deliverable` 类型 + 三字段 |
| ~~`question-chips.tsx`~~ | **不做** | chips 渲染已存在（`creative-agent-options`），不重复造 |
| `web/src/lib/creation/creative-agent-contract.ts` | 改 | brief 组装时注入 designSystem/deliverables |
| `web/test/creative-scenarios-r25d.test.ts` | **新增** | 三字段测试 |

**★ 待核实项**（实施首步）：`questionGuides[].options` 的现有渲染方式。

---

## 六、验收

| # | 验收 | 验证方式 |
|---|---|---|
| 1 | `designSystem` 字段在位（4 场景可选） | 类型 + tsc |
| 2 | `deliverables` 字段在位 | 同上 |
| 3 | ~~`options` 渲染为 chips~~ | **已兑现**（`creative-agent-options`），改为**回归测试**（直线流程复用同一渲染） |
| 4 | brief 组装注入新字段 | 单元测试（组装结果含品牌/交付物） |
| 5 | 未填字段不注入（不产生空占位） | 单元测试 |
| 6 | 4 场景全部兼容（既有行为不破） | 回归测试 |

---

## 六.1 诚实边界（★ 深拆判断过时的登记）

**深拆说「缺三件小事」，实勘后只剩两件** —— `options` 的 chips 渲染**已存在**。

**登记理由**：这是**深拆判断过时**的实例（深拆基于数据层推断，未追渲染层）。
与「计数纪律」「假命中家族」「跨枝比较」「样本偏差」同属**工具/方法误判**大类，
但**性质不同**：前四者是**我的误判**，本条是**既有文档的判断随代码演进而过时**。

**处置**：不追改深拆文档（历史记录），在**本卡**登记修正。
**建议**：后续消费深拆结论时，**先核实实现层**（不只读数据层）。

## 七、不做

- ❌ **不做品牌套件完整实现**（那是 R25e，本卡只留 `designSystem` 结构）
- ❌ **不改 `instruction` / `workflowRules`**（现有内容已精细，不动）
- ❌ **不做 brief 的 LLM 生成**（`plan-prompt` → `compose-brief` 是 Magnific 的产品形态；
  影策的 brief 由 Agent 按 `instruction` 生成，本卡只补**数据字段**）
- ❌ **不新增场景**（4 个够用）

---

## 八、工作量

| 项 | 估时 |
|---|---|
| 两字段类型 + 数据填（designSystem / deliverables） | 0.5 人日 |
| brief 注入 + 测试 | 0.5 人日 |
| **合计** | **~1.0 人日**（S 级搭车，可中断；较原估减 0.5，因 chips 已兑现） |
