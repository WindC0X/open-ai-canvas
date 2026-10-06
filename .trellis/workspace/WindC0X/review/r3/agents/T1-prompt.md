你是独立代码评审员。任务：统一任务面批（主面①）**核心机制**评审（T1）。只读，不改代码。

先读 /tmp/review-r3/shared-context.md（★ 环境禁令必须遵守）。

## 你的批次（T1：主面① 核心机制）
范围：`git diff f180edf5..7db3fa10`，读代码 `git -C /mnt/f/CODE/Project/oac-wt-review show 7db3fa10:<path>`。
动态验证：`/home/windc0x/oac-ext4/oac-wt-baseline`（隔离树，禁 oac-wt-test / 禁 /mnt/f）。

### T1 文件清单
1. `web/src/lib/canvas/headless-tidy.ts`（新增 62）—— **重点①：只投影 position 是否真不触碰 metadata/任务态**
2. `web/src/lib/canvas/workspace-type.ts`（新增 19）
3. `web/src/lib/task-face-download.ts`（新增 90）
4. `web/src/stores/canvas/use-canvas-store.ts`（+17）
5. `web/src/types/canvas.ts`（+9）
6. `backend/internal/canvas/user_data_page.go`（+8）—— **重点③：workspaceType 后端侧**
7. `backend/internal/canvas/user_data_page_workspace_test.go`（新增 49，测试）
8. `web/src/services/api/user-data.ts`（+3）
9. `web/src/pages/canvas/use-canvas-project-lifecycle.ts`（+21）

### 重点核查
**① headless-tidy 只投影 position**：逐字段读投影逻辑（读哪里、写哪里）；构造反例（源对象 metadata 带任务态字段时投影后是否被触碰/丢失）；检查浅拷贝导致的 metadata 间接修改。动态验证：写临时测试到 /tmp，构造带 metadata 的 headless 项目跑投影，断言 metadata 逐字段不变。

**③ workspaceType 过滤链（后端→前端端到端）**：
- 后端如何写入/透出？空值语义（零迁移承诺）？
- 前端 `filterVisibleCanvasProjects` 在哪、判据是什么？端到端是否真的接上（**关键：后端透出的字段与前端消费的数据源是否是同一条链**）
- **边界**：workspaceType 缺失/非法值/大小写；headless 项目在哪些面被过滤（列表/任务面/画布路由）？有无面漏过滤？

**⑤ 线索记录**：遇 UnifiedTaskFace 相关代码记录线索（完整评审归 T2）。

### 动态验证
`cd /home/windc0x/oac-ext4/oac-wt-baseline/web && bun test test/task-face-workspace-type.test.ts`
`cd /home/windc0x/oac-ext4/oac-wt-baseline/backend && go build -buildvcs=false ./... && go test ./internal/canvas/ -run Workspace -v`

## 输出
严格按共享上下文格式。写到 `/tmp/review-r3/agents/T1.md`。
最后一行：DONE T1 <发现数>。
