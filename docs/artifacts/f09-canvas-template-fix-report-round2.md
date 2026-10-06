# F-09 三期修复批（第二轮：B2-1 + N3-1）交付报告

- **任务**：修复批任务书（控制线 2026-10-06 第二轮，评审线复核发现）
- **起点**：main @ `a7c2575c`（第一轮修复批 `40b9c915` 之后的代码面）
- **执行**：A线
- **核心教训**：**测试的断言对象必须等于它声称的验证对象**（两轮同一缺陷类，深了一层）

---

## §1 评审线发现的缺陷与本轮修复

| # | 缺陷 | 性质 | 修法 |
|---|---|---|---|
| **B2-1** | B-2 派发挂在**不可达路径**（Config 节点永不渲染 `CanvasNodePromptPanel`） | 阻塞 | 派发移到 Config 真实入口 + 分支逻辑抽纯函数 |
| **N3-1** | `sourceImageIds` 可能含非图片节点（文本节点占据产品图槽位） | 非阻塞 | 纯函数 `resolveTemplateImageSlots` 内过滤类型 |
| **测试质量** | N3-1/N-3/□5-2 的断言是**源码文本断言**（无捕获语义失效能力） | 阻塞（质量） | 抽纯函数 + 真实渲染测试 |

### §1.1 B2-1 的根因链（评审线 5 步证据链，A线 独立复核成立）

```
① 爆款复刻节点 type = CanvasNodeType.Config          （canvas-clone-template.ts:97）
② Config 节点渲染分支 = CanvasConfigComposer          （project.tsx:2286-2299）
   其 Props 【无 onGenerate】                        （canvas-config-composer.tsx:15-25）
③ 全仓渲染点各仅 1 处
   <CanvasConfigComposer  → project.tsx:2287（Config 分支）
   <CanvasNodePromptPanel → project.tsx:2301（非 Config 分支）
④ 第一轮的 createCloneRecreateNode 调用在
   CanvasNodePromptPanel.onGenerate 内 ⇒ ★ 不可达
⑤ Config 的真实生成入口 = CanvasConfigNodePanel.onGenerate
   （project.tsx:2505 → canvas-config-node-panel.tsx:297 onClick）
```

**⇒ 第一轮代码本身正确，只是挂错了组件。**（控制线原话：不是说你写错了代码）

---

## §2 修复实现

### §2.1 B2-1：分支逻辑抽纯函数（方案 ②+③ 组合）

**`clone-recreate-submission.ts` 新增**：
```ts
export type ConfigGenerateAction =
    | { kind: "clone-recreate"; params: CloneRecreateParams }
    | { kind: "generic" };

export function resolveConfigGenerateAction(node): ConfigGenerateAction

export function dispatchConfigGenerateAction<T extends ConfigGenerateTarget>(
    node, mode, prompt, handlers: ConfigGenerateHandlers<T>,
): ConfigGenerateAction["kind"]
```

**`project.tsx` 改为无分支纯接线**：
```tsx
const dispatchConfigGenerate = useCallback((nodeId, mode, prompt) => {
    const target = nodesRef.current.find((item) => item.id === nodeId);
    dispatchConfigGenerateAction(target, mode, prompt, {
        onCloneRecreate: (node, params) => { void createCloneRecreateNode(node, params).catch(...); },
        onGenericGenerate: (id, generationMode, generationPrompt) => { void handleGenerateNode(...); },
    });
}, [...]);

// ① Config 真实入口（CanvasConfigNodePanel.onGenerate，:2505）
// ② 通用面板（CanvasNodePromptPanel.onGenerate）
// 两处都调用同一入口 ⇒ 无第二份判据（V1）
```

**★ 为什么把分支整个搬进纯函数**（而不是留在 `dispatchConfigGenerate` 里）：
```
评审线注入实验：分支留在组件内 ⇒ 测试只能用文本断言 ⇒
  「handler 首行早退（文本全保留）」⇒ ★ 10 pass / 0 fail（无捕获）
搬进纯函数后：① 分支可被 spy handler 行为断言
             ② project.tsx 的派发点退化为无分支纯接线
                ⇒「改分支条件」这个注入点在该处【物理上不存在】
```

### §2.2 N3-1 / N-3：槽位填充抽纯函数

**`canvas-clone-template.ts` 新增**：
```ts
export function resolveTemplateImageSlots<T>(slots, sourceImageIds, findNode, imageNodeType): Map<string, T>
```
① 过滤为图片节点（N3-1）② 按位置配对 ③ 只填有内容的源。

**★ 语义判定（A线 测试初版假设错误，已修正）**：
```
场景：sourceImageIds = [img-empty(无内容), img-ok(有内容)]
· 位置配对（当前实现）：img-ok → slot-layout，slot-product 保持空  ✓ 正确
· 压缩填充（我的初版假设）：img-ok → slot-product                 ✗ 错位
为什么位置配对对：模板契约是「位置即角色」；压缩会把版式参考图
【静默提升为产品图】，而后端按位置编号无法察觉。保持空则占位可见。
```

### §2.3 □5-2：真实渲染测试（选项 C，比控制线的 A/B 都强）

控制线给的选项：
```
A. 保留文本断言 + 如实标注（推荐）
B. 抽纯函数 shouldRenderTemplateCards（只验证判据，不验证渲染）
```
**A线 采用选项 C**：`react-dom/server` 的 `renderToStaticMarkup`（项目已有依赖，无新增），
`web/test/f09-guided-template-cards-render.test.tsx`（5 测试）**真实渲染组件**并断言输出 HTML：
```
① 传入 templateCards ⇒ 标题/hint 出现在输出
② undefined ⇒ 不渲染模板区域（引导区仍在，回归保护）
③ 空数组 ⇒ 不渲染（空态不显示标题）
④ 每张卡是【可点击 button】（不是纯文本）
⑤ 模板区在「空白分镜」之后（独立区域语义）
```

---

## §3 ★ 注入记录表（V10-g 要求 + 控制线的「保留文本、语义失效」形式）

**所有注入均在主仓工作区执行，每次注入后立即恢复并验证。**

| 时间 | 文件 | 注入形式 | 红数 | 恢复 |
|---|---|---|---|---|
| 13:5x | `clone-recreate-submission.ts` | 判据恒返回 `generic` | **2 red** | ✓ |
| 13:5x | `clone-recreate-submission.ts` | 判据恒返回 `clone-recreate`（反向） | **1 red** | ✓ |
| 13:5x | `project.tsx` | `&& false` 使 clone 分支不生效 | 0 red → **已修**（见 §4） | ✓ |
| 14:0x | `canvas-clone-template.ts` | 去掉类型过滤 | **2 red** | ✓ |
| 14:0x | `canvas-short-drama-entry.tsx` | `false && templateCards?.length` | **3 red** | ✓ |
| 14:0x | `canvas-short-drama-entry.tsx` | ★ **`[].map` 保留全部文本、渲染为空** | **2 red** | ✓ |
| 14:0x | `canvas-short-drama-entry.tsx` | 卡片改 `span role="none"`（无 button 语义） | **1 red** | ✓ |
| 14:0x | `canvas-short-drama-entry.tsx` | 首次注入 `div` 闭合标签不匹配 | 语法错误 ⇒ **该注入作废，重做** | ✓ |

**★ 关键一条**：注入「`[].map`（文本全保留、渲染为空）」⇒ **2 red**。
这是控制线对 N3-1 用的同类注入形式（保留文本、语义失效），
证明 □5-2 的渲染测试**能捕获**该形式 —— 而文本断言不能。

---

## §4 ★ 一轮失败与修正（诚实登记）

**注入「`project.tsx` 的 `&& false`」⇒ 0 red**（未被捕获）。

**根因**：第一版的 `dispatchConfigGenerate` 内部仍有分支：
```tsx
if (action.kind === "clone-recreate" && target) { ... return; }
```
行为断言只覆盖了纯函数 `resolveConfigGenerateAction`，**没覆盖派发点的分支**。

**修法**：把分支整个搬进纯函数 `dispatchConfigGenerateAction`（§2.1），
`project.tsx` 退化为**无分支纯接线** ⇒ 该注入点物理消失。
**修正后**：用 spy handler 断言「哪个 handler 被调用」⇒ 语义失效必红。

**⇒ 这是本批最有价值的自我发现**：控制线的批评（文本断言无捕获能力）
在**更深的层次**上同样适用于我第一版的「行为断言」—— 只行为化了纯函数，
没行为化调用点。

---

## §5 门禁（原始输出）

```
① tsc --noEmit ........................ exit 0
② eslint（本批 7 文件）................ exit 0
③ 全量 bun test ....................... 3191 pass / 0 fail / 15959 expect / 376 files
                                        （起点 3178 ⇒ +13 测试）
④ F-09 测试组 + 守卫（7 文件）......... 68 pass / 0 fail / 274 expect
⑤ go build ./... ...................... exit 0（本批未改后端）
```

**测试文件明细**：
```
f09-fix-batch.test.ts ................. 19 pass（第一轮 10 + 本轮 9）
f09-guided-template-cards-render.tsx ... 5 pass（新增，真实渲染）
其他 F-09 + 守卫 ..................... 44 pass
```

---

## §6 诚实边界

```
□ □5-2 的渲染验证用 renderToStaticMarkup（SSR 静态输出），
  不是【真实浏览器交互验证】
  · 已验证：组件输出含可点击 button + 标题 + hint + 独立区域位置
  · 未验证：浏览器中的点击 → 模板实例化 → 节点组出现（端到端）
  · 未验证：CSS 布局/主题下的实际可见性
  ⇒ 与任务书「函数级验证」口径一致；浏览器端到端仍登记为后续批次

□ B2-1 的派发端到端（点生成 → 请求体带 productImageCount + clonePromptParams）
  未做真实生成验证（属渠道实测）

□ N-2（顺序契约可被用户操作破坏）：控制线裁定只登记，本批未修

□ 新-3（升格枝无运行时派发机制）：架构缺口，登记不改
```

---

## §7 口径声明

- **版本**：main @ `a7c2575c`（起点）；本批为单 commit（见 §8）
- **被测对象**：`f88feac7`（控制线钉死）—— 本批在其代码面上修改
- **注入记录**：见 §3（8 条，含 1 条作废重做）
- **失败登记**：见 §4（0 red 注入与修正过程）
- **一手依据**：N-4 的 `F-09-IMPLEMENTATION-PLAN.md:468`；B2-1 的评审线 5 步证据链（A线 独立复核）
