# F-06 micro-rider：硬贴回经典协议形状失明 + Agent 链 mask 口径对齐

> 来源：控制线 micro-rider 令（2026-09-28），PRD 采用令原文（裁去会话恢复说明段）。
> 发现出处（终审追溯）：① 形状失明 = 三模型独立 review 之 **glm**；② mask 口径分裂 = 三模型独立 review 之 **deepseek**；三家一致无 P0。
> 工作区：oac-wt-f06-hb（feat/ecom-f06-hardblend @ 4711e5a1，封版五轮后）。

## 背景

merge-v1.5.9 批次树现为 06bc4a1c。控制线对 5a567238..06bc4a1c 全量做了三模型独立 review，发现本枝两处应修项，各为小量级 rider：

## Rider 1：硬贴回 worker 兜底钩子对经典协议结果形状失明（静默失效且无日志）

- backend/internal/app/task_outpaint_hardblend.go:58 断言 result["images"].([]interface{})；而经典内置协议（backend/internal/app/provider_image.go:118/187/295/421 的 openai-image classic / gemini-image / grok / volcengine-ark）返回的 images 是 []map[string]string —— Go 类型断言必失败 → return result 且无任何日志，贴回静默跳过。
- 触发面：F-06 自己引入的扩图档位编辑器允许管理员把任意图片模型（含经典协议渠道）认证为可用/推荐档，画布扩图槽放行该模型 → metadata.outpaint 已写入、用户以为原图区像素级保真，实际贴回不发生——违背功能契约与 fail-open-but-logged 的自述设计。媒体检查点路径（materializeTaskMedia 文件级贴回）不受影响。
- 修法（倾向前者）：进钩子前先 JSON 归一化（persist 侧本来就要做）；或补 []map[string]string 分支。形状不匹配必须留日志。
- 测试：task_outpaint_hardblend_test.go:253 现只造 []interface{} 形状，补经典协议形状用例。

## Rider 2：Agent 扩图链 mask 口径与手动链分裂（Agent 扩图闭环不可用）

- 本批自己的推荐配置是 nano 关蒙版（.trellis/tasks/09-27-f06-hardblend/implement.md:107「建议渠道配置把 nano 的 maskSupported 设为 false」）；手动链（web/src/pages/canvas/use-canvas-media-tools.ts:870）与重试链（web/src/pages/canvas/use-canvas-generation-retry.ts:422-427）都已适配 maskSupported=false，但 Agent 链三处硬依赖 mask：
  - backend/internal/app/cloud_agent_media_outpaint.go:362-370 / :475 无条件合成并引用 mask；
  - :501-503 预检 spec.Inputs["mask"].Max < 1 直接拒绝；
  - backend/internal/app/model_capability.go:921-923 的「当前图片模型不支持蒙版编辑」admission 兜底。
- 后果：同一渠道上手动扩图 nano 是「推荐」可跑，Agent 链 prepare 即拒同款模型——两条扩图链能力口径分裂。
- 修法：与手动链同语义——maskSupported=false 时跳过 mask 合成 + 预检放行（admission 兜底同口径）。

## 顺带登记项（范围外，只登记不修）

- cloud_agent_media_outpaint.go:507 的 !AllowCustom && Parameter != "size" 条件与注释「aspect_ratio 制模型可按枚举比值提交」语义相反，核对是否应取反，报控制线即可。

## 交付标准（门禁）

- go test 全量 0 fail；web focused + tsc/build 通过。
- 双提交（rider1 / rider2 各一），**不 push**；完成后报 HEAD 等控制线验收并入 merge 批次。
- 预算 ≤0.3 人日，超了上报。
