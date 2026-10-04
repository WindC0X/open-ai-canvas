import { Download, ExternalLink, ListTodo, LoaderCircle, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MediaPreview } from "@/components/media-preview";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/constant/credits";
import {
    canCancelGenerationTask,
    formatTaskKind,
    generationTaskExecutionLabel,
    generationTaskShowsProgress,
    generationTaskStageLabel,
    generationTaskStatusLabel,
    mediaDeliverySummary,
} from "@/lib/generation-task-display";
import { subscribeGenerationTasks, type GenerationTask } from "@/services/api/task-center";
import { useUserStore } from "@/stores/use-user-store";

/**
 * W5 统一任务面（UnifiedTaskFace）—— 设计卡 `docs/artifacts/w5-unified-task-face-card.md`。
 *
 * ★ 三条硬验收（方案 §5）：
 *   ① 双条件：不见画布也能走到下载；画布任一步可达、结果可编辑/对比/批量
 *   ② 独立可用：进度/结果/预览/下载四要素齐备；「在画布中打开」**给而不要求**
 *   ③ 交付步：下载入口（合规成品）
 *
 * ★ 订阅契约（§4.3，不可违反）：
 *   任务状态**只**来自 `subscribeGenerationTasks(taskIds)`。禁止从画布状态推导任务态、
 *   禁止订阅画布事件刷新本组件。教训来源 `pending-test.mdx:3763` 撤销反噬
 *   （撤销 95 秒后被自动同步反噬）—— 状态被非预期路径改写的失效模式。
 *   机检护栏：`web/test/task-face-independence.test.ts`（扫描本目录全部文件）。
 *
 * ★ 挂载无关：组件不知道自己在哪挂载，能力由 props 注入（`showOpenInCanvas` 等）。
 *   四个挂载点 —— 档 0 点卡（/create）/ 档 1 直线流程 / 画布浮层（F-02）/ 未来 /tasks。
 */

export type UnifiedTaskFaceProps = {
    /** 任务 id 列表（★ 唯一状态源，锚定 TaskID） */
    taskIds: readonly string[];
    /**
     * 是否显示「在画布中打开」入口。
     * ★ 硬验收②「给而不要求」—— 默认 true；小白直线流程可传 false。
     */
    showOpenInCanvas?: boolean;
    /** 点击「在画布中打开」的回调（跳转方式由调用方决定） */
    onOpenInCanvas?: (task: GenerationTask) => void;
    /** 取消任务回调 */
    onCancelTask?: (task: GenerationTask) => void;
    /** 交付步：下载回调（★ 硬验收③） */
    onDownload?: (task: GenerationTask) => void;
    /** 标题右侧的上下文说明（如「当前画布」「直线流程」） */
    contextLabel?: string;
    className?: string;
};

export function UnifiedTaskFace({
    taskIds,
    showOpenInCanvas = true,
    onOpenInCanvas,
    onCancelTask,
    onDownload,
    contextLabel,
    className,
}: UnifiedTaskFaceProps) {
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const [now, setNow] = useState(() => Date.now());
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const tasksRef = useRef<GenerationTask[]>([]);
    const [tasks, setTasks] = useState<GenerationTask[]>([]);

    // 订阅契约：只认 TaskID。taskIds 内容变化才重订阅，避免父组件每次渲染都断连重连。
    const taskIdKey = useMemo(() => JSON.stringify([...taskIds].sort()), [taskIds]);
    useEffect(() => {
        const ids = JSON.parse(taskIdKey) as string[];
        if (!ids.length) {
            tasksRef.current = [];
            setTasks([]);
            return;
        }
        // 先按 id 占位，避免首帧空列表闪烁；随后由订阅回调填充真实状态。
        const placeholder = ids.map((id) => tasksRef.current.find((task) => task.id === id) ?? null).filter((task): task is GenerationTask => Boolean(task));
        if (placeholder.length) setTasks(placeholder);
        return subscribeGenerationTasks(ids, (task) => {
            setTasks((current) => {
                const index = current.findIndex((item) => item.id === task.id);
                const next = index === -1 ? [...current, task] : current.map((item) => (item.id === task.id ? task : item));
                next.sort((a, b) => parseTime(a.createdAt) - parseTime(b.createdAt));
                tasksRef.current = next;
                return next;
            });
        });
    }, [taskIdKey]);

    useEffect(() => {
        if (!tasks.length) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1_000);
        return () => window.clearInterval(timer);
    }, [tasks.length]);

    useEffect(() => {
        if (expandedTaskId && !tasks.some((task) => task.id === expandedTaskId)) setExpandedTaskId(null);
    }, [expandedTaskId, tasks]);

    if (!tasks.length) return null;

    return (
        <section className={cn("flex flex-col gap-[var(--space-2)]", className)} aria-label="生成任务">
            <header className="flex min-w-0 items-center gap-[var(--space-2)]">
                <span className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ListTodo className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[var(--fs-label)] font-semibold">生成任务</span>
                    <span className="block truncate text-[var(--fs-tiny)] text-[var(--muted-foreground)]" aria-live="polite">
                        {contextLabel ? `${contextLabel} · ` : ""}
                        {tasks.length} 个任务
                    </span>
                </span>
                {tasks.some((task) => task.status === "running" || task.status === "queued") ? (
                    <LoaderCircle className="size-4 shrink-0 animate-spin text-[var(--accent)] opacity-70 motion-reduce:animate-none" />
                ) : null}
            </header>

            <div className="flex flex-col gap-[var(--space-2)]">
                {tasks.map((task) => (
                    <UnifiedTaskCard
                        key={task.id}
                        task={task}
                        now={now}
                        creditsEnabled={creditsEnabled}
                        expanded={expandedTaskId === task.id}
                        onToggle={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
                        showOpenInCanvas={showOpenInCanvas}
                        onOpenInCanvas={onOpenInCanvas}
                        onCancelTask={onCancelTask}
                        onDownload={onDownload}
                    />
                ))}
            </div>
        </section>
    );
}

function UnifiedTaskCard({
    task,
    now,
    creditsEnabled,
    expanded,
    onToggle,
    showOpenInCanvas,
    onOpenInCanvas,
    onCancelTask,
    onDownload,
}: {
    task: GenerationTask;
    now: number;
    creditsEnabled: boolean;
    expanded: boolean;
    onToggle: () => void;
    showOpenInCanvas: boolean;
    onOpenInCanvas?: (task: GenerationTask) => void;
    onCancelTask?: (task: GenerationTask) => void;
    onDownload?: (task: GenerationTask) => void;
}) {
    const showsProgress = generationTaskShowsProgress(task);
    const progress = showsProgress && typeof task.progress === "number" ? Math.max(0, Math.min(100, Math.round(task.progress))) : showsProgress && task.status === "queued" ? 0 : undefined;
    const elapsedMs = Math.max(0, now - parseTime(task.startedAt || task.createdAt));
    const durationLabel = `${task.status === "queued" ? "已等待" : "已运行"} ${formatDuration(elapsedMs)}`;
    const billingLabel = task.billing ? `冻结 ${formatCredits(task.billing.amountMicrocredits)} 积分` : "未计费";
    // 统一任务面铁律：执行位置只是元数据标签，不单独造 UI。
    const executionLabel = generationTaskExecutionLabel(task, {
        creditsEnabled,
        billingLabel: task.billing ? formatCredits(task.billing.amountMicrocredits) : undefined,
    });
    const delivery = mediaDeliverySummary(task.status, task.mediaStage);
    const preview = taskPreview(task);
    const canDownload = task.status === "succeeded" && Boolean(preview.url);
    const canOpenInCanvas = showOpenInCanvas && Boolean(onOpenInCanvas);
    const canCancel = Boolean(onCancelTask) && canCancelGenerationTask(task);
    const hasActions = canDownload || canOpenInCanvas || canCancel;

    return (
        <article className="overflow-hidden rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface)]">
            <button type="button" className="block w-full p-[var(--space-3)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]" onClick={onToggle} aria-expanded={expanded}>
                <div className="flex min-w-0 items-start gap-[var(--space-2)]">
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-[var(--space-2)]">
                            <span className="truncate text-[var(--fs-label)] font-semibold" title={formatTaskKind(task)}>
                                {formatTaskKind(task)}
                            </span>
                            <span className="shrink-0 rounded-full border border-[var(--border)] px-[var(--space-1)] py-[1px] text-[var(--fs-nano)] font-medium text-[var(--muted-foreground)]">
                                {generationTaskStatusLabel(task)}
                            </span>
                        </span>
                        <span className="mt-[var(--space-1)] block truncate text-[var(--fs-tiny)] text-[var(--muted-foreground)]" title={generationTaskStageLabel(task)}>
                            {generationTaskStageLabel(task)}
                        </span>
                    </span>
                </div>

                {showsProgress ? (
                    <div className="mt-[var(--space-3)] h-1.5 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                        {progress !== undefined ? (
                            <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
                        ) : null}
                    </div>
                ) : null}

                {progress !== undefined && task.status === "running" ? (
                    <div className="mt-[var(--space-1)] flex items-center justify-between text-[var(--fs-micro)] text-[var(--muted-foreground)]">
                        <span>{durationLabel}</span>
                        <span className="font-medium tabular-nums">{progress}%</span>
                    </div>
                ) : (
                    <div className={cn("mt-[var(--space-3)] grid gap-[var(--space-2)] text-[var(--fs-tiny)] text-[var(--muted-foreground)]", creditsEnabled ? "grid-cols-2" : "grid-cols-1")}>
                        <span className="inline-flex min-w-0 items-center gap-[var(--space-1)] truncate" title={durationLabel}>
                            {durationLabel}
                        </span>
                        {creditsEnabled ? <span className="inline-flex min-w-0 items-center justify-end gap-[var(--space-1)] truncate" title={billingLabel}>{billingLabel}</span> : null}
                    </div>
                )}

                {/* 结果预览（硬验收②四要素之一）：成功态直接可见，不必展开 */}
                {task.status === "succeeded" && preview.url ? (
                    <span className="mt-[var(--space-3)] block overflow-hidden rounded-[var(--r-xs)] border border-[var(--border)]">
                        <MediaPreview src={preview.url} kind={preview.kind} alt={task.prompt || formatTaskKind(task)} className="max-h-40 w-full object-cover" />
                    </span>
                ) : null}
            </button>

            {expanded ? (
                <div className="border-t border-[var(--border)] px-[var(--space-3)] pb-[var(--space-3)] pt-[var(--space-2)] text-[var(--fs-tiny)] text-[var(--muted-foreground)]">
                    <div className="flex items-center justify-between gap-[var(--space-2)]">
                        <span>当前阶段</span>
                        <span className="max-w-[200px] truncate text-right text-[var(--foreground)]">{generationTaskStageLabel(task)}</span>
                    </div>
                    <div className="mt-[var(--space-1)] flex items-center justify-between gap-[var(--space-2)]">
                        <span>执行位置</span>
                        <span className="max-w-[200px] truncate text-right text-[var(--foreground)]" title={executionLabel}>{executionLabel}</span>
                    </div>
                    {delivery ? (
                        <div className="mt-[var(--space-1)] flex items-center justify-between gap-[var(--space-2)]">
                            <span>作品交付</span>
                            <span className="max-w-[200px] truncate text-right text-[var(--foreground)]" title={delivery}>{delivery}</span>
                        </div>
                    ) : null}
                    {task.error ? (
                        <div className="mt-[var(--space-1)] flex items-start justify-between gap-[var(--space-2)]">
                            <span>失败原因</span>
                            <span className="max-w-[200px] truncate text-right text-[var(--destructive)]" title={task.error}>{task.error}</span>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* 交付步（硬验收③）：「在画布中打开」给而不要求 */}
            {hasActions ? (
                <div className="flex flex-wrap items-center gap-[var(--space-2)] border-t border-[var(--border)] px-[var(--space-3)] py-[var(--space-2)]">
                    {canDownload ? (
                        <button
                            type="button"
                            className="inline-flex h-7 items-center gap-[var(--space-1)] rounded-[var(--r-xs)] bg-[var(--accent-soft)] px-[var(--space-2)] text-[var(--fs-tiny)] font-medium text-[var(--accent)] transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            onClick={() => onDownload?.(task)}
                        >
                            <Download className="size-3" />
                            下载
                        </button>
                    ) : null}
                    {canOpenInCanvas ? (
                        <button
                            type="button"
                            className="inline-flex h-7 items-center gap-[var(--space-1)] rounded-[var(--r-xs)] px-[var(--space-2)] text-[var(--fs-tiny)] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            onClick={() => onOpenInCanvas?.(task)}
                        >
                            <ExternalLink className="size-3" />
                            在画布中打开
                        </button>
                    ) : null}
                    {canCancel ? (
                        <button
                            type="button"
                            className="ml-auto inline-flex h-7 items-center gap-[var(--space-1)] rounded-[var(--r-xs)] px-[var(--space-2)] text-[var(--fs-tiny)] font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--bg-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            onClick={() => onCancelTask?.(task)}
                        >
                            <XCircle className="size-3" />
                            取消任务
                        </button>
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}

/** 任务结果的可预览/可下载 URL。优先任务自带 previewUrl，回退到素材记录。 */
export function taskPreview(task: GenerationTask): { url: string; kind: "image" | "video" } {
    if (task.previewUrl) return { url: task.previewUrl, kind: task.previewKind === "video" ? "video" : "image" };
    return { url: "", kind: "image" };
}

function parseTime(value?: string) {
    if (!value) return Date.now();
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : Date.now();
}

function formatDuration(value: number) {
    const totalSeconds = Math.floor(value / 1_000);
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
