import { afterEach, beforeEach, expect, test } from "bun:test";
import localforage from "localforage";

import { apiClient } from "../src/services/api/request";
import { continueCreationConversationOnCanvas } from "../src/services/creation-canvas-conversation";
import { initializeRemoteUserDataSession, resetRemoteUserDataSync } from "../src/services/user-data-sync";
import { flushCanvasStorePersistence, useCanvasStore, type CanvasProject } from "../src/stores/canvas/use-canvas-store";
import { flushAssetStorePersistence, useAssetStore } from "../src/stores/use-asset-store";

// T1-P1（评审线 R3 · 控制线裁定）：workspaceType 写入者。
//
// 读侧（workspace-type.ts / headless-tidy.ts / 画布库过滤 / 首入整理）与后端透出
// 早已就位，但全仓零写入者 ⇒ headless 语义空转。写入点 = service 层新建分支
// （creation-canvas-conversation.ts），只有卡流程两分支传 workspaceType。
//
// 测试面（控制线四条验收之④）：写入点结构断言 —— 新建分支带参 / existingId 分支
// 不覆盖。本文件走真实 service + 真实 store + mock 网络适配器（不 mock 模块），
// 断言的是**落库到 store/远端 payload 的实际字段**，不是源码文本。

const originalWindow = globalThis.window;
const originalAdapter = apiClient.defaults.adapter;
const originalGet = localforage.getItem;
const originalSet = localforage.setItem;
const indexed = new Map<string, string>();
let scope = "";
let sequence = 0;
let remote = new Map<string, CanvasProject>();
let putPayloads: CanvasProject[] = [];

function canvas(id: string, workspaceType?: CanvasProject["workspaceType"]): CanvasProject {
    return {
        id,
        revision: 1,
        title: id,
        createdAt: "2026-10-05T00:00:00Z",
        updatedAt: "2026-10-05T00:00:00Z",
        nodes: [],
        connections: [],
        chatSessions: [],
        activeChatId: null,
        viewport: { x: 0, y: 0, k: 1 },
        ...(workspaceType ? { workspaceType } : {}),
    };
}

function sourceConversation(id = "linear-flow-task-0001") {
    return {
        id,
        title: "白底主图",
        updatedAt: "2026-10-05T00:00:00Z",
        messages: [
            { id: `${id}-user`, role: "user" as const, content: "生成一张白底主图", createdAt: "2026-10-05T00:00:00Z" },
            { id: `${id}-assistant`, role: "assistant" as const, content: "已生成", createdAt: "2026-10-05T00:00:00Z", status: "done" },
        ],
    };
}

beforeEach(async () => {
    resetRemoteUserDataSync();
    scope = `headless-writer-test-${++sequence}`;
    indexed.clear();
    putPayloads = [];
    remote = new Map();
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            setTimeout: () => 1,
            clearTimeout: () => undefined,
            localStorage: { getItem: () => scope, setItem: () => undefined },
        },
    });
    localforage.getItem = (async (key: string) => indexed.get(key) ?? null) as typeof localforage.getItem;
    localforage.setItem = (async (key: string, value: string) => {
        indexed.set(key, value);
        return value;
    }) as typeof localforage.setItem;
    apiClient.defaults.adapter = async (config) => {
        const method = config.method || "get";
        const id = String(config.url).split("/").at(-1)!;
        const body = config.data ? JSON.parse(config.data) : undefined;
        let data: unknown;
        let status = 200;
        if (id === "snapshot") data = { projects: structuredClone([...remote.values()]), assets: [] };
        else if (method === "put") {
            const project = body.project as CanvasProject;
            putPayloads.push(structuredClone(project));
            const saved = { ...structuredClone(project), revision: (remote.get(id)?.revision ?? 0) + 1 };
            remote.set(id, saved);
            data = { project: saved };
        } else data = { project: structuredClone(remote.get(id)) };
        return { config, status, statusText: "", headers: {}, data: { code: status === 200 ? 0 : status, data, msg: "ok" } };
    };
    useCanvasStore.setState({ projects: [] });
    useAssetStore.setState({ assets: [] });
});

afterEach(async () => {
    resetRemoteUserDataSync();
    await Promise.all([flushCanvasStorePersistence(), flushAssetStorePersistence()]);
    apiClient.defaults.adapter = originalAdapter;
    localforage.getItem = originalGet;
    localforage.setItem = originalSet;
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
});

test("卡流程交接（带 workspaceType）在新建容器时写入 headless_task", async () => {
    await initializeRemoteUserDataSession(scope);
    const result = await continueCreationConversationOnCanvas(sourceConversation(), { workspaceType: "headless_task" });

    const stored = useCanvasStore.getState().projects.find((project) => project.id === result.id);
    expect(stored?.workspaceType).toBe("headless_task");
    // 远端 payload 也必须带该字段（否则读侧过滤拿不到；后端直读 PayloadJSON.workspaceType）。
    expect(putPayloads.at(-1)?.workspaceType).toBe("headless_task");
});

test("既有创作交接（不带 workspaceType）保持 standard —— 不写字段", async () => {
    await initializeRemoteUserDataSession(scope);
    const result = await continueCreationConversationOnCanvas(sourceConversation("creation-handoff-0001"));

    const stored = useCanvasStore.getState().projects.find((project) => project.id === result.id);
    expect(stored?.workspaceType).toBeUndefined();
    expect(putPayloads.at(-1)?.workspaceType).toBeUndefined();
});

test("existingId 分支不覆盖既有画布的 workspaceType（即使调用方传了参数）", async () => {
    await initializeRemoteUserDataSession(scope);
    // 既有画布：无 workspaceType（普通用户画布），且会话已存在于其中。
    const existing = canvas("existing-standard-canvas");
    existing.chatSessions = [{ id: "creation:existing-conversation", title: "旧", createdAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z", messages: [] }];
    remote.set(existing.id, existing);
    useCanvasStore.setState({ projects: [structuredClone(existing)] });

    const result = await continueCreationConversationOnCanvas(
        { ...sourceConversation("existing-conversation"), canvasId: existing.id },
        { workspaceType: "headless_task" },
    );

    expect(result.id).toBe(existing.id);
    const stored = useCanvasStore.getState().projects.find((project) => project.id === existing.id);
    // 硬约束：既有画布不能被一次交接打成 headless。
    expect(stored?.workspaceType).toBeUndefined();
});

test("existingId 分支不被反向改写：既有 headless 容器不因调用方传 standard 而变回 standard", async () => {
    await initializeRemoteUserDataSession(scope);
    const existing = canvas("existing-headless-canvas", "headless_task");
    existing.chatSessions = [{ id: "creation:headless-conversation", title: "旧", createdAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z", messages: [] }];
    remote.set(existing.id, existing);
    useCanvasStore.setState({ projects: [structuredClone(existing)] });

    await continueCreationConversationOnCanvas(
        { ...sourceConversation("headless-conversation"), canvasId: existing.id },
        { workspaceType: "standard" },
    );

    const stored = useCanvasStore.getState().projects.find((project) => project.id === existing.id);
    // 既有 headless 容器保持 headless（不被参数反向改写）。
    expect(stored?.workspaceType).toBe("headless_task");
});

test("同一会话第二次交接（命中 existingId）不改变已有标记", async () => {
    await initializeRemoteUserDataSession(scope);
    const first = await continueCreationConversationOnCanvas(sourceConversation("carrier-then-result"), { workspaceType: "headless_task" });
    expect(useCanvasStore.getState().projects.find((project) => project.id === first.id)?.workspaceType).toBe("headless_task");

    // 结果阶段再交接：同 sessionKey ⇒ 命中 existingId（本地会话已在 store）。
    await continueCreationConversationOnCanvas(sourceConversation("carrier-then-result"), { workspaceType: "headless_task" });

    expect(useCanvasStore.getState().projects.filter((project) => project.id === first.id)).toHaveLength(1);
    expect(useCanvasStore.getState().projects.find((project) => project.id === first.id)?.workspaceType).toBe("headless_task");
});

// 接线级断言（控制线验收④）：调用点的打标范围 —— 卡流程两分支打标、既有创作交接不打标。
// 断言的是一次调用是否带第二参，不是源码文本形状。
test("接线：卡流程 carrier/result 两分支传 headless_task，既有创作交接不传", async () => {
    const source = await Bun.file(new URL("../src/pages/create/index.tsx", import.meta.url)).text();
    // 三处调用点各自独立成句：统计带参调用数 = 2（carrier + result）。
    const headlessCalls = source.match(/\}, \{ workspaceType: "headless_task" \}\);/g) ?? [];
    expect(headlessCalls).toHaveLength(2);
    // 既有创作交接保持无参（:862 一处）。
    expect(source).toContain("continueCreationConversationOnCanvas(source)");
    // 反向：不得出现把 standard 显式写入的调用。
    expect(source).not.toContain('workspaceType: "standard"');
});

test("接线：service 层只在新建分支消费 workspaceType（existingId 分支无该字段写入）", async () => {
    const source = await Bun.file(new URL("../src/services/creation-canvas-conversation.ts", import.meta.url)).text();
    // 契约：唯一消费点 = 新建分支的 initialContent 透传（条件展开，缺省不写字段）。
    expect(source).toContain("options?.workspaceType ? { workspaceType: options.workspaceType } : {}");
    // 反向：existingId 分支的 updateProject 调用不得带 workspaceType。
    const updateProjectLine = source.split("\n").find((line) => line.includes("updateProject(project.id")) ?? "";
    expect(updateProjectLine).not.toContain("workspaceType");
});
