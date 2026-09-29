# backlog · 模型选择器 Auto 线（Featured / Auto-1/2/3 / Multi）登记卡

- 登记日期：2026-09-29　状态：**规划中（未排期）**，下批任务书素材
- 与同栏：:507 Agent outpaint 尺寸专项、扩图画幅商用矫正、参数面板 2.0、composer 方向
- 前置依赖：模型行重构 T 任务（B线 执行中，2026-09-29 任务书）——Featured/Multi 在 T 落地后的行结构（右轨+两行流式区）上实现

## 一、决策链存档（为什么是这些方案）

1. 用户四轮真机反馈逐次否决：居中漂移 → 等高空槽（3a「很空」）→ 斜三角（3c+ 锚顶）→ 标签挤占说明（原方案 A）；裁决变体 T（价格/✓/pin 右轨锚标题行 + 标签说明两行流式区）
2. Flora 特性对照触发（用户截图 2026-09-29）：Auto select model / Use multiple models / Featured models / 时长徽章
3. 用户关键修正：**「低价池跑量+商用兜底」是扩图的渠道策略；生图 auto 是两层决策**——第 1 层选模型（各生图模型特性/强项不一），第 2 层选渠道（同一模型不同 provider 的支持特性、能力、价格、稳定性）
4. 用户方向裁定：**Jev 参与但不依赖**；**收集用户生成偏好反哺选择**
5. jev 身份复核（2026-09-29 联网 + 本地档案双源）：TypeSafe AI 2026-09-15 发布的首个 System One Model，不生成文本，输出带校准概率的类型化决策值；端到端 70-500ms、input ~$0.042/M tokens、output 免费、单次调用并行多问（官方口径，无第三方评测）
6. jev-router v1→v7 尸检教训移植（488 路由/620 结果实测，`RESEARCH/jev-decision-model/`）

## 二、两层路由地基盘点

| 层 | 现状 | 缺口 |
|---|---|---|
| 第 2 层 渠道路由 | **基本现成**：logical_models / logical_model_routes / route_attempts（优先级+失败转移），价格档与 attempts 遥测在积累 | 暴露给画布 picker 的 ✦ Auto 模式 |
| 第 1 层 模型匹配 | 能力硬约束（model_capability profile）✅；预设场景→模型映射（O-03 刚落地）✅；策展标签（tag 系统）半有；画幅偏差遥测（本批埋下）🌱 | prompt 语义选模型（**裁定不做**，靠场景+策展先行） |

## 三、项目卡

### P-A　Featured 精选区（~0.5 人日）
管理员全局策展分组（区别于用户 Pinned）。tag 驱动，数据通路已验证（ddcat nano 的「推荐」chip）。待定：策展入口（管理端勾选 vs tag）。

### P-B　Auto-1 渠道层（2-3 人日）
用户/场景定模型 → 系统在多渠道按【价低优先 + 稳定性降权 + 失败转移】执行。逻辑模型路由暴露给 ✦ 模式。工程为主。

### P-C　Auto-2 规则模型层 + 埋点（2-3 人日）
第 0 层确定性规则跑通：能力硬约束过滤 → 场景/预设映射 → 策展标签 → 价格/稳定性排序。**偏好采集从本日启动**（手动改选行为即数据）。产品语义待定清单：选择依据优先级、粒度（按节点/按次生成）、用户可见度。

### P-D　Auto-3 Jev 决策层（设计见下）
shadow → advisory 两阶段。读 Auto-2 攒的偏好做 state。

### P-E　Multi 多选（**挂起待语义**）
选中态单值→集合，generation 派发/retry/节点元数据/VRT 全动（1.5-2 人日+）。前置：多模型时的分摊语义（随机/轮询/逐次挑）。

### P-F　时长徽章（顺手档）
任务日志滚动均值，展示层小改。不急。

## 四、Auto-3 设计（Jev 决策层）

### 4.1 三层结构

```
任务（prompt/节点/场景）
 ↓ 第 0 层 规则底座（确定性，永远在，可独立出结果）
    能力硬约束 → 场景/预设映射 → 策展标签 → 价格/稳定性排序
 ↓ 第 1 层 Jev 顾问（可选，不依赖）
    state = 底座候选 + prompt 摘要 + 用户偏好摘要
    questions（并行）= 模型 Choice + 适配 Score + 兜底 Noul
    超时/失败/未配置 → 静默回落第 0 层，生成零阻塞
 ↓ 第 2 层 偏好反哺（持续积累）
    auto 建议 X 用户改选 Y = 负投票 → 喂 state 偏好摘要 + 第 0 层权重
```

### 4.2 Jev 原语映射

| 原语 | Auto 对应 |
|---|---|
| Choice（固定选项+概率分布） | 这个任务用哪个模型 |
| Score（量表打分） | 价格/稳定性权衡、任务适配度 |
| Noul（是/否概率） | 兜底触发？弹回手动？ |

### 4.3 硬约束（jev-router 尸检移植，四条）

1. **shadow 先行**：先只记日志不生效，用户真实选择当裁判；一致率+置信分达标才转 advisory。shadow 期即偏好采集，两设计合流
2. **绝不热路径拦截**：生成永不等待 Jev；失败/超时静默走规则底座
3. **阈值按题型逐一定标**（jaggedness 实锤：阈值不可跨题型迁移）：模型选择置信门 ≠ 渠道选择置信门
4. **预登记生死线**：shadow 期一致率低于规则底座基线 → 整线终结，不恋战

### 4.4 工程要点

- 先例：prompt enhancer 的「可选 LLM 辅助 + 无配置不启用 + 失败静默降级」骨架（`PROMPT_ENHANCER_*`）
- 时序：节点创建/prompt 输入防抖时**异步预选**；提交时刻只有缓存命中或跳过
- 一致性：温度 0 + 结果缓存 + 滞回（同类任务不轻易换模型）
- 延迟/成本预算：70-500ms、output 免费、合批省钱（13 问合批 = 便宜 12.2x 快 10x，官方 cookbook）
- 副产品：Jev 理由字符串供养「为什么选了它」透明化 + 审计日志
- 接入：`POST /v1/systemone`（jev-latest），本机已有 TYPESAFE_API_KEY

### 4.5 偏好反哺信号源

| 信号 | 强度 | 现状 |
|---|---|---|
| auto 建议 X 用户改选 Y | 最强（显式负投票） | Auto-2 起埋点 |
| 同场景反复手选同一模型 | 强 | creation_preferences store 先例可扩 |
| 生成后 edit/regenerate 率 | 中 | 任务日志可算 |
| 画幅偏差/失败遥测 | 中（稳定性维度） | 本批已埋 |
| 保留 vs 删除 | 中 | 待定义 |

存储：V1 localStorage（用户级）；V2 后端表（跨设备 + 顾问 few-shot 素材）。冷启动用全局策展默认。

**北星指标**：auto 建议与用户最终选择的一致率（可用 Jev 置信分分层统计）。

## 五、风险与开放问题

- Jev 生态年轻（发布 2 周，无第三方评测，全部厂商口径）；Vercel AI Gateway / Langfuse 已接入为方向性正证
- jev-router 失败域是「改变 agent 行为」（执法），Auto-3 是「产品路由决策」（参与）——正册用例，但 shadow 数据仍是唯一本地实证来源
- Auto-2 的产品语义未定（P-C 清单），阻塞 Auto-3 的 state 设计定稿
- Multi 与 Auto 的交互未设计（auto 多选还是单选？）

## 附：证据与归档

- 原型：`proto-model-row-planA.html` / `proto-model-row-planA2.html`（Temp，随 T 卡归档）
- Gemini 咨询两轮全文（闭合式 2026-09-29 上午 / 开放式同日）→ T 卡附件
- jev 档案：`RESEARCH/jev-decision-model/`（REPORT.md 用法与九缺陷 / REPORT-identity-v1.md 身份 / BLACKHOLE-MCTX-INSPIRATION.md 尸检）
- 2026-09-29 联网复核：smart-search session 641c281b8b9e（typesafe.ai 官方两源 + awesome-jev）
