# F-08 圈选改图（W5 B线主槽）

> 正式任务书：`docs/artifacts/f08-annotate-task-book.md`（侦察草案+三裁定封版）。
> 控制线开线令 2026-10-05：C1 零咽喉立即开工；C2 等 F-02 让位信号（已解除，F-02 主体合入）；C3 收口含渠道实测门。
> 预算：4 人日中位；压缩开关（砍箭头留矩形=3 人日）启用前报备。

## Goal

图片节点获得「圈选改图」区域级编辑能力——弹窗内对图片圈选区域（矩形 region + 箭头 arrow）并附文字要求，提交后生成一张干净新图（替换/移除/修改区域内内容），标注本身不烙进结果图。对象擦除/元素编辑/局部重生成都是它的预设子集。

## Requirements

### 范围（三切片）

- **C1 标注交互与几何（纯前端零咽喉）**：`canvas-node-annotate-edit-dialog.tsx`（矩形 region + 箭头 arrow 两种，freehand 不做）+ 标注几何纯函数模块（归一化坐标↔像素、联合 bounds+32px padding、动态 pixelRatio 1x/1.5x/2x、尺寸钳制判定）+ 纯函数测试。
- **C2 执行链合槽（唯一咽喉 commit）**：`annotateEditImageNode` 进 `use-canvas-media-tools.ts`（maskEditImageNode 骨架同构）+ 提示词组装器（Cowart ANNOTATION_EDIT_PROMPT 汉化适配）+ 导出合成（canvas 2D 自绘：原图+标注层合成单张 dataUrl）+ 关闭确认。
- **C3 注册表+入口+渠道实测门**：`capability-entries.ts` 加 `image.annotateEdit` 条目（`single_image` 谓词）+ 图片工具条入口 + 弹窗挂接 + 渠道实测门（nano-banana-2 标注截图输入 3-5 样本，不烙图遵循度）+ 兜底路径（标注转 mask 降级）真实验证一次 + 文档同步。

### 硬约束（三裁定 + 纪律）

1. **谓词**：`contextRequirement: "single_image"`（控制线裁定——`hasSelection` 是多选工具条语义，圈选是弹窗内交互不上浮为入口谓词）。
2. **持久化**：v1 弹窗内临时态、关闭即弃；关闭前给一次性确认（「关闭将清除标注」）。
3. **导出钳制**：与 F-06 对齐为长边 4096 硬顶 + 总像素 1600 万双限；报错文案沿用 Cowart「将标注移近」范式中文适配。
4. **转写化石禁令**：og-canvas `buildCowartImageEditPrompt` 及其提示词文本不可复制（未经生成验证）；仅其数据模型形状与几何测试数学可参考。
5. **不烙图保证**：结果图无标注元素——提示词纪律 + 渠道实测双证。
6. **咽喉纪律**：三咽喉文件开工前 git log 报备占用状态（已报备：无占用）。

### 不做（红线）

- ❌ freehand 手绘标注（v1 只做 region + arrow）
- ❌ 标注持久化（v1 临时态；「可复编辑」为真需求时 W6+ 再升）
- ❌ F-11 文字层检测/翻译（骨架留位不实现）
- ❌ 不做 DOM 截图库（自绘 canvas 合成）
- ❌ 不引第三方标注库

## Acceptance Criteria

- [ ] **出口可达**：图片工具条「圈选改图」入口 → 弹窗 → 圈选+文字 → 新图落画布全链（反模式 #6 纪律：截图证据）
- [ ] **不烙图保证**：结果图无标注元素（提示词纪律 + 渠道实测双证）
- [ ] **注册表**：`image.annotateEdit` 条目可查 + 谓词生效（无图上下文入口不渲染）
- [ ] **兜底路径真实验证**：标注转 mask 降级走通一次（非纸面备胎）
- [ ] **关闭确认**：有标注时关闭弹窗给一次性确认
- [ ] **尺寸钳制**：超 4096 长边 / 1600 万像素时阻断并给出中文指引
- [ ] `cd web && bun test` 全量 + `bunx tsc --noEmit` 0 + `bun run lint` 0

## Notes

- 交付形态：只交分支不合入（`feat/ecom-f08-annotate`），W5 门后合。
- 证据记录：验收证据写入任务卡 `check.jsonl` 或 `docs/artifacts/f08-annotate-task-book.md` 验收节。
