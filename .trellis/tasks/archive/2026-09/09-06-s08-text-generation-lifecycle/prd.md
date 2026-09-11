# S08：文本生成生命周期 flora 语法对齐（D3 第二族 · 第一切片）

## 背景

D3 族序第二族(文本)。S01-S07 已在生图/生视频上建立完整闸门管线(几何/生成中/完成/浮层),本切片把同一套语法延伸到**文本生成节点全生命周期**:composer(生成前)→ running(生成中)→ 结果 → 错误/重试。

## 证据现状(已核)

**flora live 投影解剖**(phase85/86,2026-08-03 实测,authority JSON 在 og-canvas-flora-study):
- 节点几何:**384×384 world-px**(文本族不遵循媒体族的宽高比分档);screen ≈138.2px@36% zoom;
- 两族节点:`text-generation-form`(生成前表单,26 idle descendants)与 `generated-text`(结果节点,30-49 descendants,含 image/type reference 变体 +16/+19);
- 四态轴:deselected-idle(26 原子)→ hover(92 原子,composer+外部工具条挂载,800ms 后两原子回缩 92→90)→ selected(prompt 聚焦)→ result-focus;
- data 词表:`data-prompt-area` / `data-empty` / `data-has-inputs` / `data-prompt-can-scroll` / `data-scroll-container` / `data-node-interactive`;
- submit 主原子:size-9(36 world px),transitionDuration 0.15s(= flora fast 档);hover 悬停图标 group-hover:opacity;
- 键盘/AX 已测部分:Tab 序列 prompt→textarea→@按钮→节点外;AX 缺陷本身不采(负面约束:flora 缺陷不当设计语言);
- **flora 证据缺口**:loading/error/retry/cancel/provider 终态**未被捕获**(phase85 unverified 明示)→ 生成中/错误态**无 flora 参照,沿用影策 S01-S07 已立语法**(填充层/生成环/0-里程碑未知/retry 重置),登记"自行设计,有影策同族先例"。

**影策现状**(已核代码):
- 文本生成 executor 已存在:`canvas-text-generation-executor.ts`(textCount 独立份数、原位/子节点两模式、status loading 子节点);
- Text 节点渲染:`canvas-node-content.tsx` TextContent(内联 mention 编辑/富文本渲染/深度编辑模态分离);
- task-sync 支持 mode="text"(task-sync.ts:111),完成路径 fitNodeSize 未区分文本几何;
- **缺口**:①S04 填充层与生成环仅覆盖 Image/Video,Text 生成中无"进行中"反馈;②生成前表单(composer)形态与 flora text-generation-form 语法未对照;③文本节点几何固定 340×240(NODE_DEFAULT_SIZE),flora 为 384×384;④错误/重试态在 Text 上的表现未核。

## 改动面(草案,闸门前不写码)

1. **生成中反馈**:Text 节点 loading 态接入既有填充层/生成环语法(条件扩 type 判断,纯函数不动逻辑);文本无媒体尺寸概念,完成不跳变问题不存在,但完成回填的框尺寸需定约;
2. **生成前 composer**:对照 flora text-generation-form 解剖(悬停才挂载的微控件/submit 原子/数量在发送前 reveal——与影策既有 composer 原语语法合并,不新建面,遵守归属面去重纪律);
3. **几何**:文本生成节点框随内容自适配或定 384×384 风格档(需与影策 340×240 存量兼容策略一起决策);
4. **错误/重试**:errorDetails 展示 + retry 走 0-里程碑已知语义。

## 范围外

- 笔记节点(非生成)的编辑语法/autosave(P51-029 NOT_STARTED,证据最薄,后续切片);
- 文本深度编辑模态内部(保留现状);
- 引用变体 chip(image/type reference)细节(随 composer 切片或角色引用族)。

## 验收

1. `cd web && bunx tsc --noEmit && bun run build` 通过;
2. 纯函数/组件单测覆盖新增几何/状态分支(bun:test SSR 模式);
3. 浏览器实测(tmwd):文本生成 running 态有进行中反馈(填充层+生成环),完成回填正确,error 态展示与 retry 行为正确;
4. Image/Video 路径回归:填充层挂载条件扩展后非文本类型行为不变。

## 回滚

前端单域小改,无数据迁移;revert 单提交即可。
