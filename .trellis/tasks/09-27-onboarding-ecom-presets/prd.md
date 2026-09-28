# 轻量枝：新手体验 + 渠道预设（S1–S4 + O-03 层1）

## Goal

W3 第三轻量枝（控制线 2026-09-27 任务书）：在 `feat/onboarding-ecom-presets` 分枝落地五件独立交付，预算 6–7 人日，**每件独立 commit**，完成后出终报经用户转控制线验收。父任务承载总需求、子任务映射、跨子验收与终验清单；不直接作为实现对象。

用户价值：新用户 30–90 秒产出第一个可保留成果（可执行 starter + JIT 教学 + 帮助入口 + 用户文档骨架）；电商直出引导（渠道预设组）让批量出图不再猜尺寸/档位。

## 输入依据（只读）

- 控制线任务书 2026-09-27（五件规格 + 门禁纪律 + 三裁决）。
- 综述：`/mnt/f/CODE/Project/canvas/新手教学体系-竞品综述与落地方案-2026-09-26.md`（§四 + 闭账增补）。
- 规划：`/mnt/f/CODE/Project/canvas/MASTER-PLAN.md` §4.2 O-03 条目（三层定位；本枝只做层1，不做超分/计费映射）+ v1.4 落点索引。
- 渠道裁决：`/mnt/f/CODE/Project/canvas/analysis-2026-09-12/ecom-design/upscale/超分放大方案调研-终版-2026-09-12.md`【渠道一手数据增补】（三档制、定价锚低价、计价展示不硬编码）。
- 控制线三裁决 2026-09-27：① 结构=父+5 子，子卡验收必含门禁四件；② S1=直接开跑 + 知情交互三件；③ S4=内容层落地四条。

## 子任务映射（五件，按杠杆序）

| # | 子任务目录 | 交付 | 独立 commit |
|---|---|---|---|
| 1 | `09-27-s1-ecom-starters` | Agent 面板新对话态电商 starter 卡（点了就跑 + 成本知情） | `feat(canvas): ...` |
| 2 | `09-27-s2-tool-hover-cards` | 工具/节点 hover 说明卡（flora 配方，数据驱动） | `feat(canvas): ...` |
| 3 | `09-27-s3-help-menu` | ? 帮助菜单四件套（教程/快捷键/反馈/最近更新） | `feat(canvas): ...` |
| 4 | `09-27-s4-docs-diataxis` | 文档 Diátaxis 重排（Quickstart/四分组/llms.txt/D6 清账） | `docs(...): ...` |
| 5 | `09-27-o03-layer1-presets` | O-03 层1 直出引导（渠道预设组 + 生成面板） | `feat(canvas): ...` |

## 跨子项通用纪律（强制）

- 只碰**组件 + docs 域**；新组件样式一律 Tailwind 工具类/组件级写法，**不进 `globals.css`**（A 线 flora-tokens 域）。
- 不 push、不碰冻结分支、不做 E2E（测试线域）。
- dev 环境自建；端口避开 :3000/:3400/:8482，建议 :3010/:8483；**真机逐件走查截图**。
- 规格冲突/不明 → 报控制线裁决（经用户转发），不自行取舍。
- 主题口径：flora 与画布同为暗色系（已裁决），不做主题适配工作。

## 门禁四件（每件 commit 前 + 终态；已写入各子卡验收）

1. **web tsc 0**：`cd web && bun run typecheck`。
2. **bun build 通过**：`cd web && bun run build`（含 tsc 预检）。
3. **focused 测试绿**：`cd web && bun test <专项文件>`（新增可测逻辑必带专项测试）。
4. **窗口套件红基线口径**：`cd web && bun test` 全量，对照测试仓 `open-ai-canvas-testing/docs/env.md` 冻结红基线（@5a567238，15 条 = 4 白名单 + 11 上游原生）；**基线内放行，名单外红 = stop 报控制线**。

## 跨子项验收（终验清单）

- [ ] 五件各自完成并通过门禁四件；每件一个独立 commit（共 ≥5 个业务 commit，除终报文档外不混装）。
- [ ] 终报 = 五件状态 + 门禁结果 + **D6 清账确认** + **新 UI 面清单**（组件名/路径/截图索引）+ 截图索引，经用户转控制线。
- [ ] 三裁决逐条对照勾销：裁决1（结构+门禁入卡）✓ 本文件；裁决2（S1 三件）→ S1 卡；裁决3（S4 四条）→ S4 卡。
- [ ] O-03「开枝首日必做」：CapabilityConfig 能力覆盖度盘点产出（`09-27-o03-layer1-presets/research/`），缺口清单随终报上报。
- [ ] 五件真机走查截图齐（自建 dev 环境 :3010/:8483）。

## 新 UI 面清单（测试线 VRT 追加用；随实现维护）

- S1：Agent 面板电商 starter 卡（含成本提示行）。
- S2：工具 hover 说明卡（左栏 Dock + 添加节点菜单两处）。
- S3：? 帮助菜单（四件套）+ 反馈表单弹层。
- O-03：电商场景预设行 + 比例项预设角标 + composer 药丸预设态（含渠道小标/一键取消）+ 画质偏好控件（形态待评审）。

## Out of Scope

- O-03 层2/层3（超分、计费映射、视频线）；层2/层3 另卡另排。
- S3 任何新后端 endpoint（纯前端聚合，走现有外链机制）；S1 后端改动。
- E2E / VRT 基线采集（测试线域）；上游同步与合入动作（由用户/控制线决定时机）。
- Changelog 独立文档页（评审稿含、任务书 S4 未列；S3「最近更新」链现有 in-app 弹窗）。

## Open Items（评审门报控制线）

1. S1 卡面文案与数量（草案见 S1 prd §卡面草案）。
2. O-03 预设档位参数（草案见 O-03 design；Amazon 主图口径按任务书取 ≥1600px——与旧稿 ≥2048 的差异已按最新裁定执行，报备）。
3. O-03(c) 画质偏好控件形态（草案 V1：生成设置弹窗顶部「画质偏好」行；备选 V2：仅静默记忆）。
4. S2 预览资产缺口（现有 assets 盘点；无图工具走降级卡，缺口列终报）。

> **评审门裁定（控制线 2026-09-27）**：以上四项 + 另两项报备（S4 结构选型=全移动版 / S3 反馈形态=复制聚合+外链）全部通过；控制线补强三处已落卡：S1 文案两处微调、O-03 desiredResolution 字段与档位 id 统一导出、S3 聚合透明度明示「将包含以下信息」。

## Notes

- 参考截图：主仓 `docs/artifacts/batch11-walkthrough/` 的 `07b*.png`（空画布全页）与 `18*.png`（添加节点菜单全量）。
- prefill 语义来源：commit `3b3fe456`（自增 id 命令语义，防同一命令被静默去重）。
- 上游结构参照：commit `2088cf78`（创作入口 Agent 优先，已并入本枝基线）。

## 2026-09-28 rider：宫格切分跳闪修复 + tool 徽章补齐（控制线 rider · 完成即 merge-ready）

- Bug1（用户三实例实报）：`.canvas-grid-split-picker` 根容器 align-items stretch→flex-start 结构性修复——2026-09-25 的 138px 数字追等式在用户显示环境破相，hover「自定义」棋盘展开撑高容器 → 左列行被拉伸 → 行被推离光标 → 140ms 收/150ms 开循环跳闪。域内文件：canvas-grid-split-picker.css（root 块改一行 + 两处注释升级）；守卫测试语义升级（canvas-split-hover-open：flex-start + 棋盘 absolute 脱流，替代旧数字断言）；真机走查含左列每行 rect 逐像素不变 + L2 零位移复核。
- Bug2（接上轮 ⚠ 报备，控制线同轮批准）：canvas-node-hover-composer 补 `kind:"tool"` 分支（⚙ / Tool）；SSR + 源级守卫。
- 范围纪律：零 globals.css、零依赖、门禁四件、双提交不 push；预算 ≤0.4 人日（实际：同轮内完成）。

## 2026-09-28 rider 二轮：宫格残余 a/b + O-03 四刀（控制线回执）

- 残余 b 根因闭合：格点被 unified-buttons 基线 padding-inline（max(12px,--space-3)）撑破网格轨道（24px 最小宽 vs 16.8px 轨道）→ 重叠、板高失真、用户环境呈压扁；修复 = data-icon-only 豁免。复验：cells 16.59² 正方、gap 4、board 99²；像素取证双证。
- 残余 a：单卡背景包 max(两列高) → 矮列底部露无内容背景块；修复 = 背景下放两列独立成卡 + 根容器透明 + 2px 缝；rider 不变式（行 rect 开合一致、L2 零位移）复验保持。
- 四刀：预设场景 / 删恢复默认 / 新节点画质+ⓘ 补行 / banner「未达该预设要求（≥…）」；用户文案与单测同步（含 not 平台下限 断言）。
- 预算 ≤0.5 人日内完成；门禁四件照旧；双提交不 push。

## 2026-09-28 微修令：新节点画质行整行移除

- 按控制线微修令（替换上一条 Ⓘ 卡去重令）：面板行 + ⓘ + QUALITY_TIER_INFO_LINES 清理；popover 槽接线移除；ImageSettingsQualityTierSlot 类型保留（最小 diff）。
- 数据与吸附逻辑不动：creation-preferences store 读写保留、model-selection 吸附消费保留——已有偏好继续生效，仅面板入口移除。
- 去向备注：该偏好的新家 = 修缮期参数面板 2.0（侧栏方案）侧栏底部「新节点默认档位」行；过渡期无修改入口，属可接受空窗（低频偏好）。
- 证据：面板活体照 s10-quality-row-removed.png（预设场景/药丸 ✕/banner 三刀仍在 + 画质行不存在）；单测更新 + 护栏；门禁 2366 → 15 红逐名=基线。

## 2026-09-28 hotfix：hover 卡 clamp 分支遮挡（batch-12 阻断项）

- 背景：create-menu 位于视口下缘时，408px hover 卡夹紧后覆盖菜单项吃掉点击（addImageNode 15s 死循环）；S2.1 定位升级引入，控制线认账验收盲区。
- 修复：`computeToolHoverCardPosition` 侧移优先（above → below → 侧移空间大侧 + 8px gap → 缩高内滚兜底）；above/below 分支与指针入卡语义未动。
- 不变式 + 单测：任意视口×锚点参数化（下缘菜单/左缘 dock × 768×1024/1024×768/2320×1287），卡矩形 ∩ 锚点矩形 = 空。
- 真机复现（:3010）：侧移落位 gap 8、elementFromPoint 命中菜单项、像素核验无覆盖（证据 .local/hoverfix-walkthrough/）。
- 去向：合入 batch 树（feat/onboarding-ecom-presets 提交，控制线让 A 线 merge 带入 merge-v1.5.9）。

## 2026-09-28 hotfix-2：expands 命令 active 态禁卡

- batch-12 重跑 5 红根因：tool-add（expands, active=addPanelOpen）hover 卡（above 放得下）与 420px 菜单几乎全重叠 → 移向菜单项必经卡内 → 点击被吃；归属控制线（S2 清单未定义 expands active 态卡行为）。
- 修复：`floating-dock.tsx` 卡 data 条件加 `!command.active`（面板展开期不出卡，收起恢复）；定位函数不动（hotfix-1 侧移不变式保留，两层互补）。
- 真机双场景证据 + 挂点核对（菜单内部条目卡不受影响）；门禁照旧。
- 去向：合入 batch 树，A 线 merge 带入 merge-v1.5.9。

## 2026-09-28 hotfix-3：hover 卡滞留族（第三条路径）+ O-03 诚实化

- 根因（测试线 06bc4a1c 三跑 VRT 7 红）：hotfix-2 只挡卡数据未重置状态机——菜单关后 data 恢复、旧状态 open → 卡重开在鼠标下方 → pointerenter 锁存 → 卡永不关闭遮 composer 点击。归属控制线（S2 清单未定义 expands active 态卡状态）。
- 修三件：① useToolHoverCard suppression 状态归零（清三计时器 + setState(initial)）；② create-menu 按钮 :focus-visible 门控 + mousedown 清焦（防 focused 滞留）；③ O-03：size 模型实际像素判达标 + 不支持比例 short 诚实提示 + applyPreset 绝不静默写 size。
- 守卫 5 项 + 真机 09 场景闭环（创建节点 cards:0、可点击、撤销复原）；门禁照旧。
- 去向：批内 merge 进 merge-v1.5.9 → 测试线 VRT 重跑 + 基线重采裁定。
