import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { CanvasImageSettingsPopover, imageSettingsPresetView } from "../src/components/canvas/canvas-image-settings-popover";
import { ImageSettingsPanel, QUALITY_TIER_INFO_LINES, aspectBadgeInfoCard, ecomPresetInfoCard } from "../src/components/image-settings-panel";
import { ToolHoverCardMiniContent } from "../src/components/ui/tool-hover-card";
import { canvasThemes } from "../src/lib/canvas-theme";
import { defaultImageCapabilityConfig, defaultModelCapabilityConfig, type ImageCapabilityConfig } from "../src/lib/model-capabilities";
import { ECOM_CHANNEL_PRESETS } from "../src/lib/image-size-presets";
import { defaultConfig, type AiConfig, type ModelChannel } from "../src/stores/use-config-store";

function agnesProfile(): ImageCapabilityConfig {
    const profile = defaultImageCapabilityConfig(undefined, "agnes");
    profile.quality = { supported: false, values: [], default: "auto" };
    profile.size = {
        parameter: "size",
        values: ["1024x1024", "2048x2048", "2880x2880", "1024x1360", "1728x2304", "2448x3264", "1024x1824", "1536x2752", "2160x3840"],
        default: "1024x1024",
        allowCustom: false,
    };
    return profile;
}

function grokProfile(): ImageCapabilityConfig {
    return defaultImageCapabilityConfig("grok-image", "grok-imagine-image-2.0");
}

function cappedProfile(): ImageCapabilityConfig {
    const profile = defaultImageCapabilityConfig(undefined, "gpt-image-2");
    profile.quality = { supported: true, values: ["auto", "low", "medium", "high"], default: "medium" };
    profile.size = { parameter: "size", values: ["1024x1024", "1024x1360", "1024x1824"], default: "1024x1024", allowCustom: false };
    return profile;
}

function aiConfig(entries: Array<{ model: string; profile: ImageCapabilityConfig }>): AiConfig {
    const channel: ModelChannel = {
        id: "relay",
        name: "中转渠道",
        baseUrl: "https://api.example.com",
        apiKey: "test-key",
        apiFormat: "openai",
        models: entries.map((entry) => entry.model),
        modelCosts: entries.map((entry) => {
            const capabilityConfig = defaultModelCapabilityConfig(undefined, entry.model);
            capabilityConfig.image = entry.profile;
            return { model: entry.model, capability: "image" as const, billingMode: "fixed_request" as const, unitPriceMicrocredits: 1, capabilityConfig };
        }),
    };
    const models = entries.map((entry) => `relay::${entry.model}`);
    return { ...defaultConfig, channels: [channel], models, imageModels: models, model: models[0] };
}

describe("药丸预设态（imageSettingsPresetView 派生）", () => {
    test("full：命中目标档时返回预设态与档位标签", () => {
        const config = { ...aiConfig([{ model: "agnes-image-2.5-flash", profile: agnesProfile() }]), size: "2880x2880" };
        const view = imageSettingsPresetView(config);
        expect(view?.preset.id).toBe("amazon-main");
        expect(view?.tierLabel).toBe("4K");
        expect(view?.plan.status).toBe("full");
    });

    test("capped：模型上限低于目标档时仍显示实际生效档", () => {
        const config = { ...aiConfig([{ model: "grok-imagine-image-2.0", profile: grokProfile() }]), size: "1:1", quality: "2k" };
        const view = imageSettingsPresetView(config);
        expect(view?.preset.id).toBe("amazon-main");
        expect(view?.tierLabel).toBe("2K");
        expect(view?.plan.status).toBe("capped");
    });

    test("short：不达标态同样进入预设态（药丸显示实际档）", () => {
        const config = { ...aiConfig([{ model: "gpt-image-2", profile: cappedProfile() }]), size: "1024x1024", quality: "medium" };
        const view = imageSettingsPresetView(config);
        expect(view?.preset.id).toBe("amazon-main");
        expect(view?.plan.status).toBe("short");
    });

    test("值不命中 / quality 不命中 / 能力未知 → 非预设态", () => {
        const grok = aiConfig([{ model: "grok-imagine-image-2.0", profile: grokProfile() }]);
        expect(imageSettingsPresetView({ ...grok, size: "16:9", quality: "2k" })).toBeNull();
        expect(imageSettingsPresetView({ ...grok, size: "1:1", quality: "1k" })).toBeNull();
        const unknown = aiConfig([{ model: "gpt-image-2", profile: { ...cappedProfile(), size: { parameter: "size", values: [], default: "auto", allowCustom: false } } }]);
        expect(imageSettingsPresetView({ ...unknown, size: "1:1", quality: "auto" })).toBeNull();
    });
});

describe("面板预设行 / 角标 / 档位行（SSR）", () => {
    const config = { ...aiConfig([{ model: "grok-imagine-image-2.0", profile: grokProfile() }]), size: "1:1", quality: "2k" };
    const html = renderToStaticMarkup(
        <ImageSettingsPanel
            config={config}
            onConfigChange={() => {}}
            theme={canvasThemes.dark}
            showTitle={false}
            ecomPresets={{
                presets: ECOM_CHANNEL_PRESETS,
                activeId: "amazon-main",
                banner: "当前模型上限 2K，已满足 ≥1600×1600px",
                suggestions: [{ id: "relay::agnes-image-2.5-flash", label: "Agnes 2.5 Flash" }],
                onApply: () => {},
                onClear: () => {},
                onSelectModel: () => {},
            }}
            qualityTierControl={{ value: "flagship", onChange: () => {} }}
            aspectBadges={{
                "1:1": [{ label: "Amazon 主图", pixelRequirement: "1600×1600" }],
                "3:4": [{ label: "详情长图", pixelRequirement: "1440×1920" }],
                "9:16": [{ label: "抖音竖版", pixelRequirement: "1080×1920" }],
            }}
        />,
    );

    test("预设行：标题 / 三预设 / 恢复默认 / 状态说明 / 徽标 / 建议", () => {
        expect(html).toContain("电商场景");
        expect(html).toContain("Amazon 主图");
        expect(html).toContain("详情长图");
        expect(html).toContain("抖音竖版");
        expect(html).toContain("恢复默认");
        expect(html).not.toContain("已应用：白底主图"); // O-03 polish：常驻行收入 hover 小卡，不占面板高度
        expect(html).toContain("查看已应用预设说明：Amazon 主图");
        expect(html).toContain("当前模型上限 2K，已满足 ≥1600×1600px");
        expect(html).toContain("建议换用：");
        expect(html).toContain("Agnes 2.5 Flash");
        expect(html).toMatch(/aria-pressed="true"[^>]*><span title="白底主图，品牌\/文字向">Amazon 主图/);
    });

    test("比例角标：带预设的 aspect 出现小圆点 + 释义接线（hover 小卡数据）", () => {
        expect(html).toContain('data-canvas-aspect-badges="Amazon 主图"');
        expect(html).toContain('data-canvas-aspect-badges="详情长图"');
        expect(html).toContain('data-canvas-aspect-badges="抖音竖版"');
        expect(html).not.toContain("电商预设：Amazon 主图");
    });

    test("默认画质行：三档 + 说明收入 hover 小卡 + 当前档选中", () => {
        expect(html).toContain("默认画质");
        expect(html).toContain("经济");
        expect(html).toContain("旗舰");
        expect(html).toContain("查看默认画质说明");
        expect(html).not.toContain("新节点与切换模型时按此档吸附");
        expect(html).toMatch(/aria-pressed="true"[^>]*>旗舰/);
    });

    test("不传槽位 → 面板零变化（不含 O-03 元素）", () => {
        const plain = renderToStaticMarkup(<ImageSettingsPanel config={config} onConfigChange={() => {}} theme={canvasThemes.dark} showTitle={false} />);
        expect(plain).not.toContain("电商场景");
        expect(plain).not.toContain("默认画质");
    });
});

describe("O-03 polish · 说明行收入 hover 小卡（mini 变体）", () => {
    test("说明卡构造：已应用 / 默认画质 / 角标释义（预设名 + 最低像素）", () => {
        const amazon = ECOM_CHANNEL_PRESETS.find((preset) => preset.id === "amazon-main")!;
        const applied = ecomPresetInfoCard(amazon);
        expect(applied.title).toBe("已应用：Amazon 主图");
        expect(applied.lines).toEqual([amazon.hint]);
        const appliedMarkup = renderToStaticMarkup(<ToolHoverCardMiniContent title={applied.title} lines={applied.lines} />);
        expect(appliedMarkup).toContain('role="tooltip"');
        expect(appliedMarkup).toContain("tool-hover-card-mini");
        expect(appliedMarkup).toContain("已应用：Amazon 主图");
        expect(appliedMarkup).toContain("白底主图，品牌/文字向");

        const qualityMarkup = renderToStaticMarkup(<ToolHoverCardMiniContent title="默认画质" lines={QUALITY_TIER_INFO_LINES} />);
        expect(qualityMarkup).toContain("新节点与切换模型时按此档吸附；模型不支持时自动回退。");

        const badges = aspectBadgeInfoCard([
            { label: "Amazon 主图", pixelRequirement: "1600×1600" },
            { label: "详情长图", pixelRequirement: "1440×1920" },
        ]);
        expect(badges.title).toBe("电商预设");
        const badgeMarkup = renderToStaticMarkup(<ToolHoverCardMiniContent title={badges.title} lines={badges.lines} />);
        expect(badgeMarkup).toContain("Amazon 主图（≥1600×1600px）");
        expect(badgeMarkup).toContain("详情长图（≥1440×1920px）");
    });

    test("静态护栏：角标按钮 hover 接线 + mini CSS 高于设置浮层", () => {
        const panelSource = readFileSync(resolve(import.meta.dir, "../src/components/image-settings-panel.tsx"), "utf8");
        expect(panelSource).toContain("aspectBadgeHover.setAnchor");
        expect(panelSource).toContain("useToolInfoCard");
        expect(panelSource).toContain("export type ImageSettingsAspectBadge");
        const css = readFileSync(resolve(import.meta.dir, "../src/components/ui/tool-hover-card.css"), "utf8");
        expect(css).toContain("z-index: var(--tool-hover-card-mini-z, 1150)");
    });
});

describe("药丸预设态与取消（popover SSR）", () => {
    test("命中预设：药丸显示 比例 · 实际档 + 渠道小标 + 取消按钮", () => {
        const config = { ...aiConfig([{ model: "grok-imagine-image-2.0", profile: grokProfile() }]), size: "1:1", quality: "2k" };
        const html = renderToStaticMarkup(<CanvasImageSettingsPopover config={config} onConfigChange={() => {}} />);
        expect(html).toMatch(/1:1[^<]*·[^<]*2K|1:1.*?2K/s);
        expect(html).toContain("Amazon");
        expect(html).toContain("取消电商预设");
        expect(html).toContain("图像设置：1:1 · 2K（Amazon 主图）");
    });

    test("未命中预设：药丸保持摘要形态，无取消按钮", () => {
        const config = { ...aiConfig([{ model: "grok-imagine-image-2.0", profile: grokProfile() }]), size: "16:9", quality: "2k" };
        const html = renderToStaticMarkup(<CanvasImageSettingsPopover config={config} onConfigChange={() => {}} />);
        expect(html).not.toContain("取消电商预设");
        expect(html).toContain("图像设置：");
    });
});

describe("静态护栏：接线与取消语义", () => {
    test("popover：取消语义（size→auto + quality 回模型默认档）与档位写入 store", () => {
        const source = readFileSync(resolve(import.meta.dir, "../src/components/canvas/canvas-image-settings-popover.tsx"), "utf8");
        expect(source).toContain("canvas-composer-preset-clear");
        expect(source).toContain("onConfigChange(\"size\", \"auto\")");
        expect(source).toContain("mergedProfile.quality.default || \"auto\"");
        expect(source).toContain("rememberImageQualityTier");
        expect(source).toContain("plan.status !== \"unconstrained\" && plan.quality");
    });

    test("node prompt panel：换模型建议接线到默认参数重置", () => {
        const source = readFileSync(resolve(import.meta.dir, "../src/components/canvas/canvas-node-prompt-panel.tsx"), "utf8");
        expect(source).toContain("onSelectModel={(model) => onConfigChange(node.id, { model, ...defaultImageParamsForModel(config, model) })}");
    });

    test("面板槽位类型导出（批量/审批/蒙版不传即零变化）", () => {
        const source = readFileSync(resolve(import.meta.dir, "../src/components/image-settings-panel.tsx"), "utf8");
        expect(source).toContain("export type ImageSettingsEcomPresetSlot");
        expect(source).toContain("export type ImageSettingsQualityTierSlot");
    });
});
