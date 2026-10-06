# F-09 三期修复批交付报告

- **任务**：修复批任务书（控制线 2026-10-06），门 2 已绿后的缺陷修复
- **起点**：main @ 9b80133d
- **执行**：A线
- **性质**：缺陷性质 = **登记层与运行时接线脱节**（非功能失效）
- **结论**：2 阻塞 + 4 非阻塞 + 控制线新查 3 项 + □5-2 = **全部处理**

---

## §1 修复清单与可证伪证据

| # | 缺陷 | 修法 | 注入点 | 实测红数 | 恢复 |
|---|---|---|---|---|---|
| **B-1** | `dual_image` 谓词悬空（入口内联比较 = 两份真值） | 入口改为**调用能力层谓词函数** | `capability-entries.ts` `dual_image` case → `return true` | **3 red**（含真实入口路径 2 条） | ✓ |
| **B-2** | handler `createCloneRecreateNode` 零消费方 | `project.tsx` `onGenerate` 按 `metadata.cloneRecreateParams` 派发 | `project.tsx` `if (cloneParams)` → `if (false && cloneParams)` | **1 red** | ✓ |
| **新-1** | `entryPoints.target` 语义未明（模板 id 混作 tool id） | 两个入口分开登记 + 守卫按 kind 分源校验 | 见 N-1 | — | ✓ |
| **新-2** | 选区工具栏入口未登记 | `entryPoints` 加 `{ kind: "selection-toolbar", target: "selection-clone-recreate" }` | `capability-entries.ts` target 改不存在值 → 守卫红 | **1 red**（守卫） | ✓ |
| **新-3** | 升格枝无运行时派发机制 | 本次不实现（超出本批范围），登记为架构缺口 | — | — | 登记 |
| **N-1** | 守卫只覆盖 3/6 kind（`create-card` 静默跳过） | 扩 `GUARDED_ENTRY_KINDS` + `CANVAS_TEMPLATES` 校验源 + 「kind 必在覆盖集合」断言 | 同上 | **1 red** | ✓ |
| **N-3** | 选区入口丢弃用户选中的图 | `instantiateTemplate(templateId, sourceImageIds?)` 填入图片槽位 | `project.tsx` 不传 `selectedNodeIds` → 测试红 | 接线断言 | ✓ |
| **N-4** | 默认 `copyMode: auto-copy` 与调研裁决矛盾 | 改 `no-copy`（依据 `F-09-IMPLEMENTATION-PLAN.md:468`） | `clone-recreate-params.ts` 改回 `auto-copy` | **1 red** | ✓ |
| **□5-2** | 模板卡在 guided 态不可达（默认路径判据① FAIL） | guided 态加**独立区域**（方案 D） | `project.tsx` guided 态不传 `templateCards` | **1 red** | ✓ |

**合计**：8 处注入，实测 **3/1/1/1/1/1/1/1 red**，恢复后全部 0 fail。

---

## §2 关键修复详述

### §2.1 B-1：谓词接线（控制线双向注入对照的修复）

**修复前**：
```tsx
applicable: (ctx) => ctx.selectedImageCount === 2,   // ← 谓词的第二份实现
```
**修复后**：
```tsx
applicable: (ctx) => cloneRecreateContextSatisfied(ctx.selectedImageCount),
// 函数体：capabilityContextSatisfied(entry, { imageCount: selectedImageCount, hasSelection: true })
```

**接线验证（决定性）**：
| 注入对象 | 修复前 | 修复后 |
|---|---|---|
| 谓词（`imageCount === 2` → `=== 5`） | 真实入口测试**全绿**（未红） | **真实入口测试 2 red** ✓ |

**⇒ 修复前「改谓词入口不红」= 两份真值；修复后「改谓词入口红」= 单一真值** —— 这正是接线成立的判据。

**架构合规性**：不违反「禁止把能力层字段塞进 ToolDefinition」（架构方案 §1.1）——
本处是按钮层**调用**能力层**谓词函数**，不是把能力层字段搬进按钮层结构。

### §2.2 B-2：handler 派发

**派发判据**：节点 `metadata.cloneRecreateParams` 存在 ⇒ 走 `createCloneRecreateNode`。
**为什么用 metadata 而非节点类型**：模板实例化时写入该字段 ⇒ 只有爆款复刻模板产出的生成节点
走专属链，**其他 Config 节点零影响**（RunningHub 工作流节点等不受干扰）。

**与先例一致**（F-08 / 超分）：
```
F-08：project.tsx:1017 解构 + :3693 void editAnnotatedImageNode(node, payload)
超分：project.tsx:1024 解构 + :3717 void superResolveImageNode(node, params)
F-09：project.tsx:1018 解构 + :2340 void createCloneRecreateNode(targetNode, cloneParams)
```

### §2.3 □5-2：guided 态可达（方案 D）

**控制线裁定**：这是**缺陷**（任务书 §2.3 判据①写的是「空状态出现」，不是「freeform 态出现」）。

**方案 D 实现**：guided 态加 `templateCards` prop，渲染为 **footer 之后的独立区域**
（标题「或从现成模板开始」），**不混入短剧流程引导**（语义边界：上方「开始创作」，下方「现成模板」）。

**为什么不用方案 A**：A 是把卡混进 `canvas-entry-actions`（短剧引导区）⇒ 语义冲突；
D 用独立区域达成同样可达性，且语义清晰。

### §2.4 N-3：选区入口填入选中图

```tsx
instantiateTemplate("clone-recreate", Array.from(selectedNodeIds))
```
模板的图片槽位按 `nodes` 顺序填充（**产品图槽位在前、版式参考图槽位在后**），
与 `buildCloneRecreateSubmission` 的数组顺序契约一致。

---

## §3 未修项与上报

### §3.1 新-3：升格枝无运行时派发机制（登记，本批不实现）

```
grep -rn "entryPoints" web/src/  →  除 capability-entries.ts 外零命中
⇒ 没有任何按 entryPoints 派发入口的运行时机制
```
**性质**：架构缺口（非本批引入）。**处理**：登记，不改架构。
**影响**：`entryPoints` 当前是**声明 + 守卫校验**，不是运行时派发源 —— 入口靠手工接线。
**若未来实现升格枝**：须先扩 `GUARDED_ENTRY_KINDS`（N-1 已加断言强制此点）。

### §3.2 N-2：顺序契约可被用户操作破坏（★ 需控制线裁定）

**问题**：`productImageCount` 在模板里**写死为 1**。用户若：
- 删除产品图节点 ⇒ 实际输入只剩版式参考图，但 `productImageCount` 仍为 1 ⇒ **静默错位**
- 调整连线顺序（把参考图连在前面）⇒ 同样静默错位

**为什么本批未修**：后端**无法校验**（`providerMedia` 无语义标签，只能按位置编号）。
前端可选的修法都有代价：
```
① 动态计算（从连线推断哪张是产品图）—— 无法判断语义，只能按位置，等于没修
② 监听节点删除并同步 productImageCount —— 复杂且仍有竞态
③ 产品图槽位加「锁定」标记（metadata.locked）—— 属步骤 3 范围
```
**⇒ 上报请裁定**：是否值得修，还是只登记边界（报告 §7 已登记）。

### §3.3 待裁定 A：□5-2 已按你的裁定修复（缺陷定性）

已实现，见 §2.3。

---

## §4 门禁（原始输出）

```
① tsc --noEmit ........................ exit 0
② eslint（本批改动文件面）............. exit 0
③ 全量 bun test ....................... 3178 pass / 0 fail / 15923 expect / 375 files
                                        （修复批起点 3167 ⇒ +11 新测试）
④ registry-namespace-guard.test.ts .... 15 pass / 0 fail（原 14 + 1 新增 kind 覆盖测试）
⑤ F-09 测试组（6 文件）................ 55 pass / 0 fail
⑥ go build ./... ...................... exit 0（本批未改后端，确认无破坏）
⑦ go test -run Clone .................. ok
```

---

## §5 拓扑与文件清单

**拓扑**：`main @ 9b80133d`（起点）→ 修复批工作区改动 → 单 commit

**文件面（9 修改 + 1 新增）**：
```
M web/src/lib/canvas/capability-entries.ts                        entryPoints 两入口登记
M web/src/lib/canvas/clone-recreate-params.ts                     N-4 默认值 no-copy
M web/src/lib/canvas/tool-registry/definitions/selection-toolbar-tools.tsx  B-1 消费谓词
M web/src/pages/canvas/project.tsx                                B-2 派发 + N-3 传选中图 + □5-2 guided 接线
M web/src/pages/canvas/use-canvas-template-cards.ts               N-3 sourceImageIds
M web/src/components/canvas/canvas-short-drama-entry.tsx          □5-2 guided 态模板卡区域
M web/test/f09-canvas-clone-template.test.ts                      N-4 断言同步
M web/test/registry-namespace-guard.test.ts                       N-1 扩 kind 覆盖
A web/test/f09-fix-batch.test.ts                                  修复批接线断言（10 测试）
```

---

## §6 诚实边界

```
□ 新-3（升格枝运行时派发）未实现 —— 架构缺口，登记不改
□ N-2（顺序契约可绕过）未修 —— 需控制线裁定（见 §3.2）
□ 本批验证仍为【函数级 + 源码级】，未做浏览器实测
  · □5-2 的「guided 态看到卡」是接线 + 源码断言，未在真实浏览器确认渲染
□ B-2 派发路径的端到端（点生成 → 请求体带 productImageCount + clonePromptParams）
  未做真实生成验证（属渠道实测）
□ 8 条未实现的 concatRules 仍不实现（三期无 UI 可填值）
```

---

## §7 口径声明

- **版本**：main @ 9b80133d（修复批起点）
- **一手材料**：N-4 依据 `F-09-IMPLEMENTATION-PLAN.md:468`（「短期只保留 no-copy」）
- **注入红数**：8 处注入，实测 3/1/1/1/1/1/1/1 red（附注入点，V7 附1-a）
- **接线判据**：B-1 的验收标准是「改谓词 ⇒ 入口测试红」（非「两边各自算对」）
