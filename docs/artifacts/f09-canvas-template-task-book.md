# F-09 三期（画布模板化）任务书

> 控制线拟，2026-10-06。**A线执行**（主仓家域，刚完成画布承载性验证）。
> 纪律见 `docs/artifacts/multi-line-discipline.md`。
> 前序：`f09-canvas-workflow-validation-task-book.md`（验证）+ `f09-canvas-workflow-validation-report.md`（结论）

---

## 〇、纪律前置确认

- [ ] 已读 `docs/artifacts/multi-line-discipline.md`
- [ ] 本批产物落盘位置已指定（D1）：
  - 任务书：本文件（`docs/artifacts/f09-canvas-template-task-book.md`）
  - 代码：`web/src/`（主仓树）
  - journal：`.trellis/workspace/WindC0X/`
- [ ] 环境基线已引用（V4）：`main @ b2a3523b`（A线 验证提交，已推 fork）
- [ ] **本批是产品代码批**，与验证批（不写产品代码）性质不同

---

## 一、批次定位与已定结论（不得重开）

### 1.1 已裁定事实（用户 2026-10-06 07:14 + A线 验证结论）

```
★ 形式裁定：走【画布】路径，不做独立 F-09 页面
  依据链：
    ① 用户 07:14 批准验证时的框架：
       「若画布可行 ⇒ 独立页可能不需要（避免第 3 套 UI）」
    ② A线 验证结论（b2a3523b）：
       Q1 成立 —— 数组顺序 = @提及首次出现顺序（24 条测试，控制线独立复跑通过）
    ③ A线 报告 §8：⇒ 无需独立 F-09 页面
```

**★ 本批不得重开「独立页 vs 画布」讨论。** 若实现中遇到与裁定冲突的技术事实，
**上报，不自行改道**（C3）。

### 1.2 用户对产品形态的原话（2026-10-06 07:00，方向性约束）

> 「用户替换掉参考图节点的图片，然后重新生成」
> 「小白需要画布内的引导标记（文字/箭头/图案）」
> 「然后整个工作流/模板打包成一组（打成一组）」

**⇒ 本批目标形态**：一个**可复用、带引导、可整体操作**的画布节点组。

### 1.3 分期（用户 07:14 裁定的三步，本批 = 步骤 2）

| 步骤 | 内容 | 人日 | 状态 |
|---|---|---|---|
| 步骤 1 | 手工验证画布能否承载 | 0.5 | ✅ 完成（b2a3523b） |
| **步骤 2** | **最小模板集**：节点图 JSON + 输入槽声明 + 空状态卡入口 | **3-5** | ⬅ **本批** |
| 步骤 3 | 专用引导标记（可选） | 1-2 | 后续批 |

**★ 本批不含步骤 3**（引导标记），但**必须为它留好挂载点**（见 §二.4）。

---

## 二、验证范围（逐项：验证对象 + 手段 + 判据）

### 2.1 前置：`productImageCount` 前端赋值（A线 验证的唯一缺口）

**背景**（A线 报告 §4，控制线已核实）：

```
实测：grep productImageCount web/src → 仅 1 处注释，【零实现】
后端：backend/internal/app/prompt_image_role.go:93
      if input.Config.ProductImageCount <= 0 { return }  ← 不传 ⇒ 不注入
后端字段：backend/internal/app/provider.go:110
      ProductImageCount int `json:"productImageCount,omitempty"`
```

**★ 后端已声明的前置条件**（`provider.go:100-110`，调用方必须满足）：
```
产品图必须排在 ReferenceImages 的【前 N 个位置】
若调用方把参考图放前面而传 ProductImageCount=1 ⇒
注入编号与模型实际看到的图片【完全相反】，且不报错
```

| 项 | 内容 |
|---|---|
| **验证对象** | 最终请求体中的 `config.productImageCount`（经 `backendProviderConfig()` 输出） |
| **手段** | 在 F-09 入口路径上赋值 `productImageCount`，抓取真实请求体 |
| **通过判据** | ① 请求体 JSON 含 `"productImageCount": N`（N = 产品图张数）<br>② **非 F-09 路径不传该字段**（保持 `omitempty` 零影响）<br>③ 数组顺序与 N 的对应关系正确（产品图在前 N 位） |

**★ 接缝位置（控制线实测；A线 2026-10-06 修正，已核实）**：

```
【赋值点】web/src/lib/canvas/canvas-project-generation.ts:438
          const requestedConfig: AiConfig = { ...config, ... }
          ← ★ 这里才是【画布节点配置的构造点】
              （合并 node.metadata + config，是真正的赋值位置）

【透传点】web/src/services/api/generation-task.ts:406
          export function backendProviderConfig(config, mode)
          ← 把 AiConfig 转成请求体，【只是透传】
          调用点 :310  config: backendProviderConfig(config, mode)

【类型】AiConfig 当前【无】productImageCount 字段
        ⇒ 需先加字段，才能赋值
```

**★ 实施路径（A线 提，控制线核实后采纳）**：
```
① AiConfig 加 productImageCount?: number 字段
② buildGenerationConfig（:411）在 requestedConfig（:438）里赋值
③ backendProviderConfig（:406）透传（自然经 :310 调用点）
```

### 2.2 节点图模板（打成一组）

**背景**（控制线 2026-10-06 07:15 实测的能力缺口）：

```
Frame 节点（canvas-frame.ts）是唯一的分组容器
  但 canFrameContain 限定 Image/Text/Drawing/Script/Video
  ⇒ Config 生成节点【不能】放进视觉 Frame（folder 变体可以，但不含 Frame）
CanvasNodeType 有 19 个内建类型，【无 Group 类型】（只有 attemptGroupId）
模板实例化【不存在】（F-05 未实现）
```

| 项 | 内容 |
|---|---|
| **验证对象** | 画布模板的载体形式（Frame / folder / 其他） |
| **手段** | ① 核实 `canFrameContain` 能否扩展容纳 Config<br>② 或核实 folder 变体是否满足「打成一组」<br>③ **先做可行性结论，再实现** |
| **通过判据** | 用户能**一次性选中并移动/复制**整个 F-09 工作流（2 图节点 + Config + 连线） |
| **★ 硬要求** | **不得新增 CanvasNodeType**（除非证实现有机制全部不可行，且需上报裁定） |

**★ 开放项（A线 需先侦查再实现）**：
```
① Frame 的 canFrameContain 是否可扩（改动面多大）
② 连线能否随组移动
③ 复制/复用机制（用户说「点卡复用」）—— 现有代码有无？
```

---

#### 2.2.1 ★ 已裁定：F-2（Frame + 扩判定）【A线 2026-10-06 验证，控制线核实】

**核实依据（A线 读码 + 控制线复验）**：
```
canvas-frame.ts:23  canFolderContain(node) = node.type !== Frame
                    ⇒ folder 已能容纳 Config ✓
canvas-frame.ts:15  isCanvasFolderNode = isFrameNode && metadata.folder
                    ⇒ folder 是 Frame 的【变体】（同一 CanvasNodeType）✓
use-canvas-node-operations.ts:168  folder 创建时 collapsed: true（默认折叠）
canvas-frame.ts:19  canFrameContain 当前限定 5 种类型，不含 Config
```

**选项对比**：

| 选项 | 做法 | 问题 |
|---|---|---|
| F-1 folder | 用 folder 容器 | 默认折叠（`:168`）⇒ 实例化后用户看不到内容，与「小白要看到引导」冲突 |
| **F-2 Frame（采纳）** | `canFrameContain` 加 Config（+1 行） | 需验证折叠副作用（见下） |
| F-3 仅多选 | 不加容器，实例化后自动选中 | 无视觉边界，不符「打成一组」 |

**★ 副作用验证结果**（A线 新增 `web/test/canvas-frame-config-containment.test.ts`，5 条，控制线已核实文件存在）：

| 场景 | 结果 | 判定 |
|---|---|---|
| `canFrameContain(Config)` | false（现状） | 需扩判定（+1 行） |
| **展开** Frame 内 Config | 内部连线 ✓ / 跨边界连线 ✓ / hidden=false ✓ | **★ 无副作用** |
| **折叠** Frame 内 Config | 跨边界连线重定向为 `{from: frame, to: out}`，内部连线返 null | 副作用确认（但见下） |

**★ 控制线判读（采纳 A线 结论）**：
```
① 副作用【确实存在】，但触发条件是 Frame【折叠】
② 用户操作 F-09 工作流时 Frame 必然展开（否则节点不可见）
   ⇒ 实际使用路径上无副作用
③ 「折叠 → 连线重定向到 Frame」是【所有节点类型的既有设计】
   （canvas-frame.ts:180-181），非 Config 特有 ⇒ 不构成 F-2 额外风险
④ ⇒ **F-2 可行，无需退回 F-3**
```

**★ 附带收益**：`resolveFrameConnection` 此前**零测试覆盖**（控制线 grep 复验：
`web/test/` 下仅 A线 新增文件），本批顺带补上该缺口。

**★ 诚实边界**：以上是**函数级**验证，未做浏览器实测；
若需真实 UI 确认，在模板机制实现后一并验证（那时本就要起画布）。

### 2.3 空状态卡入口

**背景**（控制线实测）：

```
web/src/lib/canvas/canvas-ecom-starters.ts（81 行）
  EcomStarterCard = { id, icon, title, hint, prompt }  ← 【只有 prompt 文本，无节点图】
  4 张卡：白底主图 / 3:4 详情图 / 批量优化提示词 / 商品场景图
  findEcomStarterCardByPrompt(content) ← 按 prompt 文本匹配

web/src/lib/canvas/canvas-starter.ts（20 行）
  CanvasEmptyStateKind = "none" | "guided" | "freeform" | "linked"
  resolveCanvasEmptyStateKind({...}) ← 空状态模式判定
```

| 项 | 内容 |
|---|---|
| **验证对象** | 空状态卡是否支持「点击 → 实例化节点图」（而非只填 prompt） |
| **手段** | 扩展 `EcomStarterCard` 或新增模板卡类型，承载节点图 |
| **通过判据** | ① 空状态出现 F-09 卡<br>② 点击后画布出现完整节点组（含连线 + 提示词）<br>③ 用户只需替换图片 → 点生成 |
| **★ 兼容要求** | 既有 4 张卡的 `prompt` 行为不得回归（V1：真实接缝） |

### 2.4 为步骤 3（引导标记）留挂载点

**背景**（控制线 07:15 实测 + 用户 07:10 方向）：

```
metadata.locked（web/src/types/canvas.ts:285）已被 style-preset 程序化使用
web/src/components/canvas/canvas-node.tsx:604  showChrome && !readOnly && !locked → 隐藏 resize 手柄
web/src/components/canvas/canvas-node.tsx:828-840  locked → 禁止拖拽 + 显示锁徽标
web/src/components/canvas/canvas-node.tsx:566  locked → 显示 NodeLockBadge
web/src/components/canvas/canvas-node.tsx:369  locked → 标题不可编辑
```

| 项 | 内容 |
|---|---|
| **本批范围** | **不实现**引导层（步骤 3 是后续批） |
| **本批要求** | 模板实例化出的节点**可携带 `metadata.locked`**（透传链路不丢） |
| **通过判据** | 手工给模板节点加 `locked: true` → 实例化后仍为 `true` |
| **★ 未验项（登记，不阻塞）** | `locked` 是否阻止选中/删除；如何关闭内/外 composer 引导文案 |

---

### 2.5 ★ 提示词层：六段式骨架 + 动态段【本批新增，控制线 2026-10-06 补】

**★ 为何补入本批**：控制线起草时漏了这条。F-09 的提示词是**两层**：
```
层1 角色清单（后端已实现）—— 只解决「哪张图是什么角色」
层2 六段式骨架 + 动态段（★ 未实现）—— 解决「怎么复刻」
```
**⇒ 只有层1 而没有层2，F-09 的实际效果不可控**（H3 合规红线正是靠层2 的【④原创与文字安全】段）。

#### 2.5.1 现状实测（控制线 2026-10-06）

```
已实现：backend/internal/app/prompt_image_role.go
        buildImageRolePrompt() —— 角色清单（heading + 共N张 + 两组编号 + footer）
        applyImageRolePrompt() —— mode=="image" && ProductImageCount>0 时注入

未实现：六段式正文（任务 / 优先级链 / 主体真实性 / 原创与文字安全 / 输出要求）
        —— grep 「原创商业视觉」「优先级」backend/internal → 零命中

未实现：concatRules 动态段拼装（11 条）
        —— 前端 prompts/catalog.ts 无 F-09 相关
```

#### 2.5.2 材料位置（一手逐字，勿凭记忆重写）

| 材料 | 位置 | 验证状态 |
|---|---|---|
| 六段式正文逐字 | `docs/artifacts/f09-input-spec/F-09-IMPLEMENTATION-PLAN.md` §1.1② / §4.2 | 一手核验（ImgAk wfapp-52 `output.prompt`） |
| 11 条 concatRules | 同上 §1.1③ | 一手核验（含 separator + conditions） |
| 3 个真实样本 | 同上 §1.1④ | 含输入对 + 输出 + 全参数 |
| 语料原文 | `docs/artifacts/f09-input-spec/S1-meitu-piccopilot-deep-dive/corpus/imgak/wfapp-52-detail.json` | 控制线已提取逐字 |

**★ 六段式正文（控制线从语料逐字提取，供对照）**：
```
任务：根据“版式参考图组”制作一张原创商业视觉。用户替换主体图组定义需要保持真实并替换进成片的商品或主体；版式参考图组定义视觉方案，并可按复刻方式决定参考人物是否保留。两组图片不得混淆，也不得因为替换商品而误删参考图中需要保留的人物。
优先级：用户明确要求与准确文案 > 用户替换主体身份和事实 > 高度复刻的人物保留要求 > 逐张参考要求 > 选择的复刻策略 > 风格参考范围 > 模型自由发挥。冲突时按此前顺序执行。
主体真实性：如提供主体图，必须保持可见类别、数量、轮廓比例、主色、材质、图案、Logo相对位置和结构部件；不要凭空增加功能、配件、认证、规格或卖点。看不清的细节要保守处理。
原创与文字安全：不得照搬参考图中的品牌、Logo、水印、受保护角色、独特插画或旧广告文案。人物身份只在“高度复刻”中按该模式的明确规则保留；“参考风格”不得复刻可识别人脸或人物身份。除用户准确文案或用户主体图中清晰可确认的内容外，不得生成价格、折扣、销量、排名、功效、证言、认证、参数或其他主体事实。
输出要求：只生成一张完成度高的成片，不输出对比图、步骤图、网格草稿、解释文字或额外边框。只有画面文字模式明确允许时才添加文字，文字必须简短、可读并服从所选语言。
```

#### 2.5.3 ★ 需先做方案决策（不自行决定，按 §九⑤ 上报）

**核心问题：层2 放前端还是后端？**

| 选项 | 做法 | 优点 | 风险 |
|---|---|---|---|
| **A 前端拼装** | 模板实例化时把六段式正文写进 Config 节点 `composerContent` | 用户可见可编辑；无需改后端 | 用户误改会破坏合规段（H3 红线） |
| **B 后端注入层** | 仿 `prompt_image_role.go` 新增 `prompt_clone_skeleton.go`，按 ProductImageCount>0 触发 | 用户不可改，合规段有保障 | 用户看不到提示词，难以调试 |
| **C 混合** | 六段式正文后端注入（不可改）+ 参数面走前端 concatRules | 合规有保障 + 参数可见 | 实现量最大 |

**★ 控制线倾向 C**（理由：H3 合规红线是**判据级要求**，不可由用户误改破坏；
而参数面需要 UI 交互）。**但这是设计决策，需 A线 先出方案结论再实现。**

#### 2.5.4 本批的动态段范围（★ 不是全 11 条）

用户裁定三期只有 3 个参数面（复刻程度 / 复刻侧重 / 文字策略）⇒
**只需实现 3-6 条规则**：

| 规则 | 来源字段 | 分隔符 | 触发条件 | 本批 |
|---|---|---|---|---|
| clone-degree | `clone.degree` | `\n复刻策略：` | — | ✅ 需要 |
| clone-scope | `clone.scope` | `\n风格参考范围：` | `clone.degree == style-reference` | ✅ 需要 |
| copy-mode | `copy.mode` | `\n画面文字策略：` | — | ✅ 需要 |
| clone-type | `clone.type` | `\n用途要求：` | — | ⏸ 三期无 UI（无值可填） |
| reference-notes | `reference.requirements.prompt` | `\n逐张参考要求：\n` | — | ⏸ 三期无 UI |
| copy-text | `copy.text` | `\n必须准确呈现的用户文案：` | `copy.mode == exact-copy` | ⏸ 三期无 UI |
| market-platform / market-region / copy-language | — | — | — | ⏸ 三期无 UI |
| product-fidelity | `product.fidelity` | `\n主体保持策略：` | `product.images` 非空 | ⏸ 三期无 UI |
| global-requirements | `clone.globalRequirements` | `\n其他成片要求：` | — | ⏸ 三期无 UI（若做补充要求输入框则启用） |

**★ 机制要点**：`sourceProperty: "des"` —— 取选项的**描述文本**（非 label）拼进提示词
⇒ **每个选项的 `des` 字段本身就是提示词片段**，需与参数面选项一一对应。

#### 2.5.5 通过判据

| 项 | 判据 |
|---|---|
| 六段式注入 | 抓请求体 → prompt 以角色清单开头，其后为六段式正文 |
| 动态段拼装 | 改 `clone.degree` → prompt 出现 `\n复刻策略：` + 对应 `des` 文本 |
| 条件规则 | `clone.degree != style-reference` 时，**不出现** `风格参考范围：` 段 |
| 非 F-09 零影响 | 无 ProductImageCount 的请求 → prompt 不含六段式 |

**★ 可证伪要求**：注入「六段式不拼装」→ 判据测试必须红（V2）。

---

## 三、能力条目登记（与 §2.1 同批，顺序不可颠倒）

### 3.1 ★ 顺序依据：F-08 先例（控制线实测）

```
F-08 圈选改图：
  d9482dcf（07:37）handler 实现 —— editAnnotatedImageNode
  1197a5d2（07:39）条目登记 + 测试 + 入口接线（同一提交）
    └─ 测试断言 entryPoints.target 在工具条源码里【真实存在】（annotate-edit-entry.test.ts:115）

⇒ 【handler 必须先存在】，条目才登记
⇒ 否定「先登记条目，handler 指向未来函数」
```

**★ 因此本批顺序**：
```
① §2.1 productImageCount 赋值（前端）
② handler 实现（F-09 生成链入口函数）
③ 条目登记 image.cloneRecreate + 测试 + 入口接线（同一提交）
④ §2.2/§2.3 模板与入口
```

### 3.2 条目定义（用户 2026-10-05 23:06 裁定 + 控制线 2026-10-05 23:12 已加谓词）

**已存在（工作树未提交，控制线 2026-10-05 23:12 所加）**：
```ts
// web/src/lib/canvas/capability-entries.ts:51
| "dual_image";   // 恰好 2 张图，角色区分由调用方数组顺序保证

// :236
case "dual_image":
    return context.imageCount === 2;
```

**★ 该谓词目前【悬空】**（零消费方、零测试）—— 本批 ③ 为它接上消费方。

**待登记条目**（字段值来自用户裁定）：
```ts
{
    id: "image.cloneRecreate",
    name: "爆款复刻",
    tier: 0,                          // 点卡出图
    contextRequirement: "dual_image",
    assetKind: "capability/tool",
    parameterSurface: [               // 用户裁定：复刻程度 / 复刻侧重 / 文字策略
        { field: "cloneDegree",  label: "复刻程度", options: [...] },
        { field: "cloneScope",   label: "复刻侧重", options: [...] },
        { field: "copyMode",     label: "文字策略", options: [...] },
    ],
    executionChain: {
        handler: "<本批 ② 实现的函数名>",
        location: "cloud",
        primaryChannel: "暂无 —— 候选 a6api·nano-banana-2，见一期门结论",
        requiredOperations: [],
    },
    zeroParameterPreset: "暂无",
    entryPoints: [{ kind: "create-card", target: "<本批 §2.3 的卡 id>" }],
    registryVersion: 1,
}
```

**★ 字段值必须实测确认，不得照抄本任务书**（C6：控制线的片段是未验证草案）：
```
① parameterSurface 的 options 取值 —— 需对齐美图/ImgAk 口径与后端实际参数
   （见 docs/artifacts/f09-input-spec/S1-meitu-piccopilot-deep-dive/findings/M01-meitu-clone.md）
② primaryChannel —— 一期门实测结论（B线 交付 test/f09-channel-gate）
③ entryPoints.target —— 必须与 §2.3 真实定义的卡 id 一致（守卫测试会校验）
```

---

## 四、门禁

- [ ] 门禁绑定本批 tip（G5）：`<hash>`（完成后回填）
- [ ] 文件面用 `git diff <merge>^1 <merge>`（G1）+ 打印文件数
- [ ] `tsc --noEmit` exit 0
- [ ] `eslint`（本批文件面）exit 0
- [ ] 全量 `bun test` 在 ext4（V6）—— **基线 = 3132 pass / 0 fail / 369 files**（b2a3523b 实测）
- [ ] 失败对照环境基线（V4）
- [ ] `registry-namespace-guard.test.ts` 通过（新条目的 id/entryPoints/registryVersion 校验）
- [ ] `scripts/merge-file-face.sh <tip>` exit 0

---

## 五、可证伪性

- [ ] **每个护栏测试注入缺陷证明可红**（V2），红数附注入点（V7 附1-a）
  - `productImageCount` 断言：注入「不赋值」→ 测试必须红
  - `dual_image` 谓词：注入「恒 true」→ 测试必须红
  - 条目字段：注入「entryPoints.target 不存在」→ 守卫测试必须红
- [ ] 断言真实生产接缝，非镜像实现（V1/V2）
  - **★ 反面样例**：只测 `capabilityContextSatisfied(entry, {imageCount: 2})` 返回 true
    是**谓词自证**，不证明「真实入口在双图时渲染」。需测入口消费路径。

---

## 六、报告格式

- 每轮结果与失败详情（含截图/日志行证据）
- 发现分级：阻塞 / 非阻塞回归 / 环境差异
- 拓扑链 + 文件清单 + 门禁原始输出
- 断言逐条对码（V7）
- **口径声明**（若涉及判据数值）：版本 / 参数 / 标定点（§四·五 溯源维度）
- 单 commit 不 push main，STOP-report（C5）

---

## 七、诚实边界（必须写进报告）

```
□ 本批不含【引导标记】（步骤 3，后续批）
□ 本批不含【模板市场/跨用户复用】—— 只做单画布内的模板实例化
□ 本批不含【真机出图质量验收】—— 渠道质量已由一期门覆盖
□ 用户实际路径是【拖拽搭画布】，本批做的是【模板实例化】——
  两者不等价，需在报告中明确哪些环节用户仍需手工操作
□ 本批只实现 3-6 条 concatRules（三期只 3 个参数面），
  其余 5-8 条【不实现】（无 UI 可填值），需在报告中列明
```

---

## 八、交付物

| # | 交付物 | 说明 |
|---|---|---|
| 1 | 前端 `productImageCount` 赋值 + 测试 | §2.1 |
| 2 | 生成链 handler 实现 | §3.1 ② |
| 3 | `image.cloneRecreate` 条目 + 测试 | §3.2 |
| 4 | 节点图模板机制（含可行性结论） | §2.2 |
| 5 | 空状态卡入口 | §2.3 |
| 6 | **提示词层2：六段式骨架 + 3-6 条 concatRules + 方案决策** | **§2.5（★ 2026-10-06 补）** |
| 7 | 报告 | 本任务书 §六 格式 |

---

## 九、需上报不自行决定的事项

```
① 若 Frame/folder 均无法承载 Config 节点，且需新增 CanvasNodeType
② 若 parameterSurface 的字段值无法从语料确定（口径分歧）
③ 若 productImageCount 的赋值点不在 backendProviderConfig（接缝位置与预期不符）
④ 任何与「画布形式」裁定冲突的技术事实
⑤ 人日超出预估（3-5 人日）的 50% 以上
⑥ ★ 提示词层2 的落点决策（前端 / 后端 / 混合）—— 先出方案结论，再实现
   （控制线倾向混合方案 C，但需 A线 先核实技术可行性）
⑦ ★ 若六段式正文与影策现有 prompt 组装链路冲突（如已有 systemPrompt 拼接）
```
