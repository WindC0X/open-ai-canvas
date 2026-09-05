import React, { useEffect, useRef, useState } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { CanvasNodeData } from "@/types/canvas";

type CanvasTheme = (typeof canvasThemes)[keyof typeof canvasThemes];

type LoadingFillPhase = "fallback" | "correction" | "real";

const EXIT_BUFFER_MS = 400;

export type LoadingFillPhaseInput = {
    taskId: string | undefined;
    taskProgress: number | undefined;
    lastTaskId: string | null;
    lastScale: number | null;
};

export type LoadingFillPhaseResult = {
    phase: LoadingFillPhase;
    /** 内联 --loading-target-scale；fallback 为 null（走 keyframe）。 */
    scale: number | null;
    fromScale?: number;
    toScale?: number;
};

/**
 * S04 填充层三态推导（纯函数，便于单测）。
 *
 * 数据源契约（backend task_worker.go）：图片/视频的百分比只能来自供应商状态响应；
 * 后端里程碑 = 创建 5%(排队) → worker 接单 0(正在连接上游，"0=无可报，不冒充") → 完成 100。
 * 因此展示层语义：
 * - 0 视为"未知"而非真实 0%：已有刻度则保持，无刻度则 fallback 5% 小条；
 * - 同一任务内刻度不因 0 回缩；真实回落（上游自报变低，>0）仍走 correction 桥接（flora 语义）；
 * - retry/重提交产生新 taskId：刻度归零，从 fallback 重新开始。
 */
export function resolveLoadingFillPhase(input: LoadingFillPhaseInput): LoadingFillPhaseResult {
    const isNewTask = input.lastTaskId !== null && input.lastTaskId !== input.taskId;
    const lastScale = isNewTask ? null : input.lastScale;

    const raw = input.taskProgress;
    const numeric = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : null;
    if (numeric === null) {
        return { phase: "fallback", scale: null };
    }

    const target = numeric / 100;
    if (target <= 0) {
        if (lastScale !== null && lastScale > 0) {
            return { phase: "real", scale: lastScale };
        }
        return { phase: "fallback", scale: null };
    }
    if (lastScale === null) {
        return { phase: "correction", fromScale: 0, toScale: target, scale: target };
    }
    if (target < lastScale) {
        return { phase: "correction", fromScale: lastScale, toScale: target, scale: target };
    }
    return { phase: "real", scale: target };
}

type CanvasNodeLoadingFillProps = {
    node: CanvasNodeData;
    theme: CanvasTheme;
};

/**
 * 生成中媒体区进度填充（S04，flora BlockLoadingState 对齐）。
 *
 * 仅挂载于 Image/Video 节点首次空白生成路径（status=loading 且无媒体内容），
 * 由 canvas-node.tsx 的挂载条件控制；本组件只负责三态与退出缓冲：
 * - 真实进度：内联 --loading-target-scale + transform transition（compositor 路径）；
 * - 无进度（0=未知 / queued 无刻度 / running 无数值）：fallback 5% 小条一次性动画；
 * - 回跳（retry 重建 / 上游自报回落）：correction 桥接动画；
 * - 退出：status 离开 loading 后保留 400ms（flora o(g,400) 同款语义），
 *   防 retry 抖动（loading→error→loading）闪条；success 后由挂载条件与媒体上屏同帧卸载。
 */
export function CanvasNodeLoadingFill({ node, theme }: CanvasNodeLoadingFillProps) {
    const isLoading = node.metadata?.status === "loading";
    const [shouldRender, setShouldRender] = useState(isLoading);
    const lastScaleRef = useRef<number | null>(null);
    const lastTaskIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (isLoading) {
            setShouldRender(true);
            return;
        }
        const timer = window.setTimeout(() => setShouldRender(false), EXIT_BUFFER_MS);
        return () => window.clearTimeout(timer);
    }, [isLoading]);

    if (!shouldRender) {
        return null;
    }

    // 退出缓冲窗口（error/retry 抖动）：冻结在上帧刻度，静态展示，不重放任何动画。
    if (!isLoading) {
        const frozenScale = lastScaleRef.current ?? 0;
        return (
            <div className="canvas-node-loading-fill" aria-hidden="true">
                <div
                    className="canvas-node-loading-fill-bar"
                    style={{ "--loading-target-scale": frozenScale, backgroundColor: theme.node.loadingFill } as React.CSSProperties}
                />
            </div>
        );
    }

    const taskId = node.metadata?.taskId;
    const resolved = resolveLoadingFillPhase({
        taskId,
        taskProgress: node.metadata?.taskProgress,
        lastTaskId: lastTaskIdRef.current,
        lastScale: lastScaleRef.current,
    });
    lastTaskIdRef.current = taskId ?? null;
    if (resolved.scale !== null) {
        lastScaleRef.current = resolved.scale;
    }

    let barStyle: React.CSSProperties;
    if (resolved.phase === "fallback") {
        barStyle = { backgroundColor: theme.node.loadingFill };
    } else if (resolved.phase === "correction") {
        barStyle = {
            "--loading-from-scale": resolved.fromScale,
            "--loading-to-scale": resolved.toScale,
            "--loading-target-scale": resolved.toScale,
            backgroundColor: theme.node.loadingFill,
        } as React.CSSProperties;
    } else {
        barStyle = {
            "--loading-target-scale": resolved.scale,
            backgroundColor: theme.node.loadingFill,
            transition: "transform 0.3s ease-out",
        } as React.CSSProperties;
    }

    return (
        <div className="canvas-node-loading-fill" aria-hidden="true">
            <div className="canvas-node-loading-fill-bar" data-phase={resolved.phase} style={barStyle} />
        </div>
    );
}
