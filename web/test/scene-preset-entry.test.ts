import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";

import { SCENE_PRESETS, findScenePreset } from "@/lib/canvas/scene-presets";
import { scenePresetBrief } from "@/components/canvas/scene-preset-chips";

/**
 * F-02 商拍场景入口守卫（过渡形态）。
 *
 * 组件本身是 JSX（本仓无 DOM 测试环境），故守卫分两层：
 *   ① 纯逻辑：`scenePresetBrief` 的文案契约
 *   ② 源码面断言：挂载点、命名红线、样式复用（照本仓既有守卫惯例，见
 *      test/canvas-node-toolbar-menu-style.test.ts）
 */

const chipsSource = readFileSync(
    new URL("../src/components/canvas/scene-preset-chips.tsx", import.meta.url),
    "utf8",
);
const panelSource = readFileSync(
    new URL("../src/components/canvas/canvas-cloud-agent-panel.tsx", import.meta.url),
    "utf8",
);

describe("场景 brief 文案契约", () => {
    test("brief 是纯中文文案，不混入模型面英文变量", () => {
        for (const preset of SCENE_PRESETS) {
            const brief = scenePresetBrief(preset);
            // 模型面 variables 的英文短语不得出现在用户面 brief 里
            expect({
                id: preset.id,
                leaked: brief.includes(preset.variables.scenario),
            }).toEqual({ id: preset.id, leaked: false });
        }
    });

    test("brief 含场景名 + 不直接生成的确认指令（对齐 starter 卡文案语义）", () => {
        for (const preset of SCENE_PRESETS) {
            const brief = scenePresetBrief(preset);
            expect({
                id: preset.id,
                hasTitle: brief.includes(preset.title),
                noDirectGenerate: brief.includes("先不要直接生成"),
                asksReference: brief.includes("@"),
            }).toEqual({ id: preset.id, hasTitle: true, noDirectGenerate: true, asksReference: true });
        }
    });

    test("brief 带场景描述正文（非只有模板壳）", () => {
        const brief = scenePresetBrief(findScenePreset("festive-party")!);
        expect(brief).toContain("香槟杯");
        expect(brief).toContain("派对");
    });
});

/**
 * 剥离注释后的代码面 —— 负向断言必须看代码面。
 *
 * 注释里合法地解释命名红线（「不用『场景胶囊』」）与上游模块名
 * （`AGENT_SCENE_DEFS`），不剥离会产生假阳性（同类教训本仓已复发三次）。
 */
function codeSurface(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("★ 命名红线（任务书 §二-3）", () => {
    test("入口组件代码面不含「胶囊」字样（用「商拍场景」限定词）", () => {
        expect(codeSurface(chipsSource).includes("胶囊")).toBe(false);
        expect(chipsSource).toContain("商拍场景");
    });

    test("入口组件代码面不复用上游 AGENT_SCENE_DEFS（语义隔离）", () => {
        expect(codeSurface(chipsSource).includes("AGENT_SCENE_DEFS")).toBe(false);
    });
});

describe("★ 样式复用（任务书 §二-2：禁直改 globals.css）", () => {
    test("复用既有 agent-scene-capsule 族类名，零新造样式", () => {
        // 复用 AgentSceneCapsules 的既有类族 —— 无需新增 CSS，也无需碰 globals.css
        for (const cls of [
            "agent-scene-capsules",
            "agent-scene-capsules-heading",
            "agent-scene-capsules-scroll",
            "agent-scene-capsule-label",
            "agent-scene-capsule-meta",
        ]) {
            expect({ cls, used: chipsSource.includes(cls) }).toEqual({ cls, used: true });
        }
    });

    test("入口组件不引入新的样式文件", () => {
        expect(chipsSource.includes('.css"')).toBe(false);
    });
});

describe("★ 挂载点（过渡形态入口已接线）", () => {
    test("ScenePresetChips 已挂到 Agent 面板空态", () => {
        expect(panelSource).toContain("ScenePresetChips");
        expect(panelSource).toContain('from "./scene-preset-chips"');
    });

    test("挂载在既有 AgentSceneCapsules 同族位置（空态、无消息时）", () => {
        const mountIndex = panelSource.indexOf("<ScenePresetChips");
        expect(mountIndex).toBeGreaterThan(-1);
        const before = panelSource.slice(0, mountIndex);
        // 空态条件在挂载点之前出现（同一 JSX 分支内）
        expect(before.includes('!messages.some((message) => message.role === "user"')).toBe(true);
        expect(before.includes("<AgentSceneCapsules")).toBe(true);
    });

    test("点场景只回填输入框，不直接发起生成（setPrompt 而非 submit）", () => {
        const mountIndex = panelSource.indexOf("<ScenePresetChips");
        const block = panelSource.slice(mountIndex, mountIndex + 400);
        expect(block).toContain("setPrompt(brief)");
        expect(block.includes("submit(")).toBe(false);
    });

    test("过渡形态声明在源码中（W5 设计卡出来后统一）", () => {
        expect(chipsSource.includes("过渡形态")).toBe(true);
        expect(panelSource.includes("过渡形态")).toBe(true);
    });
});
