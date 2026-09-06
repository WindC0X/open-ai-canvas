import { describe, expect, test } from "bun:test";

import { fitNodeSize, MEDIA_SAME_RATIO_TOLERANCE, VIDEO_NODE_MAX_SIZE, videoCompletionSize } from "../src/lib/canvas/canvas-node-size";

describe("videoCompletionSize", () => {
    test("同比例媒体保持节点现框（flora 原位显现，不跳变）", () => {
        // 1:1 渠道：S07 前 405×405 → fitNodeSize(720,720,720,520) = 520×520 跳变；守卫后保持现框。
        const size = videoCompletionSize({ width: 420, height: 420 }, { width: 960, height: 960 });
        expect(size).toEqual({ width: 420, height: 420, keepPosition: true });
        // 16:9 渠道：720×405 现框 + 1280×720 媒体 → 保持。
        expect(videoCompletionSize({ width: 720, height: 405 }, { width: 1280, height: 720 })).toEqual({ width: 720, height: 405, keepPosition: true });
    });

    test("比例真不同才 refit 到 720×520 界内", () => {
        const portrait = videoCompletionSize({ width: 720, height: 405 }, { width: 1080, height: 1920 });
        expect(portrait.keepPosition).toBe(false);
        expect(portrait).toEqual({ ...fitNodeSize(1080, 1920, VIDEO_NODE_MAX_SIZE.width, VIDEO_NODE_MAX_SIZE.height), keepPosition: false });
    });

    test("容差边界：1.9% 保持 / 2.1% refit", () => {
        const base = { width: 400, height: 400 };
        const keep = videoCompletionSize(base, { width: 1019, height: 1000 }); // 差 1.9%
        expect(keep.keepPosition).toBe(true);
        const refit = videoCompletionSize(base, { width: 1021, height: 1000 }); // 差 2.1%
        expect(refit.keepPosition).toBe(false);
        expect(MEDIA_SAME_RATIO_TOLERANCE).toBe(0.02);
    });

    test("媒体尺寸缺失时与旧逻辑逐字同义：退回节点现框再 fit", () => {
        const expected = fitNodeSize(720, 405, VIDEO_NODE_MAX_SIZE.width, VIDEO_NODE_MAX_SIZE.height);
        expect(videoCompletionSize({ width: 720, height: 405 }, {})).toEqual({ ...expected, keepPosition: false });
        expect(videoCompletionSize({ width: 720, height: 405 }, { width: 0, height: 0 })).toEqual({ ...expected, keepPosition: false });
        expect(videoCompletionSize({ width: 0, height: 0 }, {})).toEqual({ ...fitNodeSize(VIDEO_NODE_MAX_SIZE.width, VIDEO_NODE_MAX_SIZE.height, VIDEO_NODE_MAX_SIZE.width, VIDEO_NODE_MAX_SIZE.height), keepPosition: false });
    });

    test("节点现框无效（0 尺寸）时不做同比例判定，直接 fit 媒体", () => {
        const size = videoCompletionSize({ width: 0, height: 0 }, { width: 960, height: 540 });
        expect(size.keepPosition).toBe(false);
        expect(size).toEqual({ ...fitNodeSize(960, 540, VIDEO_NODE_MAX_SIZE.width, VIDEO_NODE_MAX_SIZE.height), keepPosition: false });
    });
});
