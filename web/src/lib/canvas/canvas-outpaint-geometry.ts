export type OutpaintPadding = { left: number; top: number; right: number; bottom: number };

export type OutpaintDragEdge = "left" | "top" | "right" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export const OUTPAINT_MAX_LONG_EDGE = 4096;

type FrameAxis = "horizontal" | "vertical";

const ZERO_PADDING: OutpaintPadding = { left: 0, top: 0, right: 0, bottom: 0 };

function finiteOrZero(value: number) {
    return Number.isFinite(value) ? value : 0;
}

function positiveOrZero(value: number) {
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function sanitizePadding(padding: OutpaintPadding): OutpaintPadding {
    return {
        left: Math.max(0, finiteOrZero(padding.left)),
        top: Math.max(0, finiteOrZero(padding.top)),
        right: Math.max(0, finiteOrZero(padding.right)),
        bottom: Math.max(0, finiteOrZero(padding.bottom)),
    };
}

function roundPadding(padding: OutpaintPadding): OutpaintPadding {
    return {
        left: Math.round(padding.left),
        top: Math.round(padding.top),
        right: Math.round(padding.right),
        bottom: Math.round(padding.bottom),
    };
}

// 手柄位移语义：dx/dy 为世界坐标中手柄的位移（向右/向下为正）；
// left/top 边向外扩即手柄向左/上移动，故对应边取负号。
function dragDeltas(edge: OutpaintDragEdge, dx: number, dy: number): Partial<OutpaintPadding> {
    switch (edge) {
        case "left":
            return { left: -dx };
        case "right":
            return { right: dx };
        case "top":
            return { top: -dy };
        case "bottom":
            return { bottom: dy };
        case "topLeft":
            return { left: -dx, top: -dy };
        case "topRight":
            return { right: dx, top: -dy };
        case "bottomLeft":
            return { left: -dx, bottom: dy };
        case "bottomRight":
            return { right: dx, bottom: dy };
    }
}

function dragAxis(edge: OutpaintDragEdge, dx: number, dy: number): FrameAxis {
    if (edge === "left" || edge === "right") return "horizontal";
    if (edge === "top" || edge === "bottom") return "vertical";
    return Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
}

export function resolveOutpaintPadding(input: {
    padding: OutpaintPadding;
    edge: OutpaintDragEdge;
    dx: number;
    dy: number;
    nodeWidth: number;
    nodeHeight: number;
    ratio: number | null;
}): OutpaintPadding {
    const padding = sanitizePadding(input.padding);
    const dx = finiteOrZero(input.dx);
    const dy = finiteOrZero(input.dy);
    const nodeWidth = positiveOrZero(input.nodeWidth);
    const nodeHeight = positiveOrZero(input.nodeHeight);
    const ratio = input.ratio !== null && Number.isFinite(input.ratio) && input.ratio > 0 ? input.ratio : null;

    const deltas = dragDeltas(input.edge, dx, dy);
    const next: OutpaintPadding = { ...padding };
    for (const key of Object.keys(deltas) as Array<keyof OutpaintPadding>) {
        const delta = deltas[key];
        if (delta !== undefined) next[key] = Math.max(0, next[key] + delta);
    }

    // ratio 反解需要正的节点尺寸；任一前置无效时退化为自由拖拽，仍保证 clamp 非负。
    if (!ratio || !nodeWidth || !nodeHeight) {
        return roundPadding(next);
    }

    // ratio 锁定：被拖拽边应用意图（clamp >= 0），再反解主导轴上的对边保持
    // (nodeW+L+R)/(nodeH+T+B) = ratio；对边反解出负值时 clamp 到 0，比例让步（非负 padding 优先）。
    if (dragAxis(input.edge, dx, dy) === "horizontal") {
        const anchored = input.edge === "left" || input.edge === "topLeft" || input.edge === "bottomLeft" ? "left" : "right";
        const opposite = anchored === "left" ? "right" : "left";
        const frameHeight = nodeHeight + next.top + next.bottom;
        next[opposite] = Math.max(0, ratio * frameHeight - nodeWidth - next[anchored]);
    } else {
        const anchored = input.edge === "top" || input.edge === "topLeft" || input.edge === "topRight" ? "top" : "bottom";
        const opposite = anchored === "top" ? "bottom" : "top";
        const frameWidth = nodeWidth + next.left + next.right;
        next[opposite] = Math.max(0, frameWidth / ratio - nodeHeight - next[anchored]);
    }
    return roundPadding(next);
}

export function resolveOutpaintTargetPx(input: {
    contentWidth: number;
    contentHeight: number;
    nodeWidth: number;
    nodeHeight: number;
    padding: OutpaintPadding;
    maxLongEdge?: number;
}): { width: number; height: number; paddingPx: OutpaintPadding } {
    const contentWidth = positiveOrZero(input.contentWidth);
    const contentHeight = positiveOrZero(input.contentHeight);
    const nodeWidth = positiveOrZero(input.nodeWidth);
    const nodeHeight = positiveOrZero(input.nodeHeight);
    if (!contentWidth || !contentHeight || !nodeWidth || !nodeHeight) {
        return { width: 0, height: 0, paddingPx: { ...ZERO_PADDING } };
    }

    const padding = sanitizePadding(input.padding);
    const scale = contentWidth / nodeWidth;
    const width = (nodeWidth + padding.left + padding.right) * scale;
    const height = (nodeHeight + padding.top + padding.bottom) * scale;

    let factor = 1;
    const maxLongEdge = input.maxLongEdge ?? OUTPAINT_MAX_LONG_EDGE;
    if (Number.isFinite(maxLongEdge) && maxLongEdge > 0) {
        const longEdge = Math.max(width, height);
        if (longEdge > maxLongEdge) factor = maxLongEdge / longEdge;
    }

    return {
        width: Math.max(0, Math.round(width * factor)),
        height: Math.max(0, Math.round(height * factor)),
        paddingPx: {
            left: Math.max(0, Math.round(padding.left * scale * factor)),
            top: Math.max(0, Math.round(padding.top * scale * factor)),
            right: Math.max(0, Math.round(padding.right * scale * factor)),
            bottom: Math.max(0, Math.round(padding.bottom * scale * factor)),
        },
    };
}

export function describeOutpaintSize(padding: OutpaintPadding, nodeWidth: number, nodeHeight: number, scale = 1): string {
    const safeNodeWidth = positiveOrZero(nodeWidth);
    const safeNodeHeight = positiveOrZero(nodeHeight);
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    if (!safeNodeWidth || !safeNodeHeight) return "0 × 0";

    const safe = sanitizePadding(padding);
    const width = Math.max(0, Math.round((safeNodeWidth + safe.left + safe.right) * safeScale));
    const height = Math.max(0, Math.round((safeNodeHeight + safe.top + safe.bottom) * safeScale));
    return `${width} × ${height}`;
}
