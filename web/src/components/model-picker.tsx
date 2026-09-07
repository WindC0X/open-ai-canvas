import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Coins, Search } from "lucide-react";
import { Popover } from "antd";

import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { modelCapabilityConfigFor, videoDurationOptions } from "@/lib/model-capabilities";
import { formatPriceRange, modelQuoteRequest, normalizeTierResolution, priceTierSummaryLabel, priceTiersForCurrentSelection } from "@/lib/model-pricing";
import { compatibleModelInGroup, configuredModelDisplayName, groupModelsByDisplayName, modelCompatibilityError, resolveCompatibleModel, type ModelRequirements } from "@/lib/model-selection";
import { cn } from "@/lib/utils";
import { logicalModelFamilyOf, modelDisplayName, modelIcon, modelOptionName, PUBLIC_MODEL_CATALOG_ID, resolveModelChannel, selectableModelsByCapability, type AiConfig, type ModelCapability } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { ModelLogo } from "@/components/model-logo";
import { quoteLogicalModel, type LogicalModelQuote } from "@/services/api/logical-models";

type ModelPickerProps = {
    config: AiConfig;
    value?: string;
    onChange: (model: string) => void;
    capability?: ModelCapability;
    className?: string;
    popoverClassName?: string;
    fullWidth?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
    showSelectedPrice?: boolean;
    showOptionPrices?: boolean;
    variant?: "default" | "creation";
    requirements?: ModelRequirements;
    showConfiguredModelName?: boolean;
    /** 弹出方向;画布 composer 统一向上(topLeft),默认保持 bottomLeft 兼容既有调用。 */
    placement?: "topLeft" | "top" | "topRight" | "bottomLeft" | "bottom" | "bottomRight";
    /** flora 语法:模型列表顶部搜索过滤;默认关闭保持既有轻量列表。 */
    searchable?: boolean;
    /** 分组语法: family=按模型家族(前台创作页), channel=按渠道(画布, 默认)。 */
    grouping?: "channel" | "family";
};

export function ModelPicker({
    config,
    value,
    onChange,
    capability,
    className,
    popoverClassName,
    fullWidth = false,
    placeholder = "选择模型",
    onMissingConfig,
    showSelectedPrice = true,
    showOptionPrices = showSelectedPrice,
    variant = "default",
    placement: placementProp,
    requirements,
    showConfiguredModelName = false,
    searchable = false,
    grouping = "channel",
}: ModelPickerProps) {
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const pickerId = useId();
    // 双保险：即使 store merge 写出非法 theme，这里也兜底到 dark，避免 "reading 'node'" 崩溃
    const rawTheme = useThemeStore((state) => state.theme);
    const theme = (canvasThemes[rawTheme as keyof typeof canvasThemes] ?? canvasThemes.dark) as CanvasTheme;
    const [open, setOpen] = useState(false);
    // flora Providers 二级语法: L1=渠道/产商行钻取, L2=该组模型列表; 单组直接 L2, 搜索态展开全部
    const [drilledGroup, setDrilledGroup] = useState<string | null>(null);
    const [triggerWidth, setTriggerWidth] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const options = useMemo(() => Array.from(new Set(selectableModelsByCapability(config, capability).filter(Boolean))), [capability, config]);
    const optionGroups = useMemo(() => {
        // 分组语法: 前台(创作页)按模型家族聚(产商族, flora Providers 结构的数据诚实版);
        // 画布系统模型按渠道分组。options 已由当前有效渠道重建, 无法解析渠道的旧值直接丢弃。
        if (grouping === "family") {
            const groups = new Map<string, string[]>();
            for (const model of options) {
                const label = logicalModelFamilyOf(config, model);
                const bucket = groups.get(label);
                if (bucket) bucket.push(model);
                else groups.set(label, [model]);
            }
            return Array.from(groups.entries())
                .map(([label, models]) => ({ key: label, label, scope: "", models: groupModelsByDisplayName(config, models) }))
                .filter((group) => group.models.length);
        }
        const channelGroups = config.channels
            .map((channel) => ({
                key: channel.id,
                label: channel.name || "未命名渠道",
                scope: channel.id === PUBLIC_MODEL_CATALOG_ID ? "" : channel.scope === "system" ? "平台服务" : "我的模型",
                models: groupModelsByDisplayName(
                    config,
                    options.filter((model) => resolveModelChannel(config, model).id === channel.id),
                ),
            }))
            .filter((group) => group.models.length);
        return channelGroups;
    }, [config, grouping, options]);
    const storedCurrent = value?.trim() || "";
    // 参数档位会在选中模型后由调用方归一到其能力配置，不能因为旧模型留下的参数而禁止切换。
    const selectionRequirements = requirements ? { ...requirements, videoSeconds: undefined, imageSize: undefined, options: undefined } : undefined;
    const resolvedCurrent = resolveCompatibleModel(config, storedCurrent, selectionRequirements) || storedCurrent;
    // 旧画布可能保存过已下架或前端历史内置模型；它们不能重新进入当前可选目录。
    const current = options.includes(resolvedCurrent) ? resolvedCurrent : "";
    const currentPrice = modelMenuPrice(config, current, capability, false, requirements);
    const quoteRequest = useMemo(() => modelQuoteRequest(config, current, capability, requirements), [capability, config, current, requirements]);
    const [routeQuote, setRouteQuote] = useState<LogicalModelQuote | undefined>();
    const creationVariant = variant === "creation";

    useLayoutEffect(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const updateTriggerWidth = () => setTriggerWidth(Math.ceil(trigger.getBoundingClientRect().width));
        updateTriggerWidth();
        const observer = new ResizeObserver(updateTriggerWidth);
        observer.observe(trigger);
        return () => observer.disconnect();
    }, [className, fullWidth, showSelectedPrice, variant, value]);

    useEffect(() => {
        if (!showSelectedPrice || !creditsEnabled || !quoteRequest) {
            setRouteQuote(undefined);
            return;
        }
        const controller = new AbortController();
        setRouteQuote(undefined);
        quoteLogicalModel(quoteRequest.logicalModelID, quoteRequest.intent, controller.signal)
            .then((payload) => setRouteQuote(payload.quote))
            .catch(() => {
                if (!controller.signal.aborted) setRouteQuote(undefined);
            });
        return () => controller.abort();
    }, [creditsEnabled, quoteRequest, showSelectedPrice]);

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    useEffect(() => {
        if (!open) return;
        // 画布拖拽从 pointerdown 开始，须在捕获阶段关闭 Portal 菜单，避免菜单与触发器分离。
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        // 画布 wheel 缩放/平移移动触发器锚点, antd Popover 不跟随 transform —— 手势打断直接关(修漂移)。
        const closeOnCanvasWheel = (event: WheelEvent) => {
            if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
            setOpen(false);
        };
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        window.addEventListener("wheel", closeOnCanvasWheel, { capture: true, passive: true });
        return () => {
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
            window.removeEventListener("wheel", closeOnCanvasWheel, { capture: true });
        };
    }, [open]);

    const searchRef = useRef<HTMLInputElement>(null);
    const [searchText, setSearchText] = useState("");
    useEffect(() => {
        if (!open) {
            setSearchText("");
            setDrilledGroup(null);
        }
        else if (searchable) window.requestAnimationFrame(() => searchRef.current?.focus());
    }, [open, searchable]);
    const setPickerOpen = (nextOpen: boolean) => {
        if (nextOpen && !options.length) onMissingConfig?.();
        if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
        setOpen(nextOpen);
    };
    const focusMenuOption = (last = false) => {
        window.requestAnimationFrame(() => {
            const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
            const target = last ? buttons?.item((buttons?.length || 1) - 1) : buttons?.item(0);
            target?.focus();
        });
    };
    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        setPickerOpen(true);
        focusMenuOption(event.key === "ArrowUp");
    };
    const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
            return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
        if (!buttons.length) return;
        event.preventDefault();
        const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowUp" ? Math.max(0, activeIndex - 1) : Math.min(buttons.length - 1, activeIndex + 1);
        buttons[nextIndex]?.focus();
    };
    const normalizedSearch = searchText.trim().toLowerCase();
    const visibleGroups = normalizedSearch
        ? optionGroups
              .map((group) => ({
                  ...group,
                  models: group.models.filter((modelGroup) =>
                      modelGroup.models.some((model) => {
                          const label = pickerModelDisplayName(config, model, showConfiguredModelName);
                          const channelName = resolveModelChannel(config, model).name || "";
                          return label.toLowerCase().includes(normalizedSearch) || model.toLowerCase().includes(normalizedSearch) || channelName.toLowerCase().includes(normalizedSearch);
                      }),
                  ),
              }))
              .filter((group) => group.models.length)
        : optionGroups;
    // 二级形态: 搜索=平铺全部; 单组=直接L2; 多组且可搜索=钻取(flora Providers 语法); 其余平铺
    const drillMode: "flat" | "drill" | "single" | "search" = normalizedSearch ? "search" : !searchable ? "flat" : optionGroups.length > 1 ? (drilledGroup ? "single" : "drill") : "single";
    const activeGroup = optionGroups.find((group) => group.key === drilledGroup);
    const renderModelRow = (modelGroup: (typeof optionGroups)[number]["models"][number], groupLabel: string) => {
        const selected = modelGroup.models.includes(current);
        const model = compatibleModelInGroup(config, modelGroup.models, selectionRequirements, selected ? current : undefined);
        const displayModel = model || (selected ? current : modelGroup.models[0]);
        const disabledReason = model ? "" : modelCompatibilityError(config, modelGroup.models[0], selectionRequirements) || "当前输入不符合该模型能力";
        return (
            <button
                key={groupLabel + ":" + modelGroup.key}
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={Boolean(disabledReason)}
                disabled={Boolean(disabledReason)}
                title={disabledReason || pickerModelOptionLabel(config, displayModel, showConfiguredModelName)}
                className="canvas-model-picker-option disabled:cursor-not-allowed disabled:opacity-45"
                style={{ background: selected ? theme.toolbar.activeBg : "transparent", color: theme.node.text }}
                onClick={() => {
                    if (!model) return;
                    onChange(model);
                    setOpen(false);
                    window.requestAnimationFrame(() => triggerRef.current?.focus());
                }}
            >
                <ModelLabel
                    config={config}
                    model={displayModel}
                    capability={capability}
                    theme={theme}
                    creationVariant={creationVariant}
                    showConfiguredModelName={showConfiguredModelName}
                    showPrice={showOptionPrices && creditsEnabled}
                    disabledReason={disabledReason}
                />
                {selected ? <Check className="canvas-model-picker-option-check" style={{ color: theme.node.activeStroke }} /> : null}
            </button>
        );
    };
    const MenuLevelOne = () => (
        <>
            {optionGroups.map((group) => (
                <button
                    key={group.key}
                    type="button"
                    role="option"
                    aria-selected={current && group.models.some((modelGroup) => modelGroup.models.includes(current)) ? true : undefined}
                    className="canvas-model-picker-option canvas-model-picker-provider-row"
                    style={{ color: theme.node.text }}
                    onClick={() => setDrilledGroup(group.key)}
                >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ background: theme.toolbar.itemHover }}>
                        <ModelIcon config={config} model={group.models[0]?.models[0] || ""} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[var(--fs-label)] font-medium">{group.label}</span>
                    {group.scope ? (
                        <span className="shrink-0 text-[var(--fs-tiny)]" style={{ color: theme.node.muted }}>
                            {group.scope}
                        </span>
                    ) : null}
                    <ChevronRight className="size-4 shrink-0 opacity-45" aria-hidden="true" />
                </button>
            ))}
        </>
    );
    const MenuLevelTwo = () => (
        <>
            {optionGroups
                .filter((group) => !drilledGroup || group.key === drilledGroup)
                .map((group) => (
                    <section key={group.key} className="canvas-model-picker-group min-w-0 overflow-hidden">
                        <div className="canvas-model-picker-group-label" style={{ color: theme.node.muted }}>
                            <span className="truncate">{group.label}</span>
                            {group.scope ? (
                                <span className="shrink-0" style={{ color: theme.node.muted }}>
                                    {group.scope}
                                </span>
                            ) : null}
                        </div>
                        <div className="grid min-w-0 gap-1">{group.models.map((modelGroup) => renderModelRow(modelGroup, group.label))}</div>
                    </section>
                ))}
        </>
    );

    const content = (
        <div
            ref={menuRef}
            data-canvas-no-zoom
            className={cn("canvas-model-picker-menu max-w-[calc(100vw-24px)]", creationVariant ? "creation-model-picker-menu w-[360px]" : "w-[var(--panel-width-compact)]")}
            style={
                {
                    background: theme.node.panel,
                    color: theme.node.text,
                    "--canvas-model-picker-trigger-width": triggerWidth ? String(triggerWidth) + "px" : undefined,
                } as CSSProperties
            }
            role="listbox"
            aria-label={placeholder}
            onKeyDown={handleMenuKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {searchable ? (
                <div className="canvas-model-picker-search" onMouseDown={(event) => event.stopPropagation()}>
                    <Search className="canvas-model-picker-search-icon" aria-hidden="true" />
                    <input
                        ref={searchRef}
                        type="text"
                        role="searchbox"
                        aria-label="搜索模型"
                        placeholder="搜索兼容模型"
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpen(false);
                                triggerRef.current?.focus();
                            }
                            event.stopPropagation();
                        }}
                    />
                </div>
            ) : null}
            {creationVariant && !searchable ? (
                <div className="creation-model-picker-heading">
                    <span>选择模型</span>
                    {current ? <strong>{pickerModelDisplayName(config, current, showConfiguredModelName)}</strong> : null}
                </div>
            ) : null}
            {drillMode === "drill" ? (
                <>
                    <div className="canvas-model-picker-group-label" style={{ color: theme.node.muted }}>
                        <span className="truncate">{placeholder}</span>
                    </div>
                    <MenuLevelOne />
                </>
            ) : (
                <>
                    {drillMode === "single" && optionGroups.length > 1 ? (
                        <button type="button" className="canvas-model-picker-back" onMouseDown={(event) => event.stopPropagation()} onClick={() => setDrilledGroup(null)}>
                            <ArrowLeft className="size-3.5" aria-hidden="true" />
                            <span>全部模型</span>
                        </button>
                    ) : null}
                    <MenuLevelTwo />
                </>
            )}
            {drillMode === "flat" && !visibleGroups.length ? (
                <div className="canvas-model-picker-empty" style={{ color: theme.node.muted }}>
                    {emptyModelLabel(config, capability)}
                </div>
            ) : null}
        </div>
    );

    return (
        <div className={cn(fullWidth ? "w-full min-w-0" : "w-fit max-w-full")} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <Popover
                open={open}
                onOpenChange={setPickerOpen}
                trigger="click"
                placement={placementProp ?? "bottomLeft"}
                arrow={false}
                content={content}
                classNames={{
                    root: cn("canvas-model-picker-popover", creationVariant && "creation-model-picker-popover", popoverClassName),
                    container: cn("canvas-composer-popover-surface", creationVariant && "creation-model-picker-surface"),
                    content: "canvas-composer-popover-content",
                }}
            >
                <button
                    ref={triggerRef}
                    type="button"
                    className={cn("canvas-composer-model-picker", fullWidth ? "w-full" : "max-w-full", className)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label={placeholder}
                    title={current ? pickerModelOptionLabel(config, current, showConfiguredModelName) : placeholder}
                    onKeyDown={handleTriggerKeyDown}
                >
                    <span className="canvas-model-picker-label flex min-w-0 items-center gap-1.5">
                        <span className="canvas-model-picker-trigger-icon" style={{ background: theme.toolbar.itemHover }}>
                            <ModelIcon config={config} model={current} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{current ? (creationVariant ? pickerModelDisplayName(config, current, showConfiguredModelName) : pickerModelOptionLabel(config, current, showConfiguredModelName)) : placeholder}</span>
                        {showSelectedPrice && creditsEnabled ? <ModelPrice price={currentPrice} quote={routeQuote} compact /> : null}
                    </span>
                    <ChevronDown className={cn("canvas-model-picker-chevron", open && "is-open")} aria-hidden="true" />
                </button>
            </Popover>
        </div>
    );
}

function emptyModelLabel(config: AiConfig, capability?: ModelCapability) {
    const label = capability === "image" ? "生图" : capability === "video" ? "视频" : capability === "text" ? "文本" : capability === "audio" ? "音频" : "";
    if (capability && config.models.length) return `暂无支持当前输入的${label}模型`;
    return config.models.length ? `暂无匹配的${label}模型` : "当前没有可用模型，请联系管理员或检查模型配置";
}

// flora 徽章行(能力诚实版): 视频时长区间+分辨率档, 图片分辨率档; 无能力不造徽章
function videoCapabilityChips(config: AiConfig, model: string): string[] {
    const profile = modelCapabilityConfigFor(config, model).video;
    if (!profile) return [];
    const durations = videoDurationOptions(profile);
    const durationChip = profile.duration.selection === "enum" ? `${durations[0]}s` : `${profile.duration.min || durations[0]}-${profile.duration.max || durations[durations.length - 1]}s`;
    return [durationChip, ...profile.resolutions.slice(0, 2).map((item) => item.toUpperCase())];
}

function imageCapabilityChips(config: AiConfig, model: string): string[] {
    const profile = modelCapabilityConfigFor(config, model).image;
    if (!profile) return [];
    const tiers = profile.size.values.filter((value) => /^\d+[kK]$/i.test(value.trim())).slice(0, 2);
    return tiers.map((tier) => tier.toUpperCase());
}

function ModelLabel({
    config,
    model,
    capability,
    theme,
    creationVariant,
    showConfiguredModelName,
    showPrice,
    disabledReason,
}: {
    config: AiConfig;
    model: string;
    capability?: ModelCapability;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    creationVariant: boolean;
    showConfiguredModelName: boolean;
    showPrice: boolean;
    disabledReason?: string;
}) {
    const meta = modelMenuMeta(model, capability);
    const channel = resolveModelChannel(config, model);
    const logicalCost = channel.modelCosts?.find((item) => item.model === modelOptionName(model));
    const logicalSpec = logicalCost?.logicalCapabilitySpec;
    const videoProfile = capability === "video" ? modelCapabilityConfigFor(config, model).video : undefined;
    const capabilitySummary =
        disabledReason ||
        logicalCost?.description?.trim() ||
        (logicalSpec ? logicalCapabilitySummary(logicalSpec) : videoProfile ? `${formatDurationSummary(videoProfile)} · ${videoProfile.resolutions.map((item) => item.toUpperCase()).join("/")}` : meta.description);
    // flora P51-030 权威: logo 24x24 radius8 白.1 容器, 名 14px/350, 能力徽章 18px pill(bg 白.1/12px/500), 描述 12px/350 #b4b4b4
    const chips = capability === "video" ? videoCapabilityChips(config, model) : capability === "image" ? imageCapabilityChips(config, model) : [];
    return (
        <span className="flex w-full min-w-0 items-center gap-2 overflow-hidden py-0">
            <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: "var(--canvas-model-badge-bg, rgba(144,144,144,.14))" }}>
                <ModelIcon config={config} model={model} />
            </span>
            <span className="min-w-0 flex-1 overflow-hidden">
                <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate text-[var(--fs-body)] font-normal leading-none">{pickerModelDisplayName(config, model, showConfiguredModelName)}</span>
                    <span className="flex shrink-0 items-center gap-0.5">
                        {chips.map((chip) => (
                            <span key={chip} className="canvas-model-picker-chip">
                                {chip}
                            </span>
                        ))}
                    </span>
                </span>
                <span className="mt-1 block truncate text-[var(--fs-tiny)] font-normal" style={{ color: theme.node.muted }} title={capabilitySummary}>
                    {capabilitySummary}
                </span>
            </span>
            {showPrice ? <ModelPrice price={modelMenuPrice(config, model, capability, true)} chip /> : null}
        </span>
    );
}

function logicalCapabilitySummary(spec: NonNullable<NonNullable<AiConfig["channels"][number]["modelCosts"]>[number]["logicalCapabilitySpec"]>) {
    const operationLabels: Record<string, string> = {
        text_to_video: "文生视频",
        image_to_video: "图生视频",
        reference_to_video: "全模态参考",
        audio_to_video: "音频生视频",
        extend: "视频续写",
        inpaint: "局部修改",
        replace_element: "元素替换",
        camera_motion: "运镜调整",
        style_transfer: "风格迁移",
    };
    const inputLabels: Record<string, { label: string; unit: string }> = {
        image: { label: spec.capability === "text" ? "图片理解" : "参考图片", unit: "张" },
        video: { label: spec.capability === "text" ? "视频理解" : "参考视频", unit: "个" },
        audio: { label: "参考音频", unit: "个" },
        mask: { label: "蒙版", unit: "张" },
    };
    const optionLabels: Record<string, string> = {
        size: "画面比例",
        aspectRatio: "画面比例",
        quality: "生成质量",
        count: "输出数量",
        videoSeconds: "视频时长",
        duration: "视频时长",
        vquality: "输出分辨率",
        resolution: "输出分辨率",
        audioVoice: "音色",
        audioFormat: "音频格式",
        audioSpeed: "语速",
    };
    const values: string[] = [];
    values.push(...(spec.operations || []).map((operation) => operationLabels[operation] || operation));
    for (const [name, constraint] of Object.entries(spec.inputs || {})) {
        if (constraint.max <= 0) continue;
        const definition = inputLabels[name];
        if (!definition) continue;
        values.push(spec.capability === "text" ? `支持${definition.label}` : `${definition.label}最多 ${constraint.max}${definition.unit}`);
    }
    for (const [name, constraint] of Object.entries(spec.options || {})) {
        const label = optionLabels[name];
        if (!label) continue;
        if (constraint.values?.length) values.push(`${label} ${constraint.values.map(publicScalarLabel).join("/")}`);
        else if (constraint.min !== undefined && constraint.max !== undefined) values.push(`${label} ${constraint.min}-${constraint.max}`);
    }
    return values.slice(0, 2).join(" · ") || "智能匹配当前输入";
}

function publicScalarLabel(value: unknown) {
    if (value === true) return "支持";
    if (value === false) return "关闭";
    return String(value);
}

function formatDurationSummary(profile: NonNullable<ReturnType<typeof modelCapabilityConfigFor>["video"]>) {
    const values = videoDurationOptions(profile);
    if (profile.duration.selection === "enum") return values.map((item) => `${item}s`).join("/");
    return `${profile.duration.min || values[0]}-${profile.duration.max || values[values.length - 1]}s`;
}

type ModelMenuPrice = { kind: "tiers"; label: string; compactLabel: string; title: string } | { kind: "estimate" } | { kind: "fixed"; value: number; unit: "次" | "秒" | "百万 Token" };

function modelMenuPrice(config: AiConfig, model: string, capability?: ModelCapability, summary = false, requirements?: ModelRequirements): ModelMenuPrice | null | undefined {
    if (!model) return undefined;
    const channel = resolveModelChannel(config, model);
    const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(model));
    if (!cost) return channel.scope === "system" ? null : undefined;
    if (cost.pricePolicy === "channel") {
        const tiers = cost.logicalPriceTiers || [];
        if (!tiers.length) return null;
        const matched = summary ? tiers : priceTiersForCurrentSelection(tiers, capability, config, requirements);
        return channelTierPriceSummary(matched.length ? matched : tiers, tiers);
    }
    if (cost.billingMode === "token") return { kind: "estimate" };
    return { kind: "fixed", value: cost.unitPriceMicrocredits / 1_000_000, unit: cost.billingMode === "per_second" ? "秒" : "次" };
}

function pickerModelDisplayName(config: AiConfig, model: string, showConfiguredModelName: boolean) {
    return showConfiguredModelName ? configuredModelDisplayName(config, model) : modelDisplayName(config, model);
}

function pickerModelOptionLabel(config: AiConfig, model: string, showConfiguredModelName: boolean) {
    const displayName = showConfiguredModelName ? configuredModelDisplayName(config, model) : modelDisplayName(config, model);
    const channel = resolveModelChannel(config, model);
    return channel.scope === "system" ? displayName : `${displayName}（${channel.name}）`;
}

function channelTierPriceSummary(
    visibleTiers: NonNullable<NonNullable<AiConfig["channels"][number]["modelCosts"]>[number]["logicalPriceTiers"]>,
    allTiers: NonNullable<NonNullable<AiConfig["channels"][number]["modelCosts"]>[number]["logicalPriceTiers"]>,
): Extract<ModelMenuPrice, { kind: "tiers" }> {
    const label = priceTierSummaryLabel(visibleTiers);
    return {
        kind: "tiers",
        label,
        compactLabel: label,
        title: `系统规格价格：${allTiers.map((tier) => `${tierSpecificationLabel(tier)} ${tierPriceLabel(tier)}`).join("；")}`,
    };
}

function tierResolutionLabel(value: string) {
    const normalized = normalizeTierResolution(value);
    return normalized === "*" ? "全部分辨率" : normalized.toUpperCase();
}

function tierDurationLabel(seconds: number) {
    return seconds > 0 ? `${seconds} 秒` : "全部时长";
}

function tierSpecificationLabel(tier: NonNullable<NonNullable<AiConfig["channels"][number]["modelCosts"]>[number]["logicalPriceTiers"]>[number]) {
    const selector = tier.selector || {};
    const operationLabels: Record<string, string> = { text_to_image: "文生图", image_to_image: "图生图", text_to_video: "文生视频", image_to_video: "图生视频", video_to_video: "视频生视频" };
    const operation = selector.operation && selector.operation !== "*" ? operationLabels[selector.operation] || selector.operation : "";
    const details = [
        operation,
        selector.quality && selector.quality !== "*" ? selector.quality.toUpperCase() : "",
        selector.size && selector.size !== "*" ? selector.size : "",
        tier.resolution !== "*" ? tierResolutionLabel(tier.resolution) : "",
        tier.videoSeconds ? tierDurationLabel(tier.videoSeconds) : "",
        selector.imageCount && selector.imageCount !== "*" ? `${selector.imageCount} 张参考图` : "",
    ].filter(Boolean);
    return details.length ? details.join(" / ") : "默认规格";
}

function tierPriceLabel(tier: NonNullable<NonNullable<AiConfig["channels"][number]["modelCosts"]>[number]["logicalPriceTiers"]>[number]) {
    if (tier.billingMode === "token") return "按量预估";
    return `${formatPriceRange([tier.unitPriceMicrocredits / 1_000_000], tier.billingMode === "per_second" ? "积分/秒" : "积分")}`;
}

function ModelPrice({ price, quote, compact = false, chip = false }: { price: ModelMenuPrice | null | undefined; quote?: LogicalModelQuote; compact?: boolean; chip?: boolean }) {
    if (quote) {
        const amount = (quote.amountMicrocredits / 1_000_000).toLocaleString("zh-CN", { maximumFractionDigits: 3 });
        return chip ? (
            <span className="canvas-model-picker-chip tabular-nums" title={`${quote.estimated ? "预计" : "本次"}消耗 ${amount} 积分`}>
                {amount}
            </span>
        ) : (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[var(--fs-tiny)] font-medium tabular-nums opacity-60" title={`${quote.estimated ? "预计" : "本次"}消耗 ${amount} 积分`}>
                <Coins className="size-3" />
                {compact ? amount : `${amount} 积分`}
            </span>
        );
    }
    if (price === undefined) return null;
    if (price === null) return compact ? null : <span className="shrink-0 text-[var(--fs-tiny)] text-foreground/40">未配置</span>;
    if (price.kind === "tiers") {
        return chip ? (
            <span className="canvas-model-picker-chip tabular-nums" title={price.title}>
                {price.label}
            </span>
        ) : (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[var(--fs-tiny)] font-medium tabular-nums opacity-60" title={price.title}>
                <Coins className="size-3" />
                {compact ? price.compactLabel : price.label}
            </span>
        );
    }
    if (price.kind === "estimate") {
        return <span className="canvas-model-picker-chip">按量</span>;
    }
    const value = price.value.toLocaleString("zh-CN", { maximumFractionDigits: compact || chip ? 3 : 6 });
    return chip ? (
        <span className="canvas-model-picker-chip tabular-nums" title={`每${price.unit}消耗 ${value} 积分`}>
            {value}
        </span>
    ) : (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[var(--fs-tiny)] font-medium tabular-nums opacity-60" title={`每${price.unit}消耗 ${value} 积分`}>
            <Coins className="size-3" />
            {value}/{price.unit}
        </span>
    );
}

function modelMenuMeta(model: string, capability?: ModelCapability): { description: string; time?: string } {
    const name = modelOptionName(model).toLowerCase();
    if (capability === "image") {
        if (name.includes("nano banana") || name.includes("nanobanana") || name.includes("imagen")) return { description: "Gemini 高质量图片生成，适合角色和商业成片" };
        if (name.includes("nano") || name.includes("pro")) return { description: "高质量图片生成，适合角色和商业成片" };
        if (name.includes("seedream")) return { description: "快速出图，适合批量探索风格" };
        if (name.includes("gpt") || name.includes("image")) return { description: "通用图片模型，提示词理解稳定" };
        return { description: "图片生成模型" };
    }
    if (capability === "video") {
        if (name.includes("veo") || name.includes("omni flash") || name.includes("omni-flash")) return { description: "Gemini 镜头生成与图生视频，适合成片流程", time: "3m" };
        if (name.includes("seedance") || name.includes("sora")) return { description: "镜头生成与图生视频，适合成片流程", time: "3m" };
        return { description: "视频生成模型", time: "3m" };
    }
    if (capability === "audio") return { description: "语音、音效或音乐生成", time: "20s" };
    if (name.includes("claude")) return { description: "长文本、推理与创意写作", time: "10s" };
    if (name.includes("gemini")) return { description: "多模态理解与快速文本生成", time: "10s" };
    if (name.includes("deepseek")) return { description: "推理、代码和结构化文本", time: "10s" };
    return { description: capability === "text" ? "文本生成模型" : "当前模型", time: "10s" };
}

export function ModelIcon({ config, model, icon }: { config?: AiConfig; model?: string; icon?: string }) {
    return <ModelLogo icon={icon || (config && model ? modelIcon(config, model) : "")} size={14} className="opacity-80" />;
}
