# W5 R3 评审报告（评审线 · 第四线）

**锚点**：主面① `7db3fa10`（= `156ce089` 代码面 + docs-only +18 行，branch-only 未合入 main）；主面② `d6b6a952`（已合入 main `65c51953`）
**范围**：主面① `f180edf5..7db3fa10` 17 文件；主面② `d6b6a952` 7 文件；副面③ R1 四条 + R2 两条
**方法**：3 批独立评审（T1/T2/T3，deepseek-v4.1-flash）→ 3 份红队核验（P1 全覆盖 + 主动证伪）→ 编排者独立复核 + 机制级去重
**环境**：动态验证树 `/home/windc0x/oac-ext4/oac-wt-baseline` @ `7db3fa10`（隔离；被测源码 100% 来自该树）；全程未在 `/mnt/f` 跑测试、未读测试线 twin 源码面
**产出**：`/tmp/review-r3/agents/T{1,2,3}.md` + `verify-T{1,2,3}.md`（已归档仓库侧，见 §8）

---

## §0 方法学更正（编排者裁定，先读）

**① ★ T3 两条副面线索读错拓扑 —— 读了评审工作区自身 checkout（旧 fork），而非被评审对象**
评审工作树停在 `374bdf22` 系（R1 快照，sync 前）；T3 的 C1/C2 直接读了工作树文件：
- C2 引用的 `analytics.go:272-278` `filter.From.UTC()`：该写法只存在于 `374bdf22` 系（工作树 :278 逐字命中），在 `d6b6a952`/`7db3fa10`/`main` 上 **0 命中**（已被上游 `whereTimeRange` 取代）。
- C1 引用的 `add-node-menu-tools.tsx:32` 带 `applicable: isProjectLinked`：该形态存在于工作树（`3ef258f3:32`）及 R1 时代 fork 快照（`d328a257:32`），在 `7db3fa10`/`d6b6a952` 上不存在——后两者 `project-character` 在 `:25` 且**无** applicable。
**更正**：C2 整条证伪（详见 §5）；C1 的「证伪」无效，R2-P2-3 线索实质成立（见 M19）。
**教训（升格纪律）**：读码一律 `git show <评审锚点>:<path>`；**禁止直接读评审工作树文件**（工作树 ≠ 被评审对象）；核验层须检查引用的拓扑归属。

**② T2 计数不符**：T2 自述「14 条（P2:6）」，文件实际 13 条标题（6 P1 + 5 P2 + 2 P3）。本报告按标题计数 13 处理，并再次提示计数纪律。

**③ R2-S2 子句更正**：「analytics whereTimeRange 修复零测试覆盖」被证伪——`TestSQLiteAPICallLogRangeUsesInstantNotOffsetText` 在 `f180edf5:63` 存在，编排者复跑 **PASS**（0.012s）。残余：`AnalyticsTasks` 无专项 range 测试（grep 无命中），但同一谓词已被测试覆盖，残余风险低。

**④ 重启重建说明**：首轮 T1/T2/T3 产出因系统重启丢失（`/tmp` 被清），本报告基于重建轮（同 prompt、同锚点、隔离树）——首轮结论未进入本报告。

---

## §1 控制线重点结论（对账）

| 重点 | 结论 |
|---|---|
| ① headless-tidy「只投影 position」 | ✅ **成立**（函数级代码结构防线；`{...node, position}` 唯一写入字段，metadata 同引用；测试断结构不变式非镜像）。调用方两缺陷：M3（快照竞态 P2）、M2（中断语义 P3） |
| ② 守卫测试证伪性 | ❌ **不足**（M4，P1）：侧效 import / 动态 import·require / 非递归 / 名单缺 `@/pages/canvas` 四盲区，注入实验全部假绿（唯一能抓的是静态命名 import） |
| ③ workspaceType 过滤链端到端 | ⚠️ **字段链通、测试真接线级（后端删透出必红）；但全仓无生产写入者 → 端到端不可达**（M1，P2；跨卡缺口，设计卡 §八明示不做创建） |
| ④ UnifiedTaskFace 订阅契约 | ✅ **成立**（直接 import 无画布 store；2-hop 传递闭包唯一命中 `use-user-store → lib/canvas/canvas-drawing-engine` 绘图设置，与任务态无关）。但护栏证伪不了它（见 ②） |
| 主面②-① source 判据语义 | ❌ **不稳固**（M14，P1）：判据=「角色名存在」，声明=「CC0 改编」——数据巧合；且标注测试对误标/极性/字段绑定零覆盖（变异 F 存活） |
| 主面②-② UI 等价性 | ✅ **成立且更强**：`renderToStaticMarkup` 前后 `cmp` 逐字节一致；但提交体引用的「16713」不可复现（实测 17756，M15 P3） |

---

## §2 P1（3 条，全部红队 confirmed）

### P1-1 护栏机检证伪性不足：文本匹配扫描的语法/范围/名单四盲区（合并 T1-P2-5 + T2-P1×4）
- 文件：`web/test/task-face-independence.test.ts:38-73`；`web/test/task-face-workspace-type.test.ts:141-162`
- 证据（注入实验，独立复现）：
  - `import "@/stores/canvas/use-canvas-store";`（侧效）→ **6 pass / 0 fail**（假绿；正则要求 `from`）
  - `const l = () => import("@/stores/canvas/use-canvas-store")` / `require(...)` → 6 pass（语法域外）
  - `src/components/task/nested/deep.tsx`（子目录）→ 6 pass（`readdirSync` 非递归；注释却承诺「含未来新增」）
  - `import ... from "@/pages/canvas/use-canvas-generation"` → 6 pass（`forbidden` 五项不含 `@/pages/canvas`；该模块 :13 持有 canvas-store）
  - `task-face-workspace-type.test.ts` 的 `toContain`+`indexOf` 接线断言：把调用行**注释掉**仍全绿（只对整行删除有证伪力）
- 影响：两条护栏分别是「订阅契约」（验收 5/6）与「验收 7/8 接线」的唯一机检手段；最想防的失效模式（接线被摘、依赖以日常写法引入）恰是它们测不到的
- 建议：独立护栏改模块图判定（`Bun.build` 产物不含 `stores/canvas`）或至少覆盖 `import/export from/import(/require(` + 递归 + 名单补 `@/pages/canvas`；接线断言复用同批 `stripComments()` 先剥注释

### P1-2 交付步「合规成品」判据不达设计卡 §5.3（预览/下载只看 `previewUrl`）
- 文件：`web/src/components/task/unified-task-face.tsx:176-180,296-299`；`web/src/components/canvas/canvas-active-task-panel.tsx:254,288`
- 证据：设计卡 §5.3（`:222-232`）要求「下载必须是合规成品（非中间产物）…原始分辨率」；实现 `canDownload = status==="succeeded" && Boolean(preview.url)`，对整文件 grep `resultState|outputs|materializedAssetId` 零命中；而 `task-face-download.ts:61-77` 自认 previewUrl「可能是缩略图」并优先走 `outputs[].materializedAssetId` → 回退分支恰是它声明要避免的展示地址
- 影响：①有合规素材但无 previewUrl → 下载入口不出现；②素材未就绪（`MATERIALIZING` 等）按钮已可点，点下去可能下载到缩略图
- 建议：判据收敛为 `resultState === "READY"` 或首个 `outputs[].materializedAssetId` 可解析；previewUrl 仅用于预览；回退分支加显式降级提示

### P1-3 缝隙池批：附来源判据把「角色名存在」当「许可证事实」，且标注测试不可证伪（合并 T3-A1 + A1′）
- 文件：`web/src/lib/canvas/registry-adapters.ts:214-216`；`web/src/pages/create/creation-workspace-empty.tsx:144`；`web/test/gap-repair-wiring.test.tsx:44-67,112-122`
- 证据：
  - 判据 `...(inspiration.source && source ? { source } : {})`；`inspiration.source` 实测 8 值是**角色名**（Storyteller/Screenwriter/…/Historian），而注入的 `AssetSource.license` 是仓库级常量 `CC0-1.0`（creation-inspirations.ts:61-66）；渲染直接映射为「开源改编 · CC0」（:144）
  - 变异实验：标注整体**反转** `asset.source ? "原创提示词" : "开源改编 · CC0"` → **65 pass / 0 fail 存活**（verify-T3 独立复现）；判据改绑 `asset.source?.license`（看起来更严格）→ 存活（T3 报告，未独立复现）；`cc0Count+originalCount===12` 是计数恒等式，与内容/极性/绑定字段无关
- 影响：任何使 12 张首屏卡标注反转/错绑字段的改动都静默通过门禁；将来带角色名语义的条目（含内部原创补 `source: "本店风格"`）会被标成 CC0——正是本批声称修复的误标类型（当前 8 条数据上判据与事实重合，无即时误标）
- 建议：渲染判据改显式 `asset.source?.license === "CC0-1.0"`（或增 `origin: internal|external` 字段）；SSR 断言改「按卡片顺序的期望标注序列」+「license 非 CC0 不标 CC0」反例

---

## §3 P2（8 条）

### M1 `workspaceType`/headless 无生产者 —— 验收 7/8 消费侧就位、端到端不可达（合并 T1-P1 + T2-P1-6；核验降级）
- 文件：`web/src/lib/canvas/workspace-type.ts:12-19`；`web/src/pages/canvas/index.tsx:105-107`；`web/src/pages/canvas/use-canvas-project-lifecycle.ts:164-177`
- 证据：`git grep headless_task` 全树仅类型/谓词/注释/测试；`createCanvasProjectWithRemoteSync` 签名与 store `createProject` 均无该参数；后端仅纯读透出（`user_data_page.go:82`）；**`65c51953`（main）同样 0 写入点 → 跨卡范围缺口**；设计卡 §八:287 明示不做创建流程；本批 docs 无「验收 7/8 已完成」声明（代码注释与测试名引用验收 7/8，但断的是机制非可达性）
- 影响：过滤恒空转、整理恒不触发；前向风险真实——写入者一旦出现，列表静默过滤（用户画布消失）无守卫
- 建议：验收表标注「消费侧完成、生产侧待直线入口批」+ 记 pending-test；`updateProject` 侧加非 headless 流程不得写 `headless_task` 的守卫
- 注：verify-T1 降级 P2（卡边界已文档化）、verify-T2 维持 P1（验收登记口径）；编排者采 P2（无生产影响、已文档化边界、前向风险）

### M3 整理用「标记前快照坐标」覆盖实时 store（F1 修复后立刻显形的前向缺陷）
- 文件：`use-canvas-project-lifecycle.ts:168,172,174`；`headless-tidy.ts:58-61`
- 证据：batches/positions 基于 `:168` 快照；`applyHeadlessTidyPositions` 只做 `positions.has` 判定，无版本/移动校验；窗口内新拖动节点会被旧坐标回写（metadata 不受影响，不触发重跑）
- 建议：批提交前校验快照未过期（revision/哈希），或整理期间忽略画布 pointer 事件

### M8 交付面双实现分叉：面板未按设计卡「包装 UnifiedTaskFace」，两处判据已现分叉
- 文件：`canvas-active-task-panel.tsx:250-336` vs `unified-task-face.tsx:176-299`；设计卡 §六:239
- 证据：面板自建预览/下载（下载门控 `status==="succeeded" && onDownload`，不校验 preview）；统一面 `succeeded && Boolean(preview.url)`；同语义两套判据
- 建议：面板卡片体替换为 `UnifiedTaskFace`（保留外壳），或抽出 `taskDeliverableState(task)` 共用

### M10 「在画布中打开」只按 `metadata.taskId` 找节点，漏 `generationTaskId` 匹配路径
- 文件：`web/src/pages/canvas/project.tsx:2740-2748` vs `canvas-generation-task-sync.ts:408`（及 :331,338 的 `generationTaskId`）
- 影响：绑定在 `generationTaskId` 上的产物命中「产物节点不在当前画布中」误报
- 建议：抽同源节点定位函数（`taskId ?? generationTaskId` + `status==="success"`），两处共用

### M12 设计卡 §5.2「结果」要素（`resultState` 六态）与文本结果通道未实现
- 文件：`unified-task-face.tsx:296-299`；设计卡 §5.2:217-218；`w5-linear-entry-card.md:339-345`（文本通道已记档）
- 影响：text 卡在统一面下无结果可见性；六态对用户不可见（缺口部分已记档）
- 建议：验收表登记「结果要素=部分」；`resultState !== "READY"` 显示人话标签

### M16 三段式 id 零报警（R1 线索成立）：守卫只解构前两段
- 文件：`web/test/registry-namespace-guard.test.ts:44-52`；`capability-entries.ts:171`
- 证据：`const [domain, action] = id.split(".")` 丢弃多余段；`"image.annotate.edit"` 变异 → **14 pass / 0 fail**
- 建议：`expect(id.split(".")).toHaveLength(2)` 或整体正则匹配

### M17 registry 风格预置测试输入与 UI 真源错位（R1 线索成立，口径修正）
- 文件：`web/test/registry-adapters.test.ts:258,278`；`registry-adapters.ts:75`；`canvas-style-picker-modal.tsx:48-51`
- 证据（独立复现集合求交）：legacy=18 / UI(`canvasStylePresets`)=24；legacy-only=12、UI-only=18 ⇒ **交集 6（非 verify-T3 所报的 0，其算术有误）**；两侧成员/顺序/去重键均不同
- 影响：registry 侧 12 条断言不能推出 UI 侧任何结论；属测试输入口径问题，无直接生产缺陷
- 建议：测试改用 UI 真源或补「两集合 prompt 相等」桥接断言

### M18 `loadSkillPresetAssets` 的 `signal` 声明空转（R1 线索成立）
- 文件：`registry-reader.ts:72,81`；`skills.ts:205-207`
- 证据：signal 被解构但 `listSkillPresets()` 不接收参数（无参签名），取消不生效；同模块 `loadStyleAssets` 的 signal 是真传导
- 建议：`listSkillPresets(options?: { signal?: AbortSignal })` 透传，或删除字段与注释

---

## §4 P3（9 条，一行式）

| # | 内容 | 位置 |
|---|---|---|
| M2 | 首入整理中断语义：`markHeadlessCanvasTidied` 先于批次落盘（:169）+ 帧循环共用 effect 的 `isStale`（:174）⇒ 中断后永久半整理；verify-T1 论证「先落标记保护用户手工排布」故定性为边界，编排者采 P3 | `use-canvas-project-lifecycle.ts:169,174`；`headless-tidy.ts:24` |
| M5 | 后端不校验枚举值 + 前端 `as never` ⇒ 拼写异常静默降级 standard | `user_data_page.go:82`；`headless-tidy.ts:26` |
| M6 | 下载扩展名 MIME 子串匹配脆弱（`video/mpeg` 类误判；audio 回退分支丢 mediaType） | `task-face-download.ts:41-46,68-75` |
| M9 | 筛选谓词三处字面漂移（Frame 兜底已由 `positions.has` 保证，T1 影响句被证伪）+ 调用方重算 positions 冗余 | `headless-tidy.ts:41`；`canvas-layout.ts:137`；`lifecycle:172` |
| M11 | runner `taskId` 单值、重跑覆盖（任务面入口在该挂载点本就关闭，T2-9 影响句不成立，降级） | `linear-flow-runner.tsx:161` |
| M13 | `previewUrl` 无有效性过滤，非可渲染地址渲染破图 | `unified-task-face.tsx:222-226,296-299` |
| M15 | 提交体「SSR HTML 16713 逐字节一致」数字不可复现（实测 17756；`cmp` 证逐字节一致——结论更强） | `d6b6a952` 提交体 |
| M19 | 角色卡条目门控缺失（R2-P2-3 线索成立；T3-C1 证伪无效）：`7db3fa10:25`/`f180edf5:25` 无 applicable；上游 12125e18 有意移除（合并注释明示「不再以 isProjectLinked 门控」）；非项目画布点击→打开角色库（`listCharacters` 不依赖 projectId，功能可用）。影响轻微，建议 owner 确认上游语义 | `add-node-menu-tools.tsx:25` |
| M20 | `AssetKind` 留槽纪律无护栏：插入 `"asset/audio"` → 90 pass / 0 fail（R1 线索成立） | `registry-asset.ts:28-38` |

---

## §5 证伪与更正清单

| 项 | 判定 | 依据 |
|---|---|---|
| T1「Frame 三处筛选漂移致批次名额虚增」 | **refuted**（核心影响句） | `planHeadlessTidyBatches` 内 `positions.has` 兜底：Frame 不在 `layoutCanvasAuto` 返回 Map ⇒ 不可能进 batch；残项 = M9 |
| T3-C2「混合时区修复只覆盖 api_call_logs 且无测试」 | **refuted**（机制/行号/测试三项全错，且读错拓扑） | `whereTimeRange` 同时应用于 `AnalyticsTasks:78` 与 `api_call_logs:311`；测试 `TestSQLiteAPICallLogRangeUsesInstantNotOffsetText` 在 `d6b6a952/7db3fa10/main/f180edf5` 存在，编排者复跑 PASS；T3 引用的是工作树旧 fork 代码 |
| T3-C1「角色卡条目带 applicable，R2 线索前提不成立」 | **更正**（证伪无效） | 读错拓扑（工作树 :32 vs `7db3fa10:25` 无门控）；R2-P2-3 实质成立 → M19 |
| R2-S2「analytics 修复零测试覆盖」 | **更正** | 测试存在（`f180edf5:63`）且 PASS；残余 = `AnalyticsTasks` 无专项 range 测试 |
| T2-9「/create 任务『在画布中打开』必然落空」 | **降级** | 该挂载点任务面入口本就 `showOpenInCanvas={false}`；runner 自建入口走新建会话；残余 = taskId 单值（M11） |
| T1「验收 7/8 被记为已达成」 | **证伪** | docs 无该声明；代码注释/测试引用验收编号但断的是机制 |

---

## §6 副面③ 六条线索结案

| # | 线索 | 状态 |
|---|---|---|
| 1 | 三段式 id 零报警 | ✅ 成立 → M16 (P2) |
| 2 | assetKind 落枚举纪律空转 | ✅ 成立 → M20 (P3) |
| 3 | 12-12 legacy prompt 不同源 | ✅ 成立（修正：交集 6 非 0；影响=测试口径）→ M17 (P2) |
| 4 | signal 参数声明不符 | ✅ 成立 → M18 (P2) |
| 5 | R2-P2-3 角色卡门控可达性 | ⚠️ 更正：T3-C1 证伪无效；线索实质成立、影响轻微 → M19 (P3) |
| 6 | R2-P2-6 analytics 时间窗 | ✅ 结案：修复与测试均在（复跑 PASS）；R2 子句更正见 §5 |

---

## §7 机制级去重表（29 原始条目 → 20 有效）

| 原始 | 归并后 |
|---|---|
| T1-P1 + T2-P1-6 | M1（P2，降级） |
| T1-P2-2 + T2-P2-10 | M2（P3） |
| T1#4（Frame 漂移） | refuted（残项 → M9） |
| T1-P2-5 + T2-P1-1..4 + T2-P3-12 | P1-1（四盲区 + 注释不符） |
| T3-A1 + T3-A1′ | P1-3（判据 + 测试一条因果链） |
| T3-C1 | 更正 → M19 |
| T3-C2 | refuted |
| T2-9 | 降级 → M11 |
| T2-P3-12 | 并入 P1-1 |
| 其余 | 一一对应 |

**有效计数：P0=0 · P1=3 · P2=8 · P3=9 —— 共 20 条。**

---

## §8 覆盖声明与未做项

- R3 未跑全量 build / lint / 全量测试；批级测试结果见各批报告（T1: workspace-type 11 pass、后端 Workspace PASS；T2: 3 测试 37 pass + 护栏证伪实验；T3: gap-repair 65 pass + 变异矩阵）。
- 未做浏览器 E2E 验收；M3/M6 为静态推演（M3 当前不可达）。
- P2/P3 未全量红队（核验聚焦 P1 + 两条 P2 抽查）；T2 的 P2/P3、T3-B2 的变异结论为批次自证。
- **依赖目录披露**：动态验证树 `oac-wt-baseline` 的 `web/node_modules` 为软链（→ 测试线 twin 的依赖目录）；被测源码 100% 来自隔离树（`git rev-parse` 确认 `7db3fa10`），依赖目录共享风险如实披露（本次未发生依赖变动，mtime Oct 2）。
- 主面①为 branch-only（`7db3fa10` 未合入 main）；本报告所有主面①结论仅对该锚点成立。
- 归档：本报告与 6 份批次/核验文件已复制到 `.trellis/workspace/WindC0X/review/r3/` 并提交（防重启丢失）。

---

**评审线（第四线）· R3 · 2026-10-05**
