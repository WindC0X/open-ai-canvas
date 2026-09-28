import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { App, Button, Input, Switch, type GetRef } from "antd";
import { ChevronDown, Copy, ImagePlus, Mail, MessageSquareHeart, Users, X } from "lucide-react";

import { APP_VERSION } from "@/components/layout/app-changelog-modal";
import { AppModal } from "@/components/ui/product/app-modal";
import { FEEDBACK_CHANNEL_URL } from "@/lib/canvas/canvas-help-links";
import { buildFeedbackMailtoUrl, buildFeedbackManifest, buildFeedbackPayload } from "@/lib/canvas/feedback-payload";
import { getCanvasShare } from "@/services/api/canvas-share";

type CanvasFeedbackDialogProps = {
    open: boolean;
    onClose: () => void;
    /** 画布项目 ID：读取分享状态 + 附加信息用（缺失时分享开关禁用）。 */
    projectId?: string;
    /** 画布节点数（附加信息用）。 */
    nodeCount?: number;
};

/** UA 摘要：截断过长 UA，明示区与复制文本同源。 */
function summarizeUserAgent() {
    if (typeof navigator === "undefined") return "";
    const ua = navigator.userAgent;
    return ua.length > 140 ? `${ua.slice(0, 140)}…` : ua;
}

/**
 * 反馈弹层（S3 四件套之三）：纯前端聚合——填写 → 复制内容 → 任选渠道（邮件 / 用户群）提交。
 * 不建任何后端接口；截图仅本地预览与剪贴板尽力复制，不自动上传。
 */
export function CanvasFeedbackDialog({ open, onClose, projectId, nodeCount }: CanvasFeedbackDialogProps) {
    const { message } = App.useApp();
    const [description, setDescription] = useState("");
    const [screenshot, setScreenshot] = useState<{ file: File; url: string } | null>(null);
    const [shareAvailable, setShareAvailable] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareOn, setShareOn] = useState(false);
    const [shareUrl, setShareUrl] = useState("");
    const [capturedAt, setCapturedAt] = useState("");
    const [fallbackText, setFallbackText] = useState<string | null>(null);
    const textareaRef = useRef<GetRef<typeof Input.TextArea>>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const descriptionId = useId();
    const shareHintId = useId();

    // 截图对象 URL 生命周期：替换/移除/卸载时回收
    useEffect(() => () => {
        if (screenshot?.url) URL.revokeObjectURL(screenshot.url);
    }, [screenshot]);

    // 打开时：重置分享勾选与降级文本框、采集时间；只读读取现有分享状态（不创建分享）
    useEffect(() => {
        if (!open) return;
        setShareOn(false);
        setFallbackText(null);
        setCapturedAt(new Date().toISOString());
        if (!projectId) {
            setShareAvailable(false);
            setShareUrl("");
            return;
        }
        let cancelled = false;
        setShareLoading(true);
        getCanvasShare(projectId)
            .then((result) => {
                if (cancelled) return;
                const url = result.share.enabled && result.share.token ? `${window.location.origin}/share/canvas/${result.share.token}` : "";
                setShareAvailable(Boolean(url));
                setShareUrl(url);
            })
            .catch(() => {
                if (cancelled) return;
                setShareAvailable(false);
                setShareUrl("");
            })
            .finally(() => {
                if (!cancelled) setShareLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, projectId]);

    const metaInput = useMemo(
        () => ({
            appVersion: APP_VERSION,
            pathname: typeof window === "undefined" ? "" : window.location.pathname,
            canvasId: projectId,
            nodeCount,
            userAgent: summarizeUserAgent(),
            capturedAt,
        }),
        [capturedAt, nodeCount, projectId],
    );

    const payloadInput = useMemo(
        () => ({
            description,
            screenshotName: screenshot?.file.name,
            shareUrl: shareOn && shareUrl ? shareUrl : undefined,
            meta: metaInput,
        }),
        [description, metaInput, screenshot, shareOn, shareUrl],
    );

    // 明示区与实际复制文本共用同一组装（透明度原则：单点可核全量 payload，含条件项）
    const manifest = useMemo(() => buildFeedbackManifest(payloadInput), [payloadInput]);
    const canCopy = description.trim().length > 0;

    const copy = useCallback(async () => {
        if (!canCopy) {
            message.warning("请先填写问题描述");
            return;
        }
        let payloadText: string;
        try {
            payloadText = buildFeedbackPayload(payloadInput).text;
        } catch {
            message.warning("请先填写问题描述");
            return;
        }
        try {
            await navigator.clipboard.writeText(payloadText);
            setFallbackText(null);
            message.success("反馈内容已复制");
        } catch {
            setFallbackText(payloadText);
            message.error("复制失败，请在下方文本框手动全选复制");
            return;
        }
        if (!screenshot) return;
        try {
            if (typeof ClipboardItem === "undefined") throw new Error("unsupported");
            const mime = screenshot.file.type || "image/png";
            const item = new ClipboardItem({ "text/plain": new Blob([payloadText], { type: "text/plain" }), [mime]: screenshot.file });
            await navigator.clipboard.write([item]);
            message.success("截图也已写入剪贴板，可直接粘贴");
        } catch {
            message.info("截图未能写入剪贴板，请在提交时手动选择截图文件粘贴");
        }
    }, [canCopy, message, payloadInput, screenshot]);

    const openMail = useCallback(() => {
        if (!canCopy) {
            message.warning("请先填写问题描述");
            return;
        }
        try {
            window.location.href = buildFeedbackMailtoUrl(payloadInput);
        } catch {
            message.warning("请先填写问题描述");
        }
    }, [canCopy, message, payloadInput]);

    const openGroup = useCallback(() => {
        window.open(FEEDBACK_CHANNEL_URL, "_blank", "noopener,noreferrer");
    }, []);

    const pickScreenshot = () => fileInputRef.current?.click();

    return (
        <AppModal
            className="canvas-feedback-modal"
            open={open}
            onCancel={onClose}
            footer={null}
            title={null}
            centered
            keyboard
            width="min(600px, calc(100vw - 24px))"
            flush
            afterOpenChange={(visible) => {
                if (visible) window.requestAnimationFrame(() => textareaRef.current?.focus());
            }}
        >
            <div className="max-h-[min(760px,calc(100vh-64px))] overflow-y-auto px-5 py-5 sm:px-6">
                <header className="mb-4 flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/[.07]" aria-hidden>
                        <MessageSquareHeart className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <div className="text-[15px] font-semibold leading-5">反馈</div>
                        <div className="text-xs leading-5 text-foreground/65">内容不会自动发送——先复制，再粘贴到邮件或用户群中提交。</div>
                    </div>
                </header>

                <label className="mb-1.5 block text-xs font-medium text-foreground/70" htmlFor={descriptionId}>
                    问题描述 <span className="font-normal text-foreground/65">（必填）</span>
                </label>
                <Input.TextArea
                    id={descriptionId}
                    ref={textareaRef}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    maxLength={2000}
                    showCount
                    placeholder="请描述你遇到的问题，或想提的建议…"
                />

                <div className="mt-4">
                    <div className="mb-1.5 text-xs font-medium text-foreground/70">
                        截图 <span className="font-normal text-foreground/65">（可选，不会自动上传）</span>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-label="选择截图文件"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) setScreenshot({ file, url: URL.createObjectURL(file) });
                            event.currentTarget.value = "";
                        }}
                    />
                    {screenshot ? (
                        <div className="rounded-lg border border-foreground/10 p-2">
                            <img src={screenshot.url} alt={screenshot.file.name} className="max-h-40 w-full rounded object-contain" />
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-xs text-foreground/65">{screenshot.file.name}</span>
                                <Button size="small" type="text" icon={<X className="size-3.5" />} onClick={() => setScreenshot(null)} aria-label="移除截图">
                                    移除
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button size="small" icon={<ImagePlus className="size-3.5" />} onClick={pickScreenshot}>
                            添加截图
                        </Button>
                    )}
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground/70">附上画布分享链接</div>
                        <div id={shareHintId} className="mt-0.5 text-xs leading-5 text-foreground/65">
                            {shareLoading
                                ? "读取分享状态…"
                                : shareAvailable
                                  ? shareOn
                                      ? shareUrl
                                      : "将包含当前画布的公开分享链接"
                                  : "开启画布分享后可附上"}
                        </div>
                        {shareOn && shareAvailable ? <div className="mt-0.5 text-xs leading-5 text-foreground/60">提交后排查期间请保持分享开启，撤销后链接失效</div> : null}
                    </div>
                    <Switch
                        size="small"
                        checked={shareOn}
                        disabled={!shareAvailable || shareLoading}
                        onChange={setShareOn}
                        aria-label="附上画布分享链接"
                        aria-describedby={!shareAvailable || shareLoading ? shareHintId : undefined}
                    />
                </div>

                <details className="group mt-4 rounded-lg border border-foreground/10 bg-foreground/[.03] px-3 py-2">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-foreground/70 [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
                        将包含以下信息
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs leading-5">
                        {manifest.map(([label, value]) => (
                            <li key={label} className="flex gap-2">
                                <span className="w-16 shrink-0 text-foreground/65">{label}</span>
                                <span className="min-w-0 break-all text-foreground/70">{value}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-2 text-[11px] leading-4 text-foreground/60">不包含 Cookie、密钥或其他敏感信息。</div>
                </details>

                {fallbackText ? (
                    <div className="mt-3">
                        <label className="mb-1.5 block text-xs font-medium text-foreground/70" htmlFor={`${descriptionId}-fallback`}>
                            请手动复制以下内容（点击文本后全选）
                        </label>
                        <Input.TextArea
                            id={`${descriptionId}-fallback`}
                            readOnly
                            value={fallbackText}
                            rows={6}
                            onFocus={(event) => event.currentTarget.select()}
                        />
                    </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                    <span className="mr-auto flex flex-col text-[11px] leading-4 text-foreground/60">
                        <span>先复制反馈内容，再任选渠道提交</span>
                        <span>加群后将复制的反馈内容粘贴到群内</span>
                    </span>
                    <Button icon={<Users className="size-3.5" />} onClick={openGroup}>
                        加入用户群
                    </Button>
                    <Button icon={<Mail className="size-3.5" />} disabled={!canCopy} onClick={openMail}>
                        邮件反馈
                    </Button>
                    <Button type="primary" icon={<Copy className="size-3.5" />} disabled={!canCopy} onClick={() => void copy()}>
                        复制反馈内容
                    </Button>
                </div>
            </div>
        </AppModal>
    );
}
