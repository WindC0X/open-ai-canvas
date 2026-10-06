/**
 * F-09 爆款复刻 —— 提交构造（纯函数，供执行链与结构断言测试共用）。
 *
 * 与 F-08 的 annotate-edit-submission.ts 同构：执行链（createCloneRecreateNode）
 * 只做编排，「提交了什么」由本模块单点决定且可被结构断言直接测试。
 *
 * ★ 分工（控制线 2026-10-06 裁定 C-2）：
 *   · 六段式骨架 + 动态段【后端注入】（不可由用户误改，保护 H3 合规红线）
 *   · 前端只负责：① 声明产品图张数（productImageCount）
 *                 ② 收集用户参数选择（cloneDegree / cloneScope / copyMode）
 *                 ③ 按 @提及顺序排列参考图（数组顺序 = 产品图在前 N 位）
 *
 * ★ 数组顺序契约（后端 providerConfig.ProductImageCount 的前置条件）：
 *   产品图必须排在 referenceImages 的前 N 位。后端只能按位置编号，
 *   顺序写反会让「图1～N＝产品图组」与模型所见完全相反且不报错。
 *   本模块通过【先产品图后参考图】的显式拼装保证该契约。
 */

import type { ReferenceImage } from "@/types/image";
import { CLONE_DEGREE_OPTIONS, CLONE_SCOPE_OPTIONS, COPY_MODE_OPTIONS, type CloneDegree, type CloneRecreateParams, type CloneScope, type CopyMode } from "@/lib/canvas/clone-recreate-params";

function optionLabel<T extends string>(options: { value: T; label: string }[], value: T): string {
    return options.find((item) => item.value === value)?.label || value;
}

/** 复刻程度的中文 label（用户可见）。 */
export function cloneDegreeLabel(value: CloneDegree): string {
    return optionLabel(CLONE_DEGREE_OPTIONS, value);
}

/** 复刻侧重的中文 label（用户可见）。 */
export function cloneScopeLabel(value: CloneScope): string {
    return optionLabel(CLONE_SCOPE_OPTIONS, value);
}

/** 文字策略的中文 label（用户可见）。 */
export function copyModeLabel(value: CopyMode): string {
    return optionLabel(COPY_MODE_OPTIONS, value);
}

export type CloneRecreateSubmissionInput = {
    /** 源节点 id（生成节点的 child 节点 metadata.sourceNodeId）。 */
    nodeId: string;
    /** 产品图（被替换的主体），按用户 @ 顺序；可为空（纯版式复刻）。 */
    productImages: ReferenceImage[];
    /** 版式参考图（视觉方案来源），按用户 @ 顺序。 */
    referenceImages: ReferenceImage[];
    /** 用户在参数面选择的三项（复刻程度 / 复刻侧重 / 文字策略）。 */
    params: CloneRecreateParams;
};

export type CloneRecreateSubmission = {
    /** 提交给后端的提示词（前端不拼六段式，后端注入层负责）。 */
    prompt: string;
    /**
     * 参考图数组 —— ★ 顺序契约的落点：产品图在前 N 位，版式参考图在后。
     * productImageCount = productImages.length。
     */
    referenceImages: ReferenceImage[];
    /** 产品图张数（→ providerConfig.productImageCount → 后端角色清单）。 */
    productImageCount: number;
    /** 节点元数据（含参数选择，供 UI 回显与审计）。 */
    metadata: Record<string, unknown>;
};

/**
 * 构造 F-09 提交物。
 *
 * 提示词只承载【用户意图与参数】，不承载六段式正文 —— 后者由后端
 * prompt_clone_skeleton.go 注入，保证合规段不可被用户编辑破坏。
 */
export function buildCloneRecreateSubmission(input: CloneRecreateSubmissionInput): CloneRecreateSubmission {
    const productImages = input.productImages;
    const referenceImages = input.referenceImages;
    // ★ 顺序契约：产品图在前、版式参考图在后（后端按位置编号「图1～N / 图N+1～M」）。
    const orderedReferences = [...productImages, ...referenceImages];

    return {
        prompt: buildCloneRecreatePrompt(input.params, productImages.length, referenceImages.length),
        referenceImages: orderedReferences,
        productImageCount: productImages.length,
        metadata: {
            cloneRecreateParams: { ...input.params },
            productImageCount: productImages.length,
            referenceImageCount: referenceImages.length,
        },
    };
}

/**
 * ★ F-09 修复批 B2-1（评审线 2026-10-06）：Config 节点生成动作的【纯函数判据】。
 *
 * 为什么抽成纯函数：原先判据内联在 project.tsx 的 `CanvasNodePromptPanel.onGenerate` 里，
 * 而 Config 节点【永不渲染该组件】（project.tsx:2286-2299 走 CanvasConfigComposer 分支，
 * 其 Props 无 onGenerate）⇒ 派发挂在不可达路径，handler 仍零消费方。
 *
 * 抽成纯函数后：
 *   ① 两个 onGenerate（Config 真实入口 CanvasConfigNodePanel + 通用面板）共用同一判据，防未来分叉
 *   ② 测试可以断言【返回值】（行为断言），而不是断言源码文本存在（文本断言无法捕获功能失效 ——
 *      评审线实测：handler 内部首行早退时 10 pass / 0 fail）
 *
 * 判据：节点 metadata 带 cloneRecreateParams（模板实例化时写入）
 * ⇒ 只有爆款复刻模板产出的生成节点走专属链，其他 Config 节点（含 RunningHub 工作流）零影响。
 */
export type ConfigGenerateAction =
    | { kind: "clone-recreate"; params: CloneRecreateParams }
    | { kind: "generic" };

export function resolveConfigGenerateAction(
    node: { metadata?: { cloneRecreateParams?: CloneRecreateParams } } | undefined | null,
): ConfigGenerateAction {
    const params = node?.metadata?.cloneRecreateParams;
    if (params) return { kind: "clone-recreate", params };
    return { kind: "generic" };
}

/** 判据所需的最小节点结构（结构类型，避免 lib 依赖页面类型）。 */
export type ConfigGenerateTarget = {
    id: string;
    metadata?: { cloneRecreateParams?: CloneRecreateParams };
};

/**
 * ★ 泛型 <T>：调用方传入的节点类型（如 CanvasNodeData）在 handler 中原样保留。
 * 为什么需要：createCloneRecreateNode 的签名要求完整 CanvasNodeData，
 * 若此处收窄为 ConfigGenerateTarget，调用方还得做一次无意义的类型断言。
 */
export type ConfigGenerateHandlers<T extends ConfigGenerateTarget> = {
    onCloneRecreate: (node: T, params: CloneRecreateParams) => void;
    onGenericGenerate: (nodeId: string, mode: string, prompt: string) => void;
};

/**
 * ★ 修复批 B2-1（评审线 2026-10-06 第二轮）：Config 节点生成派发的【完整分支逻辑】。
 *
 * 为什么把分支整个搬到这里（而不是留在 project.tsx 的 dispatchConfigGenerate 里）：
 *   评审线的注入实验证明 —— 只要分支留在组件内，测试就只能用【源码文本断言】覆盖它，
 *   而文本断言无法捕获「语义失效」（handler 首行早退 ⇒ 文本全保留 ⇒ 全绿）。
 *   把分支搬进纯函数后：
 *     ① 分支可被【行为断言】直接覆盖（注入 spy handler，断言哪个被调用）
 *     ② project.tsx 的派发点退化为【无分支的纯接线】（只有一处 if 都没有的调用），
 *        「改分支条件」这个注入点在该处【物理上不存在】了
 *     ③ 两个 onGenerate 共用同一分支 ⇒ 不存在第二份判据（V1）
 *
 * @returns 实际走的动作 kind（便于测试与日志）
 */
export function dispatchConfigGenerateAction<T extends ConfigGenerateTarget>(
    node: T | undefined | null,
    mode: string,
    prompt: string,
    handlers: ConfigGenerateHandlers<T>,
): ConfigGenerateAction["kind"] {
    const action = resolveConfigGenerateAction(node);
    if (action.kind === "clone-recreate" && node) {
        handlers.onCloneRecreate(node, action.params);
        return "clone-recreate";
    }
    handlers.onGenericGenerate(node?.id ?? "", mode, prompt);
    return "generic";
}

/**
 * 前端提示词 —— 只写用户意图与参数口径。
 *
 * ★ 六段式骨架（任务/优先级/主体真实性/原创与文字安全/输出要求）与动态段
 *   由后端注入（控制线裁定 C-2）。此处不重复，避免两份真值（V1）。
 */
export function buildCloneRecreatePrompt(params: CloneRecreateParams, productCount: number, referenceCount: number): string {
    const lines = ["按版式参考图复刻一张商业视觉。"];
    if (productCount > 0) {
        lines.push(`用我提供的 ${productCount} 张产品图替换成片中的商品主体。`);
    }
    if (referenceCount > 0) {
        lines.push(`版式参考图 ${referenceCount} 张，沿用其视觉方案。`);
    }
    // ★ 用中文 label 而非内部 value：前端提示词会显示给用户看，
    //   而 value（如 lighting）对用户无意义。后端拼装的动态段才用 des 文本。
    lines.push(`复刻程度：${cloneDegreeLabel(params.cloneDegree)}；复刻侧重：${params.cloneScope.map(cloneScopeLabel).join("、") || "默认"}；文字策略：${copyModeLabel(params.copyMode)}。`);
    return lines.join("\n");
}
