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
