import { expect, test, describe } from "bun:test";

import {
    CHARACTER_REFERENCE_ROLE_PRIORITY,
    resolvePreferredCharacterImage,
    resolvePreferredCharacterRepresentation,
} from "@/lib/canvas/character-reference-images";
import type { CharacterRepresentation } from "@/services/api/projects";

/**
 * 角色参考图优先级单测（W4 骑乘件三，2026-10-03）。
 *
 * 依据：SOUL-IMPLEMENTATION-PLAN §5.1 的 1.1 条（C1 参考素材策略修正），
 * 官方口径「人物参考图优先使用单人独立照片，不建议使用三视图、多视图素材」。
 * 计划要求单测覆盖四组，本文件对应实现。
 */

const image = (role: string, resourceId = `res-${role}`): CharacterRepresentation => ({
    id: `id-${role}`,
    resourceId,
    mediaType: "image/png",
    role,
});

describe("角色参考图优先级（官方建议顺序）", () => {
    test("① 单角色单图：有 front 时选 front 而非 turnaround_sheet（核心修正）", () => {
        // 三视图排在数组前面也不该被选中——按优先级表查找，不按数组顺序
        const reps = [image("turnaround_sheet"), image("front")];
        expect(resolvePreferredCharacterRepresentation(reps)?.role).toBe("front");
    });

    test("② 无 front 时的回退链：side → back → primary → turnaround_sheet", () => {
        expect(resolvePreferredCharacterRepresentation([image("turnaround_sheet"), image("side")])?.role).toBe("side");
        expect(resolvePreferredCharacterRepresentation([image("turnaround_sheet"), image("primary"), image("back")])?.role).toBe("back");
        expect(resolvePreferredCharacterRepresentation([image("turnaround_sheet"), image("primary")])?.role).toBe("primary");
        // 只有三视图时仍然可用（垫底不等于禁用）
        expect(resolvePreferredCharacterRepresentation([image("turnaround_sheet")])?.role).toBe("turnaround_sheet");
    });

    test("③ 优先级表本身与官方建议一致（防回归：三视图不得回到首位）", () => {
        expect(CHARACTER_REFERENCE_ROLE_PRIORITY).toEqual(["front", "side", "back", "primary", "turnaround_sheet"]);
        expect(CHARACTER_REFERENCE_ROLE_PRIORITY[0]).not.toBe("turnaround_sheet");
        expect(CHARACTER_REFERENCE_ROLE_PRIORITY.indexOf("turnaround_sheet")).toBe(
            CHARACTER_REFERENCE_ROLE_PRIORITY.length - 1,
        );
    });

    test("④ 空列表与无匹配 role 返回 undefined（不抛错、不臆造）", () => {
        expect(resolvePreferredCharacterRepresentation([])).toBeUndefined();
        expect(resolvePreferredCharacterRepresentation([image("expression_sheet"), image("custom_role")])).toBeUndefined();
    });
});

describe("图片媒体类型约束（参考图注入只接受图片）", () => {
    test("优先级命中的不是图片时退回任意图片", () => {
        const reps: CharacterRepresentation[] = [
            { id: "v", resourceId: "res-v", mediaType: "video/mp4", role: "front" },
            image("custom_role", "res-img"),
        ];
        expect(resolvePreferredCharacterImage(reps)?.resourceId).toBe("res-img");
    });

    test("命中图片时按优先级返回（不回退）", () => {
        const reps = [image("turnaround_sheet"), image("back")];
        expect(resolvePreferredCharacterImage(reps)?.role).toBe("back");
    });

    test("全非图片时返回 undefined", () => {
        const reps: CharacterRepresentation[] = [
            { id: "a", resourceId: "res-a", mediaType: "audio/mpeg", role: "front" },
        ];
        expect(resolvePreferredCharacterImage(reps)).toBeUndefined();
    });
});
