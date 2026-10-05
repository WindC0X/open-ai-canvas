import { afterAll, expect, spyOn, test } from "bun:test";

import { http } from "../src/services/api/request";
import * as actualCanvasStore from "../src/stores/canvas/use-canvas-store";
import type { CanvasProject } from "../src/stores/canvas/use-canvas-store";
import { CanvasNodeType } from "../src/types/canvas";

// 回归：临界区内的 waitForRemoteProjectLoads 只等【进入临界区前注册】的 load。
// 历史缺陷（review 2026-09-21 P1，已复现）：它读实时 map，把临界区内新注册、排在事务【之后】
// 的 load 也一起等 → 「事务等 load、load 等事务」双向死锁，尾随队列永久卡死（撤销事务 POST
// 期间任意一次打开画布 / 生成任务完成回写即中招，自动同步/保存/登出全部挂起且无提示）。
//
// 自带确定性 store 桩：**spyOn 临时替换**（不用 mock.module）。
// ★ 为什么改：bun 的 mock.module 是进程级且无恢复手段（实测 mock.restore() 不还原已加载
//   模块），桩会泄漏给后续测试文件 —— 全量跑中 headless-workspace-writer（5 红）与
//   canvas-asset-repair（7 红）都因此受害。spyOn 只替换同一 store 对象的方法，afterAll
//   恢复后所有持有该对象引用的模块自动回到真实实现。
// ★ 桩只接管 projects：其余 setState 字段透传真实 store。只处理 projects 的桩会吞掉
//   persist rehydrate 回调写入的 hydrated，使同进程后续测试的「画布资料正在加载」守卫
//   误报（配对跑实测 5 红；全量跑是否触发取决于文件加载顺序，不可依赖）。
let projects: CanvasProject[] = [];
const realGetState = actualCanvasStore.useCanvasStore.getState;
const realSetState = actualCanvasStore.useCanvasStore.setState;
const getStateSpy = spyOn(actualCanvasStore.useCanvasStore, "getState").mockImplementation(() => ({ ...realGetState(), projects }));
const setStateSpy = spyOn(actualCanvasStore.useCanvasStore, "setState").mockImplementation((updater: unknown) => {
    const patch = (typeof updater === "function"
        ? (updater as (state: { projects: CanvasProject[] }) => { projects?: CanvasProject[] })({ ...realGetState(), projects })
        : (updater as { projects?: CanvasProject[] })) ?? {};
    if (patch.projects) projects = patch.projects;
    // 桩只接管 projects：其余字段透传真实 store，不得吞掉 rehydrate 写入的其它状态。
    const { projects: _intercepted, ...rest } = patch as Record<string, unknown>;
    if (Object.keys(rest).length) realSetState(rest as never);
});
afterAll(() => {
    getStateSpy.mockRestore();
    setStateSpy.mockRestore();
});

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

// 回归：去重命中时第二个调用者的 onLoad 必须被调用。
// 历史缺陷（batch 10 S2/S5/S6 六红同根因，2026-09-23 dev-only）：第二个调用者拿到的是第一笔 load 的
// promise，而 onLoad 只在创建时绑定 → 第二次挂载（StrictMode 双挂载）的 onLoad 永不触发，其渲染门
// （setProjectLoaded）永不打开 ⇒ 编辑器永久停在 CanvasRefreshShell 骨架屏。
test("去重命中时第二个调用者的 onLoad 仍被调用", async () => {
    projects = [initial];
    await initializeRemoteUserDataSession("dedup-onload-user");
    const spy = spyOn(http, "get").mockResolvedValue({ project: remote });
    const called: string[] = [];
    const loadedIds: string[] = [];
    const first = loadCanvasProjectForEditing("deadlock-probe", {
        onLoad: (project) => {
            called.push("first");
            loadedIds.push(project.id);
        },
    });
    const second = loadCanvasProjectForEditing("deadlock-probe", {
        onLoad: (project) => {
            called.push("second");
            loadedIds.push(project.id);
        },
    });
    const [firstProject, secondProject] = await Promise.all([first, second]);
    spy.mockRestore();
    await resetRemoteUserDataSync();
    expect(called).toEqual(["first", "second"]);
    expect(loadedIds).toEqual(["deadlock-probe", "deadlock-probe"]);
    expect(firstProject?.id).toBe("deadlock-probe");
    expect(secondProject?.id).toBe("deadlock-probe");
});

// ★ P1-2 治本的可证伪锚点：桩只接管 projects，其余 setState 字段必须透传真实 store。
// 缺陷形态（只处理 projects 的桩）会吞掉 rehydrate 的 hydrated —— 该缺陷在全量跑中
// 因文件加载顺序可能不显形，故此契约在本地显式钉住（注入「去掉透传」→ 本测试必红）。
test("桩只接管 projects：其余 setState 字段透传真实 store（防 hydrated 被吞）", () => {
    actualCanvasStore.useCanvasStore.setState({ hydrated: true });
    expect(actualCanvasStore.useCanvasStore.getState().hydrated).toBe(true);
});
