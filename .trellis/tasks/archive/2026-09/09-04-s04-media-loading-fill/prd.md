# S04 修正：生成中媒体区进度填充（BlockLoadingState）

## 0. 结论修正声明

S04 第 4 版（`445d3a5` 后）的"flora 生成中媒体区完全安静、仅标题 ETA + 底部状态行"裁决**部分错误**：

- **错误部分**：首次空白生成路径的媒体区**有动效**——用户 2026-09-04 实机观察确认（最高证据层）。
- 仍然正确的部分：重生成路径（媒体面已存在时）保持 compositor 静止、经标题 ETA + Queue 沟通进度（phase43 §4.2 语料，该路径实例已采到）。

错误根因：语料库对"首次空白生成"瞬态从未采到实例（A6 台账已记录该缺口），而裁决把"捕获里没见到"当成了"证毕安静"。`block-loading-fill` 三枚 keyframe 一直躺在 A6 报告的"001-only keyframes"清单里，被列出但从未追查消费方。

## 1. flora 真实实现（066 chunk JS 级还原，源 `.flora-capture/static/066-0l6-ok9_srnk1.js.js` + 001 chunk CSS）

**组件 BlockLoadingState**（React 组件，JS 内有 `data-testid="loading-fill"`）：

```jsx
<div className="absolute inset-0 overflow-hidden {NODE_RADIUS}" data-id="block-loading-state">
  <div data-testid="loading-fill"
       data-phase={b} data-animation-name={E.animationName}
       className="absolute inset-0 bg-white/10"
       style={{
         // 有精确进度: animation:"none", transition:"transform 0.3s ease-out"
         // 无精确进度: animationName/durationMs/delayMs/fillMode:"forwards"/timingFunction
         "--loading-from-scale": E.fromScale,
         "--loading-to-scale": E.toScale,
         "--loading-target-scale": N
       }} />
</div>
```

**CSS 侧（001 chunk，2026-07-02 build）三态 keyframe：**

| 态 | keyframe | 行为 |
| --- | --- | --- |
| 真实进度 | `block-loading-fill-real` | `scaleX(0) → scaleX(.95)` |
| 无进度 fallback | `block-loading-fill-fallback` | `scaleX(0) → scaleX(.05)`（5% 小条） |
| 进度跳变 correction | `block-loading-fill-correction` | `scaleX(var(--loading-from-scale)) → scaleX(var(--loading-to-scale))` |

- 消费选择器：`[data-id=block-loading-state]>div { transform-origin: 0; transform: scaleX(var(--loading-target-scale, 0)) }`
- 填充条视觉：`absolute inset-0 bg-white/10`（盖满媒体区、白色 10% alpha、transform-origin 左侧）
- 有精确进度时 JS 直接写 `--loading-target-scale = progress/100` 并 `animation:none` + `transition: transform 0.3s ease-out`；无进度走 fallback；进度回跳/修正走 correction 桥接
- 退出：`visible=false` 或 `progress===100` 后 `shouldRender` 400ms 渲染缓冲（`o(g,400)`），fillMode forwards
- reduced-motion：001 CSS 有对 `.loading-fill` 系的 `@media (prefers-reduced-motion)` 降级规则

## 2. og 对照（og-canvas-flora-study `canvas-loading-wave`，globals.css:516）

- 视觉近似：白雾水平填充（30%→70%→96% 宽度）+ sheen 扫光 1.35s + blur 0.35px，reduced-motion 静态 66%
- **本质差异**：og 是无限循环假进度（`3.2s ease-in-out infinite`），flora 是真进度绑定 + fallback + correction 桥接 + 400ms 退出。这就是"类似（但不是完全）"的精确含义。
- 影策取 flora 方案，不取 og 的无限循环。

## 3. 影策实施方案（S04 v5）

改动面：`web/src/components/canvas/canvas-node-content.tsx`（LoadingContent 首次空白分支）+ `web/src/styles/globals.css`（keyframe 与类）。

1. 新增 BlockLoadingState 同款填充层：
   - 容器 `absolute inset-0 overflow-hidden`，圆角继承节点；
   - 填充条 `bg-white/10` 对应物必须走影策三层 token（明暗两主题各一值，语义层命名如 `--canvas-node-loading-fill`），不得硬编码 `rgba(255,255,255,.1)`；
   - transform-origin left，宽度由 scaleX 驱动。
2. 进度三态：
   - 有 `metadata.taskProgress` → 内联 `--loading-target-scale: progress/100`，`transition: transform 0.3s ease-out`；
   - 无进度 → `block-loading-fill-fallback`（5% 小条，一次性 forwards，不无限循环）；
   - 进度回跳/修正 → correction 桥接（`--loading-from-scale` → `--loading-to-scale`）。
3. 退出缓冲：progress=100 或任务完成事件后 400ms 再卸载填充层（fillMode forwards）。
4. 保留现有三层信号：标题 ETA token、底部安静状态行、首次空白 `node-generating-border` 旋转环。
5. reduced-motion：动画禁用，静态显示当前 scaleX 或 fallback 小条。
6. 与 florarunning-light 无关——那个绑定面（emphasis-ring）是另一族，见 §5 复查清单。

## 4. 验收标准

1. 浏览器实测：首次空白生成 → 填充条随 taskProgress 增长（transform scaleX 实时变化）；无进度任务显示 5% 小条；完成 400ms 后卸载。
2. 明暗两主题各自检查填充条对比度可感知（G10 眼验）。
3. reduced-motion 模拟下动画禁用、静态条可见。
4. 重生成路径回归：已有媒体面仍保持静止（phase43 行为不回归）。
5. `cd web && bun run build` 通过。

## 5. 附带记录：全局证据复查清单（用户 2026-09-04 提出的"全局反推"）

裁决规则升级：**凡"flora 无某动效/某行为"的否定性结论，证据若只是"捕获里没见到 DOM 实例"，一律降级为"未证实"；只有追到消费方 CSS 规则 + JS 渲染条件的否定才能定案。**

按此规则需复查（按风险排序）：

1. `flora-running-light` 销案 → **重开**：`.emphasis-ring-motion::after` 消费绑定存在于 0e7d（07-26 build）CSS；"零 DOM 实例"只证明捕获没赶上生成瞬态，与 S04 同一个洞。
2. S04 "安静方胜出" → **已撤销**（本 PRD §0）。
3. VERDICT.md 里其余基于"absence-in-capture"的否定性结论 → 逐条标注证据类型（consumer-trace / absence-in-capture）并降级后者。
4. 两 build keyframe 差集（001 有 block-loading-fill、0e7d 有 running-light 等）说明 flora 自身跨版本演进，影策对齐时以用户实机现状为最高优先，两份 CSS build 仅为历史旁证。
5. 方法论教训已记：索引 ≠ 读透；keyframe 名单只是目录，消费方追踪（CSS 选择器 + JS 设置点）才是定案证据。
