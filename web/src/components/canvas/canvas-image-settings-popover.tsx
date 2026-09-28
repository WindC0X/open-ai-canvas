import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Settings2, X } from "lucide-react";
import { Button } from "antd";
import { usePopoverExit } from "./use-popover-exit";
import { useExclusiveSettings } from "./use-exclusive-settings";

import { ImageSettingsPanel, imageQualityLabel, imageSizeLabel, type ImageSettingsAspectBadge, type ImageSettingsEcomPresetSlot, type ImageSettingsQualityTierSlot } from "@/components/image-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { modelCapabilityConfigFor, normalizeImageValue } from "@/lib/model-capabilities";
import { ECOM_CHANNEL_PRESETS, planEcomPresetApplication, type EcomChannelPreset, type EcomPresetPlan } from "@/lib/image-size-presets";
import { configuredModelDisplayName, imagePriceTiersForModel, mergedImageCapabilityConfig } from "@/lib/model-selection";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import { selectableModelsByCapability, type AiConfig } from "@/stores/use-config-store";
import { useCreationPreferencesStore } from "@/stores/use-creation-preferences-store";

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
    /** O-03：从换模型建议切换模型（未传时建议只读展示）。 */
    onSelectModel?: (model: string) => void;
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

export function CanvasImageSettingsPopover({ supplyNodeId, config, onConfigChange, onOpenChange, buttonClassName, placement = "topLeft", iconOnly = false, onSelectModel }: CanvasImageSettingsPopoverProps) {
    const theme = canvasThemes[useActiveTheme()];
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
    // O-03 层1：电商预设态（派生，无独立状态）——当前 size/quality 命中某预设的交集计划值即视为预设态；
    // 取消 = size→auto + quality 回模型默认档（控制线 2026-09-27 批），不恢复历史值。
    const mergedProfile = mergedImageCapabilityConfig(config, config.model || config.imageModel);
    const priceTiers = imagePriceTiersForModel(config, config.model || config.imageModel);
    const presetView = imageSettingsPresetView(config);
    const suggestions = shouldRender && presetView?.plan.status === "short" ? presetModelSuggestions(config, presetView.preset) : undefined;
    const qualityTierValue = useCreationPreferencesStore((state) => state.preferences.image?.qualityTier ?? null);
    const applyPreset = (id: string) => {
        const preset = ECOM_CHANNEL_PRESETS.find((item) => item.id === id);
        if (!preset) return;
        const plan = planEcomPresetApplication({ profile: mergedProfile, preset, priceTiers });
        onConfigChange("size", plan.size);
        if (plan.status !== "unconstrained" && plan.quality) onConfigChange("quality", plan.quality);
    };
    const clearPreset = () => {
        onConfigChange("size", "auto");
        onConfigChange("quality", mergedProfile.quality.supported ? mergedProfile.quality.default || "auto" : "auto");
    };
    const ecomPresetSlot: ImageSettingsEcomPresetSlot = {
        presets: ECOM_CHANNEL_PRESETS,
        activeId: presetView?.preset.id,
        banner: presetView ? presetBannerText(presetView.plan) : undefined,
        suggestions,
        onApply: applyPreset,
        onSelectModel,
    };
    const qualityTierSlot: ImageSettingsQualityTierSlot = {
        value: qualityTierValue,
        onChange: (tier) => useCreationPreferencesStore.getState().rememberImageQualityTier(tier),
    };
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

    const panel = shouldRender && buttonRect ? <ImageSettingsPortal supplyNodeId={supplyNodeId} buttonRect={buttonRect} panelRef={panelRef} placement={placement} theme={theme} config={config} onConfigChange={onConfigChange} closing={closing} ecomPresets={ecomPresetSlot} qualityTierControl={qualityTierSlot} aspectBadges={ECOM_ASPECT_BADGES} /> : null;

    if (!hasSettings) return null;

    return (
        <>
            {hasSettings && (
                <span ref={buttonRef} className="inline-flex min-w-0 items-center">
                    <Button
                        size="small"
                        type="text"
                        className={`canvas-generation-settings-trigger ${buttonClassName || "!h-8 !max-w-[168px] !justify-start !rounded-full !px-2.5"}`}
                        style={{ color: theme.node.text }}
                        aria-expanded={open}
                        aria-label={presetView ? `图像设置：${presetView.preset.aspect} · ${presetView.tierLabel}（${presetView.preset.label}）` : `图像设置：${summary}`}
                        title={presetView ? `图像设置 · ${presetView.preset.label}（${presetView.preset.aspect} · ${presetView.tierLabel}）` : `图像设置 · ${summary}`}
                        onClick={() => updateOpen(!open)}
                    >
                        {iconOnly ? null : (
                        <>
                            {presetView ? (
                                <>
                                    <span className="truncate">{presetView.preset.aspect} · {presetView.tierLabel}</span>
                                    <span className="shrink-0 rounded-[4px] px-1 text-[9px] leading-4 opacity-80" style={{ background: theme.toolbar.itemHover }}>{presetView.preset.shortLabel}</span>
                                </>
                            ) : (
                                <span className="truncate">{summary}</span>
                            )}
                            <ChevronDown className="canvas-composer-trigger-chevron size-3 shrink-0 opacity-50" aria-hidden="true" />
                        </>
                    )}
                    </Button>
                    {presetView ? (
                        <button
                            type="button"
                            aria-label="取消电商预设"
                            title="取消电商预设（回到自动）"
                            className="canvas-composer-preset-clear ml-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                            style={{ outlineColor: theme.node.muted, color: theme.node.text }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                clearPreset();
                            }}
                        >
                            <X className="size-3" aria-hidden="true" />
                        </button>
                    ) : null}
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
    ecomPresets,
    qualityTierControl,
    aspectBadges,
}: {
    buttonRect: DOMRect;
    panelRef: RefObject<HTMLDivElement | null>;
    placement: CanvasImageSettingsPopoverProps["placement"];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    config: AiConfig;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    closing: boolean;
    supplyNodeId?: string;
    ecomPresets: ImageSettingsEcomPresetSlot;
    qualityTierControl: ImageSettingsQualityTierSlot;
    aspectBadges: Record<string, ImageSettingsAspectBadge[]>;
}) {
    const gap = 4;
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
        // 开合 scale 动画的锚点=触发器方向(canvas-panel-in/out 从 origin 收放)。
        transformOrigin: placement?.endsWith("Right") ? "bottom right" : placement === "top" || placement === "bottom" ? "bottom center" : "bottom left",
        // 微浮方向锚定触发器: 向下展开(top 定位)时锚点在上方, 微浮取负向;
        // transformOrigin 在纯位移动画语法下无作用, 一并退役。
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
            <ImageSettingsPanel config={config} onConfigChange={(key, value) => onConfigChange(key, value)} theme={theme} showTitle={false} className="space-y-4" ecomPresets={ecomPresets} qualityTierControl={qualityTierControl} aspectBadges={aspectBadges} />
        </div>,
        document.body,
    );
}

/** O-03 电商预设态视图（派生）：当前 size/quality 命中某预设的 min(预设,能力) 计划值时返回预设态。 */
export type ImageSettingsPresetView = {
    preset: EcomChannelPreset;
    plan: Extract<EcomPresetPlan, { status: "full" | "capped" | "short" }>;
    tierLabel: string;
};

export function imageSettingsPresetView(config: AiConfig): ImageSettingsPresetView | null {
    const profile = mergedImageCapabilityConfig(config, config.model || config.imageModel);
    const priceTiers = imagePriceTiersForModel(config, config.model || config.imageModel);
    const normalized = normalizeImageValue(profile, config);
    for (const preset of ECOM_CHANNEL_PRESETS) {
        const plan = planEcomPresetApplication({ profile, preset, priceTiers });
        if (plan.status === "unconstrained") continue;
        if (plan.size !== normalized.size) continue;
        if (plan.quality && plan.quality.toLowerCase() !== String(normalized.quality).toLowerCase()) continue;
        return { preset, plan, tierLabel: plan.tier.toUpperCase() };
    }
    return null;
}

function presetBannerText(plan: ImageSettingsPresetView["plan"]): string | undefined {
    if (plan.status === "capped") return plan.badge;
    if (plan.status === "short") return plan.gap;
    return undefined;
}

/** 不达标态换模型建议（每条保留最多 3 项）：从可选目录动态查找该比例可达平台下限的模型。 */
function presetModelSuggestions(config: AiConfig, preset: EcomChannelPreset): { id: string; label: string }[] {
    const current = config.model || config.imageModel;
    const catalog = selectableModelsByCapability(config, "image")
        .filter((model) => model !== current)
        .map((model) => ({ id: model, profile: modelCapabilityConfigFor(config, model).image }));
    const plan = planEcomPresetApplication({ profile: mergedImageCapabilityConfig(config, current), preset, priceTiers: imagePriceTiersForModel(config, current), catalog });
    if (plan.status !== "short") return [];
    return plan.suggestModelIds.slice(0, 3).map((id) => ({ id, label: configuredModelDisplayName(config, id) }));
}

const ECOM_ASPECT_BADGES: Record<string, ImageSettingsAspectBadge[]> = ECOM_CHANNEL_PRESETS.reduce<Record<string, ImageSettingsAspectBadge[]>>((acc, preset) => {
    acc[preset.aspect] = [...(acc[preset.aspect] || []), { label: preset.label, pixelRequirement: `${preset.minPixels.width}×${preset.minPixels.height}` }];
    return acc;
}, {});
