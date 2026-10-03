import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * 裸毫秒护栏（W4 骑乘件一，2026-10-03）。
 *
 * 背景：深拆 S15d 一手统计——`transition:` 内 389 个时长字面值中 364 个是硬编码毫秒（94%），
 * 其中 160ms/180ms/140ms 三值占 265 个且全部不在 token 表内。规范与代码之间存在断层。
 *
 * 本护栏只覆盖「W4 外置触碰面」：flora-overrides.css（fork 组件覆写层）与随迁的
 * 画布节点渲染组件。全局收编另立任务，不在本护栏范围——所以断言面是白名单制，
 * 而非全仓扫描。
 *
 * 白名单语义（两类，均需逐条给理由）：
 *   ① 语义性时长——不是「动效档位」，而是业务契约的一部分
 *      （如 S04 加载填充的 60s 缓爬、进度回跳 0.3s 桥接、旋转动画 4s 周期）
 *   ② token 引用——var(--motion-*) 形式，天然豁免
 *
 * 检查方式：剥离注释后扫描 `transition:` / `animation:` 声明中的裸时长字面值。
 * 剥离注释是必须的——注释里合法地引用了这些数值（解释历史决策），
 * 不剥离会产生假阳性（同类教训已在本仓复发三次：Xbot / jsDelivr ORT / backdrop-filter）。
 */

const overrides = readFileSync(new URL("../src/styles/flora-overrides.css", import.meta.url), "utf8");

/** 剥离 CSS 注释，保留行数（便于报错定位）。 */
function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1));
}

/**
 * 白名单：语义性时长（非动效档位）。
 * 每条必须能回答「为什么它不该走 --motion-dur-* 档位」。
 */
const SEMANTIC_DURATION_WHITELIST: Array<{ value: string; reason: string }> = [
    {
        value: "4s",
        reason: "flora-generating-border-rotate 的无限旋转周期——是动画节奏不是过渡时长，与 --motion-scale 降级无关（reduced-motion 已单独关断）",
    },
    {
        value: "60s",
        reason: "canvas-loading-fill-fallback 的缓爬时长，S04 契约照抄 flora 066 chunk 原文 durationMs 6e4——改值即改产品语义",
    },
    {
        value: "0.3s",
        reason: "canvas-loading-fill-correction 的进度回跳桥接时长，S04 三态之一——与进度语义绑定，非通用档位",
    },
];

/** 提取 `transition:` / `animation:` 声明行中的裸时长字面值。 */
function findBareDurations(css: string): Array<{ line: number; value: string; text: string }> {
    const out: Array<{ line: number; value: string; text: string }> = [];
    const lines = stripComments(css).split("\n");
    lines.forEach((raw, index) => {
        const text = raw.trim();
        if (!/^(transition|animation)(-duration)?\s*:/.test(text)) return;
        // 只认「裸」值：后面不跟 var( 的时长字面值。var(--motion-*) 天然豁免。
        for (const match of text.matchAll(/(?<![\w-])(\d+(?:\.\d+)?)(ms|s)(?![\w-])/g)) {
            out.push({ line: index + 1, value: match[0], text: text.slice(0, 90) });
        }
    });
    return out;
}

test("flora-overrides.css 的 transition/animation 不含白名单外的裸毫秒（W4 骑乘件一）", () => {
    const found = findBareDurations(overrides);
    const allowed = new Set(SEMANTIC_DURATION_WHITELIST.map((item) => item.value));
    const offenders = found.filter((item) => !allowed.has(item.value));
    expect(offenders.map((item) => `L${item.line} ${item.value}: ${item.text}`)).toEqual([]);
});

test("白名单条目全部仍在文件中出现（防白名单腐烂）", () => {
    const stripped = stripComments(overrides);
    for (const { value, reason } of SEMANTIC_DURATION_WHITELIST) {
        expect({ value, reason, present: stripped.includes(value) }).toEqual({ value, reason, present: true });
    }
});

test("触碰面已收编三个目标值（140/160/180ms 不再裸写）", () => {
    const stripped = stripComments(overrides);
    for (const value of ["140ms", "160ms", "180ms"]) {
        expect({ value, present: stripped.includes(value) }).toEqual({ value, present: false });
    }
});

test("外置层保持 @layer utilities 包裹（层级契约，违反即静默失效）", () => {
    // globals.css 的 fork 增量位于 @layer utilities；外置层必须同层才能保住胜出关系。
    // 未分层段（no-motion 关断）是该契约的唯一例外，位于 @layer 块之后。
    expect(overrides).toContain("@layer utilities {");
    const layerStart = overrides.indexOf("@layer utilities {");
    let depth = 0;
    let layerEnd = -1;
    for (let i = layerStart; i < overrides.length; i += 1) {
        if (overrides[i] === "{") depth += 1;
        else if (overrides[i] === "}") {
            depth -= 1;
            if (depth === 0) {
                layerEnd = i;
                break;
            }
        }
    }
    expect(layerEnd).toBeGreaterThan(layerStart);
    // @layer 之外只允许未分层段（no-motion 关断）——不得再有别的规则混在外面。
    // 按花括号深度取「顶层规则」的选择器（跳过嵌套声明与 at-rule 内部）。
    const outside = overrides.slice(layerEnd + 1).replace(/\/\*[\s\S]*?\*\//g, "");
    const topLevel: string[] = [];
    let ruleDepth = 0;
    let pending = "";
    for (const ch of outside) {
        if (ch === "{") {
            if (ruleDepth === 0) topLevel.push(pending.trim().replace(/\s+/g, " "));
            pending = "";
            ruleDepth += 1;
        } else if (ch === "}") {
            ruleDepth -= 1;
            pending = "";
        } else if (ruleDepth === 0) {
            pending += ch;
        }
    }
    expect(topLevel).toEqual([
        "@media (prefers-reduced-motion: reduce)",
        ".no-motion [data-affordance]",
        ".no-motion .canvas-node-panel-affordance .canvas-node-panel-enter",
    ]);
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 骑乘护栏两件（控制线 2026-10-03 合入令 ⑥，测试线建议）
 *
 * 动机（门3 裁定记档的方法论增量）：VRT 对「时长变化」存在结构性盲区——
 * Playwright 截图以 animations: disabled 快进到终态，因此 180ms→150ms 这类
 * 纯时长变化在像素上完全不可见。VRT 零 diff **不能**证明动效收编无副作用。
 * 本组护栏补上该盲区：静态解析 var() 链到「解析后的时长」并快照，
 * 任何时长漂移都会在此显形，而不必依赖真实浏览器。
 * ───────────────────────────────────────────────────────────────────────────── */

/** 从 globals.css 解析 token 定义（含 --motion-scale 的媒体查询覆写）。 */
function readMotionTokens(): Map<string, string> {
    const globals = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8");
    const stripped = stripComments(globals);
    const tokens = new Map<string, string>();
    for (const match of stripped.matchAll(/(--motion-[\w-]+)\s*:\s*([^;]+);/g)) {
        const [, name, raw] = match;
        // 同名多次定义时以最后一次为准（globals 内 --motion-scale 有媒体查询覆写，
        // 基础值 L276 在前、覆写在 L331/L339 在后；此处取基础值 1，覆写单独断言）。
        tokens.set(name, raw.trim());
    }
    tokens.set("--motion-scale", "1");
    return tokens;
}

/** 解析 calc(var(A) * var(B)) 与直接引用，返回解析后的时长（ms 数值）。 */
function resolveDuration(expr: string, tokens: Map<string, string>): number | null {
    let value = expr.trim();
    // 展开 var() 引用（最多 4 层，足够覆盖 --motion-dur-fast-calc → --motion-dur-fast × --motion-scale）
    for (let depth = 0; depth < 4; depth += 1) {
        const next = value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => tokens.get(name) ?? `var(${name})`);
        if (next === value) break;
        value = next;
    }
    // calc(A * B)
    const calc = value.match(/^calc\(\s*([\d.]+)ms\s*\*\s*([\d.]+)\s*\)$/);
    if (calc) return Number(calc[1]) * Number(calc[2]);
    const plain = value.match(/^([\d.]+)ms$/);
    if (plain) return Number(plain[1]);
    const seconds = value.match(/^([\d.]+)s$/);
    if (seconds) return Number(seconds[1]) * 1000;
    return null;
}

/**
 * 关键组件时长快照（解析后毫秒值）。
 *
 * 这是 VRT 盲区的补位：VRT 看不见时长，本表看得见。
 * 改动任一时长 → 本表失败 → 强制改动者显式确认（并把新值写进快照）。
 */
const MOTION_DURATION_SNAPSHOT: Array<{ selector: string; property: string; ms: number; note: string }> = [
    { selector: ".canvas-node-hover-composer-surface", property: "transition", ms: 180, note: "composer hover 信息态淡入" },
    { selector: ".canvas-count-settings-popover", property: "animation", ms: 150, note: "设置浮层入场 canvas-panel-in" },
    { selector: ".canvas-settings-popover-closing", property: "animation", ms: 150, note: "设置浮层退场 canvas-panel-out" },
    { selector: ".canvas-settings-option", property: "transition", ms: 150, note: "设置项 hover/选中过渡" },
    { selector: ".canvas-settings-option:active:not(:disabled)", property: "transition-duration", ms: 80, note: "设置项按压反馈" },
    { selector: ".canvas-node-toolbar-surface", property: "animation", ms: 180, note: "工具栏显场（微供给 enter）" },
    { selector: ".canvas-node-panel-affordance .canvas-node-panel-enter", property: "transition", ms: 180, note: "面板显场 180ms ease-out（★ 显/隐不对称的一半）" },
    { selector: ".canvas-node-panel-affordance[data-affordance=\"hidden\"] .canvas-node-panel-enter", property: "transition", ms: 150, note: "面板隐藏 160ms→150ms 档（★ 不对称的另一半）" },
    { selector: ".canvas-node-toolbar[data-affordance=\"hidden\"] .canvas-node-toolbar-surface", property: "animation", ms: 150, note: "工具栏隐场（微供给 exit）" },
    { selector: ".video-duration-range::-webkit-slider-thumb", property: "transition", ms: 150, note: "滑块拇指 hover" },
];

/** 取 @layer utilities 块的文本（快照只应看常规层，不看层外的降级态）。 */
function layeredSurface(): string {
    const stripped = stripComments(overrides);
    const layerStart = stripped.indexOf("@layer utilities {");
    if (layerStart === -1) return "";
    let depth = 0;
    let layerEnd = -1;
    for (let i = layerStart; i < stripped.length; i += 1) {
        if (stripped[i] === "{") depth += 1;
        else if (stripped[i] === "}") {
            depth -= 1;
            if (depth === 0) {
                layerEnd = i;
                break;
            }
        }
    }
    return stripped.slice(layerStart, layerEnd + 1);
}

/**
 * 取「最后一个**声明了目标属性**的规则体」。
 *
 * 两个坑（本次实现各踩一次）：
 *  ① 同一选择器常有多条规则（玻璃面、尺寸、动效分开写），取「最后一次出现」
 *     会落到不含目标属性的那条上；
 *  ② no-motion 关断段（@layer 之外）用同一批选择器声明 `transition: none !important`，
 *     那是降级态而非常规时长，必须排除——故限定在 @layer utilities 内查找。
 */
function ruleBodyFor(selector: string, property: string): string | null {
    const layered = layeredSurface();
    const tokens = readMotionTokens();
    let found: string | null = null;
    for (const match of layered.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = (match[1] ?? "").split(/\s+/).join(" ");
        if (!sel.split(",").map((s) => s.trim()).includes(selector)) continue;
        const body = match[2] ?? "";
        const decl = body
            .split(";")
            .map((d) => d.trim())
            .find((d) => d.startsWith(`${property}:`));
        if (!decl) continue;
        // 跳过解析不出时长的声明（`transition: none !important` 是 reduced-motion
        // 降级态，不是常规时长；取到它会让快照变成 null）
        const candidates = decl.slice(decl.indexOf(":") + 1).match(/(var\(--motion-[\w-]+\)|[\d.]+m?s)/g) ?? [];
        if (candidates.some((c) => resolveDuration(c, tokens) !== null)) found = body;
    }
    return found;
}

test("⑥a 关键组件时长快照（解析后毫秒值）——补 VRT 对时长变化的结构性盲区", () => {
    const tokens = readMotionTokens();
    const actual: Array<{ selector: string; property: string; ms: number | null; note: string }> = [];
    for (const entry of MOTION_DURATION_SNAPSHOT) {
        const body = ruleBodyFor(entry.selector, entry.property);
        if (body === null) {
            actual.push({ ...entry, ms: null });
            continue;
        }
        // 取该属性声明里「第一个能解析出时长的 token」。
        //
        // 两个坑（各踩一次）：
        //  ① @layer 内也有 `transition: none !important`（reduced-motion 降级）——
        //     按「最后一个声明该属性的规则」取会落到它上面，时长变 null；
        //     改为「第一个可解析出时长的 token」后，`none` 天然无 token 而被跳过。
        //  ② animation 简写的动画名是普通标识符（canvas-panel-in），不匹配 token 正则，
        //     故时长是**第 1 个**匹配到的 token，不是第 2 个（按位置猜会取到 easing）。
        const decl = body
            .split(";")
            .map((d) => d.trim())
            .find((d) => d.startsWith(`${entry.property}:`));
        if (!decl) {
            actual.push({ ...entry, ms: null });
            continue;
        }
        const expr = decl.slice(decl.indexOf(":") + 1);
        const candidates = expr.match(/(var\(--motion-[\w-]+\)|[\d.]+m?s)/g) ?? [];
        let resolved: number | null = null;
        for (const candidate of candidates) {
            resolved = resolveDuration(candidate, tokens);
            if (resolved !== null) break;
        }
        actual.push({ ...entry, ms: resolved });
    }
    expect(actual).toEqual(MOTION_DURATION_SNAPSHOT.map((e) => ({ ...e, ms: e.ms })));
});

test("⑥a-bis 显/隐不对称性未被收编抹平（180ms 显场 vs 150ms 隐场）", () => {
    const tokens = readMotionTokens();
    const show = ruleBodyFor(".canvas-node-panel-affordance .canvas-node-panel-enter", "transition");
    const hide = ruleBodyFor(".canvas-node-panel-affordance[data-affordance=\"hidden\"] .canvas-node-panel-enter", "transition");
    expect(show).not.toBeNull();
    expect(hide).not.toBeNull();
    const showMs = resolveDuration((show ?? "").match(/(var\(--motion-[\w-]+\))/)?.[1] ?? "", tokens);
    const hideMs = resolveDuration((hide ?? "").match(/(var\(--motion-[\w-]+\))/)?.[1] ?? "", tokens);
    // 显场必须比隐场慢——这是 flora 刻意的「回位慢、收拢快」体感，映射到同一 token 即破坏
    expect({ showMs, hideMs, asymmetric: (showMs ?? 0) > (hideMs ?? 0) }).toEqual({
        showMs: 180,
        hideMs: 150,
        asymmetric: true,
    });
});

test("⑥b 层级契约机器护栏：@layer utilities 之外的顶层规则只允许 no-motion 关断段", () => {
    // 文件头契约从「人工遵守」升级为「机器护栏」（控制线合入令 ⑥b）：
    // 除 no-motion 关断段外，任何顶层规则出现在 @layer utilities 之外都意味着
    // 该规则会输给所有未分层规则（@layer 内规则永远输给未分层规则）→ 静默失效。
    const stripped = stripComments(overrides);
    const layerStart = stripped.indexOf("@layer utilities {");
    expect(layerStart).toBeGreaterThan(-1);

    // 找 @layer 块的结束位置（花括号配平）
    let depth = 0;
    let layerEnd = -1;
    for (let i = layerStart; i < stripped.length; i += 1) {
        if (stripped[i] === "{") depth += 1;
        else if (stripped[i] === "}") {
            depth -= 1;
            if (depth === 0) {
                layerEnd = i;
                break;
            }
        }
    }
    expect(layerEnd).toBeGreaterThan(layerStart);

    // 收集 @layer 之外的所有顶层规则选择器
    const outside = stripped.slice(layerEnd + 1);
    const topLevel: string[] = [];
    let ruleDepth = 0;
    let pending = "";
    for (const ch of outside) {
        if (ch === "{") {
            if (ruleDepth === 0) topLevel.push(pending.trim().replace(/\s+/g, " "));
            pending = "";
            ruleDepth += 1;
        } else if (ch === "}") {
            ruleDepth -= 1;
            pending = "";
        } else if (ruleDepth === 0) {
            pending += ch;
        }
    }

    // 白名单：no-motion 关断段（未分层是其正确形态——!important 在层内的优先级高于层外）
    const NO_MOTION_ALLOWED = [
        "@media (prefers-reduced-motion: reduce)",
        ".no-motion [data-affordance]",
        ".no-motion .canvas-node-panel-affordance .canvas-node-panel-enter",
    ];
    const offenders = topLevel.filter((sel) => !NO_MOTION_ALLOWED.includes(sel));
    expect({ offenders, outsideCount: topLevel.length }).toEqual({ offenders: [], outsideCount: 3 });
});
