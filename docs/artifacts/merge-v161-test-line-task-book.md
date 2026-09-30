# merge-v1.6.1 测试线任务书

> 控制线拟，2026-09-30。测试线执行，纪律照旧：单 commit 不 push、STOP-report、不改产品码、证据留痕。
> 上游批：rider 2（e0a2697c..d328a257，13 commits / 227 files，主体=7f5d87ef 平台架构拆分）。
> 开发线状态：merge-v1.6.1 @ 5e14fbc5（oac-wt-merge-v161），控制线独立验收 12/12 已过。

## 一、被测对象与栈切换

- **批树**：`/mnt/f/CODE/Project/oac-wt-merge-v161`（branch merge-v1.6.1 @ `5e14fbc5`）
- twin 栈切换：:3400 web 的 vite cwd 从 oac-wt-test 切到 oac-wt-merge-v161/web（同 fc8337f9 系后端 :8482 不变；twin db 沿用现库，无需重新迁移数据）
- 切换后先跑一次 auth + 首屏 smoke 确认起服务

## 二、S1 twin 数据冒烟（拆分域聚焦）

v1.6.0 的 S1 已证 748 画布零丢失；本批聚焦**拆分重构触碰的持久化域**：

1. card06 域：水位门 + 校准分支落在新家 `web/src/services/user-data-sync.ts` / `-media.ts`——用真实 twin 库验证：改一个画布 → 关页 → 重开，水位/内容同步正常（老数据无 409/428 校准风暴）
2. 媒体节点：视频节点（loop 属性落 media-content）重开画布后循环播放仍生效；音频节点设置面板（14 键情感族）打开/保存/重开不丢
3. Agent 面板拆分域：已有会话的历史消息渲染完整（panel-parts/events/composer/attachments 四拆分文件拼接后无消息丢失/错位）

## 三、S2 行为回归（S1-S7 五跑门，ext4 上）

- S1-S7 全套五轮（Playwright 五跑行为位/守卫 35 口径不变；S4 SPECIAL 维持 skip 口径，S4 spec 已能力化）
- 背景：A线 在 drvfs 上 Go e2e 族串行第 4 条超时（v1.6.0 同位先例），五跑门必须在 ext4 上复证
- 重点行为位：Agent 审批链（反转语义 + H1 x/y 审批门）、撤销条、starter 命令、prefill 幂等

## 四、VRT 三面重采（本批核心价值面）

1. **Agent 面板面（必采）**——panel.tsx −1033 拆分是本批最大重写，视觉基线必须重采
2. 画布缩略图面、工作台 Agent 面（按 drift 触发）
3. 用 backup+delete 后重采法（playwright --update 不覆写既有基线——序6 教训）

## 五、e2e 门复证（可选加分项）

A线 交付的 Go e2e 族 5 条（Pi runtime 审批链）在 ext4 twin 后端上跑一遍，消解 drvfs 超时疑云；环境不足可跳过并在报告中说明。

## 六、报告格式（照序6 惯例）

- 每轮结果与失败详情（含截图/日志行证据）
- 发现分级：阻塞 / 非阻塞回归 / 环境差异
- VRT 重采前后对比说明（如 diff 出问题：归因到具体 commit，不做就地修复）
- 单 commit 不 push，STOP-report
