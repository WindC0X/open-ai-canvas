import { type ReactNode } from "react";

/**
 * 参数面板步进刻度滑块(flora 语法, 用户参考图 2026-09-11):
 * 2px 细轨 + 每个 step 一个 DOM 刻度点 + 下方里程碑标签(均匀抽稀至约 8 个, 选中值强制可见)。
 * video 时长 / audio 语速共用; 标题行右侧当前值由调用方经 SettingGroup extra 提供。
 *
 * 几何: 原生 range 的 thumb 中心被钳在 [thumbW/2, W-thumbW/2](thumb 12px → 6px),
 * 因此刻度点与标签容器同内缩 6px, 且按值位置线性分布(absolute left %),
 * 与 thumb 的浏览器映射一致——grid 均分列中心会造成错位(用户实测已踩)。
 */
export function SettingsStepper({ value, min, max, step, format, onChange }: {
    value: number;
    min: number;
    max: number;
    step: number;
    /** 标签文本(默认 String(v)); 时长 "8s" / 语速 "1x"。 */
    format?: (v: number) => ReactNode;
    onChange: (value: number) => void;
}) {
    const total = Math.floor((max - min) / step) + 1;
    const ticks = Array.from({ length: total }, (_, i) => min + i * step);
    const labelEvery = Math.max(1, Math.ceil(total / 8));
    const pos = (index: number) => (total > 1 ? `${(index / (total - 1)) * 100}%` : "0%");
    return (
        <div className="space-y-1">
            <div className="relative h-3">
                <div className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
                <div className="absolute inset-y-0" style={{ left: 6, right: 6 }}>
                    {ticks.map((tick, index) => (
                        <span
                            key={tick}
                            className="absolute top-1/2 size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{ left: pos(index), background: "rgba(255,255,255,0.4)" }}
                        />
                    ))}
                </div>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    className="video-duration-range absolute inset-0 h-3 min-w-0 w-full cursor-pointer"
                    onChange={(event) => onChange(Number(event.target.value))}
                    onMouseDown={(event) => event.stopPropagation()}
                />
            </div>
            <div className="relative h-5" style={{ marginLeft: 6, marginRight: 6 }}>
                {ticks.map((tick, index) => {
                    // 里程碑格 + 当前选中格始终显示(选中值落在抽稀位时也可见, 保持面板内位置感)。
                    const visible = index % labelEvery === 0 || value === tick;
                    return (
                        <button
                            key={tick}
                            type="button"
                            className="canvas-settings-option absolute top-0 -translate-x-1/2 cursor-pointer whitespace-nowrap rounded px-1 py-0.5 text-center text-[10px] leading-none tabular-nums"
                            style={{ left: pos(index), fontSize: "10px", ...(visible ? {} : { visibility: "hidden" as const }) }}
                            aria-pressed={value === tick}
                            aria-hidden={!visible}
                            tabIndex={visible ? 0 : -1}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={() => onChange(tick)}
                        >
                            {format ? format(tick) : tick}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
