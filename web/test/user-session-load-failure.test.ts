import { expect, test } from "bun:test";
import { ApiError } from "../src/services/api/request";
import { isAuthRejectedStatus } from "../src/lib/user-session";

function apiError(status?: number) {
    return new ApiError("session probe", { status });
}

test("only explicit auth rejection statuses sign out on session load failure", () => {
    expect(isAuthRejectedStatus(apiError(401))).toBe(true);
    expect(isAuthRejectedStatus(apiError(403))).toBe(true);
});

test("transport-level failures must NOT sign out (mis-logout regression guard)", () => {
    // vite 代理空窗/后端重启: axios 网络层错误没有 response → status undefined:
    expect(isAuthRejectedStatus(apiError(undefined))).toBe(false);
    expect(isAuthRejectedStatus(apiError(502))).toBe(false);
    expect(isAuthRejectedStatus(apiError(503))).toBe(false);
    expect(isAuthRejectedStatus(apiError(504))).toBe(false);
    expect(isAuthRejectedStatus(apiError(429))).toBe(false);
    expect(isAuthRejectedStatus(new Error("Network Error"))).toBe(false);
    expect(isAuthRejectedStatus(undefined)).toBe(false);
});

test("backend contract: session expiry is 200 + user null, never a 401 through this path", () => {
    // 锚定后端契约(handler/auth.go:158 ok(user:nil)): 若未来后端改用 401 表达过期,
    // 上面的 401 分支已就位; 若有人误把其它状态当登出, 这里挡住。
    expect(isAuthRejectedStatus(apiError(200))).toBe(false);
    expect(isAuthRejectedStatus(apiError(500))).toBe(false);
});
