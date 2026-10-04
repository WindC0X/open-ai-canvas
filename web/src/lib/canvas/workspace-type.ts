import type { CanvasWorkspaceType } from "@/types/canvas";

/**
 * 画布容器类型判定（W5 统一任务面设计卡 §4.2 / §4.4 反模式 A3）。
 *
 * `headless_task` 是小白直线流程**隐式创建**的容器 —— 用户未主动进入画布，
 * 画布只是产物的承载方式。它**不主动出现在画布列表顶层**：用户通过任务面的
 * 「在画布中打开」（给而不要求）到达，而不是靠翻列表发现。
 *
 * ★ 默认值纪律：`undefined` 一律视为 `standard`（存量画布零迁移）。
 */
export function isHeadlessTaskWorkspace(workspaceType: CanvasWorkspaceType | undefined | null): boolean {
    return workspaceType === "headless_task";
}

/** 过滤掉 headless 容器，返回主列表可见的画布。 */
export function filterVisibleCanvasProjects<T extends { workspaceType?: CanvasWorkspaceType }>(projects: readonly T[]): T[] {
    return projects.filter((project) => !isHeadlessTaskWorkspace(project.workspaceType));
}
