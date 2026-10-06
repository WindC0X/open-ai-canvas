你是独立代码评审员。任务：统一任务面批（主面①）**组件与测试质量**评审（T2）。只读，不改代码。

先读 /tmp/review-r3/shared-context.md（★ 环境禁令必须遵守）。

## 你的批次（T2：UnifiedTaskFace + 守卫测试 + 挂载）
范围：`git diff f180edf5..7db3fa10`，读代码 `git -C /mnt/f/CODE/Project/oac-wt-review show 7db3fa10:<path>`。

### T2 文件清单
1. `web/src/components/task/unified-task-face.tsx`（新增 313）—— **重点④：订阅契约（无 canvas-store import）**
2. `web/src/components/canvas/canvas-active-task-panel.tsx`（+86）—— 交付步
3. `web/src/components/create/linear-flow-runner.tsx`（+31）
4. `web/src/pages/canvas/project.tsx`（+31）
5. `web/src/pages/canvas/index.tsx`（+8）
6. `web/test/task-face-independence.test.ts`（新增 97，测试）—— **重点②：守卫测试的证伪性**
7. `web/test/task-face-workspace-type.test.ts`（新增 164，测试）
8. `web/test/linear-flow-runner.test.ts`（+22，测试）

### 重点核查
**④ 订阅契约**：unified-task-face.tsx 是否 import canvas-store / canvas 相关模块？数据源是什么？订阅契约清晰吗？反例：间接依赖（工具函数/类型 import/store hook）能绕过守卫吗？

**② 守卫测试的证伪性（重点，必须动手）**：
- 读 task-face-independence.test.ts：断言什么？源码文本断言还是行为断言？
- **动手证伪**：把护栏与目标文件复制到 /tmp 副本，注入缺陷（例：加 `import { useCanvasStore } from "@/stores/canvas/use-canvas-store"`），看测试是否变红。**若不变红 = 假绿**。
- 覆盖边界：检查了哪些文件/import 形态？side-effect import / 相对路径 / 动态 import / `export ... from` 能绕过吗？扫描是否递归？

**挂载正确性**：linear-flow-runner 的挂载 props 完整吗？条件渲染判据？canvas-active-task-panel 的交付步状态机正确吗？

### 动态验证
`cd /home/windc0x/oac-ext4/oac-wt-baseline/web && bun test test/task-face-independence.test.ts test/task-face-workspace-type.test.ts test/linear-flow-runner.test.ts`

## 输出
严格按共享上下文格式。写到 `/tmp/review-r3/agents/T2.md`。
最后一行：DONE T2 <发现数>。
