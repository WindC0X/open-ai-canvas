import { expect, test, describe } from "bun:test";

import {
    GUIDE_VISIBLE_TOOL_COUNT,
    GUIDE_VISIBLE_TOOL_IDS,
    allNodeHoverToolIds,
    guideVisibleToolIds,
    isGuideStateActive,
    isToolVisibleInGuideState,
    nodeHoverToolsBySection,
    resolveGuideState,
} from "@/lib/canvas/graduation-state";

/**
 * W5 毕业机制 —— 状态机单测（设计卡 §3.4 + 控制线四项裁定）。
 *
 * 覆盖：三态迁移 / 单向粘性 / 6 动作白名单 / 零门控默认态 / B1 分组。
 */

describe("★ 状态迁移（控制线裁定②：单向粘性）", () => {
    test("直接进入画布 → novice（默认完整，零门控）", () => {
        expect(resolveGuideState({ entry: "direct" })).toBe("novice");
        expect(resolveGuideState({ current: "novice", entry: "direct" })).toBe("novice");
    });

    test("从卡流程进入 → guide（引导态）", () => {
        expect(resolveGuideState({ entry: "linear-flow" })).toBe("guide");
        expect(resolveGuideState({ current: "novice", entry: "linear-flow" })).toBe("guide");
    });

    test("完成首单 → graduate", () => {
        expect(resolveGuideState({ entry: "linear-flow", firstOrderCompleted: true })).toBe("graduate");
        expect(resolveGuideState({ current: "guide", entry: "direct", firstOrderCompleted: true })).toBe("graduate");
    });

    test("点「完整画布」→ graduate", () => {
        expect(resolveGuideState({ current: "guide", entry: "direct", fullCanvasRequested: true })).toBe("graduate");
    });

    test("★ graduate 是终态：任何输入都不回退（单向粘性）", () => {
        // 已毕业用户再次从卡流程进入，不降回 guide
        expect(resolveGuideState({ current: "graduate", entry: "linear-flow" })).toBe("graduate");
        expect(resolveGuideState({ current: "graduate", entry: "direct" })).toBe("graduate");
        // 即使显式传 false 也不回退
        expect(resolveGuideState({ current: "graduate", entry: "linear-flow", firstOrderCompleted: false })).toBe("graduate");
    });

    test("首单完成优先于卡流程入口（同时满足时毕业）", () => {
        expect(resolveGuideState({ entry: "linear-flow", firstOrderCompleted: true, fullCanvasRequested: false })).toBe("graduate");
    });

    test("guide 态不会自动毕业（没有触发条件就停在引导态）", () => {
        expect(resolveGuideState({ current: "guide", entry: "direct" })).toBe("guide");
    });
});

describe("★ 零门控默认态（PRODUCT.md 反参照 + 硬验收②）", () => {
    test("isGuideStateActive 只对 guide 为真", () => {
        expect(isGuideStateActive("guide")).toBe(true);
        expect(isGuideStateActive("novice")).toBe(false);
        expect(isGuideStateActive("graduate")).toBe(false);
    });

    test("★ novice 与 graduate 都返回 null（零门控，全量呈现）", () => {
        expect(guideVisibleToolIds("novice")).toBeNull();
        expect(guideVisibleToolIds("graduate")).toBeNull();
    });

    test("只有 guide 返回白名单", () => {
        expect(guideVisibleToolIds("guide")).toEqual(GUIDE_VISIBLE_TOOL_IDS);
    });

    test("零门控时任意工具都可见（含系统动作）", () => {
        for (const toolId of ["info", "delete", "retry", "node-lock", "edit"]) {
            expect(isToolVisibleInGuideState("novice", toolId)).toBe(true);
            expect(isToolVisibleInGuideState("graduate", toolId)).toBe(true);
        }
    });
});

describe("★ 6 动作白名单（控制线裁定③）", () => {
    test("恰好 6 项（硬约束）", () => {
        expect(GUIDE_VISIBLE_TOOL_IDS).toHaveLength(GUIDE_VISIBLE_TOOL_COUNT);
        expect(GUIDE_VISIBLE_TOOL_COUNT).toBe(6);
    });

    test("无重复", () => {
        expect(new Set(GUIDE_VISIBLE_TOOL_IDS).size).toBe(GUIDE_VISIBLE_TOOL_IDS.length);
    });

    test("★ 判据④：6 项全部映射到注册表真实 tool id（零悬空引用）", () => {
        const registered = new Set(allNodeHoverToolIds());
        for (const toolId of GUIDE_VISIBLE_TOOL_IDS) {
            expect(registered.has(toolId)).toBe(true);
        }
    });

    test("★ 判据②：系统管理动作不在白名单（delete/retry/info/node-lock）", () => {
        for (const systemTool of ["info", "delete", "retry", "node-lock"]) {
            expect(GUIDE_VISIBLE_TOOL_IDS).not.toContain(systemTool);
            expect(isToolVisibleInGuideState("guide", systemTool)).toBe(false);
        }
    });

    test("★ 判据③：编辑类动作在白名单（结果永远可编辑）", () => {
        for (const editTool of ["edit", "editText", "generateImage"]) {
            expect(GUIDE_VISIBLE_TOOL_IDS).toContain(editTool);
        }
    });

    test("★ 判据①：卡流程教过的动作在白名单（上传/出图/下载）", () => {
        for (const flowTool of ["uploadImage", "generateImage", "download"]) {
            expect(GUIDE_VISIBLE_TOOL_IDS).toContain(flowTool);
        }
    });

    test("引导态下白名单外工具不可见", () => {
        expect(isToolVisibleInGuideState("guide", "edit")).toBe(true);
        expect(isToolVisibleInGuideState("guide", "trimRegenerate")).toBe(false);
        expect(isToolVisibleInGuideState("guide", "extractAudio")).toBe(false);
    });
});

describe("★ 毕业后的 B1 分组呈现（控制线裁定②）", () => {
    test("分组来源是注册表 nodeToolbar.section（非硬编码清单）", () => {
        const groups = nodeHoverToolsBySection();
        expect(groups.length).toBeGreaterThan(0);
        const sections = groups.map((group) => group.section);
        // 实测注册表里的分组名
        expect(sections).toContain("节点管理");
        expect(sections).toContain("素材");
    });

    test("分组覆盖全量工具（不丢项）", () => {
        const grouped = nodeHoverToolsBySection().flatMap((group) => group.toolIds);
        expect(grouped.sort()).toEqual(allNodeHoverToolIds().sort());
    });

    test("全量工具数 = 20（设计卡 §3.4 原文「node-hover 20 项」）", () => {
        expect(allNodeHoverToolIds()).toHaveLength(20);
    });

    test("无分组工具归入「常用操作」兜底（不静默丢失）", () => {
        const groups = nodeHoverToolsBySection();
        const fallback = groups.find((group) => group.section === "常用操作");
        // 注册表里有若干无 section 的工具（如 retry/generateImage/download）
        expect(fallback).toBeDefined();
        expect(fallback!.toolIds.length).toBeGreaterThan(0);
    });
});

describe("模块边界（两个门控正交，控制线裁定②）", () => {
    test("本模块不引用 LinearFlowGate（两个门控互不依赖）", async () => {
        const source = await Bun.file(new URL("../src/lib/canvas/graduation-state.ts", import.meta.url)).text();
        // 注释里允许提及（说明两个门控正交），但不得 import
        const codeOnly = source
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
        expect(codeOnly).not.toContain("linear-flow-gate");
        expect(codeOnly).not.toContain("LinearFlowGate");
    });

    test("本模块零画布 store 依赖（纯函数，可在任意载体复用）", async () => {
        const source = await Bun.file(new URL("../src/lib/canvas/graduation-state.ts", import.meta.url)).text();
        expect(source).not.toContain("use-canvas-store");
        expect(source).not.toContain("useState");
    });

    test("resolveGuideState 是纯函数：同输入同输出", () => {
        const input = { entry: "linear-flow" as const, current: "novice" as const };
        expect(resolveGuideState(input)).toBe(resolveGuideState(input));
    });
});
