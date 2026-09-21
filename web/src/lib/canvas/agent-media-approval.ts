import type { AgentMediaSettings } from "@/services/api/agent";
import { logicalModelIDForConfig, modelOptionName, resolveModelChannel, selectableModelsByCapability, type AiConfig } from "@/stores/use-config-store";

export type AgentImageApproval = AgentMediaSettings & { prompt: string; referenceNodeIds: string[]; outpaintRatio: string };

export function agentImageApproval(detail: Record<string, unknown>): AgentImageApproval | null {
    const call = detail.call as { function?: { name?: string; arguments?: unknown } } | undefined;
    if ((call?.function?.name || detail.toolName) !== "generate_media") return null;
    const raw = call?.function?.arguments ?? detail.arguments;
    try {
        const args = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!args || args.mode !== "image" || typeof args.size !== "string" || typeof args.prompt !== "string") return null;
        return {
            logicalModelId: typeof args.logicalModelId === "string" ? args.logicalModelId : "",
            channelId: typeof args.channelId === "string" ? args.channelId : "",
            channelModelKey: typeof args.channelModelKey === "string" ? args.channelModelKey : "",
            size: args.size,
            quality: typeof args.quality === "string" ? args.quality : "",
            prompt: args.prompt,
            referenceNodeIds: Array.isArray(args.referenceNodeIds) ? args.referenceNodeIds.filter((id: unknown): id is string => typeof id === "string") : [],
            outpaintRatio: typeof args.outpaintRatio === "string" ? args.outpaintRatio : "",
        };
    } catch {
        return null;
    }
}

// 规格行回退：扩图走比例档时 size 为空（提交时由服务端按比例解出画幅），
// 卡片此前显示为空的「本次规格：· auto」。有比例就显示比例，两者都空才回退「默认」（取模型默认规格）。
export function agentApprovalSpecLabel(settings: AgentMediaSettings, approval: AgentImageApproval): string {
    return settings.size || approval.outpaintRatio || "默认";
}

export function agentApprovalModel(config: AiConfig, settings: AgentMediaSettings): string {
    return selectableModelsByCapability(config, "image").find((model) => {
        if (settings.logicalModelId) return logicalModelIDForConfig({ ...config, model }) === settings.logicalModelId;
        return resolveModelChannel(config, model).id === settings.channelId && modelOptionName(model) === settings.channelModelKey;
    }) || "";
}

export function agentApprovalMatchesSettings(argumentsValue: unknown, settings: AgentMediaSettings): boolean {
    const approved = agentImageApproval({ toolName: "generate_media", arguments: argumentsValue });
    return Boolean(approved && (["logicalModelId", "channelId", "channelModelKey", "size", "quality"] as const).every((key) => (approved[key] || "") === (settings[key] || "")));
}

export function agentApprovalModelSelection(config: AiConfig, model: string): Pick<AgentMediaSettings, "logicalModelId" | "channelId" | "channelModelKey"> {
    const logicalModelId = logicalModelIDForConfig({ ...config, model });
    if (logicalModelId) return { logicalModelId };
    const channel = resolveModelChannel(config, model);
    if (channel.scope !== "system") throw new Error("Agent 生成仅支持平台模型");
    return { channelId: channel.id, channelModelKey: modelOptionName(model) };
}
