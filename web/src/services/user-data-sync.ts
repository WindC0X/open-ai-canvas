import { getMediaBlob } from "@/services/file-storage";
import { getImageBlob } from "@/services/image-storage";
import { deleteRemoteAssets, deleteRemoteCanvasProject, getRemoteAsset, getRemoteAssetsByIds, getRemoteCanvasProject, getRemoteUserDataSnapshot, listRemoteAssetsPage, restoreRemoteCanvasHistory, upsertRemoteAsset, upsertRemoteCanvasProject } from "@/services/api/user-data";
import { ApiError } from "@/services/api/request";
import { canvasContentHash, sameCanvasContent } from "@/lib/canvas/canvas-content";
import { getActiveUserScope } from "@/lib/user-scope";
import { preserveCanvasSyncDraft, readCanvasSyncDrafts } from "@/services/canvas-sync-drafts";
import { appQueryClient } from "@/lib/query-client";
import { resourceFileUrl, resourceIdFromStorageKey, resourceStorageKey, uploadResourceFile } from "@/services/api/resources";
import { parseAssetRecordList } from "@/lib/asset-record";
import { assetForRemoteSync } from "@/lib/asset-remote-sync";
import type { Asset } from "@/stores/use-asset-store";
import { flushAssetStorePersistence, useAssetStore } from "@/stores/use-asset-store";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";
import { flushCanvasStorePersistence, useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useSyncProgressStore } from "@/stores/use-sync-progress-store";
import { useCanvasHistoryStore } from "@/stores/canvas/use-canvas-history-store";
import { repairMissingCanvasAssets, collectCanvasMediaAssetIds, rebindInconsistentCanvasAssets, type CanvasAssetRebindResult } from "@/services/canvas-asset-repair";
import { canvasNodeToAsset } from "@/lib/canvas/canvas-node-asset";
import { applyAgentCanvasPatch, type AgentCanvasPatch } from "@/lib/canvas/agent-canvas-patch";

let activeRemoteUserId = "";
type RemoteUserDataPhase = "inactive" | "hydrating" | "ready" | "failed";

let remoteUserDataPhase: RemoteUserDataPhase = "inactive";
let syncTimer: number | null = null;
let syncPromise: Promise<void> | null = null;
let syncQueued = false;
let remoteOperationTail: Promise<void> = Promise.resolve();
let subscriptionsInstalled = false;
let acknowledgedAssets = new Map<string, Asset>();
let acknowledgedProjects = new Map<string, CanvasProject>();
// 同步水位: "最后一次确认与远端一致"的 updatedAt(按用户持久化到 localStorage)。
// 会话内基线(acknowledged*)随进程消失, 重启后会把上一会话未同步成功的本地修改误认作"已同步基线",
// adopt 远端时静默覆盖丢失。水位跨会话存活, 是唯一可靠的"本地是否落后于上次确认同步点"判据。
// 服务端 upsert 原样存储客户端 updatedAt(backend/internal/service/user_data.go parseClientTime),
// 因此"同步成功"必然使两侧 updatedAt 相同, 水位对比无时钟歧义。
let watermarkProjects = new Map<string, string>();
let watermarkAssets = new Map<string, string>();

function watermarkStorageKey(userId: string) {
    return `canvas-user-data-sync-watermark:${userId}`;
}

function loadWatermarks(userId: string) {
    watermarkProjects = new Map();
    watermarkAssets = new Map();
    try {
        const raw = localStorage.getItem(watermarkStorageKey(userId));
        if (!raw) return;
        const parsed = JSON.parse(raw) as { p?: Record<string, string>; a?: Record<string, string> };
        watermarkProjects = new Map(Object.entries(parsed.p ?? {}));
        watermarkAssets = new Map(Object.entries(parsed.a ?? {}));
    } catch {
        // 水位缺失时退回旧行为: 无法识别跨会话未同步修改(不再比旧实现更差), 下次同步成功即重建水位。
    }
}

function persistWatermarks() {
    if (!activeRemoteUserId) return;
    try {
        localStorage.setItem(
            watermarkStorageKey(activeRemoteUserId),
            JSON.stringify({
                p: Object.fromEntries(watermarkProjects),
                a: Object.fromEntries(watermarkAssets),
            }),
        );
    } catch {
        // localStorage 配额满等场景忽略: 水位落后只导致保守冲突(fail-closed), 不会静默覆盖。
    }
}
let incrementalSession = false;
let sessionEpoch = 0;
const verifiedProjects = new Set<string>();
const verifiedAssets = new Set<string>();
const remoteProjectLoadPromises = new Map<string, Promise<CanvasProject | undefined>>();

// 读取当前打开的本地画布。语义等同 store.openProject（`projects.find(...) || null`），但只经由
// `projects`：同步域测试用最小 store 桩（只有 projects/setState），且此处只是纯读，不触 store 动作。
const openLocalProject = (id: string) => useCanvasStore.getState().projects.find((project) => project.id === id) ?? null;

export async function initializeRemoteUserDataSession(userId: string) {
    await withRemoteUserDataSyncExclusive(async () => {
        resetRemoteUserDataSync();
        activeRemoteUserId = userId;
        loadWatermarks(userId);
        incrementalSession = true;
        acknowledgedProjects = new Map(useCanvasStore.getState().projects.map((project) => [project.id, project]));
        acknowledgedAssets = new Map(useAssetStore.getState().assets.map((asset) => [asset.id, asset]));
        remoteUserDataPhase = "ready";
    });
}

/** 冲突页"加载云端版本": 放弃本地该画布(从 store 移除), 下一次 load 即走纯远端采纳。不触碰其它画布与持久媒体。 */
export async function discardLocalCanvasProject(id: string) {
    await withRemoteUserDataSyncExclusive(() => discardLocalCanvasProjectUnlocked(id));
}

/** discard 的无锁变体：调用方必须已持有 withRemoteUserDataSyncExclusive 临界区。 */
export async function discardLocalCanvasProjectUnlocked(id: string) {
    acknowledgedProjects.delete(id);
    watermarkProjects.delete(id);
    verifiedProjects.delete(id);
    useCanvasStore.setState((state) => ({ projects: state.projects.filter((candidate) => candidate.id !== id) }));
    await flushCanvasStorePersistence();
    persistWatermarks();
}

// 上游签名新增 options(latest/historyRestore/onLoad) 后，我方"进行中 load 先去重"的前置返回保留，
// 但只对普通加载生效：显式的 latest/historyRestore 必须真发出（否则恢复历史/加载最新会被另一笔
// 进行中的普通 load 静默顶替成空操作）。去重同时避免"临界区内注册的新 load 排在事务之后"的互相
// 等待（load 等事务、事务等 load → 尾随队列卡死，review 2026-09-21 P1）。登记仍由函数尾部维持。
function liveCanvasIfUnchanged(id: string, snapshot: CanvasProject | null | undefined) {
    const live = openLocalProject(id);
    if (live === snapshot) return live;
    if (!snapshot) return live ? undefined : null;
    return live && sameCanvasContent(live, snapshot) ? live : undefined;
}

export async function loadCanvasProjectForEditing(id: string, options: { latest?: boolean; historyRestore?: { snapshotId: string; revision: number }; onLoad?: (project: CanvasProject) => void } = {}) {
    if (!options.latest && !options.historyRestore) {
        const pending = remoteProjectLoadPromises.get(id);
        if (pending) {
            // 去重命中：多个调用者共用同一笔 load，但 onLoad 只在创建时绑定 —— 新调用者的 onLoad 必须在
            // 同一笔 load 完成时一并调用，否则它的调用点拿不到加载结果。（dev/StrictMode 双挂载下第二次
            // 挂载的 onLoad 被去重吃掉，其渲染门永远打不开 ⇒ 编辑器永久骨架屏；batch 10 S2 根因）
            return options.onLoad
                ? pending.then((project) => {
                      if (project) options.onLoad?.(project);
                      return project;
                  })
                : pending;
        }
    }
    const epoch = sessionEpoch;
    const request = withRemoteUserDataSyncExclusive(async () => {
        if (epoch !== sessionEpoch) throw new Error("账号已切换，请重新打开画布");
        requireRemoteUserDataBaseline();
        const scope = getActiveUserScope();
        const requireUnchangedLocal = (snapshot: CanvasProject | null | undefined, message: string) => {
            if (epoch !== sessionEpoch || getActiveUserScope() !== scope) throw new Error("账号已切换，请重新打开画布");
            const live = liveCanvasIfUnchanged(id, snapshot);
            if (live === undefined) throw new Error(message);
            return live;
        };
        if (options.historyRestore) {
            const local = openLocalProject(id);
            if (local) {
                const draftCount = await preserveCanvasSyncDraft(local, scope);
                useSyncProgressStore.getState().setProjectProgress(id, { draftCount });
            }
            requireUnchangedLocal(local, "本地内容仍在更新，请稍后再恢复历史版本");
            const { snapshotId, revision } = options.historyRestore;
            try {
                const saved = await restoreRemoteCanvasHistory(id, snapshotId, revision);
                if (epoch !== sessionEpoch || getActiveUserScope() !== scope) throw new Error("账号已切换，请重新打开画布查看恢复结果");
                if (saved.project.revision !== revision + 1) throw new Error("恢复结果的版本无效，请重新核对云端内容");
            } catch (error) {
                if (epoch === sessionEpoch && getActiveUserScope() === scope && error instanceof ApiError && (error.status === 409 || error.status === 428)) {
                    useSyncProgressStore.getState().setProjectProgress(id, { phase: "conflict", message: error.message });
                }
                throw error;
            }
        }
        let remote: CanvasProject;
        try {
            remote = (await getRemoteCanvasProject(id)).project;
        } catch (error) {
            if (epoch !== sessionEpoch) throw new Error("账号已切换，请重新打开画布");
            const local = openLocalProject(id);
            if (error instanceof ApiError && error.status === 404 && local?.revision === 0) {
                options.onLoad?.(local);
                return local ?? undefined;
            }
            throw error;
        }
        if (epoch !== sessionEpoch) throw new Error("账号已切换，请重新打开画布");
        await loadReferencedAssets(collectAssetIds(remote));
        const hash = await canvasContentHash(remote);
        if (epoch !== sessionEpoch || getActiveUserScope() !== scope) throw new Error("账号已切换，请重新打开画布");
        const local = openLocalProject(id);
        const cachedClean = local?.remoteContentHash && local.remoteContentHash === await canvasContentHash(local);
        const dirty = local && (!verifiedProjects.has(id) && incrementalSession ? !cachedClean : !sameCanvasContent(acknowledgedProjects.get(id), local));
        // 卡 06 水位门（2026-09-22 重核落点）：本地在"上次确认同步"之后改过 ⇔ remoteContentHash 与当前内容不符
        //（上游 cachedClean 的补集，无时钟）；远端也在水位之后变了 ⇔ 远端 revision 已前进（服务端 CAS 权威值）。
        // 二者同时成立 = 跨会话双向分歧 → fail-closed，绝不被上游"保留编辑分支交服务端拒绝"路径静默吞掉。
        // （原 updatedAt 判据已废：35ebed30 起后端把画布 updatedAt 落库为服务端 now()，两侧单位不再可比，
        //   详见 docs/merge-card06-watermark-recheck.md §3/§5。）
        const localAhead = Boolean(local && !cachedClean && Number.isSafeInteger(local.revision));
        const remoteAhead = Boolean(local && local.revision !== remote.revision);
        if (localAhead && !options.latest && !options.historyRestore) {
            if (remoteAhead) {
                // 双向分歧：先落草稿再 fail-closed（与上游同函数草稿分支、以及 409/428 分支的草稿保留同级保险）。
                const draftCount = await preserveCanvasSyncDraft(local!, scope);
                useSyncProgressStore.getState().setProjectProgress(id, { draftCount });
                useSyncProgressStore.getState().setProjectProgress(id, { phase: "conflict", message: "云端画布已有更新，本地修改已保留为草稿" });
                throw new CanvasSyncConflictError(id, "diverged");
            }
            // 仅本地领先（远端 == 水位）：先落草稿，再把基线改记远端版本使 store 与基线产生差异，
            // 既有防抖同步会按 dirty 检测提交这笔上一会话残留；此处已确认远端未变，增量守卫可跳过。
            const draftCount = await preserveCanvasSyncDraft(local!, scope);
            if (epoch !== sessionEpoch || getActiveUserScope() !== scope || openLocalProject(id) !== local) throw new Error("画布仍在更新，已保留本地内容，请稍后再加载最新版本");
            useSyncProgressStore.getState().setProjectProgress(id, { draftCount });
            acknowledgedProjects.set(id, { ...remote, remoteContentHash: hash });
            verifiedProjects.add(id);
            options.onLoad?.(local!);
            return local ?? undefined;
        }
        if (dirty && !sameCanvasContent(local, remote)) {
            const draftCount = await preserveCanvasSyncDraft(local, scope);
            const liveAfterDraft = requireUnchangedLocal(local, "画布仍在更新，已保留本地内容，请稍后再加载最新版本");
            useSyncProgressStore.getState().setProjectProgress(id, { draftCount });
            if (!options.latest && !options.historyRestore && local.revision !== undefined) {
                if (local.revision !== remote.revision) {
                    useSyncProgressStore.getState().setProjectProgress(id, { phase: "conflict", message: "云端画布已有更新，本地修改已保留为草稿" });
                } else {
                    // A cached draft is not an acknowledged cloud save. Once its
                    // ancestor is verified, retain it as pending against that content.
                    acknowledgedProjects.set(id, { ...remote, remoteContentHash: hash });
                    verifiedProjects.add(id);
                    useSyncProgressStore.getState().setProjectProgress(id, { phase: "pending", message: "本地草稿等待保存到云端" });
                    scheduleRemoteUserDataSync();
                }
                options.onLoad?.(liveAfterDraft || local);
                return liveAfterDraft || local || undefined;
            }
        }
        // Editing/generation may continue during the network request or draft write.
        // Viewport-only updates are not document edits and must not block adopting cloud content.
        const live = requireUnchangedLocal(local, "画布仍在更新，已保留本地内容，请稍后再加载最新版本");
        const project = { ...remote, viewport: live?.viewport || local?.viewport || remote.viewport || { x: 0, y: 0, k: 1 }, remoteContentHash: hash };
        // Align live editor refs synchronously before publishing the new revision.
        // A generation callback must never see old rendered nodes paired with a new revision.
        options.onLoad?.(project);
        acknowledgedProjects.set(id, project);
        watermarkProjects.set(id, project.updatedAt);
        persistWatermarks();
        verifiedProjects.add(id);
        useCanvasStore.setState((state) => ({ projects: local ? state.projects.map((item) => item.id === id ? project : item) : [...state.projects, project] }));
        await flushCanvasStorePersistence();
        useSyncProgressStore.getState().setProjectProgress(id, { phase: "done", message: "已加载云端最新版本" });
        return project;
    });
    remoteProjectLoadPromises.set(id, request);
    const clearPending = () => { if (remoteProjectLoadPromises.get(id) === request) remoteProjectLoadPromises.delete(id); };
    void request.then(clearPending, clearPending);
    return request;
}

// Never replace edits made while the Agent was running. Leave the acknowledged
// baseline untouched on conflict, so automatic sync cannot silently overwrite it.
const agentCanvasListeners = new Set<(project: CanvasProject, previous: CanvasProject | undefined) => void>();

export function subscribeAgentCanvasRefresh(listener: (project: CanvasProject, previous: CanvasProject | undefined) => void) {
    agentCanvasListeners.add(listener);
    return () => {
        agentCanvasListeners.delete(listener);
    };
}

export async function refreshCanvasAfterAgent(id: string) {
    const epoch = sessionEpoch;
    return withRemoteUserDataSyncExclusive(async () => {
        if (!activeRemoteUserId) throw new Error("请先登录再刷新 Agent 画布结果");
        const { project } = await getRemoteCanvasProject(id);
        if (epoch !== sessionEpoch) throw new Error("账号已切换");
        const current = useCanvasStore.getState().projects.find((candidate) => candidate.id === id);
        const baseline = acknowledgedProjects.get(id);
        const cachedDirty = current && incrementalSession && !verifiedProjects.has(id) && current.remoteContentHash !== await canvasContentHash(current);
        if (epoch !== sessionEpoch) throw new Error("账号已切换");
        if (current && (cachedDirty || !sameCanvasContent(baseline, current)) && !sameCanvasContent(current, project)) {
            // Replayed events can request a snapshot while local edits await saving.
            // An unchanged, verified ancestor is not a concurrent cloud edit.
            if (!cachedDirty && current.revision === project.revision && baseline?.revision === project.revision && sameCanvasContent(baseline, project)) {
                useSyncProgressStore.getState().setProjectProgress(id, { phase: "pending", message: "本地修改等待保存到云端" });
                scheduleRemoteUserDataSync();
                return current;
            }
            await preserveAgentConflict(current);
            throw new Error("Agent 已更新服务端画布，但本地存在未同步编辑。已保留本地草稿，请加载云端最新版本。");
        }
        const projected = { ...project, viewport: current?.viewport || project.viewport, remoteContentHash: await canvasContentHash(project) };
        if (epoch !== sessionEpoch || openLocalProject(id) !== (current || null)) throw new Error("画布仍在更新，请重新同步 Agent 结果");
        try {
            if (!sameCanvasContent(current, projected)) {
                for (const listener of agentCanvasListeners) listener(projected, current);
            }
        } catch (error) {
            if (current) await preserveAgentConflict(current);
            throw error;
        }
        acknowledgedProjects.set(id, projected);
        verifiedProjects.add(id);
        useCanvasStore.setState((state) => ({ projects: [...state.projects.filter((candidate) => candidate.id !== id), projected] }));
        await flushCanvasStorePersistence();
        useSyncProgressStore.getState().setProjectProgress(id, { phase: "done", message: "已同步 Agent 画布结果" });
        return projected;
    });
}

/**
 * 撤销专用画布采纳(2026-09-19): 强制以云端内容覆盖本地该画布, 但保留本地 viewport。
 *
 * 不走 discardLocalCanvasProject(整体移除再重加): 那会让 refreshCanvasAfterAgent 以
 * previous=undefined 投影, 触发"全部节点被判 Agent 新建→全选+视角飞行"(用户实测)。
 * 与 refreshCanvasAfterAgent 的差异: 后者在本地 dirty 时抛冲突保留本地; 撤销场景本地
 * 内容即将被云端(回滚态)覆盖, dirty 无需保护 —— 直接对齐基线+水位, 抑制反向反噬。
 */
export async function adoptRemoteCanvasAfterUndo(id: string) {
    await withRemoteUserDataSyncExclusive(() => adoptRemoteCanvasAfterUndoUnlocked(id));
}

/** adopt 的无锁变体：调用方必须已持有 withRemoteUserDataSyncExclusive 临界区。 */
export async function adoptRemoteCanvasAfterUndoUnlocked(id: string) {
    const epoch = sessionEpoch;
    {
        if (epoch !== sessionEpoch) throw new Error("账号已切换");
        if (!activeRemoteUserId) throw new Error("请先登录");
        const { project } = await getRemoteCanvasProject(id);
        if (epoch !== sessionEpoch) throw new Error("账号已切换");
        const current = useCanvasStore.getState().projects.find((candidate) => candidate.id === id);
        // 保留本地视口: 撤销是内容级回滚, 不应带用户飞行到远端保存的旧视口。
        const projected = current ? { ...project, viewport: current.viewport } : project;
        for (const listener of agentCanvasListeners) listener(projected, current);
        // 基线对齐 projected(含本地视口, 2026-09-19 review P3): 否则视口差被判 dirty, 撤销后立刻多一轮空 PUT。
        acknowledgedProjects.set(id, projected);
        verifiedProjects.add(id);
        watermarkProjects.set(id, project.updatedAt);
        persistWatermarks();
        if (current && sameEntitySnapshot(current, projected)) {
            useCanvasStore.setState((state) => ({ projects: state.projects.map((candidate) => (candidate.id === id ? projected : candidate)) }));
        } else {
            useCanvasStore.setState((state) => ({ projects: [...state.projects.filter((candidate) => candidate.id !== id), projected] }));
        }
    }
}

export async function applyAgentCanvasPatches(id: string, patches: AgentCanvasPatch[]) {
    const epoch = sessionEpoch;
    return withRemoteUserDataSyncExclusive(async () => {
        if (epoch !== sessionEpoch || !activeRemoteUserId) throw new Error("账号已切换或未登录，已停止 Agent 画布同步");
        const baseline = acknowledgedProjects.get(id);
        const current = useCanvasStore.getState().projects.find((project) => project.id === id);
        if (!baseline || !current) throw new Error("缺少画布同步基线，需要重新读取画布");
        let remote = baseline;
        let projected = current;
        try {
        // A rejected delta requests a snapshot through createAgentCanvasSync.
        // Only that reconciliation can distinguish stale replay from a conflict.
        if (incrementalSession && !verifiedProjects.has(id) && baseline.remoteContentHash !== await canvasContentHash(baseline)) throw new Error("本地缓存尚未核对，请加载云端最新版本");
        if (current.revision !== baseline.revision || !Number.isSafeInteger(baseline.revision)) throw new Error("画布同步基线已变化");
        for (const patch of patches) {
            if (!Number.isSafeInteger(patch.revision) || !Number.isSafeInteger(patch.baseRevision)) throw new Error("Agent 增量缺少版本，请重新读取画布");
            if (patch.revision! <= remote.revision!) continue;
            if (patch.baseRevision !== remote.revision || patch.revision !== patch.baseRevision! + 1) throw new Error("Agent 画布增量版本不连续，请重新读取画布");
            remote = { ...applyAgentCanvasPatch(remote, patch), revision: patch.revision };
            projected = { ...applyAgentCanvasPatch(projected, patch), revision: patch.revision };
        }
        if (projected === current) return current;
        const hash = await canvasContentHash(remote);
        if (epoch !== sessionEpoch || openLocalProject(id) !== current) throw new Error("画布仍在更新，请重新同步 Agent 结果");
        remote = { ...remote, remoteContentHash: hash };
        projected = { ...projected, remoteContentHash: hash };
        if (!sameCanvasContent(projected, current)) {
            for (const listener of agentCanvasListeners) listener(projected, current);
        }
        acknowledgedProjects.set(id, remote);
        verifiedProjects.add(id);
        if (projected === current) return current;
        useCanvasStore.setState((state) => ({ projects: state.projects.map((project) => project.id === id ? projected : project) }));
        await flushCanvasStorePersistence();
        useSyncProgressStore.getState().setProjectProgress(id, { phase: sameCanvasContent(remote, projected) ? "done" : "pending", message: "已同步 Agent 画布结果" });
        return projected;
        } catch (error) {
            const local = openLocalProject(id) || current;
            // H2（2026-09-24）：只有本地确有未同步改动才落冲突草稿；版本不连续等可恢复错误
            // 只应触发对账，不能让无本地改动的画布凭空出现 conflict/草稿。
            if (epoch === sessionEpoch && (!local.remoteContentHash || local.remoteContentHash !== await canvasContentHash(local))) {
                await preserveAgentConflict(local);
            }
            throw error;
        }
    });
}

/**
 * 临界区内的 load 依赖快照：只含【进入临界区前已注册】的 load（见 waitForRemoteProjectLoads）。
 * 临界区外为 null（此时按实时 map 等待是安全的）。
 */
let exclusiveEntryLoads: Promise<unknown>[] | null = null;

async function preserveAgentConflict(project: CanvasProject) {
    useSyncProgressStore.getState().setProjectProgress(project.id, { phase: "conflict", message: "云端画布已有更新，请保留草稿并加载最新版本" });
    const draftCount = await preserveCanvasSyncDraft(project);
    useSyncProgressStore.getState().setProjectProgress(project.id, { draftCount });
}

async function waitForRemoteProjectLoads() {
    // 只等进入临界区前注册的 load：它们排在本操作之前（尾随队列串行），必然已 settle。
    // 临界区内新注册的 load 排在本操作【之后】，等待它们会造成「事务等 load、load 等事务」
    // 双向死锁（review 2026-09-21 P1 已复现：撤销事务 POST 数秒窗口内任意一次
    // loadCanvasProjectForEditing —— 生成任务完成回写、打开另一个画布 —— 即中招，
    // 尾随队列永久卡死、自动同步/保存/登出全部挂起且无任何提示）。
    const pending = exclusiveEntryLoads ?? [...remoteProjectLoadPromises.values()];
    if (pending.length) await Promise.all(pending);
}

export async function loadAssetLibraryPage(options: Parameters<typeof listRemoteAssetsPage>[0]) {
    const epoch = sessionEpoch;
    const result = await listRemoteAssetsPage(options);
    await withRemoteUserDataSyncExclusive(async () => {
        if (epoch !== sessionEpoch) throw new Error("账号已切换，请重新读取素材");
        acceptRemoteAssets(result.assets);
    });
    return { ...result, assets: parseAssetRecordList(result.assets) };
}

function acceptRemoteAssets(remoteAssets: Asset[]) {
    const assets = parseAssetRecordList(remoteAssets);
    const current = new Map(useAssetStore.getState().assets.map((asset) => [asset.id, asset]));
    for (const asset of assets) {
        const local = current.get(asset.id);
        // 跨会话残留的未同步修改(本地 updatedAt 偏离水位)优先保护: 不采纳远端, 保留本地待同步。
        const assetWatermark = watermarkAssets.get(asset.id);
        if (local && assetWatermark && Date.parse(local.updatedAt) !== Date.parse(assetWatermark)) continue;
        if (local && !sameEntitySnapshot(acknowledgedAssets.get(asset.id), local)) continue;
        acknowledgedAssets.set(asset.id, asset);
        watermarkAssets.set(asset.id, asset.updatedAt);
        verifiedAssets.add(asset.id);
        current.set(asset.id, asset);
    }
    persistWatermarks();
    useAssetStore.setState({ assets: [...current.values()] });
}

function collectAssetIds(value: unknown, ids = new Set<string>()): Set<string> {
    if (!value || typeof value !== "object") return ids;
    for (const [key, child] of Object.entries(value)) {
        if (key === "assetId" && typeof child === "string" && child) ids.add(child);
        else if (child && typeof child === "object") collectAssetIds(child, ids);
    }
    return ids;
}

async function loadReferencedAssets(ids: Iterable<string>) {
    const pending = [...new Set(ids)].filter((id) => !verifiedAssets.has(id));
    for (let offset = 0; offset < pending.length; offset += 100) {
        const { assets } = await getRemoteAssetsByIds(pending.slice(offset, offset + 100));
        acceptRemoteAssets(assets);
    }
}

export async function loadAssetsForUse(ids: Iterable<string>) {
    const epoch = sessionEpoch;
    const requestedIds = [...new Set(ids)];
    await withRemoteUserDataSyncExclusive(async () => {
        if (epoch !== sessionEpoch) throw new Error("账号已切换，请重新读取素材");
        if (activeRemoteUserId) await loadReferencedAssets(requestedIds);
        const available = new Set(useAssetStore.getState().assets.map((asset) => asset.id));
        if (requestedIds.some((id) => !available.has(id) || (activeRemoteUserId && !verifiedAssets.has(id)))) throw new Error("部分素材不存在或无权访问，请重新选择素材");
    });
}

const LOCAL_STORAGE_KEY_PATTERN = /^(image|video|audio|file|video-reference|audio-reference):/;

export async function syncRemoteUserData(userId?: string | null) {
    // 登录/切换账号时，服务端快照建立新的远端基线；本地 IndexedDB 只负责首屏缓存，
    // 不能把服务端已经删除或当前用户无权访问的实体重新补回去。后续增量保存必须基于这份基线做冲突校验。
    await withRemoteUserDataSyncExclusive(async () => {
        incrementalSession = false;
        activeRemoteUserId = userId || "";
        acknowledgedProjects.clear();
        acknowledgedAssets.clear();
        if (!activeRemoteUserId) {
            remoteUserDataPhase = "inactive";
            return;
        }
        remoteUserDataPhase = "hydrating";
        try {
            // 登录只拉一次聚合快照。摘要列表再逐条请求详情会把 N 条数据放大成 2N+2 个请求，
            // 并且会在登录阶段同时触发大量媒体解析，任何一项失败都会污染登录结果。
            const snapshot = await getRemoteUserDataSnapshot();
            const localProjects = useCanvasStore.getState().projects;
            const remoteById = new Map(snapshot.projects.map((project) => [project.id, project]));
            // Archive unsynced work before replacing the active cache, including deleted remote canvases.
            for (const local of localProjects) {
                const clean = local.remoteContentHash && local.remoteContentHash === await canvasContentHash(local);
                if (!clean && !sameCanvasContent(local, remoteById.get(local.id))) await preserveCanvasSyncDraft(local);
            }
            const projects = await Promise.all(snapshot.projects.map(async (project) => {
                const local = localProjects.find((item) => item.id === project.id);
                const draftCount = (await readCanvasSyncDrafts(project.id)).length;
                useSyncProgressStore.getState().setProjectProgress(project.id, { phase: "done", draftCount, message: "已保存到云端" });
                return { ...project, viewport: local?.viewport || project.viewport || { x: 0, y: 0, k: 1 }, remoteContentHash: await canvasContentHash(project) };
            }));
            if (useCanvasStore.getState().projects !== localProjects) throw new Error("本地画布仍在更新，已保留本地内容，请重新同步");
            useCanvasStore.getState().replaceProjects(projects);
            useAssetStore.getState().replaceAssets(parseAssetRecordList(snapshot.assets));
            await Promise.all([flushCanvasStorePersistence(), flushAssetStorePersistence()]);
            acknowledgedProjects = new Map(projects.map((project) => [project.id, project]));
            acknowledgedAssets = new Map(parseAssetRecordList(snapshot.assets).map((asset) => [asset.id, asset]));
            remoteUserDataPhase = "ready";
        } catch (error) {
            remoteUserDataPhase = "failed";
            throw error;
        }
    });
}

export function installRemoteUserDataAutoSync() {
    if (subscriptionsInstalled) return;
    subscriptionsInstalled = true;
    useCanvasStore.subscribe((state, previous) => {
        if (state.projects === previous.projects) return;
        const before = new Map(previous.projects.map((project) => [project.id, project]));
        const changed = state.projects.filter((project) => !sameCanvasContent(before.get(project.id), project));
        if (!changed.length && state.projects.length === previous.projects.length) return;
        if (remoteUserDataPhase === "ready") {
            for (const project of changed) {
                if (sameCanvasContent(acknowledgedProjects.get(project.id), project)) continue;
                if (useSyncProgressStore.getState().syncingProjects[project.id]?.phase === "conflict") continue;
                useSyncProgressStore.getState().setProjectProgress(project.id, { phase: "pending", message: "有修改等待保存" });
            }
        }
        scheduleRemoteUserDataSync();
    });
    useAssetStore.subscribe((state, previous) => {
        if (state.assets !== previous.assets) scheduleRemoteUserDataSync();
    });
}

export function resetRemoteUserDataSync() {
    sessionEpoch += 1;
    incrementalSession = false;
    verifiedProjects.clear();
    verifiedAssets.clear();
    remoteProjectLoadPromises.clear();
    activeRemoteUserId = "";
    remoteUserDataPhase = "inactive";
    acknowledgedAssets.clear();
    acknowledgedProjects.clear();
    watermarkProjects = new Map();
    watermarkAssets = new Map();
    if (syncTimer) {
        window.clearTimeout(syncTimer);
        syncTimer = null;
    }
    syncQueued = false;
    useSyncProgressStore.getState().clearAll();
}

export function hasRemoteUserDataSyncSession() {
    return Boolean(activeRemoteUserId) && remoteUserDataPhase === "ready";
}

/**
 * 串行执行用户数据同步、账号切换和登出相关的远端操作。
 *
 * 前一个操作失败只影响它自己，不能让后续操作永远停在 rejected tail；当前操作的
 * 结果仍原样返回，由调用方决定如何提示或重试，避免同步层把写入失败伪装成成功。
 */
export function withRemoteUserDataSyncExclusive<T>(operation: () => Promise<T>): Promise<T> {
    // 入口同步快照：此后（临界区内）注册的 load 属于后续队列，不得在本操作内等待，
    // 否则尾随队列自锁（见 waitForRemoteProjectLoads）。
    const entryLoads = [...remoteProjectLoadPromises.values()];
    const pending = remoteOperationTail
        .then(
            () => undefined,
            () => undefined,
        )
        .then(() => {
            const previousEntryLoads = exclusiveEntryLoads;
            exclusiveEntryLoads = entryLoads;
            return operation().finally(() => {
                exclusiveEntryLoads = previousEntryLoads;
            });
        });
    remoteOperationTail = pending.then(
        () => undefined,
        () => undefined,
    );
    return pending;
}

export function scheduleRemoteUserDataSync() {
    if (!activeRemoteUserId || remoteUserDataPhase !== "ready") return;
    if (syncPromise) {
        syncQueued = true;
        return;
    }
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
        syncTimer = null;
        void saveRemoteUserDataNow().catch((error) => console.warn("云端自动同步失败", error));
    }, 1200);
}

export function formatLocalSavedRemotePending(localAction: string, error: unknown): string {
    const detail = error instanceof Error && error.message.trim() ? error.message.trim() : "未知错误";
    if (error instanceof ApiError && (error.status === 409 || error.status === 428)) {
        return `${localAction}，云端同步已暂停：${detail}。请保留草稿并加载最新版本。`;
    }
    return `${localAction}，云端同步失败：${detail}。将自动重试。`;
}

/** 本地写已成功、云端同步失败：排队同一幂等重试，并返回可直接展示的 warning。不得回滚本地写，也不得说成已保存到云端。 */
export function localSavedRemotePendingMessage(localAction: string, error: unknown): string {
    scheduleRemoteUserDataSync();
    return formatLocalSavedRemotePending(localAction, error);
}

export async function createCanvasProjectWithRemoteSync(title: string, projectId?: string, initialContent?: Partial<Pick<CanvasProject, "nodes" | "connections" | "chatSessions" | "activeChatId">>) {
    const id = useCanvasStore.getState().createProject(title, projectId);
    if (initialContent) useCanvasStore.getState().updateProject(id, initialContent);
    if (!activeRemoteUserId) return { id, syncError: new Error("尚未建立云端同步会话") };
    try {
        await saveRemoteUserDataNow(id);
        return { id };
    } catch (syncError) {
        scheduleRemoteUserDataSync();
        return { id, syncError };
    }
}

export async function deleteAssetWithRemoteSync(id: string) {
    return deleteAssetsWithRemoteSync([id]);
}

export async function deleteAssetsWithRemoteSync(ids: string[]) {
    const epoch = sessionEpoch;
    if (!ids.length || ids.length > 1000) throw new Error("每次请选择 1–1000 个素材删除");
    const assetIds = [...new Set(ids.map((id) => id.trim()))];
    if (assetIds.some((id) => !id)) throw new Error("素材 ID 不能为空");
    await withRemoteUserDataSyncExclusive(async () => {
        if (epoch !== sessionEpoch) throw new Error("账号已切换，请重新选择要删除的素材");
        if (activeRemoteUserId) {
            requireRemoteUserDataBaseline();
            await deleteRemoteAssets(assetIds);
            if (epoch !== sessionEpoch) throw new Error("账号已切换，请刷新原账号素材库确认删除结果");
            for (const id of assetIds) acknowledgedAssets.delete(id);
        }
        await useAssetStore.getState().removeAssets(assetIds);
        await flushAssetStorePersistence();
    });
    if (epoch !== sessionEpoch) throw new Error("账号已切换，请刷新原账号素材库确认删除结果");
    // 列表查询也会进入同步队列，必须在退出删除队列后触发，不能在队列内等待刷新。
    // 刷新慢或失败不应阻塞确认弹窗关闭，也不能把已完成的删除报告为失败。
    void Promise.all([
        appQueryClient.invalidateQueries({ queryKey: ["asset-library"] }, { throwOnError: true }),
        appQueryClient.invalidateQueries({ queryKey: ["asset-picker"] }, { throwOnError: true }),
    ]).catch((error) => {
        console.warn("素材删除后列表刷新失败", error);
    });
}

export async function deleteCanvasProjectsWithRemoteSync(ids: string[]) {
    const epoch = sessionEpoch;
    const projectIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!projectIds.length) return;
    // 删除只依赖画布 ID，跳过编辑加载，避免关联素材的合同校验阻塞删除。
    await withRemoteUserDataSyncExclusive(async () => {
        if (epoch !== sessionEpoch) throw new Error("账号已切换，请重新选择要删除的画布");
        if (activeRemoteUserId) requireRemoteUserDataBaseline();
        const currentProjects = useCanvasStore.getState().projects;
        const projectById = new Map(currentProjects.map((project) => [project.id, project]));
        const deletedProjectIds: string[] = [];
        const deletedProjectObjects: CanvasProject[] = [];
        let deletionError: unknown;
        for (const id of projectIds) {
            try {
                if (activeRemoteUserId) {
                    await deleteRemoteCanvasProject(id);
                    acknowledgedProjects.delete(id);
                }
                useCanvasStore.getState().deleteProjects([id]);
                // 批量删除允许部分成功；每个已成功远端删除的实体都立即落实到本地 durable cache。
                await flushCanvasStorePersistence();
                deletedProjectIds.push(id);
                const project = projectById.get(id);
                if (project) deletedProjectObjects.push(project);
            } catch (error) {
                deletionError = error;
                break;
            }
        }
        if (deletedProjectObjects.length > 0) useCanvasHistoryStore.getState().recordDeletedProjects(deletedProjectObjects);

        if (incrementalSession) {
            void appQueryClient.invalidateQueries({ queryKey: ["canvas-library"] });
            if (deletionError) throw deletionError;
            return;
        }

        // 将属于被删除画布的所有媒体节点安全归档至素材库回收站 (status = "archived")
        const currentAssets = useAssetStore.getState().assets;
        const remainingProjects = useCanvasStore.getState().projects;
        const activeAssetIds = new Set<string>();
        for (const proj of remainingProjects) {
            for (const node of proj.nodes) {
                if (node.metadata?.assetId) activeAssetIds.add(node.metadata.assetId);
            }
            for (const clip of proj.timeline?.clips || []) {
                if (clip.directMedia?.assetId) activeAssetIds.add(clip.directMedia.assetId);
            }
        }
        let assetChanged = false;
        // 1. 已存在的关联素材标记为 archived
        const assetsToArchive = currentAssets.filter((asset) => {
            const canvasId = asset.metadata?.canvasId as string | undefined;
            return canvasId && deletedProjectIds.includes(canvasId) && !activeAssetIds.has(asset.id) && asset.status !== "archived";
        });
        for (const asset of assetsToArchive) {
            useAssetStore.getState().updateAsset(asset.id, { status: "archived" });
            assetChanged = true;
        }

        // 2. 对于画布中尚未入库的媒体节点，直接归档为回收站素材。
        // 素材字段统一交给 canvasNodeToAsset 组装，避免删除路径另起一套尺寸、MIME 和资源定位规则。
        for (const project of deletedProjectObjects) {
            for (const node of project.nodes || []) {
                const isMedia = node.type === "image" || node.type === "video" || node.type === "audio";
                if (!isMedia) continue;

                const existingAsset = node.metadata?.assetId ? currentAssets.find((a) => a.id === node.metadata?.assetId) : undefined;
                if (existingAsset) {
                    const owningCanvasId = existingAsset.metadata?.canvasId as string | undefined;
                    if (owningCanvasId === project.id && !activeAssetIds.has(existingAsset.id) && existingAsset.status !== "archived") {
                        useAssetStore.getState().updateAsset(existingAsset.id, { status: "archived" });
                        assetChanged = true;
                    }
                    continue;
                }

                const archivedAsset = canvasNodeToAsset(node, { canvasId: project.id, source: "canvas-manual" });
                if (!archivedAsset) continue;

                const title = node.title || `${project.title} - ${node.type === "image" ? "图片" : node.type === "video" ? "视频" : "音频"}`;
                const prompt = typeof node.metadata?.prompt === "string" ? node.metadata.prompt : "";
                useAssetStore.getState().addAsset({
                    ...archivedAsset,
                    title,
                    tags: node.type === "audio" ? ["画布音频"] : prompt ? [prompt.slice(0, 16)] : [node.type === "video" ? "画布视频" : "画布生成"],
                    category: "other",
                    status: "archived",
                    source: `已删除画布：${project.title}`,
                    metadata: {
                        ...archivedAsset.metadata,
                        canvasId: project.id,
                        sourceNodeId: node.id,
                    },
                });
                assetChanged = true;
            }
        }

        if (assetChanged) {
            await flushAssetStorePersistence();
            if (activeRemoteUserId) {
                try {
                    await drainRemoteUserDataChanges();
                } catch (syncErr) {
                    scheduleRemoteUserDataSync();
                    console.warn("回收站素材云端同步警告:", syncErr);
                }
            }
        }
        if (deletionError) throw deletionError;
    });
}

export async function saveRemoteUserDataNow(input?: string | readonly string[] | { force?: boolean }) {
    const projectId = typeof input === "string" || Array.isArray(input) ? input as string | readonly string[] : undefined;
    const options = input && typeof input === "object" && !Array.isArray(input) ? input as { force?: boolean } : {};
    const epoch = sessionEpoch;
    if (!activeRemoteUserId) throw new Error("尚未建立云端同步会话，本地内容尚未保存到云端");
    requireRemoteUserDataBaseline();
    const assertNoConflict = () => {
        const ids = projectId === undefined ? useCanvasStore.getState().projects.map((project) => project.id)
            : typeof projectId === "string" ? [projectId] : projectId;
        if (ids.some((id) => useSyncProgressStore.getState().syncingProjects[id]?.phase === "conflict")) {
            throw new ApiError("云端画布已有更新，请保留本地草稿并加载最新版本", { status: 409 });
        }
    };
    if (projectId !== undefined) assertNoConflict();
    await waitForRemoteProjectLoads();
    if (syncPromise) {
        syncQueued = true;
        await syncPromise;
        assertNoConflict();
        return;
    }
    syncPromise = withRemoteUserDataSyncExclusive(async () => {
        requireRemoteUserDataBaseline();
        if (epoch !== sessionEpoch) throw new Error("账号已切换，已停止旧会话保存");
        await drainRemoteUserDataChanges(options);
    });
    try {
        await syncPromise;
        assertNoConflict();
    } finally {
        syncPromise = null;
        if (syncQueued) scheduleRemoteUserDataSync();
    }
}

/**
 * flush 的无锁变体：调用方必须已持有 withRemoteUserDataSyncExclusive 临界区
 * （撤销事务 flush→POST→adopt 三步同区，review 2026-09-21 P2）。
 */
export async function flushRemoteUserDataUnlocked(options: { force?: boolean } = {}) {
    const epoch = sessionEpoch;
    if (!activeRemoteUserId) return;
    requireRemoteUserDataBaseline();
    await waitForRemoteProjectLoads();
    if (epoch !== sessionEpoch) throw new Error("账号已切换，已停止旧会话保存");
    await drainRemoteUserDataChanges(options);
}

/**
 * 强制覆盖保存：以本地内容为准修复画布媒体与素材的绑定（重绑到引用同一资源的素材，
 * 缺失则按节点新建），再走「素材先于画布」的整体推送覆盖云端。服务端画布不变式只认
 * 「节点资源被其 assetId 对应素材引用」，重绑后的本地画布可以在不破坏该不变式的前提下
 * 覆盖远端。素材远端版本冲突时采纳远端为基线继续覆盖，避免显式覆盖被冲突检测卡死。
 * 素材修复可采用远端素材基线；画布始终携带原始 revision，不能绕过版本校验（服务端 CAS）。
 */
export async function forceOverwriteRemoteCanvasSync(): Promise<CanvasAssetRebindResult> {
    const epoch = sessionEpoch;
    if (!activeRemoteUserId) throw new Error("尚未建立云端同步会话，请登录后重试");
    requireRemoteUserDataBaseline();
    await waitForRemoteProjectLoads();
    const rebind = await withRemoteUserDataSyncExclusive(async () => {
        if (epoch !== sessionEpoch) throw new Error("账号已切换，已停止修复保存");
        requireRemoteUserDataBaseline();
        const projects = useCanvasStore.getState().projects;
        // 服务端素材记录是 guard 实际校验的事实；本地缓存可能落后，须先取回再判定绑定一致性。
        const claimedIds = [...collectCanvasMediaAssetIds(projects)];
        const remoteAssets: Asset[] = [];
        for (let offset = 0; offset < claimedIds.length; offset += 100) {
            const { assets } = await getRemoteAssetsByIds(claimedIds.slice(offset, offset + 100));
            remoteAssets.push(...assets);
        }
        const remoteById = new Map(remoteAssets.map((asset) => [asset.id, asset]));
        const merged = [...remoteAssets, ...useAssetStore.getState().assets.filter((asset) => !remoteById.has(asset.id))];
        const result = rebindInconsistentCanvasAssets(parseAssetRecordList(merged));
        await Promise.all([flushCanvasStorePersistence(), flushAssetStorePersistence()]);
        return result;
    });
    await saveRemoteUserDataNow({ force: true });
    return rebind;
}

async function drainRemoteUserDataChanges(options: { force?: boolean } = {}) {
    const uploaded = new Map<string, string>();
    do {
        syncQueued = false;
        await saveRemoteUserDataBatch(uploaded, options);
    } while (syncQueued);
}

async function saveRemoteUserDataBatch(uploaded: Map<string, string>, options: { force?: boolean } = {}) {
    // 中央兜底：任何调用方只要把持久媒体写进画布，提交前都会先补齐素材记录与 assetId。
    // 页面级入口仍主动入库，以便立即反馈；这里负责阻止遗漏入口形成远端幽灵资源。
    let savedAny = false;
    try {
        // 主体包 try/finally: 上游按项目隔离错误(单项目失败不再中断整批), 成功实体的新水位
        // 也必须在 finally 落盘 —— 否则内存水位与 localStorage 永久分叉,
        // 刷新后回到"每刷必弹 diverged 冲突门"的老路(用户实测)。
        const changedProjectIds = new Set(useCanvasStore.getState().projects.filter((project) => !sameCanvasContent(acknowledgedProjects.get(project.id), project)).map((project) => project.id));
        repairMissingCanvasAssets(changedProjectIds, incrementalSession);
        const currentProjects = useCanvasStore.getState().projects;
        const currentAssets = useAssetStore.getState().assets;
        const dirtyProjects = currentProjects.filter((project) => !sameCanvasContent(acknowledgedProjects.get(project.id), project) && useSyncProgressStore.getState().syncingProjects[project.id]?.phase !== "conflict");
        const dirtyAssets = currentAssets.filter((asset) => !sameEntitySnapshot(acknowledgedAssets.get(asset.id), asset));
        if (!dirtyProjects.length && !dirtyAssets.length) return;

        if (incrementalSession) {
            // 我方(fork, ab588925): 旧缓存未核对的项目先取回远端详情作为新校验基线, 再提交当前打开画布的完整快照,
            // 避免画布编辑态被旧缓存冲突永久阻塞。服务端 revision CAS 仍是最终防线(陈旧 revision 一律 409),
            // 因此这里不构成静默覆盖 —— 失败会落到下面的 409/428 分支保留草稿。
            for (const source of dirtyProjects) {
                const baseline = acknowledgedProjects.get(source.id);
                if (!baseline || verifiedProjects.has(source.id)) continue;
                const { project } = await getRemoteCanvasProject(source.id);
                if (Date.parse(project.updatedAt) !== Date.parse(baseline.updatedAt)) {
                    acknowledgedProjects.set(source.id, project);
                }
                verifiedProjects.add(source.id);
            }
            for (const source of dirtyAssets) {
                const baseline = acknowledgedAssets.get(source.id);
                if (!baseline || verifiedAssets.has(source.id)) continue;
                const { asset } = await getRemoteAsset(source.id);
                if (Date.parse(asset.updatedAt) !== Date.parse(baseline.updatedAt)) {
                    if (!options.force) throw new Error("素材远端版本已变化，已停止覆盖，请重新打开素材库");
                    // 强制覆盖是用户显式指令：采纳远端版本为新基线后继续用本地内容覆盖。
                    acknowledgedAssets.set(source.id, asset);
                }
                verifiedAssets.add(source.id);
            }
        }

        // 转换后的 resource: 引用只属于发往服务端的 payload，不能反写整份实时 store。
        // 已确认快照记录的是本次上传所依据的本地实体；上传期间的新编辑会在下一轮继续提交。
        // 素材先于画布提交。这样画布中的 resource: 引用一旦成为远端事实，
        // 对应 Asset 已经存在，刷新或换设备不会出现只占容量、不见素材的窗口。
        for (const source of dirtyAssets) {
            const remotePayload = await ensureRemoteResourceReferences(assetForRemoteSync(source), uploaded);
            await upsertRemoteAsset(remotePayload);
            acknowledgedAssets.set(source.id, source);
            watermarkAssets.set(source.id, source.updatedAt);
            verifiedAssets.add(source.id);
            savedAny = true;
        }
        const errors: unknown[] = [];
        for (const source of dirtyProjects) {
            const keysToUpload = collectLocalMediaKeys(source);
            const total = keysToUpload.length;
            useSyncProgressStore.getState().setProjectProgress(source.id, {
                projectId: source.id,
                total,
                completed: 0,
                phase: total > 0 ? "uploading" : "saving",
                message: total > 0 ? "正在同步媒体至云端" : "正在保存画布",
            });
            const onMediaUploaded = () => {
                if (total > 0) {
                    useSyncProgressStore.getState().incrementProjectCompleted(source.id);
                }
            };
            try {
                if (!Number.isSafeInteger(source.revision) || source.revision! < 0) {
                    throw new ApiError("缺少画布版本，请保留草稿并加载云端最新版本", { status: 428 });
                }
                const hash = await canvasContentHash(source);
                const remotePayload = await ensureRemoteResourceReferences(source, uploaded, onMediaUploaded);
                if (total > 0) {
                    useSyncProgressStore.getState().setProjectProgress(source.id, {
                        phase: "saving",
                        message: "正在保存画布结构",
                    });
                }
                const { project: saved } = await upsertRemoteCanvasProject(sanitizeCanvasProjectForRemoteSync(remotePayload));
                if (!Number.isSafeInteger(saved.revision) || saved.revision !== source.revision! + 1) {
                    throw new ApiError("服务端未返回有效画布版本，请加载云端最新版本", { status: 409 });
                }
                const current = openLocalProject(source.id);
                if (current && current.revision !== source.revision) {
                    throw new ApiError("画布基线已变化，请加载云端最新版本", { status: 409 });
                }
                const acknowledged = { ...source, revision: saved.revision, remoteContentHash: hash };
                acknowledgedProjects.set(source.id, acknowledged);
                watermarkProjects.set(source.id, source.updatedAt);
                verifiedProjects.add(source.id);
                savedAny = true;
                if (current) {
                    useCanvasStore.setState((state) => ({ projects: state.projects.map((project) => project === current
                        ? { ...project, revision: saved.revision, remoteContentHash: hash } : project) }));
                }
                await flushCanvasStorePersistence();
                const pending = !sameCanvasContent(source, openLocalProject(source.id) || undefined);
                useSyncProgressStore.getState().setProjectProgress(source.id, { phase: pending ? "pending" : "done", message: pending ? "有新修改等待保存" : "已保存到云端" });
                if (pending) syncQueued = true;
            } catch (error) {
                const conflict = error instanceof ApiError && (error.status === 409 || error.status === 428);
                useSyncProgressStore.getState().setProjectProgress(source.id, {
                    phase: conflict ? "conflict" : "error",
                    message: error instanceof Error ? error.message : "云端同步失败，等待重试",
                });
                if (conflict) {
                    try {
                        const current = openLocalProject(source.id) || source;
                        const draftCount = await preserveCanvasSyncDraft(current);
                        useSyncProgressStore.getState().setProjectProgress(source.id, { draftCount });
                    } catch (draftError) {
                        useSyncProgressStore.getState().setProjectProgress(source.id, { message: "本地草稿保存失败，请勿关闭页面；请先下载草稿" });
                        errors.push(draftError);
                    }
                }
                errors.push(error);
            }
        }
        if (errors.length) throw errors[0];
        if (dirtyProjects.length) void appQueryClient.invalidateQueries({ queryKey: ["canvas-library"] });
    } finally {
        if (savedAny) persistWatermarks();
    }
}

function collectLocalMediaKeys(value: unknown, set = new Set<string>()): string[] {
    if (!value || typeof value !== "object") return [...set];
    if (Array.isArray(value)) {
        for (const item of value) collectLocalMediaKeys(item, set);
        return [...set];
    }
    const record = value as Record<string, unknown>;
    const storageKey = typeof record.storageKey === "string" ? record.storageKey : "";
    if (isLocalStorageKey(storageKey) && !resourceIdFromStorageKey(storageKey)) {
        set.add(storageKey);
    } else {
        const inline = inlineMediaDataUrl(record);
        if (inline) set.add(`${inline.length}:${inline.slice(0, 64)}:${inline.slice(-64)}`);
    }
    for (const child of Object.values(record)) {
        collectLocalMediaKeys(child, set);
    }
    return [...set];
}

async function ensureRemoteResourceReferences<T>(value: T, uploaded = new Map<string, string>(), onUploaded?: () => void): Promise<T> {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) {
        const result: unknown[] = [];
        for (const item of value) result.push(await ensureRemoteResourceReferences(item, uploaded, onUploaded));
        return result as T;
    }

    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        next[key] = await ensureRemoteResourceReferences(child, uploaded, onUploaded);
    }

    const storageKey = typeof next.storageKey === "string" ? next.storageKey : "";
    const remoteResourceId = resourceIdFromStorageKey(storageKey);
    if (remoteResourceId) return applyResourceReference(next, storageKey) as T;

    if (!isLocalStorageKey(storageKey)) {
        const inline = inlineMediaDataUrl(next);
        if (!inline) return next as T;
        const identity = await inlineMediaUploadIdentity(inline);
        const cached = uploaded.get(identity);
        if (cached) return applyResourceReference(next, cached) as T;
        const resourceStorage = await uploadInlineDataUrl(inline, identity);
        uploaded.set(identity, resourceStorage);
        onUploaded?.();
        return applyResourceReference(next, resourceStorage) as T;
    }

    const cached = uploaded.get(storageKey);
    if (cached) return applyResourceReference(next, cached) as T;
    const resourceStorage = await uploadLocalStorageKey(storageKey, next);
    uploaded.set(storageKey, resourceStorage);
    onUploaded?.();
    return applyResourceReference(next, resourceStorage) as T;
}

function applyResourceReference(payload: Record<string, unknown>, storageKey: string) {
    const resourceId = resourceIdFromStorageKey(storageKey);
    if (!resourceId) {
        throw new Error(`远端资源引用无效：${storageKey}`);
    }
    const url = resourceFileUrl(resourceId);
    payload.storageKey = storageKey;
    for (const key of ["content", "dataUrl", "url", "coverUrl"]) {
        if (typeof payload[key] === "string") payload[key] = url;
    }
    return payload;
}

function inlineMediaDataUrl(payload: Record<string, unknown>) {
    for (const key of ["dataUrl", "content", "url", "coverUrl"]) {
        const value = payload[key];
        if (typeof value === "string" && /^data:(image|video|audio)\//i.test(value)) return value;
    }
    return "";
}

async function uploadInlineDataUrl(dataUrl: string, identity: string) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error("内嵌媒体读取失败");
    const blob = await response.blob();
    const kind: "image" | "video" | "audio" | "file" = blob.type.startsWith("image/") ? "image" : blob.type.startsWith("video/") ? "video" : blob.type.startsWith("audio/") ? "audio" : "file";
    const resource = await uploadResourceFile(blob, kind, { idempotencyKey: identity });
    return resourceStorageKey(resource.id);
}

async function inlineMediaUploadIdentity(dataUrl: string) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(dataUrl));
    return `inline:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function uploadLocalStorageKey(storageKey: string, payload: Record<string, unknown>) {
    const blob = storageKey.startsWith("image:") ? await getImageBlob(storageKey) : await getMediaBlob(storageKey);
    if (!blob) throw new Error(`本地媒体不存在，无法同步：${storageKey}`);
    const kind = blob.type.startsWith("image/") ? "image" : blob.type.startsWith("video/") ? "video" : blob.type.startsWith("audio/") ? "audio" : "file";
    const resource = await uploadResourceFile(blob, kind, {
        width: numberValue(payload.naturalWidth) || numberValue(payload.width),
        height: numberValue(payload.naturalHeight) || numberValue(payload.height),
        durationMs: numberValue(payload.durationMs),
        idempotencyKey: storageKey,
    });
    return resourceStorageKey(resource.id);
}

function requireRemoteUserDataBaseline() {
    if (remoteUserDataPhase !== "ready") throw new Error("云端数据基线尚未建立，已停止写入");
}

export type CanvasSyncConflictKind = "diverged";

/** 画布本地与远端双向分歧(两版都有对方没有的修改)。阻断打开, 由用户选择导出备份或放弃本地。 */
export class CanvasSyncConflictError extends Error {
    readonly kind: CanvasSyncConflictKind;
    readonly projectId: string;

    constructor(projectId: string, kind: CanvasSyncConflictKind) {
        super("画布在本地和云端都有修改。可先导出本地备份，再选择加载云端版本（将放弃本地版本）。");
        this.name = "CanvasSyncConflictError";
        this.kind = kind;
        this.projectId = projectId;
    }
}

function sameEntitySnapshot<T>(acknowledged: T | undefined, current: T) {
    return acknowledged !== undefined && (acknowledged === current || JSON.stringify(acknowledged) === JSON.stringify(current));
}

function isLocalStorageKey(value: string) {
    return LOCAL_STORAGE_KEY_PATTERN.test(value) && !resourceIdFromStorageKey(value);
}

function numberValue(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
}

function sanitizeCanvasProjectForRemoteSync<T>(project: T): T {
    if (!project || typeof project !== "object") return project;
    const clone = { ...(project as Record<string, unknown>) };
    if (Array.isArray(clone.chatSessions)) {
        clone.chatSessions = clone.chatSessions.map((session) => {
            if (!session || typeof session !== "object") return session;
            const s = { ...(session as Record<string, unknown>) };
            if (Array.isArray(s.messages)) {
                s.messages = s.messages.map((message) => {
                    if (!message || typeof message !== "object" || !message.detail) return message;
                    const m = { ...(message as Record<string, unknown>) };
                    if (m.detail && typeof m.detail === "object") {
                        const d = { ...(m.detail as Record<string, unknown>) };
                        if (Array.isArray(d.results)) {
                            d.results = d.results.map((r) => {
                                if (!r || typeof r !== "object") return r;
                                const res = { ...(r as Record<string, unknown>) };
                                if (res.result && typeof res.result === "object") {
                                    const inner = { ...(res.result as Record<string, unknown>) };
                                    if (inner.data && typeof inner.data === "object") {
                                        const { snapshot: _s, before: _b, after: _a, ...restData } = inner.data as Record<string, unknown>;
                                        inner.data = restData;
                                    }
                                    res.result = inner;
                                }
                                return res;
                            });
                        }
                        m.detail = d;
                    }
                    return m;
                });
            }
            return s;
        });
    }
    return clone as T;
}
