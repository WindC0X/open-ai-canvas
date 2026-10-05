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

/**
 * 递归列出任务面目录下的源码文件。
 *
 * ★ P1-1 修复（评审线 R3）：原实现用 `readdirSync(dir)` **非递归**，
 * 注释却宣称「扫描整个目录而非单个文件」—— 子目录文件（如
 * `src/components/task/nested/deep.tsx`）完全不纳入扫描，注入画布依赖后测试仍全绿。
 * 改用 withFileTypes 递归，并保留原有过滤（排除测试文件）。
 */
function collectTaskFaceFiles(dir: string, prefix = "src/components/task"): TaskFaceFile[] {
    if (!existsSync(dir)) return [];
    const collected: TaskFaceFile[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const childPath = `${prefix}/${entry.name}`;
        const childDir = join(dir, entry.name);
        if (entry.isDirectory()) {
            collected.push(...collectTaskFaceFiles(childDir, childPath));
            continue;
        }
        if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
        if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
        collected.push({ path: childPath, code: stripComments(readFileSync(childDir, "utf8")) });
    }
    return collected;
}

function taskFaceFiles(): TaskFaceFile[] {
    return collectTaskFaceFiles(taskFaceDir);
}

const files = taskFaceFiles();
const joined = files.map((file) => `/* ${file.path} */\n${file.code}`).join("\n");

describe("统一任务面 —— 独立性护栏", () => {
    test("任务面组件存在且可扫描", () => {
        expect(files.length).toBeGreaterThan(0);
        expect(files.some((file) => file.path.includes("unified-task-face"))).toBe(true);
    });

    test("零画布依赖：模块图不得含画布面（反模式 A4）", () => {
        // ★ P1-1 修复（评审线 R3）：原实现用**正则扫 import 行**（要求 `from`），
        // 四个盲区均经实证假绿：
        //   ① 侧效 import（`import "@/stores/canvas/use-canvas-store";`）—— 无 from
        //   ② 动态 import() / require() —— 语法域外
        //   ③ 名单外模块（`@/pages/canvas/use-canvas-generation` —— 该模块 :13 持有 canvas-store）
        //   ④ 子目录文件（非递归 readdirSync）
        // 现改为**模块图判定**：用 Bun.build 实际打包，检查产物是否含画布面标记。
        // 这是**语义判定** —— 不管写法（静态/侧效/动态）、不管名单（只问产物里有没有）、
        // 不管层级（间接依赖一并带出）。实测证据（控制线已收）：
        //   基线 252KB 零命中 / 侧效 371KB 命中 / 动态 377KB 命中 /
        //   名单外真模块（use-canvas-generation）691KB 命中
        //
        // ★ 为何用子进程：`bun test` 进程内 Bun.build **不解析项目 tsconfig 的 paths**
        // （实测 `Could not resolve: "@/components/media-preview"`，tsconfig / root / 插件
        // 三种配置均不生效），而裸 bun 进程能正常解析。故 spawn 一个 bun 子进程做构建。
        const offenders: string[] = [];
        for (const file of files) {
            const script = `
const built = await Bun.build({
    entrypoints: [${JSON.stringify(file.path)}],
    target: "browser", write: false, minify: false,
    external: ["react", "react-dom", "antd", "lucide-react", "motion", "@tanstack/react-query"],
});
if (!built.success) {
    console.log("BUILD_FAIL::" + built.logs.map(String).join(" | ").slice(0, 300));
} else {
    const bundle = (await Promise.all(built.outputs.map((o) => o.text()))).join("\\n");
    const hits = ["use-canvas-store", "CANVAS_STORE_KEY", "use-canvas-theme-store"].filter((m) => bundle.includes(m));
    console.log(hits.length ? "HIT::" + hits.join(",") : "CLEAN");
}
`;
            const proc = Bun.spawnSync(["bun", "-e", script], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
            const output = proc.stdout.toString().trim();
            if (output.startsWith("BUILD_FAIL::")) offenders.push(`${file.path}: 模块图构建失败（${output.slice(13, 213)}）`);
            else if (output.startsWith("HIT::")) offenders.push(`${file.path}: 模块图含 ${output.slice(5)}`);
            else if (output !== "CLEAN") offenders.push(`${file.path}: 子进程输出异常（${output.slice(0, 150)}）`);
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
