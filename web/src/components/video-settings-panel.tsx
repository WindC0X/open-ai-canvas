import { type ReactNode } from "react";
import { Switch } from "@/components/ui/base/switch";

import { ImageSettingsTheme, OptionPill } from "@/components/image-settings-panel";
import { boolConfig, isSeedanceFastModel, isSeedanceVideoConfig, normalizeSeedanceDuration, normalizeSeedanceRatio, normalizeSeedanceResolution, seedanceRatioOptions } from "@/lib/seedance-video";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { formatVideoResolutionLabel, isVideoResolutionMatch, normalizeVideoDuration, videoDimensionsForRatioAndResolution, videoResolutionComparisonKey, VIDEO_DURATION_MIN } from "@/lib/video-generation-options";
import { modelCapabilityConfigFor, resolveVideoRatioValue, resolveVideoResolutionValue, videoDurationOptions, type VideoCapabilityConfig } from "@/lib/model-capabilities";
import { modelOptionName, resolveModelChannel, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

const sizeOptions = [
    { value: "1280x720", label: "横屏", width: 1280, height: 720 },
    { value: "720x1280", label: "竖屏", width: 720, height: 1280 },
    { value: "1024x1024", label: "方形", width: 1024, height: 1024 },
    { value: "1792x1024", label: "宽屏", width: 1792, height: 1024 },
    { value: "1024x1792", label: "长图", width: 1024, height: 1792 },
    { value: "auto", label: "auto", width: 0, height: 0 },
];

type VideoSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark" | "videoArkPrivateAssetUpload", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function VideoSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[292px] space-y-3" }: VideoSettingsPanelProps) {
    const profile = modelCapabilityConfigFor(config, config.model).video!;
	const priceTiers = modelPriceTiers(config);
    if (resolveModelRequestConfig(config, config.model).interfaceType === "volcengine-jimeng-video") {
		return <JiMengVideoSettingsPanel config={config} profile={profile} priceTiers={priceTiers} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} className={className} />;
    }
    if (isSeedanceVideoConfig(config)) {
		return <SeedanceVideoSettingsPanel config={config} profile={profile} priceTiers={priceTiers} onConfigChange={onConfigChange} theme={theme} showTitle={showTitle} className={className} />;
    }

    const seconds = normalizeVideoDuration(config.videoSeconds);
    const resolution = resolveVideoResolutionValue(profile, config.vquality);
    const ratio = resolveVideoRatioValue(profile, config.size);
    const dimensions = videoDimensionsForRatioAndResolution(ratio, resolution);
    const sizeSupported = profile.ratios.length > 0;
    const configuredResolutions = profile.resolutions.map((value) => ({ value, label: formatVideoResolutionLabel(value) }));
    const generateAudio = boolConfig(config.videoGenerateAudio, profile.generateAudio.default);
    const watermark = boolConfig(config.videoWatermark, profile.watermark.default);

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">视频设置</div> : null}
                {/* 排布纪律(设计 v2): 比例(构图)置首, 清晰度/时长随后, 输出属性收尾; 与 Seedance/JiMeng 分支及 image 面板同序。 */}
                {sizeSupported ? <SettingGroup title="比例" color={theme.node.muted}>
                    {dimensions ? <div className="text-xs tabular-nums" style={{ color: theme.node.muted }}>
                        {`${ratio} · ${dimensions.width} × ${dimensions.height}px`}
                    </div> : null}
                    {/* 比例按钮统一 image 面板的双行卡形态(h-52: 图标行+文字行)。 */}
                    <div className="grid grid-cols-3 gap-1">
                        {profile.ratios.map((value) => (
                            <button
                                key={value}
                                type="button"
                                className="canvas-settings-option flex h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[var(--fs-label)] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                                style={{ outlineColor: theme.node.muted, fontSize: "var(--fs-label)" }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("size", value)}
                            >
                                <span className="grid h-6 w-8 place-items-center">
                                    <SizePreview width={ratioPreview(value).width} height={ratioPreview(value).height} color="currentColor" />
                                </span>
                                <span className="whitespace-nowrap">{value}</span>
                            </button>
                        ))}
                    </div>
                </SettingGroup> : null}
                {configuredResolutions.length > 1 ? <SettingGroup title="清晰度" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1">
                        {configuredResolutions.map((item) => (
							<OptionPill key={item.value} selected={isVideoResolutionMatch(resolution, item.value)} disabled={!hasPriceTierForVideoSelection(priceTiers, item.value, Number(seconds))} theme={theme} onClick={() => onConfigChange("vquality", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </SettingGroup> : null}
                <SettingGroup title="时长" color={theme.node.muted} extra={<span className="shrink-0 text-[11px] font-medium leading-none tabular-nums" style={{ color: theme.node.text }}>{seconds}s</span>}>
					<VideoDurationControl profile={profile} value={Number(seconds)} theme={theme} disabled={(value) => !hasPriceTierForVideoSelection(priceTiers, resolution, value)} onChange={(value) => onConfigChange("videoSeconds", String(value))} />
                </SettingGroup>
                {profile.generateAudio.supported || profile.watermark.supported ? <SettingGroup title="输出" color={theme.node.muted}><div className="grid grid-cols-2 gap-3 rounded-lg px-2" style={{ background: theme.toolbar.itemHover }}>{profile.generateAudio.supported ? <SwitchRow label="生成声音" checked={generateAudio} theme={theme} onChange={(checked) => onConfigChange("videoGenerateAudio", String(checked))} /> : null}{profile.watermark.supported ? <SwitchRow label="添加水印" checked={watermark} theme={theme} onChange={(checked) => onConfigChange("videoWatermark", String(checked))} /> : null}</div></SettingGroup> : null}
            </div>
        </ImageSettingsTheme>
    );
}

function JiMengVideoSettingsPanel({ config, profile, priceTiers, onConfigChange, theme, showTitle, className }: VideoSettingsPanelProps & { profile: VideoCapabilityConfig; priceTiers: ReturnType<typeof modelPriceTiers> }) {
    const seconds = normalizeVideoDuration(config.videoSeconds);
    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">视频设置</div> : null}
                {/* 排布纪律(设计 v2): 比例置首, 清晰度随后(与默认分支同序); JiMeng 比例升级双行卡(h-52)。 */}
                <SettingGroup title="比例" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1">
                {profile.ratios.map((value) => (
                    <button
                        key={value}
                        type="button"
                        className="canvas-settings-option flex h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[var(--fs-label)] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                        style={{ outlineColor: theme.node.muted, fontSize: "var(--fs-label)" }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={() => onConfigChange("size", value)}
                    >
                        <span className="grid h-6 w-8 place-items-center">
                            <SizePreview width={ratioPreview(value).width} height={ratioPreview(value).height} color="currentColor" />
                        </span>
                        <span className="whitespace-nowrap">{value}</span>
                    </button>
                ))}
                    </div>
                </SettingGroup>
                <SettingGroup title="时长" color={theme.node.muted}>
					<VideoDurationControl profile={profile} value={Number(seconds)} theme={theme} disabled={(value) => !hasPriceTierForVideoSelection(priceTiers, "*", value)} onChange={(value) => onConfigChange("videoSeconds", String(value))} />
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

function SeedanceVideoSettingsPanel({ config, profile, priceTiers, onConfigChange, theme, showTitle, className }: VideoSettingsPanelProps & { profile: VideoCapabilityConfig; priceTiers: ReturnType<typeof modelPriceTiers> }) {
    const model = modelOptionName(config.model || config.videoModel);
    const resolution = normalizeSeedanceResolution(config.vquality, model);
    const ratio = normalizeSeedanceRatio(config.size);
    const duration = normalizeSeedanceDuration(config.videoSeconds);
    const generateAudio = boolConfig(config.videoGenerateAudio, profile.generateAudio.default);
    const watermark = boolConfig(config.videoWatermark, profile.watermark.default);
    const useArkPrivateAssets = boolConfig(config.videoArkPrivateAssetUpload, true);
    const isArkSeedance = resolveModelRequestConfig(config, config.model).interfaceType === "volcengine-ark-video";

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">视频设置</div> : null}
                {/* 排布纪律(设计 v2): 比例置首(含像素换算条), 清晰度随后(与默认分支同序)。 */}
                <SettingGroup title="比例" color={theme.node.muted}>
                    {(() => {
                        const dims = videoDimensionsForRatioAndResolution(ratio, resolution);
                        return dims ? <div className="text-xs tabular-nums" style={{ color: theme.node.muted }}>
                            {`${ratio} · ${dims.width} × ${dims.height}px`}
                        </div> : null;
                    })()}
                    {/* 比例按钮统一 image 面板的双行卡形态(h-52)与 grid-cols-4。 */}
                    <div className="grid grid-cols-4 gap-1">
                        {profile.ratios.map((value) => {
                            const item = { value, label: value };
                            return (
                            <button
                                key={item.value}
                                type="button"
                                className="canvas-settings-option flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[var(--fs-tiny)] leading-none transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                                style={{ outlineColor: theme.node.muted, fontSize: "var(--fs-label)" }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onConfigChange("size", item.value)}
                            >
                                <span className="grid h-6 w-8 place-items-center">
                                    <SizePreview width={ratioPreview(item.value).width} height={ratioPreview(item.value).height} color="currentColor" />
                                </span>
                                <span className="whitespace-nowrap">{item.label}</span>
                            </button>
                            );
                        })}
                    </div>
                </SettingGroup>
                {profile.resolutions.length > 1 ? <SettingGroup title="清晰度" color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-1">
                        {profile.resolutions.map((value) => {
                            const item = { value, label: value.toUpperCase() };
							const disabled = (item.value === "1080p" && isSeedanceFastModel(model)) || !hasPriceTierForVideoSelection(priceTiers, item.value, duration);
                            return (
                                <OptionPill key={item.value} selected={resolution === item.value} disabled={disabled} theme={theme} onClick={() => onConfigChange("vquality", item.value)}>
                                    {item.label}
                                </OptionPill>
                            );
                        })}
                    </div>
                    {isSeedanceFastModel(model) ? <div className="text-[var(--fs-tiny)] leading-4 opacity-55">fast 模型自动使用 720P</div> : null}
                </SettingGroup> : null}
                <SettingGroup title="时长" color={theme.node.muted} extra={<span className="shrink-0 text-[11px] font-medium leading-none tabular-nums" style={{ color: theme.node.text }}>{duration}s</span>}>
					<VideoDurationControl profile={profile} value={duration} theme={theme} disabled={(value) => !hasPriceTierForVideoSelection(priceTiers, resolution, value)} onChange={(value) => onConfigChange("videoSeconds", String(value))} />
                </SettingGroup>
                <SettingGroup title="输出" color={theme.node.muted}>
                    <div className="grid grid-cols-2 gap-3 rounded-lg px-2" style={{ background: theme.toolbar.itemHover }}>
                        {profile.generateAudio.supported ? <SwitchRow label="生成声音" checked={generateAudio} theme={theme} onChange={(checked) => onConfigChange("videoGenerateAudio", String(checked))} /> : null}
                        {profile.watermark.supported ? <SwitchRow label="添加水印" checked={watermark} theme={theme} onChange={(checked) => onConfigChange("videoWatermark", String(checked))} /> : null}
                    </div>
                </SettingGroup>
                {isArkSeedance ? (
                    <SettingGroup title="参考图" color={theme.node.muted}>
                        <div className="rounded-md px-2" style={{ background: theme.toolbar.itemHover }}>
                            <SwitchRow label="自动同步可信素材（确认拥有使用权）" checked={useArkPrivateAssets} theme={theme} onChange={(checked) => onConfigChange("videoArkPrivateAssetUpload", String(checked))} />
                        </div>
                    </SettingGroup>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

export function videoResolutionLabel(value: string) {
    return formatVideoResolutionLabel(value);
}

export function videoSizeLabel(value: string) {
    const ratio = normalizeSeedanceRatio(value);
    if (value === "adaptive" || value === "auto") return "自适应";
    // The compact summary must mirror the selected value (for example 16:9),
    // while the settings panel can still use semantic labels such as 横屏.
    if (ratio === value) return ratio;
    const size = normalizeVideoSizeValue(value);
    return sizeOptions.find((item) => item.value === size)?.label || size;
}

export function videoSecondsLabel(value: string) {
    return `${normalizeVideoDuration(value)}s`;
}

export function normalizeVideoSizeValue(value: string) {
    if (value === "auto") return "auto";
    if (/^\d+x\d+$/.test(value || "")) return value;
    return ["9:16", "2:3", "3:4"].includes(value) ? "720x1280" : "1280x720";
}

// 分段 pill 已收敛到 image-settings-panel 共享导出(40px 命中区, 与 image/audio 同词汇)。

// 组标题排版与 image 面板同一收敛(text-xs font-normal + space-y-2, 语料 P51-030 12px/400)。
function SettingGroup({ title, color, extra, children }: { title: string; color: string; extra?: ReactNode; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="text-xs font-normal" style={{ color }}>
                    {title}
                </div>
                {extra}
            </div>
            {children}
        </div>
    );
}

function VideoDurationControl({ profile, value, theme, disabled, onChange }: { profile: VideoCapabilityConfig; value: number; theme: CanvasTheme; disabled?: (value: number) => boolean; onChange: (value: number) => void }) {
    if (profile.duration.selection === "range") {
        const min = profile.duration.min || VIDEO_DURATION_MIN;
        const max = Math.max(min, profile.duration.max || min);
        const step = Math.max(1, profile.duration.step || 1);
        const normalized = normalizeDurationValue(value, profile.duration.default, min, max, step);
		return <DurationRangeControl value={normalized} min={min} max={max} step={step} theme={theme} onChange={(next) => { if (!disabled?.(next)) onChange(next); }} />;
    }

    const options = videoDurationOptions(profile);
    return <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }}>
		{options.map((option) => <OptionPill key={option} selected={normalizedNumber(value) === option} disabled={disabled?.(option)} theme={theme} onClick={() => onChange(option)}>{option}s</OptionPill>)}
    </div>;
}

function modelPriceTiers(config: AiConfig) {
	const channel = resolveModelChannel(config, config.model);
	const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(config.model));
	return cost?.logicalPriceTiers || [];
}

function hasPriceTierForVideoSelection(tiers: ReturnType<typeof modelPriceTiers>, resolution: string, seconds: number) {
	if (!tiers.length) return true;
	const normalizedResolution = normalizeTierResolution(resolution);
	return tiers.some((tier) => {
		const selector = tier.selector || {};
		const tierResolution = selector.vquality || tier.resolution;
		const tierSeconds = selector.videoSeconds ? Number(selector.videoSeconds) : tier.videoSeconds;
		return (tierResolution === "*" || !tierResolution || normalizeTierResolution(tierResolution) === normalizedResolution) && (!tierSeconds || tierSeconds === seconds);
	});
}

function normalizeTierResolution(value: string) {
	return videoResolutionComparisonKey(value);
}

function DurationRangeControl({ value, min, max, step, theme, onChange }: { value: number; min: number; max: number; step: number; theme: CanvasTheme; onChange: (value: number) => void }) {
    // flora 步进滑块语法(用户参考图 2026-09-11): 标题行右侧当前值 + 2px 细轨离散刻度点 +
    // 下方可点里程碑标签(均匀分布, 选中白粗)。弃右侧数值输入框与 min/max 两端标签。
    const total = Math.floor((max - min) / step) + 1;
    const ticks = Array.from({ length: total }, (_, i) => min + i * step);
    // 标签全显上限 10 个, 超出则均匀抽稀(刻度点仍在滑轨上, 只是部分不标数)。
    const labelEvery = Math.max(1, Math.ceil(total / 10));
    return <div className="space-y-1">
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-label="视频时长（秒）"
            className="video-duration-range h-4 min-w-0 w-full"
            style={{
                // 离散刻度点经 CSS 变量透传到 ::-webkit-slider-runnable-track(inline 直接写在 input 上会被 track 底色遮住)。
                ["--ticks-image" as string]: `radial-gradient(circle, rgba(255,255,255,0.4) 1.5px, transparent 2px)`,
            }}
            onChange={(event) => onChange(Number(event.target.value))}
            onMouseDown={(event) => event.stopPropagation()}
        />
        <div className="grid" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {ticks.map((tick, index) => (
                <button
                    key={tick}
                    type="button"
                    className="canvas-settings-option cursor-pointer rounded py-0.5 text-center text-[10px] leading-none tabular-nums"
                    aria-pressed={value === tick}
                    disabled={index % labelEvery !== 0}
                    style={{ opacity: index % labelEvery === 0 ? undefined : 0 }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => onChange(tick)}
                >
                    {tick}s
                </button>
            ))}
        </div>
    </div>;
}

function normalizeDurationValue(value: number, fallback: number, min: number, max: number, step: number) {
    const candidate = Number.isFinite(value) ? value : fallback;
    const clamped = Math.min(max, Math.max(min, Math.floor(candidate)));
    const maxStep = Math.max(0, Math.floor((max - min) / step));
    return min + Math.min(maxStep, Math.max(0, Math.round((clamped - min) / step))) * step;
}

function normalizedNumber(value: number) {
    return Number.isFinite(value) ? Math.floor(value) : 0;
}

function SizePreview({ width, height, color }: { width: number; height: number; color: string }) {
    if (!width || !height) return null;
    const longSide = Math.max(width, height);
    const previewWidth = Math.max(7, Math.round((width / longSide) * 16));
    const previewHeight = Math.max(7, Math.round((height / longSide) * 16));
    return <span className="shrink-0 rounded-[2px] border" style={{ width: previewWidth, height: previewHeight, borderColor: color }} />;
}

function ratioPreview(ratio: string) {
    if (ratio === "9:16") return { width: 9, height: 16 };
    if (ratio === "1:1") return { width: 1, height: 1 };
    if (ratio === "4:3") return { width: 4, height: 3 };
    if (ratio === "3:4") return { width: 3, height: 4 };
    if (ratio === "21:9") return { width: 21, height: 9 };
    if (ratio === "adaptive") return { width: 0, height: 0 };
    return { width: 16, height: 9 };
}

function SwitchRow({ label, checked, theme, onChange }: { label: string; checked: boolean; theme: CanvasTheme; onChange: (checked: boolean) => void }) {
    return (
        <div className="flex h-8 items-center justify-between gap-2">
            <span className="min-w-0 whitespace-nowrap text-[var(--fs-label)]" style={{ color: theme.node.text }}>
                {label}
            </span>
            <span className="shrink-0" onMouseDown={(event) => event.stopPropagation()}>
                <Switch size="sm" checked={checked} onChange={onChange} />
            </span>
        </div>
    );
}
