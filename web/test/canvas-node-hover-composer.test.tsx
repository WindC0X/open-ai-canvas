import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasNodeHoverComposer } from "@/components/canvas/canvas-node-hover-composer";
import type { CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import { canvasThemes } from "@/lib/canvas-theme";

function reference(partial: Partial<CanvasResourceReference>): CanvasResourceReference {
    return {
        id: "ref-1",
        nodeId: "node-1",
        kind: "image",
        label: "图片1",
        title: "图片1",
        active: false,
        category: "other",
        ...partial,
    };
}

describe("CanvasNodeHoverComposer 渲染(静态标记)", () => {
    function html(visible: boolean, references: CanvasResourceReference[] = [], prompt: string = "提示词") {
        return renderToStaticMarkup(
            <CanvasNodeHoverComposer prompt={prompt} references={references} theme={canvasThemes.dark} visible={visible} />,
        );
    }

    test("隐藏态不渲染引用缩略 img(避免隐藏层触发图片加载)", () => {
        const markup = html(false, [reference({ kind: "image", previewUrl: "blob:img" })]);
        expect(markup).not.toContain("<img");
        expect(markup).toContain('data-node-hover-composer="hidden"');
        expect(markup).toContain('aria-hidden="true"');
    });

    test("可见态渲染引用缩略与提示词且不标 aria-hidden", () => {
        const markup = html(true, [reference({ kind: "image", previewUrl: "blob:img" })]);
        expect(markup).toContain("<img");
        expect(markup).toContain('data-node-hover-composer="visible"');
        expect(markup).not.toContain("aria-hidden");
        expect(markup).toContain("提示词");
    });

    test("视频引用无预览时走图标块而非视频 URL", () => {
        const markup = html(true, [reference({ kind: "video", mediaUrl: "https://cdn.example.com/a.mp4" })]);
        expect(markup).not.toContain("<img");
        expect(markup).not.toContain(".mp4");
    });

    test("无内容时不显示(visible 但零信息)", () => {
        expect(html(true, [], "  ")).toContain('data-node-hover-composer="hidden"');
    });

    test("缩略源语义: 图片进 img, 文本/无封面角色走图标块", () => {
        expect(html(true, [reference({ kind: "image", previewUrl: "blob:img" })])).toContain('src="blob:img"');
        expect(html(true, [reference({ kind: "text", previewUrl: "data:text/plain,hi" })])).not.toContain("<img");
        expect(html(true, [reference({ kind: "character" })])).not.toContain("<img");
    });

    test("技能引用：✦ 符号 + Skill 副标（控制线域外授权修复：不再落 T/Image 缺省）", () => {
        const markup = html(true, [reference({ kind: "skill", label: "商品图直出" })]);
        expect(markup).toContain("✦");
        expect(markup).toContain(">Skill<");
        expect(markup).not.toContain("<img");
    });

    test("工具引用：⚙ 符号 + Tool 副标（2026-09-28 rider：不再落 T/Image 缺省）", () => {
        const markup = html(true, [reference({ kind: "tool", label: "九宫格切分" })]);
        expect(markup).toContain("⚙");
        expect(markup).toContain(">Tool<");
        expect(markup).not.toContain("<img");
    });

    test("引用行容器挂 mask 类(左右渐隐按类名锚定, 不随 JSX 层级漂移)", () => {
        expect(html(true, [reference({ kind: "image", previewUrl: "blob:img" })])).toContain("canvas-node-hover-composer-refs-mask");
    });
});

describe("控制线域外授权 2026-09-28 · 技能 chip 修复守卫", () => {
    test("注入面收窄：节点引用表不再混入技能引用；tool 注入保留、@ 候选面不动", () => {
        const source = readFileSync(new URL("../src/pages/canvas/use-canvas-render-model.ts", import.meta.url), "utf8");
        const startIdx = source.indexOf("const mentionReferencesByNodeId = useMemo");
        expect(startIdx).toBeGreaterThan(-1);
        const block = source.slice(startIdx, source.indexOf("return {", startIdx));
        expect(block).not.toContain("skillMentionReferences");
        expect(block).toContain("toolMentionReferencesByNodeId");

        const agentPanel = readFileSync(new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url), "utf8");
        expect(agentPanel).toContain("buildSkillMentionReferences(installedSkills)");
    });

    test("hover composer 源级技能分支守卫（✦ / Skill）", () => {
        const source = readFileSync(new URL("../src/components/canvas/canvas-node-hover-composer.tsx", import.meta.url), "utf8");
        expect(source).toContain('"✦"');
        expect(source).toContain('"Skill"');
    });

    test("hover composer 源级工具分支守卫（⚙ / Tool，2026-09-28 rider 批准）", () => {
        const source = readFileSync(new URL("../src/components/canvas/canvas-node-hover-composer.tsx", import.meta.url), "utf8");
        expect(source).toContain('"⚙"');
        expect(source).toContain('"Tool"');
    });
});
