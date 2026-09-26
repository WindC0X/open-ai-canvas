# S2 设计：数据驱动 hover 说明卡

## 1. 数据层（单一事实源）

`tool-definition.ts` 扩展（两处类型同步）：

```ts
export type ToolHoverInfo = {
    /** 一句话职责（必填；hover 卡正文） */
    description: string;
    /** 预览图（web/public 相对路径，可选；仅用现有 assets） */
    preview?: string;
    /** 快捷键徽章：CANVAS_SHORTCUTS 的 id 列表（可选，单一来源） */
    shortcuts?: string[];
};
// ToolDefinition 增 hover?: ToolHoverInfo
// AddNodeMenuCommand 增 hover?: ToolHoverInfo
```

数据填写：`definitions/main-toolbar-tools.tsx` 与 `definitions/add-node-menu-tools.tsx` 每个条目补 `hover.description`；有键位的补 `hover.shortcuts`（如 撤销/重做/添加节点（如注册表有）/搜索等——以 `CANVAS_SHORTCUTS` 实际 id 为准枚举）；preview 仅在存在合适资产时填写（盘点表见 §5）。

## 2. 渲染层（一个共享组件 + 两处接入）

新组件 `web/src/components/canvas/canvas-tool-hover-card.tsx`：

```tsx
export function CanvasToolHoverCard({ icon, label, hover, theme, open, anchorRect }: {...})
```

- 结构：横向小卡（图标位 + 名称/职责文本列）+ 预览图（下方内嵌，`img` 懒加载）+ 快捷键徽章行（`kbd` 样式；键位由 `CANVAS_SHORTCUTS.find(id)` 解析 keys 数组 → `Ctrl + S` 形态渲染）。
- 定位：portal 到 body（`position: fixed`，锚定触发器 rect；上方优先，空间不足翻下方），防 Dock 窄屏 overflow 裁剪。
- 动效：`motion/react`（项目既有），延时不大于现有 dock tooltip 量级；`useReducedMotion` 下禁用位移/缩放（仅显隐）。
- 无障碍：`role="tooltip"` 或 `aria-describedby` 关联触发器；键盘 focus 显示。

接入点 1 —— FloatingDock（`floating-dock.tsx`）：
- `FloatingDockCommand` 增可选 `hoverCard?: { description: string; preview?: string; shortcutKeys?: string[][] }`（由 registry `toolToEntry` 从 `ToolDefinition.hover` 映射；快捷键数组在 entry 构造时解析成 keys，渲染层不依赖 shortcuts 模块）。
- `DockCommandButton`：`hoverCard` 存在 → 渲染 `CanvasToolHoverCard`（延时/收起逻辑内聚）；不存在 → 维持现状 tooltip。

接入点 2 —— 节点创建菜单（`canvas-create-menu.tsx`）：
- `CanvasCreateCommand` 增可选 `hover` 同构字段；`CanvasCreateCommandGrid` 按钮 hover/focus 时渲染同一个 `CanvasToolHoverCard`（停靠按钮上方）。

## 3. 快捷键解析（单一来源）

`canvas-tool-hover-card.tsx` 内部：`const shortcut = CANVAS_SHORTCUTS.find((item) => item.id === id)`；键位渲染 `item.keys.map(k => k.join(" + "))`。**定义侧只存 id**，键位永远实时取自注册表。

## 4. 取舍与风险

- 为何扩 FloatingDock 而不是在 canvas-toolbar 外层写 hover：dock 的按钮状态（hover/focus/disabled）在 `DockCommandButton` 内部，外挂需要重造状态机；扩展点是刻意设计的"数据驱动"体系。
- 风险1：FloatingDock 是共享 UI（zoom dock 等也在用）→ `hoverCard` 可选，缺省行为不动；zoom dock 不改。
- 风险2：窄屏 scrollable 场景自定义 tooltip 会被 overflow 裁剪（现注释已说明）→ portal 渲染规避；仍保留原生 title 兜底路径。
- 风险3：hover 卡与点击冲突 → 卡不拦截指针事件（`pointer-events-none` 除链接外）；不铺遮罩。
- 风险4：预览图加载失败 → `onError` 隐藏图像区（降级为无图卡）。

## 5. 预览资产盘点（初版，实现时以实际为准）

| 工具 | 候选资产 | 结论 |
|---|---|---|
| 文件夹 | `images/canvas/folder-default-cover.png` | 可用 |
| 项目画风 | `short-drama-styles/real-life.jpg`（样张） | 可用（仅示意） |
| 其余（文本/图片/视频/音频/分帧/导演台/工作流/上传…） | 无对应资产 | **降级卡（无图）**；缺口清单交付时上报 |

> 复核口径：宁可无图也不滥用无关图；预览可后续由专门资产任务补齐（系统已支持数据填入即生效）。

## 6. 测试

`web/test/canvas-tool-hover-cards.test.ts`：
- 覆盖性：main toolbar + add-node menu 全量条目 `hover?.description` 非空。
- 引用完整性：所有 `hover.shortcuts` id ∈ `CANVAS_SHORTCUTS`；所声明 `preview` 路径在 `web/public/` 存在。
- 结构：确保 `floating-dock.tsx` 的 hoverCard 分支与 create-menu 接入存在（静态断言）。

## 7. 回滚

单 commit 全量 revert；或分层回退（先撤接入、保留数据）。
