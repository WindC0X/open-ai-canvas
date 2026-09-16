// @jsxImportSource react
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { CanvasNodeHoverComposer } from "@/components/canvas/canvas-node-hover-composer";

const theme = canvasThemes.dark;
const prompt = "a calm lake at dawn";
const REF: never[] = [];

function renderPanel(nodeHeight?: number) {
    return renderToStaticMarkup(createElement(CanvasNodeHoverComposer, { prompt, references: [], theme, visible: true, nodeHeight }));
}

describe("CanvasNodeHoverComposer 矮节点高度钳制(2026-09-16 Q1)", () => {
    test("高节点保持 flora 基准 184/prompt132", () => {
        const html = renderPanel(1004);
        expect(html).toContain("max-height:132px");
        expect(html).toContain("min-height:116px");
    });

    test("矮节点(216px)预算 97px 全给 prompt(无引用, 不超基准)", () => {
        const html = renderPanel(216);
        expect(html).toContain("max-height:97px");
        expect(html).toContain("min-height:97px");
    });

    test("中矮节点(360px)预算 162 → prompt 钳基准 132", () => {
        const html = renderPanel(360);
        expect(html).toContain("max-height:132px");
    });

    test("有引用行时预算扣 52px: 216px 节点 prompt 区 56px 下限", () => {
        const html = renderToStaticMarkup(createElement(CanvasNodeHoverComposer, { prompt, references: [{ id: "r1", kind: "image", label: "图1", previewUrl: "data:image/png;base64,x" } as never], theme, visible: true, nodeHeight: 216 }));
        expect(html).toContain("max-height:56px");
    });

    test("不传节点高回退基准", () => {
        expect(renderPanel(undefined)).toContain("max-height:132px");
    });
});
