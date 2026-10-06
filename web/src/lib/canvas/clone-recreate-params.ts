/**
 * F-09 爆款复刻 —— 参数面定义（复刻程度 / 复刻侧重 / 文字策略）。
 *
 * ★ 选项的 `des` 文本是【提示词片段】的一手来源：
 *   ImgAk wfapp-52 的 concatRules 用 `sourceProperty: "des"`，
 *   即把选项的**描述文本**（非 label）拼进提示词。
 *   逐字取自 docs/artifacts/f09-input-spec/S1-meitu-piccopilot-deep-dive/corpus/imgak/wfapp-52-detail.json
 *   的 inputs[5]（clone.degree）/ inputs[6]（clone.scope）/ inputs[8]（copy.mode）的 constraint.item[].des。
 *
 * ★ 拼装位置（控制线 2026-10-06 裁定 C-2）：
 *   `des` 文本只在【后端】存一份并拼装（prompt_clone_skeleton.go），
 *   前端只提交【选项 value】。若前端也存 des 文本会形成两份真值（V1）。
 *   本文件因此只保留 label 与 value，des 由后端负责。
 */

/** 复刻程度（clone.degree）—— 单选。 */
export type CloneDegree = "style-reference" | "high-structure";

/** 复刻侧重（clone.scope）—— 多选。 */
export type CloneScope = "composition" | "palette" | "lighting" | "typography" | "background" | "people-models";

/** 文字策略（copy.mode）—— 单选。 */
export type CopyMode = "no-copy" | "auto-copy" | "exact-copy";

export type CloneRecreateParams = {
    cloneDegree: CloneDegree;
    cloneScope: CloneScope[];
    copyMode: CopyMode;
};

export const CLONE_DEGREE_OPTIONS: { value: CloneDegree; label: string }[] = [
    { value: "style-reference", label: "参考风格" },
    { value: "high-structure", label: "高度复刻" },
];

export const CLONE_SCOPE_OPTIONS: { value: CloneScope; label: string }[] = [
    { value: "composition", label: "构图与留白" },
    { value: "palette", label: "色彩关系" },
    { value: "lighting", label: "光线与质感" },
    { value: "typography", label: "排版节奏" },
    { value: "background", label: "背景与道具" },
    { value: "people-models", label: "人物 / 模特主体" },
];

export const COPY_MODE_OPTIONS: { value: CopyMode; label: string }[] = [
    { value: "no-copy", label: "无文字" },
    { value: "auto-copy", label: "自动文案" },
    { value: "exact-copy", label: "使用文案" },
];

/** 默认参数（对齐 ImgAk 默认表单：cloneLevel 默认 high；文字默认自动文案）。 */
export const DEFAULT_CLONE_RECREATE_PARAMS: CloneRecreateParams = {
    cloneDegree: "high-structure",
    cloneScope: ["composition", "palette", "lighting"],
    copyMode: "auto-copy",
};
