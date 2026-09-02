import { useState } from "react";

import { Composer, HoverToolbar, NodeSurface, type ToolbarPersistence } from "@/components/canvas/primitives";
import { useThemeStore } from "@/stores/use-theme-store";

/**
 * 画布原语 playground(/dev/primitives,仅 DEV 构建可达)。
 *
 * 用途:原语车道第一批(NodeSurface / HoverToolbar / Composer)的逐态验收场。
 * 验收对齐 yingce-floraization state-matrix:四态工具条语义、状态轴正交、
 * computed 目标值(阴影/alpha 面板/控件高度)与 DESIGN.md 表面补录一致。
 */

function ThemeToggle() {
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    return (
        <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--card-foreground)", cursor: "pointer" }}
        >
            {theme === "dark" ? "切到亮色" : "切到暗色"}
        </button>
    );
}

const PERSISTENCE_LABELS: Record<ToolbarPersistence, string> = {
    "hover-only": "hover-only(瞬态)",
    selected: "selected(常驻)",
    "edit-focus": "edit-focus(编辑常驻)",
    "dropdown-open": "dropdown-open(菜单桥接)",
};

const PHASES = ["empty", "ready", "running", "generated", "error"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--foreground)" }}>{title}</h2>
            {children}
        </section>
    );
}

export default function PrimitivesLab() {
    const [prompt, setPrompt] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [sending, setSending] = useState(false);
    const [selection, setSelection] = useState<"idle" | "hover" | "selected">("selected");
    const [phase, setPhase] = useState<(typeof PHASES)[number]>("empty");
    const [persistence, setPersistence] = useState<ToolbarPersistence>("selected");
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const effectivePersistence: ToolbarPersistence = dropdownOpen ? "dropdown-open" : persistence;

    return (
        <div style={{ padding: 32, maxWidth: 960, margin: "0 auto", color: "var(--foreground)" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <h1 style={{ fontSize: 18, fontWeight: 600 }}>画布原语 Playground</h1>
                <ThemeToggle />
            </header>

            <Section title="NodeSurface — 状态轴(phase × selection 正交)">
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    {PHASES.map((p) => (
                        <button key={p} type="button" onClick={() => setPhase(p)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: phase === p ? "var(--primary)" : "transparent", color: phase === p ? "var(--primary-foreground)" : "inherit", cursor: "pointer", fontSize: 12 }}>
                            {p}
                        </button>
                    ))}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    {(["idle", "hover", "selected"] as const).map((s) => (
                        <button key={s} type="button" onClick={() => setSelection(s)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: selection === s ? "var(--primary)" : "transparent", color: selection === s ? "var(--primary-foreground)" : "inherit", cursor: "pointer", fontSize: 12 }}>
                            {s}
                        </button>
                    ))}
                </div>
                <div style={{ position: "relative", width: 320 }}>
                    <NodeSurface phase={phase} selection={selection} width="100%" aspectRatio="4 / 3">
                        <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", fontSize: 12 }}>
                            {phase === "empty" ? "空态:提示词入口 + 说明" : phase === "running" ? "生成中:ambient,非居中卡" : phase}
                        </div>
                    </NodeSurface>
                    {selection === "selected" && (
                        <HoverToolbar persistence={effectivePersistence} anchor={{ x: 8, y: -44 }} onDropdownToggle={setDropdownOpen}>
                            <div style={{ display: "flex", gap: 2, padding: 4, alignItems: "center" }}>
                                {["模型", "4:3", "Tools", "锁", "下载"].map((t) => (
                                    <button key={t} type="button" style={{ padding: "4px 8px", fontSize: 12, background: "transparent", border: "none", color: "var(--foreground)", cursor: "pointer", borderRadius: 6 }}>{t}</button>
                                ))}
                            </div>
                        </HoverToolbar>
                    )}
                </div>
            </Section>

            <Section title="HoverToolbar — 四态 persistence">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {(Object.keys(PERSISTENCE_LABELS) as ToolbarPersistence[]).map((p) => (
                        <button key={p} type="button" onClick={() => setPersistence(p)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: persistence === p ? "var(--primary)" : "transparent", color: persistence === p ? "var(--primary-foreground)" : "inherit", cursor: "pointer", fontSize: 12 }}>
                            {PERSISTENCE_LABELS[p]}
                        </button>
                    ))}
                </div>
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                    hover-only:指针进入保持、离开即收(leaveGraceMs=0);selected / edit-focus:常驻;dropdown-open:桥接宽限不参与 hover 计时。
                    上方 NodeSurface 已联动演示:data-toolbar-persistence 标记当前语义。
                </p>
            </Section>

            <Section title="Composer — 可用性矩阵(T1 实测对齐)">
                <div style={{ width: 420 }}>
                    <Composer
                        value={prompt}
                        onChange={setPrompt}
                        placeholder="描述这张图片…"
                        quantity={quantity}
                        onQuantityChange={setQuantity}
                        sending={sending}
                        canEnhance={prompt.trim().length > 0}
                        onEnhance={() => undefined}
                        referenceCount={0}
                        onSend={() => {
                            setSending(true);
                            window.setTimeout(() => setSending(false), 1200);
                        }}
                    />
                </div>
                <ul style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.9, marginTop: 12, paddingLeft: 18 }}>
                    <li>空提示词 → Generate disabled(T1 实测)</li>
                    <li>qty=1 → Decrease disabled;qty=4 → Increase disabled</li>
                    <li>无引用 → 引用供给 disabled</li>
                    <li>Enhance 为 hover/focus 供给(空态禁用),非常驻标签</li>
                    <li>Enter=换行,发送走显式按钮(IME 安全)</li>
                    <li>sending 态:整组禁用(1200ms 模拟)</li>
                </ul>
            </Section>
        </div>
    );
}
