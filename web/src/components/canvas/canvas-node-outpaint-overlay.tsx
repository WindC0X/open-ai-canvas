import { Button, Dropdown, Input, Select } from "antd";
import { ArrowUp, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import { ModelPicker } from "@/components/model-picker";
import { CreditSymbol } from "@/constant/credits";
import { defaultImageParamsForModel } from "@/lib/model-selection";
import { modelCapabilityConfigFor } from "@/lib/model-capabilities";
import { modelQuoteRequest, requestCreditCost } from "@/lib/model-pricing";
import {
    buildImageResolutionOptions,
    imageSizeForResolution,
    imageResolutionChoices,
    type ImageResolutionChoice,
    type ImageResolutionTier,
} from "@/lib/image-resolution-tiers";
import { describeOutpaintSize, parseRatioValue, relocateOutpaintPadding, resolveDragAxis, resolveOutpaintClipHole, resolveOutpaintPadding, resolveOutpaintPaddingForRatio, resolveOutpaintTargetPx, snapOutpaintTargetSize, type FrameAxis, type OutpaintDragEdge, type OutpaintPadding } from "@/lib/canvas/canvas-outpaint-geometry";
import { CANVAS_NODE_DRAG_PREVIEW_EVENT, subscribeCanvasViewportPreview, type CanvasNodeDragPreview } from "@/lib/canvas/canvas-live-viewport";
import { modelOptionName, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { quoteLogicalModel } from "@/services/api/logical-models";
import type { CanvasNodeData } from "@/types/canvas";

export type CanvasImageOutpaintPayload = {
    paddingPx: OutpaintPadding;
    prompt: string;
    // 锁定档位时非空：提交 size/pad 合成尺寸 = 该精确像素，原图按占比缩放（用户语义第十三轮）。
    submitTarget?: { width: number; height: number };
    generationConfig: { model: string; imageModel?: string; size?: string; quality?: string; count: string };
};

type CanvasNodeOutpaintOverlayProps = {
    node: CanvasNodeData | null;
    // 渲染点必须位于画布容器（position 定位上下文）内部，rect 量测相对该容器换算。
    containerRef: RefObject<HTMLDivElement | null>;
    config: AiConfig;
    onClose: () => void;
    onExecute: (node: CanvasNodeData, payload: CanvasImageOutpaintPayload) => void;
    // 拖图松手提交：节点位移写入节点 position（扩图模式内图片在框内重定位的本质 = 移动节点 +
    // padding 重分布，frame 数学位置不变）。与 setPadding 同批 React 提交，无闪帧。
    onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
    // 拖图会话活跃态上传（首帧有效位移置真 / 松手·取消·卸载置假）：project 层据此把 SVG 强调连线层
    // （光晕/流光，canvas-project-world-layers 的 hideVisual）在拖动中隐藏——该层 pathD 只随 React
    // commit 更新，不隐藏会滞留旧锚点直到拖动结束（对齐正常节点拖拽 isNodeDragging 的防残影机制）。
    onImageDragActiveChange?: (active: boolean) => void;
};

const FREE_RATIO_KEY = "free";
// 原图比例（用户裁定 2026-09-19 第十四轮）：默认选项，框比 = 原图真实宽高比。
const ORIGINAL_RATIO_KEY = "original";

// 通用比例组（size.parameter 非 aspect_ratio 的模型走这组，只约束框几何，不进提交参数）。
const GENERIC_RATIO_OPTIONS = ["1:1", "4:3", "3:4", "16:9", "9:16"];

const CORNER_HANDLES: Array<{ edge: OutpaintDragEdge; className: string }> = [
    { edge: "topLeft", className: "-left-1.5 -top-1.5 cursor-nwse-resize" },
    { edge: "topRight", className: "-right-1.5 -top-1.5 cursor-nesw-resize" },
    { edge: "bottomLeft", className: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
    { edge: "bottomRight", className: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
];

const EDGE_HANDLES: Array<{ edge: OutpaintDragEdge; className: string }> = [
    { edge: "top", className: "-top-1.5 left-1/2 h-3 w-10 -translate-x-1/2 cursor-ns-resize" },
    { edge: "bottom", className: "-bottom-1.5 left-1/2 h-3 w-10 -translate-x-1/2 cursor-ns-resize" },
    { edge: "left", className: "-left-1.5 top-1/2 h-10 w-3 -translate-y-1/2 cursor-ew-resize" },
    { edge: "right", className: "-right-1.5 top-1/2 h-10 w-3 -translate-y-1/2 cursor-ew-resize" },
];

const PLUS_PATTERN_ID = "canvas-outpaint-plus-pattern";

const DEFAULT_PADDING: OutpaintPadding = { left: 48, top: 48, right: 48, bottom: 48 };

// 报价可到 micro 级（用户配置 0.001）：固定两位会把 0.001 截断成 0.00（2026-09-20 实测）。
// 最多 6 位去尾零，整数不带小数点。
function formatOutpaintCredits(value: number) {
    return String(Number(value.toFixed(6)));
}
const ZERO_PADDING: OutpaintPadding = { left: 0, top: 0, right: 0, bottom: 0 };
const FRAME_EXPAND_TRANSITION = "left 360ms cubic-bezier(0.22, 1, 0.36, 1), top 360ms cubic-bezier(0.22, 1, 0.36, 1), width 360ms cubic-bezier(0.22, 1, 0.36, 1), height 360ms cubic-bezier(0.22, 1, 0.36, 1)";

// 手柄位移语义：dx/dy 为拖拽累计屏幕 delta（÷scale 后进几何纯函数），
// 每次以 pointerdown 时的 startPadding 为基准重算，避免增量叠加误差。
type DragState = { edge: OutpaintDragEdge; startX: number; startY: number; startPadding: OutpaintPadding; axis: FrameAxis | null } | null;

// "1536x1024" → "3:2"（gcd 约分；除不尽时取 4 位精度最近似简比，如 1024x1360 → 1:1.33 显示为 3:4 类）。
function sizeValueToRatioLabel(value: string): string | null {
    const parts = value.toLowerCase().split("x").map((item) => Number(item));
    if (parts.length !== 2 || parts.some((item) => !Number.isFinite(item) || item <= 0)) return null;
    const [width, height] = parts;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const rw = width / divisor;
    const rh = height / divisor;
    // 约分后边长 ≤21 视为整数比（1:1/3:2/2:3 等），否则按常见档位容差归并
    if (rw <= 21 && rh <= 21) return `${rw}:${rh}`;
    const ratio = width / height;
    const known: Array<[string, number]> = [["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4], ["16:9", 16 / 9], ["9:16", 9 / 16], ["3:2", 3 / 2], ["2:3", 2 / 3]];
    let best = known[0];
    let bestDiff = Infinity;
    for (const item of known) {
        const diff = Math.abs(item[1] - ratio);
        if (diff < bestDiff) { bestDiff = diff; best = item; }
    }
    return bestDiff / ratio < 0.05 ? best[0] : `${ratio.toFixed(2)}:1`;
}

const RATIO_VALUE_MAP: Record<string, number> = { "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "16:9": 16 / 9, "9:16": 9 / 16, "2:3": 2 / 3, "3:2": 3 / 2, "21:9": 21 / 9 };

export function CanvasNodeOutpaintOverlay({ node, containerRef, config, onClose, onExecute, onNodeMove, onImageDragActiveChange }: CanvasNodeOutpaintOverlayProps) {
    const frameRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    // 扩展区纹理层：单一全铺 pattern + clip-path 挖出图片视觉矩形（洞跟随拖图 transform 逐帧直写）。
    // 取代旧「四条带挖洞」——拖图时洞跟图片走、原位露纹理（tapnow 同款），frame 内部零布局变化。
    const clipHoleRef = useRef<HTMLDivElement>(null);
    const maskRectRef = useRef<SVGRectElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const nodeElementRef = useRef<HTMLElement | null>(null);
    const scaleRef = useRef(1);
    const dragRef = useRef<DragState>(null);
    const paddingRef = useRef<OutpaintPadding>(ZERO_PADDING);
    // 节点布局尺寸以 DOM offsetWidth/Height 实测为准（含 freeResize），禁用 React node.width 推断 scale。
    const [layoutSize, setLayoutSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [padding, setPadding] = useState<OutpaintPadding>(ZERO_PADDING);
    const [dragging, setDragging] = useState(false);
    // 拖图会话句柄：非空 = 冻结 frame DOM（updateFrame 早退）+ transform/洞直写（声明必须先于 updateFrame）。
    const imageDragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        startPadding: OutpaintPadding;
        tx: number;
        ty: number;
        contentEl: HTMLElement;
        wrapperEl: HTMLElement;
        // 拖图开始时冻结的洞基准（图片盒相对 frame 的偏移与尺寸）：拖图中洞 = 冻结基准 + transform，
        // 不重读 rect——外部（viewport/transition/虚拟化）的 rect 漂移不参与洞计算，洞与图片严格同步。
        holeBase: { x: number; y: number; w: number; h: number };
        // 活跃态是否已上报（首帧有效位移置真，只在上报翻转时回调，避免每 move 帧 setState）。
        activeNotified?: boolean;
    } | null>(null);
    // 回调 ref 镜像：容器级原生监听的 effect 不因回调身份变化重建。
    const imageDragActiveChangeRef = useRef(onImageDragActiveChange);
    imageDragActiveChangeRef.current = onImageDragActiveChange;
    // 框位置/尺寸的 transition 只在比例切换展开动画时开启（用户裁定交互）；恒开会让
    // viewport 跟随 / 拖图松手后的末帧位置修正都被 360ms 动画放大 = 框游动与回弹。
    const [expanding, setExpanding] = useState(false);
    const expandingTimerRef = useRef<number | null>(null);
    // 卸载清理（review 2026-09-21 P3）：节点删除/✕ 关闭后 420ms 定时器不再触发。
    useEffect(() => () => {
        if (expandingTimerRef.current) window.clearTimeout(expandingTimerRef.current);
    }, []);
    const startExpandAnimation = useCallback(() => {
        setExpanding(true);
        if (expandingTimerRef.current) window.clearTimeout(expandingTimerRef.current);
        expandingTimerRef.current = window.setTimeout(() => setExpanding(false), 420);
    }, []);
    const [ratioKey, setRatioKey] = useState<string>(ORIGINAL_RATIO_KEY);
    const [model, setModel] = useState<string>(node?.metadata?.model || config.model);
    const [sizeValue, setSizeValue] = useState<string>("");
    const [qualityValue, setQualityValue] = useState<string>("");
    const [count, setCount] = useState(1);
    const [prompt, setPrompt] = useState("");
    const [visible, setVisible] = useState(false);

    paddingRef.current = padding;

    const contentWidth = Number(node?.metadata?.naturalWidth) || layoutSize.width;
    const contentHeight = Number(node?.metadata?.naturalHeight) || layoutSize.height;
    // 无模型态红线（用户反馈 2026-09-19：未选模型不得预填参数）：modelCapabilityConfigFor 对空 model
    // 会回落默认能力域，不能用 imageProfile 是否存在判定“已选模型”。
    const hasModel = Boolean(model);
    const imageProfile = useMemo(() => (hasModel ? modelCapabilityConfigFor(config, model).image : undefined), [config, hasModel, model]);
    const canExecute = hasModel && (imageProfile?.references?.maxImages ?? 0) >= 1;
    const countMax = Math.max(1, Math.min(4, imageProfile?.references?.maxImages ?? 1));
    const countOptions = Array.from({ length: countMax }, (_, index) => index + 1);
    const sizeParameter = imageProfile?.size?.parameter;
    const sizeOptions = imageProfile?.size?.values ?? [];
    const sizeFallback = imageProfile?.size?.default ?? "";
    const qualityOptions = imageProfile?.quality?.supported ? imageProfile.quality.values ?? [] : [];

    // size 制模型的结构化分辨率档（tier×ratio→WxH，来自渠道能力配置；values 里的比例字符串被解析过滤）。
    const sizePresetOptions = useMemo(
        () => (sizeParameter === "size" ? buildImageResolutionOptions(sizeOptions) : []),
        [sizeParameter, sizeOptions],
    );
    // 分辨率槽选项：auto + 已启用 tier（对齐渠道「编辑模型」的 1K/2K/4K 语义，不再是逐 WxH 列表）。
    const tierChoices = useMemo(
        () => (sizeParameter === "size" ? imageResolutionChoices(sizeOptions) : []),
        [sizeParameter, sizeOptions],
    );


    // 比例槽（用户裁定 2026-09-19 第十四轮）：「原图比例」恒为默认首项；模型枚举档位随后；
    // 「自由」仅在模型允许自定义尺寸时出现（allowCustom=false 的渠道模型不该有自由档）。
    const ratioOptions = useMemo(() => {
        if (!hasModel) return [];
        const allowCustom = Boolean(imageProfile?.size.allowCustom);
        const options = [ORIGINAL_RATIO_KEY];
        if (sizeParameter === "aspect_ratio") {
            options.push(...sizeOptions.filter((value) => parseRatioValue(value) !== null));
        } else if (sizeParameter === "size" && sizePresetOptions.length) {
            const ratios: string[] = [];
            for (const preset of sizePresetOptions) if (!ratios.includes(preset.ratio)) ratios.push(preset.ratio);
            options.push(...ratios);
        } else {
            options.push(...GENERIC_RATIO_OPTIONS);
        }
        if (allowCustom) options.push(FREE_RATIO_KEY);
        return options;
    }, [hasModel, imageProfile, sizeParameter, sizeOptions, sizePresetOptions]);
    const ratioOptionLabel = (key: string) => (key === FREE_RATIO_KEY ? "自由" : key === ORIGINAL_RATIO_KEY ? "原图比例" : key);
    // 分辨率槽：size 制模型显示 auto+tier 档（提交 size = tier×ratio 的渠道配置像素），quality 多档模型显示画质档。
    const resolutionMode: "size" | "quality" | null = !hasModel
        ? null
        : sizeParameter === "size"
          ? "size"
          : qualityOptions.length > 1
            ? "quality"
            : null;
    const resolutionOptions = resolutionMode === "size" ? tierChoices : resolutionMode === "quality" ? qualityOptions : [];

    // 模型切换时把比例/档位选择重置进新模型的能力域。
    useEffect(() => {
        setRatioKey(ORIGINAL_RATIO_KEY);
        setSizeValue("");
        setQualityValue("");
    }, [model]);

    // size 制的分辨率档（sizeValue 语义 = tier）；默认 auto = 模型自选。
    const selectedTier: ImageResolutionChoice =
        sizeValue && (tierChoices as string[]).includes(sizeValue) ? (sizeValue as ImageResolutionChoice) : "auto";
    const lockedRatioKey = ratioKey !== FREE_RATIO_KEY ? ratioKey : null;
    const contentRatio = contentWidth / Math.max(1, contentHeight);
    const lockedRatio = lockedRatioKey === ORIGINAL_RATIO_KEY ? contentRatio : parseRatioValue(lockedRatioKey ?? "");
    const submitSize =
        sizeParameter === "aspect_ratio"
            ? // 原图比例不是模型枚举值 → 提交模型默认；枚举档位直接提交。
              sizeOptions.includes(lockedRatioKey ?? "") ? (lockedRatioKey as string) : sizeFallback
            : sizeParameter === "size"
              ? // 比例锁定 + 分辨率档 → 渠道配置的精确像素；自由比例或 auto → 模型自选（auto）。
                selectedTier !== "auto" && lockedRatioKey
                  ? (imageSizeForResolution(sizePresetOptions, selectedTier as ImageResolutionTier, lockedRatioKey) ?? sizeFallback)
                  : "auto"
              : sizeFallback;
    // 域非空时总是提交域内值（越域回落模型默认档），短路 hook 层的全局 config.quality 回落链。
    const submitQuality = qualityOptions.length
        ? qualityOptions.includes(qualityValue)
            ? qualityValue
            : imageProfile?.quality?.default || qualityOptions[0]
        : undefined;

    // 档位 snap 候选（第十一轮）：比例+分辨率档锁定时目标像素 = 该比例下离拖拽量级最近的档位
    // 像素（4:3+1K 档配 2045×1534 的拖拽量级 → snap 到 2048×1536），标注与提交共用同一结果，
    // 消除「标注 scale 换算值 ≠ 提交档位值」的失配。空数组 = 未锁定，走 scale 换算。
    const presetCandidates = useMemo(
        () =>
            sizeParameter === "size" && selectedTier !== "auto" && lockedRatioKey
                ? sizePresetOptions
                      // 原图比例：模型枚举无该比例 → 该 tier 全部 preset 进 snap 候选（按面积就近取档，
                      // 提交像素必落模型域内）；枚举比例：精确匹配。
                      .filter((option) => option.tier === selectedTier && (lockedRatioKey === ORIGINAL_RATIO_KEY || option.ratio === lockedRatioKey))
                      .map((option) => ({ width: option.width, height: option.height }))
                : [],
        [lockedRatioKey, selectedTier, sizeParameter, sizePresetOptions],
    );
    const presetCandidatesRef = useRef(presetCandidates);
    presetCandidatesRef.current = presetCandidates;
    const sizePresetOptionsRef = useRef(sizePresetOptions);
    sizePresetOptionsRef.current = sizePresetOptions;
    // 提交/标注目标统一解析（用户反馈 2026-09-19 第十六轮）：锁定档位走既有精确比例 snap；
    // AUTO 档（或自由）走全域 ratio 感知 snap——比例距离占优、面积距离次之，恒落渠道配置域
    // （16 对齐像素）。此前 AUTO 落 scale 换算裸值（3283×2189 超模型 1K 域，admission 也会拒）。
    const resolveOutpaintSubmitTarget = useCallback(
        (target: { width: number; height: number; paddingPx: OutpaintPadding }): { width: number; height: number; paddingPx: OutpaintPadding } | null => {
            if (presetCandidatesRef.current.length) {
                return snapOutpaintTargetSize({ targetWidth: target.width, targetHeight: target.height, paddingPx: target.paddingPx, presets: presetCandidatesRef.current });
            }
            if (!sizePresetOptions.length || !target.width || !target.height) return null;
            return snapOutpaintTargetSize({
                targetWidth: target.width,
                targetHeight: target.height,
                paddingPx: target.paddingPx,
                presets: sizePresetOptions,
                targetRatio: target.width / target.height,
            });
        },
        [sizePresetOptions],
    );

    const ratio = ratioKey === FREE_RATIO_KEY ? null : lockedRatio;

    // 远端报价单次价；显示价 = 单次价 × 张数（configuredCredits 已按张数折算，不重复乘）。
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const priceChannel = useMemo(() => resolveModelChannel(config, model), [config, model]);
    const configuredCredits = useMemo(
        () =>
            requestCreditCost({
                channelMode: priceChannel.scope === "system" ? "remote" : "local",
                modelCosts: priceChannel.modelCosts,
                model: modelOptionName(model),
                count,
                seconds: 1,
                capability: "image",
                config,
            }),
        [config, count, model, priceChannel],
    );
    const quoteRequest = useMemo(() => (model ? modelQuoteRequest(config, model, "image") : null), [config, model]);
    const [quotedCredits, setQuotedCredits] = useState<number | null>(null);
    const quoted = quotedCredits !== null ? quotedCredits * count : null;
    const credits = quoted ?? configuredCredits ?? 0;

    useEffect(() => {
        if (!creditsEnabled || !quoteRequest) {
            setQuotedCredits(null);
            return;
        }
        const controller = new AbortController();
        setQuotedCredits(null);
        if (!quoteRequest.logicalModelID) {
            return;
        }
        quoteLogicalModel(quoteRequest.logicalModelID, quoteRequest.intent, controller.signal)
            .then(({ quote }) => setQuotedCredits(quote.amountMicrocredits / 1_000_000))
            .catch(() => {
                if (!controller.signal.aborted) setQuotedCredits(null);
            });
        return () => controller.abort();
    }, [creditsEnabled, quoteRequest]);

    const applyPadding = useCallback((next: OutpaintPadding) => {
        setPadding(next);
        paddingRef.current = next;
    }, []);


    // 虚拟化世界会在 viewport 提交时重建节点 DOM 元素；ref 失连后必须重新解析，
    // 否则 gBCR 返回 0 尺寸，updateFrame 早退、框停留在旧位置（漂移错位根因）。
    const ensureNodeElement = useCallback(() => {
        const container = containerRef.current;
        if (!container || !node) return null;
        const current = nodeElementRef.current;
        if (current?.isConnected) return current;
        // 基准优先图片内容盒（排除悬浮 header 造成的视觉偏移与条带遮字），非图节点回落整个节点。
        const wrapper = container.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`);
        const fresh = wrapper?.querySelector<HTMLElement>("[data-canvas-image-content]") || wrapper;
        nodeElementRef.current = fresh;
        return fresh;
    }, [containerRef, node]);

    // 扩展区纹理洞直写（frame 相对坐标）：evenodd 双环 polygon，内环 = 图片视觉矩形。
    // 拖图 pointermove 与松手 commit 都走这里；比例切换/手柄路径由 updateFrame 调用（位移 0）。
    const writeClipHole = useCallback((x: number, y: number, w: number, h: number) => {
        // 洞用 SVG mask 矩形实现，不用 clip-path polygon(evenodd)：CSS polygon 是单条连续
        // 路径，外环末点到内环首点的跳边 + 隐式闭合边是横贯 gap 的长对角线，evenodd 逐点
        // 奇偶翻转把对角线扫过区误剪（第十七轮"沙漏缺口"根源，数学复现实证）。
        const mask = maskRectRef.current;
        if (!mask) return;
        mask.setAttribute("x", `${x.toFixed(2)}`);
        mask.setAttribute("y", `${y.toFixed(2)}`);
        mask.setAttribute("width", `${Math.max(0, w).toFixed(2)}`);
        mask.setAttribute("height", `${Math.max(0, h).toFixed(2)}`);
    }, []);

    const updateFrame = useCallback(() => {
        // 拖图会话中冻结 frame DOM：图片 translate 与 padding 补偿每帧数像素级舍入差会让框微震
        // （用户反馈第十三轮）；冻结后框完全静止，松手时 padding 终值 + 节点 commit 位置一次重算衔接。
        if (imageDragRef.current) return;
        const container = containerRef.current;
        const frame = frameRef.current;
        const nodeElement = ensureNodeElement();
        const layoutWidth = nodeElement?.offsetWidth || 0;
        const layoutHeight = nodeElement?.offsetHeight || 0;
        if (!container || !nodeElement || !frame || !layoutWidth || !layoutHeight) return;

        const nodeRect = nodeElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (!nodeRect.width || !nodeRect.height) return;
        // scale 全程 DOM 实测（rect 是 transform 后尺寸，offset 是布局尺寸），不读 React viewport/节点宽。
        const scale = nodeRect.width / layoutWidth;
        scaleRef.current = scale;
        setLayoutSize((current) => (current.width === layoutWidth && current.height === layoutHeight ? current : { width: layoutWidth, height: layoutHeight }));

        const current = paddingRef.current;
        const left = nodeRect.left - containerRect.left - current.left * scale;
        const top = nodeRect.top - containerRect.top - current.top * scale;
        const width = nodeRect.width + (current.left + current.right) * scale;
        const height = nodeRect.height + (current.top + current.bottom) * scale;
        frame.style.left = `${left}px`;
        frame.style.top = `${top}px`;
        frame.style.width = `${width}px`;
        frame.style.height = `${height}px`;

        // 扩展区纹理洞（clip-path evenodd 双环）：洞 = 图片视觉矩形（未拖图时 = 节点 rect 相对 frame）。
        // T2：洞走 frame-local（减去 containerRect），兼容 64px 工作区侧栏等容器原点偏移。
        // 拖图时洞由 pointermove 逐帧直写跟随 transform，updateFrame 冻结中不触碰。
        const hole = resolveOutpaintClipHole({ nodeRect, containerRect, frameOffset: { left, top } });
        writeClipHole(hole.x, hole.y, hole.width, hole.height);
        if (labelRef.current) {
            // 标注 = 实际提交目标（第十一轮）：档位锁定时显示 snap 后的档位精确像素（与提交同源），
            // 自由/未锁档时显示 scale 换算预览。同源后顶部标注不再是 2045×1534 这类换算余数。
            let labelText: string | null = null;
            if (sizePresetOptionsRef.current.length) {
                const target = resolveOutpaintTargetPx({ contentWidth, contentHeight, nodeWidth: layoutWidth, nodeHeight: layoutHeight, padding: current });
                const snapped = target.width && target.height ? resolveOutpaintSubmitTarget(target) : null;
                if (snapped) labelText = `${snapped.width} × ${snapped.height}`;
            }
            labelRef.current.textContent = labelText ?? describeOutpaintSize(current, layoutWidth, layoutHeight, contentWidth / Math.max(1, layoutWidth));
        }
        if (barRef.current) {
            const bar = barRef.current;
            const barWidth = bar.offsetWidth || 500;
            const barHeight = bar.offsetHeight || 44;
            const centerX = left + width / 2;
            const barLeft = Math.min(Math.max(centerX - barWidth / 2, 12), Math.max(12, containerRect.width - barWidth - 12));
            const below = top + height + 16;
            const barTop = below + barHeight + 12 <= containerRect.height ? below : Math.max(12, top - barHeight - 16);
            bar.style.left = `${barLeft}px`;
            bar.style.top = `${barTop}px`;
        }
    }, [containerRef, contentWidth, ensureNodeElement, resolveOutpaintSubmitTarget, writeClipHole]);

    // DOM 实测驱动（禁读 viewport prop）：节点 layout（RO）+ worldLayer style（MO，捕捉拖拽预览与
    // viewport transform）+ live-viewport 订阅；一次量测消费框与参数条两处定位。
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || !node) return;
        const nodeElement = container.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`);
        nodeElementRef.current = nodeElement;
        if (!nodeElement) return;

        updateFrame();
        const resizeObserver = new ResizeObserver(updateFrame);
        resizeObserver.observe(nodeElement);
        resizeObserver.observe(container);
        // 参数条内容尺寸变化（选模型/档位改变行宽）→ 重定位，消除「盒中心对、内容变宽后偏移」。
        let barResize: ResizeObserver | null = null;
        if (barRef.current) {
            barResize = new ResizeObserver(updateFrame);
            barResize.observe(barRef.current);
        }
        // viewport 转场是 rAF 逐帧插值（CSS transition 的插值帧不触发 MO），
        // 必须订阅 live-viewport preview 事件逐帧重算，否则聚焦动画期间框停在旧位置。
        const unsubscribeViewport = subscribeCanvasViewportPreview(container, updateFrame);
        const worldLayer = container.querySelector<HTMLElement>("[data-canvas-world-layer], .canvas-world-layer");
        let worldMutations: MutationObserver | null = null;
        if (worldLayer) {
            worldMutations = new MutationObserver(updateFrame);
            worldMutations.observe(worldLayer, { attributes: true, attributeFilter: ["style"], subtree: true });
        }
        return () => {
            resizeObserver.disconnect();
            barResize?.disconnect();
            unsubscribeViewport();
            worldMutations?.disconnect();
            nodeElementRef.current = null;
        };
    }, [containerRef, node, updateFrame]);

    // 聚焦展开动画一拍：inline transition（后台节流下 CSS animation 不播放，cc383e14）。
    // padding 从 0 展开到默认值，配合 viewport 聚焦形成"框从原图生长"的动效。
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setVisible(true);
            setPadding(DEFAULT_PADDING);
            paddingRef.current = DEFAULT_PADDING;
        }, 60);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        updateFrame();
    }, [padding, updateFrame]);



    const onHandlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>, edge: OutpaintDragEdge) => {
            event.stopPropagation();
            event.preventDefault();
            dragRef.current = { edge, startX: event.clientX, startY: event.clientY, startPadding: paddingRef.current, axis: null };
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        [],
    );

    const onHandlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            if (!drag) return;
            event.stopPropagation();
            const scale = scaleRef.current || 1;
            if (drag.axis === null) {
                // 主轴在首次显著位移时锁定（角手柄斜拖时 |dx|≥|dy| 逐帧翻转 = 框跳变，用户实测）。
                if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) return;
                drag.axis = resolveDragAxis(drag.edge, event.clientX - drag.startX, event.clientY - drag.startY);
            }
            const dx = (event.clientX - drag.startX) / scale;
            const dy = (event.clientY - drag.startY) / scale;
            applyPadding(
                resolveOutpaintPadding({
                    padding: drag.startPadding,
                    edge: drag.edge,
                    dx,
                    dy,
                    nodeWidth: nodeElementRef.current?.offsetWidth || layoutSize.width,
                    nodeHeight: nodeElementRef.current?.offsetHeight || layoutSize.height,
                    ratio,
                    axis: drag.axis,
                }),
            );
        },
        [applyPadding, layoutSize.height, layoutSize.width, ratio],
    );

    const onHandlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        dragRef.current = null;
        imageDragRef.current = null;
        setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }, []);

    // 拖动图片 = 框内重定位（用户反馈 2026-09-19 第十四轮重构）：不再借道节点拖拽管线做
    // 「位移 + padding 反向补偿」的抵消式架构——那条路径在贴边后补偿封顶，节点继续跟手就变成
    // 「框被顶着移动」，且图片能被拖出框（真机实锤）。现改为自实现拖拽：
    //   · 内容盒 capture pointerdown 阻断节点拖拽/画布手势管线，setPointerCapture 接管；
    //   · pointermove：位移 clamp 在 padding 余量内（图片永不越出 frame、贴边即停），
    //     图片 transform 直改跟手 + 纹理洞 clip-path 同帧跟随 + paddingRef 累积（relocate 守恒）；
    //   · 松手同批提交：节点 position += 位移（世界域）+ padding 重分布 state 提交 → 二者抵消后
    //     frame = node' + pad' 仍等于拖动前的冻结位置（零跳变），transform 清零、洞回到节点 rect。
    // ratioRef 仅用于 relocate 语义兼容（现守恒统一，两模式同数学）。
    const ratioRef = useRef(ratio);
    ratioRef.current = ratio;
    const updateImageDragVisual = useCallback((drag: NonNullable<typeof imageDragRef.current>, tx: number, ty: number) => {
        // transform 整个节点卡（卡壳+图片+标题栏一起走）。写入通道 = 绝对定位的 left/top：
        // · style.transform 是 React 的节点定位（世界坐标），覆盖它 = 节点飞到世界原点（3913px 跳变实锤）；
        // · style.translate 在 contain:layout style 的节点上写入后渲染不生效（实测 rect 不动）；
        // · left/top 空闲且与 transform 定位叠加生效（absolute 元素布局位置偏移）。
        // 域换算：tx/ty 是屏幕域位移，wrapper 处在世界层内、left/top 走世界布局坐标——
        // 不换算时位移被画布缩放 k 衰减（写 18px 实动 18*k），拖图越远洞与图片错位越大
        // （用户截图 35% 重叠的真根源，headless fit-canvas k≈1 永远测不出）。
        const scale = scaleRef.current || 1;
        const wx = tx / scale;
        const wy = ty / scale;
        drag.wrapperEl.style.left = tx || ty ? `${wx}px` : "";
        drag.wrapperEl.style.top = tx || ty ? `${wy}px` : "";
        // 洞 = 冻结基准（pointerdown 时的图片盒相对 frame 偏移）+ 本次 transform。
        // 不重读 rect：viewport transition / 虚拟化的 rect 幻影（实测拖图开始瞬间 rect 跳 3913px）
        // 不参与洞计算，洞与图片 transform 严格同源同步。
        writeClipHole(drag.holeBase.x + tx, drag.holeBase.y + ty, drag.holeBase.w, drag.holeBase.h);
    }, [writeClipHole]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || !node) return;
        // 容器级捕获委托（目标时刻解析节点卡）：虚拟化世界重建节点 DOM 后监听不失连。
        // 拦截范围 = 节点卡整体（图片盒 + 卡壳 + 标题栏）——用户拖「图片」时可能落在卡片任意区域，
        // 只拦图片盒会漏掉 header 拖拽（走原生节点管线把节点拖走、框留在原地 = 全面错位）。
        // 按钮类交互（铅笔编辑等）放行，不参与拖拽。
        const resolveDragEl = () => {
            const wrapper = container.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`);
            const content = wrapper?.querySelector<HTMLElement>("[data-canvas-image-content]");
            return { wrapper, content };
        };
        // 命中判定（pointerdown 与 mousedown 共用）：节点卡内非按钮区域。
        const hitDragTarget = (event: MouseEvent | PointerEvent) => {
            if (event.button !== 0) return null;
            const { wrapper, content } = resolveDragEl();
            const target = event.target as HTMLElement | null;
            if (!wrapper || !target || !wrapper.contains(target)) return null;
            if (target.closest("button, input, textarea, [data-no-outpaint-drag]")) return null;
            return { wrapper, content: content || wrapper };
        };
        // 关键：pointerdown 的 stopPropagation 阻不断后续独立派发的 mousedown——节点拖拽管线
        // 监听 mousedown（React 合成），必须单独阻断，否则管线照常启动并每帧写 translate（世界域
        // 位移），与我们的补偿叠加 + 双重 commit（真机/headless 双实锤的框图错位总根源）。
        const onMouseDownBlock = (event: MouseEvent) => {
            if (hitDragTarget(event)) {
                event.stopPropagation();
                event.preventDefault();
            }
        };
        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0 || imageDragRef.current) return;
            // 扩图手柄拖拽会话中，落在节点卡上的事件不是拖图意图（手柄在 frame 上、可能悬于节点卡上方）。
            if (dragRef.current) return;
            const hit = hitDragTarget(event);
            if (!hit) return;
            const { wrapper } = hit;
            const contentEl = hit.content;
            // 阻断节点拖拽管线（React 合成事件挂根容器，目标捕获阶段 stopPropagation 即到不了根）
            // 与画布 selection/pan 手势。
            event.stopPropagation();
            event.preventDefault();
            // 冻结洞基准：图片盒相对 frame 的偏移（与 updateFrame 同基准 = 图片内容盒）。
            const frameNow = frameRef.current;
            const cr = contentEl.getBoundingClientRect();
            const fr = frameNow?.getBoundingClientRect();
            const holeBase = fr
                ? { x: cr.left - fr.left, y: cr.top - fr.top, w: cr.width, h: cr.height }
                : { x: 0, y: 0, w: cr.width, h: cr.height };
            imageDragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startPadding: paddingRef.current,
                tx: 0,
                ty: 0,
                contentEl,
                wrapperEl: wrapper,
                holeBase,
            };
            setDragging(true);
            try {
                contentEl.setPointerCapture(event.pointerId);
            } catch {
                // 捕获失败（元素已在拖拽中）回落：仍由 container 级 pointermove 兜底
            }
        };
        const onPointerMove = (event: PointerEvent) => {
            const drag = imageDragRef.current;
            if (!drag || event.pointerId !== drag.pointerId || dragRef.current) return;
            event.stopPropagation();
            const scale = scaleRef.current || 1;
            const start = drag.startPadding;
            // clamp = 图片视觉 rect 不越出 frame：右移上限 = 右 padding 余量，左移上限 = 左 padding 余量。
            const tx = Math.min(start.right * scale, Math.max(-start.left * scale, event.clientX - drag.startX));
            const ty = Math.min(start.bottom * scale, Math.max(-start.top * scale, event.clientY - drag.startY));
            drag.tx = tx;
            drag.ty = ty;
            // 首帧有效位移上报拖图活跃态（SVG 强调连线层拖动中隐藏，防旧锚点残影）。
            if (!drag.activeNotified && (tx !== 0 || ty !== 0)) {
                drag.activeNotified = true;
                imageDragActiveChangeRef.current?.(true);
            }
            paddingRef.current = relocateOutpaintPadding(start, tx / scale, ty / scale, ratioRef.current !== null);
            updateImageDragVisual(drag, tx, ty);
            // 连线跟随：拖图绕过了节点拖拽管线，连线层（leafer graphics）靠订阅预览事件把端点临时平移。
            // 直接派发同款事件（世界域位移，同 O1 教训）但不走 applyCanvasNodeDragPreview——
            // 它会写 wrapper 的 style.translate：与这里的 left/top 通道叠加双重位移，且 contain:layout 节点上 translate 渲染不生效。
            const container = containerRef.current;
            if (container) {
                container.dispatchEvent(new CustomEvent<CanvasNodeDragPreview | null>(CANVAS_NODE_DRAG_PREVIEW_EVENT, {
                    detail: { x: tx / scale, y: ty / scale, nodeIds: new Set([node.id]) },
                }));
            }
        };
        const onPointerUp = (event: PointerEvent) => {
            const drag = imageDragRef.current;
            if (!drag || event.pointerId !== drag.pointerId || dragRef.current) return;
            event.stopPropagation();
            const scale = scaleRef.current || 1;
            const dxWorld = drag.tx / scale;
            const dyWorld = drag.ty / scale;
            if (drag.activeNotified) imageDragActiveChangeRef.current?.(false);
            imageDragRef.current = null;
            drag.wrapperEl.style.left = "";
            drag.wrapperEl.style.top = "";
            // 恢复洞的展开过渡（拖图期间被直写为 none；React style diff 判同值时不会重写）
            try {
                if (drag.contentEl.hasPointerCapture(event.pointerId)) drag.contentEl.releasePointerCapture(event.pointerId);
            } catch {
                // 已释放
            }
            setDragging(false);
            // 同批提交（React 事件批处理 → 一次 paint）：节点位移 + padding 重分布互为抵消，
            // frame 数学位置不变；transform 已在同一帧清零，无闪跳。
            if (Math.abs(dxWorld) > 0.5 || Math.abs(dyWorld) > 0.5) {
                onNodeMove(node.id, { x: node.position.x + dxWorld, y: node.position.y + dyWorld });
            }
            applyPadding(paddingRef.current);
            // 清预览：discrete pointerup 的 setState 同步 flush，onNodeMove 返回时连线层已拿到新 position，
            // 此刻清预览端点直接用新位置计算，无回跳帧。
            const container = containerRef.current;
            if (container) {
                container.dispatchEvent(new CustomEvent<CanvasNodeDragPreview | null>(CANVAS_NODE_DRAG_PREVIEW_EVENT, { detail: null }));
            }
        };
        container.addEventListener("pointerdown", onPointerDown, true);
        container.addEventListener("mousedown", onMouseDownBlock, true);
        container.addEventListener("pointermove", onPointerMove, true);
        container.addEventListener("pointerup", onPointerUp, true);
        container.addEventListener("pointercancel", onPointerUp, true);
        return () => {
            container.removeEventListener("pointerdown", onPointerDown, true);
            container.removeEventListener("mousedown", onMouseDownBlock, true);
            container.removeEventListener("pointermove", onPointerMove, true);
            container.removeEventListener("pointerup", onPointerUp, true);
            container.removeEventListener("pointercancel", onPointerUp, true);
        };
    }, [applyPadding, containerRef, node, onNodeMove, updateImageDragVisual]);

    // 卸载清理：拖图会话中关闭扩图（✕/节点删除）时，图片 transform 残留会让节点保持歪斜。
    useEffect(() => {
        return () => {
            if (imageDragRef.current) {
                if (imageDragRef.current.activeNotified) imageDragActiveChangeRef.current?.(false);
                imageDragRef.current.wrapperEl.style.left = "";
                imageDragRef.current.wrapperEl.style.top = "";
                imageDragRef.current = null;
                // 预览事件残留会让连线永远偏移：卸载也派发清除。
                const container = containerRef.current;
                if (container) {
                    container.dispatchEvent(new CustomEvent<CanvasNodeDragPreview | null>(CANVAS_NODE_DRAG_PREVIEW_EVENT, { detail: null }));
                }
            }
        };
    }, [containerRef]);

    const handleExecute = useCallback(() => {
        if (!node || !canExecute) return;
        const layoutWidth = nodeElementRef.current?.offsetWidth || layoutSize.width;
        const layoutHeight = nodeElementRef.current?.offsetHeight || layoutSize.height;
        if (!layoutWidth || !layoutHeight) return;
        const target = resolveOutpaintTargetPx({ contentWidth, contentHeight, nodeWidth: layoutWidth, nodeHeight: layoutHeight, padding });
        if (!target.width || !target.height) return;
        // 锁定档位 snap 到该比例档位档；AUTO/自由 snap 到全域最近比例档（16 对齐像素）——
        // pad 合成与提交 size 用同一像素，标注/档位/实际画幅三方同源，提交恒落模型域。
        const snapped = resolveOutpaintSubmitTarget(target);
        const widthPx = snapped?.width ?? target.width;
        const heightPx = snapped?.height ?? target.height;
        onExecute(node, {
            paddingPx: snapped?.paddingPx ?? target.paddingPx,
            prompt: prompt.trim(),
            // 提交 size = snap 后 preset 精确像素，合成按占比缩放原图（padImageToDataUrl target 模式）。
            submitTarget: snapped ? { width: snapped.width, height: snapped.height } : undefined,
            generationConfig: {
                model,
                // aspect_ratio 制模型只认枚举比值串，WxH 像素串必被 admission 拒（review 2026-09-21 P2：
                // submitSize 之前算而不用）；size 制模型维持精确像素 WxH。
                size: sizeParameter === "aspect_ratio" ? submitSize : `${widthPx}x${heightPx}`,
                quality: submitQuality,
                count: String(count),
            },
        });
    }, [canExecute, contentHeight, contentWidth, count, layoutSize.height, layoutSize.width, model, node, onExecute, padding, resolveOutpaintSubmitTarget, prompt, submitQuality, sizeParameter, submitSize]);

    if (!node) return null;

    const frameStyle: CSSProperties = {
        opacity: visible ? 1 : 0,
        // 位置/尺寸 transition 仅 expanding（比例切换展开动画）时开启；拖图与 viewport 跟随路径直改 DOM 即时生效。
        transition: dragging || !expanding ? "opacity 150ms ease" : `${FRAME_EXPAND_TRANSITION}, opacity 150ms ease`,
    };

    // 框位置/尺寸的 transition 只在比例切换展开动画时开启（用户裁定交互）；恒开会让
    // viewport 跟随 / 拖图松手后的末帧位置修正都被 360ms 动画放大 = 框游动与回弹。
    const ratioMenuLabel = ratioOptionLabel(ratioKey);

    return (
        <div className="pointer-events-none absolute inset-0 z-[var(--z-node-toolbar)] overflow-hidden">
            <div
                ref={frameRef}
                style={frameStyle}
                className="absolute rounded-lg border-[1.5px] border-primary/70"
                data-testid="canvas-outpaint-frame"
            >
                <svg width="0" height="0" className="absolute" aria-hidden>
                    <defs>
                        {/* 砖石交错排布：双列错半步 + 菱形中心微弱点（用户参考图 1789732625543）。
                            单一 pattern 全铺整框，平铺原点 = frame 原点（天然锚定，拖边手柄时
                            新露出区域以 frame 基准接续，+ 号相位恒定）。 */}
                        <pattern id={PLUS_PATTERN_ID} width="44" height="22" patternUnits="userSpaceOnUse">
                            <path d="M11 2v7M7.5 5.5h7M33 13v7M29.5 16.5h7" stroke="currentColor" strokeWidth="1.6" fill="none" />
                            <circle cx="22" cy="11" r="1" fill="currentColor" opacity="0.4" />
                        </pattern>
                    </defs>
                </svg>
                {/* 扩展区"+"号纹理：全铺 + SVG mask 挖出图片视觉矩形（白=显示/黑=隐藏）。
                    拖图时洞跟随 transform 逐帧直写（原位露纹理、图片永在洞中可见），
                    手柄拖边时洞随 frame 重算；mask 矩形无多边形对角线伪影。 */}
                <div ref={clipHoleRef} className="pointer-events-none absolute inset-0 text-primary/35">
                    <svg width="100%" height="100%">
                        <defs>
                            <mask id={`${PLUS_PATTERN_ID}-hole`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
                                <rect width="100%" height="100%" fill="white" />
                                <rect ref={maskRectRef} x="-16" y="-16" width="0" height="0" fill="black" />
                            </mask>
                        </defs>
                        <rect width="100%" height="100%" fill={`url(#${PLUS_PATTERN_ID})`} mask={`url(#${PLUS_PATTERN_ID}-hole)`} />
                    </svg>
                </div>
                {/* 三分网格只画内部 4 线，避免 9 格 border 外缘描重 */}
                <div className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-primary/30" />
                <div className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-primary/30" />
                <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-primary/30" />
                <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-primary/30" />
                <div ref={labelRef} className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur" />
                {CORNER_HANDLES.map((handle) => (
                    <div
                        key={handle.edge}
                        onPointerDown={(event) => onHandlePointerDown(event, handle.edge)}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={onHandlePointerUp}
                        onPointerCancel={onHandlePointerUp}
                        className={`pointer-events-auto absolute size-3 rounded-full border-2 border-background bg-primary shadow-sm ${handle.className}`}
                        data-testid={`canvas-outpaint-handle-${handle.edge}`}
                    />
                ))}
                {EDGE_HANDLES.map((handle) => (
                    <div
                        key={handle.edge}
                        onPointerDown={(event) => onHandlePointerDown(event, handle.edge)}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={onHandlePointerUp}
                        onPointerCancel={onHandlePointerUp}
                        className={`pointer-events-auto absolute rounded-full border border-primary/40 bg-background/60 backdrop-blur-sm transition-colors hover:bg-primary/25 ${handle.className}`}
                        data-testid={`canvas-outpaint-handle-${handle.edge}`}
                    />
                ))}
            </div>

            <div
                ref={barRef}
                style={{ opacity: visible ? 1 : 0, transition: "opacity 150ms ease" }}
                data-canvas-no-zoom
                data-canvas-wheel-scroll
                data-testid="canvas-outpaint-bar"
                className="pointer-events-auto absolute flex w-max max-w-[calc(100%-24px)] flex-col gap-1 rounded-2xl border border-border/60 bg-background/90 p-1.5 shadow-xl backdrop-blur-xl"
            >
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                <button
                    type="button"
                    aria-label="关闭扩图"
                    onClick={onClose}
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-foreground/8 hover:text-foreground"
                >
                    <X className="size-4" />
                </button>
                <span className="h-6 w-px shrink-0 bg-border" />
                <div className="canvas-node-composer-model shrink-0">
                    <ModelPicker
                        config={config}
                        value={model}
                        capability="image"
                        // 扩图合同：模型必须能接收底图参考（maxImages>=1），maxImages=0 的纯文生图
                        // 模型（如 grok-imagine-image-2.0）直接不进列表，而非灰显（2026-09-20 用户反馈）。
                        requirements={{ capability: "image", input: { textCount: 1, imageCount: 1, videoCount: 0, audioCount: 0, characterCount: 0 } }}
                        hideIncompatible
                        placement="topRight"
                        variant="creation"
                        searchable
                        className="!h-7 !min-w-0 !text-[var(--fs-tiny)] !font-normal [&_img]:!size-3 [&_.lucide]:!size-3"
                        popoverClassName="canvas-outpaint-picker-surface"
                        showSelectedPrice={false}
                        showConfiguredModelName
                        onChange={(next) => setModel(next)}
                    />
                </div>
                {hasModel ? (
                    <>
                        <span className="h-6 w-px shrink-0 bg-border" />
                        <Dropdown
                            trigger={["click"]}
                            placement="top"
                            menu={{
                                items: ratioOptions.map((option) => ({ key: option, label: ratioOptionLabel(option) })),
                                selectable: true,
                                selectedKeys: [ratioKey],
                                onClick: ({ key }) => {
                                    setRatioKey(key);
                                    if (key === FREE_RATIO_KEY || !node) return;
                                    const nextRatio = parseRatioValue(key);
                                    // 原图比例 = 回到打开时的基准外扩（源图比例），不进档位重排：
                                    // 不重置则 padding 停留在上一个比例的重排值，框比例不变（2026-09-20 实测缺陷）。
                                    if (!nextRatio) {
                                        if (key === ORIGINAL_RATIO_KEY) {
                                            startExpandAnimation();
                                            applyPadding(DEFAULT_PADDING);
                                        }
                                        return;
                                    }
                                    const layoutWidth = nodeElementRef.current?.offsetWidth || layoutSize.width;
                                    const layoutHeight = nodeElementRef.current?.offsetHeight || layoutSize.height;
                                    if (!layoutWidth || !layoutHeight) return;
                                    // 唯一开启位置/尺寸 transition 的入口：比例切换的 360ms 展开跟随。
                                    startExpandAnimation();
                                    // 比例锁定只重排框形状（占比语义）：框显示大小仍由手柄/拖图决定，
                                    // 提交目标恒 = 档位×比例的 preset 精确像素（handleExecute 换算）。
                                    applyPadding(resolveOutpaintPaddingForRatio({ nodeWidth: layoutWidth, nodeHeight: layoutHeight, ratio: nextRatio, basePadding: paddingRef.current }));
                                },
                            }}
                        >
                            <button type="button" className="flex h-8 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/8" aria-label="目标画幅比例">
                                {ratioMenuLabel}
                            </button>
                        </Dropdown>
                        {resolutionOptions.length > 1 ? (
                            <>
                                <span className="h-6 w-px shrink-0 bg-border" />
                                <Select
                                    size="small"
                                    variant="borderless"
                                    value={resolutionMode === "size" ? selectedTier : qualityOptions.includes(qualityValue) ? qualityValue : qualityOptions[0]}
                                    onChange={(value) => {
                                        const next = String(value);
                                        if (resolutionMode === "size") {
                                            // 档位切换只改提交目标（preset 精确像素，handleExecute 换算），框显示不动。
                                            setSizeValue(next);
                                            return;
                                        }
                                        setQualityValue(next);
                                    }}
                                    options={resolutionOptions.map((value) => ({ value, label: String(value) === "auto" ? "AUTO" : String(value).toUpperCase() }))}
                                    popupMatchSelectWidth={false}
                                    placement="topLeft"
                                    aria-label={resolutionMode === "size" ? "输出分辨率" : "输出画质"}
                                    className="w-[86px] shrink-0"
                                />
                            </>
                        ) : null}
                        {/* size 制模型（如 gpt-image-2）画质域与分辨率档独立并存：分辨率槽选像素档，
                            画质槽选模型 quality 域（auto/low/medium/high）；quality 制模型（如 grok）
                            的画质已由上方槽承担，不重复展示（用户需求 2026-09-20）。 */}
                        {resolutionMode === "size" && qualityOptions.length > 1 ? (
                            <>
                                <span className="h-6 w-px shrink-0 bg-border" />
                                <Select
                                    size="small"
                                    variant="borderless"
                                    value={qualityOptions.includes(qualityValue) ? qualityValue : imageProfile?.quality?.default || qualityOptions[0]}
                                    onChange={(value) => setQualityValue(String(value))}
                                    options={qualityOptions.map((value) => ({ value, label: String(value) === "auto" ? "AUTO" : String(value).toUpperCase() }))}
                                    popupMatchSelectWidth={false}
                                    placement="topLeft"
                                    aria-label="输出画质"
                                    className="w-[86px] shrink-0"
                                />
                            </>
                        ) : null}
                        {countOptions.length > 1 ? (
                            <>
                                <span className="h-6 w-px shrink-0 bg-border" />
                                <Select
                                    size="small"
                                    variant="borderless"
                                    value={count}
                                    onChange={setCount}
                                    options={countOptions.map((value) => ({ value, label: `x${value}` }))}
                                    popupMatchSelectWidth={false}
                                    placement="topLeft"
                                    aria-label="生成张数"
                                    className="w-[64px] shrink-0"
                                />
                            </>
                        ) : null}
                    </>
                ) : null}
                <Button
                    type="text"
                    className={`canvas-node-composer-submit canvas-node-composer-submit-canvas ${canExecute && creditsEnabled ? "has-cost" : ""}`}
                    disabled={!canExecute}
                    onClick={handleExecute}
                    style={{ "--canvas-composer-submit-action": "var(--primary)", "--canvas-composer-submit-action-fg": "var(--primary-foreground)" } as CSSProperties}
                    aria-label={canExecute ? `预计消耗 ${credits} 积分，执行扩图` : "当前模型不支持扩图，请更换模型"}
                >
                    {canExecute && creditsEnabled ? (
                        <span className="canvas-node-composer-submit-cost">
                            <CreditSymbol />
                            {/* 报价可到 micro 级(用户配置 0.001)：固定两位会把 0.001 截断成 0.00（2026-09-20 实测）；
                                最多 6 位去尾零，整数不带小数点。 */}
                            <span>{formatOutpaintCredits(credits)}</span>
                        </span>
                    ) : null}
                    <span className="canvas-node-composer-submit-action" aria-hidden>
                        <ArrowUp className="size-3.5" strokeWidth={2.4} />
                    </span>
                </Button>
                </div>
                <Input
                    size="small"
                    variant="borderless"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="追加说明（可选）"
                    aria-label="扩图追加说明"
                    className="min-w-0 flex-1 text-xs"
                />
            </div>
            {/* 覆盖共享 surface 的玻璃渲染：backdrop-filter 与 WebGL 画布合成时区域撕裂（Pinned 区透出下层），
                扩图场景改为完全不透明 surface。源顺序在后 → 同特异性同 important 下本规则获胜。 */}
            <style>{"@layer utilities { .ant-popover.canvas-outpaint-picker-surface .canvas-composer-popover-surface, .ant-popover.canvas-outpaint-picker-surface .creation-model-picker-surface { background: var(--popover) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } }"}</style>
        </div>
    );
}
