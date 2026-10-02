import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DIRECTOR_DEFAULT_ACTOR_URL } from "../src/lib/canvas/director/director-scene";
import { inferDirectorRig } from "../src/components/canvas/director/director-viewport-rig";
import { Bone, Object3D } from "three";

const read = (path: string) => readFileSync(resolve(import.meta.dir, "../src", path), "utf8");

/**
 * 默认演员模型的守卫。
 *
 * 原来的 Xbot.glb 走 jsDelivr 外链：国内不稳，COEP require-corp 下会被拦，
 * 且 Mixamo 血统的再分发权不明确。换成本地 CC0 模型后这些断言防止回退。
 */
describe("默认演员模型", () => {
    test("指向站内自托管路径，不再依赖外部 CDN", () => {
        expect(DIRECTOR_DEFAULT_ACTOR_URL).toBe("/models/RobotExpressive.glb");
        expect(DIRECTOR_DEFAULT_ACTOR_URL.startsWith("/models/")).toBe(true);
        const scene = read("lib/canvas/director/director-scene.ts");
        // 注释里可以保留换模型的原因说明，但赋值行必须指向站内。
        const assignment = scene.split("\n").find((line) => line.startsWith("export const DIRECTOR_DEFAULT_ACTOR_URL"));
        expect(assignment).toBe('export const DIRECTOR_DEFAULT_ACTOR_URL = "/models/RobotExpressive.glb";');
        expect(scene).not.toContain("cdn.jsdelivr.net");
    });

    test("模型文件在 public 下真实存在", () => {
        const path = resolve(import.meta.dir, "../public/models/RobotExpressive.glb");
        const stat = statSync(path);
        expect(stat.size).toBeGreaterThan(100_000);
        // 上限 10MB（控制线的工程筛序）。
        expect(stat.size).toBeLessThan(10 * 1024 * 1024);
    });

    test("骨骼命名能映射到导演台人形骨架", () => {
        // 取 RobotExpressive 的真实骨骼名（Blender 点号风格）。
        const boneNames = [
            "Hips", "Abdomen", "Torso", "Neck", "Head",
            "Shoulder.L", "UpperArm.L", "LowerArm.L",
            "Shoulder.R", "UpperArm.R", "LowerArm.R",
            "UpperLeg.L", "LowerLeg.L", "Foot.L",
            "UpperLeg.R", "LowerLeg.R", "Foot.R",
        ];
        const root = new Object3D();
        for (const name of boneNames) {
            const bone = new Bone();
            bone.name = name;
            root.add(bone);
        }
        const rig = inferDirectorRig(root, []);
        expect(rig.status).toBe("ready");
        // 姿态系统依赖的核心骨骼必须全部命中。
        for (const bone of ["hips", "head", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm", "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"]) {
            expect(rig.boneMap[bone as keyof typeof rig.boneMap]).toBeDefined();
        }
    });

    test("别名表扩展是追加式的，既有命名体系仍命中", () => {
        const root = new Object3D();
        // 至少 8 个命中才会判 ready（inferDirectorRig 的门槛）。
        for (const name of ["mixamorig:Hips", "mixamorig:Spine", "mixamorig:Head", "mixamorig:LeftArm", "mixamorig:RightArm", "mixamorig:LeftUpLeg", "mixamorig:RightUpLeg", "mixamorig:LeftFoot", "mixamorig:RightFoot"]) {
            const bone = new Bone();
            bone.name = name;
            root.add(bone);
        }
        const rig = inferDirectorRig(root, []);
        expect(rig.status).toBe("ready");
        expect(rig.boneMap.hips).toBe("mixamorig:Hips");
        expect(rig.boneMap.leftUpperArm).toBe("mixamorig:LeftArm");
        expect(rig.boneMap.leftUpperLeg).toBe("mixamorig:LeftUpLeg");
    });

    test("上下腿不互相抢占（Blender 命名下 upperleg/lowerleg 各自归位）", () => {
        const root = new Object3D();
        for (const name of ["UpperLeg.L", "LowerLeg.L", "UpperLeg.R", "LowerLeg.R"]) {
            const bone = new Bone();
            bone.name = name;
            root.add(bone);
        }
        const rig = inferDirectorRig(root, []);
        expect(rig.boneMap.leftUpperLeg).toBe("UpperLeg.L");
        expect(rig.boneMap.leftLowerLeg).toBe("LowerLeg.L");
        expect(rig.boneMap.rightUpperLeg).toBe("UpperLeg.R");
        expect(rig.boneMap.rightLowerLeg).toBe("LowerLeg.R");
    });
});
