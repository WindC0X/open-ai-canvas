# 评审线 · 自纠：我上一轮报告的 B-1「行为断言」判断有误

**2026-10-06**

---

## ① 我的错误

**我在 F-09 修复批复核报告（`a92a7204`）§1 写**：
> B-1 | `capability-entries.ts` `dual_image` → `imageCount === 5` | 2 red | **2 red ✓** | 19 pass ✓

**并在 §4 写**：
> B-1 谓词接线 | ✅ **已修** | 注入谓词 → 真实入口测试 **2 red**（修复前同注入全绿）

**⇒ 这个判断【部分错误】**：
```
我跑的是【两个文件一起】：
  bun test test/f09-fix-batch.test.ts test/f09-clone-recreate-entry.test.ts
  ⇒ 2 fail
我误判为「B-1 的行为断言有效」
⇒ ★ 实际：2 fail 全部来自 f09-clone-recreate-entry.test.ts（旧文件）
   而新文件 f09-fix-batch.test.ts 的「★ 行为：谓词与入口同源」是【恒真断言】
```

---

## ② 测试线 的发现（我先看到控制线在核实，随后独立复现）

**测试线 的结论**：`f09-fix-batch.test.ts:63-71` 的断言恒真。

**我的独立复现（三种注入）**：

| 注入 | f09-fix-batch.test.ts | f09-clone-recreate-entry.test.ts |
|---|---|---|
| 谓词 → `imageCount === 5` | **10 pass / 0 fail** | **2 fail** |
| 谓词 → `Math.random() > 0.5` | **10 pass / 0 fail** | （未跑） |
| （无注入，基线） | 10 pass | 9 pass |

**⇒ 恒真确证**：谓词改成**随机值**仍 10 pass ⇒ 断言永远成立。

---

## ③ 形式化证明（我做的）

**测试代码**（`f09-fix-batch.test.ts:63-71`）：
```ts
const predicate = capabilityContextSatisfied(entry, { imageCount: count, hasSelection: true });
const rendered = resolveToolbarEntries("selection", toolContext(count), defaultToolbarPrefs("selection"))
    .some((item) => item.id === "selection-clone-recreate");
expect(rendered).toBe(predicate);      // ← ★ 断言
```

**生产代码**（`selection-toolbar-tools.tsx:15-20`）：
```ts
function cloneRecreateContextSatisfied(selectedImageCount: number): boolean {
    const entry = findCapabilityEntry("image.cloneRecreate");
    if (!entry) return false;
    return capabilityContextSatisfied(entry, { imageCount: selectedImageCount, hasSelection: true });
}
// applicable: (ctx) => cloneRecreateContextSatisfied(ctx.selectedImageCount)
```

**推导**：
```
rendered = resolveToolbarEntries(...).some(id === "selection-clone-recreate")
         = applicable(ctx) 的结果（经 resolveToolbarEntries 过滤）
         = cloneRecreateContextSatisfied(count)
         = capabilityContextSatisfied(entry, { imageCount: count, hasSelection: true })
         = predicate                                    ← 同一函数、同一入参
⇒ expect(rendered).toBe(predicate) ≡ expect(X).toBe(X) 【恒真】
```

---

## ④ ★ 重要的区分：B-1 的修复**仍然有效**，但守护来自【旧测试】

```
f09-clone-recreate-entry.test.ts:38-42（旧文件，R9 前就有）
  expect(ids).toContain("selection-clone-recreate")   ← 选中 2 张时
⇒ 谓词改 5 ⇒ 不渲染 ⇒ 红 ✓  ← 【这是真实的守护】

f09-fix-batch.test.ts:63-71（新文件，A线 修复批新增）
  expect(rendered).toBe(predicate)  ← ★ 恒真
⇒ 谓词改任何值 ⇒ 仍绿 ✗  ← 【无守护能力】
```

**⇒ 所以**：
```
· B-1 的【功能修复】有效（旧测试证明了：谓词改动 → 入口行为变）
· B-1 的【新测试】无效（恒真断言，不提供任何守护）
⇒ 我上轮说「B-1 用行为断言，质量高」—— 这句话【对旧测试成立，对新测试不成立】
```

---

## ⑤ 我的错误根因（教训二十七）

**直接原因**：我**合并跑了两个文件**，看到 2 red 就归因给「新测试」。

**深层原因**：**我没有「按文件分离」验证** ——
```
我的原做法：
  bun test <新文件> <旧文件>   ⇒ 2 fail
  ⇒ 归因：「新文件的行为断言有效」（未经分离验证）

正确做法：
  bun test <新文件>            ⇒ 0 fail  ← ★ 应单跑
  bun test <旧文件>            ⇒ 2 fail
  ⇒ 归因才能精确
```

**★ 这与我此前发现的问题【同族】**：
```
· 我上轮发现：「测试名声称 X，实际测 Y」（断言对象 ≠ 声称对象）
· 本轮我犯的：「两个文件一起跑，归因给其中一个」（证据来源 ≠ 归因对象）
⇒ 同族：**归因前必须分离证据来源**
```

**★ 与 V10-a（归因必须先核实身份）同族**：
```
V10-a（控制线/A线）：归因前核实【执行者身份】（进程 ID）
本条（我）：        归因前核实【证据来源】（哪个文件产生的红）
⇒ 都是「归因必须绑定可核实的具体对象」
```

---

## ⑥ 教训二十七（建议登记）

```
### ★ 教训二十七：归因前必须分离证据来源

实例（F-09 修复批复核）：
  · 我跑 `bun test <新测试> <旧测试>` ⇒ 2 fail
  · 归因为「新测试的行为断言有效」
  · 实际：2 fail 全来自旧测试；新测试是恒真断言（10 pass / 0 fail）
⇒ 教训：**多源证据的红数，必须按来源分离后才能归因**

【判定方法】
  · 单文件跑（不是多文件合并跑）
  · 或：注入后逐文件统计（如 `bun test <file> | grep -c "^\(fail\)"`）

【同族】
  · V10-a：归因前核实【执行者身份】（进程 ID / context ID）
  · lesson 18（R6）：对齐两条注入序列时，按【对象+形式】而非【序号】
  · 本条：归因红数时，按【文件来源】分离
  ⇒ 共同点：**归因对象必须是可独立核实的单元**
```

---

## ⑦ 对 B-1 结论的修正

**修正前**（我上轮报告）：
> B-1 谓词接线 | ✅ **已修** | 注入谓词 → 真实入口测试 **2 red**（修复前同注入全绿）

**修正后**：
```
B-1 谓词接线 | ✅ 已修（功能有效，旧测试守护）
             | ⚠️ 但新增测试（f09-fix-batch.test.ts:63-71）是【恒真断言】
             |    ⇒ 谓词改随机值仍 10 pass ⇒ 无守护能力
             |    ⇒ 建议改为【不依赖同一函数】的断言形式
```

**★ 建议的修法**（供 A线 参考）：
```ts
// 恒真写法（当前）：
const predicate = capabilityContextSatisfied(entry, {...});
const rendered = resolveToolbarEntries(...).some(...);
expect(rendered).toBe(predicate);       // ✗ 同函数同入参 ⇒ 恒真

// 可行写法 1：硬编码期望值（与实现解耦）
expect(resolveToolbarEntries("selection", toolContext(2), ...).some(i => i.id === "selection-clone-recreate")).toBe(true);
expect(resolveToolbarEntries("selection", toolContext(1), ...).some(i => i.id === "selection-clone-recreate")).toBe(false);
expect(resolveToolbarEntries("selection", toolContext(3), ...).some(i => i.id === "selection-clone-recreate")).toBe(false);

// 可行写法 2（更强）：断言「谓词被调用」
const spy = spyOn(capabilityEntries, "capabilityContextSatisfied");
resolveToolbarEntries("selection", toolContext(2), ...);
expect(spy).toHaveBeenCalled();          // ← 证明入口真的消费了谓词
```

**★ 注意**：写法 1 **就是旧文件已有的测试**（`f09-clone-recreate-entry.test.ts:38-54`）——
⇒ 新测试是**重复覆盖**且**覆盖质量更低**（恒真 vs 硬编码期望）。

---

## ⑧ 状态

- **我的报告需修正**：`docs/artifacts/f09-canvas-template-fix-review.md` 的 §1 表格 + §4 结论
- **修正方式**：建议追加「自纠附录」（不重写原报告，保留可追溯性）
- **二次复核**：范围再加一项 —— 复验 A线 是否修正了恒真断言
