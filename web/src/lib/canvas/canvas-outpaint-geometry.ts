import type { ImagePadRect } from "./canvas-image-data";

// 世界坐标下的外扩框四边 padding；像素域复用同一形状（见 padImageToDataUrl）。
export type OutpaintPadding = ImagePadRect;

export type OutpaintDragEdge = "left" | "top" | "right" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export const OUTPAINT_MAX_LONG_EDGE = 4096;

export type FrameAxis = "horizontal" | "vertical";

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

export function resolveDragAxis(edge: OutpaintDragEdge, dx: number, dy: number): FrameAxis {
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
    // 主轴冻结（用户反馈 2026-09-19 第十六轮）：角手柄斜拖时 |dx|≥|dy| 逐帧翻转会让两条
    // 求解分支来回切换 = 框跳变。拖拽会话在首次显著位移时锁定主轴，此后恒用该轴求解。
    axis?: FrameAxis;
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

    // ratio 锁定 = 等比缩放扩图区域（用户裁定 2026-09-19）：被拖轴上对边锚定（padding 不变）、
    // 被拖边跟手；另一轴外扩总量按 ratio 联动，增量按「图片方位保持」半和分配（dL/dB 不变，
    // 与 resolveOutpaintPaddingForRatio 同款）——图片既不居中漂移也不贴边跳动；
    // 框不可小于原图（触底时以原图尺寸回推主导轴，比例让步优先非负 padding）。
    if ((input.axis ?? resolveDragAxis(input.edge, dx, dy)) === "horizontal") {
        const draggedLeft = input.edge === "left" || input.edge === "topLeft" || input.edge === "bottomLeft";
        const dragged = draggedLeft ? "left" : "right";
        const opposite = draggedLeft ? "right" : "left";
        let frameWidth = nodeWidth + next[opposite] + Math.max(0, next[dragged]);
        let frameHeight = frameWidth / ratio;
        if (frameHeight < nodeHeight) {
            frameHeight = nodeHeight;
            frameWidth = ratio * nodeHeight;
        }
        const growWidth = Math.round(frameWidth) - nodeWidth;
        const shTotal = Math.max(0, Math.round(frameHeight) - nodeHeight);
        const dV = padding.top - padding.bottom;
        const top = Math.min(shTotal, Math.max(0, Math.round((shTotal + dV) / 2)));
        const bottom = shTotal - top;
        const oppositePad = next[opposite];
        return roundPadding({
            ...next,
            [dragged]: Math.max(0, growWidth - oppositePad),
            [opposite]: oppositePad,
            top,
            bottom,
        });
    }
    const draggedTop = input.edge === "top" || input.edge === "topLeft" || input.edge === "topRight";
    const dragged = draggedTop ? "top" : "bottom";
    const opposite = draggedTop ? "bottom" : "top";
    let frameHeight = nodeHeight + next[opposite] + Math.max(0, next[dragged]);
    let frameWidth = frameHeight * ratio;
    if (frameWidth < nodeWidth) {
        frameWidth = nodeWidth;
        frameHeight = nodeWidth / ratio;
    }
    const swTotal = Math.max(0, Math.round(frameWidth) - nodeWidth);
    const dH = padding.left - padding.right;
    const left = Math.min(swTotal, Math.max(0, Math.round((swTotal + dH) / 2)));
    const right = swTotal - left;
    const oppositePad = next[opposite];
    return roundPadding({
        ...next,
        [dragged]: Math.max(0, Math.round(frameHeight) - nodeHeight - oppositePad),
        [opposite]: oppositePad,
        left,
        right,
    });
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

// 档位提交换算（用户语义 2026-09-19 第十三轮修订）：比例+档位锁定时提交目标 = preset 精确像素，
// 与拖拽量级解耦（扩图扩的是空间信息，2K 图也可用 1K 档生成——原图在合成时按占比缩放）。
// paddingPx 同比例缩放到 preset 域（k = preset/target），供 padImageToDataUrl target 模式使用。
export function snapOutpaintTargetSize(input: {
    targetWidth: number;
    targetHeight: number;
    paddingPx: OutpaintPadding;
    presets: Array<{ width: number; height: number }>;
    // 域感知 snap（用户反馈 2026-09-19 第十六轮）：AUTO 档无比例锁定，纯面积距离会选到与
    // 当前框比例无关的档（1K 模型 3:2 框 → 1024×1024，绕开更近的 1536×1024）。给定目标比时
    // 距离 = 面积项 + 比例项（比例占优），标注/提交都落模型域内、同比例的档。
    targetRatio?: number;
}): { width: number; height: number; paddingPx: OutpaintPadding } | null {
    const targetWidth = positiveOrZero(input.targetWidth);
    const targetHeight = positiveOrZero(input.targetHeight);
    if (!targetWidth || !targetHeight || !input.presets.length) return null;
    const ratio = input.targetRatio && Number.isFinite(input.targetRatio) && input.targetRatio > 0 ? input.targetRatio : null;
    let best: { width: number; height: number; delta: number } | null = null;
    for (const preset of input.presets) {
        const width = positiveOrZero(preset.width);
        const height = positiveOrZero(preset.height);
        if (!width || !height) continue;
        const delta = Math.abs(Math.log((width * height) / (targetWidth * targetHeight)))
            + (ratio ? Math.abs(Math.log((width / height) / ratio)) * 2 : 0);
        if (!best || delta < best.delta) best = { width, height, delta };
    }
    if (!best) return null;
    const scaleX = best.width / targetWidth;
    const scaleY = best.height / targetHeight;
    const source = sanitizePadding(input.paddingPx);
    return {
        width: best.width,
        height: best.height,
        paddingPx: roundPadding({
            left: source.left * scaleX,
            top: source.top * scaleY,
            right: source.right * scaleX,
            bottom: source.bottom * scaleY,
        }),
    };
}

// 比例选择（含参数条下拉即时切换）反解四边 padding：联立解保证框比精确等于目标比例。
// anchor = 既有外扩强度（basePadding 最大边和的一半），作为「少加的那条轴」的保底量；
// 另一轴按 (基准 + 2*anchor) 联立补差。补差为负时放弃 anchor，回落最小外扩纯解（比例优先）。
// 比例字符串解析："16:9" 直接除；已知别名（"21:9" 等）走映射表；无法解析返回 null（自由拖拽语义）。
const RATIO_VALUE_MAP: Record<string, number> = { "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "16:9": 16 / 9, "9:16": 9 / 16, "2:3": 2 / 3, "3:2": 3 / 2, "21:9": 21 / 9 };

export function parseRatioValue(value: string): number | null {
    const parts = value.split(":").map((item) => Number(item));
    if (parts.length === 2 && parts.every((item) => Number.isFinite(item) && item > 0)) return parts[0] / parts[1];
    return RATIO_VALUE_MAP[value] ?? null;
}

// 拖动图片 = 扩图框内重定位（用户裁定 2026-09-19）：框不跟拖，仅四边 padding 相互转移。
// 图片右移 dx>0 → left 增、right 减；右 pad 耗尽后差额转为框扩展（贴边续拖 = 框随图扩）。
// ratio 锁定时外扩总量守恒（只转移不扩展），避免拖图破坏锁定比例。
export function relocateOutpaintPadding(padding: OutpaintPadding, dx: number, dy: number, _ratioLocked: boolean): OutpaintPadding {
    const base = sanitizePadding(padding);
    const safeDx = Number.isFinite(dx) ? dx : 0;
    const safeDy = Number.isFinite(dy) ? dy : 0;
    // 统一总量守恒（用户反馈 2026-09-19 第十三轮）：拖图到框边 = 图片贴边停住，框永不被顶着移动。
    // 自由与 ratio 锁定同语义——扩图总量由手柄/档位决定，拖图只做框内位置调整。
    // （_ratioLocked 参数保留：历史调用点仍传；两分支语义已统一。）
    const horizontalTotal = base.left + base.right;
    const left = Math.min(horizontalTotal, Math.max(0, base.left + safeDx));
    const verticalTotal = base.top + base.bottom;
    const top = Math.min(verticalTotal, Math.max(0, base.top + safeDy));
    return roundPadding({ left, right: horizontalTotal - left, top, bottom: verticalTotal - top });
}

export function resolveOutpaintPaddingForRatio(input: { nodeWidth: number; nodeHeight: number; ratio: number; basePadding?: OutpaintPadding }): OutpaintPadding {
    const nodeWidth = positiveOrZero(input.nodeWidth);
    const nodeHeight = positiveOrZero(input.nodeHeight);
    const ratio = Number.isFinite(input.ratio) && input.ratio > 0 ? input.ratio : 0;
    const base = sanitizePadding(input.basePadding ?? { left: 0, top: 0, right: 0, bottom: 0 });
    if (!nodeWidth || !nodeHeight || !ratio) return base;
    // 目标：框比 = ratio，且新框与当前框「最接近」（对数面积距离）——切比例是重排不是放大。
    // 两个合法解：锚定横轴总外扩反解纵轴 / 锚定纵轴反解横轴（锚定轴只增不减，被解轴按比例
    // 精确反解且允许收缩，负值时回落最小合法框）。旧实现恒锚横轴，3:2 大框翻 2:3 时巨量
    // 横向外扩被强行保留、纵轴按比例爆炸（框溢出屏幕，用户实测）。
    const solveFromHorizontal = (swIn: number): { sw: number; sh: number } => {
        let sw = Math.max(0, swIn);
        let sh = (nodeWidth + sw) / ratio - nodeHeight;
        if (sh < 0) {
            sh = 0;
            sw = Math.max(0, ratio * nodeHeight - nodeWidth);
        }
        return { sw, sh };
    };
    const solveFromVertical = (shIn: number): { sw: number; sh: number } => {
        let sh = Math.max(0, shIn);
        let sw = ratio * (nodeHeight + sh) - nodeWidth;
        if (sw < 0) {
            sw = 0;
            sh = Math.max(0, nodeWidth / ratio - nodeHeight);
        }
        return { sw, sh };
    };
    const candidateH = solveFromHorizontal(base.left + base.right);
    const candidateV = solveFromVertical(base.top + base.bottom);
    const currentArea = (nodeWidth + base.left + base.right) * (nodeHeight + base.top + base.bottom);
    const distance = (c: { sw: number; sh: number }) => Math.abs(Math.log(((nodeWidth + c.sw) * (nodeHeight + c.sh)) / currentArea));
    const distH = distance(candidateH);
    const distV = distance(candidateV);
    // 并列（同比例重选等）取外扩更大者：锚定轴「只增不减」语义在等价解下保留。
    const chosen = Math.abs(distH - distV) < 0.01
        ? (candidateH.sw + candidateH.sh >= candidateV.sw + candidateV.sh ? candidateH : candidateV)
        : (distH < distV ? candidateH : candidateV);
    // 分配（图片方位保持：dL/dB 中心偏移半和分配，clamp 到 [0, 总量]，差额自然并入对边）。
    const swRounded = Math.round(chosen.sw);
    const left = Math.min(swRounded, Math.max(0, Math.round((swRounded + (base.left - base.right)) / 2)));
    const shRounded = Math.round(chosen.sh);
    const top = Math.min(shRounded, Math.max(0, Math.round((shRounded + (base.top - base.bottom)) / 2)));
    return { left, right: swRounded - left, top, bottom: shRounded - top };
}