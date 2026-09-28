# 全量冲突图：8d60a516..origin/main（129 提交 · 三方模拟实测）

> 方法：`git merge-file --diff3`，base=`8d60a516` / ours=`7ca75afc` / theirs=各提交，逐文件统计真实冲突 hunk。
> 用途：批次九合并的冲突地图（批次七只覆盖增量 49，本表为全量 129）。

## 总览

- 提交总数 **129**；有冲突 **70**；无冲突 **59**
- 冲突 hunk 合计 **627**
- **干净前缀**（自 merge-base 起连续无冲突）：**0 个**，末点 `-`
- 该前缀之后第一个冲突提交 = `772c5519`（globals.css `[data-theme=dark]` .ant-message 强制色，10 hunk → 卡 09 处置）

## 有冲突提交（按上游时间序）

| # | 提交 | hunk | 主题 | 主要冲突文件 |
| --- | --- | --- | --- | --- |
| 1 | `772c5519` | 10 | fix(theme): 补充全局提示框暗黑模式背� | web/src/styles/globals.css(10) |
| 2 | `77f2c9d5` | 1 | fix(ark-assets): 方舟素材库 - 阻止图片 Ag | docs/content/docs/progress/pending-test.mdx(1) |
| 3 | `1e228a04` | 1 | feat(plugins): 方舟 Agent Plan - 新增图片与 | docs/content/docs/progress/pending-test.mdx(1) |
| 4 | `60bad8ca` | 1 | fix(protocol): Seedream 声明式结果 - 裸 b64_ | docs/content/docs/progress/pending-test.mdx(1) |
| 5 | `35ebed30` | 30 | fix(canvas): 画布 - 防止旧内容覆盖并支� | backend/internal/app/cloud_agent_media.go(2)、backend/internal/app/cloud_agent_undo.go(1)、docs/content/docs/backend/code-map.mdx(1)、docs/content/docs/overview/fe |
| 6 | `a3b6761b` | 12 | feat(banner): 首页常驻滚动通知与管理配 | .gitignore(1)、web/src/styles/globals.css(10)、web/src/styles/workspace-product.css(1) |
| 7 | `1dd8e258` | 1 | feat(payment): 支付管理 - 新增支付订单� | docs/content/docs/progress/pending-test.mdx(1) |
| 8 | `615974f1` | 1 | feat(banner): 首页常驻滚动通知 - 合并 PR | docs/content/docs/progress/pending-test.mdx(1) |
| 9 | `648c3098` | 1 | style(web): 工作台入口 - 侧栏容量加硬� | docs/content/docs/progress/pending-test.mdx(1) |
| 10 | `d2ce78d0` | 1 | feat(payment): 支付管理 - 合并 PR #533 支� | docs/content/docs/progress/pending-test.mdx(1) |
| 11 | `f3875357` | 1 | fix(canvas): 画布版本 - 合并 PR #528 防止� | docs/content/docs/progress/pending-test.mdx(1) |
| 12 | `da1560aa` | 1 | feat(plugins): 方舟 Agent Plan - 合并 PR #527  | docs/content/docs/progress/pending-test.mdx(1) |
| 13 | `025b5e84` | 14 | fix(canvas): 画布同步 - 加载云端最新版� | web/src/pages/canvas/use-canvas-project-lifecycle.ts(2)、web/src/services/user-data-sync.ts(12) |
| 14 | `506f463d` | 4 | feat(canvas): 批量创作表 - 支持全局提示 | web/src/pages/canvas/project.tsx(4) |
| 15 | `10f2aa30` | 1 | docs(canvas): 画布能力 - 补充批量创作表 | docs/content/docs/progress/pending-test.mdx(1) |
| 16 | `4eaa28b8` | 1 | fix(canvas): 提示词编辑 - 修复小视口溢� | docs/content/docs/progress/pending-test.mdx(1) |
| 17 | `9b9a7f4a` | 5 | feat(merge): 以官方 main 为基底融合 PR#530 | web/src/pages/canvas/project.tsx(4)、web/src/pages/canvas/shared.tsx(1) |
| 18 | `9eb2fcd4` | 16 | chore(release): 版本发布 - publish v1.5.1 | .gitignore(1)、backend/internal/app/cloud_agent_tools.go(1)、backend/internal/prompts/agent_policy_test.go(1)、docs/content/docs/progress/pending-test.mdx(1)、web/s |
| 19 | `6abaa7b4` | 36 | feat(image): integrate PoloX image editing workflo | backend/internal/app/cloud_agent_media.go(3)、backend/internal/app/cloud_agent_tools.go(4)、web/src/components/canvas/canvas-image-toolbar-tools.tsx(3)、web/src/co |
| 20 | `531019b3` | 15 | feat(*): 模型计费与渠道目录 - 支持视� | web/src/components/model-picker.tsx(15) |
| 21 | `b99ad798` | 4 | fix(canvas): 画布与素材同步 - 修复批量� | web/src/components/canvas/canvas-node-prompt-panel.tsx(1)、web/src/lib/canvas/canvas-image-batch-retry.ts(1)、web/src/pages/canvas/use-canvas-project-lifecycle.ts |
| 22 | `46a32a95` | 5 | feat(admin): 站点外观 - 支持 Tab 分类与� | .gitignore(1)、docs/content/docs/progress/pending-test.mdx(1)、web/src/styles/globals.css(3) |
| 23 | `8e3692ea` | 13 | feat(canvas): 图片编辑 - 合并图片编辑工 | web/src/pages/canvas/project.tsx(11)、web/src/pages/canvas/shared.tsx(2) |
| 24 | `17ffdda0` | 25 | fix(canvas): 图片工具 - 移除独立图片编� | web/src/components/canvas/canvas-image-toolbar-tools.tsx(3)、web/src/components/canvas/canvas-node-toolbar.tsx(3)、web/src/pages/canvas/canvas-project-media-dialo |
| 25 | `2e509228` | 15 | fix(canvas): 模型选择 - 按系统渠道聚合� | web/src/components/model-picker.tsx(15) |
| 26 | `0a06783f` | 16 | fix(*): 视频计费与结果解析 - 按 Token � | web/src/components/canvas/canvas-node-prompt-panel.tsx(1)、web/src/components/model-picker.tsx(15) |
| 27 | `5ad05efb` | 13 | fix(canvas): 画布删除 - 跳过关联素材预� | docs/content/docs/progress/pending-test.mdx(1)、web/src/services/user-data-sync.ts(12) |
| 28 | `237f2e2a` | 17 | feat(models): 模型目录与计费 - 按展示名 | docs/content/docs/progress/pending-test.mdx(1)、web/src/components/model-picker.tsx(15)、web/src/lib/user-session.ts(1) |
| 29 | `27bcca62` | 11 | feat: 批量创作表增加完整生成设置对� | web/src/pages/canvas/project.tsx(11) |
| 30 | `e921deac` | 3 | feat: add list mode for AI-powered batch table gen | web/src/components/canvas/canvas-node-prompt-panel.tsx(1)、web/src/pages/canvas/project.tsx(1)、web/src/types/canvas.ts(1) |
| 31 | `cf4d2ab1` | 2 | feat: add right-click and keyboard delete for batc | web/src/pages/canvas/project.tsx(1)、web/src/pages/canvas/shared.tsx(1) |
| 32 | `5843d489` | 15 | fix: restore list mode entry in text composer | web/src/components/canvas/canvas-node-prompt-panel.tsx(3)、web/src/pages/canvas/project.tsx(12) |
| 33 | `5eab8126` | 10 | refactor(web): 样式体系 - 拆分模型选择� | web/src/styles/globals.css(10) |
| 34 | `16bd4b92` | 2 | feat(canvas): 生成合同 - 统一节点参数并 | web/src/components/canvas/canvas-node-prompt-panel.tsx(1)、web/src/lib/canvas/canvas-project-domain.ts(1) |
| 35 | `adf3a5be` | 17 | feat(agent): 云端 Agent - 增加上下文预算� | backend/cmd/migrate-sqlite-postgres/main.go(1)、backend/internal/app/cloud_agent_canvas_state.go(3)、backend/internal/app/cloud_agent_media.go(7)、backend/internal |
| 36 | `d8e9928c` | 2 | fix(ci): 质量检查 - 同步格式、前端断� | web/test/appearance-bootstrap.test.ts(1)、web/test/site-appearance-and-skins.test.ts(1) |
| 37 | `7985dbec` | 12 | fix: connect batch generation settings dialog | web/src/pages/canvas/project.tsx(12) |
| 38 | `33908ed1` | 21 | feat(canvas): 交互可读性 - 优化连线、字 | web/src/components/canvas/canvas-node-content.tsx(1)、web/src/pages/canvas/project.tsx(11)、web/src/styles/globals.css(9) |
| 39 | `f3e951d5` | 1 | docs(canvas): 补充媒体链路与工作条验收 | docs/content/docs/progress/pending-test.mdx(1) |
| 40 | `04cb4388` | 1 | feat(admin): 模型管理 - 统一财务统计并� | docs/content/docs/progress/pending-test.mdx(1) |
| 41 | `3e35f7d6` | 1 | fix(merge): PR 集成 - fix merge 上传状态与� | docs/content/docs/progress/pending-test.mdx(1) |
| 42 | `cfcc53a9` | 13 | fix(workspace): 创作工作台 - 修复线上样� | docs/content/docs/progress/pending-test.mdx(1)、web/src/components/canvas/canvas-cloud-agent-panel.tsx(3)、web/src/styles/globals.css(9) |
| 43 | `b35c66b2` | 1 | chore(merge): 主线同步 - 合并支付插件与 | docs/content/docs/progress/pending-test.mdx(1) |
| 44 | `d7682963` | 1 | feat(admin): 系统模型 - 合并渠道与模型� | docs/content/docs/progress/pending-test.mdx(1) |
| 45 | `1be8ffce` | 2 | fix(web): 导演台检查 - 隔离开发复现入� | docs/content/docs/progress/pending-test.mdx(1)、web/test/appearance-bootstrap.test.ts(1) |
| 46 | `9afe061d` | 1 | ci(deploy): 镜像发布 - 原生多架构构建� | docs/content/docs/progress/pending-test.mdx(1) |
| 47 | `8d94bde1` | 4 | feat(*): 系统渠道与画布 - 支持多规格� | docs/content/docs/progress/pending-test.mdx(1)、web/src/components/canvas/canvas-cloud-agent-panel.tsx(3) |
| 48 | `0ea9f7d9` | 12 | fix(canvas): 画布智能体 - 严格校验模型� | backend/internal/app/cloud_agent_media.go(7)、backend/internal/app/cloud_agent_tools.go(4)、docs/content/docs/progress/pending-test.mdx(1) |
| 49 | `6d355380` | 17 | feat(canvas): support multimodal video storyboard  | web/src/pages/canvas/project.tsx(13)、web/src/pages/canvas/use-canvas-media-tools.ts(3)、web/src/types/canvas.ts(1) |
| 50 | `d87c3944` | 16 | merge: official v1.5.6 with multimodal storyboard  | web/src/components/canvas/canvas-node-prompt-panel.tsx(3)、web/src/pages/canvas/project.tsx(13) |
| 51 | `f6b33e76` | 1 | feat(plugins): DashScope Wan3 - 新增 wan3.0 原� | docs/content/docs/progress/pending-test.mdx(1) |
| 52 | `9148ceab` | 33 | feat(canvas): 画布工作区 - 整合侧栏与风 | backend/cmd/migrate-sqlite-postgres/main.go(1)、docs/content/docs/progress/pending-test.mdx(2)、web/src/components/canvas/canvas-image-toolbar-tools.tsx(3)、web/sr |
| 53 | `150f9cf2` | 2 | feat(plugins): DashScope Wan3 - 合并原生视频 | docs/content/docs/progress/pending-test.mdx(2) |
| 54 | `a3bf0bd8` | 21 | feat(canvas): 多模态表格 - 合并 PR #549 并 | docs/content/docs/progress/pending-test.mdx(2)、web/src/components/canvas/canvas-node-prompt-panel.tsx(3)、web/src/pages/canvas/project.tsx(13)、web/src/pages/canv |
| 55 | `85de9907` | 11 | fix(canvas): 云端 Agent - 参数错误有限重� | backend/internal/app/cloud_agent_approval_preview.go(1)、backend/internal/app/cloud_agent_tools.go(4)、backend/internal/prompts/agent_policy_test.go(1)、docs/conte |
| 56 | `13d8f629` | 4 | fix(settings): 工作台浮层 - 修复离开设� | docs/content/docs/progress/pending-test.mdx(2)、web/src/pages/settings/index.tsx(2) |
| 57 | `6c92c3be` | 1 | chore(web): 前端格式 - 统一十个文件的 P | web/test/create-library-button.test.ts(1) |
| 58 | `76e02734` | 1 | test(app): 测试库 - 改用 WAL 文件库，消� | backend/internal/app/resource_delete_test.go(1) |
| 59 | `fd3fc44d` | 2 | fix(agent): 画布写入 - 漏 patch 按参数错� | backend/internal/app/cloud_agent_approval_preview.go(1)、backend/internal/app/cloud_agent_approval_preview_test.go(1) |
| 60 | `13707c06` | 4 | perf(agent): 工具 schema 瘦身 - 去掉重复 o | backend/internal/app/cloud_agent_tools.go(4) |
| 61 | `c09304d9` | 1 | fix(web): 首屏 favicon - 不再先闪内置品� | web/index.html(1) |
| 62 | `93bc079b` | 2 | fix(video): 创作台视频 - 修正同步音频� | docs/content/docs/progress/pending-test.mdx(2) |
| 63 | `19c9a207` | 18 | fix(model-picker): 模型选择 - 修复候选报� | docs/content/docs/progress/pending-test.mdx(2)、web/src/components/model-picker.tsx(16) |
| 64 | `15946e5a` | 2 | fix(text): 文本生成 - 修复声明式协议流 | docs/content/docs/progress/pending-test.mdx(2) |
| 65 | `8b8ea291` | 7 | fix(runtime): 运行稳定性 - 修复技能种子 | backend/internal/app/cloud_agent_tools.go(4)、backend/internal/app/resource_delete_test.go(1)、docs/content/docs/progress/pending-test.mdx(2) |
| 66 | `4ab43ca6` | 2 | fix(ui): 提示浮层 - 修复键盘触发并补� | docs/content/docs/progress/pending-test.mdx(2) |
| 67 | `b8eefdad` | 25 | feat(canvas): 模型选择 - 支持彩色展示标 | docs/content/docs/progress/pending-test.mdx(2)、web/src/components/model-picker.tsx(21)、web/src/lib/user-session.ts(1)、web/src/styles/workspace-product.css(1) |
| 68 | `c5b81f69` | 7 | feat(*): 画布助手 - 新增 Live2D 配置导入 | .gitignore(1)、docs/content/docs/progress/pending-test.mdx(2)、web/src/components/canvas/canvas-cloud-agent-panel.tsx(4) |
| 69 | `dc1ad680` | 31 | fix(*): 素材库与画布 - 修复批量删除刷 | backend/internal/app/resource_delete_test.go(1)、docs/content/docs/progress/pending-test.mdx(2)、web/src/components/canvas/canvas-node-prompt-panel.tsx(3)、web/src |
| 70 | `6f452405` | 26 | fix(canvas): 画布批量生成 - 修复节点丢� | docs/content/docs/progress/pending-test.mdx(2)、web/src/lib/canvas/canvas-generation-task-sync.ts(1)、web/src/lib/canvas/canvas-image-batch-retry.ts(3)、web/src/pa |

## 无冲突提交（自动并入）

`3dc3ea29`、`af5b5b20`、`14bdd29d`、`f4df7868`、`4d76acf4`、`c7c37f2d`、`4066be73`、`fd4872a4`、`878bd35c`、`2ae8bfe8`、`cd5a9f2e`、`f848e705`、`c4086a2c`、`11a4320a`、`72ee04fb`、`a07539d4`、`10263016`、`39920ec9`、`dc62109d`、`2682c950`、`fecaab80`、`308cf424`、`6f1b4577`、`937f2b7a`、`944a2209`、`baddbc2f`、`e94eab88`、`af968240`、`0e5fb27f`、`f9dc1c56`、`cce2d2d3`、`3f5b0bd3`、`6c48282e`、`d7e695b9`、`10b85962`、`0e61fb00`、`6edd8b1e`、`cb68476e`、`659f3d4e`、`04a1e19d`、`b9d60f98`、`28b99309`、`55ea71d5`、`24323817`、`9c22ea1d`、`473d535e`、`104396ba`、`7449c1c0`、`b9608c9b`、`0e3fb79b`、`edcf7bc7`、`5e3bc011`、`22d65d01`、`ea44d445`、`f7a8b9ed`、`04d8b85e`、`73ef84ff`、`5045f7a7`、`d5ff2225`
