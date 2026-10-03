/**
 * F-02 商拍场景预设 —— 场景卡的**数据层**。
 *
 * ★ 命名纪律（任务书 §二-3，修-7 命名红线）：上游 Agent 技能域已占用「场景胶囊」
 * 语义（`AGENT_SCENE_DEFS` 的 frequent/drama/ecommerce/creative/social/others 六桶，
 * 见 canvas-cloud-agent-composer.tsx:42）。本模块一律用「**商拍场景**」限定词，
 * 不复用「场景胶囊」也不与之混用。
 *
 * 与 starter 卡的关系（任务书 §二-5，入口复用）：
 * `canvas-ecom-starters.ts` 的 `scene` 卡（id `"scene"`，title「商品场景图」）是
 * **入口**（休眠数据层，点击发出「意图 + 澄清指令」复合 prompt）；本模块是**场景库**
 * （用户选定具体场景后填充 spec 变量）。两者语义不同、互不替代。
 *
 * 场景模板变量对齐 Flora `Product in Scene Generator` 的六要素
 * （surface / scenario / props / lighting / mood），见 scene-prompt-pipeline.ts。
 */
import type { SceneSpecVariables } from "@/lib/canvas/scene-prompt-pipeline";

/** 场景分类（面向电商商拍，非上游技能域分类）。 */
export type SceneCategory = "home" | "food" | "nature" | "studio" | "seasonal";

export type ScenePreset = {
    id: string;
    /** 场景名（卡片标题）。 */
    title: string;
    /** 一句话说明（卡片副标题）。 */
    hint: string;
    category: SceneCategory;
    /**
     * spec 变量（对齐 Flora 六要素）。
     * 未填的项由管线保留占位符（暴露漏填），调用方应尽量填全。
     */
    variables: Omit<SceneSpecVariables, "product">;
    /** 推荐的渠道尺寸预设 id（对齐 `ECOM_CHANNEL_PRESETS`）。 */
    recommendedPresetId?: "amazon-main" | "detail-3x4" | "douyin-vertical";
};

/** 场景分类标签（渲染层用）。 */
export const SCENE_CATEGORY_LABELS: Record<SceneCategory, string> = {
    home: "居家生活",
    food: "餐饮美食",
    nature: "自然户外",
    studio: "影棚质感",
    seasonal: "节庆季节",
};

/**
 * 商拍场景库。
 *
 * 语料依据：Flora `Product in Scene Generator` 的实例场景（party celebration +
 * linen tablecloth + confetti/flutes + bright direct lighting）——本库按电商常见
 * 投放场景扩展，每个场景的 variables 可直接填 `SCENE_SPEC_TEMPLATE`。
 */
export const SCENE_PRESETS: ScenePreset[] = [
    {
        id: "kitchen-morning",
        title: "晨光厨房",
        hint: "原木台面 · 暖光侧照 · 生活气息",
        category: "home",
        variables: {
            surface: "a reclaimed oak countertop",
            scenario: "a sunlit minimalist kitchen",
            props: "scattered roasted coffee beans and a folded linen napkin",
            lighting: "warm morning rays streaming through a window",
            mood: "cozy, quiet, and inviting",
        },
        recommendedPresetId: "amazon-main",
    },
    {
        id: "living-room-afternoon",
        title: "午后客厅",
        hint: "布艺沙发 · 自然散射光 · 松弛感",
        category: "home",
        variables: {
            surface: "a linen-covered side table",
            scenario: "a bright, lived-in living room",
            props: "a ceramic vase with dried stems and a stack of art books",
            lighting: "soft, diffused afternoon daylight",
            mood: "calm, warm, and effortlessly comfortable",
        },
        recommendedPresetId: "amazon-main",
    },
    {
        id: "cafe-table",
        title: "咖啡店桌台",
        hint: "大理石桌面 · 侧窗光 · 都市调性",
        category: "food",
        variables: {
            surface: "a veined marble cafe table",
            scenario: "a quiet specialty coffee shop",
            props: "a folded newspaper and a small glass of water",
            lighting: "directional window light with soft falloff",
            mood: "urban, refined, and unhurried",
        },
        recommendedPresetId: "detail-3x4",
    },
    {
        id: "restaurant-plating",
        title: "餐厅出餐",
        hint: "深色木桌 · 聚光 · 高级餐饮",
        category: "food",
        variables: {
            surface: "a dark walnut dining table",
            scenario: "an intimate fine-dining setting",
            props: "a linen runner and a pair of polished cutlery",
            lighting: "focused warm overhead light with gentle rim highlights",
            mood: "intimate, elegant, and appetizing",
        },
        recommendedPresetId: "detail-3x4",
    },
    {
        id: "outdoor-picnic",
        title: "户外野餐",
        hint: "草地格纹布 · 日光 · 明快",
        category: "nature",
        variables: {
            surface: "a checkered cotton picnic blanket on grass",
            scenario: "a sunny open meadow",
            props: "a wicker basket and scattered wildflowers",
            lighting: "bright natural sunlight with dappled shade",
            mood: "cheerful, fresh, and outdoorsy",
        },
        recommendedPresetId: "douyin-vertical",
    },
    {
        id: "stone-terrace",
        title: "石材露台",
        hint: "天然石板 · 硬光阴影 · 质感对比",
        category: "nature",
        variables: {
            surface: "a textured natural stone slab",
            scenario: "a minimalist outdoor terrace",
            props: "a few smooth pebbles and a sprig of greenery",
            lighting: "hard directional sunlight casting crisp shadows",
            mood: "clean, grounded, and sculptural",
        },
        recommendedPresetId: "amazon-main",
    },
    {
        id: "studio-gradient",
        title: "影棚渐变底",
        hint: "无缝背景 · 柔光箱 · 纯净电商",
        category: "studio",
        variables: {
            surface: "a seamless matte gradient backdrop",
            scenario: "a professional product photography studio",
            props: "a subtle reflective acrylic riser",
            lighting: "large softbox lighting with controlled gradient falloff",
            mood: "clean, premium, and distraction-free",
        },
        recommendedPresetId: "amazon-main",
    },
    {
        id: "studio-dramatic",
        title: "影棚戏剧光",
        hint: "暗场 · 硬光切割 · 高反差",
        category: "studio",
        variables: {
            surface: "a dark slate pedestal",
            scenario: "a blacked-out studio set",
            props: "a single geometric accent block",
            lighting: "a narrow hard key light with deep falloff and rim separation",
            mood: "dramatic, bold, and high-contrast",
        },
        recommendedPresetId: "amazon-main",
    },
    {
        id: "festive-party",
        title: "节庆派对",
        hint: "彩纸散落 · 明亮直射 · 欢快（Flora 实例场景）",
        category: "seasonal",
        variables: {
            surface: "a crisp white linen tablecloth",
            scenario: "a lively party celebration",
            props: "scattered metallic star and circle confetti, party blowouts, and crystal champagne flutes",
            lighting: "bright, direct lighting that casts strong, distinct shadows",
            mood: "joyful, festive, and energetic",
        },
        recommendedPresetId: "douyin-vertical",
    },
    {
        id: "autumn-warmth",
        title: "秋日暖调",
        hint: "暖褐木纹 · 低角度金光 · 季节感",
        category: "seasonal",
        variables: {
            surface: "a warm-toned rustic wooden board",
            scenario: "a cozy autumn interior",
            props: "dried maple leaves and a chunky knit textile",
            lighting: "low golden-hour light with long soft shadows",
            mood: "nostalgic, warm, and comforting",
        },
        recommendedPresetId: "detail-3x4",
    },
];

/** 按 id 取场景预设。 */
export function findScenePreset(id: string): ScenePreset | undefined {
    return SCENE_PRESETS.find((preset) => preset.id === id);
}

/** 按分类过滤场景预设（渲染层分组用）。 */
export function scenePresetsByCategory(category: SceneCategory): ScenePreset[] {
    return SCENE_PRESETS.filter((preset) => preset.category === category);
}
