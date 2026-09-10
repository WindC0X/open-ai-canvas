import { type ReactNode, useState } from "react";
import { ConfigProvider } from "antd";
import { Switch } from "@/components/ui/base/switch";

import { type CanvasTheme } from "@/lib/canvas-theme";
import { buildImageResolutionOptions, formatImageResolutionSize, imageRatioForSize, imageResolutionChoices, imageResolutionOption, imageSizeForResolution, supportsImageResolutionPresets, type ImageResolutionChoice } from "@/lib/image-resolution-tiers";
import { imageResolutionUsesQuality } from "@/lib/image-size-presets";
import { modelCapabilityConfigFor, normalizeImageValue, type ImageCapabilityConfig } from "@/lib/model-capabilities";
import { mergedImageCapabilityConfig } from "@/lib/model-selection";
import { modelOptionName, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";

const qualityOptions = [
    { value: "auto", label: "自动" },
    { value: "high", label: "高" },
    { value: "medium", label: "中" },
    { value: "low", label: "低" },
    { value: "1k", label: "1K" },
    { value: "2k", label: "2K" },
    { value: "4k", label: "4K" },
];

const DIMENSION_STEP = 16;

type AspectOption = { value: string; label: string; width: number; height: number; icon: string; size?: string };

const aspectOptions: AspectOption[] = [
    { value: "1:1", label: "1:1", width: 1024, height: 1024, icon: "square" },
    { value: "3:2", label: "3:2", width: 1536, height: 1024, icon: "landscape" },
    { value: "2:3", label: "2:3", width: 1024, height: 1536, icon: "portrait" },
    { value: "4:3", label: "4:3", width: 1360, height: 1024, icon: "landscape" },
    { value: "3:4", label: "3:4", width: 1024, height: 1360, icon: "portrait" },
    { value: "16:9", label: "16:9", width: 1824, height: 1024, icon: "landscape" },
    { value: "2:1", label: "2:1", size: "2048x1024", width: 2048, height: 1024, icon: "landscape" },
    { value: "1:2", label: "1:2", size: "1024x2048", width: 1024, height: 2048, icon: "portrait" },
    { value: "21:9", label: "21:9", size: "2352x1008", width: 2352, height: 1008, icon: "landscape" },
    { value: "9:16", label: "9:16", width: 1024, height: 1824, icon: "portrait" },
    { value: "1:1-2k", label: "1:1(2k)", size: "2048x2048", width: 2048, height: 2048, icon: "square" },
    { value: "16:9-2k", label: "16:9(2k)", size: "2048x1152", width: 2048, height: 1152, icon: "landscape" },
    { value: "9:16-2k", label: "9:16(2k)", size: "1152x2048", width: 1152, height: 2048, icon: "portrait" },
    { value: "16:9-4k", label: "16:9(4k)", size: "3840x2160", width: 3840, height: 2160, icon: "landscape" },
    { value: "9:16-4k", label: "9:16(4k)", size: "2160x3840", width: 2160, height: 3840, icon: "portrait" },
    { value: "auto", label: "auto", width: 0, height: 0, icon: "auto" },
];

type ImageSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "quality" | "size" | "transparentBackground", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    showQuality?: boolean;
    showTransparent?: boolean;
    showSize?: boolean;
    showCount?: boolean;
    className?: string;
    maxCount?: number;
    quickCount?: number;
    /** 局部编辑等场景需要先允许选择参数，由后端负责最终计费校验。 */
    bypassPriceGuard?: boolean;
};

export function ImageSettingsPanel({ config, onConfigChange, theme, showTitle = true, showQuality = true, showTransparent = true, showSize = true, showCount = true, className = "w-[304px] space-y-3 rounded-2xl px-1 py-0.5", maxCount = 15, quickCount = 3, bypassPriceGuard = false }: ImageSettingsPanelProps) {
    const [snapDimensionToStep, setSnapDimensionToStep] = useState(true);
    const profile = mergedImageCapabilityConfig(config, config.model || config.imageModel);
    const normalized = normalizeImageValue(profile, config);
    const quality = normalized.quality;
    const transparentBackground = normalized.transparentBackground === "true";
    const activeSize = normalized.size;
    const pixelSizeValues = profile.size.values.filter((value) => value.trim().toLowerCase() !== "auto");
    const hasResolutionPresets = supportsImageResolutionPresets(profile.size);
    const resolutionOptions = hasResolutionPresets ? buildImageResolutionOptions(pixelSizeValues) : [];
    // 自定义尺寸行常驻在比例网格下方(与 W/H 输入并列), 16 倍对齐就地开关。
    const activeResolution = activeSize === "auto" ? undefined : imageResolutionOption(resolutionOptions, activeSize);
    const activeRatio = activeResolution?.ratio || imageRatioForSize(activeSize);
    const resolutionChoices = hasResolutionPresets ? imageResolutionChoices(profile.size.values) : [];
    // 只有一个分辨率层级时，分辨率切换器没有实际选择意义；更重要的是不能因此把比例列表裁剪成当前层级的 3 个像素尺寸。
    // 例如历史 `*` 配置恢复为标准值后，虽然包含 1024x1024/1536x1024/1024x1536，实际仍应展示完整的比例和尺寸选项。
    const usesResolutionPicker = resolutionChoices.length > 1;
    const availableAspects: AspectOption[] = usesResolutionPicker && activeSize === "auto"
        ? []
        : usesResolutionPicker && activeResolution
        ? resolutionOptions.filter((item) => item.tier === activeResolution.tier).map((item) => ({ value: item.ratio, label: item.ratio, size: item.size, width: item.width, height: item.height, icon: item.width === item.height ? "square" : item.width > item.height ? "landscape" : "portrait" }))
        : imageAspectOptions(profile);
    const selectedAspect = availableAspects.find((item) => imageOptionValue(profile, item) === activeSize || item.value === activeSize) || availableAspects.find((item) => item.label === activeRatio);
    const isCustomSize = profile.size.allowCustom && activeSize !== "auto" && !selectedAspect;
    const dimensions = readSizeDimensions(activeSize, selectedAspect || aspectOptions[0]);
	const activeQualityOptions = profile.quality.values.map((value) => qualityOptions.find((item) => item.value === value) || { value, label: value });
	const priceTiers = imageModelPriceTiers(config);
    const selectAspect = (value: string) => {
        const option = availableAspects.find((item) => item.value === value);
        onConfigChange("size", option ? imageOptionValue(profile, option) : "auto");
    };
    const selectResolution = (choice: ImageResolutionChoice) => {
        if (choice === "auto") {
            onConfigChange("size", "auto");
            return;
        }
        const ratio = activeRatio || availableAspects[0]?.label;
        const size = imageSizeForResolution(resolutionOptions, choice, ratio) || resolutionOptions.find((item) => item.tier === choice)?.size;
        if (size) onConfigChange("size", size);
    };
    const updateDimension = (key: "width" | "height" | null, value: number | null) => {
        if (key === null) {
            // "自定义"按钮: 以当前 W/H 应用自定义尺寸。
            onConfigChange("size", `${alignDimension(dimensions.width, snapDimensionToStep)}x${alignDimension(dimensions.height, snapDimensionToStep)}`);
            return;
        }
        const next = Math.max(1, Math.floor(value || dimensions[key] || 1024));
        const width = key === "width" ? next : dimensions.width;
        const height = key === "height" ? next : dimensions.height;
        onConfigChange("size", `${alignDimension(width, snapDimensionToStep)}x${alignDimension(height, snapDimensionToStep)}`);
    };

    return (
        <ImageSettingsTheme theme={theme}>
            <div
                className={className}
                style={{ color: theme.node.text }}
                onMouseDown={(event) => {
                    event.stopPropagation();
                    if (event.target instanceof HTMLInputElement) return;
                    if (document.activeElement instanceof HTMLInputElement && event.currentTarget.contains(document.activeElement)) document.activeElement.blur();
                }}
            >
                {showTitle ? <div className="text-base font-semibold">图像设置</div> : null}
                {availableAspects.length ? <div className="space-y-2">
                    <SettingTitle color={theme.node.groupTitle}>比例</SettingTitle>
                    <div className="grid grid-cols-5 gap-1">
                        {!usesResolutionPicker ? (
                            <button
                                type="button"
                                aria-pressed={activeSize === "auto"}
                                className="canvas-settings-option flex h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[var(--fs-label)] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                                style={{ outlineColor: theme.node.muted, fontSize: "var(--fs-label)" }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("size", "auto")}
                            >
                                <span className="whitespace-nowrap">自适应</span>
                            </button>
                        ) : null}
                        {availableAspects.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                aria-pressed={selectedAspect?.value === item.value}
                                className="canvas-settings-option flex h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[var(--fs-label)] leading-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                                style={{ outlineColor: theme.node.muted, fontSize: "var(--fs-label)" }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => selectAspect(item.value)}
                            >
                                <AspectIcon type={item.icon} width={item.width} height={item.height} color="currentColor" />
                                <span className="whitespace-nowrap">{item.label}</span>
                            </button>
                        ))}
                    </div>
                    {/* 自定义与长宽定义并列一行(用户拍板): 点击"自定义"应用当前 W/H; 编辑输入即切自定义; 16 倍对齐就地开关。 */}
                    {profile.size.allowCustom ? <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1">
                        <button
                            type="button"
                            aria-pressed={isCustomSize}
                            className="canvas-settings-option h-8 cursor-pointer whitespace-nowrap rounded-lg px-2 text-[11px] leading-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                            style={{ outlineColor: theme.node.muted, fontSize: "11px" }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => updateDimension(null, null)}
                        >
                            自定义
                        </button>
                        <DimensionInput prefix="W" value={dimensions.width} disabled={activeSize === "auto"} theme={theme} alignToStep={snapDimensionToStep} onChange={(value) => updateDimension("width", value)} />
                        <span className="text-[10px] opacity-45">×</span>
                        <DimensionInput prefix="H" value={dimensions.height} disabled={activeSize === "auto"} theme={theme} alignToStep={snapDimensionToStep} onChange={(value) => updateDimension("height", value)} />
                        <span title="输入完成后自动向上补成 16 的倍数" className="flex shrink-0 items-center" onMouseDown={(event) => event.stopPropagation()}>
                            <Switch size="sm" checked={snapDimensionToStep} onChange={setSnapDimensionToStep} />
                        </span>
                    </div> : null}
                </div> : null}
                {resolutionChoices.length ? <div className="space-y-2">
                    <SettingTitle color={theme.node.groupTitle}>分辨率</SettingTitle>
                    <div className={`grid gap-1.5 ${resolutionChoices.length <= 2 ? "grid-cols-2" : resolutionChoices.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                        {resolutionChoices.map((choice) => (
                            <OptionPill key={choice} selected={choice === "auto" ? activeSize === "auto" : activeResolution?.tier === choice} theme={theme} onClick={() => selectResolution(choice)}>
                                {choice === "auto" ? "自动" : choice.toUpperCase()}
                            </OptionPill>
                        ))}
                    </div>
                </div> : null}
                {showQuality && profile.quality.supported && !imageResolutionUsesQuality(profile) ? <div className="space-y-2">
                    <SettingTitle color={theme.node.groupTitle}>{isGrokResolutionQuality(profile) ? "分辨率" : "质量"}</SettingTitle>
                    <div className={`grid gap-1.5 ${activeQualityOptions.length <= 2 ? "grid-cols-2" : "grid-cols-4"}`}>
						{activeQualityOptions.map((item) => (
                            <OptionPill key={item.value} selected={quality === item.value} disabled={!bypassPriceGuard && !hasPriceTierForImageSelection(priceTiers, item.value, activeSize)} theme={theme} onClick={() => onConfigChange("quality", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </div> : null}
                {showTransparent && profile.transparentBackground.supported ? <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <SettingTitle color={theme.node.groupTitle}>透明背景</SettingTitle>
                    </div>
                    <span title="是否支持透明背景由当前模型接口决定" onMouseDown={(event) => event.stopPropagation()}>
                        <Switch
                            size="sm"
                            checked={transparentBackground}
                            onChange={(checked) => onConfigChange("transparentBackground", checked ? "true" : "false")}
                        />
                    </span>
                </div> : null}
            </div>
        </ImageSettingsTheme>
    );
}

export function applyImageSizeSelection(onConfigChange: ImageSettingsPanelProps["onConfigChange"], size: string, quality?: string) {
    onConfigChange("size", size);
    if (quality) onConfigChange("quality", quality);
}

export function ImageSettingsTheme({ theme, children }: { theme: CanvasTheme; children: ReactNode }) {
    return (
        <ConfigProvider
            theme={{
                token: { colorBgContainer: theme.canvas.background, colorBgElevated: theme.canvas.background, colorBorder: theme.node.stroke, colorPrimary: theme.node.activeStroke, colorText: theme.node.text, colorTextLightSolid: theme.node.panel },
                components: { Button: { defaultBg: theme.canvas.background, defaultBorderColor: theme.node.stroke, defaultColor: theme.node.text } },
            }}
        >
            {children}
        </ConfigProvider>
    );
}

export function imageQualityLabel(value: string) {
    return ({ auto: "自动", high: "高", medium: "中", low: "低", "1k": "1K", "2k": "2K", "4k": "4K" } as Record<string, string>)[value.toLowerCase()] || value || "默认";
}

function isGrokResolutionQuality(profile: ImageCapabilityConfig) {
    const values = profile.quality.values.map((item) => item.toLowerCase());
    return values.some((value) => ["1k", "2k", "4k"].includes(value));
}

export function imageSizeLabel(size: string) {
    const resolutionLabel = formatImageResolutionSize(size, buildImageResolutionOptions([size]));
    return resolutionLabel !== size ? resolutionLabel : aspectOptions.find((item) => (item.size || item.value) === size || item.value === size)?.label || size;
}

function imageModelPriceTiers(config: AiConfig) {
	const channel = resolveModelChannel(config, config.model || config.imageModel);
	const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(config.model || config.imageModel));
	return cost?.logicalPriceTiers || [];
}

function hasPriceTierForImageSelection(tiers: ReturnType<typeof imageModelPriceTiers>, quality: string, size: string) {
	if (!tiers.length) return true;
	return tiers.some((tier) => {
		const selector = tier.selector || {};
		return (!selector.quality || selector.quality === "*" || selector.quality === quality.toLowerCase()) && (!selector.size || selector.size === "*" || selector.size === size.toLowerCase());
	});
}

/** 共享分段 pill(参数面板统一控件, audio/video 面板同源消费)。
 * 命中区 32px(用户实测 40px 过大, 对齐模型菜单行密度; 双行卡 44px); 禁用态透明度由 globals .canvas-settings-option:disabled 0.45 接管。 */
export function OptionPill({ selected, disabled = false, theme, onClick, children }: { selected: boolean; disabled?: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
			className="canvas-settings-option h-8 cursor-pointer whitespace-nowrap rounded-lg px-2 text-[11px] leading-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 disabled:cursor-not-allowed"
			style={{ outlineColor: theme.node.muted, fontSize: "11px" }}
			disabled={disabled}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function DimensionInput({ prefix, value, disabled, theme, alignToStep, onChange }: { prefix: string; value: number; disabled: boolean; theme: CanvasTheme; alignToStep: boolean; onChange: (value: number | null) => void }) {
    const commit = (input: HTMLInputElement) => {
        const next = alignDimension(Math.max(1, Math.floor(Number(input.value) || value || 1024)), alignToStep);
        input.value = String(next);
        onChange(next);
    };

    return (
        <label className="flex h-8 overflow-hidden rounded-lg text-xs" style={{ background: theme.toolbar.itemHover, color: theme.node.text, opacity: disabled ? 0.55 : 1 }}>
            <span className="grid w-8 place-items-center" style={{ color: theme.node.muted }}>
                {prefix}
            </span>
            <input
                type="number"
                min={1}
                disabled={disabled}
                className="min-w-0 flex-1 bg-transparent px-2 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                defaultValue={value || ""}
                key={`${prefix}-${value}`}
                onBlur={(event) => commit(event.currentTarget)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
        </label>
    );
}

// 份数竖向滚动列表(与文本份数气泡同词汇: 窄列数字/行高36/细滚动条/选中高亮)
function CountRoll({ value, max, theme, onChange }: { value: number; max: number; theme: CanvasTheme; onChange: (value: number) => void }) {
    const counts = Array.from({ length: Math.min(max, 15) }, (_, index) => index + 1);
    return (
        <div
            className="canvas-settings-roll thin-scrollbar flex flex-col overflow-y-auto rounded-lg"
            style={{ maxHeight: Math.min(counts.length, 9) * 36 + 8 }}
            onMouseDown={(event) => event.stopPropagation()}
        >
            {counts.map((item) => (
                <button
                    key={item}
                    type="button"
                    data-count={item}
                    aria-pressed={value === item}
                    aria-label={`${item} 张`}
                    className="canvas-settings-option canvas-settings-roll-row"
                    style={{
                        background: value === item ? theme.toolbar.activeBg : "transparent",
                        borderColor: value === item ? theme.node.activeStroke : "transparent",
                        color: theme.node.text,
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => onChange(item)}
                >
                    {item}
                </button>
            ))}
        </div>
    );
}

function CountInput({ value, quickCount, max, theme, onChange }: { value: number; quickCount: number; max: number; theme: CanvasTheme; onChange: (value: number | null) => void }) {
    const commit = (input: HTMLInputElement) => {
        const next = Math.max(1, Math.min(max, Math.floor(Number(input.value) || 1)));
        input.value = String(next);
        onChange(next);
    };
    return (
        <label className="flex h-8 overflow-hidden rounded-lg text-xs" style={{ background: theme.toolbar.itemHover, color: theme.node.text }}>
            <input
                key={value > quickCount ? `custom-${value}` : "quick"}
                type="number"
                min={1}
                max={max}
                aria-label="自定义生成张数"
                placeholder="输入"
                className="min-w-0 flex-1 bg-transparent px-2 text-center outline-none placeholder:text-current placeholder:opacity-55 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{ color: theme.node.text, WebkitTextFillColor: theme.node.text }}
                defaultValue={value > quickCount ? value : ""}
                onBlur={(event) => commit(event.currentTarget)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
                onMouseDown={(event) => event.stopPropagation()}
            />
        </label>
    );
}

function AspectIcon({ type, width, height, color }: { type: string; width: number; height: number; color: string }) {
    if (type === "auto") return null;
    const ratio = width / Math.max(1, height);
    const boxWidth = ratio >= 1 ? 14 : Math.max(6, 14 * ratio);
    const boxHeight = ratio >= 1 ? Math.max(6, 14 / ratio) : 14;
    return (
        <span className="grid h-5 w-7 place-items-center">
            <span className="border" style={{ width: boxWidth, height: boxHeight, borderColor: color }} />
        </span>
    );
}

function SettingTitle({ children, color }: { children: string; color: string }) {
    // 语料权威(P51-030): 组标题 12px/400 muted, 不用 medium 加重。
    return (
        <div className="text-xs font-normal" style={{ color }}>
            {children}
        </div>
    );
}

function imageOptionAllowed(profile: ImageCapabilityConfig, option: AspectOption) {
    if (profile.size.parameter === "none") return false;
    if (profile.size.allowCustom && profile.size.values.length === 0) return true;
    return [option.value, option.size, option.width && option.height ? `${option.width}x${option.height}` : ""].filter(Boolean).some((value) => profile.size.values.includes(String(value)));
}

function imageAspectOptions(profile: ImageCapabilityConfig): AspectOption[] {
    if (profile.size.parameter === "none") return [];
    const values = profile.size.values.filter((value) => value.trim().toLowerCase() !== "auto");
    if (!values.length) return profile.size.allowCustom ? aspectOptions.filter((item) => item.value !== "auto") : [];
    // 设计契约(P2 能力裁剪 + P5 渐进披露): 网格只承载标准比例(竞品同型, 两行封顶)——
    // 同比例多像素尺寸归分辨率/换算条, 非标准怪异比例归自定义输入; 标准集为空才回退去重全量。
    const standard = aspectOptions.filter((item) =>
        !/-\d+k$/.test(item.value) && [item.value, item.size, item.width && item.height ? `${item.width}x${item.height}` : ""].filter(Boolean).some((candidate) => values.includes(String(candidate))),
    );
    if (standard.length) return standard;
    const seenRatios = new Set<string>();
    const options: AspectOption[] = [];
    for (const value of values) {
        const known = aspectOptions.find((item) => (item.size || item.value) === value || item.value === value);
        if (known) {
            if (seenRatios.has(known.label)) continue;
            seenRatios.add(known.label);
            options.push(known);
            continue;
        }
        const parts = ratioParts(value);
        const ratioLabel = parts ? `${parts.width}:${parts.height}` : value;
        if (seenRatios.has(ratioLabel)) continue;
        seenRatios.add(ratioLabel);
        options.push({ value, label: ratioLabel, size: value, width: parts?.width || 0, height: parts?.height || 0, icon: parts && parts.width !== parts.height ? (parts.width > parts.height ? "landscape" : "portrait") : "square" });
    }
    return options;
}

function ratioParts(value: string) {
    const pixel = value.trim().match(/^(\d+)x(\d+)$/i);
    if (pixel) {
        const divisor = gcd(Number(pixel[1]), Number(pixel[2]));
        return { width: Number(pixel[1]) / divisor, height: Number(pixel[2]) / divisor };
    }
    const ratio = value.trim().match(/^(\d+):(\d+)$/);
    if (!ratio) return undefined;
    const divisor = gcd(Number(ratio[1]), Number(ratio[2]));
    return { width: Number(ratio[1]) / divisor, height: Number(ratio[2]) / divisor };
}

function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
}

function imageOptionValue(profile: ImageCapabilityConfig, option: AspectOption) {
    const candidates = [option.size, option.value, option.width && option.height ? `${option.width}x${option.height}` : ""].filter(Boolean).map(String);
    return candidates.find((value) => profile.size.values.includes(value)) || option.size || option.value || "auto";
}

function readSizeDimensions(size: string, fallback: { width: number; height: number }) {
    const match = size?.match(/^(\d+)x(\d+)$/);
    return {
        width: match ? Number(match[1]) : fallback.width,
        height: match ? Number(match[2]) : fallback.height,
    };
}

function alignDimension(value: number, enabled: boolean) {
    return enabled ? Math.ceil(value / DIMENSION_STEP) * DIMENSION_STEP : value;
}
