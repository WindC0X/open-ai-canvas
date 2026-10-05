import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createCanvasProjectLocal } from "../src/services/user-data-sync";
import { useCanvasStore } from "../src/stores/canvas/use-canvas-store";

/**
 * D-1/D-2 接线级测试：预建承载容器 + /tasks 画布入口。
 *
 * ★ V9 纪律：源码文本断言一律先 stripComments 再匹配，切片前断言锚点存在。
 * ★ V1 纪律：能走行为断言的走行为（createCanvasProjectLocal 真调 store），
 *   源码断言只用于「跨文件接线」这类没有行为钩子的地方。
 */

function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1))
        .replace(/^\s*\/\/.*$/gm, "");
}

const runnerSource = await Bun.file(new URL("../src/components/create/linear-flow-runner.tsx", import.meta.url)).text();
const pageSource = await Bun.file(new URL("../src/pages/create/index.tsx", import.meta.url)).text();
const tasksPageSource = await Bun.file(new URL("../src/pages/tasks/index.tsx", import.meta.url)).text();
const listRowSource = await Bun.file(new URL("../src/pages/tasks/task-list-row.tsx", import.meta.url)).text();
const gridCardSource = await Bun.file(new URL("../src/pages/tasks/task-grid-card.tsx", import.meta.url)).text();

describe("D-1：预建承载容器（createCanvasProjectLocal）", () => {
    // ★ 测试隔离：行为断言会真写全局 store —— 前后各复位一次，
    //   不给同进程后续测试文件留下 hydrated/projects 残留（P1-2 同族纪律）。
    let originalProjects: ReturnType<typeof useCanvasStore.getState>["projects"] = [];
    let originalHydrated = false;
    beforeEach(() => {
        const state = useCanvasStore.getState();
        originalProjects = state.projects;
        originalHydrated = state.hydrated;
        useCanvasStore.setState({ hydrated: true, projects: [] });
    });
    afterEach(() => {
        useCanvasStore.setState({ hydrated: originalHydrated, projects: originalProjects });
    });

    test("行为：本地创建返回 id + 写入 workspaceType（不阻塞云端往返）", () => {
        const id = createCanvasProjectLocal("白底主图", { workspaceType: "headless_task" });
        expect(id).toBeTruthy();
        const stored = useCanvasStore.getState().projects.find((project) => project.id === id);
        expect(stored?.title).toBe("白底主图");
        expect(stored?.workspaceType).toBe("headless_task");
    });

    test("行为：不传 initialContent 时不写 workspaceType（零迁移语义）", () => {
        const id = createCanvasProjectLocal("普通容器");
        const stored = useCanvasStore.getState().projects.find((project) => project.id === id);
        expect(stored?.workspaceType).toBeUndefined();
    });
});

describe("D-1：runner 预建 + 任务带 projectId", () => {
    test("runner 提交前调 onPrepareCanvas，且任务创建带 projectId", () => {
        const code = stripComments(runnerSource);
        // 锚点存在性前置断言（V9 ②）
        const prepareAnchor = code.indexOf("onPrepareCanvas({ title: card.title })");
        expect(prepareAnchor).toBeGreaterThan(-1);
        // 预建在任务创建之前
        const submitAnchor = code.indexOf("runBackendGenerationTask({");
        expect(submitAnchor).toBeGreaterThan(-1);
        expect(prepareAnchor).toBeLessThan(submitAnchor);
        // 任务带 projectId（条件展开：无 canvasId 时保持既有行为）
        expect(code).toContain("...(canvasId ? { projectId: canvasId } : {})");
    });

    test("runner 预建失败不阻塞生成（降级为不带 projectId）", () => {
        const code = stripComments(runnerSource);
        const catchAnchor = code.indexOf("预建承载容器失败");
        expect(catchAnchor).toBeGreaterThan(-1);
    });

    test("handoff 两分支都带 canvasId（容器复用）", () => {
        const code = stripComments(runnerSource);
        const carrierAnchor = code.indexOf('kind: "carrier"');
        const resultAnchor = code.indexOf('kind: "result"');
        expect(carrierAnchor).toBeGreaterThan(-1);
        expect(resultAnchor).toBeGreaterThan(-1);
        expect(code).toContain("canvasId: canvasIdRef.current || undefined");
        // 两个分支各一次
        expect(code.match(/canvasId: canvasIdRef\.current \|\| undefined/g)).toHaveLength(2);
    });

    test("接线：create 页实现 onPrepareCanvas（本地创建 + hydrated 守卫）", () => {
        const code = stripComments(pageSource);
        const anchor = code.indexOf("onPrepareCanvas=");
        expect(anchor).toBeGreaterThan(-1);
        expect(code).toContain("createCanvasProjectLocal(title");
        expect(code).toContain('workspaceType: "headless_task"');
        // hydrated 守卫：未水合时返回 undefined（降级，不抛错）
        expect(code).toContain("if (!useCanvasStore.getState().hydrated) return undefined;");
    });

    test("接线：两分支交接 source 带 canvasId（写进预建容器）", () => {
        const code = stripComments(pageSource);
        const matches = code.match(/\.\.\.\(handoff\.canvasId \? \{ canvasId: handoff\.canvasId \} : \{\}\)/g) ?? [];
        expect(matches).toHaveLength(2);
    });
});

describe("D-2：/tasks 画布入口", () => {
    test("接线：两段式判定（本地容器 → 详情确认）", () => {
        const code = stripComments(tasksPageSource);
        const anchor = code.indexOf("resolveTaskCanvasAction(");
        expect(anchor).toBeGreaterThan(-1);
        // ★ 确认必须【前置】于建容器：openTaskCanvas 内的 isLinearFlowTask 判据
        //   必须在 continueCreationConversationOnCanvas 之前（否则普通任务被建空容器）。
        //   注意不能只 toContain —— 详情 effect 里也有同名调用，注入删除本处判据仍会命中。
        const openFn = code.slice(code.indexOf("const openTaskCanvas = async"), code.indexOf("const runAction = async"));
        const confirmAnchor = openFn.indexOf("isLinearFlowTask(detail.inputJson)");
        const createAnchor = openFn.indexOf("continueCreationConversationOnCanvas(");
        expect(confirmAnchor).toBeGreaterThan(-1);
        expect(createAnchor).toBeGreaterThan(-1);
        expect(confirmAnchor).toBeLessThan(createAnchor);
        // 详情确认缓存（同 taskId 不重复查）
        expect(code).toContain("linearFlowCheckedRef.current.has(task.id)");
        expect(code).toContain("linearFlowDetailsRef.current.get(task.id)");
    });

    test("接线：创建路径复用同一 sessionKey + 同一 workspaceType（内容一致）", () => {
        const code = stripComments(tasksPageSource);
        const anchor = code.indexOf("const sessionKey = `linear-flow-${task.id}`");
        expect(anchor).toBeGreaterThan(-1);
        expect(code).toContain('}, { workspaceType: "headless_task" });');
        // 结果图物化走 attachments 通道（与卡流程交付分支一致）
        expect(code).toContain("uploadImage(resultUrl)");
    });

    test("接线：列表行/网格卡都渲染画布入口（aria-label 双态）", () => {
        for (const source of [listRowSource, gridCardSource]) {
            const code = stripComments(source);
            expect(code).toContain('canvasAction === "create" ? "创建画布并打开" : "在画布中打开"');
            expect(code).toContain("onOpenCanvas");
        }
    });

    test("接线：页面两处渲染都传 canvasAction", () => {
        const code = stripComments(tasksPageSource);
        expect(code.match(/canvasAction=\{taskCanvasAction\(task\)\}/g)).toHaveLength(2);
    });
});
