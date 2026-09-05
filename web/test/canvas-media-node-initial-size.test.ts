import { describe, expect, test } from "bun:test";

import { mediaNodeInitialSize } from "../src/lib/canvas/canvas-project-generation";
import { defaultModelCapabilityConfig, type ModelCapabilityConfig } from "../src/lib/model-capabilities";
import { defaultConfig, type AiConfig, type ModelChannel } from "../src/stores/use-config-store";
import { NODE_DEFAULT_SIZE } from "../src/constant/canvas";

function configWithVideoModel(ratios: string[], defaultRatio: string): AiConfig {
    const capabilityConfig: ModelCapabilityConfig = defaultModelCapabilityConfig("xai-video", "grok-imagine-video");
    capabilityConfig.video!.ratios = ratios;
    capabilityConfig.video!.defaultRatio = defaultRatio;
    // models 数组存原始名；目录选项由 modelOptionsFromChannels 编码为 "<channelId>::<model>"。
    const channel: ModelChannel = {
        id: "ch1",
        enabled: true,
        name: "test",
        baseUrl: "https://relay.example.com",
        apiKey: "k",
        apiFormat: "openai",
        models: ["grok-imagine-video"],
        modelCosts: [{ model: "grok-imagine-video", displayName: "grok-imagine-video", capability: "video" as const, billingMode: "fixed_request" as const, unitPriceMicrocredits: 1, capabilityConfig }],
    } as unknown as ModelChannel;
    const models = ["ch1::grok-imagine-video"];
    return { ...defaultConfig, channels: [channel], models, videoModels: models, videoModel: models[0] };
}

describe("mediaNodeInitialSize", () => {
    test("video 渠道默认 1:1 → 空框跟随为正方形（420 最小宽度地板，与 S05 实测一致）", () => {
        const size = mediaNodeInitialSize(configWithVideoModel(["1:1", "16:9", "9:16"], "1:1"), "video");
        expect(size).toEqual({ width: 420, height: 420 });
    });

    test("video 渠道默认 16:9 → 空框为 720×405 基准横幅", () => {
        const size = mediaNodeInitialSize(configWithVideoModel(["16:9"], "16:9"), "video");
        expect(size).toEqual({ width: 720, height: 405 });
    });

    test("video 渠道默认 9:16 → 竖版空框（高比宽大，比例正确）", () => {
        const size = mediaNodeInitialSize(configWithVideoModel(["9:16"], "9:16"), "video");
        expect(size).not.toBeNull();
        expect(size!.width / size!.height).toBeCloseTo(9 / 16, 2);
    });

    test("无渠道模型 → null 保持 NODE_DEFAULT_SIZE", () => {
        expect(mediaNodeInitialSize(defaultConfig, "video")).toBeNull();
        expect(mediaNodeInitialSize(defaultConfig, "image")).toBeNull();
    });

    test("image 同链路回归：1:1 渠道 → 正方形（与 S05 行为一致）", () => {
        const capabilityConfig: ModelCapabilityConfig = defaultModelCapabilityConfig("openai-image", "gpt-image-2");
        const channel: ModelChannel = {
            id: "ch2",
            enabled: true,
            name: "t2",
            baseUrl: "https://relay.example.com",
            apiKey: "k",
            apiFormat: "openai",
            models: ["gpt-image-2"],
            modelCosts: [{ model: "gpt-image-2", displayName: "gpt-image-2", capability: "image" as const, billingMode: "per_image" as const, unitPriceMicrocredits: 1, capabilityConfig }],
        } as unknown as ModelChannel;
        const models = ["ch2::gpt-image-2"];
        const config: AiConfig = { ...defaultConfig, channels: [channel], models, imageModels: models, imageModel: models[0] };
        const size = mediaNodeInitialSize(config, "image");
        expect(size).not.toBeNull();
        expect(size!.width).toBe(size!.height);
    });
});
