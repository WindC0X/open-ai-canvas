# F-09 画布工作流承载性验证报告

- **任务书**：`docs/artifacts/f09-canvas-workflow-validation-task-book.md`
- **执行日期**：2026-10-06
- **基线**：main @ 8f05b71a（任务书正文写的 5c5b8475 是旧值，控制线已裁定以 8f05b71a 为准）
- **执行方**：A线
- **结论**：**画布能承载 F-09** —— Q1 成立，唯一缺口是 `productImageCount` 字段透传（三期前端工作）

---

## §1 四个子问题的答案

| # | 问题 | 答案 | 验证方式 |
|---|---|---|---|
| **Q1** | @提及顺序 → `referenceImages` 数组顺序？ | ✅ **能**（普通模型渠道） | 隔离探针 + 5 条新测试 + 证伪注入 |
| **Q2** | `productImageCount` 能否被赋值？ | ✅ **已验：当前 main 无赋值来源** | 全仓 grep（仅注释提及，无赋值代码） |
| **Q3** | 透明 PNG 引导层（`metadata.locked`）？ | ⏸ **不做** —— 登记为三期设计输入 | 控制线裁定 |
| **Q4** | 端到端出图？ | ⏸ **不做** —— B线 一期门已覆盖 | 控制线裁定（重复验证违反 V1） |

---

## §2 Q1 详证（核心）

### §2.1 结论

```
数组顺序 = @提及首次出现顺序（提示词有显式 @ 时）
         = 连线顺序        （提示词无 @ 时，退化为自动输入）
```

### §2.2 实测证据（隔离探针，连线顺序固定 `[product, layout]`）

| 提示词 | `referenceImages` 数组 | 判定 |
|---|---|---|
| `@图片1 是产品，@图片2 是版式。` | **`[product, layout]`** | 正序 ✓ |
| `@图片2 是版式，@图片1 是产品。` | **`[layout, product]`** | ★ 顺序颠倒 |
| 纯文本（无 @） | `[product, layout]` | 退化为连线顺序 |
| 只 `@图片2` | `[layout]` | 单张 |

**⇒ 连线顺序相同时，仅改提示词即可改变数组顺序 ⇒ Q1 成立。**

### §2.3 机制细节（任务书 §2.1 未覆盖）

代码：`web/src/components/canvas/canvas-node-generation.ts:217-234`

1. `@图片N` 是**槽位 token**（`slotInputByToken.get("@图片1")`，:365），
   槽位由 `generationSlotEntries`（:346）**按连线顺序**分配。
2. **数组顺序**由 `matchAll` 循环里 `selectedInputs.push(input)`（:229）的
   **首次出现顺序**决定。
3. ⇒ **两个独立杠杆**：
   - 改**连线顺序** → 改变「图片1」指向哪张图
   - 改**@提及顺序** → 改变数组排列顺序

**⇒ 对任务书 §2.1 的修正表述**（控制线裁定②采纳）：

> 任务书原文「`selectedInputs.push(input)` 按提示词中 @提及 的出现顺序遍历」**正确**，
> 但易被误读为「连线顺序无关」—— 实际上**槽位 token 的指向**由连线顺序决定。

### §2.4 ★ 工作流渠道边界（控制线裁定②要求登记）

代码：`web/src/components/canvas/canvas-node-generation.ts:96`（判定）+ `:239-255`（分支实现）

```ts
const autoIncludeWorkflowMedia = isWorkflowSource || includeConnectedAudioMedia;
```

**当节点是 RunningHub 工作流**（`isCanvasWorkflowProvider(metadata) === true`，
即 `metadata.workflowProvider === "runninghub"` 或存在 `metadata.runningHubWorkflowId`）时：

- 数组**先按连线顺序**放入媒体（:246-249）
- 显式 @ 引用**追加在后面**（:250-254）

**⇒ `@提及顺序优先` 这条结论只适用于普通模型渠道，不能外推到工作流渠道。**

边界测试已锁：`工作流节点：数组按【连线顺序】而非 @提及顺序（边界锁）`
+ 对照测试 `同一提示词在普通模型节点上得到【@提及顺序】的数组`。

---

## §3 测试固化

文件：`web/test/canvas-node-generation-mentions.test.ts`（+7 条）

```
★ F-09 Q1：数组顺序 = @提及首次出现顺序
  · 两张图按 @提及顺序进入 referenceImages（产品图在前）
  · ★ 数组顺序跟随 @提及首次出现顺序（连线顺序相同、仅提示词不同）
  · 同一节点重复 @ 只入数组一次，且位置为首次出现处
★ F-09 Q1 补充：槽位 token vs 显式节点引用
  · 槽位 token @图片N 的位置不影响数组顺序（由连线顺序决定槽位）
  · 显式节点引用 @[node:id] 的顺序决定数组顺序
★ F-09 Q1 边界：工作流渠道（RunningHub）走【连线顺序优先】
  · 工作流节点：数组按【连线顺序】而非 @提及顺序（边界锁）
  · 对照：同一提示词在普通模型节点上得到【@提及顺序】的数组
```

**结果**：24 pass / 0 fail（原 17 条 + 新 7 条）

### 证伪验证（V9 纪律：红数附注入点）

| 注入 | 注入点 | 实测红数 | 恢复后 |
|---|---|---|---|
| 数组按连线顺序（而非 @提及顺序） | `canvas-node-generation.ts` `buildComposerGenerationContext` `selectedInputs` 填充逻辑 | **12 fail**（含 5 条 F-09 测试） | 24 pass ✓ |
| 删除 `autoIncludeWorkflowMedia` 分支 | `canvas-node-generation.ts:239` `if (false && ...)` | **5 fail**（含 1 条边界锁） | 24 pass ✓ |

---

## §4 Q2 详证：当前 main 无 `productImageCount` 赋值来源

**验证方式**：全仓 grep

```bash
grep -rn "productImageCount\|ProductImageCount" web/src/
```

**结果**：仅 1 处命中，且是**注释**：

```
web/src/lib/canvas/capability-entries.ts:49:
  见后端 `providerConfig.ProductImageCount` 的前置条件声明。
```

**⇒ 前端当前不传 `productImageCount` ⇒ 后端 `applyImageRolePrompt` 早返回
（`ProductImageCount <= 0`，`backend/internal/app/prompt_image_role.go:93`）**
**⇒ 角色清单不会注入 —— 这是任务书 §3 步骤 2 的缺陷（控制线已确认）**

**⇒ 三期前端实现要求**（已在 F-09 计划 §4.2 登记，控制线 commit 76e0842）：
产品图必须排在参考图之前；后端无法校验（`providerMedia` 无语义标签）。

---

## §5 遇到的问题（卡点记录）

### §5.1 环境障碍（已解决）

| # | 问题 | 解法 |
|---|---|---|
| 1 | 任务书 §7 指定的 :3020/:8488 被 B线 占用 | 用主仓 + :8489 后端 + :3030 前端（控制线批准） |
| 2 | 浏览器标签建不出来（`tmwd-browser tabs create` 超时） | CDP `Target.createTarget` |
| 3 | CDP `exec` 被其他 debugger 占用 | `Runtime.evaluate` 直连（封装 `/tmp/f09-exec.sh`） |
| 4 | 画布节点右键菜单无法通过 CDP/JS 触发 | 改用代码级验证（本报告方法） |

### §5.2 方法调整（控制线裁定 ③）

**原计划**：纯 UI 手工验证（拖拽节点 + 连线 + 点生成）
**调整后**：代码级验证（直接测 `buildNodeGenerationContext`）

**理由**：Q1 的本质是**前端逻辑**（@提及 → 数组顺序），
而 UI 拖拽方式**不影响**该逻辑 —— 用 UI 验证逻辑成本高但增益为零。

**边界**：本方法验证的是**纯逻辑**，未验证真实浏览器请求体（Q4 已裁定不做）。

---

## §6 交付物对照（任务书 §4）

| # | 交付物 | 状态 | 说明 |
|---|---|---|---|
| 1 | 画布截图/录屏 | ⏸ 未交付 | Q3 不做 ⇒ 无引导层截图；画布已搭好（2 图节点）但未完成生成节点 |
| 2 | 请求体 JSON | ⏸ 未交付 | Q4 不做 ⇒ 未触发真实请求；Q1 用函数级证据替代 |
| 3 | 输出图 | ⏸ 未交付 | Q4 不做 |
| 4 | 验证报告 | ✅ **本文件** | |
| 5 | 判断 | ✅ **能** | 见 §1 结论 |

**⇒ 交付物 1-3 未交付的依据**：控制线 2026-10-06 裁定 C（Q1 已够，不做 Q2/Q4）。

---

## §7 诚实边界

```
□ 本报告的核心证据是【函数级】测试，不是【浏览器端到端】
  · 已验证：buildNodeGenerationContext 的输出数组顺序
  · 未验证：该数组经 hydrate → 提交 → 后端收到的真实请求体
  · 替代依据：Q1 只依赖前端逻辑，函数级证据覆盖该逻辑；
             后端接收环节由 B线 一期门（4a448e06 系列）覆盖
□ Q3/Q4 未执行，依据控制线裁定
□ 输出图质量不在本任务范围（渠道质量已由一期门验证）
□ 未写任何产品代码（唯一改动是测试文件）
```

---

## §8 对「画布能否承载 F-09」的最终判断

**⇒ 能。**

**依据**：
1. **Q1 成立**（数组顺序可控）—— 核心前提 ✓
2. **F-09 编号语义可表达**：用户写 `@产品图 @参考图` + 模板 A 正文 ⇒ 数组 `[产品, 参考]`
3. **唯一缺口是 Q2**（`productImageCount` 需三期前端赋值）——
   这是**字段透传**问题，不是「画布不能承载」

**产品化最小改动**：
```
① 前端在 F-09 入口传 config.productImageCount = 产品图张数
② 用户按 @产品图 @参考图 顺序写提示词（或显式引用 @[node:id]）
③ 后端注入层自动补角色清单
```

**三期设计输入（Q3）**：
- `metadata.locked` 隐藏工具栏（防止用户误改已锁定节点）
- 透明 PNG 引导层（`locked` 节点的视觉提示）

**⇒ 无需独立 F-09 页面**（任务书的核心问题得到否定回答）。
