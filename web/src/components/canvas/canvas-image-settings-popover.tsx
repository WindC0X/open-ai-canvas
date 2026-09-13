import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Settings2 } from "lucide-react";
import { Button } from "antd";
import { usePopoverExit } from "./use-popover-exit";
import { useExclusiveSettings } from "./use-exclusive-settings";

import { ImageSettingsPanel, imageQualityLabel, imageSizeLabel } from "@/components/image-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { modelCapabilityConfigFor, normalizeImageValue } from "@/lib/model-capabilities";
import { useThemeStore } from "@/stores/use-theme-store";
import type { AiConfig } from "@/stores/use-config-store";

type CanvasImageSettingsPopoverProps = {
    /** 归属供给标注: 打开的气泡面板纳入 hover 归属域(面板/触发器双标), 指针在面板上时
        composer 归属不判空, 防面板连着 composer 一起退场(2026-09-13 报告 P2-4 根修)。 */
    supplyNodeId?: string;
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    onMissingConfig?: () => void;
    onOpenChange?: (open: boolean) => void;
    buttonClassName?: string;
    getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
    placement?: "topLeft" | "top" | "topRight" | "bottomLeft" | "bottom" | "bottomRight";
    autoAdjustOverflow?: boolean;
    /** 图标触发器: 摘要移出按钮(composer 左组布局), aria/title 保留完整摘要。 */
    iconOnly?: boolean;
};

/** 图像参数摘要(纯函数,composer 左组被动文本与触发器共用,与 ImageSettingsPanel 口径同源)。 */
export function imageSettingsSummary(config: AiConfig): string {
    const profile = modelCapabilityConfigFor(config, config.model || config.imageModel).image!;
    const normalized = normalizeImageValue(profile, config);
    return [
        ...(profile.size.parameter !== "none" ? [imageSizeLabel(normalized.size)] : []),
        ...(profile.quality.supported ? [imageQualityLabel(normalized.quality)] : []),
        ...(profile.transparentBackground.supported && normalized.transparentBackground === "true" ? ["透明"] : []),
    ].join(" · ");
}

export function CanvasImageSettingsPopover({ supplyNodeId, config, onConfigChange, onOpenChange, buttonClassName, placement = "topLeft", iconOnly = false }: CanvasImageSettingsPopoverProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    // 互斥广播关闭必须同步外部镜像(project.tsx 的 nodeImageSettingsOpen gate 节点工具栏),
    // 走裸 setOpen 会绕过 updateOpen 的 onOpenChange, 镜像残留 true 会让节点工具栏被隐藏。
    useExclusiveSettings("image-settings", open, (next) => {
        if (next) {
            setOpen(true);
            return;
        }
        updateOpen(false);
    }, supplyNodeId);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const { shouldRender, closing } = usePopoverExit(open);
    const profile = modelCapabilityConfigFor(config, config.model || config.imageModel).image!;
    const normalized = normalizeImageValue(profile, config);
    const summary = imageSettingsSummary(config);
    const hasSettings = profile.size.parameter !== "none" || profile.quality.supported || profile.transparentBackground.supported;
    const updateOpen = (nextOpen: boolean) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
    };

    useEffect(() => {
        if (!shouldRender) return;
        const syncPosition = () => setButtonRect(buttonRef.current?.getBoundingClientRect() || null);
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            if (document.activeElement instanceof HTMLElement && panelRef.current?.contains(document.activeElement)) document.activeElement.blur();
            setOpen(false);
            onOpenChange?.(false);
        };

        syncPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        // 画布 wheel 缩放/平移使触发器位移, fixed 浮层不跟随 —— 手势打断直接关(修漂移)。
        const closeOnCanvasWheel = (event: WheelEvent) => {
            if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
            setOpen(false);
            // wheel 关闭同样要同步 project.tsx 的 nodeImageSettingsOpen, 否则节点工具栏被残留的 open 状态永久隐藏。
            onOpenChange?.(false);
        };
        window.addEventListener("wheel", closeOnCanvasWheel, { capture: true, passive: true });
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
            window.removeEventListener("wheel", closeOnCanvasWheel, { capture: true });
        };
    }, [onOpenChange, shouldRender]);

    const panel = shouldRender && buttonRect ? <ImageSettingsPortal supplyNodeId={supplyNodeId} buttonRect={buttonRect} panelRef={panelRef} placement={placement} theme={theme} config={config} onConfigChange={onConfigChange} closing={closing} /> : null;

    if (!hasSettings) return null;

    return (
        <>
            {hasSettings && (
                <span ref={buttonRef} className="inline-flex min-w-0">
                    <Button size="small" type="text" className={`canvas-generation-settings-trigger ${buttonClassName || "!h-8 !max-w-[168px] !justify-start !rounded-full !px-2.5"}`} style={{ color: theme.node.text }} aria-expanded={open} aria-label={`图像设置：${summary}`} title={`图像设置 · ${summary}`} onClick={() => updateOpen(!open)}>
                        {iconOnly ? null : (
                        <>
                            <span className="truncate">{summary}</span>
                            <ChevronDown className="canvas-composer-trigger-chevron size-3 shrink-0 opacity-50" aria-hidden="true" />
                        </>
                    )}
                    </Button>
                </span>
            )}
            {panel}
        </>
    );
}

function ImageSettingsPortal({
    buttonRect,
    panelRef,
    placement,
    theme,
    config,
    onConfigChange,
    closing,
    supplyNodeId,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasImageSettingsPopoverProps["placement"];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    closing: boolean;
    supplyNodeId?: string;
}) {
    const gap = 8;
    const margin = 12;
    const width = Math.min(320, window.innerWidth - margin * 2);
    const alignRight = placement?.endsWith("Right");
    const alignCenter = placement === "top" || placement === "bottom";
    const left = alignCenter ? buttonRect.left + buttonRect.width / 2 - width / 2 : alignRight ? buttonRect.right - width : buttonRect.left;
    // 方向纪律:统一向上展开(与图像节点 composer 行为一致);高度封顶 420px,长列表内部滚动;上方空间不足时降级向下。
    const aboveTop = buttonRect.top - gap;
    const preferAbove = aboveTop >= 240;
    const style = {
        position: "fixed",
        // 微浮方向锚定触发器: 向下展开(top 定位)时锚点在上方, 微浮取负向;
        // transformOrigin 在纯位移动画语法下无作用, 一并退役。
        "--panel-float-y": preferAbove ? "6px" : "-6px",
        zIndex: "var(--z-dialog-popover)",
        width,
        left: Math.max(margin, Math.min(window.innerWidth - width - margin, left)),
        ...(preferAbove ? { bottom: window.innerHeight - aboveTop } : { top: buttonRect.bottom + gap }),
        maxHeight: Math.min(560, Math.max(260, preferAbove ? aboveTop : window.innerHeight - buttonRect.bottom - margin * 2)),
        padding: 10,
        overflowY: "auto",
        color: theme.node.text,
    } as const;

    return createPortal(
        <div
            ref={panelRef}
            data-supply-node={supplyNodeId}
            data-affordance="full"
            className={`canvas-image-settings-popover aceternity-floating-panel canvas-settings-scroll${closing ? " canvas-settings-popover-closing" : ""}`}
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <ImageSettingsPanel config={config} onConfigChange={(key, value) => onConfigChange(key, value)} theme={theme} showTitle={false} className="space-y-4" />
        </div>,
        document.body,
    );
}
