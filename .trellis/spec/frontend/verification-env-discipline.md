# 前端验证与环境纪律（影策 flora 工作）

> 来自 S04/S05/S06 实现-验证循环的可执行教训。验证声明必须与实际执行一致。

---

## Forbidden Patterns

### 1. 声明超出已验证事实
- `tsc`/`build` 通过 ≠ 功能验证。提交信息与文档**不得**写"已修复/已验证"除非对应证据真实存在。
- 反例（真实发生）：b66c11a 提交说明里写了 fitToImage 修复但代码未改，下一个提交 3d34b82 补实装。
- 规则：提交前对照 `git diff` 逐条核对提交信息里的每个断言。

### 2. 用 rAF 做跨层上报合帧
- **后台/冻结标签（💤）rAF 不触发**。任何"事件 → setState/prop 上报"的合帧必须用 RO 原生合批 + 值去重，禁用 `requestAnimationFrame`。
- 案例：S06 任务面板高度上报初版用 rAF，后台标签里对象 HUD 永不让位。

### 3. 静态动画常量硬编码 rgba
- 媒体区填充/覆盖类颜色必须走 `canvasThemes`（node 组 token，明暗两值），不得硬编码 flora 暗色值（flora 语料是 dark-only，明主题下不可见）。

---

## Required Patterns

### 验证环境启动顺序（浏览器验证前必做）
1. 后端：`cd backend && CANVAS_BACKEND_DATA_DIR=$HOME/flora-quiet-check CANVAS_BACKEND_ADDR=0.0.0.0:8081 nohup go run ./cmd/server > /tmp/backend.log 2>&1 &`
   - 旧库 schema 不匹配时按 MASTER-PLAN 本地状态污染预案处理（归档 + 重建 + 程序化搬迁账号/渠道）。
   - 测试账号 floracheck / s04verify（本地 dev）。
2. vite：**必须** `VITE_API_PROXY_TARGET=http://127.0.0.1:8081`（默认 8080 被无关 sub2api 服务占用）。
3. 浏览器：tmwd 桥（WSL 用 Windows 网关 IP 连 18766，不能 127.0.0.1）。

### WSL /mnt/f vite watcher 失效处理
- 症状：改代码后 HMR 不生效；**无 query 的模块请求返回旧代码、带 query 返回新代码**（transform 缓存陈旧）。
- 判定：`curl -s http://localhost:3000/src/<模块路径> | grep -c <新代码特征字符串>` 为 0 即命中。
- 处理：**重启 vite**（touch 无效，drvfs inotify 丢事件）。
- 纪律：/mnt/f 上每次改码后、浏览器验证前先 curl 验证服务端产物，再怀疑代码本身。

### tmwd 桥能力边界（TMWebDriver.py /link 端点）
- 仅支持 3 个命令：`execute_js` / `get_all_sessions` / `find_session`。
- 其它 cmd（`cdp`/`tabs`/`status`/`batch`）**静默返回字符串 'ok' 假成功**——结果不会执行。不要再用它们做 reload/navigate/createTarget。
- `get_all_sessions` 枚举 chrome.tabs 全量（含 💤 冻结标签）；`execute_js` 需要标签内容脚本活着（💤 标签 ACK 不回结果）。
- 注入失败两态：`No response data (ACK received)` = 内容脚本收到但页面冻结/忙；`CDP fallback failed: Another debugger` = 该标签被其它 debugger 占用（DevTools/助手扩展）。
- **先查调用方再怀疑桥**：2026-09-06 实录——自写 helper /tmp/tmw.py 用 `script` 字段发码，而服务端读 `data.get('code')`（TMWebDriver.py:100），导致每次实际发出 `code:null`→空脚本→CDP fallback 风暴，被误诊成“桥卡死/MV3 锁死”。判定方法：同一个标签上用直接 heredoc `code` 字段发一针短探针，通则问题在调用方。另外服务端在会话未连接时会**静默回退到其它活动标签**（TMWebDriver.py:202-206）——每次注入前必须带 `location.href` 守卫断言目标标签身份。
- MV3 service worker 的 CDP 串行锁可能卡死（症状：所有标签都报 Another debugger）→ 让用户在 chrome://extensions 重载 tmwd 扩展。

### 影策生成链路测试要点
- 无 canvas-creation REST 端点（POST /api/canvases 404）；画布经 UI `新建画布` 创建，节点加经 UI 菜单。
- 后端任务 progress 是**里程碑不是百分比**：创建 5（等待队列调度）→ worker 接单 0（正在连接上游，注释明言"不冒充真实进度"）→ 完成 100。前端展示层凡消费 progress 必须**把 ≤5/0 视为"未知"**（保持当前刻度或 fallback），不得当真实 0% 渲染。
- composer 生成按钮：icon-only antd Button，`aria-label="预计消耗 X 积分，生成"`，textContent 为空，选择器必须用 aria-label 正则。
- 后台标签做采样器：页面 setInterval 会被节流，长时序验证应在单次 execute_js 内完成采样（注入的 async IIFE 里自采样自汇总）。

---

## Testing Requirements

- 组件三态等纯逻辑抽成导出纯函数（如 `resolveLoadingFillPhase`），用 bun:test SSR（renderToStaticMarkup）断言；项目无 @testing-library。
- 跨帧时序（缓爬推进、transition 过程）SSR 测不到，只能浏览器实测；pending-test.mdx 记录实测与遗留边界。
- 每次交付 `cd web && bunx tsc --noEmit && bun run build` 双绿为底线。
