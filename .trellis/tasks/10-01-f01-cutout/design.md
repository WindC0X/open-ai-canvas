# Design · F-01 智能抠图/白底图

> 技术设计。需求与验收见 `prd.md`；落点与红线见控制线任务书 `docs/artifacts/f01-cutout-task-book.md`。

## 1. 架构总览

```
media-conversion 节点（operation=cutout）
  └─ media-conversion-node.tsx  cutout 分支
       └─ cutout-runtime.ts        ← 调用侧封装（单例 + pending Map + abort + 崩溃重建）
            └─ background-removal.worker.ts  ← WASM worker（三段进度 + dtype 回落）
                 └─ transformers.js pipeline('image-segmentation')
                      └─ /canvas/models/birefnet-lite-512/  ← 自托管权重（allowRemoteModels=false）
       └─ 白底合成（cutout-white-background.ts）→ Canvas 2D → blob → setImageBlob
```

**关键点**：Go 后端单张链路**零改动**；源图不出浏览器；权重走静态资源（与既有 `/canvas/models/` 同族）。

## 2. 既有同构先例（本仓实读，非外部项目）

| 先例 | 文件 | 可复用模式 |
|---|---|---|
| MediaPipe WASM worker | `web/src/lib/canvas/canvas-face-detector.worker.ts` | 单例懒加载 `detectorPromise`、`/canvas/models/*` 自托管、错误回传、`image.close()` 释放 |
| worker 调用侧封装 | `web/src/lib/canvas/canvas-face-detection.ts` | 单例 worker、`pendingRequests` Map、`AbortSignal` 支持、`onerror` 拒绝在途 + `terminate()` + 置 null 重建 |
| 本地模型目录 | `web/public/canvas/models/` | nginx 已配 `/canvas` 路由回退；`blaze-face-full-range-sparse.tflite` 等已在树 |
| blob 存储链路 | `web/src/services/image-storage.ts:101` `setImageBlob` | 转换结果落 IndexedDB，返回 URL |
| 电商档位 | `web/src/lib/image-size-presets.ts:157` `ECOM_CHANNEL_PRESETS` | `amazon-main`（1:1 / ≥1600px / hint「白底主图」）已定义 |

**结论**：任务书提到的 dramaclaw/DisyLab 外部蓝本，本仓已有等价实现（MediaPipe worker 族），**照本仓先例同构**比照抄外部更安全（构建链、错误处理、类型约定都已验证）。

## 3. 新增文件

### 3.1 `web/src/workers/background-removal.worker.ts`

职责：WASM 抠图 worker。**照 `canvas-face-detector.worker.ts` 同构**。

```ts
/// <reference lib="webworker" />

type CutoutRequest = { id: number; image: ImageBitmap; op: "cutout" };
type CutoutProgress = { id: number; phase: "download" | "segment" | "encode"; ratio?: number };
type CutoutResponse =
  | { id: number; kind: "progress"; phase: ...; ratio?: number }
  | { id: number; kind: "done"; blob: Blob; width: number; height: number }
  | { id: number; kind: "error"; message: string; code: string };
```

要点：
- 单例懒加载 `pipelinePromise`（照 `detectorPromise`）。
- `env.allowRemoteModels = false`；`env.localModelPath = "/canvas/models/"`（**严禁 HF/jsDelivr**，硬约束 C2）。
- dtype 回落：`navigator.gpu?.requestAdapter()` 成功 → `{ device: "webgpu", dtype: "fp16" }`，否则 `{ device: "wasm", dtype: "q8" }`。探测失败不抛错，只回落。
- `crossOriginIsolated === false` → 强制单线程（`env.backends.onnx.wasm.numThreads = 1`），避免 ort 多线程告警。
- 三段进度：`progress_callback`（下载模型）→ 推理前（识别主体）→ 编码 PNG（生成透明 PNG）。
- `image.close()` 释放（照先例）。

### 3.2 `web/src/services/cutout-runtime.ts`

职责：worker 调用封装。**照 `canvas-face-detection.ts` 同构**。

```ts
export type CutoutProgressPhase = "download" | "segment" | "encode";
export async function runBrowserCutout(
  sourceUrl: string,
  options: { signal?: AbortSignal; onProgress?: (phase, ratio?) => void },
): Promise<{ blob: Blob; width: number; height: number }>;
export function preloadCutoutWorker(): void;  // 预热（任务书要求）
```

要点：单例 worker、`pendingRequests` Map、abort 支持、`onerror` → 拒绝在途 + `terminate()` + 置 null。

### 3.3 `web/src/lib/media-conversion/cutout-white-background.ts`

职责：白底合成（纯函数，零 DOM 依赖便于单测）。

```ts
export type WhiteBackgroundOptions = {
  targetAspect?: number;   // 1 for Amazon 1:1
  minPixels?: number;      // 1600
  padding?: number;        // 1:1 补边留白比例
};
export function planWhiteBackground(source: {width, height}, options): {
  canvasWidth: number; canvasHeight: number;
  drawX: number; drawY: number; drawWidth: number; drawHeight: number;
};
```

要点：**几何计算与绘制分离**——`planWhiteBackground` 是纯函数（可单测 clamp/补边/裁切），绘制走 Canvas 2D（`ctx.fillStyle="#fff"` → `drawImage`）。

### 3.4 `web/public/models/birefnet-lite-512/models-manifest.json`

> 落点按控制线 Q-3 裁定：`web/public/models/`（**不是** `web/public/canvas/models/`——后者是既有 canvas 静态模型目录，新目录独立以便 gitignore 权重）。

```json
{
  "schemaVersion": 1,
  "models": [{
    "id": "birefnet-lite-512",
    "task": "image-segmentation",
    "files": [
      { "path": "onnx/model_fp16.onnx", "bytes": 98484532, "sha256": "<落盘后回填>" }
    ],
    "license": "MIT",
    "source": "https://huggingface.co/studioludens/birefnet-lite-512",
    "upstream": "https://github.com/ZhengPeng7/BiRefNet"
  }]
}
```

**Q-2 裁定落实**：单一 `model_fp16.onnx` 同时服务 WebGPU 档与 WASM 回落档（一份文件 / 一个 sha256 / 一个 manifest 条目）。dtype 探测回落逻辑保留，文件同一份，运维面减半。fp32 不入 manifest（183MB，无收益）。

**Q-1 裁定落实**：manifest 带 `schemaVersion` 字段，为后续 INT8 减重档预留版本位。

sha256 在权重落盘后回填；校验逻辑在 `cutout-model-manifest.ts`（纯函数，可单测）。

## 4. 修改文件

| 文件 | 锚点 | 改动 |
|---|---|---|
| `web/src/components/canvas/nodes/media-conversion-node.tsx` | `:155` | cutout 从 `model_missing` 通用桩改走 `runBrowserCutout()`；执行链 `:171-177` 加 cutout 分支；进度状态写入节点 state |
| `web/src/lib/media-conversion/contracts.ts` | `:43` | cutout 描述改「本地浏览器抠图，首次使用需下载约 90MB 模型，之后离线可用」（**Q-1 实测体积**） |
| `web/src/lib/media-conversion/contracts.ts` | `:82` | `isLocalImageOperation` 是否纳入 cutout（见 §5 D1） |
| `nginx.conf` | server 块 | COOP/COEP 头 + `/models/` 缓存策略 + CORP |
| `web/vite.config.ts` | `server` | dev server COOP/COEP 头 |
| `web/package.json` | — | 新增 `@huggingface/transformers@4.3.0`（精确版本，见 §6） |
| `web/src/lib/canvas/director/director-scene.ts` | `:6` | `DIRECTOR_DEFAULT_ACTOR_URL` 改为自托管路径（**Xbot 裁定 a**，见 §5 D4） |
| `web/src/components/canvas/director/director-viewport-rig.ts` | `:88-136` | 骨骼别名表扩展 Blender 点号风格（**Xbot 裁定 a 的必要件**，见 §5 D4） |
| `web/src/lib/canvas/director/director-scene.ts` | `:269` | `directorPoseBoneDeltas` 注释中的「Soldier」改为新模型（轴向依据变更） |

## 5. 关键决策

### D1：`isLocalImageOperation` 是否纳入 cutout

- **不纳入**（推荐）：cutout 走独立的 `runBrowserCutout` 分支（与 depth/lineart/pose 同层），语义更清晰——它是「AI 模型推理」而非「普通图像算法」。
- 纳入：会让 `convertImageLocally` 需要处理 cutout，但该函数当前明确 throw `model_missing`，纳入需改其语义。

**选定**：不纳入。`media-conversion-node.tsx:155` 的守卫条件改为显式列举（`depth` / `lineart` / `pose` / `cutout`）。

### D2：进度如何回到节点 state

节点 state（`MediaConversionNodeState`）当前无 progress 字段。两个选择：

- **A（推荐）**：本枝不改 schema（避免 schemaVersion 升级），进度只走 `setNotice()` 文本 + 节点内 React state（瞬时态，不持久化）。
- B：`MediaConversionNodeState` 加 `progressPhase?: string`，升 schemaVersion 到 2，需处理旧节点迁移。

**选定 A**：进度是瞬时态，持久化无意义；避免 schema 迁移扩大本枝风险面。

### D3：白底合成入口

- 复用 `canvas-node-crop-dialog.tsx` 的交互外壳，新增「白底 1:1」预设按钮。
- 或独立按钮直接产出（不走对话框）。

**选定**：先做**纯函数 + 独立导出路径**（`planWhiteBackground` + 一个导出动作），对话框接线留待真机验收后按反馈决定——避免本枝同时改对话框（扩大回归面）。

### D4：默认角色模型替换（控制线裁定 Xbot 路径 = a）

**背景**：`DIRECTOR_DEFAULT_ACTOR_URL` 原指向 jsDelivr 的 `Xbot.glb`。控制线核查判定 Mixamo 血统资产**再分发权不明确**（Adobe FAQ 只授予使用权，`redistribute` 零命中），且 jsDelivr 国内不可达 + COEP 下会被拦截。

**选型**（已实测筛除，见下表）：

| 候选 | 许可 | 骨骼 | 判定 |
|---|---|---|---|
| Kenney Blocky Characters | CC0 ✓ | 8 nodes / 2 命中 | ✗ 骨骼过简 |
| Kenney Mini Characters | CC0 ✓ | 10 nodes / 2 命中 | ✗ 骨骼过简 |
| Quaternius | **QAL v1.0**（禁再分发） | — | ✗ 许可不符 |
| three.js Soldier.glb | 无 README | `mixamorig:*` | ✗ **Mixamo 血统** |
| three.js Xbot.glb | 无 README | `mixamorig:*` | ✗ Mixamo 血统（原候选） |
| **three.js RobotExpressive** | **README 明示 CC0 1.0** ✓ | 43 skin joints | ✓ **选定** |

**选定：`RobotExpressive.glb`**

- 来源：`https://github.com/mrdoob/three.js/blob/r185/examples/models/gltf/RobotExpressive/RobotExpressive.glb`
- 许可：`RobotExpressive/README.md` 原文 —— 「Model by Tomás Laulhé (quaternius). ... **CC0 1.0**.」+ Don McCurdy 的 FBX2GLTF 转换与材质调整
- 体积：**453.1 KB**（<10MB 限制 ✓）
- 风格：低多边形机器人 = **中性/工具风**（符合控制线风格边界，避开写实人像）
- 骨架：43 skin joints，完整人形层级（Hips → Abdomen → Torso → Neck/Head + Shoulder/UpperArm/LowerArm + UpperLeg/LowerLeg/Foot）
- 动画：14 个（Idle/Standing/Walking/Running/Sitting/Wave/Punch/Dance 等）

**必须配套的别名表扩展**（实测数据）：

RobotExpressive 用 **Blender 点号命名**（`UpperArm.L` → 归一化 `upperarml`），现有别名表只认 `leftUpperArm` / `mixamorigleftarm` / `upperarm_l`，实测命中：

| 别名表 | 总命中 | 核心姿态骨骼（12 项） |
|---|---|---|
| 现有 | 15（12 个是手指） | **2/12** → 姿态系统实质失效 |
| 扩展后（加 `upperarml`/`lowerarml`/`upperlegl`/`lowerlegl`/`shoulderl`/`footl` 等点号归一化变体） | **27** | **13/15** |

扩展需注意**冲突修正**：`Leg.L`（`legl`）不得被 `leftLowerLeg` 抢占——`lowerlegl` 模式优先级高于宽松的 `legl`。

**已知缺口**：`leftHand`/`rightHand` 未命中——GLB 中 `Hand.L`/`Hand.R` 是独立根节点，不在 skin joints 内。影响：`wave`/`phone` 等涉及 `rightHand` 的姿态该骨骼不生效（其余骨骼正常）。**登记为已知限制**，不阻断。

**留档要求**（控制线细则 4）：模型来源 URL + 许可声明截证 + 文件 sha256 进任务卡 Notes；真机截图一张（导演台 3D 视图）进交付报告。

**Xbot 本体清理**（控制线细则 5）：`director-scene.ts:6` 的 jsDelivr URL 连同注释一起移除，改为本地 `/models/RobotExpressive.glb`。

### D5：512 输入质量策略（控制线 Q-4）

**选定**：长边缩到 512 推理 → alpha 上采样回原分辨率 → 与原图合成。

- 输出保持**原分辨率**（主体保真不受损）
- 边缘质量受 512 限制（模型卡明示「512×512 input limits edge detail on large images」）
- 这是 remove.bg 类管线标准做法，也是 lite 模型的设计意图
- 不采用分块推理（复杂度超范围）

## 6. 依赖选型

`@huggingface/transformers`（transformers.js v3+，包名已从 `@xenova/transformers` 迁移）：

- **许可核查**（硬约束 C3，dramaclaw AGPL 教训）：transformers.js 为 **Apache-2.0**（需在实施时用 `npm view` / 官方仓库二次确认，写进 Notes）。
- **版本**：锁定具体版本，不用 `^`（权重格式与 API 兼容性敏感）。
- **体积**：仅 worker 侧动态导入，避免主 bundle 膨胀。
- 权重格式：ONNX（transformers.js 原生支持）。

**待实施时确认**：BiRefNet 在 transformers.js 中的 `pipeline("image-segmentation")` 支持度——若官方未收录该架构，需回落到 `AutoModel` + 手工预处理（输入 1024² + ImageNet 归一化）。**这是本枝最大的技术不确定性**，实施第一步先做 spike 验证。

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| ~~transformers.js 不支持 BiRefNet~~ | ✅ **spike 已排除**：支持，且任务书点名模型存在 |
| 权重体积 94MB 影响首次体验 | **Q-1 裁定接受**；三段进度条 + 文案明示实测体积；INT8 减重登记后续档（manifest schemaVersion 留位） |
| COOP/COEP 拦截第三方资源 | **审计已完成**：全站仅 1 处外链（`DIRECTOR_DEFAULT_ACTOR_URL`），随 **Xbot 裁定 a** 一并自托管解决 |
| WebGPU 探测误判 | 探测失败静默回落 **fp16 WASM**（Q-2 裁定），不阻断 |
| **默认角色替换后姿态轴向失配** | `directorPoseBoneDeltas` 的旋转参数原按 Soldier/Mixamo 轴向调校；RobotExpressive 轴向不同 → 实施后需真机核 21 种姿态，必要时微调参数 |
| **别名表扩展影响既有模型** | 扩展是**追加**模式（新正则加在候选数组末尾），既有模型（Soldier/其他）命中不变；需跑既有 director 相关测试验证 |
| **权重部署链断裂** | `scripts/fetch-cutout-models.sh` 带 sha256 校验；Docker 构建 RUN 该脚本；源 URL 可配 |

## 8. 测试策略

| 层 | 内容 |
|---|---|
| 纯函数单测（零 DOM） | `planWhiteBackground` 几何（1:1 补边/裁切 clamp/极小图/极大图）；`cutout-model-manifest` sha256 校验；dtype 回落判定（注入 `navigator.gpu` 桩） |
| worker 契约 | 三段进度映射、错误码枚举（不启真实 worker） |
| 既有守卫 | media-conversion 相关测试 + image-size-presets 相关 |
| 真机（用户验收） | 首次下载三段进度 → 二次离线 → 白底导出 Amazon 1:1 |

## 9. 落点与红线自检

- ✅ `use-canvas-media-tools.ts` / `canvas-image-toolbar-tools.tsx` / `routes.go`：grep `cutout` = 0，零触碰。
- ✅ globals.css：零改动（COOP/COEP 是响应头，非 CSS）。
- ✅ 后端：单张链路零改动（仅静态资源托管）。
- ✅ 权重 MIT（三重证据）；transformers.js Apache-2.0；**新模型 RobotExpressive CC0 1.0**。
- ✅ 无 HF 直连 / 无 jsDelivr 直连（两者均自托管）。
- ⚠ COOP/COEP 是本枝唯一的「全站影响面」——但审计确认仅 1 处外链且随本枝解决。

## 10. 控制线裁定登记（2026-10-01）

| 裁定 | 内容 | 落点 |
|---|---|---|
| Q-1 | 接受 94MB，文案改实测值；INT8 减重登记后续档 | §3.4 manifest schemaVersion / §4 文案 / §7 风险 |
| Q-2 | fp16 WASM 回落；单一权重文件双档服务 | §3.4 / §3.1 dtype 回落 |
| Q-3 | `web/public/models/`（gitignore）+ `scripts/fetch-cutout-models.sh` | §3.4 路径 / §1 阶段 A |
| Q-4 | 缩 512 推理 → alpha 上采样 → 原分辨率合成 | §5 D5 |
| Q-5 / Xbot 路径 a | 换 CC0 人形模型（RobotExpressive）+ 自托管 + 别名表扩展 | §5 D4 |

**红线 ② 判定确认**：控制线认定「自托管 Xbot 不算扩域——它是 COOP/COEP 完成的最小必要件（全站唯一外链）」，任务卡 Notes 登记。本枝按路径 a 执行（换模型 + 自托管）。
