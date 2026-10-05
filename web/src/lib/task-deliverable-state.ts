import type { GenerationTask } from "@/services/api/task-center";

/**
 * 任务交付就绪判定（纯函数，★ 零依赖 —— 不得 import asset store / 画布层）。
 *
 * ★ 抽为独立模块的原因（R3 P1-2 修复）：判据原先内联在 unified-task-face 组件里
 * （`status === "succeeded" && Boolean(previewUrl)`），与下载实现
 * （task-face-download.ts 优先走 outputs[].materializedAssetId）**不一致**：
 *   ① 有合规素材但无 previewUrl ⇒ 下载入口不出现
 *   ② 素材未就绪 ⇒ 按钮已可点，点下去可能下到缩略图
 * 而 task-face-download.ts 自身 import 了 useAssetStore（下载实现需要），
 * 任务面组件不能 import 它（会破坏独立性护栏）⇒ 把**纯判据**抽到这里，
 * 两侧共用同一真值。
 */

export function taskDeliverableOutput(task: GenerationTask) {
    const outputs = task.outputs ?? [];
    return outputs.slice().sort((a, b) => a.outputIndex - b.outputIndex)[0];
}

/**
 * 交付就绪判定（★ R3 P1-2 修复）。
 *
 * 缺陷：面板/任务面的下载入口原先只看 `task.status === "succeeded" && Boolean(previewUrl)`，
 * 而 `downloadGenerationTaskResult` 自认 previewUrl「可能是缩略图」并**优先走**
 * `outputs[].materializedAssetId` ⇒ 判据与实现优先序不一致：
 *   ① 有合规素材但无 previewUrl ⇒ 下载入口不出现（用户拿不到成品）
 *   ② 素材未就绪（materializing 等）⇒ 按钮已可点，点下去可能下到缩略图
 *
 * 本函数把「能不能下载」收敛为单一判定，与下载实现同源：
 *   · 有 outputs 且首个可解析到 materializedAssetId ⇒ 可下载（合规成品路径）
 *   · 否则回退到 previewUrl（展示地址，可能缩略图）—— 仍可下载但属降级
 *
 * 返回值区分两种可下载形态，供 UI 决定是否提示降级。
 */
export type TaskDeliverableState =
    | { downloadable: true; quality: "original" }
    | { downloadable: true; quality: "preview"; reason: string }
    | { downloadable: false; reason: string };

export function taskDeliverableState(task: GenerationTask): TaskDeliverableState {
    if (task.status !== "succeeded") return { downloadable: false, reason: "任务未成功" };
    const output = taskDeliverableOutput(task);
    if (output?.materializedAssetId) {
        // 素材记录存在即认为可走原始字节路径（解析失败由下载函数抛错并提示）。
        return { downloadable: true, quality: "original" };
    }
    if (task.previewUrl) {
        return { downloadable: true, quality: "preview", reason: "素材记录未就绪，将下载展示用地址" };
    }
    return { downloadable: false, reason: "任务产物不可下载：既无素材记录也无展示地址" };
}

