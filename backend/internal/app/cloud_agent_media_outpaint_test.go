package app

import (
	"bytes"
	"image"
	"image/png"
	"testing"
)

func TestCloudAgentOutpaintRatioValue(t *testing.T) {
	cases := []struct {
		raw  string
		want float64
	}{
		{"16:9", 16.0 / 9.0}, {"3:2", 1.5}, {"1:1", 1}, {"1.5", 1.5}, {"", 0}, {"abc", 0}, {"0:9", 0}, {"-3:2", 0},
	}
	for _, c := range cases {
		got, _, _ := cloudAgentOutpaintRatioValue(c.raw)
		if (got > 0) != (c.want > 0) || (c.want > 0 && absDiff(got, c.want) > 0.0001) {
			t.Fatalf("ratio %q = %v, want %v", c.raw, got, c.want)
		}
	}
}

func absDiff(a, b float64) float64 {
	if a > b {
		return a - b
	}
	return b - a
}

func TestCloudAgentOutpaintPlan(t *testing.T) {
	// 1024x1024 → 3:2 目标：竖直外扩锁定，水平补足比例。
	padding, err := cloudAgentOutpaintPlan(1024, 1024, 1.5)
	if err != nil {
		t.Fatal(err)
	}
	width := 1024 + padding["left"] + padding["right"]
	height := 1024 + padding["top"] + padding["bottom"]
	if ratio := float64(width) / float64(height); absDiff(ratio, 1.5) > 0.02 {
		t.Fatalf("plan ratio = %.4f, want 1.5 (padding %+v)", ratio, padding)
	}
	if padding["top"]+padding["bottom"] <= 0 {
		t.Fatalf("vertical padding should stay locked positive: %+v", padding)
	}
	// 竖版目标 2:3（更"竖"）：水平锁定，竖直补足。
	padding, err = cloudAgentOutpaintPlan(1024, 1024, 2.0/3.0)
	if err != nil {
		t.Fatal(err)
	}
	width = 1024 + padding["left"] + padding["right"]
	height = 1024 + padding["top"] + padding["bottom"]
	if ratio := float64(width) / float64(height); absDiff(ratio, 2.0/3.0) > 0.02 {
		t.Fatalf("plan ratio = %.4f, want %.4f (padding %+v)", ratio, 2.0/3.0, padding)
	}
}

func TestCloudAgentOutpaintPlanAlignedTo16(t *testing.T) {
	for _, c := range []struct {
		w, h  int
		ratio float64
	}{
		{1536, 1024, 16.0 / 9.0}, {1024, 1024, 1.5}, {1024, 1024, 2.0 / 3.0}, {896, 1200, 16.0 / 9.0}, {1536, 1024, 1.0},
	} {
		padding, err := cloudAgentOutpaintPlan(c.w, c.h, c.ratio)
		if err != nil {
			t.Fatal(err)
		}
		w := c.w + padding["left"] + padding["right"]
		h := c.h + padding["top"] + padding["bottom"]
		if w%16 != 0 || h%16 != 0 {
			t.Fatalf("target %dx%d not aligned to 16 (padding %+v)", w, h, padding)
		}
		if ratio := float64(w) / float64(h); absDiff(ratio, c.ratio) > 0.02 {
			t.Fatalf("%dx%d ratio %.4f, want %.4f", w, h, ratio, c.ratio)
		}
	}
}

func TestCloudAgentOutpaintPaintMaskSemantics(t *testing.T) {
	// 4x4 纯色源图，四边 pad 2px → 8x8；mask 要求中心 4x4 不透明、外圈透明。
	src := image.NewRGBA(image.Rect(0, 0, 4, 4))
	padding := map[string]int{"left": 2, "right": 2, "top": 2, "bottom": 2}
	data, width, height, err := cloudAgentOutpaintPaint(src, padding, 1, true)
	if err != nil {
		t.Fatal(err)
	}
	if width != 8 || height != 8 {
		t.Fatalf("mask size = %dx%d, want 8x8", width, height)
	}
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	check := func(x, y int, wantAlpha uint8) {
		r, g, b, a := img.At(x, y).RGBA()
		_ = r
		_ = g
		_ = b
		if uint8(a>>8) != wantAlpha {
			t.Fatalf("mask alpha at (%d,%d) = %d, want %d", x, y, a>>8, wantAlpha)
		}
	}
	// 外扩区透明。
	check(0, 0, 0)
	check(7, 7, 0)
	check(0, 4, 0)
	check(7, 4, 0)
	// 原区域不透明。
	check(2, 2, 255)
	check(5, 5, 255)
	check(3, 4, 255)
	// 底图：中心非白由源决定，但白底区域应为纯白。
	baseData, _, _, err := cloudAgentOutpaintPaint(src, padding, 1, false)
	if err != nil {
		t.Fatal(err)
	}
	base, err := png.Decode(bytes.NewReader(baseData))
	if err != nil {
		t.Fatal(err)
	}
	r, g, b, a := base.At(0, 0).RGBA()
	if r>>8 != 255 || g>>8 != 255 || b>>8 != 255 || a>>8 != 255 {
		t.Fatalf("base corner = (%d,%d,%d,%d), want opaque white", r>>8, g>>8, b>>8, a>>8)
	}
}
