import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { activeConnectionPath, connectionHandleY } from "../src/components/canvas/canvas-connections";
import { STORYBOARD_HEADER_HEIGHT, STORYBOARD_ROW_HEIGHT, storyboardTableHeight } from "../src/lib/canvas/canvas-storyboard-layout";
import type { CanvasNodeData, StoryboardRow } from "../src/types/canvas";

const rows: StoryboardRow[] = [
    { id: "row-1", shotNumber: 1, durationSeconds: 6, prompt: "", status: "idle" },
    { id: "row-2", shotNumber: 2, durationSeconds: 6, prompt: "", status: "idle" },
    { id: "row-3", shotNumber: 3, durationSeconds: 6, prompt: "", status: "idle" },
] as unknown as StoryboardRow[];

const scriptNode = {
    id: "script-1",
    type: "script",
    position: { x: 630, y: 359 },
    width: 872,
    height: 620,
    content: "",
    metadata: { storyboard: { rows }, storyboardComposerHeight: 104 },
} as unknown as CanvasNodeData;

const sourceImage = {
    id: "image-1",
    type: "image",
    position: { x: 120, y: 240 },
    width: 320,
    height: 560,
    content: "",
} as unknown as CanvasNodeData;

test("row handle id resolves the shot row center on the storyboard left edge", () => {
    const expected = scriptNode.position.y + STORYBOARD_HEADER_HEIGHT + STORYBOARD_ROW_HEIGHT / 2;
    expect(connectionHandleY(scriptNode, "row:row-1")).toBe(expected);
    // 行 2/3 依次下移一行:
    expect(connectionHandleY(scriptNode, "row:row-2")).toBe(expected + STORYBOARD_ROW_HEIGHT);
    expect(connectionHandleY(scriptNode, "row:row-3")).toBe(expected + STORYBOARD_ROW_HEIGHT * 2);
});

test("target-side scroll offset shifts the row anchor and stays clamped", () => {
    const base = scriptNode.position.y + STORYBOARD_HEADER_HEIGHT + STORYBOARD_ROW_HEIGHT / 2;
    expect(connectionHandleY(scriptNode, "row:row-1", 20)).toBe(base - 20);
    // 滚动超过首行时 clamp 到表格顶部(不减成负数):
    const tableHeight = storyboardTableHeight(scriptNode.height, scriptNode.metadata?.storyboardComposerHeight);
    expect(connectionHandleY(scriptNode, "row:row-1", tableHeight)).toBe(scriptNode.position.y + STORYBOARD_HEADER_HEIGHT + 4);
});

test("absent handle keeps the legacy edge midpoint (non-storyboard targets unchanged)", () => {
    expect(connectionHandleY(scriptNode, undefined)).toBe(scriptNode.position.y + scriptNode.height / 2);
    expect(connectionHandleY(scriptNode, "row:missing-row")).toBe(scriptNode.position.y + scriptNode.height / 2);
});

test("preview path end follows the target row handle instead of the node midpoint", () => {
    const rowY = scriptNode.position.y + STORYBOARD_HEADER_HEIGHT + STORYBOARD_ROW_HEIGHT / 2;
    const path = activeConnectionPath(sourceImage, { nodeId: sourceImage.id, handleType: "source" }, { x: 400, y: 300 }, scriptNode, 0, "row:row-1", 0);
    const coords = path.split(" ").map(Number).filter((n) => !Number.isNaN(n));
    // 三次贝塞尔: M x0 y0 C .. .., x1 y1 — 终点是最后两个数:
    const endY = coords[coords.length - 1];
    expect(endY).toBeCloseTo(rowY, 5);
    const endX = coords[coords.length - 2];
    expect(endX).toBe(scriptNode.position.x);
});

test("preview path without target handle falls back to the node midpoint (pre-regression guard)", () => {
    const path = activeConnectionPath(sourceImage, { nodeId: sourceImage.id, handleType: "source" }, { x: 400, y: 300 }, scriptNode, 0, undefined, 0);
    const coords = path.split(" ").map(Number).filter((n) => !Number.isNaN(n));
    expect(coords[coords.length - 1]).toBeCloseTo(scriptNode.position.y + scriptNode.height / 2, 5);
});

test("leafer renders both single and batch connection previews with target handle snap", () => {
    const source = readFileSync(new URL("../src/components/canvas/canvas-leafer-graphics-layer.tsx", import.meta.url), "utf8");
    // 单线预览: 目标侧 handleId + 目标侧滚动偏移都要传给 activeConnectionPath;
    // batch 预览(v2 曾漏): 多选拖拽同一语义, 防回归锚。
    expect(source).toContain("props.connectionTargetHandleId : undefined");
    expect(source).toContain("props.scriptScrollTopById[props.connectionTargetNodeId] || 0");
    expect(source).toContain("batch.targetHandleId");
    expect(source).toContain("props.scriptScrollTopById[batch.targetNodeId] || 0");
});
