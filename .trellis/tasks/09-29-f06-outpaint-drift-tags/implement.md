# 执行清单 · 扩图画幅偏差处置 + 模型行标签布局

> 门禁：go 全量 0 fail（`-timeout 25m`）；web focused + tsc + build；全量 15 红逐名=冻结基线。双提交不 push。

## Step 1（提交1 `b481f532` · 后端）：贴回阈值对齐角标 ✓

- [x] `task_outpaint_hardblend.go`：常量 0.08→0.02 + 三处注释（角标亮=不贴回 / ②a 修订）
- [x] 测试：1.06× 由"允许"改"拒绝"；新增 `TestHardBlendOutpaintImageDriftBoundary`（2043×1600 drift≈0.0213 跳过 / 2039×1600 drift≈0.0193 贴回）
- [x] focused `-run 'HardBlend|Outpaint'` 23/23 全绿

## Step 2（提交2 `b20fbbe8` · 前端）：偏差呈现 + 标签布局 ✓

- [x] `canvas-generation-task-sync.ts`：计算前移 + `mismatchRefit`（!userResized/!freeResize）+ 注释
- [x] `use-canvas-media-tools.ts`：直连写回同口径
- [x] `model-picker.tsx`：tags slot 包裹；`model-picker.css`：slot `min-height:27px` + flex 列（防 margin 折叠逃逸 +6px，实测修复）
- [x] 新测试 `outpaint-drift-node-size.test.ts` 3/3（周边 39/39）
- [x] tsc rc=0 / eslint rc=0

## Step 3（收口）✓

- [x] `PATCH-MAP.md` 冲突预判段（C1-C4；C1 高=model-picker 标签 UI 与上游同面）
- [x] twin 真机验证（headless，:3001 本枝 vite ↔ :8482 twin 后端）
- [x] go 全量（`-timeout 25m`，RC=0，0 FAIL，app 1021.469s）；web 全量 **2287 pass / 15 fail（15/15 逐名=冻结基线）**；build ✓ 1m33s
- [x] 卡记录 + 报 HEAD（不 push）

## 执行记录（2026-09-29）

**修项3 布局（before/after 实证，twin a6api 渠道 flyout）**

- BEFORE :3010（批树旧码）：三行 53.6 / 80.6 / 80.6（混排），logo 圆心 26.8 / 40.3 / 40.3（漂移 13.5px）。
- AFTER :3001（本枝）：三行全 80.6（统一），logo 圆心全 40.3、chips 全 17.8（零漂移）；flyout 总高 237→264（+27px 恰为一条标签行占位）。
- 方向裁定：**选 a（标签行 min-height 全行统一 3 行高）**——验收两条件（重心不漂移+行高不跳变）唯 a 全满足；上游"三行固定结构"与 a 同构；b 仍保留行高落差。
- 证据：`.local/f06drift-evidence/`（flyout-3010/3001.json+png、crop 对照、compare.png）。
- twin 数据整备（验收矩阵用）：a6api nano 补入「稍微不稳定」、sunburst 补入「限时」（与用户表述一致；原「低价香蕉」保留）。

**修项2 偏差呈现（live 实跑实证）**

- :3001 直连路径实跑（a6api nano，$0.005 档）：占位 0.7865 → 完成瞬间节点 327.6×438.7 = **ratio 0.7467 = 实返图(896×1200)比例**；DB 真值 420×562.5（|size_ratio−image_ratio| = 0.0）；`outpaintSizeMismatch = {submitted:'1002x1274', actual:'896x1200'}` 角标渲染于节点。
- 对照：原「错位节点」保持旧行为（0.7867 帧 + object-contain 两侧空缺）——new/old 同位对照留存于 twin 画布供复验。
- 备注：twin 后端为批树旧码（修项1 的跳过行为不在其上），本轮图片内容侧的旧贴回不可证；跳过+重算的完整联合行为待合并后复验。
- 重试链观测：retry 重建帧按枚举比（config.size 空 → 无 mismatch 判定、节点保帧）——不在本单范围，记录备查。

**修项1 阈值**

- 单测边界（0.0213 跳 / 0.0193 贴）+ 1.06× 拒；live 不可在 twin 验证（旧后端），合并后复验。

**环境/现场**

- twin 画布节点：原 5 + 新增 `R9jVqv2xXHSHvZNSvtLGB`（修复后实证节点，保留）；两次失败尝试节点已删（网络 EOF / ddcat key 失效，均非本改动）。
- 验证会话：twin 库补插 e2e-tester 会话（7 天有效，token 存 /tmp/f06drift-cookie.txt 不入库）；本枝 :3001 vite 验证后释放。
- 证据总目录：`.local/f06drift-evidence/`（含 livegen/retry/crop/compare）。

## 回滚点

- 提交1 / 提交2 各自独立 revert。

---

# 修项3b 执行记录（2026-09-29 微令 · 顶部锚定混排）

## 改动（提交1 `fix(canvas)`）

- `model-picker.tsx`：撤 3a 占位槽（`canvas-model-picker-tags-slot` 元素删除，`ModelTags` 裸渲染）；ModelLabel 根 `items-center` → `items-start`（行内容顶部锚定）。
- `model-picker.css`：
  - 删 `.canvas-model-picker-tags-slot` 规则（3a 等高占位）。
  - `option-body`（两处重复 align-items 收敛为一）与 `option > span:first-child` 旧结构规则均改 `align-items: flex-start`。
  - unlayered 段新增锚定补偿（TOP 位压过分层旧规）：`.canvas-model-picker-logo { margin-top: calc(var(--fs-body) * 0.7 - 12px) }`（24px logo 居中 19.6px 标题行）；`.canvas-model-picker-option-check { align-self: flex-start; margin-top: calc(var(--fs-body) * 0.7 - 7px) }`（14px ✓ 居中标题行）。补偿按 `--fs-body × 1.4` 推导，字号变时自适应。
- `model-picker-style-source.test.ts` 追加守卫：无 slot（tsx+css）、根级 items-start、option-body 无 center、✓/logo 锚顶补偿存在、hover transition 仅 background-color 且无 height/padding（果冻防线）。drift 相关测试未动。

## 验证（:3002 本枝 vite 热更 ↔ :8484 控制线验证栈，会话复用 3a 签发）

- **a6api flyout（工具栏选择器，与 3a 对照同表面）**：行高混排回归——GPT Image 2.5（无标签）53.6 紧凑两行 / nano（双标签）80.6 / sunburst（单标签）80.6；**logo 圆心全 17.8、chips 圆心全 17.8、titleTop 全 8**（跨行锚顶零漂移）。
- **✓ 锚顶**（扩图浮层选中行实测）：check top = titleTop + 2.8、cy 20 = logoCy 20 = chipsCy 20（恰为标题行几何中心）。
- **ddcat 全无标签 flyout**：8 行全 53.6 紧凑两行，锚定值同上。
- 目视复核：a6api 混排三行 + ddcat 八行截图（`.local/f06drift-evidence/f063b-*.png`）。
- 守卫测试 7/7（style-source 全文件）；tsc rc=0；eslint rc=0（css 文件不在 eslint 配置内，warning 无害）。
- 备注：选中行 `min-height: 58px` 为既有规则（当前模型行略高于未选中 53.6，锚定不受影响——补偿挂标题行不挂行盒），3b 未动。
- 证据：`.local/f06drift-evidence/f063b-measure.json`、`f063b-measure2.json`、`f063b-flyout-*.png`、`f063b-toolbar-flyout-*.png`。

## 门禁与提交

- web 全量 + build 见下（收口节）；go 侧无改动（3b 纯前端 CSS/TSX）。
- 提交1 `fix(canvas)`：tsx + css + 守卫测试；提交2 `chore(trellis)`：本卡 prd 附2（微令原文）+ 本记录 + PATCH-MAP C1 同步（"同构上游三行固定"→"fork 顶部锚定混排"）。双提交不 push。

## 回滚点

- revert 提交1 即回 3a 等高占位形态（slot 规则随提交恢复）。
