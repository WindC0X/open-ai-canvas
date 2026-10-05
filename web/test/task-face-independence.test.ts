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
        // 四个盲区均经实证假绿（旧护栏 0/4，新护栏 4/4 —— 控制线独立复现）：
        //   ① 侧效 import（`import "@/stores/canvas/use-canvas-store";`）—— 无 from
        //   ② 动态 import() —— 语法域外（注：**被使用**时才有真实依赖；未使用会被 tree-shake）
        //   ③ 名单外模块（`@/pages/canvas/use-canvas-generation` —— 该模块持有 canvas-store）
        //   ④ 子目录文件（原 readdirSync 非递归，注释却承诺「含未来新增」）
        // 现改为**模块图判定**：Bun.build 实际打包，检查产物是否含画布面标记。
        // 这是**语义判定** —— 不管写法（静态/侧效/动态）、不管名单（只问产物里有没有）、
        // 不管层级（间接依赖一并带出）。实测证据（控制线已收）：
        //   基线 252KB 零命中 / 侧效 371KB 命中 / 动态 377KB 命中 /
        //   名单外真模块（use-canvas-generation）691KB 命中
        //
        // ★ 两个实测坑（控制线独立复现并更正机制）：
        //   1. `bun test` 进程内 **首次** Bun.build 调用必败（多进程采样：
        //      #1=THREW #2=true #3=true ×3 进程），后续调用成功 ——
        //      与 tsconfig/root/plugin 配置无关，是**调用次序**问题。
        //      ⇒ 本测试用**子进程**：每次都是该进程的「首次」调用，行为确定。
        //   2. 未使用的动态 import 会被 tree-shake（无真实依赖，属正确行为）。
        //
        // ★ 成本：**一次**子进程构建全部文件（O(1) 而非 O(N)）——
        //   控制线指出逐文件 spawn 会随任务面扩张线性变慢（1 文件 730ms ⇒ 10 文件 ~7s）。
        const script = `
const entries = ${JSON.stringify(files.map((file) => file.path))};
const results = [];
for (const entry of entries) {
    try {
        const built = await Bun.build({
            entrypoints: [entry],
            target: "browser", write: false, minify: false,
            external: ["react", "react-dom", "antd", "lucide-react", "motion", "@tanstack/react-query"],
        });
        if (!built.success) {
            results.push(entry + "::BUILD_FAIL::" + built.logs.map(String).join(" | ").slice(0, 200));
            continue;
        }
        const bundle = (await Promise.all(built.outputs.map((o) => o.text()))).join("\\n");
        const hits = ["use-canvas-store", "CANVAS_STORE_KEY", "use-canvas-theme-store"].filter((m) => bundle.includes(m));
        if (hits.length) results.push(entry + "::HIT::" + hits.join(","));
    } catch (error) {
        // ★ 护栏诊断质量（控制线 e111a6ad 验证发现）：Bun.build 在**模块解析失败**时
        // **抛异常**（不是返回 success:false）—— 不捕获会让整个子进程崩溃，
        // 真正的原因（Could not resolve: ...）丢失，只剩 stderr 首部的代码帧。
        // 那会被误读为「护栏自身故障」⇒ 进而被跳过或删除（今日已见三次同类失效）。
        // ⇒ 归类为构建失败，保留文件名 + 原因。
        // AggregateError 的 message 只有 "Bundle failed"，真正原因在 errors[].message
        // （实测：Could not resolve: "@/this/does/not/exist"）。
        const aggregate = error as { errors?: Array<{ message?: string }>; message?: string };
        const detail = aggregate?.errors?.map((item) => String(item?.message ?? item)).join(" | ")
            || String(aggregate?.message ?? error);
        results.push(entry + "::BUILD_FAIL::" + detail.slice(0, 200));
    }
}
console.log(JSON.stringify(results));
`;
        const proc = Bun.spawnSync(["bun", "-e", script], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
        const raw = proc.stdout.toString().trim();
        let reported: string[];
        try {
            reported = JSON.parse(raw) as string[];
        } catch {
            throw new Error(`模块图子进程输出不可解析：${raw.slice(0, 300)} / stderr=${proc.stderr.toString().slice(0, 300)}`);
        }
        const offenders = reported.map((item) => item.replace("::BUILD_FAIL::", " 构建失败：").replace("::HIT::", " 模块图含 "));
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
