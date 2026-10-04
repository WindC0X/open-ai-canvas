/**
 * 直线入口卡网格（W5 直线入口设计卡 §3.1 梯度 0 / §五文件清单）。
 *
 * ★ 位置纪律：挂在 `/create` 空态（`creation-workspace-empty.tsx` 的 launchpad 区），
 * 与既有 `CreationEmptySuggest`（快捷入口）并列 —— 不新增一级导航（一级导航上限 8 裁定），
 * 不新增页面（A4 不为工具发现新增一级页）。
 *
 * ★ 与 `CreationEmptySuggest` 的分工：
 *   前者 = 快捷入口（回填提示词到输入框，用户继续走对话）
 *   本组件 = **可执行卡**（点卡直接进直线流程，端到端出图+下载，不见画布）
 * 两者并存不互斥：用户想要对话就点快捷入口，想要直接出图就点可执行卡。
 */
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUp } from "lucide-react";

import { aceternityMotion } from "@/lib/aceternity-motion";
import { LINEAR_FLOW_CARDS, linearFlowCardIcon, type LinearFlowCard } from "@/lib/canvas/linear-flow-cards";

export function LinearFlowCardGrid({
    onPick,
    disabled = false,
}: {
    /** 选中卡 → 进入直线流程（由 `linear-flow-runner` 承载）。 */
    onPick: (card: LinearFlowCard) => void;
    disabled?: boolean;
}) {
    const reducedMotion = useReducedMotion();
    const [hovered, setHovered] = useState<string | null>(null);
    return (
        <section className="linear-flow-card-grid" aria-label="一键出图">
            <div className="linear-flow-card-grid-heading">
                <h2>一键出图</h2>
                <p>选一张卡，按提示走完就能拿到成品图 —— 全程不用进画布</p>
            </div>
            <div className="linear-flow-card-list" role="list">
                {LINEAR_FLOW_CARDS.map((card) => {
                    const Icon = linearFlowCardIcon(card);
                    return (
                        <motion.button
                            key={card.id}
                            type="button"
                            role="listitem"
                            className="linear-flow-card"
                            data-card-id={card.id}
                            disabled={disabled}
                            onClick={() => onPick(card)}
                            onHoverStart={() => setHovered(card.id)}
                            onHoverEnd={() => setHovered(null)}
                            whileHover={reducedMotion || disabled ? undefined : { y: -2 }}
                            transition={aceternityMotion.spring.surface}
                        >
                            <span className="linear-flow-card-icon">
                                <Icon size={18} strokeWidth={2} />
                            </span>
                            <span className="linear-flow-card-copy">
                                <strong>{card.title}</strong>
                                <span>{card.hint}</span>
                            </span>
                            <span className={`linear-flow-card-go ${hovered === card.id ? "is-active" : ""}`} aria-hidden>
                                <ArrowUp size={16} strokeWidth={2} />
                            </span>
                        </motion.button>
                    );
                })}
            </div>
        </section>
    );
}
