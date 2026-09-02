import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

/**
 * 底部 composer(DESIGN.md 归属面契约:Bottom composer owns prompt/reference/send)。
 *
 * 控件可用性矩阵来自 flora T1 实测(20260903-floraization-generate-success):
 * - Enhance prompt 是 hover/focus 供给,不是常驻标签(负面约束)
 * - 数量微控:qty=1 时 decrease disabled
 * - 引用为空时 Reference 供给 disabled
 * - 提示词为空时发送 disabled
 *
 * 内容统一走影策令牌;不混入 antd 组件(同一交互面单一词汇契约)。
 */
export type ComposerProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    quantity: number;
    onQuantityChange: (quantity: number) => void;
    onSend: () => void;
    sending?: boolean;
    canEnhance?: boolean;
    onEnhance?: () => void;
    referenceCount?: number;
    renderReferences?: () => ReactNode;
    className?: string;
    style?: CSSProperties;
};

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 4;

export function Composer({ value, onChange, placeholder, quantity, onQuantityChange, onSend, sending = false, canEnhance = false, onEnhance, referenceCount = 0, renderReferences, className, style }: ComposerProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const editorRef = useRef<HTMLDivElement>(null);
    const composingRef = useRef(false);

    // 受控 contenteditable:外部值与内部文本同步,IME 合成期间不覆写(input 事件照常上报)
    useEffect(() => {
        const el = editorRef.current;
        if (!el || composingRef.current) return;
        if (el.textContent !== value) el.textContent = value;
    }, [value]);

    const canSend = value.trim().length > 0 && !sending;

    const surfaceStyle: CSSProperties = {
        background: theme.toolbar.panel,
        border: `1px solid ${theme.toolbar.border}`,
        borderRadius: 12,
        ...style,
    };

    const iconButtonStyle = (disabled: boolean, active = false): CSSProperties => ({
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 8,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? theme.node.faint : active ? theme.toolbar.activeText : theme.toolbar.item,
        background: active ? theme.toolbar.activeBg : "transparent",
        fontSize: 12,
    });

    return (
        <div className={className} style={surfaceStyle} data-composer-phase={sending ? "sending" : "idle"}>
            {renderReferences?.()}
            <div
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-multiline="true"
                aria-label="提示词"
                data-placeholder={placeholder}
                spellCheck={false}
                style={{
                    minHeight: 40,
                    maxHeight: 160,
                    overflowY: "auto",
                    padding: "8px 10px",
                    color: theme.node.text,
                    fontSize: 13,
                    lineHeight: 1.5,
                    outline: "none",
                    whiteSpace: "pre-wrap",
                }}
                onBeforeInput={(event) => {
                    if (event.nativeEvent instanceof InputEvent && event.nativeEvent.inputType === "insertCompositionText") composingRef.current = true;
                }}
                onInput={(event) => {
                    if (event.nativeEvent instanceof InputEvent && event.nativeEvent.inputType === "insertCompositionText") return;
                    composingRef.current = false;
                    onChange((event.target as HTMLDivElement).textContent ?? "");
                }}
                onBlur={() => {
                    composingRef.current = false;
                }}
                onKeyDown={(event) => {
                    // Enter=换行;发送走显式按钮,避免 IME 上屏与误发
                    if (event.key === "Enter" && !event.shiftKey) event.preventDefault();
                }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px 6px" }}>
                <button type="button" aria-label="Enhance prompt" title="增强提示词" style={iconButtonStyle(!canEnhance, true)} disabled={!canEnhance || !onEnhance} onClick={onEnhance}>
                    ✦
                </button>
                <button type="button" aria-label="插入引用" style={iconButtonStyle(referenceCount === 0 && true)} disabled={referenceCount === 0}>
                    @
                </button>
                <div style={{ flex: 1 }} />
                <button
                    type="button"
                    aria-label="Decrease quantity"
                    style={iconButtonStyle(quantity <= MIN_QUANTITY)}
                    disabled={quantity <= MIN_QUANTITY}
                    onClick={() => onQuantityChange(Math.max(MIN_QUANTITY, quantity - 1))}
                >
                    −
                </button>
                <span aria-label="生成数量" style={{ color: theme.node.muted, fontSize: 12, minWidth: 16, textAlign: "center" }}>
                    {quantity}
                </span>
                <button
                    type="button"
                    aria-label="Increase quantity"
                    style={iconButtonStyle(quantity >= MAX_QUANTITY)}
                    disabled={quantity >= MAX_QUANTITY}
                    onClick={() => onQuantityChange(Math.min(MAX_QUANTITY, quantity + 1))}
                >
                    +
                </button>
                <button
                    type="button"
                    aria-label="Generate"
                    style={{
                        marginLeft: 6,
                        height: 28,
                        padding: "0 12px",
                        borderRadius: 8,
                        border: "none",
                        cursor: canSend ? "pointer" : "not-allowed",
                        background: theme.accent.primary,
                        color: theme.accent.onPrimary,
                        fontSize: 12,
                        fontWeight: 500,
                        opacity: canSend ? 1 : 0.4,
                        transition: "opacity var(--motion-dur-fast) var(--motion-ease-out)",
                    }}
                    disabled={!canSend}
                    onClick={onSend}
                >
                    生成
                </button>
            </div>
        </div>
    );
}
