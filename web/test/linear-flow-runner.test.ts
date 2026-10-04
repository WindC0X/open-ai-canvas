import { expect, test, describe } from "bun:test";

/**
 * W5 卡流程端到端 —— 结构测试（设计卡 §3.1 梯度 0 + §6.1 三条硬验收）。
 *
 * ★ 为什么是源码断言而不是渲染测试：本仓测试纪律是「纯函数用 bun:test，
 * 画布/DOM 行为走真机浏览器验证」（F-08 同族）。卡流程的交互（点卡→上传→问→出图→下载）
 * 依赖 antd Modal + 上传 + 后端任务链，静态渲染测试会大量 mock 而失去证明力；
 * 故此处只做**链路结构断言**（关键调用在位、交付步在流程内、不依赖未实现组件），
 * 真实交互由真机验证补足（与 F-08 渠道实测门同纪律）。
 */

const runnerSource = await Bun.file(new URL("../src/components/create/linear-flow-runner.tsx", import.meta.url)).text();
const gridSource = await Bun.file(new URL("../src/components/create/linear-flow-card-grid.tsx", import.meta.url)).text();
const pageSource = await Bun.file(new URL("../src/pages/create/index.tsx", import.meta.url)).text();

describe("★ 硬验收③：交付步必须在卡流程内", () => {
    test("runner 内含下载交付（结果图 + download 链接）", () => {
        expect(runnerSource).toContain("linear-flow-download");
        expect(runnerSource).toContain("download={`${card.id}.png`}");
        expect(runnerSource).toContain("下载成品");
    });

    test("交付步是流程内的独立阶段（不是跳转外部页面）", () => {
        // deliver 是 runner 内的 stage，不是 navigate 到任务中心
        expect(runnerSource).toContain('"deliver"');
        expect(runnerSource).toContain("linear-flow-deliver");
        // 交付态直接渲染结果，不需要用户离开弹层
        expect(runnerSource).toContain("linear-flow-result-image");
    });

    test("文本卡也有交付步（复制文本，不是只出图卡才有交付）", () => {
        expect(runnerSource).toContain("复制文本");
        expect(runnerSource).toContain("linear-flow-result-text");
    });

    test("★ 交付面仍卡专属（进度面已回改为 UnifiedTaskFace）", () => {
        // 前提更新（2026-10-05 统一任务面批）：原断言「该组件尚未实现」已失效 ——
        // 姊妹卡已落地，且按回改点把**生成阶段进度面**挂到了 UnifiedTaskFace
        // （同时是设计卡验收 2 的「无画布上下文真实挂载点」）。
        //
        // ★ 但控制线裁定①的**真实契约仍有效**：**交付面**（deliver stage）保持卡专属 ——
        // 「下载成品 / 重新来一次 / 在画布中打开」是卡流程动作，不委托通用组件；
        // 且结果源是本地 dataUrl（通用面预览源是服务端 previewUrl），语义不同不合并。
        const codeOnly = runnerSource
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
        // 进度面已挂载（本批新增）
        expect(codeOnly).toContain("UnifiedTaskFace");
        expect(codeOnly).toContain("taskIds={[taskId]}");
        // 交付面仍卡专属：deliver 段的四个卡动作仍在 runner 内自建
        expect(codeOnly).toContain("linear-flow-deliver");
        expect(codeOnly).toContain("下载成品");
        expect(codeOnly).toContain("重新来一次");
    });
});

describe("★ 硬验收②：画布在任一步可达（给而不要求）", () => {
    test("交付面提供「在画布中打开」可选入口", () => {
        expect(runnerSource).toContain("在画布中打开");
        expect(runnerSource).toContain("onOpenInCanvas");
    });

    test("转入画布是可选 prop（未提供时不渲染该按钮）", () => {
        expect(runnerSource).toContain("{onOpenInCanvas && card.mode === \"image\" ?");
    });

    test("卡流程本身不写画布（只在用户主动点击时才建会话）", () => {
        // 画布导航只出现在 onOpenInCanvas 回调里
        const openCanvasIndex = pageSource.indexOf("onOpenInCanvas=");
        const navigateIndex = pageSource.indexOf("navigate(`/canvas/${created.id}");
        expect(openCanvasIndex).toBeGreaterThan(-1);
        expect(navigateIndex).toBeGreaterThan(openCanvasIndex);
    });
});

describe("★ 硬验收①：双条件（不见画布路径 + 画布可达）", () => {
    test("卡流程全程在弹层内（Modal 承载，无画布跳转）", () => {
        expect(runnerSource).toContain("<Modal");
        expect(runnerSource).toContain("linear-flow-modal");
    });

    test("空态挂载卡网格（可执行入口在位）", () => {
        expect(pageSource).toContain("<LinearFlowCardGrid");
        expect(pageSource).toContain("onPick={(card) => setLinearFlowCard(card)}");
    });

    test("runner 挂在页面级（不是画布页）", () => {
        expect(pageSource).toContain("<LinearFlowRunner");
        expect(pageSource).toContain("card={linearFlowCard}");
    });
});

describe("流程步骤（点卡 → 传图 → ≤3 问 → 出图 → 下载）", () => {
    test("步骤导航渲染（含门控三态）", () => {
        expect(runnerSource).toContain("linearFlowStepGate");
        expect(runnerSource).toContain("visibleLinearFlowSteps");
        expect(runnerSource).toContain("aria-current");
    });

    test("传图步可选（acceptsReference 控制）", () => {
        expect(runnerSource).toContain("card.acceptsReference");
        expect(runnerSource).toContain("上传商品图（可选）");
    });

    test("澄清步支持选择题与文本问两种形态", () => {
        expect(runnerSource).toContain('question.kind === "select"');
        expect(runnerSource).toContain("linear-flow-option");
        expect(runnerSource).toContain("aria-pressed");
    });

    test("出图步调用后端任务链（复用既有协议，不新造生成通道）", () => {
        expect(runnerSource).toContain("runBackendGenerationTask");
        expect(runnerSource).toContain("mode: card.mode");
        expect(runnerSource).toContain("referenceImages");
    });

    test("生成中/失败态有可见反馈（不静默）", () => {
        expect(runnerSource).toContain("linear-flow-progress");
        expect(runnerSource).toContain("linear-flow-error");
        expect(runnerSource).toContain("role=\"alert\"");
    });
});

describe("门控纪律：只锁直线流程内（设计卡 §3.2 方向钉死）", () => {
    test("runner 不写画布 store 的门控状态", () => {
        expect(runnerSource).not.toContain("use-canvas-store");
        expect(runnerSource).not.toContain("updateProject");
    });

    test("门控状态是 runner 局部 state（不污染全局）", () => {
        expect(runnerSource).toContain("useState<LinearFlowStepId>");
        expect(runnerSource).toContain("resolveLinearFlowGate");
    });
});

describe("网格组件（C1 卡面）", () => {
    test("网格渲染全部卡（数据驱动，不硬编码）", () => {
        expect(gridSource).toContain("LINEAR_FLOW_CARDS.map");
        expect(gridSource).toContain("onPick(card)");
    });

    test("卡命名按任务（不含能力词）", async () => {
        const cardsSource = await Bun.file(new URL("../src/lib/canvas/linear-flow-cards.ts", import.meta.url)).text();
        for (const forbidden of ["抠图", "超分"]) {
            expect(gridSource).not.toContain(forbidden);
            expect(cardsSource).not.toContain(`title: "${forbidden}`);
        }
    });

    test("网格有可访问语义（section + list）", () => {
        expect(gridSource).toContain('aria-label="一键出图"');
        expect(gridSource).toContain('role="list"');
    });
});
