package app

import (
	"fmt"
	"testing"

	"infinite-canvas/backend/internal/model"
)

func TestImagePriceTiersMatchResolutionAndActualReferences(t *testing.T) {
	channelModel := model.ChannelModel{}
	for _, operation := range []string{"text_to_image", "image_to_image"} {
		for _, quality := range []string{"1k", "2k", "4k"} {
			channelModel.PriceTiers = append(channelModel.PriceTiers, model.ChannelModelPriceTier{
				ID: operation + "-" + quality, SelectorJSON: fmt.Sprintf(`{"operation":%q,"quality":%q}`, operation, quality), Enabled: true, PriceConfigured: true,
			})
		}
	}
	for _, operation := range []string{"", "image", "text_to_image", "image_to_image"} {
		for _, quality := range []string{"1K", "2K", "4K"} {
			for _, imageCount := range []int{0, 1, 3} {
				intent := ModelRequestIntentFromTaskInput(map[string]any{
					"mode": "image", "referenceImages": make([]any, imageCount), "config": map[string]any{"quality": quality},
				}, "canvas_image", operation)
				wantOperation := "text_to_image"
				if imageCount > 0 {
					wantOperation = "image_to_image"
				}
				tier := channelModelPriceTierForIntent(channelModel, intent)
				if tier == nil || tier.ID != wantOperation+"-"+skuSelectorForIntent(intent)["quality"] {
					t.Fatalf("operation=%q quality=%q imageCount=%d: tier=%#v", operation, quality, imageCount, tier)
				}
			}
		}
	}
	if tier := channelModelPriceTierForIntent(channelModel, ModelRequestIntent{Capability: "image", Options: map[string]any{"quality": "8k"}}); tier != nil {
		t.Fatalf("unconfigured resolution matched tier: %#v", tier)
	}
}

func TestAutoQualityIsOmittedFromCapabilityIntent(t *testing.T) {
	intent := ModelRequestIntentFromTaskInput(map[string]any{
		"mode":              "image",
		"capabilityOptions": map[string]any{"quality": "auto", "size": "2048x878"},
	}, "canvas_image", "image")
	if _, exists := intent.Options["quality"]; exists {
		t.Fatalf("quality option = %#v, want omitted for auto", intent.Options["quality"])
	}
	if intent.Options["size"] != "2048x878" {
		t.Fatalf("size option = %#v, want preserved", intent.Options["size"])
	}
}

func TestModelRequestIntentNormalizesVideoResolution(t *testing.T) {
	input := map[string]any{
		"mode":   "video",
		"config": map[string]any{"vquality": "480", "videoSeconds": "6", "size": "16:9"},
	}
	intent := ModelRequestIntentFromTaskInput(input, "video_generate", "text_to_video")
	if got := intent.Options["vquality"]; got != "480p" {
		t.Fatalf("vquality = %#v, want 480p", got)
	}
}

func TestModelRequestIntentNormalizesNumericVideoResolution(t *testing.T) {
	for value, want := range map[string]string{
		"768": "768p", "768p": "768p", "768P": "768p",
		"960": "960p", "960P": "960p",
	} {
		intent := ModelRequestIntentFromTaskInput(map[string]any{
			"mode":   "video",
			"config": map[string]any{"vquality": value},
		}, "canvas_video", "image_to_video")
		if got := intent.Options["vquality"]; got != want {
			t.Errorf("vquality %q normalized to %#v, want %s", value, got, want)
		}
	}
}

func TestModelRequestIntentNormalizesImageSpecificationValues(t *testing.T) {
	input := map[string]any{
		"mode":   "image",
		"config": map[string]any{"quality": "1K", "size": "3:2"},
	}
	intent := ModelRequestIntentFromTaskInput(input, "canvas_image", "image")
	if got := intent.Options["quality"]; got != "1k" {
		t.Fatalf("quality = %#v, want 1k", got)
	}
	if got := intent.Options["size"]; got != "3:2" {
		t.Fatalf("size = %#v, want 3:2", got)
	}
}

func TestSKUSelectorInfersImageResolutionFromSizeWhenQualityIsAutomatic(t *testing.T) {
	for _, test := range []struct {
		size string
		want string
	}{
		{size: "1024x1024", want: "1k"},
		{size: "2048x2048", want: "2k"},
		{size: "2880x2880", want: "4k"},
	} {
		selector := skuSelectorForIntent(ModelRequestIntent{Capability: "image", Options: map[string]any{"quality": "auto", "size": test.size}})
		if selector["quality"] != test.want {
			t.Fatalf("size %s quality = %q, want %q", test.size, selector["quality"], test.want)
		}
	}
}

func TestSKUSelectorHandlesMissingImageOptions(t *testing.T) {
	for _, quality := range []any{nil, "", "auto", "any"} {
		options := map[string]any{"size": "2048x2048"}
		if quality != nil {
			options["quality"] = quality
		}
		selector := skuSelectorForIntent(ModelRequestIntent{Capability: "image", Options: options})
		if selector["quality"] != "2k" {
			t.Errorf("quality=%#v: selector=%#v, want 2k", quality, selector)
		}
	}
	for _, options := range []map[string]any{nil, {}, {"quality": nil, "size": nil}} {
		selector := skuSelectorForIntent(ModelRequestIntent{Capability: "image", Options: options})
		if len(selector) != 1 || selector["operation"] != "text_to_image" {
			t.Errorf("missing options produced synthetic specification: %#v", selector)
		}
	}
}

func TestSKUSelectorKeepsImageUpscaleOperation(t *testing.T) {
	// O-03 层2：AI 超分必须保留自己的 operation，否则会被归并到 image_to_image，
	// 导致渠道无法为超分配置独立价格档（超分与普通改图同价）。
	selector := skuSelectorForIntent(ModelRequestIntent{Capability: "image", Operation: "image_upscale", Inputs: map[string]int{"image": 1}, Options: map[string]any{"quality": "2k"}})
	if selector["operation"] != "image_upscale" {
		t.Fatalf("operation = %q, want image_upscale (selector=%#v)", selector["operation"], selector)
	}
	// 大小写与空白必须归一化后仍命中（前端传入不保证大小写）。
	for _, operation := range []string{"IMAGE_UPSCALE", " image_upscale "} {
		selector := skuSelectorForIntent(ModelRequestIntent{Capability: "image", Operation: operation, Inputs: map[string]int{"image": 1}})
		if selector["operation"] != "image_upscale" {
			t.Errorf("operation=%q: selector[operation] = %q, want image_upscale", operation, selector["operation"])
		}
	}
}

// ★ F-1（评审线 R1，证据恢复版）：带 quality/size 条件的超分价格档必须能命中。
//
// 缺陷（三条断言，均经独立读码验证）：
//   ① model_router.go 原 :308-311 在 image_upscale 分支直接 `break`，跳过后面的
//      quality/size 归一化 ⇒ 超分请求 selector 永远只有 {operation: image_upscale}
//   ② matchSKUSelector 对缺失键取零值比较（requested["quality"]="" != "2k"）⇒ 返回 false
//      ⇒ 带条件的超分档永不命中
//   ③ channelModelPriceTierForIntent 随后落到通配档（全键 continue ⇒ score=0）
//      ⇒ 静默按通配价计费（不报错）
//
// ★ 测试形态（控制线硬性要求）：**行为级** —— 构造带 quality 的超分档，断言**能命中**，
// 不是源码文本断言。同时验证反例（无匹配档时不得静默落通配）。
func TestImageUpscalePriceTierMatchesQualityCondition(t *testing.T) {
	channelModel := model.ChannelModel{PriceTiers: []model.ChannelModelPriceTier{
		{ID: "upscale-2k", SelectorJSON: `{"operation":"image_upscale","quality":"2k"}`, Enabled: true, PriceConfigured: true},
		{ID: "upscale-4k", SelectorJSON: `{"operation":"image_upscale","quality":"4k"}`, Enabled: true, PriceConfigured: true},
		// 通配档（score=0）：缺陷存在时超分会静默落到它。
		{ID: "any-anything", SelectorJSON: `{"operation":"*"}`, Enabled: true, PriceConfigured: true},
	}}
	// 超分请求：size=2048x2048 → normalizeImagePriceQuality ⇒ "2k"
	intent := ModelRequestIntentFromTaskInput(map[string]any{
		"mode": "image", "referenceImages": []any{map[string]any{}}, "config": map[string]any{"size": "2048x2048"},
	}, "canvas_image", "image_upscale")
	selector := skuSelectorForIntent(intent)
	if selector["operation"] != "image_upscale" {
		t.Fatalf("operation = %q, want image_upscale (selector=%#v)", selector["operation"], selector)
	}
	if selector["quality"] != "2k" {
		t.Fatalf("quality = %q, want 2k —— 超分 selector 必须包含 quality（F-1 修复点）", selector["quality"])
	}
	tier := channelModelPriceTierForIntent(channelModel, intent)
	if tier == nil || tier.ID != "upscale-2k" {
		t.Fatalf("tier = %#v, want upscale-2k（带条件的超分档必须命中，而非静默落通配档）", tier)
	}
}

// ★ F-1 反例一：带条件的超分档**优先于**通配档（分数排序契约）。
// 若实现回退到 `break`（selector 无 quality），"upscale-2k" 不会匹配（缺失键零值比较失败），
// 结果会落到通配档 —— 本断言即红，正是缺陷形态。
func TestImageUpscaleSpecificTierBeatsWildcard(t *testing.T) {
	channelModel := model.ChannelModel{PriceTiers: []model.ChannelModelPriceTier{
		{ID: "any-anything", SelectorJSON: `{"operation":"*"}`, Enabled: true, PriceConfigured: true},
		{ID: "upscale-2k", SelectorJSON: `{"operation":"image_upscale","quality":"2k"}`, Enabled: true, PriceConfigured: true},
	}}
	intent := ModelRequestIntentFromTaskInput(map[string]any{
		"mode": "image", "referenceImages": []any{map[string]any{}}, "config": map[string]any{"size": "2048x2048"},
	}, "canvas_image", "image_upscale")
	tier := channelModelPriceTierForIntent(channelModel, intent)
	if tier == nil || tier.ID != "upscale-2k" {
		t.Fatalf("tier = %#v, want upscale-2k（带条件档分数高于通配档，必须优先命中）", tier)
	}
}

// ★ F-1 反例二：既无匹配的带条件档、也无通配档时，必须**显式返回 nil**
// （调用方报「当前模型尚未配置所选规格的价格」），而不是静默按某个价计费。
func TestImageUpscaleWithoutAnyMatchingTierReturnsNil(t *testing.T) {
	channelModel := model.ChannelModel{PriceTiers: []model.ChannelModelPriceTier{
		{ID: "upscale-4k", SelectorJSON: `{"operation":"image_upscale","quality":"4k"}`, Enabled: true, PriceConfigured: true},
	}}
	intent := ModelRequestIntentFromTaskInput(map[string]any{
		"mode": "image", "referenceImages": []any{map[string]any{}}, "config": map[string]any{"size": "2048x2048"},
	}, "canvas_image", "image_upscale")
	if tier := channelModelPriceTierForIntent(channelModel, intent); tier != nil {
		t.Fatalf("2K 超分无匹配档时必须返回 nil（显式失败），got %#v", tier)
	}
}

func TestSKUSelectorKeepsImageToImageForOtherEdits(t *testing.T) {
	// 回归保护：非超分的图片编辑仍走 image_to_image，不被超分分支影响。
	for _, operation := range []string{"", "image_to_image", "mask_edit"} {
		selector := skuSelectorForIntent(ModelRequestIntent{Capability: "image", Operation: operation, Inputs: map[string]int{"image": 1}})
		if selector["operation"] != "image_to_image" {
			t.Errorf("operation=%q: selector[operation] = %q, want image_to_image", operation, selector["operation"])
		}
	}
	// 无输入图时仍是 text_to_image（超分分支不得改变该判定）。
	selector := skuSelectorForIntent(ModelRequestIntent{Capability: "image", Operation: "image_upscale"})
	if selector["operation"] != "image_upscale" {
		t.Fatalf("超分无输入图也应保留 operation，got %q", selector["operation"])
	}
}

func TestSKUSelectorIncludesVideoReferenceImageCount(t *testing.T) {
	selector := skuSelectorForIntent(ModelRequestIntent{Capability: "video", Inputs: map[string]int{"image": 5}, Options: map[string]any{"vquality": "720p"}})
	if selector["imageCount"] != "5" || selector["vquality"] != "720p" {
		t.Fatalf("selector = %#v", selector)
	}
	modelWithTiers := model.ChannelModel{PriceTiers: []model.ChannelModelPriceTier{
		{SelectorJSON: `{"vquality":"720p","imageCount":"5"}`, Enabled: true, PriceConfigured: true},
		{SelectorJSON: `{"vquality":"720p","imageCount":"9"}`, Enabled: true, PriceConfigured: true},
	}}
	matched := channelModelPriceTierForIntent(modelWithTiers, ModelRequestIntent{Capability: "video", Inputs: map[string]int{"image": 5}, Options: map[string]any{"vquality": "720p"}})
	if matched == nil || matched.SelectorJSON != `{"vquality":"720p","imageCount":"5"}` {
		t.Fatalf("matched tier = %#v", matched)
	}
}

func TestSKUSelectorTreatsAnyVideoReferenceAsVideoToVideo(t *testing.T) {
	intent := ModelRequestIntentFromTaskInput(map[string]any{
		"mode":              "video",
		"referenceImages":   []any{map[string]any{"url": "https://example.com/reference.png"}},
		"referenceVideos":   []any{map[string]any{"url": "https://example.com/reference.mp4"}},
		"referenceAudios":   []any{map[string]any{"url": "https://example.com/reference.mp3"}},
		"capabilityOptions": map[string]any{"vquality": "720p"},
	}, "canvas_video", "reference_to_video")
	selector := skuSelectorForIntent(intent)
	if selector["operation"] != "video_to_video" {
		t.Fatalf("operation = %q, want video_to_video; selector = %#v", selector["operation"], selector)
	}

	modelWithTiers := model.ChannelModel{PriceTiers: []model.ChannelModelPriceTier{
		{SelectorJSON: `{}`, Enabled: true, PriceConfigured: true},
		{SelectorJSON: `{"operation":"video_to_video"}`, Enabled: true, PriceConfigured: true},
	}}
	matched := channelModelPriceTierForIntent(modelWithTiers, intent)
	if matched == nil || matched.SelectorJSON != `{"operation":"video_to_video"}` {
		t.Fatalf("matched tier = %#v", matched)
	}
}

func TestSKUSelectorTreatsAnyImageReferenceCountAsImageToVideo(t *testing.T) {
	intent := ModelRequestIntentFromTaskInput(map[string]any{
		"mode": "video",
		"referenceImages": []any{
			map[string]any{"url": "https://example.com/reference-1.png"},
			map[string]any{"url": "https://example.com/reference-2.png"},
			map[string]any{"url": "https://example.com/reference-3.png"},
		},
	}, "canvas_video", "reference_to_video")
	selector := skuSelectorForIntent(intent)
	if selector["operation"] != "image_to_video" || selector["imageCount"] != "3" {
		t.Fatalf("selector = %#v, want image_to_video with imageCount 3", selector)
	}

	modelWithTiers := model.ChannelModel{PriceTiers: []model.ChannelModelPriceTier{
		{SelectorJSON: `{}`, Enabled: true, PriceConfigured: true},
		{SelectorJSON: `{"operation":"image_to_video"}`, Enabled: true, PriceConfigured: true},
	}}
	matched := channelModelPriceTierForIntent(modelWithTiers, intent)
	if matched == nil || matched.SelectorJSON != `{"operation":"image_to_video"}` {
		t.Fatalf("matched tier = %#v", matched)
	}
}
