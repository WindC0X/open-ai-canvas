import { describe, expect, test } from "bun:test";

import { parseCanvasStorageDocument } from "@/lib/canvas/canvas-storage-revision";

describe("parseCanvasStorageDocument", () => {
    test("空值返回 fallback 空文档", () => {
        const doc = parseCanvasStorageDocument(null, []);
        expect(doc.state.projects).toEqual([]);
        expect(doc.storageRevision).toBe(0);
    });

    test("历史对象值可直接解析（非字符串分支）", () => {
        const doc = parseCanvasStorageDocument({ state: { projects: [] }, version: 1, storageRevision: 3 });
        expect(doc.storageRevision).toBe(3);
    });

    test("损坏字符串（[object Object]）回退空文档而非抛错——防待写队列永久卡死", () => {
        const doc = parseCanvasStorageDocument("[object Object]", []);
        expect(doc.state.projects).toEqual([]);
        expect(doc.storageRevision).toBe(0);
    });

    test("其它非法 JSON 字符串同样回退空文档", () => {
        expect(parseCanvasStorageDocument("not-json{", []).state.projects).toEqual([]);
    });

    test("结构无效（可解析但缺 projects 数组）仍然抛出", () => {
        expect(() => parseCanvasStorageDocument(JSON.stringify({ state: {} }), [])).toThrow("画布持久状态无效");
    });
});
