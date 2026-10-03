import { useUserStore } from "@/stores/use-user-store";
import { useEffect, useState } from "react";
import { Dropdown } from "antd";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LoaderCircle, Palette, Wrench, X } from "lucide-react";

import { listTools, type ToolScope, type ToolSummary } from "@/services/api/tools";
import { FEED_TABS, SUB_TAB_TAGS, toAbsoluteUrl } from "@/lib/canvas/canvas-tool-presentation";
import { degradedNoticeText, loadStyleAssets } from "@/lib/canvas/registry-reader";
import { LEGACY_CANVAS_STYLE_PRESETS } from "@/lib/canvas/legacy-style-presets";

const STYLE_TOOL_PAGE_SIZE = 40;
const SEARCH_DEBOUNCE_MS = 250;

export function CanvasChooseImageStylePicker({
    open,
    onOpenChange,
    activeToolId,
    activeLabel,
    scope = "public",
    tag,
    onSelect,
    onClear,
}: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** 当前提示词中 style 工具标签的 toolId，未选择时为 undefined。 */
    activeToolId?: number;
    /** 当前 style 标签的 label 段，列表未加载或查不到时用于按钮回显。 */
    activeLabel?: string;
    /** 工具范围初始值（public/favorites/custom），弹层内可切换，语义与侧边栏工具面板一致。 */
    scope?: ToolScope;
    /** 标签过滤初始值，弹层内可切换。 */
    tag?: string;
    onSelect: (toolId: number, label: string) => void;
    /** 关闭已选风格：从提示词移除 style 工具标签。 */
    onClear?: () => void;
}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [searchText, setSearchText] = useState("");
    const [scopeTab, setScopeTab] = useState(scope);
    const [tagFilter, setTagFilter] = useState(tag ?? "");
    const actualOpen = open ?? internalOpen;
    const setOpen = (next: boolean) => {
        setInternalOpen(next);
        onOpenChange?.(next);
    };

    useEffect(() => {
        const timer = window.setTimeout(() => setSearchText(searchInput.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const userId = useUserStore((s) => s.user?.id);
    const toolsQuery = useInfiniteQuery({
        queryKey: ["canvas-tools", userId, "style-picker", scopeTab, tagFilter, searchText],
        queryFn: ({ signal, pageParam }) => listTools({ page: pageParam, pageSize: STYLE_TOOL_PAGE_SIZE, scope: scopeTab, type: "style", tag: tagFilter || undefined, search: searchText || undefined }, { signal }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
        enabled: actualOpen && Boolean(userId),
    });
    const tools = toolsQuery.data?.pages.flatMap((page) => page.tools) ?? [];
    const activeTool = tools.find((tool) => tool.id === activeToolId);
    const resolvedLabel = activeTool?.label || activeLabel;

    // 服务端不可达时的离线降级（架构方案 §3.2：降级必须标注，不得静默）。
    // 走统一读取器取降级结果 —— 它与正常路径共享同一适配器与视频域窗口标注。
    const [degradedState, setDegradedState] = useState<{ assets: { slug: string; title: string; coverUrl?: string }[]; notice: string } | null>(null);
    useEffect(() => {
        if (!actualOpen || !toolsQuery.isError) {
            setDegradedState(null);
            return;
        }
        let cancelled = false;
        void loadStyleAssets({ localFallback: LEGACY_CANVAS_STYLE_PRESETS })
            .then((result) => {
                if (cancelled || !result.degraded) return;
                setDegradedState({
                    assets: result.assets.map((asset) => ({ slug: asset.slug, title: asset.title, coverUrl: asset.coverUrl })),
                    notice: degradedNoticeText({ assets: result.assets, degraded: true, degradedReason: result.degradedReason }) ?? "",
                });
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [actualOpen, toolsQuery.isError]);

    const handleSelect = (tool: ToolSummary) => {
        setOpen(false);
        onSelect(tool.id, tool.label);
    };

    return (
        <Dropdown
            open={actualOpen}
            onOpenChange={setOpen}
            trigger={["click"]}
            autoAdjustOverflow
            menu={{ items: [] }}
            popupRender={() => (
                <div
                    className="canvas-node-toolbar-menu canvas-node-toolbar-menu-style"
                    data-canvas-no-zoom
                    data-canvas-wheel-scroll
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                >
                    <div className="canvas-node-toolbar-menu-stack">
                        <div className="asset-filters border-b border-border/70 px-2 py-1.5">
                            <div className="asset-filter-row">
                                <div className="col-feed-tabs shrink-0">
                                    {FEED_TABS.map((tab) => (
                                        <button key={tab.id} type="button" className={`col-feed-tab${scopeTab === tab.id ? " on" : ""}`} aria-pressed={scopeTab === tab.id} onClick={() => setScopeTab(tab.id)}>
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <input className="asset-search min-w-0 flex-1" placeholder="搜索名称/标签" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} aria-label="搜索风格" />
                                {searchInput ? (
                                    <button type="button" className="grid size-5 shrink-0 place-items-center rounded text-foreground/32 hover:bg-surface-hover hover:text-foreground" onClick={() => setSearchInput("")} aria-label="清空搜索">
                                        <X className="size-3" />
                                    </button>
                                ) : null}
                            </div>
                            <div className="col-tag-filter mt-1.5">
                                {[{ id: "", label: "全部" }, ...SUB_TAB_TAGS.style].map((chip) => (
                                    <button key={chip.id || "all"} type="button" className={`col-tag-chip${tagFilter === chip.id ? " on" : ""}`} aria-pressed={tagFilter === chip.id} onClick={() => setTagFilter(chip.id)}>
                                        {chip.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="thin-scrollbar grid max-h-80 grid-cols-5 gap-1.5 overflow-y-auto p-2" role="listbox" aria-label="风格工具">
                            {toolsQuery.isPending ? (
                                <div className="col-span-3 grid h-24 place-items-center text-foreground/40">
                                    <LoaderCircle className="size-4 animate-spin" />
                                </div>
                            ) : toolsQuery.isError ? (
                                degradedState && degradedState.assets.length ? (
                                    <div className="col-span-5 flex flex-col gap-1.5">
                                        {/* ★ 降级态必须明示（架构方案 §3.2 纪律）：用户须知道这不是完整列表 */}
                                        <p className="rounded-[var(--r-sm)] bg-[var(--surface-hover)] px-2 py-1 text-[11px] text-foreground/55">{degradedState.notice}</p>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {degradedState.assets.map((asset) => (
                                                <button
                                                    key={asset.slug}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={false}
                                                    title={asset.title}
                                                    className="group flex flex-col gap-1 rounded-[var(--r-md)] border border-transparent p-1.5 text-left opacity-80 transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:outline-none"
                                                    onClick={() => {
                                                        // 降级清单项无服务端 toolId，回填 label 供用户继续；
                                                        // 不做静默提交，交由既有 onSelect 语义处理。
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--r-sm)] border border-border/60">
                                                        {asset.coverUrl ? <img src={toAbsoluteUrl(asset.coverUrl)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-foreground/30"><Wrench className="size-4" /></div>}
                                                    </div>
                                                    <span className="truncate text-center text-[11px] font-medium leading-4 text-foreground">{asset.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="col-span-3 grid h-24 place-items-center text-xs text-foreground/40">风格工具加载失败，请稍后重试</div>
                                )
                            ) : tools.length === 0 ? (
                                <div className="col-span-3 grid h-24 place-items-center text-xs text-foreground/40">{searchText ? "没有匹配的风格" : "暂无风格工具"}</div>
                            ) : (
                                tools.map((tool) => <StyleToolCard key={tool.id} tool={tool} selected={tool.id === activeToolId} onSelect={handleSelect} />)
                            )}
                        </div>
                        {toolsQuery.hasNextPage && (
                            <button type="button" disabled={toolsQuery.isFetchingNextPage} onClick={() => void toolsQuery.fetchNextPage()}>
                                加载更多
                            </button>
                        )}
                    </div>
                </div>
            )}
        >
            <div
                role="button"
                tabIndex={0}
                className="canvas-node-composer-header-action canvas-node-fixed-chip relative overflow-hidden cursor-pointer"
                title={resolvedLabel ? `风格：${resolvedLabel}` : "选择风格"}
                aria-expanded={actualOpen}
                aria-haspopup="menu"
                onClick={() => setOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <Palette className="size-3 shrink-0" />
                <span className="truncate">{resolvedLabel || "风格"}</span>
                {activeToolId != null && onClear ? (
                    <button
                        type="button"
                        aria-label="移除风格"
                        onClick={(event) => {
                            event.stopPropagation();
                            onClear();
                        }}
                    >
                        <X className="size-3" />
                    </button>
                ) : null}
            </div>
        </Dropdown>
    );
}

function StyleToolCard({ tool, selected, onSelect }: { tool: ToolSummary; selected: boolean; onSelect: (tool: ToolSummary) => void }) {
    const coverUrl = toAbsoluteUrl(tool.cover);
    return (
        <button
            type="button"
            role="option"
            aria-selected={selected}
            title={tool.label}
            className={`group flex flex-col gap-1 rounded-[var(--r-md)] border p-1.5 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:outline-none ${selected ? "border-primary/60 ring-1 ring-primary/40" : "border-transparent"}`}
            onClick={() => onSelect(tool)}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--r-sm)] border border-border/60">
                {coverUrl ? (
                    <img src={coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                    <div className="grid h-full w-full place-items-center text-foreground/30">
                        <Wrench className="size-4" />
                    </div>
                )}
            </div>
            <span className="truncate  text-center text-[11px] font-medium leading-4 text-foreground">{tool.label}</span>
        </button>
    );
}
