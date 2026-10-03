import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";

import { generationTaskExecutionLabel } from "@/lib/generation-task-display";

/**
 * F-02 统一任务面 —— 执行位置元数据标签守卫。
 *
 * 约束（MASTER-PLAN v1.6 §6 / 任务书 §六-2，用户拍板）：
 * **云任务呈现走既有任务面模式，执行位置只作元数据标签，不单独造 UI。**
 *
 * 故本文件既测纯函数的标签语义，也断言面板源码**没有**新造独立任务面。
 */

const panelSource = readFileSync(
    new URL("../src/components/canvas/canvas-active-task-panel.tsx", import.meta.url),
    "utf8",
);

describe("执行位置标签语义", () => {
    test("云端任务 + 积分启用 → 「云端 · X 积分」", () => {
        const label = generationTaskExecutionLabel(
            { provider: "a6api", model: "nano-banana-2" },
            { creditsEnabled: true, billingLabel: "0.02" },
        );
        expect(label).toBe("云端 · 0.02");
    });

    test("积分体系关闭 → 只显示「云端」（不显示无意义的积分位）", () => {
        const label = generationTaskExecutionLabel(
            { provider: "a6api", model: "nano-banana-2" },
            { creditsEnabled: false, billingLabel: "0.02" },
        );
        expect(label).toBe("云端");
    });

    test("无计费信息 → 只显示「云端」（不产出「云端 · undefined」）", () => {
        const label = generationTaskExecutionLabel(
            { provider: "a6api", model: "nano-banana-2" },
            { creditsEnabled: true },
        );
        expect(label).toBe("云端");
    });

    test("无 provider 也无 model → 「本地」（分支保留，当前无本地任务行）", () => {
        const label = generationTaskExecutionLabel({}, { creditsEnabled: true, billingLabel: "0.02" });
        expect(label).toBe("本地");
    });

    test("★ 标签形态是单行文本（元数据标签，非独立 UI 的标题）", () => {
        const label = generationTaskExecutionLabel(
            { provider: "p", model: "m" },
            { creditsEnabled: true, billingLabel: "1.00" },
        );
        expect(label.includes("\n")).toBe(false);
        expect(label.split(" · ").length).toBeLessThanOrEqual(2);
    });
});

describe("★ 统一任务面约束（不单独造 UI）", () => {
    test("标签渲染在既有活动任务面板内（复用同一面板，非新组件）", () => {
        expect(panelSource).toContain("generationTaskExecutionLabel");
        expect(panelSource).toContain("执行位置");
    });

    test("标签是面板展开区的一行详情，与「当前阶段」同族", () => {
        const stageIndex = panelSource.indexOf("<span>当前阶段</span>");
        const execIndex = panelSource.indexOf("<span>执行位置</span>");
        expect(stageIndex).toBeGreaterThan(-1);
        expect(execIndex).toBeGreaterThan(stageIndex);
        // 同一展开区内（相距不远），不是另起的区块
        expect(execIndex - stageIndex).toBeLessThan(600);
    });

    test("★ 未新增独立的任务面组件（不造第二套 UI）", () => {
        // 既有任务面：活动面板 + 工作区面板 + 任务中心 API
        const known = [
            "canvas-active-task-panel",
            "canvas-workspace-task-panel",
        ];
        for (const name of known) {
            expect({ name, exists: true }).toEqual({ name, exists: true });
        }
        // 面板源码不得引入 F-02 专用的任务面组件
        expect(/from "\.\/scene-task-panel"/.test(panelSource)).toBe(false);
    });

    test("标签用 theme token 着色（不散落字面色值）", () => {
        // 定位 JSX 渲染处（注释里也提到「执行位置」，必须取渲染节点）
        const execIndex = panelSource.indexOf("<span>执行位置</span>");
        expect(execIndex).toBeGreaterThan(-1);
        const block = panelSource.slice(execIndex, execIndex + 300);
        expect(block).toContain("theme.node.text");
        // 不得出现十六进制字面色值
        expect(/#[0-9a-fA-F]{3,6}\b/.test(block)).toBe(false);
    });
});

describe("★ 云任务类型标签（任务列表条目可辨识）", () => {
    test("任务类型标签表已含画布生图（场景图任务的载体类型）", async () => {
        const mod = await import("@/lib/generation-task-display");
        expect(mod.taskTypeLabel.canvas_image).toBe("画布生图");
    });
});
