# 扩图档位门控 技术设计

## 1. 数据流

```
渠道模型能力配置（channel_models.capability_config_json）
  → Go NormalizeModelCapabilityConfigForModel（归一 + 按模型名播种）
  → /api/config | /api/channels 下发（modelCosts[].capabilityConfig）
  → 前端 config store → modelCapabilityConfigFor(config, model).image
  → 扩图槽：候选过滤（isOutpaintEligible）+ 默认选择 + canExecute + 空态文案
  → use-canvas-media-tools.outpaintImageNode 兜底二次校验
```

## 2. 字段与语义

- 字段：`ImageCapabilityConfig.outpaintTier`，值域 `recommended | capable | uncertified`，`omitempty`（空=未认证）。
- 非空即显式档位：normalize **不覆写**（支持显式降档 uncertified 钉住）。
- 播种名单（Go 常量与 TS 常量同源维护）：`nano-banana-2` / `nano-banana2` / `gemini-3.1-flash-image`（大小写不敏感包含匹配）→ recommended。
- 校验：非法值 → 400「扩图档位仅支持 recommended、capable 或 uncertified」。

## 3. 播种点（Go）

- `DefaultImageCapabilityConfig(protocol, modelName)`：新建/重置配置时播种。
- `NormalizeModelCapabilityConfigForModel` 图片分支：入库与下发前播种 —— 存量 nano 行零手改自动归位；显式值不动。
- TS `defaultImageCapabilityConfig(protocol, model)` 同规则播种（编辑器默认态与纯前端回落一致）。

## 4. 前端过滤点

- 谓词：`isOutpaintEligible(image)`（recommended|capable）。
- `ModelPicker` 新增可选 prop `filterModel?: (model) => boolean`：在 base 候选后、兼容性过滤前应用；缺省不改变既有行为。
- overlay `canvas-node-outpaint-overlay.tsx`：
  - `eligibleModels = selectableModelsByCapability(config, "image").filter(eligible)`。
  - 初始 model：node.metadata.model（在白名单）→ config.model（在白名单）→ 白名单首个 → `""`；`useEffect` 校正（配置异步到达 / 遗留非白名单值时改选）。
  - `canExecute = hasModel && maxImages>=1 && isOutpaintEligible(imageProfile)`（两层互不替代：硬能力 + 质量门控）。
  - 空态：`eligibleModels.length===0` → 「当前没有支持扩图的模型」；其余维持原文案。
- hook `outpaintImageNode`：maxImages 校验后加档位校验（message.error + return）。

## 5. 编辑器控件

- `model-capability-editor.tsx` ImageCapabilityEditor：
  - `section==="references"`（渠道管理实际使用路径）：ReferenceCard「图片引用」内、蒙版编辑下方加「扩图档位」Select。
  - 默认全量渲染路径同步加一份（同字段）。
- 保存即写 `capabilityConfig.outpaintTier`，随渠道模型保存链路落库（无新接口）。

## 6. 兼容与回退

- 字段可选：旧配置=未认证=不进扩图列表（安全方向，不会误放行）。
- capability version 不变；JSON `omitempty` 不污染既有配置。
- 回退：revert 前端过滤提交即恢复放开语义；Go 播种字段无副作用。

## 7. 测试点

- Go：默认播种（nano 族 / 非 nano）；normalize 保留显式值、空值播种、非法值拒绝。
- TS：isOutpaintEligible 三态；播种规则与显式值不覆写。
- 接口级：重启后端后断言配置响应 nano 行 `outpaintTier=recommended`、2.5/sunburst 无值。
- UI：开扩图确认模型槽只列白名单（headless / 真机，按现有验证纪律）。
