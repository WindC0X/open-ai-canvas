# S2 执行计划

> 前置：先读 `design.md`。提交信息建议 `feat(canvas): 工具 hover 说明卡 - 左栏与节点菜单 flora 配方（数据驱动 + 快捷键徽章）`。

## Step 0：核对
- [ ] 0.1 重读 `canvas-shortcuts.ts` 全部 id，确定"工具 → 快捷键"映射表（只填真实存在的 id）。
- [ ] 0.2 `cd web && bun run typecheck` 基线 0。

## Step 1：数据层
- [ ] 1.1 `tool-definition.ts`：加 `ToolHoverInfo` + 两类型可选字段。
- [ ] 1.2 `main-toolbar-tools.tsx` / `add-node-menu-tools.tsx`：全量补 `hover.description`；按映射表补 `shortcuts`；按盘点表补 `preview`（仅 2 处候选）。
- [ ] 1.3 静态测试先行：`web/test/canvas-tool-hover-cards.test.ts`（覆盖率断言此时应绿）。

## Step 2：渲染组件
- [ ] 2.1 新建 `canvas-tool-hover-card.tsx`（结构/定位/动效/无障碍/降级）。
- [ ] 2.2 `floating-dock.tsx`：`hoverCard` 字段 + `DockCommandButton` 接入（缺省不动）。
- [ ] 2.3 `tool-registry.ts` `toolToEntry`：`hover` → `hoverCard`（shortcuts id → keys 解析）。
- [ ] 2.4 `canvas-create-menu.tsx`：`hover` 字段 + `CanvasCreateCommandGrid` 接入。
- [ ] 2.5 验证：专项测试 + `bun run typecheck`。

## Step 3：门禁 + 真机
- [ ] 3.1 `bun run typecheck`（=0）→ `bun run build`（通过）。
- [ ] 3.2 `bun test` 全量对照红基线（15 条内放行；名单外红=stop）。
- [ ] 3.3 真机走查（:3010/:8483）：左栏 hover / 节点菜单 hover / 键盘 focus / 窄屏兜底 → 截图。
- [ ] 3.4 `pending-test.mdx` 登记；预览缺口清单整理。

## Step 4：交付
- [ ] 4.1 独立 commit（仅 S2 文件集；diff 自证不含 `globals.css`）。
- [ ] 4.2 汇报：状态 + 门禁结果 + 覆盖统计 + 缺口清单 + 截图索引。

## 回滚点
- Step 2 先后可分层回退；全量单 commit revert 亦可。
