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
 * ★ 回改点已偿（2026-10-05 统一任务面批）：
 * 姊妹卡 `UnifiedTaskFace` 已落地，本组件在**生成阶段**挂载它承载统一进度面
 * （`taskIds` 锚定 TaskID，订阅契约由该组件单一持有）—— 这同时是设计卡验收 2
 * 「无画布上下文页面挂载跑通」的**真实挂载点**（`/create` 不是画布页）。
 * 交付阶段仍保留本组件自建交付面：它是**卡专属**的（含「重新来一次」等流程动作），
 * 且结果源是本地 `dataUrl`（任务面预览源是服务端 `previewUrl`），两者语义不同不合并。
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
import { UnifiedTaskFace } from "@/components/task/unified-task-face";

/** 卡流程的运行阶段（生成/交付共用同一状态机）。 */
type RunnerStage = "form" | "generating" | "done" | "error";

/**
 * 转入画布的两种语义（★ 硬验收②「画布在任一步可达」—— 两种语义必须分流，不得混用）：
 *
 * - `result`：**交付阶段**的结果交接 —— 结果图已就绪，物化为素材附件写入承载容器会话。
 * - `carrier`：**生成阶段**的承载画布打开 —— 任务尚未完成，无结果可交，只建/开承载容器
 *   （headless 语义：画布是产物的承载方式，提前可见是特性，不是「无意义的空画布」）。
 *
 * 判别式（`kind`）让调用方无法把两种语义写混 —— 生成阶段不可能拿到 `resultUrl`。
 */
export type LinearFlowCanvasHandoff =
    | { kind: "result"; prompt: string; resultUrl: string; taskId?: string; metadata: Record<string, unknown> }
    | { kind: "carrier"; prompt: string; taskId: string; metadata: Record<string, unknown> };

export type LinearFlowRunnerProps = {
    card: LinearFlowCard | null;
    /**
     * 生成配置基准（**调用方已按 card.mode 重写 model 族**，见 `create/index.tsx` 的
     * `linearFlowConfig`）。
     *
     * ★ R1 修复（D-1）：防御层**不再无条件以 `model` prop 覆写** —— 那会把调用方
     * 按 card.mode 选好的模型重新改回「当前页面模式的模型」（文本/视频页面开图片卡
     * 时重新引入已修缺陷）。现行为：仅当 `config.model` 与该卡 mode 对应的模型族字段
     * （`imageModel` / `textModel`）不一致时，才回退到 `model` prop。
     */
    config: AiConfig;
    /**
     * 本卡模式的模型（与 `linearFlowConfig.model` 同源，调用方用同一变量传递）。
     * ★ 仅作为防御层回退值：当 `config` 与 mode 族不一致时使用。
     */
    model: string;
    onClose: () => void;
    /**
     * 可选：转入画布（硬验收②「给而不要求」）。
     * 交付阶段发 `result`（结果交接），生成阶段发 `carrier`（打开承载画布）。
     */
    onOpenInCanvas?: (input: LinearFlowCanvasHandoff) => void | Promise<void>;
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
    // 统一任务面锚点（验收 2）：生成阶段把 taskId 交给 UnifiedTaskFace 承载进度四要素。
    const [taskId, setTaskId] = useState("");
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
        setTaskId("");
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
            // ★ R1 修复（D-1）：防御层只在**配置与 card.mode 模型族不一致**时介入。
            // 旧实现（`config.model === model ? config : {...覆写}`）在文本/视频页面开图片卡时
            // 会把调用方选好的 imageModel 改回页面模型（model prop 当时 = selectedModel）——
            // 重新引入「提交文本模型 → HTTP 400」缺陷。
            // 现判据：图片卡看 config.imageModel，文本卡看 config.textModel；
            // 一致则**原样使用**（调用方已重写），不一致才回退到 model prop。
            const modeModel = card.mode === "text" ? config.textModel : config.imageModel;
            const requestConfig = config.model === modeModel
                ? config
                : { ...config, model, ...(card.mode === "text" ? { textModel: model } : { imageModel: model }) };
            const result = await runBackendGenerationTask({
                mode: card.mode,
                prompt,
                config: requestConfig,
                referenceImages: reference ? [reference] : [],
                signal: controller.signal,
                metadata,
                // 统一任务面订阅锚点：任务一创建就把 id 交给 UnifiedTaskFace。
                onTaskUpdate: (task) => setTaskId(task.id),
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

    /** 交付步的「在画布中打开」（可选，硬验收②「给而不要求」）—— 结果交接语义。 */
    const handleOpenInCanvas = useCallback(async () => {
        if (!onOpenInCanvas || !resultUrl) return;
        setOpeningCanvas(true);
        try {
            await onOpenInCanvas({ kind: "result", prompt, resultUrl, taskId: taskId || undefined, metadata: card ? buildLinearFlowMetadata(card, answers) : {} });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "转入画布失败");
        } finally {
            setOpeningCanvas(false);
        }
    }, [answers, card, onOpenInCanvas, prompt, resultUrl, taskId, toast]);

    /**
     * 生成中的「在画布中打开」—— 承载画布语义（硬验收②「画布在任一步可达」）。
     *
     * 任务尚未完成，没有结果可交接：只把承载容器建/开出来，让用户提前进入画布。
     * 与交付阶段的 `result` 语义分流（判别式类型强制），不做「无结果也走结果交接」的伪装。
     */
    const handleOpenCarrierCanvas = useCallback(async () => {
        if (!onOpenInCanvas || !taskId) return;
        setOpeningCanvas(true);
        try {
            await onOpenInCanvas({ kind: "carrier", prompt, taskId, metadata: card ? buildLinearFlowMetadata(card, answers) : {} });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "打开画布失败");
        } finally {
            setOpeningCanvas(false);
        }
    }, [answers, card, onOpenInCanvas, prompt, taskId, toast]);

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
                            // ★ 统一任务面挂载点（设计卡验收 2）：/create 无画布上下文，
                            // 进度/阶段/状态由 UnifiedTaskFace 统一承载（订阅契约单一持有）。
                            // taskId 未就绪的首帧回退到本地提示，避免空窗。
                            taskId ? (
                                // ★ 硬验收②「画布在任一步可达」：生成中**不**隐藏画布入口 ——
                                // 走默认 showOpenInCanvas（true）+ 承载画布回调（carrier 语义）。
                                <UnifiedTaskFace
                                    taskIds={[taskId]}
                                    onOpenInCanvas={onOpenInCanvas ? () => void handleOpenCarrierCanvas() : undefined}
                                    contextLabel="直线流程"
                                />
                            ) : (
                                <div className="linear-flow-progress" role="status">
                                    <LoaderCircle className="is-spinning" size={16} strokeWidth={2} />
                                    正在生成，请稍候…
                                </div>
                            )
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
