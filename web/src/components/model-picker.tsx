import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, Coins, Image as ImageIcon, Info, ListMusic, Pin, Search, Type as TypeIcon, Video as VideoIcon } from "lucide-react";
import { Popover, Tooltip } from "antd";

import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { modelCapabilityConfigFor, normalizeModelCapabilityConfig, videoDurationOptions } from "@/lib/model-capabilities";
import { formatPriceRange, modelQuoteRequest, normalizeTierResolution, priceTierSummaryLabel, priceTiersForCurrentSelection, modelQuoteDescription } from "@/lib/model-pricing";
import { compatibleModelInGroup, configuredModelDisplayName, groupModelsByDisplayName, modelCompatibilityError, resolveCompatibleModel, type ModelRequirements } from "@/lib/model-selection";
import { cn } from "@/lib/utils";
import { logicalModelFamilyOf, modelDisplayName, modelIcon, modelOptionName, PUBLIC_MODEL_CATALOG_ID, resolveModelChannel, selectableModelsByCapability, type AiConfig, type ModelCapability } from "@/stores/use-config-store";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { ModelLogo, modelProviderTitleOf } from "@/components/model-logo";
import { quoteLogicalModel, type CapabilitySpec, type LogicalModelQuote, quoteModel } from "@/services/api/logical-models";

// flora 语法: 模型置顶(Pinned models 组)。影策无账号级收藏服务, 前端 localStorage 持久化(按浏览器/用户代理隔离)。
const MODEL_PICKER_PINNED_KEY = "canvas-model-picker-pinned";
/** 供给域延伸浮层类名(hover 归属遮挡门豁免域): 指针在模型菜单/L2 flyout 上时
    composer 保持 full(与设置气泡钉 full 同语义)。归属侧按此常量匹配, 改类名两处同步。 */
export const MODEL_PICKER_POPOVER_CLASS = "canvas-model-picker-popover";
export const MODEL_PICKER_FLYOUT_CLASS = "canvas-model-picker-flyout";
function loadPinnedModels(): string[] {
    try {
        const raw = localStorage.getItem(MODEL_PICKER_PINNED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
        return [];
    }
}

import { groupModelsForPicker, isDirectSystemModel, modelChannelLabel } from "@/lib/model-picker-groups";

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
    /** 特化生成场景(如扩图)的候选集合同: 不满足 requirements 的模型直接不进列表, 而非灰显
     *  (扩图里选了也无法执行, 灰显徒增误选成本)。默认 false 保持灰显语义。 */
    hideIncompatible?: boolean;
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
    hideIncompatible = false,
}: ModelPickerProps) {
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const pickerId = useId();
    // 双保险：即使 store merge 写出非法 theme，这里也兜底到 dark，避免 "reading 'node'" 崩溃
    const rawTheme = useActiveTheme();
    const theme = (canvasThemes[rawTheme as keyof typeof canvasThemes] ?? canvasThemes.dark) as CanvasTheme;
    const [open, setOpen] = useState(false);
    // 收起动画期间不得注入 ant-popover-hidden(display:none 会瞬间抹掉 canvas-panel-out 收起动画,
    // 模型菜单"关=瞬闪消失"); hidden 必须走 props 注入(rc-motion 启动 leave 时按 props 重算 root
    // className, DOM 副作用加的类会被整体抹掉), 因此用 afterOpenChange 门控: 动画走完再隐。
    // 后台 tab 冻结时 afterOpenChange 不触发, 面板停在收起首帧(隐藏 tab 不可见), 恢复后动画补完。
    const [hiddenAfterLeave, setHiddenAfterLeave] = useState(true);
    useEffect(() => {
        if (open) setHiddenAfterLeave(false);
        else if (typeof document !== "undefined" && document.hidden) setHiddenAfterLeave(true);
    }, [open]);
    const [pinnedModels, setPinnedModels] = useState<string[]>(loadPinnedModels);
    const togglePinned = (model: string) => {
        setPinnedModels((prev) => {
            const next = prev.includes(model) ? prev.filter((item) => item !== model) : [model, ...prev];
            try {
                localStorage.setItem(MODEL_PICKER_PINNED_KEY, JSON.stringify(next));
            } catch {
                // localStorage 不可用时置顶仅本次会话生效
            }
            return next;
        });
    };
    // flora Providers 语法: 分组行 hover 右侧悬浮展开该组模型(flyout)
    const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
    const [flyoutPos, setFlyoutPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const flyoutRef = useRef<HTMLDivElement>(null);
    const flyoutCloseTimer = useRef<number | null>(null);
    // 锚点元素留存: antd 菜单 zoom 入场动画期间行的 rect 是中间态(整体向触发器压缩),
    // mouseenter 此时读到的坐标会让 flyout 沉底(2026-09-19 用户实测"子菜单悬浮输入框上")。
    // 动画结束后按锚点终态位置重测校正。
    const flyoutAnchorRef = useRef<HTMLElement | null>(null);
    const openFlyout = (groupKey: string, anchor: HTMLElement) => {
        if (flyoutCloseTimer.current) window.clearTimeout(flyoutCloseTimer.current);
        // 横向锚定用 L1 菜单容器(而非行): Provider 行在部分变体下不满宽, 行右缘落在 L1 的
        // 空白列里, L2 会直接叠进 L1(2026-09-19 用户实测)。容器右缘才是 L1 的真实边界。
        const menuRect = menuRef.current?.getBoundingClientRect() || anchor.getBoundingClientRect();
        const flyoutWidth = 384;
        // 缝隙 2px(2026-09-19 用户拍板): flora 二级菜单视觉上贴住 L1, 8px 分离缝被读成两个断开面板。
        const x = menuRect.right + 2 + flyoutWidth > window.innerWidth - 12 ? menuRect.left - flyoutWidth - 2 : menuRect.right + 2;
        // y 初值=顶边贴 anchor; 首开时 ref 尚未挂载读不到真实高度(读恒为 0, 永远判"放得下"),
        // 底部溢出的向上翻转改由挂载后的 useLayoutEffect 实测校正(2026-09-19 Agent 面板实测)。
        flyoutAnchorRef.current = anchor;
        setFlyoutPos({ x: Math.max(12, x), y: Math.max(12, menuRect.top - 8) });
        setFlyoutGroup(groupKey);
    };
    const scheduleFlyoutClose = () => {
        if (flyoutCloseTimer.current) window.clearTimeout(flyoutCloseTimer.current);
        // 关闭容差 280ms(原 160): 真实用户从 L1 行移向右侧 flyout 要穿过 8px 定位 gap,
        // 慢移/犹豫超过旧容差时 flyout 已卸载, 随后点击落空 —— 表现即 "L2 行点击不选择"
        // (复现非确定的根因: 与鼠标速度相关; L1 直出行常驻无此窗, 故 L1 恒可选)。
        flyoutCloseTimer.current = window.setTimeout(() => setFlyoutGroup(null), 280);
    };
    const cancelFlyoutClose = () => {
        if (flyoutCloseTimer.current) window.clearTimeout(flyoutCloseTimer.current);
        flyoutCloseTimer.current = null;
    };
    useEffect(() => {
        if (!open) {
            setFlyoutGroup(null);
        }
    }, [open]);
    // flyout 真实高度挂载后才可知: 底部溢出(面板 composer 场景)时向上翻, 底边贴视口底。
    // 钳制公式与渲染位置无关(布局高度), 一帧收敛 —— 旧减法项(overflow>0 ? overflow+4 : 0)
    // 以上一帧渲染位测溢出, 在溢出边界两值间跳变 → 双稳态无限振荡(2026-09-20 用户实测
    // "靠近底部 L2 不停上下抽动", 通用缺陷不限扩图)。
    const flyoutClampedY = (anchorTop: number) => {
        const flyoutHeight = flyoutRef.current?.offsetHeight ?? 0;
        return Math.max(12, Math.min(anchorTop - 8, window.innerHeight - 12 - flyoutHeight));
    };
    useLayoutEffect(() => {
        if (!flyoutGroup) return;
        const el = flyoutRef.current;
        if (!el) return;
        const anchor = flyoutAnchorRef.current;
        if (anchor) setFlyoutPos((pos) => ({ ...pos, y: flyoutClampedY(anchor.getBoundingClientRect().top) }));
        // 菜单入场动画(~200ms)期间锚点 rect 在漂移: 逐帧按锚点终态重贴, 连续两帧稳定即停。
        let stable = 0;
        let raf = 0;
        const tick = () => {
            const anchor = flyoutAnchorRef.current;
            if (!anchor || !anchor.isConnected) return;
            const ar = anchor.getBoundingClientRect();
            setFlyoutPos((pos) => {
                const mr = menuRef.current?.getBoundingClientRect() || ar;
                const x = Math.max(12, mr.right + 2 + 384 > window.innerWidth - 12 ? mr.left - 384 - 2 : mr.right + 2);
                const y = flyoutClampedY(ar.top);
                if (Math.abs(pos.x - x) < 1 && Math.abs(pos.y - y) < 1) { stable += 1; return pos; }
                stable = 0;
                return { x, y };
            });
            if (stable < 2) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flyoutClampedY 读 ref, 非响应式; y 写入不入依赖防回环
    }, [flyoutGroup, flyoutPos.x]);
    // flora Providers 二级语法: L1=渠道/产商行钻取, L2=该组模型列表; 单组直接 L2, 搜索态展开全部
    const [triggerWidth, setTriggerWidth] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // 参数档位会在选中模型后由调用方归一到其能力配置，不能因为旧模型留下的参数而禁止切换。
    const selectionRequirements = useMemo(
        () => (requirements ? { ...requirements, videoSeconds: undefined, imageSize: undefined, options: undefined } : undefined),
        [requirements],
    );
    const options = useMemo(() => {
        const base = Array.from(new Set(selectableModelsByCapability(config, capability).filter(Boolean)));
        if (!hideIncompatible || !selectionRequirements) return base;
        return base.filter((model) => Boolean(compatibleModelInGroup(config, [model], selectionRequirements)));
    }, [capability, config, hideIncompatible, selectionRequirements]);
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
        const groupedChannels = new Map<string, string>();
        for (const model of options) {
            groupedChannels.set(model, resolveModelChannel(config, model).id);
        }
        // 前台目录(managed 渠道)无产商标字段, 按模型配置的 logo 分组(2026-09-09 用户指令);
        // logo 同属一个产商即同组, 组名取 lobehub 图标人读名; 未配置 logo(默认)的模型沉底不分组。
        const isManagedChannel = options.every((model) => groupedChannels.get(model) === PUBLIC_MODEL_CATALOG_ID) && options.length > 0;
        const managedIconOf = (model: string) => resolveModelChannel(config, model).modelCosts?.find((item) => item.model === modelOptionName(model))?.icon || "";
        const providerGroups = new Map<string, string[]>();
        const defaultLogoModels: string[] = [];
        if (isManagedChannel) {
            for (const model of options) {
                const icon = managedIconOf(model);
                if (!icon) {
                    defaultLogoModels.push(model);
                    continue;
                }
                const bucket = providerGroups.get(icon);
                if (bucket) bucket.push(model);
                else providerGroups.set(icon, [model]);
            }
        }
        const managedProviderGroups = isManagedChannel
            ? Array.from(providerGroups.entries())
                  .map(([icon, models]) => ({
                        key: `provider:${icon}`,
                        label: modelProviderTitleOf(icon) || icon,
                        scope: "",
                        models: groupModelsByDisplayName(config, models),
                    }))
                  .filter((group) => group.models.length)
            : [];
        const channelGroups = config.channels
            .map((channel) => ({
                key: channel.id,
                label: channel.name || "未命名渠道",
                scope: "",
                models: groupModelsByDisplayName(
                    config,
                    options.filter((model) => groupedChannels.get(model) === channel.id),
                ),
            }))
            .filter((group) => group.models.length && group.key !== PUBLIC_MODEL_CATALOG_ID);
        // flora: 未归属任何渠道分组的模型沉底为通用 Models 组, 不静默丢弃(按同一渠道解析口径判定)
        const ungrouped = groupModelsByDisplayName(
            config,
            isManagedChannel
                ? defaultLogoModels
                : options.filter((model) => !channelGroups.some((group) => group.key === groupedChannels.get(model))),
        );
        const tail = ungrouped.length ? [{ key: "__ungrouped", label: "Models", scope: "", models: ungrouped }] : [];
        return [...managedProviderGroups, ...channelGroups, ...tail];
    }, [config, grouping, options]);
    const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
    const storedCurrent = value?.trim() || "";
    const resolvedCurrent = isDirectSystemModel(config, storedCurrent) ? storedCurrent : resolveCompatibleModel(config, storedCurrent, selectionRequirements) || storedCurrent;
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
        quoteModel(quoteRequest, controller.signal)
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
        // flyoutPointer 标记: pointerdown 落点在 flyout 内时置位(pointerup 清除), 供
        // setPickerOpen 拦截 antd useWinClick 的同步关闭 —— antd 在 mousedown 捕获阶段调
        // onOpenChange(false), 此时行 React handler 尚未派发, 受控 flush 会让行 fiber 在
        // 派发前分离 → L2 行点击"只关不选"(2026-09-11 实测)。
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            // flyout portal 不在 menuRef 子树内, 不纳入判定会被本关闭器当外部点击同步关掉,
            // 导致 flyout 行 mousedown 在事件派发中途 fiber 分离, 行内 onChange 选择丢失(2026-09-09 实测)。
            const inFlyout = flyoutRef.current?.contains(target) ?? false;
            flyoutPointerRef.current = inFlyout;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target) || inFlyout) return;
            setOpen(false);
        };
        const clearFlyoutPointer = () => { flyoutPointerRef.current = false; };
        // 画布 wheel 缩放/平移移动触发器锚点, antd Popover 不跟随 transform —— 手势打断直接关(修漂移)。
        const closeOnCanvasWheel = (event: WheelEvent) => {
            if ((event.target instanceof Node && menuRef.current?.contains(event.target)) || (event.target instanceof Node && flyoutRef.current?.contains(event.target))) return;
            setOpen(false);
        };
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        window.addEventListener("pointerup", clearFlyoutPointer, true);
        window.addEventListener("wheel", closeOnCanvasWheel, { capture: true, passive: true });
        return () => {
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
            window.removeEventListener("pointerup", clearFlyoutPointer, true);
            window.removeEventListener("wheel", closeOnCanvasWheel, { capture: true });
        };
    }, [open]);

    const searchRef = useRef<HTMLInputElement>(null);
    const [searchText, setSearchText] = useState("");
    useEffect(() => {
        if (!open) {
            setSearchText("");
            // flyout 残留清理: Esc/外部点击等关闭路径不经过行内 mousedown, 必须在此统一收
            setFlyoutGroup(null);
        }
        else if (searchable) window.requestAnimationFrame(() => searchRef.current?.focus());
    }, [open, searchable]);
    // flyout 行 mousedown 的时间戳: 该时间窗内忽略 antd 的"外部点击关闭"。
    // 否则 mousedown 关菜单→行卸载→落空 click 掉到触发器→菜单重开(选择后残留)。
    const lastFlyoutMouseDownRef = useRef(0);
    // pointerdown 落点是否在 flyout 内: setPickerOpen 据此拦截 antd useWinClick 的同步关闭,
    // 保证 flyout 行 mousedown 的 React 派发不被受控 flush 打断(2026-09-11 issue-1 根修)。
    const flyoutPointerRef = useRef(false);
    const setPickerOpen = (nextOpen: boolean) => {
        // 行 mousedown 后的时间窗内忽略 antd 的开/关切换:
        // mousedown 即选择+关菜单 → 行因选中/置顶重排被 detach → 落空 click 掉到触发器
        // 会请求 reopen(true) 造成"选择后残留"的镜像缺陷, 双向都挡。
        if (Date.now() - lastFlyoutMouseDownRef.current < 400) return;
        // antd useWinClick 对 flyout 行点击会请求关闭(flyout 不在其 popupEle 判定内):
        // 此关闭若放行, 受控 flush 会在行 mousedown 派发前分离行 fiber → 只关不选。拦截之。
        if (!nextOpen && flyoutPointerRef.current) return;
        if (nextOpen && !options.length) onMissingConfig?.();
        if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
        setOpen(nextOpen);
    };
    const focusMenuOption = (last = false) => {
        window.requestAnimationFrame(() => {
            const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-model-picker-item]:not(:disabled)');
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
        if (event.key === "ArrowLeft" && activeGroupKey !== null) {
            event.preventDefault();
            setActiveGroupKey(null);
            focusMenuOption();
            return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-model-picker-item]:not(:disabled)'));
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
    // flora 权威: L1 恒平铺模型行(分组标=渠道), 无渠道钻取首层; 搜索=过滤平铺
    const drillMode: "flat" | "search" = normalizedSearch ? "search" : "flat";
    const renderModelRow = (modelGroup: (typeof optionGroups)[number]["models"][number], groupLabel: string) => {
        const selected = modelGroup.models.includes(current);
        const model = compatibleModelInGroup(config, modelGroup.models, selectionRequirements, selected ? current : undefined);
        const displayModel = model || (selected ? current : modelGroup.models[0]);
        const disabledReason = model ? "" : modelCompatibilityError(config, modelGroup.models[0], selectionRequirements) || "当前输入不符合该模型能力";
        const pinned = pinnedModels.includes(displayModel);
        const mediaTypes = modelMediaTypes(config, displayModel, capability);
        const priceForChip = showOptionPrices && creditsEnabled ? modelMenuPrice(config, displayModel, capability, true) : null;
        return (
            <div key={groupLabel + ":" + modelGroup.key} className="canvas-model-picker-rowgroup">
                <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={Boolean(disabledReason)}
                    disabled={Boolean(disabledReason)}
                    title={disabledReason || pickerModelOptionLabel(config, displayModel, showConfiguredModelName)}
                    className="canvas-model-picker-option disabled:cursor-not-allowed disabled:opacity-45"
                    style={{ color: theme.node.text }}
                    onMouseDown={() => {
                        // flora 语义: mousedown 即选中并收起(2026-09-07 实测定案: 选择会触发行重排 detach,
                        // 等到 click 再关的话 click 落在已分离节点上 → setOpen(false) 永不执行 → 残留)。
                        // 落空 click 掉到触发器的重开请求由 setPickerOpen 时间窗双向拦截。
                        lastFlyoutMouseDownRef.current = Date.now();
                        if (!model) return;
                        onChange(model);
                        // L2 flyout 是独立 createPortal, 不受 Popover root 类控制, 必须显式卸载
                        setFlyoutGroup(null);
                        setOpen(false);
                        // 隐藏走 props 注入(见 classNames.root 的 ant-popover-hidden): rc-motion
                        // 启动 leave 时会按 props 重算 root className, 任何 DOM 副作用加的类都会被
                        // 整体抹掉(2026-09-08 实测根因), props 注入则重算后仍在。后台 tab rAF 停摆时
                        // leave 冻结也只冻在一个 display:none 的节点上, 无可见残留。
                        triggerRef.current?.focus();
                    }}
                    onClick={() => {
                        // 键盘 Enter 路径(click 事件): 与 mousedown 幂等。flyout 卸载必须显式:
                        // 只依赖 !open effect 会在下一帧才清, L2 残留可见一帧以上。
                        if (!model) return;
                        onChange(model);
                        setFlyoutGroup(null);
                        setOpen(false);
                    }}
                >
                    <span className="canvas-model-picker-option-body">
                        <ModelLabel
                            config={config}
                            model={displayModel}
                            capability={capability}
                            theme={theme}
                            creationVariant={creationVariant}
                            showConfiguredModelName={showConfiguredModelName}
                            showPrice={false}
                            disabledReason={disabledReason}
                            inlineBadges={(
                                <>
                                    {priceForChip ? <ModelPrice price={priceForChip} chip /> : null}
                                    {mediaTypes.map((item) => (
                                        <span key={item.kind} className="canvas-model-picker-chip canvas-model-picker-chip-icon" title={item.label}>
                                            {item.icon}
                                        </span>
                                    ))}
                                </>
                            )}
                        />
                        {selected ? <Check className="canvas-model-picker-option-check" style={{ color: theme.node.activeStroke }} /> : null}
                    </span>
                </button>
                <button
                    type="button"
                    className={cn("canvas-model-picker-pin", pinned && "is-pinned")}
                    aria-label={pinned ? "取消置顶" : "置顶模型"}
                    aria-pressed={pinned}
                    title={pinned ? "取消置顶" : "置顶模型"}
                    style={{ color: pinned ? theme.node.activeStroke : theme.node.muted }}
                    onPointerDown={(event) => {
                        // flora 语义: pin 在 pointerdown 即生效(八轮定案): 事件流顺序 pointerdown →
                        // mousedown → mouseup → click, antd useWinClick 在 window 捕获层收 mousedown
                        // 先置 open=false, 任意后续关渲染(flyout 卸载/菜单 leave)都会让更晚阶段的
                        // handler 失效 —— 只有 pointerdown 阶段(最先派发)必然先于一切关闭逻辑执行。
                        // 七轮用 mousedown 在 L1 实测通过但 L2 真机仍失效(用户 2026-09-09 复测),
                        // 证明 mousedown 阶段同样会被吞, 提前到 pointerdown。
                        event.stopPropagation();
                        togglePinned(displayModel);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                >
                    <Pin className="size-3.5" />
                </button>
            </div>
        );
    };
    const pinnedGroups = useMemo(() => {
        const rows: { key: string; models: (typeof optionGroups)[number]["models"] }[] = [];
        for (const group of optionGroups) {
            const models = group.models.filter((modelGroup) => modelGroup.models.some((model) => pinnedModels.includes(model)));
            if (models.length) rows.push({ key: group.key, models });
        }
        return rows;
    }, [optionGroups, pinnedModels]);

    // 模型行序列: pinned 组置顶 → 渠道分组; 搜索态平铺全部匹配
    const bodyGroups = normalizedSearch
        ? visibleGroups
              .map((group) => {
                  const models = group.models.filter((modelGroup) => modelGroup.models.some((model) => pinnedModels.includes(model)));
                  const rest = group.models.filter((modelGroup) => !models.includes(modelGroup));
                  return { group, models: [...models, ...rest] };
              })
              .filter((item) => item.models.length)
        : null;

    const MenuBody = () => (
        <>
            {pinnedGroups.length && !normalizedSearch ? (
                <section className="canvas-model-picker-group min-w-0 overflow-hidden">
                    <div className="canvas-model-picker-group-label" style={{ color: theme.node.muted }}>
                        <span className="truncate">Pinned models</span>
                        {/* flora 语法: 组标带 ⓘ + tooltip(2026-09-09 用户截图补漏) */}
                        <Tooltip title="收藏的模型会显示在这里" mouseEnterDelay={0.15}>
                            <Info className="canvas-model-picker-group-info" aria-label="置顶说明" />
                        </Tooltip>
                    </div>
                    <div className="grid min-w-0 gap-0.5">{pinnedGroups.flatMap((item) => item.models.map((modelGroup) => renderModelRow(modelGroup, "pinned")))}</div>
                </section>
            ) : null}
            {!pinnedGroups.length && !normalizedSearch ? (
                /* flora 空态语法(用户截图 2026-09-09): 与 Providers 同构的 group section,
                   标题+ⓘ 在上, placeholder 文本在下; 不再包独立卡片壳(旧 pinned-empty
                   的背景+缩进让空态看似被收进一个盒子, 与 Providers 不平级) */
                <section className="canvas-model-picker-group min-w-0 overflow-hidden">
                    <div className="canvas-model-picker-group-label" style={{ color: theme.node.muted }}>
                        <span className="truncate">Pinned models</span>
                        <Tooltip title="收藏的模型会显示在这里" mouseEnterDelay={0.15}>
                            <Info className="canvas-model-picker-group-info" aria-label="置顶说明" />
                        </Tooltip>
                    </div>
                    <div className="canvas-model-picker-pinned-empty-hint" style={{ color: theme.node.muted }}>
                        收藏的模型会显示在这里
                    </div>
                </section>
            ) : null}
            {bodyGroups
                ? bodyGroups.map((item) => (
                      <div key={item.group.key} className="grid min-w-0 gap-0.5">
                          {item.models.map((modelGroup) => renderModelRow(modelGroup, item.group.label))}
                      </div>
                  ))
                : (
                      <>
                          {/* flora 权威: 渠道区上方有 Providers 组标(影策语义=系统渠道分组) + ⓘ(2026-09-09 补漏) */}
                          <section className="canvas-model-picker-group min-w-0 overflow-hidden">
                              <div className="canvas-model-picker-group-label" style={{ color: theme.node.muted }}>
                                  <span className="truncate">Providers</span>
                                  <Tooltip title="模型按产商/渠道分组" mouseEnterDelay={0.15}>
                                      <Info className="canvas-model-picker-group-info" aria-label="分组说明" />
                                  </Tooltip>
                              </div>
                              <div className="grid min-w-0 gap-0.5">
                                  {optionGroups
                                      .filter((group) => group.key !== "__ungrouped")
                                      .map((group) => (
                                          <div
                                              key={group.key}
                                              className="canvas-model-picker-provider-row"
                                              onMouseEnter={(event) => openFlyout(group.key, event.currentTarget)}
                                              onMouseLeave={scheduleFlyoutClose}
                                              onFocus={(event) => openFlyout(group.key, event.currentTarget)}
                                          >
                                              <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-[8px]" style={{ background: "var(--canvas-model-badge-bg, rgba(144,144,144,.14))" }}>
                                                  <ModelIcon config={config} model={group.models[0]?.models[0] || ""} />
                                              </span>
                                              <span className="min-w-0 flex-1 truncate text-[var(--fs-body)]">{group.label}</span>
                                              <ChevronRight className="size-4 shrink-0 opacity-45" aria-hidden="true" />
                                          </div>
                                      ))}
                              </div>
                          </section>
                          {optionGroups
                              .filter((group) => group.key === "__ungrouped")
                              .map((group) => (
                                  <section key={group.key} className="canvas-model-picker-group min-w-0 overflow-hidden">
                                      <div className="canvas-model-picker-group-label" style={{ color: theme.node.muted }}>
                                          <span className="truncate">Models</span>
                                      </div>
                                      <div className="grid min-w-0 gap-0.5">{group.models.map((modelGroup) => renderModelRow(modelGroup, group.label))}</div>
                                  </section>
                              ))}
                      </>
                  )}
        </>
    );

    const content = (
        <div
            ref={menuRef}
            data-canvas-no-zoom
            // 上游 v1.3 的两级品牌双栏菜单(is-brand-list/is-model-list)与我们 flora flyout 分组菜单在同一区域平行演进,
            // merge 冲突已取我们侧 —— 此处恢复我们侧根 className, 剔除上游泄漏的 className 三元, 避免两套布局 CSS 杂交。
            className={cn("canvas-model-picker-menu max-w-[calc(100vw-24px)]", creationVariant ? "creation-model-picker-menu w-[360px]" : "w-[var(--panel-width-compact)]")}
            style={
                {
                    /* 背景不在此层: 容器层(surface)承载 flora .9 玻璃, 内容层实色会把毛玻璃糊死(亮底不透的根因之一) */
                    color: theme.node.text,
                    "--canvas-model-picker-trigger-width": triggerWidth ? String(triggerWidth) + "px" : undefined,
                } as CSSProperties
            }
            role="listbox"
            aria-label={placeholder}
            onKeyDown={handleMenuKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseLeave={scheduleFlyoutClose}
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
            {/* 选择模型标题已删(2026-09-19 用户拍板): 触发按钮本身已显示当前模型, 双重展示冗余。 */}
            {/* MenuBody 以函数调用内联: 若写成 <MenuBody />, 组件标识每 render 新建,
                整棵菜单子树随之重挂载(任意 state 变化丢滚动位置/重置 hover)。 */}
            {MenuBody()}
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
                afterOpenChange={(next) => {
                    // leave 动画结束后才允许 hidden 类生效(见 hiddenAfterLeave 注释);
                    // destroyOnHidden 仍在 open 翻 false 后的动画结束点卸载内容层, 残留防线不变。
                    if (!next) setHiddenAfterLeave(true);
                }}
                trigger="click"
                placement={placementProp ?? "bottomLeft"}
                arrow={false}
                /* 关闭即卸载(不走 leave 动画): rc-motion 的 leave 依赖 rAF/transitionend, 在后台 tab
                   会冻结成 "选行后菜单残留直到下一次外部点击" 的肉眼 bug(2026-09-08 实测);
                   antd6 Popover 会用 { motionName: zoom-big } 重置传入的 motion 布尔开关(动画禁不掉),
                   destroyOnHidden 走 Portal autoDestroy 卸载链, 与动画帧完全无关。 */
                destroyOnHidden
                content={content}
                classNames={{
                    root: cn(MODEL_PICKER_POPOVER_CLASS, creationVariant && "creation-model-picker-popover", popoverClassName, !open && hiddenAfterLeave && "ant-popover-hidden"),
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
            {/* flyout portal 必须挂在组件根级而不是 antd Popover content 内:
                content 在 open=false 的 leave 期间被 antd 冻结(motion 期间不向 content 下发
                渲染更新, 后台 tab rAF 停摆时 leave 永不完成 → content 永不销毁), 选行后
                flyoutGroup=null 的 portal 卸载永远没有渲染机会, DOM 滞留 body(2026-09-09
                fiber 实测: hooks 已提交 null 而陈旧 flyout 仍 connected)。根级挂载让 portal
                的卸载跟随本组件自身 commit, 与 antd 动画生命周期解耦。挂载点仍是
                document.body(position:fixed 定位语义不变)。 */}
            {createPortal(
                flyoutGroup ? (
                    <div
                        ref={flyoutRef}
                        className={cn(
                            MODEL_PICKER_FLYOUT_CLASS + " canvas-model-picker-menu",
                            // 与 L1 同源: 画布 composer 传 variant=creation 时 L1 菜单挂 creation 类,
                            // flyout 也必须同挂, 否则两套容器/行外观(padding/gap/字号) → L1/L2 不一致(2026-09-08 实测)
                            creationVariant && "creation-model-picker-menu",
                        )}
                        style={{ left: flyoutPos.x, top: flyoutPos.y }}
                        onMouseEnter={cancelFlyoutClose}
                        onMouseLeave={scheduleFlyoutClose}
                        role="listbox"
                    >
                        {optionGroups
                            .filter((group) => group.key === flyoutGroup)
                            .map((group) => (
                                <div key={group.key} className="grid min-w-0 gap-0.5">
                                    {group.models.map((modelGroup) => renderModelRow(modelGroup, group.label))}
                                </div>
                            ))}
                    </div>
                ) : null,
                // portal 卸载仅由 flyoutGroup 驱动, 不叠加 open:
                // antd useWinClick 在 window 捕获阶段收 mousedown, flyout 挂 body 在其 popupEle
                // 判定外 → 行 mousedown 先被 antd 置 open=false。若渲染条件含 open, 同一 dispatch
                // 内 flush 会中途卸载 flyout、行 fiber 分离, 行自己的 onMouseDown(onChange 选择)
                // 被 React 跳过 → 只关不选(2026-09-09 rowHit 实测)。仅由 flyoutGroup 驱动时行
                // handler 正常跑完: onChange + setFlyoutGroup(null) 主动卸载; Esc/外部点击等
                // 其它关闭路径由上方 !open effect 清 flyoutGroup 兑底。 */}
                // 挂载点 body → #root(2026-09-11 issue-1 根修): React 19 委托 listener 在
                // createRoot container 上派发最可靠; #root 顶层无 transform 祖先,
                // position:fixed 定位语义不变, z-index 1200 已在 CSS 声明。
                document.getElementById("root") as HTMLElement,
            )}
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
    label,
    requirements,
    showPrice,
    disabledReason,
    inlineBadges,
}: {
    config: AiConfig;
    model: string;
    capability?: ModelCapability;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    creationVariant: boolean;
    showConfiguredModelName: boolean;
    label?: string;
    requirements?: ModelRequirements;
    showPrice: boolean;
    disabledReason?: string;
    inlineBadges?: ReactNode;
}) {
    const meta = modelMenuMeta(model, capability);
    const channel = resolveModelChannel(config, model);
    const logicalCost = channel.modelCosts?.find((item) => item.model === modelOptionName(model));
    const logicalSpec = logicalCost?.logicalCapabilitySpec;
    const videoProfile = capability === "video" ? modelCapabilityConfigFor(config, model).video : undefined;
    const capabilitySummary =
        disabledReason ||
        logicalCost?.description?.trim() ||
        (isDirectSystemModel(config, model) ? "" : logicalSpec ? logicalCapabilitySummary(logicalSpec) : videoProfile ? `${formatDurationSummary(videoProfile)} · ${videoProfile.resolutions.map((item) => item.toUpperCase()).join("/")}` : meta.description);
    // flora 权威行: logo squircle24-r8; 第一行=名字+消耗+媒体类型(同行, 名字右侧); 第二行=描述 12px/350
    // (2026-09-07 用户指令: 徽章在模型名右边同行; 名字降部不得截断; 描述溢出 hover 滚动)
    const subtitleRef = useRef<HTMLSpanElement | null>(null);
    const [subtitleOverflow, setSubtitleOverflow] = useState(false);
    useLayoutEffect(() => {
        const el = subtitleRef.current;
        if (!el) return;
        setSubtitleOverflow(el.scrollWidth > el.clientWidth + 1);
    }, [capabilitySummary, creationVariant]);
    return (
        // flex-1(basis 0%+grow)而非 w-full: 上游合并带入 option-body 的 width:100% 后, flex 嵌套两层时
        // 百分比 width 解析失效(indefinite), w-full 塌到 min-content 32px, title 被裁 0(模型名不可见, 徽标挤到行左);  flex-1 脱离百分比链, 实测恢复。
        <span className="flex flex-1 min-w-0 items-center gap-2 py-0">
            <span className="canvas-model-picker-logo grid size-6 shrink-0 place-items-center overflow-hidden rounded-[8px]" style={{ background: "var(--canvas-model-badge-bg, rgba(144,144,144,.14))" }}>
                <ModelIcon config={config} model={model} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                    <span className="canvas-model-picker-title min-w-0 truncate text-[var(--fs-body)] font-[350] leading-[1.4]" style={{ color: theme.node.text }}>{pickerModelDisplayName(config, model, showConfiguredModelName)}</span>
                    {inlineBadges}
                </span>
                <span
                    ref={subtitleRef}
                    className={cn("canvas-model-picker-subtitle mt-0.5 block truncate text-xs font-[350]", subtitleOverflow && "is-overflow")}
                    style={{ color: theme.node.muted }}
                    title={capabilitySummary}
                >
                    <span className="canvas-model-picker-subtitle-inner">{capabilitySummary}</span>
                </span>
            </span>
            {showPrice ? <ModelPrice price={modelMenuPrice(config, model, capability, true)} chip /> : null}
        </span>
    );
}

// flora 媒体类型徽章(2026-09-09 用户截图定案): 图标=模型可接受的输入模态, tooltip 形如 "Accepts text input"。
// flora 实测: Claude(纯文本输出)显示 text+video+image(它接受三种输入), 图像模型显示 text+image →
// 图标不表达输出类型。text(提示词输入)恒显; image/video/audio 按实际配置诚实声明：
// - managed 逻辑模型: spec.inputs[kind].max>0；无声明则按 capability 兜底。
// - 渠道模型(2026-09-10 用户反馈问题二): 读 capabilityConfig.references.max*——后端「最大参考图=0」
//   时不得再显示图像图标(旧兑底 capability===kind 无视配置，是误导显示的根因)。
function modelMediaTypes(config: AiConfig, model: string, capability?: ModelCapability): { kind: string; label: string; icon: ReactNode }[] {
    const channel = resolveModelChannel(config, model);
    const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(model));
    const spec = cost?.logicalCapabilitySpec;
    const configured = cost?.capabilityConfig ? normalizeModelCapabilityConfig(cost.capabilityConfig) : undefined;
    const entries: { kind: string; label: string; icon: ReactNode }[] = [];
    const push = (kind: string, label: string, icon: ReactNode) => {
        if (!entries.some((item) => item.kind === kind)) entries.push({ kind, label, icon });
    };
    push("text", "可输入文本", <TypeIcon className="size-3" />);
    const declaredInputs = spec?.inputs && Object.keys(spec.inputs).length > 0 ? spec.inputs : undefined;
    // 渠道模型: 引用上限由后台 capabilityConfig 决定（0=不可输入该模态）。
    // 映射随请求能力分派: image 请求看 image.references, video 请求看 video.references, text 请求(图片/视频理解)看 text.references。
    const configuredMax = (kind: "image" | "video" | "audio"): number => {
        if (capability === "image") return kind === "image" ? configured?.image?.references.maxImages ?? 0 : 0;
        if (capability === "video") {
            const refs = configured?.video?.references;
            return kind === "image" ? refs?.maxImages ?? 0 : kind === "video" ? refs?.maxVideos ?? 0 : kind === "audio" ? refs?.maxAudios ?? 0 : 0;
        }
        if (capability === "text") {
            // 文本模型的图片/视频理解徽章按渠道 capabilityConfig 正常显示
            // (2026-09-19 用户实测: 后台配置最大参考图片数 16, 列表却不显示"可输入图像")。
            const refs = configured?.text?.references;
            return kind === "image" ? refs?.maxImages ?? 0 : kind === "video" ? refs?.maxVideos ?? 0 : kind === "audio" ? 0 : 0;
        }
        return 0;
    };
    const inputKinds: Exclude<CapabilitySpec["capability"], "text">[] = ["image", "video", "audio"];
    for (const kind of inputKinds) {
        let accepts: boolean;
        if (declaredInputs) {
            accepts = (declaredInputs[kind]?.max ?? 0) > 0;
        } else if (configured) {
            accepts = configuredMax(kind) > 0;
        } else {
            accepts = capability === kind;
        }
        if (!accepts) continue;
        if (kind === "image") push("image", "可输入图像", <ImageIcon className="size-3" />);
        if (kind === "video") push("video", "可输入视频", <VideoIcon className="size-3" />);
        if (kind === "audio") push("audio", "可输入音频", <ListMusic className="size-3" />);
    }
    return entries;
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

type ModelMenuPrice = { kind: "tiers"; label: string; compactLabel: string; chipLabel?: string; title: string } | { kind: "estimate"; label?: string; title?: string } | { kind: "fixed"; value: number; unit: "次" | "秒" | "百万 Token" };

function modelMenuPrice(config: AiConfig, model: string, capability?: ModelCapability, summary = false, requirements?: ModelRequirements): ModelMenuPrice | null | undefined {
    if (!model) return undefined;
    const channel = resolveModelChannel(config, model);
    const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(model));
    if (!cost) return channel.scope === "system" ? null : undefined;
    if (cost.pricePolicy === "channel") {
        const tiers = cost.logicalPriceTiers || [];
        if (!tiers.length) return null;
        const matched = summary ? tiers : priceTiersForCurrentSelection(tiers, capability, config, requirements);
        if (!summary && !matched.length) return { kind: "tiers", label: "当前规格无报价", compactLabel: "当前规格无报价", title: "请调整参数，或选择支持当前规格的渠道" };
        return channelTierPriceSummary(matched.length ? matched : tiers, tiers, capability);
    }
    if (cost.billingMode === "token") {
        const rate = cost.outputTokenPriceMicrocredits;
        return capability === "video" && typeof rate === "number" && Number.isFinite(rate) && rate >= 0
            ? { kind: "estimate", label: formatPriceRange([rate / 1_000_000], "积分/百万视频 Token"), title: "按视频 Token 单价预估，优先按有效上游用量结算；未返回用量时按视频公式结算" }
            : { kind: "estimate" };
    }
    return { kind: "fixed", value: cost.unitPriceMicrocredits / 1_000_000, unit: cost.billingMode === "per_second" ? "秒" : "次" };
}

function pickerModelDisplayName(config: AiConfig, model: string, showConfiguredModelName: boolean) {
    const name = showConfiguredModelName ? configuredModelDisplayName(config, model) : modelDisplayName(config, model);
    return isDirectSystemModel(config, model) ? `${name} · ${modelChannelLabel(config, model)}` : name;
}

function pickerModelOptionLabel(config: AiConfig, model: string, showConfiguredModelName: boolean) {
    const displayName = showConfiguredModelName ? configuredModelDisplayName(config, model) : modelDisplayName(config, model);
    const channel = resolveModelChannel(config, model);
    return channel.scope === "system" ? pickerModelDisplayName(config, model, showConfiguredModelName) : `${displayName}（${channel.name}）`;
}

function channelTierPriceSummary(
    visibleTiers: NonNullable<NonNullable<AiConfig["channels"][number]["modelCosts"]>[number]["logicalPriceTiers"]>,
    allTiers: NonNullable<NonNullable<AiConfig["channels"][number]["modelCosts"]>[number]["logicalPriceTiers"]>,
    capability?: ModelCapability,
): Extract<ModelMenuPrice, { kind: "tiers" }> {
    const label = priceTierSummaryLabel(visibleTiers, capability);
    // chip 徽章只显数值(flora: badge=数字+icon, "积分"字样省略)
    const chipLabel = label.replace(/积分\/秒$/, "/秒").replace(/积分$/, "").trim();
    return {
        kind: "tiers",
        label,
        compactLabel: label,
        chipLabel,
        title: `系统规格价格：${allTiers.map((tier) => `${tierSpecificationLabel(tier)} ${priceTierSummaryLabel([tier], capability)}`).join("；")}${allTiers.some((tier) => tier.billingMode === "token") ? (capability === "video" ? "；优先按有效上游用量结算，未返回用量时按视频公式结算" : "；Token 费用为预估，最终按成功任务的实际用量结算") : ""}`,
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
        selector.videoGenerateAudio === "true" ? "有声" : selector.videoGenerateAudio === "false" ? "无声" : "",
    ].filter(Boolean);
    return details.length ? details.join(" / ") : "默认规格";
}

function tierPriceLabel(tier: NonNullable<NonNullable<AiConfig["channels"][number]["modelCosts"]>[number]["logicalPriceTiers"]>[number]) {
    if (tier.billingMode === "token") return "按量预估";
    return formatPriceRange([tier.unitPriceMicrocredits / 1_000_000], tier.billingMode === "per_second" ? "积分/秒" : "积分");
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
                {price.chipLabel ?? price.label}
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
    return <ModelLogo icon={icon || (config && model ? modelIcon(config, model) : "")} size={14} />;
}
