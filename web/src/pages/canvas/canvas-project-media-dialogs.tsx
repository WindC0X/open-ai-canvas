import { CanvasNodeAnnotationDialog } from "@/components/canvas/canvas-node-annotation-dialog";
import { CanvasNodeCropDialog, type CanvasImageCropRect } from "@/components/canvas/canvas-node-crop-dialog";
import { CanvasNodeMaskEditDialog, type CanvasImageMaskEditPayload } from "@/components/canvas/canvas-node-mask-edit-dialog";
import { CanvasNodeOutpaintOverlay, type CanvasImageOutpaintPayload } from "@/components/canvas/canvas-node-outpaint-overlay";
import { CanvasNodeUpscaleDialog, type CanvasImageUpscaleParams } from "@/components/canvas/canvas-node-upscale-dialog";
import type { RefObject } from "react";
import type { CanvasNodeData } from "@/types/canvas";
import type { AiConfig } from "@/stores/use-config-store";

type CanvasProjectMediaDialogsProps = {
    cropNode: CanvasNodeData | null;
    annotationNode: CanvasNodeData | null;
    maskEditNode: CanvasNodeData | null;
    outpaintNode: CanvasNodeData | null;
    upscaleNode: CanvasNodeData | null;
    // 画布容器（position 定位上下文），供扩图覆盖层 rect 实测定位。
    canvasContainerRef: RefObject<HTMLDivElement | null>;
    onCloseCrop: () => void;
    onCloseAnnotation: () => void;
    onCloseMaskEdit: () => void;
    onCloseOutpaint: () => void;
    onOutpaintNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
    // 扩图拖图会话活跃态（svg 强调连线层拖动中隐藏防残影，对齐正常拖拽 isNodeDragging 机制）。
    onOutpaintImageDragChange: (active: boolean) => void;
    onCloseUpscale: () => void;
    onCrop: (node: CanvasNodeData, crop: CanvasImageCropRect) => void;
    onAnnotate: (node: CanvasNodeData, dataUrl: string) => void;
    onMaskEdit: (node: CanvasNodeData, payload: CanvasImageMaskEditPayload) => void;
    onOutpaint: (node: CanvasNodeData, payload: CanvasImageOutpaintPayload) => void;
    onUpscale: (node: CanvasNodeData, params: CanvasImageUpscaleParams) => void;
    config: AiConfig;
};

export function CanvasProjectMediaDialogs({
    cropNode,
    annotationNode,
    maskEditNode,
    outpaintNode,
    canvasContainerRef,
    upscaleNode,
    onCloseCrop,
    onCloseAnnotation,
    onCloseMaskEdit,
    onCloseOutpaint,
    onOutpaintNodeMove,
    onOutpaintImageDragChange,
    onCloseUpscale,
    onCrop,
    onAnnotate,
    onMaskEdit,
    onOutpaint,
    onUpscale,
    config,
}: CanvasProjectMediaDialogsProps) {
    return (
        <>
            {cropNode?.metadata?.content ? <CanvasNodeCropDialog dataUrl={cropNode.metadata.content} open onClose={onCloseCrop} onConfirm={(crop) => onCrop(cropNode, crop)} /> : null}
            {annotationNode?.metadata?.content ? <CanvasNodeAnnotationDialog image={{ url: annotationNode.metadata.content, storageKey: annotationNode.metadata.storageKey }} open onClose={onCloseAnnotation} onConfirm={(dataUrl) => onAnnotate(annotationNode, dataUrl)} /> : null}
            {maskEditNode?.metadata?.content ? <CanvasNodeMaskEditDialog dataUrl={maskEditNode.metadata.content} config={{ ...config, model: maskEditNode.metadata.model || config.model, imageModel: maskEditNode.metadata.model || config.imageModel, size: maskEditNode.metadata.size || config.size, quality: maskEditNode.metadata.quality || config.quality, count: String(maskEditNode.metadata.count || config.count) }} open onClose={onCloseMaskEdit} onConfirm={(payload) => onMaskEdit(maskEditNode, payload)} /> : null}
            {outpaintNode && canvasContainerRef.current ? <CanvasNodeOutpaintOverlay key={outpaintNode.id} node={outpaintNode.metadata?.content ? outpaintNode : null} containerRef={canvasContainerRef} config={config} onClose={onCloseOutpaint} onExecute={onOutpaint} onNodeMove={onOutpaintNodeMove} onImageDragActiveChange={onOutpaintImageDragChange} /> : null}
            {upscaleNode?.metadata?.content ? <CanvasNodeUpscaleDialog dataUrl={upscaleNode.metadata.content} open onClose={onCloseUpscale} onConfirm={(params) => onUpscale(upscaleNode, params)} /> : null}
        </>
    );
}
