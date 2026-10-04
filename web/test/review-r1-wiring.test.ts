import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildImageToolbarTools } from "../src/components/canvas/canvas-image-toolbar-tools";
import { filterToolsForGuide, GUIDE_VISIBLE_TOOL_IDS } from "../src/lib/canvas/graduation-tools";
import { defaultToolbarPrefs, getToolbarTools, resolveToolbarTools } from "../src/lib/canvas/tool-registry";
import { nodeHoverToolbarTools } from "../src/lib/canvas/tool-registry/definitions/node-hover-tools";
import { mainToolbarTools } from "../src/lib/canvas/tool-registry/definitions/main-toolbar-tools";
import { buildAnnotateEditSubmission } from "../src/lib/canvas/annotate-edit-submission";
import { badgeCenter } from "../src/lib/canvas/annotate-edit-render";
import { findLinearFlowCard, LINEAR_FLOW_CARDS, resolveLinearFlowConfig, resolveLinearFlowConfigSize, resolveLinearFlowModel, resolveLinearFlowSize } from "../src/lib/canvas/linear-flow-cards";
import { modelCapabilityConfigFor, type ImageCapabilityConfig } from "../src/lib/model-capabilities";
import { createModelChannel, defaultConfig, encodeChannelModel } from "../src/stores/use-config-store";
import type { ToolContext } from "../src/lib/canvas/tool-registry/tool-definition";
import type { ReferenceImage } from "../src/types/image";

/**
 * W5 评审 R1 修复批 —— ★ 接线级断言（B 线）。
 *
 * 覆盖七条 P1（E-1/E-2/B-1/B-2/B-3/D-1/D-2）。
 * 纪律（评审线 R1 §4 测试质量 + 控制线两轮教训）：
 *   · 行为断言 / 渲染断言 / 反例 —— **不得再写纯函数镜像**
 *   · 每条断言落在**实际返回值/渲染结果**上，不落源码文本
 *
 * 评审线证据引用见各 describe 标题。
 */

const webRoot = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(webRoot, relative), "utf8");

/** 图片节点（有内容）。 */
const imageNode = {
    id: "r1-image-node",
    type: "image",
    title: "商品图",
    position: { x: 0, y: 0 },
    width: 320,
    height: 320,
    metadata: { content: "image:test", storageKey: "image:test", status: "success" },
} as unknown as ToolContext["node"];

function ctxFor(workspaceMode: ToolContext["workspaceMode"]): ToolContext {
    return {
        workspaceMode,
        node: imageNode,
        nodeMetadata: imageNode.metadata,
        handlers: {} as ToolContext["handlers"],
    } as ToolContext;
}

// ────────────────────────────────────────────────────────────────────────────
// E-1（评审线 P1）：图片节点工具栏整条旁路 —— guide 态实测 32 项 vs 白名单 6 项
// ────────────────────────────────────────────────────────────────────────────

describe("★ E-1：guide 态图片节点工具栏**实际渲染项数** ≤ 6（评审线 P1）", () => {
    /**
     * 复刻 canvas-node-toolbar 的合并逻辑（registry + imageTools）。
     *
     * ★ 关键：图片层的过滤走**真接缝** `filterToolsForGuide`（与生产代码同一函数），
     * 不是复刻表达式 —— 防评审线 D-4 批评的「测试镜像实现」。
     */
    function renderedToolIds(workspaceMode: ToolContext["workspaceMode"]) {
        const ctx = ctxFor(workspaceMode);
        const registryTools = resolveToolbarTools("node-hover", ctx, null).map((tool) => tool.id);
        const imageTools = buildImageToolbarTools(imageNode, {} as never);
        const merged = [...registryTools, ...filterToolsForGuide(imageTools, workspaceMode).map((tool) => tool.id)];
        return merged;
    }

    test("★ guide 态实际渲染项数 ≤ 6（修复前 = 32）", () => {
        const ids = renderedToolIds("guide");
        expect(ids.length).toBeLessThanOrEqual(6);
        // 每一项都在白名单内（不泄漏高级编辑能力）
        for (const id of ids) expect(GUIDE_VISIBLE_TOOL_IDS).toContain(id);
    });

    test("★ 反例：不过滤时 32 项（证明修复必要性）", () => {
        const unfiltered = renderedToolIds("professional");
        expect(unfiltered.length).toBeGreaterThan(6);
        // 评审线实测数字：registry 2 + imageTools 30 = 32
        const registryCount = resolveToolbarTools("node-hover", ctxFor("guide"), null).length;
        const imageToolCount = buildImageToolbarTools(imageNode, {} as never).length;
        expect(registryCount + imageToolCount).toBe(32);
    });

    test("★ professional 态不受影响（零门控回归）", () => {
        const ids = renderedToolIds("professional");
        // 全量：registry + 全部 30 项图片工具
        const registryCount = resolveToolbarTools("node-hover", ctxFor("professional"), null).length;
        expect(ids.length).toBe(registryCount + 30);
        // 高级编辑能力仍在（证明不是全局裁剪）
        expect(ids).toContain("crop");
        expect(ids).toContain("superResolve");
    });

    test("★ 接线源码：canvas-node-toolbar 的合并路径走真接缝（不是内联复刻）", () => {
        const source = read("src/components/canvas/canvas-node-toolbar.tsx");
        expect(source).toContain("...filterToolsForGuide(imageTools, workspaceMode)");
        // 叶子模块是唯一过滤入口（白名单常量不得在本文件内联使用）
        expect(source).not.toContain("GUIDE_VISIBLE_TOOL_IDS.includes");
    });

    test("★ 接缝自身行为：filterToolsForGuide 三态", () => {
        const tools = [{ id: "download" }, { id: "crop" }, { id: "superResolve" }];
        // guide：只留白名单内
        expect(filterToolsForGuide(tools, "guide").map((t) => t.id)).toEqual(["download"]);
        // professional：原样
        expect(filterToolsForGuide(tools, "professional").map((t) => t.id)).toEqual(["download", "crop", "superResolve"]);
        // simple：原样（黑名单语义在别处，不在此处混）
        expect(filterToolsForGuide(tools, "simple").map((t) => t.id)).toEqual(["download", "crop", "superResolve"]);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// E-2（评审线 P1）：主工具栏被清空 —— guide 态 9→0
// ────────────────────────────────────────────────────────────────────────────

describe("★ E-2：guide 态主工具栏**不被清空**（评审线 P1）", () => {
    test("★ guide 态 main 项数 == professional 态项数（修复前 guide=0）", () => {
        const guideIds = resolveToolbarTools("main", ctxFor("guide"), defaultToolbarPrefs("main")).map((tool) => tool.id);
        const professionalIds = resolveToolbarTools("main", ctxFor("professional"), defaultToolbarPrefs("main")).map((tool) => tool.id);
        expect(guideIds.length).toBe(professionalIds.length);
        expect(guideIds.length).toBeGreaterThan(0);
        expect(guideIds.sort()).toEqual(professionalIds.sort());
    });

    test("★ 反例：main 注册 id 与白名单交集为空（无条件过滤必然清空）", () => {
        const mainIds = getToolbarTools("main").map((tool) => tool.id);
        const intersection = mainIds.filter((id) => GUIDE_VISIBLE_TOOL_IDS.includes(id));
        // 交集为空 —— 这正是修复前 main guide=0 的根因
        expect(intersection).toHaveLength(0);
    });

    test("★ node-hover 仍受白名单约束（过滤未被完全移除）", () => {
        const ids = resolveToolbarTools("node-hover", ctxFor("guide"), defaultToolbarPrefs("node-hover")).map((tool) => tool.id);
        expect(ids.length).toBeLessThanOrEqual(6);
        for (const id of ids) expect(GUIDE_VISIBLE_TOOL_IDS).toContain(id);
    });

    test("★ selection / add-node-menu 在 guide 态不受影响", () => {
        // selection 工具栏注册表
        const selectionIds = resolveToolbarTools("selection", ctxFor("guide"), defaultToolbarPrefs("selection")).map((tool) => tool.id);
        const selectionProfIds = resolveToolbarTools("selection", ctxFor("professional"), defaultToolbarPrefs("selection")).map((tool) => tool.id);
        expect(selectionIds.sort()).toEqual(selectionProfIds.sort());
    });

    test("★ 接线源码：显式白名单式生效面（防未来 toolbar 隐式继承）", () => {
        const source = read("src/lib/canvas/tool-registry/tool-registry.ts");
        expect(source).toContain("GUIDE_FILTERED_TOOLBARS");
        expect(source).toContain('GUIDE_FILTERED_TOOLBARS: readonly ToolbarId[] = ["node-hover"]');
        expect(source).toContain("GUIDE_FILTERED_TOOLBARS.includes(toolbar)");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// B-1（评审线 P1）：序号徽标 clamp 用错坐标系
// ────────────────────────────────────────────────────────────────────────────

describe("★ B-1：序号徽标 clamp 用原图坐标系（评审线 P1）", () => {
    test("★ 接线源码：drawLabelBadge 签名含 imageHeight 且不再用 context.canvas", () => {
        const source = read("src/lib/canvas/annotate-edit-render.ts");
        expect(source).toContain("function drawLabelBadge(context: CanvasRenderingContext2D, label: number, x: number, y: number, imageWidth: number, imageHeight: number)");
        // 旧实现的两行必须消失
        expect(source).not.toContain("context.canvas.width - radius");
        expect(source).not.toContain("context.canvas.height - radius");
        // 新 clamp 在真接缝里用传入的原图尺寸
        expect(source).toContain("export function badgeCenter");
        expect(source).toContain("imageWidth - radius");
        expect(source).toContain("imageHeight - radius");
    });

    test("★ 行为断言：badgeCenter 在图内锚点**原样返回**（不被错误 clamp —— 旧缺陷把徽标全拉到一处）", () => {
        const imageWidth = 1024;
        const imageHeight = 1024;
        const radius = Math.max(10, imageWidth / 80);
        // ★ 关键断言（能抓到坐标系错位）：图内锚点必须原样返回，
        // 不能被钳到更小的错误范围（旧实现用导出画布尺寸 clamp → 多条徽标重合）。
        const insideAnchors = [
            { x: 512, y: 512 },
            { x: 200, y: 800 },
            { x: 900, y: 100 },
        ];
        for (const anchor of insideAnchors) {
            const center = badgeCenter(anchor.x, anchor.y, imageWidth, imageHeight, radius);
            expect(center.x).toBe(anchor.x);
            expect(center.y).toBe(anchor.y);
        }
    });

    test("★ 行为断言：越界锚点被 clamp 到原图边缘（且互不重合）", () => {
        const imageWidth = 1024;
        const imageHeight = 1024;
        const radius = Math.max(10, imageWidth / 80);
        const anchors = [
            { x: 0, y: 0 },
            { x: -300, y: -600 },
            { x: imageWidth, y: imageHeight },
        ];
        const centers = anchors.map((anchor) => badgeCenter(anchor.x, anchor.y, imageWidth, imageHeight, radius));
        for (const center of centers) {
            expect(center.x).toBeGreaterThanOrEqual(radius);
            expect(center.x).toBeLessThanOrEqual(imageWidth - radius);
            expect(center.y).toBeGreaterThanOrEqual(radius);
            expect(center.y).toBeLessThanOrEqual(imageHeight - radius);
        }
        // 右上角与左下角两锚点不得重合（旧缺陷的「两条重合」症状）
        expect(centers[2].x).not.toBe(centers[0].x);
        expect(centers[2].y).not.toBe(centers[0].y);
    });

    test("★ 反例：旧实现（canvas 尺寸 clamp）在裁剪导出下产出负坐标", () => {
        // 模拟导出场景：原图 1024x1024，标注 bounds 裁剪到 [400, 900]，导出画布 500x500
        const imageWidth = 1024;
        const bounds = { left: 400, top: 400 };
        const canvasWidth = 500;
        const radius = Math.max(10, imageWidth / 80);
        // 旧实现：用 canvas 尺寸 clamp 原图坐标
        const oldClamp = (value: number, extent: number) => Math.min(Math.max(value, radius), extent - radius);
        const anchorX = 50; // 原图坐标 50（在裁剪 bounds 左侧）
        const oldCx = oldClamp(anchorX, canvasWidth);
        // 再经 translate(-bounds.left) 变换到导出坐标
        const oldCxInExport = oldCx - bounds.left;
        // 旧实现在导出画布上跑到左侧外（评审线实测 [-354,-654] 同族）
        expect(oldCxInExport).toBeLessThan(0);
        // 新实现（真接缝）：按原图尺寸 clamp，落点仍在原图内
        const newCenter = badgeCenter(anchorX, anchorX, imageWidth, imageWidth, radius);
        expect(newCenter.x).toBeGreaterThanOrEqual(radius);
        expect(newCenter.x).toBeLessThanOrEqual(imageWidth - radius);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// B-2（评审线 P1）：重试路径丢标注截图
// ────────────────────────────────────────────────────────────────────────────

describe("★ B-2：标注截图物化 storageKey（评审线 P1）", () => {
    const sourceRef: ReferenceImage = { id: "src", name: "source.png", type: "image/png", dataUrl: "data:image/png;base64,source" };

    test("★ 结构断言：annotatedStorageKey 贯通到 referenceImages[1].storageKey", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "n1",
            source: sourceRef,
            annotatedDataUrl: "data:image/png;base64,annotated",
            annotatedStorageKey: "image:abc123",
            actionHint: "modify",
            annotationCount: 1,
            strokeCount: 0,
            exportWidth: 512,
            exportHeight: 512,
        });
        expect(submission.referenceImages[1].storageKey).toBe("image:abc123");
    });

    test("★ 反例：缺 storageKey 时重试链过滤后只剩原图（证明缺陷存在）", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "n1",
            source: { ...sourceRef, storageKey: "image:source" },
            annotatedDataUrl: "data:image/png;base64,annotated",
            // 不传 annotatedStorageKey（修复前行为）
            actionHint: "modify",
            annotationCount: 1,
            strokeCount: 0,
            exportWidth: 512,
            exportHeight: 512,
        });
        // 复刻 referenceUrl 过滤（canvas-project-generation.ts:261）：
        // 只留 storageKey / url / 非 data: 的 dataUrl
        const referenceUrl = (image: ReferenceImage) => image.storageKey || image.url || (!image.dataUrl.startsWith("data:") ? image.dataUrl : undefined);
        const surviving = submission.referenceImages.map(referenceUrl).filter((url): url is string => Boolean(url));
        // 标注图被过滤掉 → 只剩原图（正是评审线 B-2 的缺陷形态）
        expect(surviving).toHaveLength(1);
        // 而带 storageKey 时两张都存活
        const fixed = buildAnnotateEditSubmission({
            nodeId: "n1",
            source: { ...sourceRef, storageKey: "image:source" },
            annotatedDataUrl: "data:image/png;base64,annotated",
            annotatedStorageKey: "image:abc123",
            actionHint: "modify",
            annotationCount: 1,
            strokeCount: 0,
            exportWidth: 512,
            exportHeight: 512,
        });
        const fixedSurviving = fixed.referenceImages.map(referenceUrl).filter((url): url is string => Boolean(url));
        expect(fixedSurviving).toHaveLength(2);
    });

    test("★ 接线源码：执行链在提交前物化上传（照 outpaint maskUpload 先例）", () => {
        const source = read("src/pages/canvas/use-canvas-media-tools.ts");
        expect(source).toContain("annotatedReferenceUpload");
        expect(source).toContain("annotatedStorageKey: annotatedReferenceUpload?.storageKey");
        // 失败不阻断（可见提示）
        expect(source).toContain("标注截图上传失败");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// B-3（评审线 P1→P2）：metadata 注释与实现对齐
// ────────────────────────────────────────────────────────────────────────────

describe("★ B-3：逐条标注明细进元数据（兑现审计承诺）", () => {
    test("★ 结构断言：annotations 明细随 metadata 落盘", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "n1",
            source: { id: "s", name: "s.png", type: "image/png", dataUrl: "data:image/png;base64,s" },
            annotatedDataUrl: "data:image/png;base64,a",
            actionHint: "replace",
            annotationCount: 2,
            strokeCount: 0,
            exportWidth: 100,
            exportHeight: 100,
            annotations: [
                { id: "a1", shape: "region", note: "改成金色", x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
                { id: "a2", shape: "arrow", note: "指向把手", x: 0.5, y: 0.5, endX: 0.8, endY: 0.8 },
            ],
        });
        expect(submission.metadata.annotateEdit.annotations).toEqual([
            { shape: "region", note: "改成金色" },
            { shape: "arrow", note: "指向把手" },
        ]);
    });

    test("★ 画笔模式（无 annotations）不产出该字段（不硬塞空数组）", () => {
        const submission = buildAnnotateEditSubmission({
            nodeId: "n1",
            source: { id: "s", name: "s.png", type: "image/png", dataUrl: "data:image/png;base64,s" },
            annotatedDataUrl: "data:image/png;base64,a",
            actionHint: "modify",
            annotationCount: 0,
            strokeCount: 3,
            exportWidth: 100,
            exportHeight: 100,
        });
        expect(submission.metadata.annotateEdit.annotations).toBeUndefined();
        expect("annotations" in submission.metadata.annotateEdit).toBe(false);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// D-1（评审线 P1）：runner 防御层覆写 model prop
// ────────────────────────────────────────────────────────────────────────────

describe("★ D-1：模型选择单一真值（评审线 P1）", () => {
    const models = { imageModel: "img-m", textModel: "txt-m", selectedModel: "page-m" };

    test("★ 行为断言：图片卡取 imageModel（不受页面模式影响）", () => {
        expect(resolveLinearFlowModel({ mode: "image" }, models)).toBe("img-m");
        // 页面 selectedModel 是视频/文本模型时，仍取 imageModel（修复前会被覆写）
        expect(resolveLinearFlowModel({ mode: "image" }, { ...models, selectedModel: "vid-m" })).toBe("img-m");
    });

    test("★ 行为断言：文本卡取 textModel", () => {
        expect(resolveLinearFlowModel({ mode: "text" }, models)).toBe("txt-m");
    });

    test("★ 兜底：imageModel 为空时回退 selectedModel", () => {
        expect(resolveLinearFlowModel({ mode: "image" }, { ...models, imageModel: "" })).toBe("page-m");
    });

    test("★ 反例：修复前接线（model prop = selectedModel）在文本页面开图片卡 → 错模型", () => {
        // 修复前的 prop 表达式：mode === "text" ? textModel : selectedModel
        const oldModelProp = (mode: "image" | "text", m: typeof models) => (mode === "text" ? m.textModel || m.selectedModel : m.selectedModel);
        // 文本页面（selectedModel = txt-m）开图片卡
        const oldValue = oldModelProp("image", { imageModel: "img-m", textModel: "txt-m", selectedModel: "txt-m" });
        expect(oldValue).toBe("txt-m"); // 错模型 → 提交文本模型 → HTTP 400
        // 修复后
        expect(resolveLinearFlowModel({ mode: "image" }, { imageModel: "img-m", textModel: "txt-m", selectedModel: "txt-m" })).toBe("img-m");
    });

    test("★ 接线源码：index.tsx 的 config 与 prop 同源（同一函数）", () => {
        const source = read("src/pages/create/index.tsx");
        // 两处都调 resolveLinearFlowModel
        const occurrences = source.match(/resolveLinearFlowModel\(/g) || [];
        expect(occurrences.length).toBe(2);
        expect(source).toContain("model={linearFlowModel}");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// D-2（评审线 P1）：视频模式无 aspect 卡把视频比例当图片 size
// ────────────────────────────────────────────────────────────────────────────

describe("★ D-2：size 由卡流程唯一决定（不从 generationConfig 继承）", () => {
    const sizeProfile = (): ImageCapabilityConfig =>
        ({
            references: { promptMaxChars: 4000, maxImages: 3, maxImageBytes: 1e7, maskSupported: false },
            size: { parameter: "size", values: ["auto", "1024x1024", "1024x1360"], default: "auto", allowCustom: false },
            quality: { supported: false, values: [], default: "auto" },
            transparentBackground: { supported: false, default: false },
            responseFormat: { supported: true },
            outputFormat: { supported: true },
            maxOutputs: 1,
        }) as ImageCapabilityConfig;

    test("★ 行为断言：视频比例不污染 —— 无 aspect 卡返回 auto（不是继承值）", () => {
        // 场景图卡（linearFlowCardAspect = undefined）
        const card = findLinearFlowCard("scene-shot")!;
        expect(resolveLinearFlowConfigSize(card, sizeProfile(), undefined)).toBe("auto");
    });

    test("★ 行为断言：有 aspect 的图片卡返回模型可接受值", () => {
        const card = findLinearFlowCard("white-background-main")!;
        expect(resolveLinearFlowConfigSize(card, sizeProfile(), "1:1")).toBe("1024x1024");
        const detail = findLinearFlowCard("detail-3x4")!;
        expect(resolveLinearFlowConfigSize(detail, sizeProfile(), "3:4")).toBe("1024x1360");
    });

    test("★ 行为断言：文本卡返回 auto（不传图片 size）", () => {
        const card = findLinearFlowCard("batch-prompt-tune")!;
        expect(card.mode).toBe("text");
        expect(resolveLinearFlowConfigSize(card, sizeProfile(), undefined)).toBe("auto");
    });

    test("★ 反例：修复前的继承行为（generationConfig.size=16:9 透传）", () => {
        // 修复前：`...generationConfig` 打底，size 只在 resolveLinearFlowSize 有返回时覆盖
        const inherited = "16:9"; // 视频模式的 generationConfig.size
        const aspect = undefined; // 场景图卡
        const size = undefined; // resolveLinearFlowSize(profile, undefined) = undefined
        const oldFinalSize = size ?? inherited;
        expect(oldFinalSize).toBe("16:9"); // 污染形态（评审线实测值）
        // 修复后
        expect(resolveLinearFlowConfigSize(findLinearFlowCard("scene-shot")!, sizeProfile(), aspect)).toBe("auto");
    });

    test("★ 行为断言（真接缝）：视频比例不被继承 —— 场景图卡 size=auto 且模型族正确", () => {
        // 视频模式的 baseConfig：size 是视频比例 16:9（评审线实测的污染源）
        const baseConfig = { model: "vid-m", videoModel: "vid-m", size: "16:9", quality: "auto", count: "1" };
        const result = resolveLinearFlowConfig({
            card: findLinearFlowCard("scene-shot")!,
            config: { imageModel: "img-m", textModel: "txt-m" },
            baseConfig,
            selectedModel: "vid-m",
            imageProfile: sizeProfile(),
        });
        // ② size 不被继承（修复前 = 16:9）
        expect(result.size).toBe("auto");
        expect(result.size).not.toBe(baseConfig.size);
        // ① 模型族按 card.mode（图片卡 → imageModel）
        expect(result.model).toBe("img-m");
        expect(result.imageModel).toBe("img-m");
    });

    test("★ 行为断言（真接缝）：有 aspect 的图片卡 size 为模型可接受值", () => {
        const result = resolveLinearFlowConfig({
            card: findLinearFlowCard("white-background-main")!,
            config: { imageModel: "img-m", textModel: "txt-m" },
            baseConfig: { model: "vid-m", size: "16:9" },
            selectedModel: "vid-m",
            imageProfile: sizeProfile(),
        });
        expect(result.size).toBe("1024x1024");
    });

    test("★ 行为断言（真接缝）：文本卡取 textModel 且不污染图片 size", () => {
        const result = resolveLinearFlowConfig({
            card: findLinearFlowCard("batch-prompt-tune")!,
            config: { imageModel: "img-m", textModel: "txt-m" },
            baseConfig: { model: "page-m", size: "16:9" },
            selectedModel: "page-m",
            imageProfile: sizeProfile(),
        });
        expect(result.model).toBe("txt-m");
        expect(result.textModel).toBe("txt-m");
        expect(result.size).toBe("auto");
    });

    test("★ 反例：修复前实现（继承 baseConfig.size）在视频模式场景图卡透传 16:9", () => {
        // 修复前：`...generationConfig` 打底，size 只在 resolveLinearFlowSize 有返回时覆盖
        const baseConfig = { model: "vid-m", size: "16:9" };
        const aspect = undefined;
        const oldSize = resolveLinearFlowSize(sizeProfile(), aspect) ?? baseConfig.size;
        expect(oldSize).toBe("16:9"); // 污染形态
        // 修复后（真接缝）
        const fixed = resolveLinearFlowConfig({
            card: findLinearFlowCard("scene-shot")!,
            config: { imageModel: "img-m", textModel: "txt-m" },
            baseConfig,
            selectedModel: "vid-m",
            imageProfile: sizeProfile(),
        });
        expect(fixed.size).toBe("auto");
    });

    test("★ 接线源码：index.tsx 走真接缝（不是内联组装）", () => {
        const source = read("src/pages/create/index.tsx");
        expect(source).toContain("resolveLinearFlowConfig({");
        expect(source).toContain("baseConfig: generationConfig");
        // 内联剥离语句不应再出现（逻辑已进纯函数）
        expect(source).not.toContain("const { size: _inheritedSize, ...configWithoutSize } = generationConfig");
    });
});
