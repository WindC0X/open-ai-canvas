/**
 * 权重清单的类型与校验规则。
 *
 * 清单随权重一起发布，运行期用来确认拿到的文件是预期的那个版本；
 * 这里只做结构校验（sha256 的实际比对在 scripts/fetch-cutout-models.sh 里，
 * 浏览器侧不重复下载整份权重做哈希）。
 */

export const CUTOUT_MODEL_ID = "birefnet-lite-512" as const;

export type CutoutModelFile = {
    path: string;
    bytes: number;
    sha256: string;
};

export type CutoutModelEntry = {
    id: string;
    task: string;
    runtime: string;
    files: CutoutModelFile[];
    license: string;
    source: string;
    upstream?: string;
};

export type CutoutModelManifest = {
    schemaVersion: number;
    models: CutoutModelEntry[];
};

/** 当前支持的清单版本；升版时要同时给出迁移方式（如 INT8 减重档）。 */
export const SUPPORTED_MANIFEST_SCHEMA_VERSION = 1 as const;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function parseCutoutManifest(raw: unknown): CutoutModelManifest {
    if (!raw || typeof raw !== "object") throw new Error("模型清单格式不正确");
    const manifest = raw as Partial<CutoutModelManifest>;
    if (manifest.schemaVersion !== SUPPORTED_MANIFEST_SCHEMA_VERSION) {
        throw new Error(`模型清单版本不受支持：${String(manifest.schemaVersion)}`);
    }
    if (!Array.isArray(manifest.models) || manifest.models.length === 0) {
        throw new Error("模型清单缺少模型条目");
    }
    for (const model of manifest.models) {
        if (!model?.id || !Array.isArray(model.files) || model.files.length === 0) {
            throw new Error("模型清单条目不完整");
        }
        for (const file of model.files) {
            if (!file?.path) throw new Error("模型文件缺少路径");
            if (!Number.isFinite(file.bytes) || file.bytes <= 0) throw new Error(`模型文件体积不合法：${file.path}`);
            if (!SHA256_PATTERN.test(file.sha256 ?? "")) throw new Error(`模型文件缺少 sha256：${file.path}`);
        }
    }
    return manifest as CutoutModelManifest;
}

/** 取出指定模型的条目；找不到时抛错而不是返回空值，避免静默降级。 */
export function cutoutModelEntry(manifest: CutoutModelManifest, id: string = CUTOUT_MODEL_ID): CutoutModelEntry {
    const entry = manifest.models.find((model) => model.id === id);
    if (!entry) throw new Error(`模型清单里没有 ${id}`);
    return entry;
}

/** 权重总体积（字节），用于首次下载的体积提示。 */
export function cutoutModelBytes(entry: CutoutModelEntry): number {
    return entry.files.reduce((total, file) => total + file.bytes, 0);
}
