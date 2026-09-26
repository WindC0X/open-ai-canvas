# F-06 二期：扩图硬贴回保真合成

> 控制线任务书 2026-09-27。基线 = `5a567238`（分支 merge-v1.5.8，认证基准）；本枝 `feat/ecom-f06-hardblend` @ oac-wt-f06-hb。

## Goal

扩散结果不再整图替换——按 mask 裁剪回贴原图像素域（硬贴回），修复主体漂移与纹理延展变形。技术路线：diffusers `padding_mask_crop` / `apply_overlay` 语义——生成后把非生成区（原图区）的原图像素硬贴回结果图，非生成区像素零改动。

## Requirements

### R1 后端扩图管线改造

- 预处理：生成所需的几何换算（原图区在提交画布坐标系中的映射）。
- 后处理：结果图落资源前做贴回——按几何把原图像素写回非生成区，生成区保留模型输出。
- 坐标系换算：覆盖 target 模式（锁定档位两轴 k）与 free 模式（等比 scale）两条合成路径。
- 双通道覆盖：maskSupported=true（mask 通道）与 false（指令通道）都受益（F-06.md 行 43「双通道通用必做步」）。

### R2 共存策略（待裁决）

贴回 = 默认 or 可配？——给建议后报裁决，按裁决实现。

### R3 质量验收（红线框架）

- 主体漂移归零（关键点对位；非生成区像素级不变为验收口径）。
- 纹理连续性（生成区目视）。
- 非生成区像素级不变（SSIM 只当护栏不当验收——红线）。
- 前后同图对照：两缺陷各一组"修复前/修复后"证据。

### R4 界面纪律

- 前端无新 UI；如需进度/模式提示文案，最小化。

## Constraints（红线）

- 计费走现有 F-06 链不改费率。
- Fill-dev NC 许可不碰（内部评估限定）。
- 不碰层 2 超分域。
- 不 push。
- 不碰冻结分支与 flora/轻量枝文件域。
- 规格冲突/不明 → 报控制线，不自行取舍。

## Gates（门）

- go full suite（`-timeout 30m`，勿用默认 10m）。
- web focused。
- 扩图链 focused。
- 真机前后同图对照（两缺陷各一组前后证据）。

## Acceptance Criteria

- [ ] AC1：非生成区像素级不变——修复后扩图结果的"原图区"与原始原图（按设计几何映射）逐像素一致（羽化过渡带除外，2–4px）。
- [ ] AC2：主体漂移归零——关键点对位验证（原图区几何/内容零改动）。
- [ ] AC3：纹理连续性——生成区目视无明显断裂（对照修复前基线）。
- [ ] AC4：双通道覆盖（mask 通道 + 指令通道）均生效。
- [ ] AC5：共存策略按裁决实现；关闭贴回时行为与现状一致（可回退）。
- [ ] AC6：门全绿（go full suite / web focused / 扩图链 focused / 真机对照证据）。
- [ ] AC7：交付物齐全：管线改造 + 前后对照证据 + 共存策略建议（已报）/裁决落地 + 台账记行。

## 首日复验（2026-09-27，合并后基线 5a567238）

### 环境

- 新 worktree `oac-wt-f06-hb` @ 5a567238 → 分支 `feat/ecom-f06-hardblend`（旧 oac-wt-f06 保留勿动）。
- 端口：vite :3001 / backend :8181（避开 :3000/:3010/:3400/:8482/:8483；cookie 隔离名 `open_ai_canvas_session_f06`）。
- 数据：旧 B 线库复制到 `.local/f06-hb-debug`（账号 f06test / 渠道 ddcat 保留；ddcat 实调可用 ✓）。
- 依赖：bun install 1443 包；vite/后端/代理三探 200。

### 复验结论：两缺陷稳定复现（3/3 单）

**复验单**（金毛幼犬节点 `upload-1789735413980-lnz06`，GPT Image 2 · f06-ddcat，原图比例 + AUTO，1 张/单）：

| 运行 | 任务 ID | 提交画幅 | 结果图 | 原图区显著差异（>24） | 备注 |
| --- | --- | --- | --- | --- | --- |
| run1 | `b51f860e6587` | 1536×1024（snap 1K 档） | 1536×1024 | **76.2%**（mean 50.0） | — |
| run2 | `b453eedaaa07` | 同上 | 1536×1024 | **74.6%**（mean 48.4） | 结果边缘暗角/羽化糊（生成区质量劣化实例） |
| run3 | `ab783bdb90e7` | 同上 | 1536×1024 | **75.9%**（mean 50.0） | — |

- **缺陷 1（主体漂移）实锤**：非生成区（mask 不透明区 1356×854 @ (90,85)）约 75% 像素被模型重绘（对照原图 resize 同几何）；DIFF 热图遍布全身轮廓/木纹/花瓣。
- **缺陷 2（纹理延展变形）实锤**：生成区质量不稳定——run2 出现边缘暗角羽化糊；run1/3 扩展区（水壶/栅栏/花园）虽连贯但细节与原图有可见差异。
- 几何备注：三单均"原图比例 + AUTO → snap 1536×1024"，上游（ddcat）**忠实返回同尺寸**；target 模式两轴 k 非等比（kx 0.883 / ky 0.834，吸收框-档比例差）。

### 证据（`.local/hb-evidence/`）

- `before-*.png`：三单结果图原件。
- `subject-drift.png`：原图区三联对比（原图/结果/DIFF×4 热图）。
- `three-runs-summary.png`：原图 + 三单结果汇总。
- `ext-strip-*.png`：三单扩展区条带特写。
- `run2-pad.jpg` / `run2-mask.png`：提交物（白底 pad 图 + 透明区 mask）。
- 数据：三单 drift 统计（mean/P95/显著差异占比）；任务/资源 ID 见上表与库记录（tasks/resources 表）。

### 基线 focused（合并后）

- `canvas-outpaint-geometry` 27 pass / 0 fail。
- `canvas-image-batch-retry` 12 pass / 0 fail。
- `agent-media-approval` + `creative-agent-state` 18 pass / 0 fail。
- **扩图 focused 合计 52 pass / 0 fail**（`canvas-node-content` 角标无独立测试文件，代码在 content/task-sync/media-tools 三处，随 web 全量门覆盖）。

## Notes

- 必读文档：`impl/F-06.md`（行 43 保真后合成、行 86/89 工程要点）、`MASTER-PLAN.md` §4.2（行 37/68：硬贴回→W4 修缮期；行 235：双通道通用必做步）、outpaint 调研 12 文件（工程要点 C：padding_mask_crop/apply_overlay、羽化 2–4px）。
- 合并修缮触碰点（勿踩坏）：canvas-node-content.tsx L884 起尺寸偏差角标；cloud_agent_media.go CallHash @L637；image-batch-retry producedModel 链；getResourceAccess 资源访问契约。
