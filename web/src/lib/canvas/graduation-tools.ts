/**
 * 引导态可见工具白名单 —— **零依赖叶子模块**（W5 毕业机制）。
 *
 * ★ 为什么单独成文件（实测教训）：
 * 白名单原本住在 `graduation-state.ts`，但 `tool-registry.ts` 需要消费它，
 * 而 `graduation-state.ts` 又 import `node-hover-tools.tsx`（取注册表做 B1 分组），
 * 后者再 import `tool-registry.ts` —— 形成**循环依赖**：
 *
 *   tool-registry.ts → graduation-state.ts → node-hover-tools.tsx → tool-registry.ts
 *
 * 运行时表现为 `ReferenceError: Cannot access 'registry' before initialization`
 * （`canvas-node-toolbar.test.ts` 直接炸，单跑即复现）。
 *
 * 修法：把**纯数据**（白名单常量）抽到这个零依赖模块，`tool-registry.ts` 只 import 它，
 * 循环被打断。`graduation-state.ts` 继续持有状态机与分组逻辑（可安全 import 注册表）。
 *
 * ★ 单一真值纪律：白名单只此一处定义，消费方（tool-registry 的过滤、graduation-state
 * 的查询函数、测试）全部引用它，不得各自硬编码 id 清单。
 */

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
 *
 * ★ 语义是**上限**不是固定值：实际渲染还要过工具的 `applicable`（节点类型判据），
 * 故各节点类型下是它的子集（实测：有图图片节点 2 项、文本节点 4 项、视频节点 3 项），
 * 但**绝不会超出**本清单。
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
 * 引导态工具过滤（★ R1 修复 E-1 的**真接缝**）。
 *
 * 图片工具层（`buildImageToolbarTools` 30 项）与注册表层是两条独立定义源，
 * 此前只有注册表层过白名单 —— 图片层整条旁路，guide 态实测 32 项（评审线 E-1）。
 *
 * 本函数是**唯一过滤入口**：`canvas-node-toolbar` 的合并路径调用它，
 * 接线级测试直接断言它的返回值（不是复刻表达式 —— 防「测试镜像实现」）。
 *
 * @param tools 待过滤工具（只需 id 字段）
 * @param workspaceMode 当前工作区模式（非 guide 原样返回）
 */
export function filterToolsForGuide<T extends { id: string }>(tools: T[], workspaceMode: string | undefined): T[] {
    if (workspaceMode !== "guide") return tools;
    return tools.filter((tool) => GUIDE_VISIBLE_TOOL_IDS.includes(tool.id));
}
