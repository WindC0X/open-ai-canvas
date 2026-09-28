/**
 * 画布帮助入口的外链常量（S3「? 帮助菜单」四件套）。
 *
 * 产品裁定（控制线 2026-09-28）：在线平台不向用户暴露项目仓库（含上游），
 * 帮助入口一律不得指向 GitHub。文档站属产品侧域名基建：就绪后填入
 * `DOCS_BASE_URL` 即全链路启用；为空期间教程菜单项保持禁用并提示「教程编写中」。
 */

/** 文档站基址（产品域名文档站待定；禁止指向 GitHub。就绪后填入即启用，如 "https://docs.example.com"）。 */
export const DOCS_BASE_URL = "";

/** 教程目标相对路径（S4 2026-09-28 定稿结构：getting-started/quick-start；产品域名就绪后随 DOCS_BASE_URL 启用）。 */
export const DOCS_QUICKSTART_PATH = "/docs/getting-started/quick-start";

/** 教程完整链接；`DOCS_BASE_URL` 为空时返回空串（调用方按禁用态处理）。 */
export function getDocsQuickstartUrl(): string {
    const base = DOCS_BASE_URL.replace(/\/+$/, "");
    return base ? `${base}${DOCS_QUICKSTART_PATH}` : "";
}

/** 反馈支持邮箱（邮件通道，mailto 预填聚合文本）。 */
export const FEEDBACK_SUPPORT_EMAIL = "fengw5774@gmail.com";

/** 反馈用户群加群链接（入群后粘贴已复制的反馈内容）。 */
export const FEEDBACK_CHANNEL_URL = "https://qm.qq.com/q/3yojnHm7QI";
