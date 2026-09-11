# 问题四设计规格 v2（2026-09-10，四 skill 合成）

> 设计依据：impeccable（品质基线/反模式）、emil-design-eng（微交互/状态）、apple-design（流体响应/材质/可打断）、ux-psychology-review（认知原则）。
> 语料权威：P51-030。竞品截图 7 张已逐张解析。代码现状已盘点。
> 用户已拍板：份数三模式独立（UI 先行链路后补）；count 气泡 A 形态（快捷档+竖滚+自定义）。

## 一、设计原则（跨面板，每条有名有据）

| # | 原则 | 来源 | 在面板中的落法 |
|---|---|---|---|
| P1 | Hick's Law：选项分块，高频直出低频折叠 | ux-psy #1 | 比例/分辨率直出；自定义尺寸/自定义份数折叠 |
| P2 | Progressive Disclosure | ux-psy #12 | ▶自定义比例或尺寸；份数"自定义"行 |
| P3 | Mental Model/Familiarity | ux-psy #35 | 只用已验证控件：分段 pill、网格卡、滑块、开关——不自创 |
| P4 | Centre-Stage + Default Effect | ux-psy #8 | capabilityConfig.default 预选中，开面板即见当前态 |
| P5 | Fitts's Law | ux-psy #6 | 选项卡命中区 ≥40px 高（h-52 双行卡 ✓） |
| P6 | Feedback Loops | ux-psy #33 | 比例选中即出像素换算条 `3:4 · 1024×1360px` |
| P7 | Cognitive Load | ux-psy #3 | 一屏尽量不滚（420 封顶）；组标题统一 12px/400 muted |
| P8 | 按下即响应 | apple §1 | 所有选项 press scale(0.97)+100ms ease-out（项目已有 canvas-settings-option） |
| P9 | 动效频率闸门 | emil 框架 | 面板开合=每天几十次→220ms flora exit 档（已有）；选项选中=即时状态切换+100ms press，无进场动画 |
| P10 | 锚点缩放 | emil/apple | 面板 transform-origin 指向触发器方向（topLeft/topRight 分支已有） |
| P11 | tabular-nums | impeccable | 像素换算条、份数、时长徽章数字 |
| P12 | reduced-motion | apple/impeccable | 面板开合与 press 动效 motion-reduce 关停（项目已有语法） |

## 二、能力裁剪矩阵（同参数不同模型值域不同的系统性解法）

| capabilityConfig 字段 | 值域形态分派 | 不支持时 |
|---|---|---|
| image.size.parameter | none→隐藏；values≤4→单行分段；5+→双行卡网格；allowCustom→折叠 | 整区块不渲染 |
| image.quality.supported | values≤4→单行分段；5+→两行 grid | 隐藏 |
| image.transparentBackground.supported | Switch+副标题 | 隐藏 |
| image.responseFormat/outputFormat | 分段 | 隐藏 |
| image.maxOutputs | 份数气泡 max；=1 时气泡不渲染 | 隐藏 |
| video.resolutions | ≤4 分段；>4 两行 | 隐藏 |
| video.duration.selection | range→滑块+数值徽章；enum≤6→pill 行；durationSupported=false→隐藏 | 隐藏 |
| video.ratios | 双行卡网格（含自适应档） | 隐藏 |
| video.generateAudio/watermark | Switch 组 | 隐藏 |
| audio voice/format/speed | 渠道值域动态：voice>8→两列，否则 pill 行 | 隐藏 |

**硬规则：值域全部取自 capabilityConfig，零硬编码白名单**（现 image-settings-panel 里的 aspectOptions/qualityOptions 静态表降级为 fallback）。

## 三、面板区块流（常用度排布）

### 图像（比例 > 分辨率 > 画质 > 透明背景）
依据：创作流"先构图再精度再输出形态"；竞品 GPT-Image 面板同为比例占最大区块。
1. **比例**：双行卡网格 2×5（形状图标 22×22 + 比例值 12px）+ 自适应档 → 选中即出换算条 → allowCustom 折叠
2. **分辨率**：单行分段（1K/2K/4K…，≤4）
3. **画质**：值域分派（见矩阵）
4. **透明背景**：Switch 行 + 副标题 12px muted
5. 份数 → 独立气泡（面板内移除）

### 视频（比例 > 清晰度 > 时长 > 声音/水印）
依据：flora 面板形态截图（1789009218940）区块序为 比例→清晰度→时长→生成音频→数量；生成模式 chip 无链路不做（登记后续）。
1. **比例**：双行卡网格
2. **清晰度**：分段行
3. **时长**：滑块 + 右侧数值徽章（range）或 pill 行（enum）
4. **生成声音/水印**：Switch 组（同区 Common Region 分组）
5. 份数 → 独立气泡

### 音频（音色 > 语速 > 格式）
依据：音色是音频生成首要创作参数（TTS 语义），语速次之，格式是输出属性最低频。
1. **音色**：pill 行（>8 值域转两列 grid）
2. **语速**：分段（0.75/1/1.25/1.5）
3. **格式**：分段（MP3/WAV…）
4. 份数 → 独立气泡

### 份数气泡（三模式统一，A 形态）
1. 快捷档 1/2/3/4 pill 行（≤max 过滤）
2. 竖滚列表（P51 定版语法：行高 36、宽适配、细滚动条、打开滚到当前值）
3. "自定义"行 → 原位变输入框（Progressive Disclosure），Enter 提交 Esc 取消
4. 词汇随调用方：张/个/份

## 四、控件状态规格（emil 表格式）

| 控件/状态 | 默认 | hover/focus-visible | 选中 | 禁用 | press |
|---|---|---|---|---|---|
| 双行卡（比例） | itemHover 底 + toolbar.border | surface 提升 | activeBg + activeStroke 描边 | 45% 透明度 + title 说明原因 | scale 0.97 / 100ms |
| 分段 pill | 同上 | 同 | 同 | 同 | 同 |
| 滑块 | 6px 细轨 | 拇指 1.15x | — | — | 拇指 1:1 跟手（apple §2） |
| Switch | 自研 sm | — | accent 填充 | — | — |
| 换算条 | 12px muted tabular-nums | — | — | — | — |
| 组标题 | 12px/400 muted | — | — | — | — |

Surface（全面板统一）：玻璃 rgba(32,32,32,.9)+blur16（dark）/rgba(255,255,255,.94)（light）、radius 16、宽 356、高 420 封顶内滚、方向向上、transform-origin 锚触发器。

## 五、emil 式现状→设计对照（关键 8 项）

| Before（现状） | After（设计） | Why |
| --- | --- | --- |
| 三个面板表面各异（blur16/18+saturate 混用） | 统一 P51 权威玻璃 blur16 | 语料权威+一致性（handoff §5 末条收敛） |
| image 静态 aspectOptions/qualityOptions 白名单 | capabilityConfig 值域分派 | 同参数不同模型值域不同（用户点名） |
| 份数仅 image 面板内+text 独立 | 三模式统一独立气泡（A 形态） | 用户拍板；Mental Model 一致性 |
| 比例无自适应档（image 部分模型有） | 网格首格"自适应"档 | flora/竞品同型；P3 |
| 换算条只在部分路径出现 | 选中比例恒出 | P6 反馈闭环 |
| 面板开合 origin 居中 | 锚触发器方向 | emil：popover 从触发器缩放 |
| 分辨率/画质/比例各自 grid 列数硬编码 | 值数量分派（≤4 分段/5+ 网格） | 值域形态学 |
| 视频时长 input+pill 混排 | range→滑块+徽章；enum→pill | 值域形态学+flora 同型 |

## 六、实施与验收顺序（确认后执行）

1. 份数气泡 A 形态（三模式挂载：image 右组已有→重设计；video/audio 右组新增）
2. surface 统一 CSS（先 grep 同名选择器）
3. image 面板重构（值域分派器 + 比例网格 + 换算条 + 折叠）
4. video 面板重构（滑块形态）
5. audio 面板重构
6. 回归面：创作页消费点、mask-edit-dialog（showCount=false+bypassPriceGuard）、摘要 pill 口径（image 摘要移除份数后同步）、明暗双主题、a11y 过 reviewing-a11y 清单
7. 每步 tsc+build；终验真机四模式×明暗主题×三模型组合；pending-test.mdx 登记
