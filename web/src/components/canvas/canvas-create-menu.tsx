import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { useToolHoverCard } from "@/components/ui/tool-hover-card";
import { aceternityMotion } from "@/lib/aceternity-motion";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import type { ToolHoverCardData } from "@/lib/canvas/tool-hover-card-data";
import { cn } from "@/lib/utils";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";

export type CanvasCreateCommand = {
    id: string;
    label: string;
    icon: ReactNode;
    badge?: string;
    section: "node" | "workflow" | "project" | "resource";
    /** hover 说明卡数据（可选；缺省回退原生 title） */
    hover?: ToolHoverCardData;
    onClick: () => void;
};

export function CanvasCreateMenu({ commands }: { commands: CanvasCreateCommand[] }) {
    const theme = canvasThemes[useActiveTheme()];
    const projectCommands = commands.filter((command) => command.section === "project");
    const nodeCommands = commands.filter((command) => command.section === "node");
    const workflowCommands = commands.filter((command) => command.section === "workflow");
    const resourceCommands = commands.filter((command) => command.section === "resource");

    return (
        <div>
            <header className="flex min-h-7 items-center justify-between gap-2 border-b pb-2" style={{ borderColor: theme.toolbar.border }}>
                <h2 className="font-semibold leading-none" style={{ fontSize: "var(--fs-caption)" }}>添加节点</h2>
                {projectCommands.map((command) => (
                    <ProjectCommandButton key={command.id} command={command} theme={theme} />
                ))}
            </header>

            <MenuSection title="创作节点" color={theme.node.muted} />
            <CanvasCreateCommandGrid commands={nodeCommands} variant="node" />

            {workflowCommands.length ? (
                <>
                    <MenuSection title="工作流" color={theme.node.muted} spaced />
                    <CanvasCreateCommandGrid commands={workflowCommands} variant="workflow" />
                </>
            ) : null}

            <MenuSection title="导入资源" color={theme.node.muted} spaced />
            <CanvasCreateCommandGrid commands={resourceCommands} variant="compact" />
        </div>
    );
}

function CanvasCreateCommandGrid({ commands, variant }: { commands: CanvasCreateCommand[]; variant: "node" | "compact" | "workflow" }) {
    const theme = canvasThemes[useActiveTheme()];
    const reducedMotion = useReducedMotion();

    return (
        <div className={cn("grid gap-1", variant === "node" ? "grid-cols-4" : variant === "workflow" ? "grid-cols-1" : "grid-cols-2")}>
            {commands.map((command) => (
                <GridCommandButton key={command.id} command={command} variant={variant} theme={theme} reducedMotion={reducedMotion} />
            ))}
        </div>
    );
}

function MenuSection({ title, color, spaced = false }: { title: string; color: string; spaced?: boolean }) {
    return <h3 className="mb-1 mt-2 px-1 font-medium leading-none" style={{ color, fontSize: "var(--fs-tiny)", marginTop: spaced ? "var(--space-4)" : "var(--space-2)" }}>{title}</h3>;
}

/** 菜单头项目按钮：带 hover 说明卡（无数据时维持原生 title 行为）。 */
function ProjectCommandButton({ command, theme }: { command: CanvasCreateCommand; theme: CanvasTheme }) {
    const hoverCard = useToolHoverCard({ data: command.hover, label: command.label, icon: command.icon });
    return (
        <button
            type="button"
            ref={hoverCard.setAnchor}
            className="inline-flex h-6 min-w-0 items-center gap-1 rounded-[var(--dock-item-radius)] px-1.5 font-medium outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/8 [&_svg]:size-3"
            style={{ color: theme.node.muted, fontSize: "var(--fs-tiny)", "--tw-ring-color": theme.node.muted } as CSSProperties}
            title={command.hover ? undefined : command.label}
            onMouseEnter={hoverCard.onEnter}
            onMouseLeave={hoverCard.onLeave}
            onFocus={hoverCard.onFocus}
            onBlur={hoverCard.onBlur}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={command.onClick}
        >
            {command.icon}
            <span className="whitespace-nowrap">{command.label}</span>
            {hoverCard.card}
        </button>
    );
}

/** 网格命令按钮：带 hover 说明卡（无数据时维持原生 title 行为）。 */
function GridCommandButton({ command, variant, theme, reducedMotion }: { command: CanvasCreateCommand; variant: "node" | "compact" | "workflow"; theme: CanvasTheme; reducedMotion: ReturnType<typeof useReducedMotion> }) {
    const hoverCard = useToolHoverCard({ data: command.hover, label: command.label, icon: command.icon });
    return (
        <motion.button
            type="button"
            ref={hoverCard.setAnchor}
            whileHover={reducedMotion ? undefined : { y: -1 }}
            whileTap={reducedMotion ? undefined : { scale: 0.98 }}
            transition={aceternityMotion.spring.dock}
            className={cn(
                "group min-w-0 overflow-hidden border border-black/10 bg-white/70 outline-none transition-colors hover:border-black/20 hover:bg-black/5 focus-visible:ring-2 dark:border-white/10 dark:bg-white/[.04] dark:hover:border-white/20 dark:hover:bg-white/8",
                variant === "node"
                    ? "flex h-[var(--canvas-create-node-height)] flex-col items-start justify-between rounded-[var(--dock-item-radius)] px-2 py-2 text-left"
                    : variant === "workflow"
                        ? "flex h-[var(--canvas-create-resource-height)] items-center justify-start gap-2 rounded-[var(--dock-item-radius)] px-2 text-left"
                        : "flex h-[var(--canvas-create-resource-height)] items-center justify-center gap-1.5 rounded-[var(--dock-item-radius)] px-2 text-center",
            )}
            style={{ color: theme.node.text, "--tw-ring-color": theme.node.muted } as CSSProperties}
            title={command.hover ? undefined : command.label}
            onMouseEnter={hoverCard.onEnter}
            onMouseLeave={hoverCard.onLeave}
            onFocus={hoverCard.onFocus}
            onBlur={hoverCard.onBlur}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={command.onClick}
        >
            {variant === "node" ? (
                <>
                    <span className="flex w-full min-w-0 items-center justify-between gap-1">
                        <span className="grid size-6 shrink-0 place-items-center opacity-65 transition-opacity group-hover:opacity-100 [&_svg]:size-5">{command.icon}</span>
                        {command.badge ? <span className="shrink-0 font-medium leading-none" style={{ color: theme.node.muted, fontSize: "var(--fs-tiny)" }}>{command.badge}</span> : null}
                    </span>
                    <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-medium leading-none" style={{ fontSize: "var(--fs-label)" }}>{command.label}</span>
                </>
            ) : (
                <>
                    <span className="grid size-4 shrink-0 place-items-center opacity-65 transition-opacity group-hover:opacity-100 [&_svg]:size-3.5">{command.icon}</span>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium leading-none" style={{ fontSize: "var(--fs-label)" }}>{command.label}</span>
                </>
            )}
            {hoverCard.card}
        </motion.button>
    );
}
