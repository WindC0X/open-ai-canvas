# implement — P4 族3 角色引用与分镜 flora 化

## S1 角色引用 chip 交互（R17）
- [x] 读生成提交链：角色生成链已通（type:character 输入/CharacterGenerationReference/分镜行文本注入）；缺口=chip UI + 行生成角色图注入
- [x] 分镜行角色槽 UI（宿主 canvas-script-node.tsx assets 列）：StoryboardAssetsCell 交互化（hover Remove aria-label=`移除 <title> 引用` + 添加 Popover 列 buildStoryboardAssetCatalog 目录，排除已绑定）
- [x] 数据流：storyboardRowAssetBindingPatch 纯函数（canvas-storyboard-assets.ts）统一增删 + characters 同步；8 单测全绿；Content/Editor 两调用点接线
- [ ] 生成链验证：绑定角色后行生成的 prompt/references 含角色图（mock 渠道冒烟）
- [ ] 提交 `feat(canvas): 角色引用chip - 分镜行绑定角色资产节点(R17语法)`

## S2 角色槽位端口（R18）
- [ ] handle 前缀 `character:` + 几何常量（沿用 BATCH_REFERENCE_HANDLE 模式）
- [ ] planBatchConnections 角色扩展（source 校验图像资产节点/去重/上限）
- [ ] 空槽 helper 文案 + cursor 语义（R18）
- [ ] 连线 → chip 同步（连线 commit 写行内 characters/bindings）
- [ ] 提交 `feat(canvas): 角色槽位端口 - 连线绑定与空槽helper(R18契约)`

## S3 分镜表格 flora 化
- [ ] batch-table 节点视觉令牌化（玻璃 surface/滚动条权威规则/微供给接线）
- [ ] chip 行回嵌表格
- [ ] 提交 `feat(canvas): 分镜表格flora化 - 表格节点接入既有令牌与微供给`

## S4 终验收
- [ ] bunx tsc 0 + bun run build + 全量测试基线对照（同盘）
- [ ] 真机验收 A1-A4（A1 chip 增删与 Remove 交互；A2 端口连线绑定与 helper 文案；A3 绑定后生成 prompt 含角色图；A4 表格 flora 视觉+明暗主题）
- [ ] pending-test.mdx 登记 + 07-TOTAL-SCHEME-STATUS 快照刷新（P4 族序 4/4）+ 归档

## 验证命令
- `cd web && bunx tsc --noEmit`
- `cd web && bun run build`
- `cd web && bun test test/canvas-batch-table*.test.* test/canvas-affordance.test.ts`（按范围增量）
