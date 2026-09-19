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
import { describeOutpaintSize, parseRatioValue, resolveOutpaintPadding, resolveOutpaintPaddingForRatio, resolveOutpaintTargetPx, type OutpaintDragEdge, type OutpaintPadding } from "@/lib/canvas/canvas-outpaint-geometry";
import { subscribeCanvasViewportPreview } from "@/lib/canvas/canvas-live-viewport";
import { modelOptionName, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { quoteLogicalModel } from "@/services/api/logical-models";
import type { CanvasNodeData } from "@/types/canvas";

export type CanvasImageOutpaintPayload = {
    paddingPx: OutpaintPadding;
    prompt: string;
    generationConfig: { model: string; imageModel?: string; size?: string; quality?: string; count: string };
};

type CanvasNodeOutpaintOverlayProps = {
    node: CanvasNodeData | null;
    // 渲染点必须位于画布容器（position 定位上下文）内部，rect 量测相对该容器换算。
    containerRef: RefObject<HTMLDivElement | null>;
    config: AiConfig;
    onClose: () => void;
    onExecute: (node: CanvasNodeData, payload: CanvasImageOutpaintPayload) => void;
};

const FREE_RATIO_KEY = "free";

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
const ZERO_PADDING: OutpaintPadding = { left: 0, top: 0, right: 0, bottom: 0 };
const FRAME_EXPAND_TRANSITION = "left 360ms cubic-bezier(0.22, 1, 0.36, 1), top 360ms cubic-bezier(0.22, 1, 0.36, 1), width 360ms cubic-bezier(0.22, 1, 0.36, 1), height 360ms cubic-bezier(0.22, 1, 0.36, 1)";

// 手柄位移语义：dx/dy 为拖拽累计屏幕 delta（÷scale 后进几何纯函数），
// 每次以 pointerdown 时的 startPadding 为基准重算，避免增量叠加误差。
type DragState = { edge: OutpaintDragEdge; startX: number; startY: number; startPadding: OutpaintPadding } | null;

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

export function CanvasNodeOutpaintOverlay({ node, containerRef, config, onClose, onExecute }: CanvasNodeOutpaintOverlayProps) {
    const frameRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const stripRefs = useRef<{ top: HTMLDivElement | null; bottom: HTMLDivElement | null; left: HTMLDivElement | null; right: HTMLDivElement | null }>({ top: null, bottom: null, left: null, right: null });
    const stripPatternRefs = useRef<{ top: SVGPatternElement | null; bottom: SVGPatternElement | null; left: SVGPatternElement | null; right: SVGPatternElement | null }>({ top: null, bottom: null, left: null, right: null });
    const barRef = useRef<HTMLDivElement>(null);
    const nodeElementRef = useRef<HTMLElement | null>(null);
    const scaleRef = useRef(1);
    const dragRef = useRef<DragState>(null);
    const paddingRef = useRef<OutpaintPadding>(ZERO_PADDING);
    // 节点布局尺寸以 DOM offsetWidth/Height 实测为准（含 freeResize），禁用 React node.width 推断 scale。
    const [layoutSize, setLayoutSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [padding, setPadding] = useState<OutpaintPadding>(ZERO_PADDING);
    const [dragging, setDragging] = useState(false);
    const [ratioKey, setRatioKey] = useState<string>(FREE_RATIO_KEY);
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

    // 比例槽：aspect_ratio 制用模型档位；size 制用渠道结构化 presets 的去重比例（10 个比例就是 10 个，
    // 不再从全 tier WxH 推导出 2.33:1/7:3 之类重复档）；未选模型时不显示参数槽。
    const ratioOptions = useMemo(() => {
        if (!hasModel) return [];
        if (sizeParameter === "aspect_ratio") {
            return [FREE_RATIO_KEY, ...sizeOptions.filter((value) => parseRatioValue(value) !== null)];
        }
        if (sizeParameter === "size" && sizePresetOptions.length) {
            const ratios: string[] = [];
            for (const preset of sizePresetOptions) if (!ratios.includes(preset.ratio)) ratios.push(preset.ratio);
            return [FREE_RATIO_KEY, ...ratios];
        }
        return [FREE_RATIO_KEY, ...GENERIC_RATIO_OPTIONS];
    }, [hasModel, sizeParameter, sizeOptions, sizePresetOptions]);
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
        setRatioKey(FREE_RATIO_KEY);
        setSizeValue("");
        setQualityValue("");
    }, [model]);

    // size 制的分辨率档（sizeValue 语义 = tier）；默认 auto = 模型自选。
    const selectedTier: ImageResolutionChoice =
        sizeValue && (tierChoices as string[]).includes(sizeValue) ? (sizeValue as ImageResolutionChoice) : "auto";
    const lockedRatioKey = ratioKey !== FREE_RATIO_KEY ? ratioKey : null;
    const submitSize =
        sizeParameter === "aspect_ratio"
            ? (lockedRatioKey ?? sizeFallback)
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

    const ratio = ratioKey === FREE_RATIO_KEY ? null : parseRatioValue(ratioKey);

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

    const updateFrame = useCallback(() => {
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

        const pt = current.top * scale;
        const pb = current.bottom * scale;
        const pl = current.left * scale;
        const pr = current.right * scale;
        // 网格相位锚定「图片左上」：条带 SVG 原点在 frame 内位于 (stripX, stripY)，
        // 图片左上在 (pl, pt) → patternTransform = translate(pl - stripX, pt - stripY)。
        // 拖动边框 / 选比例时 pl、pt 不随被拖边变化（图片不动），+ 号在图片坐标系中静止，
        // 新露出的区域按图片边缘为基准展开（用户语义：以图片边缘线展开）。
        const setPhase = (key: "top" | "bottom" | "left" | "right", stripX: number, stripY: number) => {
            const pattern = stripPatternRefs.current[key];
            if (!pattern) return;
            pattern.setAttribute("patternTransform", `translate(${pl - stripX}, ${pt - stripY})`);
        };
        if (stripRefs.current.top) {
            stripRefs.current.top.style.height = `${pt}px`;
            stripRefs.current.top.style.display = pt > 0 ? "" : "none";
        }
        if (stripRefs.current.bottom) {
            stripRefs.current.bottom.style.height = `${pb}px`;
            stripRefs.current.bottom.style.display = pb > 0 ? "" : "none";
        }
        if (stripRefs.current.left) {
            stripRefs.current.left.style.width = `${pl}px`;
            stripRefs.current.left.style.top = `${pt}px`;
            stripRefs.current.left.style.bottom = `${pb}px`;
            stripRefs.current.left.style.display = pl > 0 ? "" : "none";
        }
        if (stripRefs.current.right) {
            stripRefs.current.right.style.width = `${pr}px`;
            stripRefs.current.right.style.top = `${pt}px`;
            stripRefs.current.right.style.bottom = `${pb}px`;
            stripRefs.current.right.style.display = pr > 0 ? "" : "none";
        }
        setPhase("top", 0, 0);
        setPhase("bottom", 0, height - pb);
        setPhase("left", 0, pt);
        setPhase("right", width - pr, pt);
        if (labelRef.current) {
            labelRef.current.textContent = describeOutpaintSize(current, layoutWidth, layoutHeight, contentWidth / Math.max(1, layoutWidth));
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
    }, [containerRef, contentWidth, ensureNodeElement]);

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
            dragRef.current = { edge, startX: event.clientX, startY: event.clientY, startPadding: paddingRef.current };
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
                }),
            );
        },
        [applyPadding, layoutSize.height, layoutSize.width, ratio],
    );

    const onHandlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        dragRef.current = null;
        setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }, []);

    const handleExecute = useCallback(() => {
        if (!node || !canExecute) return;
        const layoutWidth = nodeElementRef.current?.offsetWidth || layoutSize.width;
        const layoutHeight = nodeElementRef.current?.offsetHeight || layoutSize.height;
        if (!layoutWidth || !layoutHeight) return;
        const target = resolveOutpaintTargetPx({ contentWidth, contentHeight, nodeWidth: layoutWidth, nodeHeight: layoutHeight, padding });
        if (!target.width || !target.height) return;
        onExecute(node, {
            paddingPx: target.paddingPx,
            prompt: prompt.trim(),
            generationConfig: { model, size: submitSize, quality: submitQuality, count: String(count) },
        });
    }, [canExecute, contentHeight, contentWidth, count, layoutSize.height, layoutSize.width, model, node, onExecute, padding, prompt, submitQuality, submitSize]);

    if (!node) return null;

    const frameStyle: CSSProperties = {
        opacity: visible ? 1 : 0,
        transition: dragging ? "opacity 150ms ease" : `${FRAME_EXPAND_TRANSITION}, opacity 150ms ease`,
    };

    const ratioMenuLabel = ratioKey === FREE_RATIO_KEY ? "自由" : ratioKey;

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
                            每条带独立 pattern，patternTransform 把平铺原点对齐到「图片左上」——
                            拖动任一边时新区域以图片边缘为基准展开（+ 号静止在图片坐标系）。 */}
                        {(["top", "bottom", "left", "right"] as const).map((key) => (
                            <pattern key={key} id={`${PLUS_PATTERN_ID}-${key}`} width="44" height="22" patternUnits="userSpaceOnUse" ref={(el) => { stripPatternRefs.current[key] = el; }}>
                                <path d="M11 2v7M7.5 5.5h7M33 13v7M29.5 16.5h7" stroke="currentColor" strokeWidth="1.6" fill="none" />
                                <circle cx="22" cy="11" r="1" fill="currentColor" opacity="0.4" />
                            </pattern>
                        ))}
                    </defs>
                </svg>
                {/* 扩展区"+"号填充：四条带挖出原图区域，currentColor 随令牌明暗自适应 */}
                <div className="pointer-events-none absolute inset-0 text-primary/35">
                    <div ref={(el) => { stripRefs.current.top = el; }} style={{ transition: dragging ? "none" : "width 360ms cubic-bezier(0.22,1,0.36,1), height 360ms cubic-bezier(0.22,1,0.36,1)" }} className="absolute inset-x-0 top-0 overflow-hidden rounded-t-md">
                        <svg width="100%" height="100%"><rect width="100%" height="100%" fill={`url(#${PLUS_PATTERN_ID}-top)`} /></svg>
                    </div>
                    <div ref={(el) => { stripRefs.current.bottom = el; }} style={{ transition: dragging ? "none" : "height 360ms cubic-bezier(0.22,1,0.36,1)" }} className="absolute inset-x-0 bottom-0 overflow-hidden rounded-b-md">
                        <svg width="100%" height="100%"><rect width="100%" height="100%" fill={`url(#${PLUS_PATTERN_ID}-bottom)`} /></svg>
                    </div>
                    <div ref={(el) => { stripRefs.current.left = el; }} style={{ transition: dragging ? "none" : "width 360ms cubic-bezier(0.22,1,0.36,1), top 360ms cubic-bezier(0.22,1,0.36,1), bottom 360ms cubic-bezier(0.22,1,0.36,1)" }} className="absolute left-0 overflow-hidden">
                        <svg width="100%" height="100%"><rect width="100%" height="100%" fill={`url(#${PLUS_PATTERN_ID}-left)`} /></svg>
                    </div>
                    <div ref={(el) => { stripRefs.current.right = el; }} style={{ transition: dragging ? "none" : "width 360ms cubic-bezier(0.22,1,0.36,1), top 360ms cubic-bezier(0.22,1,0.36,1), bottom 360ms cubic-bezier(0.22,1,0.36,1)" }} className="absolute right-0 overflow-hidden">
                        <svg width="100%" height="100%"><rect width="100%" height="100%" fill={`url(#${PLUS_PATTERN_ID}-right)`} /></svg>
                    </div>
                </div>
                {/* 三分网格只画内部 4 线，避免 9 格 border 外缘描重 */}
                <div className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-primary/15" />
                <div className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-primary/15" />
                <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-primary/15" />
                <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-primary/15" />
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
                className="pointer-events-auto absolute flex w-[640px] max-w-[calc(100%-24px)] flex-col gap-1 rounded-2xl border border-border/60 bg-background/90 p-1.5 shadow-xl backdrop-blur-xl"
            >
                <div className="flex min-w-0 items-center gap-1">
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
                                items: ratioOptions.map((option) => ({ key: option, label: option === FREE_RATIO_KEY ? "自由" : option })),
                                selectable: true,
                                selectedKeys: [ratioKey],
                                onClick: ({ key }) => {
                                    setRatioKey(key);
                                    if (key === FREE_RATIO_KEY || !node) return;
                                    const nextRatio = parseRatioValue(key);
                                    if (!nextRatio) return;
                                    const layoutWidth = nodeElementRef.current?.offsetWidth || layoutSize.width;
                                    const layoutHeight = nodeElementRef.current?.offsetHeight || layoutSize.height;
                                    if (!layoutWidth || !layoutHeight) return;
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
                                    onChange={(value) => (resolutionMode === "size" ? setSizeValue(String(value)) : setQualityValue(String(value)))}
                                    options={resolutionOptions.map((value) => ({ value, label: String(value) === "auto" ? "AUTO" : String(value).toUpperCase() }))}
                                    popupMatchSelectWidth={false}
                                    placement="topLeft"
                                    aria-label={resolutionMode === "size" ? "输出分辨率" : "输出画质"}
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
                            <span>{credits % 1 === 0 ? credits : credits.toFixed(2)}</span>
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
