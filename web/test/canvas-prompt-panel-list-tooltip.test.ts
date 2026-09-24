import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const source = readFileSync(new URL("../src/components/canvas/canvas-node-prompt-panel.tsx", import.meta.url), "utf8");

describe("text composer list-mode hint", () => {
    test("列表模式说明为 tooltip（挂在「列表」开关上），不再常驻占位", () => {
        expect(source).toContain('<Tooltip title="行数和列结构由模型判断">');
        expect(source).not.toContain("行数和列结构由模型判断</span>");
    });
});
