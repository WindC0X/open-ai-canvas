import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { getAuthSession, type AuthSessionPayload } from "@/services/api/auth";
import { FullScreenLoader } from "@/components/ui/aceternity/full-screen-loader";
import { preloadWorkspaceRoute } from "@/lib/workspace-route-modules";
import { isAuthRejectedStatus } from "@/lib/user-session";
import { useUserStore } from "@/stores/use-user-store";
import { recordDiagnosticEvent } from "@/services/diagnostics/client-diagnostics";

export function AuthSessionHydrator({ children }: { children: ReactNode }) {
    const hydrated = useUserStore((state) => state.hydrated);
    // 会话加载的传输层失败(代理空窗/后端重启/网络闪断)不能当登出处理: 后端对未登录
    // 本来就返回 200 + user:null, 走到 catch 的只有网络/服务瞬态——误登出会把正在
    // 工作的用户踢到登录页(2026-09-18 用户反馈)。保持 loader 并给出重试入口。
    const [sessionLoadError, setSessionLoadError] = useState(false);

    const load = useCallback(() => {
        let cancelled = false;
        setSessionLoadError(false);
        // 合并口径：重试入口与启动诊断共用本次尝试（startedAt 每次 load 重采样）。
        const startedAt = performance.now();
        recordDiagnosticEvent({ category: "navigation", level: "info", code: "startup.auth_session_started", message: "开始恢复认证会话" });
        getAuthSession()
            .then(async (payload) => {
                if (cancelled) return;
                recordDiagnosticEvent({
                    category: "navigation",
                    level: "info",
                    code: "startup.auth_session_ready",
                    message: payload.user ? "认证会话已恢复" : "匿名会话已确认",
                    durationMs: performance.now() - startedAt,
                });
                if (!payload.user) {
                    applyAnonymousSession(payload);
                    recordDiagnosticEvent({
                        category: "navigation",
                        level: "info",
                        code: "startup.anonymous_ready",
                        message: "匿名页面已解除启动阻塞",
                        durationMs: performance.now() - startedAt,
                    });
                    return;
                }
                // 账号数据、画布和素材持久化只属于已登录工作区，登录页不下载这些模块。
                const { applyUserSession } = await import("@/lib/user-session");
                if (cancelled) return;
                await applyUserSession(payload);
                recordDiagnosticEvent({
                    category: "navigation",
                    level: "info",
                    code: "startup.workspace_ready",
                    message: "登录工作区已解除启动阻塞",
                    durationMs: performance.now() - startedAt,
                });
                preloadWorkspaceRoute(window.location.pathname);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                // 合并口径：鉴权明确拒绝=正常匿名路径；瞬态失败记录诊断后保留重试入口（不降级匿名）。
                if (isAuthRejectedStatus(error)) {
                    applyAnonymousSession({ user: null });
                    return;
                }
                recordDiagnosticEvent({
                    category: "navigation",
                    level: "warning",
                    code: "startup.auth_session_failed",
                    message: "认证会话恢复失败，已保留重试入口",
                    durationMs: performance.now() - startedAt,
                });
                setSessionLoadError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => load(), [load]);

    if (sessionLoadError) {
        return (
            <div className="grid h-dvh place-items-center bg-background" data-session-load-error>
                <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-sm text-foreground/80">连接服务中断，会话状态未能确认</p>
                    <p className="text-xs text-foreground/50">请检查网络或稍后重试；已确认登录状态不受影响</p>
                    <button
                        type="button"
                        onClick={load}
                        className="mt-1 rounded-md border border-border bg-foreground/5 px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-foreground/10"
                    >
                        重新连接
                    </button>
                </div>
            </div>
        );
    }

    return hydrated ? children : <FullScreenLoader />;
}

function applyAnonymousSession(payload: AuthSessionPayload) {
    const store = useUserStore.getState();
    store.clearSession();
    store.setRuntimeLimits(payload.runtimeLimits);
    store.setDrawingEngine(payload.drawingEngine);
    store.setFeatures(payload.features);
    store.setHydrated(true);
}
