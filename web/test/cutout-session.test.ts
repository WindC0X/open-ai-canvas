/**
 * 抠图会话标记单测（测试线 S1 阻塞缺陷 2026-10-02）。
 *
 * 覆盖数据兼容路径：已落库的残留节点必须被显示侧治愈，不做数据迁移。
 */
import { describe, expect, test } from "bun:test";
import { CUTOUT_SESSION_ID, isActiveCutoutSession } from "@/lib/media-conversion/cutout-session";

describe("抠图会话标记", () => {
    test("会话 id 是非空字符串（模块级单次生成）", () => {
        expect(typeof CUTOUT_SESSION_ID).toBe("string");
        expect(CUTOUT_SESSION_ID.length).toBeGreaterThan(0);
    });

    test("本次会话发起的 phase → 显示", () => {
        expect(isActiveCutoutSession("encode", CUTOUT_SESSION_ID)).toBe(true);
        expect(isActiveCutoutSession("queued", CUTOUT_SESSION_ID)).toBe(true);
        expect(isActiveCutoutSession("locate", CUTOUT_SESSION_ID)).toBe(true);
    });

    test("存量脏数据（旧会话 id）→ 不显示（治愈已落库残留）", () => {
        expect(isActiveCutoutSession("encode", "old-session-from-previous-page-load")).toBe(false);
        expect(isActiveCutoutSession("download", "stale")).toBe(false);
    });

    test("无会话标记（S1 修复前的历史节点）→ 不显示", () => {
        // 用户 twin 库的 1790957281s 节点属此类：phase 在、sessionId 不在
        expect(isActiveCutoutSession("encode", undefined)).toBe(false);
        expect(isActiveCutoutSession("download", undefined)).toBe(false);
    });

    test("无 phase → 不显示（终态清理后的正常节点）", () => {
        expect(isActiveCutoutSession(undefined, CUTOUT_SESSION_ID)).toBe(false);
        expect(isActiveCutoutSession(undefined, undefined)).toBe(false);
        expect(isActiveCutoutSession("", CUTOUT_SESSION_ID)).toBe(false);
    });
});
