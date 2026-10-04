import { expect, test, describe } from "bun:test";

import { buildAnnotateEditSubmission } from "@/lib/canvas/annotate-edit-submission";
import type { ReferenceImage } from "@/types/image";

/**
 * F-08 圈选改图 —— 提交构造单测（C2 执行链换引擎）。
 *
 * 结构断言纪律（O-03 教训 2026-10-03）：断言落在**函数的实际返回值**上，
 * 不用源码 includes 字符串断言验证行为。
 */

function sourceReference(): ReferenceImage {
    return { id: "node-1", name: "reference-node-1.png", type: "image/png", dataUrl: "data:image/png;base64,source", storageKey: "sk-source" };
}

describe("★ 提交构造（buildAnnotateEditSubmission，结构断言）", () => {
    test("两图协议：[原图, 标注图]，顺序不可颠倒", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "modify",
            annotationCount: 2,
            strokeCount: 0,
            exportWidth: 1200,
            exportHeight: 900,
        });
        expect(submission.referenceImages).toHaveLength(2);
        expect(submission.referenceImages[0].id).toBe("node-1");
        expect(submission.referenceImages[0].dataUrl).toBe("data:image/png;base64,source");
        expect(submission.referenceImages[1].id).toBe("node-1-annotation");
        expect(submission.referenceImages[1].dataUrl).toBe("data:image/png;base64,annotated");
    });

    test("★ 提示词贯通：含不烙图纪律 + 意图行 + 元数据行", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "remove",
            annotationCount: 3,
            strokeCount: 0,
            exportWidth: 800,
            exportHeight: 600,
        });
        expect(submission.prompt).toContain("不要把标注箭头、标注文字、选框或其他标注痕迹带进最终图片");
        expect(submission.prompt).toContain("移除被标注区域的内容");
        expect(submission.prompt).toContain("Included annotation shapes: 3");
        expect(submission.prompt).toContain("Screenshot size: 800x600");
    });

    test("★ 画笔模式：标注数取笔数（annotationCount=0 时回退 strokeCount）", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "modify",
            annotationCount: 0,
            strokeCount: 4,
            exportWidth: 640,
            exportHeight: 480,
        });
        expect(submission.prompt).toContain("Included annotation shapes: 4");
        expect(submission.metadata.annotateEdit.strokeCount).toBe(4);
        expect(submission.metadata.annotateEdit.annotationCount).toBe(0);
    });

    test("元数据结构：edit=annotation + annotateEdit 明细（供任务链追溯）", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "node-1",
            source: sourceReference(),
            annotatedDataUrl: "data:image/png;base64,annotated",
            actionHint: "replace",
            annotationCount: 1,
            strokeCount: 0,
            exportWidth: 100,
            exportHeight: 100,
        });
        expect(submission.metadata).toEqual({
            sourceNodeId: "node-1",
            edit: "annotation",
            annotateEdit: { actionHint: "replace", annotationCount: 1, strokeCount: 0, exportWidth: 100, exportHeight: 100 },
        });
    });
});
