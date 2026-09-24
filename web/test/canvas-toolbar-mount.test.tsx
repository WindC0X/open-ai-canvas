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

// 回归：第三缺陷（画布渲染层缺失，2026-09-23）——W4 同一处置连带删除了整个画布区
// （容器 div + InfiniteCanvas + world layers + 面板层 + 模态层），节点虽进 store/后端却零 DOM。
test("画布层挂载：InfiniteCanvas 渲染且以 graphicsLayer 接入 leafer 层", () => {
    expect(pageSource).toContain("<InfiniteCanvas");
    expect(pageSource).toContain("interactive={!versions.preview}");
    expect(pageSource).toMatch(/graphicsLayer=\{\s*<CanvasLeaferGraphicsLayer/);
});

test("画布世界层与节点上下文挂载（节点 DOM 的来源）", () => {
    expect(pageSource).toContain("<CanvasProjectWorldLayers");
    expect(pageSource).toContain("<CanvasNodeActionContext.Provider");
    expect(pageSource).toContain("<CanvasNodeGraphContext.Provider");
});

test("同区面板与模态层挂载（活动任务/专注模式/agent 面板/短剧引导/分享/风格/导演/导入）", () => {
    for (const component of [
        "<CanvasActiveTaskPanel",
        "<CanvasFocusModeBar",
        "<CanvasCloudAgentPanel",
        "<CanvasShortDramaGuide",
        "<CanvasShareModal",
        "<CanvasStylePickerModal",
        "<CanvasDirectorTemplateModal",
        "<LibTVImportDialog",
        "<TapNowImportDialog",
    ]) {
        expect(pageSource).toContain(component);
    }
});

test("节点 DOM 锚点 data-node-id 由节点组件提供（e2e 可见性断言依据）", () => {
    const nodeSource = readFileSync(new URL("../src/components/canvas/canvas-node.tsx", import.meta.url), "utf8");
    expect(nodeSource).toContain("data-node-id={data.id}");
});

// 回归：第 4 缺陷（条件结构拼接，2026-09-23）——W4 拼接时把上游的
// {angleNode?.metadata?.content ? ( wrapper 装到了 fork 本体 node={selectedPanelNode} 上，
// 条件对普通节点恒 false ⇒ composer 面板永不渲染。以下两例锁定「条件与渲染对象配对」。
test("普通节点 toggleDialog 后 composer 面板必须可渲染（无 angleNode 条件包裹）", () => {
    const match = pageSource.match(/\{selectedPanelNode \? \([\s\S]*?<\/AffordanceSurface>/);
    expect(match).toBeTruthy();
    const block = match![0];
    expect(block).toContain("<CanvasNodePanelOverlay");
    expect(block).toContain("node={selectedPanelNode}");
    expect(block).not.toContain("angleNode?.metadata?.content ? (");
});

test("angleNode 面板（独立块）仍可达：条件与渲染对象配对", () => {
    const conditionCount = (pageSource.match(/angleNode\?\.metadata\?\.content \? \(/g) || []).length;
    expect(conditionCount).toBe(1);
    // 形态跟随 fork 产品线：多角度编辑器为居中的可关闭弹窗（2247c7c1 引入；W1-a 合并曾再度丢失，
    // 2e4a31c5 在 fork 线修复过一次，此处以全量套件口径锁定：条件块内渲染 CanvasNodeAnglePanel 自身，不指向 selectedPanelNode）。
    const match = pageSource.match(/\{angleNode\?\.metadata\?\.content \? \([\s\S]*?<CanvasNodeAnglePanel/);
    expect(match).toBeTruthy();
    expect(match![0]).not.toContain("selectedPanelNode");
});

// 回归：F7（2026-09-24）——主工具栏「工作区」按钮接线；W4 区域恢复时丢失，
// 组件侧 ?.() 可选调用使按钮成为静默死键。
test("CanvasToolbar 挂载携带工作区开关接线（F7）", () => {
    expect(pageSource).toContain("onOpenWorkspace={() => setWorkspaceOpen(value => !value)}");
    const toolbarSource = readFileSync(new URL("../src/components/canvas/canvas-toolbar.tsx", import.meta.url), "utf8");
    expect(toolbarSource).toContain("onOpenWorkspace");
});

// 回归：F8/F9（2026-09-24）——画布浮层双挂载清理：每个覆盖层组件全局只允许一处挂载。
test("画布浮层唯一挂载（F8/F9：删除遗留第二实例）", () => {
    const counts = {
        searchModal: (pageSource.match(/<CanvasNodeSearchModal/g) || []).length,
        connectionMenu: (pageSource.match(/<CanvasConnectionCreateMenu/g) || []).length,
        selectionToolbar: (pageSource.match(/<CanvasProjectSelectionToolbar/g) || []).length,
        minimap: (pageSource.match(/<Minimap/g) || []).length,
        replaceHover: (pageSource.match(/connectionReplaceHover \? \(/g) || []).length,
    };
    expect(counts).toEqual({ searchModal: 1, connectionMenu: 1, selectionToolbar: 1, minimap: 1, replaceHover: 1 });
});
