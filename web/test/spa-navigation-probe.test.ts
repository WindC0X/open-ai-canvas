import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * SPA 导航探针测试（页面内注入脚本）。
 *
 * ★ 为什么需要测试一个「浏览器注入脚本」：它的核心承诺是**让阴性结论可信**
 *   （「无警告」必须区别于「监视器失灵」）。若自检机制本身失效，
 *   探针会给出**虚假的阴性证据** —— 比没有探针更危险（V8 纪律：失败路径必须可诊断）。
 *
 * ★ 本文件用最小 DOM 桩在 bun 内执行脚本（本仓无 happy-dom/jsdom）：
 *   桩只提供脚本用到的四个全局（window / history / document / MutationObserver），
 *   断言针对**脚本行为**（记录了什么、自检是否报红），不针对浏览器渲染。
 */

const probeSource = readFileSync(new URL("./helpers/spa-navigation-probe.js", import.meta.url), "utf8");

type ProbeApi = {
    navLog: Array<{ type: string; url: string; at: number }>;
    msgLog: string[];
    reset: () => void;
    dump: () => { navLog: Array<{ type: string; url: string }>; msgLog: string[] };
    selfCheck: () => Promise<{ ok: boolean; detail: string }>;
    keywords: string[];
};

type FakeNode = { className: string; textContent: string; parentNode: unknown };

type Harness = {
    probe: ProbeApi;
    historyStub: { pushState: (...args: unknown[]) => void; replaceState: (...args: unknown[]) => void };
    historyCalls: Array<{ method: string; url: unknown }>;
    body: { appendChild: (node: FakeNode) => FakeNode; removeChild: (node: FakeNode) => FakeNode; children: FakeNode[] };
    /** 读取当前 window 上的探针实例（二次注入后可能与首次不同）。 */
    current: () => ProbeApi;
    run: () => void;
};

/** 最小 DOM/History 桩：只实现脚本用到的接口。 */
function createHarness(source: string): Harness {
    const observers: Array<(records: Array<{ addedNodes: FakeNode[] }>) => void> = [];

    class FakeMutationObserver {
        private callback: (records: Array<{ addedNodes: FakeNode[] }>) => void;
        constructor(callback: (records: Array<{ addedNodes: FakeNode[] }>) => void) {
            this.callback = callback;
        }
        observe() {
            observers.push(this.callback);
        }
    }

    const body = {
        children: [] as FakeNode[],
        appendChild(node: FakeNode) {
            node.parentNode = body;
            body.children.push(node);
            for (const callback of observers) callback([{ addedNodes: [node] }]);
            return node;
        },
        removeChild(node: FakeNode) {
            body.children = body.children.filter((item) => item !== node);
            node.parentNode = null;
            return node;
        },
    };

    const documentStub = {
        body,
        createElement(): FakeNode {
            return { className: "", textContent: "", parentNode: null };
        },
    };

    const historyCalls: Array<{ method: string; url: unknown }> = [];
    const historyStub = {
        pushState(_state: unknown, _title: unknown, url?: unknown) {
            historyCalls.push({ method: "pushState", url: url });
        },
        replaceState(_state: unknown, _title: unknown, url?: unknown) {
            historyCalls.push({ method: "replaceState", url: url });
        },
    };

    const windowStub: Record<string, unknown> = {};
    const run = () => {
        const factory = new Function("window", "history", "document", "MutationObserver", source);
        factory(windowStub, historyStub, documentStub, FakeMutationObserver);
    };
    run();

    const probe = windowStub.__spaNavProbe as ProbeApi;
    const current = () => windowStub.__spaNavProbe as ProbeApi;
    return { probe, historyStub: historyStub as Harness["historyStub"], historyCalls, body, current, run };
}

function fakeMessageNode(text: string): FakeNode {
    return { className: "", textContent: text, parentNode: null };
}

describe("SPA 导航探针：导航记录（pushState/replaceState 包装）", () => {
    test("push 与 replace 都被记录，含完整 query（SPA 消费后仍可回溯）", () => {
        const { probe, historyStub } = createHarness(probeSource);
        historyStub.pushState({}, "", "/canvas/abc?conversation=creation%3Alinear-flow-t1");
        historyStub.replaceState({}, "", "/canvas/abc");
        expect(probe.navLog).toHaveLength(2);
        expect(probe.navLog[0]).toMatchObject({ type: "push", url: "/canvas/abc?conversation=creation%3Alinear-flow-t1" });
        expect(probe.navLog[1]).toMatchObject({ type: "replace", url: "/canvas/abc" });
    });

    test("透传：包装层调用原始 history 方法（不吞掉真实导航）", () => {
        const { historyStub, historyCalls } = createHarness(probeSource);
        historyStub.pushState({}, "", "/canvas/abc");
        historyStub.replaceState({}, "", "/canvas/abc?x=1");
        expect(historyCalls, "包装层必须透传 —— 否则真实导航被吞").toEqual([
            { method: "pushState", url: "/canvas/abc" },
            { method: "replaceState", url: "/canvas/abc?x=1" },
        ]);
    });
});

describe("SPA 导航探针：消息捕获（MutationObserver）", () => {
    test("关键词命中的插入节点被捕获", () => {
        const { probe, body } = createHarness(probeSource);
        body.appendChild(fakeMessageNode("未找到要接续的会话，请从首页重新进入。"));
        expect(probe.msgLog).toHaveLength(1);
        expect(probe.msgLog[0]).toContain("未找到要接续的会话");
    });

    test("非关键词节点不被捕获（避免噪声淹没证据）", () => {
        const { probe, body } = createHarness(probeSource);
        body.appendChild(fakeMessageNode("生成成功"));
        expect(probe.msgLog).toHaveLength(0);
    });

    test("dump/reset 语义：dump 返回副本，reset 清空", () => {
        const { probe, historyStub, body } = createHarness(probeSource);
        historyStub.pushState({}, "", "/a");
        body.appendChild(fakeMessageNode("未找到"));
        const snapshot = probe.dump();
        expect(snapshot.navLog).toHaveLength(1);
        expect(snapshot.msgLog).toHaveLength(1);
        snapshot.navLog.push({ type: "fake", url: "/injected" });
        expect(probe.navLog, "dump 必须返回副本 —— 外部改动不得污染探针内部记录").toHaveLength(1);
        probe.reset();
        expect(probe.dump()).toEqual({ navLog: [], msgLog: [] });
    });
});

describe("SPA 导航探针：★ 自检机制（阴性结论的前置条件）", () => {
    test("正常配置：自检 ok === true（监视器确实抓得住）", async () => {
        const { probe } = createHarness(probeSource);
        const result = await probe.selfCheck();
        expect(result.ok).toBe(true);
        expect(result.detail).toContain("可信");
    });

    test("★ 证伪：关键词配错 ⇒ 自检 ok === false（「无警告」结论不可采信）", () => {
        const anchor = 'var MESSAGE_KEYWORDS = ["未找到", "会话"];';
        // V9 ①：替换前先断言锚点存在，避免锚点消失导致证伪测试静默失效
        expect(probeSource, "关键词锚点消失 —— 证伪测试失效，需同步更新").toContain(anchor);
        const brokenSource = probeSource.replace(anchor, 'var MESSAGE_KEYWORDS = ["__probe_broken_keyword__"];');
        expect(brokenSource).not.toBe(probeSource);
        const { probe } = createHarness(brokenSource);
        return probe.selfCheck().then((result) => {
            expect(result.ok).toBe(false);
            expect(result.detail).toContain("无效");
        });
    });

    test("自检注入的假消息被清理（不污染后续 dump）", async () => {
        const { probe, body } = createHarness(probeSource);
        const result = await probe.selfCheck();
        expect(result.ok).toBe(true);
        expect(body.children, "自检节点必须移除 —— 否则污染页面").toHaveLength(0);
    });
});

describe("SPA 导航探针：幂等（重复注入不叠加监听）", () => {
    test("二次注入不替换已安装实例（守卫命中）", () => {
        const { probe, run, current } = createHarness(probeSource);
        const first = current();
        run();
        const second = current();
        // ★ 可证伪点：移除 `if (previous && previous.__installed) return;` 后，
        //   二次注入会重新包装 history 并替换 window.__spaNavProbe（second !== first）。
        //   （仅断言 navLog 长度会假绿：两个闭包各自记录一次，第一个实例的日志仍是 1 条。）
        expect(second, "二次注入必须返回同一实例 —— 否则监听器与包装层会无界叠加").toBe(first);
        expect(probe).toBe(first);
    });

    test("二次注入后单次导航在该实例日志中只记一条", () => {
        const { probe, historyStub, run } = createHarness(probeSource);
        run();
        run();
        historyStub.pushState({}, "", "/once");
        expect(probe.navLog).toHaveLength(1);
    });
});
