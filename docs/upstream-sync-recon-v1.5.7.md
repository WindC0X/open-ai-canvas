# 增量侦察底图：v1.5.1 → origin/main HEAD（批次七 · 机械层，2026-09-22）

> 本文件只含**机械统计**（不裁决）。裁决战见 `docs/merge-ruling-cards/`（签字制）。锁版见 `docs/merge-lock-v1.5.7.md`。

## 1. 区间与规模

| 项 | 值 |
| --- | --- |
| 侦察基线 | `8d60a516`（merge-base） |
| 目标（用户裁定选 2） | `origin/main` HEAD = **`6f452405`** |
| 上游待合提交 | **129** |
| 上游改动文件数 | **726** |
| 我方改动文件数（同基线对比） | **377** |
| **双方都改（冲突热区）** | **82** |

## 2. 冲突热区全表（上游提交数 / 我方增删行 / 文件）

| 上游提交数 | 我方增/删 | 文件 |
| ---: | ---: | --- |
| 35 | 1401/6 | `docs/content/docs/progress/pending-test.mdx` |
| 14 | 806/468 | `web/src/pages/canvas/project.tsx` |
| 11 | 16/0 | `docs/content/docs/overview/features.mdx` |
| 9 | 105/56 | `web/src/components/canvas/canvas-node-prompt-panel.tsx` |
| 8 | 9/8 | `backend/internal/app/cloud_agent_tools.go` |
| 8 | 2/1 | `docs/content/docs/backend/code-map.mdx` |
| 8 | 129/11 | `web/src/components/canvas/canvas-cloud-agent-panel.tsx` |
| 8 | 1215/322 | `web/src/styles/globals.css` |
| 6 | 7/0 | `web/src/components/canvas/canvas-cloud-agent.css` |
| 6 | 672/141 | `web/src/components/model-picker.tsx` |
| 6 | 16/0 | `web/src/types/canvas.ts` |
| 6 | 1/10 | `web/src/styles/workspace-product.css` |
| 5 | 7/0 | `backend/internal/app/cloud_agent_runtime.go` |
| 5 | 262/77 | `web/src/services/user-data-sync.ts` |
| 5 | 22/25 | `web/src/pages/canvas/shared.tsx` |
| 5 | 152/22 | `backend/internal/app/cloud_agent_media.go` |
| 5 | 1/0 | `.gitignore` |
| 4 | 83/1 | `web/src/components/canvas/canvas-cloud-agent-chat-ui.tsx` |
| 4 | 8/2 | `web/src/pages/canvas/use-canvas-render-model.ts` |
| 4 | 4/1 | `web/src/lib/model-capabilities.ts` |
| 4 | 33/0 | `web/src/stores/use-config-store.ts` |
| 4 | 269/12 | `web/src/pages/canvas/use-canvas-media-tools.ts` |
| 4 | 2/0 | `backend/cmd/migrate-sqlite-postgres/main.go` |
| 4 | 12/0 | `web/src/lib/user-session.ts` |
| 3 | 62/0 | `backend/internal/app/provider.go` |
| 3 | 5/1 | `backend/internal/app/resource_delete_test.go` |
| 3 | 43/30 | `web/src/components/canvas/canvas-node-toolbar.tsx` |
| 3 | 4/1 | `backend/internal/app/analytics.go` |
| 3 | 3/1 | `backend/internal/service/aliases_consts.go` |
| 3 | 265/3 | `backend/internal/app/cloud_agent_approval_preview.go` |
| 3 | 16/2 | `web/src/pages/canvas/use-canvas-project-lifecycle.ts` |
| 3 | 13/2 | `web/src/components/canvas/canvas-image-toolbar-tools.tsx` |
| 2 | 73/6 | `web/src/lib/canvas/canvas-project-domain.ts` |
| 2 | 72/14 | `backend/internal/app/cloud_agent_canvas_state.go` |
| 2 | 5/2 | `web/test/site-appearance-and-skins.test.ts` |
| 2 | 40/8 | `web/src/lib/canvas/canvas-generation-task-sync.ts` |
| 2 | 3/2 | `backend/internal/app/cloud_agent_batch_table.go` |
| 2 | 23/3 | `web/src/lib/canvas/canvas-project-generation.ts` |
| 2 | 2/1 | `web/test/canvas-resource-mention-editor.test.ts` |
| 2 | 19/9 | `web/src/lib/canvas/canvas-image-batch-retry.ts` |
| 2 | 17/0 | `web/src/pages/canvas/canvas-project-media-dialogs.tsx` |
| 2 | 16/4 | `web/src/lib/app-theme.ts` |
| 2 | 10/1 | `web/src/stores/canvas/use-canvas-store.ts` |
| 2 | 1/1 | `web/test/appearance-bootstrap.test.ts` |
| 2 | 1/1 | `web/src/pages/create/creation-workspace.tsx` |
| 2 | 1/1 | `web/src/constant/canvas.ts` |
| 2 | 1/1 | `backend/internal/prompts/agent_policy_test.go` |
| 2 | 1/1 | `backend/internal/app/cloud_agent_contract_test.go` |
| 2 | 0/1 | `web/index.html` |
| 1 | 99/10 | `web/src/components/canvas/canvas-workspace-overlays.tsx` |
| 1 | 86/126 | `web/src/components/video-settings-panel.tsx` |
| 1 | 7/4 | `web/src/pages/canvas/canvas-image-generation-executor.ts` |
| 1 | 7/0 | `web/src/components/model-logo.tsx` |
| 1 | 68/28 | `web/src/components/canvas/canvas-node-content.tsx` |
| 1 | 6/1 | `backend/internal/app/provider_test.go` |
| 1 | 5/2 | `web/src/lib/model-pricing.ts` |
| 1 | 5/0 | `web/src/services/agent-canvas-sync.ts` |
| 1 | 5/0 | `backend/internal/app/resource.go` |
| 1 | 48/2 | `web/src/services/project-asset-sync.ts` |
| 1 | 44/12 | `backend/internal/app/cloud_agent_step_hash.go` |
| 1 | 4/4 | `backend/internal/app/channel_model_upstream_rename_test.go` |
| 1 | 4/3 | `web/test/create-library-button.test.ts` |
| 1 | 4/0 | `.env.example` |
| 1 | 36/2 | `backend/internal/app/cloud_agent_step_hash_test.go` |
| 1 | 35/0 | `backend/internal/repository/cloud_agent.go` |
| 1 | 32/8 | `web/src/lib/canvas/canvas-storage-revision.ts` |
| 1 | 3/5 | `web/src/pages/settings/index.tsx` |
| 1 | 25/0 | `backend/internal/app/cloud_agent_approval_preview_test.go` |
| 1 | 245/5 | `backend/internal/app/cloud_agent_media_test.go` |
| 1 | 22/1 | `AGENTS.md` |
| 1 | 20/6 | `web/src/lib/canvas/agent-canvas-patch.ts` |
| 1 | 2/2 | `backend/internal/app/cloud_agent_batch_table_test.go` |
| 1 | 2/0 | `web/src/router.tsx` |
| 1 | 186/5 | `backend/internal/app/cloud_agent_undo_test.go` |
| 1 | 17/2 | `backend/internal/app/creation_canvas.go` |
| 1 | 158/1 | `backend/internal/app/cloud_agent_undo.go` |
| 1 | 15/0 | `web/test/agent-canvas-sync.test.ts` |
| 1 | 13/4 | `backend/internal/handler/auth.go` |
| 1 | 12/0 | `web/test/agent-canvas-patch.test.ts` |
| 1 | 1/1 | `web/src/components/layout/app-changelog-dialog.tsx` |
| 1 | 1/1 | `backend/internal/canvas/capability/builtin.go` |
| 1 | 1/1 | `backend/internal/app/cloud_agent_storyboard_test.go` |

## 3. 重点预判对象（用户指定）

### b8eefdad

```text
### b8eefdad feat(canvas): 模型选择 - 支持彩色展示标签并优化目录与积分交互
 backend/internal/app/channel_model_tags.go         | 32 ++++++++++
 backend/internal/app/channel_model_tags_test.go    | 27 ++++++++
 backend/internal/app/channel_models.go             |  6 ++
 backend/internal/app/model_catalog.go              |  2 +
 .../internal/database/channel_model_tags_test.go   | 39 ++++++++++++
 backend/internal/database/migrations.go            | 10 ++-
 backend/internal/database/migrations_test.go       | 10 +++
 backend/internal/handler/openapi.yaml              | 15 +++++
 backend/internal/model/models_channel.go           |  6 ++
 docs/content/docs/backend/backend-database.mdx     |  2 +
 docs/content/docs/backend/http-api.mdx             |  4 +-
 docs/content/docs/progress/pending-test.mdx        | 21 ++++++
 web/src/components/model-picker.tsx                | 48 ++++++--------
 web/src/components/model-tags.tsx                  |  9 +++
```

与热区文件交集：`docs/content/docs/progress/pending-test.mdx`、`web/src/components/model-picker.tsx`

### c5b81f69

```text
### c5b81f69 feat(*): 画布助手 - 新增 Live2D 配置导入与模型渲染支持
 backend/internal/app/appearance.go                 |  19 +-
 backend/internal/app/appearance_canvas.go          |  64 +++++
 backend/internal/app/appearance_live2d.go          | 294 +++++++++++++++++++++
 backend/internal/app/appearance_live2d_test.go     | 252 ++++++++++++++++++
 backend/internal/app/resource.go                   |   5 +-
 backend/internal/handler/appearance.go             |   1 +
 backend/internal/handler/appearance_live2d.go      |  72 +++++
 backend/internal/handler/appearance_routes_test.go |  15 +-
 backend/internal/handler/openapi.yaml              |  62 +++++
 backend/internal/service/aliases_consts.go         |   1 +
 docs/content/docs/backend/backend-database.mdx     |   6 +
 .../docs/backend/canvas-agent-appearance.mdx       |  47 ++++
 docs/content/docs/backend/code-map.mdx             |   7 +
 docs/content/docs/backend/http-api.mdx             |  12 +
```

与热区文件交集：`backend/internal/app/resource.go`、`backend/internal/service/aliases_consts.go`、`docs/content/docs/backend/code-map.mdx`

### 6f452405

```text
### 6f452405 fix(canvas): 画布批量生成 - 修复节点丢失、资源引用及刷新状态不一致
 docs/design/canvas-consistency-repair.mdx          | 40 ++++++++++
 docs/index.md                                      |  2 +
 web/src/lib/canvas/canvas-editor-state.ts          | 16 ++++
 web/src/lib/canvas/canvas-generation-layout.ts     |  2 +-
 web/src/lib/canvas/canvas-generation-result.ts     | 32 ++++++++
 web/src/lib/canvas/canvas-generation-task-sync.ts  |  5 +-
 web/src/lib/canvas/canvas-image-batch-retry.ts     | 34 +++++----
 web/src/lib/canvas/canvas-node-visibility.ts       | 32 ++++++++
 web/src/lib/canvas/canvas-performance-mode.ts      |  4 +-
 web/src/lib/canvas/canvas-project-generation.ts    | 29 +------
 web/src/lib/canvas/canvas-resource-references.ts   | 50 ++++++------
 web/src/lib/canvas/canvas-task-state.ts            | 36 +++++++++
 .../canvas/canvas-image-generation-executor.ts     | 17 +++--
 web/src/pages/canvas/project.tsx                   | 22 ++----
```

与热区文件交集：`web/src/lib/canvas/canvas-generation-task-sync.ts`、`web/src/lib/canvas/canvas-image-batch-retry.ts`、`web/src/lib/canvas/canvas-project-generation.ts`、`web/src/pages/canvas/project.tsx`

## 4. 待下一会话完成（深度层）

1. `prd`/`design` 级读取：`docs/upstream-sync-recon-v1.5.1-v1.5.6.md` + 九张裁决卡 + journal 顶部。
2. 对 82 个热区文件做**三方模拟分类**（上游语义 / 我方语义 / 合成后语义），重点 `b8eefdad` 模型选择器域逐项对照（`model-picker.tsx` 我方 +672/-141）。
3. 产出新增裁决卡 / 既有卡修订 → 批次八签字单。
4. 先遣队重算（19 提交先遣队作废，按 129 新地图）。

