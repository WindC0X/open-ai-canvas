# S2 工具/节点 hover 说明卡（flora 配方）

## Goal

按 flora 配方为画布工具补齐 JIT（just-in-time）教学：hover 说明卡 = 图标 + 名称 + 一句话职责 + 内嵌预览图（有资产时）+ 快捷键徽章（有快捷键时）。数据驱动（配置文件 → 渲染组件），覆盖**左栏工具**（主工具栏 Dock）与**节点创建菜单**（添加节点菜单）。

## 已核实事实（证据锚）

- 工具注册表（数据驱动体系已在）：`web/src/lib/canvas/tool-registry/tool-registry.ts` + `definitions/main-toolbar-tools.tsx`（左栏）+ `definitions/add-node-menu-tools.tsx`（节点菜单）；类型 = `ToolDefinition` / `AddNodeMenuCommand`（`tool-definition.ts`）。
- Dock 渲染：`web/src/components/ui/aceternity/floating-dock.tsx`（`DockCommandButton` 现有一个精简 tooltip：hover/focus 显示 label；触屏/窄屏走原生 `title` 兜底）。
- 节点菜单渲染：`web/src/components/canvas/canvas-create-menu.tsx`（`CanvasCreateCommandGrid` 按钮，现仅有 `title`）。
- 快捷键注册表：`web/src/lib/canvas/canvas-shortcuts.ts`（`CANVAS_SHORTCUTS`，含 `id/title/description/keys/...`）；快捷键 Modal 在 `canvas-shortcuts-modal.tsx`。
- 预览资产盘点（现状）：`web/public/` 下无逐工具预览图；可映射候选 = folder 封面（`images/canvas/folder-*.png`）、风格样张（`short-drama-styles/*.jpg`）、光照样张（`lighting-presets/*.png`）、工作台截图（`welcome/workbench-*.webp`）。**覆盖率不足处走降级卡（无图）**，缺口清单随交付上报。

## Requirements

- R1 卡面配方（flora 同构）：图标 + 名称 + 一句话职责（description）+ 内嵌预览图（preview，可选）+ 快捷键徽章（shortcuts，可选，键盘键位从 `CANVAS_SHORTCUTS` 取，单一来源）。
- R2 数据驱动：`ToolDefinition` 与 `AddNodeMenuCommand` 增补可选 `hover?: { description: string; preview?: string; shortcuts?: string[] }`；全部左栏工具与节点菜单命令补 description；shortcuts 以 **CANVAS_SHORTCUTS id** 引用；渲染组件统一。
- R3 覆盖：左栏全部 command 项 + 节点创建菜单全部项（switch/separator 不做卡）。插件节点命令无 hover 数据时优雅降级。
- R4 复用纪律：快捷键徽章渲染自 `CANVAS_SHORTCUTS`（改注册表 → 卡片自动同步）；样式纯组件级（Tailwind / 组件 CSS）；**不改 `globals.css`**。
- R5 交互与可达性：hover 延时（~200ms）显示、离开即收；键盘 focus 可达（kbd 用户）；**不阻断点击**；reduced-motion 下不动画/最小动画；触屏窄屏沿用现有原生 `title` 兜底；portal 渲染防裁剪（Dock 窄屏 overflow 场景）。
- R6 预览资产：只用现有 assets；无合适资产 = 降级卡（结构保留 preview 字段）；**不新制图**。（控制线 2026-09-27 批降级方案：有图用图、无图纯卡；缺口清单随交付上报，S2 不被阻塞。）

## Acceptance Criteria

- [ ] AC1：左栏工具 + 节点创建菜单全量覆盖（每个工具 hover 出卡；卡含图标 + 名称 + 职责；有快捷键/预览的按数据展示）。
- [ ] AC2：快捷键徽章与 `CANVAS_SHORTCUTS` 一致（键位来源唯一；专项测试断言引用 id 全部存在）。
- [ ] AC3：降级路径正确：无 preview 无 shortcuts 时卡片自然收窄；触屏/窄屏 fallback 不报错；reduced-motion 不播动画。
- [ ] AC4：专项测试绿：`web/test/canvas-tool-hover-cards.test.ts`（定义完整性：coverage 全量、description 非空、shortcuts id 有效、preview 路径存在性）。
- [ ] AC5：**门禁四件**：① `cd web && bun run typecheck` 0 ② `cd web && bun run build` 通过 ③ focused 测试绿 ④ `bun test` 全量对照测试仓 `open-ai-canvas-testing/docs/env.md` 冻结红基线（15 条 @5a567238）：基线内放行，名单外红 = stop 报控制线。
- [ ] AC6：真机走查截图（左栏 hover、节点菜单 hover、键盘 focus、窄屏 fallback），dev 端口 :3010/:8483。
- [ ] AC7：`git diff` 不含 `globals.css`；无新增依赖。
- [ ] AC8：预览资产盘点表 + 缺口清单随交付附上（供控制线/测试线后续）。

## Out of Scope

- 模型选择器 / 画布外观面板 / 缩放控件等其它 hover 面（仅任务书点名的两处：左栏 + 节点菜单）。
- 预览图新制作、动图演示、教学文案本地化以外的扩展。
- 移动端专门交互重构（沿用现状兜底）。

## Notes

- flora 参照：图标 → 功能名 + 一句话职责 + 说明段 + 内嵌节点预览图 + 快捷键徽章（综述 §一/§四）。
- `pending-test.mdx` 登记（S4 迁移前旧路径）。

## S2 实现与验证记录（2026-09-27 · 完成）

- 施工与清单一致：左栏 Dock 10 项 + 节点菜单 16 项全量覆盖（26/26）；控制线快审「四小修」全部执行（switch 两段各一卡 / A1 文案拆分 / B1 有意不配 / A9「可撤销」+ A10「清空前请确认」）。
- 两处落地差异（详见 design §8）：组件落位 `web/src/components/ui/`（避免 ui→canvas 反向依赖）；快捷键在适配层解析（`CANVAS_SHORTCUTS` id → 键位数组）。
- 验收结果：门禁四件绿（tsc 0 / build ✓ / focused 最终复核 61 绿（7 文件组，实现期首跑 51） / 全量 2304 测试对照冻结红基线逐名一致）；真机走查矩阵与默认态对照见 `.local/s2-walkthrough/`（主 Dock 带 0–11px，同标签噪声同量级）。
- 预览资产：1/26（仅 B6 文件夹封面）；缺口清单见清单文件「preview 覆盖率」节。
- 登记：`pending-test.mdx` S2 节（含待真机复核项与 Esc 已知限制）。


## S2.1 形态升级与验证记录（2026-09-28 · 完成）

控制线裁定：S2 v1（fc18a40d + 22708b60）功能/工程验收通过，但形态对比 flora.ai 判「简陋」→ 限定范围一轮升级：工程底座（状态机/延时/定位骨架/Esc/指针入卡/a11y 三件/测试体系）全保留，仅重写渲染层 + CSS 至 flora 四层配方（权威依据：`docs/artifacts/s2-hover-upgrade/flora-hover-spec.md` v1.1 + 两张实拍证据图）。

- 文案三段式 26 项全量重写（tagline ≤10 字 + 长句），控制线总批通过（3 必改 + 2 可选全部执行）：A9 tagline「移除所选内容」+ 长句「可在会话内撤销」（撤销栈会话级 = 代码实证）；A2「节点、连线与画布设置都能恢复」保留（快照含 canvasAppearance/backgroundMode/showImageInfo 且 undo apply = 代码实证）；B15「复用角色设定」；B16「选取素材插入画布」；A4 长句砍尾。
- 预览制式：位图预览整体退场（含 B6 文件夹封面）→ 工具类 48px 大图标 ×15、节点类手写 SVG mockup ×11（零位图资产）；footer 仅 3 项（A2/A3/A9），手势短语不做假键位。
- 验收：四层 DOM/计算样式断言 + 1024×768 几何边界 + 26 卡等高（测试层）+ :3012/:3013 同态对照（默认态主 Dock 带 0px）+ 出卡实拍矩阵；门禁四件绿（tsc 0 / build ✓ / focused 66 / 全量 2309 测试 → 15 红逐名=冻结基线）。
- 明细见 design §9 / implement「S2.1 执行记录」/ `.local/s21-walkthrough/evidence-notes.md`。
