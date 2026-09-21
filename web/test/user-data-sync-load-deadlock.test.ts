import { expect, mock, spyOn, test } from "bun:test";

import { http } from "../src/services/api/request";
import * as actualCanvasStore from "../src/stores/canvas/use-canvas-store";
import type { CanvasProject } from "../src/stores/canvas/use-canvas-store";
import { CanvasNodeType } from "../src/types/canvas";

// 回归：临界区内的 waitForRemoteProjectLoads 只等【进入临界区前注册】的 load。
// 历史缺陷（review 2026-09-21 P1，已复现）：它读实时 map，把临界区内新注册、排在事务【之后】
// 的 load 也一起等 → 「事务等 load、load 等事务」双向死锁，尾随队列永久卡死（撤销事务 POST
// 期间任意一次打开画布 / 生成任务完成回写即中招，自动同步/保存/登出全部挂起且无提示）。
//
// 自带确定性 store 桩：本仓其他测试文件会 mock.module 掉画布 store（bun 的模块 mock 是进程级、
// 跨文件泄漏），真实 store 在同进程全量跑里会变成没有 setState 的桩，这里不依赖加载顺序。
let projects: CanvasProject[] = [];
void mock.module("../src/stores/canvas/use-canvas-store", () => ({
    // 保留其余导出（CANVAS_STORE_KEY 等），只替换 store 本体
    ...actualCanvasStore,
    useCanvasStore: {
        getState: () => ({ projects }),
        setState: (updater: unknown) => {
            const patch = typeof updater === "function"
                ? (updater as (state: { projects: CanvasProject[] }) => { projects?: CanvasProject[] })({ projects })
                : (updater as { projects?: CanvasProject[] });
            if (patch?.projects) projects = patch.projects;
        },
    },
}));

const {
    flushRemoteUserDataUnlocked,
    initializeRemoteUserDataSession,
    loadCanvasProjectForEditing,
    resetRemoteUserDataSync,
    withRemoteUserDataSyncExclusive,
} = await import("../src/services/user-data-sync");

const initial: CanvasProject = {
    id: "deadlock-probe",
    title: "探针",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    nodes: [],
    connections: [],
    chatSessions: [],
    activeChatId: null,
    viewport: { x: 0, y: 0, k: 1 },
};
const remote: CanvasProject = {
    ...initial,
    nodes: [{ id: "n1", type: CanvasNodeType.Text, title: "远端", position: { x: 0, y: 0 }, width: 10, height: 10, metadata: { content: "x" } }],
};

test("事务执行期间并发注册的 load 不再与临界区互相死等", async () => {
    projects = [initial];
    await initializeRemoteUserDataSession("deadlock-user");
    const spy = spyOn(http, "get").mockResolvedValue({ project: remote });
    let transactionFinished = false;
    let concurrentLoad: Promise<unknown> | null = null;
    const transaction = withRemoteUserDataSyncExclusive(async () => {
        // 第一次 flush：此时无 pending load
        await flushRemoteUserDataUnlocked();
        // 模拟事务窗口（如撤销 POST 数秒等待）内并发的 loadCanvasProjectForEditing：
        // 它排在事务之后，事务内的第二次 flush 不得等待它（等待即结构性死锁）。
        // 注意：事务内也不得 await 这个 load——它按设计必须等事务结束才能开始执行。
        concurrentLoad = loadCanvasProjectForEditing("deadlock-probe");
        await flushRemoteUserDataUnlocked();
        transactionFinished = true;
    });
    const outcome = await Promise.race([
        transaction.then(() => "resolved" as const),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 5000)),
    ]);
    // 队列未卡死：事务后的下一个临界区操作仍能执行
    let queueAlive = false;
    await Promise.race([
        withRemoteUserDataSyncExclusive(async () => {
            queueAlive = true;
        }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    // 事务结束后，被排在后面的 load 正常启动并完成
    const loaded = await Promise.race([
        concurrentLoad!.then(() => "loaded" as const),
        new Promise<"stuck">((resolve) => setTimeout(() => resolve("stuck"), 5000)),
    ]);
    spy.mockRestore();
    await resetRemoteUserDataSync();
    expect(outcome).toBe("resolved");
    expect(transactionFinished).toBe(true);
    expect(loaded).toBe("loaded");
    expect(queueAlive).toBe(true);
}, 20000);
