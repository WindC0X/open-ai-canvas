/**
 * 光照预设离线兜底源 —— 注册表收编片 3（架构方案 §6.1）。
 *
 * ★ 为什么提取到 lib（与片 2 的 legacy-style-presets.ts 同构）：
 * 原先这 8 条是 `canvas-node-lighting-dialog.tsx` 的模块私有常量，注册表资产层
 * 无法访问。提取后由 `registry-adapters.ts` 适配为统一 schema，服务端不可达时
 * 作为**离线降级**源（origin: "local-fallback"，UI 必须标注，架构方案 §3.2）。
 *
 * 数据与 dialog 内的消费口径逐字一致（id / name / color / image / prompt），
 * 不新增字段、不改语义 —— 本文件是**搬迁**不是重设计。
 */

/** 光照风格预设（原 canvas-node-lighting-dialog.tsx 的 STYLE_PRESETS）。 */
export type LegacyLightingPreset = {
    /** 稳定英文标识（用作 RegistryAsset.slug） */
    id: string;
    /** 用户可见名称 */
    name: string;
    /** 主题色（dialog 缩略图底色） */
    color: string;
    /** 缩略图路径 */
    image: string;
    /** 模型面提示词 */
    prompt: string;
};

/**
 * 8 条光照风格预设 —— 逐字搬迁自 `canvas-node-lighting-dialog.tsx`。
 *
 * 顺序保持原样（dialog 渲染顺序），不重排。
 */
export const LEGACY_LIGHTING_PRESETS: LegacyLightingPreset[] = [
    { id: "overexposed", name: "过曝胶片", color: "#d4b896", image: "/lighting-presets/overexposed.png", prompt: "overexposed film aesthetic, high-key lighting, washed out highlights, soft diffused light, vintage film look" },
    { id: "blueBacklight", name: "蓝色逆光", color: "#1a3a5c", image: "/lighting-presets/blue-backlight.png", prompt: "dramatic backlighting, blue rim light, cool color temperature, silhouette with colored edges, ethereal atmosphere" },
    { id: "rembrandt", name: "伦勃朗光", color: "#5a3a1a", image: "/lighting-presets/rembrandt.png", prompt: "Rembrandt lighting, 45-degree angle key light, dramatic chiaroscuro, painterly shadows, classical portraiture" },
    { id: "cyberpunk", name: "赛博朋克", color: "#2a0a2a", image: "/lighting-presets/cyberpunk.png", prompt: "cyberpunk neon lighting, synthetic glow, futuristic atmosphere, vibrant cyan and magenta neon" },
    { id: "sunset", name: "落日迷幻", color: "#7a3010", image: "/lighting-presets/sunset.png", prompt: "golden hour lighting, warm sunset tones, long shadow, romantic atmosphere, Kodachrome colors" },
    { id: "mysterious", name: "神秘暗调", color: "#0a0a14", image: "/lighting-presets/mysterious.png", prompt: "low-key noir lighting, deep shadows, mysterious mood, film noir style, high contrast cinematic" },
    { id: "goldenHour", name: "黄金时刻", color: "#7a5a00", image: "/lighting-presets/golden-hour.png", prompt: "golden hour photography, warm soft light, beautiful catchlights, lens flare, magical golden glow" },
    { id: "nolanGrey", name: "诺兰冷灰", color: "#1a2a2a", image: "/lighting-presets/nolan-grey.png", prompt: "Christopher Nolan cinematography, IMAX quality, desaturated cold palette, teal and grey grading" },
];

/** 按 id 查光照预设（dialog 与适配器共用）。 */
export function findLegacyLightingPreset(id: string): LegacyLightingPreset | undefined {
    return LEGACY_LIGHTING_PRESETS.find((preset) => preset.id === id);
}
