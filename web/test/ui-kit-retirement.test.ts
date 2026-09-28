import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function walkSourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkSourceFiles(path));
            continue;
        }
        if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
    }
    return files;
}

const srcRoot = resolve(import.meta.dir, "../src");

// 全 src 快扫描用例耗时受 /mnt/f 慢 IO 影响：实测 5.1-6.3s 越过默认 5s 线（控制线 2026-09-28 独立复现在案），
// per-test 超时加宽至 20s；断言与扫描口径不变。
test("command confirms use App.useApp().modal instead of static Modal.confirm", () => {
    const offenders = walkSourceFiles(srcRoot)
        .filter((file) => readFileSync(file, "utf8").includes("Modal.confirm("))
        .map((file) => relative(srcRoot, file));
    expect(offenders).toEqual([]);
}, 20000);

test("generic empties do not import antd Empty", () => {
    const offenders = walkSourceFiles(srcRoot)
        .filter((file) => /import\s*\{[^}]*\bEmpty\b/.test(readFileSync(file, "utf8")))
        .map((file) => relative(srcRoot, file));
    expect(offenders).toEqual([]);
}, 20000);

test("flush modal and drawer spacing is owned by product shells", () => {
    const offenders = walkSourceFiles(srcRoot)
        .filter((file) => /styles\s*=\s*\{\{\s*body:\s*\{\s*padding:\s*0\s*\}\s*\}\}/.test(readFileSync(file, "utf8")))
        .map((file) => relative(srcRoot, file));
    expect(offenders).toEqual([]);
}, 20000);
