import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const source = readFileSync(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");

describe("image angle editor (#432)", () => {
    test("uses a centered dismissible modal instead of a node-anchored overlay", () => {
        const dialog = source.slice(source.indexOf("{angleNode?.metadata?.content"), source.indexOf("{emotionNode?.metadata?.content"));
        expect(dialog).toContain("<AppModal");
        expect(dialog).toContain("centered");
        expect(dialog).toContain("onCancel={() => setAngleNodeId(null)}");
        expect(dialog).toContain("onClose={() => setAngleNodeId(null)}");
        // AppModal 封装默认 destroyOnHidden=true(app-modal.tsx:15), 字面 prop 不再出现在调用点。
        const appModal = readFileSync(new URL("../src/components/ui/product/app-modal/app-modal.tsx", import.meta.url), "utf8");
        expect(appModal).toContain("destroyOnHidden = true");
        expect(dialog).not.toContain("CanvasNodePanelOverlay");
        expect(dialog).not.toContain("isCanvasNodeMoving");
5c790071 (test(web): rebase 后测试契约对齐 - 文本节点单击真toggle断言/角度弹窗AppModal封装断言(destroyOnHidden默认值))
        expect(dialog).toContain("generateAngleNode(angleNode, params)");
        expect(dialog).not.toContain("<Modal");
        expect(dialog).not.toContain("AppModal");
        expect(dialog).not.toContain("destroyOnHidden");
    });
});
