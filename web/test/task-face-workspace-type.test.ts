import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readFileSync } from "node:fs";
import { applyHeadlessTidyPositions, markHeadlessCanvasTidied, planHeadlessTidyBatches, shouldTidyHeadlessCanvas } from "@/lib/canvas/headless-tidy";
import { filterVisibleCanvasProjects, isHeadlessTaskWorkspace } from "@/lib/canvas/workspace-type";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

/**
 * W5 统一任务面 —— workspace_type 与 headless 自动整理（设计卡 §4.2/§4.5/验收 4/7/8）。
 *
 * ★ 验收 8 的核心断言是**反向**的：headless 自动整理**不触发任务重跑**。
 * 验证方式不是「跑一遍看任务有没有重跑」（那要真机且不稳定），而是
 * **结构断言**：整理只投影 position，产物里 metadata/status/生成参数逐字节不变。
 * 这匹配「验证形态必须匹配被验证对象」—— 被验对象是「整理不触碰任务态」这个结构约束。
 */

// bun 测试环境无 DOM：按 canvas-appearance.test.ts 的既有范式注入最小 window stub。
const storageValues = new Map<string, string>();
let originalWindow: PropertyDescriptor | undefined;

beforeEach(() => {
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    storageValues.clear();
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            localStorage: {
                getItem: (key: string) => storageValues.get(key) || null,
                setItem: (key: string, value: string) => storageValues.set(key, value),
                removeItem: (key: string) => storageValues.delete(key),
            },
        },
    });
});

afterEach(() => {
    // ★ 必须删干净：bun 环境本来没有 window，若只做「有则恢复」，
    // 注入的假 window 会永久残留 → 后续测试的 localforage 拿到假 window
    // 直接 "No available storage method found"（本批实测：全量 3001 pass / 2 fail）。
    // 参考 test/canvas-appearance.test.ts 的既有范式。
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
});

function node(id: string, x = 0, y = 0, metadata?: CanvasNodeData["metadata"]): CanvasNodeData {
    return { id, type: CanvasNodeType.Image, title: id, position: { x, y }, width: 320, height: 320, metadata };
}

const connections = [] as never;

describe("workspace_type 判定（验收 4）", () => {
    test("undefined 一律视为 standard（存量画布零迁移）", () => {
        expect(isHeadlessTaskWorkspace(undefined)).toBe(false);
        expect(isHeadlessTaskWorkspace(null)).toBe(false);
        expect(isHeadlessTaskWorkspace("standard")).toBe(false);
        expect(isHeadlessTaskWorkspace("headless_task")).toBe(true);
    });

    test("headless 容器不进主列表（验收 7 / 反模式 A3）", () => {
        const projects = [
            { id: "a", workspaceType: undefined },
            { id: "b", workspaceType: "standard" as const },
            { id: "c", workspaceType: "headless_task" as const },
        ];
        expect(filterVisibleCanvasProjects(projects).map((project) => project.id)).toEqual(["a", "b"]);
    });
});

describe("headless 首入自动整理（验收 8 / 反模式 A5）", () => {
    test("非 headless 画布不整理", () => {
        expect(shouldTidyHeadlessCanvas("canvas-1", undefined)).toBe(false);
        expect(shouldTidyHeadlessCanvas("canvas-1", "standard")).toBe(false);
    });

    test("headless 画布首入整理一次（标记后不再整理，不覆盖用户手工排布）", () => {
        expect(shouldTidyHeadlessCanvas("canvas-1", "headless_task")).toBe(true);
        markHeadlessCanvasTidied("canvas-1");
        expect(shouldTidyHeadlessCanvas("canvas-1", "headless_task")).toBe(false);
        // 不同画布互不影响
        expect(shouldTidyHeadlessCanvas("canvas-2", "headless_task")).toBe(true);
    });

    test("整理分批（流式），单节点/空画布不产生批次", () => {
        expect(planHeadlessTidyBatches([node("a")], connections)).toEqual([]);
        const batches = planHeadlessTidyBatches([node("a"), node("b"), node("c"), node("d"), node("e"), node("f"), node("g")], connections, 3);
        expect(batches.length).toBe(3);
        expect(batches[0]).toHaveLength(3);
        expect(batches.flat().sort()).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    });

    test("锁定节点与子节点不参与整理", () => {
        const locked = node("locked", 0, 0, { locked: true });
        const child = { ...node("child"), parentId: "parent" };
        const batches = planHeadlessTidyBatches([node("a"), node("b"), locked, child], connections, 10);
        expect(batches.flat().sort()).toEqual(["a", "b"]);
    });

    test("★ 整理只投影 position：metadata / 生成参数 / 任务态逐字节不变（不触发任务重跑）", () => {
        const generationMetadata = {
            size: "1360x1024",
            model: "nano-banana-2",
            generationTaskId: "task-1",
            prompt: "白底主图",
            status: "success" as const,
        };
        const nodes = [node("a", 10, 20, { ...generationMetadata }), node("b", 30, 40, { ...generationMetadata })];
        const positions = new Map([["a", { x: 999, y: 888 }], ["b", { x: 777, y: 666 }]]);

        const next = applyHeadlessTidyPositions(nodes, positions, ["a"]);

        // 坐标变了
        expect(next[0].position).toEqual({ x: 999, y: 888 });
        // 未在批次内的节点完全不变（同一引用）
        expect(next[1]).toBe(nodes[1]);
        // ★ 核心：metadata 逐字段不变（含任务 id / 生成参数 / 状态）
        expect(next[0].metadata).toEqual(generationMetadata);
        expect(next[0].metadata).toBe(nodes[0].metadata);
        // 除 position 外无其他字段变化
        const { position: _before, ...beforeRest } = nodes[0];
        const { position: _after, ...afterRest } = next[0];
        expect(afterRest).toEqual(beforeRest);
    });

    test("空批次/空坐标表返回原数组（同一引用，不产生无谓渲染）", () => {
        const nodes = [node("a")];
        expect(applyHeadlessTidyPositions(nodes, new Map(), ["a"])).toBe(nodes);
        expect(applyHeadlessTidyPositions(nodes, new Map([["a", { x: 1, y: 1 }]]), [])).toBe(nodes);
    });
});

/**
 * ★ 接线断言（「纯函数全绿 ≠ 接线可用」教训）。
 *
 * 上面测的是纯函数正确性；这里断言它们**真的被调用**——
 * 否则护栏和实现在，首入整理却永不触发（本仓已复发的失效模式）。
 */
describe("接线（纯函数之外）", () => {
    const lifecycleSource = readFileSync(new URL("../src/pages/canvas/use-canvas-project-lifecycle.ts", import.meta.url), "utf8");
    const canvasIndexSource = readFileSync(new URL("../src/pages/canvas/index.tsx", import.meta.url), "utf8");

    test("headless 首入整理接在画布 load 完成路径上", () => {
        expect(lifecycleSource).toContain("tidyHeadlessCanvasIfNeeded");
        expect(lifecycleSource).toContain("shouldTidyHeadlessCanvas");
        expect(lifecycleSource).toContain("applyHeadlessTidyPositions");
        // 必须在 load().then 里（首入时点），不是别处
        const loadIndex = lifecycleSource.indexOf("void load()");
        const tidyIndex = lifecycleSource.indexOf("void tidyHeadlessCanvasIfNeeded()");
        expect(tidyIndex).toBeGreaterThan(loadIndex);
    });

    test("画布库列表接入 headless 过滤（验收 7 接线）", () => {
        expect(canvasIndexSource).toContain("filterVisibleCanvasProjects");
    });

    test("★ 验收 2：UnifiedTaskFace 有真实挂载点（无画布上下文页面）", () => {
        // 设计卡验收 2「统一任务面独立可用（不依赖画布上下文）」——
        // 组件存在不等于挂载：必须断言真实使用点，否则「有代码≠能用」复发。
        const runnerSource = readFileSync(new URL("../src/components/create/linear-flow-runner.tsx", import.meta.url), "utf8");
        expect(runnerSource).toContain("<UnifiedTaskFace");
        expect(runnerSource).toContain("taskIds={[taskId]}");
        // /create 直线流程不是画布页 ⇒ 满足「无画布上下文」
        expect(runnerSource).toContain("onTaskUpdate: (task) => setTaskId(task.id)");
    });
});
