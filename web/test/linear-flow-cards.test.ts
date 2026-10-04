import { expect, test, describe } from "bun:test";

import {
    LINEAR_FLOW_CARDS,
    LINEAR_FLOW_CARD_LIMIT,
    LINEAR_FLOW_QUESTION_LIMIT,
    buildLinearFlowMetadata,
    buildLinearFlowPrompt,
    findLinearFlowCard,
    linearFlowAnswersComplete,
    resolveLinearFlowScenePresetId,
    starterForLinearFlowCard,
} from "@/lib/canvas/linear-flow-cards";
import { ECOM_STARTER_CARDS } from "@/lib/canvas/canvas-ecom-starters";
import { SCENE_PRESETS, findScenePreset } from "@/lib/canvas/scene-presets";

/**
 * W5 直线入口卡 —— 数据层单测（纯逻辑，零 DOM）。
 *
 * 覆盖（设计卡 §6.2 验收 4/5/6/7）：
 *   验收 5 卡命名按任务 / 验收 6 首批 ≤8 张 / 验收 7 休眠卡唤醒 / 债一 scenePresetId 显式传递
 */

describe("首批卡清单（设计卡 §3.1 + 控制线裁定②）", () => {
    test("首批卡数量 ≤8（控制线裁定上限）", () => {
        expect(LINEAR_FLOW_CARDS.length).toBeLessThanOrEqual(LINEAR_FLOW_CARD_LIMIT);
    });

    test("本轮实际 4 张（不新造数据，8 是上限不是配额）", () => {
        expect(LINEAR_FLOW_CARDS).toHaveLength(4);
    });

    test("卡 id 唯一", () => {
        const ids = LINEAR_FLOW_CARDS.map((card) => card.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test("每张卡都来自休眠 starter（验收 7：4 张全收，不新造数据）", () => {
        const starterIds = LINEAR_FLOW_CARDS.map((card) => card.starterId);
        expect(new Set(starterIds)).toEqual(new Set(ECOM_STARTER_CARDS.map((starter) => starter.id)));
        for (const card of LINEAR_FLOW_CARDS) {
            expect(starterForLinearFlowCard(card)).toBeDefined();
        }
    });

    test("★ 卡命名按任务不按能力（验收 5）", () => {
        const titles = LINEAR_FLOW_CARDS.map((card) => card.title);
        expect(titles).toContain("白底主图");
        expect(titles).toContain("场景图");
        // 能力词不得作为卡名（DESIGN.md 命名分流红线）
        for (const title of titles) {
            for (const forbidden of ["抠图", "超分", "合成", "重绘", "放大"]) {
                expect(title).not.toContain(forbidden);
            }
        }
    });

    test("每张卡的澄清问题 ≤3（设计卡「≤3 问」硬约束）", () => {
        for (const card of LINEAR_FLOW_CARDS) {
            expect(card.questions.length).toBeLessThanOrEqual(LINEAR_FLOW_QUESTION_LIMIT);
            expect(card.questions.length).toBeGreaterThan(0);
        }
    });

    test("选择题问必须带选项；文本问必须有 placeholder", () => {
        for (const card of LINEAR_FLOW_CARDS) {
            for (const question of card.questions) {
                if (question.kind === "select") {
                    expect(question.options?.length || 0).toBeGreaterThan(0);
                } else {
                    expect(question.placeholder).toBeTruthy();
                }
            }
        }
    });

    test("图片卡接受参考图；纯文本卡不接受", () => {
        expect(findLinearFlowCard("white-background-main")?.acceptsReference).toBe(true);
        expect(findLinearFlowCard("scene-shot")?.acceptsReference).toBe(true);
        expect(findLinearFlowCard("batch-prompt-tune")?.acceptsReference).toBe(false);
    });

    test("batch-prompt-tune 是唯一文本模式卡（无出图步）", () => {
        const textCards = LINEAR_FLOW_CARDS.filter((card) => card.mode === "text");
        expect(textCards).toHaveLength(1);
        expect(textCards[0].id).toBe("batch-prompt-tune");
    });
});

describe("★ 债一：scenePresetId 显式传递（验收 4）", () => {
    test("场景卡携带 scenePresetId；非场景卡不带", () => {
        expect(findLinearFlowCard("scene-shot")?.scenePresetId).toBe("kitchen-morning");
        expect(findLinearFlowCard("white-background-main")?.scenePresetId).toBeUndefined();
        expect(findLinearFlowCard("batch-prompt-tune")?.scenePresetId).toBeUndefined();
    });

    test("卡默认 scenePresetId 必须存在于场景库（防悬空引用）", () => {
        for (const card of LINEAR_FLOW_CARDS) {
            if (!card.scenePresetId) continue;
            expect(findScenePreset(card.scenePresetId)).toBeDefined();
        }
    });

    test("选择题选项里的场景 id 也必须在场景库内（防悬空引用）", () => {
        const sceneCard = findLinearFlowCard("scene-shot")!;
        const sceneQuestion = sceneCard.questions.find((question) => question.id === "scenePreset")!;
        for (const option of sceneQuestion.options || []) {
            expect(findScenePreset(option.value)).toBeDefined();
        }
    });

    test("用户答案覆盖卡默认值", () => {
        const card = findLinearFlowCard("scene-shot")!;
        expect(resolveLinearFlowScenePresetId(card, {})).toBe("kitchen-morning");
        expect(resolveLinearFlowScenePresetId(card, { scenePreset: "cafe-table" })).toBe("cafe-table");
    });

    test("非场景卡永远返回 undefined（生成链路零介入）", () => {
        const card = findLinearFlowCard("white-background-main")!;
        expect(resolveLinearFlowScenePresetId(card, { scenePreset: "cafe-table" })).toBeUndefined();
    });

    test("★ 元数据显式携带 scenePresetId（零反查：不经 detectScenePresetFromPrompt）", () => {
        const card = findLinearFlowCard("scene-shot")!;
        const metadata = buildLinearFlowMetadata(card, { scenePreset: "cafe-table" });
        expect(metadata.scenePresetId).toBe("cafe-table");
        expect(metadata.source).toBe("linear-flow");
        expect(metadata.linearFlowCardId).toBe("scene-shot");
    });

    test("非场景卡的元数据不含 scenePresetId 字段", () => {
        const metadata = buildLinearFlowMetadata(findLinearFlowCard("white-background-main")!);
        expect("scenePresetId" in metadata).toBe(false);
    });
});

describe("提示词构建（纯函数）", () => {
    test("模板占位符按答案填充", () => {
        const card = findLinearFlowCard("white-background-main")!;
        const prompt = buildLinearFlowPrompt(card, { product: "白色陶瓷马克杯", angle: "45 度俯视" });
        expect(prompt).toContain("白色陶瓷马克杯");
        expect(prompt).toContain("45 度俯视");
        expect(prompt).not.toContain("{{");
    });

    test("★ 场景卡用场景库的用户面中文 brief（不混入模型面英文变量）", () => {
        const card = findLinearFlowCard("scene-shot")!;
        const prompt = buildLinearFlowPrompt(card, { product: "白色陶瓷马克杯", scenePreset: "kitchen-morning" });
        const preset = findScenePreset("kitchen-morning")!;
        expect(prompt).toContain(preset.brief);
        // 模型面英文变量（a sunlit minimalist kitchen）不得出现在中文 brief 里
        expect(prompt).not.toContain("a sunlit minimalist kitchen");
    });

    test("未填的占位符被清空而不是留 {{}}", () => {
        const card = findLinearFlowCard("white-background-main")!;
        const prompt = buildLinearFlowPrompt(card, {});
        expect(prompt).not.toContain("{{");
    });

    test("场景库 10 条全部可用于场景卡（数据面可达）", () => {
        const card = findLinearFlowCard("scene-shot")!;
        for (const preset of SCENE_PRESETS) {
            const prompt = buildLinearFlowPrompt(card, { product: "商品", scenePreset: preset.id });
            expect(prompt).toContain(preset.brief);
        }
    });
});

describe("答案完整性（runner 的「下一步」门控）", () => {
    test("必答项未填 → 不完整", () => {
        const card = findLinearFlowCard("white-background-main")!;
        expect(linearFlowAnswersComplete(card, {})).toBe(false);
        expect(linearFlowAnswersComplete(card, { product: "杯子" })).toBe(false);
        expect(linearFlowAnswersComplete(card, { product: "杯子", angle: "正面平视" })).toBe(true);
    });

    test("空白字符串不算已答", () => {
        const card = findLinearFlowCard("white-background-main")!;
        expect(linearFlowAnswersComplete(card, { product: "   ", angle: "正面平视" })).toBe(false);
    });

    test("每张卡在给出全部答案后可完成", () => {
        for (const card of LINEAR_FLOW_CARDS) {
            const answers: Record<string, string> = {};
            for (const question of card.questions) {
                answers[question.id] = question.kind === "select" ? question.options![0].value : "测试值";
            }
            expect(linearFlowAnswersComplete(card, answers)).toBe(true);
        }
    });
});
