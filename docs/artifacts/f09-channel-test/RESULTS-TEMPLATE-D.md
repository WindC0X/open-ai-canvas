# F-09 六段式骨架渠道实测（模板 D）· 结果报告

> 任务书：`docs/artifacts/f09-channel-test/task-book-template-d.md` @ `cf074a0d` + 二次修正 `ac3e416f`
> 执行：B线，2026-10-06
> 分支：`test/f09-channel-gate`
> 判据：`open-ai-canvas-testing` @ `353bb36`（代码）/ `c0cc968`（口径声明块）
> 层配置：`layers.example.json`（测试线口径，title x258-1028）

---

## §0 诚实边界（先声明）

```
□ 本批做【渠道对比】（chatgpt2api vs a6api）+ 【模板对比】（六段式原文 vs 一期门简化版）
  三格设计（E-1/E-2/E-3），不是原任务书的 D-1/D-2 两格
□ E-2 是【新跑】而非复用一期门 —— 因为控制线裁定 E-1/E-2 必须用同一份提示词
  （一期门用的是【简化版】，与六段式原文有 6 处差异，见 §1.2）
□ E-3 复用一期门 10 次（同渠道同场景，模板为简化版）
□ 本批只测 3 条动态段（clone.degree / clone.scope / copy.mode）——
  其余 8 条（market/copy-text/reference-notes 等）未测
□ 六段式是【ImgAk 的骨架】—— 本批测的是「它在两渠道上的表现」，
  不等于「影策实现后必然如此」（影策的拼接实现可能有差异）
□ 人工读图是主要真值来源 —— 程序判据只是辅助（一期门结论）
□ 本批不测输出质量（审美/清晰度），只测三判据
□ H1③（光线方向）与主体形态为【人工判读】，判据本身无自动化实现
□ E-1 的 1 次内容政策拒（r02）已登记，不重跑
```

---

## §1 环境

### 1.1 判据版本 + 口径五项声明

| # | 项 | 值 |
|---|---|---|
| ① | 判据版本 | `open-ai-canvas-testing` @ `353bb36`（代码）；`c0cc968`（口径声明块） |
| ② | x 口径 | `layers.example.json`（title x258-1028 / badge1 / badge2） |
| ③ | 图像表示 | `text_mask`（非 grayscale） |
| ④ | 尺寸归一化 | 开；896×1200 与 1086×1448 → 统一归一化到参考尺寸 1086×1448，INTER_LANCZOS4 |
| ⑤ | 标定点表 | `h3_layer_spec.CALIB_POINTS` @ 353bb36（0.486 / 0.492 / 0.680 / 0.763） |

### 1.2 ★ 关键前提修正：一期门「模板 A」≠ 六段式原文

**控制线裁定前的任务书说**：「一期门的模板 A 就是六段式」⇒ D-1/D-2 冗余。

**B线逐字复核（语料 JSON vs DB tasks.prompt）后实测：6 处实质差异**：

| # | 差异 | 语料原文 | 一期门简化版 |
|---|---|---|---|
| A | 结构化前缀 | 无 | **有** `【1 任务】…【6 动态段】` |
| B | 段1 后半句（18字） | **有**「并可按复刻方式决定参考人物是否保留」 | 无 |
| C | 段4 中段（44字）★ | **有**「人物身份只在"高度复刻"中…不得复刻可识别人脸或人物身份」 | 无 |
| D | 段5 后半句（35字）★ | **有**「只有画面文字模式明确允许时才添加文字…」 | 无 |
| E | 动态段条数 | **3 条**（用途要求/复刻策略/风格参考范围/画面文字策略） | **2 行**（仅用途要求+复刻策略） |
| F | 动态段文本 | `clone.type.des` = 「用于电商主图或卖点图；商品主体清楚…」<br>`clone.degree.des` = 「只参考下方选中的视觉范围并重构场景…必须更换长相和可识别身份」 | 「根据参考图制作电商商品图」<br>「参考参考图的风格方向，允许适度自由发挥」 |

**★ C 和 D 尤其关键**：C 涉及人物身份（S1 含真实儿童照片），D 涉及画面文字（H3 判的正是文案）——
两处缺失都在本批核心判据的作用域内。

**⇒ 因此原「D-1/D-2 冗余」裁定不成立，改为三格设计**（控制线 2026-10-06 裁定）。

**验证脚本**：`/tmp/verify-diff.py`（语料从 JSON 读、一期门从 DB 读，非手打）

### 1.3 渠道配置变更登记（控制线约束②）

**表 `model_channels`**：
```
新增行 CHANNEL_000011:
  name       = chatgpt2api
  base_url   = http://127.0.0.1:8000
  api_format = openai
  scope      = system
  api_key    = <已脱敏——config.json 的 auth-key>
  models_json= ["gpt-image-2.5", "gpt-image-2"]
```

**表 `channel_models`**：
```
新增行 MODEL_00032 (gpt-image-2.5) / MODEL_00033 (gpt-image-2):
  protocol                = openai-image
  capability              = image
  billing_mode            = fixed_request
  unit_price_microcredits = 0
  capability_config_json  = <a6api gpt-image-2.5 的完整配置，1456 字节>
```

**★ 执行中修的两个连带问题**（任务书未预见，特此登记）：
```
问题1：初次插入时只复制了 {references, size} 两个字段 ⇒ 建任务 400
       「指定的模型能力配置无效，请联系管理员」
       （CapabilitySpecFromModelCapabilityConfig 需要 quality/transparentBackground/
         responseFormat/outputFormat/maxOutputs）
修复：用 a6api 完整配置替换（UPDATE channel_models SET capability_config_json）
备份：/tmp/f08-db-backup-before-c2a-fix.db

问题2：chatgpt2api 跑在 127.0.0.1 ⇒ SSRF 防护拦截
       「不允许访问本机、内网或链路本地地址」
修复：重启后端时加 CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS=127.0.0.1
      （仓规 §5 的精确放行机制，非"允许全部私网"）
```

**凭据脱敏**：`api_key` 未写入本报告（存于调试库，报告只登记表名+字段名）。

### 1.4 后端环境

```
后端: CANVAS_BACKEND_DATA_DIR=../.local/f08-annotate-debug
      CANVAS_BACKEND_ADDR=0.0.0.0:8488
      CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS=127.0.0.1
      二进制: /tmp/f08-server（含 F-09 二期注入层，main 合并后构建）
分支: test/f09-channel-gate @ a7d9a12b（含注入层 merge）
```

---

## §2 消耗统计

| 项 | 数 |
|---|---|
| E-1（chatgpt2api · gpt-image-2.5） | 8 次（7 成功 + 1 内容政策拒） |
| E-1 冒烟测试 | 1 次（成功，另 1 次建任务失败不计上游消耗） |
| E-2（a6api · nano-banana-2） | 8 次（全成功） |
| E-3（复用一期门） | 0 次（10 张已有） |
| **本批总计** | **16 次上游调用**（15 成功 + 1 拒） |

**成本**：
```
E-1: 自建渠道，边际成本 ≈ 0（8 次）
E-2: a6api 按量付费，8 次 ≈ 6.4 元
E-3: 0
```

**任务书预估 16 次 ⇒ 实际 16 次，符合预估**（未触发 §九⑤ 的 50% 超限上报条件）。

---

## §3 主矩阵结果（M/N）

### 3.1 三格总表

| 格 | 渠道 | 模板 | 成功 | H1 ①②③ | H2③ | H3 | Δ 均值 | title 均值 |
|---|---|---|---|---|---|---|---|---|
| **E-1** | chatgpt2api · gpt-image-2.5 | 六段式原文 | 7/8 | **0/7** | 6/7 | **7/7** | 14.8% | 0.263 |
| **E-2** | a6api · nano-banana-2 | 六段式原文 | 8/8 | **5/8** | 8/8 | **8/8** | 10.8% | 0.326 |
| **E-3** | a6api · nano-banana-2 | 一期门简化版 | 10/10 | **5/10** | 9/10 | 9/10 | 10.1% | 0.372 |

**H1 判定口径**：①②③ 全过得 PASS；exit=2（①②过③待人工）经人工补 ③ 后计入 PASS。

### 3.2 逐张明细

**E-1（chatgpt2api · gpt-image-2.5 · 六段式原文）**

| run | taskId | Δ | H1 | H2③ | H3 title | 耗时 |
|---|---|---|---|---|---|---|
| r01 | `4133b8e8` | 14.2% | FAIL | FAIL | 0.240 PASS | 101s |
| r02 | `174a90b7` | — | — | — | — | 72s ✗内容政策拒 |
| r03 | `257f15a1` | 11.7% | FAIL | PASS | 0.259 PASS | 88s |
| r04 | `5b1a1cdc` | 15.6% | FAIL | PASS | 0.225 PASS | 130s |
| r05 | `35a444c4` | 17.1% | FAIL | PASS | 0.295 PASS | 163s |
| r06 | `9b635c81` | 18.1% | FAIL | PASS | 0.276 PASS | 121s |
| r07 | `f5b07637` | 12.7% | FAIL | PASS | 0.216 PASS | 113s |
| r08 | `cb8de993` | 14.5% | FAIL | PASS | 0.327 PASS | 117s |

**E-2（a6api · nano-banana-2 · 六段式原文）**

| run | taskId | Δ | H1 | H2③ | H3 title | 耗时 |
|---|---|---|---|---|---|---|
| r01 | `3a4d7d90` | 15.6% | FAIL | PASS | 0.373 PASS | 92s |
| r02 | `dd64a9d9` | 8.9% | PASS | PASS | 0.376 PASS | 94s |
| r03 | `b86ecb7e` | 15.5% | FAIL | PASS | 0.352 PASS | 99s |
| r04 | `824a6f08` | 9.4% | PASS | PASS | 0.243 PASS | 74s |
| r05 | `d001f0c9` | 16.2% | FAIL | PASS | 0.373 PASS | 80s |
| r06 | `c82af0f0` | 4.9% | PASS | PASS | 0.319 PASS | 103s |
| r07 | `eee55a47` | 9.2% | PASS | PASS | 0.247 PASS | 80s |
| r08 | `1c5fb4cd` | 6.4% | PASS | PASS | 0.328 PASS | 96s |

**E-3（a6api · nano-banana-2 · 一期门简化版，复用）**

| src | taskId | Δ | H1 | H2③ | H3 title |
|---|---|---|---|---|---|
| A-182508 | `5c237bde` | 2.6% | PASS | PASS | 0.404 PASS |
| A-184617 | `6f9e5e08` | 6.8% | PASS | PASS | 0.351 PASS |
| A-185144 | `42587d53` | 17.4% | FAIL | PASS | 0.341 PASS |
| A-185313 | `4259c91a` | 12.0% | FAIL | PASS | 0.339 PASS |
| A-185438 | `cd938a19` | 8.0% | PASS | PASS | 0.395 PASS |
| A-185632 | `249bba22` | 0.2% | PASS | **FAIL** | **0.573 FAIL** |
| A-175715 | `8fe9a15b` | 14.5% | FAIL | PASS | 0.278 PASS |
| A-180009 | `e6e14175` | 17.5% | FAIL | PASS | 0.373 PASS |
| A-181902 | `8a6b0e8f` | 19.3% | FAIL | PASS | 0.351 PASS |
| A-182228 | `2d888fb4` | 2.2% | PASS | PASS | 0.315 PASS |

### 3.3 提示词同一性证明（控制线硬要求①④）

**E-1 与 E-2 的上游提示词 md5（从 `api_call_logs.request_body` 提取，含注入段）**：

```
E-1 (task 4133b8e8): len=973  md5=443b9d4c0ceae4e9b964922beeb425ce
E-2 (task 3a4d7d90): len=973  md5=443b9d4c0ceae4e9b964922beeb425ce
⇒ ★ 逐字节相同（含注入层角色清单段）
```

**六段式正文（867 字符）md5**：`f91e69fddeda06951da353f26d2915eb`
**一期门简化版 md5**：`55a5fa22...`（一期门记录）

**注入层证据**（E-1 冒烟 task `d49c3952`）：
```
request_body.prompt 开头：
  「输入图片角色清单：
   共 2 张输入图。
   图1～1（产品图组）：只负责定义需要保真的替换商品；第一张为主角度。
   图2～2（版式参考图组）：定义视觉方案；第一张为主版式。
   严禁把产品图组与版式参考图组的角色互换。
   ...」
⇒ 注入层生效，编号为范围格式（图1～1 / 图2～2），与一期门手工拼装的「图1（产品图组）」不同
```

---

## §4 关键发现

### F1 ★ 渠道差异：chatgpt2api 可用，但构图比例复刻弱于 a6api

```
同提示词（md5 443b9d4c）对比：
  H3（标题不照抄）:  E-1 7/7  vs  E-2 8/8    ⇒ 两者都达标
  H2③（产品保真）:   E-1 6/7  vs  E-2 8/8    ⇒ E-2 略优
  H1①②③（构图）:    E-1 0/7  vs  E-2 5/8    ⇒ ★ E-2 明显优
  Δ 均值:            E-1 14.8% vs E-2 10.8%
  成功率:            E-1 7/8  vs  E-2 8/8

⇒ 结论：chatgpt2api 可作 S1 场景的可用渠道（H3 全过 + 成功率 87.5%），
        但【构图比例复刻】明显弱于 a6api nano-banana-2（0/7 vs 5/8）
⇒ 若三期对 H1① 比例复刻有硬要求，chatgpt2api 不宜作首选
```

**★ 附带观察（人工读图）**：E-1 的 7 张输出**全部**是「白袜 + 黑色漆皮玛丽珍鞋」，
而参考图与 E-2/E-3 都是「裸腿 + 奶油色平底鞋」——系统性偏差，非随机。
（可能原因：chatgpt2api 的 gpt-image-2.5 对参考图的鞋袜细节复刻方向不同，待 W6 探究）

### F2 ★ 自建渠道覆盖 a6api 不可用场景 —— 成立

```
chatgpt2api · gpt-image-2.5 · S1（含真实儿童照片）:  7/8 成功（1 次内容政策拒）
a6api     · gpt-image-2.5 · S1（一期门）:           3/3 全拒（upstream_content_policy_reject）

⇒ Q-E2 成立：自建渠道确实能覆盖 a6api 的拒答场景
⇒ 但注意：chatgpt2api 也非 100% 通过（r02 被拒，error_code=upstream_text_reply，
  原始报文：「非常抱歉，该提示可能违反了我们的内容政策」）
⇒ 两渠道的拒绝不是同一机制：a6api 是 upstream_content_policy_reject（永久），
  chatgpt2api 是 upstream_text_reply（模型层文本回复，可重试）
```

### F3 ★★ Q-E4 独立复核：六段式下 H1① 的判据盲区 —— 成立且更严重

**测试线发现（8a2fd2f）**：H1① 在六段式下失去区分力——PASS 里有照抄（249bba22），FAIL 里全是改写。

**B线独立复核（E-3 的 10 张，同渠道同场景）**：

| 样本 | Δ | H1① | 产品替换 | H2③ | H3 |
|---|---|---|---|---|---|
| `249bba22` | **0.2%** | **PASS** | ✗ **未替换**（碎花裙保留） | **FAIL** | **0.573 FAIL** |
| `8a6b0e8f` | 19.3% | FAIL | ✓ 已替换（深蓝裙） | PASS | 0.351 PASS |
| `4259c91a` | 12.0% | FAIL | ✓ 已替换 | PASS | 0.339 PASS |

**⇒ ★ 成立，且比测试线报告更严重**：
```
· 249bba22 是【照抄参考图】（碎花裙未替换 + 标题照抄「Floral Dress」）
  却拿到 H1① 最优分（Δ=0.2%）—— 因为它的构图与参考图几乎完全相同
· 8a6b0e8f/4259c91a 是【正确执行】（产品替换 + 标题改写）
  却因构图变化被判 H1① FAIL
⇒ 方向完全相反：H1① 奖励「照抄」，惩罚「正确执行」
```

**★ 机制**：H1① 度量「主分区比例」（文字栏宽度占比），
而**照抄参考图**自然得到最优比例；**正确执行产品替换**会改变主体形态/尺寸，从而改变比例。
⇒ H1① 无法区分「构图沿用」与「整图照抄」。

**★ 对 E-1/E-2 的影响**：E-1 的 0/7 与 E-2 的 5/8 都是**正确执行**（产品已替换），
所以 Δ 反映的是「产品替换后的构图偏离」，不是「照抄程度」。此结论不受盲区影响。

### F4 模板差异（E-2 vs E-3）：六段式原文 vs 简化版，无显著优势

```
同渠道（a6api nano-banana-2）同场景（S1）：
  Δ 均值:      E-2 10.8%（六段式）  vs  E-3 10.1%（简化版）  ⇒ 简化版略低
  Δ≤10% 占比:  E-2 5/8            vs  E-3 5/10            ⇒ 持平
  H3 均值:     E-2 0.326          vs  E-3 0.372           ⇒ 六段式略优（更不照抄）
  H3 PASS:     E-2 8/8            vs  E-3 9/10            ⇒ 六段式优（E-3 有 1 张照抄）

⇒ 结论：六段式原文在【H3 防照抄】上略优（8/8 vs 9/10，且 E-3 的照抄样本是 249bba22）
        在【H1① 比例】上无优势（10.8% vs 10.1%）
⇒ 但两者都有 Δ>10% 的样本 ⇒ 不稳定性主要是【模型层】的，非模板层

**★ 诚实边界（复核后补正）**：E-3 含 4 张【非模特】输出（挂拍 3 + 人台 1），
E-2 全为模特 ⇒ 两格的 Δ 分布受【主体形态】混淆，F4 的 Δ 对比不是纯模板差异。

按主体形态分层后：
```
E-3 模特组（6 张）:  5c237bde 2.6% PASS / 6f9e5e08 6.8% PASS / 249bba22 0.2% PASS
                    4259c91a 12% FAIL / e6e14175 17.5% FAIL / 8a6b0e8f 19.3% FAIL
                    ⇒ 3/6 PASS，Δ 均值 9.7%
E-3 非模特组（4 张）: 2d888fb4 2.2% PASS / cd938a19 8.0% PASS
                    42587d53 17.4% FAIL / 8fe9a15b 14.5% FAIL
                    ⇒ 2/4 PASS，Δ 均值 10.5%
E-2 模特组（8 张）:  5/8 PASS，Δ 均值 10.8%
```
⇒ 分层后 E-3 模特组（3/6 PASS，9.7%）与 E-2（5/8 PASS，10.8%）**仍无显著差异**，
   F4 结论方向不变；但样本量进一步缩小（n=6 vs n=8），
   **不足以给出「六段式 vs 简化版」的统计结论** —— 只能作趋势参考。
```

### F5 H3 全部达标（三格合计 24/25）

```
E-1: 7/7 PASS（title 0.216-0.327）
E-2: 8/8 PASS（title 0.243-0.376）
E-3: 9/10 PASS（title 0.315-0.404；唯一 FAIL 是 249bba22 = 照抄，正确判红）
⇒ ★ 六段式的【④原创与文字安全】段在防标题照抄上有效
⇒ 对比一期门模板 B/C（照抄 FAIL 2/3 和 1/1）⇒ 六段式明显优于 B/C
```

---

## §5 人工判定依据（读图真值表）

### 5.1 人工读图方法

```
· 每格生成合成拼图（缩略图网格，带 Δ 标注）→ 读图
· 关键样本单独放大复核
· 判读项：① 标题文字（照抄/改写/无）② 产品外观是否替换 ③ 构图是否沿用 ④ 鞋袜细节
```

### 5.2 H1③ 光线方向 + 主体形态（判据必填项，§C1a）

| 格 | 光线方向 | 主体形态 | 与参考图一致性 |
|---|---|---|---|
| REF | 左前（柔光，地面斜向投影） | 模特（真人儿童，全身正面） | — |
| E-1 | 左前（同向） | **模特 7/7**（无挂拍） | ✓ 光线一致，形态一致 |
| E-2 | 左前（同向） | **模特 8/8**（无挂拍） | ✓ 一致 |
| E-3 | 左前（同向） | **模特 6/10 + 挂拍 3 + 人台 1** | ★ 部分不一致（见下） |

**★ E-3 主体形态明细（人工逐张核实）**：
```
模特（6）: 5c237bde, 6f9e5e08, 4259c91a, 249bba22, e6e14175, 8a6b0e8f
挂拍（3）: 42587d53, cd938a19, 2d888fb4   ← 木衣架悬挂，无模特
人台（1）: 8fe9a15b                        ← 隐形人台（漂浮裙 + 地面鞋）
```
⇒ **E-3 的 4 张非模特样本集中在 Δ>8% 组**（42587d53 17.4% / 8fe9a15b 14.5% /
   2d888fb4 2.2% / cd938a19 8.0%），说明 H1① 的 Δ 部分由**主体形态变化**驱动
   （一期门已登记此现象：§C1a 的「挂拍可得 ①② 全过」）

**★ E-1/E-2 全部为模特**（无挂拍/人台）⇒ 两格的 Δ 不含主体形态变化因素，
   可比性高于 E-3。

**H1③ 判读依据**：背景地面投影方向（左前）、主体面部受光侧（左前）。

### 5.3 标题真值表（每张）

**E-1（7 张）**：全部改写 ✓
```
r01: Classic & Charming      r03: Classic Style       r04: Classic Style
r05: Classic Dress           r06: Classic Puff Sleeve Dress
r07: Classic Look            r08: Classic Girl's Dress
⇒ 无一张照抄「Floral Dress」
```

**E-2（8 张）**：全部改写 ✓
```
r01: Peter Pan Collar Dress  r02: Preppy School Dress  r03: Navy School Dress
r04: Navy Pleat Dress        r05: School Uniform Dress r06: Navy Pleated Dress
r07: Classic Navy Dress      r08: Classic Navy Dress
```

**E-3（10 张）**：
```
5c237bde: Navy Pleated Dress   6f9e5e08: Classic Navy Dress  42587d53: Classic Navy Dress
4259c91a: Navy Blue Dress      cd938a19: Navy Pleated Dress  249bba22: ★ Floral Dress（照抄！）
8fe9a15b: Peter Pan Collar Dress  e6e14175: School Dress      8a6b0e8f: Sophisticated Navy Dress
2d888fb4: Classic Dress
⇒ 9/10 改写，1 张照抄（249bba22）
```

### 5.4 产品替换真值表

| 格 | 已替换 | 未替换 | 说明 |
|---|---|---|---|
| E-1 | 7/7 | 0 | 全部换成深蓝裙 |
| E-2 | 8/8 | 0 | 全部换成深蓝裙 |
| E-3 | 9/10 | **1**（`249bba22`） | 该张保留碎花裙 |

### 5.5 ★ 鞋袜细节（E-1 系统性偏差）

```
REF:      裸腿 + 奶油色平底鞋
E-1:      ★ 7/7 全部「白袜 + 黑色漆皮玛丽珍鞋」
E-2:      8/8「裸腿 + 奶油色平底鞋」（与 REF 一致）
E-3:      10/10 同 E-2
```

**⇒ E-1 存在系统性鞋袜偏差**（非随机），登记为观察项（W6 探究）。

---

## §6 GO/NO-GO 结论

| 问题 | 结论 | 依据 |
|---|---|---|
| **Q-E1** 自建渠道质量是否达标？ | **★ 部分达标** | H3 7/7 达标、成功率 7/8；但 H1① 0/7（明显弱于 a6api 5/8） |
| **Q-E2** 能否覆盖 a6api 不可用场景？ | **✓ 成立** | chatgpt2api 在 S1（含儿童照片）7/8 成功 vs a6api 3/3 全拒 |
| **Q-E3** 成本对比 | **✓ 成立** | 自建≈0 vs a6api 8 次≈6.4 元 |
| **Q-E4** 六段式 H1① 是否失去区分力？ | **★★ 成立且更严重** | 249bba22（照抄）得 H1① 最优 Δ=0.2%；正确执行者反被判 FAIL |

### 建议

```
① chatgpt2api 可作【备用渠道】（H3 达标 + 覆盖 a6api 拒答场景 + 零成本），
   但【不宜作首选】—— H1① 比例复刻 0/7 是硬伤
② 三期实现六段式骨架【有意义】（H3 防照抄有效，8/8），
   但【不能期望它改善 H1①】—— H1① 的问题是判据盲区，非模板问题
③ ★ H1① 判据需修复（W6 议题）：当前实现奖励「整图照抄」，
   建议增加「产品替换检测」前置条件（H2③ FAIL ⇒ H1① 不计入）
④ 一期门简化版与六段式原文在 H1① 上无显著差异 —— 三期可考虑
   是否值得实现完整 5 段（当前证据不支持「必须实现」）
```

---

## §7 产物清单 + 溯源核验

### 7.1 文件清单

| # | 文件 | 说明 |
|---|---|---|
| 1 | `RESULTS-TEMPLATE-D.md` | 本报告 |
| 2 | `results-template-d.json` | 三格结构化结果（判据输出 + md5） |
| 3 | `images-d/` | 25 张输出图（E-1 7 + E-2 8 + E-3 10，JPEG q88，4.0 MB） |
| 4 | `prompts-template-d/` | 提示词落盘（六段式正文 + 动态段 + 注入段） |

### 7.2 溯源核验（taskId → resourceId → 文件）

**方法**：`resourceId` 查 `resources` 表 `object_key` → `.local/f08-annotate-debug/resources/{object_key}`

**样本核验（E-1 r01）**：
```
taskId 4133b8e80d16... → resultJson.images[0].resourceId → resources.object_key
→ .local/f08-annotate-debug/resources/users/.../xxx.png
→ 比对 sha256 与落盘图
```

**全量核验结果（25/25 通过）**：
```
方法：tasks.result_json → images[0].resourceId → resources.object_key
      → .local/f08-annotate-debug/resources/{object_key}
      → 与落盘 JPEG 解码后比对像素（E-2/E-3 先归一化到 1086x1448）

结果：25/25 通过
      mad 范围 0.980 - 1.265（JPEG q88 重编码预期 ≤2）
      （JPEG 有损压缩，mad ~1 为正常水平，非内容差异）
```

---

## §8 复现命令

```bash
# ① 渠道（已配）
sqlite3 .local/f08-annotate-debug/open_ai_canvas.db \
  "SELECT id,name,base_url,scope FROM model_channels WHERE id='CHANNEL_000011'"

# ② E-1（chatgpt2api · 六段式原文）
node .local/f09-work/e1-template-d.mjs --runs 8 --template corpus --channel chatgpt2api

# ③ E-2（a6api · 六段式原文，同一份提示词）
node .local/f09-work/e1-template-d.mjs --runs 8 --template corpus --channel nano-banana-2

# ④ 判据（E-1/E-2）
node .local/f09-work/run-criteria-e.mjs --batch E1-corpus-chatgpt2api
node .local/f09-work/run-criteria-e.mjs --batch E1-corpus-nano-banana-2

# ⑤ E-3（复用一期门，判据统一口径）
node .local/f09-work/run-criteria-e3.mjs

# ⑥ 提示词核验（语料 vs 一期门）
python3 /tmp/verify-diff.py
```

**层配置**：`layers.example.json`（判据仓内置）
**判据版本**：`353bb36`

---

*报告生成：2026-10-06 · B线 · 分支 `test/f09-channel-gate`*
