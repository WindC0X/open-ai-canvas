import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CAPABILITY_ENTRIES, capabilityContextSatisfied, capabilityEntriesByTier, findCapabilityEntry } from "@/lib/canvas/capability-entries";
import { DEFAULT_SUPER_RESOLVE_PARAMS, SUPER_RESOLVE_MODES, SUPER_RESOLVE_PROMPT_FRAGMENTS, SUPER_RESOLVE_TARGETS, isFaithfulDefault, superResolvePromptFragment, superResolveSize } from "@/lib/canvas/super-resolve-params";
import { prepareBackendGenerationTask } from "@/services/api/generation-task";
import { createModelChannel, defaultConfig, encodeChannelModel } from "@/stores/use-config-store";

/**
 * O-03 层2 AI 超分 —— 注册表条目 + 参数面 + 入口可达性。
 *
 * 本文件守护三类不变量：
 * ① 能力条目 schema 完整（控制线裁定「不许缺字段」）
 * ② 命名分流红线（MASTER-PLAN L399）：upscale（插值/免费）与 superResolve（AI/计费）
 *    严格分开，保真放大为默认，禁用「高清化」模糊词
 * ③ 入口可达性（反模式 #12：有代码≠能用）—— 工具条目存在且 handler 被消费
 */

const webRoot = join(import.meta.dir, "..");

/** 构造一个可过 assertBackendRuntimeConfigured 的配置（零网络：参考图为空）。 */
function superResolveTestConfig(capability: "image" | "video" = "image") {
    const model = capability === "video" ? "test-video-model" : "test-image-model";
    const channel = createModelChannel({
        id: "o03-test",
        name: "O-03 test",
        baseUrl: "https://relay.example.com",
        apiKey: "test-key",
        // assertBackendRuntimeConfigured 要求 channelId 或 interfaceType 之一存在；
        // 只给 apiFormat 不够（resolveModelRequestConfig 回填的 interfaceType 为空）。
        interfaceType: "chat-completion",
        apiFormat: "openai",
        models: [model],
        modelCosts: [{ model, capability, billingMode: "fixed_request", unitPriceMicrocredits: 1 }],
    });
    const encoded = encodeChannelModel(channel.id, model);
    return {
        ...defaultConfig,
        channels: [channel],
        model: encoded,
        imageModel: capability === "image" ? encoded : defaultConfig.imageModel,
        videoModel: capability === "video" ? encoded : defaultConfig.videoModel,
    };
}
const read = (relative: string) => readFileSync(join(webRoot, relative), "utf8");

describe("能力条目 schema（控制线裁定：全字段登记，不许缺字段）", () => {
    test("超分条目全字段齐备", () => {
        const entry = findCapabilityEntry("image.superResolve");
        expect(entry).toBeDefined();
        expect({
            id: entry?.id,
            name: entry?.name,
            tier: entry?.tier,
            contextRequirement: entry?.contextRequirement,
            assetKind: entry?.assetKind,
            hasParameterSurface: (entry?.parameterSurface.length ?? 0) > 0,
            executionHandler: entry?.executionChain.handler,
            executionLocation: entry?.executionChain.location,
            primaryChannel: entry?.executionChain.primaryChannel,
            zeroParameterPreset: entry?.zeroParameterPreset,
        }).toEqual({
            id: "image.superResolve",
            name: "AI 超分",
            // 能力组织层方案 §4 表明确列「超分W5」为画布内弹窗档。
            tier: 1,
            contextRequirement: "single_image",
            assetKind: "capability/tool",
            hasParameterSurface: true,
            executionHandler: "superResolveImageNode",
            executionLocation: "cloud",
            primaryChannel: "a6api · nano-banana-2",
            // 控制线裁定：显式写「暂无」，不许缺字段。
            zeroParameterPreset: "暂无",
        });
    });

    test("每条记录字段非空（防后续新增条目漏字段）", () => {
        for (const entry of CAPABILITY_ENTRIES) {
            for (const [key, value] of Object.entries(entry)) {
                expect({ id: entry.id, key, empty: value === undefined || value === null || value === "" }).toEqual({ id: entry.id, key, empty: false });
            }
            expect(entry.parameterSurface.length).toBeGreaterThan(0);
            expect(entry.executionChain.primaryChannel.length).toBeGreaterThan(0);
        }
    });

    test("★ 登记位独立：元数据不在按钮定义文件里", () => {
        // 控制线裁定：禁止把元数据塞进按钮定义的字段或注释里，升格枝要按记录消费。
        const toolbarSource = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(toolbarSource.includes("capability-entries")).toBe(false);
        expect(toolbarSource.includes("contextRequirement")).toBe(false);
    });

    test("按档位与上下文筛选", () => {
        expect(capabilityEntriesByTier(1).some((entry) => entry.id === "image.superResolve")).toBe(true);
        const entry = findCapabilityEntry("image.superResolve")!;
        // single_image：恰好一张图才满足。
        expect(capabilityContextSatisfied(entry, { imageCount: 1, hasSelection: false })).toBe(true);
        expect(capabilityContextSatisfied(entry, { imageCount: 0, hasSelection: false })).toBe(false);
        expect(capabilityContextSatisfied(entry, { imageCount: 2, hasSelection: false })).toBe(false);
    });
});

describe("★ 命名分流红线（MASTER-PLAN L399）", () => {
    test("保真放大是默认档（红线原文：保真放大（默认））", () => {
        expect(DEFAULT_SUPER_RESOLVE_PARAMS.mode).toBe("faithful");
        expect(isFaithfulDefault(DEFAULT_SUPER_RESOLVE_PARAMS)).toBe(true);
    });

    test("AI 增强需勾选确认（红线原文：AI 增强（勾选确认））", () => {
        const enhance = SUPER_RESOLVE_MODES.find((item) => item.value === "enhance");
        const faithful = SUPER_RESOLVE_MODES.find((item) => item.value === "faithful");
        expect({ enhanceConfirm: enhance?.confirm, faithfulConfirm: faithful?.confirm }).toEqual({ enhanceConfirm: true, faithfulConfirm: false });
    });

    test("★ 禁用「高清化」模糊词（全仓，含注释）", () => {
        const files = [
            "src/lib/canvas/super-resolve-params.ts",
            "src/components/canvas/canvas-node-super-resolve-dialog.tsx",
            "src/lib/canvas/capability-entries.ts",
            "src/components/canvas/canvas-image-toolbar-tools.tsx",
        ];
        for (const file of files) {
            expect({ file, banned: read(file).includes("高清化") }).toEqual({ file, banned: false });
        }
    });

    test("超分工具条目的 label 不含「超分」以外的混淆词，且描述声明消耗积分", () => {
        const source = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(source.includes('label: "AI 超分"')).toBe(true);
        expect(source.includes("云端重建像素细节，消耗积分")).toBe(true);
    });

    test("★ HUD 的「超分」误标已修正为「调整尺寸」（它调的是免费插值）", () => {
        const source = read("src/pages/canvas/project.tsx");
        // 修正前：{ label: "超分", ... onClick: () => setUpscaleNodeId(...) } —— 命名红线违规。
        expect(source.includes('{ label: "超分", icon: <ZoomIn')).toBe(false);
        expect(source.includes('{ label: "调整尺寸", icon: <ZoomIn')).toBe(true);
    });
});

describe("★ 入口可达性（反模式 #12：有代码≠能用）", () => {
    test("工具条目 id: superResolve 存在（此前只有 handler 声明，Modal 不可达）", () => {
        const source = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(source.includes('id: "superResolve"')).toBe(true);
    });

    test("★ handler 被消费（此前 onSuperResolve 是死 prop）", () => {
        const source = read("src/components/canvas/canvas-image-toolbar-tools.tsx");
        expect(source.includes("handlers.onSuperResolve(node)")).toBe(true);
    });

    test("★ 占位「暂未实现」已移除，换真对话框", () => {
        const source = read("src/pages/canvas/canvas-project-status-dialogs.tsx");
        expect(source.includes("暂未实现")).toBe(false);
        expect(source.includes("CanvasNodeSuperResolveDialog")).toBe(true);
    });

    test("★ 执行链贯通：project.tsx 把 onSuperResolve 接到 superResolveImageNode", () => {
        const source = read("src/pages/canvas/project.tsx");
        expect(source.includes("onSuperResolve={(node, params) =>")).toBe(true);
        expect(source.includes("superResolveImageNode(node, params)")).toBe(true);
    });

    test("★ 计费 operation 贯通：传输层返回值 operation === image_upscale（结构断言）", async () => {
        // ★★ 为什么必须是结构断言（2026-10-03 测试线增量门抓到的 NO-GO）：
        // 本用例原先是 source.includes 字符串断言 —— 只证明「代码存在」，
        // 而真实缺陷恰恰在字符串断言看不到的地方：backendGenerationTaskInput()
        // 拿到 generationOperation() 的返回值后又按 mode 二次覆盖
        // （`operation: mode === "video" ? videoOperation : mode`），
        // 超分在 HTTP 层之前就被丢回 "image"，后端 selector 永不命中，
        // DB 实测 tasks.operation="image"（超分与普通改图同价）。
        // ⇒ 断言必须落在**函数的实际返回值**上，不能落在源码文本上。
        const input = await prepareBackendGenerationTask({
            mode: "image",
            prompt: "AI 超分 · 2K · 保真放大",
            config: superResolveTestConfig(),
            metadata: { canvasEditOperation: "image_upscale" },
        });
        expect(input.operation).toBe("image_upscale");
    });

    test("★ 回归保护：非超分图片任务仍是 image（不被超分分支污染）", async () => {
        const input = await prepareBackendGenerationTask({
            mode: "image",
            prompt: "画一只猫",
            config: superResolveTestConfig(),
        });
        expect(input.operation).toBe("image");
    });

    test("★ 回归保护：video 任务的 operation 仍由 generationOperation() 决定", async () => {
        const input = await prepareBackendGenerationTask({
            mode: "video",
            prompt: "小猫在流泪",
            config: superResolveTestConfig("video"),
            referenceImages: [{ id: "r1", name: "r.png", type: "image/png", url: "https://cdn.example.com/r.png" }],
        });
        expect(input.operation).toBe("image_to_video");
    });

    // ★ 任务 3 链路验证（控制线 2026-10-04 裁定降级为「任务创建→计费→上游请求构造发出」三段）：
    // step 0 探针已证前两段（DB 计费单 price_tier_id=T_UPSCALE）+ 第三段「发出」
    // （error=外部服务域名解析失败，说明请求已构造并发出）。本组补「修复后的 payload 正确性」。
    test("★ size 修复贯通：payload 携带按目标档构造的 size（非源节点历史尺寸）", async () => {
        // 模拟修复后的调用：media-tools 用源图实际像素 + 目标档算出 size 后写入 config
        const input = await prepareBackendGenerationTask({
            mode: "image",
            prompt: "AI 超分 · 2K · 保真放大",
            config: { ...superResolveTestConfig(), size: superResolveSize(960, 960, "2k") },
            metadata: { canvasEditOperation: "image_upscale" },
        });
        // 960×960 源图对齐 2K ⇒ 2048×2048（而不是源节点残留的 1360x1024）
        expect(input.input?.config?.size).toBe("2048x2048");
        expect(input.input?.config?.size).not.toBe("1360x1024");
    });

    test("★ prompt 修复贯通：payload 携带 faithful 不变量片段（不再只是标题）", async () => {
        const title = "AI 超分 · 2K · 保真放大";
        const input = await prepareBackendGenerationTask({
            mode: "image",
            prompt: `${title}\n${superResolvePromptFragment("faithful")}`,
            config: superResolveTestConfig(),
            metadata: { canvasEditOperation: "image_upscale" },
        });
        expect(input.prompt).toContain("AI 超分 · 2K · 保真放大");
        expect(input.prompt).toContain("严格保持");
        expect(input.prompt).toContain("构图");
        // 回归保护：prompt 不再等于纯标题
        expect(input.prompt).not.toBe(title);
    });

    test("★ 两档 payload 的 prompt 必须不同（mode 有语义落点）", async () => {
        const build = (mode: "faithful" | "enhance") =>
            prepareBackendGenerationTask({
                mode: "image",
                prompt: `AI 超分 · 2K\n${superResolvePromptFragment(mode)}`,
                config: superResolveTestConfig(),
                metadata: { canvasEditOperation: "image_upscale" },
            });
        const faithful = await build("faithful");
        const enhance = await build("enhance");
        expect(faithful.prompt).not.toBe(enhance.prompt);
        expect(faithful.prompt).toContain("严格保持");
        expect(enhance.prompt).toContain("允许重绘");
    });
});

describe("参数面", () => {
    test("目标档只含 2K / 4K（超分只跑一次，见 MASTER-PLAN L399 F-06 衔接口径）", () => {
        expect(SUPER_RESOLVE_TARGETS.map((item) => item.value)).toEqual(["2k", "4k"]);
    });

    test("默认目标档 2K", () => {
        expect(DEFAULT_SUPER_RESOLVE_PARAMS.targetResolution).toBe("2k");
    });
});

describe("★ size 构造（控制线 2026-10-04 追加：不继承源节点 metadata）", () => {
    // 根因：超分原走 buildGenerationConfig(config, node, "image")，该函数取
    // node.metadata.size ?? config.size —— 源节点携带历史生成尺寸时，超分提交历史尺寸，
    // 使弹窗承诺的「长边对齐 2K/4K」落空（测试线实测 960×960 源图 → 1445×1088，长边 < 2048）。
    test("1:1 源图对齐 2K 得到 2048×2048", () => {
        expect(superResolveSize(960, 960, "2k")).toBe("2048x2048");
    });

    test("4:3 源图对齐 2K：长边 2048，短边按比例", () => {
        expect(superResolveSize(1360, 1024, "2k")).toBe("2048x1542");
    });

    test("16:9 源图对齐 4K：长边 4096，短边按比例", () => {
        expect(superResolveSize(1920, 1080, "4k")).toBe("4096x2304");
    });

    test("竖图（3:4）长边仍对齐 target", () => {
        expect(superResolveSize(768, 1024, "2k")).toBe("1536x2048");
    });

    test("长边恒等于目标档（这是「兑现弹窗承诺」的机器可检契约）", () => {
        for (const [w, h] of [[960, 960], [1360, 1024], [1920, 1080], [768, 1024], [500, 3000]]) {
            for (const tier of ["2k", "4k"] as const) {
                const [outW, outH] = superResolveSize(w, h, tier).split("x").map(Number);
                const expected = tier === "2k" ? 2048 : 4096;
                expect(Math.max(outW, outH)).toBe(expected);
            }
        }
    });

    test("退化输入不产生 0 或负尺寸", () => {
        // 0×0 的源图不可能出现（超分前置校验 node.metadata.content），
        // 但即使传入也必须给出合法正整数尺寸，不能崩或产出 "0x0"。
        const [w0, h0] = superResolveSize(0, 0, "2k").split("x").map(Number);
        expect(w0).toBeGreaterThan(0);
        expect(h0).toBeGreaterThan(0);
        const [w1, h1] = superResolveSize(-5, 10, "2k").split("x").map(Number);
        expect(w1).toBeGreaterThan(0);
        expect(h1).toBe(2048);
    });
});

describe("★ mode → 提示词语义（控制线 2026-10-04 追加）", () => {
    // 现状问题：prompt 只是标题字符串「AI 超分 · 4K · 保真放大」，对模型零语义约束。
    test("faithful 逐项枚举不变量（构图/取景/色调/元素位置/数量）", () => {
        const fragment = superResolvePromptFragment("faithful");
        for (const invariant of ["构图", "取景", "色调", "位置", "数量"]) {
            expect(fragment).toContain(invariant);
        }
        expect(fragment).toContain("不得新增或删除");
    });

    test("enhance 明确允许重绘细节，但仍守住构图与数量", () => {
        const fragment = superResolvePromptFragment("enhance");
        expect(fragment).toContain("允许重绘");
        expect(fragment).toContain("构图");
        expect(fragment).toContain("数量");
    });

    test("两档提示词必须不同（否则 mode 无意义）", () => {
        expect(SUPER_RESOLVE_PROMPT_FRAGMENTS.faithful).not.toBe(SUPER_RESOLVE_PROMPT_FRAGMENTS.enhance);
    });

    test("faithful 比 enhance 更严格（含「严格保持」级措辞）", () => {
        expect(SUPER_RESOLVE_PROMPT_FRAGMENTS.faithful).toContain("严格保持");
        expect(SUPER_RESOLVE_PROMPT_FRAGMENTS.enhance).not.toContain("严格保持以下全部不变");
    });

    test("未知 mode 回退到 faithful（保守优先）", () => {
        expect(superResolvePromptFragment("bogus" as never)).toBe(SUPER_RESOLVE_PROMPT_FRAGMENTS.faithful);
    });
});
