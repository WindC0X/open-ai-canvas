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

/**
 * 是否渲染画布库的「加载更多」哨兵节点（★ T2-P1a 修复的行为契约）。
 *
 * 背景：该节点是 IntersectionObserver 的观察目标，缺失则永远拉不到下一页。
 * 缺陷形态（修复前）：条件只看 `visibleCount`，而 visibleCount 是**过滤后**的数量
 * —— 当前页全被过滤（如全是 headless 容器）时它为 0 ⇒ 节点不渲染 ⇒ **死锁**。
 *
 * 抽为纯函数的理由（控制线建议）：原修复只有源码文本断言（对格式敏感、
 * 不能证明运行时行为）；本函数让行为可直接测三态。
 *
 * @param input.hydrated 画布数据是否已 hydrate（未就绪不渲染，避免闪空态）
 * @param input.visibleCount 过滤后可见项数量
 * @param input.hasMore 是否还有下一页（服务端游标）
 */
export function shouldRenderLoadMore(input: { hydrated: boolean; visibleCount: number; hasMore: boolean }): boolean {
    if (!input.hydrated) return false;
    return input.visibleCount > 0 || input.hasMore;
}
