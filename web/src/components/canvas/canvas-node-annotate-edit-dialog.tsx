/**
 * F-08 圈选改图对话框（合并路线，控制线 2026-10-05 裁定 A）。
 *
 * 双模式标注（弹窗内切换）：
 * - 结构化：矩形 region / 箭头 arrow（导出按联合 bounds 裁剪 + 4096/16M 钳制）
 * - 自由笔刷：彩色笔画（沿用既有 annotationEdit 链的笔刷体验，导出整图标注）
 *
 * 用户可见文案统一「圈选改图」（任务命名，机器 id 保持 annotationEdit 不改）。
 * 蓝本：Cowart annotation edit（标注=修改要求的视觉指示）。
 * 标注为 v1 弹窗内临时态，关闭即弃（控制线裁定；有标注时关闭给一次性确认）。
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { App, Button, Input, Modal, Segmented, Slider } from "antd";
import { ArrowUpRight, Brush, ChevronDown, Eraser, Redo2, RotateCcw, Square, Trash2, Undo2, WandSparkles, X } from "lucide-react";

import { readImageMeta } from "@/lib/image-utils";
import { imageToDataUrl } from "@/services/image-storage";
import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { defaultImageParamsForModel } from "@/lib/model-selection";
import { Tooltip } from "@/components/ui/base/tooltip";
import type { AiConfig } from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import {
    clampUnit,
    normalizeRect,
    type AnnotateEditAnnotation,
    type AnnotateEditShape,
} from "@/lib/canvas/annotate-edit-geometry";
import { drawAnnotationShape, drawBrushStroke, type BrushStroke } from "@/lib/canvas/annotate-edit-render";
import { composeAnnotateEditExport } from "@/lib/canvas/annotate-edit-export";
import { ANNOTATE_EDIT_ACTIONS, type AnnotateEditAction } from "@/lib/canvas/annotate-edit-prompt";

/** 标注模式：结构化形状 / 自由笔刷。 */
export type AnnotateEditMode = "shape" | "brush";

type Stroke = BrushStroke;

export type CanvasAnnotateEditPayload = {
    /** 结构化标注（shape 模式；brush 模式为空数组）。 */
    annotations: AnnotateEditAnnotation[];
    /** 编辑意图。 */
    actionHint: AnnotateEditAction;
    /** 合成/整图标注 dataUrl（执行链参考图 2）。 */
    annotatedDataUrl: string;
    /** 源图 dataUrl（执行链参考图 1）。 */
    sourceDataUrl: string;
    /** 画笔笔数（brush 模式的元数据行；shape 模式为 0）。 */
    strokeCount: number;
    /** 导出截图尺寸（元数据行）。 */
    exportWidth: number;
    exportHeight: number;
    generationConfig?: Partial<Pick<AiConfig, "model" | "imageModel" | "size" | "quality" | "count" | "transparentBackground">>;
};

/** 拖拽小于该归一化尺寸视为误触（不生成标注）。 */
const MIN_ANNOTATION_SIZE = 0.02;
const brushColors = ["#ef4444", "#f59e0b", "#22c55e", "#14b8a6", "#3b82f6", "#a855f7", "#ffffff", "#111827"];

export function CanvasNodeAnnotateEditDialog({ dataUrl, storageKey, open, config, onClose, onConfirm }: { dataUrl: string; storageKey?: string; open: boolean; config: AiConfig; onClose: () => void; onConfirm: (payload: CanvasAnnotateEditPayload) => void }) {
    const { modal } = App.useApp();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sourceImageRef = useRef<HTMLImageElement | null>(null);
    const drawingRef = useRef<{ active: boolean; start: { x: number; y: number } | null; stroke: Stroke | null }>({ active: false, start: null, stroke: null });
    const [source, setSource] = useState("");
    const [image, setImage] = useState<{ width: number; height: number } | null>(null);
    const [mode, setMode] = useState<AnnotateEditMode>("shape");
    const [shape, setShape] = useState<AnnotateEditShape>("region");
    const [annotations, setAnnotations] = useState<AnnotateEditAnnotation[]>([]);
    const [draft, setDraft] = useState<{ shape: AnnotateEditShape; x: number; y: number; width: number; height: number; endX: number; endY: number } | null>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
    const [brushColor, setBrushColor] = useState(brushColors[0]);
    const [brushSize, setBrushSize] = useState(18);
    const [brushErase, setBrushErase] = useState(false);
    const [actionHint, setActionHint] = useState<AnnotateEditAction>("modify");
    const [error, setError] = useState("");
    const [generationConfig, setGenerationConfig] = useState<AiConfig>(() => config);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const theme = canvasThemes[useActiveTheme()];

    useEffect(() => {
        if (!open) return;
        setMode("shape");
        setShape("region");
        setAnnotations([]);
        setDraft(null);
        setStrokes([]);
        setRedoStrokes([]);
        setActionHint("modify");
        setError("");
        setAdvancedOpen(false);
        setGenerationConfig(config);
    }, [dataUrl, open, config]);

    // 源图读取：storageKey 优先（大图 dataUrl 直读代价高），失败回退 dataUrl。
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        void imageToDataUrl({ url: dataUrl, storageKey }).then(async (resolved) => {
            const usable = resolved || dataUrl;
            if (cancelled || !usable) return;
            const element = new Image();
            element.onload = () => {
                if (cancelled) return;
                sourceImageRef.current = element;
                setSource(usable);
                setImage({ width: element.naturalWidth, height: element.naturalHeight });
            };
            element.src = usable;
        });
        return () => { cancelled = true; };
    }, [dataUrl, open, storageKey]);

    // 标注层重绘（结构化 + 笔刷共用一块 overlay canvas）。
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || !image) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const all = draft ? [...annotations, draftToAnnotation(draft)] : annotations;
        all.forEach((annotation, index) => drawAnnotationShape(context, annotation, image.width, image.height, index + 1));
        strokes.forEach((stroke) => drawBrushStroke(context, stroke));
    }, [annotations, draft, strokes, image]);

    const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const start = drawingRef.current.start;
        if (!start || !image) return;
        const point = readCanvasPoint(event.currentTarget, event.clientX, event.clientY);
        const nextX = clampUnit(point.x / image.width);
        const nextY = clampUnit(point.y / image.height);
        setDraft({ shape, x: start.x, y: start.y, width: nextX - start.x, height: nextY - start.y, endX: nextX, endY: nextY });
    };

    const startDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!image) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = readCanvasPoint(event.currentTarget, event.clientX, event.clientY);
        setError("");
        if (mode === "brush") {
            const stroke: Stroke = { color: brushColor, size: brushSize, erase: brushErase, points: [point] };
            drawingRef.current = { active: true, start: null, stroke };
            setStrokes((current) => [...current, stroke]);
            return;
        }
        drawingRef.current = { active: true, start: { x: clampUnit(point.x / image.width), y: clampUnit(point.y / image.height) }, stroke: null };
    };

    const moveDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current.active) return;
        event.preventDefault();
        if (mode === "brush") {
            const stroke = drawingRef.current.stroke;
            if (!stroke) return;
            const point = readCanvasPoint(event.currentTarget, event.clientX, event.clientY);
            stroke.points.push(point);
            setStrokes((current) => [...current]);
            return;
        }
        draw(event);
    };

    const stopDraw = () => {
        const { start, stroke } = drawingRef.current;
        drawingRef.current = { active: false, start: null, stroke: null };
        if (mode === "brush") {
            if (stroke) setRedoStrokes([]);
            return;
        }
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

    const undoBrush = () => setStrokes((current) => {
        const last = current.at(-1);
        if (!last) return current;
        setRedoStrokes((redo) => [...redo, last]);
        return current.slice(0, -1);
    });

    const redoBrush = () => setRedoStrokes((current) => {
        const last = current.at(-1);
        if (!last) return current;
        setStrokes((items) => [...items, last]);
        return current.slice(0, -1);
    });

    const hasContent = mode === "shape" ? annotations.length > 0 : strokes.length > 0;

    const requestClose = useCallback(() => {
        if (!hasContent) {
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
    }, [hasContent, modal, onClose]);

    /** 合成导出：shape=按 bounds 裁剪；brush=整图（共享导出模块，双模式统一出口）。 */
    const buildAnnotatedExport = useCallback(async (): Promise<{ dataUrl: string; width: number; height: number } | null> => {
        const sourceImage = sourceImageRef.current;
        if (!sourceImage || !image) return null;
        try {
            return composeAnnotateEditExport(mode === "shape"
                ? { mode: "shape", image: sourceImage, annotations }
                : { mode: "brush", image: sourceImage, strokes });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "导出合成失败");
            return null;
        }
    }, [annotations, image, mode, strokes]);

    const submit = async () => {
        if (!image) return;
        if (mode === "shape" && annotations.length === 0) return setError("请先在图片上圈选或标注区域");
        if (mode === "brush" && strokes.length === 0) return setError("请先用画笔标记要修改的区域");
        if (mode === "shape" && annotations.some((annotation) => !annotation.note.trim())) return setError("请为每条标注填写修改要求");
        const annotated = await buildAnnotatedExport();
        if (!annotated) return;
        const sourceImage = sourceImageRef.current;
        if (!sourceImage) return;
        onConfirm({
            annotations: mode === "shape" ? annotations.map((annotation) => ({ ...annotation, note: annotation.note.trim() })) : [],
            actionHint,
            annotatedDataUrl: annotated.dataUrl,
            sourceDataUrl: source,
            strokeCount: mode === "brush" ? strokes.length : 0,
            exportWidth: annotated.width,
            exportHeight: annotated.height,
            generationConfig: { model: generationConfig.model, imageModel: generationConfig.imageModel, size: generationConfig.size, quality: generationConfig.quality, count: generationConfig.count, transparentBackground: generationConfig.transparentBackground },
        });
    };

    return (
        <Modal className="workspace-modal workspace-modal-wide" title={null} open={open && Boolean(dataUrl)} onCancel={requestClose} footer={null} centered destroyOnHidden>
            <div className="grid gap-5 lg:grid-cols-[minmax(360px,1fr)_340px]">
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 rounded-lg bg-surface-active p-0">
                    <div className="relative inline-block max-w-full overflow-hidden rounded-lg bg-transparent select-none">
                        <img src={source} alt="" className="relative z-0 block max-h-[68vh] max-w-full bg-transparent" draggable={false} />
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

                        <Segmented
                            block
                            value={mode}
                            onChange={(value) => {
                                setMode(value as AnnotateEditMode);
                                setError("");
                            }}
                            options={[
                                { label: "形状标注", value: "shape" },
                                { label: "自由画笔", value: "brush" },
                            ]}
                        />

                        {mode === "shape" ? (
                            <>
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
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <ToolButton title="画笔" active={!brushErase} onClick={() => setBrushErase(false)}><Brush className="size-4" /></ToolButton>
                                    <ToolButton title="橡皮" active={brushErase} onClick={() => setBrushErase(true)}><Eraser className="size-4" /></ToolButton>
                                    <div className="flex items-center gap-1 px-1">
                                        {brushColors.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                aria-label={`颜色 ${item}`}
                                                className="size-5 rounded-full border-2 transition"
                                                style={{ background: item, borderColor: brushColor === item ? "currentColor" : "transparent", boxShadow: item === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,.18)" : undefined }}
                                                onClick={() => { setBrushColor(item); setBrushErase(false); }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Brush className="size-3.5 opacity-55" />
                                    <Slider className="m-0 flex-1" min={3} max={80} value={brushSize} onChange={setBrushSize} />
                                    <span className="w-10 text-right text-xs opacity-60">{brushSize}px</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ToolButton title="撤销" disabled={!strokes.length} onClick={undoBrush}><Undo2 className="size-4" /></ToolButton>
                                    <ToolButton title="重做" disabled={!redoStrokes.length} onClick={redoBrush}><Redo2 className="size-4" /></ToolButton>
                                    <ToolButton title="清空" disabled={!strokes.length} onClick={() => { setStrokes([]); setRedoStrokes([]); }}><RotateCcw className="size-4" /></ToolButton>
                                    <span className="ml-auto text-xs opacity-60">{strokes.length} 笔</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="text-sm font-medium opacity-75">编辑意图</div>
                            <Segmented
                                block
                                value={actionHint}
                                onChange={(value) => setActionHint(value as AnnotateEditAction)}
                                options={ANNOTATE_EDIT_ACTIONS.map((action) => ({ label: action.label, value: action.value }))}
                            />
                        </div>

                        {error ? <div className="text-xs font-medium text-destructive">{error}</div> : null}

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
                        <Button
                            icon={<RotateCcw className="size-4" />}
                            onClick={() => {
                                setAnnotations([]);
                                setStrokes([]);
                                setRedoStrokes([]);
                            }}
                        >
                            重置
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button icon={<X className="size-4" />} onClick={requestClose}>
                                取消
                            </Button>
                            <Button type="primary" icon={<WandSparkles className="size-4" />} onClick={() => void submit()}>
                                按标注修改
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function ToolButton({ title, active, disabled, children, onClick }: { title: string; active?: boolean; disabled?: boolean; children: React.ReactNode; onClick: () => void }) {
    return <Tooltip title={title}><button type="button" disabled={disabled} className={`grid size-9 place-items-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-25 ${active ? "bg-black/10 dark:bg-white/15" : "hover:bg-black/5 dark:hover:bg-white/10"}`} onClick={onClick}>{children}</button></Tooltip>;
}

function draftToAnnotation(draft: { shape: AnnotateEditShape; x: number; y: number; width: number; height: number; endX: number; endY: number }): AnnotateEditAnnotation {
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
