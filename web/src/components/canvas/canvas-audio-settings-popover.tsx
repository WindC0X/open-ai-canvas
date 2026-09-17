import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "antd";
import { usePopoverExit } from "./use-popover-exit";
import { useExclusiveSettings } from "./use-exclusive-settings";

import { AudioSettingsPanel } from "@/components/audio-settings-panel";
import { audioFormatLabel, audioSpeedLabel, audioVoiceLabel } from "@/lib/audio-generation";
import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import type { AiConfig } from "@/stores/use-config-store";

export type CanvasAudioSettingKey = "audioVoice" | "audioFormat" | "audioSpeed" | "audioInstructions";

type CanvasAudioSettingsPopoverProps = {
    /** 归属供给标注: 打开的气泡面板纳入 hover 归属域(面板/触发器双标), 指针在面板上时
        composer 归属不判空, 防面板连着 composer 一起退场(2026-09-13 报告 P2-4 根修)。 */
    supplyNodeId?: string;
    config: AiConfig;
    onConfigChange: (key: CanvasAudioSettingKey, value: string) => void;
    buttonClassName?: string;
    placement?: "topLeft" | "top" | "topRight" | "bottomLeft" | "bottom" | "bottomRight";
    /** 图标触发器: 摘要移出按钮(composer 左组布局), aria/title 保留完整摘要。 */
    iconOnly?: boolean;
};

/** 音频参数摘要(纯函数,composer 左组被动文本与触发器共用)。 */
export function audioSettingsSummary(config: AiConfig): string {
    return `${audioVoiceLabel(config.audioVoice)} · ${audioFormatLabel(config.audioFormat)} · ${audioSpeedLabel(config.audioSpeed)}`;
}

export function CanvasAudioSettingsPopover({ supplyNodeId, config, onConfigChange, buttonClassName, placement = "topLeft", iconOnly = false }: CanvasAudioSettingsPopoverProps) {
    const theme = canvasThemes[useActiveTheme()];
    const buttonRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    useExclusiveSettings("audio-settings", open, setOpen, supplyNodeId);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const { shouldRender, closing } = usePopoverExit(open);
    const summary = audioSettingsSummary(config);

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

    const panel = shouldRender && buttonRect ? <AudioSettingsPortal supplyNodeId={supplyNodeId} buttonRect={buttonRect} panelRef={panelRef} placement={placement} theme={theme} config={config} onConfigChange={onConfigChange} closing={closing} /> : null;

    return (
        <>
            <span ref={buttonRef} className="inline-flex min-w-0">
                <Button size="small" type="text" className={`canvas-generation-settings-trigger ${buttonClassName || "!h-8 !max-w-[168px] !justify-start !rounded-full !px-2.5"}`} style={{ color: theme.node.text }} aria-expanded={open} aria-label={`音频设置：${summary}`} title={`音频设置 · ${summary}`} onClick={() => setOpen((current) => !current)}>
                    {iconOnly ? null : (
                        <>
                            <span className="truncate">{summary}</span>
                            <ChevronDown className="canvas-composer-trigger-chevron size-3 shrink-0 opacity-50" aria-hidden="true" />
                        </>
                    )}
                </Button>
            </span>
            {panel}
        </>
    );
}

function AudioSettingsPortal({
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
    placement: CanvasAudioSettingsPopoverProps["placement"];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    config: AiConfig;
    onConfigChange: (key: CanvasAudioSettingKey, value: string) => void;
    closing: boolean;
    supplyNodeId?: string;
}) {
    const width = 320;
    const gap = 4;
    const margin = 12;
    const alignRight = placement?.endsWith("Right");
    const alignCenter = placement === "top" || placement === "bottom";
    const left = alignCenter ? buttonRect.left + buttonRect.width / 2 - width / 2 : alignRight ? buttonRect.right - width : buttonRect.left;
    // 方向纪律:统一向上展开;高度封顶 420px;质感与 image/video 气泡同一收敛。
    const aboveTop = buttonRect.top - gap;
    const preferAbove = aboveTop >= 240;
    const style = {
        position: "fixed",
        // 开合 scale 动画的锚点=触发器方向(canvas-panel-in/out 从 origin 收放)。
        transformOrigin: placement?.endsWith("Right") ? "bottom right" : placement === "top" || placement === "bottom" ? "bottom center" : "bottom left",
        // 微浮方向锚定触发器: 向下展开(top 定位)时锚点在上方, 微浮取负向;
        // transformOrigin 在纯位移动画语法下无作用, 一并退役。
        zIndex: "var(--z-dialog-popover)",
        width,
        left: Math.max(margin, Math.min(window.innerWidth - width - margin, left)),
        ...(preferAbove ? { bottom: window.innerHeight - aboveTop } : { top: buttonRect.bottom + gap }),
        maxHeight: Math.min(420, Math.max(260, preferAbove ? aboveTop : window.innerHeight - buttonRect.bottom - margin * 2)),
        // 方向纪律:统一向上展开;高度封顶 420px;质感与 image/video 气泡同一收敛(theme.canvas.background + 安静化 elevation)。
        padding: 10,
        overflowY: "auto",
        color: theme.node.text,
    } as const;

    return createPortal(
        <div
            ref={panelRef}
            data-supply-node={supplyNodeId}
            data-affordance="full"
            className={`canvas-audio-settings-popover aceternity-floating-panel canvas-settings-scroll${closing ? " canvas-settings-popover-closing" : ""}`}
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            <AudioSettingsPanel config={config} onConfigChange={(key, value) => onConfigChange(key, value)} theme={theme} className="space-y-4" showTitle={false} />
        </div>,
        document.body,
    );
}
