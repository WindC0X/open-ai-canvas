import type { CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import type { CanvasTheme } from "@/lib/canvas-theme";

/**
 * 节点内 hover 信息态 composer（任务 09-15-composer-inline-hover-chrome S1）。
 *
 * 交互契约（用户 2026-09-15 定稿）：
 * - 纯信息展示：提示词 + 引用缩略横滚行；零按钮（发送/@/#/滑块/箭头不放）。
 * - rect 恒在节点内（inset-x-0 bottom-0）⇒ hover 域=节点域，永不越界误触邻居节点
 *   （外部浮动微面板的几何矛盾就此根治）。
 * - 显隐动画照 flora SurfaceLayout（0_di9:7893 附近）：双层 200ms cubic-bezier(0,0.8,0.1,1)，
 *   外层 opacity、内层 translateY(calc(100%+1px)) 坠落；常驻挂载不卸载，退场无卸载竞态。
 * - 微亮→全显走纯 CSS :hover（0.45→1，flora group-hover/surface 同思路），零状态零事件链。
 * - 提示词容器照 flora :7653 非展开态 max-h-[4.5rem] + overflow-auto（内部滚动，非全文铺开）。
 * - 引用行照 flora :7893：overflow-x-auto overflow-y-hidden、负 margin 扩滚动域、nowheel。
 */

const FLORA_EASE = "cubic-bezier(0, 0.8, 0.1, 1)";
const DURATION_MS = 200;

type CanvasNodeHoverComposerProps = {
    prompt?: string;
    references: CanvasResourceReference[];
    theme: CanvasTheme;
    /** 显隐由节点侧派生（hovered && !selected && !generating && !batchExpanded && !mediaActive），组件内零状态。 */
    visible: boolean;
};

export function referenceThumbSrc(reference: CanvasResourceReference) {
    return reference.previewUrl || (reference.kind === "video" ? reference.mediaUrl : "") || "";
}

export function CanvasNodeHoverComposer({ prompt, references, theme, visible }: CanvasNodeHoverComposerProps) {
    const promptText = prompt?.trim() || "";
    const show = visible && (Boolean(promptText) || references.length > 0);

    return (
        <div
            className="canvas-node-hover-composer absolute inset-x-0 bottom-0 z-20"
            data-node-hover-composer={show ? "visible" : "hidden"}
            style={{
                opacity: show ? 1 : 0,
                pointerEvents: show ? "auto" : "none",
                transition: `opacity ${DURATION_MS}ms ${FLORA_EASE}`,
            }}
        >
            <div
                style={{
                    transform: show ? "translateY(0)" : "translateY(calc(100% + 1px))",
                    transition: `transform ${DURATION_MS}ms ${FLORA_EASE}`,
                }}
            >
                <div className="canvas-node-hover-composer-surface flex flex-col gap-1.5 px-3 pb-2 pt-5">
                    {promptText ? (
                        <div
                            className="canvas-node-hover-composer-prompt max-h-[4.5rem] overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-4"
                            style={{ color: theme.node.text }}
                        >
                            {promptText}
                        </div>
                    ) : null}
                    {references.length > 0 ? (
                        <div
                            className="-mx-3 -my-4 overflow-x-auto overflow-y-hidden px-3 py-4"
                            data-canvas-wheel-scroll
                        >
                            <div className="flex w-max items-center gap-1">
                                {references.map((reference) => {
                                    const src = referenceThumbSrc(reference);
                                    return src ? (
                                        <img
                                            key={reference.id}
                                            src={src}
                                            alt={reference.label}
                                            draggable={false}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-5 w-5 shrink-0 rounded-[4px] object-cover"
                                            style={{ outline: `1px solid ${theme.node.stroke}` }}
                                        />
                                    ) : (
                                        <span
                                            key={reference.id}
                                            className="flex h-5 shrink-0 items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-none"
                                            style={{ background: theme.toolbar.itemHover, color: theme.node.muted }}
                                        >
                                            {reference.kind === "audio" ? "♪" : "T"}
                                            <span className="max-w-16 truncate">{reference.label}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
