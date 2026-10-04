import { expect, test, describe } from "bun:test";

import { buildLinearFlowMetadata, findLinearFlowCard } from "@/lib/canvas/linear-flow-cards";
import { isSceneGenerationNode, resolveSceneExecution } from "@/lib/canvas/scene-execution";
import { findScenePreset } from "@/lib/canvas/scene-presets";
import type { CanvasNodeData } from "@/types/canvas";

/**
 * W5 债一兑现 —— scenePresetId 显式传递端到端（设计卡 §2.1 + §6.2 验收 4）。
 *
 * ★ 本测试证明的是**链路语义**：直线卡产出的元数据直接进节点 → 执行器标记优先命中 →
 * **零文本反查**（不经过 detectScenePresetFromPrompt 的句式匹配）。
 */

function nodeFromLinearFlow(cardId: string, answers: Record<string, string> = {}): CanvasNodeData {
    const card = findLinearFlowCard(cardId)!;
    const metadata = buildLinearFlowMetadata(card, answers);
    return {
        id: "linear-flow-node",
        type: "image" as CanvasNodeData["type"],
        title: "卡流程节点",
        position: { x: 0, y: 0 },
        width: 320,
        height: 320,
        metadata: {
            ...metadata,
            // ★ 故意写一个**不含场景句式**的提示词 —— 若链路走反查则必然识别失败。
            prompt: "商品场景图，把商品放进真实使用场景",
        },
    };
}

describe("★ 债一：直线卡 → 节点元数据 → 执行器（零反查）", () => {
    test("场景卡的节点直接带 scenePresetId（不依赖提示词句式）", () => {
        const node = nodeFromLinearFlow("scene-shot", { scenePreset: "cafe-table" });
        expect(node.metadata?.scenePresetId).toBe("cafe-table");
        // 提示词不含「「X」风格的商拍场景图」句式 —— 反查路径不可能命中
        expect(String(node.metadata?.prompt)).not.toContain("商拍场景图");
        expect(String(node.metadata?.prompt)).not.toContain("「");
    });

    test("★ 反证：同一提示词去掉元数据标记后，反查无法识别（证明标记是唯一传递路径）", () => {
        const marked = nodeFromLinearFlow("scene-shot", { scenePreset: "cafe-table" });
        const unmarked: CanvasNodeData = { ...marked, metadata: { ...marked.metadata, scenePresetId: undefined } };
        expect(isSceneGenerationNode(marked)).toBe(true);
        expect(isSceneGenerationNode(unmarked)).toBe(false);
    });

    test("执行器按标记解析出正确的场景预设（零反查）", () => {
        const node = nodeFromLinearFlow("scene-shot", { scenePreset: "cafe-table" });
        const runtime = resolveSceneExecution(node, String(node.metadata?.prompt));
        expect(runtime).not.toBeNull();
        expect(runtime?.scenePresetId).toBe("cafe-table");
    });

    test("非场景卡的节点不带标记，执行器完全不介入", () => {
        const node = nodeFromLinearFlow("white-background-main", { product: "马克杯", angle: "正面平视" });
        expect(node.metadata?.scenePresetId).toBeUndefined();
        expect(isSceneGenerationNode(node)).toBe(false);
        expect(resolveSceneExecution(node, "电商白底产品主图，白色陶瓷马克杯")).toBeNull();
    });

    test("卡默认值在无答案时生效（用户跳过场景选择仍可执行）", () => {
        const node = nodeFromLinearFlow("scene-shot");
        expect(node.metadata?.scenePresetId).toBe("kitchen-morning");
        const runtime = resolveSceneExecution(node, "商品场景图");
        expect(runtime?.scenePresetId).toBe("kitchen-morning");
    });

    test("执行器产出的是场景模板提示词（含商品角色声明），不是原始 brief", () => {
        const node = nodeFromLinearFlow("scene-shot", { scenePreset: "kitchen-morning" });
        const runtime = resolveSceneExecution(node, String(node.metadata?.prompt));
        expect(runtime).not.toBeNull();
        // F-02 场景执行的协议面：角色声明进最终提示词
        expect(runtime?.prompt).toContain("PRODUCT_REFERENCE");
    });

    test("场景库全部 10 条都能经直线卡路径命中（数据面全覆盖）", () => {
        const card = findLinearFlowCard("scene-shot")!;
        for (const preset of ["kitchen-morning", "living-room-afternoon", "cafe-table", "restaurant-plating", "outdoor-picnic", "stone-terrace", "studio-gradient", "studio-dramatic", "festive-party", "autumn-warmth"]) {
            const node = nodeFromLinearFlow("scene-shot", { scenePreset: preset });
            const runtime = resolveSceneExecution(node, "商品场景图");
            expect(runtime?.scenePresetId).toBe(preset);
            expect(findScenePreset(preset)).toBeDefined();
        }
        expect(card.scenePresetId).toBeDefined();
    });
});

describe("Agent 路径兜底保留（设计卡 §2.1：降为兜底不删）", () => {
    test("无标记时仍按稳定句式反查（Agent 路径不受影响）", () => {
        const agentNode: CanvasNodeData = {
            id: "agent-node",
            type: "image" as CanvasNodeData["type"],
            title: "商品图",
            position: { x: 0, y: 0 },
            width: 320,
            height: 320,
            metadata: { prompt: "帮我做一张「晨光厨房」风格的商拍场景图：把商品放进去" },
        };
        expect(isSceneGenerationNode(agentNode)).toBe(true);
        const runtime = resolveSceneExecution(agentNode, String(agentNode.metadata?.prompt));
        expect(runtime?.scenePresetId).toBe("kitchen-morning");
    });

    test("标记优先于句式（两者冲突时以标记为准）", () => {
        const node: CanvasNodeData = {
            id: "conflict-node",
            type: "image" as CanvasNodeData["type"],
            title: "商品图",
            position: { x: 0, y: 0 },
            width: 320,
            height: 320,
            metadata: {
                scenePresetId: "cafe-table",
                prompt: "帮我做一张「晨光厨房」风格的商拍场景图：把商品放进去",
            },
        };
        const runtime = resolveSceneExecution(node, String(node.metadata?.prompt));
        expect(runtime?.scenePresetId).toBe("cafe-table");
    });
});

describe("源码可达性（防链路被删改）", () => {
    test("scene-execution 注释已同步为「Agent 路径兜底」", async () => {
        const source = await Bun.file(new URL("../src/lib/canvas/scene-execution.ts", import.meta.url)).text();
        expect(source).toContain("Agent 路径兜底");
        expect(source).not.toContain("过渡形态的标记传递路径");
    });

    test("runner 把元数据传给生成任务（source: linear-flow）", async () => {
        const source = await Bun.file(new URL("../src/components/create/linear-flow-runner.tsx", import.meta.url)).text();
        expect(source).toContain("buildLinearFlowMetadata");
        expect(source).toContain("runBackendGenerationTask");
    });
});
