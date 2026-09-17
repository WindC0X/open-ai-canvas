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

// 曲线分工(2026-09-17 第七轮定稿):
// 入场 flora 快攻 200ms — 响应快(90% 行程在前 1/3, 滑入干脆, 用户确认 OK)。
// 退场重力加速 200ms — flora 用在退场时前 65ms 就跳完 90% 行程 → 人眼读作"弹走消失"
// (用户: "取消hover时收缩动画不对"); 改 ease-in 加速(慢起加速沉底)。
// 挂件侧(overlays)坠落用重力曲线, 各归各职责。
const FLORA_EASE = "cubic-bezier(0, 0.8, 0.1, 1)";
const EXIT_EASE = "cubic-bezier(0.5, 0, 0.8, 0.4)";
const ENTER_MS = 200;
const EXIT_MS = 200;

// flora 实测对齐数值(09-15 逐轮校准的终值, 改动前先对照用户 flora 截图测量):
// prompt 区含被裁掉的 flora 工具栏行高(36px 并入), 面板总高 184px 与 flora 精确对齐。
const THUMB_SIZE_CLASS = "h-10 w-10"; // flora AssetChip size-10(40px)
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
                transition: `opacity ${show ? `${ENTER_MS}ms ${FLORA_EASE}` : `${EXIT_MS}ms ${EXIT_EASE}`}`,
            }}
        >
            <div
                style={{
                    // 坠落距离固定 160px(退场沉底消失, 入场从底缘滑入): 入场 flora 快攻,
                    // 退场 ease-in 加速沉底(用户 2026-09-17: flora 用在退场读作"弹走", 无收缩感)。
                    // 不用 calc(100%+1px): 信息态高度随引用/节点高变化, 固定距离保证动画不脱节。
                    transform: show ? "translateY(0)" : "translateY(160px)",
                    transition: `transform ${show ? `${ENTER_MS}ms ${FLORA_EASE}` : `${EXIT_MS}ms ${EXIT_EASE}`}`,
                }}
            >
                <div className="canvas-node-hover-composer-surface flex flex-col gap-2 px-3.5 py-3">
                    {/* flora SurfaceControlsOverlay(0_di9:7903)顺序: 引用行在前, 提示词在后。 */}
                    {references.length > 0 ? (
                        <div
                            className={`canvas-node-hover-composer-refs -mx-3.5 -my-3 overflow-x-auto overflow-y-hidden px-3.5 py-3 ${show ? "canvas-node-hover-composer-refs-mask" : ""}`}
                            data-canvas-wheel-scroll
                        >
                            <div className="flex min-w-0 items-center gap-1">
                                {references.map((reference) => {
                                    const src = referenceThumbSrc(reference);
                                    // flora 引用缩略(用户 hover 截图对): 静置 48px 方块 radius 12 纯缩略图;
                                    // hover 展开为胶囊 —— 名称 + 类型标签(Image/Text)淡入, 宽度过渡 200ms。
                                    // 隐藏态不解析 src: 常驻挂载 + lazy 救不了 opacity:0 的隐藏层,
                                    // 缩略图会在整个画布生命周期里被静默加载(节点数放大网络/解码开销)。
                                    const thumbSrc = show ? src : "";
                                    // flora AssetChip 源码对齐(0_di9:9952-9982):
                                    // ①外壳常驻透明, hover 才出现底色(rgba(58,58,58,.95))+pr-2 — 背景属壳不属缩略;
                                    // ②缩略 40px, hover 时 scale-0.8(缩小让位文字, 非放大); ③meta 只过渡
                                    // max-width 0→80px(内容自适应上限, 无 min-w/mx — 空底问题不存在);
                                    // ④flora 原版此处另有 ×Remove 按钮(absolute -left-1.5 -top-1.5, hover
                                    //   淡入, aria-label) — 未引入: 信息态是只读展示, 引用管理走选中态面板。
                                    //   圆角全 rounded-xl。
                                    return (
                                        <span
                                            key={reference.id}
                                            data-thumb-open={forceOpenId === reference.id || undefined}
                                            onPointerEnter={() => setForceOpenId(reference.id)}
                                            onPointerLeave={() => setForceOpenId((current) => (current === reference.id ? null : current))}
                                            className={`canvas-node-hover-composer-ref group/ref relative flex h-10 shrink-0 items-center gap-1 rounded-xl transition-[background-color,padding] duration-200 ease-out group-hover/ref:pr-2 data-[thumb-open]:pr-2`}
                                        >
                                            {thumbSrc ? (
                                                <img src={thumbSrc} alt={reference.label} draggable={false} loading="lazy" decoding="async" className={`${THUMB_SIZE_CLASS} shrink-0 origin-center overflow-hidden rounded-xl border object-cover transition-transform duration-200 ease-out group-hover/ref:scale-[0.8] data-[thumb-open]:scale-[0.8]`} style={{ borderColor: theme.node.stroke }} />
                                            ) : (
                                                <span className={`flex ${THUMB_SIZE_CLASS} shrink-0 origin-center items-center justify-center overflow-hidden rounded-xl border text-sm font-medium transition-transform duration-200 ease-out group-hover/ref:scale-[0.8] data-[thumb-open]:scale-[0.8]`} style={{ color: theme.node.muted, borderColor: theme.node.stroke, background: theme.toolbar.itemHover }}>
                                                    {reference.kind === "audio" ? "♪" : reference.kind === "video" ? "▶" : reference.kind === "character" ? "👤" : "T"}
                                                </span>
                                            )}
                                            <span className="canvas-node-hover-composer-ref-meta flex max-w-0 flex-col justify-center overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover/ref:max-w-20 group-hover/ref:opacity-100 data-[thumb-open]:max-w-20 data-[thumb-open]:opacity-100">
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
