# Design · F-08 圈选改图

> 需求与验收见 `prd.md`；正式任务书见 `docs/artifacts/f08-annotate-task-book.md`（侦察草案+三裁定封版）。
> 技术路线判定（侦察一手结论）：Cowart 蓝本=**视觉指示编辑**（原图+标注合成截图交模型，不走 mask 通道）；影策蒙版链=mask 通道。两条输入管线，编排层同构复用。

## 1. 架构总览

```
图片工具条「圈选改图」入口（C3，canvas-image-toolbar-tools.tsx）
  └─ project.tsx: setAnnotateEditNodeId(node.id)
       └─ canvas-project-media-dialogs.tsx 挂接
            └─ canvas-node-annotate-edit-dialog.tsx（C1，新文件）
                 ├─ annotate-edit-geometry.ts   ← 纯函数（C1，新文件）
                 │    ├─ 归一化坐标 ↔ 像素（标注定位）
                 │    ├─ 联合 bounds + 32px padding
                 │    ├─ 动态 pixelRatio（1x/1.5x/2x）
                 │    └─ 尺寸钳制判定（4096 长边 + 1600 万像素）
                 └─ onConfirm(payload: AnnotateEditPayload)
                      └─ annotateEditImageNode（C2，use-canvas-media-tools.ts）
                           ├─ annotate-edit-prompt.ts ← 提示词组装（C2，新文件）
                           ├─ 导出合成：canvas 2D 自绘（原图 + 标注层 → dataUrl）
                           └─ 照 maskEditImageNode 骨架：config 构建 → 门控 → 风格注入
                              → 建节点（批量）→ persistMediaNodes
```

**关键点**：与 maskEditImageNode 的**执行编排完全同构**（buildGenerationConfig / 门控 / resolveImageEditStyle / 建节点 / persistMediaNodes），分叉只在**输入管线**（标注合成截图 vs 画笔 mask）。C2 合槽复用骨架，不重造编排。

## 2. 数据模型

### 2.1 标注（弹窗内临时态，v1 关闭即弃）

```ts
type AnnotateEditShape = "region" | "arrow";

type AnnotateEditAnnotation = {
    id: string;               // nanoid
    shape: AnnotateEditShape;
    note: string;             // 用户文字要求（必填，空则提交校验拦截）
    // 归一化坐标（0-1，相对原图）——与 og-canvas visualIntentAnnotations 同构，F-11 留位
    x: number;
    y: number;
    // region：宽高；arrow：终点
    width?: number;           // region only
    height?: number;          // region only
    endX?: number;            // arrow only
    endY?: number;            // arrow only
};

type AnnotateEditPayload = {
    annotations: AnnotateEditAnnotation[];
    generationConfig?: Partial<Pick<AiConfig, "model" | "imageModel" | "size" | "quality" | "count" | "transparentBackground">>;
};
```

### 2.2 几何常量（照 Cowart 一手值）

| 常量 | 值 | 来源 |
|---|---|---|
| `ANNOTATE_EXPORT_PADDING` | 32 | Cowart `ANNOTATION_EDIT_EXPORT_PADDING` |
| `ANNOTATE_MAX_LONG_EDGE` | 4096 | 控制线裁定（与 F-06 对齐） |
| `ANNOTATE_MAX_PIXELS` | 16_000_000 | 控制线裁定（Cowart 1600 万沿用） |
| pixelRatio | ≤1000→2x / ≤1600→1.5x / >1600→1x | Cowart `getAnnotationEditExportPixelRatio` |

## 3. 新增文件

### 3.1 `web/src/lib/canvas/annotate-edit-geometry.ts`（C1，纯函数）

照 `canvas-selection.ts` 风格：无 React 依赖、全导出纯函数、bun:test 直测。

```ts
export type NormalizedRect = { x: number; y: number; width: number; height: number };
export type NormalizedArrow = { x: number; y: number; endX: number; endY: number };

/** 归一化坐标 → 像素（原图像素空间）。 */
export function annotationToPixels(...): ...;
/** 像素 → 归一化（拖拽结束落库）。 */
export function pixelsToAnnotation(...): ...;
/** 全标注联合 bounds（像素空间）+ padding，clamp 到原图内。 */
export function annotationUnionBounds(annotations, imageWidth, imageHeight, padding): ...;
/** 动态像素比（Cowart 口径）。 */
export function annotationExportPixelRatio(bounds): 1 | 1.5 | 2;
/** 尺寸钳制判定（4096 + 16M 双限）。 */
export function annotationExportTooLarge(width, height): boolean;
/** 导出尺寸计算（bounds × ratio，含钳制判定结果）。 */
export function annotationExportSize(bounds): { width, height, pixelRatio, tooLarge };
```

### 3.2 `web/src/components/canvas/canvas-node-annotate-edit-dialog.tsx`（C1）

**照 `canvas-node-mask-edit-dialog.tsx` 同构**（img + overlay canvas 绝对定位、`readCanvasPoint` 坐标映射、`onPointerDown/Move/Up` + `setPointerCapture`、右侧参数栏 + 底部按钮区、`workspace-modal workspace-modal-wide`）。

交互设计：
- **工具切换**：`region`（矩形）/ `arrow`（箭头）两按钮（`aria-pressed`，照画笔/擦除范式）；不用滑块，用默认尺寸。
- **绘制**：region=按下拖拽出矩形；arrow=按下拖拽出箭头（起点→终点）。释放后弹出 note 输入（浮层 Input，Enter 确认 / Esc 取消，取消则丢弃该标注）。
- **渲染**：overlay canvas 实时绘制——region 半透明填充+虚线边框（照 mask 预览色 `rgba(37,99,235,.38)`）；arrow 带箭头头部的实线。
- **标注列表**：右侧显示已有标注（序号 + note 摘要 + 删除按钮）。
- **提交**：至少 1 条标注且全部有 note；调 `annotationExportSize` 判定，超限 `message.error` 指引（照 Cowart 文案：「请将标注移近或缩小图片到长边不超过 4096px」）。
- **关闭确认**：有标注时 `Modal` 的 `onCancel` 先弹 `AppModal.confirm`（「关闭将清除标注」）——**注意**：仓规禁静态 `Modal.confirm`（lint 只禁 antd Empty 和静态 Modal.confirm），用 `AppModal.confirm` 或受控二次确认。

### 3.3 `web/src/lib/canvas/annotate-edit-prompt.ts`（C2，纯函数）

Cowart `ANNOTATION_EDIT_PROMPT` 汉化适配（**不得复制转写化石**，按一手 Cowart 语义重写）：

```ts
export function buildAnnotateEditPrompt(input: { annotationCount: number; exportWidth: number; exportHeight: number; }): string;
// 骨架：角色声明（按标注修改）→ 截图内容说明（含标注箭头/文字）→
//       「标注文字=修改要求」→「不要把标注/选框带进结果」→「保留原图，新图放原图旁」
```

### 3.4 `web/src/lib/canvas/annotate-edit-export.ts`（C2，纯函数+canvas 合成）

```ts
export async function composeAnnotateEditExport(input: {
    imageDataUrl: string;
    annotations: AnnotateEditAnnotation[];
    exportSize: { width; height; pixelRatio };
    bounds: { left; top; width; height };  // 像素空间
}): Promise<string>;  // 合成 dataUrl
```

要点：canvas 2D 自绘——drawImage 原图（按 bounds 裁剪+缩放）→ 逐标注绘 region/arrow + note 文字（CanvasRenderingContext2D.fillText，带描边保证可读）→ `toDataURL`。**不用 DOM 截图库**（Cowart 的 tldraw 截图路径不适用）。

### 3.5 `annotateEditImageNode`（C2，进 use-canvas-media-tools.ts）

照 `maskEditImageNode`（:640 起）骨架逐段同构：

1. `node.metadata?.content` 守卫；
2. `buildGenerationConfig` → `defaultImageParamsForModel` → **门控**（F-08 走指令跟随模型——门控条件待渠道实测后定：复用 `maskSupported` 或新标记，见开放点 O-1）；
3. `resolveImageEditStyle`（风格注入，免费继承）；
4. `composeAnnotateEditExport` 合成 → `nodeReferenceImage` 等价的参考图输入（**注意**：合成图是 dataUrl，需要上传或直接进 generationConfig——照 maskEdit 的 `nodeReferenceImage(node)` 用法，具体接口实现时定）；
5. 提示词组装 `buildAnnotateEditPrompt`；
6. 建节点（root + 批量 children）+ `persistMediaNodes` + 成功/失败提示。

### 3.6 `capability-entries.ts` 条目（C3）

```ts
{
    id: "image.annotateEdit",
    name: "圈选改图",
    tier: 1,
    contextRequirement: "single_image",   // 控制线裁定
    assetKind: "capability/tool",
    parameterSurface: [
        { field: "actionHint", label: "编辑意图", options: ["replace", "remove", "modify"], default: "modify" },
    ],
    executionChain: {
        handler: "annotateEditImageNode",
        location: "cloud",
        primaryChannel: "暂无——候选 a6api · nano-banana-2，F-08 渠道实测门待跑（不可继承 F-02 结论）",
    },
    zeroParameterPreset: "暂无",
}
```

### 3.7 入口（C3）

- `canvas-image-toolbar-tools.tsx`：`ImageNodeActionToolId` 联合类型加 `"annotateEdit"` + 条目（label「圈选改图」，icon 候选 `PencilRuler`/`Scan`）+ handlers `onNodeAnnotateEdit`（照 `maskEdit` 同位置，:134 邻位）；
- `canvas-node-toolbar.tsx`：透传 `onAnnotateEdit`（照 `onMaskEdit` 范式）；
- `project.tsx`：`annotateEditNodeId` state + `annotateEditImageNode` 调用 + 挂接；
- `canvas-project-media-dialogs.tsx`：弹窗挂接（照 maskEdit 范式）。

## 4. 既有同构先例（本仓实读）

| 先例 | 文件 | 复用模式 |
|---|---|---|
| 蒙版编辑对话框 | `canvas-node-mask-edit-dialog.tsx` | canvas 叠加、指针捕获、坐标映射、参数栏、提交校验 |
| 蒙版执行链 | `use-canvas-media-tools.ts:640` `maskEditImageNode` | 编排骨架（config/门控/风格/建节点/持久化） |
| 超分弹窗挂接 | `canvas-node-super-resolve-dialog.tsx` + `canvas-project-status-dialogs.tsx` | 新式挂接（O-03 刚立） |
| 能力条目 | `capability-entries.ts`（O-03 立） | 字段口径 + 谓词判定 |
| 纯函数+测试 | `canvas-selection.ts` + `web/test/scene-*.test.ts` | 无 React 依赖纯函数、bun:test |

## 5. 不做

- ❌ freehand 手绘、❌ 标注持久化、❌ F-11 检测、❌ DOM 截图库、❌ 第三方标注库。
- ❌ 不碰 `routes.go` / `model-capabilities.ts`（预计零触碰；渠道实测若需门控标记再升级报备）。

## 6. 开放点（实现时定，已记录）

- **O-1 门控条件**：F-08 支持哪些模型？候选：复用 `maskSupported`（保守，但语义不完全匹配——标注截图不需要 mask 通道）或新标记 `annotationEditSupported`。渠道实测门结果定。
- **O-2 合成图输入形态**：dataUrl 直传 vs 先 uploadImage。看 generationConfig 的参考图字段实际接口（实现时读 `nodeReferenceImage` 与 `buildImageGenerationMetadata` 消费方）。
- **O-3 关闭确认组件**：`AppModal.confirm` 实际 API 核对（lint 禁静态 Modal.confirm）。
