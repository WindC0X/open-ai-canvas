import { useState } from "react";

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
 * - 提示词容器照 flora :7653 非展开态 + overflow-auto（内部滚动，非全文铺开）；
 * - flora 底部工具栏行(36px)按用户定稿裁掉后，其高度并入提示词区（min 116 / max 132），面板总高与 flora 同比例。
 * - 引用行照 flora :7893：overflow-x-auto overflow-y-hidden、负 margin 扩滚动域、nowheel。
 */

const FLORA_EASE = "cubic-bezier(0, 0.8, 0.1, 1)";
const DURATION_MS = 200;

// flora 实测对齐数值(09-15 逐轮校准的终值, 改动前先对照用户 flora 截图测量):
// prompt 区含被裁掉的 flora 工具栏行高(36px 并入), 面板总高 184px 与 flora 精确对齐。
const THUMB_SIZE_CLASS = "h-9 w-9";
const PROMPT_MIN_HEIGHT = 116;
const PROMPT_MAX_HEIGHT = 132;

type CanvasNodeHoverComposerProps = {
    prompt?: string;
    references: CanvasResourceReference[];
    theme: CanvasTheme;
    /** 显隐由节点侧派生（hovered && !selected && !generating && !batchExpanded && !mediaActive），组件内零状态。 */
    visible: boolean;
    /** 节点高(CSS px): 矮媒体节点上信息态让位中心播放按钮, 面板高度按比例收缩。 */
    nodeHeight?: number;
};

function referenceThumbSrc(reference: CanvasResourceReference) {
    // 仅图片类 URL 可进 <img src>; 空 src 与视频文件 URL(video mediaUrl)都是必裂图,
    // 文本/音频/技能与无封面视频/角色一律走图标块。mediaUrl 只允许 <video> 消费。
    const media = reference.kind === "image" || reference.kind === "video" || reference.kind === "character";
    return media ? reference.previewUrl || "" : "";
}

export function CanvasNodeHoverComposer({ prompt, references, theme, visible, nodeHeight }: CanvasNodeHoverComposerProps) {
    const promptText = prompt?.trim() || "";
    const show = visible && (Boolean(promptText) || references.length > 0);
    // 缩略展开双保险: CSS :hover(group-hover/ref) 为主, pointerenter 置位为兜底 —
    // 真机出现过指针悬停缩略上 meta 不展开(CDP 复测两条路径均正常, 判定为
    // 命中判定边界的偶发), JS 事件链不依赖 hit-testing 怪癖。
    const [forceOpenId, setForceOpenId] = useState<string | null>(null);
    // 矮节点(视频预览常见 216px)上, flora 全尺寸信息态会视觉包住中心播放按钮(用户 2026-09-16 反馈):
    // 面板总高钳到节点高的 45%, 且不超过 flora 基准 184px; 提示词区相应收缩(下限 56 保两行可读)。
    const budget = nodeHeight ? Math.min(184, Math.round(nodeHeight * 0.45)) : 184;
    // 有引用行时预算扣 52px(缩略行高+gap); 无引用时预算全给提示词, 但不超过 flora 基准 132。
    const promptMax = Math.max(56, Math.min(PROMPT_MAX_HEIGHT, budget - (references.length > 0 ? 52 : 0)));
    const promptMin = Math.min(PROMPT_MIN_HEIGHT, promptMax);

    return (
        <div
            className="canvas-node-hover-composer absolute inset-x-0 bottom-0 z-20"
            data-node-hover-composer={show ? "visible" : "hidden"}
            aria-hidden={!show || undefined}
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
                            className={`canvas-node-hover-composer-refs -mx-3.5 -my-3 overflow-x-auto overflow-y-hidden px-3.5 py-3 ${show ? "canvas-node-hover-composer-refs-mask" : ""}`}
                            data-canvas-wheel-scroll
                        >
                            <div className="flex w-max items-center gap-2">
                                {references.map((reference) => {
                                    const src = referenceThumbSrc(reference);
                                    // flora 引用缩略(用户 hover 截图对): 静置 48px 方块 radius 12 纯缩略图;
                                    // hover 展开为胶囊 —— 名称 + 类型标签(Image/Text)淡入, 宽度过渡 200ms。
                                    // 隐藏态不解析 src: 常驻挂载 + lazy 救不了 opacity:0 的隐藏层,
                                    // 缩略图会在整个画布生命周期里被静默加载(节点数放大网络/解码开销)。
                                    const thumbSrc = show ? src : "";
                                    return (
                                        <span
                                            key={reference.id}
                                            data-thumb-open={forceOpenId === reference.id || undefined}
                                            onPointerEnter={() => setForceOpenId(reference.id)}
                                            onPointerLeave={() => setForceOpenId((current) => (current === reference.id ? null : current))}
                                            className={`canvas-node-hover-composer-ref group/ref flex ${THUMB_SIZE_CLASS} items-center overflow-hidden rounded-lg group-hover/ref:w-auto data-[thumb-open]:w-auto`}
                                            style={{ background: theme.toolbar.itemHover, outline: `1px solid ${theme.node.stroke}` }}
                                        >
                                            {thumbSrc ? (
                                                <img src={thumbSrc} alt={reference.label} draggable={false} loading="lazy" decoding="async" className={`${THUMB_SIZE_CLASS} shrink-0 object-cover`} />
                                            ) : (
                                                <span className={`flex ${THUMB_SIZE_CLASS} shrink-0 items-center justify-center text-sm font-medium`} style={{ color: theme.node.muted }}>
                                                    {reference.kind === "audio" ? "♪" : reference.kind === "video" ? "▶" : reference.kind === "character" ? "👤" : "T"}
                                                </span>
                                            )}
                                            <span className="canvas-node-hover-composer-ref-meta flex w-0 min-w-11 flex-col justify-center overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-[cubic-bezier(0,0.8,0.1,1)] group-hover/ref:mx-2 group-hover/ref:max-w-24 group-hover/ref:w-auto group-hover/ref:opacity-100 data-[thumb-open]:mx-2 data-[thumb-open]:max-w-24 data-[thumb-open]:w-auto data-[thumb-open]:opacity-100">
                                                <span className="truncate text-xs leading-4" style={{ color: theme.node.text }}>{reference.label}</span>
                                                <span className="text-[10px] leading-3 opacity-55" style={{ color: theme.node.muted }}>{reference.kind === "audio" ? "Audio" : reference.kind === "video" ? "Video" : reference.kind === "character" ? "Character" : reference.kind === "text" ? "Text" : "Image"}</span>
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
                            style={{ color: theme.node.text, minHeight: promptMin, maxHeight: promptMax }}
                        >
                            {promptText}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
