import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const toolbar = readFileSync(new URL("../src/components/canvas/canvas-node-toolbar.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../src/components/canvas/canvas-grid-split-picker.tsx", import.meta.url), "utf8");
const pickerCss = readFileSync(new URL("../src/components/canvas/canvas-grid-split-picker.css", import.meta.url), "utf8");

// 回归（2026-09-25 用户报告）：工具栏菜单展开后，指针移入列表/切分面板进行选择时自动关闭。
// 根因：hover 归因的遮挡门把指针进入浮层判为「无关浮层」（菜单不在供给域、几何矩形不覆盖），
// 380ms grace + 160ms 退场后工具栏实例卸载，带走菜单。
// 修复 = 菜单容器与切分 picker 标注 data-supply-node（与参数设置气泡同架构），指针在其上时归属续航。
describe("node toolbar menu hover supply", () => {
    test("菜单容器与切分 picker 均标记为节点供给（防「移入即关」回归）", () => {
        expect(toolbar).toContain("data-supply-node={nodeId}");
        expect(toolbar).toContain("supplyNodeId={nodeId}");
        expect(picker).toContain("data-supply-node={supplyNodeId}");
    });

    test("切分两列天然等高（防「自定义」展开后的空槽与左列拉长回归）", () => {
        expect(pickerCss).toContain(".canvas-grid-split-presets > .canvas-grid-split-item");
        expect(pickerCss).toContain("flex: 1 1 auto");
        expect(pickerCss).toContain("width: 7.3125rem");
    });
});
