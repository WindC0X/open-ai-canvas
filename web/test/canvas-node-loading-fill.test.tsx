import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasNodeLoadingFill } from "@/components/canvas/canvas-node-loading-fill";
import { canvasThemes } from "@/lib/canvas-theme";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

const darkTheme = canvasThemes.dark;
const lightTheme = canvasThemes.light;

function loadingNode(metadata: Record<string, unknown> = {}): CanvasNodeData {
    return {
        id: "n-fill",
        type: CanvasNodeType.Image,
        title: "fill-test",
        position: { x: 0, y: 0 },
        width: 384,
        height: 384,
        metadata: { status: "loading", ...metadata },
    } as unknown as CanvasNodeData;
}

function render(node: CanvasNodeData, theme: typeof darkTheme = darkTheme) {
    return renderToStaticMarkup(<CanvasNodeLoadingFill node={node} theme={theme} />);
}

describe("CanvasNodeLoadingFill(S04 v5) 三态映射", () => {
    test("running 有精确进度(非首个值): 内联 --loading-target-scale + 0.3s ease-out transition, 无 data-phase", () => {
        const html = render(loadingNode({ taskProgress: 45 }));
        // SSR 单帧无上帧:首个真实值走 correction 桥接(与 design §4 "fallback→首个真实值走 correction" 一致)
        expect(html).toContain('data-phase="correction"');
        expect(html).toContain("--loading-from-scale:0");
        expect(html).toContain("--loading-to-scale:0.45");
    });

    test("progress=100 且仍 loading: 满格 scaleX(1)", () => {
        const html = render(loadingNode({ taskProgress: 100 }));
        expect(html).toContain("--loading-target-scale:1");
    });

    test("running 无进度(taskProgress undefined): data-phase=fallback 5% 小条", () => {
        const html = render(loadingNode({}));
        expect(html).toContain('data-phase="fallback"');
        expect(html).not.toContain("--loading-target-scale");
    });

    test("queued(taskProgress=0): 按 design §4 归入 fallback(0 不可见, 5% 静条表达已排队)", () => {
        const html = render(loadingNode({ taskProgress: 0 }));
        expect(html).toContain('data-phase="fallback"');
    });

    test("status=success(非 loading): SSR 不渲染(挂载条件在父层, 退出缓冲走 effect)", () => {
        const html = render({ ...loadingNode({ taskProgress: 80 }), metadata: { status: "success" } } as CanvasNodeData);
        expect(html).toBe("");
    });

    test("填充色走 token: dark=rgba(255,255,255,.10) / light=rgba(17,24,39,.07)", () => {
        expect(render(loadingNode(), darkTheme)).toContain("rgba(255,255,255,.10)");
        expect(render(loadingNode(), lightTheme)).toContain("rgba(17,24,39,.07)");
    });

    test("aria-hidden: 纯视觉层不进无障碍树", () => {
        expect(render(loadingNode())).toContain('aria-hidden="true"');
    });
});
