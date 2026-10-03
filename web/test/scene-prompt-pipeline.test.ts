import { expect, test, describe } from "bun:test";

import {
    PRODUCT_REFERENCE_ROLE,
    SCENE_REFERENCE_ROLE,
    SCENE_SPEC_TARGET_CHARS,
    SCENE_SPEC_TEMPLATE,
    buildScenePrompt,
    condenseSceneSpec,
    fillSceneSpecTemplate,
    renderInputRoles,
    renderMaskSemantics,
} from "@/lib/canvas/scene-prompt-pipeline";

/**
 * F-02 场景图管线单测（纯逻辑，零 DOM）。
 *
 * 覆盖任务书 §八-3 要求的五项：管线凝缩 / 变量填充 / @[ref] 声明生成 /
 * mask 语义段 / 退化档切换。
 */

const LONG_SPEC = [
    "INPUT ROLES:",
    "@[product] = PRODUCT_REFERENCE. ROLE: exact product reproduction only. Ignore the background.",
    "",
    "A detailed still life of a matte black ceramic coffee dripper resting on a reclaimed oak countertop within a sunlit minimalist kitchen, surrounded by scattered roasted coffee beans and a folded linen napkin.",
    "The scene is illuminated by warm morning rays streaming through a window to highlight the product textures perfectly.",
    "The overall atmosphere feels cozy, quiet, and inviting.",
    "The composition is entirely unpopulated and devoid of people, focusing purely on the product in its natural environment, captured in photorealistic detail with depth of field, 50mm lens, shallow focus on the product, soft natural shadows, muted warm color palette, editorial product photography style.",
].join(" ");

test("@[ref] 角色声明：渲染 INPUT ROLES 段并带 @[label] = ROLE 格式", () => {
    const rendered = renderInputRoles([PRODUCT_REFERENCE_ROLE, SCENE_REFERENCE_ROLE]);
    expect(rendered.startsWith("INPUT ROLES:")).toBe(true);
    expect(rendered.includes("@[product] = PRODUCT_REFERENCE.")).toBe(true);
    expect(rendered.includes("@[scene] = SCENE_REFERENCE.")).toBe(true);
});

test("★ 场景参考的防误用条款逐字保留（防模型当第二主体）", () => {
    const rendered = renderInputRoles([SCENE_REFERENCE_ROLE]);
    // 输入清单 §1 原话：防模型把场景图当第二个主体
    expect(rendered.includes("Do NOT treat it as a second subject")).toBe(true);
    expect(rendered.includes("do not copy its objects into the output")).toBe(true);
});

test("商品参考的边界语义逐字保留（只复现本体，不取场景）", () => {
    const rendered = renderInputRoles([PRODUCT_REFERENCE_ROLE]);
    expect(rendered.includes("exact product reproduction only")).toBe(true);
    expect(rendered.includes("Take no scene, environment, or context from it")).toBe(true);
});

test("空角色列表返回空串（不产出裸表头）", () => {
    expect(renderInputRoles([])).toBe("");
});

test("★ mask 语义预写两个要点齐备：selection 声明 + 透明渲染为黑", () => {
    const rendered = renderMaskSemantics({ hasMask: true });
    // FULL-DATA-REPORT L255：显式声明蒙版不是参考图 + 透明区可能渲染为黑
    expect(rendered.includes("It is a selection, not a reference photo of the product")).toBe(true);
    expect(rendered.includes("transparent and may render as black")).toBe(true);
});

test("无 mask 时不产出该段（避免无关声明干扰模型）", () => {
    expect(renderMaskSemantics({ hasMask: false })).toBe("");
});

test("preset 模板保留 Flora 六要素占位符", () => {
    for (const key of ["product", "surface", "scenario", "props", "lighting", "mood"]) {
        expect(SCENE_SPEC_TEMPLATE.includes(`{${key}}`), `模板缺占位符 {${key}}`).toBe(true);
    }
});

test("模板填充后无占位符残留，且值进入文本", () => {
    const filled = fillSceneSpecTemplate({
        product: "matte black ceramic dripper",
        surface: "reclaimed oak countertop",
        scenario: "sunlit minimalist kitchen",
        props: "scattered roasted beans",
        lighting: "warm morning rays",
        mood: "cozy and quiet",
    });
    expect(/\{\w+\}/.test(filled)).toBe(false);
    expect(filled.includes("matte black ceramic dripper")).toBe(true);
    expect(filled.includes("reclaimed oak countertop")).toBe(true);
});

test("未提供的变量保留占位符（暴露漏填而非产出破损句子）", () => {
    const filled = fillSceneSpecTemplate({ product: "ceramic mug" });
    expect(filled.includes("ceramic mug")).toBe(true);
    expect(filled.includes("{surface}")).toBe(true);
});

test("空字符串/空白值视为未提供（不产出「on .」）", () => {
    const filled = fillSceneSpecTemplate({ product: "ceramic mug", surface: "   " });
    expect(filled.includes("{surface}")).toBe(true);
});

test("超长 spec 被压到目标上限内", () => {
    const condensed = condenseSceneSpec(LONG_SPEC, { min: 100, max: 600 });
    expect(condensed.length <= 600, `凝缩后 ${condensed.length} 字符，超上限`).toBe(true);
});

test("★ 角色声明段被固定保留（协议面不可压缩）", () => {
    const condensed = condenseSceneSpec(LONG_SPEC, { min: 100, max: 600 });
    expect(condensed.includes("@[product]")).toBe(true);
    expect(condensed.includes("INPUT ROLES")).toBe(true);
});

test("已在上限内的 spec 原样返回（不做无谓改写）", () => {
    const short = "A still life of a mug on oak.";
    expect(condenseSceneSpec(short, { min: 900, max: 1500 })).toBe(short);
});

test("目标区间常量与 Flora 实测一致（900-1500 字）", () => {
    expect(SCENE_SPEC_TARGET_CHARS).toEqual({ min: 900, max: 1500 });
});

test("正常档：含角色声明 + 商品参考 + 场景参考", () => {
    const result = buildScenePrompt({
        sceneBrief: LONG_SPEC,
        product: "ceramic dripper",
        hasSceneReference: true,
    });
    expect(result.degraded).toBe(false);
    expect(result.tier).toBe("full");
    expect(result.prompt.includes("INPUT ROLES:")).toBe(true);
    expect(result.prompt.includes("@[scene]")).toBe(true);
});

test("★ 降智档：走模板+变量，不依赖 LLM 产出质量", () => {
    const result = buildScenePrompt({
        sceneBrief: "", // 模拟 LLM 完全不可用
        product: "ceramic mug",
        degraded: true,
        variables: {
            surface: "oak countertop",
            scenario: "sunlit kitchen",
            props: "coffee beans",
            lighting: "warm morning light",
            mood: "cozy",
        },
    });
    expect(result.degraded).toBe(true);
    expect(result.tier).toBe("condensed");
    expect(/\{\w+\}/.test(result.prompt)).toBe(false);
    expect(result.prompt.includes("ceramic mug")).toBe(true);
});

test("降智档仍带角色声明（防误用条款不因降级而丢失）", () => {
    const result = buildScenePrompt({
        sceneBrief: "",
        product: "mug",
        degraded: true,
        hasSceneReference: true,
    });
    expect(result.prompt.includes("Do NOT treat it as a second subject")).toBe(true);
});

test("无场景参考图时不产出 @[scene]（避免声明不存在的输入）", () => {
    const result = buildScenePrompt({ sceneBrief: LONG_SPEC, product: "mug", hasSceneReference: false });
    expect(result.prompt.includes("@[scene]")).toBe(false);
    expect(result.prompt.includes("@[product]")).toBe(true);
});

test("chars 与实际提示词长度一致（渠道实测记录用）", () => {
    const result = buildScenePrompt({ sceneBrief: LONG_SPEC, product: "mug" });
    expect(result.chars).toBe(result.prompt.length);
});
