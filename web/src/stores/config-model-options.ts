// 渠道模型选项的编码、解析与展示：channelId + 模型名组合成选择值，按能力过滤可选模型。

import { type AiConfig, type ModelChannel, resolveModelChannel } from "./use-config-store";

export const CHANNEL_MODEL_SEPARATOR = "::";

export function uniqueModelOptions(models: string[]) {
    return Array.from(
        new Set(
            (models || [])
                .filter((model): model is string => typeof model === "string")
                .map((model) => model.trim())
                .filter(Boolean),
        ),
    );
}

export function normalizeRawModelName(value: unknown) {
    if (typeof value !== "string") return "";
    const model = modelOptionName(value).trim();
    return model && model !== "undefined" && model !== "null" ? model : "";
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function modelDisplayName(config: AiConfig, value: string) {
    const model = modelOptionName(value);
    const channel = resolveModelChannel(config, value);
    const displayName = channel.modelCosts?.find((item) => item.model === model)?.displayName?.trim();
    if (displayName) return displayName;
    return channel.scope === "system" ? "系统模型" : model;
}

export function modelIcon(config: AiConfig, value: string) {
    const model = modelOptionName(value);
    return resolveModelChannel(config, value).modelCosts?.find((item) => item.model === model)?.icon || "";
}

export function modelOptionLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (!decoded) return modelDisplayName(config, value);
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    const displayName = modelDisplayName(config, value);
    // 平台前台模型只展示公开名称；供应来源和内部目录适配器不属于创作端信息。
    if (!channel || channel.scope === "system") return displayName;
    return `${displayName}（${channel.name}）`;
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(
        channels.flatMap((channel) =>
            channel.models
                .map(normalizeRawModelName)
                .filter(Boolean)
                .filter((model) => channel.scope !== "system" || hasSystemModelPrice(channel, model))
                .map((model) => encodeChannelModel(channel.id, model)),
        ),
    );
}

export function hasSystemModelPrice(channel: ModelChannel, model: string) {
    if (channel.scope !== "system") return true;
    // 价格字段已由后端按“非负数”校验；0 表示免费模型，不能在目录重建时被过滤。
    const configured = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0;
    return (
        channel.modelCosts?.some((item) => {
            if (item.model !== model) return false;
            const tiers = item.logicalPriceTiers || [];
            if (tiers.length) {
                return tiers.some((tier) => (tier.billingMode === "token" ? [tier.inputTokenPriceMicrocredits, tier.outputTokenPriceMicrocredits, tier.cachedTokenPriceMicrocredits].every(configured) : configured(tier.unitPriceMicrocredits)));
            }
            if (item.billingMode === "token") {
                return [item.inputTokenPriceMicrocredits, item.outputTokenPriceMicrocredits, item.cachedTokenPriceMicrocredits].every(configured);
            }
            return configured(item.unitPriceMicrocredits);
        }) === true
    );
}

export function normalizeModelOptionValue(value: unknown, channels: ModelChannel[]) {
    const model = typeof value === "string" ? value.trim() : "";
    if (!normalizeRawModelName(model)) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        const resolved = channel?.modelAliases?.[decoded.model] || decoded.model;
        return channel && channel.models.includes(resolved) ? encodeChannelModel(channel.id, resolved) : "";
    }
    const channel = channels.find((item) => item.models.includes(model) || Boolean(item.modelAliases?.[model])) || channels[0];
    const resolved = channel?.modelAliases?.[model] || model;
    return channel && channel.models.includes(resolved) ? encodeChannelModel(channel.id, resolved) : "";
}

// 模型家族聚类: 从模型显示名提取产商/家族词(flora Providers 分组的数据诚实版——
// 平台目录不透出渠道内部名, 家族词取自模型名自身, 无映射的回落"其他模型")。
// fork 增量（7888b5f2 S08 纠正批）：上游拆分本文件时未包含此函数，model-picker 的
// T-row 家族分组依赖它，故在此落位并随本文件再导出。
export function logicalModelFamilyOf(config: AiConfig, model: string): string {
    const name = (modelDisplayName(config, model) || modelOptionName(model)).toLowerCase();
    const families: Array<[string, string]> = [
        ["grok", "Grok"],
        ["nano banana", "Nano Banana"],
        ["nanobanana", "Nano Banana"],
        ["imagen", "Imagen"],
        ["gemini", "Gemini"],
        ["gpt", "GPT Image"],
        ["dall", "DALL·E"],
        ["seedream", "Seedream"],
        ["seedance", "Seedance"],
        ["jimeng", "即梦"],
        ["veo", "Veo"],
        ["claude", "Claude"],
        ["deepseek", "DeepSeek"],
        ["qwen", "Qwen"],
        ["kimi", "Kimi"],
        ["flux", "FLUX"],
        ["sora", "Sora"],
        ["wan", "Wan"],
        ["agnes", "Agnes"],
        ["tts", "TTS"],
        ["whisper", "Whisper"],
    ];
    for (const [needle, label] of families) {
        if (name.includes(needle)) return label;
    }
    return "其他模型";
}
