import { CanvasCountSettingsPopover, normalizeCount } from "./canvas-count-settings-popover";

export const TEXT_COUNT_MAX = 15;

/** @deprecated 兼容旧导出: 归一逻辑已收敛到 canvas-count-settings-popover 的 normalizeCount。 */
export function normalizeTextCount(value: number | string | null | undefined): number {
    return normalizeCount(value);
}

type CanvasTextSettingsPopoverProps = {
    /** 归属供给标注(透传 CanvasCountSettingsPopover, 见其文档)。 */
    supplyNodeId?: string;
    value: number;
    onChange: (value: number) => void;
    placement?: "topLeft" | "topRight" | "top" | "bottom";
    buttonClassName?: string;
};

/** 文本份数气泡(兼容包装): 词汇表/滚动行为已收敛到 canvas-count-settings-popover 通用组件。 */
export function CanvasTextSettingsPopover({ supplyNodeId, value, onChange, placement, buttonClassName }: CanvasTextSettingsPopoverProps) {
    return (
        <CanvasCountSettingsPopover supplyNodeId={supplyNodeId} value={value} onChange={onChange} max={TEXT_COUNT_MAX} label="份" placement={placement} buttonClassName={buttonClassName} />
    );
}
