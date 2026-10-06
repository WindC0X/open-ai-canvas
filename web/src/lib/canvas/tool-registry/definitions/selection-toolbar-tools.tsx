import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignHorizontalSpaceAround, AlignHorizontalSpaceBetween, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalSpaceAround, AlignVerticalSpaceBetween, AtSign, Film, FolderTree, Grid3X3, LayoutTemplate, Link2, LoaderCircle, Sparkles, Workflow } from "lucide-react";

import { registerToolbarTools, type ToolDefinition } from "@/lib/canvas/tool-registry";
import { capabilityContextSatisfied, findCapabilityEntry } from "@/lib/canvas/capability-entries";

/**
 * F-09 爆款复刻的入口可用性判定 —— 单一真值来自能力层谓词。
 *
 * ★ 为什么要有这个函数（修复批 B-1）：入口此前内联 `selectedImageCount === 2`，
 *   与能力条目的 `dual_image` 谓词是两份独立实现，改一处不影响另一处。
 *   现在入口经由本函数调用谓词，谓词是唯一判定源。
 *
 * 入口在选区工具栏（多选场景）⇒ hasSelection 恒为 true。
 */
function cloneRecreateContextSatisfied(selectedImageCount: number): boolean {
    const entry = findCapabilityEntry("image.cloneRecreate");
    // 条目缺失时保守返回 false（不渲染入口），而不是抛错 —— 与「默认拒绝」一致。
    if (!entry) return false;
    return capabilityContextSatisfied(entry, { imageCount: selectedImageCount, hasSelection: true });
}

export const selectionToolbarTools: ToolDefinition[] = [
    { id: "selection-align-left", toolbar: "selection", category: "layout", label: "左对齐", icon: <AlignHorizontalJustifyStart />, defaultVisible: true, defaultOrder: 10, run: (ctx) => ctx.handlers.onAlign("left") },
    { id: "selection-align-center-x", toolbar: "selection", category: "layout", label: "水平居中", icon: <AlignHorizontalJustifyCenter />, defaultVisible: true, defaultOrder: 20, run: (ctx) => ctx.handlers.onAlign("centerX") },
    { id: "selection-align-right", toolbar: "selection", category: "layout", label: "右对齐", icon: <AlignHorizontalJustifyEnd />, defaultVisible: true, defaultOrder: 30, run: (ctx) => ctx.handlers.onAlign("right") },
    { id: "selection-align-top", toolbar: "selection", category: "layout", label: "顶对齐", icon: <AlignVerticalJustifyStart />, defaultVisible: true, defaultOrder: 40, run: (ctx) => ctx.handlers.onAlign("top") },
    { id: "selection-align-center-y", toolbar: "selection", category: "layout", label: "垂直居中", icon: <AlignVerticalJustifyCenter />, defaultVisible: true, defaultOrder: 50, run: (ctx) => ctx.handlers.onAlign("centerY") },
    { id: "selection-align-bottom", toolbar: "selection", category: "layout", label: "底对齐", icon: <AlignVerticalJustifyEnd />, defaultVisible: true, defaultOrder: 60, run: (ctx) => ctx.handlers.onAlign("bottom") },
    { id: "selection-distribute-x", toolbar: "selection", category: "layout", label: "水平等距", icon: <AlignHorizontalSpaceBetween />, defaultVisible: true, defaultOrder: 70, disabled: (ctx) => ctx.selectedCount < 3, run: (ctx) => ctx.handlers.onAlign("distributeX") },
    { id: "selection-distribute-y", toolbar: "selection", category: "layout", label: "垂直等距", icon: <AlignVerticalSpaceBetween />, defaultVisible: true, defaultOrder: 80, disabled: (ctx) => ctx.selectedCount < 3, run: (ctx) => ctx.handlers.onAlign("distributeY") },
    { id: "selection-arrange-row", toolbar: "selection", category: "arrange", label: "横向排列", icon: <AlignHorizontalSpaceAround />, defaultVisible: false, defaultOrder: 90, run: (ctx) => ctx.handlers.onArrange("row") },
    { id: "selection-arrange-column", toolbar: "selection", category: "arrange", label: "纵向排列", icon: <AlignVerticalSpaceAround />, defaultVisible: false, defaultOrder: 100, run: (ctx) => ctx.handlers.onArrange("column") },
    { id: "selection-arrange-grid", toolbar: "selection", category: "arrange", label: "宫格排列", icon: <Grid3X3 />, defaultVisible: false, defaultOrder: 110, run: (ctx) => ctx.handlers.onArrange("grid") },
    { id: "selection-arrange-flow", toolbar: "selection", category: "arrange", label: "按连线整理", icon: <Workflow />, defaultVisible: false, defaultOrder: 120, run: (ctx) => ctx.handlers.onArrange("flow") },
    { id: "selection-create-storyboard", toolbar: "selection", category: "selection", label: "创建分镜组", icon: <LayoutTemplate />, defaultVisible: true, defaultOrder: 130, disabled: (ctx) => ctx.selectedCount < 2, run: (ctx) => ctx.handlers.onCreateStoryboard() },
    { id: "selection-create-reference-group", toolbar: "selection", category: "selection", label: "创建引用组", icon: <FolderTree />, defaultVisible: false, defaultOrder: 140, disabled: (ctx) => ctx.selectedCount < 2, run: (ctx) => ctx.handlers.onCreateReferenceGroup() },
    { id: "selection-batch-connect", toolbar: "selection", category: "selection", label: "批量连接", icon: <Link2 />, defaultVisible: true, defaultOrder: 145, disabled: (ctx) => ctx.selectedCount < 2, run: (ctx) => ctx.handlers.onBatchConnect() },
    { id: "selection-send-to-agent", toolbar: "selection", category: "selection", label: "发送到 Agent", icon: <AtSign />, defaultVisible: true, defaultOrder: 148, disabled: (ctx) => ctx.selectedCount < 1, run: (ctx) => ctx.handlers.onSendSelectionToAgent() },
    {
        id: "selection-merge-videos",
        toolbar: "selection",
        category: "selection",
        label: (ctx) => `合并选中视频（${ctx.selectedVideoCount}）`,
        icon: (ctx) => ctx.mergingVideos ? <LoaderCircle className="animate-spin" /> : <Film />,
        defaultVisible: true,
        defaultOrder: 150,
        applicable: (ctx) => ctx.selectedVideoCount >= 2,
        disabled: (ctx) => ctx.mergingVideos,
        run: (ctx) => ctx.handlers.onMergeVideos(),
    },
    {
        // F-09 三期 §3.2：`dual_image` 谓词的真实消费方。
        //
        // ★ 修复批 B-1（控制线 2026-10-06 评审发现）：原先这里写 `ctx.selectedImageCount === 2`，
        //   是谓词的【第二份实现】—— 改谓词不会影响入口行为（双向注入对照已证）。
        //   现改为【调用能力层谓词函数】，消除两份真值：
        //   改 capability-entries.ts 的 dual_image case ⇒ 本入口行为随之改变（可证伪）。
        //
        // ★ 不违反「禁止把能力层字段塞进 ToolDefinition」（架构方案 §1.1）：
        //   本处是按钮层【调用】能力层的谓词函数，不是把能力层字段搬进按钮层结构；
        //   唯一契约仍是 executionChain.handler ↔ ToolbarHandlers.onXxx。
        id: "selection-clone-recreate",
        toolbar: "selection",
        category: "selection",
        label: "爆款复刻",
        icon: <Sparkles />,
        defaultVisible: true,
        defaultOrder: 152,
        applicable: (ctx) => cloneRecreateContextSatisfied(ctx.selectedImageCount),
        run: (ctx) => ctx.handlers.onCreateCloneRecreate(),
    },
];

registerToolbarTools(selectionToolbarTools);
