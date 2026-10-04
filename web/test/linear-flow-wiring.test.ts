import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { prepareBackendGenerationTask } from "@/services/api/generation-task";
import { createModelChannel, defaultConfig, encodeChannelModel } from "@/stores/use-config-store";
import { LINEAR_FLOW_CARDS, findLinearFlowCard, linearFlowCardAspect, resolveLinearFlowSize } from "@/lib/canvas/linear-flow-cards";
import { ECOM_CHANNEL_PRESETS, imagePresetValue, imageSizePresets } from "@/lib/image-size-presets";
import { modelCapabilityConfigFor, type ImageCapabilityConfig } from "@/lib/model-capabilities";

/**
 * W5 直线入口卡 —— ★ 接线级断言（修复令第 3 面，测试线 b12r16 ③ 缺陷的看守）。
 *
 * ★ 为什么补这个文件（诚实说明）：
 * 前 4 个测试文件全是**纯函数测试**（卡数据/门控/提示词/结构），接线面零看守 ——
 * 于是「图片卡提交文本模型 → HTTP 400」这个缺陷逃过了全部静态门禁。
 * 本文件断言的是**提交体的实际返回值**（`prepareBackendGenerationTask` 的结构），
 * 不是源码文本 —— 与 super-resolve.test.ts 的 NO-GO 教训同族：
 * 「断言必须落在函数的实际返回值上，不能落在源码文本上」。
 */

const webRoot = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(webRoot, relative), "utf8");

/** 构造一个同时具备图片与文本模型的配置（零网络：参考图为空）。 */
function linearFlowTestConfig() {
    const imageModel = "test-image-model";
    const textModel = "test-text-model";
    const channel = createModelChannel({
        id: "linear-flow-test",
        name: "Linear flow test",
        baseUrl: "https://relay.example.com",
        apiKey: "test-key",
        // assertBackendRuntimeConfigured 要求 channelId 或 interfaceType 之一存在。
        interfaceType: "chat-completion",
        apiFormat: "openai",
        models: [imageModel, textModel],
        modelCosts: [
            { model: imageModel, capability: "image", billingMode: "fixed_request", unitPriceMicrocredits: 1 },
            { model: textModel, capability: "text", billingMode: "fixed_request", unitPriceMicrocredits: 1 },
        ],
    });
    const encodedImage = encodeChannelModel(channel.id, imageModel);
    const encodedText = encodeChannelModel(channel.id, textModel);
    return {
        ...defaultConfig,
        channels: [channel],
        // ★ 故意让 config.model 指向**文本模型** —— 复现缺陷现场（页面在对话模式下点图片卡）。
        model: encodedText,
        imageModel: encodedImage,
        textModel: encodedText,
    };
}

describe("★ 修复令第 1 面：提交体 model 与 card.mode 匹配", () => {
    test("图片卡提交体用图片模型（不是 config.model 的文本模型）", async () => {
        const config = linearFlowTestConfig();
        const card = findLinearFlowCard("white-background-main")!;
        expect(card.mode).toBe("image");
        // 复现修复前的接线：config.model 是文本模型
        expect(config.model).toBe(config.textModel);
        // 修复后的调用方行为：按 card.mode 重写 config.model = imageModel
        const requestConfig = { ...config, model: config.imageModel, imageModel: config.imageModel };
        const input = await prepareBackendGenerationTask({ mode: "image", prompt: "电商白底产品主图，马克杯", config: requestConfig });
        expect(input.model).toBe(config.imageModel);
        expect(input.model).not.toBe(config.textModel);
    });

    test("文本卡提交体用文本模型", async () => {
        const config = linearFlowTestConfig();
        const card = findLinearFlowCard("batch-prompt-tune")!;
        expect(card.mode).toBe("text");
        const requestConfig = { ...config, model: config.textModel, textModel: config.textModel };
        const input = await prepareBackendGenerationTask({ mode: "text", prompt: "优化这些提示词", config: requestConfig });
        expect(input.model).toBe(config.textModel);
    });

    test("★ 反证：不重写 config 时提交体带错模型（证明修复必要性）", async () => {
        const config = linearFlowTestConfig();
        // 不重写 —— 直接传页面 generationConfig（缺陷现场）
        const input = await prepareBackendGenerationTask({ mode: "image", prompt: "白底主图", config });
        // 提交体的 model 是文本模型 → 正是测试线抓到的 HTTP 400 根因
        expect(input.model).toBe(config.textModel);
    });

    test("★ 接线源码：index.tsx 按 card.mode 重写 config（不是直接传 generationConfig）", () => {
        const source = read("src/pages/create/index.tsx");
        expect(source).toContain("linearFlowConfig");
        expect(source).toContain('linearFlowCard.mode === "text" ? (config.textModel || selectedModel) : (config.imageModel || selectedModel)');
        // runner 挂载点必须用重写后的 config
        expect(source).toContain("config={linearFlowConfig}");
        expect(source).not.toContain("config={generationConfig}\n            model={linearFlowCard?.mode");
    });

    test("★ 接线源码：runner 用 model prop 修正 config.model（防御层）", () => {
        const source = read("src/components/create/linear-flow-runner.tsx");
        expect(source).toContain("const requestConfig = config.model === model ? config :");
        expect(source).toContain("config: requestConfig");
    });
});

describe("★ 修复令第 2 面：卡片比例语义进生成链", () => {
    test("白底主图卡 → 1:1（走 O-03 层1 渠道预设口径，不新造尺寸值）", () => {
        const aspect = linearFlowCardAspect(findLinearFlowCard("white-background-main")!);
        expect(aspect).toBe("1:1");
        expect(ECOM_CHANNEL_PRESETS.find((preset) => preset.id === "amazon-main")?.aspect).toBe("1:1");
    });

    test("3:4 详情图卡 → 3:4", () => {
        const aspect = linearFlowCardAspect(findLinearFlowCard("detail-3x4")!);
        expect(aspect).toBe("3:4");
        expect(ECOM_CHANNEL_PRESETS.find((preset) => preset.id === "detail-3x4")?.aspect).toBe("3:4");
    });

    test("无渠道比例绑定的卡返回 undefined（走模型默认，不硬塞）", () => {
        expect(linearFlowCardAspect(findLinearFlowCard("scene-shot")!)).toBeUndefined();
        expect(linearFlowCardAspect(findLinearFlowCard("batch-prompt-tune")!)).toBeUndefined();
    });

    test("★ 比例值必须在模型支持列表内（防「画面尺寸超出支持范围」）", () => {
        const config = linearFlowTestConfig();
        const profile = modelCapabilityConfigFor(config, config.imageModel).image!;
        for (const card of LINEAR_FLOW_CARDS) {
            const aspect = linearFlowCardAspect(card);
            if (!aspect) continue;
            // 支持列表含该比例，或模型允许自定义
            expect(profile.size.values.includes(aspect) || profile.size.allowCustom).toBe(true);
        }
    });

    test("★ 比例进提交体（size 字段贯通）", async () => {
        const config = linearFlowTestConfig();
        const profile = modelCapabilityConfigFor(config, config.imageModel).image!;
        const aspect = linearFlowCardAspect(findLinearFlowCard("white-background-main")!);
        const size = resolveLinearFlowSize(profile, aspect);
        const input = await prepareBackendGenerationTask({
            mode: "image",
            prompt: "电商白底产品主图",
            config: { ...config, model: config.imageModel, imageModel: config.imageModel, ...(size ? { size } : {}) },
        });
        const inputConfig = input.input as { config?: { size?: string } };
        expect(inputConfig.config?.size).toBe(size);
    });

    test("★ 接线源码：index.tsx 把 resolveLinearFlowSize 结果写进 config.size", () => {
        const source = read("src/pages/create/index.tsx");
        expect(source).toContain("linearFlowCardAspect");
        expect(source).toContain("resolveLinearFlowSize");
        expect(source).toContain("...(size ? { size } : {})");
    });
});

describe("卡面比例与卡名一致（任务语义对齐）", () => {
    test("比例语义在卡面可见（title 或 hint）", () => {
        const main = findLinearFlowCard("white-background-main")!;
        const detail = findLinearFlowCard("detail-3x4")!;
        // 白底主图：比例写在 hint
        expect(main.hint).toContain("1:1");
        // 3:4 详情图：比例写在 title（卡名本身）
        expect(detail.title).toContain("3:4");
    });

    test("★ 卡面声明的比例与生成链实际提交的比例一致（防 UI 与提交不一致）", () => {
        // 白底主图：hint 说 1:1 → aspect 必须也是 1:1
        const main = findLinearFlowCard("white-background-main")!;
        expect(main.hint).toContain(linearFlowCardAspect(main)!);
        // 3:4 详情图：title 说 3:4 → aspect 必须也是 3:4
        const detail = findLinearFlowCard("detail-3x4")!;
        expect(detail.title).toContain(linearFlowCardAspect(detail)!);
    });

    test("每张卡的 mode 与 acceptsReference 组合合法", () => {
        for (const card of LINEAR_FLOW_CARDS) {
            if (card.mode === "text") {
                // 文本卡不应要求参考图
                expect(card.acceptsReference).toBe(false);
            }
        }
    });
});

/**
 * ★ 二轮修复（b12r16-③R）：比例字符串 vs 像素值。
 *
 * 根因：上轮把 size 写成比例字符串（"1:1"），但 size 协议模型要像素值（"1024x1024"）
 * → 实测报「画面尺寸超出支持范围」。测试线实证正确路径：1:1→1024x1024；3:4→1024x1360。
 */
describe("★ 二轮修复：resolveLinearFlowSize（比例 → 模型可接受值）", () => {
    /** size 协议 profile（像素值 values），照 gpt-image-2.5 实测值。 */
    const sizeProfile = (): ImageCapabilityConfig => ({
        references: { promptMaxChars: 4000, maxImages: 3, maxImageBytes: 1e7, maskSupported: false },
        size: { parameter: "size", values: ["auto", "1024x1024", "1824x1024", "1024x1824", "1360x1024", "1024x1360", "1536x1024", "1024x1536"], default: "auto", allowCustom: false },
        quality: { supported: false, values: [], default: "auto" },
        transparentBackground: { supported: false, default: false },
        responseFormat: { supported: true },
        outputFormat: { supported: true },
        maxOutputs: 1,
    }) as ImageCapabilityConfig;

    /** aspect_ratio 协议 profile（比例 values），照 nano-banana2 实测值。 */
    const aspectProfile = (): ImageCapabilityConfig => ({
        references: { promptMaxChars: 4000, maxImages: 3, maxImageBytes: 1e7, maskSupported: false },
        size: { parameter: "aspect_ratio", values: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], default: "auto", allowCustom: false },
        quality: { supported: false, values: [], default: "auto" },
        transparentBackground: { supported: false, default: false },
        responseFormat: { supported: true },
        outputFormat: { supported: true },
        maxOutputs: 1,
    }) as ImageCapabilityConfig;

    test("★ size 协议模型：1:1 → 1024x1024（测试线实证值）", () => {
        expect(resolveLinearFlowSize(sizeProfile(), "1:1")).toBe("1024x1024");
    });

    test("★ size 协议模型：3:4 → 1024x1360（测试线实证值）", () => {
        expect(resolveLinearFlowSize(sizeProfile(), "3:4")).toBe("1024x1360");
    });

    test("★ 结果必须是模型 values 里的合法值（防再次「超出支持范围」）", () => {
        const profile = sizeProfile();
        for (const aspect of ["1:1", "3:4"]) {
            const size = resolveLinearFlowSize(profile, aspect);
            expect(size).toBeDefined();
            expect(profile.size.values).toContain(size!);
        }
    });

    test("aspect_ratio 协议模型：1:1 → 1:1（该模型 values 就是比例）", () => {
        expect(resolveLinearFlowSize(aspectProfile(), "1:1")).toBe("1:1");
        expect(resolveLinearFlowSize(aspectProfile(), "3:4")).toBe("3:4");
    });

    test("★ 反证：直接传比例字符串给 size 模型 → 不在 values 里（证明缺陷存在）", () => {
        const profile = sizeProfile();
        expect(profile.size.values).not.toContain("1:1");
        expect(profile.size.values).not.toContain("3:4");
    });

    test("匹配不到 → undefined（兜底：不传 size，走模型默认）", () => {
        // 模型只支持 16:9，卡要 3:4
        const narrow = { ...sizeProfile(), size: { ...sizeProfile().size, values: ["auto", "1824x1024"] } } as ImageCapabilityConfig;
        expect(resolveLinearFlowSize(narrow, "3:4")).toBeUndefined();
    });

    test("parameter = none 的模型 → undefined（不传 size）", () => {
        const none = { ...sizeProfile(), size: { parameter: "none", values: [], default: "auto", allowCustom: false } } as ImageCapabilityConfig;
        expect(resolveLinearFlowSize(none, "1:1")).toBeUndefined();
    });

    test("profile 或 aspect 缺失 → undefined（不崩）", () => {
        expect(resolveLinearFlowSize(undefined, "1:1")).toBeUndefined();
        expect(resolveLinearFlowSize(sizeProfile(), undefined)).toBeUndefined();
    });

    test("★ 消费既有函数：映射结果与 imageSizePresets + imagePresetValue 一致", () => {
        const profile = sizeProfile();
        const preset = imageSizePresets(profile).find((item) => item.ratio === "1:1")!;
        expect(resolveLinearFlowSize(profile, "1:1")).toBe(imagePresetValue(profile, preset));
    });

    test("★ 接线源码：index.tsx 不再把 aspect 直接当 size", () => {
        const source = read("src/pages/create/index.tsx");
        expect(source).not.toContain("...(aspect ? { size: aspect } : {})");
        expect(source).toContain("...(size ? { size } : {})");
    });

    test("★ 兜底记录：匹配不到时 console.info（不硬造值）", () => {
        const source = read("src/pages/create/index.tsx");
        expect(source).toContain("console.info");
        expect(source).toContain("未在模型");
    });
});
