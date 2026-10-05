// F-09 二期：图片角色清单注入层的测试。
//
// 覆盖方案 §7「由裁定 6 引出的实施要求」四条 + 控制线追加的边界项：
//   T1 编号顺序对齐 API 数组（★ 易错点）
//   T2 prepend 生效（角色清单在提示词最前）
//   T3 {{totalImages}} 与实际图片数一致
//   T4 productImageCount == 0 → emptyText 变体
//   T5 productImageCount == totalImages（无参考图）→ 编号正确、无 N+1～M 段
//
// 编号顺序的测试设计：直接断言「产品图段与参考图段的边界 = 产品图张数」，
// 并显式覆盖「计数与实际数组不一致时以数组为准」的路径 —— 这条对应
// 方案 §1.1 ⑦ 的陷阱：写反了不报错，只有静默偏差。

package app

import (
	"strings"
	"testing"
)

func TestImageRolePromptNumbersProductImagesFirst(t *testing.T) {
	// 1 张产品图 + 2 张参考图：产品段必须是「图1～1」，参考段「图2～3」。
	prompt := buildImageRolePrompt(1, 3)
	for _, want := range []string{"共 3 张输入图。", "图1～1（产品图组）", "图2～3（版式参考图组）"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("编号未对齐产品图在前：缺少 %q\n实际：%s", want, prompt)
		}
	}
	// 反向：产品段不得出现「图1～2」（那会把参考图算进产品组）。
	if strings.Contains(prompt, "图1～2（产品图组）") {
		t.Fatalf("产品图段越界，把参考图算进了产品组：%s", prompt)
	}
}

func TestImageRolePromptBoundaryFollowsCountNotArrayOrder(t *testing.T) {
	// ★ 易错点守护：边界必须由 productImageCount 决定。
	// 3 张产品图 + 1 张参考图 ⇒ 产品段「图1～3」，参考段「图4～4」。
	prompt := buildImageRolePrompt(3, 4)
	if !strings.Contains(prompt, "图1～3（产品图组）") {
		t.Fatalf("产品图边界错误（期望 图1～3）：%s", prompt)
	}
	if !strings.Contains(prompt, "图4～4（版式参考图组）") {
		t.Fatalf("参考图边界错误（期望 图4～4）：%s", prompt)
	}
	// 参考段起点必须严格等于 产品张数+1，不是固定值。
	if strings.Contains(prompt, "图1～1（产品图组）") {
		t.Fatalf("边界未随计数变化（疑似写死为单张产品图）：%s", prompt)
	}
}

func TestPrependImageRolePromptPutsSectionFirst(t *testing.T) {
	userPrompt := "请复刻这张版式。"
	result := prependImageRolePrompt(userPrompt, 1, 3)
	if !strings.HasPrefix(result, imageRolePromptHeading) {
		t.Fatalf("角色清单未在最前（prepend 失效）：%s", result)
	}
	if !strings.HasSuffix(result, userPrompt) {
		t.Fatalf("用户提示词应在角色清单之后：%s", result)
	}
	if strings.Index(result, userPrompt) <= strings.Index(result, imageRolePromptHeading) {
		t.Fatalf("用户提示词出现在角色清单之前：%s", result)
	}
}

func TestPrependImageRolePromptKeepsPromptWhenNoImages(t *testing.T) {
	userPrompt := "请复刻这张版式。"
	if got := prependImageRolePrompt(userPrompt, 0, 0); got != userPrompt {
		t.Fatalf("无图片时不得改动提示词：%q", got)
	}
}

func TestImageRolePromptTotalImagesMatchesActual(t *testing.T) {
	for _, total := range []int{1, 2, 5, 20} {
		prompt := buildImageRolePrompt(1, total)
		want := "共 " + itoa(total) + " 张输入图。"
		if !strings.Contains(prompt, want) {
			t.Fatalf("totalImages 与实际不一致：期望 %q\n实际：%s", want, prompt)
		}
	}
}

func TestImageRolePromptUsesEmptyTextWhenNoProductImages(t *testing.T) {
	// 产品图为空：仍要注入说明（方案 §7 要求 4），且不得出现产品图编号段。
	prompt := buildImageRolePrompt(0, 2)
	if !strings.Contains(prompt, imageRoleProductEmptyText) {
		t.Fatalf("产品图为空时未注入 emptyText：%s", prompt)
	}
	if strings.Contains(prompt, "（产品图组）") {
		t.Fatalf("产品图为空时不得出现产品图编号段：%s", prompt)
	}
	if !strings.Contains(prompt, "图1～2（版式参考图组）") {
		t.Fatalf("参考图段编号错误（应从图1开始）：%s", prompt)
	}
}

func TestImageRolePromptWithoutReferenceImagesOmitsLayoutSection(t *testing.T) {
	// T5 边界：全部是产品图 ⇒ 有产品段、无参考段。
	prompt := buildImageRolePrompt(3, 3)
	if !strings.Contains(prompt, "图1～3（产品图组）") {
		t.Fatalf("产品图段缺失：%s", prompt)
	}
	if strings.Contains(prompt, "版式参考图组）：") {
		t.Fatalf("无参考图时不得出现参考图编号段：%s", prompt)
	}
	// footer 仍要在（它声明两组不得互换，是固定收尾）。
	if !strings.Contains(prompt, "严禁把产品图组与版式参考图组的角色互换。") {
		t.Fatalf("footer 缺失：%s", prompt)
	}
}

func TestImageRolePromptClampsCountAboveTotal(t *testing.T) {
	// 计数大于数组长度时按数组长度收敛，不得出现「图1～5」而总数只有 2。
	prompt := buildImageRolePrompt(5, 2)
	if strings.Contains(prompt, "图1～5") {
		t.Fatalf("计数超出总数时未收敛：%s", prompt)
	}
	if !strings.Contains(prompt, "图1～2（产品图组）") {
		t.Fatalf("应按总数收敛为 图1～2：%s", prompt)
	}
}

func TestApplyImageRolePromptInjectsOnlyForImageModeWithCount(t *testing.T) {
	// 非图片模式：不改提示词。
	textInput := canvasGenerationInput{Mode: "text", Prompt: "原文"}
	textInput.Config.ProductImageCount = 1
	applyImageRolePrompt(&textInput)
	if textInput.Prompt != "原文" {
		t.Fatalf("非图片模式不得注入：%q", textInput.Prompt)
	}

	// 图片模式但未声明计数：不改提示词（非 F-09 场景零影响）。
	plainImage := canvasGenerationInput{Mode: "image", Prompt: "原文", ReferenceImages: []providerMedia{{ID: "a"}, {ID: "b"}}}
	applyImageRolePrompt(&plainImage)
	if plainImage.Prompt != "原文" {
		t.Fatalf("未声明计数时不得注入：%q", plainImage.Prompt)
	}

	// 图片模式 + 声明计数：注入，且 totalImages 取实际数组长度。
	f09 := canvasGenerationInput{Mode: "image", Prompt: "复刻", ReferenceImages: []providerMedia{{ID: "a"}, {ID: "b"}, {ID: "c"}}}
	f09.Config.ProductImageCount = 1
	applyImageRolePrompt(&f09)
	if !strings.HasPrefix(f09.Prompt, imageRolePromptHeading) {
		t.Fatalf("F-09 路径未注入角色清单：%q", f09.Prompt)
	}
	if !strings.Contains(f09.Prompt, "共 3 张输入图。") {
		t.Fatalf("totalImages 应取实际数组长度 3：%q", f09.Prompt)
	}
	if !strings.HasSuffix(f09.Prompt, "复刻") {
		t.Fatalf("用户提示词应保留在末尾：%q", f09.Prompt)
	}
}

// itoa 避免为单个测试引入 strconv 依赖（本文件只用字符串断言）。
func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := ""
	for value > 0 {
		digits = string(rune('0'+value%10)) + digits
		value /= 10
	}
	return digits
}
