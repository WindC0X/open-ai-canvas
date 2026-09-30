import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildImageToolbarTools } from "../src/components/canvas/canvas-image-toolbar-tools";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

const read = (path: string) => readFileSync(resolve(import.meta.dir, "../src", path), "utf8");
const flat = (text: string) => text.replace(/\s+/g, " ");

/**
 * 入口整合守卫（控制线 2026-10-01 追加裁定）。
 *
 * 用户真机抽验发现两条「去背景」链并存：工具栏默认走生成式（扣积分），
 * 本地 WASM 路线没有曝光入口。这些断言盯住整合后的分流形态：
 * 默认走本地，已抠过的结果节点才提供生成式精修。
 */

const imageNode = (metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData => ({
    id: "image-1",
    type: CanvasNodeType.Image,
    title: "测试图",
    position: { x: 0, y: 0 },
    width: 300,
    height: 200,
    metadata: { content: "data:image/png;base64,AAAA", ...metadata },
});

/** 记录 run 实际调用了哪个 handler。 */
function toolFor(node: CanvasNodeData) {
    const calls: string[] = [];
    const handlers = {
        onRemoveBackground: () => calls.push("onRemoveBackground"),
        onRemoveBackgroundLocal: () => calls.push("onRemoveBackgroundLocal"),
        onRemoveBackgroundGenerative: () => calls.push("onRemoveBackgroundGenerative"),
    } as unknown as Parameters<typeof buildImageToolbarTools>[1];
    const tool = buildImageToolbarTools(node, handlers).find((item) => item.id === "removeBackground")!;
    return { tool, calls };
}

describe("去除背景入口整合", () => {
    test("普通图片默认走本地抠图，不弹生成式对话框", () => {
        const { tool, calls } = toolFor(imageNode());
        expect(tool.label).toBe("去除背景");
        expect(tool.description).toBe("本地识别，免费离线，逐像素保真");
        tool.onClick();
        expect(calls).toEqual(["onRemoveBackgroundLocal"]);
    });

    test("本地抠图结果节点提供生成式精修入口", () => {
        const { tool, calls } = toolFor(imageNode({ backgroundRemoval: { mode: "local" } }));
        expect(tool.label).toBe("用 AI 模型重新去除");
        expect(tool.description).toBe("AI 模型重画，适合复杂边缘，消耗积分");
        tool.onClick();
        expect(calls).toEqual(["onRemoveBackgroundGenerative"]);
    });

    test("生成式档位明确标注消耗积分（诚实文案）", () => {
        const { tool } = toolFor(imageNode({ backgroundRemoval: { mode: "local" } }));
        expect(tool.description).toContain("消耗积分");
        // 不承诺发丝级：透明/高反光仍是已知弱项。
        expect(tool.description).not.toContain("发丝");
        expect(toolFor(imageNode()).tool.description).not.toContain("发丝");
    });

    test("两档共用同一个工具位（不新增工具项、默认入口不消失）", () => {
        const plain = buildImageToolbarTools(imageNode(), {} as Parameters<typeof buildImageToolbarTools>[1]);
        const result = buildImageToolbarTools(imageNode({ backgroundRemoval: { mode: "local" } }), {} as Parameters<typeof buildImageToolbarTools>[1]);
        const count = (tools: ReturnType<typeof buildImageToolbarTools>) => tools.filter((item) => item.id === "removeBackground").length;
        expect(count(plain)).toBe(1);
        expect(count(result)).toBe(1);
        expect(plain.map((item) => item.id)).toEqual(result.map((item) => item.id));
    });

    test("本地档落到画布子节点，并标记来源档位", () => {
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        // 走本地 worker，不是生成任务。
        expect(tools).toContain("runBrowserCutout(source.url)");
        expect(tools).toContain('backgroundRemoval: { mode: "local" }');
        // 结果作为子节点连接并选中（与裁剪/标注同范式，不弹对话框）。
        expect(tools).toContain("fromNodeId: node.id, toNodeId: childId");
        // 重入守卫：首次要下 90MB，重复点按会并发起多个请求。
        expect(tools).toContain("localCutoutInFlightRef");
    });

    test("生成式档位仍走既有 image-edit 对话框（上游能力保留）", () => {
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        expect(tools).toContain("openBackgroundRemovalGenerative");
        expect(tools).toContain('setImageEditPreset("remove-background")');
        expect(tools).toContain("setImageEditNodeId(node.id)");
    });

    test("访客态保持未授权提示，不因整合而放行", () => {
        const shared = flat(read("pages/canvas/shared.tsx"));
        expect(shared).toContain("onRemoveBackground={unauthorized}");
        expect(shared).toContain("onRemoveBackgroundLocal={unauthorized}");
        expect(shared).toContain("onRemoveBackgroundGenerative={unauthorized}");
    });

    test("工具栏 handlers 三档都透传（缺失会让工具点击静默失效）", () => {
        const toolbar = flat(read("components/canvas/canvas-node-toolbar.tsx"));
        expect(toolbar).toContain("onRemoveBackgroundLocal");
        expect(toolbar).toContain("onRemoveBackgroundGenerative");
        const project = flat(read("pages/canvas/project.tsx"));
        expect(project).toContain("onRemoveBackgroundLocal={removeBackgroundLocally}");
        expect(project).toContain("onRemoveBackgroundGenerative={openBackgroundRemovalGenerative}");
    });
});
