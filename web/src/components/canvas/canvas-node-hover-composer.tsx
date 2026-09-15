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
    // 仅媒体类渲染 img; 文本/技能引用无图, 不允许空 src(img src="" 必裂图 — 用户截图批评项)。
    const media = reference.kind === "image" || reference.kind === "video" || reference.kind === "character";
    return media ? reference.previewUrl || (reference.kind === "video" ? reference.mediaUrl : "") || "" : "";
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
                <div className="canvas-node-hover-composer-surface flex flex-col gap-2 px-3.5 py-3">
                    {/* flora SurfaceControlsOverlay(0_di9:7903)顺序: 引用行在前, 提示词在后。 */}
                    {references.length > 0 ? (
                        <div
                            className="-mx-3.5 -my-3 overflow-x-auto overflow-y-hidden px-3.5 py-3"
                            data-canvas-wheel-scroll
                        >
                            <div className="flex w-max items-center gap-2">
                                {references.map((reference) => {
                                    const src = referenceThumbSrc(reference);
                                    // flora 引用缩略(用户 hover 截图对): 静置 48px 方块 radius 12 纯缩略图;
                                    // hover 展开为胶囊 —— 名称 + 类型标签(Image/Text)淡入, 宽度过渡 200ms。
                                    return (
                                        <span
                                            key={reference.id}
                                            className="canvas-node-hover-composer-ref group/ref flex h-9 items-center overflow-hidden rounded-lg"
                                            style={{ background: theme.toolbar.itemHover, outline: `1px solid ${theme.node.stroke}` }}
                                        >
                                            {src ? (
                                                <img src={src} alt={reference.label} draggable={false} loading="lazy" decoding="async" className="h-9 w-9 shrink-0 object-cover" />
                                            ) : (
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center text-sm font-medium" style={{ color: theme.node.muted }}>
                                                    {reference.kind === "audio" ? "♪" : "T"}
                                                </span>
                                            )}
                                            <span className="canvas-node-hover-composer-ref-meta flex min-w-0 max-w-0 flex-col justify-center overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-[cubic-bezier(0,0.8,0.1,1)] group-hover/ref:mx-2.5 group-hover/ref:max-w-40 group-hover/ref:opacity-100">
                                                <span className="truncate text-xs leading-4" style={{ color: theme.node.text }}>{reference.label}</span>
                                                <span className="text-[10px] leading-3 opacity-55" style={{ color: theme.node.muted }}>{reference.kind === "audio" ? "Audio" : reference.kind === "video" ? "Video" : reference.kind === "text" ? "Text" : "Image"}</span>
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                    {promptText ? (
                        <div
                            className="canvas-node-hover-composer-prompt overflow-y-auto whitespace-pre-wrap break-words text-[var(--fs-body)] leading-5"
                            data-canvas-wheel-scroll
                            style={{ color: theme.node.text, minHeight: 80, maxHeight: 96 }}
                        >
                            {promptText}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
