# merge-v1.6.1 任务书（A线执行）

> 控制线拟，2026-09-30。执行窗口：W4 初（10-05 前后；用户已拍板 v1.6.1 先于 F-01）。
> 侦察底账：`merge-v161-recon.md`（必读，落位操作全在那份的 §三 落位表）。本任务书只定顺序、门禁、纪律。

## 一、范围

上游 rider 2：`e0a2697c..eb13f736`（12 commits / 227 files）。merge-base 以实际 fetch 为准（侦察时点 origin/main = eb13f736 无新增；若 W4 开工时上游又进新提交，STOP 报告待控制线更新 recon）。

## 二、执行顺序

1. **开枝**：`oac-wt-merge-v161` worktree，基线 = 本地 main（31a93835 系）。
2. **merge origin/main**：按 recon §三 落位表逐域处置（7 域：F1 panel 根部5处原位+渲染段3处落 parts / F2 AgentUndoBar / F4 project / F5 node-content→media-content / G2 runtime / E4 model-capabilities 原位 / card06 整文件迁 services 新家）。
3. **守卫锚点迁移**（recon §五）：12+ 守卫测试断言锚在被拆文件代码段的，随落位同步迁移；产出**锚点迁移表**（测试名 → 旧锚 → 新锚）随报告交付。
4. **PATCH-MAP 登记**：F 系列新增 merge-v1.6.1 处置段（card06 域新路径、F5 loop 锚点新文件名等）。
5. **门禁**（见 §三）全绿 → 单 commit 链 → STOP 报告。

## 三、门禁（v1.6.0 全套 + 1 新增）

1. `tsc --noEmit` / `eslint` / `build`（web/ 内）
2. `bun test` 全量——**必须在 web/ 目录内跑**（目录敏感：仓根跑静默丢 24 条）
3. go 全量（28 packages 0 FAIL；internal/app 历史带 748-1458s， drvfs 波动属正常）
4. e2e 五跑门（S1-S7）+ S4 SPECIAL 保留
5. VRT：Agent 面板面**必采**（拆分敏感面），其余按 drift 触发
6. **新增：守卫锚点迁移表交付**（§二.3）
7. 聚焦守卫：agent-panel-overlay-zorder / agent-send-prefill-command / canvas-media-* / canvas-model-policy 等 recon §五 清单

## 四、红线（STOP 条件）

- 上游在开工窗口内又进新提交（recon 失效）
- 落位表任一域发现 fork 增量与上游新架构**语义冲突**（非纯位置迁移）——尤其 G2 双口径字段与上游并发控制新逻辑的交互
- card06 水位门在新家 `services/user-data-sync.ts` 的访问器行为异常（G5 校准分支语义待复检——recon 已标）
- 守卫迁移中发现断言依赖的 fork 行为被上游拆分**静默改变**

## 五、报告格式（照 v1.6.0 惯例）

拓扑链 / 落位表逐域处置实录 / 锚点迁移表 / 门禁全量结果（原始输出截段）/ 未解释项清单。单 commit 不 push，STOP-report 不自修产品码。

## 六、验收（控制线）

控制线独立复跑关键门（不信任报告）：H1 系抽查（canvas_apply_ops schema）、card06 域源码核对、守卫迁移表逐条验证、bun test 数值对账。通过后：用户真机抽验（Agent 面板拆分面）→ push → 测试线整轮（S1 迁移冒烟 + S2 五跑 + VRT 三面）→ F-01 开枝。
