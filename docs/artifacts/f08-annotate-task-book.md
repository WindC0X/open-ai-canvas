# F-08 圈选改图 任务书（B 线侦察草案+三裁定封版，2026-10-03）

> 状态：★已封版（2026-10-03 控制线三项裁定通过，详见文末「控制线裁定记录」；正文相关处已内联标 ★已裁定）。本文件=正式任务书的权威底稿（草案+裁定一体化），W5 开线时据此建 Trellis 卡（`10-05-f08-annotate-edit`）。
> 基线：worktree oac-wt-f08 @ b858bd1d（分支 feat/ecom-f08-annotate，O-03 超分 + F-02 场景图已合入 main 基线）。
> 底表口径：F-08 🔨W5，3-5 人日；蓝本=Cowart buildAnnotationEditPrompt（一手验证）；对象擦除/元素编辑/局部重生成均为其子集；与 F-11 骨架同构可联做。

---

## §1 目标与验收

**目标**：图片节点获得「圈选改图」能力——在弹窗内对图片圈选区域并附文字要求，提交后生成一张干净新图（替换/移除/修改区域内内容），标注本身不烙进结果图。区域级编辑的上位能力，对象擦除、元素编辑、局部重生成都是它的预设子集。

**目标入口档位**：档 1 画布内弹窗（能力组织层方案 §4 表明确列「圈选改图W5」）；所属资产形态：capability/tool。

**用户可见出口（v1.8 §8 纪律：每条验收回答「用户能在哪一步看到它」）**：

1. **出口 1（主出口，档 1 弹窗）**：用户在图片节点 hover 工具条/图片工具条看到「圈选改图」入口 → 点开弹窗 → 在图上圈选（矩形区域起步）+ 输入文字要求 → 提交 → 新图节点落画布（原图右侧、连线谱系保持、prompt metadata 完整可复跑）。验收时该入口必须真实可达，且至少一个入口从注册表条目生成（能力组织层方案 §11 纪律 2，反模式 #12 堵死条款）。
2. **出口 2（注册表）**：`capability-entries.ts` 中 `image.annotateEdit` 条目可查，contextRequirement 谓词生效（无图上下文时入口不渲染/禁用）。
3. **不烙图保证**：结果图不含标注箭头/文字/选框——提示词纪律 + 渠道实测双重验证；不支持该玩法的模型被门控拦截并给出可理解文案。

**硬验收三条**：
- 弹窗内完成「圈选 + 文字 → 云端任务 → 新图落画布」全流程，中途退出不产生半截节点；
- 标注导出尺寸受钳制（长边/总像素上限），超限报错文案指引用户（照 Cowart 文案范式）；
- `web/` 目录内 `bun test` 全量通过（目录敏感教训：仓根跑会静默丢 24 条，f02 任务书 §验证）。

---

## §2 蓝本与技法参照

**一手蓝本：Cowart（/mnt/f/CODE/Project/Cowart/src/App.jsx，真实生成验证过）**

- `buildAnnotationEditPrompt`（App.jsx:1206，:1362 调用）+ `prepareAnnotationEditRequest`（:1279，:5559 工具栏按钮消费）。
- **技法本质**：视觉指示编辑（annotation-as-image）——把「原图 + 标注箭头 + 标注文字」整体渲染为一张截图交给模型，提示词说明「标注文字是修改要求、标注元素不得进入结果」。**不走 mask 通道**，与影策蒙版链是两条路线。
- 关键工程件（全部可移植）：
  - 导出范围：标注 shapes 与原图联合 bounds + 32px padding（`ANNOTATION_EDIT_EXPORT_PADDING`）；
  - 动态像素比：bounds 长边 >1600 → 1x，>1000 → 1.5x，否则 2x（`getAnnotationEditExportPixelRatio`）；
  - 尺寸钳制：长边上限 + 总像素 1600 万上限，超限报错并把「将标注移近」写进文案（`isAnnotationEditExportTooLarge`）；
  - 提示词骨架（App.jsx:153）：角色声明 → 截图内容说明 → 「标注文字=修改要求」→ 「不要把标注/选框/工具栏带进结果」→ 「保留原图与标注，新图放原图旁」。
- **转写件警示**：og-canvas `canvas-visual-annotations.ts` 的 `buildCowartImageEditPrompt` 是转写化石，未经生成验证，不可作蓝本；但其数据模型有参考价值——`visualIntentAnnotations: { type: arrow|region, note, 归一化坐标 }`，且其几何投影快照测试是纯数学、可复用（MASTER-PLAN v1.8 明文裁定）。

**Flora 对口技法（第二梯队抽取，v3 候选清单 §B）**：`Image Recolor` / `Product recolor`（区域改色）、`Object Remover`（移除）——「圈选 + 限定语义改动」的提示词参照。抽提取向：进参数面预置（隐去名字），不建独立技法面。

**渠道候选**：a6api · nano-banana-2（F-02 渠道实测门同源）。但 **F-08 不能直接继承 F-02 实测结论**——输入形态不同（标注合成截图 vs 两段式 spec），渠道实测门必须自跑（见 §7 风险 1）。

---

## §3 注册表条目定义（全字段）

落点 `web/src/lib/canvas/capability-entries.ts`（O-03 分支已立范式，字段口径照抄不新造）：

```ts
{
    id: "image.annotateEdit",
    name: "圈选改图",
    tier: 1,                              // 档 1 画布内弹窗（§4 明列）
    contextRequirement: /* 见下方论证，推荐 "single_image" */,
    assetKind: "capability/tool",
    parameterSurface: [
        // actionHint：替换/移除/修改三选，作提示词组装前缀；空数组语义=自由输入
        { field: "actionHint", label: "编辑意图", options: ["replace", "remove", "modify"], default: "modify" },
        // model / count 走既有 generationConfig，不重复登记为条目字段
    ],
    executionChain: {
        handler: "annotateEditImageNode",   // 合槽 use-canvas-media-tools.ts，复用 maskEditImageNode 骨架
        location: "cloud",
        primaryChannel: "暂无——候选 a6api·nano-banana-2，F-08 渠道实测门待跑（不可继承 F-02 结论）",
    },
    zeroParameterPreset: "暂无",          // 显式留字，照 O-03 先例；无标注时弹窗禁用提交
}
```

**id 命名论证**：保持 `image.annotateEdit`。候选 `image.regionEdit` 被否——「区域」丢失「标注语义」（用户心智=圈出来+写字），且与蓝本术语 annotation edit 一致；`image.markupEdit` 无先例。与 O-03 `image.superResolve` 的「域.动作 camelCase」命名空间一致。

**contextRequirement 论证（★ 侦察修正点，交控制线裁定）**：任务书默认给 `selection`，但实勘发现语义不匹配——`capabilityContextSatisfied` 的 `"selection"` 谓词（`hasSelection`）设计给多选工具条场景（selection-toolbar 17 项全是多节点编排语义），而 F-08 的圈选发生在**弹窗内部**（打开后才圈），入口前提只需单图（与 maskEdit 落点完全一致）。若按 `selection` 填，入口可见性条件与实际执行前提错位。**推荐 `single_image`**，圈选作为弹窗内交互、不上浮为入口谓词；若控制线坚持 `selection`，需同步扩谓词语义定义（「弹窗内将产生选区」≠「入口需要画布选区」），成本更高。★已裁定（2026-10-03）：采纳 `single_image` 封版。

**蒙版链关系**：maskEditImageNode（use-canvas-media-tools.ts :640 起）走 `maskSupported` 门控 + 画笔蒙版 + mask 通道；F-08 走标注合成截图 + 指令跟随模型。**执行编排层同构复用**（buildGenerationConfig → 门控 → prompt 组装 → 风格注入 resolveImageEditStyle → 建节点 → persistMediaNodes → 批量子节点），**输入管线分叉**。风格注入已接入媒体工具全链（F-10 底表事实），F-08 免费继承。

---

## §4 咽喉清单与合槽策略

**咽喉文件占用现状（实勘 2026-10-03，git diff 实证）**：

| 咽喉 | O-03 分支（即将合入） | F-02 分支（A 线 W5 收尾） | F-08 预计触碰 |
|---|---|---|---|
| `use-canvas-media-tools.ts` | **+66 行**（superResolveImageNode） | 已提交部分**未碰**（碰的是 use-canvas-generation-executor.ts +23）；但任务书声明收尾段将碰 | **+1 方法**（annotateEditImageNode，骨架同构 ~80 行） |
| `canvas-image-toolbar-tools.tsx` | +15 行（入口按钮） | 未碰 | **+1 按钮**（maskEdit 同落点，:134 邻位） |
| `project.tsx` / dialogs | +7 / +11（弹窗挂接） | 未碰 | 弹窗挂接 ~数行 |
| `capability-entries.ts` | **新增**（152 行，本枝将进基线） | 未碰 | **+1 条目** |
| `routes.go` / `model_router` | +7（image_upscale 计费） | 未碰 | **预计零触碰**（纯前端提示词/截图链路，同 F-09 先例）；渠道实测若需新档位才升级 |
| `model-capabilities.ts` | 未碰 | 未碰 | 待定：标注编辑能力门控标记（复用 maskSupported 或新标记），W5 实测定 |

**W5 开线先后关系（硬时序）**：
1. 等 O-03 合入 main（capability-entries.ts 范式 + superResolveImageNode 进基线）→ rebase 本枝；
2. 咽喉让位协议照 v1.8 §12 + §5.4：**F-02 收尾优先**，F-08 入实现段时对表（F-08 的 media-tools 方法与 F-02 收尾触碰面函数域不同，git 冲突面小，但纪律上仍错峰合入）；
3. Trellis 任务卡 + 首个实现 commit 在 W5 开线时才建（本次零写入）。

**合槽策略**：v1.8 §12 已裁定 F-08 与 O-03 层2「同槽连做」——O-03 合入后其 media-tools 追加模式就是 F-08 的样板；两者方法体同构不同名，连续完成摊薄上下文成本。

---

## §5 实现切片（2-3 commit 粒度）

- **C1 标注交互与几何（纯前端，零咽喉）**：`canvas-node-annotate-edit-dialog.tsx`（圈选矩形 + 每标注 note 输入 + 标注列表管理，交互栈照 mask-edit-dialog 的 canvas 2D 范式）+ 标注几何纯函数模块（归一化坐标 ↔ 像素、联合导出 bounds、padding、动态 pixelRatio、尺寸钳制判定）+ 纯函数测试（og-canvas 几何测试的数学部分复用思路，自证不经生成）。范围裁定建议：v1 仅矩形 region + 箭头 arrow 两种（Cowart 两种皆验证），freehand 不做。
- **C2 执行链合槽（唯一咽喉 commit）**：`annotateEditImageNode`（media-tools，复用 maskEditImageNode 骨架）+ 提示词组装器（Cowart ANNOTATION_EDIT_PROMPT 汉化适配：标注文字=修改要求/不烙图纪律/新图落位）+ 导出合成（原图 + 标注层 canvas 2D 自绘合成单张 dataUrl——不引 DOM 截图库，Cowart 的 tldraw 截图路径不适用）+ 门控与报错文案。
- **C3 注册表与出口**：capability-entries.ts 条目 + canvas-image-toolbar-tools.tsx 入口 + 弹窗挂接 + 渠道实测门（nano-banana-2 标注截图输入实测，失败走 §7 风险 2 兜底）——★已裁定：兜底路径（标注转 mask 降级）必须真实验证一次并记入验收，不是纸面备胎+ 文档同步（features.mdx / code-map.mdx；无 API 面则 http-api.mdx 零触碰）。

测试纪律：全部 `cd web && bun test`；C1 几何测试、C2 提示词组装快照（Cowart 一手输出为基准）、C3 条目谓词测试。

---

## §6 工作量复核（底表 3-5 人日）

**实勘结论：维持 3-5 人日，中位估计 4，依据如下。**

摊薄项（实勘证实可复用，占成本低）：
- 生成编排全套现成：maskEditImageNode 骨架（config 构建/门控/风格注入/落节点/批量/持久化）F-01/F-02/O-03 三次验证同构路径，C2 实际新写量 ≈ 输入管线分叉部分；
- 交互栈现成：mask-edit-dialog 的 canvas 2D 画笔/指针事件/坐标映射范式直接搬，标注交互是新形状不是新栈；
- 提示词一手验证：Cowart 模板直接移植，无提示词调试成本；
- 注册表范式 O-03 刚立：条目字段零设计成本；
- 零后端改动预期（同 F-09 先例）。

新增成本（实勘证实无现成件，占成本高）：
- 标注交互是**新交互形态**：矩形/箭头拖拽定位 + 每标注 note 输入 + 列表管理，复杂度高于画笔蒙版（≈ mini 编辑器），C1 估 1.5-2 人日；
- 导出合成管线新写：坐标映射/devicePixelRatio/尺寸钳制，Cowart 依赖 tldraw 截图 API 不可移植，估 0.5 人日（含在 C2 的 1 人日内）；
- 渠道实测门自跑：0.5 人日（含兜底路径验证）。

压缩开关：若 W5 带宽紧张，v1 砍到「仅矩形标注」可压至 3 人日（箭头交互 + 几何简化）；砍单序照 v1.8 §12（F-09 → F-07 先砍，F-08 不在不可砍核心内但排序靠前）。

**F-11 联做留位**：标注数据结构设计带 `type` 扩展位（arrow/region/…），归一化坐标 + note 的形状与 F-11 文字层检测框同构——本期只留位不实现（F-11 中期池 4-6 人日，另立）。

---

## §7 风险与开放问题

1. **渠道理解力未验证（最高风险）**：Cowart 一手验证走的是其自家 agent 消息链路（plugin://cowart），**不是**直接图像编辑 API；影策走云端图像编辑 API。模型对「带标注合成截图 + 指令」的遵循度（尤其「不把标注烙进图」）必须实测。**兜底路线**：标注区域转蒙版 → 降级走 maskEditImageNode 既有 mask 通道（不传标注截图，传 mask + 文字）——交互层不浪费，执行链换通道，风险封顶为「效果降级」而非「能力不可用」。★已裁定：兜底路线设计采纳，C3 真实验证一次记入验收。
2. **contextRequirement 谓词裁定**：`selection` vs `single_image`（§3 论证，推荐后者），交控制线，W5 开线首日定。
3. **标注是否持久化**：Cowart 的标注是画布 shapes（持久、可复编辑）；og-canvas 存节点 metadata。侦察建议：**v1 弹窗内临时态，关闭即弃**（省持久化 schema 与节点metadata 污染，降 0.5-1 人日）；用户反馈需要「标注可复编辑」再升持久化。★已裁定（2026-10-03）：采纳 v1 弹窗内临时态、关闭即弃；追加——关闭前给一次性确认（「关闭将清除标注」），防用户标注白做。
4. **导出尺寸钳制口径**：与 F-06 的 4096 钳制数值对齐问题——Cowart 上限（长边 + 1600 万像素）与影策扩图钳制不同源，W5 定一个统一口径，避免同画布两套尺寸纪律。★已裁定（2026-10-03）：与 F-06 对齐为长边 4096 + 总像素 1600 万双限；报错文案沿用 Cowart「将标注移近」范式中文适配。
5. **咽喉排程依赖**：O-03 合入时点决定本枝 rebase 时点；F-02 收尾段若拖周，F-08 的 C2（唯一咽喉 commit）可后置，C1（零咽喉）可先行——切片顺序本身是错峰缓冲。
6. **与统一任务面（W5 设计卡）的交界**：F-08 是档 1 弹窗 + 既有任务面板呈现；统一任务面若同期落地，按铁律「执行位置只是元数据标签」处理，不阻塞本卡。
7. **og-canvas 转写件禁令**：`buildCowartImageEditPrompt` 及其提示词文本不可复制（未经生成验证）；仅其数据模型形状与几何测试数学可参考——防止转写化石二次污染。★已裁定：此禁令写进 W5 正式任务卡。

---

## 控制线裁定记录（2026-10-03，草案审定通过并封版）

三项开放问题全部拍板：

1. **§3 谓词**：采纳 `single_image` 封版（论证经控制线实码核验成立——`hasSelection` 是多选工具条语义，F-08 入口前提只需单图，圈选是弹窗内交互不上浮为入口谓词）。
2. **§7-3 标注持久化**：采纳 v1 弹窗内临时态、关闭即弃；追加——关闭前一次性确认（「关闭将清除标注」），防用户标注白做。「标注可复编辑」为真需求时 W6+ 再升持久化（届时数据结构 type 扩展位已留）。
3. **§7-4 导出钳制**：与 F-06 对齐为长边 4096 + 总像素 1600 万双限；报错文案沿用 Cowart「将标注移近」范式中文适配。

补充采纳两处：

- 渠道实测门自跑 + 兜底路线（标注转 mask 降级）设计正确——C3 切片中兜底路径必须真实验证一次（非纸面备胎），记入验收。
- Cowart 转写化石禁令（og-canvas `buildCowartImageEditPrompt` 不可复制）写进正式任务卡。

**W5 开线令（预告）**：O-03 合入 main（A 线收尾中）后 rebase 本枝即进实现段——C1（零咽喉）可立即开工；C2 等 F-02 收尾段让位信号（§5.4）；C3 收口含渠道实测门。工作量按 **4 人日中位**报；压缩开关（砍箭头留矩形=3 人日）须报备控制线后方可启用。W5 开线时建 Trellis 任务卡与首个实现 commit，本草案+本裁定=正式任务卡。

---

*侦察证据清单：底表/能力组织层方案/MASTER-PLAN v1.8（§12 开线方案、§5.4 咽喉规则、§8 出口纪律）/ v3 候选清单 §B（Flora 技法映射）/ Cowart App.jsx（:153 提示词、:1206 组装、:1279 准备、:5533 按钮）/ og-canvas canvas-visual-annotations.test.ts / 仓内 use-canvas-media-tools.ts:640、canvas-node-mask-edit-dialog.tsx、selection-toolbar-tools.tsx（17 项实证）、canvas-selection.ts（框选=节点级，无图内圈选实证）/ git diff：feat/o03-l2-superresolve、feat/ecom-f02-scene 咽喉占用。*
