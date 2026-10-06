import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { CAPABILITY_ENTRIES, capabilityContextSatisfied, findCapabilityEntry } from "../src/lib/canvas/capability-entries";
import { CANVAS_TEMPLATES, CLONE_RECREATE_TEMPLATE } from "../src/lib/canvas/canvas-clone-template";
import { DEFAULT_CLONE_RECREATE_PARAMS } from "../src/lib/canvas/clone-recreate-params";
import { defaultToolbarPrefs, resolveToolbarEntries, type ToolContext, type ToolbarHandlers } from "../src/lib/canvas/tool-registry";
import { CanvasNodeType } from "../src/types/canvas";

/**
 * F-09 三期修复批 —— B-1/B-2 + 新-1~新-3 + N-1/N-3/N-4 的接线与一致性断言。
 *
 * ★ 本文件的核心价值是【接线证明】：断言「入口/派发真的消费了能力层/执行链」，
 *   而不是「两边各自算对了」（后者是两份真值，改一处不影响另一处）。
 */

const SOURCES = {
    selectionTools: readFileSync(new URL("../src/lib/canvas/tool-registry/definitions/selection-toolbar-tools.tsx", import.meta.url), "utf8"),
    project: readFileSync(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8"),
    templateCards: readFileSync(new URL("../src/pages/canvas/use-canvas-template-cards.ts", import.meta.url), "utf8"),
    shortDramaEntry: readFileSync(new URL("../src/components/canvas/canvas-short-drama-entry.tsx", import.meta.url), "utf8"),
};

function toolContext(imageCount: number): ToolContext {
    return {
        selectedCount: imageCount,
        selectedNodeTypes: new Set([CanvasNodeType.Image]),
        selectedVideoCount: 0,
        selectedImageCount: imageCount,
        canvasTool: "move",
        workspaceMode: "professional",
        isProjectLinked: false,
        canUndo: false,
        canRedo: false,
        extractingVideoFrames: false,
        extractingAudio: false,
        trimmingVideo: false,
        mergingVideos: false,
        addPanelOpen: false,
        appearancePanelOpen: false,
        settingsPanelOpen: false,
        handlers: {} as ToolbarHandlers,
    };
}

describe("修复批 B-1：入口消费能力层谓词（单一真值）", () => {
    test("★ 入口 applicable 经由谓词函数（不是内联比较）", () => {
        // 接线证据：源码里 applicable 调用 cloneRecreateContextSatisfied
        expect(SOURCES.selectionTools).toContain("applicable: (ctx) => cloneRecreateContextSatisfied(ctx.selectedImageCount)");
        // 且该函数体调用能力层谓词
        expect(SOURCES.selectionTools).toContain("capabilityContextSatisfied(entry, { imageCount: selectedImageCount, hasSelection: true })");
        // 反证：不应再出现内联比较。
        // ★ V9 ①（注释免疫）：直接 not.toContain 会被【注释里引用的旧代码】满足 ——
        //   本文件的修复注释恰好引用了 `selectedImageCount === 2`。
        //   因此先剥离注释再断言（剥离对象：行注释 + 块注释）。
        const withoutComments = SOURCES.selectionTools
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
        expect(withoutComments).not.toContain("selectedImageCount === 2");
    });

    test("★ 行为：谓词与入口同源（改谓词 ⇒ 入口结果变）", () => {
        const entry = findCapabilityEntry("image.cloneRecreate")!;
        for (const count of [1, 2, 3]) {
            const predicate = capabilityContextSatisfied(entry, { imageCount: count, hasSelection: true });
            const rendered = resolveToolbarEntries("selection", toolContext(count), defaultToolbarPrefs("selection"))
                .some((item) => item.id === "selection-clone-recreate");
            expect(rendered).toBe(predicate);
        }
    });
});

describe("修复批 B-2：handler 有真实消费方", () => {
    test("★ project.tsx 解构并调用 createCloneRecreateNode", () => {
        expect(SOURCES.project).toContain("createCloneRecreateNode,");
        expect(SOURCES.project).toContain("createCloneRecreateNode(targetNode, cloneParams)");
    });

    test("★ 派发判据是节点 metadata.cloneRecreateParams（只有模板产出的节点走专属链）", () => {
        expect(SOURCES.project).toContain("const cloneParams = targetNode?.metadata?.cloneRecreateParams;");
        expect(SOURCES.project).toContain("if (cloneParams) {");
    });
});

describe("修复批 新-1/新-2：entryPoints 登记真实入口", () => {
    test("★ 两个入口都登记，且 target 各自指向真实 id", () => {
        const entry = findCapabilityEntry("image.cloneRecreate")!;
        const kinds = entry.entryPoints.map((point) => point.kind);
        expect(kinds).toContain("create-card");
        expect(kinds).toContain("selection-toolbar");
        // create-card 的 target 是模板 id
        const cardPoint = entry.entryPoints.find((point) => point.kind === "create-card")!;
        expect(CANVAS_TEMPLATES.map((template) => template.id)).toContain(cardPoint.target);
        // selection-toolbar 的 target 是真实 tool id
        const selectionPoint = entry.entryPoints.find((point) => point.kind === "selection-toolbar")!;
        expect(selectionPoint.target).toBe("selection-clone-recreate");
        expect(SOURCES.selectionTools).toContain(`id: "${selectionPoint.target}"`);
    });
});

describe("修复批 N-3：选区入口填入选中的图", () => {
    test("★ instantiateTemplate 接收 sourceImageIds 并填入图片槽位", () => {
        expect(SOURCES.templateCards).toContain("instantiateTemplate = useCallback((templateId: string, sourceImageIds?: string[])");
        expect(SOURCES.templateCards).toContain("imageSlots.forEach((slot, index) => {");
        expect(SOURCES.project).toContain('instantiateTemplate("clone-recreate", Array.from(selectedNodeIds))');
    });
});

describe("修复批 N-4：默认 copyMode 对齐调研裁决", () => {
    test("★ 默认 copyMode = no-copy（F-09-IMPLEMENTATION-PLAN.md:468）", () => {
        expect(DEFAULT_CLONE_RECREATE_PARAMS.copyMode).toBe("no-copy");
        expect(CLONE_RECREATE_TEMPLATE.nodes.find((node) => node.type === CanvasNodeType.Config)!.metadata.cloneRecreateParams!.copyMode).toBe("no-copy");
    });
});

describe("修复批 □5-2：模板卡在 guided 态可达", () => {
    test("★ guided 态组件接受 templateCards 并渲染独立区域", () => {
        expect(SOURCES.shortDramaEntry).toContain("templateCards?: { id: string; title: string; hint: string; onPick: () => void }[];");
        expect(SOURCES.shortDramaEntry).toContain("或从现成模板开始");
    });

    test("★ project.tsx 的 guided 态传入 templateCards", () => {
        expect(SOURCES.project).toContain("<CanvasShortDramaEmptyState\n            templateCards={templateCards}");
    });
});

describe("修复批 N-1：守卫覆盖 create-card", () => {
    test("★ 能力条目的 entryPoints 使用的 kind 都在守卫覆盖范围内", () => {
        const guarded = ["node-toolbar", "selection-toolbar", "main-toolbar", "create-card"];
        for (const entry of CAPABILITY_ENTRIES) {
            for (const point of entry.entryPoints) {
                expect(guarded).toContain(point.kind);
            }
        }
    });
});
