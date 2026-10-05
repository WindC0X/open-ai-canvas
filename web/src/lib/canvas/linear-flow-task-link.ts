import type { CanvasProject } from "@/stores/canvas/use-canvas-store";
import type { GenerationTask } from "@/services/api/task-center";
import { isHeadlessTaskWorkspace } from "@/lib/canvas/workspace-type";

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
 * 在容器内找承载某任务的会话（用于导航时带 `conversation` 参数）。
 *
 * ★ 为什么按 taskId 而不是「容器有没有会话」：D-1 预建容器可能
 *   ① 完全无会话（用户没点过「在画布中打开」）；
 *   ② 有 carrier 会话（生成中点过，taskIds 已写）；
 *   ③ 有 result 会话（完成后点过）。
 *   只有 ① 需要降级（不带 conversation，避免画布页弹「未找到要接续的会话」）。
 *   用 `chatSessions.length === 0` 会在 ②/③ 误降级 —— 明明有该任务的交接记录
 *   却不带会话，用户进画布看不到它。
 *
 * ★ 多会话选择规则：取**最后一个**（会话按创建顺序追加，result 交接晚于 carrier
 *   且二者共用同一 sessionKey `linear-flow-<taskId>`，故同一容器通常只有一条；
 *   若历史数据里出现多条，后写入的更接近用户期望的落点）。
 *
 * ★ 调用面：只在路径 A（容器反查命中）使用 —— 路径 B 可达时全库必无承载该
 *   taskId 的会话（见 `resolveTaskCanvasAction` 内注释），故其 sessionId 恒为 undefined。
 */
export function findTaskSessionId(taskId: string, project: CanvasProject | undefined): string | undefined {
    if (!taskId || !project) return undefined;
    const sessions = project.chatSessions || [];
    for (let index = sessions.length - 1; index >= 0; index -= 1) {
        const session = sessions[index];
        if ((session.messages || []).some((message) => readTaskIds(message.detail).includes(taskId))) return session.id;
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
 *   `sessionId` 仅在容器内确有承载该任务的会话时给出 —— 调用方据此决定是否
 *   带 `?conversation=` 参数（无会话时带了会让画布页弹「未找到要接续的会话」警告）。
 * - `create`：无容器但已确认是卡流程任务（详情判据）⇒ 提供「创建并打开」。
 * - `none`：不提供入口（非卡流程 / 已绑定画布但容器不在本地）。
 */
export type TaskCanvasAction =
    | { kind: "navigate"; canvasId: string; sessionId?: string }
    | { kind: "create" }
    | { kind: "none" };

export function resolveTaskCanvasAction(
    task: Pick<GenerationTask, "id" | "projectId">,
    projects: readonly CanvasProject[],
    linearFlowTaskId?: string,
): TaskCanvasAction {
    const container = findLinearFlowContainer(task.id, projects);
    // 路径 A：本地按 taskIds 反查命中 —— 会话必然存在（能反查命中就说明会话里有 taskId）。
    if (container) return { kind: "navigate", canvasId: container.id, sessionId: findTaskSessionId(task.id, container) };
    // D-1 之后卡流程任务带 projectId（预建容器）—— 容器本地存在但可能尚无会话
    // （用户没点过「在画布中打开」）。按 id 命中本地 headless 容器同样直接跳转，
    // 否则 D-1 预建的容器反而不达（P1-1 的原意就是让容器可达）。
    // ★ 只认 headless 容器：普通画布任务（用户在画布页生成）本来就有画布入口，
    //   不在这里重复提供（否则 30 条历史任务几乎每条都长出一个按钮）。
    if (task.projectId) {
        const bound = projects.find((project) => project.id === task.projectId);
        if (bound && isHeadlessTaskWorkspace(bound.workspaceType)) {
            // ★ 走到这里说明路径 A 未命中 —— `findLinearFlowContainer` 已扫描全部
            //   容器的全部会话，故全库无任何会话承载此 taskId ⇒ 该容器必然无此任务的
            //   会话，导航不带 conversation（P2-1 场景①：D-1 预建容器用户从未点过）。
            //   （无需再查一遍：若该容器有承载此 taskId 的会话，路径 A 就已命中。）
            return { kind: "navigate", canvasId: task.projectId };
        }
    }
    // 已绑定画布但本地无该画布：容器可能在别的设备创建 —— 不提供新建（避免双容器）。
    if (task.projectId) return { kind: "none" };
    // 两段式第二步的结果由调用方传入（详情查询缓存命中后才传入 taskId）。
    return linearFlowTaskId === task.id ? { kind: "create" } : { kind: "none" };
}
