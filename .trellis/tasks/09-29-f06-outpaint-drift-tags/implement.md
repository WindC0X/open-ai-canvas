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
