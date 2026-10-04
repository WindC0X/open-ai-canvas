import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * W5 统一任务面 —— 独立性护栏（2026-10-05）。
 *
 * 设计卡：`docs/artifacts/w5-unified-task-face-card.md` §4.3/§4.4/§7.2。
 *
 * 背景：统一任务面的**订阅契约**（方案 §5 工程约束）是「任务状态只来自
 * `subscribeGenerationTasks(taskIds)`，不监听当前画布事件」。当前实现事实成立，
 * 但未写成纪律 —— 未来改动可能为了「顺手」引入画布状态监听。
 *
 * 教训来源：`docs/plans/pending-test.mdx:3763` 撤销反噬（撤销 95 秒后被自动同步反噬）
 * —— 状态被非预期路径改写的失效模式。任务面若监听画布事件，画布撤销/编辑/同步
 * 会反向污染任务态（反模式 A2/A4）。
 *
 * ★ 本护栏把纪律变成机检：`src/components/task/` 下**任何**文件
 * （含未来新增）都不得依赖画布层。扫描整个目录而非单个文件 ——
 * 新增文件自动纳入护栏，不需要改测试。
 *
 * ★ 剥离注释后扫描（本仓已复发三次的假阳性教训：注释里的合法引用会被误扫）。
 */

const taskFaceDir = join(import.meta.dir, "../src/components/task");

/** 剥离注释（块注释与行注释），保留行数便于定位。 */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1))
        .replace(/^\s*\/\/.*$/gm, "");
}

type TaskFaceFile = { path: string; code: string };

function taskFaceFiles(): TaskFaceFile[] {
    if (!existsSync(taskFaceDir)) return [];
    return readdirSync(taskFaceDir)
        .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
        .filter((name) => !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"))
        .map((name) => ({
            path: `src/components/task/${name}`,
            code: stripComments(readFileSync(join(taskFaceDir, name), "utf8")),
        }));
}

const files = taskFaceFiles();
const joined = files.map((file) => `/* ${file.path} */\n${file.code}`).join("\n");

describe("统一任务面 —— 独立性护栏", () => {
    test("任务面组件存在且可扫描", () => {
        expect(files.length).toBeGreaterThan(0);
        expect(files.some((file) => file.path.includes("unified-task-face"))).toBe(true);
    });

    test("零画布依赖：不 import 画布 store / 画布层（反模式 A4）", () => {
        const forbidden = [
            "@/stores/canvas",
            "use-canvas-store",
            "use-canvas-theme-store",
            "@/lib/canvas",
            "@/components/canvas",
        ];
        const offenders: string[] = [];
        for (const file of files) {
            const imports = file.code.match(/^\s*import\s+[^;]+?from\s+["'][^"']+["']/gm) ?? [];
            for (const line of imports) {
                for (const needle of forbidden) {
                    if (line.includes(needle)) offenders.push(`${file.path}: ${line.trim()}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    test("零画布事件订阅：不监听 canvas:* 窗口事件（反模式 A2）", () => {
        const canvasEvents = joined.match(/["'`]canvas:[a-z-]+["'`]/g) ?? [];
        expect(canvasEvents).toEqual([]);
        expect(joined).not.toContain("addEventListener(\"canvas");
    });

    test("订阅契约：状态只来自 subscribeGenerationTasks(taskIds)", () => {
        expect(joined).toContain("subscribeGenerationTasks");
        // 任务状态不得从画布节点/边推导（反模式 A1）
        expect(joined).not.toContain(".nodes");
        expect(joined).not.toContain(".connections");
    });

    test("交付步契约：下载入口在位（硬验收③）", () => {
        expect(joined).toContain("onDownload");
    });

    test("挂载无关契约：「在画布中打开」给而不要求（硬验收②）", () => {
        expect(joined).toContain("showOpenInCanvas");
        expect(joined).toContain("onOpenInCanvas");
    });
});
