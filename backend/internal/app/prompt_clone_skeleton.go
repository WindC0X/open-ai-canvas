// 提示词前置注入层（爆款复刻六段式骨架 + 动态段）。
//
// 来源：F-09 克隆复刻（clone-to-edit）三期 —— ImgAk wfapp-52 的完整提示词模板。
// 一手逐字取自 docs/artifacts/f09-input-spec/S1-meitu-piccopilot-deep-dive/corpus/imgak/wfapp-52-detail.json
// 的 inputs[17]（output.prompt 六段式正文）与 inputs[5]/[6]/[8]（concatRules 的 des 文本）。
//
// ★ 为什么放在后端（控制线 2026-10-06 裁定 C-2）：
//   1. 第四段「原创与文字安全」是 H3 合规红线，属判据级要求，不可由用户误改破坏；
//   2. concatRules 的拼装源是选项的 `des` 文本（sourceProperty: "des"）——
//      若前端也存一份会形成两份真值（V1）；后端单点存放，前端只提交选项 value。
//
// ★ 触发条件：与角色清单同源（ProductImageCount > 0），非 F-09 请求零影响。
//
// 与 prompt_image_role.go 的分工：
//   - prompt_image_role.go  层1：角色清单（哪张图是什么角色）
//   - prompt_clone_skeleton.go 层2：六段式骨架 + 动态段（怎么复刻）
//   两段都由 applyClonePromptLayers 依次 prepend，层1 在最前。

package app

import (
	"fmt"
	"strings"
)

// 六段式骨架（前五段固定，第六段为动态段）。
// ★ 逐字取自 wfapp-52 inputs[17].value，勿改标点/空格。
const (
	cloneSkeletonTask       = "任务：根据“版式参考图组”制作一张原创商业视觉。用户替换主体图组定义需要保持真实并替换进成片的商品或主体；版式参考图组定义视觉方案，并可按复刻方式决定参考人物是否保留。两组图片不得混淆，也不得因为替换商品而误删参考图中需要保留的人物。"
	cloneSkeletonPriority   = "优先级：用户明确要求与准确文案 > 用户替换主体身份和事实 > 高度复刻的人物保留要求 > 逐张参考要求 > 选择的复刻策略 > 风格参考范围 > 模型自由发挥。冲突时按此前顺序执行。"
	cloneSkeletonFidelity   = "主体真实性：如提供主体图，必须保持可见类别、数量、轮廓比例、主色、材质、图案、Logo相对位置和结构部件；不要凭空增加功能、配件、认证、规格或卖点。看不清的细节要保守处理。"
	cloneSkeletonCompliance = "原创与文字安全：不得照搬参考图中的品牌、Logo、水印、受保护角色、独特插画或旧广告文案。人物身份只在“高度复刻”中按该模式的明确规则保留；“参考风格”不得复刻可识别人脸或人物身份。除用户准确文案或用户主体图中清晰可确认的内容外，不得生成价格、折扣、销量、排名、功效、证言、认证、参数或其他主体事实。"
	cloneSkeletonOutput     = "输出要求：只生成一张完成度高的成片，不输出对比图、步骤图、网格草稿、解释文字或额外边框。只有画面文字模式明确允许时才添加文字，文字必须简短、可读并服从所选语言。"
)

// 动态段的 separator（concatRules 逐字）。
const (
	cloneRuleSeparatorDegree = "\n复刻策略："
	cloneRuleSeparatorScope  = "\n风格参考范围："
	cloneRuleSeparatorCopy   = "\n画面文字策略："
)

// cloneRuleDegreeText 复刻程度选项的 des 文本（inputs[5].constraint.item[].des 逐字）。
var cloneRuleDegreeText = map[string]string{
	"style-reference": "只参考下方选中的视觉范围并重构场景、细节与构图；人物身份默认不参考，即使选择人物/模特主体，也必须更换长相和可识别身份。",
	"high-structure":  "保持参考图的高层信息层级、主体占比、主要分区和光线关系；如果参考图含人物或模特，默认保留同一人物的可识别身份、人数、姿态、画面位置及与商品的互动，不得省略人物或改成无人画面。用户主体图只替换其对应商品或指定主体；除非用户明确要求，不替换参考人物。重建品牌、文案和独特细节，不得逐像素临摹。",
}

// cloneRuleScopeText 复刻侧重选项的 des 文本（inputs[6].constraint.item[].des 逐字）。
var cloneRuleScopeText = map[string]string{
	"composition":   "构图、主体占比、视觉动线与留白。",
	"palette":       "主辅色比例、对比和氛围，不机械复制色值。",
	"lighting":      "光向、明暗层次、阴影和材质表现。",
	"typography":    "只参考字号层级、位置与装饰方式，不复制原文。",
	"background":    "参考背景空间关系和道具类别，重新设计具体元素。",
	"people-models": "只参考人物或模特的类型、人数、姿态、画面位置、穿搭气质及与商品的互动；必须重新生成人物身份与面部特征，使长相和可识别身份与参考人物明显不同。",
}

// cloneRuleCopyText 文字策略选项的 des 文本（inputs[8].constraint.item[].des 逐字）。
var cloneRuleCopyText = map[string]string{
	"no-copy":    "画面不添加标题、卖点、价格、Logo或随机乱码。",
	"auto-copy":  "根据参考图的视觉主题、用户主体图中清晰可确认的信息、成片用途、平台与目标市场，自动生成 1 条简短标题，必要时增加 1 条中性行动语并排入画面。不得照抄参考图文字，不得编造品牌名、价格、折扣、销量、排名、参数、功效、认证或其他无法核实事实；信息不足时使用不涉及主体事实的中性文案。",
	"exact-copy": "只使用用户在下方填写的准确文字；保持原意、拼写、数字和标点，不擅自增加主体事实。",
}

// clonePromptParams 动态段参数（前端提交的选项 value）。
//
// ★ 只传 value 不传 des 文本：des 文本在本文件单点存放（防两份真值，V1）。
// 空值表示用户未选择该参数 ⇒ 该规则不拼装。
type clonePromptParams struct {
	CloneDegree string   `json:"cloneDegree,omitempty"`
	CloneScope  []string `json:"cloneScope,omitempty"`
	CopyMode    string   `json:"copyMode,omitempty"`
}

// buildCloneSkeletonPrompt 生成六段式骨架（前五段固定文本）。
//
// 第六段（动态段）由 buildCloneDynamicRules 单独生成后追加。
func buildCloneSkeletonPrompt() string {
	return strings.Join([]string{
		cloneSkeletonTask,
		cloneSkeletonPriority,
		cloneSkeletonFidelity,
		cloneSkeletonCompliance,
		cloneSkeletonOutput,
	}, "\n")
}

// buildCloneDynamicRules 按用户选择拼装动态段（concatRules 的 3 条实现）。
//
// ★ 本批只实现 3 条（三期只有 3 个参数面）：clone.degree / clone.scope / copy.mode。
// 其余 8 条（clone.type / reference.requirements.prompt / copy.text / market.* /
// product.fidelity / clone.globalRequirements）三期无 UI 可填值，不实现。
//
// ★ 条件规则：clone.scope 仅在 clone.degree == "style-reference" 时拼装
// （一手 concatRules 的 conditions 逐字）。
func buildCloneDynamicRules(params clonePromptParams) string {
	var builder strings.Builder

	if text, ok := cloneRuleDegreeText[params.CloneDegree]; ok {
		builder.WriteString(cloneRuleSeparatorDegree)
		builder.WriteString(text)
	}

	// ★ 条件触发：只有「参考风格」档才声明风格参考范围（一手规则逐字）。
	if params.CloneDegree == "style-reference" && len(params.CloneScope) > 0 {
		parts := make([]string, 0, len(params.CloneScope))
		for _, scope := range params.CloneScope {
			if text, ok := cloneRuleScopeText[scope]; ok {
				parts = append(parts, text)
			}
		}
		if len(parts) > 0 {
			builder.WriteString(cloneRuleSeparatorScope)
			builder.WriteString(strings.Join(parts, ""))
		}
	}

	if text, ok := cloneRuleCopyText[params.CopyMode]; ok {
		builder.WriteString(cloneRuleSeparatorCopy)
		builder.WriteString(text)
	}

	return builder.String()
}

// applyCloneSkeletonPrompt 把六段式骨架 + 动态段 prepend 到提示词。
//
// 与 applyImageRolePrompt 同构：mode == image 且 ProductImageCount > 0 时生效，
// 非 F-09 请求零影响。空提示词直接返回骨架（骨架本身即完整指令）。
func applyCloneSkeletonPrompt(input *canvasGenerationInput) {
	if input == nil || input.Mode != "image" || input.Config.ProductImageCount <= 0 {
		return
	}
	section := buildCloneSkeletonPrompt() + buildCloneDynamicRules(input.Config.ClonePromptParams)
	if section == "" {
		return
	}
	base := strings.TrimSpace(input.Prompt)
	if base == "" {
		input.Prompt = section
		return
	}
	input.Prompt = section + "\n\n" + base
}

// 确保 fmt 被使用（调试与错误信息）。
var _ = fmt.Sprintf
