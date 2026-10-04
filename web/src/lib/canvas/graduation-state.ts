/**
 * 毕业机制 —— 引导态状态机（W5 直线入口设计卡 §3.4 + 控制线 2026-10-04 四项裁定）。
 *
 * ★ 两个门控、两个作用域（控制线裁定②，防方向性歧义）：
 *   · `LinearFlowGate`（`linear-flow-gate.ts`）：allowed/locked/hidden，只作用于**直线流程内部步骤**。
 *   · `GuideState`（本模块）：画布的**进入模式**，只作用于**节点工具栏可见性**。
 * 两者正交，互不引用。
 *
 * ★ 方向性纪律（PRODUCT.md 反参照 + 硬验收②，控制线钉死）：
 *   · 直接打开画布的用户 → **完整画布，零门控**（默认态不变）
 *   · 从卡流程点「在画布中打开」进入 → 引导态（node-hover 只露 6 动作 + 顶部常驻「完整画布」出口）
 *   · 毕业 = **单向粘性**：完成首单 或 点「完整画布」→ 全量 20 项，此后不再回退
 *
 * ★ 为什么是纯函数模块：状态机零 IO、零框架、零 store 依赖 —— 便于单测与在任意载体上复用
 * （载体选择见任务书；本模块不预设是扩展 `CanvasWorkspaceMode` 还是独立字段）。
 */
import { nodeHoverToolbarTools } from "@/lib/canvas/tool-registry/definitions/node-hover-tools";

/**
 * 引导态三态（控制线裁定②）。
 *
 * - `novice`：从未进入引导态（直接开画布的用户）→ **完整画布**。
 * - `guide`：引导态中（从卡流程进入）→ 只露 6 动作。
 * - `graduate`：已毕业（**终态，单向粘性**）→ 完整画布，且**此后不再回退**。
 *
 * ★ novice 与 graduate 的可见性相同（都是完整画布），区别在**粘性**：
 * 已毕业用户即使再次从卡流程进入，也**不再降回**引导态。
 */
export type GuideState = "novice" | "guide" | "graduate";

/** 进入画布的入口（决定是否开启引导态）。 */
export type GuideEntry = "direct" | "linear-flow";

export type GuideStateInput = {
    /** 当前持久化状态（undefined = 从未记录 = novice）。 */
    current?: GuideState;
    /** 本次进入画布的入口。 */
    entry: GuideEntry;
    /** 是否已完成首单（首个任务 succeeded）。 */
    firstOrderCompleted?: boolean;
    /** 用户是否点了「完整画布」出口。 */
    fullCanvasRequested?: boolean;
};

/**
 * 状态迁移（★ 单向粘性：`graduate` 是终态，任何输入都不回退）。
 *
 * 优先级（高 → 低）：
 *   ① 已是 graduate → graduate（终态，粘性）
 *   ② 完成首单 或 点「完整画布」→ graduate
 *   ③ 从卡流程进入 → guide
 *   ④ 直接进入 → novice（保持当前；默认完整画布）
 */
export function resolveGuideState(input: GuideStateInput): GuideState {
    if (input.current === "graduate") return "graduate";
    if (input.firstOrderCompleted === true || input.fullCanvasRequested === true) return "graduate";
    if (input.entry === "linear-flow") return "guide";
    return input.current ?? "novice";
}

/** 是否处于引导态（唯一需要门控的状态）。 */
export function isGuideStateActive(state: GuideState): boolean {
    return state === "guide";
}

/**
 * 引导态露出的 6 个动作（控制线裁定③授权按四判据选取）。
 *
 * ★ 判据命中（逐项，控制线要求任务书列明）：
 *   ① 新手任务对齐（卡流程教过的动作优先）
 *   ② 排除系统动作（delete/retry/info/node-lock 等「管理」类不进）
 *   ③ 覆盖「结果永远可编辑」核心语义（编辑类优先）
 *   ④ registry 条目对齐（映射注册表 tool id，保持注册表原生纪律）
 *
 * | # | tool id | 判据命中 |
 * |---|---|---|
 * | 1 | `edit` | ③ 核心编辑语义（文本生成/生成设置）；① 卡流程「确认」步的延续 |
 * | 2 | `generateImage` | ③ 结果可再生成；① 卡流程「出图」步的画布侧对应 |
 * | 3 | `uploadImage` | ① 卡流程「传图」步逐字对应 |
 * | 4 | `download` | ③ 硬验收③「交付步」在画布侧的对应 |
 * | 5 | `editText` | ③ 内容编辑（放大编辑） |
 * | 6 | `saveAsset` | ③ 成果沉淀（结果可保存复用） |
 *
 * 排除示例（判据②）：`info`（只读信息）、`delete`（危险）、`retry`（异常恢复）、
 * `node-lock`（状态管理）—— 它们是「管理」不是「创作」。
 */
export const GUIDE_VISIBLE_TOOL_IDS: readonly string[] = [
    "edit",
    "generateImage",
    "uploadImage",
    "download",
    "editText",
    "saveAsset",
];

/** 引导态动作数（控制线「6 动作」硬约束）。 */
export const GUIDE_VISIBLE_TOOL_COUNT = 6;

/**
 * 节点工具栏在给定状态下的可见工具 id。
 *
 * @returns `null` = **零门控**（全量呈现）；`string[]` = 白名单。
 */
export function guideVisibleToolIds(state: GuideState): readonly string[] | null {
    return isGuideStateActive(state) ? GUIDE_VISIBLE_TOOL_IDS : null;
}

/** 某工具在给定状态下是否可见（`null` 白名单 = 全部可见）。 */
export function isToolVisibleInGuideState(state: GuideState, toolId: string): boolean {
    const whitelist = guideVisibleToolIds(state);
    return whitelist === null || whitelist.includes(toolId);
}

/**
 * 毕业后的分组呈现（控制线裁定②：「node-hover 20 项按 B1 分组全量呈现」）。
 *
 * B1 分组来源 = 注册表工具的 `nodeToolbar.section`（`tool-definition.ts:190` 字段已有），
 * 不是硬编码清单 —— 分组随注册表演进自动跟随。
 */
export function nodeHoverToolsBySection(): Array<{ section: string; toolIds: string[] }> {
    const groups = new Map<string, string[]>();
    for (const tool of nodeHoverToolbarTools) {
        const section = tool.nodeToolbar?.section || "常用操作";
        const ids = groups.get(section) || [];
        ids.push(tool.id);
        groups.set(section, ids);
    }
    return [...groups.entries()].map(([section, toolIds]) => ({ section, toolIds }));
}

/** 节点工具栏注册表里的全量工具 id（毕业后的解锁面）。 */
export function allNodeHoverToolIds(): string[] {
    return nodeHoverToolbarTools.map((tool) => tool.id);
}
