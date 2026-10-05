import { describe, expect, test } from "bun:test";

import { taskDeliverableOutput, taskDeliverableState } from "@/lib/task-deliverable-state";
import type { GenerationTask } from "@/services/api/task-center";

/**
 * R3 P1-2：可下载判据必须与下载实现同源。
 *
 * 缺陷：任务面原先 `canDownload = status === "succeeded" && Boolean(previewUrl)`，
 * 而 downloadGenerationTaskResult 自认 previewUrl「可能是缩略图」并优先走
 * outputs[].materializedAssetId ⇒ 判据与实现优先序不一致。
 */

function task(overrides: Partial<GenerationTask> = {}): GenerationTask {
    return {
        id: "task-1",
        type: "image",
        status: "succeeded",
        prompt: "测试",
        createdAt: "2026-10-05T00:00:00Z",
        updatedAt: "2026-10-05T00:00:00Z",
        ...overrides,
    } as GenerationTask;
}

describe("taskDeliverableState（可下载判据，与下载实现同源）", () => {
    test("★ 有合规素材但无 previewUrl ⇒ 仍可下载（原缺陷：入口不出现）", () => {
        const state = taskDeliverableState(task({
            outputs: [{ outputIndex: 0, materializedAssetId: "asset-1" }],
        } as never));
        expect(state.downloadable).toBe(true);
        expect(state.downloadable && state.quality).toBe("original");
    });

    test("★ 素材未就绪但无 previewUrl ⇒ 不可下载（原缺陷：按钮可点但会失败）", () => {
        const state = taskDeliverableState(task({ outputs: [] } as never));
        expect(state.downloadable).toBe(false);
    });

    test("无素材记录但有 previewUrl ⇒ 可下载但标记为降级（preview 形态）", () => {
        const state = taskDeliverableState(task({ previewUrl: "https://example.com/thumb.webp" } as never));
        expect(state.downloadable).toBe(true);
        expect(state.downloadable && state.quality).toBe("preview");
        if (state.downloadable && state.quality === "preview") {
            expect(state.reason).toContain("素材记录未就绪");
        }
    });

    test("任务未成功 ⇒ 不可下载（无论有无产物）", () => {
        for (const status of ["running", "queued", "failed", "cancelled"] as const) {
            const state = taskDeliverableState(task({
                status,
                previewUrl: "https://example.com/x.png",
                outputs: [{ outputIndex: 0, materializedAssetId: "asset-1" }],
            } as never));
            expect(state.downloadable).toBe(false);
        }
    });

    test("两个信号都无 ⇒ 不可下载且给出原因", () => {
        const state = taskDeliverableState(task());
        expect(state.downloadable).toBe(false);
        if (!state.downloadable) expect(state.reason.length).toBeGreaterThan(0);
    });

    test("★ taskDeliverableOutput 取 outputIndex 最小者（与下载实现同源）", () => {
        const output = taskDeliverableOutput(task({
            outputs: [
                { outputIndex: 2, materializedAssetId: "asset-late" },
                { outputIndex: 0, materializedAssetId: "asset-first" },
            ],
        } as never));
        expect(output?.materializedAssetId).toBe("asset-first");
    });
});
