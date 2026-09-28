# micro-rider 执行清单

> 门禁：`cd backend && GOTOOLCHAIN=local ~/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.26.8.linux-amd64/bin/go test ./... -timeout 25m`（全量 0 fail；internal/app 包实测 748s，超 Go 默认 600s 线，必须放宽）；
> web：focused + tsc + build。双提交不 push。

## Step 1：硬贴回形状归一化（提交1 `0a16cd41`）✓

- [x] `task_outpaint_hardblend.go`：`normalizeOutpaintHardBlendImages`（[]interface{} 原样；经典形状 JSON 归一化；其余形状 warn 日志）；条目级形状失配补 warn
- [x] 测试：`TestApplyOutpaintHardBlendClassicProtocolShape`（[]map[string]string → 归一化 → 贴回真实发生 + 像素口径 + 尺寸不变）绿
- [x] focused `-run 'HardBlend'` 全绿

## Step 2：Agent 链 mask 可选（提交2 `c8a32f58`）✓

- [x] `cloud_agent_media_outpaint.go`：materialize 增 `withMask`（false=跳过 mask 合成、返回 nil）；`cloudAgentOutpaintCapabilityCheck` 去 mask 硬依赖（画幅能力仍硬要求）
- [x] `cloud_agent_media.go`：调用点按 `spec.Inputs["mask"].Max >= 1` 传参；注释同步
- [x] 测试：`TestCloudAgentOutpaintCapabilityCheckMaskOptional`（mask-off 放行 / mask-on 通过 / 无画幅仍拒）+ `TestCloudAgentOutpaintMaterializeSkipsMaskWhenUnsupported`（mask-off 仅底图 + mask-on 对照）绿
- [x] focused `-run 'CloudAgentOutpaint'` 全绿

## 验证与收口

- [x] go test ./... 全量 0 fail（`-timeout 25m`，RC=0；app 748.071s + 其余 20+ 包全绿；日志 /tmp/f06rider-go-full.log）
- [x] web focused（outpaint-model-tier 5/5；http-ownership + ui-kit-retirement 6/6）+ tsc rc=0 + build ✓（前端本轮零改动，口径为守卫族回归）
- [x] 顺带项 :507 核对（见下，报控制线）
- [x] 卡记录 + 报 HEAD（不 push）

## 执行记录（2026-09-28）

- 双提交（本地，未 push）：`0a16cd41`（rider1）+ `c8a32f58`（rider2）。
- 归因备注：首轮全量 gate 在 internal/app 包 600s 处被 Go 默认超时保险丝熔断（该包基线耗时本就 ~700-750s，与本次改动无关——首轮与二轮分别是 600s 熔断 / 748.071s 通过）；放宽 `-timeout 25m` 后全绿。
- 顺带项（:507，登记不修）核对结论：
  1. `!spec.ImageSize.AllowCustom && spec.ImageSize.Parameter != "size"` 与注释语义相反——现状对「aspect_ratio 固定档」拒、对「size 固定档」放行，与注释声称的两种处置均相反。
  2. 单纯取反不足以闭环：预检放行 aspect_ratio 固定档后，提交侧 `cfg["size"]="WxH"`（像素串）会撞 `validateImageTask` 的「图片尺寸不在当前模型支持范围内」（值不在枚举），且 `validateImagePresetSelection` 的「当前分辨率不支持所选图片宽高比」（ratio 不匹配 preset）同样拦——nano 类模型需提交侧按枚举就近（与手动链 426fcde8 同语义）才真正可用。
  3. 建议：单独立项裁定「预检取反 + 提交侧枚举就近」或「维持拒绝 + 文案引导」；本 rider 只登记不修。

## 回滚点

- revert `0a16cd41` = 恢复（失明）旧行为；revert `c8a32f58` = 恢复 mask 硬依赖。
