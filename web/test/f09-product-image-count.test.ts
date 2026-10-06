import { describe, expect, test } from "bun:test";

import { prepareBackendGenerationTask } from "../src/services/api/generation-task";
import { buildGenerationConfig } from "../src/lib/canvas/canvas-project-generation";
import { createModelChannel, defaultConfig, encodeChannelModel } from "../src/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

/**
 * F-09 三期 §2.1：productImageCount 前端赋值。
 *
 * 后端 providerConfig.ProductImageCount 声明「前 N 张 referenceImages 是产品图」，
 * 据此注入图片角色清单（backend/internal/app/prompt_image_role.go）。
 * 本组测试锁住【真实请求体】这一接缝（V1：断言真实生产接缝，非镜像实现）：
 * 从节点 metadata → buildGenerationConfig → prepareBackendGenerationTask → input.config。
 */

function imageConfig() {
    const channel = createModelChannel({
        id: "f09-channel",
        name: "F-09 Channel",
        baseUrl: "https://example.com/api",
        apiKey: "test-key",
        interfaceType: "chat-completion",
        models: ["nano-banana-2"],
        modelCosts: [{
            model: "nano-banana-2",
            capability: "image",
            protocol: "chat-completion",
            billingMode: "fixed_request",
            unitPriceMicrocredits: 1,
        }],
    });
    const model = encodeChannelModel(channel.id, "nano-banana-2");
    return { ...defaultConfig, channels: [channel], model, imageModel: model, baseUrl: channel.baseUrl, interfaceType: channel.interfaceType };
}

/** F-09 生成节点（Config 类型，带 productImageCount 声明）。 */
function cloneRecreateNode(productImageCount?: number): CanvasNodeData {
    return {
        id: "clone-config",
        type: CanvasNodeType.Config,
        title: "爆款复刻",
        position: { x: 0, y: 0 },
        width: 320,
        height: 200,
        metadata: {
            composerContent: "按版式参考图复刻",
            ...(productImageCount === undefined ? {} : { productImageCount }),
        },
    };
}

/** 普通图片节点（非 F-09）。 */
function plainImageNode(): CanvasNodeData {
    return {
        id: "plain-image",
        type: CanvasNodeType.Image,
        title: "普通图",
        position: { x: 0, y: 0 },
        width: 320,
        height: 200,
        metadata: { composerContent: "画一只猫" },
    };
}

function referenceImages(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        id: `ref-${index + 1}`,
        name: `image-${index + 1}.png`,
        type: "image/png",
        url: `https://cdn.example.com/image-${index + 1}.png`,
    }));
}

describe("F-09 §2.1 productImageCount 前端赋值", () => {
    test("★ 节点声明 productImageCount 时，真实请求体 input.config 携带该字段", async () => {
        const config = buildGenerationConfig(imageConfig(), cloneRecreateNode(1), "image");
        const request = await prepareBackendGenerationTask({
            mode: "image",
            prompt: "复刻这张版式",
            config,
            referenceImages: referenceImages(2),
        });
        // 真实接缝：请求体的 input.config.productImageCount（序列化后 = 线上字节）
        const serialized = JSON.parse(JSON.stringify(request)) as { input: { config: Record<string, unknown> } };
        expect(serialized.input.config.productImageCount).toBe(1);
    });

    test("★ 非 F-09 节点（无声明）不携带该字段（零影响）", async () => {
        const config = buildGenerationConfig(imageConfig(), plainImageNode(), "image");
        const request = await prepareBackendGenerationTask({
            mode: "image",
            prompt: "画一只猫",
            config,
            referenceImages: referenceImages(2),
        });
        // ★ 断言【序列化后】的请求体 —— 真实接缝是 JSON 线上的字节，
        //   而不是内存对象（undefined 键在 JS 对象里仍存在，但 JSON.stringify 会省略）。
        const serialized = JSON.parse(JSON.stringify(request)) as { input: { config: Record<string, unknown> } };
        const body = serialized.input.config;
        // ★ 必须是「键不存在」，不是「值为 0」—— 后端靠 omitempty 区分「不注入」与「注入零产品图」
        expect("productImageCount" in body).toBe(false);
        expect(body.productImageCount).toBeUndefined();
    });

    test("N = 产品图张数（2 张产品 + 1 张版式参考）", async () => {
        const config = buildGenerationConfig(imageConfig(), cloneRecreateNode(2), "image");
        const request = await prepareBackendGenerationTask({
            mode: "image",
            prompt: "复刻",
            config,
            referenceImages: referenceImages(3),
        });
        expect((request.input as { config: Record<string, unknown> }).config.productImageCount).toBe(2);
    });

    test("节点未设 productImageCount 时透传 undefined（不臆造默认值）", async () => {
        const config = buildGenerationConfig(imageConfig(), cloneRecreateNode(), "image");
        expect(config.productImageCount).toBeUndefined();
    });

    test("★ 顺序契约：前 N 张必须是产品图（记录调用方前置条件，不做后端校验）", async () => {
        // 后端按位置编号且无法校验（providerMedia 无语义标签），
        // 因此这里锁住「数组顺序 = 产品图在前」这一调用方契约的【数据形态】：
        // 产品图 2 张在前、版式参考图 1 张在后，N=2。
        const config = buildGenerationConfig(imageConfig(), cloneRecreateNode(2), "image");
        const request = await prepareBackendGenerationTask({
            mode: "image",
            prompt: "复刻",
            config,
            referenceImages: referenceImages(3),
        });
        const body = request.input as { config: Record<string, unknown>; referenceImages: { id: string }[] };
        expect(body.config.productImageCount).toBe(2);
        // 数组顺序即提交顺序（前 2 张 = 产品图）—— 与后端编号「图1～2＝产品图组」一致
        expect(body.referenceImages.map((image) => image.id)).toEqual(["ref-1", "ref-2", "ref-3"]);
    });

    test("buildGenerationConfig 从节点 metadata 读取，节点值优先于全局 config", async () => {
        const globalConfig = { ...imageConfig(), productImageCount: 9 };
        const config = buildGenerationConfig(globalConfig, cloneRecreateNode(1), "image");
        // 节点声明优先（与 size/quality 等字段同一套合并语义）
        expect(config.productImageCount).toBe(1);
    });
});
