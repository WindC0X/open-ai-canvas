# W4 flora-overrides 外置 + 在途吸收三件 — 执行记录（2026-10-03）

## 主任务：flora-overrides.css 组件覆写迁移（W4 硬验收点 §4.1）

### 交付
新建 `web/src/styles/flora-overrides.css`（Component 覆写层，与 flora-tokens.css 的
Semantic 值层分工），四块外置自 globals.css，每块独立 commit：

| 块 | commit | 内容 | 行数 |
|----|--------|------|------|
| [1] | `91b20e98` | composer hover 信息态族 + 工具栏 surface/按钮/菜单族 + T4 rc-motion 反制 | 264 |
| [2] | `a8ae561c` | antd 浮层动画对齐 + 设置面板族 + 微供给 keyframes + video-duration-range | 310 |
| [3] | `0b49690f` | 微供给 no-motion 关断（★ 未分层段）| 22 |
| [4] | `0b49690f` | 生成态视觉族（node-generating-border / loading-fill）| 63 |

### ★ 关键技术约束（任务书未提及，一手发现）
globals.css 的 fork 增量**全部位于 `@layer utilities`**（L1463-11327，三处 @layer：
base L1372-1408 / utilities L1463-11327 / utilities L12779-12894）。

级联铁律：**@layer 内的规则永远输给未分层规则，与加载序无关**。因此：
- utilities 规则 → 必须包在 `@layer utilities` 内（同层 + 后加载 ⇒ 保住胜出关系）
- **例外**：块 [3] 的 no-motion 关断是未分层规则 → 必须留未分层，
  一旦落层会立刻输给所有未分层规则

### 一处「fork 修改上游规则」的处置
上游 `.canvas-floating-dock, .canvas-floating-panel, .canvas-node-toolbar` 共享
canvas-panel-in 入场动画。fork 把 `.canvas-node-toolbar` 移出该组（改由微供给
AffordanceSurface 管显隐）并给 5 个 settings popover 挂上同一动画。
外置形态：globals.css 回归上游原状（保留 .canvas-node-toolbar），
fork 差异在 overrides 表达（先 `animation: none` 退役，再挂 5 个 popover）。
实测 computed `animation-name=none` 确认退役意图保住。

### 零回归验证（真实浏览器 computed style 逐属性对比）
迁移前 vs 迁移后，13 组探针（块1+2）+ 16 组（块3+4），**diff 结果全部 0 差异**。
覆盖 toolbar-surface / dock-command / toolbar-menu / toolbar-menu-item /
composer-surface / composer-ref / composer-prompt / settings-group /
settings-option / option-selected / count-switch-on / video-duration-range /
node-toolbar-anim / affordance / generating-border / loading-fill-bar。

### 迁移安全性静态核查
- 27 个迁移选择器在 globals 中**零「同选择器属性重叠」残留** → 排除后置反超
- vs shared/*.css 唯一交叠 `.canvas-reference-tools-popover`，是 model-picker.css:871
  已声明的既定分工边界（「globals 侧同规则仅留智能引用」）

## 骑乘件一：动效三值收编 + 裸毫秒护栏（commit `03a93c6d`）

收编映射（不新增档位，复用既有 token 表）：
- 180ms → `var(--motion-state)`（精确匹配，Semantic 层既有档位，60+ 消费点）
- 160ms → `var(--motion-dur-fast-calc)`（150ms 档，带 --motion-scale 降级）
- 100ms → `var(--motion-dur-instant-calc)`（80ms 档）
- 200ms → `var(--motion-state)`
共 8 处。160/100/200 有 10-20ms 漂移，属档位归并的既定代价。

实测：`motion-toolbar-surface animation-duration=0.18s`（= --motion-state 精确等价）；
`motion-settings-press transition-duration=0.15s, 0.15s, 0.08s`（档位生效）。

新增护栏 `web/test/flora-overrides-guard.test.ts`（4 例）：
白名单外裸毫秒为零 / 白名单防腐烂 / 140-160-180 不再裸写 / @layer 包裹与未分层边界。
白名单（语义性时长，各带理由）：4s 旋转周期 / 60s S04 缓爬契约 / 0.3s 进度回跳桥接。

## 骑乘件二：/wallet 空白页修复（commit `d77d8778`）

**偏离控制线原令「删路由」，一手证据推翻**：后端支付回跳硬编码该路径，删掉会落 404：
- `backend/internal/handler/payment.go:180` → 302 `/wallet?payment=invalid`
- `backend/internal/handler/payment.go:183` → 302 `/wallet?paymentOrder=<id>`
- `WorkspaceWalletHost` 唯一挂载点在 `AppWorkspaceShell`（app-top-nav.tsx:115，认证布局内）
- catch-all `{ path: "*" }` 在 router.tsx 顶层（L230，布局之外）

⇒ 删路由 = URL 落顶层 catch-all = 布局不渲染 = host 不挂载 = 弹窗不弹 + paymentOrder 丢失

修法：保留路径 + 立即重定向
`{ path: "/wallet", element: <RequireAuth><Navigate to="/" replace /></RequireAuth> }`
- URL 仍匹配 → 布局渲染 → host 的 `pathname === "/wallet"` effect 照常捕获 query 弹窗
- 同时立刻回首页 → 不再停在空白主区
- 时序：React 同 commit 内子 effect 先于父——Navigate（叶子）先 navigate，
  host（布局祖先）后跑但 pathname 取本次 render 的闭包值（仍为 "/wallet"）故仍匹配

## 骑乘件三：角色参考图优先级修正（commit `42290dec`）

依据 SOUL-IMPLEMENTATION-PLAN §5.1 的 1.1 条（C1，一手证据链）：火山方舟官方明令
「人物参考图优先使用单人独立照片，**不建议使用三视图、多视图素材**」。
原实现两处均把 `turnaround_sheet` 列第一优先级，与官方建议相反。

新增 `web/src/lib/canvas/character-reference-images.ts`（两处共用唯一实现）：
- `CHARACTER_REFERENCE_ROLE_PRIORITY = front → side → back → primary → turnaround_sheet`
- `resolvePreferredCharacterRepresentation()` / `resolvePreferredCharacterImage()`（后者
  额外要求 mediaType 为图片，参考图注入只接受图片）
- 回退语义：primary 通常是系统生成主图（可能是拼图）故排在三个独立视角之后；
  turnaround_sheet 垫底——不是禁用，而是「无更好独立照片时才用」

两处调用点改薄包装：`canvas-node-generation.ts` / `workflow-shot-references.ts`。
单测 7 例（计划要求的四组 + 媒体类型约束）。
其余 turnaround_sheet 用法（封面/缩略图）与生成参考注入无关，不在范围。

## 门禁（全部通过）

| 项 | 结果 |
|----|------|
| tsc --noEmit | 0 |
| eslint src test | 0 |
| 全量 bun test | **2524 pass / 0 fail**（326 文件，+11 新用例）|
| build | ✅ |

守卫跟进 4 条（均因外置而改断言面，规则存在性不变）：
`canvas-node-toolbar-menu-style` / `composer-detail-fixes`×2 / `workspace-route-loading`。
教训沿用：负向断言必须剥离注释看代码面（注释合法引用旧写法）。

## PATCH-MAP
K1-K7 已登记（外置层 / globals 迁出 / 动效收编 / 护栏 / wallet / 角色参考 ×2）。

## 待控制线验收
- 四块外置 + 三骑乘件共 6 个 commit，未推送
- worktree `/mnt/f/CODE/Project/oac-wt-flora`（分支 `feat/flora-overrides`）
