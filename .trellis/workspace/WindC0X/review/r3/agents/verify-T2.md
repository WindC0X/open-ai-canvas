# verify-T2 · 对抗核验（红队，只读）

- 核验对象：`/tmp/review-r3/agents/T2.md` 的 6 条 P1（P2/P3 按令跳过）
- 代码面：主面① `7db3fa10`（branch-only），只读 `git show`；未修改评审仓任何文件
- 动态验证：`/tmp/vT2`（自建最小副本：护栏原文 + 目标文件原文），`bun test`；未触碰 `oac-wt-test`，未在 `/mnt/f` 下跑测试
- 基线复现：护栏原文单独运行 = **6 pass / 0 fail / 11 expect**

---

### [confirmed] 守卫护栏只识别静态 `import … from "…"`，侧效 import 假绿

- 核验方法：独立注入实验（不复用 T2 的 /tmp/falsify）。取 `7db3fa10:web/src/components/task/unified-task-face.tsx` 原文，在首行前插 `import "@/stores/canvas/use-canvas-store";`，跑同一护栏。
- 证据：结果 **6 pass / 0 fail**（与无注入基线完全一致）。护栏判定在 `web/test/task-face-independence.test.ts:66`：`file.code.match(/^\s*import\s+[^;]+?from\s+["'][^"']+["']/gm)` —— 侧效 import 无 `from`，正则失配 ⇒ `forbidden` 循环（`:67-71`）永不进入。`forbidden` 含 `@/stores/canvas`（`:58`），说明缺的是语法覆盖而非名单。
- 备注：这是护栏唯一机检手段，且侧效 import 是挂载 store 初始化的日常写法 —— 缺陷成立，非设计选择。

### [confirmed] 动态 `import()` 与 `require()` 在扫描语法域之外

- 核验方法：直接对正则做语法域判定（确定性，无需运行）。
- 证据：`^\s*import\s+[^;]+?from\s+["']…` 中 `import` 后要求 `\s+`，故 `import("@/…")` 在第一个 token 即失配；`require(` 整串无 `import`，同样不可匹配。两类写法都不会进入 `:67-71` 的 needle 检查。
- 备注：与 T2-1 同根（文本扫描 vs 模块图），但语法分支不同，独立计数成立。

### [confirmed] 护栏非递归，子目录文件不纳入

- 核验方法：在副本内新建 `src/components/task/nested/deep.tsx`（内容 = 一条指向 `@/stores/canvas/use-canvas-store` 的静态命名 import，即护栏**本应**能抓的形态），跑护栏。
- 证据：结果 **6 pass / 0 fail**（静态命名 import 在顶层能红、在子目录全绿 ⇒ 范围问题已被隔离）。实现 `:38-45` `readdirSync(taskFaceDir)` 无 `recursive`/`withFileTypes` 下钻，`path` 拼接写死 `src/components/task/${name}`。`git ls-tree -r 7db3fa10 -- web/src/components/task` 仅 `unified-task-face.tsx` 一个文件 ⇒ 当前零漏检，风险是未来新增子目录时静默失守；而注释 `:18-20` 明确承诺「任何文件（含未来新增）…扫描整个目录」。
- 备注：属「实现-承诺不符 + 未来风险」，当前无现实漏检对象 —— 但护栏的全部价值就是防未来，故维持 P1。

### [confirmed] `forbidden` 名单缺 `@/pages/canvas`

- 核验方法：注入 `import { subscribeCanvasGenerationRecoveryTasks } from "@/pages/canvas/use-canvas-generation";` 后跑护栏；另实读被指向的模块是否真的持有 canvas-store。
- 证据：护栏仍 **6 pass / 0 fail**；`forbidden`（`:57-63`）恰好只有 `@/stores/canvas`、`use-canvas-store`、`use-canvas-theme-store`、`@/lib/canvas`、`@/components/canvas` 五项，不含 `@/pages/canvas`。实读 `web/src/pages/canvas/use-canvas-generation.ts:13` 确有 `import { useCanvasStore } from "@/stores/canvas/use-canvas-store";`。
- 备注：护栏是纯文本扫描，注入符号是否存在不影响判定（不作为证据项）；成立的是「名单口径比契约口径窄一层间接」——契约禁的是画布**上下文**，名单只禁画布**模块**。

### [confirmed] 交付步判据只看 `previewUrl`，与设计卡 §5.3「合规成品」不符

- 核验方法：逐处读判据代码 + 读设计卡原文 + 读下载实现的三条取值路径。
- 证据：
  - 设计卡 `docs/artifacts/w5-unified-task-face-card.md:222-232`（§5.3）：「下载必须是**合规成品**（不是中间产物）…图片：原始分辨率（非缩略图）」。
  - `unified-task-face.tsx:296-299` `taskPreview()` 仅返回 `task.previewUrl`，无 `outputs`/`resultState` 分支；`:177` `canDownload = task.status === "succeeded" && Boolean(preview.url)`；对整文件 grep `resultState|outputs|materializedAssetId` **零命中**。
  - 面板侧 `canvas-active-task-panel.tsx:254`（预览）与 `:288`（下载门控）同样只看 `task.previewUrl`。
  - `web/src/lib/task-face-download.ts:61-77` 自述 previewUrl「可能是缩略图」并优先走 `outputs[].materializedAssetId` → `asset.data.storageKey` → `getResourceBlob`；仅当素材不可解析才回退 `task.previewUrl`。
  - `web/src/services/api/task-center.ts:45-51` 确认 `previewUrl?` / `resultState?` / `outputs?` 三个字段并存。
- 影响：入口判据与下载实现**取值口径不一致** ⇒ ①有合规素材但无 previewUrl 时下载入口不出现；②素材未就绪时按钮已可点，点下去落到实现自认要避免的展示地址。卡面纪律在入口侧无任何代码保障。
- 备注：`resultState` 在类型上是可选字段（`:50`），收敛判据时需留 fallback —— 不改变缺陷成立。

### [confirmed] `headless_task` 容器无生产者，验收 7/8 恒为 no-op

- 核验方法：全仓 grep 生产者（赋值点），区分「读点/判定点/注释」与「写入点」。
- 证据：
  - `git grep -n "headless_task" 7db3fa10 -- web/src backend`（排除 `_test`）全部命中为注释/类型/判定函数：`lib/canvas/workspace-type.ts:6,13`、`types/canvas.ts:67,71`、`stores/canvas/use-canvas-store.ts:42,45`、`services/api/user-data.ts:43`、`pages/canvas/index.tsx:106`、`backend/internal/canvas/user_data_page.go:48`。
  - `git grep -n "workspaceType"` 的全部命中为：类型字段声明、store 的 `updateProject` patch 签名（`use-canvas-store.ts:68`）、读点（`headless-tidy.ts:25-26`、`use-canvas-project-lifecycle.ts:167`、`workspace-type.ts:17-18`、`user_data_page.go:50,82`）。**无一处写入**。
  - 接线本身在位：`index.tsx:105-107` 调 `filterVisibleCanvasProjects(projects)`；`use-canvas-project-lifecycle.ts:167` 调 `shouldTidyHeadlessCanvas(projectId, current.workspaceType)`。
  - 设计卡 `:287` 显式把「不做 headless 画布的创建流程」列入不做清单。
- 影响：过滤链与首入整理是「已接线、无生产者」的死路径；验收 7/8 不能记为已达成（是验收状态登记问题，非实现缺陷）。反向风险真实：一旦别的批次写入 `headless_task`，用户画布会静默从列表消失。
- 备注：T2 未把它算作实现缺陷，判定口径正确，故维持 P1 而非升级。

---

## 未复核项（预算内主动跳过，如实登记）

- T2 的 6 条 P2 / 2 条 P3：按任务令（仅 P0/P1）跳过，不作判定。
- T2 证据表 #5/#6/#7（相对路径 / 无分号 / `from` 前无空格）与 #11/#12（`.nodes` / `canvas:*` 变红对照）：未逐条重跑；#5-#7 属 T2-1 同根语法族，已由本条独立注入覆盖；#11/#12 是护栏**能**红的正向对照，与本次 6 条 P1 的结论方向不冲突。
- T2 自写的 2-hop 传递依赖脚本与其 `[ok]` 订阅契约结论：未复现脚本；本次核验未发现与之矛盾的证据，故既不确认也不反驳（T2 的 P1 集合不依赖该结论）。

## 假阳性检查（本次判定通过的项）

- 行号漂移：T2 引用的行号在 `7db3fa10` 上逐条对齐命中（`:66`、`:38-45`、`:57-63`、`unified-task-face.tsx:177,296-299`、`panel:254,288`、`task-face-download.ts:61-77`），未见漂移。
- branch-only / main 混淆：本次全部读取锚定 `7db3fa10`，未混入 main 内容。
- 设计选择误判：T2-5（合规成品）有卡面明文纪律背书，非风格偏好；T2-6 被 T2 主动降级为验收登记问题，未见夸大。
- 已知限制当新缺陷：未发现此类项。

## 统计

- confirmed：6（T2-1 侧效 import 假绿 / T2-2 动态 import·require / T2-3 非递归 / T2-4 forbidden 缺 `@/pages/canvas` / T2-5 交付步合规成品不达 / T2-6 headless 无生产者）
- refuted：0
- uncertain：0
- 工具调用：13 / 15 上限

VERIFY T2 confirmed=6 refuted=0 uncertain=0
