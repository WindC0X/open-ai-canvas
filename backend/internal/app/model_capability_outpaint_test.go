package app

import "testing"

func TestDefaultImageCapabilityConfigSeedsOutpaintTier(t *testing.T) {
	cases := []struct {
		protocol string
		model    string
		want     string
	}{
		{"openai-image", "nano-banana-2", ImageOutpaintTierRecommended},
		{"gemini-image", "nano-banana2", ImageOutpaintTierRecommended},
		{"gemini-image", "gemini-3.1-flash-image-preview", ImageOutpaintTierRecommended},
		{"openai-image", "gpt-image-2.5", ""},
		{"openai-image", "gpt-image-2.5-sunburst", ""},
	}
	for _, tc := range cases {
		got := DefaultImageCapabilityConfig(tc.protocol, tc.model)
		if got.OutpaintTier != tc.want {
			t.Fatalf("%s/%s outpaintTier = %q, want %q", tc.protocol, tc.model, got.OutpaintTier, tc.want)
		}
	}
}

func TestNormalizeImageCapabilityOutpaintTier(t *testing.T) {
	// 显式档位保留（含显式降档 uncertified）
	explicit := DefaultImageCapabilityConfig("openai-image", "gpt-image-2.5")
	explicit.OutpaintTier = ImageOutpaintTierCapable
	cfg, err := NormalizeModelCapabilityConfigForModel("image", "openai-image", "gpt-image-2.5", &ModelCapabilityConfig{Version: 1, Image: explicit})
	if err != nil {
		t.Fatalf("normalize explicit tier failed: %v", err)
	}
	if cfg.Image.OutpaintTier != ImageOutpaintTierCapable {
		t.Fatalf("explicit tier not preserved: %q", cfg.Image.OutpaintTier)
	}

	// 空值在归一时按模型名补种（存量 nano 行零手改归位）
	raw := DefaultImageCapabilityConfig("openai-image", "nano-banana-2")
	raw.OutpaintTier = ""
	seeded, err := NormalizeModelCapabilityConfigForModel("image", "openai-image", "nano-banana-2", &ModelCapabilityConfig{Version: 1, Image: raw})
	if err != nil {
		t.Fatalf("normalize seed failed: %v", err)
	}
	if seeded.Image.OutpaintTier != ImageOutpaintTierRecommended {
		t.Fatalf("seed at normalize failed: %q", seeded.Image.OutpaintTier)
	}

	// 非法值拒绝
	bad := DefaultImageCapabilityConfig("openai-image", "gpt-image-2.5")
	bad.OutpaintTier = "best"
	if _, err := NormalizeModelCapabilityConfigForModel("image", "openai-image", "gpt-image-2.5", &ModelCapabilityConfig{Version: 1, Image: bad}); err == nil {
		t.Fatalf("invalid tier accepted")
	}
}
