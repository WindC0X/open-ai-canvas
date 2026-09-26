# O-03 执行计划

> 前置：先读 `design.md`；§1/§4/§5 的复核点结论到位后动手（评审门统一裁定）。提交信息建议 `feat(canvas): O-03 层1 直出引导 - 渠道预设组/交集逻辑/药丸预设态/画质档位（纯前端）`。

## Step 0：开枝首日必做——CapabilityConfig 覆盖度盘点
- [ ] 0.1 数据源就位（运行实例渠道目录优先；否则仓库静态件），逐模型采集：比例集 / 最大分辨率 / 质量档 / 承载形态。
- [ ] 0.2 产出 `research/capability-coverage-2026-09-27.md`（表 + 缺口单列）。
- [ ] 0.3 缺口清单交给控制线（终报或即时转）。

## Step 1：数据 + 纯函数（含测试）
- [ ] 1.1 扩展 `image-size-presets.ts`：预设数据（minPixels + desiredResolution）+ 档位 id 常量（控制线批）。
- [ ] 1.2 `planEcomPresetApplication` + `resolveTierPlan`（§2；价格一致性走既有口径）。
- [ ] 1.3 测试：`ecom-preset-plan.test.ts`（四分支 + 降级 + 未知；或并入既有 image-size-presets 测试）。
- [ ] 1.4 验证：`bun test test/ecom-channel-presets.test.ts`。

## Step 2：面板预设行 + 角标
- [ ] 2.1 `image-settings-panel.tsx`：`ecomPresets` 可选 props + 预设行 + banner + 角标（不传即零变化）。
- [ ] 2.2 `canvas-image-settings-popover.tsx`：组装 VM + onApply/onClear + 状态派生。
- [ ] 2.3 `canvas-node-prompt-panel.tsx`：按需传参（仅节点 composer 路径）。
- [ ] 2.4 验证：`bun run typecheck`；共享面快测（批量/审批/蒙版相关测试跑存量）。

## Step 3：药丸预设态
- [ ] 3.1 `imageSettingsPresetView` + 药丸后缀（渠道小标）+ ✕ 取消（语义按复核稿）。
- [ ] 3.2 静态护栏（✕/小标/文本形态断言）。

## Step 4：画质档位一阶段
- [ ] 4.1 档位常量/解析（image-size-presets.ts）+ store 扩展（`image.qualityTier`）。
- [ ] 4.2 吸收点：`defaultImageParamsForModel`（吸附 + 价目档校验 + 不可行不应用）。
- [ ] 4.3 面板控件（V1）或静默（V2，按复核）。
- [ ] 4.4 测试：档位吸附/降级/解析（并入 1.3 文件或既测文件）。

## Step 5：门禁 + 真机
- [ ] 5.1 `bun run typecheck`（=0）→ `bun run build`（通过）。
- [ ] 5.2 `bun test` 全量对照红基线（15 条内放行；名单外红=stop）。
- [ ] 5.3 真机走查（:3010/:8483）：预设应用/角标/三态徽标/药丸+取消/档位吸附/不达标建议 → 截图。
- [ ] 5.4 `pending-test.mdx` 登记（S4 后为新路径 `docs/plans/pending-test.mdx`）。
- [ ] 5.5 计价自证：grep 无价格数字；diff 无 globals.css。

## Step 6：交付
- [ ] 6.1 独立 commit。
- [ ] 6.2 汇报：状态 + 门禁 + 盘点清单 + 缺口 + 复核稿落地情况 + 截图索引。

## 回滚点
- Step 1 纯新增；Step 2/3/4 可分层回退；整枝单 commit revert。
