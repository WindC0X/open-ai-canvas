/**
 * F-08 圈选改图 —— 提示词组装（Cowart 语义重写 + 既有两图协议合并）。
 *
 * 蓝本：Cowart `ANNOTATION_EDIT_PROMPT`（App.jsx:153，一手生成验证过的语义）。
 * ★ 转写化石禁令（控制线裁定）：og-canvas 的 `buildCowartImageEditPrompt` 及其
 *   提示词文本不可复制——此处按 Cowart 一手语义重写，不引用转写件任何字符串。
 *
 * 提交协议（沿用既有 annotationEdit 链的两图形式）：
 *   图 1 = 原图；图 2 = 带标注的截图（结构化路线为 bounds 裁剪合成版，画笔路线为整图标注）。
 *
 * 语义骨架：
 * ① 任务声明：按标注修改图片（两图说明）
 * ② 「标注文字=修改要求」+「生成一张干净新图」
 * ③ 不烙图纪律：标注箭头/文字/选框不得进入结果图
 * ④ 编辑意图行（actionHint：修改/替换/移除）
 * ⑤ Cowart 元数据行：标注数 + 截图尺寸（同 buildAnnotationEditPrompt 的 Included/Screenshot 行）
 */

/** 编辑意图（参数面 actionHint；进提示词组装前缀）。 */
export type AnnotateEditAction = "modify" | "replace" | "remove";

/** 编辑意图选项（UI 与提示词行的单一真值源）。 */
export const ANNOTATE_EDIT_ACTIONS: Array<{ value: AnnotateEditAction; label: string; promptLine: string }> = [
    {
        value: "modify",
        label: "修改",
        promptLine: "只修改被标注的区域，保持未标注区域、构图、主体和细节不变。",
    },
    {
        value: "replace",
        label: "替换",
        promptLine: "把被标注区域的内容替换为标注文字描述的内容，保持其他区域不变。",
    },
    {
        value: "remove",
        label: "移除",
        promptLine: "移除被标注区域的内容，并用周围画面自然补全，保持其他区域不变。",
    },
];

export type AnnotateEditPromptInput = {
    /** 标注数量（结构化=形状数；画笔=笔画数）。 */
    annotationCount: number;
    /** 导出截图尺寸（0 时省略该元数据行）。 */
    exportWidth: number;
    exportHeight: number;
    /** 编辑意图（缺省 modify）。 */
    actionHint?: AnnotateEditAction;
};

/**
 * 组装圈选改图的提示词。
 *
 * 输出为中文（影策用户侧语言），语义与 Cowart 一手蓝本逐条对齐。
 */
export function buildAnnotateEditPrompt(input: AnnotateEditPromptInput): string {
    const actionLine = ANNOTATE_EDIT_ACTIONS.find((item) => item.value === input.actionHint)?.promptLine
        ?? ANNOTATE_EDIT_ACTIONS[0].promptLine;
    const lines = [
        "请根据标注修改图片：",
        "- 第一张图是原图；第二张图是带标注的截图，标注箭头或标注文字指向要修改的位置。",
        "- 请把标注文字当作修改要求，生成一张新的干净图片。",
        "- 不要把标注箭头、标注文字、选框或其他标注痕迹带进最终图片。",
        `- ${actionLine}`,
        "",
        `Included annotation shapes: ${Math.max(0, input.annotationCount)}`,
    ];
    if (input.exportWidth > 0 && input.exportHeight > 0) {
        lines.push(`Screenshot size: ${Math.round(input.exportWidth)}x${Math.round(input.exportHeight)}`);
    }
    return lines.join("\n");
}
