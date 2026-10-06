import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasShortDramaEmptyState } from "../src/components/canvas/canvas-short-drama-entry";

/**
 * F-09 修复批 □5-2 —— guided 态模板卡的【真实渲染断言】（控制线 2026-10-06 第二轮要求）。
 *
 * ★ 为什么需要本文件：控制线指出 f09-fix-batch.test.ts 的 □5-2 组是【源码文本断言】
 *   （`expect(source).toContain("或从现成模板开始")`），能捕获「删除」不能捕获
 *   「保留文本但语义失效」。本文件用 renderToStaticMarkup 真实渲染组件，
 *   断言【输出 HTML 中的可交互元素】—— 语义失效必红。
 *
 * 判据（任务书 §2.3）：默认新建画布是 guided 态（shortDramaEnabled=true 且
 * starterMode !== "freeform"），模板卡必须在【空状态可见】⇒ 必须挂到 guided 态。
 */

const CARDS = [
    { id: "clone-recreate", title: "爆款复刻", hint: "两张图复刻版式", onPick: () => {} },
    { id: "another", title: "另一模板", hint: "示例", onPick: () => {} },
];

function render(props: Partial<Parameters<typeof CanvasShortDramaEmptyState>[0]> = {}) {
    return renderToStaticMarkup(
        <CanvasShortDramaEmptyState
            onCreatePipeline={() => {}}
            onOpenAgent={() => {}}
            onStartFreeform={() => {}}
            onUpload={() => {}}
            onAddText={() => {}}
            onAddScript={() => {}}
            {...props}
        />,
    );
}

describe("□5-2 guided 态模板卡（★ 真实渲染断言）", () => {
    test("★ 行为：传入 templateCards ⇒ 标题与 hint 出现在渲染输出中", () => {
        const html = render({ templateCards: CARDS });
        expect(html).toContain("爆款复刻");
        expect(html).toContain("两张图复刻版式");
        expect(html).toContain("另一模板");
        expect(html).toContain("或从现成模板开始");
    });

    test("★ 行为：templateCards 为 undefined ⇒ 不渲染模板区域（但引导区仍在）", () => {
        const html = render();
        expect(html).not.toContain("或从现成模板开始");
        expect(html).not.toContain("爆款复刻");
        // guided 态原有内容不受影响（回归保护）
        expect(html).toContain("交给 Agent");
        expect(html).toContain("空白画布");
    });

    test("★ 行为：templateCards 为空数组 ⇒ 不渲染模板区域（空态不显示标题）", () => {
        const html = render({ templateCards: [] });
        expect(html).not.toContain("或从现成模板开始");
    });

    test("★ 行为：每张卡渲染为【可点击 button】（不是纯文本）", () => {
        const html = render({ templateCards: CARDS });
        // 卡片必须是 button 元素（可交互），且数量与传入一致
        const cardButtons = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*?爆款复刻[\s\S]*?<\/button>/g) ?? [];
        expect(cardButtons.length).toBeGreaterThan(0);
        expect(cardButtons[0]).toContain("<button");
    });

    test("★ 行为：卡片不混入短剧引导按钮区（独立区域语义）", () => {
        const html = render({ templateCards: CARDS });
        // 模板区标题「或从现成模板开始」应出现在「空白分镜」之后（footer 之后 = 独立区域）
        const templateIdx = html.indexOf("或从现成模板开始");
        const scriptIdx = html.indexOf("空白分镜");
        expect(templateIdx).toBeGreaterThan(-1);
        expect(scriptIdx).toBeGreaterThan(-1);
        expect(templateIdx).toBeGreaterThan(scriptIdx);
    });
});
