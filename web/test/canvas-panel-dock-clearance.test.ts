import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clampPanelTopAboveDock, resolvePanelDockClearBottom } from "../src/components/canvas/canvas-workspace-overlays";

// 控制线 2026-09-28 micro-fix 令：选中图片节点时 O-03 药丸（chip）等面板行遮挡 dock「添加节点」按钮。
// 根因：选中态 composer 挂件（z 高于 dock 带）下探到 dock 热区时，面板任意行都能拦截 dock 按钮命中。
// 修法：让位在「面板」层完成——自然落点越带时上抬，保证 elementFromPoint(添加节点按钮中心) 命中按钮本体。
describe("rider：选中态挂件与 dock 热区避让（控制线 2026-09-28）", () => {
    test("dock 带以上可占据底缘 = 容器高 − 偏移 − 安全缝；非法偏移回落 50", () => {
        expect(resolvePanelDockClearBottom(900, 50)).toBe(844);
        expect(resolvePanelDockClearBottom(900, 46)).toBe(848);
        expect(resolvePanelDockClearBottom(900, Number.NaN)).toBe(844);
    });

    test("自然落点越过 dock 带 → 上抬到带上方（底缘 = 可占据底缘）", () => {
        // 现场几何（2026-09-28 实测）：node bottom 641 → 挂件 653..933，dock 按钮 top 854。
        expect(clampPanelTopAboveDock(653, 280, 900, 50)).toBe(564); // 844 − 280
        // 底缘恰等于可占据底缘时不抬：
        expect(clampPanelTopAboveDock(564, 280, 900, 50)).toBe(564);
        // 高位节点完全不动：
        expect(clampPanelTopAboveDock(100, 280, 900, 50)).toBe(100);
        // 极端矮容器不退化为负数：
        expect(clampPanelTopAboveDock(10, 280, 300, 50)).toBe(0);
    });

    test("源级护栏：让位接线在 update() 与 wait 拍两处均生效（入场零位移不跳变）", () => {
        const src = readFileSync(resolve(import.meta.dir, "../src/components/canvas/canvas-workspace-overlays.tsx"), "utf8");
        expect(src).toContain("--canvas-dock-popover-offset");
        expect(src).toContain("clampPanelTopAboveDock(position.top");
        expect(src).toContain("clampPanelTopAboveDock(initialPosition.top");
        expect(src).toContain("选中态遮挡 dock 修复");
    });
});
