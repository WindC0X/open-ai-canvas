export type CanvasColorTheme = "light" | "dark";
export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export const canvasThemes = {
    light: {
        canvas: {
            background: "#f0f0f0",
            dot: "rgba(0,0,0,.80)",
            line: "rgba(0,0,0,.80)",
            selectionFill: "rgba(17,17,17,.10)",
        },
        node: {
            label: "#4b5563",
            agentUserMessage: "#edf6ff",
            fill: "#ffffff",
            panel: "#ffffff",
            stroke: "#e2e4e8",
            edge: "rgba(15,23,42,.16)",
            // 安静化(DESIGN.md 表面补录):与 dark 侧同档收敛
            shadow: "0 4px 12px rgba(15,23,42,.07)",
            hoverShadow: "0 6px 16px rgba(15,23,42,.10)",
            activeStroke: "#111827",
            activeBorder: "#333333",
            placeholder: "#9ca3af",
            text: "#111827",
            muted: "#6b7280",
            groupTitle: "rgba(0,0,0,.85)",
            groupFill: "rgba(0,0,0,.035)",
            faint: "#9ca3af",
            // 生成中媒体区进度填充(S04, flora BlockLoadingState bg-white/10 对应物):明底取暗色同族 alpha 保持可感知
            loadingFill: "rgba(17,24,39,.07)",
        },
        frame: {
            fill: "rgba(17,24,39,.025)",
            stroke: "rgba(17,24,39,.18)",
            activeFill: "rgba(17,17,17,.05)",
            activeStroke: "#171717",
            preview: "rgba(255,255,255,.82)",
        },
        toolbar: {
            // 安静化(DESIGN.md 表面补录):与 dark 侧同策略,降低不透明度
            panel: "rgba(255,255,255,.92)",
            border: "rgba(17,24,39,.10)",
            item: "#4b5563",
            itemHover: "rgba(17,24,39,.06)",
            activeBg: "rgba(17,24,39,.10)",
            activeText: "#111827",
        },
        spatial: {
            surface: "rgba(255,255,255,.72)",
            elevated: "rgba(255,255,255,.94)",
            dropzone: "rgba(248,250,252,.78)",
            glow: "rgba(17,17,17,.14)",
            glowStrong: "rgba(17,17,17,.42)",
            shadow: "rgba(15,23,42,.18)",
        },
        // 时间线/字幕组件语义色：轨道底、按类型区分的片段、标尺与播放头、字幕列表条目态。
        timeline: {
            trackFill: "#f6f8fb",
            trackBorder: "rgba(17,24,39,.08)",
            clipVideo: "rgba(79,110,232,.16)",
            clipAudio: "rgba(16,185,129,.14)",
            clipSubtitle: "rgba(245,158,11,.16)",
            clipSelectedBorder: "#171717",
            handle: "rgba(255,255,255,.72)",
            rulerTick: "rgba(17,24,39,.28)",
            rulerLabel: "#6b7280",
            playhead: "#171717",
            entryActive: "rgba(17,17,17,.10)",
            entryHover: "rgba(17,24,39,.05)",
        },
        accent: {
            primary: "#171717",
            primarySoft: "rgba(17,17,17,.10)",
            onPrimary: "#ffffff",
            danger: "#f87171",
        },
    },
    dark: {
        canvas: {
            background: "#000000",
            dot: "rgba(175,175,175,.80)",
            line: "rgba(175,175,175,.80)",
            selectionFill: "rgba(255,255,255,.12)",
        },
        node: {
            label: "#a3a3a3",
            fill: "#181818",
            agentUserMessage: "#182b40",
            panel: "#141414",
            stroke: "rgba(255,255,255,.12)",
            edge: "rgba(255,255,255,.18)",
            // 安静化(DESIGN.md 表面补录):阴影收敛到 --shadow-md 档,低模糊克制升高
            shadow: "0 4px 12px rgba(0,0,0,.30)",
            hoverShadow: "0 6px 16px rgba(0,0,0,.38)",
            activeStroke: "#f1f1f1",
            activeBorder: "#d9d9d9",
            placeholder: "#737373",
            text: "#ededed",
            muted: "#a3a3a3",
            // 参数面板组标题(用户 2026-09-11: 与选项 hover 字亮度同档, 比 muted 亮一档)
            groupTitle: "rgba(255,255,255,.92)",
            // 参数面板组卡片背景(用户 2026-09-11: 组块要有背景色分块, 参考 flora 分组卡)
            groupFill: "rgba(255,255,255,.05)",
            faint: "#666666",
            // 生成中媒体区进度填充(S04):flora 原值 bg-white/10
            loadingFill: "rgba(255,255,255,.10)",
        },
        frame: {
            fill: "rgba(255,255,255,.025)",
            stroke: "rgba(190,198,210,.15)",
            activeFill: "rgba(255,255,255,.08)",
            activeStroke: "#f5f5f5",
            preview: "rgba(20,20,20,.94)",
        },
        toolbar: {
            // 安静化(DESIGN.md 表面补录):alpha 表面 + 细边框,去投影(flora 工具条语法)
            panel: "rgba(20,20,20,.92)",
            border: "rgba(255,255,255,.10)",
            item: "#d4d4d4",
            itemHover: "rgba(255,255,255,.07)",
            activeBg: "rgba(255,255,255,.10)",
            activeText: "#f5f6f8",
        },
        spatial: {
            surface: "rgba(22,22,22,.82)",
            elevated: "rgba(15,15,15,.97)",
            dropzone: "rgba(8,8,8,.9)",
            glow: "rgba(255,255,255,.12)",
            glowStrong: "rgba(255,255,255,.36)",
            shadow: "rgba(0,0,0,.6)",
        },
        timeline: {
            trackFill: "#101114",
            trackBorder: "rgba(255,255,255,.08)",
            clipVideo: "rgba(96,126,234,.22)",
            clipAudio: "rgba(16,185,129,.20)",
            clipSubtitle: "rgba(245,158,11,.20)",
            clipSelectedBorder: "#f5f5f5",
            handle: "rgba(255,255,255,.5)",
            rulerTick: "rgba(255,255,255,.26)",
            rulerLabel: "#a3a3a3",
            playhead: "#f5f5f5",
            entryActive: "rgba(255,255,255,.10)",
            entryHover: "rgba(255,255,255,.06)",
        },
        accent: {
            primary: "#f5f5f5",
            primarySoft: "rgba(255,255,255,.11)",
            onPrimary: "#131313",
            danger: "#fb7185",
        },
    },
} as const;

export type CanvasTheme = (typeof canvasThemes)[CanvasColorTheme];
