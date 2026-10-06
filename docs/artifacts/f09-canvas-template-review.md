# F-09 三期交付独立复核报告

**评审线 · 第四线 · 2026-10-06**

**复核对象**：`open-ai-canvas` @ `8f6b59ba`（A线 交付，未 push）
**交付面**：29 文件 +1838/-8（backend 3 + docs 1 + web 25）
**隔离树**：`/home/windc0x/oac-ext4/_f09`（依赖物理隔离，lesson 16）
**基线**：`web/` 下 `bun test` → **3167 pass / 0 fail / 15886 expect / 374 files** ✓（与控制线一致）

---

## §1 证伪重跑实测（独立注入，非复述 A线 数字）

**注入前先备份原件**，每次注入后跑 F-09 四文件，恢复后再跑确认绿。

| # | 注入点（file + 形式） | A线 声称 | **我实测** | 恢复后 |
|---|---|---|---|---|
| ① | `canvas-project-generation.ts:459` `productImageCount: node?.metadata?.productImageCount` → `undefined` | 4 red | **4 red ✓** | 30 pass ✓ |
| ② | `generation-task.ts:429` `productImageCount: config.productImageCount` → `undefined` | 3 red | **3 red ✓** | 6 pass ✓ |
| ③ | `clone-recreate-submission.ts` `[...productImages, ...referenceImages]` → `[...referenceImages, ...productImages]` | 1 red | **1 red ✓** | 30 pass ✓ |
| ④ | `clone-recreate-submission.ts` `productImageCount: productImages.length` → `0` | 1 red | **1 red ✓** | 6 pass ✓ |
| ⑤ | `clone-recreate-submission.ts` 提示词混入六段式正文 | 1 red | **1 red ✓** | 6 pass ✓ |
| ⑥ | `capability-entries.ts` `dual_image` case → `return true` | 1 red | **1 red ⚠️** | 30 pass ✓ |
| ⑦ | `selection-toolbar-tools.tsx` `applicable` → `() => true` | 2 red | **2 red ✓** | 9 pass ✓ |
| ⑧ | `capability-entries.ts` `entryPoints.target` → `"nonexistent-tool-id"` | 1 red（守卫测试） | **0 red ✗ 不可复现** | — |

**⑦ 与 ⑧ 的红数对比见 §3.2 的核心发现。**

---

## §2 ★★ 独立发现（分级）

### 【阻塞】B-1：`dual_image` 谓词**仍然悬空** —— 报告 §3.2 声称的「本批接上真实消费方」不成立

**任务书 §3.2 原文**（要求）：
> **★ 该谓词目前【悬空】**（零消费方、零测试）—— **本批 ③ 为它接上消费方**。

**报告 §3.2 原文**（声称）：
> **此前状态**：`dual_image` 谓词**零消费方、零测试**（全仓 grep 无引用）。
> **本批接上真实消费方**：选区工具栏 `selection-clone-recreate`

**实测**：
```
$ grep -rn "capabilityContextSatisfied(" web/src/ | grep -v "capability-entries.ts:269"
（空）
⇒ 该谓词在【生产代码】中零调用点 —— 仍是悬空谓词
```

**真实入口用的是【自己的重复实现】**（`selection-toolbar-tools.tsx:46`）：
```tsx
applicable: (ctx) => ctx.selectedImageCount === 2,   // ← 自己写的，不调用 dual_image 谓词
```

**★ 判定实验（决定性）**：

| 注入对象 | 「真实入口消费路径」两测试 | 「谓词与入口判定一致」 |
|---|---|---|
| **谓词**（`capability-entries.ts` 改成 `imageCount === 5`） | **全绿（未红）** | **1 red** |
| **工具栏 gating**（`selection-toolbar-tools.tsx` 去掉） | **2 red** | 全绿 |

**⇒ 结论**：标着「★ 真实入口消费路径」的两个测试，实际验证的是**工具栏自己的 `applicable`**，
**与 `dual_image` 谓词无关**。谓词改动**不影响任何真实入口行为**。

**⇒ 这构成 V1 的形态错配**：
```
测试名承诺：验证 dual_image 谓词的真实消费方
断言实际覆盖：工具栏自己的 selectedImageCount === 2（重复实现）
逃逸的缺陷：谓词被破坏/删除 ⇒ UI 行为不变（两份真值，无同步机制）
```
**⇒ 与 V9 ①-a「测试名过度声称」同族**，但更严重：不是断言太窄，而是**断言对象错误**。

**后果**：
- 报告 §3.2 的「接上消费方」是**登记层声明**，不是**运行时接线**
- 谓词与工具栏 gating **两份真值**，改一处不影响另一处（无守卫）

**★ 与「升格枝」裁定的关系**（避免误判）：
架构方案 `capability-registry-architecture.md:33` 载明「登记位独立，**升格枝**要按记录消费」——
即**注册表整体**的生产消费方属未来批次，这不是缺陷。
**但本批的声称不同**：报告 §3.2 明确说「**本批接上**真实消费方」，
任务书 §3.2 也明确要求「**本批 ③ 为它接上**消费方」。
⇒ **缺陷在于「声称已接上」与「实际未接上」的落差**，而非「注册表无消费方」本身。

---

### 【阻塞】B-2：`createCloneRecreateNode`（handler）**零消费方** —— 提交构造链路在生产路径不可达

**★ 先说明**：任务书 §3.1 要求「handler 必须先存在，条目才登记」（F-08 先例），
且架构方案的「升格枝按记录消费」意味着**未来**由升格枝派发 handler。
**但本批的声称是「接线真实性」**（报告 §3.1 列出 handler 并在 §6 列为交付面），
且 F-08/超分先例的 handler **都有真实消费点** ⇒ 本条按「与先例不一致」计。

**证据**：
```
$ grep -rn "createCloneRecreateNode" web/src/ web/test/
use-canvas-media-tools.ts:1338  ← 定义
use-canvas-media-tools.ts:1963  ← 导出
capability-entries.ts:239       ← 条目登记（字符串）
（无 project.tsx 消费）
```

**对照 F-08 / 超分先例**（handler 均有真实消费点）：

| handler | 条目 | `project.tsx` 消费 |
|---|---|---|
| `superResolveImageNode` | ✓ | ✓ `:1024` 解构 + `:3717` `onSuperResolve` |
| `editAnnotatedImageNode` | ✓ | ✓ `:1017` 解构 + `:3693` `onAnnotationEdit` |
| **`createCloneRecreateNode`** | ✓ | **✗ 未解构、无调用** |

**真实生成路径**（`project.tsx:2487`）：
```tsx
<CanvasConfigNodePanel
    onGenerate={(nodeId) => {
        void handleGenerateNode(nodeId, target?.metadata?.generationMode || "image",
                                target?.metadata?.composerContent ?? target?.metadata?.prompt ?? "");
    }}
/>
```
⇒ 走**通用路径** `handleGenerateNode`，**不经过** `createCloneRecreateNode`。

**⇒ 连带后果**：`buildCloneRecreateSubmission`（提交构造纯函数）**唯一调用点**在 handler 内部
⇒ 该函数及其 6 个测试**测的是生产不可达路径**。

**★ 但主流程功能未断**（我实测确认，避免误判为功能失效）：
```
buildGenerationConfig 从 node.metadata 读 productImageCount=1  ✓（实测序列化后 = 1）
buildGenerationConfig 从 node.metadata 读 clonePromptParams    ✓（实测序列化后 = {...}）
getGenerationResourceNodes 按连线顺序收集 [产品图, 版式参考图]  ✓（实测）
序列化后 input.referenceImages = ["p","l"] + productImageCount = 1  ✓（端到端实测）
```
⇒ **`productImageCount` 与顺序契约在通用路径下仍然生效**（因它们落在 metadata 与连线上）。

**⇒ 真正失效的是 handler 独有的那部分**：
- handler 构造的**前端提示词**（`buildCloneRecreatePrompt`）不生效
  （模板 Config 无 `composerContent`/`prompt` ⇒ 通用路径 prompt = `""`）
- `buildCloneRecreateSubmission` 的**数组拼装**（`[...productImages, ...referenceImages]`）不生效
  （通用路径直接用 `getGenerationResourceNodes` 的连线顺序）

**⇒ 定性**：**不是功能缺失，而是「死代码 + 两份实现」** ——
模板路径与 handler 路径**各自实现了一遍顺序保证**，但只有一条被执行。
**风险**：后续若有人「修复」handler 并接上，两条路径的行为可能不一致。

---

### 【非阻塞】N-1：报告 §5 注入⑧ 的红数**不可复现**（称 1 red，实测 0 red）

**根因**（我定位到机制）：守卫测试**只校验 3 种 kind**（`registry-namespace-guard.test.ts:81`）：
```ts
if (point.kind === "node-toolbar" || point.kind === "selection-toolbar" || point.kind === "main-toolbar") {
    expect(toolIdSet.has(point.target)).toBe(true);
}
```
而 `CapabilityEntryPoint.kind` 有 **6 种**取值：
```
node-toolbar       ✓ 被守卫
selection-toolbar  ✓ 被守卫
main-toolbar       ✓ 被守卫
command-palette    ✗ 静默跳过
create-card        ✗ 静默跳过   ← ★ F-09 用的正是这个
canvas-route       ✗ 静默跳过
```

**实测对照**：
```
注入 entryPoints: [{ kind: "create-card", target: "nonexistent-tool-id" }]
  → 全量 3167 pass / 0 fail     ★ 0 red

注入 entryPoints: [{ kind: "selection-toolbar", target: "nonexistent-tool-id" }]
  → registry-namespace-guard 1 fail   ✓ 1 red
```

**⇒ 两个问题**：
1. 报告 §5 注入⑧ 的「1 red（守卫测试）」**不成立**（该 kind 被守卫跳过）
2. **F-09 新登记的入口（`create-card`）实际上无守卫保护** —— 与「入口登记缺口已机器化收口」的声称不符

---

### 【非阻塞】N-2：数组顺序契约**有绕过路径**（静默错位）

**控制线要求我核实的边界**：「前端是否真的保证了？有没有路径能绕过？」

**★ 绕过路径（动态实证）**：

| 场景 | 上游图片 | `productImageCount` | 后端编号结果 |
|---|---|---|---|
| 基线（模板原样） | `[产品图, 版式参考图]` | 1 | 图1=产品图 ✓ |
| **用户删掉产品图**，只留版式参考图 | `[版式参考图]` | **仍为 1** | **图1=版式参考图 ✗ 静默错位** |
| 用户拖拽重排（`reorderCanvasResourceConnections`） | `[版式参考图, 产品图]` | **仍为 1** | **图1=版式参考图 ✗ 静默错位** |

**⇒ 根因**：`productImageCount` 是**模板实例化时写死的常量**（`canvas-clone-template.ts:105`），
**不随**用户后续的删除/重排**更新**；而顺序由**连线数组顺序**决定。
两者**无同步机制** ⇒ 一旦用户改动连线，两者失配。

**★ 与报告的差异**：报告 §7 边界只列了「未做浏览器实测」，
**未登记**「顺序契约可被用户操作破坏」这一真实边界。

**⇒ 定性**：非阻塞（**默认路径下正确**，用户需主动破坏才触发），
但属**静默错误**（不报错、模型所见相反）—— 建议补守护或补边界登记。

---

### 【非阻塞】N-3：选区入口**丢弃用户选中的图**

**接线**（`project.tsx:3227`）：
```tsx
onCreateCloneRecreate={() => instantiateTemplate("clone-recreate")}
```
`instantiateTemplate(templateId)` **只接收模板 id**，不接收选中的图。

**后果**：用户选中 2 张图 → 点「爆款复刻」→ 画布出现**另外 2 张空占位图**
（模板节点 `metadata: {}`），**选中的图未被使用**，用户需重新上传。

**★ 与任务书的差异**：任务书 §2.3 只规定**空状态卡入口**（画布为空时点卡），
**未提及**选区工具栏入口 —— 该入口是 A线 自行新增（报告 §2.3 称「额外入口」）。
⇒ 语义未经任务书定义，当前实现**未消费选区**。

---

### 【非阻塞】N-4：`copy.mode` 默认值 `auto-copy` 与调研裁决**矛盾**

**代码**（`clone-recreate-params.ts:51-56`）：
```ts
/** 默认参数（对齐 ImgAk 默认表单：cloneLevel 默认 high；文字默认自动文案）。 */
export const DEFAULT_CLONE_RECREATE_PARAMS: CloneRecreateParams = {
    cloneDegree: "high-structure",
    cloneScope: ["composition", "palette", "lighting"],
    copyMode: "auto-copy",       // ← 注释声称「对齐 ImgAk 默认表单」
};
```

**三处调研裁决均为「短期只做 `no-copy`」**：
```
F-09-IMPLEMENTATION-PLAN.md:468  短期只保留 no-copy，其余挂 F-11（文字渲染是独立能力）
SYNTH-piccopilot-full-site.md:580 短期只做 no-copy，其余挂 F-11
X02-mechanism-comparison.md:255   短期只做 no-copy，其余挂 F-11
```

**一手语料**（`wfapp-52-detail.json` `data.appData.inputs[7]`）：
```
field_path: "copy.mode"   value: "no-copy"      ← 模板实际取值
```

**一手默认表单**（`M01-meitu-clone.md:69`，bundle@1474942）：
```
cloneLevel: high（单页）、styleUnified: true、textOverlayLanguage: ...、core_point_type: "customize"
⇒ ★ 其中【没有 copy.mode】—— 「文字默认自动文案」无一手依据
```

**⇒ 两处问题**：
1. 注释「对齐 ImgAk 默认表单：文字默认自动文案」**无一手依据**（该字段不在默认表单记录里）
2. 默认值与调研裁决「短期只做 no-copy」**矛盾**

**实际后果**：用户不选参数时，提示词注入 `auto-copy` 的 des
（「自动生成 1 条简短标题…」）⇒ **会生成文字**，
而调研明确说影策「无文字层（F-11 在池）」。

### 【非阻塞】N-5：整个能力注册表零生产消费（**已裁定的设计状态，非缺陷**）

**实测**：
```
$ grep -rn "CAPABILITY_ENTRIES\|findCapabilityEntry\|capabilityEntriesByTier" web/src/ | grep -v capability-entries.ts
（空）
```

**★ 但架构方案 `capability-registry-architecture.md:33` 已载明**：
> **禁止**把能力层字段塞进 `ToolDefinition`（控制线 2026-10-03 裁定：
> **登记位独立，升格枝要按记录消费**）

⇒ **注册表的生产消费方属未来批次（升格枝）**，不是本批缺陷。
**记录在此仅为避免与 B-1/B-2 混淆** —— 二者的差异在于
**报告/任务书对本批的声称**（「本批接上」）与实际状态不符。

---

## §3 控制线已知结论的独立确认

| 控制线结论 | 我的核验 |
|---|---|
| 五段固定正文 5/5 逐字一致 | ✅ 未复核（信任控制线，非我任务范围） |
| 动态段 des 11/11 逐字一致 | ✅ 未复核（同上） |
| 全量 bun test 3167/0 | ✅ **独立确认**（`web/` 下，374 files） |
| registry-namespace-guard 14 pass | ✅ 确认（但见 N-1：覆盖不全） |
| F-09 4 测试文件 30 pass | ✅ 确认 |
| canvas-frame-config-containment 5 pass | ✅ 确认 |
| 接线真实性：`project.tsx:2775` + `:3227` | ✅ 确认存在，**但语义问题见 N-3** |
| 已知缺陷：注释索引 3 处 | ✅ 确认（`clone-recreate-params.ts:8` 写 `inputs[8]`；实测 `copy.mode` 在 `[7]`，`[8]` 是 `copy.text`） |
| 运行位置陷阱（根目录 2 fail） | ✅ 确认（`web/` 下 0 fail） |

**★ 反驳项**：报告 §5 注入⑧ 的「1 red」—— **实测 0 red**（见 N-1）。

---

## §4 边界补充（A线 §7 漏报的）

**A线 §7 已登记 7 项**（引导标记/模板市场/真机质量/用户路径不等价/参数面 UI 未做/8 条规则不实现/未做浏览器实测）。

**我补充 4 项漏报**：

| # | 漏报边界 | 依据 |
|---|---|---|
| 1 | **handler 未接线** —— `createCloneRecreateNode` 零消费方，`buildCloneRecreateSubmission` 生产不可达 | §2 B-2 |
| 2 | **谓词仍悬空** —— `capabilityContextSatisfied` 零生产调用，与报告 §3.2 声称相反 | §2 B-1 |
| 3 | **顺序契约可被用户操作破坏** —— 删除/重排连线后 `productImageCount` 不更新 ⇒ 静默错位 | §2 N-2 |
| 4 | **`create-card` kind 无守卫** —— 入口登记校验静默跳过（6 种 kind 只覆盖 3 种） | §2 N-1 |

**★ 关于「`productImageCount` 写死为 1 是否会在某路径下产生静默错误」**（控制线指定核实项）：

**会** —— 见 N-2。两条路径：
- 用户删除产品图节点（只留参考图）⇒ 参考图被当产品图
- 用户拖拽重排（若 Config 面板提供重排入口）⇒ 顺序反转

**⇒ 且两条路径都【不报错】**（后端 `providerMedia` 无语义标签，只能按位置编号）。

---

## §5 结论

### **需修复后合并**

**阻塞 2 项**（B-1 谓词悬空、B-2 handler 零消费方）—— 均为「声称与实现不符」，
不修则**能力登记层与实际运行时行为脱节**，后续升格枝/审计会基于错误前提。

**非阻塞 4 项**（N-1 注入红数不可复现 + 守卫覆盖不全、N-2 顺序契约可绕过、
N-3 选区入口语义、N-4 默认值矛盾）。

### 补充发现（见 §2.5）

**N-5：整个能力注册表零生产消费**（`CAPABILITY_ENTRIES` / `findCapabilityEntry` /
`capabilityEntriesByTier` 在 `web/src/` 中除定义文件外**均无引用**）。
**★ 这属已裁定的设计状态**（架构方案 `:33`「升格枝要按记录消费」），
**不计为本批缺陷** —— 记录在此以免与 B-1/B-2 混淆。

**★ 本批的可信部分**：
- 模板实例化（结构/容器/连线顺序）—— 纯函数，测试充分，注入全部生效
- `productImageCount` 的 metadata → 请求体链路 —— 注入①②各 4/3 red，链路真实
- 后端六段式注入 + des 逐字一致性 —— 控制线已核
- 全量基线 3167/0 一致

**★ 修复建议**（按优先级）：
1. **B-2**：`project.tsx` 解构并接线 `createCloneRecreateNode`
   （或在 Config 面板按 `entryPoints`/`capabilityContextSatisfied` 派发），
   并补「handler 被真实消费」的测试（当前测试只断言「源码里存在该字符串」）
2. **B-1**：让 `selection-clone-recreate` 的 `applicable` **消费** `capabilityContextSatisfied`，
   消除两份真值；测试改为断言「谓词被调用」而非「渲染结果」
3. **N-1**：守卫覆盖全部 6 种 kind（或至少补 `create-card`）
4. **N-2**：`productImageCount` 改为**动态计算**（按实际产品图节点数），或补用户操作后的校验
5. **N-4**：核对 `copy.mode` 默认值（对齐调研裁决 `no-copy`，或补一手依据）

---

## §6 方法说明（评审纪律）

- **隔离树**：`/home/windc0x/oac-ext4/_f09`（detached @ `8f6b59ba`），依赖 `cp -r` 物理隔离（lesson 16）
- **注入纪律**：每次注入前备份原件到 `/tmp/f09-orig-*.ts`，注入后跑测试，恢复后**必跑确认绿**
- **判定实验**（B-1）：不只读码，而是**双向注入对照**（改谓词 vs 改工具栏）——
  这是区分「真消费」与「镜像实现」的判据
- **探针**：临时探针文件（`zz-f09-*.test.ts`）用后即删，不留在树里
- **未做**：真实浏览器验证（无环境）、后端 Go 侧复核（控制线已核）

**★ 本轮方法教训（教训二十四）**：
> **「消费方」必须用「改一处是否影响另一处」判定，不能靠读码或测试名。**
>
> 我最初读 `f09-clone-recreate-entry.test.ts` 的测试名（「★ 真实入口消费路径」）
> 与报告 §3.2（「本批接上真实消费方」）时，倾向相信「已接上」。
> **只有做了双向注入对照，才暴露「测试测的是镜像实现」**。
>
> ⇒ 同族于教训二十二（不凭来源判定数字有效）、二十三（不凭结论方向判定算式有效）：
> **本条：不凭声明判定接线有效。**
