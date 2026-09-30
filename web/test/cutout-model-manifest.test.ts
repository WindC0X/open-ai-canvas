import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    CUTOUT_MODEL_ID,
    SUPPORTED_MANIFEST_SCHEMA_VERSION,
    cutoutModelBytes,
    cutoutModelEntry,
    parseCutoutManifest,
} from "../src/lib/media-conversion/cutout-model-manifest";

const validManifest = {
    schemaVersion: 1,
    models: [
        {
            id: "birefnet-lite-512",
            task: "image-segmentation",
            runtime: "transformers.js",
            files: [
                { path: "config.json", bytes: 81, sha256: "a".repeat(64) },
                { path: "onnx/model_fp16.onnx", bytes: 98484532, sha256: "b".repeat(64) },
            ],
            license: "MIT",
            source: "https://huggingface.co/studioludens/birefnet-lite-512",
        },
    ],
};

describe("抠图权重清单", () => {
    test("接受的版本号与实现常量一致", () => {
        expect(SUPPORTED_MANIFEST_SCHEMA_VERSION).toBe(1);
        expect(CUTOUT_MODEL_ID).toBe("birefnet-lite-512");
    });

    test("合法清单通过校验", () => {
        const manifest = parseCutoutManifest(validManifest);
        expect(manifest.models).toHaveLength(1);
        expect(cutoutModelEntry(manifest).license).toBe("MIT");
    });

    test("权重总体积可求和（用于首次下载体积提示）", () => {
        const manifest = parseCutoutManifest(validManifest);
        expect(cutoutModelBytes(cutoutModelEntry(manifest))).toBe(81 + 98484532);
    });

    test("版本号不符时拒绝", () => {
        expect(() => parseCutoutManifest({ ...validManifest, schemaVersion: 2 })).toThrow("版本不受支持");
    });

    test("缺少模型条目时拒绝", () => {
        expect(() => parseCutoutManifest({ schemaVersion: 1, models: [] })).toThrow("缺少模型条目");
        expect(() => parseCutoutManifest({ schemaVersion: 1 })).toThrow("缺少模型条目");
    });

    test("sha256 格式不合法时拒绝", () => {
        const broken = structuredClone(validManifest);
        broken.models[0].files[0].sha256 = "not-a-hash";
        expect(() => parseCutoutManifest(broken)).toThrow("缺少 sha256");
    });

    test("体积不合法时拒绝", () => {
        const broken = structuredClone(validManifest);
        broken.models[0].files[0].bytes = 0;
        expect(() => parseCutoutManifest(broken)).toThrow("体积不合法");
    });

    test("非对象输入被拒绝", () => {
        expect(() => parseCutoutManifest(null)).toThrow("格式不正确");
        expect(() => parseCutoutManifest("nope")).toThrow("格式不正确");
    });

    test("查询不存在的模型时抛错而不是返回空", () => {
        const manifest = parseCutoutManifest(validManifest);
        expect(() => cutoutModelEntry(manifest, "nonexistent")).toThrow("没有 nonexistent");
    });

    test("仓库内实际发布的清单通过校验，且声明 MIT", () => {
        const path = resolve(import.meta.dir, "../public/models/birefnet-lite-512/models-manifest.json");
        const manifest = parseCutoutManifest(JSON.parse(readFileSync(path, "utf8")));
        const entry = cutoutModelEntry(manifest);
        expect(entry.license).toBe("MIT");
        expect(entry.files.some((file) => file.path === "onnx/model_fp16.onnx")).toBe(true);
        // 只发 fp16 单档（Q-2 裁定：一份权重同时服务 WebGPU 与 WASM 回落）。
        expect(entry.files.some((file) => file.path === "onnx/model.onnx")).toBe(false);
    });
});
