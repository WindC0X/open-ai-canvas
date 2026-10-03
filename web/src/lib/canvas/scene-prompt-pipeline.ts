/**
 * F-02 商品场景图 —— 两段式提示词管线。
 *
 * 语料依据：`docs/artifacts/flora-techniques-deep-dive/`（Product in Scene Generator）
 * 与 `docs/artifacts/f02-scene-inputs.md`（控制线输入清单）。
 *
 * 管线形态（Flora 范式 3，FULL-DATA-REPORT L257-267）：
 *   ① LLM 节点出结构化 spec（5000-9000 字符 / Flora 实测 3421 ch）
 *   → ② 凝缩到 900-1500 字（Flora 实测 1254 ch）
 *   → ③ imageToImage 执行
 *
 * ★ 渠道实测（2026-10-03，任务书 §十）：a6api 上 nano-banana-2 在 148/486/1020ch
 * 三档的遵循度不打折，故 spec 长度采用 Flora 原始区间，不砍。降智预案独立于长度
 * （见 scene-spec-templates.ts 的「模板 + 变量」退化档）。
 *
 * 本模块只做纯字符串组装，零 IO、零 DOM、零框架依赖 —— 便于单测与降智期降级复用。
 */
import type { CharacterRepresentation } from "@/services/api/projects";

/** 输入引用的角色声明（`@[ref]` 语法，Flora 范式 1）。 */
export type SceneInputRole = {
    /** 引用标签，渲染为 `@[label]`。 */
    label: string;
    /** 角色名，如 PRODUCT_REFERENCE / SCENE_REFERENCE。 */
    role: string;
    /** 角色边界说明（逐条）。 */
    boundaries: string[];
};

/**
 * 商品参考图角色 —— 逐字对齐 Flora 原文（FULL-DATA-REPORT L216-222）的边界语义：
 * 「只复现商品本体，忽略其背景/台面/光照，不要从它取场景」。
 */
export const PRODUCT_REFERENCE_ROLE: SceneInputRole = {
    label: "product",
    role: "PRODUCT_REFERENCE",
    boundaries: [
        "ROLE: exact product reproduction only.",
        "Capture the material, finish, color, proportions, and every construction detail with absolute fidelity.",
        "Ignore the background, surface, and lighting of the reference.",
        "Take no scene, environment, or context from it.",
    ],
};

/**
 * 场景参考图角色 —— ★ 防误用条款是本段的全部意义。
 *
 * Flora 原文（FULL-DATA-REPORT L255 的机制说明）：「显式警告模型不要把 mask 当参考图」
 * 的同族手法 —— 这里防的是**把场景图当第二个主体**（输入清单 §1 原话
 * 「防模型把场景图当第二个主体」）。
 */
export const SCENE_REFERENCE_ROLE: SceneInputRole = {
    label: "scene",
    role: "SCENE_REFERENCE",
    boundaries: [
        "ROLE: environment, surface, lighting and atmosphere only.",
        "Take the surface, surrounding props, illumination style, and mood from it.",
        "Do NOT treat it as a second subject — do not copy its objects into the output.",
        "Do not reproduce its composition; use it as loose scene/photography/style reference.",
    ],
};

/** 渲染 INPUT ROLES 段（Flora 原文格式：`@[label] = ROLE. <boundaries>`）。 */
export function renderInputRoles(roles: SceneInputRole[]): string {
    if (roles.length === 0) return "";
    const lines = roles.map((item) => {
        const [head, ...rest] = item.boundaries;
        const first = `${item.role}. ${head ?? ""}`.trim();
        return [`@[${item.label}] = ${first}`, ...rest].join("\n");
    });
    return ["INPUT ROLES:", ...lines].join("\n");
}

/**
 * mask 语义声明 —— 逐字对齐 Flora 原文（FULL-DATA-REPORT L237-242）。
 *
 * ★ 两个预写要点（L255）：
 *   ① `It is a selection, not a reference photo` —— 声明蒙版不是参考图
 *   ② `transparent and may render as black` —— **透明渲染为黑的坑要预写**
 *
 * F-02 用途：场景图 v1 若不需 mask，本段作为**预写保留在管线中**——F-01 抠图产出
 * 可直接作 mask 输入，形成 F-01→F-02 串联（任务书 §4.3）。
 */
export function renderMaskSemantics(options: { hasMask: boolean }): string {
    if (!options.hasMask) return "";
    return [
        "Input Roles:",
        "- BASE_IMAGE (Image 1): Owns the product, its presentation, composition, shape, details, lighting, and all non-edited pixels.",
        "- PRODUCT_MASK (Image 2): a cutout of Image 1. Only the pixels to edit are visible; everything else is transparent and may render as black. It is a selection, not a reference photo of the product.",
        "- SCENE_REFERENCE: the environment reference (what surroundings to apply).",
    ].join("\n");
}

/** 场景 spec 的变量（preset 模板填充位，对齐 Flora 原文的 6 个 `[Insert ...]`）。 */
export type SceneSpecVariables = {
    /** 商品名与材质 → `[Insert Product Name and Materials]`。 */
    product: string;
    /** 承托台面 → `[Insert Surface Type]`。 */
    surface: string;
    /** 生活方式场景 → `[Insert Lifestyle Scenario]`。 */
    scenario: string;
    /** 1-2 个补充道具 → `[Insert 1 to 2 Complementary Objects]`。 */
    props: string;
    /** 光照风格 → `[Insert Lighting Style]`。 */
    lighting: string;
    /** 氛围情绪 → `[Insert Mood or Vibe]`。 */
    mood: string;
};

/**
 * preset spec 模板 —— 逐字取自 Flora `Product in Scene Generator`
 * （`contentPackaging.json`，nodeId `scene-5` 的 imageToImage 提示词骨架）。
 *
 * ★ 降智预案的载体（输入清单 §2）：预凝缩成品直接入模板，LLM 只做变量填充。
 * 弱渠道/降智期退化为「模板 + 变量」，出图下限由模板保证。
 */
export const SCENE_SPEC_TEMPLATE =
    "A detailed still life of {product}, resting gracefully on {surface}. " +
    // ★ 冠词归属：由**变量**携带（`a reclaimed oak countertop`），模板不再硬编码 "a" ——
    // 否则产出 "within a a lively party celebration" 双冠词（实现中实测暴露后修正）。
    // Flora 原文的 `[Insert Surface Type]` 占位符同样把冠词交给填写者。
    "The item is situated within {scenario}, surrounded by subtle contextual props such as {props}. " +
    "The scene is illuminated by {lighting} to highlight the product textures perfectly. " +
    "The overall atmosphere feels {mood}. " +
    "The composition is entirely unpopulated and devoid of people, focusing purely on the product " +
    "in its natural environment, captured in photorealistic detail with depth of field.";

/**
 * 用变量填充模板（降智退化档的**唯一入口**）。
 *
 * 未提供的变量保留 `{name}` 占位符而非填空字符串 —— 让调用方/测试能发现漏填，
 * 也避免产出「resting gracefully on .」这类破损句子。
 */
export function fillSceneSpecTemplate(
    variables: Partial<SceneSpecVariables>,
    template: string = SCENE_SPEC_TEMPLATE,
): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => {
        const value = variables[key as keyof SceneSpecVariables];
        return typeof value === "string" && value.trim() !== "" ? value.trim() : match;
    });
}

/** spec 长度档位（渠道实测用，任务书 §十）。 */
export type SceneSpecLengthTier = "full" | "condensed";

/** 凝缩目标区间（Flora 原文实测：① 3421ch → ② 1254ch）。 */
export const SCENE_SPEC_TARGET_CHARS = { min: 900, max: 1500 } as const;

/**
 * 凝缩 spec 到目标区间。
 *
 * 实现取向（任务书 §4.1）：**规则化抽取优先于二次 LLM 调用** —— 省一次调用、
 * 降智期更稳。策略：按句切分，优先保留承载「场景/光照/构图/材质」语义的句子，
 * 按原文顺序回填直到接近上限；不足下限时回退为原文（宁长勿缺）。
 */
export function condenseSceneSpec(
    spec: string,
    target: { min: number; max: number } = SCENE_SPEC_TARGET_CHARS,
): string {
    const trimmed = spec.trim();
    if (trimmed.length <= target.max) return trimmed;

    // 语义权重：命中越多越先保留（Flora 六要素 + 构图/材质/镜头语汇）
    const keywords = [
        "INPUT ROLES", "@[", "ROLE", "product", "scene", "reference",
        "surface", "countertop", "table", "background", "environment",
        "light", "lighting", "illuminat", "shadow", "sun", "window",
        "mood", "atmosphere", "composition", "framing", "photorealistic",
        "material", "texture", "finish", "color", "detail",
    ];
    const score = (sentence: string) => {
        const lower = sentence.toLowerCase();
        return keywords.reduce((sum, kw) => (lower.includes(kw.toLowerCase()) ? sum + 1 : sum), 0);
    };

    const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
    // 角色声明段必须保留（协议面，不是可压缩的描述）
    const pinned = sentences.filter((s) => s.includes("@[") || s.startsWith("INPUT ROLES"));
    const rest = sentences.filter((s) => !pinned.includes(s));

    const kept: string[] = [...pinned];
    let length = kept.join(" ").length;
    // 按语义分降序挑选，再按原文顺序回填（保可读性）
    const ranked = rest
        .map((sentence, index) => ({ sentence, index, weight: score(sentence) }))
        .sort((a, b) => b.weight - a.weight || a.index - b.index);
    const chosen = new Set<number>();
    for (const item of ranked) {
        const cost = item.sentence.length + 1;
        if (length + cost > target.max) continue;
        chosen.add(item.index);
        length += cost;
    }
    for (const [index, sentence] of rest.entries()) {
        if (chosen.has(index)) kept.push(sentence);
    }

    const result = kept.join(" ").trim();
    return result.length >= target.min ? result : trimmed;
}

/** 管线输入。 */
export type ScenePipelineInput = {
    /** 场景卡描述（用户意图 / 预设场景）。 */
    sceneBrief: string;
    /** 商品描述（名称 + 材质）。 */
    product: string;
    /** 是否附带场景参考图。 */
    hasSceneReference?: boolean;
    /** 是否附带 mask（F-01 抠图产物）。 */
    hasMask?: boolean;
    /** 降智档：true 时走「模板 + 变量」而不走 LLM spec。 */
    degraded?: boolean;
    /** 降智档的模板变量。 */
    variables?: Partial<SceneSpecVariables>;
};

/** 管线输出。 */
export type ScenePipelineResult = {
    /** 喂给图像模型的最终提示词。 */
    prompt: string;
    /** 产出档位（用于任务面元数据标签与可观测性）。 */
    tier: SceneSpecLengthTier;
    /** 是否走了降智退化路径。 */
    degraded: boolean;
    /** 提示词字符数（渠道实测记录用）。 */
    chars: number;
};

/**
 * 组装两段式管线的**最终提示词**。
 *
 * 正常档：LLM spec（由调用方传入的 sceneBrief 已含 spec 语义）→ 凝缩 → 拼角色声明。
 * 降智档：模板 + 变量填充 → 拼角色声明（不依赖 LLM 产出质量）。
 */
export function buildScenePrompt(input: ScenePipelineInput): ScenePipelineResult {
    const roles: SceneInputRole[] = [PRODUCT_REFERENCE_ROLE];
    if (input.hasSceneReference) roles.push(SCENE_REFERENCE_ROLE);

    const degraded = input.degraded === true;
    let body: string;
    if (degraded) {
        body = fillSceneSpecTemplate({ ...input.variables, product: input.variables?.product ?? input.product });
    } else {
        body = condenseSceneSpec(input.sceneBrief);
    }

    const sections = [renderInputRoles(roles), body, renderMaskSemantics({ hasMask: input.hasMask === true })].filter(
        (section) => section !== "",
    );
    const prompt = sections.join("\n\n");

    return {
        prompt,
        tier: degraded ? "condensed" : "full",
        degraded,
        chars: prompt.length,
    };
}

/**
 * 角色表现图 → 场景参考图选择。
 *
 * 复用 W4 骑乘件三的优先级实现（火山方舟官方：单人独立照片优先于三视图）。
 * 场景参考图在本枝用于「风格/场景参考」，同样应避免多视图混淆。
 */
export { resolvePreferredCharacterImage as resolveSceneReferenceImage } from "@/lib/canvas/character-reference-images";

export type { CharacterRepresentation };
