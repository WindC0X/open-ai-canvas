# Implement：S04 媒体区进度填充

## 执行清单（顺序执行，每步可独立验证）

### 1. Token：canvas-theme.ts 两键
- [x] light.node 加 `loadingFill: "rgba(17,24,39,.07)"`
- [x] dark.node 加 `loadingFill: "rgba(255,255,255,.10)"`
- 验证：`grep -n loadingFill web/src/lib/canvas-theme.ts` 两处。

### 2. CSS：globals.css 追加
- [x] 在 `.node-generating-border` 区块后追加 design.md §6 全段（容器/条/两 keyframe/reduced-motion）。
- 验证：无重名选择器——`grep -c "canvas-node-loading-fill" web/src/styles/globals.css` 预期 6 处以内且全在本段。

### 3. 组件：canvas-node-loading-fill.tsx（新文件）
- [x] 按 design.md §3 契约实现：visible / shouldRender(400ms) / targetScale / correction bridge。
- [x] 三态分支：
  - progress 数值 → 内联 `--loading-target-scale` + `transition: transform .3s ease-out`；
  - undefined/queued-0 → `data-phase="fallback"`；
  - 回跳或 fallback→真实 → `data-phase="correction"` + `--loading-from-scale` / `--loading-to-scale`。
- [x] `pointer-events-none`；除 transform/background 外无内联样式。
- 验证：`cd web && bunx tsc --noEmit`（若 tsbuildinfo 陈旧先删 web/tsconfig.tsbuildinfo）。

### 4. 挂载：canvas-node.tsx
- [x] body 容器（`rounded-[inherit]` overflow-hidden 层，~line 340）第一子元素挂载：
  `{data.metadata?.status === "loading" && !hasImageContent && !hasVideoContent && (data.type === CanvasNodeType.Image || data.type === CanvasNodeType.Video) ? <CanvasNodeLoadingFill node={data} theme={theme} /> : null}`
- [x] 保持 LoadingContent / 状态行 / badge 现状零改动。
- 验证：`git diff --stat` 仅 4 个文件。

### 5. 构建
- [x] `cd web && bun run build` 零错误。

### 5.5 证据闸门（yingce-floraization 纪律，不可跳过）
- [x] 把 flora BlockLoadingState 证据（066 chunk JS 关键段 + 001 CSS keyframe 三条）登记进 `.workflow/scratch/20260903-floraization-image-node-grammar/references/`；
- [x] state-score.md 增加 running 态行（实现后回填 yingce/ 证据与 comparisons/）；
- [x] `python3 flora-evidence-kit/yingce-floraization/scripts/validate_evidence_bundle.py .workflow/scratch/20260903-floraization-image-node-grammar --phase implement` 通过后方可宣称实现完成；acceptance 阶段待人眼签收。

### 6. 运行验证（需要 dev 环境，用户在场或明确授权时）
- [ ] 真实生成：进度条随 taskProgress 推进。
- [ ] queued/无进度：5% 静条。
- [ ] retry 回跳：correction 桥接一次。
- [ ] 完成：填充层与媒体上屏同帧消失。
- [ ] 重生成路径：媒体面无填充。
- [ ] 明/暗/reduced-motion 三态目检。
- [ ] 结果记入 `docs/content/docs/progress/pending-test.mdx`。

## 回滚点

每步独立可回退；整体回滚 = 删 4 文件改动（新文件删除 + 3 处 revert），无数据/存储迁移。

## 评审闸门

- 步骤 1-5 完成后先自查 diff（对照 design.md §2 范围边界，确认未触碰重生成路径与 Text 节点），再进入步骤 6。
- 步骤 6 的目检必须真实发生；无法运行 dev 环境时如实说明，并把待验证项写进 pending-test.mdx，不标记完成。
