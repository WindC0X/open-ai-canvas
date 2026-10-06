import { describe, expect, test } from "bun:test";

import { buildCloneRecreateSubmission, buildCloneRecreatePrompt } from "../src/lib/canvas/clone-recreate-submission";
import { DEFAULT_CLONE_RECREATE_PARAMS, CLONE_DEGREE_OPTIONS, CLONE_SCOPE_OPTIONS, COPY_MODE_OPTIONS } from "../src/lib/canvas/clone-recreate-params";
import type { ReferenceImage } from "../src/types/image";

/**
 * F-09 三期 §3.1 handler 层：爆款复刻提交构造。
 *
 * ★ 控制线要求（任务书 §五）：
 *   断言真实生产接缝，非镜像实现。只测「谓词返回 true」是谓词自证，
 *   必须测【真实入口消费路径】—— 本组测试覆盖 buildCloneRecreateSubmission
 *   的实际输出（数组顺序 + productImageCount + 元数据），
 *   该输出正是 handler createCloneRecreateNode 提交给后端的载荷。
 */

function image(id: string): ReferenceImage {
    return { id, name: `${id}.png`, type: "image/png", dataUrl: `data:image/png;base64,${id}` };
}

describe("F-09 §3.1 爆款复刻提交构造", () => {
    test("★ 数组顺序契约：产品图在前 N 位、版式参考图在后", () => {
        const submission = buildCloneRecreateSubmission({
            nodeId: "config-1",
            productImages: [image("product-1"), image("product-2")],
            referenceImages: [image("layout-1")],
            params: DEFAULT_CLONE_RECREATE_PARAMS,
        });
        // 数组顺序 = 产品图（2）在前 + 参考图（1）在后
        expect(submission.referenceImages.map((item) => item.id)).toEqual(["product-1", "product-2", "layout-1"]);
        // N = 产品图张数（后端据此编号「图1～2＝产品图组 / 图3＝版式参考图组」）
        expect(submission.productImageCount).toBe(2);
    });

    test("★ 无产品图时 productImageCount = 0（后端注入 emptyText 变体）", () => {
        const submission = buildCloneRecreateSubmission({
            nodeId: "config-1",
            productImages: [],
            referenceImages: [image("layout-1")],
            params: DEFAULT_CLONE_RECREATE_PARAMS,
        });
        expect(submission.productImageCount).toBe(0);
        expect(submission.referenceImages.map((item) => item.id)).toEqual(["layout-1"]);
    });

    test("★ 元数据携带参数选择（供 UI 回显与审计）", () => {
        const params = { cloneDegree: "style-reference" as const, cloneScope: ["composition" as const, "palette" as const], copyMode: "no-copy" as const };
        const submission = buildCloneRecreateSubmission({
            nodeId: "config-1",
            productImages: [image("product-1")],
            referenceImages: [],
            params,
        });
        expect(submission.metadata.cloneRecreateParams).toEqual(params);
        expect(submission.metadata.productImageCount).toBe(1);
        expect(submission.metadata.referenceImageCount).toBe(0);
    });

    test("★ 前端提示词不含六段式正文（合规段由后端注入，防两份真值）", () => {
        const prompt = buildCloneRecreatePrompt(DEFAULT_CLONE_RECREATE_PARAMS, 1, 1);
        // 六段式骨架的关键句必须【不在】前端提示词里 —— 否则与后端注入层形成两份真值（V1）
        expect(prompt).not.toContain("原创与文字安全");
        expect(prompt).not.toContain("不得照搬参考图中的品牌");
        expect(prompt).not.toContain("优先级：用户明确要求与准确文案");
        expect(prompt).not.toContain("主体真实性");
        // 但用户意图与参数要在
        expect(prompt).toContain("复刻");
        expect(prompt).toContain("复刻程度：高度复刻");
    });

    test("提示词反映产品图/参考图数量与参数值", () => {
        const prompt = buildCloneRecreatePrompt({ cloneDegree: "style-reference", cloneScope: ["lighting"], copyMode: "auto-copy" }, 2, 3);
        expect(prompt).toContain("2 张产品图");
        expect(prompt).toContain("版式参考图 3 张");
        expect(prompt).toContain("复刻程度：参考风格");
        expect(prompt).toContain("光线与质感");
        expect(prompt).toContain("文字策略：自动文案");
    });

    test("参数面选项与一手语料取值对齐（3 参数面，6+3+3 选项）", () => {
        expect(CLONE_DEGREE_OPTIONS.map((item) => item.value)).toEqual(["style-reference", "high-structure"]);
        expect(CLONE_SCOPE_OPTIONS.map((item) => item.value)).toEqual(["composition", "palette", "lighting", "typography", "background", "people-models"]);
        expect(COPY_MODE_OPTIONS.map((item) => item.value)).toEqual(["no-copy", "auto-copy", "exact-copy"]);
    });
});
