import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CAPABILITY_ENTRIES, capabilityContextSatisfied, capabilityEntriesByTier, findCapabilityEntry } from "@/lib/canvas/capability-entries";
import { ANNOTATE_EDIT_ACTIONS, buildAnnotateEditPrompt } from "@/lib/canvas/annotate-edit-prompt";

/**
 * F-08 圈选改图 —— 注册表条目 + 入口可达性（C3）。
 *
 * 提交构造的结构断言在 annotate-edit-submission.test.ts（C2）。
 * 仅入口存在性/命名类检查保留源码读取。
 */

const webRoot = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(webRoot, relative), "utf8");

describe("★ 提示词模块（buildAnnotateEditPrompt）", () => {
    test("三种编辑意图各有独立语义行", () => {
        const modify = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 0, exportHeight: 0, actionHint: "modify" });
        const replace = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 0, exportHeight: 0, actionHint: "replace" });
        const remove = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 0, exportHeight: 0, actionHint: "remove" });
        expect(modify).toContain("只修改被标注的区域");
        expect(replace).toContain("替换为标注文字描述的内容");
        expect(remove).toContain("移除被标注区域的内容");
    });

    test("缺省意图回退 modify", () => {
        const prompt = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 0, exportHeight: 0 });
        expect(prompt).toContain("只修改被标注的区域");
    });

    test("尺寸为 0 时省略 Screenshot size 行（画笔模式不裁剪的合法态）", () => {
        const prompt = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 0, exportHeight: 0 });
        expect(prompt).not.toContain("Screenshot size");
        expect(prompt).toContain("Included annotation shapes: 1");
    });

    test("意图选项表与提示词行一一对应（UI 与提交同源）", () => {
        for (const action of ANNOTATE_EDIT_ACTIONS) {
            const prompt = buildAnnotateEditPrompt({ annotationCount: 1, exportWidth: 0, exportHeight: 0, actionHint: action.value });
            expect(prompt).toContain(action.promptLine);
        }
    });
});

describe("★ 注册表条目（image.annotateEdit，控制线裁定全字段）", () => {
    test("条目全字段齐备（不许缺字段）", () => {
        const entry = findCapabilityEntry("image.annotateEdit");
        expect(entry).toBeDefined();
        expect({
            id: entry?.id,
            name: entry?.name,
            tier: entry?.tier,
            contextRequirement: entry?.contextRequirement,
            assetKind: entry?.assetKind,
            hasParameterSurface: (entry?.parameterSurface.length ?? 0) > 0,
            executionHandler: entry?.executionChain.handler,
            executionLocation: entry?.executionChain.location,
            hasChannel: (entry?.executionChain.primaryChannel.length ?? 0) > 0,
            zeroParameterPreset: entry?.zeroParameterPreset,
        }).toEqual({
            id: "image.annotateEdit",
            // 用户可见名称=任务命名（控制线裁定：入口与对话框统一「圈选改图」）。
            name: "圈选改图",
            tier: 1,
            // 控制线裁定：single_image（圈选是弹窗内交互，不上浮为入口谓词）。
            contextRequirement: "single_image",
            assetKind: "capability/tool",
            hasParameterSurface: true,
            executionHandler: "editAnnotatedImageNode",
            executionLocation: "cloud",
            hasChannel: true,
            zeroParameterPreset: "暂无",
        });
    });

    test("谓词生效：single_image 语义（无图不满足）", () => {
        const entry = findCapabilityEntry("image.annotateEdit")!;
        expect(capabilityContextSatisfied(entry, { imageCount: 1, hasSelection: false })).toBe(true);
        expect(capabilityContextSatisfied(entry, { imageCount: 0, hasSelection: false })).toBe(false);
        expect(capabilityContextSatisfied(entry, { imageCount: 2, hasSelection: false })).toBe(false);
    });

    test("档 1 筛选包含两个原生条目（superResolve + annotateEdit）", () => {
        const tier1 = capabilityEntriesByTier(1).map((entry) => entry.id);
        expect(tier1).toContain("image.superResolve");
        expect(tier1).toContain("image.annotateEdit");
    });

    test("全部条目字段非空（防新增条目漏字段）", () => {
        for (const entry of CAPABILITY_ENTRIES) {
            for (const [key, value] of Object.entries(entry)) {
                expect({ id: entry.id, key, empty: value === undefined || value === null || value === "" }).toEqual({ id: entry.id, key, empty: false });
            }
            expect(entry.parameterSurface.length).toBeGreaterThan(0);
            expect(entry.executionChain.primaryChannel.length).toBeGreaterThan(0);
        }
    });

    test("参数面 actionHint 与提示词模块同源（三值一致）", () => {
        const entry = findCapabilityEntry("image.annotateEdit")!;
        const actionSurface = entry.parameterSurface.find((surface) => surface.field === "actionHint");
        expect(actionSurface?.options).toEqual(ANNOTATE_EDIT_ACTIONS.map((action) => action.value));
        expect(actionSurface?.default).toBe("modify");
    });

    test("★ R25m 跨枝字段：entryPoints 指向真实工具条 id + registryVersion=1", () => {
        const entry = findCapabilityEntry("image.annotateEdit")!;
        expect(entry.entryPoints).toEqual([{ kind: "node-toolbar", target: "annotationEdit" }]);
        expect(entry.registryVersion).toBe(1);
        // 守卫纪律：entryPoints.target 必须与真实按钮定义一致（R25m 线守卫同口径）。
        const toolbar = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        for (const point of entry.entryPoints) {
            expect({ target: point.target, exists: toolbar.includes(`id: "${point.target}"`) }).toEqual({ target: point.target, exists: true });
        }
    });
});

describe("★ 入口可达性（反模式 #12：有代码≠能用）", () => {
    test("工具条目 id: annotationEdit 存在且文案为「圈选改图」", () => {
        const source = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(source.includes('id: "annotationEdit"')).toBe(true);
        expect(source.includes('label: "圈选改图"')).toBe(true);
    });

    test("★ 入口文案不含旧机制名「标注编辑」（命名统一裁定）", () => {
        const toolbar = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(toolbar.includes('label: "标注编辑"')).toBe(false);
    });

    test("★ handler 被消费（onAnnotationEdit 接到执行链）", () => {
        const toolbar = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(toolbar.includes("handlers.onAnnotationEdit(node)")).toBe(true);
        const project = read("src/pages/canvas/project.tsx");
        expect(project.includes("editAnnotatedImageNode(node, payload)")).toBe(true);
    });

    test("★ 弹窗挂接：media-dialogs 用新对话框（双模式）", () => {
        const source = read("src/pages/canvas/canvas-project-media-dialogs.tsx");
        expect(source.includes("CanvasNodeAnnotateEditDialog")).toBe(true);
        // 旧 editMode 链路不再用于 annotationEdit 入口。
        expect(source.includes("editMode")).toBe(false);
    });

    test("★ 登记位独立：元数据不在按钮定义文件里", () => {
        const toolbarSource = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(toolbarSource.includes("capability-entries")).toBe(false);
        expect(toolbarSource.includes("contextRequirement")).toBe(false);
    });
});
