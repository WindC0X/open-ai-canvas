import { expect, test, describe } from "bun:test";

import { buildAnnotateEditPrompt } from "@/lib/canvas/annotate-edit-prompt";

/**
 * F-08 提示词组装单测（纯逻辑，零 DOM）。
 *
 * 语义对照 Cowart `ANNOTATION_EDIT_PROMPT`（App.jsx:153，一手验证）+
 * 合并路线两图协议（控制线 2026-10-05 裁定 A：原图+标注截图，沿用既有链输入形态）。
 * ★ 转写化石禁令：断言不引用 og-canvas 转写件字符串。
 */

describe("buildAnnotateEditPrompt", () => {
    test("★ 核心语义纪律齐备（Cowart 逐条对齐 + 两图协议）", () => {
        const prompt = buildAnnotateEditPrompt({ annotationCount: 2, exportWidth: 1200, exportHeight: 900 });
        // ① 任务声明
        expect(prompt).toContain("请根据标注修改图片");
        // ② 两图协议说明（图1=原图，图2=标注截图）
        expect(prompt).toContain("第一张图是原图");
        expect(prompt).toContain("第二张图是带标注的截图");
        // ③ 标注文字=修改要求
        expect(prompt).toContain("把标注文字当作修改要求");
        // ④ 不烙图纪律
        expect(prompt).toContain("不要把标注箭头、标注文字、选框或其他标注痕迹带进最终图片");
        // ⑤ 默认意图行（modify）
        expect(prompt).toContain("只修改被标注的区域");
    });

    test("元数据行携带标注数与截图尺寸", () => {
        const prompt = buildAnnotateEditPrompt({ annotationCount: 3, exportWidth: 800, exportHeight: 600 });
        expect(prompt).toContain("Included annotation shapes: 3");
        expect(prompt).toContain("Screenshot size: 800x600");
    });

    test("尺寸取整（浮点像素防御）", () => {
        const prompt = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 1200.4, exportHeight: 899.6 });
        expect(prompt).toContain("Screenshot size: 1200x900");
    });

    test("标注数下限保护（负数/零不产出负值行）", () => {
        expect(buildAnnotateEditPrompt({ annotationCount: 0, exportWidth: 100, exportHeight: 100 })).toContain("Included annotation shapes: 0");
        expect(buildAnnotateEditPrompt({ annotationCount: -1, exportWidth: 100, exportHeight: 100 })).toContain("Included annotation shapes: 0");
    });

    test("输出为多行文本（含空行分隔元数据区）", () => {
        const lines = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 100, exportHeight: 100 }).split("\n");
        expect(lines.length).toBeGreaterThanOrEqual(6);
        expect(lines.some((line) => line === "")).toBe(true);
    });
});
