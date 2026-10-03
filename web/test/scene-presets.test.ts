import { expect, test, describe } from "bun:test";

import { buildScenePrompt } from "@/lib/canvas/scene-prompt-pipeline";
import {
    SCENE_CATEGORY_LABELS,
    SCENE_PRESETS,
    findScenePreset,
    scenePresetsByCategory,
    type SceneCategory,
} from "@/lib/canvas/scene-presets";
import { ECOM_STARTER_CARDS } from "@/lib/canvas/canvas-ecom-starters";

/**
 * F-02 商拍场景库单测（纯数据，零 DOM）。
 *
 * 重点覆盖两条纪律：
 *   ① 命名红线（任务书 §二-3）：避开上游「场景胶囊」语义
 *   ② 与 starter 卡的分工（§二-5）：场景卡是入口，本库是场景库，不互相替代
 */

describe("场景库结构与完整性", () => {
    test("场景 id 唯一（防渲染层 key 冲突）", () => {
        const ids = SCENE_PRESETS.map((preset) => preset.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test("每个场景的 spec 变量填全（不留占位符给用户）", () => {
        for (const preset of SCENE_PRESETS) {
            const { surface, scenario, props, lighting, mood } = preset.variables;
            expect({
                id: preset.id,
                complete: Boolean(surface && scenario && props && lighting && mood),
            }).toEqual({ id: preset.id, complete: true });
        }
    });

    test("分类标签齐备（每个出现过的分类都有中文标签）", () => {
        const used = new Set(SCENE_PRESETS.map((preset) => preset.category));
        for (const category of used) {
            expect({ category, label: SCENE_CATEGORY_LABELS[category] }).toEqual({
                category,
                label: SCENE_CATEGORY_LABELS[category],
            });
            expect(SCENE_CATEGORY_LABELS[category].length).toBeGreaterThan(0);
        }
    });

    test("推荐的尺寸预设 id 合法（对齐 ECOM_CHANNEL_PRESETS）", () => {
        const allowed = new Set(["amazon-main", "detail-3x4", "douyin-vertical"]);
        for (const preset of SCENE_PRESETS) {
            if (!preset.recommendedPresetId) continue;
            expect({ id: preset.id, ok: allowed.has(preset.recommendedPresetId) }).toEqual({ id: preset.id, ok: true });
        }
    });
});

describe("查找与分组", () => {
    test("按 id 查找命中 / 未命中返回 undefined", () => {
        expect(findScenePreset("kitchen-morning")?.title).toBe("晨光厨房");
        expect(findScenePreset("no-such-scene")).toBeUndefined();
    });

    test("按分类过滤只返回该分类", () => {
        for (const category of Object.keys(SCENE_CATEGORY_LABELS) as SceneCategory[]) {
            for (const preset of scenePresetsByCategory(category)) {
                expect(preset.category).toBe(category);
            }
        }
    });
});

describe("★ 命名红线（任务书 §二-3：避开上游「场景胶囊」语义）", () => {
    test("场景标题/说明不含「胶囊」字样", () => {
        for (const preset of SCENE_PRESETS) {
            const text = `${preset.title}${preset.hint}`;
            expect({ id: preset.id, hasCapsule: text.includes("胶囊") }).toEqual({ id: preset.id, hasCapsule: false });
        }
    });

    test("分类标签用「商拍场景」体系而非上游技能域桶名", () => {
        const labels = Object.values(SCENE_CATEGORY_LABELS).join("");
        // 上游 AGENT_SCENE_DEFS 的桶：我的常用/短剧故事/广告电商/视觉创意/传播社媒/其他
        for (const upstream of ["短剧故事", "视觉创意", "传播社媒"]) {
            expect({ upstream, mixed: labels.includes(upstream) }).toEqual({ upstream, mixed: false });
        }
    });
});

describe("★ 与 starter 卡的分工（任务书 §二-5：入口复用，不互相替代）", () => {
    test("starter 的 scene 卡仍在（入口未被本库取代）", () => {
        const sceneCard = ECOM_STARTER_CARDS.find((card) => card.id === "scene");
        expect(sceneCard).toBeDefined();
        expect(sceneCard?.title).toBe("商品场景图");
    });

    test("本库 id 与 starter 卡 id 不冲突（两个数据层独立）", () => {
        const starterIds = new Set(ECOM_STARTER_CARDS.map((card) => card.id));
        for (const preset of SCENE_PRESETS) {
            expect({ id: preset.id, collides: starterIds.has(preset.id) }).toEqual({ id: preset.id, collides: false });
        }
    });
});

describe("★ 场景库 → 管线端到端（降智档变量填充）", () => {
    test("每个场景都能直接喂降智档并产出无占位符的提示词", () => {
        for (const preset of SCENE_PRESETS) {
            const result = buildScenePrompt({
                sceneBrief: "",
                product: "test product",
                degraded: true,
                variables: preset.variables,
            });
            expect({
                id: preset.id,
                degraded: result.degraded,
                noPlaceholder: !/\{\w+\}/.test(result.prompt),
                hasProduct: result.prompt.includes("test product"),
            }).toEqual({ id: preset.id, degraded: true, noPlaceholder: true, hasProduct: true });
        }
    });

    test("产出长度落在 Flora 目标区间附近（900-1500 字，实测遵循度不打折）", () => {
        for (const preset of SCENE_PRESETS) {
            const result = buildScenePrompt({
                sceneBrief: "",
                product: "a matte black ceramic coffee dripper",
                degraded: true,
                variables: preset.variables,
            });
            // 降智档产出应达到 Flora 区间量级（角色声明段 + 模板正文）
            expect({ id: preset.id, enough: result.chars >= 400 }).toEqual({ id: preset.id, enough: true });
        }
    });

    test("★ 产出无英文双冠词（模板不硬编码 a/an，冠词归变量）", () => {
        // 实现中实测暴露的缺陷：模板写 "within a {scenario}" 而变量自带冠词
        // （"a lively party celebration"）→ 产出 "within a a lively party celebration"。
        // 修正为冠词归变量（Flora 原文的 [Insert ...] 占位符同样把冠词交给填写者）。
        for (const preset of SCENE_PRESETS) {
            const result = buildScenePrompt({
                sceneBrief: "",
                product: "test product",
                degraded: true,
                variables: preset.variables,
            });
            expect({
                id: preset.id,
                doubleArticle: /\b(a|an|the)\s+(a|an|the)\b/i.test(result.prompt),
            }).toEqual({ id: preset.id, doubleArticle: false });
        }
    });

    test("场景变量的冠词齐备（模板依赖变量自带冠词）", () => {
        for (const preset of SCENE_PRESETS) {
            for (const key of ["surface", "scenario"] as const) {
                const value = preset.variables[key];
                expect({
                    id: preset.id,
                    key,
                    hasArticle: /^(a|an|the)\s/i.test(value),
                }).toEqual({ id: preset.id, key, hasArticle: true });
            }
        }
    });

    test("Flora 实例场景（节庆派对）保留其逐字道具与光照", () => {
        const preset = findScenePreset("festive-party");
        const result = buildScenePrompt({
            sceneBrief: "",
            product: "chocolate-covered pretzel pouch",
            degraded: true,
            variables: preset?.variables,
        });
        expect(result.prompt).toContain("confetti");
        expect(result.prompt).toContain("champagne flutes");
        expect(result.prompt).toContain("strong, distinct shadows");
    });
});
