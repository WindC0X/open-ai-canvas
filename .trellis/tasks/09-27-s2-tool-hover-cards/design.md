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

## 8. 实现差异与落地记录（2026-09-27）

与 §2/§3 的刻意差异：

1. **组件落位 `web/src/components/ui/`**：`tool-hover-card.tsx` / `.css` 不放 `components/canvas/`，因为 `floating-dock.tsx`（ui/aceternity）接入时不得反向依赖 canvas；`ToolHoverCardData` 与快捷键解析 `resolveToolHoverCardData`（id → `string[][]`）落在 `web/src/lib/canvas/tool-hover-card-data.ts`（ui→lib 为既有允许方向）。
2. **快捷键解析前移到适配层**：`tool-registry.ts toolToEntry` 与 `use-canvas-create-commands.ts` 把 `ToolHoverInfo.shortcuts`（`CANVAS_SHORTCUTS` id）解析为键位数组后注入渲染层；渲染组件不依赖快捷键模块。

落地细节（设计外细化）：

- 状态机为导出纯函数 `reduceToolHoverCardState` / `isToolHoverCardOpen`；延时 200ms、离开宽限 140ms；Esc document-capture 监听（`preventDefault/stopPropagation`），关闭后 `dismissed` 直到下一次 enter/focus 重新武装。
- 定位 `computeToolHoverCardPosition` 纯函数：上方优先、空间不足翻下、水平夹取（边距 8）；portal 至 body，ResizeObserver + scroll-capture 跟随重排。
- 门控：`cardsEnabled = !scrollable`（coarsePointer 或视口 <768 时禁用）；禁用工具不出卡（对齐既有 tooltip 语义）；switch 由 DockSwitch 父级单 hook + refs Map 实现逐段卡（规避 hooks-in-loop）。
- 样式走全局 Semantic token（`bg-surface-strong` / `border-border` / `text-foreground`）+ `base/Kbd`；**未触碰 `globals.css`**。接受小代价：portal 无法承接 dock 的 inline 画布主题变量，画布主题 ≠ app 主题时材质或有细微差异。
- Esc 已知边界：画布全局 Esc（取消/去选）在 `window`-capture 先于卡片 `document`-capture，Esc 关卡可能同时触发画布动作；修复需共享键盘调度器，本轮接受并登记。


## §9 S2.1 形态升级（flora 四层配方）实现差异与落地记录（2026-09-28）

- **数据层升级**：`ToolHoverInfo` → `{ tagline（必填）, description（长句）, preview?: 'icon'|'node', shortcuts? }`；`ToolHoverCardData.preview` 必填，`resolveToolHoverCardData(hover, itemId)` 双参——node 预览仅当 `preview==='node'` 且 itemId ∈ `NODE_PREVIEW_KINDS`（11 节点白名单），否则 icon 回退；适配层（tool-registry / use-canvas-create-commands）补传 itemId。
- **渲染层重写**：四层结构（L1 41px 头：32×32 圆角图标块 + 名称/tagline；L2 长句 2 行 min-height 防高度跳变；L3 366×229 预览盒：tool=48px 大图标、node=`tool-hover-card-mockups.tsx` 11 款手写 SVG mockup（标题栏 + 类型徽章 + 点阵背景）；L4 footer「按 + kbd 徽章 + tagline」仅第一组键位）；kbd 徽章本地样式（不动共享 Kbd）。
- **壳 CSS**：min(408px, 100vw−16px) / r24 / rgba(32,32,32,0.9)+blur(16px) / flora 双段阴影 / padding 20px / gap 14px / 150ms scale 0.96→1 / `data-entering` 进场挂 will-change、动画结束清除 / prefers-reduced-motion 直切。
- **定位升级**：`computeToolHoverCardPosition` 按 419–447px 高卡重写（上方优先 → 翻下 → 纵向 clamp + max-height calc(100vh−16px) overflow-y-auto → 水平 clamp）；卡尺寸测量改用 `offsetWidth/offsetHeight`（进场中间帧吃 transform 的回归修复）。
- **两处有意偏离**（控制线批准，PATCH-MAP「形态偏离登记」）：次级灰 #7B7B7B → #949494（flora 原值对比 3.87:1 不达 AA，fork 提亮至 ≥4.6:1）；footer 句式中文化。
- **与 v1 相同的边界保留**：Esc 双动作（全局键盘先手）、portal 主题差、<1024 沉浸无 surface、<768 native title 兜底。

- **加固（2026-09-28）**：新增「全局单卡不变式」（`createToolHoverCardExclusivity` 注册表 + layout 阶段强制关闭其它卡）——节流环境下 leave 宽限定时器被实测拉长（140ms→435ms+），可能与新卡显示延迟倒挂产生双卡残留；不变式让「同时最多一张卡」成为结构性保证（后开者以 escape 语义关闭先开者，保留正常再武装）。
