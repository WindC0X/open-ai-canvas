import type { ReactNode } from "react";

import type { NodePreviewKind } from "@/lib/canvas/tool-hover-card-data";

/**
 * S2.1 · 节点类 hover 卡预览：11 种手写 SVG mockup（零位图资产，任意 DPI 清晰）。
 * 统一规格：节点标题栏（小图标 + 示例标题 + 类型徽章）+ 内容示意。
 */

const META: Record<NodePreviewKind, { title: string; badge: string }> = {
    text: { title: "开场旁白", badge: "文本" },
    drawing: { title: "场景草图", badge: "绘图" },
    script: { title: "镜头脚本", badge: "分镜" },
    frame: { title: "场景背板", badge: "背板" },
    folder: { title: "参考素材", badge: "文件夹" },
    image: { title: "山间日落", badge: "图片" },
    video: { title: "镜头 01", badge: "视频" },
    "batch-table": { title: "批量生成表", badge: "批量" },
    "media-conversion": { title: "转 MP4", badge: "转换" },
    director: { title: "机位 A", badge: "3D" },
    audio: { title: "主题配乐", badge: "音频" },
};

const OUTLINE = "rgba(255,255,255,0.22)";
const SOFT_FILL = "rgba(255,255,255,0.06)";

/** 节点 mini 卡片外框：标题栏 + 类型徽章（所有 mockup 共用） */
function MockNodeFrame({ title, badge, children }: { title: string; badge: string; children: ReactNode }) {
    return (
        <g>
            <rect x="63" y="44" width="240" height="140" rx="12" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.106)" />
            <rect x="75" y="56" width="16" height="16" rx="4" fill="rgba(255,255,255,0.1)" />
            <text x="97" y="68" fontSize="10" fill="#cfcfcf">
                {title}
            </text>
            <rect x="239" y="56" width="52" height="16" rx="8" fill="rgba(255,255,255,0.06)" />
            <text x="265" y="68" fontSize="9" fill="#949494" textAnchor="middle">
                {badge}
            </text>
            {children}
        </g>
    );
}

const SKETCHES: Record<NodePreviewKind, ReactNode> = {
    text: (
        <g fill="rgba(255,255,255,0.13)">
            <rect x="75" y="96" width="168" height="8" rx="4" />
            <rect x="75" y="116" width="148" height="8" rx="4" />
            <rect x="75" y="136" width="116" height="8" rx="4" />
        </g>
    ),
    drawing: (
        <g fill="none" stroke="#a8a8a8" strokeWidth="2.5" strokeLinecap="round">
            <path d="M78 152 C104 100 132 166 160 116 S216 96 244 128 S276 150 288 120" />
        </g>
    ),
    script: (
        <g>
            <rect x="75" y="94" width="100" height="58" rx="6" fill={SOFT_FILL} stroke={OUTLINE} />
            <rect x="83" y="134" width="84" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
            <rect x="191" y="94" width="100" height="58" rx="6" fill={SOFT_FILL} stroke={OUTLINE} />
            <rect x="199" y="134" width="84" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
        </g>
    ),
    frame: (
        <g>
            <rect x="88" y="90" width="190" height="76" rx="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeDasharray="7 7" />
            <rect x="100" y="102" width="64" height="32" rx="6" fill="rgba(255,255,255,0.07)" />
            <rect x="180" y="120" width="64" height="32" rx="6" fill="rgba(255,255,255,0.07)" />
        </g>
    ),
    folder: (
        <path
            d="M84 162v-54a6 6 0 0 1 6-6h30l12 12h62a6 6 0 0 1 6 6v42a6 6 0 0 1-6 6H90a6 6 0 0 1-6-6z"
            fill="rgba(255,255,255,0.07)"
            stroke={OUTLINE}
        />
    ),
    image: (
        <g>
            <circle cx="248" cy="106" r="11" fill="none" stroke="#a8a8a8" strokeWidth="2" />
            <path d="M78 158 L120 110 L146 138 L170 112 L214 158 Z" fill="rgba(255,255,255,0.09)" stroke={OUTLINE} strokeLinejoin="round" />
            <path d="M138 158 L166 132 L196 158 Z" fill="rgba(255,255,255,0.05)" />
        </g>
    ),
    video: (
        <g>
            <rect x="75" y="92" width="216" height="66" rx="8" fill="rgba(255,255,255,0.03)" stroke={OUTLINE} />
            <circle cx="183" cy="125" r="15" fill="none" stroke="rgba(255,255,255,0.3)" />
            <path d="M179 118 l12 7 -12 7 z" fill="#a8a8a8" />
            <rect x="75" y="166" width="216" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
            <rect x="75" y="166" width="72" height="4" rx="2" fill="rgba(255,255,255,0.3)" />
        </g>
    ),
    "batch-table": (
        <g>
            <rect x="75" y="92" width="216" height="72" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.16)" />
            <path d="M147 92v72M219 92v72" stroke="rgba(255,255,255,0.1)" />
            <path d="M75 116h216M75 140h216" stroke="rgba(255,255,255,0.1)" />
        </g>
    ),
    "media-conversion": (
        <g>
            <rect x="75" y="102" width="80" height="56" rx="6" fill="rgba(255,255,255,0.03)" stroke={OUTLINE} />
            <path d="M83 148 l16 -20 10 12 8 -9 12 17 z" fill="rgba(255,255,255,0.12)" />
            <path d="M165 130h34" stroke="#a8a8a8" strokeWidth="2" fill="none" />
            <path d="M193 124 l8 6 -8 6" stroke="#a8a8a8" strokeWidth="2" fill="none" strokeLinejoin="round" />
            <rect x="213" y="102" width="78" height="56" rx="6" fill="rgba(255,255,255,0.03)" stroke={OUTLINE} />
            <path d="M244 120 l14 10 -14 10 z" fill="rgba(255,255,255,0.2)" />
        </g>
    ),
    director: (
        <g stroke={OUTLINE} strokeLinejoin="round">
            <path d="M183 88 L228 110 L183 132 L138 110 Z" fill="rgba(255,255,255,0.08)" />
            <path d="M228 110v36l-45 22v-36z" fill="rgba(255,255,255,0.04)" />
            <path d="M138 110v36l45 22v-36z" fill="rgba(255,255,255,0.06)" />
        </g>
    ),
    audio: (
        <g fill="rgba(255,255,255,0.3)">
            {[24, 40, 56, 72, 88, 72, 56, 40, 24].map((height, index) => (
                <rect key={height + "-" + index} x={123 + index * 15} y={128 - height / 2} width="8" height={height} rx="4" />
            ))}
        </g>
    ),
};

export function NodePreviewMockup({ kind }: { kind: NodePreviewKind }) {
    return (
        <svg viewBox="0 0 366 229" className="h-full w-full" aria-hidden="true" focusable="false" data-mockup-kind={kind}>
            <MockNodeFrame title={META[kind].title} badge={META[kind].badge}>
                {SKETCHES[kind]}
            </MockNodeFrame>
        </svg>
    );
}
