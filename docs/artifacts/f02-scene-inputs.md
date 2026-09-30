# F-02 场景图/背景替换 任务书输入清单（W5 开书时取用）

> 控制线预整理，2026-09-30。开书时与本清单合并成文，不必重新调研。

## 1. Flora 范式（语料：`docs/artifacts/flora-techniques-deep-dive/`）

- **两段式提示词**：LLM 节点出结构化 spec（3-9K 字）→ 凝缩 900-1500 字喂图像模型。对应对标技法的 nodeInputsMap 里有逐字原文。
- **@[ref] 角色声明（INPUT ROLES）**：产品图=主体、场景图=环境，声明边界与「不要复制其颜色」类防误用条款——防模型把场景图当第二个主体。
- **mask 语义声明**：显式声明蒙版语义（选区/非照片），透明渲染为黑的坑要预写。
- **对标技法**（优先抓取集）：Product in Scene Generator（5 输出）、Relighting / Relighting Photoshoot（与 F-07 共享语料）。

## 2. preset spec 模板化预案（降智/弱渠道兜底——社区情报 2026-09-30）

- 预凝缩 spec（900-1500 字成品）直接入模板，LLM 只做变量填充（商品名/材质/目标场景），**不做全程生成**。
- 降智期自动退化为「模板+变量」模式，出图下限可控。
- 触发来源：上游群 Elio 实测「gpt 降智→内置提示词很垃圾」。

## 3. 渠道现实实测门

- 低价号池常跑同款模型名（gpt-image-2/nano-banana-pro），便宜来自套利非降质——**但不可假设**，开书前用目标渠道跑 3-5 张样本实测遵循度，据实定模板长度（Flora 原文按 Opus/NB-Pro 调，spec 偏长；遵循度打折则砍到 2-3K）。

## 4. 工程约束（沿用 F-01 任务书口径）

- 咽喉纪律：F-02 落点涉 `use-canvas-media-tools.ts` 咽喉——**与 F-01 分枝避免并行**（W4 F-01 / W5 F-02 的排期已天然错开）。
- 修-7 命名红线：场景相关命名避开上游 Agent 技能域「场景胶囊」语义（用「场景图/商拍场景」限定词）。
- PATCH-MAP 登记：新 UI 面若需样式，走 flora-overrides.css，不直改 globals.css。

## 5. 用户面

- 入口 = S1 starter 卡「商品场景图」（`canvas-ecom-starters.ts` 已有 4 卡 dormant 数据层，含 scene 卡）。
- 尺寸预设：`ECOM_CHANNEL_PRESETS`（`image-size-presets.ts`）现成。
- 直线流程要求同 PRODUCT.md 设计原则（小白零画布负担）。
