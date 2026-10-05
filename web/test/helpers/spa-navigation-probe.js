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
 *   2.5 ★★ 自检后必须 reset()（自检本身会写入一条 msgLog 记录）：
 *        orca-ide eval --expression "window.__spaNavProbe.reset(); 'reset'"
 *      · 探针已内置清理（selfCheck 会移除自己写入的 msgLog 记录），
 *        但**显式 reset 更稳妥** —— 且能一并清掉自检前的历史记录。
 *      · 不 reset 的后果：msgLog 残留自检假消息（含目标关键词）⇒
 *        「msgLog 不含目标文案」类阴性断言**必然失败**（假阳性）。
 *      （实测：顺序 reset→selfCheck→触发→dump 会残留 1 条；
 *             顺序 selfCheck→reset→触发→dump 则干净 —— 测试线 b12r26 发现）
 *   3. 触发要验证的交互（点击等）
 *   4. 取证据：
 *        orca-ide eval --expression "JSON.stringify(window.__spaNavProbe.dump())"
 *      → { navLog: [{ type, url, at }], msgLog: [text] }
 *
 * 典型用法（R5 P2-1 验证）：同一按钮，唯一变量 = 容器内是否有该任务的会话；
 * 正例 navLog 含 ?conversation=...（随后 replaceState 删除），负例不含 —— 直接对照。
 *
 * ★★ 两条使用纪律（R7 评审 + 控制线核验补充，2026-10-05）：
 *
 * 【纪律A】阳性对照必须断言**目标文案**，不能只断言「msgLog 非空」。
 *   本探针按**子串**匹配（matchesKeywords 用 indexOf），而同一页面可能存在
 *   **其他含相同关键词的消息** —— 实测画布页 /canvas/* 同时存在两条 warning：
 *     · project.tsx:682              「未找到要接续的会话，请从首页重新进入。」← 目标
 *     · use-canvas-project-lifecycle.ts:210
 *                                    「部分助手会话素材恢复失败，已使用项目记录继续打开」
 *   两条触发条件独立（前者 = URL 带 ?conversation 但无该会话；后者 = 素材恢复失败 catch），
 *   **可同页共现**。若只断言 msgLog.length > 0，捕获到非目标消息也会判「探针工作正常」。
 *   ⇒ 正确写法：msgLog.some(function (m) { return m.indexOf("要接续的会话") !== -1; })
 *
 *   ★★ 该陷阱是**双向**的（A线 补充，控制线核验采纳）：
 *     msgLog 是**关键词粗筛**，不是「目标消息证据」。非空**既不能证明目标出现过，
 *     也不能证明目标没出现过** —— 两个方向都可能被干扰消息污染：
 *       · 判「目标出现过」时：干扰消息使 msgLog 非空 ⇒ 假阳性
 *       · 判「目标没出现」时：干扰消息使 msgLog 非空 ⇒ 若据「非空」反推「有消息」
 *         或据「有干扰」混淆结论 ⇒ 假阴性/误读
 *     干扰消息的触发路径**独立且不罕见**（lifecycle.ts:210 走
 *     hydrateAssistantImages 的 catch；而 resolveImageUrl（image-storage.ts:85）
 *     经 getResourceAccess 发网络请求 ⇒ 网络/OSS 异常即抛错 ⇒ 整批 catch）。
 *     ⇒ 一切判定必须锚定**目标文案本身**，不得以 msgLog 的空/非空为判据。
 *
 *   ★★★ 更根本的原因：本探针**不过滤消息容器**（见 captureNode，捕获任意
 *     含关键词的 addedNode），因此**任何**插入 DOM 的文本都可能进 msgLog ——
 *     不只是 antd message。实测案例（B线 R5 P2-1 真机验证，2026-10-05）：
 *       web/src/components/canvas/canvas-cloud-agent-composer.tsx:171
 *         <p className="agent-scene-capsules-note">
 *           仅本会话生效 · 缺失技能将加入技能库 · Agent 按任务调用</p>
 *       含「会话」二字 ⇒ 被捕获，**但它不是警告**（是常驻说明文字）。
 *     当时靠人工阅读 msgLog 内容识别（报告标注「面板内容（非警告）」）——
 *     **若无纪律A，此条会被当作「捕获到消息」的证据**。
 *     注意它与 antd message 的区别：message 是短暂 toast（3 秒后消失），
 *     而该 <p> 是**常驻 DOM**（面板打开期间一直在），任何一次面板重渲染都可能命中。
 *
 * 【纪律B】多轮对照前必须 reset()，否则证据相互污染。
 *   dump() 返回**全量累计**（navLog.slice() / msgLog.slice()），不是增量。
 *   R5 P2-1 式对照需 2 轮（阴性 → 阳性），若不 reset，第 2 轮 dump() 会包含第 1 轮记录，
 *   无法判断「本条导航是本轮产生的还是上轮残留」。
 *   ⇒ 每轮开始前：window.__spaNavProbe.reset()
 *   （★ 注意：reset() 清空记录，但**不影响** selfCheck —— 每轮可重新自检。）
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
                // ★ 修法2（测试线 b12r26 发现，控制线核验采纳）：自检消息**已进入 msgLog**，
                //   只删 DOM 节点不够 —— 该记录含目标关键词，会让后续「msgLog 不含
                //   目标文案」的阴性断言**必然失败**。此处一并移除，保持 msgLog
                //   只含真实消息。未捕获时（ok=false）msgLog 中本无该条，indexOf 返回 -1，
                //   不会误删（控制线边界实测：观察器失效场景 msgLog 仍为空）。
                var selfIdx = msgLog.indexOf(SELF_CHECK_TEXT.slice(0, 200));
                if (selfIdx !== -1) msgLog.splice(selfIdx, 1);
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
