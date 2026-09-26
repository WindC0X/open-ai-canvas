package app

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"testing"

	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// F-06 二期硬贴回判据测试（2026-09-27 裁决口径）：
// ① rect 外（生成区）像素零改动；② rect 内（过渡带外）= 原图映射；
// ③ 过渡带随映射因子缩放；④ 结果尺寸永不改变；⑤ 失真超阈放弃；⑥ 缺省 hardBlend=开启。

func hardBlendTestSolid(width, height int, c color.RGBA) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.SetRGBA(x, y, c)
		}
	}
	return img
}

func hardBlendTestPixel(img image.Image, x, y int) color.RGBA {
	r, g, b, a := img.At(x, y).RGBA()
	return color.RGBA{R: uint8(r >> 8), G: uint8(g >> 8), B: uint8(b >> 8), A: uint8(a >> 8)}
}

// 结果画布尺寸不变；rect 外像素 = 生成图原样；rect 内（过渡带外）= 原图像素。
func TestHardBlendOutpaintImageKeepsCanvasAndOutsidePixels(t *testing.T) {
	generated := hardBlendTestSolid(100, 80, color.RGBA{R: 10, G: 200, B: 30, A: 255})
	source := hardBlendTestSolid(50, 40, color.RGBA{R: 255, G: 0, B: 0, A: 255})
	got, err := hardBlendOutpaintImage(generated, source, hardBlendOutpaintParams{
		x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75, frameWidth: 100, frameHeight: 80,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Bounds().Dx() != 100 || got.Bounds().Dy() != 80 {
		t.Fatalf("结果尺寸必须不变，得到 %v", got.Bounds())
	}
	// rect 外（生成区）：逐点 = 生成图。
	for y := 0; y < 80; y++ {
		for x := 0; x < 100; x++ {
			if x >= 25 && x < 75 && y >= 20 && y < 60 {
				continue
			}
			if pixel := hardBlendTestPixel(got, x, y); pixel != (color.RGBA{R: 10, G: 200, B: 30, A: 255}) {
				t.Fatalf("生成区像素被改动 (%d,%d)=%+v", x, y, pixel)
			}
		}
	}
	// rect 内缩过渡带（feather=2）后 = 原图（纯红）。
	for y := 22; y < 58; y++ {
		for x := 27; x < 73; x++ {
			if pixel := hardBlendTestPixel(got, x, y); pixel.R < 250 || pixel.G > 5 || pixel.B > 5 {
				t.Fatalf("原图区像素未贴回 (%d,%d)=%+v", x, y, pixel)
			}
		}
	}
}

// 过渡带语义：边界像素 = 生成图（alpha=0），向内线性过渡到原图（alpha=1）。
func TestHardBlendOutpaintImageFeatherRamp(t *testing.T) {
	generated := hardBlendTestSolid(64, 64, color.RGBA{R: 0, G: 0, B: 0, A: 255})
	source := hardBlendTestSolid(32, 32, color.RGBA{R: 255, G: 255, B: 255, A: 255})
	got, err := hardBlendOutpaintImage(generated, source, hardBlendOutpaintParams{
		x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75, frameWidth: 64, frameHeight: 64,
	})
	if err != nil {
		t.Fatal(err)
	}
	// dst = (16,16)-(48,48)；feather=2。
	if pixel := hardBlendTestPixel(got, 16, 32); pixel.R != 0 {
		t.Fatalf("边界像素应为生成图（alpha=0），得到 %+v", pixel)
	}
	if pixel := hardBlendTestPixel(got, 17, 32); pixel.R == 0 || pixel.R == 255 {
		t.Fatalf("过渡带第一像素应为半混合，得到 %+v", pixel)
	} else if pixel.R < 100 || pixel.R > 155 {
		t.Fatalf("过渡带第一像素应近似 50%% 混合，得到 %+v", pixel)
	}
	if pixel := hardBlendTestPixel(got, 18, 32); pixel.R != 255 {
		t.Fatalf("过渡带外应为原图，得到 %+v", pixel)
	}
}

// 等比偏差（结果 = 2× 提交画幅）允许贴回：rect 等比映射结果坐标系 + 过渡带随映射因子放大。
func TestHardBlendOutpaintImageAllowsProportionalScale(t *testing.T) {
	generated := hardBlendTestSolid(200, 160, color.RGBA{R: 0, G: 0, B: 0, A: 255})
	source := hardBlendTestSolid(50, 40, color.RGBA{R: 9, G: 9, B: 9, A: 255})
	got, err := hardBlendOutpaintImage(generated, source, hardBlendOutpaintParams{
		x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75, frameWidth: 100, frameHeight: 80,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Bounds().Dx() != 200 || got.Bounds().Dy() != 160 {
		t.Fatalf("结果尺寸必须不变，得到 %v", got.Bounds())
	}
	// dst = (50,40)-(150,120)，feather = 2×2 = 4。内缩 4px 后 = 原图。
	if pixel := hardBlendTestPixel(got, 100, 80); pixel.R < 5 {
		t.Fatalf("等比偏差单贴回失败 (%d,%d)=%+v", 100, 80, pixel)
	}
	if pixel := hardBlendTestPixel(got, 10, 10); pixel.R != 0 {
		t.Fatalf("生成区被改动 (%d,%d)=%+v", 10, 10, pixel)
	}
}

// 纵横比失真超阈（裁决②a）→ 放弃贴回（error 由调用方记日志跳过）。
func TestHardBlendOutpaintImageRejectsAspectDistortion(t *testing.T) {
	generated := hardBlendTestSolid(100, 50, color.RGBA{A: 255})
	source := hardBlendTestSolid(50, 40, color.RGBA{A: 255})
	_, err := hardBlendOutpaintImage(generated, source, hardBlendOutpaintParams{
		x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9, frameWidth: 100, frameHeight: 80,
	})
	if err == nil {
		t.Fatal("纵横比失真 1.25 倍应放弃贴回")
	}
	// 8% 以内（1.06 倍）允许。
	ok, err := hardBlendOutpaintImage(hardBlendTestSolid(106, 80, color.RGBA{A: 255}), source, hardBlendOutpaintParams{
		x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9, frameWidth: 100, frameHeight: 80,
	})
	if err != nil || ok == nil {
		t.Fatalf("8%% 内等比偏差应允许贴回: %v", err)
	}
}

func hardBlendTestTask(t *testing.T, metadata map[string]interface{}) *model.Task {
	t.Helper()
	input := map[string]interface{}{"mode": "image", "metadata": metadata}
	raw, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	return &model.Task{ID: "task-1", UserID: "user-1", InputJSON: string(raw)}
}

// 裁决①b：metadata 缺省 hardBlend 字段 = 开启（默认路径是被测事实）。
func TestOutpaintHardBlendMetadataDefaultsEnabled(t *testing.T) {
	svc := &Service{}
	meta, err := svc.outpaintHardBlendMetadata(hardBlendTestTask(t, map[string]interface{}{
		"outpaint": map[string]interface{}{
			"sourceStorageKey": "resource:abc",
			"rect":             map[string]interface{}{"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.9},
			"frame":            map[string]interface{}{"width": 1536, "height": 1024},
		},
	}))
	if err != nil || meta == nil {
		t.Fatalf("缺省 hardBlend 应可解析: meta=%v err=%v", meta, err)
	}
	if !meta.hardBlend {
		t.Fatal("缺省 hardBlend 必须为 true（裁决①b）")
	}
}

func TestOutpaintHardBlendMetadataDisabled(t *testing.T) {
	svc := &Service{}
	meta, err := svc.outpaintHardBlendMetadata(hardBlendTestTask(t, map[string]interface{}{
		"outpaint": map[string]interface{}{
			"sourceStorageKey": "resource:abc",
			"rect":             map[string]interface{}{"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.9},
			"frame":            map[string]interface{}{"width": 1536, "height": 1024},
			"hardBlend":        false,
		},
	}))
	if err != nil || meta == nil {
		t.Fatalf("解析失败: meta=%v err=%v", meta, err)
	}
	if meta.hardBlend {
		t.Fatal("hardBlend=false 必须生效（关断通道）")
	}
}

// 边界条款：有块但缺 rect → 跳过 + 日志（err 上抛由调用方记日志）。
func TestOutpaintHardBlendMetadataMissingRect(t *testing.T) {
	svc := &Service{}
	meta, err := svc.outpaintHardBlendMetadata(hardBlendTestTask(t, map[string]interface{}{
		"outpaint": map[string]interface{}{
			"sourceStorageKey": "resource:abc",
			"frame":            map[string]interface{}{"width": 1536, "height": 1024},
		},
	}))
	if err == nil || meta != nil {
		t.Fatalf("缺 rect 应跳过: meta=%v err=%v", meta, err)
	}
}

func TestOutpaintHardBlendMetadataRejectsBadRect(t *testing.T) {
	svc := &Service{}
	if _, err := svc.outpaintHardBlendMetadata(hardBlendTestTask(t, map[string]interface{}{
		"outpaint": map[string]interface{}{
			"sourceStorageKey": "resource:abc",
			"rect":             map[string]interface{}{"x0": 0.9, "y0": 0.1, "x1": 0.1, "y1": 0.9},
			"frame":            map[string]interface{}{"width": 1536, "height": 1024},
		},
	})); err == nil {
		t.Fatal("倒置 rect 应被拒绝")
	}
}

// 非扩图任务（无 outpaint 块）：静默跳过（nil, nil），不刷日志不报错。
func TestOutpaintHardBlendMetadataIgnoresNonOutpaint(t *testing.T) {
	svc := &Service{}
	meta, err := svc.outpaintHardBlendMetadata(hardBlendTestTask(t, map[string]interface{}{"edit": "outpaint"}))
	if err != nil || meta != nil {
		t.Fatalf("无 outpaint 块应静默跳过: meta=%v err=%v", meta, err)
	}
}

// 服务层端到端：资源读取 + 贴回 + 编码替换（含关断路径）。
func TestApplyOutpaintHardBlendEndToEnd(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.SystemSetting{}, &model.UserOSSSetting{}, &model.StorageLocation{}, &model.UserDailyUploadUsage{}, &model.Resource{}, &model.Task{}, &model.TaskLog{}); err != nil {
		t.Fatal(err)
	}
	svc := New(repository.New(db), t.TempDir())

	source := hardBlendTestSolid(50, 40, color.RGBA{R: 255, G: 0, B: 0, A: 255})
	var sourceBuffer bytes.Buffer
	if err := png.Encode(&sourceBuffer, source); err != nil {
		t.Fatal(err)
	}
	uploadKey := "outpaint-test-source"
	resource, _, err := svc.storeResource("user-1", "image", "source.png", "image/png", int64(sourceBuffer.Len()), 50, 40, 0, bytes.NewReader(sourceBuffer.Bytes()), &uploadKey, false)
	if err != nil {
		t.Fatal(err)
	}

	generated := hardBlendTestSolid(100, 80, color.RGBA{R: 10, G: 200, B: 30, A: 255})
	var generatedBuffer bytes.Buffer
	if err := png.Encode(&generatedBuffer, generated); err != nil {
		t.Fatal(err)
	}
	generatedURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(generatedBuffer.Bytes())

	newResult := func() map[string]interface{} {
		return map[string]interface{}{
			"mode": "image",
			"images": []interface{}{
				map[string]interface{}{"dataUrl": generatedURL, "width": 100, "height": 80},
			},
		}
	}

	// 缺省开启：贴回执行，结果图 dataUrl 被替换且尺寸不变、原图区=红。
	task := hardBlendTestTask(t, map[string]interface{}{
		"edit": "outpaint",
		"outpaint": map[string]interface{}{
			"sourceStorageKey": "resource:" + resource.ID,
			"rect":             map[string]interface{}{"x0": 0.25, "y0": 0.25, "x1": 0.75, "y1": 0.75},
			"frame":            map[string]interface{}{"width": 100, "height": 80},
		},
	})
	out := svc.applyOutpaintHardBlend(task, newResult())
	item := out["images"].([]interface{})[0].(map[string]interface{})
	updated, _ := item["dataUrl"].(string)
	if updated == generatedURL || updated == "" {
		t.Fatal("贴回未替换结果图 dataUrl")
	}
	_, data, err := svc.decodeDataURL(updated)
	if err != nil {
		t.Fatal(err)
	}
	blended, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if blended.Bounds().Dx() != 100 || blended.Bounds().Dy() != 80 {
		t.Fatalf("结果尺寸必须不变 %v", blended.Bounds())
	}
	if pixel := hardBlendTestPixel(blended, 50, 40); pixel.R < 250 || pixel.G > 5 {
		t.Fatalf("原图区未贴回 %+v", pixel)
	}
	if pixel := hardBlendTestPixel(blended, 5, 5); pixel.G < 195 {
		t.Fatalf("生成区被改动 %+v", pixel)
	}

	// 关断通道：hardBlend=false → 原样返回（dataUrl 不变）。
	taskOff := hardBlendTestTask(t, map[string]interface{}{
		"edit": "outpaint",
		"outpaint": map[string]interface{}{
			"sourceStorageKey": "resource:" + resource.ID,
			"rect":             map[string]interface{}{"x0": 0.25, "y0": 0.25, "x1": 0.75, "y1": 0.75},
			"frame":            map[string]interface{}{"width": 100, "height": 80},
			"hardBlend":        false,
		},
	})
	outOff := svc.applyOutpaintHardBlend(taskOff, newResult())
	itemOff := outOff["images"].([]interface{})[0].(map[string]interface{})
	if itemOff["dataUrl"] != generatedURL {
		t.Fatal("关断路径不得改动结果图")
	}
}
