# R4 追加 · `dc8965a0` + `9c75ddaf` 独立核验

**方法**：临时 worktree（`_r4-dprobe` @ `dc8965a0`，用完即删）+ 逐条注入证伪
**结论**：**`dc8965a0` 通过**（两级证伪均成立）；**`9c75ddaf` 通过但有 P2**（一条断言被注释满足）

---

## §1 核验总表

| commit | 条目 | 基线 | 我的独立证伪 | 判定 |
|---|---|---|---|---|
| `dc8965a0` | T2-P1a 行为级断言 | 15 pass / 0 | 行为级注入 → **1 红** ✅；接线级注入 → **1 红** ✅ | **通过** |
| `9c75ddaf` | superres rider | 37 pass / 0 | 移除 `message.error` → **1 红**（声称 2 红） | **通过 + P2** |

---

## §2 `dc8965a0` T2-P1a —— 修复质量高

### 2.1 拓扑澄清（重要）

**我先核实了这两条 commit 的拓扑**（因它们的 parent 是我的评审分支 `b36df19d`）：
```
fix/w5-review-r1-r2（A线）：
  3fe603d2 A-1 版本校验登记
  dc8965a0 test(canvas): T2-P1a 补行为级断言  ← 本次核验
  9c75ddaf fix(canvas): 超分失败必须可见      ← 本次核验
  e2431865 fix(canvas): 画布库分页过滤死锁 - T2-P1a   ← ★ 真正的 T2-P1a 修复
  ...
```
⇒ A线 基于我的评审分支建枝（**正常协作**，它需要我的核验结论）；
⇒ **`e2431865` 是 T2-P1a 的实际修复**（`hydrated && visibleProjects.length` → `|| hasMore`），
**`dc8965a0` 是后续重构**（抽纯函数）。**两者都正确**。

### 2.2 修复形态

```ts
// 新增纯函数（workspace-type.ts）
export function shouldRenderLoadMore(input: { hydrated: boolean; visibleCount: number; hasMore: boolean }): boolean {
    if (!input.hydrated) return false;
    return input.visibleCount > 0 || input.hasMore;
}

// 接线处（index.tsx）
{shouldRenderLoadMore({ hydrated, visibleCount: visibleProjects.length, hasMore }) ? (
```
⇒ **行为从源码文本断言升级为可测的纯函数三态** —— 这是**正确的方向**（回应 R3 的「源码文本断言」批评）。

### 2.3 独立证伪（两级，均成立）

| 注入 | 结果 |
|---|---|
| **行为级**：纯函数改为 `return input.visibleCount > 0;`（只看可见数） | **14 pass / 1 fail** ✅ |
| **接线级**：恢复旧条件 `hydrated && (visibleProjects.length \|\| hasMore)` | **14 pass / 1 fail** ✅ |

⇒ **与 A线 声称的「两级各一次」完全一致**。

### 2.4 评价

**这是本仓「源码文本断言 → 行为级断言」改造的正面范例**：
- 抽纯函数使**三态契约**（有可见项 / 空且无下一页 / 未 hydrate）可单测
- 文本断言**降级为接线守卫**（断言「走了该函数」），职责分离正确
- **两级证伪**（行为 + 接线）覆盖了两个失效面

---

## §3 `9c75ddaf` superres rider —— 修复正确，但发现 P2

### 3.1 修复形态

```ts
} catch (error) {
    if (isGenerationCanceled(error)) return;
    const details = generationErrorMessage(error);
    message.error(details);              // ★ 新增：原先只写节点态，无用户提示
    setNodes((current) => current.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: details } } : item)));
}
```
两处补丁（`superResolveImageNode` :1646 + `generateAngleNode` :1695）——**同族一并收口**，正确。

### 3.2 独立证伪

| 注入 | 结果 |
|---|---|
| 删除 `superResolveImageNode` 的 `message.error`（:1646） | **36 pass / 1 fail**（声称 2 红） |

### 3.3 ★ P2：第二条断言被**注释内的字样**满足

**A线 声称**：「注入『移除 superResolve 的 message.error』→ **2 红**」
**我实测**：**1 红**。

**第二条断言**（`super-resolve.test.ts:389-398`）：
```ts
test("★ 反向：不得只写节点态而无提示（原缺陷形态）", async () => {
    const source = await Bun.file(new URL("../src/pages/canvas/use-canvas-media-tools.ts", import.meta.url)).text();
    const start = source.indexOf("const superResolveImageNode = useCallback");
    const end = source.indexOf("const generateAngleNode = useCallback");
    const body = source.slice(start, end);
    const catchIndex = body.indexOf("if (isGenerationCanceled(error)) return;");
    const catchBlock = body.slice(catchIndex, catchIndex + 600);   // ← ★ 固定 600 字符窗口
    expect(catchBlock).toContain("message.error");
});
```

**假绿机制**（探针实测，注入态下）：
```
catchIndex = 4270, 窗口 = [4270, 4870)
窗口含 "message.error" ? true
message.error 出现位置: [277]
窗口 240-340 区间 = "          // / maskEditImageNode 等）的 message.error 约定不一致。\n            setNodes((current) => current."
★ 剥离注释行后，窗口内还有 message.error ? false    ← 决定性
```

⇒ **窗口内唯一的 `message.error` 出现在注释里**：
```ts
// ★ superres rider（测试线 b12r18）：catch 原先只写节点态、**不弹提示** ——
// 用户可见症状「弹窗关闭 + 无请求 + 节点留 loading」，与同族工具（editImageNode
// / maskEditImageNode 等）的 message.error 约定不一致。      ← ★ 这一行满足了断言
```

**★ 这是「注释免疫」的又一实例**（R3 的 T1-P2 同族）：
- **修复时**：注释与代码同时存在 ⇒ 断言绿（正确）
- **回归时**：只删代码保留注释 ⇒ **断言仍绿** ⇒ **对缺陷形态无防护**

**为何第二条断言如此设计**（A线 的意图是「反向：不得只写节点态而无提示」）：
它的**目标**是捕获「删掉提示」的回归，但**实现**用「600 字符窗口 + `toContain`」，
而窗口**恰好覆盖了注释中的同名字样** ⇒ 反向断言的**唯一价值被注释抵消**。

### 3.4 修复方向

| 方案 | 做法 |
|---|---|
| **推荐** | 窗口内**先剥离注释**再断言（与同批 `task-face-independence.test.ts:29-34` 的 `stripComments` 范式一致，本仓已有现成实现） |
| 或 | 用**精确锚点**：`catchBlock` 只取 `if (isGenerationCanceled(error)) return;` 之后到 `} finally {` 之前 |
| 或 | 断言**顺序关系**：`message.error` 必须出现在 `setNodes(...NODE_STATUS_ERROR...)` **之前**（注释无法满足顺序断言） |

**★ 与 A线 自述的差异**：A线 称「2 红」——**偏乐观**。
实际只有第一条（`superResolveImageNode 的 catch 调用 message.error`）会红。
**建议登记**：与 R4 选项 C 的 S-2 一样，**报告红数应来自实测记录**（控制线已就此立纪律）。

---

## §4 环境与回归

```
dc8965a0 基线（两文件）              → 52 pass / 0 fail
dc8965a0 全量                        → 3063 pass / 7 fail
7 fail 构成                          → 全部 asset-repair 族（load-deadlock 污染源受害者）
排除污染源后                          → 3030 pass / 0 fail
```

⇒ **两条 commit 无回归**。

---

## §5 本轮的两个 P2 形态对照（供纪律归档）

| 来源 | 形态 | 假绿机制 | 触发条件 |
|---|---|---|---|
| **选项 C** S-2（`b6eacc8c`） | `slice(indexOf(锚点), indexOf(结束))` | 锚点缺失 → `indexOf` = -1 → **空串** → `not.toContain` 恒真 | **恢复缺陷写法**（锚点字符串消失） |
| **本轮** superres（`9c75ddaf`） | `slice(catchIndex, catchIndex + 600)` + `toContain` | 窗口**覆盖注释**中的同名字样 | **只删代码保留注释** |

**共同点**：**都是「源码文本切片断言」在边界条件下失效**，且**触发条件都是最自然的回归写法**。

**建议纪律**（与 R3「注释免疫」、R4「空切片」并列为**断言可靠性族**）：
> **切片类断言必须满足两条**：
> ① 锚点存在性前置断言（`expect(idx).toBeGreaterThan(-1)`）
> ② **断言前剥离注释**（`stripComments`）—— 否则注释中的字样会满足 `toContain`

---

## §6 覆盖声明

- **已做**：3 项注入证伪（dc8965a0 两级 + superres 一处）、注释剥离对照探针、前端全量对照
- **未做**：`3fe603d2`（A-1 登记，docs 类）、A线 其余已由控制线验证的 commit
- **环境**：临时树 `_r4-dprobe @ dc8965a0`（ext4，已删除）；`web/node_modules` 软链测试线 twin；**未在 `/mnt/f` 跑测试**
- **产出**：本文件 + `.trellis/workspace/WindC0X/review/r4/dc8965a0-9c75ddaf-verify.md`

---

**计数：P0=0 · P1=0 · P2=1（superres 反向断言被注释满足）· P3=0**

**评审线（第四线）· R4 追加核验 · 2026-10-05**
