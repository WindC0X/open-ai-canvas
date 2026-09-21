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

// 审批卡像素档（用户裁定 2026-09-21：手动扩图能选尺寸，Agent 审批卡的选择也必须生效）：
// 选定像素即提交目标，合成尺寸必须恰好等于该像素；未选定则维持 ratio 推导。
func TestCloudAgentOutpaintPixelTarget(t *testing.T) {
	for _, value := range []string{"1024x1024", "1536*1024", "1024×768", " 768 x 1024 "} {
		if _, _, ok := cloudAgentOutpaintPixelSize(value); !ok {
			t.Fatalf("像素档 %q 应被识别", value)
		}
	}
	for _, value := range []string{"", "16:9", "1.5", "auto", "1024", "1024x"} {
		if _, _, ok := cloudAgentOutpaintPixelSize(value); ok {
			t.Fatalf("非像素档 %q 不应被识别为像素目标", value)
		}
	}

	// ① 目标大于源（纯外扩）：合成尺寸恰好等于目标，源图不放大（scale=1），四边都有外扩带。
	padding, scale, err := cloudAgentOutpaintPlanForTarget(1376, 784, 1536, 1024)
	if err != nil {
		t.Fatal(err)
	}
	if scale != 1 {
		t.Fatalf("目标大于源图时不应放大源图：scale=%v", scale)
	}
	src := image.NewRGBA(image.Rect(0, 0, 1376, 784))
	_, width, height, err := cloudAgentOutpaintPaint(src, padding, scale, true)
	if err != nil {
		t.Fatal(err)
	}
	if width != 1536 || height != 1024 {
		t.Fatalf("像素档合成尺寸 = %dx%d, want 1536x1024", width, height)
	}
	if padding["left"] <= 0 && padding["right"] <= 0 || padding["top"] <= 0 && padding["bottom"] <= 0 {
		t.Fatalf("两个方向都应有外扩带：%+v", padding)
	}

	// ② 目标小于源（缩小摆入）：等比缩小后补边，尺寸仍恰好等于目标。
	padding, scale, err = cloudAgentOutpaintPlanForTarget(1376, 784, 1024, 1024)
	if err != nil {
		t.Fatal(err)
	}
	if scale >= 1 {
		t.Fatalf("目标小于源图时应等比缩小：scale=%v", scale)
	}
	_, width, height, err = cloudAgentOutpaintPaint(src, padding, scale, true)
	if err != nil {
		t.Fatal(err)
	}
	if width != 1024 || height != 1024 {
		t.Fatalf("缩小档合成尺寸 = %dx%d, want 1024x1024", width, height)
	}

	// ③ 长边超限（>1536，护中转请求体）：仍按目标比例合成，只是同比收缩到上限内。
	padding, scale, err = cloudAgentOutpaintPlanForTarget(1376, 784, 3072, 2048)
	if err != nil {
		t.Fatal(err)
	}
	_, width, height, err = cloudAgentOutpaintPaint(src, padding, scale, true)
	if err != nil {
		t.Fatal(err)
	}
	if width > 1536 || height > 1536 {
		t.Fatalf("长边应被上限收住：%dx%d", width, height)
	}
	if width*2048 != height*3072 {
		t.Fatalf("收缩后应保持目标比例：%dx%d", width, height)
	}

	// ④ 与原图几乎同尺寸：没有外扩空间，必须拒绝（否则 mask 全不透明 = 按扩图计价的原图重绘）。
	if _, _, err := cloudAgentOutpaintPlanForTarget(1376, 784, 1376, 800); err == nil {
		t.Fatal("无外扩空间的档位必须拒绝")
	}
	// ⑤ 非法/越界比例：拒绝。
	if _, _, err := cloudAgentOutpaintPlanForTarget(1376, 784, 0, 0); err == nil {
		t.Fatal("零尺寸必须拒绝")
	}
}
