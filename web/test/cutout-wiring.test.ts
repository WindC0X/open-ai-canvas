import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 抠图接线的源码守卫。
 *
 * 这些断言盯的是「接线是否还在」，不是实现细节：
 * 节点里的 cutout 分支、worker 的自托管配置、运行时两档回落，
 * 任何一处被后续合并冲掉都会在这里报红。
 */

const read = (path: string) => readFileSync(resolve(import.meta.dir, "../src", path), "utf8");
// 断言源码时忽略换行与缩进：长条件被拆行属于排版变化，不应让契约测试失效。
const flat = (text: string) => text.replace(/\s+/g, " ");

describe("抠图接线守卫", () => {
    test("节点把 cutout 从 model_missing 通用桩放行到浏览器抠图分支", () => {
        const node = flat(read("components/canvas/nodes/media-conversion-node.tsx"));
        // 守卫条件必须显式放行 cutout，否则会落回「该转换需要先安装并验证本地模型」。
        expect(node).toContain('state.operation !== "cutout"');
        expect(node).toContain("runBrowserCutout(sourceUrl");
        // 三段进度文案必须接上（首次 90MB 加载是硬要求，不能静默等待）。
        // 文案用「加载」不用「下载」：缓存命中时没有网络，说「下载」不实。
        expect(node).toContain("cutoutProgressNotice");
        expect(node).toContain("正在加载抠图模型");
    });

    test("worker 禁掉远端模型，权重只从本站取", () => {
        const worker = flat(read("workers/background-removal.worker.ts"));
        expect(worker).toContain("env.allowRemoteModels = false");
        expect(worker).toContain('env.localModelPath = MODEL_BASE_PATH');
        expect(worker).toContain('const MODEL_BASE_PATH = "/models/"');
        // 不得残留任何 HuggingFace 直连（硬约束：模型分发国内可达）。
        expect(worker).not.toContain("huggingface.co");
    });

    test("ORT WASM 运行时自托管：不落 jsDelivr 兜底", () => {
        const worker = flat(read("workers/background-removal.worker.ts"));
        // transformers.js 在 wasmPaths 为空时把 ORT 运行时指向 jsDelivr CDN，
        // 且其排除条件只认 ServiceWorkerGlobalScope —— DedicatedWorker 与主线程
        // 都会命中，实测 dev 与生产 preview 均拉取该 CDN。必须显式写 wasmPaths。
        expect(worker).toContain("wasmPaths");
        expect(worker).toContain("ort-wasm-simd-threaded.asyncify.wasm?url");
        expect(worker).toContain("ort-wasm-simd-threaded.asyncify.mjs?url");
        // 不得用 public/ 下的副本：Vite 拒绝 import public/ 内文件，dev 会直接报
        // no available backend found。
        expect(worker).not.toContain("/models/ort/");
        // 只断言赋值面：文件的解释性注释里合法地写着 jsDelivr 的完整 URL
        // （说明为何必须自托管），整文件 not.toContain 会误伤自己。
        const assign = worker.slice(worker.indexOf("const ortWasm"), worker.indexOf("const ortWasm") + 400);
        expect(assign).not.toContain("cdn.jsdelivr.net");
        expect(assign).toContain("ortMjsUrl");
        expect(assign).toContain("ortWasmUrl");
    });

    test("worker 用同一份 fp16 权重服务两档设备", () => {
        const worker = flat(read("workers/background-removal.worker.ts"));
        expect(worker).toContain('dtype: "fp16"');
        expect(worker).toContain('device: webgpu ? "webgpu" : "wasm"');
        // 无 q8 变体（模型卡明示未提供 INT8），不得出现 q8/fp32 档。
        expect(worker).not.toContain('"q8"');
        expect(worker).not.toContain('dtype: "fp32"');
    });

    test("运行时保留取消语义与 worker 崩溃重建", () => {
        const runtime = flat(read("services/cutout-runtime.ts"));
        expect(runtime).toContain("AbortSignal");
        expect(runtime).toContain("抠图已取消");
        expect(runtime).toContain("worker.terminate()");
        expect(runtime).toContain("cutoutWorker = null");
    });

    test("操作描述如实告知首次下载体积", () => {
        const contracts = read("lib/media-conversion/contracts.ts");
        expect(contracts).toContain("本地浏览器抠图");
        expect(contracts).toContain("90MB");
    });

    test("白底导出只在抠图结果上出现，且复用电商预设下限", () => {
        const node = flat(read("components/canvas/nodes/media-conversion-node.tsx"));
        expect(node).toContain('state.operation === "cutout"');
        expect(node).toContain("downloadWhiteBackground");
        expect(node).toContain("composeWhiteBackground(transparent, plan)");
        // 渠道硬要求：白底主图不允许透明，合成时必须铺白。
        const background = flat(read("lib/media-conversion/cutout-white-background.ts"));
        expect(background).toContain('context.fillStyle = "#ffffff"');
        expect(background).toContain('CUTOUT_WHITE_BACKGROUND_PRESET_ID = "amazon-main"');
    });
});
