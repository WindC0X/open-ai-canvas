# flora W3 令牌外置 技术设计

> 输入：MASTER-PLAN §4.1 分步 3 + PATCH-MAP.md（75 条直改账本）+ DESIGN.md 动效规格表 + 本仓实读（含上游 5eab8126 拆分影响、批次〇侦察笔记 §四）。
> 原则：同名变量覆盖、上游零改动、A 类条目先迁移；代码动工等 v1.5.x 同步落地（串行纪律）。

## 1. 文件边界

### 新增

| 文件 | 职责 |
| --- | --- |
| `web/src/styles/flora-tokens.css` | Semantic 层令牌值重定义（覆盖表 + 动效变量定义），唯一新文件 |
| `web/test/flora-tokens-coverage.test.ts` | 契约测试：PATCH-MAP A 类条目在 flora-tokens.css 有对应覆盖、加载序在样式链末端（源码断言风格，参照 agent-panel-overlay-zorder.test.ts） |

### 修改（接线面，同步落地后确认最终行号）

| 文件 | 改动 |
| --- | --- |
| `web/src/application.tsx` | 样式导入链末端 +1 行 `import "./styles/flora-tokens.css"`（当前 globals.css 在 :4；上游 5eab8126 新增 styles/shared/* 导入后按实际链定位） |
| `PATCH-MAP.md`（仓库根） | Top20 逐条标注迁移状态：A 类 → "已由 flora-tokens.css 承担"；B 类保留待 W4 |
| `docs/content/docs/…`（如涉令牌文档） | 按需同步；无 API/表/SSE 变化不触后端文档 |

### 明确不碰

- `globals.css` 本体（本卡期内不改；其中 A 类直改值在同步合并时随上游文件布局迁移，见 §3）。
- `app-theme.ts` / `canvas-theme.ts`（TS 侧唯一落点，保持不动）。
- 任何上游文件。

## 2. 覆盖表设计（flora-tokens.css 内容结构）

```css
/* flora-tokens.css — fork 语义层覆盖。加载序：application.tsx 样式链末端。
   取值依据 DESIGN.md 动效规格表（2026-09-03）+ PATCH-MAP Top20 条目。
   只用既有 token 名做值覆盖，不新增 Primitive。 */
:root {
  /* —— 动效（R2）：值定义从 globals.css 迁出，使用侧引用名不变 —— */
  --motion-dur-fast: 150ms;   /* DESIGN: fast 100–150ms */
  --motion-dur-base: 250ms;   /* DESIGN: base 200–250ms */
  --motion-dur-slow: 400ms;   /* DESIGN: reveal 300–400ms */
  --motion-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --motion-ease-in: cubic-bezier(0.64, 0, 0.78, 0);

  /* —— Semantic 层覆盖（R1）：逐条对齐 PATCH-MAP Top20 —— */
  /* [PM-01] 挂件/composer … */
}
```

- 覆盖条目标题注释带 PATCH-MAP 条目号，测试可校验一一对应。
- 与 globals.css 的共存语义：**同名变量后加载者胜**；globals.css 原值保留（作为回退与上游合并基线），不在本卡删除。

## 3. 同步耦合（W3 与 v1.5.x 的串行接口）

- 上游 5eab8126 把 model-picker/overlays/scrollbars 等规则移出 globals.css → 我方模型菜单 flora 直改值（P51-030 族）随上游新文件布局落位；W3 覆盖表以**同步落地后的实际文件位置**为参照重排。
- 加载序成立条件升级：flora-tokens.css 必须在 `application.tsx` 全部样式 import 之后（现链：reset → globals.css →（同步后）styles/shared/* → …）。
- PATCH-MAP 复核是同步 SOP 的既定步骤；W3 动工前置 = 同步已落地 + PATCH-MAP 复核完成。

## 4. 取舍记录

1. **覆盖 vs 直改**：选覆盖（上游零改动、冲突面从"组件规则交错"降为"令牌值并列"）；代价 = globals.css 原值双份存在（迁移期可接受，W4 后 PATCH-MAP 收敛度量）。
2. **值定义迁出 vs 使用侧引用不动**：只迁"定义"，不动任何 `var(--motion-dur-*)` 消费点——避免把外置变成全仓替换。
3. **不建 flora-overrides.css**：W4 范围；本卡把组件覆写留给同步后的实际文件边界（上游拆分已替我方划好分块）。
4. **测试形态**：源码断言（覆盖表↔PATCH-MAP 一致 + 加载序位置），不引入新的浏览器测试依赖；视觉正确性归门 3 截图 diff。
5. **代码动工时机**：串行纪律优先——同步不落地不动代码（同域冲突会双份返工）。

## 5. 风险

- **基线时效缺口（R3 验收）**：flora-baseline 5 张采于 da69a249（测试线记录），其后 main 进 HUD 纯层叠/Agent 面板/执行容错批次——W3 动工前重采基线（同盘同 runner），旧基线降为历史参照。
- **门 3 前置**：五条 spec 自 W3 起生效（MASTER-PLAN §4.3 SOP 第 4 步），本卡验收与门 1/门 3 联动。
- **漂移风险**：上游继续拆分/重命名 styles 文件——每次同步后重核一次加载链与覆盖表落点（进同步 SOP 检查项）。
