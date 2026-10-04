import { expect, test, describe } from "bun:test";

import { buildAnnotateEditPrompt } from "@/lib/canvas/annotate-edit-prompt";
import { buildAnnotateEditSubmission } from "@/lib/canvas/annotate-edit-submission";
import type { ReferenceImage } from "@/types/image";
import type { AnnotateEditAnnotation } from "@/lib/canvas/annotate-edit-geometry";

/**
 * ★ F-08 P1 修复批 —— 标注文字（note）双通道贯通断言。
 *
 * 缺陷（2026-10-04 真机发现）：shape 模式用户填写的「修改要求」三条通道全丢——
 * 不进 prompt、不画进截图、不进 metadata，模型只能从截图色块猜意图。
 *
 * 修复：(a) 截图渲染 note 文字（蓝本语义：截图含箭头**和标注文字**）
 *       (b) notes 按序号拼入 prompt（显式冗余通道）
 *
 * ★ 测试纪律（控制线裁定）：prompt 行为断言 + 提交 payload 结构断言自动化；
 * 截图渲染走真机验证点（bun 无 canvas，不硬造脆弱断言）。
 *
 * ★ 本批教训（控制线要求入 journal）：修前 5 个测试文件全部只断言现状行为，
 * 无一条断言蓝本符合性——测试镜像了实现的盲区。本文件断言的是**规格**（note 必须到达模型）。
 */

function sourceReference(): ReferenceImage {
    return { id: "node-1", name: "reference-node-1.png", type: "image/png", dataUrl: "data:image/png;base64,source", storageKey: "sk-source" };
}

function region(note: string, index = 0): AnnotateEditAnnotation {
    return { id: `r${index}`, shape: "region", note, x: 0.1 + index * 0.1, y: 0.1, width: 0.2, height: 0.2 };
}

function arrow(note: string, index = 0): AnnotateEditAnnotation {
    return { id: `a${index}`, shape: "arrow", note, x: 0.2, y: 0.2, endX: 0.5, endY: 0.4 };
}

describe("★ 通道 b：note 进提示词（行为断言）", () => {
    test("★ 单条 note 出现在提示词中（缺陷回归锚点）", () => {
        const prompt = buildAnnotateEditPrompt({
            annotationCount: 1,
            exportWidth: 1024,
            exportHeight: 1024,
            actionHint: "modify",
            notes: [{ label: 1, shape: "region", note: "把杯身改成深蓝色陶瓷材质" }],
        });
        // ★ 缺陷本体：修前这里为 false
        expect(prompt).toContain("把杯身改成深蓝色陶瓷材质");
        expect(prompt).toContain("各标注的修改要求");
        expect(prompt).toContain("标注 1（矩形选框）：把杯身改成深蓝色陶瓷材质");
    });

    test("★ 多条 note 按序号逐条列出（与截图徽标一一对应）", () => {
        const prompt = buildAnnotateEditPrompt({
            annotationCount: 2,
            exportWidth: 800,
            exportHeight: 600,
            notes: [
                { label: 1, shape: "region", note: "改成金属材质" },
                { label: 2, shape: "arrow", note: "把这里替换成蓝色" },
            ],
        });
        expect(prompt).toContain("标注 1（矩形选框）：改成金属材质");
        expect(prompt).toContain("标注 2（箭头指向）：把这里替换成蓝色");
        // 序号顺序保持（1 在 2 之前）
        expect(prompt.indexOf("标注 1")).toBeLessThan(prompt.indexOf("标注 2"));
    });

    test("note 前后空白被裁剪（提交前弹窗已 trim，此处为二次防线）", () => {
        const prompt = buildAnnotateEditPrompt({
            annotationCount: 1,
            exportWidth: 100,
            exportHeight: 100,
            notes: [{ label: 1, shape: "region", note: "  改成红色  " }],
        });
        expect(prompt).toContain("标注 1（矩形选框）：改成红色");
        expect(prompt).not.toContain("：   改成红色");
    });

    test("★ 空 note 被过滤（不产出空行；全空时不加该段）", () => {
        const prompt = buildAnnotateEditPrompt({
            annotationCount: 2,
            exportWidth: 100,
            exportHeight: 100,
            notes: [
                { label: 1, shape: "region", note: "  " },
                { label: 2, shape: "region", note: "" },
            ],
        });
        expect(prompt).not.toContain("各标注的修改要求");
        expect(prompt).not.toContain("标注 1");
    });

    test("★ 未传 notes（画笔模式）不产出该段，原有语义不受影响", () => {
        const prompt = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 1024, exportHeight: 1024, actionHint: "modify" });
        expect(prompt).not.toContain("各标注的修改要求");
        // 既有五条语义骨架仍在
        expect(prompt).toContain("请根据标注修改图片");
        expect(prompt).toContain("第一张图是原图");
        expect(prompt).toContain("把标注文字当作修改要求");
        expect(prompt).toContain("不要把标注箭头、标注文字、选框或其他标注痕迹带进最终图片");
        expect(prompt).toContain("只修改被标注的区域");
    });

    test("★ 元数据行仍在末尾（note 段落插在意图行与元数据行之间，不破坏 Cowart 行）", () => {
        const prompt = buildAnnotateEditPrompt({
            annotationCount: 1,
            exportWidth: 1024,
            exportHeight: 1024,
            notes: [{ label: 1, shape: "region", note: "改成蓝色" }],
        });
        const lines = prompt.split("\n");
        const noteIdx = lines.findIndex((line) => line.includes("各标注的修改要求"));
        const metaIdx = lines.findIndex((line) => line.includes("Included annotation shapes:"));
        const sizeIdx = lines.findIndex((line) => line.includes("Screenshot size:"));
        expect(noteIdx).toBeGreaterThan(0);
        expect(metaIdx).toBeGreaterThan(noteIdx);
        expect(sizeIdx).toBeGreaterThan(metaIdx);
    });
});

describe("★ 通道 b：提交 payload 结构贯通（结构断言）", () => {
    test("★ buildAnnotateEditSubmission 把 annotations 的 note 带进 prompt", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "modify",
            annotationCount: 1,
            strokeCount: 0,
            exportWidth: 1024,
            exportHeight: 1024,
            annotations: [region("移除杯子的把手")],
        });
        // ★ 缺陷本体：修前 submission.prompt 不含用户文字
        expect(submission.prompt).toContain("移除杯子的把手");
        expect(submission.prompt).toContain("标注 1（矩形选框）：移除杯子的把手");
    });

    test("★ 多标注序号与数组顺序一致（label = index + 1）", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "modify",
            annotationCount: 2,
            strokeCount: 0,
            exportWidth: 500,
            exportHeight: 500,
            annotations: [region("第一条要求", 0), arrow("第二条要求", 1)],
        });
        expect(submission.prompt).toContain("标注 1（矩形选框）：第一条要求");
        expect(submission.prompt).toContain("标注 2（箭头指向）：第二条要求");
    });

    test("★ 画笔模式（annotations 缺省/空）：prompt 不含标注要求段，笔数元数据不受影响", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "modify",
            annotationCount: 0,
            strokeCount: 3,
            exportWidth: 1024,
            exportHeight: 1024,
        });
        expect(submission.prompt).not.toContain("各标注的修改要求");
        expect(submission.prompt).toContain("Included annotation shapes: 3");
    });

    test("★ 两图协议与元数据不受本修复影响（回归锚点）", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "replace",
            annotationCount: 1,
            strokeCount: 0,
            exportWidth: 100,
            exportHeight: 100,
            annotations: [region("改成金色")],
        });
        expect(submission.referenceImages).toHaveLength(2);
        expect(submission.referenceImages[1].dataUrl).toBe("data:image/png;base64,annotated");
        expect(submission.metadata).toEqual({
            sourceNodeId: "node-1",
            edit: "annotation",
            annotateEdit: { actionHint: "replace", annotationCount: 1, strokeCount: 0, exportWidth: 100, exportHeight: 100 },
        });
    });

    test("★ 蒙版降级路线语义不变（该路线本就使用 note）", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "modify",
            annotationCount: 1,
            strokeCount: 0,
            exportWidth: 100,
            exportHeight: 100,
            annotations: [region("改成磨砂黑")],
        });
        expect(submission.prompt).toContain("改成磨砂黑");
    });
});

describe("★ 通道 a：截图渲染 note（源码级可达性 + 共享单源纪律）", () => {
    test("★ 导出合成调用共享绘制函数（所见即模型所见）", async () => {
        const exportSource = await Bun.file(new URL("../src/lib/canvas/annotate-edit-export.ts", import.meta.url)).text();
        // shape 模式的导出必须走 drawAnnotationShape（note 由它内部渲染）
        expect(exportSource).toContain("drawAnnotationShape");
        // 不得自己内联画文字（防两套画法漂移）
        expect(exportSource).not.toContain("fillText");
    });

    test("★ 弹窗预览与导出共用同一绘制入口", async () => {
        const dialogSource = await Bun.file(new URL("../src/components/canvas/canvas-node-annotate-edit-dialog.tsx", import.meta.url)).text();
        expect(dialogSource).toContain("drawAnnotationShape");
        expect(dialogSource).not.toContain("fillText");
    });

    test("★ 渲染模块导出 note 绘制函数（供真机验证点调用）", async () => {
        const renderSource = await Bun.file(new URL("../src/lib/canvas/annotate-edit-render.ts", import.meta.url)).text();
        expect(renderSource).toContain("export function drawAnnotationNote");
        // 可读性底线：字号随图宽缩放 + 高对比底标
        expect(renderSource).toContain("noteFontSize");
        expect(renderSource).toContain("annotateNoteBackgroundColor");
    });

    test("★ drawAnnotationShape 在两种形状上都调用 note 渲染（不是只做矩形）", async () => {
        const renderSource = await Bun.file(new URL("../src/lib/canvas/annotate-edit-render.ts", import.meta.url)).text();
        const shapeBody = renderSource.slice(renderSource.indexOf("export function drawAnnotationShape"), renderSource.indexOf("export function drawAnnotationNote"));
        const noteCalls = shapeBody.match(/drawAnnotationNote\(/g) ?? [];
        expect(noteCalls.length).toBe(2);
    });
});
