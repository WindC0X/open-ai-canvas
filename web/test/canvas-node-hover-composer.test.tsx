import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasNodeHoverComposer, referenceThumbSrc } from "@/components/canvas/canvas-node-hover-composer";
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

describe("referenceThumbSrc", () => {
    test("文本引用不返回 URL(空 src 必裂图)", () => {
        expect(referenceThumbSrc(reference({ kind: "text", previewUrl: "data:image/png;base64,AAA" }))).toBe("");
    });

    test("音频/技能引用不返回 URL", () => {
        expect(referenceThumbSrc(reference({ kind: "audio" }))).toBe("");
        expect(referenceThumbSrc(reference({ kind: "skill" }))).toBe("");
    });

    test("图片引用返回 previewUrl", () => {
        expect(referenceThumbSrc(reference({ kind: "image", previewUrl: "blob:img" }))).toBe("blob:img");
    });

    test("视频引用不得回退到 mediaUrl(视频文件 URL 进 img 必裂图)", () => {
        expect(referenceThumbSrc(reference({ kind: "video", mediaUrl: "https://cdn.example.com/a.mp4" }))).toBe("");
    });

    test("角色引用无封面时不产生空 src", () => {
        expect(referenceThumbSrc(reference({ kind: "character" }))).toBe("");
    });
});

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
});
