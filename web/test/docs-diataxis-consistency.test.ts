import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// S4 Diátaxis 重排一致性守卫：
// - 结构：五组目录齐备、overview/progress 退场、pending-test 落位 docs/plans；
// - meta.json pages 可解析（例外：reference/backend 的 protocol-plugins / canvas-data-structure
//   为未核实遗留条目，控制线裁定保留待上游核对，本测试豁免存在性校验）；
// - llms.txt 引用路径全部存在（手工维护文件，结构变更时同步）；
// - 活跃面旧路径零命中：白名单 = README.md、AGENTS.md、docs/index.md、docs/llms.txt、
//   docs/content/docs/**（内容树）、web/src/lib/canvas/canvas-help-links.ts（in-app 引用面）；
//   历史任务/日志记录（.trellis/tasks、docs/design 变更日志、upstream-sync recon）豁免。

const repoRoot = resolve(import.meta.dir, "../..");
const contentRoot = resolve(repoRoot, "docs/content/docs");
const OLD_PATH = /content\/docs\/(?:overview|progress|backend|plugins)\//;

function walkFiles(dir: string, filter: (name: string) => boolean): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walkFiles(path, filter));
        else if (filter(entry.name)) files.push(path);
    }
    return files;
}

describe("S4 文档结构一致性", () => {
    test("顶层五组齐全；overview/progress 不存在；pending-test 落位 docs/plans", () => {
        for (const dir of ["getting-started", "agent", "canvas", "assets", "reference"]) {
            expect({ dir, ok: existsSync(resolve(contentRoot, dir)) }).toEqual({ dir, ok: true });
        }
        expect(existsSync(resolve(contentRoot, "overview"))).toBe(false);
        expect(existsSync(resolve(contentRoot, "progress"))).toBe(false);
        expect(existsSync(resolve(repoRoot, "docs/plans/pending-test.mdx"))).toBe(true);
    });

    test("meta.json pages 可解析（遗留豁免在案）", () => {
        const META_EXCEPTIONS = new Set(["reference/backend:protocol-plugins", "reference/backend:canvas-data-structure"]);
        const metas: string[] = [];
        const walk = (dir: string, rel: string) => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) walk(join(dir, entry.name), `${rel}${entry.name}/`);
                else if (entry.name === "meta.json") metas.push(rel);
            }
        };
        walk(contentRoot, "");
        expect(metas.length).toBeGreaterThanOrEqual(7);
        for (const rel of metas) {
            const meta = JSON.parse(readFileSync(join(contentRoot, rel, "meta.json"), "utf8")) as { pages?: string[] };
            for (const page of meta.pages ?? []) {
                if (META_EXCEPTIONS.has(`${rel.replace(/\/$/, "")}:${page}`)) continue;
                const ok = existsSync(join(contentRoot, rel, `${page}.mdx`)) || existsSync(join(contentRoot, rel, page));
                expect({ meta: rel, page, ok }).toEqual({ meta: rel, page, ok: true });
            }
        }
    });

    test("llms.txt 引用路径全部存在", () => {
        const txt = readFileSync(resolve(repoRoot, "docs/llms.txt"), "utf8");
        const paths = [...txt.matchAll(/\((content\/docs\/[^)]+)\)/g)].map((match) => match[1]);
        expect(paths.length).toBeGreaterThanOrEqual(15);
        for (const path of paths) {
            expect({ path, ok: existsSync(resolve(repoRoot, "docs", path)) }).toEqual({ path, ok: true });
        }
    });

    test("活跃面旧路径零命中（历史记录豁免，白名单见文件头）", () => {
        const activeFiles = [
            "README.md",
            "AGENTS.md",
            "docs/index.md",
            "docs/llms.txt",
            "web/src/lib/canvas/canvas-help-links.ts",
            ...walkFiles(contentRoot, (name) => name.endsWith(".mdx") || name === "meta.json"),
        ];
        const offenders = activeFiles.filter((file) => OLD_PATH.test(readFileSync(resolve(repoRoot, file), "utf8")));
        expect(offenders).toEqual([]);
    });
});
