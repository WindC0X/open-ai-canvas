/**
 * 注册表读取器 —— 统一入口 + 离线降级标注（架构方案 §3.2）。
 *
 * ★ 裁定（架构方案 §3.2）：服务端是唯一真值源；本地 legacy 只作降级兜底。
 * 降级**必须标注**，不得静默 —— 沿用本仓「本地缓存成功 ≠ 服务端已保存」纪律。
 *
 * 本文件是片 1-2 的消费面：调用方拿到 `RegistryAssetListResult`，
 * 据 `degraded` 决定是否渲染「离线预设」提示。
 */

import { registryAssetFromLegacyStylePreset, registryAssetFromSkillPreset, registryAssetsFromToolSummaries } from "./registry-adapters";
import { isAssetVisibleToUser, type RegistryAsset, type RegistryAssetListResult } from "./registry-asset";
import type { CanvasStylePreset } from "./canvas-style-system";
import { listSkillPresets } from "@/services/api/skills";
import { listTools, type ToolSummary } from "@/services/api/tools";

/** 读取风格类资产的输入。 */
export type LoadStyleAssetsInput = {
    /**
     * 本地 legacy 兜底源（片 2 的 18 条）。
     * 服务端不可达时启用 —— 显式传入而非模块内 import，便于测试注入与调用方控制。
     */
    localFallback?: CanvasStylePreset[];
    /** 视频线是否已启动（控制视频域窗口标注，架构方案 §6.2）。 */
    videoLineEnabled?: boolean;
    /** 请求取消信号。 */
    signal?: AbortSignal;
};

/** 每页条数（沿用既有 picker 的分页口径）。 */
const STYLE_PAGE_SIZE = 60;

/**
 * 读取风格资产 —— 服务端优先，失败降级到本地 legacy 并标注。
 *
 * 降级触发条件：网络/服务端错误（含 401 未登录等）。**不降级**的情况：
 * 服务端成功但返回空列表（那是真实空态，不是降级）。
 */
export async function loadStyleAssets(input: LoadStyleAssetsInput = {}): Promise<RegistryAssetListResult> {
    const { localFallback = [], videoLineEnabled = false, signal } = input;

    try {
        const page = await listTools({ page: 1, pageSize: STYLE_PAGE_SIZE, scope: "public", type: "style" }, { signal });
        const assets = registryAssetsFromToolSummaries(page.tools as ToolSummary[]).filter((asset) => isAssetVisibleToUser(asset, { videoLineEnabled }));
        return { assets, degraded: false };
    } catch (error) {
        // 调用方主动取消不算降级 —— 取消是正常控制流，不该触发「离线」提示。
        if (isAbortError(error)) throw error;

        const assets = localFallback.map(registryAssetFromLegacyStylePreset).filter((asset) => isAssetVisibleToUser(asset, { videoLineEnabled }));
        return {
            assets,
            degraded: true,
            degradedReason: describeLoadFailure(error),
        };
    }
}

/** 读取技能场景预设的输入（片 5）。 */
export type LoadSkillPresetAssetsInput = {
    /**
     * 本地降级源（可选）。
     *
     * ★ 片 5 与片 2 的差异：skills presets **无既有前端常量** ——
     * 架构方案 §3.2 禁止「把 fallback 当默认路径」，也禁止为降级**新造**第二份真值。
     * 因此本参数默认缺省：服务端不可达时返回空列表 + degraded 标记（由调用方
     * 决定是否提供本地源），而不是凭空造数据。
     */
    localFallback?: RegistryAsset[];
    /** 请求取消信号。 */
    signal?: AbortSignal;
};

/**
 * 读取技能场景预设资产（片 5）—— 服务端优先，失败按可用降级源处理。
 *
 * 与片 1 同构：`GET /api/skills/presets` 是服务端源。
 * 降级语义：服务端不可达 → degraded=true；有 localFallback 则用之，无则空列表。
 */
export async function loadSkillPresetAssets(input: LoadSkillPresetAssetsInput = {}): Promise<RegistryAssetListResult> {
    const { localFallback, signal } = input;

    try {
        const payload = await listSkillPresets();
        const assets = (payload.presets ?? []).map(registryAssetFromSkillPreset);
        return { assets, degraded: false };
    } catch (error) {
        if (isAbortError(error)) throw error;

        // 无降级源时返回空列表 —— 不造数据（架构方案 §3.2 禁止 fallback 当默认路径）
        const assets = (localFallback ?? []).filter((asset) => asset.origin === "local-fallback");
        return {
            assets,
            degraded: true,
            degradedReason: describeLoadFailure(error),
        };
    }
}

/** 判断是否为取消类错误（AbortSignal 语义，保留取消语义不吞掉）。 */
function isAbortError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const candidate = error as { name?: string; code?: string };
    return candidate.name === "AbortError" || candidate.name === "CanceledError" || candidate.code === "ERR_CANCELED";
}

/** 把失败原因转成用户可读的短句（供降级提示）。 */
function describeLoadFailure(error: unknown): string {
    if (typeof error === "object" && error !== null) {
        const candidate = error as { message?: string; reason?: string };
        if (candidate.reason) return candidate.reason;
        if (candidate.message) return candidate.message;
    }
    return "服务端不可达";
}

/**
 * 降级态的用户可见提示文案（单一真源）。
 *
 * ★ 纪律：措辞必须让用户知道「这不是完整列表」，且不得暗示数据已同步到服务端。
 */
export function degradedNoticeText(result: RegistryAssetListResult): string | undefined {
    if (!result.degraded) return undefined;
    return `已离线展示内置预设（${result.assets.length} 项），未能连接服务端` + (result.degradedReason ? `：${result.degradedReason}` : "");
}
