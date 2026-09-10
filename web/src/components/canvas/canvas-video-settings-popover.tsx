import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button } from "antd";
import { usePopoverExit } from "./use-popover-exit";
import { useExclusiveSettings } from "./use-exclusive-settings";

import { VideoSettingsPanel, videoResolutionLabel, videoSecondsLabel, videoSizeLabel } from "@/components/video-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { modelCapabilityConfigFor, resolveVideoRatioValue, resolveVideoResolutionValue, type VideoCapabilityConfig } from "@/lib/model-capabilities";
import { useThemeStore } from "@/stores/use-theme-store";
import type { AiConfig } from "@/stores/use-config-store";

type CanvasVideoSettingsPopoverProps = {
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    buttonClassName?: string;
    placement?: "topLeft" | "top" | "topRight" | "bottomLeft" | "bottom" | "bottomRight";
    /** 图标触发器: 摘要移出按钮(composer 左组布局), aria/title 保留完整摘要。 */
    iconOnly?: boolean;
};

/** 视频参数摘要(纯函数,composer 左组被动文本与触发器共用)。 */
export function videoSettingsSummary(config: AiConfig): string {
    const videoProfile: VideoCapabilityConfig | undefined = modelCapabilityConfigFor(config, config.model).video;
    const resolutionSupported = Boolean(videoProfile?.resolutions.length);
    const sizeSupported = Boolean(videoProfile?.ratios.length);
    const resolution = videoProfile ? resolveVideoResolutionValue(videoProfile, config.vquality) : "";
    const size = videoProfile ? resolveVideoRatioValue(videoProfile, config.size) : "";
    return [
        ...(resolutionSupported ? [videoResolutionLabel(resolution)] : []),
        ...(sizeSupported ? [videoSizeLabel(size)] : []),
        videoSecondsLabel(config.videoSeconds),
    ].join(" · ");
}

export function CanvasVideoSettingsPopover({ config, onConfigChange, buttonClassName, placement = "topLeft", iconOnly = false }: CanvasVideoSettingsPopoverProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    useExclusiveSettings("video-settings", open, setOpen);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const { shouldRender, closing } = usePopoverExit(open);
    const videoProfile = modelCapabilityConfigFor(config, config.model).video;
    const summary = videoSettingsSummary(config);

    useEffect(() => {
        if (!shouldRender) return;
        const syncPosition = () => setButtonRect(buttonRef.current?.getBoundingClientRect() || null);
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            setOpen(false);
        };

        syncPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        // 画布 wheel 缩放/平移使触发器位移, fixed 浮层不跟随 —— 手势打断直接关(修漂移)。
        const closeOnCanvasWheel = (event: WheelEvent) => {
            if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
            setOpen(false);
        };
        window.addEventListener("wheel", closeOnCanvasWheel, { capture: true, passive: true });
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
            window.removeEventListener("wheel", closeOnCanvasWheel, { capture: true });
        };
    }, [shouldRender]);

    const panel = shouldRender && buttonRect ? <VideoSettingsPortal buttonRect={buttonRect} panelRef={panelRef} placement={placement} theme={theme} config={config} onConfigChange={onConfigChange} closing={closing} /> : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0">
                <Button size="small" type="text" className={`canvas-generation-settings-trigger ${buttonClassName || "!h-8 !max-w-[168px] !justify-start !rounded-full !px-2.5"}`} style={{ background: theme.node.fill, color: theme.node.text }} icon={<Settings2 className="size-3.5" />} aria-expanded={open} aria-label={`视频设置：${summary}`} title={`视频设置 · ${summary}`} onClick={() => setOpen((current) => !current)}>
                    {iconOnly ? null : <span className="truncate">{summary}</span>}
                </Button>
            </span>
            {panel}
        </>
    );
}

function VideoSettingsPortal({
    buttonRect,
    panelRef,
    placement,
    theme,
    config,
    onConfigChange,
    closing,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasVideoSettingsPopoverProps["placement"];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    closing: boolean;
}) {
    const gap = 8;
    const margin = 12;
    const width = Math.min(320, window.innerWidth - margin * 2);
    const alignRight = placement?.endsWith("Right");
    const alignCenter = placement === "top" || placement === "bottom";
    const left = alignCenter ? buttonRect.left + buttonRect.width / 2 - width / 2 : alignRight ? buttonRect.right - width : buttonRect.left;
    // 方向纪律:统一向上展开;高度封顶 420px 内部滚动;上方空间不足时降级向下。
    const aboveTop = buttonRect.top - gap;
    const preferAbove = aboveTop >= 240;
    const style = {
        position: "fixed",
        // 开合锚触发器(emil): 从触发器方向缩放, 而非恒 bottom center。
        transformOrigin: placement?.endsWith("Right") ? "bottom right" : placement === "top" || placement === "bottom" ? "bottom center" : "bottom left",
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
            className={`canvas-video-settings-popover aceternity-floating-panel canvas-settings-scroll${closing ? " canvas-settings-popover-closing" : ""}`}
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <VideoSettingsPanel config={config} onConfigChange={(key, value) => onConfigChange(key, value)} theme={theme} showTitle={false} className="space-y-4" />
        </div>,
        document.body,
    );
}
