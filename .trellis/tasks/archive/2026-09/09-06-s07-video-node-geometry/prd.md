# S07：Video 节点几何补齐（对齐 S05 Image 语义）

## 背景

S05 为 Image 节点落地了两项几何契约：空节点创建跟随渠道模型默认比例（b66c11a）、fitToImage 同比例不跳变守卫（3d34b82）。Video 节点是同族问题但当时明确记为 follow-up：

- 用户 2026-09-05 报告的"同比例生成前后大小不一致"在 Video 上同样成立且**更严重**：完成路径一律 `fitNodeSize(…, 720, 520)`，1:1 视频会从 405×405 跳到 520×520。
- 视频同样有渠道模型默认比例（`resolveModelGenerationDefaults(config, model, "video").size`，来自渠道能力 profile 的 `ratio`），空节点创建却固定 720×405。

## 现状对照（已核）

| 环节 | Image（S05 后） | Video 现状 |
| --- | --- | --- |
| 提交占位框 | executor 按 `generationConfig.size` | ✅ 已同源：`canvas-media-generation-executors.ts:40` `nodeSizeFromRatio(generationConfig.size, 720, 405)` |
| 空节点创建 | ✅ 跟随渠道默认比例 | ❌ 固定 `NODE_DEFAULT_SIZE.Video` 720×405，无比例分支 |
| 完成几何 | ✅ 同比例守卫（2% 容差保持） | ❌ `canvas-generation-task-sync.ts:164` 一律 fitNodeSize(720,520) |
| 媒体加载回调 | img onLoad fitToImage | video onLoadedMetadata 只记 naturalWidth/Height，不改框（唯一写入点是 task-sync） |

数据链（已核）：`resolveModelGenerationDefaults`（model-selection.ts:260-283）video 分支 normalized.ratio → size；渠道能力 profile 优先于持久化全局默认（legacy 值不覆盖模型配置，注释明言）。`resolveCanvasGenerationModel` 支持 mode="video"（canvas-project-generation.ts:412-413 同族分支已存在）。

## 改动面（两处，对齐 S05 模式）

### Fix 1：空 Video 节点创建跟随渠道模型默认比例
`web/src/pages/canvas/use-canvas-node-operations.ts` createNode 增加 Video 分支（复刻 Image 分支 :156-167）：
- `resolveCanvasGenerationModel(effectiveConfig, effectiveConfig.videoModel || defaultConfig.videoModel, "video")`
- 默认比例取 `resolveModelGenerationDefaults(effectiveConfig, model, "video").size`（注意：该函数签名是 (config, model, capability, explicit, fallback)，此处 explicit/fallback 传空对象；`normalizeVideoValue` 需要 profile.video，无 profile 时返回 `{}` → size undefined → 走 720×405 兜底）
- `nodeSizeFromRatio(size, 720, 405)`，position 对原锚点居中；metadata.size 不写（与 composer 芯片同源派生，理由同 S05）
- 无模型 / 无 profile / "auto" → 保持 720×405

### Fix 2：完成几何同比例守卫
`web/src/lib/canvas/canvas-generation-task-sync.ts:164`：
- 现状：`fitNodeSize(video.width || node.width || 720, video.height || node.height || 520, 720, 520)`
- 加守卫：当节点当前宽高比与 `video.width/video.height`（后端报告的媒体尺寸）一致（相对差 < 2%，与 S05 同容差）且节点非 locked、非 manualSize/freeResize 时，保持当前 width/height，position 不动；仅当比例真不同才走 fitNodeSize
- 视频无 fitToImage 式二次写入点（onLoadedMetadata 不改框），所以守卫放 task-sync 单点即可，不像 Image 有两处
- locked 节点现有行为（geometry={}）保持不变，守卫在其之前短路或并入同条件

## 范围外

- Audio/Frame/其它节点类型几何
- 视频播放器加载后的二次 fit（现状本来就没有）
- 重生成路径（reuseSourceNode 时 width/height 沿用源节点，本来就是同比例语义）

## 验收

1. `cd web && bunx tsc --noEmit && bun run build` 通过。
2. 单测：守卫提取纯函数（放 `web/src/lib/canvas/canvas-node-size.ts`，命名如 `videoCompletionSize(node, video, maxSize)`）+ bun test 覆盖：同比例保持、异比例 refit、locked、无媒体尺寸兜底。
3. 浏览器实测（自验）：grok 渠道 1:1 视频生成——空节点 405×405 级 → 完成后**不跳变**；换 16:9 渠道默认 → 空框比例随渠道。
4. Image 路径回归：S05 行为不变（守卫是 Video 专属分支，不触碰 Image 代码路径）。

## 回滚

两处独立小改 + 1 个纯函数 + 测试文件，无数据迁移；revert 单提交即可。
