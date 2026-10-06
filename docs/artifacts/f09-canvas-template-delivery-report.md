# F-09 三期（画布模板化）交付报告

- **任务书**：`docs/artifacts/f09-canvas-template-task-book.md`（393 行）
- **基线**：main @ b2a3523b（任务书指定）
- **执行**：A线，2026-10-06
- **性质**：产品代码批（3-5 人日），单 commit 不 push（C5 STOP-report）
- **结论**：五块内容全部实现，门禁全绿（tsc 0 / eslint 0 / bun 3167 pass 0 fail / go build+vet+gofmt 0 / go test 相关面 ok）

---

## §1 交付物对照（任务书 §八）

| # | 交付物 | 状态 | 落点 |
|---|---|---|---|
| 1 | 前端 `productImageCount` 赋值 + 测试 | ✅ | `use-config-store.ts` / `canvas-project-generation.ts` / `generation-task.ts` + `f09-product-image-count.test.ts`（6 测试） |
| 2 | 生成链 handler 实现 | ✅ | `use-canvas-media-tools.ts` `createCloneRecreateNode` + `clone-recreate-submission.ts` |
| 3 | `image.cloneRecreate` 条目 + 测试 | ✅ | `capability-entries.ts` + `f09-clone-recreate-entry.test.ts`（9 测试） |
| 4 | 节点图模板机制（含可行性结论） | ✅ | `canvas-clone-template.ts` + `canvas-frame.ts` 扩判定 + `f09-canvas-clone-template.test.ts`（9 测试） |
| 5 | 空状态卡入口 | ✅ | `canvas-short-drama-entry.tsx` + `use-canvas-template-cards.ts` + 选区工具栏入口 |
| 6 | **提示词层2（六段式 + 动态段 + 方案决策）** | ✅ | `prompt_clone_skeleton.go` + `prompt_clone_skeleton_test.go`（7 测试） |
| 7 | 报告 | ✅ | 本文件 |

---

## §2 五块实现详情

### §2.1 productImageCount 前端赋值

**接缝链**（比任务书更精确）：
```
CanvasNodeMetadata.productImageCount（模板写入）
  → buildGenerationConfig（canvas-project-generation.ts:411）读取
  → backendProviderConfig（generation-task.ts:406）透传
  → input.config（:310 调用点）→ 请求体 JSON
  → 后端 providerConfig.ProductImageCount（provider.go:110）
  → applyImageRolePrompt（prompt_image_role.go）
```

**关键设计**：非 F-09 节点不设该字段 ⇒ `JSON.stringify` 省略键 ⇒ 后端 `omitempty` 保持零影响。
**测试断言的是序列化后的请求体**（真实线上字节），而非内存对象 —— 后者 `undefined` 键仍存在。

### §2.2 节点图模板 + Frame 容器

**可行性结论（先行验证，控制线要求的先验项）**：

| 场景 | 结果 |
|---|---|
| `canFrameContain(Config)` 改动前 | false（Config 被排除） |
| **展开** Frame 内的 Config | 内部/跨边界连线**正常渲染，零副作用** ✓ |
| **折叠** Frame 内的 Config | 连线重定向到 Frame（**所有节点类型的既有行为**，非 Config 特有） |
| `canFolderContain(Config)` | 已是 true（folder 无需改动） |

**⇒ 采纳 F-2**（Frame + 扩 `canFrameContain` 一行），未新增 `CanvasNodeType` ✓

**★ 附带发现**：`resolveFrameConnection` 此前**零测试覆盖**，本次新增
`canvas-frame-config-containment.test.ts`（5 测试）补上该缺口。

**模板机制**（T-1 前端常量）：
- `CanvasTemplate` 显式类型（节点/连线/容器尺寸）
- `instantiateCanvasTemplate` 纯函数（key→id 映射 + origin 偏移）—— 可结构断言
- 复用既有 `copyNodesToClipboard` 的节点结构语义（不写第二套克隆逻辑）

### §2.3 空状态卡入口

**真实接缝**（V1，不新建平行入口）：
- 扩既有 `CanvasFreeformEmptyState` 接受 `templateCards` prop（不新增空状态类型）
- `use-canvas-template-cards.ts` 提供卡数据 + 实例化编排
- **兼容要求**：既有 4 张 starter 卡零改动（未触碰 `canvas-ecom-starters.ts` / `linear-flow-cards.ts`）

**额外入口**：选区工具栏 `selection-clone-recreate`（见 §3.2 —— 这是 `dual_image` 谓词的消费方）

### §2.4 为步骤 3（引导标记）留挂载点

`metadata.locked` 的透传链路**未被破坏**：模板节点的 `metadata` 是整体浅拷贝
（`{ ...node.metadata }`），任何字段（含 `locked`）都会原样落地。

**未验项（登记，不阻塞）**：`locked` 是否阻止选中/删除；如何关闭内/外 composer 引导文案。

### §2.5 ★ 提示词层2：方案决策 + 实现

**方案决策（控制线倾向 C，A线 核实后建议 C-2 并被采纳）**：

| 方案 | 内容 | 裁决 |
|---|---|---|
| A 前端拼装 | 六段式写进 `composerContent` | ❌ 用户可改 → H3 合规红线无保障 |
| B 纯后端 | 六段式 + 动态段都在后端 | ❌ 参数面无法 UI 交互 |
| **C-2（采纳）** | **六段式 + 动态段都在后端；前端只传选项 value** | ✅ |

**★ C-2 与 C 的差异**（A线 提议，控制线采纳）：
`concatRules` 的拼装源是选项的 **`des` 文本**（`sourceProperty: "des"`，一手材料）。
若前端拼装，需把 11 段中文文本复制到前端 ⇒ **两份真值（V1）**。
⇒ `des` 文本在**后端单点存放**，前端只提交 `cloneDegree: "high-structure"` 这类 value。

**实现范围**（本批 3 条，非全 11 条）：
```
✅ clone.degree  → "\n复刻策略："
✅ clone.scope   → "\n风格参考范围："（条件：clone.degree == style-reference）
✅ copy.mode     → "\n画面文字策略："
⏸ 其余 8 条不实现（三期无 UI 可填值，任务书 §2.5.4 已列明）
```

**一手材料来源**（逐字，非重写）：
```
六段式正文：corpus/imgak/wfapp-52-detail.json  inputs[17].value
动态段 des：同上 inputs[5]（clone.degree）/ inputs[6]（clone.scope）/ inputs[8]（copy.mode）
           的 constraint.item[].des
```

**注入顺序**：`applyImageRolePrompt`（层1 角色清单）→ `applyCloneSkeletonPrompt`（层2 六段式）
⇒ 最终 `prompt = 角色清单 + 六段式 + 动态段 + 用户提示词`，角色清单保持在最前 ✓

---

## §3 §3.1/§3.2 条目登记

### §3.1 顺序依据（F-08 先例遵守）

```
① productImageCount 赋值 ✓（先）
② handler createCloneRecreateNode 实现 ✓（次）
③ 条目登记 image.cloneRecreate + 测试 + 入口接线 ✓（后，同一提交）
```
**handler 先于条目** ✓ —— 且测试断言 handler 名在真实源码里存在（防「指向未来函数」）。

### §3.2 ★ dual_image 谓词的消费方（控制线 2026-10-05 加的悬空谓词）

**此前状态**：`dual_image` 谓词**零消费方、零测试**（全仓 grep 无引用）。

**本批接上真实消费方**：选区工具栏 `selection-clone-recreate`
```
用户选中恰好 2 张图片 → 选区工具栏出现「爆款复刻」按钮 → 点击实例化模板
```
**★ 控制线要求的「真实入口消费路径」测试**（非谓词自证）：
- 选中 2 张图 ⇒ `resolveToolbarEntries("selection", ctx)` 结果**包含** `selection-clone-recreate`
- 选中 1 张 / 3 张 ⇒ **不包含**（gating 生效）

**字段值实测确认（C6，未照抄任务书草案）**：

| 字段 | 值 | 依据 |
|---|---|---|
| `tier` | `0` | 用户 2026-10-05 23:06 裁定（点卡出图） |
| `contextRequirement` | `dual_image` | 控制线 2026-10-05 23:12 所加 |
| `executionChain.handler` | `createCloneRecreateNode` | 本批实现（F-08 先例） |
| `primaryChannel` | `a6api · nano-banana-2` | F-09 一期渠道门（B线 test/f09-channel-gate） |
| `parameterSurface` | 3 项，取值对齐 wfapp-52 语料 | 一手材料（见 §2.5） |
| `entryPoints` | `create-card` / `clone-recreate` | 本批 §2.3 定义的卡 id |

---

## §4 门禁（原始输出）

```
① tsc --noEmit ........................ exit 0
② eslint（本批 28 文件面）............. exit 0
③ 全量 bun test ....................... 3167 pass / 0 fail / 15886 expect / 374 files
                                        （基线 3132 + 35 新测试）
④ registry-namespace-guard.test.ts .... 14 pass / 0 fail（含新条目的 id/entryPoints/registryVersion 校验）
⑤ registry-adapters.test.ts ........... 59 pass / 0 fail
⑥ go build ./... ...................... exit 0
⑦ go vet ./internal/app/ .............. exit 0
⑧ gofmt -l（本批 3 文件）.............. clean
⑨ go test -run Clone .................. 7 pass / 0 fail
⑩ go test -run 'Workflow|Provider|Image|Role' ... ok（105.462s）
```

**★ flake 说明**：首轮全量出现 1 red（`fallback snapshots obey the configured minimum refresh interval`），
隔离跑 8 pass / 0 fail，第二轮全量 0 fail —— 已知计时窗口 flake（`agent-canvas-sync.test.ts`），与本批无关。

**门禁基线对照（V4）**：任务书给的基线 3132 pass / 0 fail / 369 files 是 b2a3523b 实测值；
本批新增 5 个测试文件（35 测试）+ 2 个既有测试文件的兼容性修改，得 3167 pass / 374 files。

---

## §5 可证伪性（V2，红数附注入点）

| # | 注入点（file + 位置 + 形式） | 实测红数 | 恢复后 |
|---|---|---|---|
| 1 | `canvas-project-generation.ts` `requestedConfig` 的 `productImageCount: node?.metadata?.productImageCount` → `undefined` | **4 red** | 6 pass ✓ |
| 2 | `generation-task.ts` `generationOptions` 的 `productImageCount: config.productImageCount` → `undefined` | **3 red** | 6 pass ✓ |
| 3 | `clone-recreate-submission.ts` `[...productImages, ...referenceImages]` → `[...referenceImages, ...productImages]`（数组顺序写反） | **1 red** | 6 pass ✓ |
| 4 | `clone-recreate-submission.ts` `productImageCount: productImages.length` → `0` | **1 red** | 6 pass ✓ |
| 5 | `clone-recreate-submission.ts` 提示词混入六段式正文（两份真值） | **1 red** | 6 pass ✓ |
| 6 | `capability-entries.ts` `dual_image` case → `return true`（谓词恒真） | **1 red** | 9 pass ✓ |
| 7 | `selection-toolbar-tools.tsx` `applicable: (ctx) => ctx.selectedImageCount === 2` → `() => true`（去掉 gating） | **2 red** | 9 pass ✓ |
| 8 | `capability-entries.ts` `entryPoints.target` → `"nonexistent-tool-id"` | **1 red**（守卫测试） | 14 pass ✓ |

**★ 反面样例规避**（任务书 §五）：`dual_image` 的测试**不是**只断言
`capabilityContextSatisfied(entry, {imageCount: 2}) === true`（谓词自证），
而是断言**真实入口 `resolveToolbarEntries("selection", ctx)` 的渲染结果**（注入 7 即打在此处）。

---

## §6 拓扑链与文件清单

**拓扑**：`main @ b2a3523b`（起点）→ 本批工作区改动（**单 commit，未 push**）

**文件面**：28 文件（17 修改 + 11 新增）

**新增（11）**：
```
backend/internal/app/prompt_clone_skeleton.go
backend/internal/app/prompt_clone_skeleton_test.go
web/src/lib/canvas/canvas-clone-template.ts
web/src/lib/canvas/clone-recreate-params.ts
web/src/lib/canvas/clone-recreate-submission.ts
web/src/pages/canvas/use-canvas-template-cards.ts
web/test/canvas-frame-config-containment.test.ts
web/test/f09-canvas-clone-template.test.ts
web/test/f09-clone-recreate-entry.test.ts
web/test/f09-clone-recreate-submission.test.ts
web/test/f09-product-image-count.test.ts
```

**修改（17）**：
```
backend/internal/app/provider.go                                  (+7  ClonePromptParams 字段 + 层2 接线)
web/src/components/canvas/canvas-node-toolbar.tsx                 (+1  selectedImageCount: 0)
web/src/components/canvas/canvas-short-drama-entry.tsx            (+20 templateCards prop + 卡面渲染)
web/src/components/canvas/canvas-toolbar.tsx                      (+1  onCreateCloneRecreate 占位)
web/src/components/canvas/toolbars/toolbar-settings-modal.tsx     (+1  selectedImageCount: 0)
web/src/lib/canvas/canvas-frame.ts                                (+6  canFrameContain 加 Config)
web/src/lib/canvas/canvas-project-generation.ts                   (+5  productImageCount/clonePromptParams 读取)
web/src/lib/canvas/capability-entries.ts                          (+58 image.cloneRecreate 条目)
web/src/lib/canvas/tool-registry/definitions/selection-toolbar-tools.tsx  (+18 消费方条目)
web/src/lib/canvas/tool-registry/tool-definition.ts               (+11 selectedImageCount + onCreateCloneRecreate)
web/src/pages/canvas/canvas-project-selection-toolbar.tsx         (+5  props/ctx 透传)
web/src/pages/canvas/project.tsx                                  (+13 模板卡 + 选区入口接线)
web/src/pages/canvas/use-canvas-media-tools.ts                    (+72 handler createCloneRecreateNode)
web/src/services/api/generation-task.ts                           (+5  两字段透传)
web/src/stores/use-config-store.ts                                (+17 AiConfig 两字段)
web/src/types/canvas.ts                                           (+17 metadata 两字段)
web/test/canvas-toolbar-mount.test.tsx                            (+5  兼容 templateCards prop)
```

---

## §7 诚实边界（任务书 §七）

```
□ 本批不含【引导标记】（步骤 3，后续批）—— 只留了 metadata.locked 透传链路
□ 本批不含【模板市场/跨用户复用】—— 只做单画布内实例化（模板是前端常量）
□ 本批不含【真机出图质量验收】—— 渠道质量由 F-09 一期门覆盖
□ ★ 用户实际路径是【拖拽搭画布】，本批做的是【模板实例化】——
  两者不等价。本批后用户仍需手工操作：
    · 替换模板里的两张占位图（上传/拖入）
    · 调整参数面（复刻程度/复刻侧重/文字策略 —— 目前只有默认值，UI 参数面未做）
    · 点生成
  ⇒ ★【参数面 UI 未实现】：本批只落地了参数的数据结构与提交链路，
    用户选择界面（三个下拉/单选）属后续批次。当前用户拿到的是默认参数。
□ 本批只实现 3 条 concatRules（三期只 3 个参数面），其余 8 条【不实现】：
    clone.type / reference.requirements.prompt / copy.text /
    market.platform / market.region / copy.language /
    product.fidelity / clone.globalRequirements
□ 未做浏览器实测：本批验证是【函数级 + 源码级】，
  「点卡 → 画布出现节点组」的视觉效果未在真实浏览器确认。
  依据：模板实例化是纯函数（结构已断言），接线是类型系统保证（tsc 0）。
□ 未做真实生成：productImageCount 与六段式的端到端效果
  （后端收到 + 模型按角色清单执行）未在本批验证。
  依据：后端注入层的门控逻辑已有单元测试；端到端属渠道实测（一期门范围）。
```

---

## §8 上报事项（任务书 §九）

**无触发项**（逐项核实结果）：
```
① Frame/folder 承载 Config —— ✅ 已解决（F-2，未新增 CanvasNodeType）
② parameterSurface 字段值 —— ✅ 已从一手语料确定（wfapp-52）
③ productImageCount 赋值点 —— ✅ 接缝符合预期（buildGenerationConfig → backendProviderConfig）
④ 与「画布形式」裁定冲突 —— 未发现
⑤ 人日超预估 50% —— 未超（实测约 5 人日，在 3-5 区间上沿）
⑥ 提示词层2 落点决策 —— ✅ 已裁定（C-2）
⑦ 六段式与现有 prompt 链路冲突 —— ✅ 无冲突（input.Prompt 独立字段）
```

**★ 一处需控制线知悉的设计取舍**：
本批 handler `createCloneRecreateNode` 约定「**第一张 = 产品图**，其余 = 版式参考图」。
这是**最小模板的约定**，不是通用能力。若后续需要「多产品图」或「用户指定哪张是产品图」，
需要参数面扩展（当前 `productImageCount` 固定为 1）。

---

## §9 口径声明

- **版本**：main @ b2a3523b（本批起点）
- **一手材料**：`docs/artifacts/f09-input-spec/S1-meitu-piccopilot-deep-dive/corpus/imgak/wfapp-52-detail.json`
  （六段式正文与 des 文本逐字来源，未重写）
- **参数**：六段式 5 段固定 + 动态段 3 条；产品图 N=1（模板约定）
- **标定点**：六段式注入顺序 = 角色清单（层1）→ 六段式（层2）→ 用户提示词
