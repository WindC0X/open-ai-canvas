import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// 回归：W4 集成遗漏（batch 10 第 2 缺陷，2026-09-23）——W4 处置类A③ 删除上游新版挂载块时，
// 把 CanvasFileDropOverlay / {emptyCanvasState} / <CanvasToolbar> 三件套一并删除且我方旧挂载未保留，
// 导致全画布无节点创建入口（素材插入除外）。本测试锁定三件套的渲染点必须存在，并携带创建回调。
const pageSource = readFileSync(new URL("../src/pages/canvas/project.tsx", import.meta.url), "utf8");

test("画布编辑区保留三件套渲染点（文件层回归护栏）", () => {
    expect(pageSource).toContain("<CanvasFileDropOverlay");
    expect(pageSource).toContain("{emptyCanvasState}");
    expect(pageSource).toContain("<CanvasToolbar");
});

test("emptyCanvasState 消费 freeformCreateCommands（无节点时仍有创建路径）", () => {
    expect(pageSource).toContain("const emptyCanvasState =");
    expect(pageSource).toContain("<CanvasFreeformEmptyState commands={freeformCreateCommands} />");
    expect(pageSource).toContain("useCanvasCreateCommands(");
});

test("CanvasToolbar 挂载携带文本/图片/分镜脚本创建回调", () => {
    expect(pageSource).toContain("onAddText={() => createNode(CanvasNodeType.Text)}");
    expect(pageSource).toContain("onAddImage={() => createNode(CanvasNodeType.Image)}");
    expect(pageSource).toContain("onAddScript={() => createNode(CanvasNodeType.Script)}");
});

test("画布工具栏自身渲染创建菜单组件（CanvasCreateMenu）", () => {
    const toolbarSource = readFileSync(new URL("../src/components/canvas/canvas-toolbar.tsx", import.meta.url), "utf8");
    expect(toolbarSource).toContain("<CanvasCreateMenu");
    expect(toolbarSource).toContain("commands={commands}");
});
