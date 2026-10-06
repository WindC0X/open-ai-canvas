# 评审线 · 预演结论：**方向正确**（附一个意外收获）

**2026-10-06 13:47** ｜ **快照 md5**：`1dd9ec2d 6127ab2b e265bfa9 ce5d7fa3 bc41ed8f d00474e3`

---

## ① 结论：**修复方向正确** ✓

**新架构**（我实测）：
```
project.tsx
  dispatchConfigGenerate(nodeId, mode, prompt)         ← 唯一入口（useCallback）
    → dispatchConfigGenerateAction(node, mode, prompt, { onCloneRecreate, onGenericGenerate })
      → resolveConfigGenerateAction(node)              ← 纯函数判据
```

**我的 6 项验证**：

| # | 验证项 | 结果 |
|---|---|---|
| ① | **静态**：`dispatchConfigGenerate` 调用点 | **2 个** ✓ 分别在 `CanvasNodePromptPanel`（通用）+ **`CanvasConfigNodePanel`（Config 真实入口）** |
| ② | 行为：`resolveConfigGenerateAction` 返回值 | ✓ 测试存在（含 `undefined`/`null`/无字段/有字段 4 种） |
| ③ | 行为：`dispatchConfigGenerateAction` spy | ✓ 测试存在（spy handler 断言「哪个被调用」） |
| ④ | 行为：`resolveTemplateImageSlots` 过滤 | ✓ 测试存在（文本节点不得占产品图槽位） |
| ⑤ | 接线：`:2537` 在 `CanvasConfigNodePanel` 块内 | **✓ 确认**（我做了位置解析：最近的组件标签 = `<CanvasConfigNodePanel`） |
| ⑥ | 接线测试的位置断言 | **✓ 有效**（见 ③ 意外收获） |

**⇒ B2-1 的根因已修**（派发从不可达的 `CanvasNodePromptPanel` 移到了 Config 真实入口）。

---

## ② ★★ 意外收获：我在 A线 注入间隙抓到了快照，**恰好验证了它的新测试有效**

**时间线**（我导出 patch 时正好撞上 A线 的注入验证）：
```
13:44:31  主仓组件 = templateCards.map + <button>          ← A线 正确实现
13:45:20  我导出 v1 ⇒ [].map（卡片列表恒空）                ← ★ A线 注入 A
13:45:40  主仓组件 = templateCards.map + <span role="none"> ← ★ A线 注入 B（改元素类型）
13:46:18  我导出 v2 ⇒ <span role="none">                    ← 仍是注入态
```

**★ 我在注入 B 状态下跑测试，得到**：
```
(fail) □5-2 guided 态模板卡（★ 真实渲染断言）
       > ★ 行为：每张卡渲染为【可点击 button】（不是纯文本）
```
**⇒ 结论：A线 的新渲染测试【确实能捕获「元素类型变化」】** ✓

**对比旧文本断言**：
```
旧（f09-fix-batch.test.ts）：expect(source).toContain("或从现成模板开始")
  ⇒ 注入 B 时该文本【仍在】⇒ 旧断言【不红】✗
新（f09-guided-template-cards-render.test.tsx）：renderToStaticMarkup + 匹配 <button>
  ⇒ 注入 B 时无 <button> ⇒ 新断言【红】✓
```
**⇒ 这正是「行为断言 vs 文本断言」的实证对照**（A线 用注入自证了新测试的价值）。

---

## ③ 一个观察（非缺陷）：A线 的注入验证会【短暂污染工作区】

**现象**：A线 连续做了至少 2 次注入（A: `[].map`；B: `<span role="none">`），
每次恢复，但我两次抓取**都落在注入间隙**。

**⇒ 影响**：
```
· 若有其他线在此期间导出工作区快照 ⇒ 会抓到注入态（我遇到了）
· 若注入未及时恢复（崩溃/中断）⇒ 工作区残留缺陷代码
```

**★ 建议**（供你参考，不是 A线 的错误）：
```
① 注入验证最好在【独立树】做（不污染共享工作区）
② 若必须在主仓做 ⇒ 每次注入后【立即】恢复（A线 做到了，只是我撞上了间隙）
③ 其他线导出快照前，先核对 md5（我这次的做法 ✓）
```

---

## ④ 待正式复核时验证（基于 commit，不基于 WIP）

```
① B2-1：注入 resolveConfigGenerateAction 返回值 ⇒ 行为测试必红
② N3-1：注入 resolveTemplateImageSlots 过滤失效 ⇒ 行为测试必红
③ N-3 / □5-2：用测试线 的 C/D 手法复验（保留文本 + 语义失效）
④ B-1：恒真断言是否已删（我看到 WIP 里已删 ✓，正式复核确认）
⑤ 基线：全量一次
```

**★ 我预判的残留风险**（正式复核时重点看）：
```
· f09-fix-batch.test.ts 仍保留【部分源码文本断言】（接线存在性检查）
  ⇒ 但已剥离注释 + 计数调用点 + 定位 Config 面板块
  ⇒ 合理（行为断言覆盖语义，结构断言覆盖「位置正确」）
  ⇒ 但 slice(1200) 有 554 字符余量 ⇒ 若注释再增会静默失效（观察点）
```

---

## ⑤ 我的隔离树状态

```
当前：应用了 A线 的 WIP v2 快照（md5 一致）
⇒ 预演完成后我会【还原到 f88feac7】（5 层检查）
⇒ 正式复核时重新应用 commit 版
```

---

## ⑥ 请回报

```
□ 预演结论：方向正确 ✓（含 ② 意外收获：A线 新测试有效已被我实测确认）
□ 未发现方向性问题 ⇒ 无需转 A线
□ 我待命，等正式复核（A线 commit 号）
