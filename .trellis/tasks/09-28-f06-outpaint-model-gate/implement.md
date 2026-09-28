# 扩图档位门控 执行计划

> 工作区 hb（feat/ecom-f06-hardblend）。Go 工具链：`~/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.26.8.linux-amd64/bin/go`（GOTOOLCHAIN=local）。
> 验证命令：后端 `cd backend && GOTOOLCHAIN=local <toolchain>/go test ./internal/app/ -run 'OutpaintTier'`；前端 `cd web && bun test outpaint-model-tier && bunx tsc --noEmit`。

## Step 1：后端字段与播种（提交1 `feat(backend): 扩图档位 - capability 新增 outpaintTier 与默认播种`）

- [x] 1.1 `model_capability.go`：OutpaintTier 字段 + 三值常量 + `applyOutpaintTierSeed`（Default 与 Normalize 两处播种）+ 校验值域
- [x] 1.2 `model_capability_outpaint_test.go`：播种 / 显式保留 / 非法拒绝 用例
- [x] 1.3 focused go test 绿（`-run 'Capability|Channel|Normalize|OutpaintTier'` 53.7s ok；OutpaintTier 2 组 -v 实跑过）

## Step 2：前端过滤链（提交2 `feat(canvas): 扩图模型白名单硬过滤`）

- [x] 2.1 `model-capabilities.ts`：`ImageOutpaintTier` 类型 + 播种 + `isOutpaintEligible`
- [x] 2.2 `model-picker.tsx`：`filterModel` prop（缺省零行为变化）
- [x] 2.3 `model-capability-editor.tsx`：扩图档位控件（references 区 + 全量区）
- [x] 2.4 overlay：候选过滤 / 默认选择 / canExecute / 空态文案 / 注释更新
- [x] 2.5 `use-canvas-media-tools.ts`：outpaintImageNode 兜底
- [x] 2.6 `web/test/outpaint-model-tier.test.ts` + 专项 3/3 + tsc 绿 + eslint 绿
- 回滚点：revert 本提交 = 恢复放开语义

## Step 3：接口级验证

- [x] 3.1 构建 `/tmp/f06hb-server-gate` 并重启 :8181（旧 pid 2161440 已杀；health ready=200）
- [x] 3.2 断言：ddcat `nano-banana2`、a6api 与 a6api-4k `nano-banana-2` → `outpaintTier=recommended`；2.5 / 2.5-4k / sunburst / grok → 无档位
- [ ] 3.3（可选）headless：开扩图确认模型槽只列 nano —— 留下一轮 / 用户真机承接

## Step 4：文档 + 收口（提交3 `docs(canvas): ...`、提交4 `chore(trellis): ...`）

- [x] 4.1 `features.mdx` / `pending-test.mdx`
- [x] 4.2 任务卡记录（本文件）
- [x] 4.3 全量 `bun test` 对照：改后 2279 pass / 18 fail vs stash 基线 2277 pass / 17 fail——差异仅为 5s 超时守卫类并发抖动（`http-ownership` / `ui-kit-retirement` 隔离复跑 `--timeout 20000` 全过），零新增回归；新增专项 3 例全绿。

## 执行记录（2026-09-28）

- 四问裁定：白名单硬过滤 / 渠道能力配置 / 仅 nano 推荐（2.5、sunburst 不升档，等样本集验收）/ 只做画布槽。
- 接口级证据（重启后 `/api/channels/system`，cookie = f06test 会话）：
  ```
  CHANNEL_000005 f06-ddcat | nano-banana2   | outpaintTier = 'recommended'
  CHANNEL_000009 a6api     | nano-banana-2  | outpaintTier = 'recommended'
  CHANNEL_000010 a6api-4k  | nano-banana-2  | outpaintTier = 'recommended'
  （gpt-image-2 / gpt-image-2.5 / 2.5-4k / sunburst / grok-imagine-image-2.0 = 无档位）
  ```
- 前端产物探针（:3001 dev，未重启 vite 即已生效）：`eligibleModels`×8 / `isOutpaintEligible`×1 / `outpaintTier`×7 / `filterModel`×3。
- 已知边界：扩图槽为空文案「当前没有支持扩图的模型」已实现、待真机复核；Agent 链本期未限制（另立项）；升档运营动作由渠道编辑器操作、随保存生效。
- 后续供货：火山 AI MediaKit / veImageX / 百炼等商用扩图 API 接入后，按同一流程（配渠道模型 → 标「推荐/可用」或加入内置播种名单）进入白名单。

## Review Gate

- Step 1 后：focused + channel/capability 测试通过 ✓
- Step 2 后：tsc + eslint + 专项测试 ✓
- Step 3 后：接口证据留档 ✓；真机终验由用户承接（模型槽显示 / 自动改选 / 空态文案 / 编辑器往返）

## 用户真机验收反馈修复（2026-09-28 第二轮，提交见 git log）

- [x] U1 用户视角档位不可分辨（截图实锤：nano 与临时升档模型在槽内并列、行上无任何档位标记）：模型槽行内新增档位徽章——`outpaintTierBadge`（推荐=前景提亮 accent / 可用=灰底 muted，悬停 title 注明“未验证扩图效果”），ModelPicker 新增 `badgeForModel` 可选 prop；候选默认选中改推荐优先（`outpaintTierRank` 排序，同档保持配置顺序）。
- [x] U2 空白名单空态文案错误（截图实锤：显示通用「暂无支持当前输入的生图模型」）：ModelPicker 新增 `emptyLabel` prop，扩图槽传「当前没有支持扩图的模型」；参数条触发器 placeholder 与执行按钮 aria 同步改用同一常量（NO_ELIGIBLE_OUTPAINT_MESSAGE 单一来源，触发器/按钮/菜单空态三处复用）。
- [x] 验证（headless 真实鼠标链路，证据 .local/f06hb-evidence-after/tier-gate/）：
  - A1 ddcat flyout：nano 行徽章=推荐 ✓；A2 a6api-4k flyout：nano=推荐 + GPT Image 2.5=可用（临时升档造样本）双徽章同列 ✓；
  - B1 空白名单：触发器 aria=「当前没有支持扩图的模型」、执行按钮 disabled 同 aria ✓；B2 菜单空态同文案 ✓；
  - 脚本 finally 恢复：nano×3=recommended、2.5=未认证（键移除）；测试库现场复核通过。
- 回归：专项 5/5（新增 2 例）；tsc/eslint 双绿；全量 2284 pass / 15 fail——15 项 = stash 基线 17 项中的确定性集合（本轮无超时抖动），零新增回归。
- 备注：a6api / a6api-4k 的 sunburst 保持用户所设「未认证」；「可用」徽章复现方式 = 渠道管理把任一模型改「可用」。

## 控制线裁决（2026-09-28 验收收口）

- 扩图档位 4 项真机**全部正常，验收通过** ✓。
- 本枝全量口径统一为「15 红逐名 = 冻结基线」；红基线对账与轻量枝超时 rider 移植（4db8b876）详见 `09-27-f06-hardblend/implement.md` 封版节。
