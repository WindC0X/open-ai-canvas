/**
 * 注册表命名空间守卫 —— 架构方案 §4.3 L1 静态断言。
 *
 * ★ 为什么需要：能力层 id（`image.superResolve`）与按钮层 id（`superResolve`）
 * 分属两个命名空间，靠「含点/不含点」的形态差异隔离。这是**约定**——
 * 约定没有守卫就会被无意破坏（本仓同类前科：upscale/superResolve 命名分流
 * 曾被 HUD 按钮标签违反）。本测试把约定升级为机器护栏。
 *
 * 三条断言（架构方案 §4.3）：
 * ① 能力层 id 必须含点（强制 `域.动作` 形态）
 * ② 工具层 id 必须不含点（防误引入）
 * ③ 两集合零交集（保险）
 *
 * 附：入口登记校验（§1.4 待建字段）—— 能力条目声明的每个 entryPoints.target
 * 必须在按钮层真实存在（这是「手工接线只有注释约定」缺口的机器化收口）。
 */

import { describe, expect, test } from "bun:test";

import { imageToolDefinitions } from "../src/components/canvas/canvas-image-toolbar-tools";
import { CAPABILITY_ENTRIES } from "../src/lib/canvas/capability-entries";
import { assetKindFromToolType, isAssetVisibleToUser, PRESET_ASSET_KINDS, type RegistryAsset } from "../src/lib/canvas/registry-asset";
import { mainToolbarTools } from "../src/lib/canvas/tool-registry/definitions/main-toolbar-tools";
import { nodeHoverToolbarTools } from "../src/lib/canvas/tool-registry/definitions/node-hover-tools";
import { selectionToolbarTools } from "../src/lib/canvas/tool-registry/definitions/selection-toolbar-tools";

/**
 * 全部按钮层工具定义。
 *
 * ★ 为什么含 imageToolDefinitions：能力条目 O-03 的 superResolve 入口在**手工接线层**
 * （canvas-image-toolbar-tools.tsx），不在 tool-registry 的 4 个定义文件里 ——
 * 这正是架构方案 §1.4 记录的缺口（「能力条目与按钮层只有注释层面的约定」）。
 * 守卫必须覆盖两个层才能校验 entryPoints.target 真实存在。
 */
const ALL_TOOL_DEFINITIONS = [...mainToolbarTools, ...nodeHoverToolbarTools, ...selectionToolbarTools, ...imageToolDefinitions];

const CAPABILITY_IDS = CAPABILITY_ENTRIES.map((entry) => entry.id);
const TOOL_IDS = ALL_TOOL_DEFINITIONS.map((tool) => tool.id);

describe("注册表命名空间——能力层与按钮层隔离", () => {
    test("能力层 id 全部含点（域.动作 形态）", () => {
        expect(CAPABILITY_IDS.length).toBeGreaterThan(0);
        for (const id of CAPABILITY_IDS) {
            expect(id).toContain(".");
            // 域.动作 两段，且动作是 camelCase（首字母小写）
            const [domain, action] = id.split(".");
            expect(domain).toMatch(/^[a-z]+$/);
            expect(action).toMatch(/^[a-z][A-Za-z0-9]*$/);
        }
    });

    test("工具层 id 全部不含点", () => {
        expect(TOOL_IDS.length).toBeGreaterThan(0);
        for (const id of TOOL_IDS) {
            expect(id).not.toContain(".");
        }
    });

    test("两集合零交集", () => {
        const capabilitySet = new Set(CAPABILITY_IDS);
        const overlap = TOOL_IDS.filter((id) => capabilitySet.has(id));
        expect(overlap).toEqual([]);
    });

    test("工具层内部无重复 id", () => {
        const seen = new Set<string>();
        const duplicates: string[] = [];
        for (const id of TOOL_IDS) {
            if (seen.has(id)) duplicates.push(id);
            seen.add(id);
        }
        expect(duplicates).toEqual([]);
    });
});

describe("注册表命名空间——入口登记校验（§1.4 待建字段）", () => {
    test("每个能力条目的 entryPoints.target 在按钮层真实存在", () => {
        const toolIdSet = new Set(TOOL_IDS);
        for (const entry of CAPABILITY_ENTRIES) {
            expect(entry.entryPoints.length).toBeGreaterThan(0);
            for (const point of entry.entryPoints) {
                if (point.kind === "node-toolbar" || point.kind === "selection-toolbar" || point.kind === "main-toolbar") {
                    expect(toolIdSet.has(point.target)).toBe(true);
                }
            }
        }
    });

    test("每个能力条目有 registryVersion 版本锚点", () => {
        for (const entry of CAPABILITY_ENTRIES) {
            expect(Number.isInteger(entry.registryVersion)).toBe(true);
            expect(entry.registryVersion).toBeGreaterThan(0);
        }
    });

    // 2026-10-04 控制线追加：requiredOperations 声明计价操作。
    // 为什么必须声明：计价按 operation 匹配价格档，渠道无精确档时**静默落通配档**
    // （step 0 探针实测：无 image_upscale 档时落 T_DEFAULT，价 100 而非 777，不报错）。
    // 声明后门控层可据此过滤渠道（本批只做声明侧）。
    test("每个能力条目声明 requiredOperations（可为空数组，不得缺字段）", () => {
        for (const entry of CAPABILITY_ENTRIES) {
            expect(Array.isArray(entry.executionChain.requiredOperations)).toBe(true);
            for (const operation of entry.executionChain.requiredOperations) {
                expect(typeof operation).toBe("string");
                expect(operation.trim()).not.toBe("");
            }
        }
    });

    test("超分条目声明 image_upscale（与其计费链一致）", () => {
        const superResolve = CAPABILITY_ENTRIES.find((entry) => entry.id === "image.superResolve");
        expect(superResolve).toBeDefined();
        expect(superResolve?.executionChain.requiredOperations).toEqual(["image_upscale"]);
    });
});

describe("注册表资产层——AssetKind 与落枚举纪律", () => {
    test("AssetKind 落枚举：留槽值不进枚举（防「定义了但没人用」）", () => {
        // 架构方案 §2.1 落枚举纪律：asset/audio 与 model/checkpoint 是纯留槽，
        // 无消费者前不进枚举。本测试是该纪律的机器护栏 —— 若有人把留槽值加进
        // AssetKind 联合类型，PRESET_ASSET_KINDS 之外的消费会暴露。
        const kindsInUse = new Set<string>(PRESET_ASSET_KINDS);
        expect(kindsInUse.has("preset/style")).toBe(true);
        // 留槽值不应出现在实际使用的 kind 清单里
        expect(kindsInUse.has("asset/audio")).toBe(false);
        expect(kindsInUse.has("model/checkpoint")).toBe(false);
    });

    test("服务端 toolType 派生 assetKind", () => {
        expect(assetKindFromToolType("style")).toBe("preset/style");
        expect(assetKindFromToolType("motion")).toBe("preset/motion");
        expect(assetKindFromToolType("nine_grid")).toBe("template/canvas");
        // 未知类型返回 undefined（不静默归错类）
        expect(assetKindFromToolType("effect")).toBeUndefined();
        expect(assetKindFromToolType("")).toBeUndefined();
    });
});

describe("注册表资产层——视频域窗口标注（§6.2 正式口径）", () => {
    const motionAsset: RegistryAsset = {
        assetId: 46,
        assetKind: "preset/motion",
        slug: "static_shot",
        title: "固定镜头",
        group: "basic",
        prompt: "static shot",
        origin: "server",
    };
    const styleAsset: RegistryAsset = {
        assetId: 1,
        assetKind: "preset/style",
        slug: "period_idol",
        title: "古装偶像",
        group: "period",
        prompt: "period idol style",
        origin: "server",
    };

    test("motion 默认对用户不可见（视频线窗口未开）", () => {
        expect(isAssetVisibleToUser(motionAsset)).toBe(false);
        expect(isAssetVisibleToUser(motionAsset, { videoLineEnabled: false })).toBe(false);
    });

    test("motion 在视频线开启后可见", () => {
        expect(isAssetVisibleToUser(motionAsset, { videoLineEnabled: true })).toBe(true);
    });

    test("非 motion 资产不受视频线窗口影响", () => {
        expect(isAssetVisibleToUser(styleAsset)).toBe(true);
        expect(isAssetVisibleToUser(styleAsset, { videoLineEnabled: false })).toBe(true);
    });

    test("enabled=false 的资产对用户不可见（优先于窗口标注）", () => {
        expect(isAssetVisibleToUser({ ...styleAsset, enabled: false })).toBe(false);
        expect(isAssetVisibleToUser({ ...motionAsset, enabled: false }, { videoLineEnabled: true })).toBe(false);
    });
});
