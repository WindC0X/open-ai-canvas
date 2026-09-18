# F-06 扩图 MVP 技术设计

> 输入：任务书硬约束 + `impl/F-06.md` 技术路线 + `f06-outpaint-ui-recon.md` tapnow 实证 + 本仓源码实读。
> 原则：第一版只做外扩框 + 参数条；所有几何输入以 DOM 实测为准；提交链照 maskEdit 骨架最小变异。

## 1. 文件边界

### 新增

| 文件 | 职责 |
| --- | --- |
| `web/src/lib/canvas/canvas-outpaint-geometry.ts` | 纯函数：padding 状态机换算、clamp、比例约束、世界尺寸→目标像素换算（可单测，零 DOM 依赖） |
| `web/src/components/canvas/canvas-node-outpaint-overlay.tsx` | 外扩框（世界层）+ 参数条（屏幕层）+ 导出 `CanvasImageOutpaintPayload` 类型 |
| `web/test/canvas-outpaint-geometry.test.ts` | 几何纯函数测试 |

### 修改（提交链 + 接线面）

| 文件 | 改动 |
| --- | --- |
| `web/src/lib/canvas/canvas-image-data.ts` | + `padImageToDataUrl(dataUrl, padding, fill)`（§5） |
| `web/src/pages/canvas/use-canvas-media-tools.ts` | + `outpaintNodeId` state、`setOutpaintNodeId`、`outpaintImageNode`（§6） |
| `web/src/components/canvas/canvas-image-toolbar-tools.tsx` | + `outpaint` 工具定义（`section:"构图与尺寸"`、`group:"process"`、order 15 紧邻 crop）+ `ImageToolHandlers.onOutpaint` |
| `web/src/pages/canvas/canvas-project-media-dialogs.tsx` | + 扩图覆盖层挂载点（outpaintNodeId → 渲染 overlay；命名保持现文件，不重构改名） |
| `web/src/components/canvas/canvas-node-toolbar.tsx` | 仅在工具渲染需要时同步（实现时核实，预期小改或零改） |
| `web/src/pages/canvas/project.tsx` | 接线：`onOutpaint={(node) => setOutpaintNodeId(node.id)}`、payload 回调、返回值透传（同 maskEdit 模式 :923/:3405） |

### 不动

- `backend/**`（零改动）；`globals.css`（A 线热区）；依赖清单（零新增）；已有 maskEdit / crop 等通道。

## 2. 状态与生命周期

```
[工具栏 outpaint] → setOutpaintNodeId(node.id)
                    → canvas-project-media-dialogs 渲染 <CanvasNodeOutpaintOverlay node=… onClose=… onExecute=…/>
                    → 用户拖拽手柄调 padding；选比例 / 分辨率 / 张数 / 模型
                    → 执行：payload = { paddingPx, prompt, generationConfig }
                    → outpaintImageNode(node, payload)（内含 padImageToDataUrl 合成 + mask 生成）
                    → 成功/失败后 onClose 清理；✕ 随时关闭
```

- 激活状态 = `outpaintNodeId: string | null`，与 `maskEditNodeId` 同构（`use-canvas-media-tools.ts:114` 模式）。
- 清理路径（唯一关闭机制 = ✕）：节点被删除 / `outpaintNodeId` 指向的节点失焦切换时，overlay 通过 props 节点查空自我卸载（状态一致性，不算第二关闭机制）；组件卸载时断开全部 RO/MO。

## 3. 双层坐标架构（核心）

### 3.1 外扩框 = 画布覆盖层内 rect 实测定位（tapnow NodeResizer 同款，2026-09-18 修订）

> 修订理由：① 节点拖拽预览期间 React state 不更新（`applyCanvasNodeDragPreview` 直改 DOM），渲染在世界层 + 读 node.position 会脱节；② 世界层挂载点受节点 `overflow:hidden` 裁剪约束，挂节点外层级需额外穿透；③ tapnow 的 NodeResizer 手柄实测渲染在屏幕空间，手柄/网格/字号恒定清晰可用性好。

- 挂载：与参数条同一画布级覆盖层（`absolute inset-0 pointer-events-none`），外扩框主体与手柄子元素 `pointer-events-auto`（手柄可交互、框内网格透传事件给画布）。
- 几何：以 `[data-node-id]` 元素 `getBoundingClientRect()` 实测（屏幕空间）+ `padding × scale` 定位；`scale` 自校准 = 节点 rect 宽 / node.width；框体 border/手柄/网格/尺寸标注为恒定屏幕像素（不随缩放变形，可读性优先）。
- 实测驱动：ResizeObserver（节点元素 layout）+ MutationObserver（worldLayer style attributes，捕捉拖拽预览与 viewport transform，挂件同款）+ `subscribeCanvasViewportPreview` 拖拽中实时 scale；一次量测两处消费（框 + 参数条）。
- node.position/width/height 仅作初始值与 clamp/ratio/像素换算的逻辑尺寸，渲染一律以 rect 实测为准；禁读 viewport React prop 纪律不变。

### 3.2 参数条 = 屏幕空间覆盖层

- 容器：画布级覆盖层 `absolute inset-0 z-10 pointer-events-none`（不进世界层，tapnow 实证结构）；参数条子元素 `pointer-events-auto`。
- 定位：外扩框底边中点的**屏幕坐标**（实测 rect 换算）+ 16px 偏移；恒定像素宽 `w≈500px`（tapnow 同款）；超出画布视口时向上翻转 / 边缘夹紧（复用 selection toolbar 的 clamp 逻辑 `canvas-workspace-overlays.tsx:20-40` 思路）。
- 更新时机：与世界层同一 RO/MO 循环（一次量测两处消费），拖拽节流 rAF 合帧。

## 4. 手柄与事件仲裁

- 8 手柄：四角圆点（`size-3` 圆点）+ 四边胶囊（中间长条），lucide 图标不需要，纯 CSS 形状 + 令牌色。
- pointerdown：`e.stopPropagation()` + `setPointerCapture`；move：仅更新被拖边/角的 padding；up：释放。
- 拖拽期间框体更新走 inline `transition: none`（拖拽跟手）；激活/关闭过渡走 inline transition（cc383e14 纪律，不用 CSS animation）。
- 画布手势豁免：参数条根元素挂 `data-canvas-no-zoom` + `data-canvas-wheel-scroll`（现画布事件忽略选择器约定，AGENTS.md §6）；手柄 stopPropagation 保证不进画布 pan/selection 管线。
- clamp：每次 move 后 `padding.x = Math.max(0, padding.x)`（`clampOutpaint` 语义）；比例锁定时按 ratio 反解对边（§7 公式）。

## 5. `padImageToDataUrl`（canvas-image-data.ts）

```ts
export type ImagePadRect = { left: number; top: number; right: number; bottom: number };
export async function padImageToDataUrl(dataUrl: string, padding: ImagePadRect, fill: string | "transparent" = "#FFFFFF"): Promise<string>
```

- 实现：`loadImage`（文件内已有）→ canvas 尺寸 = 原图 + padding（px，≥0 校验）→ `fill !== "transparent"` 时先铺 fill，再 `drawImage(原图, padding.left, padding.top)` → `toDataURL("image/png")`。
- 双用途：白底 pad 图（fill 默认 `#FFFFFF`）；mask 图（fill `"transparent"` → 原图区域不透明、新增区透明）。**mask 极性已由用户裁定：透明区 = 扩图生成区**；实现时核对 provider 规范化链路（`provider_protocol.go:316-319`）是否反转极性，保证裁定语义端到端一致（design §10.3）。
- 同构先例：`cropDataUrl` / `transformAngleDataUrl`（同文件 canvas 合成模式）；`MAX_UPSCALE_LONG_EDGE = 4096` 作为长边 clamp 上限（换算在几何纯函数层做，函数本身不 clamp，保持单一职责）。

## 6. `outpaintImageNode`（use-canvas-media-tools.ts）

签名：`(node: CanvasNodeData, payload: CanvasImageOutpaintPayload) => Promise<void>`；payload 类型定义在 overlay 组件文件（同 maskEdit payload 惯例）：

```ts
type CanvasImageOutpaintPayload = {
    paddingPx: ImagePadRect;            // 像素域 padding（已按原图真实像素换算，见 §7）
    prompt: string;                     // 用户追加说明（可空）
    generationConfig: { model?: string; imageModel?: string; size?: string; count?: string; quality?: string };
};
```

流程（照 `maskEditImageNode` :640 骨架，差异点标注）：

1. `node.metadata.content` 空则返回。
2. `buildGenerationConfig` + 选模型 + `defaultImageParamsForModel`（同骨架）。
3. **能力校验（替换 maskSupported 硬校验）**：`selectedImageProfile?.references.maxImages >= 1`，否则 `message.error` + return（参数条 UI 层已先行禁用，此处兜底）。
4. generationConfig 组装：`size` 用 payload.size（pad 后目标画幅比例档）缺省回落节点 metadata / 模型默认；`count` 来自参数条。
5. `isAiConfigReady` 检查 → 设置页（同骨架）。
6. **固定提示词模板**（替换 maskEdit 的"只修改蒙版透明区域"）：
   - maskSupported=true：`将画面自然向外延展至目标画幅，保持原图主体、构图与光照完全不变，仅生成透明新增区域的内容。{用户追加}`
   - maskSupported=false：`将画面自然向外延展至{目标画幅}，保持原图主体、构图与光照完全不变，仅在白色空白区域生成协调的新内容，原图区域一个像素都不要改动。{用户追加}`
7. 提交：`padImageToDataUrl(content, paddingPx)` → referenceImage[0]；`maskSupported=true` 时 `padImageToDataUrl(content, paddingPx, "transparent")` → `mask` 入参（现成 maskEdit 任务链，后端零改动证据：`canvas-project-generation.ts` 已收 mask、`provider_protocol.go:316-319` 规范化）。
8. root/child 批量结构、连线、`startGenerationRequest`、结果 `uploadImage` + `fitNodeSize` + `persistMediaNodes`：逐行照骨架。结果节点初始尺寸 = pad 后世界尺寸（节点显示坐标系），`fitNodeSize` 用 pad 比例。
9. 成功后 `setOutpaintNodeId(null)` 关闭覆盖层。

## 7. 几何纯函数（canvas-outpaint-geometry.ts）

```
resolveOutpaintPadding(input: { nodeW, nodeH, padding, drag?: {edge, dx, dy}, ratio?: number|null }): Padding
  - 拖拽边映射 → 对应边 padding += delta；四角 = 双边
  - clamp: 每边 ≥ 0（框 ≥ 原图）
  - ratio 锁定：以拖拽主边为准，其余边 = f(padding, nodeW, nodeH, ratio) 保持 (nodeW+L+R)/(nodeH+T+B) = ratio
resolveOutpaintTargetPx(input: { contentW, contentH, nodeW, nodeH, padding, maxLongEdge=4096 }): { width, height, paddingPx }
  - scale = contentW / nodeW（真实像素 / 显示尺寸）
  - 目标 = (nodeSize + padding) × scale，长边 clamp 4096 时整体等比缩
  - paddingPx = padding × scale × clamp 系数（用于 padImageToDataUrl / mask）
describeOutpaintSize(padding, scale): string   // 实时尺寸标注 "2048 × 1152"
```

- 单测覆盖：clamp 边界、ratio 约束、4096 clamp、scale 换算往返一致。

## 8. 参数条 UI（对照 tapnow 谱系）

顺序：`✕` → 比例菜单（original/1:1/4:3/3:4/16:9/9:16，AntD Dropdown 或 Segmented，倾向 Dropdown 省宽）→ 引导文案 `拖拽外框进行扩图`（text-xs muted）→ 分辨率档 chips（沿用模型 size 档位语义）→ 张数 → 模型选择（复用现有模型选择器组件）→ 执行按钮（↑ 语义，`type="primary"`）。

- 模型能力显隐：`maxImages=0` → 执行禁用 + 明示文案“当前模型不支持扩图，请更换模型”（红线 AC4）。
- **积分槽位（用户裁定 2026-09-18：真实计价组件）**：复用 prompt-panel / model-picker 现成模式——
  - `creditsEnabled = useUserStore((s) => s.features.creditsEnabled)`，false 时整块隐藏；
  - 本地价：`resolveModelChannel(config, model)` → `requestCreditCost({ channelMode, modelCosts, model, count: 张数, capability: "image", config, requirements })`（`web/src/lib/model-pricing.ts`）；
  - 远端报价：`modelQuoteRequest(config, model, "image", requirements)` → `quoteLogicalModel(id, intent, signal)`（AbortController，失败回落本地价，照 prompt-panel :196-207）；显示价 = 单次价 × 张数；
  - 展示：`<CreditSymbol/> {credits}`（`web/src/constant/credits.tsx`）；
  - 不新接账务接口，不改计价层。
- 样式：组件内 Tailwind + 三层令牌引用（`var(--token)`），玻璃 = `bg/90 + backdrop-blur` 仅参数条；shadow/border 用现有语义令牌，不新增 globals 规则。若需新令牌 → 登记本任务卡 Notes。

## 9. 取舍记录

| 决策 | 备选 | 理由 |
| --- | --- | --- |
| padding 世界坐标状态 + 负偏移渲染 | 独立世界层节点 | 外扩框语义上属于节点，随节点删除/选中生命周期，不进 nodes 文档（不污染撤销栈/持久化） |
| 外扩框渲染在屏幕空间覆盖层 + rect 实测（tapnow NodeResizer 同款） | 渲染在世界层随 transform | 节点拖拽预览期 React state 脱节（drag preview 直改 DOM）；世界层挂载受 overflow 裁剪；手柄/网格/字号恒定可用性好（§3.1 修订 2026-09-18） |
| 覆盖层挂 media-dialogs 文件 | 新画布层挂载点 | 接线面收敛在任务书 4 文件清单内，最小合并成本 |
| payload 像素域（paddingPx）在 UI 层换算 | hook 内再换算 | 纯函数集中在 geometry 模块可测；hook 保持骨架形状 |
| 一个 padImageToDataUrl 双用途（image/mask） | 两个函数 | fill 参数真实复用消除重复（AGENTS.md：新 helper 必须消除真实重复） |
| 程序化白底补边不设独立 UI 通道 | 参数条加模式切换 | 第一版纪律"不加花样"；pad 白底图作为提交底图已覆盖 Amazon 白底场景（模型遵循时等效），独立通道属二期 |

## 10. 风险与对策

1. **画布事件抢占细则（任务书预警的坑）**：手柄 pointerdown stopPropagation 之外，还需实测画布 selection/pan 管线是否有 window 级监听绕过 stopPropagation——实现时真机验证，若发现 window 捕获级监听，记录任务卡并停下来问用户。
2. **模型对"填充白区"遵循度**（impl/F-06.md 风险 1）：固定模板 + mask 通道缓解；不在本任务内做样本集验收（二期）。
3. **mask 极性端到端一致性**：用户裁定透明=扩图区。实现时核对 `canvas-node-mask-edit-dialog.tsx` 的 `buildEditMask` 产出极性与 `provider_protocol.go` 规范化链路：若规范化层存在极性反转，则扩图 mask 按“合成时透明=扩图区、提交前按链路要求补极性”处理，保证上游收到语义正确的 mask；核对结论写回 implement.md Step 0.1。
4. **世界层挂载点**：具体父容器（节点元素内 vs 世界层兄弟）以实际 DOM 结构为准实现时定，原则 = 节点 rect 实测锚定 + 不被节点 `overflow:hidden` 裁剪（外扩框在节点外，必要时挂节点 wrapper 的兄弟层级）。
