# CapabilityConfig 覆盖度盘点（O-03 首日必做）

- 日期：2026-09-27
- 口径：**运行实例目录优先**（已满足）——数据源 = floracheck 开发副本（`$HOME/oac-light-check`，2026-09-27 自 `flora-quiet-check` 拷贝）的 `channel_models.capability_config_json` + 价格列；生产目录以控制线部署为准（本表标注为"副本观测"）。
- 用途：O-03 层1「预设 × 能力」交集逻辑（min(预设, 能力)、三态徽标、换模型建议）的输入验证；缺口单列供上报，不在本枝修复。
- 目标下限（三预设）：Amazon 主图 1:1 **≥1600×1600**；详情长图 3:4 **≥1440×1920**；抖音竖版 9:16 **≥1080×1920**。

## 1. 图像模型清单（18 个，按渠道）

| 渠道 | 模型 | 价格/张 | 档位（tiers） | 比例数 | 1:1 最佳 | 3:4 最佳 | 9:16 最佳 | 三下限 | 质量承载 |
|---|---|---|---|---|---|---|---|---|---|
| Grok2Api | grok-imagine-image-2.0 | ¥0.001 | 1k,2k | 10 | 2048²@2k | 1728×2304@2k | 1536×2752@2k | ✓✓✓ | quality=1k/2k |
| Grok2Api | grok-imagine-image-edit | ¥0.001 | 1k | 10 | 1024²@1k | 1024×1360 | 1024×1824 | ✗✗✗ | quality=[] |
| Grok2Api | grok-imagine-image | ¥0.001 | — | 0 | 无 presets | 无 | 无 | ✗✗✗ | quality=1k/2k（presets 缺） |
| Grok2Api | grok-imagine-image-lite | ¥0.001 | — | 0 | 无 presets | 无 | 无 | ✗✗✗ | quality=1k/2k（presets 缺） |
| Grok2Api | grok-imagine-image-quality | ¥0.001 | — | 0 | 无 presets | 无 | 无 | ✗✗✗ | quality=1k/2k（presets 缺） |
| 钱咖 | gpt-image-2 | ¥0.001 | — | 0 | 名义 1024 底 | 1024×1360 | 1024×1824 | ✗✗✗ | quality=auto/low/medium/high |
| 小白鼠 | gpt-image-2 | ¥0.001 | — | 0 | 同左 | 同左 | 同左 | ✗✗✗ | 同上 |
| Agnes | agnes-image-2.5-flash | ¥0.001 | 1k,2k,4k | 10 | 2880²@4k | 2448×3264@4k | 2160×3840@4k | ✓✓✓ | quality=[]（显式像素） |
| Agnes | agnes-image-2.1-flash | ¥0.001 | 1k,2k,4k | 10 | 2880²@4k | 2448×3264@4k | 2160×3840@4k | ✓✓✓ | 同上 |
| Agnes | agnes-image-2.0-flash | ¥0.001 | 1k,2k,4k | 10 | 2880²@4k | 2448×3264@4k | 2160×3840@4k | ✓✓✓ | 同上 |
| 影策 | gpt-image-2 | ¥0.005 | 1k | 10 | 1024²@1k | 1024×1360 | 1024×1824 | ✗✗✗ | quality=auto/low/medium/high |
| 影策 | gpt-image-2.5 | ¥0.005 | 1k | 10 | 同左 | 同左 | 同左 | ✗✗✗ | 同上 |
| 影策 | gpt-image-2-4k | ¥0.009 | — | 0 | config 未见 4k 档 | — | — | ✗✗✗ | 同上（缺口，见 §3） |
| 影策 | gpt-image-2.5-4k | ¥0.009 | — | 0 | 同上 | — | — | ✗✗✗ | 同上（缺口） |
| 影策 | gpt-image-2-adobe | ¥0.0035 | — | 0 | 无 presets | — | — | ✗✗✗ | 同上（缺口） |
| 影策 | gpt-image-2.5-adobe | ¥0.035 | — | 0 | 无 presets | — | — | ✗✗✗ | 同上（缺口） |
| 影策 | nano-banana-pro | ¥0.05 | — | 0 | ratio-only（无档位表征） | — | — | ✗✗✗ | quality=auto/low/medium/high（分辨率未知） |
| 影策 | nano-banana2 | ¥0.05 | — | 0 | 同上 | — | — | ✗✗✗ | 同上（缺口） |

## 2. 参数承载形态（两套范式，交集逻辑必须双路径）

1. **ratio-only + quality 承载分辨率**（`size.parameter=aspect_ratio`，`quality.values=['1k','2k']`）：Grok2Api 全系 → 走 `imageResolutionUsesQuality` / quality 落档路径。
2. **size 像素/比例混合**（`size.parameter=size`，values 兼有比例与像素、allowCustom）：gpt-image 系 / Agnes 系 → 走像素 size 落值路径（含 `imagePresetForRatio` 计算）。
3. 边界：ratio-only 且无档位（nano-banana）→ 能力未知 → **不约束**（O-03 设计 §2-1 已有该分支）。

## 3. 缺口清单（单列，供上报；不在本枝修复）

| # | 缺口 | 影响 | 建议 |
|---|---|---|---|
| G1 | grok-imagine-image / -lite / -quality：capability_config 缺 presets（比例→尺寸映射不可枚举） | 预设推荐无法给具体像素；交集按"能力未知→不约束"降级 | 平台侧补齐 config（可对齐 grok-imagine-image-2.0 的 1k/2k 集） |
| G2 | 影策 gpt-image-2-4k / 2.5-4k / adobe / nano-banana 系：标称 4K/Pro 但 config 无 ≥4K 尺寸或档位描述 | "Amazon 4K 直出"在缺口模型上无法被交集逻辑确认，将走"未知/不约束"或缺口徽标 | 平台侧补 4K 档位（或像素清单） |
| G3 | 钱咖/小白鼠/影策基础 gpt-image-2(.5)、grok-imagine-image-edit：名义封顶 1K（1024-底），三下限均不达 | 假想：预设选择这些模型时 → 缺口徽标 + 换模型建议触发（设计目标路径） | 无需修复；用建议链路引导至 Agnes 4K / grok-image-2.0 2K |
| G4 | grok-imagine-image-edit quality=[]（档位选项空） | 该模型 quality 下拉无档；交集逻辑需容忍空 quality values | 平台侧核对是否漏配 |

## 4. 结论（喂给 O-03 设计）

- **全覆盖模型**（4K，三下限全过）：agnes-image-2.5/2.1/2.0-flash（¥0.001）—— 换模型建议首选目标。
- **2K 达标**：grok-imagine-image-2.0（三下限全过）—— 第二建议目标。
- **1K 封顶**：grok-imagine-image-edit、影策/钱咖/小白鼠 gpt-image-*（基础档）—— 触发"缺口徽标+建议"路径。
- **未知/降级**：presets 缺（G1/G2/G4）→ 走"不约束"或"缺口"分支，绝不静默。
- 双范式（§2）已在设计中覆盖（quality 路径 + size 路径 + 未知路径）。
- 附注：本表为副本观测；若控制线有生产目录快照，可用同一脚本口径复核（脚本可留档于本任务 research/）。
