/**
 * AI 超分参数对话框（O-03 层2）。
 *
 * 形态照 `canvas-node-upscale-dialog.tsx`（左源图 + 右参数面），但语义是云端 AI 超分，
 * 与免费插值严格分开（命名分流红线）。
 */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Segmented } from "antd";
import { Sparkles } from "lucide-react";

import { readImageMeta } from "@/lib/image-utils";
import { DEFAULT_SUPER_RESOLVE_PARAMS, SUPER_RESOLVE_MODES, SUPER_RESOLVE_TARGETS, type SuperResolveMode, type SuperResolveParams } from "@/lib/canvas/super-resolve-params";

export function CanvasNodeSuperResolveDialog({ dataUrl, open, onClose, onConfirm }: { dataUrl: string; open: boolean; onClose: () => void; onConfirm: (params: SuperResolveParams) => void }) {
    const [params, setParams] = useState<SuperResolveParams>(DEFAULT_SUPER_RESOLVE_PARAMS);
    const [image, setImage] = useState<{ width: number; height: number } | null>(null);
    const [enhanceConfirmed, setEnhanceConfirmed] = useState(false);
    const sourceLongEdge = image ? Math.max(image.width, image.height) : 0;
    const target = SUPER_RESOLVE_TARGETS.find((item) => item.value === params.targetResolution) ?? SUPER_RESOLVE_TARGETS[0];
    const outputSize = useMemo(() => {
        if (!image || sourceLongEdge <= 0) return null;
        const scale = target.longEdge / sourceLongEdge;
        return { width: Math.round(image.width * scale), height: Math.round(image.height * scale) };
    }, [image, sourceLongEdge, target.longEdge]);
    // 源图已达到或超过目标档时长边不再放大（超分只跑一次，不做二次插值）。
    const reachedTarget = Boolean(image && sourceLongEdge >= target.longEdge);
    const needsConfirm = params.mode === "enhance" && !enhanceConfirmed;
    const canResolve = Boolean(image) && !reachedTarget && !needsConfirm;

    useEffect(() => {
        if (!open) return;
        setParams(DEFAULT_SUPER_RESOLVE_PARAMS);
        setImage(null);
        setEnhanceConfirmed(false);
    }, [dataUrl, open]);

    useEffect(() => {
        if (!open) return;
        void readImageMeta(dataUrl).then(setImage);
    }, [dataUrl, open]);

    return (
        <Modal title={null} open={open && Boolean(dataUrl)} onCancel={onClose} footer={null} width={820} centered destroyOnHidden>
            <div className="space-y-5">
                <div>
                    <h2 className="text-xl font-semibold">AI 超分</h2>
                    <p className="mt-2 text-sm opacity-60">云端重建像素细节，另存为新图片，保留原图。与「调整尺寸」的插值放大不同，AI 超分会生成新的真实细节，消耗积分。</p>
                </div>
                <div className="grid gap-6 md:grid-cols-[minmax(260px,1fr)_360px]">
                    <div className="rounded-xl border p-4">
                        <div className="grid min-h-[280px] place-items-center rounded-lg bg-black/5">
                            <img src={dataUrl} alt="" className="max-h-[320px] max-w-full rounded-lg object-contain shadow-xl" draggable={false} />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="opacity-60">源图</span>
                            <span className="font-semibold">{image ? `${image.width} x ${image.height} px` : "读取中"}</span>
                        </div>
                    </div>
                    <div className="space-y-6 py-2">
                        <div className="space-y-2">
                            <div className="font-medium opacity-75">目标档</div>
                            <Segmented
                                block
                                value={params.targetResolution}
                                options={SUPER_RESOLVE_TARGETS.map((item) => ({ label: `${item.label} · ${item.longEdge}px`, value: item.value, disabled: Boolean(image && sourceLongEdge >= item.longEdge) }))}
                                onChange={(value) => setParams((current) => ({ ...current, targetResolution: value as SuperResolveParams["targetResolution"] }))}
                            />
                            {reachedTarget ? <div className="text-xs font-medium text-[#ef4444]">图片已达到该档，无需超分</div> : null}
                        </div>
                        <div className="space-y-2">
                            <div className="font-medium opacity-75">放大方式</div>
                            <Segmented
                                block
                                value={params.mode}
                                options={SUPER_RESOLVE_MODES.map((item) => ({
                                    value: item.value,
                                    label: (
                                        <span className="flex min-h-12 flex-col justify-center text-left leading-5">
                                            <span className="font-medium">{item.title}</span>
                                            <span className="text-xs opacity-55">{item.description}</span>
                                        </span>
                                    ),
                                }))}
                                onChange={(value) => {
                                    setParams((current) => ({ ...current, mode: value as SuperResolveMode }));
                                    // 切走 AI 增强时清掉确认态，避免回来时跳过确认。
                                    if (value !== "enhance") setEnhanceConfirmed(false);
                                }}
                            />
                            {params.mode === "enhance" ? (
                                <label className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5">
                                    <input type="checkbox" className="mt-0.5" checked={enhanceConfirmed} onChange={(event) => setEnhanceConfirmed(event.target.checked)} />
                                    <span className="opacity-75">我了解 AI 增强可能改变画面细节质感，与保真放大结果不同</span>
                                </label>
                            ) : null}
                        </div>
                        <div className="rounded-xl border px-4 py-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="opacity-60">输出尺寸</span>
                                <span className="font-semibold">{outputSize ? `${outputSize.width} x ${outputSize.height} px` : "未知"}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button type="primary" size="large" icon={<Sparkles className="size-4" />} disabled={!canResolve} onClick={() => onConfirm(params)}>
                        开始超分
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
