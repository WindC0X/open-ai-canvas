# 修缮缝隙池批 · 批内清单（B 线侦察，2026-10-04）

> 依据：`docs/artifacts/issue-13-partial-capability-audit.md` §5.2（①前端缺出口 9 项）+ `docs/artifacts/r25m-slice-verification.md` §十一（片 6/9 UI 未接线）
> 纪律：宁少勿造——需新数据源/新执行链的单独标出待裁定；片 6/9 = 把已收编 adapters 接到真实页面消费（零新数据）。
> 状态：**待控制线裁定范围**（本清单只侦察，未开工）。

---

## 一、9 项「前端缺出口」逐项代码核实

> 审计文档 §5.1 的 ① 类 9 项，逐项读码复核（审计是文档层判定，本清单是代码层实证）。

| # | 编号 | 审计判定 | 代码实测 | 归类 | 预估 |
|---|---|---|---|---|---|
| 1 | **IMG-16** 反推提示词 | ①能力在缺出口 | ★ **已完整接线**：`canvas-image-toolbar-tools.tsx:95` 条目 + `canvas-node-toolbar.tsx:145/254/262` 透传 + `project.tsx:3229` `createImageReversePromptNodes` 实现 | **④已兑现** | — |
| 2 | **3D-05** 360°/全景图 | ①查看在生成缺 | ★ **已完整接线**：`canvas-panorama-config-modal.tsx` 有「生成全景图」按钮 + `onConfirm(composedPrompt, config)` + `project.tsx:3219` `openPanoramaConfig` | **④已兑现** | — |
| 3 | **COM-06** 通知与消息中心 | ①数据在缺出口 | 有公告流（`banner-announcement-content.tsx`）+ 通知模型；**无任务完成推送** | **②需新执行链** | 待裁定 |
| 4 | **BIZ-08** 支付渠道与发票 | ①能力在缺出口 | 多支付渠道在；发票：`grep invoice/发票` = **0 处**（前后端皆无） | **②需新能力** | 待裁定 |
| 5 | **VID-23** 字幕生成与编辑 | ①编辑在生成缺 | 字幕编辑链完整（`subtitleNodeId` + `canvas-subtitle-dialog/overlay/text` 3 组件）；**无 ASR 生成** | **②需新执行链** | 待裁定 |
| 6 | **EDU-04** 教程案例一键建画布 | ①机制在内容缺 | starter 机制完整（`canvas-starter.ts` guided/freeform + `project.tsx:2713/2732` 消费）；**无课程绑定** | **②需新数据源** | 待裁定 |
| 7 | **BAT-02** 批量编辑与整组执行 | ①批量在组级缺 | 批量节点链在（逐行重试）；组级 `stopAll/cancelBatch/batchStop` = **0 处** | **②需新执行链** | 待裁定 |
| 8 | **3D-04** 3D 模型导入与导出 | ①导入在导出缺 | `GLTFLoader` 加载在（director）；导出未见 | **②需新执行链** | 待裁定 |
| 9 | **IMG-15** 姿态与姿势编辑 | ①提取在编辑缺 | ★ **提取也不存在**：`openpose/骨架提取` grep = 0（唯一命中是 three.js `SkeletonHelper` 显示辅助线，非姿态提取） | **②能力整体缺失** | 待裁定 |

### 核实结论

| 归类 | 数量 | 条目 |
|---|---|---|
| **④ 已兑现**（审计判定过期） | **2** | IMG-16、3D-05 |
| **② 需新执行链/数据源/能力** | **7** | COM-06、BIZ-08、VID-23、EDU-04、BAT-02、3D-04、IMG-15 |

**★ 重要修正**：
1. **IMG-16 / 3D-05 已兑现** —— 审计文档（2026-10-04 12:21）之后已有接线落地，其「①」判定已过期。与审计自身的样本偏差教训同族：文档判定需代码复核。
2. **IMG-15 审计前提不成立** —— 审计称「有 OpenPose 骨架提取，无骨骼编辑」，实测**提取也不存在**。故它不是「①缺出口」而是「②能力缺失」，工作量级不同。
3. **剩余 7 项全部需新执行链/数据源** —— 无一项属「零成本接线」。

**⇒ 对「宁少勿造」纪律的响应**：7 项均标出待裁定，**不建议本批承接**（每项都是独立功能开发，量级远超「修缮缝隙」）。

---

## 二、R25m 片 6/9 页面接线（零新数据，本批主候选）

> 依据：`r25m-slice-verification.md` §十一.2「片 6/9 的 UI 未接线——适配器已就绪，但页面消费路径未改」。
> 本项**零新数据**：适配器已存在且已测，只把页面消费改走注册表路径。

### 2.1 片 6：灵感卡 22 条 → `spec/generation`

| 项 | 内容 |
|---|---|
| 适配器 | `registry-adapters.ts:191` `registryAssetFromCreationInspiration(inspiration, index)` |
| 数据源 | `web/src/pages/create/creation-inspirations.ts` `creationFeaturedWorks`（22 条） |
| **现消费点** | `web/src/pages/create/creation-workspace-empty.tsx:85-92` `CreationFeaturedWorks` 组件——直接 `creationFeaturedWorks.filter(...)` 消费原始数组 |
| 接线目标 | 页面改走适配器产出的 `RegistryAsset` 列表（保持现有 UI 与交互不变） |
| 文件面 | `creation-workspace-empty.tsx`（改消费路径）+ 可能的 `registry-reader.ts` 新增 `loadGenerationSpecAssets()` 读取器（照 `loadStyleAssets` 范式） |
| 预估 | 0.5 人日（含读取器 + 接线 + 测试） |
| 风险 | 低——数据与适配器皆已就绪且已测；UI 零变化 |

### 2.2 片 9：渠道规格 3 条 → `preset/channel-spec`

| 项 | 内容 |
|---|---|
| 适配器 | `registry-adapters.ts:220` `registryAssetFromEcomChannelPreset(preset)` |
| 数据源 | `web/src/lib/image-size-presets.ts:157` `ECOM_CHANNEL_PRESETS`（3 条） |
| **现消费点** | `web/src/components/canvas/canvas-image-settings-popover.tsx:72/85/260/287`——直接消费 `ECOM_CHANNEL_PRESETS`（presets 传入 + find + 遍历 + badge reduce） |
| 接线目标 | 消费路径改走适配器产出的 `RegistryAsset`（保持现有 UI 与交互不变） |
| 文件面 | `canvas-image-settings-popover.tsx`（改消费路径）+ 可能的读取器新增 |
| 预估 | 0.5 人日 |
| 风险 | 中——该组件消费点有 4 处（含 `ECOM_ASPECT_BADGES` reduce），需逐一核对字段映射不丢信息（尤其 `minPixels`/`hint`） |

### 2.3 片 6/9 共同注意

- **零新数据纪律**：两条数据源都是本地常量，适配器已就绪（片 6 有 CC0 来源断言，片 9 有 `minPixels` 不丢断言）。
- **不新增降级态**：照片 3-4 的关闭裁定先例——本地常量即真值，无「服务端主/本地兜底」语义，故**不加降级提示条**（加了会宣告不存在的降级状态）。
- **测试面**：接线后需断言「页面消费的是适配器产出」（结构断言），而非源码字符串断言（接线批纪律）。

---

## 三、依赖与触发条件

| 项 | 依赖 | 状态 |
|---|---|---|
| 开工触发 | A线 sync 合入 main 直报到达 | **等待中**（sync 枝 `eb86fd87` 尚未推送到 fork） |
| 分支 | `feat/w5-gap-repair`，自新 main 开 | 待触发 |
| 咽喉面 | `creation-workspace-empty.tsx`（片 6）/ `canvas-image-settings-popover.tsx`（片 9） | 需开工前 git log 报备 |
| 与 sync 枝交叠 | 待 sync 合入后实测（预计 `canvas-image-settings-popover.tsx` 可能被 sync 触碰，需核实） | 待触发 |

---

## 四、范围建议（交控制线裁定）

| 方案 | 内容 | 预估 | 建议 |
|---|---|---|---|
| **A（推荐）** | 只做片 6/9 页面接线（零新数据，2 处消费点） | **1 人日** | ✅ 符合「修缮缝隙」量级与「零新数据」纪律 |
| B | A + COM-06 任务完成推送 | +2-3 人日 | 需新执行链（推送通道），超缝隙池量级 |
| C | A + 全部 7 项 | 数十人日 | ❌ 每项是独立功能开发，非缝隙修缮 |

**★ 建议 A**：片 6/9 是真正的「已收编但未接线」缝隙（数据、适配器、测试三样俱在，只差消费路径），符合本批命名与纪律；7 项 ② 类应各自立卡（W6+ 排期）。

**另附一条顺手核实**（审计 §六 附带发现）：`竞品深拆-工具页候选清单` 多处引用 `IMG-06 超分` 作为「已有」依据，O-03 合入后判定需复核（超分已从「有对话框无后端」变为「完整闭环」）。该项 1-2 处文案，可并入本批顺手更新（+0.1 人日）或留待下次深拆同步。

---

## 五、字段映射核对（开工前实测，2026-10-05）

> 依据开工令「逐一核对字段映射不丢信息」纪律，对片 6/9 的 UI 消费面逐字段核对。
> **结论：片 9 按现 schema 不可接线（结构性缺失）；片 6 缺 1 字段（来源标记）**。已直报待裁定。

### 5.1 片 6：灵感卡（`creation-workspace-empty.tsx`）

UI 消费面（`CreationFeaturedWorks` 组件，L85-127）：

| UI 用途 | 现取字段 | 适配器产出 | 判定 |
|---|---|---|---|
| 过滤/计数（:85/:106） | `item.mode` | `group` | ✓ |
| 卡片标题（:112/:121） | `item.title` | `title` | ✓ |
| 封面（:114） | `item.image` | `coverUrl` | ✓ |
| 描述（:122） | `item.description` | `description` | ✓ |
| 点击回填（:112） | `item.prompt` | `prompt` | ✓ |
| **来源标记（:125）** | **`item.source ? "开源改编 · CC0" : "原创提示词"`** | **（未映射）** | **✗ 缺失** |

- 影响：8 条 CC0 改编条目将显示「原创提示词」——**事实性误标**（非单纯信息丢失）。
- 适配器 docblock 记录了取舍（source 是角色名非仓库来源）；但 UI 实际把它当**来源布尔标记**使用。
- `featured` 字段全仓无消费者（grep 实测）——非阻塞。

### 5.2 片 9：渠道规格（`canvas-image-settings-popover.tsx`）

| # | 消费点 | 需要的字段 | 适配器产出 | 判定 |
|---|---|---|---|---|
| 1 | :72 `applyPreset` → `planEcomPresetApplication` | `aspect` / `desiredResolution` / `minPixels{width,height}` | aspect ✓；desiredResolution 并入 description 字符串；minPixels 并入 description 字符串 | **✗ 结构化丢失** |
| 2 | :85 `ecomPresetSlot.presets` → 面板 | `id` / `label` / `hint` | slug ✓ / title ✓ / hint 混入 description 拼接串 | **✗ 混入拼接串** |
| 3 | :260 `imageSettingsPresetView` → `planEcomPresetApplication` | desiredResolution / minPixels 结构化 | 同 #1 | **✗ 结构化丢失** |
| 4 | :287 `ECOM_ASPECT_BADGES` reduce | `aspect` / `label` / `minPixels{width,height}` | aspect ✓ / title ✓ / minPixels 为字符串 | **✗ 结构化丢失** |

- 另有 `shortLabel`（:152 触发器角标「Amazon/详情/抖音」）：适配器**完全未映射**。
- 关键事实：`planEcomPresetApplication` 入参类型为 `EcomChannelPreset`（结构化）——3/4 个消费点是**计算面**，统一 schema（展示/索引导向）不承载这些输入。
- ⇒ 「4 处消费点改走 RegistryAsset」按现 schema 不可实现（丢信息 / 扩 schema / 反解析字符串 三选一）。

### 5.3 待裁定选项（已直报）

| 片 | 选项 | 说明 |
|---|---|---|
| 6 | A1（推荐） | `RegistryAsset` 增 §3.4 形态 `source` 对象（repository/revision/license/notice），适配器为 8 条外部来源条目附上；UI 逐字不变，顺带闭合 §3.4 每条记录来源字段缺口 |
| 6 | A2 / A3 | A2 直带原 source 字符串（非 §3.4 形态）；A3 缓做 |
| 9 | B1（推荐） | 判「现 schema 不适用」显式关闭（比照片 3-4「降级提示条不接」先例：本地即真值）；重开条件=渠道规格出现服务端源或 schema 长出结构化载荷支持 |
| 9 | B2 / B3 | B2 扩 schema 承载结构化载荷（设计决策待裁）；B3 混合接线（显示走 asset、计算走常量）——hint 保真破坏，不推荐 |

---

## 六、裁定落地记录（控制线 2026-10-05）

| 项 | 裁定 | 落地 |
|---|---|---|
| 片 6 | **A1 批准**（补 §3.4 门禁缺口，非扩需求） | `RegistryAsset` 增可选 `source` 对象（repository/revision/license/notice）；适配器以单条角色名 `source` 存在为判据附 8 条；页面 `featuredWorkAssets` 走适配器；UI 逐字不变 |
| 片 9 | **B1 批准**（显式关闭，同片 3-4 先例） | 适配器保留（注册表侧数据表示有效），消费接线**不接**；本批零代码改动 |

### 6.1 片 9 重开条件（写入台账，将来重开时按此判）

1. **渠道规格出现服务端源** —— 届时「降级态」才成为真债，按架构方案 §3.2 走「服务端优先 + 降级标注」；
2. **注册表 schema 长出结构化载荷支持** —— 即 `RegistryAsset` 能承载 `minPixels`/`desiredResolution`/`shortLabel` 等结构化字段（属架构方案 §1 schema 面决策，不属缝隙池批量级）。

关闭理由：3/4 消费点是**计算面**（`planEcomPresetApplication` 入参为结构化 `EcomChannelPreset`），现 schema 把结构化数据压进 `description` 字符串 —— 无损接线三选一皆不可接受（丢信息 / 扩 schema / 反解析字符串）。B3 混合接线制造双真值源，违反 R25m 纪律。

### 6.2 架构方案 §6.1 追加注记（排入下一个触碰该文档的批次，本批不动该文件）

> `preset/channel-spec` 结构化载荷超出现 schema 承载面 —— 适配器产出仅适合展示/索引场景；
> 计算面消费需 schema 支持结构化载荷，或渠道规格服务端化。重开条件见上。

### 6.3 本批交付面

| 文件 | 变更 |
|---|---|
| `web/src/lib/canvas/registry-asset.ts` | +20 行：`AssetSource` 类型 + `RegistryAsset.source` 可选字段（§3.4 形态） |
| `web/src/lib/canvas/registry-adapters.ts` | +12/-4：`registryAssetFromCreationInspiration` 增可选 `source` 参数，按判据附 |
| `web/src/pages/create/creation-workspace-empty.tsx` | +40/-22：`featuredWorkAssets` 适配器产出（导出供断言），`CreationFeaturedWorks` 消费改走 `RegistryAsset` |
| `web/test/gap-repair-wiring.test.tsx` | 新增 8 tests：结构断言 + SSR 渲染断言 + 反例锚点 |
| `web/test/registry-adapters.test.ts` | +30：8 带/14 不带结构断言 + 不注入不附反例 |

**方法固化（控制线建议）**：本批「逐消费点 × 逐字段」核对表（§五）作为后续接线批模板 ——
开工前先列消费面字段需求，逐项对照适配器产出，任一项无承载即 STOP 报裁定。

### 6.4 审计勘误（§七）同批提交

`docs/artifacts/issue-13-partial-capability-audit.md` §七 勘误附注（IMG-16/3D-05 已兑现 + IMG-15 前提不成立 + ①类 9→6 数字修正）随本批提交。
