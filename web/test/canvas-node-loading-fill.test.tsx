import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasNodeLoadingFill, resolveLoadingFillPhase } from "@/components/canvas/canvas-node-loading-fill";
import { canvasThemes } from "@/lib/canvas-theme";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

const darkTheme = canvasThemes.dark;
const lightTheme = canvasThemes.light;
const TASK = "task-1";

function loadingNode(metadata: Record<string, unknown> = {}): CanvasNodeData {
    return {
        id: "n-fill",
        type: CanvasNodeType.Image,
        title: "fill-test",
        position: { x: 0, y: 0 },
        width: 384,
        height: 384,
        metadata: { status: "loading", taskId: TASK, ...metadata },
    } as unknown as CanvasNodeData;
}

function render(node: CanvasNodeData, theme: typeof darkTheme = darkTheme) {
    return renderToStaticMarkup(<CanvasNodeLoadingFill node={node} theme={theme} />);
}

describe("resolveLoadingFillPhase(S04 v5.1) 三态推导", () => {
    test("里程碑 5(排队) 归入无精确进度 → fallback 60s 缓爬(flora 6e4 契约, 非 real)", () => {
        const r = resolveLoadingFillPhase({ taskId: TASK, taskProgress: 5, lastTaskId: null, lastScale: null });
        expect(r.phase).toBe("fallback");
        expect(r.scale).toBeNull();
    });

    test("里程碑 0(连接上游) 同样 fallback", () => {
        const r = resolveLoadingFillPhase({ taskId: TASK, taskProgress: 0, lastTaskId: TASK, lastScale: null });
        expect(r.phase).toBe("fallback");
    });

    test("首个精确值(>5): lastScale null → real 内联刻度 + transition(从 fallback 封顶自然过渡)", () => {
        const r = resolveLoadingFillPhase({ taskId: TASK, taskProgress: 35, lastTaskId: TASK, lastScale: null });
        expect(r.phase).toBe("real");
        expect(r.scale).toBe(0.35);
    });

    test("推进: 同任务 35→50 走 real 平滑过渡", () => {
        const r = resolveLoadingFillPhase({ taskId: TASK, taskProgress: 50, lastTaskId: TASK, lastScale: 0.35 });
        expect(r.phase).toBe("real");
        expect(r.scale).toBe(0.5);
    });

    test("0=未知契约: 同任务已有真实刻度 35% 时报 0 → 保持 0.35 不回缩(flora g 无 ETA 时 update(t))", () => {
        const r = resolveLoadingFillPhase({ taskId: TASK, taskProgress: 0, lastTaskId: TASK, lastScale: 0.35 });
        expect(r.phase).toBe("real");
        expect(r.scale).toBe(0.35);
    });

    test("真实回落保留 flora correction: 同任务 35→20 桥接", () => {
        const r = resolveLoadingFillPhase({ taskId: TASK, taskProgress: 20, lastTaskId: TASK, lastScale: 0.35 });
        expect(r.phase).toBe("correction");
        expect(r.fromScale).toBe(0.35);
        expect(r.toScale).toBe(0.2);
    });

    test("retry(新 taskId) 重置: 旧刻度 35% + 新任务报 0 → fallback 从头缓爬", () => {
        const r = resolveLoadingFillPhase({ taskId: "task-2", taskProgress: 0, lastTaskId: TASK, lastScale: 0.35 });
        expect(r.phase).toBe("fallback");
    });

    test("retry(新 taskId) 重置: 新任务精确值 50 → real 0.5(刻度已归零)", () => {
        const r = resolveLoadingFillPhase({ taskId: "task-2", taskProgress: 50, lastTaskId: TASK, lastScale: 0.35 });
        expect(r.phase).toBe("real");
        expect(r.scale).toBe(0.5);
    });

    test("running 无数值: 已有刻度 → 保持(flora g 无 ETA 时 update(t)); 无刻度 → fallback", () => {
        const held = resolveLoadingFillPhase({ taskId: TASK, taskProgress: undefined, lastTaskId: TASK, lastScale: 0.35 });
        expect(held.phase).toBe("real");
        expect(held.scale).toBe(0.35);
        const fresh = resolveLoadingFillPhase({ taskId: TASK, taskProgress: undefined, lastTaskId: TASK, lastScale: null });
        expect(fresh.phase).toBe("fallback");
    });

    test("满格: 100 → real scaleX(1)", () => {
        const r = resolveLoadingFillPhase({ taskId: TASK, taskProgress: 100, lastTaskId: TASK, lastScale: 0.35 });
        expect(r.phase).toBe("real");
        expect(r.scale).toBe(1);
    });
});

describe("CanvasNodeLoadingFill 渲染(S04 v5.1)", () => {
    test("loading 无进度: fallback 缓爬 + 内联 5% 封顶(reduced-motion 静态可见)", () => {
        const html = render(loadingNode({}));
        expect(html).toContain('data-phase="fallback"');
        expect(html).toContain("--loading-target-scale:0.05");
        expect(html).toContain("rgba(255,255,255,.10)");
    });

    test("loading 精确进度: 内联刻度 + transition", () => {
        const html = render(loadingNode({ taskProgress: 80 }));
        expect(html).toContain('data-phase="real"');
        expect(html).toContain("--loading-target-scale:0.8");
        expect(html).toContain("transition");
    });

    test("status=success: SSR 不渲染(挂载条件在父层)", () => {
        const html = render({ ...loadingNode({ taskProgress: 80 }), metadata: { status: "success" } } as CanvasNodeData);
        expect(html).toBe("");
    });

    test("填充色走 token: light 主题用暗色 alpha", () => {
        expect(render(loadingNode(), lightTheme)).toContain("rgba(17,24,39,.07)");
    });

    test("aria-hidden: 纯视觉层不进无障碍树", () => {
        expect(render(loadingNode())).toContain('aria-hidden="true"');
    });
});
