import { ArrowUpRight } from "lucide-react";
import { ECOM_STARTER_ICONS, ecomStarterSubtitle, resolveSceneStarterCards } from "@/lib/canvas/canvas-ecom-starters";
import { AGENT_SCENE_DEFS } from "./canvas-cloud-agent-chat-ui";

/**
 * S1 v3.2（控制线 2026-09-27）：场景钻取卡区——挂在技能胶囊条下方、输入框上方。
 * 广告电商：组头「{场景名} · 快捷开始」+ 2×2 磁贴（复用四张 starter 卡：文案/澄清链/chip 全不动）；
 * 其余场景 resolveSceneStarterCards 返回 null → 零渲染（无假空态）。
 */
export function AgentSceneCards({ sceneKey, freeExperience, disabled = false, onRunStarter }: {
    sceneKey: string;
    freeExperience?: boolean;
    disabled?: boolean;
    onRunStarter: (prompt: string) => void;
}) {
    const cards = resolveSceneStarterCards(sceneKey);
    if (!cards) return null;
    const sceneLabel = AGENT_SCENE_DEFS.find((definition) => definition.key === sceneKey)?.label || sceneKey;
    return (
        <section className="agent-scene-cards" data-scene-cards={sceneKey} aria-label={`${sceneLabel} · 快捷开始`}>
            <p className="agent-scene-cards-title">{sceneLabel} · 快捷开始</p>
            <div className="agent-scene-cards-grid">
                {cards.map((card) => {
                    const Icon = ECOM_STARTER_ICONS[card.icon];
                    return (
                        <button key={card.id} type="button" className="agent-scene-card" disabled={disabled} onClick={() => onRunStarter(card.prompt)}>
                            <Icon aria-hidden="true" />
                            <span className="agent-scene-card-text">
                                <strong>{card.title}</strong>
                                <small>{ecomStarterSubtitle(card, freeExperience)}</small>
                            </span>
                            <ArrowUpRight className="agent-scene-card-arrow" aria-hidden="true" />
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
