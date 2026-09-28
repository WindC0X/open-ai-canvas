# O-03 层1 直出引导（渠道预设组 + 生成面板）

## Goal

电商直出引导**层1**（只做层1：不做超分/计费映射/视频线）：渠道预设组数据文件 + 生成设置弹窗（`1:1 · 自动` 药丸点开）顶部「电商场景」预设行 + 被预设覆盖比例项角标 + composer 底栏药丸预设态（`1:1 · 4K` + 渠道小标，一键取消回自动）+ 全局画质档位一阶段（纯前端）+ **CapabilityConfig 能力覆盖度盘点（开枝首日必做）** + 预设×能力交集逻辑 + 计价展示不硬编码。

## 已核实事实（证据锚）

- 施工面：`canvas-image-settings-popover.tsx`（药丸 + portal 弹窗；摘要 `imageSettingsSummary` = 尺寸 · 质量 · 透明）；`image-settings-panel.tsx`（比例网格 / 分辨率 / 质量 / 透明背景；**共享**于节点 composer、批量生成对话框、Agent 审批卡、蒙版编辑——改动须收窄作用面）；集成点 `canvas-node-prompt-panel.tsx:487`。
- 现有 lib：`image-size-presets.ts`（吸附辅助 `imageTierAvailable` / `imageQualityForTier` / `imageResolutionUsesQuality` / `imageTierRequestQuality` / `imageQualityForSelection` / `imagePresetForRatio`）；`image-resolution-tiers.ts`（`buildImageResolutionOptions` 等）。
- 计价动态先行成立：`imageModelPriceTiers(config)` 读 `channel.modelCosts[].logicalPriceTiers`（selector {quality,size}）；`hasPriceTierForImageSelection` 已在面板用于未定价档禁用——**不硬编码价格**的红线本次只做"保持 + 自证"。
- 用户级偏好基座：`use-creation-preferences-store`（image.quality 等，按用户 scope 持久化；create 页已消费，canvas 未消费）。
- 三档制（09-26 渠道裁决）：保真/走量档 = 1K+超分链（批量默认）/ 质量/旗舰档 = 4K 直出（主图品牌向）/ 算法超分档（既有素材，层2/3 域）。**层1 预设走直出路线，不为本枝引入超分链**。
- Amazon 主图口径：任务书 ≥1600px（旧稿 ≥2048 差异已按最新裁定执行，报备）。

## Requirements

- R1 渠道预设组数据：**扩展 `web/src/lib/image-size-presets.ts`**（控制线 2026-09-27 批）——Amazon 主图 1:1 / 详情长图 3:4 / 抖音竖版 9:16 三项，每项含 `aspect / minPixels / desiredResolution / hint`。**`desiredResolution`（目标档）与 `minPixels`（下限）并列存**：层2 接 superResolve 时「目标 4K 实得 2K」即超分触发条件，字段预留在位。
- R2 生成面板改动（药丸弹窗内）：
  - 顶部「电商场景」预设行（预设按钮 + 状态说明 + 清除）；
  - 被预设覆盖的比例项角标（1:1 / 3:4 / 9:16 角标，文案/形态见 design，复核）；
  - 应用 = 写入 size + quality（经交集逻辑），**不新建提交路径**。
- R3 composer 药丸预设态：生效时显示 `1:1 · 4K`（实际生效档）+ 渠道小标（如「Amazon 主图」）；**一键取消回自动**（✕；取消语义见 design，复核）。
- R4 全局画质档位一阶段（polox #37，纯前端）：用户级画质偏好 = **经济/标准/旗舰（economy/standard/flagship）**（控制线 2026-09-27 批）→ 面板默认吸附；映射走 **CapabilityConfig 吸附**；档位 id 常量收进 `image-size-presets.ts` **统一导出**，后续计价展示按同名 id 从 PriceTier 动态对接——**前端只造词汇表，不造价格表**；吸附结果必须有价目档，否则降级不应用。控件形态 V1（面板内一行「默认画质」）已批。
- R5 盘点（开枝首日必做）：CapabilityConfig 能力覆盖度盘点——当前模型目录各自支持的比例集 / 最大分辨率 / 质量档 → 覆盖清单（`research/`）；**缺口单独列任务上报**。
- R6 交集逻辑（预设 × 能力）：生效值 = min(预设, 当前模型能力)：
  - 能力足 → 完整应用；
  - 部分足 → 顶格应用 + 徽标说明（例："当前模型上限 2K，已满足 ≥1600px"）；
  - 不达标 → **绝不静默**：应用可达部分 + 缺口徽标 + 换模型建议（从渠道模型目录动态查找支持项）；
  - 能力未知 → 不约束。
  - 差异留存：`desiredResolution` 与实得档差异作为**层2 超分触发条件**保留（本枝只存字段，不接超分链）。
- R7 计价纪律：预设/档位数据文件无价格数字；展示走动态数据；不新增账务接口。

## Acceptance Criteria

- [ ] AC1：渠道预设组数据文件 + 纯函数单测（`planEcomPresetApplication` 三态 + 未知态全分支）。
- [ ] AC2：弹窗顶部预设行可用：应用某预设 → 比例/分辨率/质量按交集逻辑落值；被覆盖比例项出现角标；清除回默认。
- [ ] AC3：药丸预设态：显示实际生效档（`1:1 · 4K` 形态）+ 渠道小标；✕ 一键取消回自动（语义按复核稿）。
- [ ] AC4：交集四态单测全绿（full / capped+徽标 / short+缺口+换模型建议 / unconstrained）；不达标态**无静默**。
- [ ] AC5：画质档位一阶段：用户档位存储 + 面板默认吸附（CapabilityConfig 吸附 + 价目档一致；不可行则不应用）；单测覆盖吸附与降级。
- [ ] AC6：CapabilityConfig 覆盖度清单产出（`research/capability-coverage-2026-09-27.md`）；缺口清单可独立上报。
- [ ] AC7：计价不硬编码自证（grep：预设/档位文件无价格数字；diff 不含新增价格常量）。
- [ ] AC8：**门禁四件**：① `cd web && bun run typecheck` 0 ② `cd web && bun run build` 通过 ③ focused 测试绿 ④ `bun test` 全量对照测试仓 `open-ai-canvas-testing/docs/env.md` 冻结红基线（15 条 @5a567238）：基线内放行，名单外红 = stop 报控制线。
- [ ] AC9：真机走查截图（预设行应用/角标/药丸态/一键取消/档位吸附/不达标态），dev 端口 :3010/:8483。
- [ ] AC10：共享面回归：批量对话框 / Agent 审批卡 / 蒙版编辑不因面板改动出现新红（基线内放行）。
- [ ] AC11：`git diff` 不含 `globals.css`；无后端改动；无新增依赖（或明列）。

## Out of Scope

- 层2（超分链）/ 层3（ComfyUI）/ 视频线；任何后端计费映射；Agent 审批卡内预设联动（后续波次）。
- 模型目录数据修复（缺口只列任务，不在本枝修）；price 文案/账单核对。

## 裁定记录（控制线 2026-09-27，全部落卡）

1. ✅ 预设参数批：Amazon 主图 4K / 详情长图 2K / 抖音竖版 2K；min(预设,能力) 三态徽标照案。
2. ✅ 画质档位命名：经济/标准/旗舰（economy/standard/flagship）；控件形态 V1（面板内一行「默认画质」）。
3. ✅ 药丸取消语义：size→auto + quality 回归模型默认档（「预设推荐值」语义，取消 = 回无预设基线态）。
4. ✅ Amazon ≥1600（任务书为准，≥2048 旧稿不追溯）。
5. ✅ 预设数据落点 = 扩展 image-size-presets.ts；desiredResolution 字段预留（层2 触发条件）。


## O-03 实现与验证记录（2026-09-28 · 完成）

- 数据层：`image-size-presets.ts` 增 `ECOM_CHANNEL_PRESETS`（三预设，minPixels+desiredResolution+hint）/ `IMAGE_QUALITY_TIERS`（economy/standard/flagship→1K/2K/4K）/ `parseImageQualityTier` / `imageAvailableTiers`（双范式）/ `resolveTierPlan`（降级链+价目档校验）/ `planEcomPresetApplication`（四态）/ `hasPriceTierForImageSelection`（自面板迁入，去重）。
- 面板：`ImageSettingsPanel` 三可选槽（ecomPresets/qualityTierControl/aspectBadges）——不传零变化（批量/审批/蒙版回归锚，SSR 断言在案）；预设行/徽标/建议/角标/档位行为纯视觉。
- 药丸：`imageSettingsPresetView`（派生，无独立状态）；✕ 取消 = size→auto + quality 回模型默认档（控制线 2026-09-27 批）。
- 档位：store `image.qualityTier` 持久化；`defaultImageParamsForModel` 吸附（不可得回退零变化）；`imagePriceTiersForModel` 下沉 model-selection。
- 换模型建议：目录动态查找 + 按可达档排序（4K 优先）+ 点击切换接现有 onSelectModel（node composer 路径）。
- 测试：`ecom-preset-plan.test.ts` 17 例 + `ecom-preset-ui.test.tsx` 13 例（四态全分支/降级/未知/价目档/吸附/SSR 渲染/静态护栏）。
- 门禁：tsc 0 / build ✓ / 全量 2354 测试（309 文件）→ 15 红逐名=冻结基线、零额外。
- 真机走查：`.local/o03-walkthrough/` s1-s6（s1 预设行+角标；s2/s2a 药丸特写；s3 取消；s4 吸附；s5 不达标态；s6 还原）；明细见该目录 evidence-notes.md。
- 缺口上报（不擅自扩）：G1-G4 沿用首日盘点（research/capability-coverage-2026-09-27.md），本枝未修。
- 环境注记：本环境「小白鼠 Gpt Image 2」含 4K 尺寸（盘点记 1K 封顶）；交集逻辑实时取 config，不受盘点表约束。
- 派生态边界（设计 risk2 已接受）：值与预设计划同值时显示预设态（走查实录 W5）。

## O-03 polish 轮 + 技能 chip 修复记录（2026-09-28 · 控制线收编轮）

### polish（控制线 2026-09-28 收编）
- 两条常驻说明行（已应用 / 档位吸附）收入 S2.1 hover 卡 mini 变体（新增 `ToolHoverCardMiniContent` + `useToolInfoCard`，共用状态机/定位/单卡不变式；z 1150 高于设置浮层 1100）。
- 比例角标补 hover 释义：预设名 + 最低像素要求（design 要求的 title 因 pointer-events-none 不可达，已改为按需小卡）。
- 判定：s5 不达标长文案保留可见（双数值警示语义，不收起）。
- 测试：mini SSR/形态守卫/说明卡构造/接线守卫；走查 s7/s7a/s8。

### 技能 chip 修复（canvas-core，控制线域外授权 2026-09-28，根因报告在案）
- A 注入面收窄：use-canvas-render-model 节点引用表去除 skillMentionReferences 混入（tool 保留；CanvasConfigComposer skillReferences / cloud agent panel / 创建页不动）。
- B hover composer：kind:"skill" 显式分支（✦ / Skill），不再落 T/Image 缺省。
- 守卫：节点引用表 block 源码守卫 + Agent 面来源守卫 + SSR 技能徽章 + 源级分支守卫；真机全量扫描 0 命中（22 条引用条目）。
- 报备：同 fallback 链上 kind:"tool" 仍落 T/Image 缺省（本次授权范围外未动，观察项）。
