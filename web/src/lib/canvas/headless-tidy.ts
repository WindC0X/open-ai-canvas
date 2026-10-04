import type { CanvasNodeData } from "@/types/canvas";
import { layoutCanvasAuto } from "@/lib/canvas/canvas-layout";
import { isHeadlessTaskWorkspace } from "@/lib/canvas/workspace-type";
import { scopedLocalStorage } from "@/lib/user-scope";

/**
 * headless 画布首入自动整理（W5 统一任务面设计卡 §4.5 / 验收 8 / 反模式 A5）。
 *
 * 方案 §5 原文：「用户首入画布时流式自动整理排布（防状态反噬与画布污染）」。
 *
 * ★ 双向约束（设计卡 §三「本卡的额外价值」）：
 *   ① 任务面**不监听**画布事件（防画布污染任务）—— 见 `components/task/unified-task-face.tsx`
 *   ② headless 自动整理**不触发任务重跑**（防任务污染画布）—— 本模块
 *
 * ②的机制：整理只改 `position`（纯坐标），**绝不触碰**节点 `metadata`/`status`/生成参数。
 * 任务重跑的触发条件是节点生成参数或任务态变化，坐标变更不在其中；本模块进一步
 * 以「只投影 position」的实现把这条约束固化成代码结构，而不是靠调用方自觉。
 *
 * ★ 流式（不是一次性 layout）：逐节点入场，每帧一批，用户能看到排布过程而不是瞬移。
 */

const FIRST_ENTRY_KEY = "canvas-headless-tidy";

/** 首入标记：每个画布只整理一次（用户之后的手工排布不被覆盖）。 */
export function shouldTidyHeadlessCanvas(projectId: string, workspaceType?: string): boolean {
    if (!isHeadlessTaskWorkspace(workspaceType as never)) return false;
    return scopedLocalStorage.getItem(`${FIRST_ENTRY_KEY}:${projectId}`) !== "1";
}

export function markHeadlessCanvasTidied(projectId: string) {
    scopedLocalStorage.setItem(`${FIRST_ENTRY_KEY}:${projectId}`, "1");
}

/**
 * 计算流式整理批次：按依赖顺序逐批返回节点 id（每批一层），供调用方分帧提交。
 *
 * 只返回 id 与坐标的投影，不返回节点副本 —— 调用方必须用 `applyHeadlessTidyPositions`
 * 合并，避免把整理结果误当成节点整体更新（那会带上 metadata 变更，触碰任务态）。
 */
export function planHeadlessTidyBatches(nodes: CanvasNodeData[], connections: Parameters<typeof layoutCanvasAuto>[1], batchSize = 6): string[][] {
    const candidates = nodes.filter((node) => !node.metadata?.locked && !node.parentId);
    if (candidates.length < 2) return [];
    const positions = layoutCanvasAuto(candidates, connections);
    const ids = candidates.filter((node) => positions.has(node.id)).map((node) => node.id);
    const batches: string[][] = [];
    for (let index = 0; index < ids.length; index += batchSize) {
        batches.push(ids.slice(index, index + batchSize));
    }
    return batches;
}

/**
 * 把整理坐标合并回节点集：**只投影 position**。
 *
 * ★ 反模式 A5 的代码级防线：这里不 spread 节点、不写 metadata、不碰 status，
 * 因此整理在结构上不可能改变任务的生成参数或触发重跑。
 */
export function applyHeadlessTidyPositions(nodes: CanvasNodeData[], positions: Map<string, { x: number; y: number }>, batch: readonly string[]): CanvasNodeData[] {
    if (!batch.length || !positions.size) return nodes;
    const pending = new Set(batch);
    return nodes.map((node) => (pending.has(node.id) && positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node));
}
