import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CAPABILITY_ENTRIES, capabilityContextSatisfied, capabilityEntriesByTier, findCapabilityEntry } from "@/lib/canvas/capability-entries";
import { DEFAULT_SUPER_RESOLVE_PARAMS, SUPER_RESOLVE_MODES, SUPER_RESOLVE_TARGETS, isFaithfulDefault } from "@/lib/canvas/super-resolve-params";

/**
 * O-03 层2 AI 超分 —— 注册表条目 + 参数面 + 入口可达性。
 *
 * 本文件守护三类不变量：
 * ① 能力条目 schema 完整（控制线裁定「不许缺字段」）
 * ② 命名分流红线（MASTER-PLAN L399）：upscale（插值/免费）与 superResolve（AI/计费）
 *    严格分开，保真放大为默认，禁用「高清化」模糊词
 * ③ 入口可达性（反模式 #12：有代码≠能用）—— 工具条目存在且 handler 被消费
 */

const webRoot = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(webRoot, relative), "utf8");

describe("能力条目 schema（控制线裁定：全字段登记，不许缺字段）", () => {
    test("超分条目全字段齐备", () => {
        const entry = findCapabilityEntry("image.superResolve");
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
            primaryChannel: entry?.executionChain.primaryChannel,
            zeroParameterPreset: entry?.zeroParameterPreset,
        }).toEqual({
            id: "image.superResolve",
            name: "AI 超分",
            // 能力组织层方案 §4 表明确列「超分W5」为画布内弹窗档。
            tier: 1,
            contextRequirement: "single_image",
            assetKind: "capability/tool",
            hasParameterSurface: true,
            executionHandler: "superResolveImageNode",
            executionLocation: "cloud",
            primaryChannel: "a6api · nano-banana-2",
            // 控制线裁定：显式写「暂无」，不许缺字段。
            zeroParameterPreset: "暂无",
        });
    });

    test("每条记录字段非空（防后续新增条目漏字段）", () => {
        for (const entry of CAPABILITY_ENTRIES) {
            for (const [key, value] of Object.entries(entry)) {
                expect({ id: entry.id, key, empty: value === undefined || value === null || value === "" }).toEqual({ id: entry.id, key, empty: false });
            }
            expect(entry.parameterSurface.length).toBeGreaterThan(0);
            expect(entry.executionChain.primaryChannel.length).toBeGreaterThan(0);
        }
    });

    test("★ 登记位独立：元数据不在按钮定义文件里", () => {
        // 控制线裁定：禁止把元数据塞进按钮定义的字段或注释里，升格枝要按记录消费。
        const toolbarSource = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(toolbarSource.includes("capability-entries")).toBe(false);
        expect(toolbarSource.includes("contextRequirement")).toBe(false);
    });

    test("按档位与上下文筛选", () => {
        expect(capabilityEntriesByTier(1).some((entry) => entry.id === "image.superResolve")).toBe(true);
        const entry = findCapabilityEntry("image.superResolve")!;
        // single_image：恰好一张图才满足。
        expect(capabilityContextSatisfied(entry, { imageCount: 1, hasSelection: false })).toBe(true);
        expect(capabilityContextSatisfied(entry, { imageCount: 0, hasSelection: false })).toBe(false);
        expect(capabilityContextSatisfied(entry, { imageCount: 2, hasSelection: false })).toBe(false);
    });
});

describe("★ 命名分流红线（MASTER-PLAN L399）", () => {
    test("保真放大是默认档（红线原文：保真放大（默认））", () => {
        expect(DEFAULT_SUPER_RESOLVE_PARAMS.mode).toBe("faithful");
        expect(isFaithfulDefault(DEFAULT_SUPER_RESOLVE_PARAMS)).toBe(true);
    });

    test("AI 增强需勾选确认（红线原文：AI 增强（勾选确认））", () => {
        const enhance = SUPER_RESOLVE_MODES.find((item) => item.value === "enhance");
        const faithful = SUPER_RESOLVE_MODES.find((item) => item.value === "faithful");
        expect({ enhanceConfirm: enhance?.confirm, faithfulConfirm: faithful?.confirm }).toEqual({ enhanceConfirm: true, faithfulConfirm: false });
    });

    test("★ 禁用「高清化」模糊词（全仓，含注释）", () => {
        const files = [
            "src/lib/canvas/super-resolve-params.ts",
            "src/components/canvas/canvas-node-super-resolve-dialog.tsx",
            "src/lib/canvas/capability-entries.ts",
            "src/components/canvas/canvas-image-toolbar-tools.tsx",
        ];
        for (const file of files) {
            expect({ file, banned: read(file).includes("高清化") }).toEqual({ file, banned: false });
        }
    });

    test("超分工具条目的 label 不含「超分」以外的混淆词，且描述声明消耗积分", () => {
        const source = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(source.includes('label: "AI 超分"')).toBe(true);
        expect(source.includes("云端重建像素细节，消耗积分")).toBe(true);
    });

    test("★ HUD 的「超分」误标已修正为「调整尺寸」（它调的是免费插值）", () => {
        const source = read("src/pages/canvas/project.tsx");
        // 修正前：{ label: "超分", ... onClick: () => setUpscaleNodeId(...) } —— 命名红线违规。
        expect(source.includes('{ label: "超分", icon: <ZoomIn')).toBe(false);
        expect(source.includes('{ label: "调整尺寸", icon: <ZoomIn')).toBe(true);
    });
});

describe("★ 入口可达性（反模式 #12：有代码≠能用）", () => {
    test("工具条目 id: superResolve 存在（此前只有 handler 声明，Modal 不可达）", () => {
        const source = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(source.includes('id: "superResolve"')).toBe(true);
    });

    test("★ handler 被消费（此前 onSuperResolve 是死 prop）", () => {
        const source = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(source.includes("handlers.onSuperResolve(node)")).toBe(true);
    });

    test("★ 占位「暂未实现」已移除，换真对话框", () => {
        const source = read("src/pages/canvas/canvas-project-status-dialogs.tsx");
        expect(source.includes("暂未实现")).toBe(false);
        expect(source.includes("CanvasNodeSuperResolveDialog")).toBe(true);
    });

    test("★ 执行链贯通：project.tsx 把 onSuperResolve 接到 superResolveImageNode", () => {
        const source = read("src/pages/canvas/project.tsx");
        expect(source.includes("onSuperResolve={(node, params) =>")).toBe(true);
        expect(source.includes("superResolveImageNode(node, params)")).toBe(true);
    });

    test("★ 计费 operation 贯通：执行函数传 canvasEditOperation=image_upscale", () => {
        const source = read("src/pages/canvas/use-canvas-media-tools.ts");
        expect(source.includes('canvasEditOperation: "image_upscale"')).toBe(true);
        // generation-task.ts 把它映射为 operation（后端 selector 据此选价格档）。
        const taskSource = read("src/services/api/generation-task.ts");
        expect(taskSource.includes('options.metadata?.canvasEditOperation === "image_upscale"')).toBe(true);
    });
});

describe("参数面", () => {
    test("目标档只含 2K / 4K（超分只跑一次，见 MASTER-PLAN L399 F-06 衔接口径）", () => {
        expect(SUPER_RESOLVE_TARGETS.map((item) => item.value)).toEqual(["2k", "4k"]);
    });

    test("默认目标档 2K", () => {
        expect(DEFAULT_SUPER_RESOLVE_PARAMS.targetResolution).toBe("2k");
    });
});
