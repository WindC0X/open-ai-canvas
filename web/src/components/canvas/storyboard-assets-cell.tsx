import { useEffect, useMemo, useState } from "react";
import { Modal, Popover } from "antd";
import { Image as ImageIcon, Music2, Play, Plus, UserRound, X } from "lucide-react";

import { Tooltip } from "@/components/ui/base/tooltip";

import { canvasNodeVideoPreviewUrl } from "@/lib/canvas/canvas-media-preview";
import { MAX_ROW_ASSET_BINDINGS, buildStoryboardAssetCatalog, storyboardAssetRoleForNode } from "@/lib/canvas/canvas-storyboard-assets";
import { isStoryboardPreviewAsset } from "@/lib/canvas/canvas-storyboard-materializer";
import { resolveMediaUrl } from "@/services/file-storage";
import { CanvasNodeType, type CanvasNodeData, type StoryboardAssetBinding } from "@/types/canvas";

// 弹层一律 portal 到 body: antd 默认挂在 trigger 父元素(=分镜行内, 即 world layer 子树),
// 定位写 style 会触发挂件几何的 worldMutations -> setState -> 重渲染循环(Maximum update depth 实证),
// 与模型菜单 flyout 改 root portal 同一教训(e25876bc)。
const POPUP_CONTAINER = () => document.body;

const ROLE_LABELS: Record<StoryboardAssetBinding["role"], string> = {
    character: "角色",
    environment: "场景",
    wardrobe: "服装",
    prop: "道具",
    weapon: "武器",
    style: "风格",
    motion: "动态",
    audio: "音频",
};

type Props = {
    bindings: StoryboardAssetBinding[];
    nodes: CanvasNodeData[];
    limit?: number;
    /** 传入时启用手动绑定交互(R17 chip 语法: Remove 按钮 + 添加入口); 缺省保持纯只读。 */
    onAddAsset?: (nodeId: string) => void;
    onRemoveAsset?: (nodeId: string) => void;
};

export function StoryboardAssetsCell({ bindings, nodes, limit = 4, onAddAsset, onRemoveAsset }: Props) {
    const [previewNode, setPreviewNode] = useState<CanvasNodeData | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const assets = bindings.map((binding) => ({ binding, node: nodeById.get(binding.nodeId) })).filter((item) => !item.node || isStoryboardPreviewAsset(item.node));
    const visible = assets.slice(0, limit);
    const hiddenCount = Math.max(0, assets.length - visible.length);
    const interactive = Boolean(onAddAsset && onRemoveAsset);
    // 候选目录: buildStoryboardAssetCatalog 已过滤输出类节点与空资产; 这里再排除已绑定与失效节点。
    const candidates = useMemo(() => {
        if (!interactive) return [];
        const bound = new Set(bindings.map((binding) => binding.nodeId));
        return buildStoryboardAssetCatalog(nodes).filter((item) => !bound.has(item.id));
    }, [bindings, interactive, nodes]);

    if (!assets.length && !interactive) return <span className="text-[var(--fs-caption)] text-foreground/35">未关联</span>;
    return (
        <>
            <div className="flex min-w-0 items-center gap-1.5" aria-label={`已关联 ${assets.length} 个资产`}>
                {visible.map(({ binding, node }) => (
                    <div key={binding.nodeId} className="group relative shrink-0">
                        <Tooltip title={`${node?.title || "资产已失效"} · ${ROLE_LABELS[binding.role]}`}>
                            <button
                                type="button"
                                disabled={!node}
                                className="relative grid size-9 place-items-center overflow-hidden rounded-md border border-foreground/10 bg-foreground/[0.035] text-foreground/45 outline-none transition enabled:hover:border-foreground/30 enabled:hover:text-foreground/70 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed"
                                aria-label={`预览${node?.title || "失效资产"}`}
                                onMouseDown={(event) => event.stopPropagation()}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (node) setPreviewNode(node);
                                }}
                            >
                                {node ? <AssetThumbnail node={node} /> : <ImageIcon className="size-4" />}
                                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/65 px-1 text-[8px] leading-3 text-white">{ROLE_LABELS[binding.role].slice(0, 1)}</span>
                            </button>
                        </Tooltip>
                        {interactive && node ? (
                            // R17: remove 图标默认隐藏, hover/focus 显现; 移除仅解除行内绑定不删节点。
                            <button
                                type="button"
                                aria-label={`移除 ${node.title || "资产"} 引用`}
                                className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full border border-foreground/20 bg-background text-foreground/60 opacity-0 shadow-sm outline-none transition group-hover:opacity-100 group-focus-within:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                                onMouseDown={(event) => event.stopPropagation()}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRemoveAsset?.(binding.nodeId);
                                }}
                            >
                                <X className="size-2.5" />
                            </button>
                        ) : null}
                    </div>
                ))}
                {hiddenCount ? <span className="shrink-0 text-[var(--fs-caption)] font-medium text-foreground/45">+{hiddenCount}</span> : null}
                {interactive ? (
                    <Popover
                        trigger="click"
                        open={pickerOpen}
                        onOpenChange={setPickerOpen}
                        placement="bottomLeft"
                        getPopupContainer={POPUP_CONTAINER}
                        content={
                            <div className="flex max-h-64 w-56 flex-col gap-1 overflow-y-auto" onWheel={(event) => event.stopPropagation()}>
                                <div className="px-2 pb-1 pt-0.5 text-[10px] text-foreground/40">{assets.length ? "绑定画布资产（角色/图片/视频/音频）" : "连接角色图像节点，或点击选择画布资产"}</div>
                                {candidates.length ? candidates.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none transition hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                                        onClick={() => {
                                            onAddAsset?.(item.id);
                                            setPickerOpen(false);
                                        }}
                                    >
                                        <span className="grid size-6 shrink-0 place-items-center rounded bg-foreground/[0.06] text-foreground/55">
                                            {item.type === "character" ? <UserRound className="size-3.5" /> : item.type === "audio" ? <Music2 className="size-3.5" /> : item.type === "video" ? <Play className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                        <span className="shrink-0 text-[10px] text-foreground/40">{ROLE_LABELS[storyboardAssetRoleForNode(nodeById.get(item.id)!) || "style"]?.slice(0, 1) || "资"}</span>
                                    </button>
                                )) : (
                                    <span className="px-2 py-3 text-center text-[var(--fs-caption)] text-foreground/45">画布上暂无可绑定的资产节点（图片/视频/音频/角色）</span>
                                )}
                            </div>
                        }
                    >
                        <button
                            type="button"
                            aria-label={bindings.length >= MAX_ROW_ASSET_BINDINGS ? `每镜最多关联 ${MAX_ROW_ASSET_BINDINGS} 个资产` : "添加资产绑定"}
                            disabled={bindings.length >= MAX_ROW_ASSET_BINDINGS}
                            title={assets.length ? "绑定画布资产（角色/图片/视频/音频）" : "连接角色图像节点，或点击选择画布资产"}
                            className="grid size-9 shrink-0 place-items-center rounded-md border border-dashed border-foreground/15 text-foreground/40 outline-none transition enabled:hover:border-foreground/35 enabled:hover:text-foreground/70 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                            onMouseDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        >
                            <Plus className="size-4" />
                        </button>
                    </Popover>
                ) : null}
            </div>
            <AssetPreviewModal node={previewNode} onClose={() => setPreviewNode(null)} />
        </>
    );
}

function AssetThumbnail({ node }: { node: CanvasNodeData }) {
    const videoPreview = canvasNodeVideoPreviewUrl(node);
    const source = useNodeMediaSource(node.type === CanvasNodeType.Video ? null : node);
    if (node.type === CanvasNodeType.Audio) return <Music2 className="size-4" />;
    if (node.metadata?.workflowKind === "character" && !source) return <UserRound className="size-4" />;
    if (node.type === CanvasNodeType.Video) {
        return videoPreview ? (
            <>
                <img src={videoPreview} alt="" loading="lazy" decoding="async" draggable={false} className="object-cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <span className="absolute inset-0 grid place-items-center bg-black/15"><Play className="size-3.5 fill-white text-white" /></span>
            </>
        ) : <Play className="size-4" />;
    }
    // inline 尺寸: dev 环境实测 Tailwind base 层 img{height:auto} 压过 utilities 的 size-full(层序异常),
    // 缩略图按原图比例破格溢出分镜行(用户截图 9:16 竖图实证); inline 声明不受层序影响。
    return source ? <img src={source} alt="" loading="lazy" decoding="async" draggable={false} className="object-cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon className="size-4" />;
}

function AssetPreviewModal({ node, onClose }: { node: CanvasNodeData | null; onClose: () => void }) {
    const source = useNodeMediaSource(node);
    return (
        <Modal title={node?.title || "资产预览"} open={Boolean(node)} onCancel={onClose} footer={null} width={880} centered destroyOnHidden>
            {node ? (
                <div className="grid min-h-56 place-items-center overflow-hidden rounded-lg bg-black/[0.035] p-3 dark:bg-white/[0.035]" data-canvas-no-zoom>
                    {node.type === CanvasNodeType.Video && source ? <video src={source} controls autoPlay playsInline className="max-h-[68vh] max-w-full rounded-md" />
                        : node.type === CanvasNodeType.Audio && source ? <audio src={source} controls autoPlay className="w-full max-w-xl" />
                            : source ? <img src={source} alt={node.title || "资产预览"} className="max-h-[68vh] max-w-full object-contain" />
                                : <span className="text-sm text-foreground/45">当前资产没有可预览的媒体内容</span>}
                </div>
            ) : null}
        </Modal>
    );
}

function useNodeMediaSource(node: CanvasNodeData | null) {
    const fallback = node ? node.metadata?.workflowKind === "character"
        ? node.metadata.characterCoverUrl || ""
        : node.type === CanvasNodeType.Drawing
            ? node.metadata?.drawingPreviewUrl || node.metadata?.content || ""
            : node.metadata?.content || "" : "";
    const storageKey = node?.metadata?.storageKey;
    const [source, setSource] = useState(fallback);
    useEffect(() => {
        let cancelled = false;
        setSource(fallback);
        if (storageKey) void resolveMediaUrl(storageKey, fallback).then((url) => {
            if (!cancelled) setSource(url || fallback);
        }).catch(() => {
            if (!cancelled) setSource(fallback);
        });
        return () => { cancelled = true; };
    }, [fallback, storageKey]);
    return source;
}
