# PRD · 模型行重构 T（变体 T：右轨 + 流式区）

> 来源：控制线任务书 2026-09-29【控制线任务书 · 模型行重构 T】。
> 承接 3b（`84394553`）同分支续作，随 merge-v1.6.0 进树；3c 微令（pin 锚核心区）作废——被本任务结构性取代。
> 决策链：用户四轮真机反馈逐次否决 居中漂移/等高空槽/斜三角/说明截断；两轮 Gemini 咨询（闭合式+开放式）；原型 A → A改-U/T 比对，用户裁定变体 T。原型与咨询记录归档为卡附件（attachments/，咨询全文待控制线补档——本环境未随任务书收到全文文件）。

## 任务书原文

```
【控制线任务书 · 模型行重构 T】B线 2026-09-29
（决策链存档：用户四轮真机反馈逐次否决 居中漂移/等高空槽/斜三角/
说明截断；两轮 Gemini 咨询（闭合式+开放式）；原型 A → A改-U/T 比对，
用户裁定变体 T。原型与咨询记录归档为卡附件。）

一、定位
- 承接 3b（84394553）同分支续作，随 merge-v1.6.0 进树
- 3c 微令（pin 锚核心区）作废——pin 问题被本任务结构性取代
- 性质：行内结构重排，预算 ≤0.5 人日

二、目标结构（变体 T，唯一定义）
- 行容器：弃 grid 双列（option|pin），pin 退出文档流
- 标题行：logo + 模型名 + 能力图标（T/▣）；价格徽章迁出标题行
- 右轨（absolute，锚标题行中心 ~17.8，跨行高恒定）：
  [价格][✓ 选中][pin hover] 左→右；未选中行 hover 只出 pin，
  选中行 hover ✓+pin 并列
- 两行流式区（zone）：标签=16px 迷你前缀 chip（11px 字 /
  padding 2 5 / radius 3 / 弱背景）内联于说明行首，说明自然续排，
  放不下自动换第二行；区上限 2 行，尾部省略号
- 行高自适应：一行 54 / 两行 71（与实测 53.6/80.6 同源推导）
- hover 仅背景/边框/颜色过渡（红线保持，禁 height/padding 补间）
- 既有"当前模型行 min-height 58"规则不动，报告注明观感影响
- brand/provider 行（.canvas-model-picker-brand）零改动

三、守卫（model-picker-style-source 行布局断言重写）
- 无 grid pin 列；右轨存在且绝对定位、锚标题行补偿在位
- 价格在右轨、标题行无价格；zone 内联 mini chip + 2 行 clamp
- hover 无 height/padding 补间（既有断言保留）

四、验收（:3002 热更后真机）
- a6api flyout：GPT 54 / nano 71（真实说明「Gemini系生图模型2代，
  限定1K」完整可见，双标签在前）/ sunburst 54（价格迁出后全名
  预期不再截断，实测确认）
- logo/模型名/能力图标/价格/✓/pin 跨行同轨（标题行中心，逐行量测）
- pin hover 出现于右轨（选中/未选中行都验）
- ddcat flyout：8 行全 54，总高 ≈432，无内部滚动回归
- L1 composer 内嵌菜单同结构走查（ModelLabel 消费点枚举进报告）
- hover 无果冻感

五、登记
- PATCH-MAP C1 升级：行内结构 fork 专有（右轨+流式区），上游
  tags/价格行变更同步时手工映射进 zone/右轨，仍以 fork 结构为底
- 归档：原型 /mnt/c/Users/WindC0X/AppData/Local/Temp/
  proto-model-row-planA2.html + 两轮 Gemini 咨询全文 → 卡附件
- 新卡 09-29-model-row-t（引用 09-29-f06-outpaint-drift-tags 与决策链）

六、门禁与交付
- 四门禁（tsc/eslint/build/web 全量 15 红逐名=冻结基线）；go 零改动
- 双提交不 push；:3002/:8484 验证栈保留至验收
```

## 验收口径补充（实现映射）

- 行高 54/71 为原型推导值（54.6/71.6 实测同源，四舍五入口径）。
- 附件：`attachments/proto-model-row-planA.html`、`attachments/proto-model-row-planA2.html`（卡目录因创建日期自动命名为 09-30）。
