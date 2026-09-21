import type { CanvasProject } from "@/stores/canvas/use-canvas-store";
import type { CanvasConnection, CanvasNodeData } from "@/types/canvas";

type Change<T> = { before: T | null; after: T | null };
export type AgentCanvasPatch = {
    canvasId: string;
    updatedAt: string;
    nodes: Change<CanvasNodeData>[];
    connections: Change<CanvasConnection>[];
};
// (Change.after 可为 null: 仅撤销采纳路径产生删除语义; 见 mergeItems。)

function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equal(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (record(a) && record(b)) {
        const keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every((key) => equal(a[key], b[key]));
    }
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => equal(item, b[index]));
}

// Three-way merge: untouched local fields (e.g. a drag or prompt edit) survive.
// A concurrently changed field or a deleted node is a conflict, never an overwrite.
function mergeValue(current: unknown, before: unknown, after: unknown): unknown {
    if (equal(before, after) || equal(current, after)) return current;
    if (equal(current, before)) return after;
    if (record(current) && record(before) && record(after)) {
        const next = { ...current };
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("无效的画布增量字段");
            const value = mergeValue(current[key], before[key], after[key]);
            if (value === undefined) delete next[key];
            else next[key] = value;
        }
        return next;
    }
    throw new Error("Agent 画布增量与本地内容冲突，需要校准；已保留本地编辑");
}

function mergeItems<T extends { id: string }>(items: T[], changes: Change<T>[]): T[] {
    if (!changes.length) return items;
    const next = new Map(items.map((item) => [item.id, item]));
    for (const { before, after } of changes) {
        // after=null 是删除语义。唯一合法来源是撤销采纳(云端回滚); canvas_apply_ops 禁止删除,
        // 实时 canvas_updated 增量永不产生 after=null, 因此不会误伤 Agent 运行中的增量。
        if (after === null) {
            if (!before?.id) throw new Error("无效的画布增量节点");
            next.delete(before.id);
            continue;
        }
        if (!after?.id || (before && before.id !== after.id)) throw new Error("无效的画布增量节点");
        next.set(after.id, mergeValue(next.get(after.id) ?? null, before, after) as T);
    }
    const result = [...next.values()];
    return result.length === items.length && result.every((item, index) => item === items[index]) ? items : result;
}

export function applyAgentCanvasPatch(project: CanvasProject, patch: AgentCanvasPatch): CanvasProject {
    if (patch.canvasId !== project.id || !Array.isArray(patch.nodes) || !Array.isArray(patch.connections)) throw new Error("画布增量不属于当前画布或格式无效");
    const byId = new Map(project.nodes.map((node) => [node.id, node]));
    const nodeChanges = patch.nodes.map((change) => {
        // 删除语义(after=null)不经任务守卫: 撤销回滚必须能移除生成节点绑定的任务结果。
        if (change.after === null) return change;
        const current = byId.get(change.after.id);
        const beforeTask = change.before?.metadata?.taskId;
        const afterTask = change.after.metadata?.taskId;
        if (beforeTask && current?.metadata?.taskId !== beforeTask && current?.metadata?.taskId !== afterTask) throw new Error("画布增量冲突：生成节点已删除或绑定另一任务，不能覆盖");
        if (!current || !beforeTask || beforeTask !== afterTask) return change;
        const terminal = (status: string | undefined) => ["succeeded", "failed", "cancelled"].includes(status || "");
        // A local task subscriber may already know a newer state than the SSE
        // checkpoint. Never turn its terminal result back into a pending task.
        if (terminal(current.metadata?.taskStatus) && !terminal(change.after.metadata?.taskStatus)) return { before: current, after: current };
        if (terminal(current.metadata?.taskStatus)) return change;
        const metadata = { ...change.before!.metadata };
        for (const key of ["status", "taskStatus", "taskProgress", "taskStage"] as const) {
            if (!equal(metadata[key], change.after.metadata?.[key])) Object.assign(metadata, { [key]: current.metadata?.[key] });
        }
        return { ...change, before: { ...change.before!, metadata } };
    });
    const nodes = mergeItems(project.nodes, nodeChanges);
    const connections = mergeItems(project.connections, patch.connections);
    if (nodes === project.nodes && connections === project.connections) return project;
    return { ...project, nodes, connections, updatedAt: patch.updatedAt || project.updatedAt };
}

export function mergeAgentCanvasEditor(previous: CanvasProject, incoming: CanvasProject, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    // basis = patch 实际应用的活体状态（编辑器），before = store 基线。删除必须按 basis 判定
    // （review 2026-09-21 P3）：二者短暂不一致时按 store 基线算会漏删（baseline 已无、编辑器仍有）。
    const changes = <T extends { id: string }>(before: T[], after: T[], basis: T[]): Change<T>[] => {
        const byId = new Map(before.map((item) => [item.id, item]));
        const afterIds = new Set(after.map((item) => item.id));
        // 撤销会删除节点(2026-09-19 用户实测: 删除被当作冲突抛出, 撤销后画布纹丝不动)。
        // here 的删除只可能来自撤销采纳(云端权威回滚), 按删除语义下发而不是拒绝。
        const removals = basis.filter((item) => !afterIds.has(item.id)).map((item) => ({ before: item, after: null }));
        return [...removals, ...after.filter((item) => !equal(item, byId.get(item.id))).map((item) => ({ before: byId.get(item.id) ?? null, after: item }))];
    };
    return applyAgentCanvasPatch({ ...previous, nodes, connections }, {
        canvasId: previous.id,
        updatedAt: incoming.updatedAt,
        nodes: changes(previous.nodes, incoming.nodes, nodes),
        connections: changes(previous.connections, incoming.connections, connections),
    });
}
