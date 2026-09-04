import React, { useEffect, useRef, useState } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { CanvasNodeData } from "@/types/canvas";

type CanvasTheme = (typeof canvasThemes)[keyof typeof canvasThemes];

type LoadingFillPhase = "fallback" | "correction" | "real";

const EXIT_BUFFER_MS = 400;

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
 * - 无进度（running 无数值 / queued 0）：fallback 5% 小条一次性动画；
 * - 回跳（retry 重建）或 fallback→首个真实值：correction 桥接动画；
 * - 退出：status 离开 loading 后保留 400ms（flora o(g,400) 同款语义），
 *   防 retry 抖动（loading→error→loading）闪条；success 后由挂载条件与媒体上屏同帧卸载。
 */
export function CanvasNodeLoadingFill({ node, theme }: CanvasNodeLoadingFillProps) {
    const isLoading = node.metadata?.status === "loading";
    const [shouldRender, setShouldRender] = useState(isLoading);
    const lastScaleRef = useRef<number | null>(null);

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

    const rawProgress = node.metadata?.taskProgress;
    const numericProgress =
        typeof rawProgress === "number" && Number.isFinite(rawProgress) ? Math.min(100, Math.max(0, rawProgress)) : null;

    let phase: LoadingFillPhase;
    let barStyle: React.CSSProperties;

    if (numericProgress === null) {
        // 无精确进度：fallback 5% 小条，一次性 forwards（非无限循环）。
        phase = "fallback";
        barStyle = { backgroundColor: theme.node.loadingFill };
    } else {
        const targetScale = numericProgress / 100;
        const lastScale = lastScaleRef.current;

        if (lastScale !== null && targetScale < lastScale) {
            // 进度回跳（retry 重建元数据）：correction 桥接一次性动画。
            phase = "correction";
            barStyle = {
                "--loading-from-scale": lastScale,
                "--loading-to-scale": targetScale,
                "--loading-target-scale": targetScale,
                backgroundColor: theme.node.loadingFill,
            } as React.CSSProperties;
        } else if (lastScale === null && targetScale > 0) {
            // fallback/空 → 首个真实值：同样桥接，避免从 0 瞬跳。
            phase = "correction";
            barStyle = {
                "--loading-from-scale": 0,
                "--loading-to-scale": targetScale,
                "--loading-target-scale": targetScale,
                backgroundColor: theme.node.loadingFill,
            } as React.CSSProperties;
        } else {
            // 常规推进：内联刻度 + transition（flora 有精确进度时的行为）。
            // progress=100 且仍 loading：保持满格 scaleX(1)。
            phase = "real";
            barStyle = {
                "--loading-target-scale": targetScale,
                backgroundColor: theme.node.loadingFill,
                transition: "transform 0.3s ease-out",
            } as React.CSSProperties;
        }
        lastScaleRef.current = targetScale;
    }

    return (
        <div className="canvas-node-loading-fill" aria-hidden="true">
            <div className="canvas-node-loading-fill-bar" data-phase={phase} style={barStyle} />
        </div>
    );
}
