import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * W6 画布弹窗家族 —— UI 样板件令牌契约护栏（2026-10-04）。
 *
 * 背景：W6「画布弹窗家族 UI 统一批」要求 12+ 弹窗统一布局骨架 + 消费 flora tokens +
 * 动效规格表取值。超分弹窗（`canvas-node-super-resolve-dialog.tsx`）是**先行样板**，
 * 本护栏把样板契约从「人工遵守」升级为「机器可检」，防样板随触碰回潮。
 *
 * ★ 断言面刻意限定在样板文件本身，不做全仓扫描 ——
 * 其他弹窗在 W6 批内逐个迁移，本护栏不替它们提前判红。
 *
 * ★ 剥离注释后扫描（本仓已复发三次的假阳性教训：注释合法引用被扫的值）。
 */

const sampleDialog = readFileSync(join(import.meta.dir, "../src/components/canvas/canvas-node-super-resolve-dialog.tsx"), "utf8");

/** 剥离注释（块注释与行注释），保留行数便于定位。 */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1))
        .replace(/^\s*\/\/.*$/gm, "");
}

const code = stripComments(sampleDialog);

describe("W6 弹窗家族样板 —— 令牌契约", () => {
    test("字号全部走 --fs-* 令牌（无裸 text-xs/sm/base/lg/xl）", () => {
        const bare = code.match(/\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/g) ?? [];
        expect(bare).toEqual([]);
    });

    test("圆角全部走 --r-* 令牌（无裸 rounded-md/lg/xl/2xl）", () => {
        const bare = code.match(/\brounded-(sm|md|lg|xl|2xl|3xl)\b/g) ?? [];
        expect(bare).toEqual([]);
    });

    test("间距走 --space-* 令牌（grid/flex 的 gap 不裸写数字）", () => {
        // gap-6 / space-y-5 / p-4 等 Tailwind 裸间距刻度在本样板中应已换成 var(--space-*)
        const bareGap = code.match(/\bgap-[0-9]+\b/g) ?? [];
        const bareSpaceY = code.match(/\bspace-y-[0-9]+\b/g) ?? [];
        expect(bareGap).toEqual([]);
        expect(bareSpaceY).toEqual([]);
    });

    test("动效走 --motion-* 令牌（无裸毫秒 duration）", () => {
        const bareMs = code.match(/\bduration-\[?[0-9]+m?s\]?/g) ?? [];
        const bareTransitionMs = code.match(/transition[^;"]*[0-9]{2,4}ms/g) ?? [];
        expect(bareMs).toEqual([]);
        expect(bareTransitionMs).toEqual([]);
    });

    test("令牌确实被消费（防「删掉裸值但也没用令牌」的空改造）", () => {
        expect(code).toContain("var(--r-");
        expect(code).toContain("var(--fs-");
        expect(code).toContain("var(--space-");
        expect(code).toContain("var(--motion-");
    });

    test("样式常量集中在文件顶部（W6 家族可复用契约）", () => {
        // DIALOG_STYLE 是样板对其他弹窗的「对齐入口」——集中定义才可被复制/引用
        expect(sampleDialog).toContain("const DIALOG_STYLE = {");
        expect(sampleDialog).toContain("} as const;");
    });
});

describe("W6 弹窗家族样板 —— 逻辑零改动契约", () => {
    test("改造只碰样式层：状态机与校验变量保持原样", () => {
        // 这些是改造前就有的逻辑变量，样板改造不得删除或改名
        for (const symbol of ["DEFAULT_SUPER_RESOLVE_PARAMS", "enhanceConfirmed", "reachedTarget", "needsConfirm", "canResolve", "outputSize"]) {
            expect(code).toContain(symbol);
        }
    });

    test("提交路径保持：onConfirm 收到完整 params", () => {
        expect(code).toContain("onConfirm(params)");
    });

    test("reduced-motion 依赖全局 motion-scale（样板不自建降级逻辑）", () => {
        // 动效六规则第 5 条由全局 --motion-scale 承担，弹窗层不重复实现
        expect(code).not.toContain("prefers-reduced-motion");
    });
});
