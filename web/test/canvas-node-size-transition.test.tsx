/**
 * S08 像素纪律轮: 节点几何过渡 + Text 384×384 契约
 * - canvas-node.tsx 源码快照: 程序性改尺寸带 base 档过渡, 拖拽/缩放时禁用(rAF-free, 后台安全)
 * - NODE_DEFAULT_SIZE.Text = 384×384 (flora 文本族)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CanvasNodeType } from "@/types/canvas";
import { NODE_DEFAULT_SIZE } from "@/constant/canvas";

const nodeSource = readFileSync(join(import.meta.dir, "../src/components/canvas/canvas-node.tsx"), "utf-8");

describe("canvas-node 尺寸过渡契约", () => {
    test("node-element 样式含 width/height 过渡声明", () => {
        expect(nodeSource.includes("width var(--motion-dur-base)")).toBe(true);
        expect(nodeSource.includes("height var(--motion-dur-base)")).toBe(true);
    });

    test("拖拽或缩放时过渡禁用(transition: none)", () => {
        expect(nodeSource.includes('isResizingNow || dragOffset ? "none"')).toBe(true);
    });

    test("isResizingNow 由 state 驱动(后台标签安全, 非rAF)", () => {
        expect(nodeSource.includes("useState(false)")).toBe(true);
        expect(nodeSource.includes("setIsResizingNow(true)")).toBe(true);
        expect(nodeSource.includes("setIsResizingNow(false)")).toBe(true);
    });
});

describe("Text 节点默认几何", () => {
    test("NODE_DEFAULT_SIZE.Text = 384×384 (flora 文本族)", () => {
        expect(NODE_DEFAULT_SIZE[CanvasNodeType.Text].width).toBe(384);
        expect(NODE_DEFAULT_SIZE[CanvasNodeType.Text].height).toBe(384);
    });
});
