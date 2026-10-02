import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildImageToolbarTools } from "../src/components/canvas/canvas-image-toolbar-tools";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

const read = (path: string) => readFileSync(resolve(import.meta.dir, "../src", path), "utf8");
const flat = (text: string) => text.replace(/\s+/g, " ");
/**
 * 去掉注释行再做否定断言。
 *
 * 生产代码的注释会正当地引用被禁的名字（例如解释「为什么不用 jsDelivr」时写出
 * 那个 URL），直接对全文 not.toContain 会误报——历次守卫踩过三次的同一个坑。
 */
const stripComments = (text: string) =>
    text
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");

/**
 * 入口整合守卫（控制线 2026-10-01 追加裁定）。
 *
 * 用户真机抽验发现两条「去背景」链并存：工具栏默认走生成式（扣积分），
 * 本地 WASM 路线没有曝光入口。这些断言盯住整合后的分流形态：
 * 默认走本地，已抠过的结果节点才提供生成式精修。
 */

const imageNode = (metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData => ({
    id: "image-1",
    type: CanvasNodeType.Image,
    title: "测试图",
    position: { x: 0, y: 0 },
    width: 300,
    height: 200,
    metadata: { content: "data:image/png;base64,AAAA", ...metadata },
});

/** 记录 run 实际调用了哪个 handler。 */
function toolFor(node: CanvasNodeData) {
    const calls: string[] = [];
    const handlers = {
        onRemoveBackground: () => calls.push("onRemoveBackground"),
        onRemoveBackgroundLocal: () => calls.push("onRemoveBackgroundLocal"),
        onRemoveBackgroundGenerative: () => calls.push("onRemoveBackgroundGenerative"),
    } as unknown as Parameters<typeof buildImageToolbarTools>[1];
    const tool = buildImageToolbarTools(node, handlers).find((item) => item.id === "removeBackground")!;
    return { tool, calls };
}

describe("去除背景入口整合", () => {
    test("普通图片默认走本地抠图，不弹生成式对话框", () => {
        const { tool, calls } = toolFor(imageNode());
        expect(tool.label).toBe("去除背景");
        expect(tool.description).toBe("本地识别，免费离线，逐像素保真");
        tool.onClick();
        expect(calls).toEqual(["onRemoveBackgroundLocal"]);
    });

    test("本地抠图结果节点提供生成式精修入口", () => {
        const { tool, calls } = toolFor(imageNode({ backgroundRemoval: { mode: "local" } }));
        expect(tool.label).toBe("用 AI 模型重新去除");
        expect(tool.description).toBe("AI 模型重画，适合复杂边缘，消耗积分");
        tool.onClick();
        expect(calls).toEqual(["onRemoveBackgroundGenerative"]);
    });

    test("生成式档位明确标注消耗积分（诚实文案）", () => {
        const { tool } = toolFor(imageNode({ backgroundRemoval: { mode: "local" } }));
        expect(tool.description).toContain("消耗积分");
        // 不承诺发丝级：透明/高反光仍是已知弱项。
        expect(tool.description).not.toContain("发丝");
        expect(toolFor(imageNode()).tool.description).not.toContain("发丝");
    });

    test("两档共用同一个工具位（不新增工具项、默认入口不消失）", () => {
        const plain = buildImageToolbarTools(imageNode(), {} as Parameters<typeof buildImageToolbarTools>[1]);
        const result = buildImageToolbarTools(imageNode({ backgroundRemoval: { mode: "local" } }), {} as Parameters<typeof buildImageToolbarTools>[1]);
        const count = (tools: ReturnType<typeof buildImageToolbarTools>) => tools.filter((item) => item.id === "removeBackground").length;
        expect(count(plain)).toBe(1);
        expect(count(result)).toBe(1);
        expect(plain.map((item) => item.id)).toEqual(result.map((item) => item.id));
    });

    test("本地档落到画布子节点，并标记来源档位", () => {
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        // 走本地 worker，不是生成任务；带 onProgress 选项（进度反馈缺陷裁定）。
        expect(tools).toContain("runBrowserCutout(source.url, {");
        expect(tools).toContain("onProgress: ({ phase, loaded, total, attempt, attempts }) => markPhase(");
        expect(tools).toContain('backgroundRemoval: { mode: "local" }');
        // 结果作为子节点连接并选中（与裁剪/标注同范式，不弹对话框）。
        expect(tools).toContain("fromNodeId: node.id, toNodeId: childId");
        // 重入守卫：首次要下 90MB，重复点按会并发起多个请求。
        expect(tools).toContain("localCutoutInFlightRef");
    });

    test("生成式档位仍走既有 image-edit 对话框（上游能力保留）", () => {
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        expect(tools).toContain("openBackgroundRemovalGenerative");
        expect(tools).toContain('setImageEditPreset("remove-background")');
        expect(tools).toContain("setImageEditNodeId(node.id)");
    });

    test("访客态保持未授权提示，不因整合而放行", () => {
        const shared = flat(read("pages/canvas/shared.tsx"));
        expect(shared).toContain("onRemoveBackground={unauthorized}");
        expect(shared).toContain("onRemoveBackgroundLocal={unauthorized}");
        expect(shared).toContain("onRemoveBackgroundGenerative={unauthorized}");
    });

    test("工具栏 handlers 三档都透传（缺失会让工具点击静默失效）", () => {
        const toolbar = flat(read("components/canvas/canvas-node-toolbar.tsx"));
        expect(toolbar).toContain("onRemoveBackgroundLocal");
        expect(toolbar).toContain("onRemoveBackgroundGenerative");
        const project = flat(read("pages/canvas/project.tsx"));
        expect(project).toContain("onRemoveBackgroundLocal={removeBackgroundLocally}");
        expect(project).toContain("onRemoveBackgroundGenerative={openBackgroundRemovalGenerative}");
    });
});

/**
 * 进度反馈守卫（控制线 2026-10-01 缺陷裁定）。
 *
 * 用户真机抽验：点「去除背景」后全程零视觉反馈（19s-570s 的静默操作）。
 * 根因是 onProgress 管道存在但 removeBackgroundLocally 没接——接线缺失，不是能力缺失。
 * 这些断言盯住三段进度文本与清理路径，防止再次被合并冲掉。
 */
describe("本地抠图进度反馈", () => {
    test("启动即给反馈：toast 说明首次要下约 90MB", () => {
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        expect(tools).toContain("开始本地抠图");
        expect(tools).toContain("首次需下载约 90MB 模型（仅此一次）");
        expect(tools).toContain('message.info("开始本地抠图');
    });

    test("三段进度文本必须可读（不能只有微弱边框效果）", () => {
        const node = flat(read("components/canvas/canvas-node.tsx"));
        expect(node).toContain("正在加载模型…（首次约90MB）");
        // S1 后秒数经 elapsedSuffix 拼接（startedAt 缺失时整段省略）
        expect(node).toContain("`正在识别主体…${elapsedSuffix}`");
        expect(node).toContain("`正在生成透明图…${elapsedSuffix}`");
        expect(node).toContain("const elapsedSuffix = elapsed === null");
        // 覆盖层要能被读屏识别：role=status + aria-live。
        expect(node).toContain('role="status"');
        expect(node).toContain('aria-live="polite"');
        expect(node).toContain("BackgroundRemovalPhaseOverlay");
    });

    test("worker 进度接到源节点（不是接了就丢）", () => {
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        // onProgress 必须真的传进 runBrowserCutout，且解构出字节数与 L1 窗口计数。
        expect(tools).toContain("onProgress: ({ phase, loaded, total, attempt, attempts }) => markPhase(");
        // 阶段要落到节点 metadata，UI 才拿得到。
        expect(tools).toContain("backgroundRemovalPhase: phase");
        expect(tools).toContain("backgroundRemovalProgress: progress");
        expect(tools).toContain("backgroundRemovalLocate: locate");
        // 覆盖层由该字段驱动。
        const node = flat(read("components/canvas/canvas-node.tsx"));
        expect(node).toContain("data.metadata?.backgroundRemovalPhase");
        expect(node).toContain("progress={data.metadata.backgroundRemovalProgress}");
    });

    test("下载阶段显示字节数与百分比（不是只转圈）", () => {
        const node = flat(read("components/canvas/canvas-node.tsx"));
        // 覆盖层接受 progress 并在有 total 时渲染「x.xMB / y.yMB（N%）」。
        expect(node).toContain("progress?: { loaded: number; total: number }");
        expect(node).toContain("MB / ");
        expect(node).toContain("（${percent}%）");
        // 进度条随百分比走。
        expect(node).toContain("transition-[width]");

        // worker 必须把 transformers.js 的字节进度转发出来（原先只发 phase，字节被丢掉）。
        const worker = flat(read("workers/background-removal.worker.ts"));
        expect(worker).toContain("progress_callback");
        expect(worker).toContain("loaded");
        expect(worker).toContain("total");
        expect(worker).toContain('phase: "download", loaded, total');

        // 运行时把字节透传给调用方。
        const runtime = flat(read("services/cutout-runtime.ts"));
        expect(runtime).toContain("loaded?: number");
        expect(runtime).toContain("total?: number");

        // 媒体转换节点的 notice 也带字节（另一条呈现路径）。
        const mc = flat(read("components/canvas/nodes/media-conversion-node.tsx"));
        expect(mc).toContain("MB / ");
        expect(mc).toContain("formatMegabytes");
    });

    test("推理阶段（segment/encode）不能只有静态文本", () => {
        const node = flat(read("components/canvas/canvas-node.tsx"));
        // ORT 无单次 run 的进度 API，拿不到百分比；用「已用时」+ 不确定扫描条表达在动。
        expect(node).toContain("已用 ${elapsed}s");
        expect(node).toContain("window.setInterval");
        // 扫描条复用既有 keyframe（F-01 硬约束：globals.css 零改动）。
        expect(node).toContain("canvas-task-progress-shimmer");
        // 起始时间戳由调用方写入并清理。
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        expect(tools).toContain("backgroundRemovalStartedAt: startedAt");
        expect(tools).toContain("backgroundRemovalStartedAt: undefined");
    });

    test("缓存命中时文案不谎称「下载」", () => {
        const node = flat(read("components/canvas/canvas-node.tsx"));
        // 缓存命中时无网络，但仍有约 13s 的 Cache→WASM 读取；文案必须中实。
        expect(node).toContain("正在加载模型");
        const mc = flat(read("components/canvas/nodes/media-conversion-node.tsx"));
        expect(mc).toContain("正在加载");
        // 不得再出现「正在下载模型」这种缓存命中时不成立的表述。
        expect(node).not.toContain("正在下载模型");
    });

    test("阶段标记与运行态在同一 finally 里清理（漏清会永久卡「处理中」）", () => {
        const source = read("pages/canvas/use-canvas-media-tools.ts");
        const start = source.indexOf("const removeBackgroundLocally");
        const body = source.slice(start, source.indexOf("const openBackgroundRemovalGenerative", start));
        expect(body).toContain("} finally {");
        // S1 后 finally 走单次 setNodes（phase + startedAt 同批清理），不再调 markPhase(undefined)
        const fin = body.slice(body.indexOf("} finally {"));
        expect(fin).toContain("backgroundRemovalPhase: undefined");
        expect(fin).toContain("backgroundRemovalStartedAt: undefined");
        expect(fin).toContain("backgroundRemovalSessionId: undefined");
        // P2 后是计数器递减（不是布尔置 false）
        expect(body).toContain("localCutoutInFlightRef.current = Math.max(0, localCutoutInFlightRef.current - 1)");
        expect(body).toContain("setRunningNodeId(null)");
    });

    test("并发守卫：上限 2（用户真机终验 P2）", () => {
        const source = read("pages/canvas/use-canvas-media-tools.ts");
        const start = source.indexOf("const removeBackgroundLocally");
        const body = source.slice(start, source.indexOf("const openBackgroundRemovalGenerative", start));
        // 上限常量与计数器判据（不再是布尔单例）
        expect(source).toContain("const LOCAL_CUTOUT_MAX_CONCURRENT = 2");
        expect(body).toContain("if (localCutoutInFlightRef.current >= LOCAL_CUTOUT_MAX_CONCURRENT)");
        expect(body).toContain("localCutoutInFlightRef.current += 1");
        // 计数器，不是布尔
        expect(source).toContain("const localCutoutInFlightRef = useRef(0)");
        // 排队态：第二个请求显示「排队中」而不是伪装成进行中
        expect(body).toContain("const queued = localCutoutInFlightRef.current > 0");
        expect(body).toContain('markPhase(queued ? "queued" : "download"');
        expect(body).toContain("已加入本地抠图队列，等待前一张完成");
    });

    test("超限守卫 toast 保留（拒绝文案带上限值）", () => {
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        expect(tools).toContain("个本地抠图在进行，请等其中一张完成后再发起");
    });

    test("失败路径给错误 toast", () => {
        const tools = flat(read("pages/canvas/use-canvas-media-tools.ts"));
        expect(tools).toContain("本地抠图失败");
        expect(tools).toContain("message.error");
    });

    test("P1 抠图结果节点不显示 hover composer 浮层（R-2 的 hover 面）", () => {
        const node = read("components/canvas/canvas-node.tsx");
        // 判据两条：类型排除 + 本地抠图结果指纹（对齐扩图结果 :318-326 的指纹法）
        expect(node).toContain("const isMediaConversionResult =");
        expect(node).toContain('data.type === CanvasNodeType.MediaConversion ||');
        expect(node).toContain('data.metadata?.backgroundRemoval?.mode === "local"');
        // 必须真的进 hoverComposerNodeType 的否定条件
        expect(node).toMatch(/const hoverComposerNodeType = .*&& !isMediaConversionResult;/);
        expect(node).toContain("const hoverComposerVisible = hoverComposerNodeType &&");
    });

    test("S1 写侧：phase 与 startedAt 单次 setNodes（消除落库不一致窗口）", () => {
        const source = read("pages/canvas/use-canvas-media-tools.ts");
        const start = source.indexOf("const removeBackgroundLocally");
        const body = source.slice(start, source.indexOf("const openBackgroundRemovalGenerative", start));
        // markPhase 签名收 startedAt（单次写入）
        expect(body).toContain("startedAt?: number,");
        expect(body).toContain("...(startedAt !== undefined ? { backgroundRemovalStartedAt: startedAt } : {})");
        // 启动写入走单次 markPhase，不再有独立的 startedAt setNodes
        expect(body).toContain('markPhase(queued ? "queued" : "download", { loaded: 0, total: 0 }, undefined, startedAt)');
        expect(body).not.toContain("backgroundRemovalStartedAt: startedAt } }");
        // finally 同批清理 phase + startedAt
        const fin = body.slice(body.indexOf("} finally {"));
        expect(fin).toContain("backgroundRemovalPhase: undefined");
        expect(fin).toContain("backgroundRemovalStartedAt: undefined");
    });

    test("S1 显示侧：startedAt 缺失不显示秒数（不回退成 0 = Unix 秒）", () => {
        const node = read("components/canvas/canvas-node.tsx");
        // 不再有 ?? 0 回退
        expect(node).not.toContain("backgroundRemovalStartedAt ?? 0");
        // startedAt 可选 + elapsed 为 null 时不显示
        expect(node).toContain("startedAt?: number;");
        expect(node).toContain("const [elapsed, setElapsed] = useState<number | null>(null);");
        expect(node).toContain("if (startedAt === undefined) {");
        expect(node).toContain("const elapsedSuffix = elapsed === null ? \"\" : `（已用 ${elapsed}s）`;");
    });

    test("S1 残留守卫：非本次会话的 phase 不渲染覆盖层（治愈已落库脏数据）", () => {
        const node = read("components/canvas/canvas-node.tsx");
        // 显示条件走会话判定，不再只看 phase 存在
        expect(node).toContain("const cutoutPhase = isActiveCutoutSession(");
        expect(node).toContain("{cutoutPhase && data.metadata ? (");
        expect(node).not.toMatch(/\{data\.metadata\?\.backgroundRemovalPhase \? \(/);
        // 明确不用 status 守卫（会隐藏正常运行态：源节点 status 全程 success）
        expect(node).toContain("不能改用 status 守卫");
        expect(node).toContain("data.metadata?.backgroundRemovalSessionId");
    });

    test("P2 排队态进度文案（覆盖层 + 节点 notice 两端）", () => {
        const node = read("components/canvas/canvas-node.tsx");
        expect(node).toContain('phase === "queued"');
        expect(node).toContain("`排队中…${waitedSuffix}`");
        expect(node).toContain("const waitedSuffix = elapsed === null");
        expect(read("components/canvas/nodes/media-conversion-node.tsx")).toContain('progress.phase === "queued"');
        // 类型面：queued 是调用侧阶段，不能混进 worker 协议
        const runtime = read("services/cutout-runtime.ts");
        expect(runtime).toContain('export type CutoutDisplayPhase = CutoutProgressPhase | "queued"');
        expect(read("workers/background-removal.worker.ts")).toContain('export type CutoutProgressPhase = "download" | "segment" | "encode" | "locate"');
    });
});

describe("抠图改用官方 pipeline（用户真机抽验 2026-10-01 三项回修）", () => {
    test("worker 用官方 background-removal 管道，不自己解析 dims / 合成蒙版", () => {
        const worker = read("workers/background-removal.worker.ts");
        // 官方管道：对齐是构造性保证（蒙版 resize 回原图尺寸再 putAlpha）。
        expect(worker).toContain('pipeline("background-removal"');
        expect(worker).toContain("progress_callback");
        // 手搓段必须整体消失：自己解析 dims、自己布局 ImageData、自己做 destination-in
        // 合成，每一处都是一次坐标数学的机会（缺陷1「结果错位/全黑」的宿主）。
        // 断代码面而不是整文件：注释里会合法地引用这些名字（同 Xbot/jsDelivr 守卫教训）。
        const code = worker
            .split("\n")
            .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
            .join("\n");
        expect(code).not.toContain("logitsToMask");
        expect(code).not.toContain("composeTransparentPng");
        expect(code).not.toContain("destination-in");
        expect(code).not.toContain("output.logits");
    });

    test("官方管道仍保留自托管 env 三件套与字节进度", () => {
        const worker = read("workers/background-removal.worker.ts");
        expect(worker).toContain("env.allowRemoteModels = false");
        expect(worker).toContain("env.localModelPath");
        expect(worker).toContain("wasmPaths");
        expect(worker).toContain("progress_total");
    });

    test("覆盖层不用 backdrop-filter（缩放祖先内会出四象限镜像伪影）", () => {
        const node = read("components/canvas/canvas-node.tsx");
        const start = node.indexOf("function BackgroundRemovalPhaseOverlay");
        const body = node.slice(start, node.indexOf("function NodeStatusBadge", start));
        // 节点渲染在 canvas-world-layer 的 transform: scale() 之内，Chromium 对缩放
        // 祖先内的 backdrop-filter 做分块重采样，源节点画面会呈四象限镜像万花筒态。
        // 断 className 面而不是整段：注释里会说明为什么不能用 backdrop-filter。
        const classNames = body.match(/className="[^"]*"/g) ?? [];
        expect(classNames.join(" ")).not.toContain("backdrop-blur");
        expect(classNames.join(" ")).not.toContain("backdrop-filter");
        expect(classNames.join(" ")).toContain("bg-black/45");
    });

    test("toast 区分缓存命中：已缓存时不说「首次需下载」", () => {
        const tools = read("pages/canvas/use-canvas-media-tools.ts");
        expect(tools).toContain("isCutoutModelCached");
        // 判定必须走 Cache Storage 的公开面（transformers.js 用同一个 bucket 缓存权重）
        expect(tools).toContain("transformers-cache");
        expect(tools).toContain("model_fp16.onnx");
        // 两个分支都要在：命中时只报「开始本地抠图」，未命中才提首次下载
        const start = tools.indexOf("const removeBackgroundLocally");
        const body = tools.slice(start, tools.indexOf("const openBackgroundRemovalGenerative", start));
        expect(body).toContain('message.info("开始本地抠图")');
        expect(body).toContain("首次需下载约 90MB 模型（仅此一次）");
    });
});

describe("rider 批次回修（用户终验第四轮 2026-10-01）", () => {
    test("R-1 HUD 让位接线：任务面板高度必须回传到宿主", () => {
        const project = read("pages/canvas/project.tsx");
        // setActiveTaskPanelHeight 定义后必须被消费：不接时 HUD 的 topInset 让位公式
        // 永远吃到 0，任务面板出现/展开时与右侧对象 HUD 重叠。
        expect(project).toContain("onHeightChange={setActiveTaskPanelHeight}");
        // 让位公式仍要读这个 state（接线与消费两端都在）
        expect(project).toContain("activeTaskPanelHeight > 0");
    });

    test("R-2 MediaConversion 不弹对话输入面板", () => {
        const project = read("pages/canvas/project.tsx");
        const start = project.indexOf("const renderCanvasNodePanel");
        const body = project.slice(start, start + 900);
        expect(body).toContain("CanvasNodeType.MediaConversion");
        // 与 Script/Drawing 同一条排除语句（不是另起分支）
        expect(body).toMatch(/CanvasNodeType\.Script\s*\|\|\s*panelNode\.type\s*===\s*CanvasNodeType\.Drawing\s*\|\|\s*panelNode\.type\s*===\s*CanvasNodeType\.MediaConversion/);
    });

    test("R-4 L1 分层管线：弱 logits 定位 + 判别器 + 双路径", () => {
        const worker = read("workers/background-removal.worker.ts");
        // L0 门槛与 L1 接受门槛（绝对覆盖率口径）
        expect(worker).toContain("MIN_SUBJECT_COVERAGE = 0.05");
        expect(worker).toContain("L1_MIN_COVERAGE = 0.005");
        expect(worker).toContain("L1_MIN_COVERAGE_RATIO = 0.8");
        // 小主体路径：升序扫描
        expect(worker).toContain("SCAN_WINDOWS = [0.15, 0.2, 0.25, 0.35]");
        // 大构图路径：4×4@50% 网格（无空隙）
        expect(worker).toContain("GRID_SIZE = 4");
        expect(worker).toContain("GRID_WINDOW = 0.5");
        // 路由判别器（L0 同值不可区分时的分流依据）
        expect(worker).toContain("ROUTE_RATIO_HIGH = 1.3");
        expect(worker).toContain("ROUTE_RATIO_LOW = 0.7");
        expect(worker).toContain("function shouldUseGrid");
        // 复用已加载的 model/processor 拿原始 logits（不重新加载权重）
        expect(worker).toContain("function readWeakLogits");
        expect(worker).toContain("function weakCentroid");
        expect(worker).toContain("LOCATE_PERCENTILE = 0.001");
        // 绝对覆盖率口径：窗口内主体像素 / 原图总像素（不是窗内占比）
        expect(worker).toContain("alphaCoverage(cutout) * ((side * side) / (sourceWidth * sourceHeight))");
        // L0 正常图不付 L1 成本
        expect(worker).toContain("if (directCoverage >= MIN_SUBJECT_COVERAGE)");
    });

    test("R-4 L3：无主体不回传空白图，走错误通道", () => {
        const worker = read("workers/background-removal.worker.ts");
        const body = stripComments(worker);
        // L3 必须走 error 而不是 done —— 空白透明图正是用户看到的黑图
        expect(worker).toContain('errorCode: "no_subject"');
        expect(worker).toContain("未识别到主体，建议框选主体区域重试，或用 AI 重新去除（云端）");
        // 不再有 strategy "none" 的 done 分支（那会交付空白图）
        expect(body).not.toContain('strategy: "none"');
        // 两个调用点都要把 no_subject 当作可操作提示而不是执行失败
        expect(read("pages/canvas/use-canvas-media-tools.ts")).toContain('error.code === "no_subject"');
        expect(read("components/canvas/nodes/media-conversion-node.tsx")).toContain('error.code === "no_subject"');
    });

    test("R-4 L1 进度阶段可见（覆盖层 + 节点 notice）", () => {
        const canvasNode = read("components/canvas/canvas-node.tsx");
        // 覆盖层文案含阶段名与窗口计数
        expect(canvasNode).toContain("正在识别主体 · 自动定位");
        expect(canvasNode).toContain("locate.attempt");
        // 节点侧 notice 同口径
        const node = read("components/canvas/nodes/media-conversion-node.tsx");
        expect(node).toContain("自动定位 (${progress.attempt}/${progress.attempts})");
        // 元数据字段全链路存在
        expect(read("types/canvas.ts")).toContain("backgroundRemovalLocate");
        expect(read("pages/canvas/use-canvas-media-tools.ts")).toContain("backgroundRemovalLocate");
    });

    test("R-4 coverage 与 strategy 从 worker 一路透传到调用方", () => {
        const worker = read("workers/background-removal.worker.ts");
        expect(worker).toContain("function alphaCoverage");
        expect(worker).toContain("coverage: directCoverage");
        expect(worker).toContain('strategy: "direct"');
        expect(worker).toContain('strategy: "region"');
        const runtime = read("services/cutout-runtime.ts");
        expect(runtime).toContain("coverage: number");
        expect(runtime).toContain("coverage: event.data.coverage");
        expect(runtime).toContain("strategy: CutoutStrategy");
        expect(runtime).toContain("strategy: event.data.strategy");
    });
});
