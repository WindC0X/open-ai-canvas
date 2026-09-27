/**
 * 反馈聚合纯函数：把反馈表单输入组装为可复制的反馈文本。
 *
 * 纪律（控制线「聚合透明度」原则）：
 * - 只消费白名单字段，不读取任何全局状态（window / navigator 由调用方取值传入，函数保持确定性可测）；
 * - `meta` 输出即界面「将包含以下信息」明示区所渲染的内容，与实际复制文本逐条一致；
 * - 不包含 Cookie / 密钥 / 授权头等敏感字段；分享链接仅当用户显式勾选且已开启分享时出现。
 */

export type FeedbackPayloadMeta = {
    /** 应用版本（`v` 前缀会被归一为单前缀） */
    appVersion: string;
    /** 当前页面路径（pathname） */
    pathname: string;
    /** 画布 ID（可选） */
    canvasId?: string;
    /** 画布节点数（可选） */
    nodeCount?: number;
    /** 浏览器 UA 摘要（调用方截断） */
    userAgent: string;
    /** 采集时间（ISO 8601） */
    capturedAt: string;
};

export type FeedbackPayloadInput = {
    /** 问题描述（必填；空串/纯空白拒绝） */
    description: string;
    /** 截图文件名（图片本身不上传，仅记录名称，提示手动粘贴） */
    screenshotName?: string;
    /** 画布分享链接（用户勾选且分享可用时才有值） */
    shareUrl?: string;
    meta: FeedbackPayloadMeta;
};

/** 组装「将包含以下信息」明示区与反馈文本共用的白名单元信息（键即展示标签，插入序即展示序）。 */
export function buildFeedbackMeta(meta: FeedbackPayloadMeta): Record<string, string> {
    return {
        "版本": `v${meta.appVersion.replace(/^v+/i, "")}`,
        "页面": meta.pathname,
        ...(meta.canvasId ? { "画布 ID": meta.canvasId } : {}),
        ...(typeof meta.nodeCount === "number" && Number.isFinite(meta.nodeCount) ? { "画布节点数": String(meta.nodeCount) } : {}),
        "时间": meta.capturedAt,
        "浏览器": meta.userAgent,
    };
}

/** 组装完整反馈文本；`meta` 返回值与明示区一致。空描述抛错，由调用方先行校验。 */
export function buildFeedbackPayload(input: FeedbackPayloadInput): { text: string; meta: Record<string, string> } {
    const description = input.description.trim();
    if (!description) throw new Error("请填写问题描述");

    const meta = buildFeedbackMeta(input.meta);
    const lines = [
        "# 画布反馈",
        "",
        "## 问题描述",
        description,
        ...(input.shareUrl ? ["", "## 分享链接", input.shareUrl] : []),
        ...(input.screenshotName ? ["", "## 截图", `${input.screenshotName}（图片未自动上传，请在反馈渠道中手动粘贴）`] : []),
        "",
        "## 自动附加信息",
        ...Object.entries(meta).map(([label, value]) => `- ${label}：${value}`),
    ];

    return { text: `${lines.join("\n")}\n`, meta };
}
