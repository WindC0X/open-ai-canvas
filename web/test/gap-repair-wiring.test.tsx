import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CreationFeaturedWorks, featuredWorkAssets } from "../src/pages/create/creation-workspace-empty";
import { creationFeaturedWorks, inspirationSource } from "../src/pages/create/creation-inspirations";
import { registryAssetFromCreationInspiration } from "../src/lib/canvas/registry-adapters";

/**
 * 缝隙池批（片 6）—— ★ 接线级断言。
 *
 * 控制线纪律（2026-10-04 采纳）：含跨组件契约的批次，测试面必须含**提交体/返回值
 * 的结构断言** —— 纯函数测试全绿 ≠ 接线可用。本文件断言：
 *   ① 页面消费的确实是**适配器产出**（结构等价于适配器逐条产出，而非原始数组形状）
 *   ② SSR 渲染的实际 HTML 含正确许可证标注（8 条 CC0 不得误标「原创提示词」）
 *   ③ 8 条外部来源条目带 §3.4 结构化 source；不注入描述符时不附（反例）
 */

describe("★ 片 6 接线：页面消费适配器产出（结构断言）", () => {
    test("★ featuredWorkAssets 是适配器产出的 RegistryAsset 列表（非原始数组形状）", () => {
        expect(featuredWorkAssets).toHaveLength(creationFeaturedWorks.length);

        // 逐条结构等价于适配器直调结果 —— 证明页面确实走了适配器
        featuredWorkAssets.forEach((asset, index) => {
            const expected = registryAssetFromCreationInspiration(
                creationFeaturedWorks[index],
                index,
                creationFeaturedWorks[index].source ? inspirationSource : undefined,
            );
            expect(asset).toEqual(expected);
        });
    });

    test("★ 资产形态是 spec/generation（不是原始灵感卡形状）", () => {
        for (const asset of featuredWorkAssets) {
            expect(asset.assetKind).toBe("spec/generation");
            expect(asset.origin).toBe("local-fallback");
            // 原始形状没有这些字段 —— 证明消费面已换到统一 schema
            expect(asset.slug).toMatch(/^creation-/);
            expect(asset.assetId).toBe(asset.slug);
        }
    });

    test("★ 8 条带 source / 14 条不带（许可证标注不得漏）", () => {
        const withSource = featuredWorkAssets.filter((asset) => asset.source);
        expect(withSource).toHaveLength(8);
        expect(featuredWorkAssets.filter((asset) => !asset.source)).toHaveLength(14);
        for (const asset of withSource) {
            expect(asset.source?.license).toBe("CC0-1.0");
            expect(asset.source?.repository).toContain("awesome-chatgpt-prompts");
            expect(asset.source?.revision).toMatch(/^[0-9a-f]{40}$/);
        }
    });
});

describe("★ 片 6 接线：SSR 渲染断言（UI 逐字不变 + 许可证标注正确）", () => {
    const html = renderToStaticMarkup(<CreationFeaturedWorks onStartPrompt={() => {}} />);

    test("★ 首屏 12 张卡片中，CC0 与原创标注数量正确（修复前误标会露馅）", () => {
        // 默认 limit=12，按数组顺序前 12 条：5 条 CC0 改编（索引 5-11 中的 5-7 + ...）
        // 精确口径：断言总数而非硬编码分布 —— 数量对不上即说明判据错了
        const cc0Count = (html.match(/开源改编 · CC0/g) || []).length;
        const originalCount = (html.match(/原创提示词/g) || []).length;
        expect(cc0Count).toBeGreaterThan(0);
        expect(originalCount).toBeGreaterThan(0);
        expect(cc0Count + originalCount).toBe(12); // 首屏 12 张，每张恰一个标注
    });

    test("★ 卡片内容逐字保留（标题/描述/封面/模式标签）", () => {
        expect(html).toContain("精选灵感");
        expect(html).toContain("22 个创意起点 · 点击填入提示词，不自动生成");
        expect(html).toContain("雨夜霓虹 · 电影感开场");
        expect(html).toContain("宽银幕构图、环境反光与缓慢推进镜头");
        expect(html).toContain("/short-drama-styles/cyberpunk-neon.jpg");
        expect(html).toContain("全部灵感");
        expect(html).toContain("使用这个创意");
        // 来源声明页脚仍在（仓库级展示，与单条 source 不冲突）
        expect(html).toContain("模板与封面来源");
        expect(html).toContain("awesome-chatgpt-prompts · CC0");
    });

    test("★ 过滤器计数来自适配器产出（22 / 三 mode 计数与数据一致）", () => {
        for (const mode of ["video", "image", "text"] as const) {
            const count = creationFeaturedWorks.filter((item) => item.mode === mode).length;
            expect(featuredWorkAssets.filter((asset) => asset.group === mode)).toHaveLength(count);
        }
        // 页脚「已展示全部 22 个创意」只在展开后出现，首屏断言过滤器上的数字
        const totalFromData = creationFeaturedWorks.length;
        expect(html).toContain(String(totalFromData)); // "22" 出现在标题区
    });
});

describe("★ 片 6 接线：反例锚点（缺陷回归）", () => {
    test("★ 修复前缺陷：不附 source 时 8 条 CC0 会被渲染为「原创提示词」", () => {
        // 反例构造：模拟修复前路径（适配器不附 source）
        const withoutSourceFix = creationFeaturedWorks.map((inspiration, index) =>
            registryAssetFromCreationInspiration(inspiration, index),
        );
        const mislabeled = withoutSourceFix.filter(
            (asset) => creationFeaturedWorks[withoutSourceFix.indexOf(asset)].source && !asset.source,
        );
        // 8 条 CC0 全部处于「该有 source 却没有」状态 —— 这正是修复前的缺陷形态
        expect(mislabeled).toHaveLength(8);
        // 而修复后（页面实际路径）：0 条误标
        const mislabeledAfterFix = featuredWorkAssets.filter(
            (asset, index) => creationFeaturedWorks[index].source && !asset.source,
        );
        expect(mislabeledAfterFix).toHaveLength(0);
    });

    test("★ 内部原创条目不得被附上来源（防过度标注）", () => {
        featuredWorkAssets.forEach((asset, index) => {
            if (!creationFeaturedWorks[index].source) {
                expect(asset.source).toBeUndefined();
            }
        });
    });
});
