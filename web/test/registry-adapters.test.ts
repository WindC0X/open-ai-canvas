/**
 * 注册表读取链路测试 —— R25m 片 1-2 的全链验证。
 *
 * 片 1：服务端 tools.json style → 统一 schema（映射契约正确性）
 * 片 2：legacy 18 条 → 统一 schema + 离线降级标注（降级必须标注，不得静默）
 */

import { describe, expect, mock, test } from "bun:test";

import { ASSET_KIND_LABELS, isStyleAsset, registryAssetFromLegacyStylePreset, registryAssetFromToolSummary, registryAssetsFromToolSummaries } from "../src/lib/canvas/registry-adapters";
import { degradedNoticeText, loadStyleAssets } from "../src/lib/canvas/registry-reader";
import { isAssetVisibleToUser, PRESET_ASSET_KINDS } from "../src/lib/canvas/registry-asset";
import type { CanvasStylePreset } from "../src/lib/canvas/canvas-style-system";

/** 服务端 ToolSummary 样例（照 tools.json style #1 的真实字段）。 */
const SERVER_STYLE_TOOL = {
    id: 1,
    type: "style",
    labelEn: "period_idol",
    label: "古装偶像",
    desc: "",
    tag: "period",
    cover: "https://example.com/cover",
    ratio: "",
    mediaUrl: "",
    ownerId: "",
    source: "builtin",
    enabled: true,
    visibility: "public",
    sortWeight: 1,
    favorited: false,
    createdAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
};

/** legacy 预设样例（照 canvas-style-picker-modal.tsx 的真实结构）。 */
const LEGACY_STYLE_PRESET: CanvasStylePreset = {
    id: "urban-live-action",
    title: "都市真人短剧",
    category: "真人实拍",
    description: "中性城市色调、真实东亚演员与生活化服化道",
    tags: ["职场", "情感"],
    prompt: "【项目定位】当代中国都市真人短剧的写实轻电影风格",
    imageUrl: "/short-drama-styles/urban-live-action.jpg",
};

describe("片 1：服务端 tools.json style → 统一 schema", () => {
    test("字段映射正确（映射契约 §3.3）", () => {
        const asset = registryAssetFromToolSummary(SERVER_STYLE_TOOL)!;
        expect(asset.assetId).toBe(1);
        expect(asset.assetKind).toBe("preset/style");
        expect(asset.slug).toBe("period_idol");
        expect(asset.title).toBe("古装偶像");
        expect(asset.group).toBe("period");
        expect(asset.coverUrl).toBe("https://example.com/cover");
        expect(asset.origin).toBe("server");
    });

    test("列表摘要无 prompt 时留空（不报错）", () => {
        const asset = registryAssetFromToolSummary(SERVER_STYLE_TOOL)!;
        expect(asset.prompt).toBe("");
    });

    test("详情含 prompt 时取到", () => {
        const asset = registryAssetFromToolSummary({ ...SERVER_STYLE_TOOL, prompt: "full style prompt" })!;
        expect(asset.prompt).toBe("full style prompt");
    });

    test("未知 toolType 返回 undefined（不静默归错类）", () => {
        expect(registryAssetFromToolSummary({ ...SERVER_STYLE_TOOL, type: "unknown_type" })).toBeUndefined();
        expect(registryAssetFromToolSummary({ ...SERVER_STYLE_TOOL, type: "effect" })).toBeUndefined();
    });

    test("motion 类型映射到 preset/motion", () => {
        const asset = registryAssetFromToolSummary({ ...SERVER_STYLE_TOOL, type: "motion" })!;
        expect(asset.assetKind).toBe("preset/motion");
    });

    test("nine_grid 类型映射到 template/canvas", () => {
        const asset = registryAssetFromToolSummary({ ...SERVER_STYLE_TOOL, type: "nine_grid" })!;
        expect(asset.assetKind).toBe("template/canvas");
    });

    test("批量适配过滤未知类型（不产生空洞记录）", () => {
        const assets = registryAssetsFromToolSummaries([SERVER_STYLE_TOOL, { ...SERVER_STYLE_TOOL, type: "effect" }, { ...SERVER_STYLE_TOOL, id: 2 }]);
        expect(assets.length).toBe(2);
    });

    test("scope 语义映射：public / private→custom / 收藏→favorites", () => {
        expect(registryAssetFromToolSummary(SERVER_STYLE_TOOL)!.scope).toBe("public");
        expect(registryAssetFromToolSummary({ ...SERVER_STYLE_TOOL, visibility: "private" })!.scope).toBe("custom");
        expect(registryAssetFromToolSummary({ ...SERVER_STYLE_TOOL, favorited: true })!.scope).toBe("favorites");
    });
});

describe("片 2：legacy 18 条 → 统一 schema（离线降级源）", () => {
    test("字段映射正确 + origin 标记为 local-fallback", () => {
        const asset = registryAssetFromLegacyStylePreset(LEGACY_STYLE_PRESET);
        expect(asset.assetId).toBe("urban-live-action");
        expect(asset.assetKind).toBe("preset/style");
        expect(asset.slug).toBe("urban-live-action");
        expect(asset.title).toBe("都市真人短剧");
        expect(asset.group).toBe("真人实拍");
        expect(asset.coverUrl).toBe("/short-drama-styles/urban-live-action.jpg");
        // ★ 关键：降级源必须带标记，不得伪装成服务端数据
        expect(asset.origin).toBe("local-fallback");
    });

    test("★ 降级源与服务端源 origin 可区分（防静默混淆）", () => {
        const server = registryAssetFromToolSummary(SERVER_STYLE_TOOL)!;
        const local = registryAssetFromLegacyStylePreset(LEGACY_STYLE_PRESET);
        expect(server.origin).not.toBe(local.origin);
    });

    test("两条源产出同一 AssetKind（可归一到同一清单）", () => {
        const server = registryAssetFromToolSummary(SERVER_STYLE_TOOL)!;
        const local = registryAssetFromLegacyStylePreset(LEGACY_STYLE_PRESET);
        expect(server.assetKind).toBe(local.assetKind);
        expect(isStyleAsset(server)).toBe(true);
        expect(isStyleAsset(local)).toBe(true);
    });
});

describe("片 1-2 全链：服务端优先 + 失败降级标注", () => {
    test("★ 服务端成功 → degraded=false 且用服务端数据（mock 成功路径）", async () => {
        // 用 mock 覆盖 listTools 的成功返回 —— 测试环境无后端，真实成功路径需 mock。
        const mod = await import("../src/services/api/tools");
        const original = mod.listTools;
        const spy = mock((input: unknown, config: unknown) => {
            void input;
            void config;
            return Promise.resolve({ tools: [SERVER_STYLE_TOOL], totalCount: 1, page: 1, pageSize: 60, hasMore: false });
        });
        try {
            // bun 的 ESM 命名空间不可直接改 —— 用 mock.module 替换模块
            mock.module("../src/services/api/tools", () => ({ ...mod, listTools: spy }));
            const fresh = await import("../src/lib/canvas/registry-reader?mock-success");
            const result = await fresh.loadStyleAssets({ localFallback: [LEGACY_STYLE_PRESET] });
            expect(result.degraded).toBe(false);
            expect(result.assets.length).toBe(1);
            expect(result.assets[0]!.origin).toBe("server");
            expect(result.assets[0]!.slug).toBe("period_idol");
        } finally {
            mock.module("../src/services/api/tools", () => ({ ...mod, listTools: original }));
            mock.restore();
        }
    });

    test("★ 服务端不可达 → degraded=true + 用 legacy 兜底 + 提示文案", async () => {
        const result = await loadStyleAssets({ localFallback: [LEGACY_STYLE_PRESET] });
        expect(result.degraded).toBe(true);
        expect(result.assets.length).toBe(1);
        expect(result.assets[0]!.origin).toBe("local-fallback");
        expect(result.degradedReason).toBeTruthy();
    });

    test("★ 降级提示文案明确「离线」且带条数", () => {
        const text = degradedNoticeText({
            assets: [registryAssetFromLegacyStylePreset(LEGACY_STYLE_PRESET)],
            degraded: true,
            degradedReason: "服务端不可达",
        });
        expect(text).toContain("离线");
        expect(text).toContain("1 项");
    });

    test("非降级态无提示文案（不打扰正常态）", () => {
        expect(degradedNoticeText({ assets: [], degraded: false })).toBeUndefined();
    });

    test("无本地兜底时降级返回空清单（不编造数据）", async () => {
        const result = await loadStyleAssets({ localFallback: [] });
        expect(result.degraded).toBe(true);
        expect(result.assets).toEqual([]);
    });

    test("取消请求不触发降级（保留取消语义）", async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(loadStyleAssets({ localFallback: [LEGACY_STYLE_PRESET], signal: controller.signal })).rejects.toBeDefined();
    });
});

describe("跨片：视频域窗口标注对两条源一致生效", () => {
    test("motion 资产在窗口未开时对用户不可见（服务端源）", () => {
        const motion = registryAssetFromToolSummary({ ...SERVER_STYLE_TOOL, type: "motion" })!;
        expect(isAssetVisibleToUser(motion)).toBe(false);
        expect(isAssetVisibleToUser(motion, { videoLineEnabled: true })).toBe(true);
    });

    test("style 资产不受窗口标注影响", () => {
        const style = registryAssetFromToolSummary(SERVER_STYLE_TOOL)!;
        expect(isAssetVisibleToUser(style)).toBe(true);
    });
});

describe("跨片：AssetKind 标签与落枚举纪律", () => {
    test("本枝实际用到的 kind 都有中文标签", () => {
        for (const kind of PRESET_ASSET_KINDS) {
            expect(ASSET_KIND_LABELS[kind]).toBeTruthy();
        }
    });

    test("留槽值无标签（未进枚举，防「定义了但没人用」）", () => {
        expect(ASSET_KIND_LABELS["asset/audio"]).toBeUndefined();
        expect(ASSET_KIND_LABELS["model/checkpoint"]).toBeUndefined();
    });
});

describe("片 2 全链：legacy 预设提取为可索引数据源", () => {
    test("★ 18 条 legacy 预设可从 lib 导入（不再困在页面组件里）", async () => {
        const { LEGACY_CANVAS_STYLE_PRESETS } = await import("../src/lib/canvas/legacy-style-presets");
        expect(LEGACY_CANVAS_STYLE_PRESETS.length).toBe(18);
    });

    test("★ 18 条全部可适配为统一 schema（逐条验证，非抽样）", async () => {
        const { LEGACY_CANVAS_STYLE_PRESETS } = await import("../src/lib/canvas/legacy-style-presets");
        const assets = LEGACY_CANVAS_STYLE_PRESETS.map(registryAssetFromLegacyStylePreset);
        expect(assets.length).toBe(18);
        for (const asset of assets) {
            expect(asset.assetKind).toBe("preset/style");
            expect(asset.origin).toBe("local-fallback");
            expect(asset.slug).toBeTruthy();
            expect(asset.title).toBeTruthy();
            expect(asset.group).toBeTruthy();
            expect(asset.prompt.length).toBeGreaterThan(0);
        }
    });

    test("★ 适配后 slug 无重复（防收编撞车）", async () => {
        const { LEGACY_CANVAS_STYLE_PRESETS } = await import("../src/lib/canvas/legacy-style-presets");
        const slugs = LEGACY_CANVAS_STYLE_PRESETS.map((preset) => preset.id);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    test("★ 视频域窗口标注：18 条 style 全部对用户可见", async () => {
        const { LEGACY_CANVAS_STYLE_PRESETS } = await import("../src/lib/canvas/legacy-style-presets");
        const assets = LEGACY_CANVAS_STYLE_PRESETS.map(registryAssetFromLegacyStylePreset);
        expect(assets.every((asset) => isAssetVisibleToUser(asset))).toBe(true);
    });
});
