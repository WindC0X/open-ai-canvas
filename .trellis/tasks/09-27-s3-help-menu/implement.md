# S3 执行计划

> 前置：先读 `design.md`。提交信息建议 `feat(canvas): ? 帮助菜单 - 教程/快捷键/反馈/最近更新 四件套（反馈纯前端聚合）`。

## Step 0：核对
- [ ] 0.1 核对 `use-canvas-operation-history` 可取性与成本（决定「最近操作」项取舍，降级则记录）。
- [ ] 0.2 `cd web && bun run typecheck` 基线 0。

## Step 1：链接常量 + 聚合纯函数（含测试）
- [ ] 1.1 `canvas-help-links.ts`（Quickstart URL + Issues URL；注释"手工同步"）。
- [ ] 1.2 `feedback-payload.ts` + `web/test/canvas-feedback-payload.test.ts`。
- [ ] 1.3 验证：`bun test test/canvas-feedback-payload.test.ts`。

## Step 2：反馈弹层
- [ ] 2.1 `canvas-feedback-dialog.tsx`（字段/明示区/复制/外链/降级）。
- [ ] 2.2 截图预览与剪贴板降级路径。

## Step 3：顶栏 ? 菜单
- [ ] 3.1 `canvas-project-top-bar.tsx`：? 按钮 + 四件套菜单 + 快捷键 state 复用 + changelog 行复用 + feedback state。
- [ ] 3.2 样式核对（菜单行与既有 dock/菜单一致性；不减键盘可达性）。

## Step 4：门禁 + 真机
- [ ] 4.1 `bun run typecheck`（=0）→ `bun run build`（通过）。
- [ ] 4.2 `bun test` 全量对照红基线（15 条）。
- [ ] 4.3 真机走查（:3010/:8483）：四件套逐项 + 反馈表单完整走一遍 → 截图。
- [ ] 4.4 `pending-test.mdx` 登记。

## Step 5：交付
- [ ] 5.1 独立 commit（仅 S3 文件集）。
- [ ] 5.2 汇报：状态 + 门禁结果 + 截图索引 + 「最近操作」降级与否 + quickstart 链接"随合入生效"说明。

## 回滚点
- 全量 revert；或先撤菜单项保留组件。
