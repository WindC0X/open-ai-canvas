/**
 * SPA 导航探针 —— 页面内注入脚本（非 Node 模块）
 *
 * 解决的问题：两类浏览器行为**事后不可观察**，导致阴性结论不可信。
 *   ① SPA 内存路由：导航 URL 可能被消费后立即改写（如 project.tsx 消费 conversation
 *      参数后 delete + replaceState），事后读 location.href 已看不到原始导航目标。
 *   ② 短暂消息：antd message 数秒后自动消失 ——「事后没看到警告」与「监视器失灵」
 *      不可区分（V8 纪律：失败路径必须与成功路径同等可诊断）。
 *
 * 本探针把这两类证据变成可证伪的：
 *   ① 包装 history.pushState / replaceState → 记录**每次真实导航调用**（含 query）
 *   ② MutationObserver on body → 按关键词捕获短暂消息节点
 *   ③ selfCheck() 自检：注入一条假消息，验证 ② **确实抓得住** ——
 *      自检 ok === false 时，本次「无警告」类阴性结论**无效**。
 *
 * 用法（Orca 浏览器 / tmwd-browser）：
 *   1. 注入（脚本全文，任一方式）：
 *        orca-ide eval --expression "$(cat web/test/helpers/spa-navigation-probe.js); 'injected'"
 *      或页面内：eval(<脚本全文>)
 *   2. ★ 先自检（阴性结论的前置条件）：
 *        orca-ide eval --expression "window.__spaNavProbe.selfCheck().then(r => JSON.stringify(r))"
 *      → { ok: true } 才可采信后续的「无警告 / 无导航」结论
 *   3. 触发要验证的交互（点击等）
 *   4. 取证据：
 *        orca-ide eval --expression "JSON.stringify(window.__spaNavProbe.dump())"
 *      → { navLog: [{ type, url, at }], msgLog: [text] }
 *
 * 典型用法（R5 P2-1 验证）：同一按钮，唯一变量 = 容器内是否有该任务的会话；
 * 正例 navLog 含 ?conversation=...（随后 replaceState 删除），负例不含 —— 直接对照。
 *
 * 纪律：任何「无警告」的阴性结论，必须先有 selfCheck().ok === true。
 */
(function () {
    "use strict";
    var PROBE_KEY = "__spaNavProbe";
    // 消息捕获关键词（自检也依赖它：改错 ⇒ 自检报红，见测试）
    var MESSAGE_KEYWORDS = ["未找到", "会话"];
    var SELF_CHECK_TEXT = "未找到要接续的会话（探针自检，可忽略）";

    var previous = window[PROBE_KEY];
    if (previous && previous.__installed) return; // 幂等：重复注入不叠加监听

    var navLog = [];
    var msgLog = [];

    function recordNav(type, url) {
        navLog.push({ type: type, url: String(url == null ? "" : url), at: Date.now() });
    }

    var originalPush = history.pushState;
    var originalReplace = history.replaceState;
    history.pushState = function (state, title, url) {
        recordNav("push", url);
        return originalPush.apply(this, arguments);
    };
    history.replaceState = function (state, title, url) {
        recordNav("replace", url);
        return originalReplace.apply(this, arguments);
    };

    function matchesKeywords(text) {
        for (var i = 0; i < MESSAGE_KEYWORDS.length; i += 1) {
            if (text.indexOf(MESSAGE_KEYWORDS[i]) !== -1) return true;
        }
        return false;
    }

    function captureNode(node) {
        var text = (node && node.textContent) || "";
        if (matchesKeywords(text)) msgLog.push(text.slice(0, 200));
    }

    var observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i += 1) {
            var added = records[i].addedNodes || [];
            for (var j = 0; j < added.length; j += 1) captureNode(added[j]);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function reset() {
        navLog.length = 0;
        msgLog.length = 0;
    }

    function dump() {
        return { navLog: navLog.slice(), msgLog: msgLog.slice() };
    }

    /**
     * 自检：注入一条含关键词的假消息，验证观察器确实捕获。
     * 返回 Promise<{ ok, detail }> —— ok 为 false 时本次阴性结论不可采信。
     */
    function selfCheck() {
        var before = msgLog.length;
        var node = document.createElement("div");
        node.className = "spa-nav-probe-self-check";
        node.textContent = SELF_CHECK_TEXT;
        document.body.appendChild(node);
        return new Promise(function (resolve) {
            setTimeout(function () {
                var captured = msgLog.length > before;
                if (node.parentNode) node.parentNode.removeChild(node);
                resolve({
                    ok: captured,
                    detail: captured
                        ? "监视器已捕获自检消息（阴性结论可信）"
                        : "监视器未捕获自检消息 —— 本次「无警告」类结论无效（关键词或观察器异常）",
                });
            }, 0);
        });
    }

    window[PROBE_KEY] = {
        __installed: true,
        navLog: navLog,
        msgLog: msgLog,
        reset: reset,
        dump: dump,
        selfCheck: selfCheck,
        keywords: MESSAGE_KEYWORDS.slice(),
    };
})();
