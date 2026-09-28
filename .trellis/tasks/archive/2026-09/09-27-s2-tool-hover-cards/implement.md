# S2 执行计划

> 前置：先读 `design.md`。提交信息建议 `feat(canvas): 工具 hover 说明卡 - 左栏与节点菜单 flora 配方（数据驱动 + 快捷键徽章）`。

## Step 0：核对
- [ ] 0.1 重读 `canvas-shortcuts.ts` 全部 id，确定"工具 → 快捷键"映射表（只填真实存在的 id）。
- [ ] 0.2 `cd web && bun run typecheck` 基线 0。

## Step 1：数据层
- [ ] 1.1 `tool-definition.ts`：加 `ToolHoverInfo` + 两类型可选字段。
- [ ] 1.2 `main-toolbar-tools.tsx` / `add-node-menu-tools.tsx`：全量补 `hover.description`；按映射表补 `shortcuts`；按盘点表补 `preview`（仅 2 处候选）。
- [ ] 1.3 静态测试先行：`web/test/canvas-tool-hover-cards.test.ts`（覆盖率断言此时应绿）。

## Step 2：渲染组件
- [ ] 2.1 新建 `canvas-tool-hover-card.tsx`（结构/定位/动效/无障碍/降级）。
- [ ] 2.2 `floating-dock.tsx`：`hoverCard` 字段 + `DockCommandButton` 接入（缺省不动）。
- [ ] 2.3 `tool-registry.ts` `toolToEntry`：`hover` → `hoverCard`（shortcuts id → keys 解析）。
- [ ] 2.4 `canvas-create-menu.tsx`：`hover` 字段 + `CanvasCreateCommandGrid` 接入。
- [ ] 2.5 验证：专项测试 + `bun run typecheck`。

## Step 3：门禁 + 真机
- [ ] 3.1 `bun run typecheck`（=0）→ `bun run build`（通过）。
- [ ] 3.2 `bun test` 全量对照红基线（15 条内放行；名单外红=stop）。
- [ ] 3.3 真机走查（:3010/:8483）：左栏 hover / 节点菜单 hover / 键盘 focus / 窄屏兜底 → 截图。
- [ ] 3.4 `pending-test.mdx` 登记；预览缺口清单整理。

## Step 4：交付
- [ ] 4.1 独立 commit（仅 S2 文件集；diff 自证不含 `globals.css`）。
- [ ] 4.2 汇报：状态 + 门禁结果 + 覆盖统计 + 缺口清单 + 截图索引。

## 回滚点
- Step 2 先后可分层回退；全量单 commit revert 亦可。

## S2 执行记录（2026-09-27 · 完成）

- Step 0–1：22 个 `CANVAS_SHORTCUTS` id 核对（两表面仅 undo/redo/delete 真实对应）；`ToolHoverInfo` + 类型落地；26/26 条数据（含 switch 两段、B1 有意不配）；清单 22:02 控制线总批通过（四小修照改）。
- Step 2：新增 3 文件（data/ui/css）+ 接线 5 文件（floating-dock 加性 15 处、create-menu 两按钮组件提取、registry/commands 适配）；专项 `web/test/canvas-tool-hover-cards.test.tsx` 11 用例（覆盖/引用/预览存在/SSR/Esc/入卡/定位/禁用门控/静态接线）。
- Step 3 门禁：tsc 0；build ✓（1m43s）；focused 最终复核 61 绿（7 文件组，实现期首跑 51）；全量 `bun test` 2304 测试 → 15 红与冻结基线逐名一致。
- Step 3 真机走查（:3010 改造 / :3012 基线 / :8483 后端；证据 `.local/s2-walkthrough/`）：
  - 默认态对照：主 Dock 带 0–11px、缩放/素材 Dock 0px（基线 b1 / 改造 m1）；残差定性＝顶栏字形栅格相位（布局/样式一致至 0.001px）+ 缩略图重渲染，均非 S2 面；终态 m3 主 Dock 带 0px（纯瞬态）。
  - hover 矩阵：左栏 工作区/抓手/区域选择/清空 + 撤销（`Ctrl / Cmd + Z` 徽章）5 卡 + Esc 关闭；菜单 文本 + 文件夹（预览图 naturalWidth 1586）+ Esc 关闭；禁用（重做）不出卡。
  - a11y：Esc 关 / 指针移入卡保持·离开即收（fiber 状态轨迹 hovered×cardHovered 四步）/ focus 事件触发正确、`:focus-visible` 门控在指针 modality 下不出卡为预期（键 modality 实机注入受自动化限制，单测+源断言覆盖）。
  - 披露：会话中段起自动化指针通道失稳，矩阵除 `h0`（真实指针悬停）外由页内事件驱动相同 React 处理器（逐张 DOM/状态断言）；`orca keypress` 零投递、OS 级按键因焦点门禁放弃。
  - 窄屏：视口 <1024 自动沉浸（`use-focus-mode` 既有行为）→ 主 Dock 不渲染、无卡可出、无报错（h10）；<768 scrollable/原生 title 兜底由源码+单测覆盖。
- Step 4：正文 + 落卡双 commit；`git diff` 自证不含 `globals.css`、零新依赖。


## S2.1 执行记录（2026-09-28 · 完成）

- Step 1 文案：26 项三段式送审 → 控制线总批（3 必改 + 2 可选）；A9/A2 限定词先做代码实证（`use-canvas-history` 的 `historyRef` 为内存态、无持久化、50 条上限；快照含 canvasAppearance/backgroundMode/showImageInfo 且 undo 会 apply）。
- Step 2 施工：数据层重写（`tool-hover-card-data.ts` NODE_PREVIEW_KINDS + 双参解析）、27 处文案迁移（含 3 必改 + 2 可选 + preview:'node' 标记）、`tool-hover-card-mockups.tsx` 11 款 SVG、渲染层四层重写 + CSS 底盘重写、测试文件全量迁移（文案锁 / 分布断言 15 icon+11 node / 四层结构守卫 / 几何断言）。
- Step 3 门禁：tsc 0；build ✓；focused 66 绿（7 文件组）；全量 `bun test` 2309 测试 → 15 红逐名=冻结基线（日志 `/tmp/s21-bun-test-full.log`）。
- Step 3 真机走查（双实例 :3012/:3013 + :8483；证据 `.local/s21-walkthrough/`）：
  - 默认态对照对（全新双标签，全部交互后重开）：全域 1067px（0.045%），主/缩放/素材 Dock 带与画布区全 0px；残差＝顶栏字形 412px（同 v1 环境 class）+ Agent 光球动画。
  - 出卡实拍 6 张：撤销（icon + footer 键位句）、工作区（无 footer）、图片/文件夹（node mockup）、抓手（switch 段）、几何 1024×768；每张先 DOM 断言后截图。
  - 计算样式四层逐项实测命中（r24 / 玻璃 / 阴影 / #949494 / #B4B4B4 / 366×229 / 41px / kbd 徽章 / gap 8.0px / 无溢出 / 不遮触发点）。
  - fiber 状态轨迹（dismissed 后 Esc 再武装）、will-change 生命周期实测（进场 `transform, opacity` → 结束 `auto`）。
- 现场修复 2 缺陷（均由本版新断言/测量捕获）：CSS 漏 `position: fixed`（静态定位跑到 (0,0)）→ 补属性 + 新增静态断言；进场中间帧测量吃 transform（尺寸缩为 0.96×）→ `offsetWidth/offsetHeight` + 新增断言。
- 披露：Esc 首次真实 OS 键投递成功，随后该通道两次打断本会话工具命令（OS 级泄漏风险）→ 停用，其余 Esc 证据采用页面内 dispatch + 单测；帧率采样因窗口遮挡节流不可得（替代证据见 evidence-notes §四）。
- Step 4：正文 + 落卡双 commit；不 push；S2 封印待控制线复核。


### S2.1 加固记录（2026-09-28 · 用户复核发现双卡叠放）

- 用户真机截图发现双卡叠放（撤销+清空、工作区+前卡）。取证路径：orca 跳变 hover / 指针入卡探针 / 逐事件重放（单发+读取）均未能构成稳定逻辑级复现；环境实测：显示延迟被节流拉长（200ms→435-955ms）、leave 宽限 140→435ms+、合成器陈旧帧（悬停高亮像素残留实锤，m11 取证）。
- 判定：关闭链（140ms 宽限）与新卡显示链（200ms 延迟）在节流下可能倒挂；防御动作＝「全局单卡不变式」——`createToolHoverCardExclusivity` 注册表，任一卡打开（layout 阶段）强制关闭其它卡（escape 语义，保留正常再武装）。DOM 层双卡成为不可能。
- 验证：tsc 0 / focused 68 绿（+2 不变式单测）/ build ✓；:3013 真机冒烟：撤销→清空→撤销（再武装）→工作区 每步单卡，Esc 清场 ✓。残留说明：若仍偶见像素级残影（DOM 已单卡），属内嵌浏览器合成器节流陈旧帧（环境类），刷新即消。
