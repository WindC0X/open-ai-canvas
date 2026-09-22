# 裁决卡 07：canvas_undone 无条件刷新 vs 终态回放不喂同步（拍板清单⑤）

> 合并日只签字。状态：**取我方语义**。双方 agent-canvas-sync.ts :56 同行亲读。

> **现状注记（2026-09-22 控制线裁决追加，不改原结论）**：2026-09-21 现状：`canvas_undone` 我方已在 review P2 改为无条件刷新，与上游同向——"取我方语义"仅对 `canvas_updated` 门语义成立；执行按保留 gate + `requiresRefresh` 融合落地（见 `docs/merge-w1-progress.md` #2）。

## 上游行为（agent-canvas-sync.ts :56）

```ts
} else if (event.type === "canvas_updated" || event.type === "canvas_undone" || (!supportsPatches && (...))) {
```

- `canvas_updated/canvas_undone` 在 **supportsPatches 门外**——patch 能力可用时也强制 `needsRefresh`。
- 动机：上游撤销链没有专用采纳路径，`canvas_undone` 无 canvasPatch，只能靠无条件刷新对齐。

## 我方行为（agent-canvas-sync.ts :56）

```ts
} else if (!supportsPatches && (event.type === "canvas_updated" || event.type === "canvas_undone" || ...)) {
```

- 两事件在 **!supportsPatches 门内**——patch 会话里走 patch/专用采纳，不盲目刷新。
- 配套两层防复活：①终态 run 订阅是纯历史回放，**回放不喂同步通道**（canvas-cloud-agent-panel.tsx replayOnly，211e4495）；②撤销采纳走专用 `adoptRemoteCanvasAfterUndo`（保视口/对齐基线水位，无反噬——实测 95 秒反噬缺陷已根修）。

## 本质

上游无条件刷新在"终态回放含 canvas_updated"时会重新拉画布 → 已删节点复活（我方真机实证的缺陷）；我方把"何时需要刷新"收敛为：patch 不可用、或专用采纳失败。上游撤销链无专用采纳，因此选择了粗粒度安全（每次都刷）。

## 建议

**取我方语义**：保持 `!supportsPatches` 门 + 终态回放不喂同步 + 专用 adopt。合并后核对一件事：上游 `canvas_undone` 事件 payload 若新增了 canvasPatch（adf3a5be 系），把 undone 接进 patch 通道（届时 even supportsPatches 也能 patch 化撤销，降级路径仍走 adopt）。

## 备选

- B1 随上游无条件刷新：终态回放复活已删节点回归（真机实证）→ **不可接受**。
- B2 折中（patch 会话也刷新 undone）：撤销多一秒级延迟但更保险——可作为采纳失败路径的兜底，不建议替换主路径。

## 证据行号

- 上游：`agent-canvas-sync.ts` :56（门结构）；`canvas_undone` payload 无 canvasPatch（cloud_agent_undo.go state.event，双方一致）。
- 我方：`agent-canvas-sync.ts` :56；`canvas-cloud-agent-panel.tsx` replayOnly 段 + undoLastCanvasChange adopt 段；commit 211e4495。
- 实证：2026-09-19 会话切换复原已删节点 / 撤销 95 秒反噬（两缺陷均已根修）。
