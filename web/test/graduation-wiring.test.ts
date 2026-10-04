import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { GUIDE_VISIBLE_TOOL_IDS, resolveGuideState } from "@/lib/canvas/graduation-state";
import { defaultToolbarPrefs, getToolbarTools, resolveToolbarTools } from "@/lib/canvas/tool-registry";
// ★ 只 import 定义模块（它在模块尾自注册 `registerToolbarTools(nodeHoverToolbarTools)`）；
// 不能再显式注册一次，否则工具在注册表里重复 → 返回集合翻倍（实测踩过）。
import { nodeHoverToolbarTools } from "@/lib/canvas/tool-registry/definitions/node-hover-tools";
import type { ToolContext } from "@/lib/canvas/tool-registry/tool-definition";

/**
 * W5 毕业机制 —— ★ 接线级断言（控制线要求：跨组件契约必须有提交体/返回值断言）。
 *
 * 两个锚点（控制线原文）：
 *   ① guide 态下 node-hover 实际渲染的按钮集合恰为 6 项
 *   ② direct 进入用户按钮集合不变（零门控）
 *
 * ★ 为什么必须是返回值断言（前两轮教训）：纯函数测试全绿 ≠ 接线可用。
 * 本文件断言 `resolveToolbarTools` 的**实际返回集合**，不是源码字符串。
 */

const webRoot = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(webRoot, relative), "utf8");

// 注册表是模块级 Map，`node-hover-tools` 在被 import 时已自注册（模块尾调用）；
// 这里只保留引用以便断言数量用，不再重复注册。

/** 构造一个最简 ToolContext（只填 workspaceMode 与 node，其余按需）。 */
function ctxFor(workspaceMode: ToolContext["workspaceMode"], node: ToolContext["node"]): ToolContext {
    return {
        workspaceMode,
        node,
        nodeMetadata: node.metadata,
        handlers: {} as ToolContext["handlers"],
    } as ToolContext;
}

/** 一个普通图片节点（让大多数工具 applicable 通过）。 */
const imageNode = {
    id: "guide-node",
    type: "image",
    title: "商品图",
    position: { x: 0, y: 0 },
    width: 320,
    height: 320,
    metadata: { content: "image:test", storageKey: "image:test", status: "success" },
} as unknown as ToolContext["node"];

/** 一个文本节点（让文本类工具 applicable 通过）。 */
const textNode = {
    id: "guide-text-node",
    type: "text",
    title: "商品描述",
    position: { x: 0, y: 0 },
    width: 320,
    height: 180,
    metadata: { content: "白色陶瓷马克杯", status: "success" },
} as unknown as ToolContext["node"];

/** 一个视频节点（让视频类工具 applicable 通过）。 */
const videoNode = {
    id: "guide-video-node",
    type: "video",
    title: "商品视频",
    position: { x: 0, y: 0 },
    width: 320,
    height: 180,
    metadata: { content: "video:test", storageKey: "video:test", status: "success" },
} as unknown as ToolContext["node"];

describe("★ 锚点 ①：guide 态下 node-hover 实际渲染的按钮集合恰为 6 项（上限）", () => {
    test("★ guide 态返回集合 = 白名单 ∩ applicable（是上限而非固定 6 个）", () => {
        // ★ 语义澄清（实测修正）：GUIDE_VISIBLE_TOOL_IDS 是**上限**（最多露这些），
        // 实际渲染还要过 applicable（节点类型判据）。故各节点类型下是它的**子集**，
        // 且**绝不会超出白名单**。
        for (const node of [imageNode, textNode, videoNode]) {
            const ids = resolveToolbarTools("node-hover", ctxFor("guide", node), defaultToolbarPrefs("node-hover")).map((tool) => tool.id);
            // ① 上限约束：绝不超出白名单
            for (const id of ids) expect(GUIDE_VISIBLE_TOOL_IDS).toContain(id);
            // ② 数量上限：≤6
            expect(ids.length).toBeLessThanOrEqual(6);
        }
    });

    test("★ 图片节点：guide 态返回白名单里图片可用的项", () => {
        const ids = resolveToolbarTools("node-hover", ctxFor("guide", imageNode), defaultToolbarPrefs("node-hover")).map((tool) => tool.id);
        // 实测（有图图片节点）：saveAsset + download（edit 在 applicable 层被 canOpenDialog 拦下：
        // 图片源节点不可打开生成弹窗；uploadImage 因已有图被排除）
        expect(ids).toContain("download");
        expect(ids).toContain("saveAsset");
        expect(ids.length).toBeGreaterThanOrEqual(2);
    });

    test("★ 文本节点：guide 态返回白名单里文本可用的项（含 editText）", () => {
        const ids = resolveToolbarTools("node-hover", ctxFor("guide", textNode), defaultToolbarPrefs("node-hover")).map((tool) => tool.id);
        expect(ids).toContain("editText");
        expect(ids).toContain("generateImage");
        expect(ids).toContain("edit");
        expect(ids.length).toBeLessThanOrEqual(6);
    });

    test("★ 三节点类型合并可覆盖白名单里 applicable 可达的项（非死项）", () => {
        const covered = new Set<string>();
        for (const node of [imageNode, textNode, videoNode]) {
            for (const id of resolveToolbarTools("node-hover", ctxFor("guide", node), defaultToolbarPrefs("node-hover")).map((tool) => tool.id)) covered.add(id);
        }
        // ★ 实测：有图的节点上 uploadImage 不适用（其 applicable 是「无图时才显示」）——
        // 故三类型合并不含 uploadImage。这是**正确的产品语义**（已有图不需要「上传图片」）。
        // 用「空图图片节点」补上该面：
        const emptyImageNode = { ...imageNode, metadata: { status: "success" } } as unknown as ToolContext["node"];
        for (const id of resolveToolbarTools("node-hover", ctxFor("guide", emptyImageNode), defaultToolbarPrefs("node-hover")).map((tool) => tool.id)) covered.add(id);
        expect([...covered].sort()).toEqual([...GUIDE_VISIBLE_TOOL_IDS].sort());
    });

    test("★ 6 项之外的工具在 guide 态确实不返回（不是只写在白名单里）", () => {
        for (const node of [imageNode, textNode, videoNode]) {
            const ids = resolveToolbarTools("node-hover", ctxFor("guide", node), defaultToolbarPrefs("node-hover")).map((tool) => tool.id);
            for (const excluded of ["info", "delete", "retry", "node-lock", "trimRegenerate", "extractFrames"]) {
                expect(ids).not.toContain(excluded);
            }
        }
    });

    test("★ 注册表无重复项（防测试/运行时重复注册）", () => {
        const ids = getToolbarTools("node-hover").map((tool) => tool.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBe(nodeHoverToolbarTools.length);
    });
});

describe("★ 锚点 ②：direct 进入用户按钮集合不变（零门控）", () => {
    test("professional 态返回全量（不被 guide 白名单影响）", () => {
        // ★ 用文本节点（工具面最完整，applicable 过滤最少）验证「全量」语义
        const ctx = ctxFor("professional", textNode);
        const tools = resolveToolbarTools("node-hover", ctx, defaultToolbarPrefs("node-hover"));
        const ids = tools.map((tool) => tool.id);
        // 全量注册表里的工具都应在（除 applicable 排除的）
        expect(ids.length).toBeGreaterThan(6);
        // 系统动作在全量态可见（证明零门控）
        expect(ids).toContain("info");
        expect(ids).toContain("delete");
    });

    test("★ professional 态返回集合 = 未加 guide 过滤时的集合（回归锚点）", () => {
        const ctx = ctxFor("professional", imageNode);
        const tools = resolveToolbarTools("node-hover", ctx, defaultToolbarPrefs("node-hover"));
        const ids = tools.map((tool) => tool.id);
        // 手工复算（applicable 过滤 + prefs 隐藏），不含 guide 白名单
        const expected = getToolbarTools("node-hover")
            .filter((tool) => !tool.applicable || tool.applicable(ctx))
            .filter((tool) => !new Set(defaultToolbarPrefs("node-hover").hidden).has(tool.id))
            .map((tool) => tool.id);
        expect(ids.sort()).toEqual(expected.sort());
    });

    test("★ simple 态语义不受影响（上游既有值，两套判据分开写）", () => {
        const ctx = ctxFor("simple", videoNode);
        const ids = resolveToolbarTools("node-hover", ctx, defaultToolbarPrefs("node-hover")).map((tool) => tool.id);
        // simple 是黑名单式排除：视频节点上仍返回多项（远多于 6），且不含被 simpleMode 排除的视频类
        expect(ids.length).toBeGreaterThan(6);
        expect(ids).not.toContain("extractFrames");
        expect(ids).not.toContain("extractAudio");
        expect(ids).not.toContain("trimRegenerate");
        // 非排除项保留（黑名单语义：不列在排除表里的都留）
        expect(ids).toContain("info");
    });

    test("★ guide 与 simple 是两套判据：guide ≤ 6 项、simple 保留多数项", () => {
        // ★ 用文本节点对比（图片节点上 simple 黑名单也只剩 5 项，差异不明显）：
        // 文本节点 simple 态保留 edit/editText/generateImage + 字号类（减/增字号），而 guide 只留白名单。
        const guideIds = resolveToolbarTools("node-hover", ctxFor("guide", textNode), defaultToolbarPrefs("node-hover")).map((tool) => tool.id);
        const simpleIds = resolveToolbarTools("node-hover", ctxFor("simple", textNode), defaultToolbarPrefs("node-hover")).map((tool) => tool.id);
        expect(guideIds.length).toBeLessThanOrEqual(6);
        expect(simpleIds.length).toBeGreaterThan(6);
        expect(guideIds).not.toEqual(simpleIds);
        // 两套判据的具体差异：info 在 simple 保留（黑名单不排它），在 guide 被白名单滤掉
        expect(simpleIds).toContain("info");
        expect(guideIds).not.toContain("info");
    });
});

describe("★ 接线源码：四件就位", () => {
    test("① types/canvas.ts 含 guide 值（simple 语义未动）", () => {
        const source = read("src/types/canvas.ts");
        expect(source).toContain('export type CanvasWorkspaceMode = "simple" | "professional" | "guide"');
    });

    test("② project.tsx 默认分支保持 professional", () => {
        const source = read("src/pages/canvas/project.tsx");
        // 默认分支必须是 professional（红线）
        expect(source).toContain('return "professional"');
        // 入口钩子读 mode=guide
        expect(source).toContain('searchParams.get("mode") === "guide"');
        // 毕业粘性
        expect(source).toContain("graduated");
    });

    test("③ tool-registry 集中白名单过滤（单一真值 GUIDE_VISIBLE_TOOL_IDS）", () => {
        const source = read("src/lib/canvas/tool-registry/tool-registry.ts");
        expect(source).toContain("GUIDE_VISIBLE_TOOL_IDS");
        expect(source).toContain('ctx.workspaceMode === "guide"');
        // 不得硬编码 6 个 id
        expect(source).not.toContain('"generateImage"');
    });

    test("④ 入口钩子：linear-flow-runner 交接带 mode=guide", () => {
        const source = read("src/pages/create/index.tsx");
        expect(source).toContain('mode: "guide"');
    });

    test("④ 顶栏「完整画布」出口仅在引导态传入", () => {
        const projectSource = read("src/pages/canvas/project.tsx");
        expect(projectSource).toContain('guideExit={workspaceMode === "guide" ? { onExit: graduateToFullCanvas } : undefined}');
        const topBarSource = read("src/pages/canvas/canvas-project-top-bar.tsx");
        expect(topBarSource).toContain("guideExit");
        expect(topBarSource).toContain("完整画布");
    });
});

describe("★ 状态机与载体的语义一致性", () => {
    test("graduated sticky：已毕业用户再次从卡流程进入仍是 professional", () => {
        // 载体层：graduated 为 true 时 workspaceMode 推导返回 professional
        const projectSource = read("src/pages/canvas/project.tsx");
        const memoBlock = projectSource.slice(projectSource.indexOf("const workspaceMode"), projectSource.indexOf("const workspaceMode") + 600);
        expect(memoBlock).toContain("if (graduated) return \"professional\"");
        // 状态机层：resolveGuideState 同样保证单向粘性
        expect(resolveGuideState({ current: "graduate", entry: "linear-flow" })).toBe("graduate");
    });

    test("★ 毕业标记持久化字段在 store 类型与 updateProject 白名单内", () => {
        const storeSource = read("src/stores/canvas/use-canvas-store.ts");
        expect(storeSource).toContain("graduated?: boolean");
        expect(storeSource).toContain('"graduated"');
        // importProject 保留该字段（存量项目往返不丢）
        expect(storeSource).toContain("graduated: source.graduated");
    });
});

describe("★ 循环依赖防线（实测教训：白名单必须在叶子模块）", () => {
    test("tool-registry 从叶子模块导入白名单（不从 graduation-state）", () => {
        const source = read("src/lib/canvas/tool-registry/tool-registry.ts");
        expect(source).toContain('from "@/lib/canvas/graduation-tools"');
        expect(source).not.toContain('from "@/lib/canvas/graduation-state"');
    });

    test("叶子模块零依赖（不 import 任何注册表/状态机）", () => {
        const source = read("src/lib/canvas/graduation-tools.ts");
        // 只允许注释里提及，代码区不得有 import
        const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        expect(codeOnly).not.toContain("import ");
    });

    test("★ 白名单单一真值：叶子模块定义，graduation-state re-export", () => {
        const leaf = read("src/lib/canvas/graduation-tools.ts");
        const state = read("src/lib/canvas/graduation-state.ts");
        expect(leaf).toContain("export const GUIDE_VISIBLE_TOOL_IDS");
        expect(state).toContain("export { GUIDE_VISIBLE_TOOL_COUNT, GUIDE_VISIBLE_TOOL_IDS }");
        // state 里不得再重复定义字面量清单
        expect(state).not.toContain('"generateImage",');
    });

    test("★ 运行时验证：注册表可用且无重复（循环依赖会在此炸）", () => {
        const ids = getToolbarTools("node-hover").map((tool) => tool.id);
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
