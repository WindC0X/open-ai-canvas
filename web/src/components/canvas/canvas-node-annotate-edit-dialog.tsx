/**
 * F-08 圈选改图对话框。
 *
 * 交互栈照 `canvas-node-mask-edit-dialog.tsx`（img + overlay canvas 绝对定位、
 * 指针捕获、坐标映射、右侧参数栏），语义换成「标注」：矩形 region + 箭头 arrow。
 *
 * 蓝本：Cowart annotation edit（标注=修改要求的视觉指示，不走 mask 通道）。
 * 标注为 v1 弹窗内临时态，关闭即弃（控制线裁定；有标注时关闭给一次性确认）。
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { App, Button, Input, Modal } from "antd";
import { ArrowUpRight, ChevronDown, RotateCcw, Square, Trash2, WandSparkles, X } from "lucide-react";

import { readImageMeta } from "@/lib/image-utils";
import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { defaultImageParamsForModel } from "@/lib/model-selection";
import type { AiConfig } from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import {
    ANNOTATE_MAX_LONG_EDGE,
    annotationExportSize,
    annotationUnionBounds,
    clampUnit,
    normalizeRect,
    type AnnotateEditAnnotation,
    type AnnotateEditShape,
} from "@/lib/canvas/annotate-edit-geometry";

export type CanvasAnnotateEditPayload = {
    annotations: AnnotateEditAnnotation[];
    generationConfig?: Partial<Pick<AiConfig, "model" | "imageModel" | "size" | "quality" | "count" | "transparentBackground">>;
};

type DraftShape = {
    shape: AnnotateEditShape;
    x: number;
    y: number;
    width: number;
    height: number;
    endX: number;
    endY: number;
};

/** 拖拽小于该归一化尺寸视为误触（不生成标注）。 */
const MIN_ANNOTATION_SIZE = 0.02;

const regionFillColor = "rgba(37, 99, 235, .28)";
const regionBorderColor = "rgba(37, 99, 235, .85)";
const arrowColor = "rgba(37, 99, 235, .95)";
const annotationLabelColor = "rgba(255, 255, 255, .95)";

export function CanvasNodeAnnotateEditDialog({ dataUrl, open, config, onClose, onConfirm }: { dataUrl: string; open: boolean; config: AiConfig; onClose: () => void; onConfirm: (payload: CanvasAnnotateEditPayload) => void }) {
    const { modal } = App.useApp();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef<{ active: boolean; start: { x: number; y: number } | null }>({ active: false, start: null });
    const [image, setImage] = useState<{ width: number; height: number } | null>(null);
    const [shape, setShape] = useState<AnnotateEditShape>("region");
    const [annotations, setAnnotations] = useState<AnnotateEditAnnotation[]>([]);
    const [draft, setDraft] = useState<DraftShape | null>(null);
    const [error, setError] = useState("");
    const [generationConfig, setGenerationConfig] = useState<AiConfig>(() => config);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const theme = canvasThemes[useActiveTheme()];

    useEffect(() => {
        if (!open) return;
        setShape("region");
        setAnnotations([]);
        setDraft(null);
        setError("");
        setAdvancedOpen(false);
        setGenerationConfig(config);
        void readImageMeta(dataUrl).then(setImage);
    }, [dataUrl, open, config]);

    // 标注层重绘：标注列表或拖拽草稿变化时全量重画（标注数量少，无性能压力）。
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || !image) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const all = draft ? [...annotations, draftToAnnotation(draft)] : annotations;
        all.forEach((annotation, index) => drawAnnotation(context, annotation, image.width, image.height, index + 1));
    }, [annotations, draft, image]);

    const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const start = drawingRef.current.start;
        if (!start || !image) return;
        const point = readCanvasPoint(event.currentTarget, event.clientX, event.clientY);
        const nextX = clampUnit(point.x / image.width);
        const nextY = clampUnit(point.y / image.height);
        setDraft({
            shape,
            x: start.x,
            y: start.y,
            width: nextX - start.x,
            height: nextY - start.y,
            endX: nextX,
            endY: nextY,
        });
    };

    const startDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!image) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = readCanvasPoint(event.currentTarget, event.clientX, event.clientY);
        drawingRef.current = { active: true, start: { x: clampUnit(point.x / image.width), y: clampUnit(point.y / image.height) } };
        setError("");
    };

    const moveDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current.active) return;
        event.preventDefault();
        draw(event);
    };

    const stopDraw = () => {
        const start = drawingRef.current.start;
        drawingRef.current = { active: false, start: null };
        if (!start || !draft) {
            setDraft(null);
            return;
        }
        const isRegion = draft.shape === "region";
        const rect = normalizeRect(draft);
        const tooSmall = isRegion
            ? rect.width < MIN_ANNOTATION_SIZE || rect.height < MIN_ANNOTATION_SIZE
            : Math.hypot(draft.endX - start.x, draft.endY - start.y) < MIN_ANNOTATION_SIZE;
        setDraft(null);
        if (tooSmall) return;
        const id = `annotation-${Date.now()}-${annotations.length}`;
        setAnnotations((current) => [
            ...current,
            isRegion
                ? { id, shape: "region", note: "", x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                : { id, shape: "arrow", note: "", x: start.x, y: start.y, endX: draft.endX, endY: draft.endY },
        ]);
    };

    const updateNote = (id: string, note: string) => {
        setAnnotations((current) => current.map((annotation) => (annotation.id === id ? { ...annotation, note } : annotation)));
        setError("");
    };

    const removeAnnotation = (id: string) => {
        setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
    };

    const requestClose = useCallback(() => {
        if (annotations.length === 0) {
            onClose();
            return;
        }
        // 临时态纪律：关闭即弃，先确认防用户标注白做（控制线裁定）。
        modal.confirm({
            title: "关闭将清除标注",
            content: "当前标注不会被保存，关闭后需要重新圈选。",
            okText: "关闭并清除",
            cancelText: "继续编辑",
            okButtonProps: { danger: true },
            onOk: onClose,
        });
    }, [annotations.length, modal, onClose]);

    const submit = () => {
        if (annotations.length === 0) return setError("请先在图片上圈选或标注区域");
        if (annotations.some((annotation) => !annotation.note.trim())) return setError("请为每条标注填写修改要求");
        if (!image) return;
        const bounds = annotationUnionBounds(annotations, image.width, image.height);
        if (!bounds) return;
        const exportSize = annotationExportSize(bounds);
        if (exportSize.tooLarge) {
            setError(`标注范围导出尺寸 ${exportSize.width} × ${exportSize.height} 超过上限。请将标注移近，或先把图片长边缩到不超过 ${ANNOTATE_MAX_LONG_EDGE}px`);
            return;
        }
        onConfirm({
            annotations: annotations.map((annotation) => ({ ...annotation, note: annotation.note.trim() })),
            generationConfig: { model: generationConfig.model, imageModel: generationConfig.imageModel, size: generationConfig.size, quality: generationConfig.quality, count: generationConfig.count, transparentBackground: generationConfig.transparentBackground },
        });
    };

    return (
        <Modal className="workspace-modal workspace-modal-wide" title={null} open={open && Boolean(dataUrl)} onCancel={requestClose} footer={null} centered destroyOnHidden>
            <div className="grid gap-5 lg:grid-cols-[minmax(360px,1fr)_340px]">
                <div className="flex min-h-[360px] items-center justify-center rounded-lg bg-surface-active p-0">
                    <div className="relative inline-block max-w-full overflow-hidden rounded-lg bg-transparent select-none">
                        <img src={dataUrl} alt="" className="relative z-0 block max-h-[68vh] max-w-full bg-transparent" draggable={false} />
                        {image ? (
                            <canvas
                                ref={canvasRef}
                                width={image.width}
                                height={image.height}
                                className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none"
                                onPointerDown={startDraw}
                                onPointerMove={moveDraw}
                                onPointerUp={stopDraw}
                                onPointerCancel={stopDraw}
                            />
                        ) : null}
                    </div>
                </div>

                <div className="flex max-h-[68vh] min-h-[360px] flex-col overflow-hidden">
                    <div className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                        <div>
                            <h2 className="text-xl font-semibold">圈选改图</h2>
                            <div className="mt-2 text-sm opacity-60">{image ? `${image.width} x ${image.height}px` : "读取中"}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button type={shape === "region" ? "primary" : "default"} aria-pressed={shape === "region"} icon={<Square className="size-4" />} onClick={() => setShape("region")}>
                                矩形区域
                            </Button>
                            <Button type={shape === "arrow" ? "primary" : "default"} aria-pressed={shape === "arrow"} icon={<ArrowUpRight className="size-4" />} onClick={() => setShape("arrow")}>
                                箭头指向
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm font-medium opacity-75">标注列表（{annotations.length}）</div>
                            {annotations.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-xs leading-5 opacity-60">在左侧图片上拖拽画框或箭头，然后在下方填写修改要求。</div>
                            ) : (
                                <div className="space-y-2">
                                    {annotations.map((annotation, index) => (
                                        <div key={annotation.id} className="flex items-start gap-2 rounded-lg border border-border/60 px-2.5 py-2">
                                            <span className="mt-1.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{index + 1}</span>
                                            <Input
                                                size="small"
                                                value={annotation.note}
                                                status={error && !annotation.note.trim() ? "error" : undefined}
                                                placeholder={annotation.shape === "region" ? "例如：改成金属材质" : "例如：把这个替换成蓝色"}
                                                onChange={(event) => updateNote(annotation.id, event.target.value)}
                                            />
                                            <Button size="small" type="text" icon={<Trash2 className="size-4" />} aria-label={`删除标注 ${index + 1}`} onClick={() => removeAnnotation(annotation.id)} />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {error ? <div className="text-xs font-medium text-destructive">{error}</div> : null}
                        </div>

                        <div className="rounded-xl border border-border/60">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
                                aria-expanded={advancedOpen}
                                onClick={() => setAdvancedOpen((current) => !current)}
                            >
                                <span>高级生成设置</span>
                                <ChevronDown className={`size-4 shrink-0 opacity-60 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                            </button>
                            {advancedOpen ? (
                                <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
                                    <div className="space-y-2">
                                        <div className="text-sm font-medium opacity-75">生成模型</div>
                                        <ModelPicker
                                            config={generationConfig}
                                            value={generationConfig.imageModel || generationConfig.model}
                                            capability="image"
                                            fullWidth
                                            showSelectedPrice={false}
                                            onChange={(model) => setGenerationConfig((current) => ({ ...current, model, imageModel: model, ...defaultImageParamsForModel(current, model) }))}
                                        />
                                    </div>
                                    <ImageSettingsPanel
                                        config={generationConfig}
                                        showTitle={false}
                                        showCount={false}
                                        bypassPriceGuard
                                        className="space-y-3"
                                        theme={theme}
                                        onConfigChange={(key, value) => setGenerationConfig((current) => ({ ...current, [key]: value }))}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-border/50 pt-3">
                        <Button icon={<RotateCcw className="size-4" />} onClick={() => setAnnotations([])}>
                            重置
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button icon={<X className="size-4" />} onClick={requestClose}>
                                取消
                            </Button>
                            <Button type="primary" icon={<WandSparkles className="size-4" />} onClick={submit}>
                                按标注修改
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function draftToAnnotation(draft: DraftShape): AnnotateEditAnnotation {
    return {
        id: "draft",
        shape: draft.shape,
        note: "",
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height,
        endX: draft.endX,
        endY: draft.endY,
    };
}

function readCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
        y: ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
}

function drawAnnotation(context: CanvasRenderingContext2D, annotation: AnnotateEditAnnotation, imageWidth: number, imageHeight: number, label: number) {
    if (annotation.shape === "region") {
        const rect = normalizeRect(annotation);
        const left = rect.x * imageWidth;
        const top = rect.y * imageHeight;
        const width = rect.width * imageWidth;
        const height = rect.height * imageHeight;
        context.fillStyle = regionFillColor;
        context.fillRect(left, top, width, height);
        context.strokeStyle = regionBorderColor;
        context.lineWidth = Math.max(1, imageWidth / 400);
        context.setLineDash([8, 6]);
        context.strokeRect(left, top, width, height);
        context.setLineDash([]);
        drawLabel(context, label, left, top, imageWidth);
        return;
    }

    const fromX = clampUnit(annotation.x) * imageWidth;
    const fromY = clampUnit(annotation.y) * imageHeight;
    const toX = clampUnit(annotation.endX ?? annotation.x) * imageWidth;
    const toY = clampUnit(annotation.endY ?? annotation.y) * imageHeight;
    const lineWidth = Math.max(2, imageWidth / 300);
    context.strokeStyle = arrowColor;
    context.fillStyle = arrowColor;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();
    // 箭头头部：终点回折 ±30° 两条短线。
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLength = Math.max(10, imageWidth / 60);
    for (const offset of [Math.PI / 6, -Math.PI / 6]) {
        context.beginPath();
        context.moveTo(toX, toY);
        context.lineTo(toX - headLength * Math.cos(angle + offset), toY - headLength * Math.sin(angle + offset));
        context.stroke();
    }
    drawLabel(context, label, fromX, fromY, imageWidth);
}

function drawLabel(context: CanvasRenderingContext2D, label: number, x: number, y: number, imageWidth: number) {
    const radius = Math.max(10, imageWidth / 80);
    const centerX = Math.min(Math.max(x, radius), context.canvas.width - radius);
    const centerY = Math.min(Math.max(y, radius), context.canvas.height - radius);
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = arrowColor;
    context.fill();
    context.fillStyle = annotationLabelColor;
    context.font = `600 ${Math.round(radius * 1.2)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(label), centerX, centerY);
}
