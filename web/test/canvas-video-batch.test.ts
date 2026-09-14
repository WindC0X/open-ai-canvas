import { describe, expect, test } from "bun:test";

import { videoBatchChildPositions, videoGenerationCountOf } from "@/pages/canvas/canvas-media-generation-executors";
import type { CanvasNodeData } from "@/types/canvas";

function nodeWithCount(videoGenerationCount?: number): CanvasNodeData {
    return {
        id: "v1",
        type: "video",
        title: "t",
        position: { x: 0, y: 0 },
        width: 480,
        height: 270,
        metadata: videoGenerationCount === undefined ? {} : { videoGenerationCount },
    };
}

describe("videoGenerationCountOf", () => {
    test("缺省/undefined 回退 1", () => {
        expect(videoGenerationCountOf(undefined)).toBe(1);
        expect(videoGenerationCountOf(nodeWithCount(undefined))).toBe(1);
    });

    test("合法份数>1 取整使用", () => {
        expect(videoGenerationCountOf(nodeWithCount(3))).toBe(3);
        expect(videoGenerationCountOf(nodeWithCount(2.9))).toBe(2);
    });

    test("0/负数/非有限值回退 1", () => {
        expect(videoGenerationCountOf(nodeWithCount(0))).toBe(1);
        expect(videoGenerationCountOf(nodeWithCount(-2))).toBe(1);
        // Number(undefined)=NaN → 回退。
        expect(videoGenerationCountOf(nodeWithCount(Number.NaN))).toBe(1);
    });

    test("份数=1 不参与批量", () => {
        expect(videoGenerationCountOf(nodeWithCount(1))).toBe(1);
    });
});

describe("videoBatchChildPositions", () => {
    const root = { x: 100, y: 100 };
    const cw = 480;
    const ch = 270;

    test("count=0/负数返回空数组", () => {
        expect(videoBatchChildPositions(root, 480, cw, ch, 0)).toHaveLength(0);
    });

    test("子节点两列网格排布且互不重叠", () => {
        const positions = videoBatchChildPositions(root, 480, cw, ch, 3);
        expect(positions).toHaveLength(3);
        // 第一列在 root 右侧（图像 batch 同构偏移），第二列再右移一个宽度+间隙。
        expect(positions[0].x).toBeGreaterThan(root.x + 480);
        expect(positions[1].x).toBeGreaterThan(positions[0].x + cw - 1);
        // 第三行换行到第一列。
        expect(positions[2].x).toBe(positions[0].x);
        expect(positions[2].y).toBeGreaterThan(positions[0].y);
        // 同列等距。
        expect(positions[1].y).toBe(positions[0].y);
    });
});
