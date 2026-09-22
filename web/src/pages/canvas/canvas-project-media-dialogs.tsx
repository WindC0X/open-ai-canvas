import { CanvasNodeAnnotationDialog, type CanvasImageAnnotationPayload } from "@/components/canvas/canvas-node-annotation-dialog";
import { CanvasNodeCropDialog, type CanvasImageCropRect } from "@/components/canvas/canvas-node-crop-dialog";
import { CanvasNodeMaskEditDialog, type CanvasImageMaskEditPayload } from "@/components/canvas/canvas-node-mask-edit-dialog";
import { CanvasNodeOutpaintOverlay, type CanvasImageOutpaintPayload } from "@/components/canvas/canvas-node-outpaint-overlay";
import { CanvasNodeUpscaleDialog, type CanvasImageUpscaleParams } from "@/components/canvas/canvas-node-upscale-dialog";
import { CanvasNodeImageEditDialog, type CanvasImageEditPayload } from "@/components/canvas/canvas-node-image-edit-dialog";
import { CanvasNodeLayerDecompositionDialog, type CanvasImageLayerDecompositionPayload } from "@/components/canvas/canvas-node-layer-decomposition-dialog";
import { CanvasNodeTextEditDialog, type CanvasImageTextEditPayload } from "@/components/canvas/canvas-node-text-edit-dialog";
import type { RefObject } from "react";
import type { CanvasNodeData } from "@/types/canvas";
import type { AiConfig } from "@/stores/use-config-store";

type CanvasProjectMediaDialogsProps = {
    cropNode: CanvasNodeData | null;
    annotationNode: CanvasNodeData | null;
    annotationEditNode: CanvasNodeData | null;
    maskEditNode: CanvasNodeData | null;
    imageEditNode: CanvasNodeData | null;
    layerDecompositionNode: CanvasNodeData | null;
    textEditNode: CanvasNodeData | null;
    imageEditPreset?: "remove-background" | null;
    outpaintNode: CanvasNodeData | null;
    upscaleNode: CanvasNodeData | null;
    // 画布容器（position 定位上下文），供扩图覆盖层 rect 实测定位。
    canvasContainerRef: RefObject<HTMLDivElement | null>;
    onCloseCrop: () => void;
    onCloseAnnotation: () => void;
    onCloseAnnotationEdit: () => void;
    onCloseMaskEdit: () => void;
    onCloseOutpaint: () => void;
    onOutpaintNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
    // 扩图拖图会话活跃态（svg 强调连线层拖动中隐藏防残影，对齐正常拖拽 isNodeDragging 机制）。
    onOutpaintImageDragChange: (active: boolean) => void;
    onCloseUpscale: () => void;
    onCloseImageEdit: () => void;
    onCloseLayerDecomposition: () => void;
    onCloseTextEdit: () => void;
    onCrop: (node: CanvasNodeData, crop: CanvasImageCropRect) => void;
    onAnnotate: (node: CanvasNodeData, dataUrl: string) => void;
    onAnnotationEdit: (node: CanvasNodeData, payload: CanvasImageAnnotationPayload) => void;
    onMaskEdit: (node: CanvasNodeData, payload: CanvasImageMaskEditPayload) => void;
    onOutpaint: (node: CanvasNodeData, payload: CanvasImageOutpaintPayload) => void;
    onUpscale: (node: CanvasNodeData, params: CanvasImageUpscaleParams) => void;
    onImageOperation: (node: CanvasNodeData, payload: CanvasImageEditPayload) => void;
    onLayerDecomposition: (node: CanvasNodeData, payload: CanvasImageLayerDecompositionPayload) => void;
    onDetectText: () => Promise<import("@/components/canvas/canvas-node-text-edit-dialog").CanvasImageTextLine[]>;
    onTextEdit: (node: CanvasNodeData, payload: CanvasImageTextEditPayload) => void;
    config: AiConfig;
};

export function CanvasProjectMediaDialogs({
    cropNode,
    annotationNode,
    annotationEditNode,
    maskEditNode,
    imageEditNode,
    layerDecompositionNode,
    textEditNode,
    imageEditPreset,
    outpaintNode,
    canvasContainerRef,
    upscaleNode,
    onCloseCrop,
    onCloseAnnotation,
    onCloseAnnotationEdit,
    onCloseMaskEdit,
    onCloseOutpaint,
    onOutpaintNodeMove,
    onOutpaintImageDragChange,
    onCloseUpscale,
    onCloseImageEdit,
    onCloseLayerDecomposition,
    onCloseTextEdit,
    onCrop,
    onAnnotate,
    onAnnotationEdit,
    onMaskEdit,
    onOutpaint,
    onUpscale,
    onImageOperation,
    onLayerDecomposition,
    onDetectText,
    onTextEdit,
    config,
}: CanvasProjectMediaDialogsProps) {
    return (
        <>
            {cropNode?.metadata?.content ? <CanvasNodeCropDialog dataUrl={cropNode.metadata.content} open onClose={onCloseCrop} onConfirm={(crop) => onCrop(cropNode, crop)} /> : null}
            {annotationNode?.metadata?.content ? <CanvasNodeAnnotationDialog image={{ url: annotationNode.metadata.content, storageKey: annotationNode.metadata.storageKey }} open onClose={onCloseAnnotation} onConfirm={(dataUrl) => { if (typeof dataUrl === "string") onAnnotate(annotationNode, dataUrl); }} /> : null}
            {annotationEditNode?.metadata?.content ? <CanvasNodeAnnotationDialog image={{ url: annotationEditNode.metadata.content, storageKey: annotationEditNode.metadata.storageKey }} editMode open onClose={onCloseAnnotationEdit} onConfirm={(payload) => { if (typeof payload !== "string") onAnnotationEdit(annotationEditNode, payload); }} /> : null}
            {maskEditNode?.metadata?.content ? <CanvasNodeMaskEditDialog dataUrl={maskEditNode.metadata.content} config={{ ...config, model: maskEditNode.metadata.model || config.model, imageModel: maskEditNode.metadata.model || config.imageModel, size: maskEditNode.metadata.size || config.size, quality: maskEditNode.metadata.quality || config.quality, count: String(maskEditNode.metadata.count || config.count) }} open onClose={onCloseMaskEdit} onConfirm={(payload) => onMaskEdit(maskEditNode, payload)} /> : null}
            {outpaintNode && canvasContainerRef.current ? <CanvasNodeOutpaintOverlay key={outpaintNode.id} node={outpaintNode.metadata?.content ? outpaintNode : null} containerRef={canvasContainerRef} config={config} onClose={onCloseOutpaint} onExecute={onOutpaint} onNodeMove={onOutpaintNodeMove} onImageDragActiveChange={onOutpaintImageDragChange} /> : null}
            {upscaleNode?.metadata?.content ? <CanvasNodeUpscaleDialog dataUrl={upscaleNode.metadata.content} open onClose={onCloseUpscale} onConfirm={(params) => onUpscale(upscaleNode, params)} /> : null}
            {imageEditNode?.metadata?.content ? <CanvasNodeImageEditDialog dataUrl={imageEditNode.metadata.content} preset={imageEditPreset} config={{ ...config, model: imageEditNode.metadata.model || config.model, imageModel: imageEditNode.metadata.model || config.imageModel, size: imageEditNode.metadata.size || config.size, quality: imageEditNode.metadata.quality || config.quality }} open onClose={onCloseImageEdit} onConfirm={(payload) => onImageOperation(imageEditNode, payload)} /> : null}
            {layerDecompositionNode?.metadata?.content ? <CanvasNodeLayerDecompositionDialog dataUrl={layerDecompositionNode.metadata.content} config={{ ...config, model: layerDecompositionNode.metadata.model || config.model, imageModel: layerDecompositionNode.metadata.model || config.imageModel, size: layerDecompositionNode.metadata.size || config.size, quality: layerDecompositionNode.metadata.quality || config.quality }} open onClose={onCloseLayerDecomposition} onConfirm={(payload) => onLayerDecomposition(layerDecompositionNode, payload)} /> : null}
            {textEditNode?.metadata?.content ? <CanvasNodeTextEditDialog dataUrl={textEditNode.metadata.content} open onClose={onCloseTextEdit} onDetect={onDetectText} onConfirm={(payload) => onTextEdit(textEditNode, payload)} /> : null}
        </>
    );
}
