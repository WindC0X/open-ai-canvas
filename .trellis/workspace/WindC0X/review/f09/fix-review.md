# F-09 修复批独立复核报告

**评审线 · 第四线 · 2026-10-06**

**复核对象**：`open-ai-canvas` @ `f88feac7`（= 修复批 `40b9c915` + journal 登记，**代码面与 `40b9c915` 零差异**）
**隔离树**：`/home/windc0x/oac-ext4/_f09fix`（依赖物理隔离，lesson 16）
**基线**：`web/` 下 `bun test` → **3178 pass / 0 fail / 15923 expect / 375 files** ✓（与 A线 声称一致，连跑 3 次中 1 次命中已知 flaky）

---

## §0 ★ 我自己的纪律违反（G4.1 自报）

**事实**：13:10-13:12 我在 `/mnt/f/CODE/Project/open-ai-canvas`（**A线 的家域**）执行了
`git worktree add --detach _f09fix` + `cp -r node_modules`，持有 `.git` 锁，
撞上 A线 的 journal commit（`index.lock` 阻挡）。

**控制线的进程级证据**：PID 1007465 的父 pi 进程 `ORCA_TERMINAL_HANDLE = term_0ff98021-...`（我的 handle）。

**为什么违反**：我当时的判断是「worktree add 是只读性质的元数据操作」——
**错在没意识到它仍会短暂持有 index.lock**。

**★ 这是 lesson 16 的同族**：
```
lesson 16（R5）：依赖共享（symlink node_modules）⇒ 假红
本条（F-09）：  家域共享（在主仓做 git 写操作）⇒ 撞车
⇒ 共同的根因：共享资源的写入者互不可见
```

**我的纠正措施**：
1. 建隔离树前先 `ps aux | grep -E "git (commit|add|worktree|...)"` 查活跃操作
2. 优先从**评审仓**发起 worktree（`git worktree add` 共享对象库，跨 worktree 可用）
3. 已记入教训二十五（见 §6）

---

## §1 证伪重跑（独立注入，不复述控制线结论）

**★ 目标**：验证修复的真实性，不是「测试通过」。

| # | 注入点 | 控制线声称 | **我实测** | 恢复后 |
|---|---|---|---|---|
| B-1 | `capability-entries.ts` `dual_image` → `imageCount === 5` | 2 red | **2 red ✓** | 19 pass ✓ |
| B-2 | `project.tsx` `if (cloneParams)` → `if (false && cloneParams)` | 1 red | **1 red ✓** | 10 pass ✓ |
| N-1 | `capability-entries.ts` `create-card` target → 假值 | 1 red | **1 red ✓** | 15 pass ✓ |

**★ 三项全部复现**，与控制线声明一致。

**★ 但 B-2 的红有性质问题**（见 §2 B2-1）：
```
红的测试：「★ 派发判据是节点 metadata.cloneRecreateParams」
其断言（源码文本）：
    expect(SOURCES.project).toContain("const cloneParams = targetNode?.metadata?.cloneRecreateParams;");
    expect(SOURCES.project).toContain("if (cloneParams) {");
⇒ 红的原因是【源码文本子串不匹配】，不是【行为失效】
⇒ 该注入证明「文本断言有效」，但【不证明】派发在真实路径上可达
```

**我追加的注入（保留文本但语义失效）**：

| 注入形式 | 结果 | 说明 |
|---|---|---|
| `if (cloneParams && false) {` | **1 red** | 断言含 `"if (cloneParams) {"`（带右括号）⇒ 子串不匹配 |
| 分支内改走 `handleGenerateNode`（删除 handler 调用） | **1 red** | 另一个文本断言（`createCloneRecreateNode(targetNode, cloneParams)`）不匹配 |
| **handler 内部首行早退**（文本全保留） | **10 pass / 0 fail** | ★ **测试无法捕获 handler 的功能失效** |

⇒ **B-2 的测试是纯源码文本断言**，能捕获「删除调用」，**不能捕获「调用存在但语义失效」**。

---

## §2 ★★ 阻塞级发现

### 【阻塞】B2-1：B-2 的派发**加在 Config 节点永不渲染的组件上** —— handler 仍然零消费方

**A线 的修复**（`project.tsx:2349-2355`）：
```tsx
const targetNode = nodesRef.current.find((item) => item.id === nodeId);
const cloneParams = targetNode?.metadata?.cloneRecreateParams;
if (cloneParams) {
    void createCloneRecreateNode(targetNode, cloneParams).catch(...);
    return;
}
handleGenerateNode(nodeId, mode, prompt);
```

**★ 这段代码位于 `<CanvasNodePromptPanel>` 的 `onGenerate` 内**（`project.tsx:2301-2351`）。

**但爆款复刻节点是 `CanvasNodeType.Config`，永远不渲染 `CanvasNodePromptPanel`**：

**证据 1** —— `renderCanvasNodePanel`（`project.tsx:2286`）：
```tsx
return panelNode.type === CanvasNodeType.Config ? (
    <CanvasConfigComposer ... />        // ← ★ Config 走这里（无 onGenerate prop）
) : (
    <CanvasNodePromptPanel ... />       // ← 非 Config 走这里（A线 的派发在此）
);
```

**证据 2** —— `CanvasNodePromptPanel` 全仓仅 1 个渲染点（`project.tsx:2301`），在 Config 分支的 `else` 侧。

**证据 3** —— 真实「生成」按钮的路径：
```
canvas-config-node-panel.tsx:297   onClick={() => onGenerate(node.id)}
  → project.tsx:2499  <CanvasConfigNodePanel onGenerate={(nodeId) => { ... handleGenerateNode(...) }} />
  → handleGenerateNode（通用路径）
  ⇒ ★ 不经过 cloneParams 派发
```

**证据 4** —— `CanvasConfigComposer`（对话框内 Config 的面板）**无 `onGenerate` prop**（props 类型 `:15-25`），
⇒ 对话框内**无法触发生成** ⇒ 唯一生成入口是 `CanvasConfigNodePanel`。

**⇒ 结论**：
```
handler createCloneRecreateNode 仍然【零消费方】
⇒ B-2 未修复（声称已修，实际接线位置错误）
```

**★ 为什么测试全绿**：测试断言的是**源码文本存在**（`toContain("if (cloneParams) {")`），
而**不检查该代码是否在可达路径上**。这是**断言真实接缝 vs 断言源码文本**的差距 ——
正是我上一轮 B-1 发现（断言对象错误）的**同族**，只是换了形态：
```
B-1（上轮）：测试名声称「真实入口消费路径」，实际测工具栏自己的重复实现
B2-1（本轮）：测试名声称「handler 有真实消费方」，实际测源码文本存在
⇒ 共同点：断言对象 ≠ 声称的验证对象
```

**★ 建议修法**：
```
① 把派发逻辑移到 CanvasConfigNodePanel 的 onGenerate（project.tsx:2499）
   —— 这是 Config 节点的唯一真实生成入口
② 或抽成公共函数，两个 onGenerate 都调用（防未来分叉）
③ 测试补【渲染路径可达】断言：
   - 或断言 project.tsx 的 :2499 onGenerate 内含 cloneParams 派发
   - 或（更强）把派发抽为纯函数（如 resolveConfigGenerateAction(node) → "clone" | "generic"），
     直接单元测试该函数的返回 —— 这是行为断言，不是文本断言
```

---

## §3 非阻塞发现

### 【非阻塞】N3-1：N-3 的 `sourceImageIds` 可能填入**非图片节点**

**A线 的修复**（`project.tsx:3247`）：
```tsx
onCreateCloneRecreate={() => instantiateTemplate("clone-recreate", Array.from(selectedNodeIds))}
```

**问题**：传入的是 **`selectedNodeIds`（全部选中节点）**，而 gating 只校验 `selectedImageCount === 2`。

**★ 动态验证**（探针实测）：

| 场景 | `selectedNodeIds` | `selectedImageCount` | 填入槽位 |
|---|---|---|---|
| 只选 2 张图 | `[img-1, img-2]` | 2 ✓ | `[img-1, img-2]` ✓ |
| **先选文本节点，再选 2 张图** | `[text-1, img-1, img-2]` | 2 ✓（gating 通过） | **`[text-1, img-1]`** ✗ |

```
⇒ ★ slot[0]（产品图槽位）= text-1（文本内容）
   因为 filledByNodeId 的判据是 `source?.metadata?.content || storageKey`
   而文本节点也有 content 字段
```

**⇒ 影响**：用户选中「文本 + 2 图」时，**文本内容被填入产品图槽位**，且**不报错**。

**★ 与 N-2 的关系**：这是**同一个静默错位族**（顺序/内容契约被非预期输入破坏），
但触发条件更隐蔽（不需用户主动破坏，只需多选一个非图片节点）。

**建议修法**：
```tsx
// 过滤为图片节点后再传
onCreateCloneRecreate={() => instantiateTemplate("clone-recreate",
    Array.from(selectedNodeIds).filter((id) => nodes.find((n) => n.id === id)?.type === CanvasNodeType.Image))}
```
**或**在 `instantiateTemplate` 内按 `CanvasNodeType.Image` 过滤 `sourceImageIds`。

---

## §4 逐项核实结论

| # | 项 | 状态 | 证据 |
|---|---|---|---|
| **B-1** | 谓词接线 | ✅ **已修** | 注入谓词 → 真实入口测试 **2 red**（修复前同注入全绿） |
| **B-2** | handler 接线 | ❌ **未修**（位置错误） | 见 §2 B2-1：派发在 Config 节点不渲染的组件上 |
| **N-1** | 守卫覆盖 | ✅ **已修** | 注入假 `create-card` target → **1 red**；新增「kind 必在覆盖集合」断言 |
| **N-2** | 顺序契约 | ⚠️ **未修**（控制线裁定只登记） | `productImageCount: 1` 仍写死；裁定复核见 §5 |
| **N-3** | 选区入口语义 | ⚠️ **部分修**（有残留） | 主路径正确，但见 §3 N3-1 |
| **N-4** | `copyMode` 默认值 | ✅ **已修** | `no-copy`，依据 `F-09-IMPLEMENTATION-PLAN.md:468` |
| **新-1/新-2** | entryPoints 登记 | ✅ **已修** | 两个入口分开登记，target 各自指向真实 id |
| **新-3** | 升格枝派发 | ✅ **登记未实现**（合理） | 架构缺口，超本批范围 |
| **□5-2** | guided 态可达 | ✅ **已修** | guided + freeform 都传 `templateCards`（**只加不改**） |

---

## §5 N-2 裁定的复核（控制线请我复核）

**控制线裁定**：只登记，本批不修。
**理由**：3 条修法都有代价，且「默认路径正确、用户主动破坏才触发」。

**★ 我的复核结论：裁定合理**，理由如下：

**① A线 对修法1 的判断准确**：
```
A线 说「动态计算无法判断语义，只能按位置，等于没修」
我实测验证：
  · 按【标题】识别（如"产品图"）⇒ 与顺序解耦 ✓ 但用户重命名标题后失效（实测：空）
  · 按【位置】识别 ⇒ 顺序被破坏后同样失效（等于没修）✓
⇒ A线 的判断成立
```

**② 修法2（监听删除同步）的代价真实**：竞态 + 复杂度，且无法覆盖「用户拖拽重排」路径。

**③ 修法3（`metadata.locked`）属步骤 3**：模板卡已留 `locked` 透传链路（报告 §2.4），时机合理。

**④ 我补充一条低成本选项**（供后续批次参考，**不构成本批阻塞**）：
```
不修「自动纠正」，只加「生成前校验」：
  · 在 createCloneRecreateNode（或派发处）检查：
    产品图槽位节点是否仍存在 + 是否有 content
  · 若缺失 ⇒ message.warning("请先补充产品图") 而非静默错位
成本：约 5 行，无竞态（生成时同步检查）
⇒ 把「静默错误」降级为「显式提示」—— 符合「默认拒绝」原则
```
**★ 但这需要先修 B2-1**（派发不可达 ⇒ 校验也不可达）。

---

## §6 边界补充

**A线 §6 已登记 5 项**（新-3 未实现 / N-2 未修 / 未做浏览器实测 / B-2 端到端未验 / 8 条规则不实现）。

**我补充 3 项漏报**：

| # | 漏报边界 | 依据 |
|---|---|---|
| 1 | **B-2 派发在不可达路径**（A线 未意识到，报告称「已修」） | §2 B2-1 |
| 2 | **N-3 的 sourceImageIds 可能含非图片节点** | §3 N3-1 |
| 3 | **B-2 测试是源码文本断言**（不能捕获语义失效） | §1 注入表 |

**★ 关于「□5-2 是否影响既有 guided 态行为」**（控制线指定核实项）：

**不影响** ✓ —— 修复是**只加不改**：
```
project.tsx:2808-2824  分支顺序未变：freeform → linked → guided
:2809  <CanvasFreeformEmptyState ... templateCards={templateCards} />   ← freeform 仍传
:2822  <CanvasShortDramaEmptyState templateCards={templateCards} ... /> ← guided 新传
canvas-short-drama-entry.tsx: `templateCards?:` 可选参数 + `{templateCards?.length ? (...) : null}`
⇒ 未传时渲染 null（既有行为零变化）
⇒ 新增区域在 footer 之后，独立 `border-t` 分隔，不混入短剧引导语义
```

**★ 关于「project.tsx 是共享热区，派发是否影响 F-08/超分」**（控制线指定核实项）：

**零影响** ✓ —— 判据是 `metadata.cloneRecreateParams`，全仓**写入点只有 1 个**
（`canvas-clone-template.ts:107`，模板实例化）：
```
F-08（annotateEdit）节点：无 cloneRecreateParams ⇒ 走 handleGenerateNode
超分（superResolve）节点：无 cloneRecreateParams ⇒ 走 handleGenerateNode
⇒ 派发条件不会误判
```
**★ 但**：因 B2-1（派发不可达），这条「零影响」是**基于不可达代码的零影响** ——
修好 B2-1 后需重新核实（届时派发会在 `CanvasConfigNodePanel` 上生效）。

---

## §7 结论

### **需修复后合并**

**阻塞 1 项**：B2-1（B-2 派发在不可达路径 ⇒ handler 仍零消费方）。

**非阻塞 1 项**：N3-1（N-3 的 sourceImageIds 可能含非图片节点）。

**已修好 6 项**：B-1 / N-1 / N-4 / 新-1 / 新-2 / □5-2。
**已登记 1 项**：新-3（合理）。
**裁定未修 1 项**：N-2（裁定合理，我补一条低成本选项供后续参考）。

**★ 本批的可信部分**：
- B-1 的修复**质量高** —— 抽了 `cloneRecreateContextSatisfied` 函数 + 条目缺失时保守返回 false，
  且测试用**双向注入对照**（改谓词 ⇒ 入口变）验证，是**行为断言**
- N-1 的修复**超出我的建议** —— 不只加 `create-card`，还加了「kind 必在覆盖集合」的**防未来缺口**断言
- □5-2 的修复**只加不改**（`templateCards?` 可选 + null 兜底），零回归风险
- 全量基线 3178/0 一致

**★ 修复质量对比（值得记录）**：
```
B-1（已修，高质量）：抽函数 + 行为断言（双向注入对照）
B-2（未修）：        内联代码 + 源码文本断言
⇒ 同一批修复，两种质量 ⇒ 根因可能是 B-2 的验证方式没有对应的「行为层」可用
   （React 渲染测试基础设施缺失，见 R6 记录）
⇒ 但这不构成理由：可用【纯函数抽取 + 单元测试】替代（见 §2 建议③）
```

---

## §8 方法说明

- **隔离树**：`_f09fix` @ `f88feac7`（先 `ps aux | grep git` 查活跃操作 —— G4.1 纠正措施）
- **证伪纪律**：3 项注入，每次备份原件，恢复后必跑确认绿
- **探针**：`zz-*.test.ts` 用后即删
- **未做**：真实浏览器验证（无环境）

**★ 教训二十五：跨线的「共享资源」不只依赖，还有「家域」**

> R5 的 lesson 16 记录了「依赖共享」（symlink `node_modules` ⇒ 假红）。
> 本轮暴露**同族的另一形态**：「家域共享」——
> 我在 A线 的主仓做 git 写操作（`worktree add`）⇒ 撞车。
>
> **共同根因**：共享资源的**写入者互不可见**。
> ⇒ 依赖共享的后果是「读到他方半成品」（假红/假绿），
>   家域共享的后果是「与他方写操作互斥」（锁冲突）。
>
> **纠正**：跨线操作前先 `ps aux | grep` 查活跃进程；
> 优先从**自己的仓**发起（worktree 共享对象库，跨仓可用）。
