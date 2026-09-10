import { type ReactNode, useState } from "react";

import { ImageSettingsTheme, OptionPill } from "@/components/image-settings-panel";
import { SettingsStepper } from "@/components/canvas/settings-stepper";
import { audioFormatOptions, audioSpeedLabel, audioVoiceOptions, normalizeAudioFormatValue, normalizeAudioSpeedValue, normalizeAudioVoiceValue } from "@/lib/audio-generation";
import { type CanvasTheme } from "@/lib/canvas-theme";
import type { AiConfig } from "@/stores/use-config-store";

const speedOptions = ["0.75", "1", "1.25", "1.5"];

type AudioSettingKey = "audioVoice" | "audioFormat" | "audioSpeed" | "audioInstructions";

type AudioSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: AudioSettingKey, value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function AudioSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[var(--panel-width-compact)] space-y-4 rounded-2xl px-1 py-0.5" }: AudioSettingsPanelProps) {
    const voice = normalizeAudioVoiceValue(config.audioVoice);
    const format = normalizeAudioFormatValue(config.audioFormat);
    const speed = normalizeAudioSpeedValue(config.audioSpeed);
    // 排布纪律(设计 v2): 音色(首要创作参数) > 语速(呈现节奏) > 格式(输出属性) > 声音指令。
    // 语速自定义(Progressive Disclosure): 仅当当前值不在预设档内时展开输入, 否则提供自定义入口。
    const speedIsPreset = speedOptions.includes(speed);
    const [customSpeedOpen, setCustomSpeedOpen] = useState(!speedIsPreset);

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-sm font-semibold">音频设置</div> : null}
                <SettingGroup title="音色" color={theme.node.groupTitle}>
                    <div className="grid grid-cols-4 gap-1">
                        {audioVoiceOptions.map((item) => (
                            <OptionPill key={item.value} selected={voice === item.value} theme={theme} onClick={() => onConfigChange("audioVoice", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </SettingGroup>
                <SettingGroup title="语速" color={theme.node.groupTitle} extra={<span className="shrink-0 text-[11px] font-medium leading-none tabular-nums" style={{ color: theme.node.text }}>{audioSpeedLabel(speed)}</span>}>
                    {/* 步进刻度滑块(用户拍板, 与视频时长同语法): 4 档刻度+里程碑标签; 自定义入口保留。 */}
                    <SettingsStepper
                        value={Number(speed) || 1}
                        min={0.75}
                        max={Math.max(1.5, Number(speed) || 1)}
                        step={0.25}
                        format={(v) => `${v}x`}
                        onChange={(next) => onConfigChange("audioSpeed", String(next))}
                    />
                    {customSpeedOpen ? (
                        <input
                            type="number"
                            aria-label="自定义语速"
                            min={0.25}
                            max={4}
                            step={0.05}
                            autoFocus
                            className="h-8 w-full rounded-lg border bg-transparent px-3 text-center text-xs outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            style={{ borderColor: theme.node.stroke, color: theme.node.text, WebkitTextFillColor: theme.node.text }}
                            value={config.audioSpeed || "1"}
                            onChange={(event) => onConfigChange("audioSpeed", event.target.value)}
                            onBlur={(event) => onConfigChange("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                                if (event.key === "Escape") setCustomSpeedOpen(false);
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                        />
                    ) : (
                        <button
                            type="button"
                            className="canvas-settings-option h-8 w-full cursor-pointer rounded-lg px-2"
                            style={{ outlineColor: theme.node.muted, fontSize: "11px" }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => setCustomSpeedOpen(true)}
                        >
                            自定义语速…
                        </button>
                    )}
                </SettingGroup>
                <SettingGroup title="格式" color={theme.node.groupTitle}>
                    <div className="grid grid-cols-3 gap-1">
                        {audioFormatOptions.map((item) => (
                            <OptionPill key={item.value} selected={format === item.value} theme={theme} onClick={() => onConfigChange("audioFormat", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </SettingGroup>
                <SettingGroup title="声音指令" color={theme.node.groupTitle}>
                    <textarea
                        value={config.audioInstructions || ""}
                        placeholder="例如：自然、温暖、适合旁白。"
                        className="thin-scrollbar h-20 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-xs leading-5 outline-none"
                        style={{ borderColor: theme.node.stroke, color: theme.node.text, fontSize: "12px" }}
                        onChange={(event) => onConfigChange("audioInstructions", event.target.value)}
                        onMouseDown={(event) => event.stopPropagation()}
                    />
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

// 分段 pill 已收敛到 image-settings-panel 共享导出(40px 命中区)。

function SettingGroup({ title, color, extra, children }: { title: string; color: string; extra?: ReactNode; children: ReactNode }) {
    // 组间距与 image/video 面板同一收敛(space-y-2); 字重对齐语料 P51-030(12px/400)。
    return (
        <div className="canvas-settings-group space-y-2">
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
