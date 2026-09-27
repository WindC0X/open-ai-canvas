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


## S3 执行记录（2026-09-28 · 完成）

- Step 0：`use-canvas-operation-history` 核对 = Agent ops 撤销栈（非通用操作列表），跨 project.tsx 布新状态成本不符 → 「最近操作」按设计风险 3 降级隐藏（本记录+清单备案）；`bunx tsc --noEmit` 基线 0。
- Step 1：`canvas-help-links.ts`（DOCS_QUICKSTART_URL 与 S4 互链注释 / FEEDBACK_ISSUES_URL=issues/new/choose）+ `feedback-payload.ts`（buildFeedbackMeta / buildFeedbackPayload；白名单 meta；空描述抛错；版本前缀归一）+ `web/test/canvas-feedback-payload.test.ts` 6 用例（确定性/拒绝/敏感排除/分享节缺省/可选缺省/明示一致性）。
- Step 2：`canvas-feedback-dialog.tsx`（AppModal flush；描述/截图本地预览/分享 toggle 读 getCanvasShare/「将包含以下信息」折叠区；复制=writeText+截图 ClipboardItem 尽力；打开反馈渠道=window.open noopener）。
- Step 3：顶栏「?」按钮 + 四件套 Dropdown（教程外链 / 快捷键 setShortcutsOpen / 反馈 setFeedbackOpen / 最近更新=AppChangelogButton 菜单行）；`project.tsx` 传 feedbackContext={{projectId, nodeCount}}。
- Step 4 门禁：tsc 0；build ✓；focused 85 绿（10 文件组）；全量对照见 prd 记录（15 基线红 + 5 超时波动的定性：`bun test --timeout 20000` 下相关文件全绿）。
- Step 4 真机走查（:3010/:8483；证据 `.local/s3-walkthrough/evidence-notes.md`）：菜单四态、快捷键模态、反馈空/填/复制(s5+payload 捕获)、分享开关双态闭环（临时分享已撤销）、changelog 弹窗存活、教程 URL 拦截验证；方法披露（菜单行真实点击投递间歇失败→DOM 直点补验；剪贴板需真实点击激活；截图陈旧帧现象）。
- Step 5：正文 + 落卡双 commit，不 push；待控制线复核。
