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
     * spec 变量（对齐 Flora 六要素）—— **模型面**，英文，直接填 SCENE_SPEC_TEMPLATE。
     * 未填的项由管线保留占位符（暴露漏填），调用方应尽量填全。
     */
    variables: Omit<SceneSpecVariables, "product">;
    /**
     * 场景中文描述 —— **用户面**，用于回填 brief / 卡片 tooltip。
     *
     * 为什么要与 variables 分开：variables 是喂图像模型的英文素材（`a sunlit
     * minimalist kitchen`），直接拼进中文 brief 会产出「把商品放进a sunlit...」
     * 这类中英夹杂的文案。两个受众、两套文案，不混用。
     */
    brief: string;
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
        brief: "把商品放在阳光充足的极简厨房里，承托面是回收橡木台面，点缀散落的烘焙咖啡豆和一块亚麻餐巾，用穿过窗户的清晨暖光，整体氛围安静温馨。",
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
        brief: "把商品放在明亮的居家客厅里，承托面是铺亚麻布的边桌，点缀干花陶瓶和一摞画册，用柔和的午后散射光，整体氛围松弛舒适。",
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
        brief: "把商品放在安静的精品咖啡店里，承托面是带纹理的大理石桌，点缀一份折起的报纸和一杯清水，用有方向的侧窗光，整体氛围都市从容。",
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
        brief: "把商品放在高级餐厅的用餐场景里，承托面是深胡桃木餐桌，点缀亚麻桌旗和一副擦亮的餐具，用聚焦的暖色顶光配柔和轮廓光，整体氛围精致诱人。",
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
        brief: "把商品放在阳光明媚的开阔草地上，承托面是格纹棉质野餐垫，点缀藤编篮和散落的野花，用明亮的自然日光配斑驳树影，整体氛围轻快清爽。",
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
        brief: "把商品放在极简的户外露台上，承托面是带肌理的天然石板，点缀几颗光滑鹅卵石和一枝绿植，用硬朗的直射阳光投出清晰阴影，整体氛围干净利落。",
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
        brief: "把商品放在专业产品摄影棚里，承托面是无缝的哑光渐变背景，点缀一块微反光的亚克力台，用大面积柔光箱配受控渐变，整体氛围纯净高级。",
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
        brief: "把商品放在全黑棚拍的场景里，承托面是深色石板基座，点缀一个几何道具块，用一束窄硬光配深度衰减和轮廓分离，整体氛围戏剧高反差。",
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
        brief: "把商品放在热闹的派对庆典里，承托面是挺括的白色亚麻桌布，点缀散落的金属星形圆形纸屑、派对吹龙和水晶香槟杯，用明亮直射光投出强烈清晰的阴影，整体氛围欢乐热烈（Flora 实例场景）。",
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
        brief: "把商品放在温馨的秋日室内，承托面是暖色调的质朴木板，点缀干枫叶和粗针织织物，用低角度的黄金时刻光拉出柔和长影，整体氛围怀旧温暖。",
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
