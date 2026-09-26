# S3 ? 帮助菜单四件套

## Goal

画布常驻「?」帮助菜单（四件套）：**使用教程**（链 docs Quickstart，与本枝 S4 互链）/ **快捷键**（复用现有 Modal）/ **反馈**（表单：描述 + 截图 + 分享链接 toggle + 自动附加信息明示，TapNow 式）/ **最近更新**（链现有 changelog 弹窗）。

## 已核实事实（证据锚）

- `?` 菜单本体不存在（画布无帮助入口）；快捷键 Modal 已存在：`web/src/pages/canvas/canvas-shortcuts-modal.tsx`；顶栏已有打开通道：`canvas-project-top-bar.tsx`（`shortcutsOpen` state + `shortcutRequestNonce` effect，见 `project.tsx:3307`）；缩小 dock 另有「画布快捷键」入口（`canvas-zoom-controls.tsx:92`）。
- 更新日志：`AppChangelogButton`（自带开合态，lazy 加载 `AppChangelogDialog`，`components/layout/app-changelog-modal.tsx`）。
- 分享链接：`CanvasShareModal` + `services/api/canvas-share`（`getCanvasShare/createCanvasShare`；URL 形态 `${origin}/share/canvas/${token}`）——反馈表单只能**读取**已有分享状态，不新建分享。
- 反馈提交：仓库无既有反馈提交机制；一阶段预裁决 = **纯前端聚合，不建后端 endpoint，收集走现有外链机制**（既有对外渠道：GitHub Issues / 微信群，见 README）。
- 操作历史：`pages/canvas/use-canvas-operation-history`（画布操作记录）可用作「最近操作」摘要来源（可用性以实现核对为准）。

## Requirements

- R1 入口：画布顶栏右侧新增「?」图标按钮（`canvas-project-top-bar.tsx` 工具簇），点击展开四件套下拉菜单；常驻可见（与分享/版本同簇）。
- R2 使用教程：外链跳转 docs Quickstart（新常量 `canvas-help-links.ts`；与 S4 的最终路径互链——S4 定稿后回填；链接随本枝合入生效，评审期标注）。
- R3 快捷键：复用现有 `CanvasShortcutsModal`（顶栏 state 直开，不复制新弹窗）。
- R4 反馈表单（新组件 `canvas-feedback-dialog.tsx`）：
  - 字段：问题描述（必填 textarea）；截图（本地选择 → 预览；**不做上传**）；分享链接 toggle（读现有分享状态：有则含 URL，无则禁用 + 提示"开启画布分享后可附上"）；自动附加信息（可折叠区块，**标题固定「将包含以下信息」**——控制线 2026-09-27 透明度原则：如有画布上下文（节点数 / 当前操作摘要）一并列出；**不含 Cookie/Token/密钥**）。
  - 提交动作：**纯前端聚合**——「复制反馈内容」写剪贴板（含描述 + 各 toggle 项 + 附加信息）；「打开反馈渠道」外链 GitHub Issues（新窗口）。截图随剪贴板尽力而为（`navigator.clipboard.write` 图片失败时降级为"请手动粘贴截图"提示）。
  - 不建任何新 API/endpoint；不写服务器。
- R5 最近更新：复用 `AppChangelogButton`（菜单行形态）打开现有 changelog 弹窗；不新做 changelog 页。
- R6 样式与可达性：组件级样式（Tailwind/组件 CSS）；**不改 `globals.css`**；键盘可达、Esc 关闭、焦点管理沿用项目弹层纪律；文案简体中文。

## Acceptance Criteria

- [ ] AC1：顶栏「?」展开四件套；四项逐一可开：教程（外链可点）、快捷键（现有 Modal 打开）、反馈（表单打开）、最近更新（changelog 弹窗打开）。
- [ ] AC2：反馈表单完成一次完整聚合：填描述 + 勾选项 → 「复制反馈内容」得到含描述/分享链接（如勾选且存在）/附加信息的文本；附加信息明示区与实际附带一致（无敏感字段，grep 自证不含 token/cookie 字段）。
- [ ] AC3：分享链接 toggle 在无分享时禁用并提示；有分享时可含 URL。
- [ ] AC4：专项测试绿（表单组装纯函数：`buildFeedbackPayload` 输入→输出确定性；敏感字段排除断言）。
- [ ] AC5：**门禁四件**：① `cd web && bun run typecheck` 0 ② `cd web && bun run build` 通过 ③ focused 测试绿 ④ `bun test` 全量对照测试仓 `open-ai-canvas-testing/docs/env.md` 冻结红基线（15 条 @5a567238）：基线内放行，名单外红 = stop 报控制线。
- [ ] AC6：真机走查截图（? 菜单四态 + 反馈表单填写/复制），dev 端口 :3010/:8483；对照 15 条红基线放行口径。
- [ ] AC7：`git diff` 不含 `globals.css`；无新增依赖；无后端改动（diff 自证）。

## Out of Scope

- 任何新后端 endpoint / 反馈落库 / 截图上传存储（一阶段预裁决，禁止自作主张建 API）。
- 首点引导、移动端专门重构；workspace（非画布）帮助入口（后续波次可复用本组件）。
- Changelog 独立文档页。

## Notes

- TapNow 表单参照：描述 + 截图 + 分享链接 toggle + 最近操作回放 toggle + 自动附加信息明示（综述 §一/§四）。
- 「最近操作」项：如 `use-canvas-operation-history` 成本可控则并入聚合（默认勾选可关）；否则记录降级原因（评审门报备）。
- `pending-test.mdx` 登记（S4 迁移前旧路径）。
