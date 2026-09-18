import { Dropdown, Input, Select } from "antd";
import { ArrowUp, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import { ModelPicker } from "@/components/model-picker";
import { CreditSymbol } from "@/constant/credits";
import { defaultImageParamsForModel } from "@/lib/model-selection";
import { modelCapabilityConfigFor } from "@/lib/model-capabilities";
import { modelQuoteRequest, requestCreditCost } from "@/lib/model-pricing";
import { describeOutpaintSize, resolveOutpaintPadding, resolveOutpaintTargetPx, type OutpaintDragEdge, type OutpaintPadding } from "@/lib/canvas/canvas-outpaint-geometry";
import { modelOptionName, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { quoteLogicalModel } from "@/services/api/logical-models";
import type { CanvasNodeData } from "@/types/canvas";

export type CanvasImageOutpaintPayload = {
    paddingPx: OutpaintPadding;
    prompt: string;
    generationConfig: { model: string; imageModel?: string; size: string; quality?: string; count: string };
};

type CanvasNodeOutpaintOverlayProps = {
    node: CanvasNodeData | null;
    // 渲染点必须位于画布容器（position 定位上下文）内部，rect 量测相对该容器换算。
    containerRef: RefObject<HTMLDivElement | null>;
    config: AiConfig;
    onClose: () => void;
    onExecute: (node: CanvasNodeData, payload: CanvasImageOutpaintPayload) => void;
};

const RATIO_OPTIONS = [
    { key: "original", label: "原图比例" },
    { key: "1:1", label: "1:1" },
    { key: "4:3", label: "4:3" },
    { key: "3:4", label: "3:4" },
    { key: "16:9", label: "16:9" },
    { key: "9:16", label: "9:16" },
] as const;

const RATIO_VALUE: Record<string, number> = { "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "16:9": 16 / 9, "9:16": 9 / 16 };

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

// 手柄位移语义：dx/dy 为拖拽累计屏幕 delta（÷scale 后进几何纯函数），
// 每次以 pointerdown 时的 startPadding 为基准重算，避免增量叠加误差。
type DragState = { edge: OutpaintDragEdge; startX: number; startY: number; startPadding: OutpaintPadding } | null;

export function CanvasNodeOutpaintOverlay({ node, containerRef, config, onClose, onExecute }: CanvasNodeOutpaintOverlayProps) {
    const frameRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const nodeElementRef = useRef<HTMLElement | null>(null);
    const scaleRef = useRef(1);
    const dragRef = useRef<DragState>(null);
    const paddingRef = useRef<OutpaintPadding>({ left: 48, top: 48, right: 48, bottom: 48 });
    const [padding, setPadding] = useState<OutpaintPadding>({ left: 48, top: 48, right: 48, bottom: 48 });
    const [ratioKey, setRatioKey] = useState<string>("original");
    const [model, setModel] = useState<string>(node?.metadata?.model || config.model);
    const [sizeValue, setSizeValue] = useState<string>(node?.metadata?.size || config.size || "");
    const [count, setCount] = useState(1);
    const [prompt, setPrompt] = useState("");
    const [visible, setVisible] = useState(false);

    paddingRef.current = padding;

    const nodeWidth = node?.width || 0;
    const nodeHeight = node?.height || 0;
    const contentWidth = Number(node?.metadata?.naturalWidth) || nodeWidth;
    const contentHeight = Number(node?.metadata?.naturalHeight) || nodeHeight;
    const ratio = ratioKey === "original" ? (nodeWidth > 0 && nodeHeight > 0 ? nodeWidth / nodeHeight : null) : RATIO_VALUE[ratioKey] ?? null;

    const imageProfile = useMemo(() => (model ? modelCapabilityConfigFor(config, model).image : undefined), [config, model]);
    const canExecute = (imageProfile?.references?.maxImages ?? 0) >= 1;
    const sizeOptions = imageProfile?.size?.values ?? [];
    const sizeFallback = imageProfile?.size?.default ?? "";

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
    const quoteRequest = useMemo(() => modelQuoteRequest(config, model, "image"), [config, model]);
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

    const updateFrame = useCallback(() => {
        const container = containerRef.current;
        const nodeElement = nodeElementRef.current;
        const frame = frameRef.current;
        if (!container || !nodeElement || !frame || !nodeWidth || !nodeHeight) return;

        const nodeRect = nodeElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (!nodeRect.width || !nodeRect.height) return;
        const scale = nodeRect.width / nodeWidth;
        scaleRef.current = scale;

        const current = paddingRef.current;
        const left = nodeRect.left - containerRect.left - current.left * scale;
        const top = nodeRect.top - containerRect.top - current.top * scale;
        const width = nodeRect.width + (current.left + current.right) * scale;
        const height = nodeRect.height + (current.top + current.bottom) * scale;
        frame.style.left = `${left}px`;
        frame.style.top = `${top}px`;
        frame.style.width = `${width}px`;
        frame.style.height = `${height}px`;

        if (labelRef.current) {
            labelRef.current.textContent = describeOutpaintSize(current, nodeWidth, nodeHeight, contentWidth / Math.max(1, nodeWidth));
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
    }, [containerRef, contentWidth, nodeHeight, nodeWidth]);

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
        const worldLayer = container.querySelector<HTMLElement>("[data-canvas-world-layer], .canvas-world-layer");
        let worldMutations: MutationObserver | null = null;
        if (worldLayer) {
            worldMutations = new MutationObserver(updateFrame);
            worldMutations.observe(worldLayer, { attributes: true, attributeFilter: ["style"], subtree: true });
        }
        return () => {
            resizeObserver.disconnect();
            worldMutations?.disconnect();
            nodeElementRef.current = null;
        };
    }, [containerRef, node, updateFrame]);

    // 入场过渡一拍：inline transition（后台节流下 CSS animation 不播放，cc383e14）。
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setVisible(true);
            updateFrame();
        }, 30);
        return () => window.clearTimeout(timer);
    }, [updateFrame]);

    useEffect(() => {
        updateFrame();
    }, [padding, updateFrame]);

    const onHandlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>, edge: OutpaintDragEdge) => {
            event.stopPropagation();
            event.preventDefault();
            dragRef.current = { edge, startX: event.clientX, startY: event.clientY, startPadding: paddingRef.current };
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
                    nodeWidth,
                    nodeHeight,
                    ratio,
                }),
            );
        },
        [applyPadding, nodeHeight, nodeWidth, ratio],
    );

    const onHandlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }, []);

    const handleExecute = useCallback(() => {
        if (!node || !canExecute) return;
        const target = resolveOutpaintTargetPx({ contentWidth, contentHeight, nodeWidth, nodeHeight, padding });
        if (!target.width || !target.height) return;
        onExecute(node, {
            paddingPx: target.paddingPx,
            prompt: prompt.trim(),
            generationConfig: { model, size: sizeValue || sizeFallback, count: String(count), quality: node.metadata?.quality },
        });
    }, [canExecute, contentHeight, contentWidth, count, model, node, nodeHeight, nodeWidth, onExecute, padding, prompt, sizeFallback, sizeValue]);

    if (!node) return null;

    const frameStyle: CSSProperties = { transition: visible ? "opacity 150ms ease" : "none", opacity: visible ? 1 : 0 };

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            <div
                ref={frameRef}
                style={frameStyle}
                className="absolute border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                data-testid="canvas-outpaint-frame"
            >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }, (_, index) => (
                        <div key={index} className="border border-white/25" />
                    ))}
                </div>
                <div ref={labelRef} className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/65 px-2 py-0.5 text-xs font-medium text-white" />
                {CORNER_HANDLES.map((handle) => (
                    <div
                        key={handle.edge}
                        onPointerDown={(event) => onHandlePointerDown(event, handle.edge)}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={onHandlePointerUp}
                        onPointerCancel={onHandlePointerUp}
                        className={`pointer-events-auto absolute size-3 rounded-full border-2 border-white bg-white shadow-md ${handle.className}`}
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
                        className={`pointer-events-auto absolute rounded-full border border-white/70 bg-white/35 backdrop-blur-sm transition-colors hover:bg-white/60 ${handle.className}`}
                        data-testid={`canvas-outpaint-handle-${handle.edge}`}
                    />
                ))}
            </div>

            <div
                ref={barRef}
                style={frameStyle}
                data-canvas-no-zoom
                data-canvas-wheel-scroll
                data-testid="canvas-outpaint-bar"
                className="pointer-events-auto absolute flex w-[500px] max-w-[calc(100%-24px)] items-center gap-1.5 rounded-2xl border border-border/60 bg-background/90 p-1.5 shadow-xl backdrop-blur-xl"
            >
                <button
                    type="button"
                    aria-label="关闭扩图"
                    onClick={onClose}
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-foreground/8 hover:text-foreground"
                >
                    <X className="size-4" />
                </button>
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        items: RATIO_OPTIONS.map((option) => ({ key: option.key, label: option.label })),
                        selectable: true,
                        selectedKeys: [ratioKey],
                        onClick: ({ key }) => setRatioKey(key),
                    }}
                >
                    <button type="button" className="flex h-8 shrink-0 items-center gap-1 rounded-xl px-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/8" aria-label="目标画幅比例">
                        {RATIO_OPTIONS.find((option) => option.key === ratioKey)?.label}
                    </button>
                </Dropdown>
                <Input
                    size="small"
                    variant="borderless"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="拖拽外框进行扩图，可输入追加说明"
                    aria-label="扩图追加说明"
                    className="min-w-0 flex-1 text-xs"
                />
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {sizeOptions.length > 0 ? (
                        <Select
                            size="small"
                            variant="borderless"
                            value={sizeValue || sizeFallback}
                            onChange={setSizeValue}
                            options={sizeOptions.map((value) => ({ value, label: value.toUpperCase() }))}
                            popupMatchSelectWidth={false}
                            aria-label="输出分辨率"
                            className="w-[76px]"
                        />
                    ) : null}
                    <Select
                        size="small"
                        variant="borderless"
                        value={count}
                        onChange={setCount}
                        options={[1, 2, 3, 4].map((value) => ({ value, label: `x${value}` }))}
                        popupMatchSelectWidth={false}
                        aria-label="生成张数"
                        className="w-[64px]"
                    />
                    <ModelPicker
                        config={config}
                        value={model}
                        capability="image"
                        showSelectedPrice={false}
                        showConfiguredModelName
                        onChange={(next) => {
                            setModel(next);
                            const defaults = defaultImageParamsForModel(config, next);
                            if (defaults.size) setSizeValue(String(defaults.size));
                        }}
                    />
                    {creditsEnabled ? (
                        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-foreground/75" aria-label={`预计消耗 ${credits} 积分`}>
                            <CreditSymbol className="size-3.5" />
                            {credits % 1 === 0 ? credits : credits.toFixed(2)}
                        </span>
                    ) : null}
                    {canExecute ? null : <span className="shrink-0 text-xs font-medium text-destructive">当前模型不支持扩图</span>}
                    <button
                        type="button"
                        aria-label={canExecute ? "执行扩图" : "当前模型不支持扩图，请更换模型"}
                        disabled={!canExecute}
                        onClick={handleExecute}
                        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ArrowUp className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
