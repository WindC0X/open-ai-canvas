import { expect, test, describe } from "bun:test";

import {
    linearFlowStepGate,
    nextLinearFlowStep,
    resolveLinearFlowGate,
    visibleLinearFlowSteps,
} from "@/lib/canvas/linear-flow-gate";
import { LINEAR_FLOW_STEPS } from "@/lib/canvas/linear-flow-cards";

/**
 * W5 直线流程门控 —— 三态单测（设计卡 §3.2 + §6.2 验收 8/10）。
 *
 * ★ 方向性纪律回归（验收 10）：门控**只锁直线流程内**，常规画布不受影响。
 * 本模块零画布依赖 —— 不 import 任何画布 store，从模块面即保证「不影响常规画布」。
 */

describe("门控三态（设计卡 §3.2）", () => {
    test("起点：当前步 allowed、下一步 locked、更后 hidden", () => {
        const gate = resolveLinearFlowGate("clarify");
        expect(gate.allowed).toEqual(["pick", "upload", "clarify"]);
        expect(gate.locked).toEqual(["generate"]);
        expect(gate.hidden).toEqual(["deliver"]);
    });

    test("第一步：只有第一步 allowed，第二步 locked", () => {
        const gate = resolveLinearFlowGate("pick");
        expect(gate.allowed).toEqual(["pick"]);
        expect(gate.locked).toEqual(["upload"]);
        expect(gate.hidden).toEqual(["clarify", "generate", "deliver"]);
    });

    test("末步：全链 allowed（可回看），无 locked", () => {
        const gate = resolveLinearFlowGate("deliver");
        expect(gate.allowed).toEqual(["pick", "upload", "clarify", "generate", "deliver"]);
        expect(gate.locked).toEqual([]);
        expect(gate.hidden).toEqual([]);
    });

    test("已完成步骤即使跳步也 allowed（回看语义）", () => {
        const gate = resolveLinearFlowGate("generate", ["pick", "upload", "clarify"]);
        expect(gate.allowed).toContain("clarify");
        expect(gate.locked).toEqual(["deliver"]);
    });
});

describe("门控查询辅助", () => {
    test("linearFlowStepGate 返回单步态", () => {
        const gate = resolveLinearFlowGate("clarify");
        expect(linearFlowStepGate(gate, "pick")).toBe("allowed");
        expect(linearFlowStepGate(gate, "generate")).toBe("locked");
        expect(linearFlowStepGate(gate, "deliver")).toBe("hidden");
    });

    test("visibleLinearFlowSteps 只含 allowed + locked，顺序与步骤表一致", () => {
        const gate = resolveLinearFlowGate("clarify");
        const visible = visibleLinearFlowSteps(gate).map((step) => step.id);
        expect(visible).toEqual(["pick", "upload", "clarify", "generate"]);
        const order = LINEAR_FLOW_STEPS.map((step) => step.id);
        expect(visible).toEqual(order.filter((id) => visible.includes(id)));
    });

    test("nextLinearFlowStep 逐级推进，末步返回 undefined", () => {
        expect(nextLinearFlowStep("pick")).toBe("upload");
        expect(nextLinearFlowStep("upload")).toBe("clarify");
        expect(nextLinearFlowStep("clarify")).toBe("generate");
        expect(nextLinearFlowStep("generate")).toBe("deliver");
        expect(nextLinearFlowStep("deliver")).toBeUndefined();
    });
});

describe("★ 验收 10：门控不影响常规画布", () => {
    test("门控模块零画布依赖（不 import 画布 store）", async () => {
        const source = await Bun.file(new URL("../src/lib/canvas/linear-flow-gate.ts", import.meta.url)).text();
        expect(source).not.toContain("use-canvas-store");
        expect(source).not.toContain("canvas/use-canvas");
        // 也不得写任何全局门控状态（只做纯函数推导）
        expect(source).not.toContain("setState");
    });

    test("门控是纯函数：同输入同输出，无隐藏状态", () => {
        const first = resolveLinearFlowGate("clarify");
        const second = resolveLinearFlowGate("clarify");
        expect(first).toEqual(second);
    });

    test("三态互斥且完备：每个步骤恰好属于一态", () => {
        for (const step of LINEAR_FLOW_STEPS) {
            const gate = resolveLinearFlowGate(step.id);
            const membership = [gate.allowed, gate.locked, gate.hidden].filter((list) => list.includes(step.id));
            expect(membership).toHaveLength(1);
        }
    });
});
