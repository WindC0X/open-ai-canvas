import { describe, expect, test } from "bun:test";

/**
 * R5 修复批：P1 跨卡片状态残留 + P2-1 D-2 路径 B 会话缺失。
 *
 * ★ V9 纪律：源码文本断言一律先 stripComments 再匹配；切片前断言锚点存在；
 *   失败信息必须可诊断（说明「移除什么会红、为什么」）。
 * ★ 为什么 P1 只能做接线守卫：`LinearFlowRunner` 渲染依赖 antd Modal + `App.useApp()`
 *   上下文，本仓测试环境无 DOM（无 happy-dom/jsdom），静态渲染需 mock 整个 antd 应用
 *   上下文 ⇒ 证明力低于源码断言（与 `linear-flow-runner.test.ts` 既有范式一致）。
 *   行为面由真机验证补足。
 */

function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (match) => "\n".repeat(match.split("\n").length - 1))
        .replace(/^\s*\/\/.*$/gm, "");
}

const pageSource = await Bun.file(new URL("../src/pages/create/index.tsx", import.meta.url)).text();
const tasksPageSource = await Bun.file(new URL("../src/pages/tasks/index.tsx", import.meta.url)).text();

describe("P1：卡片切换必须重置 runner 实例（跨卡片状态残留）", () => {
    test("接线：LinearFlowRunner 挂载带 key={linearFlowCard?.id ?? \"none\"}", () => {
        const code = stripComments(pageSource);
        const mountAnchor = code.indexOf("<LinearFlowRunner");
        expect(mountAnchor, "找不到 <LinearFlowRunner 挂载点 —— 锚点消失，断言失效").toBeGreaterThan(-1);
        // 切片到该元素的属性区（下一个 /> 之前），避免匹配到文件其他位置的 key。
        const mountEnd = code.indexOf("/>", mountAnchor);
        expect(mountEnd, "挂载点后找不到属性区结束标记 —— 锚点消失").toBeGreaterThan(mountAnchor);
        const mount = code.slice(mountAnchor, mountEnd);
        // ★ 移除 key 会红：卡片 A 完成 → 关闭 → 点卡片 B 时组件实例复用，
        //   stage 残留 "done" 直接显示 A 的结果图，canvasIdRef 残留使预建被跳过
        //   ⇒ B 的任务带 A 的容器 id（静默错配，无 UI 可恢复）。
        expect(mount, "挂载点缺少 key={linearFlowCard?.id ?? \"none\"} —— 跨卡片状态残留会回归").toContain('key={linearFlowCard?.id ?? "none"}');
    });

    test("接线：key 引用卡片 id（非硬编码）且带 ?? \"none\" 回退", () => {
        const code = stripComments(pageSource);
        const mountAnchor = code.indexOf("<LinearFlowRunner");
        expect(mountAnchor, "找不到 <LinearFlowRunner 挂载点 —— 锚点消失，断言失效").toBeGreaterThan(-1);
        const mount = code.slice(mountAnchor, code.indexOf("/>", mountAnchor));
        // 引用 card id ⇒ 切换卡片时 key 变化 ⇒ React 重建实例（重置全部 state + ref）。
        expect(mount, "key 必须引用 linearFlowCard?.id —— 硬编码 key 不会随卡片变化").toContain("linearFlowCard?.id");
        // 回退 ⇒ card 为 null 时 key 稳定（null 期间 React 不警告 key 缺失）。
        expect(mount, "key 缺少 ?? \"none\" 回退 —— card 为 null 时 key 不稳定").toContain('?? "none"');
    });

    test("反例锚点：组件确实无 useEffect 重置（说明 key 是唯一重置路径）", async () => {
        const runnerSource = await Bun.file(new URL("../src/components/create/linear-flow-runner.tsx", import.meta.url)).text();
        const code = stripComments(runnerSource);
        // 若未来有人加了 useEffect 重置，本断言会红 —— 提示「key 之外出现了第二条重置路径」，
        // 需要同步复核两套重置是否语义一致（避免双重重置或时序竞争）。
        expect(code, "runner 新增了 useEffect —— key 不再是唯一重置路径，需复核两套重置的语义").not.toContain("useEffect(");
        // 提前返回（实例保留）是残留的前提 —— 若改为条件挂载，key 的必要性也需复核。
        expect(code, "`if (!card) return null` 消失 —— 实例保留前提变了，需复核 key 必要性").toContain("if (!card) return null");
    });
});

describe("P2-1：D-2 路径 B 会话缺失（不带 conversation 参数）", () => {
    test("接线：navigate 按 action.sessionId 决定是否带 conversation", () => {
        const code = stripComments(tasksPageSource);
        const openFn = code.slice(code.indexOf("const openTaskCanvas = async"), code.indexOf("const runAction = async"));
        expect(openFn, "找不到 openTaskCanvas 函数体 —— 锚点消失，断言失效").not.toBe("");
        const navigateAnchor = openFn.indexOf("navigate(`/canvas/${action.canvasId}");
        expect(navigateAnchor, "openTaskCanvas 内找不到 navigate 调用 —— 锚点消失").toBeGreaterThan(-1);
        // ★ 移除条件判断（恢复无条件 conversation=creation:linear-flow-${task.id}）会红：
        //   D-1 预建容器无会话时，画布页 project.tsx 会弹「未找到要接续的会话」且不打开智能体面板。
        expect(openFn, "navigate 必须按 action.sessionId 条件拼接 query —— 无条件带 conversation 会让无会话容器弹警告").toContain("action.sessionId ?");
        // 不得再硬编码会话 id（旧实现 `creation:linear-flow-${task.id}` 拼接约定已废弃）。
        expect(openFn, "navigate 不得再硬编码 creation:linear-flow-${task.id} —— 会话 id 应由纯函数按 taskIds 精确给出").not.toContain("`creation:linear-flow-${task.id}`");
    });

    test("行为：无会话 ⇒ sessionId undefined（页面不带 conversation）", async () => {
        const { resolveTaskCanvasAction } = await import("../src/lib/canvas/linear-flow-task-link");
        const action = resolveTaskCanvasAction({ id: "task-x", projectId: "empty-container" }, [
            { id: "empty-container", workspaceType: "headless_task", chatSessions: [], nodes: [], connections: [] } as never,
        ]);
        expect(action.kind).toBe("navigate");
        expect(action.kind === "navigate" ? action.sessionId : "unexpected").toBeUndefined();
    });

    test("行为：有会话 ⇒ sessionId 为容器内承载该任务的会话 id", async () => {
        const { resolveTaskCanvasAction } = await import("../src/lib/canvas/linear-flow-task-link");
        const action = resolveTaskCanvasAction({ id: "task-y", projectId: "carrier-container" }, [
            {
                id: "carrier-container",
                workspaceType: "headless_task",
                chatSessions: [
                    { id: "creation:linear-flow-task-y", title: "白底主图", messages: [{ id: "m1", role: "assistant", text: "生成中", detail: { taskIds: ["task-y"] } }] },
                ],
                nodes: [],
                connections: [],
            } as never,
        ]);
        expect(action.kind).toBe("navigate");
        expect(action.kind === "navigate" ? action.sessionId : undefined).toBe("creation:linear-flow-task-y");
    });
});
