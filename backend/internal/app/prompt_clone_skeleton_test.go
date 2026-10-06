package app

import (
	"strings"
	"testing"
)

// F-09 三期 §2.5：六段式骨架 + 动态段。
//
// 一手材料：wfapp-52-detail.json 的 inputs[17]（六段式正文）与
// inputs[5]/[6]/[8]（concatRules 的 des 文本）。测试锁住逐字一致性与条件规则。

func TestBuildCloneSkeletonPromptIsVerbatim(t *testing.T) {
	section := buildCloneSkeletonPrompt()

	// 五段固定正文的关键句（逐字）
	for _, want := range []string{
		"任务：根据“版式参考图组”制作一张原创商业视觉。",
		"优先级：用户明确要求与准确文案 > 用户替换主体身份和事实 > 高度复刻的人物保留要求 > 逐张参考要求 > 选择的复刻策略 > 风格参考范围 > 模型自由发挥。冲突时按此前顺序执行。",
		"主体真实性：如提供主体图，必须保持可见类别、数量、轮廓比例、主色、材质、图案、Logo相对位置和结构部件；不要凭空增加功能、配件、认证、规格或卖点。看不清的细节要保守处理。",
		"原创与文字安全：不得照搬参考图中的品牌、Logo、水印、受保护角色、独特插画或旧广告文案。",
		"输出要求：只生成一张完成度高的成片，不输出对比图、步骤图、网格草稿、解释文字或额外边框。",
	} {
		if !strings.Contains(section, want) {
			t.Errorf("六段式骨架缺少逐字段落：%q", want)
		}
	}
	// 五段用换行分隔
	if got := len(strings.Split(section, "\n")); got != 5 {
		t.Errorf("骨架应为 5 段（第六段为动态段），实际 %d 段", got)
	}
}

func TestBuildCloneDynamicRulesDegree(t *testing.T) {
	// 复刻程度：high-structure
	got := buildCloneDynamicRules(clonePromptParams{CloneDegree: "high-structure"})
	if !strings.Contains(got, "\n复刻策略：") {
		t.Fatalf("缺少复刻策略分隔符：%q", got)
	}
	if !strings.Contains(got, "保持参考图的高层信息层级、主体占比、主要分区和光线关系") {
		t.Errorf("缺少 high-structure 的 des 文本：%q", got)
	}

	// 复刻程度：style-reference
	got = buildCloneDynamicRules(clonePromptParams{CloneDegree: "style-reference"})
	if !strings.Contains(got, "只参考下方选中的视觉范围并重构场景、细节与构图") {
		t.Errorf("缺少 style-reference 的 des 文本：%q", got)
	}
}

func TestBuildCloneDynamicRulesScopeConditional(t *testing.T) {
	// ★ 条件规则：clone.degree == style-reference 时才出现「风格参考范围」
	got := buildCloneDynamicRules(clonePromptParams{CloneDegree: "style-reference", CloneScope: []string{"composition", "lighting"}})
	if !strings.Contains(got, "\n风格参考范围：") {
		t.Fatalf("style-reference 下应出现风格参考范围：%q", got)
	}
	if !strings.Contains(got, "构图、主体占比、视觉动线与留白。") || !strings.Contains(got, "光向、明暗层次、阴影和材质表现。") {
		t.Errorf("缺少 scope 的 des 文本：%q", got)
	}

	// ★ high-structure 时【不出现】风格参考范围（一手 conditions 逐字）
	got = buildCloneDynamicRules(clonePromptParams{CloneDegree: "high-structure", CloneScope: []string{"composition"}})
	if strings.Contains(got, "风格参考范围：") {
		t.Errorf("high-structure 下不应出现风格参考范围：%q", got)
	}
}

func TestBuildCloneDynamicRulesCopyMode(t *testing.T) {
	for value, want := range map[string]string{
		"no-copy":    "画面不添加标题、卖点、价格、Logo或随机乱码。",
		"auto-copy":  "自动生成 1 条简短标题",
		"exact-copy": "只使用用户在下方填写的准确文字",
	} {
		got := buildCloneDynamicRules(clonePromptParams{CopyMode: value})
		if !strings.Contains(got, "\n画面文字策略：") || !strings.Contains(got, want) {
			t.Errorf("copyMode=%s 拼装错误：%q", value, got)
		}
	}
}

func TestBuildCloneDynamicRulesUnknownValueSkipped(t *testing.T) {
	// 未知 value 不拼装（不臆造文本）
	got := buildCloneDynamicRules(clonePromptParams{CloneDegree: "nope", CopyMode: "nope"})
	if got != "" {
		t.Errorf("未知选项应不拼装，实际：%q", got)
	}
}

func TestApplyCloneSkeletonPromptGating(t *testing.T) {
	base := func() *canvasGenerationInput {
		return &canvasGenerationInput{Mode: "image", Prompt: "用户提示词", Config: providerConfig{ProductImageCount: 1}}
	}

	// ① 生效：mode=image 且 ProductImageCount > 0
	input := base()
	applyCloneSkeletonPrompt(input)
	if !strings.HasPrefix(input.Prompt, "任务：根据“版式参考图组”") {
		t.Errorf("骨架应 prepend 到最前：%q", input.Prompt)
	}
	if !strings.Contains(input.Prompt, "用户提示词") {
		t.Errorf("用户提示词应保留在后：%q", input.Prompt)
	}

	// ② 非 F-09（ProductImageCount = 0）零影响
	input = base()
	input.Config.ProductImageCount = 0
	applyCloneSkeletonPrompt(input)
	if input.Prompt != "用户提示词" {
		t.Errorf("ProductImageCount=0 时不应注入：%q", input.Prompt)
	}

	// ③ 非图片模式零影响
	input = base()
	input.Mode = "video"
	applyCloneSkeletonPrompt(input)
	if input.Prompt != "用户提示词" {
		t.Errorf("video 模式不应注入：%q", input.Prompt)
	}

	// ④ 空提示词时直接给骨架
	input = base()
	input.Prompt = ""
	applyCloneSkeletonPrompt(input)
	if !strings.HasPrefix(input.Prompt, "任务：根据“版式参考图组”") {
		t.Errorf("空提示词应得到骨架：%q", input.Prompt)
	}

	// ⑤ nil 安全
	applyCloneSkeletonPrompt(nil)
}

func TestApplyCloneSkeletonPromptIncludesDynamicRules(t *testing.T) {
	input := &canvasGenerationInput{
		Mode:   "image",
		Prompt: "用户提示词",
		Config: providerConfig{
			ProductImageCount: 1,
			ClonePromptParams: clonePromptParams{CloneDegree: "style-reference", CloneScope: []string{"palette"}, CopyMode: "no-copy"},
		},
	}
	applyCloneSkeletonPrompt(input)
	for _, want := range []string{"\n复刻策略：", "\n风格参考范围：", "\n画面文字策略：", "主辅色比例、对比和氛围"} {
		if !strings.Contains(input.Prompt, want) {
			t.Errorf("动态段缺少 %q：%q", want, input.Prompt)
		}
	}
}
