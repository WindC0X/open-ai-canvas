/**
 * F-02 场景图执行 —— 生成链路接线（同 `canvas-style-execution.ts` 的改写器范式）。
 *
 * ★ 为什么需要这一层（诚实说明第一段的位置）：
 * Agent 路径本身已是两段式（LLM 出 prompt → 图像模型执行），但**两个 Flora 范式
 * 不随之生效**：
 *   ① `@[ref]` 角色声明（防模型把场景参考当第二主体）
 *   ② mask 语义预写（声明蒙版不是参考图 + 透明渲染为黑）
 * 这两段是**协议面**，必须进最终 prompt —— 否则参考图会被误用。本模块把它们
 * 追加到生成链路产出的 effectivePrompt 上，是「管线组件」与「生成链路」之间的接线。
 *
 * 判据（何时启用）：
 *   节点元数据带 `scenePresetId`（由场景入口写入）即为场景图任务。
 *   无该标记时本模块**完全不介入**（返回 null），不影响任何既有生成路径。
 */
import { buildScenePrompt, type SceneSpecVariables } from "@/lib/canvas/scene-prompt-pipeline";
import { SCENE_PRESETS, findScenePreset, type ScenePreset } from "@/lib/canvas/scene-presets";
import type { CanvasNodeData } from "@/types/canvas";

export type SceneExecutionRuntime = {
    /** 追加角色声明与 mask 语义后的提示词。 */
    prompt: string;
    /** 命中的场景预设 id（可观测性/任务面元数据用）。 */
    scenePresetId: string;
    /** 是否走了降智退化档。 */
    degraded: boolean;
};

/**
 * 从提示词文本识别场景预设（过渡形态的标记传递路径）。
 *
 * ★ 为什么需要它（诚实说明）：
 * 场景入口（Agent 面板）与生成执行器（画布页）不在同一组件树，且 Agent 建的草稿
 * 节点由后端 patch 创建 —— 前端入口**无法**直接往节点元数据写 `scenePresetId`。
 * 而入口生成的 brief 文本由本仓控制、形如：
 *   「帮我做一张「晨光厨房」风格的商拍场景图：...」
 * 故按「「<场景名>」风格的商拍场景图」这一稳定句式反查场景库。
 *
 * W5 直线入口设计卡出稿后，标记应由链路显式传递（元数据字段已预留），
 * 本函数届时退化为兜底。
 */
export function detectScenePresetFromPrompt(prompt: string): ScenePreset | undefined {
    const text = String(prompt || "");
    if (!text.includes("商拍场景图")) return undefined;
    // 按标题长度降序匹配，避免「晨光厨房」被更短的同前缀名误命中
    const byLength = [...SCENE_PRESETS].sort((a, b) => b.title.length - a.title.length);
    return byLength.find((preset) => text.includes(`「${preset.title}」`));
}

/** 节点是否标记为场景图任务（元数据标记优先，回退文本识别）。 */
export function isSceneGenerationNode(node: CanvasNodeData | undefined): boolean {
    if (node?.metadata?.scenePresetId) return true;
    return Boolean(detectScenePresetFromPrompt(String(node?.metadata?.prompt || node?.metadata?.composerContent || "")));
}

/**
 * 解析场景图执行：把角色声明 / mask 语义 / （降智档）模板拼进提示词。
 *
 * @param sourceNode 源节点（读取 `scenePresetId` 与商品描述）
 * @param prompt 生成链路已产出的提示词（Agent 的 spec 或用户手写）
 * @param options.hasMask 是否附带蒙版（F-01 抠图产物可作 mask 输入）
 * @param options.degraded 强制降智档（弱渠道实测 / 演示用）
 */
export function resolveSceneExecution(
    sourceNode: CanvasNodeData | undefined,
    prompt: string,
    options: { hasMask?: boolean; degraded?: boolean; hasSceneReference?: boolean } = {},
): SceneExecutionRuntime | null {
    const marked = String(sourceNode?.metadata?.scenePresetId || "").trim();
    // 标记优先（W5 目标形态）；无标记时回退按 brief 句式识别（过渡形态）
    const detected = marked ? undefined : detectScenePresetFromPrompt(prompt);
    const scenePresetId = marked || detected?.id || "";
    if (!scenePresetId) return null;

    const preset = findScenePreset(scenePresetId) ?? detected;
    // 商品描述：优先节点标题（Agent 建的草稿节点标题通常是商品/意图），回退提示词首句。
    const product = String(sourceNode?.title || "").trim() || prompt.split(/[。.\n]/)[0]?.trim() || "the product";

    const degraded = options.degraded === true || !prompt.trim();
    const variables: Partial<SceneSpecVariables> = preset
        ? { ...preset.variables, product }
        : { product };

    const result = buildScenePrompt({
        // 降智档不消费 sceneBrief（模板+变量即可），正常档用链路产出的 prompt
        sceneBrief: degraded ? "" : prompt,
        product,
        hasSceneReference: options.hasSceneReference,
        hasMask: options.hasMask,
        degraded,
        variables,
    });

    return { prompt: result.prompt, scenePresetId, degraded: result.degraded };
}
