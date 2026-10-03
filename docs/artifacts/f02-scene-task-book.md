# F-02 商品场景图 / 背景替换 任务书（B线 Wave2 第二枝）

> 控制线拟，2026-10-03。A线执行。
> 设计输入：本任务书 = `docs/artifacts/f02-scene-inputs.md`（2026-09-30 控制线预整理）＋ 验收口径 ＋ 渠道实测门。
> 语料：`docs/artifacts/flora-techniques-deep-dive/`（Product in Scene Generator / Relighting）、`docs/artifacts/community-intel-upstream-ecom-2026-09-30.md`（降智情报）。
> 排期锚点：W4 尾提前开枝（v1.8 §12）；W5 收尾。
> 开枝：`feat/ecom-f02-scene` @ worktree `oac-wt-f02`，起点 `7e19af47`。

---

## 一、范围

**本枝做**：商品图 → 场景图（背景替换/商品入景）的**云端生成链路**，两段式提示词管线（LLM 出结构化 spec → 凝缩喂图像模型）＋ `@[ref]` 角色声明 ＋ mask 语义预写 ＋ 降智退化预案。

**本枝不做**（留钩子，不实现）：
- **Relighting / Relighting Photoshoot** —— 与 F-07 共享语料，归 F-07（本批只做 Scene）
- 本地能力（场景图无本地档，纯云）
- 批量场景图（F-12）
- 直线入口的最终设计（W5 设计卡出稿后统一，本批只做过渡形态）

---

## 二、硬约束（红线，违反即 STOP）

1. **咽喉纪律**：`use-canvas-media-tools.ts` / `canvas-image-toolbar-tools.tsx` / `routes.go` 咽喉**当前无持有者**（F-01 已合入 main），本枝独占——但 W5 起 B 线 F-08 同碰，**让位规则照 v1.8 §12**（F-02 收尾优先，F-08 进实现段时错峰）。
2. **样式面**：flora-overrides 已合入 main。**F-02 样式一律走 `flora-overrides.css` 或 `flora-tokens.css` 追加，禁直改 `globals.css`**。PATCH-MAP 登记。
3. **命名红线**：避开上游 Agent 技能域「**场景胶囊**」语义（`AGENT_SCENE_DEFS` 占用）。一律用「**商拍场景**」/「**场景图**」限定词。
4. **统一任务面**：云任务呈现走既有任务面模式，**执行位置只作元数据标签**（「云端 · X 积分」），**不单独造 UI**（输入清单 §6，用户拍板）。
5. **入口复用**：复用休眠 starter 数据层（`canvas-ecom-starters.ts` 场景卡），**数据与匹配语义沿用，不新造**。入口呈现可先过渡形态（Agent 面板 chip / `/create` 页），W5 直线入口设计卡出来后统一——**两步走**。
6. **尺寸**：走 `ECOM_CHANNEL_PRESETS`（`image-size-presets.ts`），不新造尺寸体系。
7. **文案红线**：不承诺「100% 还原商品」；场景图是**环境合成**，商品本体保真度受渠道模型能力约束，弱渠道降级期须有可读提示。

---

## 三、渠道实测门（★ 开工第一件事，先于实现）

输入清单 §3：低价号池常跑同款模型名，便宜来自套利非降质——**但不可假设**。

**动作**：用目标渠道跑 **3-5 张样本**，实测 spec 遵循度，据实定 spec 长度。
**渠道**（实测锚点，来自 f06-hb 调试库 `oac-wt-f06-hb/.local/f06-hb-debug/open_ai_canvas.db`）：

| 渠道 | 模型 key | 协议 | 备注 |
|---|---|---|---|
| `CHANNEL_000009` a6api | `gpt-image-2.5` | openai-image | 主力候选 |
| `CHANNEL_000009` a6api | `nano-banana-2` | **a6api-image**（本仓定制插件） | 非标准回包（chat 壳 + 文本 URL） |
| `CHANNEL_000009` a6api | `gpt-image-2.5-sunburst` | openai-image | |
| `CHANNEL_000010` a6api-4k | 同上三个 | 同上 | 4K 档 |
| `CHANNEL_000005` f06-ddcat | `gpt-image-2.5` / `nano-banana2` | openai-image / gemini-image | 备选（余额可能见底） |
| `CHANNEL_000008` 八方 | `gpt-image-2.5-sunburst` | openai-image | 备选 |

**判据**：
- Flora 原文按 Opus / NB-Pro 调，spec 偏长（① 3421 ch → ② 1254 ch）。
- **遵循度打折 → spec 砍到 2-3K**（输入清单 §3 原文）。
- 实测结果（样本图 + 遵循度结论 + spec 长度决定）**记入本任务书 §渠道实测**。

**STOP 条件**：目标渠道**全部不可用**（余额/鉴权/协议失败）→ STOP-report，控制线裁决。

---

## 四、实现范围（按输入清单 §1-§6）

### 4.1 两段式提示词管线（§1 范式 3）

```
① LLM 节点（textToText / imageToText）
   输入：商品图 + 简短意图（场景卡）
   输出：完整结构化 spec（Flora 实测 3421 ch / 5000-9000 字符）
   ↓
② 凝缩（本枝关键工程点）
   900-1500 字喂图像模型（Flora 实测 1254 ch）
   ↓
③ imageToImage 节点（Nano Banana Pro / gpt-image-2.5）
   输入：商品图 + ① 凝缩后的 spec
   输出：场景图
```

**凝缩实现**：LLM 二次调用产出，或规则化抽取 spec 关键段（商品描述 / 场景 / 光照 / 构图）。**倾向规则化抽取**（省一次调用、降智期更稳），实测后定。

### 4.2 `@[ref]` 角色声明（§1，全文照做，防误用条款逐字保留）

Flora 原文（`FULL-DATA-REPORT.md` L216-222，**逐字**）：

```text
INPUT ROLES:
@[flatlay-garment] = GARMENT_REFERENCE. ROLE: exact garment reproduction only.
Capture the fabric, wash, color, proportions, and every construction detail
with absolute fidelity. Ignore any accessories, jewelry, props, belts, scarves,
or items on or near the garment—reproduce the garment alone.
Take no background, environment, or context from it.
```

**场景图适配**（本枝落点）：
```text
INPUT ROLES:
@[product] = PRODUCT_REFERENCE. ROLE: exact product reproduction only.
Capture the material, finish, color, proportions, and every construction detail
with absolute fidelity. Ignore the background, surface, and lighting of the reference.
Take no scene, environment, or context from it.

@[scene] = SCENE_REFERENCE. ROLE: environment and lighting only.
Take the surface, surrounding props, illumination style, and atmosphere from it.
Do NOT treat it as a second subject — do not copy its objects into the output.
```

★ **防误用条款是核心**：`Do NOT treat it as a second subject` —— 防模型把场景图当第二个主体（输入清单 §1 原话）。

### 4.3 mask 语义预写（§1 范式 2）

Flora 原文（`FULL-DATA-REPORT.md` L237-242，**逐字**）：

```text
Input Roles:
- BASE_IMAGE (Image 1): Owns the garment, its presentation, composition, shape,
details, lighting, and all non-edited pixels
- GARMENT_MASK (Image 2): a cutout of Image 1. Only the pixels to recolor are
visible; everything else is transparent and may render as black.
It is a selection, not a reference photo of the garment.
- TARGET_COLOR: the color reference (what color to apply)
```

★ **两个预写要点**（`FULL-DATA-REPORT.md` L255）：
1. `It is a selection, not a reference photo` —— 显式声明蒙版不是参考图
2. `transparent and may render as black` —— **透明渲染为黑的坑要预写**（模型常见误解的预防性说明）

**本枝适用性**：场景图 v1 若不需 mask（整图换景），此段**作为预写保留在管线中**（F-01 抠图产出可作 mask 输入，形成 F-01→F-02 串联）。

### 4.4 降智预案（§2，社区情报 2026-09-30）

**背景**：上游群 Elio 实测「gpt 降智 → 内置提示词很垃圾」。两段式依赖 LLM 质量，低价号池降智期会伤 spec 生成。

**预案**：**preset spec 模板化**——预凝缩 spec（900-1500 字成品）直接入模板，**LLM 只做变量填充**（商品名/材质/目标场景），**不做全程生成**。

**模板来源**（Flora `Product in Scene Generator` 逐字原文，`contentPackaging.json`）：

```text
A detailed still life of [Insert Product Name and Materials], resting gracefully
on [Insert Surface Type]. The item is situated within a [Insert Lifestyle Scenario],
surrounded by subtle contextual props such as [Insert 1 to 2 Complementary Objects].
The scene is illuminated by [Insert Lighting Style] to highlight the product textures
perfectly. The overall atmosphere feels [Insert Mood or Vibe]. The composition is
entirely unpopulated and devoid of people, focusing purely on the product in its
natural environment, captured in photorealistic detail with depth of field.
```

**实例**（Flora 原文）：
> A detailed still life of a vibrant pastel pouch of Pretzy Birthday Cake flavored chocolate-covered pretzels, resting gracefully on a crisp white linen tablecloth. The item is situated within a lively party celebration, surrounded by subtle contextual props such as scattered metallic star and circle confetti, party blowouts, silver serving plates, and crystal champagne flutes. The scene is illuminated by bright, direct lighting that casts strong, distinct shadows to highlight the product textures perfectly. The overall atmosphere feels joyful, festive, and energetic. The composition is entirely unpopulated and devoid of people, focusing purely on the product in its natural environment, captured in photorealistic detail with depth of field.

**退化路径可测**：降智期自动退化为「模板 + 变量」模式，出图下限可控（验收②）。

### 4.5 商品图角色声明（Flora 原文）

```text
use the first image as reference for product, and use the second image as
reference for loose scene/photography/style reference
```
（`contentPackaging.json` nodeId `1c5959a3`，Gemini 3.1 Pro / imagesToText）

---

## 五、文件清单（锚点 2026-10-03 实核，main @ 7e19af47）

**新增**（预计）：
| 文件 | 职责 |
|---|---|
| `web/src/lib/canvas/scene-prompt-pipeline.ts` | 两段式管线：spec 组装 / 凝缩 / `@[ref]` 声明 / mask 语义段 |
| `web/src/lib/canvas/scene-spec-templates.ts` | preset spec 模板 + 变量填充（降智退化档） |
| `web/src/lib/canvas/scene-presets.ts` | 场景卡数据（复用 starter 场景卡语义，扩展场景类型） |
| `web/src/services/api/scene-generation.ts`（或并入既有） | 渠道调用封装（若需） |
| 单测 | 管线纯逻辑（凝缩长度 / 变量填充 / 角色声明生成 / 退化档切换） |

**修改**（预计）：
| 文件 | 改动 |
|---|---|
| `web/src/lib/canvas/canvas-ecom-starters.ts` | 场景卡数据沿用；如需扩展场景类型则加字段（不改匹配语义） |
| `web/src/components/canvas/canvas-cloud-agent-chat-ui.tsx` | 入口过渡形态（chip 渲染已有 `findEcomStarterCardByPrompt` 反查） |
| `web/src/styles/flora-overrides.css` | 新 UI 面样式（**不碰 globals.css**） |
| `PATCH-MAP.md` | 新面登记 |

★ **咽喉文件触碰范围待实测后定**（倾向零触碰或最小触碰）。

---

## 六、用户面约束（铁律）

1. **入口**：复用休眠 starter 数据层（`canvas-ecom-starters.ts` 的 `scene` 卡，id `"scene"`，title「商品场景图」）。入口呈现**可先过渡形态**（Agent 面板 chip / `/create` 页），**W5 直线入口设计卡出来后统一**——两步走须在本任务书写明（**已写明**）。
2. **统一任务面**：云任务呈现走既有任务面模式（`canvas-active-task-panel.tsx` / `canvas-workspace-task-panel.tsx` / `task-center.ts`），**执行位置只作元数据标签**（「云端 · X 积分」），不单独造 UI。
3. **直线流程**：上传 → 选场景 → 出图，画布自由度可选渐进展开；尺寸走 `ECOM_CHANNEL_PRESETS`。
4. **命名**：「商拍场景」/「场景图」，避开「场景胶囊」。

---

## 七、验收口径（v1.8 §8 纪律：用户能在哪一步看到它）

1. **真机直线流程**：上传商品图 → 选场景卡 → 出图**全链截图**
2. **降智退化可演示**：模拟弱渠道（或短 spec 模式）出图下限可接受
3. **统一任务面入口可见**：任务列表有场景图任务条目（**元数据标签正确**）
4. **门禁照旧**：tsc / lint / 全量 test / build ＋ 相关守卫
5. **渠道实测记录**：3-5 张样本 ＋ 遵循度结论 ＋ spec 长度决定

---

## 八、门禁（house style）

1. `web/` 目录内 `bun test` 全量（**目录敏感教训：仓根跑会静默丢 24 条**）
2. `tsc --noEmit` / `eslint` / `build` 全绿
3. 新增单测（纯逻辑零 DOM）：管线凝缩 / 变量填充 / `@[ref]` 声明生成 / mask 语义段 / 退化档切换
4. focused guards：既有 media-conversion / starter 相关测试
5. 真机自验：直线流程全链 + 统一任务面标签
6. **PATCH-MAP 登记**（新 UI 面）

---

## 九、纪律

- worktree `oac-wt-f02`（分支 `feat/ecom-f02-scene`）；单逻辑单 commit；STOP-report（遇结构性阻碍停报告，不自行扩域）
- **流水线纪律（v1.8 §12，2026-10-03 用户裁定）**：交付进测试线后立即开下一任务不等结论；门禁全绿 + VRT 零 diff + 无新缺陷可**直接合入后报备**（仅新缺陷/偏离裁定/判据争议须逐次验收）
- 预计工作量：M，3–5 人日（管线 + 模板 + 入口过渡形态 + 渠道实测）
- 验收：门禁全绿 + 用户真机抽验（场景图一眼验收）

---

## 十、渠道实测（2026-10-03 实测完成）

### 10.1 样本矩阵（7 次调用，全部一手）

| # | 渠道 · 模型 | spec 长度 | 耗时 | 结果 | 产物 |
|---|---|---|---|---|---|
| 1 | a6api · gpt-image-2.5 | 1020ch | 236.5s | ✓ | 1254×1254 |
| 2 | a6api · gpt-image-2.5 | 486ch | — | **✗ 504 网关超时** | — |
| 3 | a6api · nano-banana-2 | 486ch | 28.8s | ✓ | 1024×1024（chat 壳）|
| 4 | a6api · nano-banana-2 | 148ch | 20.4s | ✓ | 1024×1024（chat 壳）|
| 5 | a6api · nano-banana-2 | 1020ch | 22.4s | ✓ | 商品静物入景 |
| 6 | a6api · nano-banana-2 | 486ch | 28.2s | ✓ | 商品静物入景 |
| 7 | a6api · nano-banana-2 | 148ch | 41.9s | ✓ | 商品静物入景 |

样本 1-4 源图为 f06-hb 宠物照（非商品，判读作废但**主体一致性有效**：4/4 保留主体）；
样本 5-7 源图为 F-01 商品静物（含**透明 PNG**），是有效判读集。

### 10.2 ★ 环境阻断（一手发现，通用前置）

**环境代理 `172.24.176.1:10808` 对 `api.a6api.com` 做 TLS 破环**：
`SSLError: [SSL: DECRYPTION_FAILED_OR_BAD_RECORD_MAC]`。直连正常（`HTTP 401` = 鉴权预期）。

**绕过方式**：`no_proxy` / `NO_PROXY` 追加 `api.a6api.com`（回包图片域名 `.img.ec.cc` 同样要加，
nano-banana-2 的产物 URL 走该域）。已在 `probe2.py` 中用 `ProxyHandler({})` 落地。

⇒ **这条对所有后续渠道实验通用**，写入任务书避免复发。

### 10.3 ★ 模型可靠性（一手，决定性）

| 模型 | 耗时 | 稳定性 | 回包形态 |
|---|---|---|---|
| `gpt-image-2.5` | **236.5s** | ✗ 第二次直接 504 | 标准 `data[].b64_json` |
| `nano-banana-2` | **20-42s** | ✓ 5/5 成功 | **chat 壳**：`choices[0].message.content` = 图片 URL |

**结论**：a6api 上 **nano-banana-2 是可靠主力**（快 10 倍 + 稳定），`gpt-image-2.5` 作备选。
回包形态与 f06-hb 记录一致（`a6api-image` 定制协议已处理 chat 壳 + 文本 URL）。

### 10.4 ★ 遵循度判读（样本 5-7，商品静物 + 透明 PNG）

三个 spec 长度**全部通过主体一致性**（书 / 双色陶瓷杯 / 玻璃瓶茎插 三主体 3/3 保留），
场景均正确落入「橡木台面 + 阳光厨房 + 暖光 + 无人物 + 写实」的 spec 核心。

| spec | 场景细节跟随度 | 判读 |
|---|---|---|
| 1020ch | 厨房窗 + 白瓷砖 + 咖啡磨豆机 + 亚麻餐巾 + 咖啡豆 | 细节跟随最完整 |
| 486ch | 瓷砖墙 + 干花 + 亚麻 + 咖啡豆 | 核心跟随，细节减少 |
| 148ch | 橡木柜 + 迷迭香 + 咖啡豆 | 核心跟随，细节最少但**未跑偏** |

**★ 关键**：**148ch 短 spec 没有明显劣化** —— 主体保留、场景语义正确、无跑偏。
即 nano-banana-2 的遵循度**在本测试范围内不打折**。

### 10.5 ★ 透明 PNG 处理（附带发现，与 mask 语义预写直接相关）

源图为**透明 PNG**（F-01 抠图产物）。我的对比图拼接时透明区渲染为黑
（**正是输入清单 §1 预写的那个坑**：`transparent and may render as black`）——
但**模型收到的透明图被正确处理**：样本 5-7 均无黑块，三主体干净入景。

⇒ 该坑是**呈现层**问题（对比/预览拼接），不是模型问题；但**预写仍需保留**（防弱渠道误解）。

### 10.6 spec 长度决定

**决定：采用 Flora 原始区间 900-1500 字**（不砍到 2-3K 下限之外）。

依据：
1. 实测遵循度在 148-1020ch 全区间不打折 ⇒ 无「打折就砍短」的必要；
2. 长 spec 的细节跟随更完整（1020ch 场景元素最丰富）；
3. Flora 原文即按此区间调（① 3421ch → ② 1254ch），有对标依据。

**保留降智预案**（输入清单 §2）：降智期自动退化为「模板 + 变量」模式（§4.4 的 preset 模板），
出图下限由模板保证 —— 此路径独立于 spec 长度，验收②可演示。

### 10.7 实测副产物

- 探针脚本：`/tmp/f02-chan-test/probe2.py`（支持 chat 壳 + 代理绕过，可复用于 F-07 Relighting）
- 样本产物：`/tmp/f02-chan-test/{r1-long,r2-mid,r3-short}.png` + `adherence.png`（对比图）
- 判读：`adherence.png` 四联（源图 + 三档 spec）

---

## 十一、执行记录（滚动）

### 11.1 交付 commit（feat/ecom-f02-scene，起点 7e19af47）

| # | commit | 内容 |
|---|---|---|
| 1 | `eb2873ec` | 任务书（本文件）+ 渠道实测门结果 |
| 2 | `09f71614` | 两段式提示词管线（@[ref] / mask 语义 / 降智模板 / 凝缩） |
| 3 | `b32fa4f0` | 商拍场景库（10 场景 × 5 分类，Flora 六要素变量） |
| 4 | `f581a25e` | 商拍场景入口（过渡形态，Agent 面板空态 chip 行） |
| 5 | `d81a22db` | 统一任务面（执行位置元数据标签，不单独造 UI） |

### 11.2 ★ 验收① 真机直线流程（2026-10-03，CDP 实测）

**证据**：`.local/f02-evidence/01-entry-scene-chips.png`、`02-scene-brief-backfill.png`

真机链路（登录 → 建画布 → 开 Agent 面板 → 选分类 → 选场景 → 回填）：

```
1. 进入 /canvas/djVSztWrKyj5yoku2P7P6（新建画布）
2. 点 Agent 启动器 → 面板打开
3. 探测 .agent-scene-capsules：
   sceneChipRows: 2
   headings: ["技能组合推荐", "商拍场景"]        ← F-02 入口已渲染
   chipLabels: ["短剧故事","广告电商","视觉创意","居家生活","餐饮美食","自然户外","影棚质感","节庆季节"]
4. 点「居家生活」→ 同排内切换：
   headings: ["技能组合推荐","居家生活"]
   labels: ["短剧故事","广告电商","视觉创意","晨光厨房","午后客厅"]   ← 2 个场景
5. 点「晨光厨房」→ 输入框回填 157 字符：
   "帮我做一张「晨光厨房」风格的商拍场景图：把商品放在阳光充足的极简厨房里，
    承托面是回收橡木台面，点缀散落的烘焙咖啡豆和一块亚麻餐巾，用穿过窗户的
    清晨暖光，整体氛围安静温馨。先不要直接生成，请先用一条消息确认：商品用
    画布里的哪张图（用 @ 引用）..."
```

⇒ **入口可见 + 交互可用 + brief 纯中文无英文泄漏**（英文变量泄漏问题在实现中
实测暴露并修正 —— 见 §11.4）。

### 11.3 ★ 验收③ 统一任务面（执行位置元数据标签）

**证据**：`test/scene-task-face.test.ts` 10 例 + 面板源码断言

`generationTaskExecutionLabel()` 四态：
- 云端 + 积分启用 → 「云端 · X 积分」
- 积分关闭 / 无计费 → 只「云端」（不产出「云端 · undefined」）
- 无 provider/model → 「本地」（分支保留）

**复用既有活动任务面板，未新造任何任务面组件**（约束核心，单测断言）。

### 11.4 ★ 实现中实测暴露并修正的问题（非预判）

**英文变量泄漏到中文 brief**：`scenePresetBrief()` 初版直接用 `preset.variables`
（喂模型的英文素材），产出「把商品放进a sunlit minimalist kitchen」中英夹杂文案。
修正：`ScenePreset` 增 `brief` 字段（用户面中文），与 `variables`（模型面英文）
分离 —— 两个受众、两套文案。单测断言两侧不互相泄漏。

### 11.5 门禁

| 项 | 结果 |
|---|---|
| tsc --noEmit | 0 |
| eslint src test | 0 |
| 全量 bun test | **2580 pass / 0 fail**（330 文件，+49 新用例）|
| build | ✅ 1m40s |

### 11.6 环境处置

验证栈（后端 :8080 + 前端 :3020 + CDP :9230）已按 §12.6 纪律同命令清理并回显。
清理时 shell 被 SIGKILL（137）—— 清理循环的 `tr < /proc/$pid/cmdline` 匹配到了
自身命令行（既有教训的变体）；改用独立脚本文件后确认三端口全关、内存 5.7G/14.3G。

### 11.7 待办（本枝未完项）

- [ ] 降智退化档的**真机可演示**（验收②）—— 需接渠道实跑一次「模板+变量」路径
- [ ] 端到端出图（上传商品图 → 选场景 → 出图全链截图）—— 需接渠道
- [ ] PATCH-MAP 登记（新 UI 面若需样式；本次零新增 CSS，待确认是否需登记）

