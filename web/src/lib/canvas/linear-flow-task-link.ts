import type { CanvasProject } from "@/stores/canvas/use-canvas-store";
import type { GenerationTask } from "@/services/api/task-center";

/**
 * D-2：/tasks → 卡流程容器的反查（纯函数，零请求）。
 *
 * ★ 为什么按 `taskIds` 而不是 session id 字符串匹配：
 *   service 内部给会话 id 加前缀（`creation:${source.id}`），消息 id 更是双重前缀
 *   （`creation:<sessionKey>:<messageId>`）—— 按字符串拼接约定匹配会在任一侧改前缀时
 *   静默失配。`taskIds` 是交接时显式写入的结构数据，不受 id 命名约定影响。
 *
 * ★ `detail` 是 `unknown`（`types/canvas.ts`）：必须类型守卫后再读，不得直接 `.taskIds`。
 */

type HandoffDetail = { taskIds?: unknown };

function readTaskIds(detail: unknown): string[] {
    if (!detail || typeof detail !== "object") return [];
    const { taskIds } = detail as HandoffDetail;
    return Array.isArray(taskIds) ? taskIds.filter((id): id is string => typeof id === "string") : [];
}

/** 在本地画布中反查承载某任务的容器（生成中先开画布 / 完成后交接都会写 taskIds）。 */
export function findLinearFlowContainer(taskId: string, projects: readonly CanvasProject[]): CanvasProject | undefined {
    if (!taskId) return undefined;
    for (const project of projects) {
        for (const session of project.chatSessions || []) {
            for (const message of session.messages || []) {
                if (readTaskIds(message.detail).includes(taskId)) return project;
            }
        }
    }
    return undefined;
}

/**
 * 任务详情的 `inputJson.metadata.source === "linear-flow"` 判据（两段式第二步）。
 *
 * `inputJson` 是字符串（后端原样透出），解析失败或结构不符一律返回 false ——
 * 宁可少认（降级为不提供入口）也不误认（把普通任务当卡流程去建容器）。
 */
export function isLinearFlowTask(inputJson: string | undefined): boolean {
    if (!inputJson) return false;
    try {
        const parsed: unknown = JSON.parse(inputJson);
        if (!parsed || typeof parsed !== "object") return false;
        const metadata = (parsed as { metadata?: unknown }).metadata;
        if (!metadata || typeof metadata !== "object") return false;
        return (metadata as { source?: unknown }).source === "linear-flow";
    } catch {
        return false;
    }
}

/** 从任务详情的 inputJson 反解卡流程交接所需的上下文（类型守卫严格，失败返回 undefined）。 */
export type LinearFlowTaskContext = {
    cardId: string;
    answers: Record<string, string>;
};

export function readLinearFlowTaskContext(inputJson: string | undefined): LinearFlowTaskContext | undefined {
    if (!inputJson) return undefined;
    let parsed: unknown;
    try {
        parsed = JSON.parse(inputJson);
    } catch {
        return undefined;
    }
    if (!parsed || typeof parsed !== "object") return undefined;
    const metadata = (parsed as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") return undefined;
    const record = metadata as { source?: unknown; linearFlowCardId?: unknown; linearFlowAnswers?: unknown };
    if (record.source !== "linear-flow" || typeof record.linearFlowCardId !== "string" || !record.linearFlowCardId) return undefined;
    const answers: Record<string, string> = {};
    if (record.linearFlowAnswers && typeof record.linearFlowAnswers === "object") {
        for (const [key, value] of Object.entries(record.linearFlowAnswers as Record<string, unknown>)) {
            if (typeof value === "string") answers[key] = value;
        }
    }
    return { cardId: record.linearFlowCardId, answers };
}

/**
 * 任务行的画布动作判定（两段式）。
 *
 * - `navigate`：本地已有承载容器（零请求）⇒ 纯跳转。
 * - `create`：无容器但已确认是卡流程任务（详情判据）⇒ 提供「创建并打开」。
 * - `none`：不提供入口（非卡流程 / 已绑定画布但容器不在本地）。
 */
export type TaskCanvasAction =
    | { kind: "navigate"; canvasId: string }
    | { kind: "create" }
    | { kind: "none" };

export function resolveTaskCanvasAction(
    task: Pick<GenerationTask, "id" | "projectId">,
    projects: readonly CanvasProject[],
    linearFlowTaskId?: string,
): TaskCanvasAction {
    const container = findLinearFlowContainer(task.id, projects);
    if (container) return { kind: "navigate", canvasId: container.id };
    // 已绑定画布但本地无容器：容器可能在别的设备创建 —— 不提供新建（避免双容器）。
    if (task.projectId) return { kind: "none" };
    // 两段式第二步的结果由调用方传入（详情查询缓存命中后才传入 taskId）。
    return linearFlowTaskId === task.id ? { kind: "create" } : { kind: "none" };
}
