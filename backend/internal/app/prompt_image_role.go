// 提示词前置注入层（图片角色清单）。
//
// 来源：F-09 克隆复刻（clone-to-edit）二期 —— ImgAk 的 imageRolePrompt 机制。
// 影策此前没有这一层：workflowFieldsBindPrompt 只判断「有没有提示词字段」，
// 不拼装角色清单（见 F-09-IMPLEMENTATION-PLAN §1.1 证据 3）。
//
// 三个实现要点（方案 §7「由裁定 6 引出的实施要求」）：
//  1. position=prepend —— 角色清单在提示词最前，由调用方拼装（本文件只生成段落）
//  2. 编号顺序必须对齐【实际发给 API 的图片数组顺序】—— 不是表单展示顺序
//  3. 空槽位也要注入说明（emptyText）—— 防模型把参考图中的品牌当作保真主体
//
// 关于编号顺序（方案 §1.1 ⑦ 陷阱）：ImgAk 的 roles 顺序与 paramMappings 一致
// （product 在前），与表单/展示顺序相反。写反了不报错，只是输出「有点不对」，
// 因此 buildImageRolePrompt 只接受【已经定序】的计数，由调用方在传参组装后调用。

package app

import (
	"fmt"
	"strings"
)

const (
	imageRolePromptHeading = "输入图片角色清单："
	imageRoleProductLabel  = "产品图组"
	imageRoleLayoutLabel   = "版式参考图组"
	// 无产品图时的 emptyText（方案 §1.1 ① 逐字，勿改标点/空格）。
	imageRoleProductEmptyText = "用户未上传替换主体图：不要把版式参考图中的品牌、Logo或旧文案当作需要保真的替换主体；人物仍按复刻方式处理。"
)

// buildImageRolePrompt 生成图片角色清单段落（prepend 段）。
//
// productImageCount 是【产品图】在最终 API 图片数组中的张数，其余
// （totalImages - productImageCount）为版式参考图。调用方必须传入已定序的计数：
// 编号对应的是发给 API 的数组顺序，不是前端表单顺序。
//
// totalImages == 0 时返回空串（没有图片就没有角色可声明）。
func buildImageRolePrompt(productImageCount int, totalImages int) string {
	if totalImages <= 0 {
		return ""
	}
	if productImageCount < 0 {
		productImageCount = 0
	}
	if productImageCount > totalImages {
		productImageCount = totalImages
	}
	layoutImageCount := totalImages - productImageCount

	var builder strings.Builder
	builder.WriteString(imageRolePromptHeading)
	builder.WriteString("\n")
	builder.WriteString(fmt.Sprintf("共 %d 张输入图。\n", totalImages))
	if productImageCount > 0 {
		builder.WriteString(fmt.Sprintf("图1～%d（%s）：只负责定义需要保真的替换商品；第一张为主角度。\n",
			productImageCount, imageRoleProductLabel))
	} else {
		// 空槽位仍要注入说明（要点 3）。
		builder.WriteString(fmt.Sprintf("%s\n", imageRoleProductEmptyText))
	}
	if layoutImageCount > 0 {
		builder.WriteString(fmt.Sprintf("图%d～%d（%s）：定义视觉方案；第一张为主版式。\n",
			productImageCount+1, totalImages, imageRoleLayoutLabel))
	}
	builder.WriteString(fmt.Sprintf("严禁把%s与%s的角色互换。", imageRoleProductLabel, imageRoleLayoutLabel))
	return builder.String()
}

// prependImageRolePrompt 把角色清单段插到提示词最前（position=prepend）。
//
// 空清单时原样返回，避免在提示词前多出空行。角色清单与用户提示词之间用空行分隔，
// 与 withSystemPrompt 的分隔风格一致。
func prependImageRolePrompt(prompt string, productImageCount int, totalImages int) string {
	section := buildImageRolePrompt(productImageCount, totalImages)
	if section == "" {
		return prompt
	}
	if strings.TrimSpace(prompt) == "" {
		return section
	}
	return section + "\n\n" + prompt
}

// applyImageRolePrompt 在媒体已定序后把图片角色清单注入提示词（F-09 二期接线点）。
//
// 只在图片模式、且声明了 ProductImageCount 时生效：非 F-09 任务保持零影响。
// 编号取 len(input.ReferenceImages)，即最终发给 API 的数组长度 —— 方案 §1.1 ⑦ 的
// 「编号必须对齐 API 数组」在这里落地；若上游改动了图片顺序，这里也会跟着对齐。
func applyImageRolePrompt(input *canvasGenerationInput) {
	if input == nil || input.Mode != "image" {
		return
	}
	if input.Config.ProductImageCount <= 0 {
		return
	}
	input.Prompt = prependImageRolePrompt(input.Prompt, input.Config.ProductImageCount, len(input.ReferenceImages))
}
