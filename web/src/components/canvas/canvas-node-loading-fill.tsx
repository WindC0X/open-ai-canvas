import React, { useEffect, useRef, useState } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { CanvasNodeData } from "@/types/canvas";

type CanvasTheme = (typeof canvasThemes)[keyof typeof canvasThemes];

type LoadingFillPhase = "fallback" | "correction" | "real";

const EXIT_BUFFER_MS = 400;

/**
 * flora 066 chunk 契约（.flora-capture/static/066-0l6-ok9_srnk1.js.js 原文）：
 * - fallback：`loading-fill-fallback",durationMs:6e4,timingFunction:"linear",fromScale:0,toScale:.05`
 *   —— 无精确进度时 60s 线性缓爬 0→5%，全程微动表达"进行中"；
 * - 后端里程碑（排队 5 / 接单 0）不是上游真实百分比（task_worker.go 注释），归入无精确进度区。
 */
const MILESTONE_PRECISION_FLOOR = 5;
/** flora fallback 封顶 5%；首个精确值到达时从该封顶近似桥接，避免视觉回跳。 */
const FALLBACK_CAP_SCALE = 0.05;

export type LoadingFillPhaseInput = {
    taskId: string | undefined;
    taskProgress: number | undefined;
    lastTaskId: string | null;
    lastScale: number | null;
};

export type LoadingFillPhaseResult = {
    phase: LoadingFillPhase;
    /** 内联 --loading-target-scale；fallback 为 null（走 60s keyframe 缓爬）。 */
    scale: number | null;
    fromScale?: number;
    toScale?: number;
};

/**
 * S04 填充层三态推导（纯函数，便于单测）。
 *
 * - 无精确进度（数值缺失或 ≤5 里程碑区）：已有刻度则保持（flora g(e,t) 无 ETA 时 update(t)）；
 *   无刻度则 fallback 60s 线性缓爬；
 * - 精确进度（>5）：同任务内单调不回缩；真实回落（>0 上游自报变低）走 correction 桥接；
 * - retry/重提交产生新 taskId：刻度归零重新缓爬。
 */
export function resolveLoadingFillPhase(input: LoadingFillPhaseInput): LoadingFillPhaseResult {
    const isNewTask = input.lastTaskId !== null && input.lastTaskId !== input.taskId;
    const lastScale = isNewTask ? null : input.lastScale;

    const raw = input.taskProgress;
    const numeric = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : null;

    if (numeric === null || numeric <= MILESTONE_PRECISION_FLOOR) {
        if (lastScale !== null && lastScale > FALLBACK_CAP_SCALE) {
            return { phase: "real", scale: lastScale };
        }
        return { phase: "fallback", scale: null };
    }

    const target = numeric / 100;
    const fromScale = lastScale ?? FALLBACK_CAP_SCALE;
    if (target < fromScale) {
        return { phase: "correction", fromScale, toScale: target, scale: target };
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
 * - 精确进度：内联 --loading-target-scale + transform transition（compositor 路径）；
 * - 无进度：fallback 60s 线性缓爬 0→5%（flora 6e4 常量），reduced-motion 静态 5%；
 * - 回跳（上游自报回落 / retry 重建）：correction 桥接动画；
 * - 退出：status 离开 loading 后保留 400ms（flora o(g,400) 同款语义），
 *   success 后由挂载条件与媒体上屏同帧卸载。
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
        // 内联封顶值仅供 reduced-motion(animation:none) 静态可见；动画播放期由 keyframe 覆盖。
        barStyle = { "--loading-target-scale": FALLBACK_CAP_SCALE, backgroundColor: theme.node.loadingFill } as React.CSSProperties;
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
