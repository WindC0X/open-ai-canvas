import { expect, test, describe } from "bun:test";

import type { CanvasAssistantMessage, CanvasAssistantSession } from "../src/types/canvas";
import type { CanvasProject } from "../src/stores/canvas/use-canvas-store";
import { findLinearFlowContainer, isLinearFlowTask, readLinearFlowTaskContext, resolveTaskCanvasAction } from "../src/lib/canvas/linear-flow-task-link";

/**
 * D-2：/tasks → 卡流程容器的反查（两段式判据）。
 *
 * ★ 为什么按 taskIds 匹配（而非 session id 字符串）：service 内部给会话 id 加
 *   `creation:` 前缀、消息 id 双重前缀 —— 按字符串拼接约定匹配会在任一侧改前缀时静默失配。
 *   taskIds 是交接时显式写入的结构数据（本文件用真实形态的 detail 对象钉住）。
 */

function message(id: string, taskIds?: string[]): CanvasAssistantMessage {
    return {
        id,
        role: "assistant",
        text: "卡流程正在生成中",
        detail: taskIds ? { kind: "creation-handoff", taskIds } : { kind: "creation-handoff" },
    };
}

function session(id: string, messages: CanvasAssistantMessage[]): CanvasAssistantSession {
    return { id, title: "白底主图", messages, createdAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z" };
}

function project(id: string, sessions: CanvasAssistantSession[], workspaceType?: CanvasProject["workspaceType"]): CanvasProject {
    return {
        id,
        title: "白底主图",
        createdAt: "2026-10-05T00:00:00Z",
        updatedAt: "2026-10-05T00:00:00Z",
        nodes: [],
        connections: [],
        chatSessions: sessions,
        activeChatId: sessions[0]?.id ?? null,
        viewport: { x: 0, y: 0, k: 1 },
        ...(workspaceType ? { workspaceType } : {}),
    } as CanvasProject;
}

describe("findLinearFlowContainer：按 taskIds 反查容器", () => {
    test("命中：会话消息 detail.taskIds 含该任务", () => {
        const projects = [project("canvas-1", [session("creation:linear-flow-task-a", [message("m1", ["task-a"])])])];
        expect(findLinearFlowContainer("task-a", projects)?.id).toBe("canvas-1");
    });

    test("多会话多消息：命中第二条消息的 taskIds", () => {
        const projects = [
            project("canvas-x", [session("creation:other", [message("m0", ["task-other"])])]),
            project("canvas-y", [session("creation:linear-flow-task-b", [message("m1"), message("m2", ["task-b", "task-c"])])]),
        ];
        expect(findLinearFlowContainer("task-c", projects)?.id).toBe("canvas-y");
    });

    test("未命中：detail 无 taskIds / 空 taskIds / 空 taskId 入参", () => {
        const projects = [project("canvas-1", [session("s1", [message("m1"), message("m2", [])])])];
        expect(findLinearFlowContainer("task-a", projects)).toBeUndefined();
        expect(findLinearFlowContainer("", projects)).toBeUndefined();
    });

    test("类型守卫：detail 为 null/字符串/数字时不抛错（unknown 安全读）", () => {
        const weird = [
            { ...message("m1"), detail: null },
            { ...message("m2"), detail: "not-an-object" },
            { ...message("m3"), detail: 42 },
            { ...message("m4"), detail: { taskIds: "not-an-array" } },
            { ...message("m5"), detail: { taskIds: [1, 2, null] } },
        ] as CanvasAssistantMessage[];
        const projects = [project("canvas-1", [session("s1", weird)])];
        expect(findLinearFlowContainer("task-a", projects)).toBeUndefined();
    });
});

describe("isLinearFlowTask：inputJson.metadata.source 判据", () => {
    test("真值：卡流程任务的 inputJson", () => {
        const inputJson = JSON.stringify({
            metadata: { source: "linear-flow", linearFlowCardId: "white-background-main", linearFlowAnswers: { product: "马克杯" } },
            mode: "image",
        });
        expect(isLinearFlowTask(inputJson)).toBe(true);
    });

    test("反例：普通任务 / source 值不同 / 结构缺失", () => {
        expect(isLinearFlowTask(JSON.stringify({ metadata: { source: "canvas" } }))).toBe(false);
        expect(isLinearFlowTask(JSON.stringify({ metadata: {} }))).toBe(false);
        expect(isLinearFlowTask(JSON.stringify({ mode: "image" }))).toBe(false);
        expect(isLinearFlowTask(undefined)).toBe(false);
        expect(isLinearFlowTask("")).toBe(false);
    });

    test("解析失败/非对象不抛错（宁可少认，不误认）", () => {
        expect(isLinearFlowTask("{not json")).toBe(false);
        expect(isLinearFlowTask("null")).toBe(false);
        expect(isLinearFlowTask('"string"')).toBe(false);
        expect(isLinearFlowTask("[]")).toBe(false);
    });
});

describe("readLinearFlowTaskContext：反解 answers + cardId（严格守卫）", () => {
    test("真值：完整元数据", () => {
        const inputJson = JSON.stringify({
            metadata: { source: "linear-flow", linearFlowCardId: "white-background-main", linearFlowAnswers: { product: "马克杯", angle: "正面" } },
        });
        expect(readLinearFlowTaskContext(inputJson)).toEqual({
            cardId: "white-background-main",
            answers: { product: "马克杯", angle: "正面" },
        });
    });

    test("缺失/类型不符一律 undefined（降级最小容器）", () => {
        expect(readLinearFlowTaskContext(undefined)).toBeUndefined();
        expect(readLinearFlowTaskContext("{}")).toBeUndefined();
        expect(readLinearFlowTaskContext(JSON.stringify({ metadata: { source: "linear-flow" } }))).toBeUndefined();
        expect(readLinearFlowTaskContext(JSON.stringify({ metadata: { source: "linear-flow", linearFlowCardId: "" } }))).toBeUndefined();
        expect(readLinearFlowTaskContext(JSON.stringify({ metadata: { source: "linear-flow", linearFlowCardId: 42 } }))).toBeUndefined();
    });

    test("answers 非字符串值被过滤（不污染容器内容）", () => {
        const inputJson = JSON.stringify({
            metadata: { source: "linear-flow", linearFlowCardId: "c1", linearFlowAnswers: { ok: "yes", bad: 42, nested: { x: 1 }, none: null } },
        });
        expect(readLinearFlowTaskContext(inputJson)?.answers).toEqual({ ok: "yes" });
    });

    test("answers 缺失时返回空对象（cardId 仍在 ⇒ 仍可重建）", () => {
        const inputJson = JSON.stringify({ metadata: { source: "linear-flow", linearFlowCardId: "c1" } });
        expect(readLinearFlowTaskContext(inputJson)).toEqual({ cardId: "c1", answers: {} });
    });
});

describe("resolveTaskCanvasAction：两段式判定", () => {
    const withContainer = [project("canvas-1", [session("creation:linear-flow-task-a", [message("m1", ["task-a"])])])];

    test("本地命中 ⇒ navigate（零请求）", () => {
        expect(resolveTaskCanvasAction({ id: "task-a", projectId: "canvas-1" }, withContainer)).toEqual({ kind: "navigate", canvasId: "canvas-1" });
    });

    test("未命中 + 已确认卡流程（详情判据）⇒ create", () => {
        expect(resolveTaskCanvasAction({ id: "task-b" }, [], "task-b")).toEqual({ kind: "create" });
    });

    test("未命中 + 未确认 ⇒ none（不提供入口）", () => {
        expect(resolveTaskCanvasAction({ id: "task-b" }, [])).toEqual({ kind: "none" });
        expect(resolveTaskCanvasAction({ id: "task-b" }, [], "task-other")).toEqual({ kind: "none" });
    });

    test("已绑定画布但本地无容器 ⇒ none（容器可能在别的设备创建，不新建防双容器）", () => {
        expect(resolveTaskCanvasAction({ id: "task-b", projectId: "canvas-remote" }, [], "task-b")).toEqual({ kind: "none" });
    });
});
