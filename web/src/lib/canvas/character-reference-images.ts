/**
 * 角色参考图选择 —— 两处调用点共用的唯一实现。
 *
 * 为什么要抽出来（W4 骑乘件三，2026-10-03）：
 * `canvas-node-generation.ts` 与 `workflow-shot-references.ts` 各有一份优先级表，
 * 两处都首选 `turnaround_sheet`（三视图）。火山方舟官方明令——
 *
 *   「人物参考图优先使用单人独立照片，**不建议使用三视图、多视图素材**」
 *   「以人物三视图/多视图作为参考素材时，易造成模型人物识别混淆，从而生成重复同款人物」
 *
 * 依据：SOUL-IMPLEMENTATION-PLAN §5.1 因果链（1.1 参考素材策略修正，C1 条），
 * 该文档的证据链为一手来源。此处只实现该文档给出的优先级，不自行发明排序。
 *
 * 优先级（官方建议顺序，单人独立照片优先）：
 *   front → side → back → primary → turnaround_sheet
 *
 * 回退语义：`primary` 通常是系统生成的角色主图（可能是拼图/合成图），
 * 因此排在三个独立视角之后；`turnaround_sheet`（三视图）垫底——
 * 不是「不能用」，而是「没有更好的独立照片时才用」。
 */
import type { CharacterRepresentation } from "@/services/api/projects";

/**
 * 参考图角色优先级（官方建议顺序）。
 *
 * 导出供测试与调用方断言；改动此表即改动产品行为，需同步 SOUL-IMPLEMENTATION-PLAN。
 */
export const CHARACTER_REFERENCE_ROLE_PRIORITY = [
    "front",
    "side",
    "back",
    "primary",
    "turnaround_sheet",
] as const;

/**
 * 从角色表现图中挑出「最适合作为生成参考」的一张。
 *
 * @param representations 角色表现图列表（顺序不敏感——按优先级表查找，不按数组顺序）
 * @returns 命中的表现图；全部未命中时返回 undefined
 */
export function resolvePreferredCharacterRepresentation(
    representations: CharacterRepresentation[],
): CharacterRepresentation | undefined {
    for (const role of CHARACTER_REFERENCE_ROLE_PRIORITY) {
        const found = representations.find((item) => item.role === role);
        if (found) return found;
    }
    return undefined;
}

/**
 * 挑出角色主参考图，并过滤掉媒体类型不是图片的项。
 *
 * 与 `resolvePreferredCharacterRepresentation` 的差别：本函数额外要求
 * `mediaType` 是图片——参考图注入只接受图片，视频/音频表现图不能当参考。
 * 优先级表之后追加「任意图片」兜底（应对 role 为自定义字符串的表现图）。
 */
export function resolvePreferredCharacterImage(
    representations: CharacterRepresentation[],
): CharacterRepresentation | undefined {
    const preferred = resolvePreferredCharacterRepresentation(representations);
    if (preferred && preferred.mediaType.startsWith("image")) return preferred;
    // 优先级表命中的不是图片（或未命中）→ 退回任意图片；仍无则 undefined。
    return representations.find((item) => item.mediaType.startsWith("image"));
}
