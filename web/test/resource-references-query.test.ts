import { describe, expect, test } from "bun:test";
import axios from "axios";

import { apiClient } from "@/services/api/request";
import { getAssetResourceOccupancy, getResourceReferences } from "@/services/api/resources";

type Envelope = { code: number; data: unknown; msg?: string; reason?: string };

async function withAdapter<T>(envelope: Envelope, run: () => Promise<T>) {
    const previous = apiClient.defaults.adapter;
    const seen: string[] = [];
    apiClient.defaults.adapter = async (config) => {
        seen.push(String(config.url ?? ""));
        return { data: envelope, status: 200, statusText: "OK", headers: {}, config };
    };
    try {
        const result = await run();
        return { result, seen };
    } finally {
        apiClient.defaults.adapter = previous;
    }
}

describe("AST-08 资源引用查询 API", () => {
    test("引用查询走只读 GET，并把信封 data 直接返回", async () => {
        const { result, seen } = await withAdapter(
            {
                code: 0,
                data: {
                    resourceId: "resource-1",
                    references: [{ kind: "画布", id: "canvas-1", title: "商品主图", nodeId: "node-1", path: "$.nodes[0].data.storageKey" }],
                },
            },
            () => getResourceReferences("resource-1"),
        );
        expect(seen).toEqual(["/resources/resource-1/references"]);
        expect(result.resourceId).toBe("resource-1");
        expect(result.references[0]?.nodeId).toBe("node-1");
    });

    test("资源 ID 进 URL 前必须转义，不能拼接出额外路径段", async () => {
        const { seen } = await withAdapter({ code: 0, data: { resourceId: "x", references: [] } }, () => getResourceReferences("a/b?c"));
        expect(seen).toEqual(["/resources/a%2Fb%3Fc/references"]);
    });

    test("空引用列表不是错误（UI 需区分「查过没引用」与「查询失败」）", async () => {
        const { result } = await withAdapter({ code: 0, data: { resourceId: "resource-2", references: [] } }, () => getResourceReferences("resource-2"));
        expect(result.references).toEqual([]);
        expect(result.truncated).toBeUndefined();
    });

    test("截断标记透传（超上限时 UI 提示还有更多）", async () => {
        const { result } = await withAdapter({ code: 0, data: { resourceId: "resource-3", references: [], truncated: true } }, () => getResourceReferences("resource-3"));
        expect(result.truncated).toBe(true);
    });

    test("业务失败（code !== 0）必须抛错，不能静默返回空引用", async () => {
        const previous = apiClient.defaults.adapter;
        apiClient.defaults.adapter = async (config) => {
            throw new axios.AxiosError("Request failed with status code 404", "ERR_BAD_REQUEST", config, undefined, {
                data: { code: 404, data: null, msg: "资源不存在或无权访问", reason: "not_found" },
                status: 404,
                statusText: "Not Found",
                headers: {},
                config,
            });
        };
        try {
            await expect(getResourceReferences("missing")).rejects.toThrow();
        } finally {
            apiClient.defaults.adapter = previous;
        }
    });

    test("素材占用查询走独立端点", async () => {
        const { result, seen } = await withAdapter(
            { code: 0, data: { assetId: "asset-1", resourceIds: ["resource-a", "resource-b"] } },
            () => getAssetResourceOccupancy("asset-1"),
        );
        expect(seen).toEqual(["/assets/asset-1/resource-occupancy"]);
        expect(result.resourceIds).toEqual(["resource-a", "resource-b"]);
    });
});
