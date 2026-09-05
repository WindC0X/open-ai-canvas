# Design：生成中媒体区进度填充（BlockLoadingState 对齐）

## 1. 证据锚点

- flora 实现：`.flora-capture/static/066-0l6-ok9_srnk1.js.js`（BlockLoadingState 组件）+ `001-0y9adi-m3bgb7.css.css`（三枚 keyframe + 消费选择器），详见 prd.md §1。
- og 近似实现（仅对照，不采用其无限循环）：og-canvas-flora-study `globals.css:516` `.canvas-loading-wave`。
- 用户实机观察（2026-09-04）：flora 生成中节点媒体区有动效。最高证据层。

## 2. 适用面与边界

**范围内**：`CanvasNodeType.Image` / `CanvasNodeType.Video` 节点，`metadata.status === "loading"` 且**无媒体内容**（`!hasImageContent && !hasVideoContent`，即首次空白生成分支）。与 `canvas-node.tsx:302` 的 `node-generating-border` 判定条件同源。

**范围外**（明确不做，防蔓延）：
- 重生成路径（有媒体面）：保持 phase43 行为——媒体面 compositor 静止，不加任何填充/骨架。
- `Text` 节点生成中：其 loading 形态是另一片（清单待查），本 slice 不动。
- 节点边框环（`node-generating-border`）、标题 ETA token、底部状态行：全部保留现状，本任务只加媒体区填充层。

## 3. 组件契约：`CanvasNodeLoadingFill`

新文件 `web/src/components/canvas/canvas-node-loading-fill.tsx`：

```tsx
export function CanvasNodeLoadingFill({ node, theme }: { node: CanvasNodeData; theme: CanvasTheme })；
```

挂载点：`canvas-node.tsx` body 容器（`overflow-hidden` 那层，~line 340）**第一子元素**——DOM 顺序最先 ⇒ 天然位于 badge / CanvasNodeContent / 状态行之下，被容器 `rounded-[inherit] + overflow-hidden` 裁剪，无需自管 z-index。

```jsx
{!hasImageContent && !hasVideoContent && (data.type === Image || data.type === Video)
    ? <CanvasNodeLoadingFill node={data} theme={theme} /> : null}
```

内部状态机（flora `o(g, 400)` 同款语义）：

| 内部量 | 来源 | 行为 |
| --- | --- | --- |
| `visible` | `node.metadata?.status === "loading"` | 驱动渲染与退出缓冲 |
| `shouldRender` | `visible \|\| (visible=false 后 400ms)` | **防抖场景**：status 抖动（retry 重挂、loading→error→loading）不闪填条；success 后节点出现媒体 → 挂载条件翻 false → 与媒体上屏同帧卸载 |
| `targetScale` | `metadata.taskProgress` 映射（§4） | 驱动 scaleX |
| `bridge` | 上帧 scale ≠ 新 scale 且属回跳/首跳（§4 correction） | 一次性桥接动画 |

填充层 DOM（对齐 flora `data-id="block-loading-state"` 结构）：

```jsx
<div className="canvas-node-loading-fill" data-phase={phase} style={vars}>
  <div className="canvas-node-loading-fill-bar" style={scaleStyle} />
</div>
```

- 外层：`absolute inset-0 overflow-hidden`，`pointer-events: none`（不挡状态行与详情按钮）。
- 内层条：`absolute inset-0`，背景 `theme.node.loadingFill`（§5），`transform-origin: left`，宽度由 scaleX 驱动（不动画 width，走 compositor）。

## 4. 进度三态映射（影策数据源 → flora 行为）

数据源事实（已核）：`canvas-project-generation.ts` `normalizeTaskProgress`：有数值 → clamp 0..100；`queued` → 0；`running` 无数值 → `undefined`。retry 时 `resetGenerationTaskMetadata` 清空后重建 → progress 回跳真实存在。

| 影策状态 | targetScale | 表现 |
| --- | --- | --- |
| `taskProgress` 为数值 n | `n / 100` | 内联 `--loading-target-scale` + `transition: transform .3s ease-out`（无 keyframe） |
| `undefined`（running 无进度）/ `queued`（0 不可见） | fallback | `canvas-loading-fill-fallback` keyframe `scaleX(0)→scaleX(.05)` 一次性 forwards |
| 回跳（新值 < 上帧值）或 fallback → 首个真实值 | correction | `canvas-loading-fill-correction`：`--loading-from-scale`(上帧) → `--loading-to-scale`(新值)，0.3s ease-out forwards |

上帧 scale 用 `useRef` 记录。correction 动画结束后（`onAnimationEnd` 或直接靠 fillMode）回到内联 scaleX 常规路径。

**满格语义**：progress=100 但 status 仍 loading → 保持 scaleX(1)（flora 为 .95 上限，影策用真实 100/100=1，条满格）；状态翻转 success 后随挂载条件卸载。不做额外媒体等待计时。

## 5. Token（三层纪律）

`web/src/lib/canvas-theme.ts` `node` 组新增：

| 主题 | 键 | 值 | 依据 |
| --- | --- | --- | --- |
| dark | `loadingFill` | `rgba(255,255,255,.10)` | flora 原值 `bg-white/10` |
| light | `loadingFill` | `rgba(17,24,39,.07)` | 明底白条不可见；取 light `selectionFill` 同族 alpha，保持"安静可感知" |

不新增全局 CSS 变量，沿用现有 `canvasThemes` 对象注入路径（组件 props.theme 直取）。

## 6. CSS（globals.css，追加在 node-generating-border 区块附近）

```css
.canvas-node-loading-fill { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.canvas-node-loading-fill-bar {
    position: absolute; inset: 0; transform-origin: left center;
    transform: scaleX(var(--loading-target-scale, 0));
}
.canvas-node-loading-fill-bar[data-phase="fallback"] { animation: canvas-loading-fill-fallback .3s ease-out forwards; }
.canvas-node-loading-fill-bar[data-phase="correction"] {
    animation: canvas-loading-fill-correction .3s ease-out forwards;
}
@keyframes canvas-loading-fill-fallback { from { transform: scaleX(0); } to { transform: scaleX(.05); } }
@keyframes canvas-loading-fill-correction {
    from { transform: scaleX(var(--loading-from-scale, 0)); }
    to { transform: scaleX(var(--loading-to-scale, 0)); }
}
@media (prefers-reduced-motion: reduce) {
    .canvas-node-loading-fill-bar[data-phase] { animation: none; }
}
```

命名用 `canvas-loading-fill-*` 前缀，与 flora 原名区分（避免误引用外部语料类名）。reduced-motion 下：fallback 静态 5%（条仍可见）、真实进度仍由内联 scaleX 表达（`transition` 也一并禁）——transform 是状态而非装饰动画，符合 DESIGN.md 动效地板。

## 7. 数据流与兼容

- 纯增量：新组件文件 + canvas-node.tsx 一处挂载 + canvas-theme.ts 两键 + globals.css 一段。不动 sync/executor 的 metadata 写入逻辑。
- 回滚 = 删除上述四处，无数据迁移。
- 风险：`LoadingContent` 的底部状态行（`z-[1]`）在填充层之上，白条与状态行渐变底（`rgba(0,0,0,.4)`）叠加深色区——明暗主题各验一次对比度（验收 2）。

## 8. 验证

1. `cd web && bun run build`。
2. 浏览器（用户或本地）：真实生成一次 → 观察填充条随进度推进；queued 无进度任务显示 5% 静条；retry 回跳触发 correction；完成瞬间填充层随媒体上屏卸载。
3. 重生成路径回归：已有媒体节点重跑任务 → 媒体面无填充（phase43 不回归）。
4. 明 / 暗 / reduced-motion 三态目检（G10 记录进 pending-test.mdx）。
