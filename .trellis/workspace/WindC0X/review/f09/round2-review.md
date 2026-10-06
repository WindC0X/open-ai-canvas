# F-09 修复批第二轮复核报告

**评审线** ｜ **2026-10-06** ｜ **被测对象：`a492b089`**（A线，工作区已 STOP）

| 项 | 值 |
|---|---|
| 被测对象 | `a492b089`（fix canvas F-09 修复批第二轮） |
| 基线 | `f88feac7`（第一轮修复批） |
| 隔离树 | `/home/windc0x/oac-ext4/_f09fix` @ `a492b089` |
| HEAD 差异 | HEAD = `bc52f982`，其后仅 1 个 journal docs 提交，**代码面零变化** ✓ |
| 全量基线（我实测） | **3191 pass / 0 fail / 15959 expect / 376 files** |
| F-09 7 文件组（我实测） | **68 pass / 0 fail / 274 expect** ✓ 与 A线 声明一致 |

---

## 结论：**可合并**（0 阻塞 / 2 非阻塞）

| # | 项 | 结论 |
|---|---|---|
| **B2-1** | 派发可达性 | ★ **已修好**（双向注入 + 静态 + 位置，4 项验证全通过） |
| **N3-1** | 类型过滤 | ★ **已修好**（三场景探针全部正确） |
| **断言行为化** | A线 第二轮改动 | ★ **显著改善**（真行为断言，非文本） |
| **□5-2** | 渲染测试 | ★ **有效**（能捕获语义失效，旧文本断言不能） |
| **N-1** | 报告数字 | ⚠ **2 处偏差**（非阻塞，但需修正） |
| **N-2** | handler 体层盲区 | ⚠ **未登记**（非阻塞，建议补） |

---

## ① B2-1 派发可达性 —— ★ 已修好

### 1.1 双向注入（控制线要求）

| 注入 | 预期 | 实测（f09-fix-batch.test.ts 单文件） | 结论 |
|---|---|---|---|
| **正向**：`resolveConfigGenerateAction` 恒 `generic` | 应红 | **3 fail** ✓ | 捕获 |
| **反向**：`dispatchConfigGenerateAction` 不调 `onCloneRecreate` | 应红 | **1 fail** ✓ | 捕获 |
| 补：判据恒 `clone-recreate` | 应红 | **2 fail** ✓ | 捕获 |

**3 个红的测试名**（全为真行为断言）：
```
★ 行为：带 cloneRecreateParams 的节点 ⇒ 判据为 clone-recreate（含参数）
★ 行为：参数值原样透传（不被判据改写）
★★ 行为：dispatchConfigGenerateAction 真的调用对应 handler（spy 断言）
```

### 1.2 静态 + 位置

```
✓ dispatchConfigGenerate 调用点 = 2 个（:2341 PromptPanel / :2537 Config 真实入口）
✓ :2537 在 <CanvasConfigNodePanel（:2519 开标签）块内
✓ dispatchConfigGenerate 函数体【无分支】（if: 0 次，&&: 0 次）
  ⇒ 「改分支条件」注入点物理不存在 ✓（A线 §4 的自我发现已正确修正）
```

### 1.3 ★ 位置断言有效性（控制线的关键检查）

| 注入 | callSites | 预期 | 实测 |
|---|---|---|---|
| 删除 Config 块调用点 | 1 | 红 | **1 fail** ✓ |
| **Config 块调用移到 PromptPanel 块**（总数仍 2） | **2** | 红 | **1 fail** ✓ |

**⇒ 断言③ 确实断言了【位置关系】而非字符串存在** ✓（这是控制线特别要求验证的）

### 1.4 ⚠ 但位置断言有【脆弱性】（非阻塞）

```
实现：projectCode.slice(configPanelIndex, configPanelIndex + 1200)
实测距离：646 字符 ⇒ 余量 554 字符（约 9 行代码/注释）

【注入实证】在 Config 块内插入 ~700 字符【真实代码】（6 个假 prop）
  ⇒ 距离变为 1450 字符 > 1200 ⇒ ★ 测试红
  ⇒ 但接线【完全正确】⇒ ★ 这是【假阳性】（误报）

【阳性对照】把窗口改为 3000 ⇒ 同一注入下测试变绿 ✓
  ⇒ 证明红是窗口问题，非位置问题
```

**★ 结论**：窗口 1200 是**魔法数字**，代码增长后会**误报红**（假阳性，非静默失效）。
**建议**：改为「取到 Config 块闭合」而非固定窗口（例如匹配到 `/>` 或下一个顶层 return），或把窗口提升到 3000+ 并加注释说明余量。

**★ 注意**：注释注入**不影响**（测试先剥离注释 ✓ V9 ① 生效）—— 只有**真实代码**增长触发。

---

## ② N3-1 类型过滤 —— ★ 已修好

### 2.1 三场景探针（控制线要求）

| 场景 | 输入 | 实测结果 | 结论 |
|---|---|---|---|
| ① 只选 2 张图 | `[p, l]` | `{slot-product: p, slot-layout: l}` | ✓ |
| ② **先选文本再选 2 图** | `[t, p, l]` | `{slot-product: p, slot-layout: l}` | ✓ **文本不占槽位** |
| ③ 纯文本 | `[t1, t2]` | `{}`（零填充） | ✓ |

### 2.2 注入核对

| 注入 | A线 声明 | 我实测 | 结论 |
|---|---|---|---|
| 去掉类型过滤 | 2 red | **2 fail** ✓ | 吻合 |
| `imageSourceIds.length = 0`（保留文本、语义失效） | — | **3 fail** ✓ | 捕获 |

---

## ③ 断言行为化程度表

| 组 | 测试数 | 断言形式 | 可捕获性（实测） |
|---|---|---|---|
| **B-1**（入口消费谓词） | 1 | ★ 源码文本（含注释剥离 + 反证） | ✓ 内联化注入 ⇒ 1 fail |
| **B2-1**（派发） | 5 | ★★ 真行为（返回值 + spy handler） | ✓ 3 种注入全捕获 |
| **B2-1**（接线） | 1 | 源码文本（定义 + 2 调用点 + 位置） | ✓ 位置注入捕获（但有脆弱性，见 §1.4） |
| **N-1**（entryPoints） | 1 | 数据断言（findCapabilityEntry 返回值） | ✓ |
| **N3-1/N-3**（槽位） | 6 | ★★ 真行为（纯函数返回值） | ✓ 注入捕获 |
| **N-3**（接线） | 1 | 源码文本 | ⚠ 未单独验证 |
| **N-4**（copyMode） | 1 | 数据断言（默认值） | ✓ |
| **□5-2**（接线） | 1 | 源码文本 | ⚠ 见 §4 |
| **□5-2**（渲染） | 5（新文件） | ★ 渲染断言（HTML 字符串） | ✓ `[].map`/`span` 捕获 |

**⇒ 8 个测试组中 7 组有真行为/数据/渲染断言**（上轮仅 2 组）✓ **显著改善**

### 3.1 同源自证测试 —— ★ 已删除 ✓

```
原测试：「谓词与入口同源」expect(rendered).toBe(predicate)
  ⇒ 上轮教训：同函数同入参 ⇒ 恒真（谓词改 5 仍绿）
A线 处置：删除，注释说明「等价覆盖在 f09-clone-recreate-entry.test.ts:44/49/54」✓
```

### 3.2 ★ 但新旧两文件【互补而非重叠】（重要发现）

| 注入 | `f09-clone-recreate-entry.test.ts`（旧） | `f09-fix-batch.test.ts`（新） |
|---|---|---|
| 谓词 `=== 2 → === 5`（**语义**改动） | **2 fail ✓** | **0 fail ✗** |
| `applicable` 内联化（**文本**改动） | 0 fail | **1 fail ✓** |

**⇒ 两者各覆盖一个维度**：
```
· 旧文件：捕获【谓词语义改动】（行为断言，与实现解耦）
· 新文件：捕获【接线形式改动】（文本断言，捕获删除/改写）
⇒ ★ 不是冗余，是互补；A线 的「本处不重复」判断正确 ✓
```

---

## ④ □5-2 真实性边界 —— ★ 有效，但边界需明确

### 4.1 它是什么

```
测试方式：renderToStaticMarkup（React SSR 静态输出）
断言对象：HTML 字符串
  · 标题/hint 出现
  · templateCards 为空 ⇒ 不渲染模板区
  · 每张卡渲染为 <button>（正则匹配）
  · 模板区在「空白分镜」之后（indexOf 比较）
```

### 4.2 ★ 它能捕获什么（我实测）

| 注入 | 渲染测试（新文件） | 旧文本断言 |
|---|---|---|
| `[].map`（文本全保留、渲染为空） | **2 fail ✓** | 0 fail ✗ |
| `button → span role="none"`（无 button 语义） | **1 fail ✓** | 0 fail ✗ |
| `false && templateCards?.length` | **3 fail ✓**（含旧文件） | — |

**⇒ ★ 确实解决了「文本保留 + 语义失效」的盲区** ✓（上轮的核心批评已修复）

### 4.3 ⚠ 边界（A线 §6 已诚实登记 ✓）

```
□ 未验证：浏览器中的点击 → 模板实例化 → 节点组出现（端到端）
□ 未验证：CSS 布局/主题下的实际可见性
⇒ A线 报告 §6 明确写「renderToStaticMarkup 是 SSR 静态输出，不是真实浏览器交互验证」
⇒ ★ 定性准确，无夸大 ✓（我核实：测试文件内无 click/fireEvent/onPick 调用验证）
```

---

## ⑤ ★ 归因修正复核（控制线要求）

**控制线的修正：「N3-1 修复引入」⇒「既有路径，修复未消除」**

**★ 我独立核实：控制线正确** ✓

```
证据（我实际读取的代码）：
① f88feac7:use-canvas-template-cards.ts:59
   const instantiateTemplate = useCallback((templateId: string, sourceImageIds?: string[]) => {
   ⇒ ★ 修复前【已接收 sourceImageIds】

② f88feac7:use-canvas-template-cards.ts:89-95
   const imageSlots = instantiated.nodes.filter((node) => node.type === CanvasNodeType.Image);
   const sourceId = sourceImageIds?.[index];
   const source = sourceId ? sourceById.get(sourceId) : undefined;
   if (source?.metadata?.content || source?.metadata?.storageKey) filledByNodeId.set(slot.id, source);
   ⇒ ★ 修复前【已有】按位置取 + content 判据

③ f88feac7:project.tsx:3247
   onCreateCloneRecreate={() => instantiateTemplate("clone-recreate", Array.from(selectedNodeIds))}
   ⇒ ★ 修复前【已传图】

④ a492b089 的新增：仅【类型过滤】
   ⇒ 它【减少】可达路径（文本节点不再占槽位）

⇒ 结论：空图片节点 ⇒ 产品图槽位空 ⇒ 静默错位
   【不是 N3-1 修复引入的，是既有路径】✓ 控制线正确
```

**★ 我的错误（诚实登记）**：我对比时用了 `8f6b59ba`（F-09 交付）当「修复前」，
但基线是 `f88feac7`（第一轮修复批）⇒ 拿两个批次前的状态当对比端 ⇒ 表格失真。

**★ 修正后表述**（我采纳）：
```
「选区入口 + 空图片节点 ⇒ 可到达 N-2 错位态（既有路径，本批未消除）」
```

**★ 机制补充**（我实测）：错位发生在**生成层**的压缩，非填槽层：
```
use-canvas-media-tools.ts:1347-1348
  const images = upstream.map((item) => nodeReferenceImage(item)).filter(Boolean);
                                            ↑ 空节点在此返回 null（canvas-project-generation.ts:226）
⇒ images 压缩 ⇒ 版式图升到 images[0] ⇒ 被当成产品图
```
**⇒ 建议的防御点应在【生成层】而非【填槽层】**（若未来做防御）。

---

## ⑥ ⚠ 非阻塞发现（2 项）

### N-1：A线 报告 §5 有 2 处数字偏差

| # | A线 声明 | 我实测 | 影响 |
|---|---|---|---|
| ① | `f09-fix-batch.test.ts 19 pass`（10+9） | **18 pass**（实测 `Ran 18 tests`） | 报告数字，非功能 |
| ② | 「判据恒 `generic`」⇒ **2 red** | **3 fail**（单文件）；7 文件组 **3 fail** | 报告数字，非功能 |
| ③ | 「判据恒 `clone-recreate`」⇒ **1 red** | **2 fail**（单文件）；7 文件组 **2 fail** | 报告数字，非功能 |

**★ 注意**：③ 与我上一轮的记录（「1 red」）一致 —— 说明**上轮我也测到 1 red**，本轮测到 2 red。
**可能原因**：A线 本轮新增了「无该字段的节点 ⇒ 判据为 generic」测试，该测试也会被此注入打红。

**⇒ 定级**：非阻塞（报告数字偏差，不影响功能与守护有效性）。
**⇒ 建议**：A线 修正报告 §5 的 3 处数字，或注明「按 X 文件组计数」。

### N-2：handler 体层盲区未登记

```
注入：createCloneRecreateNode 首行早退（if (true) return;，文本全保留）
实测：f09-fix-batch.test.ts 18 pass / 0 fail ⇒ ★ 无捕获

【辨析】这是【handler 体层】盲区，不是【派发层】
  · 派发层（dispatchConfigGenerate → handler 被调用）⇒ ★ 已覆盖 ✓
  · handler 体层（内部执行逻辑）⇒ 无专项测试
     · buildCloneRecreateSubmission（纯函数）⇒ 有 6 测试 ✓（注入红 1）
     · buildGenerationConfig / getGenerationResourceNodes / setNodes 等 ⇒ 无

【A线 §1.3 声明】「project.tsx 的派发点退化为无分支纯接线 ⇒ 改分支条件注入点物理不存在」
  ⇒ ★ 该声明【只覆盖派发层】✓ 我已验证成立
  ⇒ ★ 但【未声明 handler 体层】仍有此盲区

【定级】非阻塞
  · 不是本轮修复目标（本轮目标是「派发可达」）
  · 端到端生成属渠道实测范围（A线 §6 已登记）
【建议】在 §6 诚实边界补一条：
  「handler 体层（节点创建 + 连线 + 请求发起）无专项测试，首行早退类注入无捕获」
```

---

## ⑦ 验证汇总

| 项 | 方法 | 结果 |
|---|---|---|
| 全量基线 | `bun test`（web/） | 3191 pass / 0 fail / 376 files ✓ |
| F-09 7 文件组 | 7 文件合并跑 | 68 pass / 0 fail / 274 expect ✓ |
| B2-1 正向注入 | 判据恒 generic | 3 fail ✓ |
| B2-1 反向注入 | 不调 onCloneRecreate | 1 fail ✓ |
| B2-1 位置注入 A | 删除 Config 块调用 | 1 fail ✓ |
| B2-1 位置注入 B | 移到 PromptPanel（总数不变） | 1 fail ✓ |
| 位置脆弱性 | 插入 700 字符真实代码 | 1 fail（假阳性）+ 窗口改 3000 变绿 ✓ |
| N3-1 三场景 | 探针 | 全正确 ✓ |
| N3-1 注入 | 去过滤 / `length = 0` | 2 fail / 3 fail ✓ |
| □5-2 注入 | `[].map` / `span` / `false &&` | 2 / 1 / 3 fail ✓ |
| 谓词注入 | `=== 2 → === 5` | 旧文件 2 fail / 新文件 0 fail（互补）✓ |
| 接线文本注入 | `applicable` 内联化 | 新文件 1 fail ✓ |
| handler 早退 | `if (true) return;` | 0 fail ⚠（盲区，见 N-2） |

**隔离树状态**：`_f09fix` @ `a492b089` **pristine**（0 未提交，所有注入已恢复）✓

---

## ⑧ 建议（供控制线裁定）

```
【建议 1】N-1 数字修正（0 成本）
  A线 报告 §5 的 3 处数字（19⇒18、2 red⇒3 red、1 red⇒2 red）
  ★ 或注明计数口径（单文件 vs 7 文件组）

【建议 2】N-2 边界登记（0 成本）
  §6 补一条 handler 体层盲区

【建议 3】位置断言脆弱性（低成本，可选）
  f09-fix-batch.test.ts:150 的 slice(1200) 魔法数字
  · 现状：距离 646，余量 554 ⇒ 代码增长约 9 行后【误报红】（假阳性）
  · 建议：改为「取到 Config 块闭合」，或窗口提到 3000+ 并注明余量

【建议 4】N-2 错位防御（下一批候选）
  「选区入口 + 空图片节点 ⇒ 静默错位」（既有路径）
  · 防御点应在【生成层】（nodeReferenceImage 过滤处或 images 组装后）
  · 非本批范围（修复批 vs 新功能），登记为下一批候选
```

---

## ⑨ 声明

```
· 被测对象 = commit a492b089（工作区已 STOP，无污染风险）✓
· 所有注入均在隔离树 _f09fix 执行，每次立即恢复并验证 ✓
· 未修改主仓任何文件 ✓
· 隔离树已还原 pristine ✓
· 归因修正复核：控制线正确，我已采纳（附 4 项代码证据）✓
· 本报告不作最终裁定，发现阻塞项请控制线裁定
```
