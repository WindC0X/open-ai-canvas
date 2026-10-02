/**
 * 本地抠图的会话标记（测试线 S1 阻塞缺陷 2026-10-02）。
 *
 * 问题：抠图的阶段字段（backgroundRemovalPhase / backgroundRemovalStartedAt）随节点
 * 落库。写侧竞态或异常中断会留下「phase 已写、startedAt 未写」的残留态，页面重开后
 * 覆盖层按 `startedAt ?? 0` 计算已用时 = (Date.now() - 0) / 1000 = Unix 秒
 * （用户实测「正在生成透明图…（已用 1790957281s）」）。
 *
 * 解法：抠图发起时同时写入本会话 id；覆盖层只在「节点上的 id === 当前会话 id」时渲染。
 * 本值在模块求值时生成一次——页面重开 → 模块重新求值 → 新 id ≠ 节点里的旧 id →
 * 判定为残留、不渲染。同一会话内正常发起的抠图 id 相等，照常显示。
 *
 * 为什么不做数据迁移：这是数据兼容路径。历史脏数据（用户 twin 库已有）不需要清理，
 * 显示侧比对即可治愈；清理会引入「哪些节点该清」的判断，反而制造新的不一致面。
 *
 * 为什么不改用 status 守卫：抠图源节点是「有内容的成品图」，其 status 全程为 "success"
 * （抠图函数不写 status），用 status 判断会连正常运行态一起隐藏，摧毁「三段进度可见」。
 */
import { nanoid } from "nanoid";

/** 本次页面会话的抠图标记。模块级内存值，不落库、不持久化。 */
export const CUTOUT_SESSION_ID = nanoid();

/**
 * 节点上的抠图阶段是否属于本次会话（即是否为需要渲染的活跃阶段）。
 *
 * @param phase 节点 metadata.backgroundRemovalPhase
 * @param sessionId 节点 metadata.backgroundRemovalSessionId
 */
export function isActiveCutoutSession(phase: string | undefined, sessionId: string | undefined): boolean {
    return Boolean(phase) && sessionId === CUTOUT_SESSION_ID;
}
