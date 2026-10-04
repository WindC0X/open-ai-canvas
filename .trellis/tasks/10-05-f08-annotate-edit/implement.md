# Implement · F-08 圈选改图

> 需求见 `prd.md`，设计见 `design.md`。执行顺序 = C1 → C2 → C3（咽喉纪律：C2 是唯一咽喉 commit）。

## 0. 开工前状态（2026-10-05 开线实测）

| 项 | 实测 |
|---|---|
| 基线 | 本枝已快进到 main @ b858bd1d（O-03 超分 + F-02 场景图全在基线） |
| lockfile | 零变更（`git diff HEAD main -- web/bun.lock` 空）→ bun install 无 STOP 风险，已执行完成 |
| 咽喉占用 | 三咽喉（use-canvas-media-tools.ts / capability-entries.ts / canvas-image-toolbar-tools.tsx）**当前无占用**——最近提交 a17cc62c（已合入 main），全 worktree 零未提交改动 |
| F-02 让位 | F-02 主体已合入（53af70b2），残余分支 `main..feat/ecom-f02-scene` 为空 → 让位信号已解除 |

## 1. 执行切片

### C1 标注交互与几何（纯前端零咽喉，立即开工）

| # | 文件 | 动作 |
|---|---|---|
| 1 | `web/src/lib/canvas/annotate-edit-geometry.ts` | 新建：纯函数（归一化↔像素、联合 bounds+padding、pixelRatio、钳制判定） |
| 2 | `web/src/components/canvas/canvas-node-annotate-edit-dialog.tsx` | 新建：弹窗（region/arrow 绘制 + note 输入 + 列表 + 提交校验 + 关闭确认） |
| 3 | `web/test/annotate-edit-geometry.test.ts` | 新建：纯函数测试（bun:test） |

验证：`cd web && bun test test/annotate-edit-geometry.test.ts`；`bunx tsc --noEmit`。

### C2 执行链合槽（唯一咽喉 commit）

**开工前**：`git log --oneline -3 -- web/src/pages/canvas/use-canvas-media-tools.ts` 再报备一次占用。

| # | 文件 | 动作 |
|---|---|---|
| 1 | `web/src/lib/canvas/annotate-edit-prompt.ts` | 新建：提示词组装（Cowart 语义重写，禁转写化石） |
| 2 | `web/src/lib/canvas/annotate-edit-export.ts` | 新建：canvas 2D 合成导出 |
| 3 | `web/src/pages/canvas/use-canvas-media-tools.ts` | **咽喉**：`annotateEditImageNode`（maskEditImageNode 骨架同构） |
| 4 | `web/test/annotate-edit-prompt.test.ts` | 新建：提示词组装测试 |

### C3 注册表+入口+渠道实测门

| # | 文件 | 动作 |
|---|---|---|
| 1 | `web/src/lib/canvas/capability-entries.ts` | **咽喉**：加 `image.annotateEdit` 条目（single_image） |
| 2 | `web/src/components/canvas/canvas-image-toolbar-tools.tsx` | **咽喉**：入口条目 + handlers |
| 3 | `web/src/components/canvas/canvas-node-toolbar.tsx` | 透传 `onAnnotateEdit` |
| 4 | `web/src/pages/canvas/project.tsx` | state + 调用 + 挂接 |
| 5 | `web/src/pages/canvas/canvas-project-media-dialogs.tsx` | 弹窗挂接 |
| 6 | `web/test/annotate-edit-entry.test.ts` | 新建：条目谓词测试 |
| 7 | 渠道实测门 | nano-banana-2 标注截图输入 3-5 样本；**兜底路径（标注转 mask 降级）真实验证一次** |
| 8 | `docs/content/docs/getting-started/features.mdx` | 文档同步（F-08 条目） |

## 2. 验收清单（对照 prd.md）

- [ ] 出口可达截图（工具条入口 → 弹窗 → 圈选+文字 → 新图落画布）
- [ ] 不烙图双证（提示词纪律 + 实测）
- [ ] 注册表条目 + 谓词生效
- [ ] 兜底路径真实验证
- [ ] 关闭确认
- [ ] 尺寸钳制
- [ ] `bun test` 全量 + `tsc 0` + `lint 0`

## 3. 风险与 STOP 条件

- 渠道实测不通过且兜底也失败 → STOP 报控制线（能力不可用 vs 效果降级是两回事）
- 咽喉文件发现他人占用 → STOP 报控制线
- 门控条件（O-1）与既有 `maskSupported` 语义冲突无法自决 → 报控制线
- 压缩开关（砍箭头留矩形=3 人日）**启用前报备**

## 4. 交付形态

只交分支 `feat/ecom-f08-annotate` 不合入；W5 门后合。提交信息照 `<type>(<scope>): <业务模块> - <变更摘要>`。
