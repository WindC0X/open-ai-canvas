/**
 * S08 像素纪律轮: 节点几何契约
 * - 尺寸变化无过渡: 用户实测 250ms 拖尾"感觉不太好", 撤销过渡(拖拽跟手优先)
 * - NODE_DEFAULT_SIZE.Text = 384×384 (flora 文本族)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CanvasNodeType } from "@/types/canvas";
import { NODE_DEFAULT_SIZE } from "@/constant/canvas";

const nodeSource = readFileSync(join(import.meta.dir, "../src/components/canvas/canvas-node.tsx"), "utf-8");

describe("canvas-node 几何契约", () => {
    test("尺寸变化无 width/height 过渡(撤销 250ms 拖尾; 其余 transition 为工具条/徽章 hover, 允许)", () => {
        expect(nodeSource.includes("width var(--motion-dur-base)")).toBe(false);
        expect(nodeSource.includes('transition: isResizingNow')).toBe(false);
    });

    test("resize 无 rAF 依赖(后台标签安全)", () => {
        expect(nodeSource.includes("requestAnimationFrame")).toBe(false);
    });
});

describe("Text 节点默认几何", () => {
    test("NODE_DEFAULT_SIZE.Text = 384×384 (flora 文本族)", () => {
        expect(NODE_DEFAULT_SIZE[CanvasNodeType.Text].width).toBe(384);
        expect(NODE_DEFAULT_SIZE[CanvasNodeType.Text].height).toBe(384);
    });
});
