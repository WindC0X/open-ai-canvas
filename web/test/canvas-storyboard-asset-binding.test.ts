import { describe, expect, test } from "bun:test";

import { storyboardRowAssetBindingPatch } from "../src/lib/canvas/canvas-storyboard-assets";
import { CanvasNodeType, type CanvasNodeData, type StoryboardRow } from "../src/types/canvas";

function makeRow(overrides: Partial<StoryboardRow> = {}): StoryboardRow {
    return {
        id: "shot-1",
        shotNumber: 1,
        durationSeconds: 5,
        plotDescription: "",
        dialogue: "",
        characters: [],
        narrativeIntent: "",
        viewerPOV: "",
        performanceBlocking: "",
        shotSize: "",
        emotion: "",
        lightingAndAtmosphere: "",
        audioEffects: "",
        camera: "",
        motion: "",
        timeBeats: "",
        imageGenerationPrompt: "",
        videoMotionPrompt: "",
        mustHave: [],
        optionalDetails: [],
        continuityOut: "",
        negativePrompt: "",
        assetBindings: [],
        ...overrides,
    };
}

function makeNode(id: string, overrides: Partial<CanvasNodeData> = {}): CanvasNodeData {
    return { id, type: CanvasNodeType.Image, title: `节点-${id}`, position: { x: 0, y: 0 }, width: 320, height: 320, ...overrides };
}

function nodeMap(nodes: CanvasNodeData[] = []) {
    return new Map(nodes.map((node) => [node.id, node]));
}

describe("storyboardRowAssetBindingPatch", () => {
    test("add 图像节点 → role=style 且不动 characters", () => {
        const row = makeRow();
        const patch = storyboardRowAssetBindingPatch(row, "img-1", "add", nodeMap([makeNode("img-1")]));
        expect(patch).not.toBeNull();
        expect(patch!.assetBindings).toEqual([{ nodeId: "img-1", role: "style", priority: 60 }]);
        expect(patch!.characters).toEqual([]);
    });

    test("add character 节点 → role=character 且同步 characters(名字/资产id/图节点id)", () => {
        const row = makeRow();
        const hero = makeNode("hero", {
            metadata: { workflowKind: "character", characterName: "林夏", characterAssetId: "asset-hero", characterPrompt: "短剧女主" },
        });
        const patch = storyboardRowAssetBindingPatch(row, "hero", "add", nodeMap([hero]));
        expect(patch!.assetBindings).toEqual([{ nodeId: "hero", role: "character", priority: 100 }]);
        expect(patch!.characters).toEqual([{
            characterName: "林夏",
            characterAssetId: "asset-hero",
            characterDescription: "短剧女主",
            characterImageNodeId: "hero",
        }]);
    });

    test("add 同 nodeId 重复绑定 → null(幂等, 调用方跳过 setNodes)", () => {
        const row = makeRow({ assetBindings: [{ nodeId: "img-1", role: "style", priority: 60 }] });
        expect(storyboardRowAssetBindingPatch(row, "img-1", "add", nodeMap([makeNode("img-1")]))).toBeNull();
    });

    test("add 已有同 characterAssetId 的角色 → binding 追加但 characters 不重复", () => {
        const hero = makeNode("hero-v2", {
            metadata: { workflowKind: "character", characterName: "林夏", characterAssetId: "asset-hero" },
        });
        const row = makeRow({
            assetBindings: [{ nodeId: "hero-v1", role: "character", priority: 100 }],
            characters: [{ characterName: "林夏", characterAssetId: "asset-hero", characterImageNodeId: "hero-v1" }],
        });
        const patch = storyboardRowAssetBindingPatch(row, "hero-v2", "add", nodeMap([hero]));
        expect(patch!.assetBindings).toHaveLength(2);
        expect(patch!.characters).toHaveLength(1);
        expect(patch!.characters![0].characterImageNodeId).toBe("hero-v1");
    });

    test("remove 删 binding 并剔除对应 characters(characterImageNodeId 匹配)", () => {
        const row = makeRow({
            assetBindings: [
                { nodeId: "hero", role: "character", priority: 100 },
                { nodeId: "bg", role: "environment", priority: 90 },
            ],
            characters: [{ characterName: "林夏", characterAssetId: "asset-hero", characterImageNodeId: "hero" }],
        });
        const patch = storyboardRowAssetBindingPatch(row, "hero", "remove", nodeMap([makeNode("hero")]));
        expect(patch!.assetBindings).toEqual([{ nodeId: "bg", role: "environment", priority: 90 }]);
        expect(patch!.characters).toEqual([]);
    });

    test("remove 按 characterAssetId 兜底剔除同资产角色项", () => {
        const row = makeRow({
            assetBindings: [{ nodeId: "hero-v1", role: "character", priority: 100 }],
            characters: [{ characterName: "林夏", characterAssetId: "asset-hero", characterImageNodeId: "hero-v1" }],
        });
        const removed = makeNode("hero-v1", { metadata: { workflowKind: "character", characterAssetId: "asset-hero" } });
        const patch = storyboardRowAssetBindingPatch(row, "hero-v1", "remove", nodeMap([removed]));
        expect(patch!.characters).toEqual([]);
    });

    test("remove 未命中的 nodeId → null", () => {
        const row = makeRow();
        expect(storyboardRowAssetBindingPatch(row, "ghost", "remove", nodeMap())).toBeNull();
    });

    test("add 节点不存在于画布 → null(防御)", () => {
        expect(storyboardRowAssetBindingPatch(makeRow(), "missing", "add", nodeMap())).toBeNull();
    });
});

describe("storyboardRowAssetBindingPatch 上限(R18 自设计常量)", () => {
    test("add 超过 MAX_ROW_ASSET_BINDINGS=8 → null", () => {
        const bindings = Array.from({ length: 8 }, (_, index) => ({ nodeId: `n${index}`, role: "style" as const, priority: 60 }));
        const row = makeRow({ assetBindings: bindings });
        expect(storyboardRowAssetBindingPatch(row, "n8", "add", nodeMap([makeNode("n8")]))).toBeNull();
    });
    test("add 第 8 个(未超)正常返回 patch", () => {
        const bindings = Array.from({ length: 7 }, (_, index) => ({ nodeId: `n${index}`, role: "style" as const, priority: 60 }));
        const row = makeRow({ assetBindings: bindings });
        const patch = storyboardRowAssetBindingPatch(row, "n7", "add", nodeMap([makeNode("n7")]));
        expect(patch!.assetBindings).toHaveLength(8);
    });
});
