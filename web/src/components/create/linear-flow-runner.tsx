/**
 * 直线流程执行器（W5 直线入口设计卡 §3.1 梯度 0 / §五文件清单）。
 *
 * ★ 流程（设计卡原文）：点卡 → 传图（可选）→ ≤3 问澄清 → 出图 → 下载
 * **全程不见画布**（headless 语义）—— 结果在弹层内交付，画布通过「在画布中打开」可选进入
 * （硬验收②「给而不要求」）。
 *
 * ★ 交付面纪律（控制线 2026-10-04 裁定①）：
 * 硬验收③只要求「交付步必须在卡流程内」。本组件**自建轻量交付面**（结果图 + 下载 +
 * 可选「在画布中打开」），**不依赖**姊妹卡的 `UnifiedTaskFace`（该组件代码尚未实现 ——
 * 全仓 git grep 零命中，A线双卡为纯设计文档）。
 *
 * ★ 回改点（技术债显式化，控制线要求记档）：
 * 姊妹卡实现批（守卫测试 + 预览/下载补齐）落地后，本组件的交付面**应回改为挂
 * `UnifiedTaskFace`**（`taskIds` + `onDownload` + `showOpenInCanvas`），消除重复实现。
 * 记档位置：`docs/artifacts/w5-linear-entry-card.md` 验收节 + 本文件注释。
 *
 * ★ 门控纪律（设计卡 §3.2，方向钉死）：
 * 门控**只作用于本直线流程内**（`linear-flow-gate.ts` 的三态），常规画布不受任何影响 ——
 * 本组件不写任何画布 store 的门控状态，只在自己的局部 state 里推导步骤可见性。
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { App, Button, Input, Modal } from "antd";
import { Check, Download, LoaderCircle, RotateCcw, Upload } from "lucide-react";

import { uploadImage } from "@/services/image-storage";
import { runBackendGenerationTask } from "@/services/api/generation-task";
import type { ReferenceImage } from "@/types/image";
import type { AiConfig } from "@/stores/use-config-store";
import { modelCapabilityConfigFor } from "@/lib/model-capabilities";
import {
    LINEAR_FLOW_QUESTION_LIMIT,
    buildLinearFlowMetadata,
    buildLinearFlowPrompt,
    linearFlowAnswersComplete,
    linearFlowCardIcon,
    resolveLinearFlowScenePresetId,
    type LinearFlowCard,
    type LinearFlowStepId,
} from "@/lib/canvas/linear-flow-cards";
import { linearFlowStepGate, nextLinearFlowStep, resolveLinearFlowGate, visibleLinearFlowSteps } from "@/lib/canvas/linear-flow-gate";
import { generationErrorMessage } from "@/lib/generation-error";

/** 卡流程的运行阶段（生成/交付共用同一状态机）。 */
type RunnerStage = "form" | "generating" | "done" | "error";

export type LinearFlowRunnerProps = {
    card: LinearFlowCard | null;
    /**
     * 生成配置基准（**调用方须已按 card.mode 重写 model 族**，见 `create/index.tsx` 的
     * `linearFlowConfig`）。本组件只做防御性修正：若 `config.model` 与 `model` prop 不一致，
     * 以 `model` 为准 —— 实测（测试线 b12r16 ③）曾因图片卡提交文本模型而 HTTP 400。
     */
    config: AiConfig;
    /** 生成用的模型（图片卡 = imageModel；文本卡 = textModel）。★ 本组件据此修正 config.model。 */
    model: string;
    onClose: () => void;
    /** 可选：把结果转入画布（硬验收②「给而不要求」）。 */
    onOpenInCanvas?: (input: { prompt: string; resultUrl: string; metadata: Record<string, unknown> }) => void | Promise<void>;
};

/**
 * 直线流程执行器。
 *
 * 单卡单流程：`card` 变化即重置（同一时刻只跑一张卡）。
 */
export function LinearFlowRunner({ card, config, model, onClose, onOpenInCanvas }: LinearFlowRunnerProps) {
    const { message: toast } = App.useApp();
    const [step, setStep] = useState<LinearFlowStepId>("clarify");
    const [completed, setCompleted] = useState<LinearFlowStepId[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [reference, setReference] = useState<ReferenceImage | null>(null);
    const [uploading, setUploading] = useState(false);
    const [stage, setStage] = useState<RunnerStage>("form");
    const [resultUrl, setResultUrl] = useState("");
    const [resultText, setResultText] = useState("");
    const [errorText, setErrorText] = useState("");
    const [openingCanvas, setOpeningCanvas] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const gate = useMemo(() => resolveLinearFlowGate(step, completed), [step, completed]);
    const visibleSteps = useMemo(() => visibleLinearFlowSteps(gate), [gate]);
    const prompt = useMemo(() => (card ? buildLinearFlowPrompt(card, answers) : ""), [card, answers]);
    const scenePresetId = useMemo(() => (card ? resolveLinearFlowScenePresetId(card, answers) : undefined), [card, answers]);
    const answersComplete = useMemo(() => (card ? linearFlowAnswersComplete(card, answers) : false), [card, answers]);

    const reset = useCallback(() => {
        setStep("clarify");
        setCompleted([]);
        setAnswers({});
        setReference(null);
        setStage("form");
        setResultUrl("");
        setResultText("");
        setErrorText("");
        abortRef.current?.abort();
        abortRef.current = null;
    }, []);

    const handleClose = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        onClose();
    }, [onClose]);

    /** 传图（可选步；`acceptsReference` 为 false 的卡不显示）。 */
    const handleUpload = useCallback(async (file: File) => {
        setUploading(true);
        try {
            const uploaded = await uploadImage(file);
            setReference({
                id: `linear-flow-${Date.now()}`,
                name: file.name,
                type: uploaded.mimeType || file.type || "image/png",
                dataUrl: "",
                url: uploaded.url,
                storageKey: uploaded.storageKey,
                bytes: uploaded.bytes,
                width: uploaded.width,
                height: uploaded.height,
            });
            setCompleted((current) => (current.includes("upload") ? current : [...current, "upload"]));
            setStep("clarify");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "上传失败");
        } finally {
            setUploading(false);
        }
    }, [toast]);

    /** 生成（出图/出文本）。 */
    const handleGenerate = useCallback(async () => {
        if (!card) return;
        setStage("generating");
        setErrorText("");
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const metadata = {
                ...buildLinearFlowMetadata(card, answers),
                linearFlowAnswers: answers,
            };
            // ★ 防御性修正（修复令第 1 面）：契约声明 model 按 card.mode 选择，实现必须真正生效 ——
            // 调用方已重写 config，此处再以 model prop 为准兜一层，防再出现「UI 显示与实际提交不一致」。
            const requestConfig = config.model === model ? config : { ...config, model, ...(card.mode === "text" ? { textModel: model } : { imageModel: model }) };
            const result = await runBackendGenerationTask({
                mode: card.mode,
                prompt,
                config: requestConfig,
                referenceImages: reference ? [reference] : [],
                signal: controller.signal,
                metadata,
            });
            if (card.mode === "image") {
                const url = result.images?.[0]?.dataUrl || "";
                if (!url) throw new Error("生成任务没有返回图片");
                setResultUrl(url);
            } else {
                if (!result.text?.trim()) throw new Error("生成任务没有返回文本");
                setResultText(result.text);
            }
            setCompleted((current) => (current.includes("generate") ? current : [...current, "generate"]));
            setStep("deliver");
            setStage("done");
        } catch (error) {
            if (controller.signal.aborted) {
                setStage("form");
                return;
            }
            const text = generationErrorMessage(error);
            setErrorText(text);
            setStage("error");
            toast.error(text);
        } finally {
            abortRef.current = null;
        }
    }, [answers, card, config, prompt, reference, toast]);

    /** 交付步的「在画布中打开」（可选，硬验收②「给而不要求」）。 */
    const handleOpenInCanvas = useCallback(async () => {
        if (!onOpenInCanvas || !resultUrl) return;
        setOpeningCanvas(true);
        try {
            await onOpenInCanvas({ prompt, resultUrl, metadata: card ? buildLinearFlowMetadata(card, answers) : {} });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "转入画布失败");
        } finally {
            setOpeningCanvas(false);
        }
    }, [answers, card, onOpenInCanvas, prompt, resultUrl, toast]);

    if (!card) return null;
    const Icon = linearFlowCardIcon(card);
    const imageProfile = modelCapabilityConfigFor(config, model).image;
    const maxReferences = imageProfile?.references?.maxImages ?? 0;
    const canUpload = card.acceptsReference && maxReferences > 0;

    return (
        <Modal
            open
            className="workspace-modal linear-flow-modal"
            title={
                <span className="linear-flow-modal-title">
                    <Icon size={18} strokeWidth={2} />
                    {card.title}
                </span>
            }
            onCancel={handleClose}
            destroyOnHidden
            footer={null}
            width={560}
        >
            <nav className="linear-flow-steps" aria-label="流程步骤">
                {visibleSteps.map((item) => {
                    const state = linearFlowStepGate(gate, item.id);
                    return (
                        <span key={item.id} className={`linear-flow-step is-${state} ${step === item.id ? "is-current" : ""}`} aria-current={step === item.id ? "step" : undefined}>
                            {completed.includes(item.id) ? <Check size={12} strokeWidth={3} /> : null}
                            {item.title}
                        </span>
                    );
                })}
            </nav>

            <div className="linear-flow-body">
                {stage === "done" ? (
                    <section className="linear-flow-deliver" aria-label="交付">
                        {card.mode === "image" ? (
                            <img className="linear-flow-result-image" src={resultUrl} alt="生成结果" />
                        ) : (
                            <pre className="linear-flow-result-text">{resultText}</pre>
                        )}
                        <div className="linear-flow-deliver-actions">
                            {card.mode === "image" ? (
                                <a className="linear-flow-download" href={resultUrl} download={`${card.id}.png`}>
                                    <Download size={15} strokeWidth={2} />
                                    下载成品
                                </a>
                            ) : (
                                <Button onClick={() => void navigator.clipboard.writeText(resultText)}>复制文本</Button>
                            )}
                            {onOpenInCanvas && card.mode === "image" ? (
                                <Button loading={openingCanvas} onClick={() => void handleOpenInCanvas()}>
                                    在画布中打开
                                </Button>
                            ) : null}
                            <Button type="text" onClick={reset}>
                                <RotateCcw size={14} strokeWidth={2} />
                                重新来一次
                            </Button>
                        </div>
                        <p className="linear-flow-deliver-hint">成品已就绪。下载后可直接用；想继续编辑就点「在画布中打开」。</p>                    </section>
                ) : (
                    <>
                        {stage === "generating" ? (
                            <div className="linear-flow-progress" role="status">
                                <LoaderCircle className="is-spinning" size={16} strokeWidth={2} />
                                正在生成，请稍候…
                            </div>
                        ) : null}

                        {stage === "error" && errorText ? (
                            <div className="linear-flow-error" role="alert">
                                {errorText}
                            </div>
                        ) : null}

                        {canUpload ? (
                            <section className="linear-flow-upload" aria-label="参考图">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        event.target.value = "";
                                        if (file) void handleUpload(file);
                                    }}
                                />
                                {reference ? (
                                    <div className="linear-flow-upload-preview">
                                        <img src={reference.url || reference.dataUrl} alt="已上传的参考图" />
                                        <button type="button" onClick={() => fileInputRef.current?.click()}>
                                            换一张
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" className="linear-flow-upload-button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                                        {uploading ? <LoaderCircle className="is-spinning" size={15} strokeWidth={2} /> : <Upload size={15} strokeWidth={2} />}
                                        {uploading ? "上传中…" : "上传商品图（可选）"}
                                    </button>
                                )}
                            </section>
                        ) : null}

                        <section className="linear-flow-questions" aria-label="确认信息">
                            {card.questions.map((question) => (
                                <div key={question.id} className="linear-flow-question">
                                    <label htmlFor={`linear-flow-${question.id}`}>{question.question}</label>
                                    {question.kind === "select" ? (
                                        <div className="linear-flow-options" role="group" aria-labelledby={`linear-flow-${question.id}`}>
                                            {(question.options || []).map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className="linear-flow-option"
                                                    aria-pressed={answers[question.id] === option.value}
                                                    title={option.hint}
                                                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <Input
                                            id={`linear-flow-${question.id}`}
                                            value={answers[question.id] || ""}
                                            placeholder={question.placeholder}
                                            onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                                        />
                                    )}
                                </div>
                            ))}
                        </section>

                        <footer className="linear-flow-footer">
                            <span className="linear-flow-scene-hint" aria-live="polite">
                                {scenePresetId ? `场景预设：${scenePresetId}（已显式写入任务元数据）` : ""}
                            </span>
                            <div className="linear-flow-footer-actions">
                                <Button onClick={handleClose}>取消</Button>
                                <Button
                                    type="primary"
                                    loading={stage === "generating"}
                                    disabled={!answersComplete}
                                    onClick={() => void handleGenerate()}
                                >
                                    {card.mode === "image" ? "开始出图" : "开始优化"}
                                </Button>
                            </div>
                        </footer>
                        {card.questions.length > LINEAR_FLOW_QUESTION_LIMIT ? <p className="linear-flow-warning">该卡问题超过 3 个，违反直线流程约束。</p> : null}
                    </>
                )}
            </div>
        </Modal>
    );
}

/** 供外部复用的步骤导航（测试/其他入口渲染用）。 */
export { nextLinearFlowStep };
