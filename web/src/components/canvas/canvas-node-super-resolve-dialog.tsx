/**
 * AI 超分参数对话框（O-03 层2）。
 *
 * 形态照 `canvas-node-upscale-dialog.tsx`（左源图 + 右参数面），但语义是云端 AI 超分，
 * 与免费插值严格分开（命名分流红线）。
 *
 * ★ UI 样板件（2026-10-04 控制线追加）：本弹窗是 W6「画布弹窗家族 UI 统一批」的**样板参照**。
 * 样式层全部消费 flora tokens（间距/圆角/字号走令牌，动效从 DESIGN.md 动效规格表取值），
 * **只动样式不碰逻辑分支** —— 布局骨架、状态机、校验与提交路径与改造前完全一致。
 *
 * 令牌来源（三层体系 Primitive → Semantic → Component）：
 * - 圆角：`--r-*`（xs/sm/md/lg/xl/2xl）
 * - 字号：`--fs-*`（tiny/label/caption/body/heading/title）
 * - 间距：`--space-*`（1/2/3/4/5/6）
 * - 动效：DESIGN.md 动效规格表 —— 微 fast 100–150ms（悬停/按下反馈）、
 *   标准 base 200–250ms（对话框、展开）；Primitive 为 `--motion-dur-fast-calc` / `--motion-state`
 * - 阴影：`--elevation-overlay`（flora 浮层高度）
 *
 * 动效六规则遵守：只动 transform/opacity 与颜色（规则 1）、
 * 错误提示单次不循环（规则 4）、`prefers-reduced-motion` 由全局 motion-scale 降级（规则 5）。
 */
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Segmented } from "antd";
import { Sparkles } from "lucide-react";

import { readImageMeta } from "@/lib/image-utils";
import { DEFAULT_SUPER_RESOLVE_PARAMS, SUPER_RESOLVE_MODES, SUPER_RESOLVE_TARGETS, type SuperResolveMode, type SuperResolveParams } from "@/lib/canvas/super-resolve-params";

/** 弹窗族共用样式（W6 样板：其他弹窗对齐本组常量即可获得一致骨架）。 */
const DIALOG_STYLE = {
    /** 区块间距（base 档，见 DESIGN.md 密度补录）。 */
    section: "space-y-[var(--space-5)]",
    /** 标题字号（页面标题档）。 */
    title: "text-[var(--fs-title)] font-semibold",
    /** 说明文字（说明档 + 次级前景色）。 */
    description: "mt-[var(--space-2)] text-[var(--fs-body)] text-[color:var(--workspace-foreground)] opacity-60",
    /** 卡片圆角（浮层用 2xl 档，与 flora 浮卡同构）。 */
    panel: "rounded-[var(--r-2xl)] border p-[var(--space-4)]",
    /** 内嵌画布圆角（lg 档）。 */
    canvas: "rounded-[var(--r-lg)]",
    /** 段落标题（标签档 + 中等字重）。 */
    label: "font-medium text-[var(--fs-body)] opacity-75",
    /** 字段组间距。 */
    field: "space-y-[var(--space-2)]",
    /** 表单列间距。 */
    column: "space-y-[var(--space-6)] py-[var(--space-2)]",
    /** 数值强调（正文档 + 半粗）。 */
    value: "font-semibold text-[var(--fs-body)]",
    /** 次级文字。 */
    muted: "text-[var(--fs-body)] opacity-60",
    /** 小字说明。 */
    hint: "text-[var(--fs-caption)]",
    /** 反馈过渡（微 fast 档：悬停/按下反馈，见动效规格表第 1 行）。 */
    interactive: "transition-colors duration-[var(--motion-dur-fast-calc)] ease-out",
} as const;

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
            <div className={DIALOG_STYLE.section}>
                <div>
                    <h2 className={DIALOG_STYLE.title}>AI 超分</h2>
                    <p className={DIALOG_STYLE.description}>云端重建像素细节，另存为新图片，保留原图。与「调整尺寸」的插值放大不同，AI 超分会生成新的真实细节，消耗积分。</p>
                </div>
                <div className="grid gap-[var(--space-6)] md:grid-cols-[minmax(260px,1fr)_360px]">
                    <div className={DIALOG_STYLE.panel}>
                        <div className={`grid min-h-[280px] place-items-center bg-black/5 ${DIALOG_STYLE.canvas}`}>
                            <img src={dataUrl} alt="" className={`max-h-[320px] max-w-full object-contain shadow-xl ${DIALOG_STYLE.canvas}`} draggable={false} />
                        </div>
                        <div className={`mt-[var(--space-3)] flex items-center justify-between ${DIALOG_STYLE.hint}`}>
                            <span className={DIALOG_STYLE.muted}>源图</span>
                            <span className={DIALOG_STYLE.value}>{image ? `${image.width} x ${image.height} px` : "读取中"}</span>
                        </div>
                    </div>
                    <div className={DIALOG_STYLE.column}>
                        <div className={DIALOG_STYLE.field}>
                            <div className={DIALOG_STYLE.label}>目标档</div>
                            <Segmented
                                block
                                value={params.targetResolution}
                                options={SUPER_RESOLVE_TARGETS.map((item) => ({ label: `${item.label} · ${item.longEdge}px`, value: item.value, disabled: Boolean(image && sourceLongEdge >= item.longEdge) }))}
                                onChange={(value) => setParams((current) => ({ ...current, targetResolution: value as SuperResolveParams["targetResolution"] }))}
                            />
                            {reachedTarget ? <div className="text-[var(--fs-caption)] font-medium text-[#ef4444]">图片已达到该档，无需超分</div> : null}
                        </div>
                        <div className={DIALOG_STYLE.field}>
                            <div className={DIALOG_STYLE.label}>放大方式</div>
                            <Segmented
                                block
                                value={params.mode}
                                options={SUPER_RESOLVE_MODES.map((item) => ({
                                    value: item.value,
                                    label: (
                                        <span className="flex min-h-12 flex-col justify-center text-left leading-5">
                                            <span className="font-medium">{item.title}</span>
                                            <span className="text-[var(--fs-caption)] opacity-55">{item.description}</span>
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
                                <label className={`flex items-start gap-[var(--space-2)] rounded-[var(--r-lg)] border px-[var(--space-3)] py-[var(--space-2)] text-[var(--fs-caption)] leading-5`}>
                                    <input type="checkbox" className="mt-0.5" checked={enhanceConfirmed} onChange={(event) => setEnhanceConfirmed(event.target.checked)} />
                                    <span className="opacity-75">我了解 AI 增强可能改变画面细节质感，与保真放大结果不同</span>
                                </label>
                            ) : null}
                        </div>
                        <div className={`${DIALOG_STYLE.panel} text-[var(--fs-body)]`}>
                            <div className="flex items-center justify-between">
                                <span className={DIALOG_STYLE.muted}>输出尺寸</span>
                                <span className={DIALOG_STYLE.value}>{outputSize ? `${outputSize.width} x ${outputSize.height} px` : "未知"}</span>
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
