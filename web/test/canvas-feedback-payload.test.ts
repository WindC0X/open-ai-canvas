import { describe, expect, test } from "bun:test";

import { buildFeedbackMeta, buildFeedbackPayload } from "../src/lib/canvas/feedback-payload";

const baseMeta = {
    appVersion: "v1.2.3",
    pathname: "/canvas/flora-clone-real",
    canvasId: "canvas-1",
    nodeCount: 12,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0",
    capturedAt: "2026-09-28T12:00:00.000Z",
};

describe("反馈聚合纯函数 · buildFeedbackPayload", () => {
    test("确定性组装：描述 trim 后等价，各勾选块与元信息齐全", () => {
        const padded = buildFeedbackPayload({
            description: "  生成按钮点击后没有反应  ",
            screenshotName: "shot.png",
            shareUrl: "https://example.com/share/canvas/tok123",
            meta: baseMeta,
        });
        const trimmed = buildFeedbackPayload({
            description: "生成按钮点击后没有反应",
            screenshotName: "shot.png",
            shareUrl: "https://example.com/share/canvas/tok123",
            meta: baseMeta,
        });
        expect(padded.text).toBe(trimmed.text);
        expect(padded.text).toContain("生成按钮点击后没有反应");
        expect(padded.text).toContain("## 分享链接");
        expect(padded.text).toContain("https://example.com/share/canvas/tok123");
        expect(padded.text).toContain("shot.png");
        expect(padded.text).toContain("- 版本：v1.2.3");
        expect(padded.text).toContain("- 页面：/canvas/flora-clone-real");
        expect(padded.text).toContain("- 画布 ID：canvas-1");
        expect(padded.text).toContain("- 画布节点数：12");
        expect(padded.text).toContain("- 时间：2026-09-28T12:00:00.000Z");
        expect(Object.keys(padded.meta)).toEqual(["版本", "页面", "画布 ID", "画布节点数", "时间", "浏览器"]);
    });

    test("空描述与纯空白描述拒绝组装", () => {
        expect(() => buildFeedbackPayload({ description: "", meta: baseMeta })).toThrow("请填写问题描述");
        expect(() => buildFeedbackPayload({ description: "   \n\t ", meta: baseMeta })).toThrow("请填写问题描述");
    });

    test("敏感字段排除：明示区键名严格等于白名单，文本不含敏感词", () => {
        const { text, meta } = buildFeedbackPayload({
            description: "描述",
            screenshotName: "shot.png",
            shareUrl: "https://example.com/share/canvas/tok123",
            meta: baseMeta,
        });
        const whitelist = ["版本", "页面", "画布 ID", "画布节点数", "时间", "浏览器"];
        for (const key of Object.keys(meta)) expect(whitelist).toContain(key);
        expect(Object.keys(meta).length).toBe(whitelist.length);
        const lowered = text.toLowerCase();
        for (const needle of ["cookie", "apikey", "api_key", "authorization", "localstorage", "sessionstorage", "password"]) {
            expect(lowered).not.toContain(needle);
        }
    });

    test("未勾选分享链接时文本不含分享节（显式 token 仅随勾选出现）", () => {
        const { text } = buildFeedbackPayload({ description: "描述", meta: baseMeta });
        expect(text).not.toContain("分享链接");
        expect(text).not.toContain("tok123");
        expect(text).not.toContain("## 截图");
    });

    test("可选元信息缺省时省略对应行；版本前缀归一", () => {
        const meta = buildFeedbackMeta({ appVersion: "1.0.0", pathname: "/canvas/a", userAgent: "UA", capturedAt: "T" });
        expect(Object.keys(meta)).toEqual(["版本", "页面", "时间", "浏览器"]);
        expect(meta["版本"]).toBe("v1.0.0");
        expect(buildFeedbackMeta({ ...baseMeta, appVersion: "vv2.0.0" })["版本"]).toBe("v2.0.0");
    });

    test("明示区与实际复制文本逐条一致（同源 meta）", () => {
        const result = buildFeedbackPayload({ description: "d", meta: baseMeta });
        for (const [label, value] of Object.entries(result.meta)) {
            expect(result.text).toContain(`- ${label}：${value}`);
        }
    });
});
