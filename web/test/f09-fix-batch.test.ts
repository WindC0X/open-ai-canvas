import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { CAPABILITY_ENTRIES, capabilityContextSatisfied, findCapabilityEntry } from "../src/lib/canvas/capability-entries";
import { CANVAS_TEMPLATES, CLONE_RECREATE_TEMPLATE, resolveTemplateImageSlots } from "../src/lib/canvas/canvas-clone-template";
import { DEFAULT_CLONE_RECREATE_PARAMS } from "../src/lib/canvas/clone-recreate-params";
import { dispatchConfigGenerateAction, resolveConfigGenerateAction, type ConfigGenerateTarget } from "../src/lib/canvas/clone-recreate-submission";
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

    // ★ 控制线 2026-10-06 判定：原「谓词与入口同源」测试（expect(rendered).toBe(predicate)）
    //   是【同函数同入参 ⇒ 恒真】，无捕获能力（谓词改 5 仍绿）。已删除。
    //   等价但有效的覆盖在 f09-clone-recreate-entry.test.ts:44/49/54（硬编码期望，
    //   与实现解耦），本处不重复（V1）。
});

describe("修复批 B-2 / B2-1：handler 有真实消费方（行为断言，非源码文本）", () => {
    /**
     * ★ 评审线 2026-10-06 的核心教训：
     *   上一轮用 `expect(source).toContain(...)` 断言接线，**文本断言只能捕获「删除」，
     *   不能捕获「语义失效」**。评审线三注入实验为证：
     *     · 注入「if (cloneParams && false) {」      ⇒ 1 red（子串不匹配，仍属文本层）
     *     · 注入「分支内改走 handleGenerateNode」    ⇒ 1 red（文本不匹配）
     *     · 注入「handler 内部首行早退（文本全保留）」⇒ ★ 10 pass / 0 fail
     *   ⇒ 因此本组改为【行为断言】：直接测纯函数 resolveConfigGenerateAction 的返回值。
     */
    test("★ 行为：带 cloneRecreateParams 的节点 ⇒ 判据为 clone-recreate（含参数）", () => {
        const action = resolveConfigGenerateAction({
            metadata: { cloneRecreateParams: DEFAULT_CLONE_RECREATE_PARAMS },
        });
        expect(action.kind).toBe("clone-recreate");
        expect(action.kind === "clone-recreate" && action.params).toEqual(DEFAULT_CLONE_RECREATE_PARAMS);
    });

    test("★ 行为：无该字段的节点 ⇒ 判据为 generic（其他 Config 节点零影响）", () => {
        expect(resolveConfigGenerateAction({ metadata: {} }).kind).toBe("generic");
        expect(resolveConfigGenerateAction({ metadata: { workflowProvider: "runninghub" } }).kind).toBe("generic");
        expect(resolveConfigGenerateAction(undefined).kind).toBe("generic");
        expect(resolveConfigGenerateAction(null).kind).toBe("generic");
    });

    test("★ 行为：参数值原样透传（不被判据改写）", () => {
        const params = { ...DEFAULT_CLONE_RECREATE_PARAMS, cloneDegree: "style-reference" as const, copyMode: "exact-copy" as const };
        const action = resolveConfigGenerateAction({ metadata: { cloneRecreateParams: params } });
        expect(action.kind === "clone-recreate" && action.params.cloneDegree).toBe("style-reference");
        expect(action.kind === "clone-recreate" && action.params.copyMode).toBe("exact-copy");
    });

    test("★★ 行为：dispatchConfigGenerateAction 真的调用对应 handler（spy 断言）", () => {
        // ★ 这是评审线注入实验「handler 首行早退 ⇒ 全绿」的正面覆盖：
        //   分支逻辑搬进纯函数后，用 spy handler 直接断言【哪个被调用】，
        //   不依赖任何源码文本 ⇒ 语义失效必红。
        const withParams: ConfigGenerateTarget = { id: "n1", metadata: { cloneRecreateParams: DEFAULT_CLONE_RECREATE_PARAMS } };
        const calls: string[] = [];
        const kind1 = dispatchConfigGenerateAction(withParams, "image", "p", {
            onCloneRecreate: (node, params) => calls.push(`clone:${node.id}:${params.copyMode}`),
            onGenericGenerate: (id, mode) => calls.push(`generic:${id}:${mode}`),
        });
        expect(kind1).toBe("clone-recreate");
        expect(calls).toEqual(["clone:n1:no-copy"]);

        // 无参数节点 ⇒ 走通用链，且【不】调用 clone handler
        const calls2: string[] = [];
        const kind2 = dispatchConfigGenerateAction({ id: "n2", metadata: {} }, "video", "q", {
            onCloneRecreate: (node) => calls2.push(`clone:${node.id}`),
            onGenericGenerate: (id, mode, prompt) => calls2.push(`generic:${id}:${mode}:${prompt}`),
        });
        expect(kind2).toBe("generic");
        expect(calls2).toEqual(["generic:n2:video:q"]);
    });

    test("★★ 行为：node 为空时不得调用 clone handler（防御）", () => {
        const calls: string[] = [];
        const kind = dispatchConfigGenerateAction(null, "image", "p", {
            onCloneRecreate: () => calls.push("clone"),
            onGenericGenerate: () => calls.push("generic"),
        });
        expect(kind).toBe("generic");
        expect(calls).toEqual(["generic"]);
    });

    test("★ 接线：Config 的【真实入口】与通用面板都调用同一派发入口（防分叉）", () => {
        // 接线存在性检查（语义已由上面的行为断言覆盖）：
        // ① 定义存在
        expect(SOURCES.project).toContain("const dispatchConfigGenerate = useCallback(");
        // ② 恰好 2 个调用点（Config 真实入口 + 通用面板），防未来分叉出第三处
        const callSites = SOURCES.project.match(/^\s+dispatchConfigGenerate\(nodeId/gm) ?? [];
        expect(callSites.length).toBe(2);
        // ③ ★ 关键：Config 真实入口（CanvasConfigNodePanel 块）内必须有调用点 ——
        //    这正是上一轮挂错的地方（挂在 CanvasNodePromptPanel 上，Config 永不渲染）。
        // ★ 剥离注释后再定位（V9 ① 注释免疫：本文件/源码的修复注释会引用
        //   "dispatchConfigGenerate" 等字样，不剥离会误命中注释而非真实代码）。
        const projectCode = SOURCES.project
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
        // ★ N-3 修正（控制线/评审线 2026-10-06 第二轮）：
        //   原先用固定窗口 slice(index, index + 1200)，实测距离 646 字符（余量仅 554）。
        //   评审线复现：在 Config 块内插入 8 行真实代码（~700 字符）⇒ 距离 1346 > 1200
        //   ⇒ 测试红，但接线完全正确 ⇒ ★ 假阳性（代码增长后误报）。
        //   修法 A：取到【JSX 块闭合】而非固定窗口 —— 与代码长度解耦。
        const configPanelIndex = projectCode.indexOf("<CanvasConfigNodePanel");
        expect(configPanelIndex).toBeGreaterThan(-1);
        // 从块首扫描到该 JSX 元素的闭合（用括号深度配对，从 onGenerate={ 的 { 开始计深度）
        const scanFrom = projectCode.indexOf("onGenerate={", configPanelIndex);
        expect(scanFrom).toBeGreaterThan(-1);
        let depth = 0;
        let end = -1;
        for (let index = projectCode.indexOf("{", scanFrom); index < projectCode.length; index += 1) {
            const char = projectCode[index];
            if (char === "{") depth += 1;
            else if (char === "}") {
                depth -= 1;
                if (depth === 0) { end = index; break; }
            }
        }
        expect(end).toBeGreaterThan(scanFrom);
        const configPanelBlock = projectCode.slice(configPanelIndex, end + 1);
        expect(configPanelBlock).toContain("dispatchConfigGenerate(nodeId,");
        // ★ 附带价值：本断言现在与【代码长度无关】，只在「调用点不在该块内」时红
        //   （例如被移到另一个组件或删掉）。
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

describe("修复批 N3-1 / N-3：图片槽位填充（★ 行为断言，非源码文本）", () => {
    // ★ 控制线 2026-10-06 实测：原文本断言在「保留文本、语义失效」注入下
    //   （`imageSourceIds.length = 0;`）⇒ 14 pass / 0 fail，无捕获能力。
    //   改为直接断言纯函数 resolveTemplateImageSlots 的返回值。
    type FakeNode = { id: string; type: string; metadata?: { content?: string; storageKey?: string } };
    const findIn = (list: FakeNode[]) => (id: string) => list.find((node) => node.id === id);
    const SLOTS = [{ id: "slot-product" }, { id: "slot-layout" }];

    test("★ 行为：文本节点排在前面时【不得】占据产品图槽位（N3-1 核心）", () => {
        const nodes: FakeNode[] = [
            { id: "text-1", type: "Text", metadata: { content: "一段文案" } },
            { id: "img-1", type: "Image", metadata: { content: "product-data" } },
            { id: "img-2", type: "Image", metadata: { content: "layout-data" } },
        ];
        const filled = resolveTemplateImageSlots(SLOTS, ["text-1", "img-1", "img-2"], findIn(nodes), "Image");
        // 产品图槽位必须是 img-1（不是 text-1），版式槽位是 img-2
        expect(filled.get("slot-product")?.id).toBe("img-1");
        expect(filled.get("slot-layout")?.id).toBe("img-2");
        expect(filled.size).toBe(2);
    });

    test("★ 行为：全部为非图片节点 ⇒ 零填充（不误填）", () => {
        const nodes: FakeNode[] = [{ id: "text-1", type: "Text", metadata: { content: "a" } }];
        const filled = resolveTemplateImageSlots(SLOTS, ["text-1"], findIn(nodes), "Image");
        expect(filled.size).toBe(0);
    });

    test("★ 行为：只填有内容的源，且【位置配对不压缩】（空占位不顶替后位）", () => {
        const nodes: FakeNode[] = [
            { id: "img-empty", type: "Image", metadata: {} },
            { id: "img-ok", type: "Image", metadata: { storageKey: "k" } },
        ];
        const filled = resolveTemplateImageSlots(SLOTS, ["img-empty", "img-ok"], findIn(nodes), "Image");
        // ★ 语义判定（A线 2026-10-06，测试初版假设错误已修正）：
        //   模板契约是「位置即角色」—— 第 0 位 = 产品图槽位，第 1 位 = 版式参考槽位。
        //   空源（无 content/storageKey）⇒ 该槽位【保持空】，不把后面的源【压缩】上来。
        //   为什么不能压缩：压缩会把版式参考图静默提升为产品图（错位，且后端按位置编号
        //   无法察觉）。保持空则模板占位可见，用户能看到「产品图未填」。
        expect(filled.size).toBe(1);
        expect(filled.has("slot-product")).toBe(false);
        expect(filled.get("slot-layout")?.id).toBe("img-ok");
    });

    test("★ 行为：按位置配对（产品图槽位在前）", () => {
        const nodes: FakeNode[] = [
            { id: "img-a", type: "Image", metadata: { content: "A" } },
            { id: "img-b", type: "Image", metadata: { content: "B" } },
        ];
        const filled = resolveTemplateImageSlots(SLOTS, ["img-a", "img-b"], findIn(nodes), "Image");
        expect(filled.get("slot-product")?.id).toBe("img-a");
        expect(filled.get("slot-layout")?.id).toBe("img-b");
    });

    test("★ 行为：sourceImageIds 为空 ⇒ 零填充（不抛错）", () => {
        expect(resolveTemplateImageSlots(SLOTS, undefined, () => undefined, "Image").size).toBe(0);
        expect(resolveTemplateImageSlots(SLOTS, [], () => undefined, "Image").size).toBe(0);
    });

    test("★ 接线：instantiateTemplate 委托给该纯函数（不再是内联逻辑）", () => {
        expect(SOURCES.templateCards).toContain("resolveTemplateImageSlots(");
        expect(SOURCES.templateCards).not.toContain("const sourceId = sourceImageIds?.[index];");
    });
});

describe("修复批 N-3：选区入口填入选中的图", () => {
    // ★ 填充语义已由 N3-1 组的行为断言覆盖（resolveTemplateImageSlots）。
    //   本组只保留【调用方确实传了选中 id】这一条接线检查 —— 它不是文本断言
    //   冒充行为验证，而是「参数确实来自选区」的调用面证据（V1 不重复覆盖语义）。
    test("★ 接线：选区入口把选中的节点 id 传给 instantiateTemplate", () => {
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
    // ★ 控制线 2026-10-06 第二轮：渲染语义已由【真实渲染断言】覆盖
    //   （f09-guided-template-cards-render.test.tsx，renderToStaticMarkup）。
    //   本组只保留【渲染点接线】检查：guided 分支确实把 templateCards 传下去了。
    //   这不是文本断言冒充行为验证 —— 行为在渲染测试里，这里只证明「传参没漏」。
    test("★ 接线：project.tsx 的 guided 分支把 templateCards 传给 CanvasShortDramaEmptyState", () => {
        const projectCode = SOURCES.project
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
        const guidedIndex = projectCode.indexOf('emptyStateKind === "guided"');
        expect(guidedIndex).toBeGreaterThan(-1);
        const guidedBlock = projectCode.slice(guidedIndex, guidedIndex + 600);
        expect(guidedBlock).toContain("<CanvasShortDramaEmptyState");
        expect(guidedBlock).toContain("templateCards={templateCards}");
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
