import { type ReactNode } from "react";

/**
 * 参数面板步进刻度滑块(flora 语法, 用户参考图 2026-09-11):
 * 2px 细轨 + 每个 step 一个 DOM 刻度点(均布) + 下方里程碑标签(均匀抽稀至约 8 个, 其余格空白仍可点)。
 * video 时长 / audio 语速共用; 标题行右侧当前值由调用方经 SettingGroup extra 提供。
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
    return (
        <div className="space-y-1">
            <div className="relative h-3">
                <div className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
                    {ticks.map((tick) => (
                        <span key={tick} className="flex items-center justify-center">
                            <span className="size-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.4)" }} />
                        </span>
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
            <div className="grid" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
                {ticks.map((tick, index) => {
                    // 里程碑格 + 当前选中格始终显示(选中值落在抽稀位时也可见, 保持面板内位置感)。
                    const visible = index % labelEvery === 0 || value === tick;
                    return (
                        <button
                            key={tick}
                            type="button"
                            className="canvas-settings-option cursor-pointer rounded py-0.5 text-center text-[10px] leading-none tabular-nums"
                            aria-pressed={value === tick}
                            aria-hidden={!visible}
                            tabIndex={visible ? 0 : -1}
                            style={visible ? { fontSize: "10px" } : { visibility: "hidden", fontSize: "10px" }}
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
