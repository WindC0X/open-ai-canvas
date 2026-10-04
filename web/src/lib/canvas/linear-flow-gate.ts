/**
 * 直线流程门控 —— `allowed` / `locked` / `hidden` 三态（W5 直线入口设计卡 §3.2）。
 *
 * ★ 方向性纪律（控制线 2026-10-04 确认，方向钉死）：
 * TapNow 模式是「默认引导态（小白看不到全部）→ 毕业才给画布」；
 * **影策方向相反** —— **画布全量在场**（默认完整），用户**主动**进入引导态（如点卡）后，
 * **门控只锁「直线流程内的装饰项」**，**不影响常规画布使用**。
 *
 * 两条硬依据：
 *   ① PRODUCT.md 反参照：「不把画布藏起来」
 *   ② 硬验收②：「画布在任一步可达」双条件
 *
 * ★ 因此本模块**只服务直线流程**：常规画布的任何节点/工具都不消费它。
 * 消费方只有 `linear-flow-runner`（卡流程内的步骤呈现）。
 */
import { LINEAR_FLOW_STEPS, type LinearFlowStep, type LinearFlowStepId } from "@/lib/canvas/linear-flow-cards";

/** 门控三态（方案 §5 梯度 1 原文）。 */
export type LinearFlowGate = "allowed" | "locked" | "hidden";

/**
 * 步骤门控表。
 *
 * ★ 为什么是「按当前步骤推导」而不是「静态表」：
 * 直线流程是**单线推进**的（点卡→传图→确认→出图→交付），任一时刻只有
 * 「已完成 / 当前 / 未到」三种状态，正好映射三态 —— 已过步骤 allowed（可回看）、
 * 当前步 allowed（可操作）、下一步 locked（可见但不可点，视觉提示「下一步解锁」）、
 * 更后的步骤 hidden（完全不呈现，避免认知负担）。
 */
export type LinearFlowNodeGate = {
    /** 固定步骤节点：可交互。 */
    allowed: LinearFlowStepId[];
    /** 存在但不可操作（视觉提示「下一步解锁」）。 */
    locked: LinearFlowStepId[];
    /** 完全不呈现（未到步骤）。 */
    hidden: LinearFlowStepId[];
};

/**
 * 按当前步骤推导门控表。
 *
 * @param currentStep 当前所在步骤
 * @param completedSteps 已完成的步骤（可回看）
 *
 * 规则：
 *   - 已完成步骤 + 当前步骤 → `allowed`
 *   - 下一步 → `locked`（可见，提示即将解锁）
 *   - 更后的步骤 → `hidden`
 */
export function resolveLinearFlowGate(currentStep: LinearFlowStepId, completedSteps: readonly LinearFlowStepId[] = []): LinearFlowNodeGate {
    const order = LINEAR_FLOW_STEPS.map((step) => step.id);
    const currentIndex = order.indexOf(currentStep);
    const completed = new Set(completedSteps);
    const gate: LinearFlowNodeGate = { allowed: [], locked: [], hidden: [] };
    order.forEach((stepId, index) => {
        if (completed.has(stepId) || index <= currentIndex) gate.allowed.push(stepId);
        else if (index === currentIndex + 1) gate.locked.push(stepId);
        else gate.hidden.push(stepId);
    });
    return gate;
}

/** 步骤在门控表中的状态（渲染层直接消费）。 */
export function linearFlowStepGate(gate: LinearFlowNodeGate, stepId: LinearFlowStepId): LinearFlowGate {
    if (gate.allowed.includes(stepId)) return "allowed";
    if (gate.locked.includes(stepId)) return "locked";
    return "hidden";
}

/** 可见步骤（allowed + locked，渲染顺序与 `LINEAR_FLOW_STEPS` 一致）。 */
export function visibleLinearFlowSteps(gate: LinearFlowNodeGate): LinearFlowStep[] {
    return LINEAR_FLOW_STEPS.filter((step) => linearFlowStepGate(gate, step.id) !== "hidden");
}

/** 下一步骤（无下一步返回 undefined）。 */
export function nextLinearFlowStep(currentStep: LinearFlowStepId): LinearFlowStepId | undefined {
    const order = LINEAR_FLOW_STEPS.map((step) => step.id);
    const index = order.indexOf(currentStep);
    return index >= 0 && index < order.length - 1 ? order[index + 1] : undefined;
}
