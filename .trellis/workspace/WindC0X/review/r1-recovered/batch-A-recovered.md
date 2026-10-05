# batch-A 恢复版摘要（A 组：R25m 能力登记处）

> **★ 来源标注（C4 纪律）**
> 本文件是**恢复件**，非原始 `batch-A.md` 正文。
> **来源**：主会话 jsonl（`/home/windc0x/.pi/agent/sessions/--mnt-f-CODE-Project-pi--/2026-09-03T21-44-45-181Z_01a0693b-3d7d-79a3-91f1-66828cc4578e.jsonl`）
> 中**已落盘发送过的 R1 报告正文**（行 13822，6517 字符，完整含 §3.5 A 组三条 + §4 测试质量 + §7 未复核线索）。
> 原始 `batch-A.md`（v2，12 条）**已随 `/tmp` 重启丢失**，本件是其**在 R1 报告中的权威转述**（我本人撰写，非二手）。
> **证据强度**：A-1/A-2/A-3 的**锚点行号**本轮已重新用 `git show 374bdf22:<path>` 逐条核实（见 §4）。

---

## 0. 批次信息

| 项 | 内容 |
|---|---|
| 批次 | A（R25m 能力登记处） |
| 提交 | `7e18af3c`（片 1-2，第一父 `980fdef2`）、`57714bb1`（片 3-9，第一父 `478cbeea`） |
| 锚点 | `374bdf22`（R1 冻结快照） |
| 计数 | **P0=0 / P1=3 / P2=5 / P3=4 = 12 条** |
| 动态验证 | `/home/windc0x/oac-ext4/oac-wt-baseline/web`（同 commit）；`registry-adapters.test.ts` + `registry-namespace-guard.test.ts` → **69 pass / 0 fail / 615 expects**；6 文件联跑 140 pass / 0 fail |
| 核验 | 3 条 P1 **全部 confirmed**（`verify-A.md` 7525 字节），其中 1 条（A-1）核验建议**降 P2** |

---

## 1. P1 三条（全部 confirmed）

### A-1 前端版本校验防线不存在（★ 核验建议降 P2）

**原始表述**：「『前端版本校验』防线在实码里不存在，但测试与验证记录都宣称它已落地」

**锚点**：`web/test/registry-namespace-guard.test.ts:89-93`

**核验修正（重要）**：门①/门④ 的 ✅ **只管字段落位与 Go 侧校验，两者都真落了**。
正确的表述应是：

> **§3.3「前端消费必须校验版本」的消费侧未落，且验证记录未登记该缺口。**

**本轮复核**（见 §4）：`:89-93` 实测是

```ts
test("每个能力条目有 registryVersion 版本锚点", () => {
    for (const entry of CAPABILITY_ENTRIES) {
        expect(Number.isInteger(entry.registryVersion)).toBe(true);
        expect(entry.registryVersion).toBeGreaterThan(0);
    }
});
```

⇒ 这条断言验的是**条目级** `registryVersion` 字段存在，**不是**「消费侧拿到 payload 后校验版本」。
架构方案 §3.3 要求的**消费侧版本校验**在实码中确实不存在。

**降级理由**：这是**未落地的防线**，而非**错误实现**；且影响面限于未来消费侧。
**处置**：降 P2，随批或缝隙池。

---

### A-2 片 7「收编但不丢弃」不成立（motion prompt 33/33 空）+ 测试假绿

**原始表述**：「片 7 宣称的『收编但不丢弃 —— 数据仍在』在生产路径下不成立（motion prompt 33/33 全空）」

**锚点**：`web/src/lib/canvas/registry-adapters.ts:32-34`（适配器）、`web/test/registry-adapters.test.ts:510-516`（测试）

**核验结论**：confirmed（探针：真实 `ToolSummary` 形状下 `PROMPT=""`）

**核验修正（影响面）**：

> **本枝无 motion 消费者**，所以不是「线上丢了 33 条」，而是
> 「**未来消费侧会拿到空串** + **现在测试假绿**」。
> 适配器注释**已明写**该限制（`:32-34`）——缺的是**测试与验证记录同步**。

**机制（★ 控制线定位 + 我的复核一致）**：

```ts
// web/src/services/api/tools.ts:5-31
ToolSummary = { id, type, labelEn, label, desc, ... }        // ← 列表，无 prompt
ToolItem    = ToolSummary & { extraInfo, prompt }            // ← 详情，有 prompt

// web/src/lib/canvas/registry-adapters.ts:32-34
// 列表摘要（ToolSummary）不含 prompt 大字段，详情（ToolItem）才有 ——
// 列表场景 prompt 留空是预期，需要 prompt 的消费侧走详情接口。
const prompt = "prompt" in tool ? tool.prompt : "";
```

- `listTools()` → `ToolSummary[]` → 适配器输出 **prompt 全空**（33/33）✅ 列表链路成立
- `getTool(id)` → `ToolItem` → 有 prompt ✅ 详情链路正常

**测试假绿**（本轮复核，见 §4）：

```ts
// web/test/registry-adapters.test.ts:510-516
test("★ 收编但不丢弃 —— 数据仍在（窗口标注只控用户面）", () => {
    const asset = registryAssetFromToolSummary({ ...SERVER_MOTION_TOOL } as never)!;
    expect(asset.prompt.length).toBeGreaterThan(0);   // ← 永远绿
    expect(asset.title).toBe("固定镜头");
});
```

fixture `SERVER_MOTION_TOOL`（`:46-52`）**带 `prompt` 字段** = `ToolItem` 形态，
而**生产走 `ToolSummary`（无 prompt）** ⇒ 断言 `prompt.length > 0` **永远绿**，生产**永远空**。

⇒ **V1「验证形态必须匹配被验证对象」的又一实例。**

**处置**：**修测试与验证记录，非代码**（适配器行为是设计预期）。
1. 修测试：喂 `ToolSummary` 形态（无 prompt）→ 断言 `asset.prompt === ""`（记录列表场景预期）；若要测详情形态，显式说明并用 `ToolItem`
2. 补验证记录：注明「列表链路 prompt 空是设计预期（适配器注释已声明），消费侧需 prompt 时走 `getTool` 详情接口」

**★ 对 A线「无法复现 33/33 空」的回应**：
A线 实测「真 seed 数据 + 真适配器 → 33 条 prompt 全非空」，这与 A-2 **不矛盾**——
A线 喂的是**真数据（详情形态，含 prompt）**，而 A-2 指的是**列表形态链路**。
两条链路都对，A-2 说的是**生产走哪条**。**A线 的实测恰好证明了「详情形态有 prompt」**。

---

### A-3 快照脚本 `--verify` 假通过

**原始表述**：「快照脚本 `--verify` 在 manifest 被改写或裁剪时静默通过（防线 1 的自证能力）」

**锚点**：`scripts/snapshot-registry-seeds.sh:60-102`

**核验结论**：confirmed（空 manifest 报「逐字节一致」，exit=0）

**语义歧义补充**：`--verify` 的**严格语义**是「**当前 seed 是否仍等于快照记录值**」，
当「**快照可信度检查**」用是**调用侧期望落差**。

**★ 本轮动态复现**（新增证据，机制已确认）：

```bash
# 机制：while read 的输入是 grep 过滤结果 —— 空 manifest ⇒ 循环体零次执行 ⇒ failed 保持 0
while read -r expected name; do ... done < <(grep '^[0-9a-f]\{64\} ' "$dir/manifest.txt")
if [ "$failed" -ne 0 ]; then ...; return 2; fi
echo "校验通过：当前 seed 与快照逐字节一致"   # ← 空输入也走到这里
```

实测（本轮）：
```
空 manifest          → "校验通过：当前 seed 与快照逐字节一致"  exit=0
仅注释行 manifest     → "校验通过：当前 seed 与快照逐字节一致"  exit=0
```

⇒ **假通过机制成立**：任何不含 64 位十六进制行的 manifest 都会静默通过。
与 R3 门禁脚本的 G1 空输入防线（`mapfile -t` + `${#arr[@]}`）**同族**——
**shell 文本工具对空输入不报错**，是「计数/遍历类防线」的通用失效形态。

**处置**：待控制线裁定「修 vs 登记」。

---

## 2. P2 五条（原始表述）

> 以下为 R1 报告中 A 批 P2 的**完整列举**（摘要级，证据细节随 batch-A.md v2 丢失）：

| # | 内容 |
|---|---|
| **A-P2-1** | **入口登记守卫可被完全绕过**：三类 `kind` 不做任何校验，`kind` 与 `target` 也不校验对应关系 |
| **A-P2-2** | **片 2 资产映射与风格中心实际渲染不同源**：10/18 条 title 与 prompt 不同，2 条缺失 |
| **A-P2-3** | **降级清单点击无反应**（死入口） |
| **A-P2-4** | **`asset/image` 与 `asset/video` 两个 `AssetKind` 无消费者也无守卫** |
| **A-P2-5** | **适配器字段保真缺口**：`extra_info[]` 未映射、`media_url` 无落点（架构方案 §3.3 契约未满足） |

---

## 3. P3 四条（原始表述）

| # | 内容 |
|---|---|
| **A-P3-1** | 降级文案被非风格来源复用 |
| **A-P3-2** | reader 把客户端映射错误归因为「服务端不可达」并泄漏内部错误串 |
| **A-P3-3** | 片 3「同源」断言是弱 `includes` 断言，且被守护的字面值写进了测试文件本身 |
| **A-P3-4** | `LEGACY_LIGHTING_PRESETS` / `registryAssetFromLegacyLightingPreset` 无可达消费者 |

---

## 4. 本轮锚点复核（★ 新增证据，非转述）

三条 P1 的锚点本轮用 `git show 374bdf22:<path>` **逐条重读**（不采信转述）：

| 条目 | 文件 | 行 | 复核结果 |
|---|---|---|---|
| A-1 | `web/test/registry-namespace-guard.test.ts` | `:89-93` | ✅ 断言为条目级 `registryVersion` 存在性，非消费侧校验 |
| A-2（适配器） | `web/src/lib/canvas/registry-adapters.ts` | `:32-34` | ✅ 注释明写「列表摘要不含 prompt，详情才有」 |
| A-2（类型） | `web/src/services/api/tools.ts` | `:5-31` | ✅ `ToolSummary` 无 prompt；`ToolItem = ToolSummary & {extraInfo, prompt}` |
| A-2（测试 fixture） | `web/test/registry-adapters.test.ts` | `:46-52` | ✅ fixture **带 prompt**（详情形态） |
| A-2（测试体） | `web/test/registry-adapters.test.ts` | `:510-516` | ✅ 断言 `asset.prompt.length > 0`，喂详情形态 ⇒ 永远绿 |
| A-3 | `scripts/snapshot-registry-seeds.sh` | `:60-102` | ✅ `cmd_verify` 存在（全文已读，逻辑与报告一致） |

---

## 5. batch-A v1 独有线索（★ 另一来源，须区分）

**背景**：`batch-A.md` 曾被两个并行进程写两次——v1（16 条，38573 字节）被 v2（12 条）覆盖。
v1 完整证据丢失，其独有线索从日志恢复，**v2 报告将其列为「未复核线索」**（R1 报告 §7）：

| 线索 | R1 时的复核状态 | R3 时的处置 |
|---|---|---|
| `--label` 路径穿越 | **已复核成立**（造伪仓实测：`--label 'x/../../..'` 写出 snapshot root 外）——本地脚本 P3 | — |
| pageSize=60 静默截断 | **被 v2 推翻**（后端夹到 80，当前 45 条不截断） | — |
| 三段式 id 零报警 | 待复核 | **R3 已复核：P2 确认**（动态测试 14/0 零报警） |
| assetKind 落枚举纪律空转 | 待复核 | **R3 已复核：P3 确认**（插入 asset/audio 90/0 无守卫触发） |
| 12/12 legacy prompt 不同源 | 待复核（v2 有近似项 A-P2-2） | **R3 已复核：确认真实**（grading 待定，见 R3 报告） |
| `signal` 参数声明不符 | 待复核 | **R3 已复核：P2 确认**（`loadSkillPresetAssets` 声明 signal 但从不传参） |

⇒ **v1 的 6 条线索中，4 条已在 R3 侧面 ③ 结清**，2 条（`--label` 穿越已成立 / pageSize 已被推翻）无需再动。

---

## 6. 恢复局限（诚实边界）

| 项 | 状态 |
|---|---|
| **原始 `batch-A.md` v2 正文** | ❌ **不可恢复**（`/tmp` 随重启丢失） |
| **R1 报告中的 A 组转述** | ✅ **完整恢复**（本文件 §1-§3，来源 = 会话 jsonl 行 13822） |
| **A 批 P2/P3 的逐条证据（行号/复现步骤）** | ❌ 随 v2 丢失，仅存标题级描述 |
| **`verify-A.md`（7525 字节）正文** | ❌ 丢失，仅存 R1 报告转述的核验结论 |
| **A-1/A-2/A-3 的锚点** | ✅ **本轮已重读核实**（§4） |

**结论**：**A-2 的语义已完整可执行**（不依赖原文）；
**A-1 的降级理由与改写表述已完整**；
**A-3 待裁定**；**P2/P3 仅存标题级**，若需逐条证据须重新评审。

---

**评审线（第四线）· batch-A 恢复件 · 2026-10-05**
