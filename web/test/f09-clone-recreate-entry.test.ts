import { describe, expect, test } from "bun:test";

import { CAPABILITY_ENTRIES, capabilityContextSatisfied, findCapabilityEntry } from "../src/lib/canvas/capability-entries";
import { defaultToolbarPrefs, resolveToolbarEntries, type ToolContext, type ToolbarHandlers } from "../src/lib/canvas/tool-registry";
import { CanvasNodeType } from "../src/types/canvas";

/**
 * F-09 三期 §3.2：`dual_image` 谓词的真实消费方。
 *
 * ★ 控制线要求（任务书 §五 反面样例）：
 *   只测 `capabilityContextSatisfied(entry, {imageCount: 2})` 返回 true 是【谓词自证】，
 *   不证明「真实入口在双图时渲染」。
 *   本组测试因此断言【真实入口消费路径】—— 选区工具栏条目
 *   `selection-clone-recreate` 经 resolveToolbarEntries 后的实际渲染结果。
 */

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

describe("F-09 §3.2 dual_image 谓词的真实消费方", () => {
    test("★ 真实入口消费路径：选中恰好 2 张图时，选区工具栏渲染爆款复刻按钮", () => {
        const items = resolveToolbarEntries("selection", toolContext(2), defaultToolbarPrefs("selection"));
        const ids = items.map((item) => item.id);
        // ★ 这是「真实入口在双图时渲染」的直接证据（非谓词自证）
        expect(ids).toContain("selection-clone-recreate");
    });

    test("★ 只选 1 张图时不渲染（谓词 gating 生效）", () => {
        const items = resolveToolbarEntries("selection", toolContext(1), defaultToolbarPrefs("selection"));
        expect(items.map((item) => item.id)).not.toContain("selection-clone-recreate");
    });

    test("★ 选 3 张图时不渲染（dual_image 是「恰好 2 张」，不是「至少 2 张」）", () => {
        const items = resolveToolbarEntries("selection", toolContext(3), defaultToolbarPrefs("selection"));
        expect(items.map((item) => item.id)).not.toContain("selection-clone-recreate");
    });

    test("对照：既有条目不受影响（选 1 张图时对齐按钮仍在）", () => {
        const items = resolveToolbarEntries("selection", toolContext(1), defaultToolbarPrefs("selection"));
        const ids = items.map((item) => item.id);
        expect(ids).toContain("selection-align-left");
    });

    test("谓词与入口判定一致（谓词是入口的过滤依据）", () => {
        const entry = findCapabilityEntry("image.cloneRecreate");
        expect(entry).toBeDefined();
        // 谓词：恰好 2 张
        expect(capabilityContextSatisfied(entry!, { imageCount: 2, hasSelection: true })).toBe(true);
        expect(capabilityContextSatisfied(entry!, { imageCount: 1, hasSelection: true })).toBe(false);
        expect(capabilityContextSatisfied(entry!, { imageCount: 3, hasSelection: true })).toBe(false);
    });

    test("条目字段完整（tier/handler/entryPoints/registryVersion）", () => {
        const entry = findCapabilityEntry("image.cloneRecreate")!;
        expect(entry.tier).toBe(0);
        expect(entry.contextRequirement).toBe("dual_image");
        expect(entry.assetKind).toBe("capability/tool");
        expect(entry.executionChain.handler).toBe("createCloneRecreateNode");
        expect(entry.entryPoints.length).toBeGreaterThan(0);
        expect(Number.isInteger(entry.registryVersion)).toBe(true);
    });

    test("★ handler 名在真实代码里存在（防「handler 指向未来函数」）", async () => {
        // F-08 先例（任务书 §3.1）：handler 必须先存在，条目才登记。
        // 这里读真实源码验证 handler 已实现并导出。
        const { readFileSync } = await import("node:fs");
        const source = readFileSync(new URL("../src/pages/canvas/use-canvas-media-tools.ts", import.meta.url), "utf8");
        const entry = findCapabilityEntry("image.cloneRecreate")!;
        // handler 定义存在
        expect(source).toContain(`const ${entry.executionChain.handler} = useCallback`);
        // 且被导出（供 project.tsx 消费）
        expect(source).toContain(`        ${entry.executionChain.handler},`);
    });

    test("★ 参数面三项与一手语料口径一致", () => {
        const entry = findCapabilityEntry("image.cloneRecreate")!;
        const fields = entry.parameterSurface.map((item) => item.field);
        expect(fields).toEqual(["cloneDegree", "cloneScope", "copyMode"]);
        // 选项取值对齐 wfapp-52 语料
        const degree = entry.parameterSurface.find((item) => item.field === "cloneDegree")!;
        expect(degree.options).toEqual(["style-reference", "high-structure"]);
        const scope = entry.parameterSurface.find((item) => item.field === "cloneScope")!;
        expect(scope.options).toHaveLength(6);
        const copy = entry.parameterSurface.find((item) => item.field === "copyMode")!;
        expect(copy.options).toEqual(["no-copy", "auto-copy", "exact-copy"]);
    });

    test("条目总数与注册表一致（新增 1 条：3 条）", () => {
        expect(CAPABILITY_ENTRIES).toHaveLength(3);
        expect(CAPABILITY_ENTRIES.map((entry) => entry.id)).toEqual(["image.superResolve", "image.annotateEdit", "image.cloneRecreate"]);
    });
});
