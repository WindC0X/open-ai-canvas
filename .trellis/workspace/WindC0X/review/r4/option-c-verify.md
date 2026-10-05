# R4 追加 · 选项 C：A线 4 条未验 commit 独立核验

**方法**：临时 worktree（`_r4-cprobe` @ `b6eacc8c`，含四条全部祖先，用完即删）+ 逐条注入证伪
**结论**：**4 条全部通过**，但**发现 2 个测试质量问题**（1 个 P2、1 个 flaky 登记）

---

## §1 核验总表

| commit | 条目 | 基线 | 我的独立证伪 | 判定 |
|---|---|---|---|---|
| `fd40026c` | F-1 超分价格档根因 | 3 pass / 0 fail | 恢复 `break` → **2 红** ✅（与声称一致） | **通过** |
| `63df7eff` | F-2 计费 NaN/Infinity 守卫 | 6 pass / 0 fail | 恢复 `\|\| 0` → **2 红**（声称 1 红） | **通过（护栏更强）** |
| `63df7eff` | F-3 size 真接缝 | 35 pass / 0 fail | 恢复内联 → **1 红** ✅（与声称一致） | **通过** |
| `d3f18b28` | S-4 孤儿令牌删除 | 零残留 | 邻近 4 令牌完好 ✅ | **通过** |
| `b6eacc8c` | S-2 prefill 双通道 | 1 pass / 0 fail | **锚点保留** → 1 红 ✅；**锚点变更** → **假绿** ⚠️ | **通过（证伪脆弱）** |

---

## §2 F-1（`fd40026c`）—— 修复正确，证伪有力

**修复形态**（`model_router.go:313-335`）：
```go
// 原：if image_upscale { selector["operation"] = "image_upscale"; break }  ← break 跳过 quality/size
// 现：
upscale := strings.EqualFold(strings.TrimSpace(intent.Operation), "image_upscale")
if upscale {
    selector["operation"] = "image_upscale"
} else if intent.Inputs["image"] > 0 {
    selector["operation"] = "image_to_image"
} else {
    selector["operation"] = "text_to_image"
}
// ↓ quality/size 归一化对超分同样生效
```

**独立证伪**（恢复 `break`）：
```
--- FAIL: TestImageUpscalePriceTierMatchesQualityCondition
    quality = "", want 2k —— 超分 selector 必须包含 quality（F-1 修复点）
--- FAIL: TestImageUpscaleSpecificTierBeatsWildcard
    tier = &{... SelectorKey:"" SelectorJSON:"{\"operation\":\"*\"}" ...}, want upscale-2k
```
⇒ **第二条精确复现了缺陷形态**（落到 `any-anything` 通配档）——**这是行为级证伪，非源码文本断言**。

**★ 修复方向评价**：控制线裁定「(B) 后端对齐，不选 (A) 前端收窄」——**我认同**：
根因在后端 `break`，修根因同时防「未来经 API 直接配置时复现」，比修表现彻底。

---

## §3 F-2（`63df7eff`）—— 修复正确，护栏比自述更强

**修复形态**：
```ts
export function finiteMicrocredits(value: number | undefined | null): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.round(value * 1_000_000);
}
```
覆盖 `unitPrice` / `inputTokenPrice` / `outputTokenPrice` / `cachedTokenPrice` + `costPricing` 全组。

**独立证伪**（恢复 `Math.round((value || 0) * 1e6)`）：
```
(fail) finiteMicrocredits 拦下非有限值（Infinity/NaN/-Infinity）
(fail) ★ F 组回归：payload 中价格字段不得出现非有限值（序列化后不为 null）
→ 4 pass / 2 fail
```

**★ 与 A线 自述的差异**：A线 称「注入 → **恰好 1 红**」，实测 **2 红**。
- **判定**：这是**护栏更强**（多一条边界测试也红了），**不是缺陷**
- **登记为观察项**（非 P 级）：A线 的自述偏保守，实际证伪面更宽

**★ 我认同 A线 的实测形态更正**：原描述「NaNxNaN」→ 实测 `Infinity` 经 `JSON.stringify` 得 **`null`**
（`Infinity || 0` = Infinity，`Math.round(Infinity * 1e6)` = Infinity，序列化 → null）。
**null 比 NaN 更隐蔽**（会被当缺省值）——这个更正**提高了缺陷的真实严重性认知**。

---

## §4 F-3（`63df7eff`）—— 真接缝修复到位

**修复形态**：
```ts
// 新增真接缝（生产代码同一函数）
export function resolveSuperResolveConfigSize(baseSize, sourceWidth, sourceHeight, targetResolution): string | undefined {
    void baseSize;                                    // 显式声明不参与计算
    if (!(sourceWidth > 0) || !(sourceHeight > 0)) return undefined;
    return superResolveSize(sourceWidth, sourceHeight, targetResolution);
}

// 接线处改为调用它
const resolvedSize = resolveSuperResolveConfigSize(generationConfig.size, sourceWidth, sourceHeight, params.targetResolution);
if (resolvedSize) generationConfig.size = resolvedSize;
```

**独立证伪**（恢复内联 `if (sourceWidth > 0 && sourceHeight > 0) generationConfig.size = superResolveSize(...)`）：
```
(fail) ★ 入口可达性（反模式 #12：有代码≠能用） > ★ 真接缝接线（源码级）：media-tools 调用真接缝而非内联复刻
→ 34 pass / 1 fail
```
⇒ **恰好 1 红**，与声称一致。

**★ 评价**：这是 **R1 F-3「测试镜像实现」的正解**——
测试从「复刻表达式」改为「断言真接缝返回值」+ 三不变量 + 源码级接线断言（反向）。
`void baseSize` 显式声明「不参与计算」是**好实践**（防未来有人误用该参数）。

---

## §5 S-4（`d3f18b28`）—— 删除精确，无残留

**改动**：`globals.css` 删 1 行（`--canvas-mention-chip-offset-y: 0.14em;`）

**独立核验**：
```
grep -rn "canvas-mention-chip-offset-y" web/src web/test  → 零残留（定义与引用均无）
邻近 4 令牌完好：
  --canvas-mention-chip-height: 22px;          :1283
  --canvas-mention-chip-preview-size: 18px;    :1284
  --canvas-mention-chip-gap: 0.12em;           :1285
  --canvas-mention-chip-padding-inline: 0.16em;:1286
  （删除的 offset-y 原在 :1287）
```
⇒ **精确删行，未误伤相邻令牌**。

---

## §6 ★ S-2（`b6eacc8c`）—— 修复正确，但**证伪声明脆弱**（P2 发现）

### 6.1 修复本身：正确

```ts
// 两通道各自独立 ref
const lastPrefillRequestIdRef = useRef(0);
const lastPrefillPromptIdRef = useRef(0);

useEffect(() => {
    // ① 上游 prefillRequest：追加语义
    if (prefillRequest && prefillRequest.id !== lastPrefillRequestIdRef.current) {
        lastPrefillRequestIdRef.current = prefillRequest.id;
        if (prefillRequest.text.trim()) { setPrompt(c => appendAgentPromptPrefill(c, prefillRequest.text)); setView("chat"); }
    }
    // ② fork prefillPrompt：替换语义（不再被 early-return 吞掉）
    const value = prefillPrompt?.trim();
    const prefillId = prefillPromptId ?? 0;
    if (value && prefillId !== lastPrefillPromptIdRef.current) {
        lastPrefillPromptIdRef.current = prefillId;
        setPrompt(value);
        setView("chat");
    }
}, [prefillPrompt, prefillPromptId, prefillRequest]);
```
⇒ **两通道都执行、独立去重、无 early-return** —— 与 R2-S2 的裁定方向（独立 ref）一致。

### 6.2 ★ P2：证伪声明依赖**脆弱的源码锚点**

**A线 声称**：「注入『恢复 early-return』→ 测试**红**（0 pass / 1 fail）」

**我的两次注入，结果不同**：

| 注入形态 | 结果 | 说明 |
|---|---|---|
| **保留锚点字符串** `if (prefillRequest && prefillRequest.id !==` | **0 pass / 1 fail** ✅ | 与 A线 声称一致 |
| **恢复原 early-return 写法**（`if (prefillRequest) {` … `return; }`） | **1 pass / 0 fail** ❌ **假绿** | 锚点字符串消失 |

**假绿机制**（探针实测）：
```ts
const anchor = "if (prefillRequest && prefillRequest.id !==";
const start = panel.indexOf(anchor);              // → -1（锚点缺失）
const end = panel.indexOf("const value = ...");   // → 20521
const requestBranch = panel.slice(-1, 20521);     // → 长度 0（空串）
expect(requestBranch).not.toContain("return;");   // → 恒真 ✓
```

⇒ **`slice(-1, N)` 得到空串，`not.toContain` 恒真** —— 测试在「锚点缺失」时**静默通过**。

**★ 为何重要**：
- 这条断言的**目的**是「防止 prefillRequest 分支 early-return 吞掉 fork 通道」
- 但**最自然的「恢复缺陷」写法**（把 `if (prefillRequest && ... !== ref)` 改回 `if (prefillRequest)`）
  **恰好会让锚点消失** ⇒ **测试静默通过** ⇒ **该断言对最可能的回归形态无防护**
- 与 R3 的「源码文本断言」教训同族，但**更隐蔽**：R3 的形态是「注释掉仍匹配」，这条是「锚点消失导致空切片」

### 6.3 修复方向

| 方案 | 做法 |
|---|---|
| **推荐** | 切片前断言锚点存在：`expect(start).toBeGreaterThan(-1)`（锚点缺失时显式失败） |
| 或 | 改为行为级测试（渲染面板 + 注入 prefill props → 断言两次 setPrompt 调用），但成本较高 |
| 或 | 锚点改为「不依赖会被改写的字符串」——如用 `panel.indexOf("const value = prefillPrompt?.trim();")` 向前查找 |

### 6.4 与 A线 自述的对照

A线 commit message 已**主动登记一处类似教训**：
> ★ 附带修正：首版测试用 `not.toContain("lastPrefillIdRef")` 误判（子串匹配），改为词边界正则

⇒ A线 **有意识处理了子串问题**（`\blastPrefillIdRef\b`），但**未覆盖「锚点缺失 → 空切片」**这一形态。
**登记为 P2**（测试质量，非功能缺陷），建议随下批修。

---

## §7 环境与回归

### 7.1 前端全量

```
b6eacc8c 全量                    → 3051 pass / 7 fail
7 fail 构成                      → 全部 asset-repair 族（load-deadlock 污染源受害者）
排除污染源后                     → 3018 pass / 0 fail（★ 复跑 2 次一致）
首次排除跑出现的 1 fail           → flaky（复跑消失）
```

⇒ **四条 commit 无前端回归**。

### 7.2 后端

```
go test ./internal/app/                     → FAIL（5 条 TestCloudAgent*）
失败原因                                     → Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'undici'
                                            imported from backend/agent-runtime/pi/agent-runtime.mjs
归因                                         → 临时树缺 backend/agent-runtime/pi/node_modules
                                            （我建树时只软链了 web/，**非 F-1 引入**）
对照 baseline 树                             → 同样缺（既有环境缺口，非本次引入）
F-1 真实回归面（计费相关）                     → go test -run "TestImageUpscale|TestSKU|TestPriceTier|TestChannelModelPrice" → ok
```

⇒ **后端无 F-1 相关回归**；`TestCloudAgent*` 5 红是**环境缺口**（V4 已登记族）。

---

## §8 覆盖声明

- **已做**：5 项注入证伪（F-1/F-2/F-3/S-2 + S-4 残留核查）、前端全量对照、后端计费面回归、flaky 复跑确认
- **未做**：`8594667a`（C 组，控制线已验）、`7978b0a3`/`abb92add`/`6d93dc91`/`e111a6ad`/`7228e83f`/`e2431865`/`c806599a`（控制线已验）——**不重复核验**
- **环境**：临时树 `_r4-cprobe @ b6eacc8c`（ext4，已删除）；`web/node_modules` 软链测试线 twin；**未在 `/mnt/f` 跑测试**
- **产出**：本文件 + `.trellis/workspace/WindC0X/review/r4/option-c-verify.md`

---

**计数：P0=0 · P1=0 · P2=1（S-2 证伪脆弱）· P3=0**（+ 1 观察项：F-2 护栏强于自述）

**评审线（第四线）· R4 选项 C · 2026-10-05**
