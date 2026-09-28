# O-03 层1 设计：渠道预设 + 交集逻辑 + 档位

## 1. 预设数据（扩展 `web/src/lib/image-size-presets.ts`；控制线 2026-09-27 批）

```ts
export type EcomChannelPreset = {
    id: "amazon-main" | "detail-3x4" | "douyin-vertical";
    label: string;        // 全称（面板/徽标）
    shortLabel: string;   // 药丸小标
    aspect: string;       // 1:1 / 3:4 / 9:16
    minPixels: { width: number; height: number; note: string };  // 平台下限（校验）
    desiredResolution: ImageResolutionTier;  // 名义目标档（4k/2k/1k）；与实得档差异 = 层2 superResolve 触发条件（字段预留）
    hint: string;         // 一句提示
};
```

**参数草案（待控制线复核）**：

| id | label / short | aspect | minPixels | desiredResolution | hint |
|---|---|---|---|---|---|
| amazon-main | Amazon 主图 / Amazon | 1:1 | ≥1600×1600（主图放大下限） | 4k（旗舰直出，文字/logo 原生） | 白底主图，品牌/文字向 |
| detail-3x4 | 详情长图 / 详情 | 3:4 | ≥1440×1920（详情高清下限） | 2k | 详情页竖图，信息密度高 |
| douyin-vertical | 抖音竖版 / 抖音 | 9:16 | ≥1080×1920（竖版全屏基准） | 2k | 竖屏内容/视频封面 |

- 文件内**无价格数字**；`desiredResolution` 为名义目标，实际取交集（§2）。控制线 2026-09-27：参数已批；数据与档位 id 常量统一落 `image-size-presets.ts`；「前端只造词汇表，不造价格表」。
- 对齐说明（已批 2026-09-27）：「主图走 4K 直出（旗舰）」与三档制对齐；批量默认（1K+超分链）不在此扳动。

## 2. 交集逻辑（`planEcomPresetApplication`，同文件或 `canvas-image-preset-plan.ts`）

```ts
export type EcomPresetPlan =
    | { status: "unconstrained"; size: string; note: string }
    | { status: "full"; size: string; quality?: string; tier: ImageResolutionTier }
    | { status: "capped"; size: string; quality?: string; tier: ImageResolutionTier; badge: string }
    | { status: "short"; size: string; quality?: string; tier: ImageResolutionTier; gap: string; suggestModelIds: string[] };

export function planEcomPresetApplication(input: {
    profile: ImageCapabilityConfig;
    preset: EcomChannelPreset;
    priceTiers: ModelPriceTier[];      // imageModelPriceTiers(config) 结果
}): EcomPresetPlan;
```

算法：
1. **能力未知**（无 profile / 空 values）：`unconstrained` —— 返回按比例的最佳努力值（aspect 直接写入；不加约束、无徽标）。
2. **档位降级链**：target →（4k→2k→1k）逐级用现有 `imageTierAvailable` / `imageQualityForTier` / presets tier 判断可得性；取第一个可用档 = effectiveTier。
3. **尺寸计算**：有像素辅助 → `imagePresetForRatio(effectiveTier, preset.aspect)` 取 size；ratio-only 模型（aspect_ratio 参数 + quality 承载档）→ size=aspect，quality=`imageTierRequestQuality(profile, effectiveTier)`。
4. **下限校验**：effectiveTier 实际像素 ≥ minPixels 双维 →
   - 且 effectiveTier == target → `full`；
   - 但低于 target → `capped`（badge：「当前模型上限 {tier}，已满足 ≥{min}px」）。
   - 像素 < minPixels → `short`：仍应用可达部分 + gap（「当前模型最高 {pixels}，低于 {min}」）+ `suggestModelIds`（从传入的渠道模型目录动态筛选：该 aspect 下可达 ≥min 的模型；无候选则空数组并提示"暂无可用模型"）。
5. **价格档一致性**（若 quality 落值）：`hasPriceTierForImageSelection` 口径校验 (quality,size)；不满足 → 逐级降档重算；最终不可得 → 不作 quality 写入（保留 size）+ 记录 note（评审可调）。
6. **层2 预留**：`desiredResolution`（目标）与实得档差异 = 未来 superResolve 触发条件（「目标 4K 但模型只给 2K」）；本枝只存字段，不接超分链。

## 3. 面板 UI 接入（`image-settings-panel.tsx` + popover）

- **作用面收窄**：`ImageSettingsPanel` 新增可选 props：
  ```ts
  ecomPresets?: { presets: EcomChannelPresetVM[]; activeId?: string; banner?: string; onApply(id): void; onClear(): void };
  ```
  仅 `CanvasImageSettingsPopover` 传入（节点 composer 路径）；批量对话框 / Agent 审批 / 蒙版编辑**不传** → 零变化（回归锚）。
- **预设行**：面板顶部、比例之前：标题「电商场景」+ 3 个预设 pill（label + hint 简短）；active 高亮；右侧「恢复默认」小钮。capped/short 状态在行下方显示 banner（徽标/缺口/换模型建议按钮——建议项点击切换模型走现有模型选择回调，若回调链路不可得则展示模型名清单）。
- **角标**：比例网格项上，若 aspect ∈ 预设集 → 右上角小圆点（`title` 显示覆盖预设名）；随 active 高亮变化。实现：`aspectBadges: Record<aspect, string[]>` 由 presets 派生，纯展示、不拦截点击。
- **应用流**：`onApply(id)` → `planEcomPresetApplication(...)` → `onConfigChange("size", plan.size)`（+ quality）→ 面板即时反馈 + 药丸同步。
- **面板内部仅做视觉**；逻辑全在 plan 纯函数（可测）。

## 4. 药丸预设态（`canvas-image-settings-popover.tsx`）

- 摘要扩展（新助手 `imageSettingsPresetView(config)`）：当当前 size/quality 命中某预设 plan 值 → 返回 `{preset, tierLabel, capped}`；药丸文本 = `{aspect} · {tierLabel}`（如 `1:1 · 4K`；capped 时仍显示实际档）+ 渠道小标（后缀 chip，样式复用 pill 内后缀区）+ ✕（`stopPropagation`）。
- **✕ 一键取消回自动语义（控制线 2026-09-27 批）**：清预设命中态 = `size → "auto"`；`quality → 该模型默认档`；不恢复历史值（无状态机，保持简单）。取消后药丸回 `自动 · …` 形态。
- 状态判定 = **派生（无独立状态）**：`size/quality` 与 plan 值比对；模型切换后自动重算（capped 徽标自适应）。边界：用户手调至同值 → 视为预设态（可接受，记录）。

## 5. 画质档位一阶段（纯前端）

- **枚举**（常量收进 `image-size-presets.ts` 统一导出；控制线 2026-09-27：计价展示按同名 id 从 PriceTier 动态对接，前端只造词汇表）：`"economy" | "standard" | "flagship"`（标签：经济 / 标准 / 旗舰）；`parseQualityTier`（非法回落 = 未设置 null）。
- **存储**：`use-creation-preferences-store` 增 `image.qualityTier`（`rememberImageQualityTier`；用户 scope 持久化已具备）。
- **吸附**：复用 §2 的档位降级链（抽共享 helper `resolveTierPlan(profile, targetTier)`）：economy→1k / standard→2k / flagship→4k，逐级降档 + 价目档校验；不可得 → 不应用。
- **吸收点**：`defaultImageParamsForModel`（模型切换 / 新节点初始化路径）——用户档位存在时覆盖其返回的 size/quality（经吸附）；不存在时行为与现状一致（零变化）。
- **控件（V1 已批，2026-09-27）**：面板内预设行下方一行紧凑控件「默认画质：经济 / 标准 / 旗舰」+ 说明小字；改动即写 store（全局生效于后续默认）。（V2 仅静默记忆留档备选。）
- **价格一致性**：吸附含 `hasPriceTierForImageSelection` 校验（同 §2-5），避免"选低价档、账单高档"。

## 6. CapabilityConfig 覆盖度盘点（开枝首日必做）

- 口径：**当前模型目录**（运行实例优先；不可得则仓库静态件）——每模型：比例集（size.values/presets）、最大分辨率（tier 上限）、质量档（quality.values）、参数承载形态（size vs quality）。
- 数据源优先级：① 本地运行实例（若开发环境可得渠道目录）；② 仓库静态（`model-capabilities.ts` 内建 + `plugin-packages/*` manifest + backend 种子/目录定义）；③ 二者差异注明。
- 产出：`research/capability-coverage-2026-09-27.md`（表 + 缺口清单：如"模型 X 无 4K 档 / 无 3:4 比例 / quality 档位漏配"），缺口**单列**供上报（不本枝修复）。
- 用途：直接喂 §2/§5 的降级链验证与预设覆盖面判断。

## 7. 触碰面与风险

- 触碰：`image-settings-panel.tsx`（props 收窄式扩展）、`canvas-image-settings-popover.tsx`、`canvas-node-prompt-panel.tsx`（传参）、`image-size-presets.ts`（扩展：预设数据 + 档位 id 常量）、`use-creation-preferences-store.ts`、`model-selection.ts`（吸收点）+ 测试。
- 风险1：面板被 4 处共享 → 收窄 props + 回归锚（AC10）。
- 风险2：派生预设态 vs 显式状态的边界（手调同值）→ 记录，评审可改显式。
- 风险3：capability/价格数据形态差异（size.presets、logicalPriceTiers 可能缺）→ 全路径走现有 helper + 降级不静默。
- 回滚：数据/逻辑文件独立新增；UI 改动可分层回退；整枝单 commit revert 可行。

## 8. 测试

- `web/test/ecom-preset-plan.test.ts`（新增或并入既有 image-size-presets 测试）：四条 plan 分支 + 价格档降级 + 未知能力。
- 档位吸附链 + 降级 + 存储解析（同域测试文件）。
- 静态护栏：预设数据无价格数字（正则）；药丸 ✕ 取消语义存在。

## 9. 复核点汇总

§1 参数表、§3 角标形态/文案、§4 取消语义、§5 档位命名与控件形态（V1）、desiredResolution 字段——全部已裁（控制线 2026-09-27）：参数批 / 命名批 / V1 批 / 字段批。
