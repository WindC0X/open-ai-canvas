import { expect, test, describe } from "bun:test";

import { detectScenePresetFromPrompt, isSceneGenerationNode, resolveSceneExecution } from "@/lib/canvas/scene-execution";
import { scenePresetBrief } from "@/components/canvas/scene-preset-chips";
import { SCENE_PRESETS, findScenePreset } from "@/lib/canvas/scene-presets";
import type { CanvasNodeData } from "@/types/canvas";

/**
 * F-02 场景图执行接线单测（纯逻辑，零 DOM）。
 *
 * 覆盖：标记识别（元数据优先 + 文本兜底）/ 生成链路改写 /
 * 非场景任务零介入（回归保护）。
 */

function node(metadata: CanvasNodeData["metadata"] = {}, title = "商品图"): CanvasNodeData {
    return {
        id: "scene-node",
        type: "image" as CanvasNodeData["type"],
        title,
        position: { x: 0, y: 0 },
        width: 320,
        height: 180,
        metadata,
    };
}

describe("场景任务识别", () => {
    test("元数据标记优先命中", () => {
        expect(isSceneGenerationNode(node({ scenePresetId: "kitchen-morning" }))).toBe(true);
    });

    test("★ 无标记时按 brief 句式兜底识别（过渡形态的标记传递路径）", () => {
        const brief = scenePresetBrief(findScenePreset("kitchen-morning")!);
        expect(detectScenePresetFromPrompt(brief)?.id).toBe("kitchen-morning");
    });

    test("每个场景的 brief 都能被反查回自身（句式稳定）", () => {
        for (const preset of SCENE_PRESETS) {
            const brief = scenePresetBrief(preset);
            expect({ id: preset.id, detected: detectScenePresetFromPrompt(brief)?.id }).toEqual({
                id: preset.id,
                detected: preset.id,
            });
        }
    });

    test("非场景提示词不误命中（普通生成零介入）", () => {
        expect(detectScenePresetFromPrompt("画一只猫在沙发上")).toBeUndefined();
        expect(detectScenePresetFromPrompt("")).toBeUndefined();
        // 含场景名但不含「商拍场景图」句式 → 不命中
        expect(detectScenePresetFromPrompt("帮我做个「晨光厨房」风格的海报")).toBeUndefined();
    });

    test("★ 非场景节点不被判定为场景任务（既有生成路径零影响）", () => {
        expect(isSceneGenerationNode(node({ prompt: "画一只猫" }))).toBe(false);
        expect(isSceneGenerationNode(undefined)).toBe(false);
    });
});

describe("★ 生成链路改写（resolveSceneExecution）", () => {
    test("非场景任务返回 null（不介入既有路径）", () => {
        const result = resolveSceneExecution(node({ prompt: "画一只猫" }), "画一只猫");
        expect(result).toBeNull();
    });

    test("场景任务：提示词被追加 @[ref] 角色声明", () => {
        const brief = scenePresetBrief(findScenePreset("kitchen-morning")!);
        const result = resolveSceneExecution(node({ scenePresetId: "kitchen-morning" }), brief);
        expect(result).not.toBeNull();
        expect(result?.prompt).toContain("INPUT ROLES:");
        expect(result?.prompt).toContain("@[product] = PRODUCT_REFERENCE.");
        expect(result?.scenePresetId).toBe("kitchen-morning");
    });

    test("★ 无场景参考图时不产出 @[scene]（避免声明不存在的输入）", () => {
        const brief = scenePresetBrief(findScenePreset("kitchen-morning")!);
        const result = resolveSceneExecution(node({ scenePresetId: "kitchen-morning" }), brief, {
            hasSceneReference: false,
        });
        expect(result?.prompt.includes("@[scene]")).toBe(false);
    });

    test("有场景参考图时产出防误用条款", () => {
        const brief = scenePresetBrief(findScenePreset("kitchen-morning")!);
        const result = resolveSceneExecution(node({ scenePresetId: "kitchen-morning" }), brief, {
            hasSceneReference: true,
        });
        expect(result?.prompt).toContain("Do NOT treat it as a second subject");
    });

    test("hasMask 时产出 mask 语义预写（含透明渲染为黑的坑）", () => {
        const brief = scenePresetBrief(findScenePreset("kitchen-morning")!);
        const result = resolveSceneExecution(node({ scenePresetId: "kitchen-morning" }), brief, { hasMask: true });
        expect(result?.prompt).toContain("It is a selection, not a reference photo");
        expect(result?.prompt).toContain("transparent and may render as black");
    });

    test("★ 空提示词走降智档（模板+变量，不依赖 LLM 产出）", () => {
        const result = resolveSceneExecution(node({ scenePresetId: "festive-party" }), "");
        expect(result?.degraded).toBe(true);
        expect(/\{\w+\}/.test(result?.prompt ?? "")).toBe(false);
        // Flora 实例场景的逐字道具仍在
        expect(result?.prompt).toContain("confetti");
    });

    test("非空提示词走正常档（消费链路产出的 prompt）", () => {
        const brief = scenePresetBrief(findScenePreset("kitchen-morning")!);
        const result = resolveSceneExecution(node({ scenePresetId: "kitchen-morning" }), brief);
        expect(result?.degraded).toBe(false);
    });

    test("显式 degraded 覆盖（弱渠道实测 / 演示用）", () => {
        const brief = scenePresetBrief(findScenePreset("kitchen-morning")!);
        const result = resolveSceneExecution(node({ scenePresetId: "kitchen-morning" }), brief, { degraded: true });
        expect(result?.degraded).toBe(true);
    });

    test("★ 文本兜底路径同样能触发改写（过渡形态可用）", () => {
        const brief = scenePresetBrief(findScenePreset("stone-terrace")!);
        const result = resolveSceneExecution(node({}, "商品图"), brief);
        expect(result).not.toBeNull();
        expect(result?.scenePresetId).toBe("stone-terrace");
        expect(result?.prompt).toContain("INPUT ROLES:");
    });
});
