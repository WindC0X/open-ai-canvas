import { describe, expect, test } from "bun:test";

import { fitNodeSize, MEDIA_NODE_MAX_SIZE, MEDIA_NODE_MIN_SIZE, VIDEO_NODE_MAX_SIZE } from "../src/lib/canvas/canvas-node-size";

// 媒体标准盒单一源（2026-09-21 用户实测：同一 1:1 比例，扩图占位 520×520 而生成结果
// 被 16:9 默认盒钳成 420×420，画布上大小不一致且生成结果偏小）。
// 本文件把「同一比例 = 同一尺寸」钉成契约：上传、扩图占位、hydrate 自然尺寸、完成回写
// 与比例→尺寸基准全部走 fitNodeSize 的同一组边界（720×520 上限 + 420×236 地板）。
describe("媒体节点标准尺寸（同比例同一尺寸）", () => {
    test("标准盒与视频上限同源，且默认边界即标准盒", () => {
        expect(MEDIA_NODE_MAX_SIZE).toEqual({ width: 720, height: 520 });
        expect(VIDEO_NODE_MAX_SIZE).toEqual(MEDIA_NODE_MAX_SIZE);
        // 不传边界 = 标准盒（上传/hydrate/完成回写/宫格拆分的调用形态）
        expect(fitNodeSize(2000, 2000)).toEqual(fitNodeSize(2000, 2000, MEDIA_NODE_MAX_SIZE.width, MEDIA_NODE_MAX_SIZE.height));
    });

    test("1:1 → 520×520（生成结果与扩图占位同尺寸）", () => {
        expect(fitNodeSize(1254, 1254)).toEqual({ width: 520, height: 520 });
        // 扩图占位目标像素（1:1 源 1254 按 1.25 扩到 1568）与生成结果必须落在同一尺寸
        expect(fitNodeSize(1568, 1568)).toEqual(fitNodeSize(1254, 1254));
    });

    test("16:9 → 720×405（与默认盒一致，不因标准盒变高而放大）", () => {
        expect(fitNodeSize(1920, 1080)).toEqual({ width: 720, height: 405 });
    });

    test("9:16 竖版受最小宽度地板约束（420 宽，高度不设上限）", () => {
        const size = fitNodeSize(1080, 1920);
        expect(size.width).toBe(MEDIA_NODE_MIN_SIZE.width);
        expect(size.width / size.height).toBeCloseTo(9 / 16, 3);
    });
});
