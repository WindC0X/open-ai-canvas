/**
 * F-02 商拍场景入口（**过渡形态**）。
 *
 * ★ 两步走（任务书 §六-1，控制线口径）：
 *   本组件是 W5 直线入口设计卡出来之前的**过渡形态** —— 挂在 Agent 面板空态，
 *   与既有 `AgentSceneCapsules`（技能组合推荐）同排逻辑但语义独立。
 *   W5 设计卡出稿后，入口统一到设计卡方案，本组件随之收敛或替换。
 *
 * 命名纪律（任务书 §二-3）：标题用「商拍场景」，**不用**「场景胶囊」
 * （后者是上游 Agent 技能域 `AGENT_SCENE_DEFS` 的既有语义）。
 *
 * 交互：点场景 → 回填一条完整的场景生成意图到输入框（用户可再编辑后提交），
 * 不直接发起生成 —— 与 starter 卡「点击发意图」同族，但本入口带**场景变量**
 * （Flora 六要素），故填出的是可直接走降智档模板的完整 brief。
 */
import { useState } from "react";
import { ArrowLeft, Mountain, Sparkles } from "lucide-react";

import {
    SCENE_CATEGORY_LABELS,
    SCENE_PRESETS,
    scenePresetsByCategory,
    type SceneCategory,
    type ScenePreset,
} from "@/lib/canvas/scene-presets";

/** 场景分类的渲染顺序（居家 → 餐饮 → 自然 → 影棚 → 节庆）。 */
const CATEGORY_ORDER: SceneCategory[] = ["home", "food", "nature", "studio", "seasonal"];

/**
 * 把场景预设转成回填给 Agent 的 brief 文本。
 *
 * 形态对齐 starter 卡的「意图 + 澄清指令」复合文案（canvas-ecom-starters.ts 的
 * 文案存档语义）：先声明意图与商品，再让 Agent 单轮确认，不直接生成。
 */
export function scenePresetBrief(preset: ScenePreset): string {
    // 用 preset.brief（用户面中文）而非 preset.variables（模型面英文）——
    // 后者直接拼进中文 brief 会产出「把商品放进a sunlit minimalist kitchen」这类
    // 中英夹杂文案。两个受众、两套文案。
    return [
        `帮我做一张「${preset.title}」风格的商拍场景图：${preset.brief}`,
        "先不要直接生成，请先用一条消息确认：商品用画布里的哪张图（用 @ 引用），以及比例（默认 1:1）。",
        "我回复后不用再追问，先复述方案，再开始生成。",
    ].join("");
}

export function ScenePresetChips({
    disabled = false,
    onPick,
}: {
    disabled?: boolean;
    /** 选中场景后回填 brief（由面板决定塞进输入框还是直接提交）。 */
    onPick: (brief: string, preset: ScenePreset) => void;
}) {
    // 始终只占一排：默认显示分类，点某分类后同排内就地切换（照 AgentSceneCapsules 的既有交互）
    const [activeCategory, setActiveCategory] = useState<SceneCategory | null>(null);
    const chipClass = "agent-scene-capsule shrink-0";
    const stop = {
        onMouseDown: (event: { stopPropagation(): void }) => event.stopPropagation(),
        onPointerDown: (event: { stopPropagation(): void }) => event.stopPropagation(),
    };
    const activePresets = activeCategory ? scenePresetsByCategory(activeCategory) : [];

    return (
        <div className="agent-scene-capsules mx-3 mb-2 min-w-0">
            <div className="agent-scene-capsules-heading">
                <Mountain aria-hidden="true" />
                <span>{activeCategory ? SCENE_CATEGORY_LABELS[activeCategory] : "商拍场景"}</span>
            </div>
            <div className="agent-scene-capsules-scroll thin-scrollbar flex gap-2 overflow-x-auto px-1 py-2">
                {activeCategory ? (
                    <>
                        <button
                            type="button"
                            disabled={disabled}
                            title="返回全部分类"
                            className={chipClass}
                            data-scene="back"
                            {...stop}
                            onClick={(event) => {
                                event.stopPropagation();
                                setActiveCategory(null);
                            }}
                        >
                            <ArrowLeft aria-hidden="true" />
                            <span>全部分类</span>
                        </button>
                        {activePresets.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                disabled={disabled}
                                title={preset.hint}
                                className={chipClass}
                                data-scene={preset.category}
                                {...stop}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onPick(scenePresetBrief(preset), preset);
                                }}
                            >
                                <Sparkles aria-hidden="true" />
                                <span className="agent-scene-capsule-label">{preset.title}</span>
                                <span className="agent-scene-capsule-meta">{preset.hint.split(" · ")[0]}</span>
                            </button>
                        ))}
                    </>
                ) : (
                    CATEGORY_ORDER.map((category) => {
                        const count = scenePresetsByCategory(category).length;
                        if (count === 0) return null;
                        return (
                            <button
                                key={category}
                                type="button"
                                disabled={disabled}
                                title={`${SCENE_CATEGORY_LABELS[category]} · ${count} 个场景`}
                                className={chipClass}
                                data-scene={category}
                                {...stop}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setActiveCategory(category);
                                }}
                            >
                                <Mountain aria-hidden="true" />
                                <span className="agent-scene-capsule-label">{SCENE_CATEGORY_LABELS[category]}</span>
                                <span className="agent-scene-capsule-meta">{count} 个场景</span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

/** 场景总数（渲染层/测试用，避免各处硬编码）。 */
export const SCENE_PRESET_COUNT = SCENE_PRESETS.length;
