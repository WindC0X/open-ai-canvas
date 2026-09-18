# implement — P4 族3 角色引用与分镜 flora 化

## S1 角色引用 chip 交互（R17）
- [x] 读生成提交链：角色生成链已通（type:character 输入/CharacterGenerationReference/分镜行文本注入）；缺口=chip UI + 行生成角色图注入
- [x] 分镜行角色槽 UI（宿主 canvas-script-node.tsx assets 列）：StoryboardAssetsCell 交互化（hover Remove aria-label=`移除 <title> 引用` + 添加 Popover 列 buildStoryboardAssetCatalog 目录，排除已绑定）
- [x] 数据流：storyboardRowAssetBindingPatch 纯函数（canvas-storyboard-assets.ts）统一增删 + characters 同步；8 单测全绿；Content/Editor 两调用点接线
- [ ] 生成链验证：绑定角色后行生成的 prompt/references 含角色图（mock 渠道冒烟）
- [ ] 提交 `feat(canvas): 角色引用chip - 分镜行绑定角色资产节点(R17语法)`

## S2 角色槽位端口（R18）
- [x] handle 方案收敛：复用既有行级 `row:<id>` handle（left=target 连资产即写 binding），**不新增** `character:` 前缀——连线→binding 写入/去重链（applyStoryboardLinkage + bindingForConnectedNode）已存在，重复造口只会分叉数据流
- [x] 校验面：去重（连线侧已有）+ 上限 MAX_ROW_ASSET_BINDINGS=8（patch 纯函数拦截 + cell + 钮禁用；flora 无上限证据，参照 batch-table=6 先例自设计登记）
- [x] 空槽 helper「连接角色图像节点，或点击选择画布资产」+ handle Tooltip 语义化；flora source cursor:not-allowed（technique 无输出禁连出）本地无对应物，登记不采纳
- [x] 连线→chip 同步：连线写 assetBindings → cell 即时渲染（既有链验证通过）；chip 侧增删走 S1 patch（双向一致）
- [ ] 提交 `feat(canvas): 角色槽位端口 - 连线绑定与空槽helper(R18契约)`

## S3 分镜表格 flora 化【2026-09-18 裁剪收口：验证性结论，零新代码】
- [x] 微供给接线：affordance 状态机节点类型无关（affordance.ts 输入仅 nodeId/hovered/dialog/selected/selfHover），Script 节点已在体系内
- [x] 令牌化：canvas-script-node 表格全程 theme.* token（node.stroke/panel/muted/accent），无直改 globals（PATCH-MAP 纪律 ✓）
- [x] chip flora 视觉：S1 已复用 AssetChip 族（36px 缩略+role 徽章+hover 交互），与 flora minimum-units Character Image 306×40 横向小卡语法同构
- [x] 语料对照：flora 无分镜表格/角色卡大面板证据 → 按"无证据不发明"不做额外改造；明暗主题真机过检并入 S4

## S4 终验收
- [ ] bunx tsc 0 + bun run build + 全量测试基线对照（同盘）
- [ ] 真机验收 A1-A4（A1 chip 增删与 Remove 交互；A2 端口连线绑定与 helper 文案；A3 绑定后生成 prompt 含角色图；A4 表格 flora 视觉+明暗主题）
- [ ] pending-test.mdx 登记 + 07-TOTAL-SCHEME-STATUS 快照刷新（P4 族序 4/4）+ 归档

## 验证命令
- `cd web && bunx tsc --noEmit`
- `cd web && bun run build`
- `cd web && bun test test/canvas-batch-table*.test.* test/canvas-affordance.test.ts`（按范围增量）
