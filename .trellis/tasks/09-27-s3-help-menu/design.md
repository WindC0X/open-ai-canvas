# S3 设计：帮助菜单 + 反馈聚合

## 1. 入口与接线

`canvas-project-top-bar.tsx`：
- 工具簇（分享按钮旁）加「?」按钮（`CircleHelp` 图标），`Dropdown menu` 四项：

```tsx
const items = [
  { key: "tutorial", icon: <BookOpen/>, label: "使用教程", onClick: openDocsQuickstart },   // 外链
  { key: "shortcuts", icon: <Keyboard/>, label: "快捷键", onClick: () => setShortcutsOpen(true) }, // 复用现有 modal state
  { key: "feedback", icon: <MessageSquareHeart/>, label: "反馈", onClick: () => setFeedbackOpen(true) },
  { key: "changelog", icon: <ScrollText/>, label: <AppChangelogButton .../> },  // 行内复用（自带开合）
];
```

- 新增 `feedbackOpen` state；`<CanvasFeedbackDialog open onClose/>` 挂 topbar 尾部（与 `CanvasShortcutsModal` 同层）。
- 链接常量：新文件 `web/src/lib/canvas/canvas-help-links.ts`：

```ts
/** docs Quickstart 外链（S4 结构定稿后同步路径；本枝合入后生效）。 */
export const DOCS_QUICKSTART_URL = "https://github.com/ddcat-ai/open-ai-canvas/blob/main/docs/content/docs/getting-started/quick-start.mdx";
```

## 2. 反馈表单（新组件 `canvas-feedback-dialog.tsx`）

- 结构（AppModal/AppDrawer 家族，截图弹层纪律）：
  - 问题描述（textarea，必填，字数上限）。
  - 截图：`<input type=file accept="image/*">` → `URL.createObjectURL` 预览 + 移除；**不传服务器**。
  - 分享链接 toggle（加载 `getCanvasShare(projectId)`：`enabled && token` → 可用并显示 URL 摘要；否则禁用 + hint）。
  - 最近操作 toggle（若 `use-canvas-operation-history` 可取：最近 N 条标题摘要；成本不足则隐藏该项并记录）。
  - 自动附加信息（`<details>` 折叠；**标题固定「将包含以下信息」**；内容 = `{app version, UA 摘要, canvasId, pathname, ISO 时间, 节点数, 当前操作摘要（如启用）}`；明示列表与实际附带一致——控制线 2026-09-27 透明度原则，不得隐藏）。
- 聚合纯函数（可测）`web/src/lib/canvas/feedback-payload.ts`：

```ts
export type FeedbackPayloadInput = { description; screenshotName?; shareUrl?; recentOps?; meta: {...} };
export function buildFeedbackPayload(input): { text: string; meta: Record<string,string> };
```

  产出固定格式文本（Markdown 友好），供复制。
- 提交动作：
  - 「复制反馈内容」→ `navigator.clipboard.writeText(payload.text)`；若附截图 → 尝试 `navigator.clipboard.write([new ClipboardItem({"image/png": blob})])`，失败降级提示「截图请手动粘贴」。
  - 「打开反馈渠道」→ `window.open(GITHUB_ISSUES_URL)`（新窗口，`noopener`）。
- 敏感信息红线：payload 只含上列白名单字段；测试断言不含 `token/cookie/apiKey/authorization` 等键名（除分享 URL 自身 token 路径——那是用户显式勾选的分享链接, 需在明示区可预览）。

## 3. 取舍与风险

- 为何复制+外链而非提交 API：一阶段预裁决；且无需处理存储/PII/垃圾信息。
- 风险1：clipboard 图片 API 兼容性 → 降级路径必备（不阻塞文本主路径）。
- 风险2：分享状态读取失败 → toggle 置灰 + 提示，不阻塞提交。
- 风险3：操作历史接口成本/稳定性未知 → 默认隐藏开关，稳妥实现后再上（不阻塞）。
- 风险4：AppChangelogButton 作为菜单行 → 检查样式兼容（菜单内 padding/尺寸），必要时用其 `className` 适配，不 fork 组件。

## 4. 测试

`web/test/canvas-feedback-payload.test.ts`：payload 组装确定性（描述/勾选项/元信息）；敏感键排除；空描述拒绝；分享 URL 未勾选不出现在文本。

## 5. 回滚

单 commit 全量 revert；反馈表单为本枝新增孤立组件，移除零影响。
