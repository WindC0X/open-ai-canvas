# R3 评审 · 共享上下文（重启后重建）

## 范围（控制线令）

### 主面① 统一任务面批（branch-only）
- 分支 `feat/w5-unified-task-face`，**R3 锚点 = 7db3fa10**（代码面与 156ce089 一致 + docs-only +18 行）
- merge-base with f180edf5 = f180edf5
- **diff 范围**：`git diff f180edf5..7db3fa10`
- 17 文件：unified-task-face.tsx（新）/ linear-flow-runner 挂载 / canvas-active-task-panel 交付步 / headless-tidy / workspace-type / task-face-download / project.tsx / use-canvas-project-lifecycle / user-data.ts / store / types + 3 测试 + backend user_data_page.go
- 读法：`git -C /mnt/f/CODE/Project/oac-wt-review show 7db3fa10:<path>`

### 主面② 缝隙池批（已合入 main）
- `d6b6a952`（parent f180edf5）→ merge `65c51953` → 现在在 main
- **diff 范围**：`git show d6b6a952`
- 7 文件：creation-workspace-empty 接线 + registry-asset source 字段 + registry-adapters + 2 测试 + 2 docs
- 读法：`git -C /mnt/f/CODE/Project/oac-wt-review show d6b6a952:<path>` 或 `show c94d14e7:<path>`

### 副面③ 遗留六条
- R1 四条未复核：三段式 id 零报警 / assetKind 落枚举纪律空转 / 12-12 legacy prompt 不同源 / signal 参数声明不符
- R2 两条动态验证：P2-3 角色卡门控可达性 / P2-6 analytics 时间窗

## ★★ 环境（控制线纠正令 — 必须遵守）
- 评审仓（只读）：`/mnt/f/CODE/Project/oac-wt-review`
- **动态验证树（唯一允许）**：`/home/windc0x/oac-ext4/oac-wt-baseline`
  - 已 checkout 到 **7db3fa10**（依赖零变更，node_modules 在位）
  - 前端：`cd /home/windc0x/oac-ext4/oac-wt-baseline/web && bun test <file>`
  - 后端：`cd /home/windc0x/oac-ext4/oac-wt-baseline/backend && go build -buildvcs=false ./...`
- **★ 禁止 `/home/windc0x/oac-ext4/oac-wt-test`**：那是测试线活跃 twin，HEAD 会随其轮次切换 → 静默测到错代码
- **★ 禁止在 `/mnt/f` 下跑 bun test / go test**：9p 挂载，进程卡 D 状态（p9_client_rpc）

## 主面① 重点（控制线指定）
1. **headless-tidy 的「只投影 position」**：是否真不触碰 metadata/任务态？逐字段核对
2. **守卫测试的证伪性**：`task-face-independence.test.ts` 是否真能证伪（注入缺陷会红吗）
3. **workspaceType 过滤链**：后端 `user_data_page.go` → 前端 `filterVisibleCanvasProjects` 端到端是否通
4. **UnifiedTaskFace 订阅契约**：无 canvas-store import 是否真成立

## 主面② 重点（控制线指定）
1. **§3.4 source 字段注入判据**：「8 条判据 = inspiration.source 存在」——语义是否稳固（误标/漏标边界）
2. **UI 判据等价性**：接线后 UI 是否真的逐字不变

## 惯例
- 只读 / P0-P3 / 附证据（文件:行）/ 核验层对抗（含证伪）/ 机制级去重
- 产出写 `/tmp/review-r3/agents/<你的批次>.md`（不要写别人的文件）
- 分级：P0 数据丢失/安全/崩溃；P1 功能缺陷/错误处理缺失/测试盲区致真实风险；P2 可维护性/边界/性能；P3 风格
- 每条格式：
### [P?] 标题
- 文件：<path>:<line>
- 证据：<具体代码或运行结果>
- 影响：<后果>
- 建议：<最小修复方向>
无发现文件列 [ok] <path>。最后统计（P0/P1/P2/P3 计数）。

## 教训家族（重点猎捕）
1. 假命中三族：弱 includes 断言 / 注释引用旧代码 / 字段名 grep 计数
2. 测试镜像实现盲区
3. 跨枝比较必须用当前拓扑（★主面① branch-only，勿与 main 混淆）
4. 验证形态必须匹配被验证对象
5. 覆盖边界与类型声明边界不一致
6. 汇总需机制级去重
