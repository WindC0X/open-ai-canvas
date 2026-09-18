package app

// Cloud Agent 扩图（image_outpaint）的服务端合成。
// Agent 的 generate_media 带 outpaintRatio 时，唯一图片参考在此被等比 pad 到目标画幅，
// 并合成"原区域不透明、外扩区域透明"的 mask；pad 图与 mask 都物化为账号资源，
// 使任务输入只含 resource 引用（内嵌媒体校验/重试链与普通编辑任务完全一致）。

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/png"
	"math"
	"strconv"
	"strings"

	"golang.org/x/image/draw"

	"infinite-canvas/backend/internal/model"
	_ "image/jpeg"
)

// cloudAgentOutpaintMaxLongEdge 限制提交给上游的 pad 图/mask 长边，避免大图 base64 撑爆中转请求体。
const cloudAgentOutpaintMaxLongEdge = 1536

// cloudAgentOutpaintMinPadding 目标画幅大于参考图时的最小外扩基准，保证非等比方向仍有可见扩展带。
const cloudAgentOutpaintMinPadding = 48

// cloudAgentOutpaintRatioValue 解析 "16:9"/"3:2"/"1.5" 形式目标画幅；非法值返回 0。
func cloudAgentOutpaintRatioValue(raw string) (float64, int, int) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return 0, 0, 0
	}
	if parts := strings.SplitN(text, ":", 2); len(parts) == 2 {
		width, widthErr := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
		height, heightErr := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
			return 0, 0, 0
		}
		return width / height, int(math.Round(width)), int(math.Round(height))
	}
	value, err := strconv.ParseFloat(text, 64)
	if err != nil || value <= 0 {
		return 0, 0, 0
	}
	return value, 0, 0
}

// cloudAgentOutpaintPlan 计算把源图 pad 到目标画幅所需的四边扩展像素（源图坐标系）。
// 语义与前端 resolveOutpaintPaddingForRatio 一致：锚定中心偏移、外扩总量只增不减。
func cloudAgentOutpaintPlan(srcWidth, srcHeight int, ratio float64) (map[string]int, error) {
	if srcWidth <= 0 || srcHeight <= 0 || ratio <= 0 {
		return nil, errors.New("扩图参考图无效")
	}
	sourceRatio := float64(srcWidth) / float64(srcHeight)
	spaceWidth := math.Round(math.Max(float64(srcWidth)*0.25, cloudAgentOutpaintMinPadding*2))
	spaceHeight := math.Round(math.Max(float64(srcHeight)*0.25, cloudAgentOutpaintMinPadding*2))
	switch {
	case math.Abs(sourceRatio-ratio) < 0.005:
		// 同比例：四边均匀外扩。
		return map[string]int{"left": int(spaceWidth / 2), "right": int(spaceWidth / 2), "top": int(spaceHeight / 2), "bottom": int(spaceHeight / 2)}, nil
	case ratio < sourceRatio:
		// 目标更"竖"：竖直外扩锁定为 spaceHeight，水平外扩由比例反解并保底 spaceWidth。
		vertical := int(spaceHeight)
		horizontal := int(math.Round(float64(srcHeight+vertical)*ratio)) - srcWidth
		if horizontal < int(spaceWidth) {
			horizontal = int(spaceWidth)
		}
		if needVertical := int(math.Round(float64(srcWidth+horizontal)/ratio)) - srcHeight; needVertical > vertical {
			vertical = needVertical
		}
		return map[string]int{"left": horizontal / 2, "right": horizontal - horizontal/2, "top": vertical / 2, "bottom": vertical - vertical/2}, nil
	default:
		// 目标更"横"：水平外扩锁定为 spaceWidth，竖直外扩由比例反解；
		// 比例反解为负时说明锁定量不足以达成目标比例，改为两侧同时外扩到比例。
		horizontal := int(spaceWidth)
		vertical := int(math.Round(float64(srcWidth+horizontal)/ratio)) - srcHeight
		if vertical < int(spaceHeight) {
			vertical = int(spaceHeight)
		}
		// 比例反解必须精确成立；竖直取基准后仍不满足时回推水平外扩量。
		if needHorizontal := int(math.Round(ratio * float64(srcHeight+vertical))) - srcWidth; needHorizontal > horizontal {
			horizontal = needHorizontal
		}
		return map[string]int{"left": horizontal / 2, "right": horizontal - horizontal/2, "top": vertical / 2, "bottom": vertical - vertical/2}, nil
	}
}

// cloudAgentOutpaintScale 让 pad 图与 mask 共用同一长边上限（扩展量按内容等比缩放，保持两者对齐）。
func cloudAgentOutpaintScale(width, height, padding int) float64 {
	longEdge := width + padding
	if height+padding > longEdge {
		longEdge = height + padding
	}
	if longEdge <= cloudAgentOutpaintMaxLongEdge {
		return 1
	}
	return float64(cloudAgentOutpaintMaxLongEdge) / float64(longEdge)
}

func cloudAgentOutpaintPaint(src image.Image, padding map[string]int, scale float64, mask bool) ([]byte, int, int, error) {
	srcW := src.Bounds().Dx()
	srcH := src.Bounds().Dy()
	padLeft := int(math.Round(float64(padding["left"]) * scale))
	padTop := int(math.Round(float64(padding["top"]) * scale))
	padRight := int(math.Round(float64(padding["right"]) * scale))
	padBottom := int(math.Round(float64(padding["bottom"]) * scale))
	targetW := int(math.Round(float64(srcW)*scale)) + padLeft + padRight
	targetH := int(math.Round(float64(srcH)*scale)) + padTop + padBottom
	canvas := image.NewNRGBA(image.Rect(0, 0, targetW, targetH))
	if !mask {
		// 底图：白底填满，避免 JPEG 有透明语义歧义。
		for y := 0; y < targetH; y++ {
			for x := 0; x < targetW; x++ {
				canvas.Set(x, y, image.White)
			}
		}
	}
	// mask 中心区先填不透明白：mask 语义=不透明保留，与前端 buildEditMask 一致；
	// 源图若有透明像素也必须视为"保留区"，不能让 mask 中心跟着透明。
	if mask {
		draw.Draw(canvas, image.Rect(padLeft, padTop, padLeft+int(math.Round(float64(srcW)*scale)), padTop+int(math.Round(float64(srcH)*scale))), image.White, image.Point{}, draw.Over)
	}
	srcRect := image.Rect(0, 0, srcW, srcH)
	dstRect := image.Rect(padLeft, padTop, padLeft+int(math.Round(float64(srcW)*scale)), padTop+int(math.Round(float64(srcH)*scale)))
	// CatmullRom 在缩小时比 ApproxBiLinear 保细节；扩图底图长边已压到 1536，开销可接受。
	draw.CatmullRom.Scale(canvas, dstRect, src, srcRect, draw.Over, nil)
	if mask {
		// mask 语义（与前端 buildEditMask 一致）：原区域不透明（保留），外扩区域透明（生成）。
		draw.Draw(canvas, image.Rect(0, 0, targetW, padTop), image.Transparent, image.Point{}, draw.Src)
		draw.Draw(canvas, image.Rect(0, targetH-padBottom, targetW, targetH), image.Transparent, image.Point{}, draw.Src)
		draw.Draw(canvas, image.Rect(0, padTop, padLeft, targetH-padBottom), image.Transparent, image.Point{}, draw.Src)
		draw.Draw(canvas, image.Rect(targetW-padRight, padTop, targetW, targetH-padBottom), image.Transparent, image.Point{}, draw.Src)
	}
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, canvas); err != nil {
		return nil, 0, 0, err
	}
	return buffer.Bytes(), targetW, targetH, nil
}

// cloudAgentOutpaintMaterialize 把源参考 + 合成结果物化为 3 个账号资源：
// 源图重存（保持输入引用语义）、pad 底图（JPEG 压缩走独立 PNG 资源便于重试）、mask（PNG）。
// 返回的 providerMedia 只带 StorageKey —— 与普通任务的输入形态一致。
func (s *Service) cloudAgentOutpaintMaterialize(userID string, source *providerMedia, padding map[string]int) (padded providerMedia, mask *providerMedia, err error) {
	if source == nil || !strings.HasPrefix(source.StorageKey, "resource:") {
		return padded, nil, errors.New("扩图源参考必须是已保存的画布图片资产")
	}
	resourceID := strings.TrimPrefix(source.StorageKey, "resource:")
	_, body, err := s.OpenResource(userID, resourceID)
	if err != nil {
		return padded, nil, fmt.Errorf("读取扩图源图失败：%w", err)
	}
	defer body.Close()
	var raw bytes.Buffer
	if _, err := raw.ReadFrom(body); err != nil {
		return padded, nil, fmt.Errorf("读取扩图源图失败：%w", err)
	}
	src, _, err := image.Decode(bytes.NewReader(raw.Bytes()))
	if err != nil {
		return padded, nil, fmt.Errorf("扩图源图解码失败：%w", err)
	}
	srcW, srcH := src.Bounds().Dx(), src.Bounds().Dy()
	scale := cloudAgentOutpaintScale(srcW, srcH, padding["left"]+padding["right"]+padding["top"]+padding["bottom"])

	baseBytes, targetW, targetH, err := cloudAgentOutpaintPaint(src, padding, scale, false)
	if err != nil {
		return padded, nil, fmt.Errorf("合成扩图底图失败：%w", err)
	}
	baseResource, err := s.storeResourceFromBytes(userID, "image", "agent-outpaint-base.png", "image/png", baseBytes, targetW, targetH, "agent:outpaint:base:"+resourceID)
	if err != nil {
		return padded, nil, fmt.Errorf("保存扩图底图失败：%w", err)
	}
	padded = providerMedia{ID: source.ID, Name: "扩图底图", Type: "image", StorageKey: "resource:" + baseResource.ID, MimeType: "image/png", Bytes: int64(len(baseBytes)), Width: targetW, Height: targetH}

	maskBytes, maskW, maskH, err := cloudAgentOutpaintPaint(src, padding, scale, true)
	if err != nil {
		return padded, nil, fmt.Errorf("合成扩图蒙版失败：%w", err)
	}
	maskResource, err := s.storeResourceFromBytes(userID, "image", "agent-outpaint-mask.png", "image/png", maskBytes, maskW, maskH, "agent:outpaint:mask:"+resourceID)
	if err != nil {
		return padded, nil, fmt.Errorf("保存扩图蒙版失败：%w", err)
	}
	mask = &providerMedia{ID: source.ID + "-mask", Name: "扩图蒙版", Type: "image", StorageKey: "resource:" + maskResource.ID, MimeType: "image/png", Bytes: int64(len(maskBytes)), Width: maskW, Height: maskH}
	return padded, mask, nil
}

// storeResourceFromBytes 把内存字节存为账号资源（Agent 合成产物专用，等价 uploadResource 语义：
// 幂等 uploadIdentity、配额、状态流转），但跳过 multipart 头解析。
func (s *Service) storeResourceFromBytes(userID, kind, fileName, mimeType string, data []byte, width, height int, uploadIdentity string) (*model.Resource, error) {
	resource, stored, err := s.storeResource(userID, kind, fileName, mimeType, int64(len(data)), width, height, 0, bytes.NewReader(data), normalizedResourceUploadKey([]string{uploadIdentity}), true)
	if err != nil {
		return nil, err
	}
	_ = stored
	return resource, nil
}

// applyCloudAgentOutpaint 把扩图请求的输入替换为合成产物：
// 恰好 1 张图片参考 → pad 底图 + mask（都已是账号资源），其余输入原样保留。
func (s *Service) applyCloudAgentOutpaint(userID string, refs map[string]any, a cloudAgentMediaArgs) (map[string]any, error) {
	images, _ := refs["referenceImages"].([]any)
	if len(images) != 1 {
		return nil, BadAuthRequest("扩图必须恰好引用 1 张图片节点；多图或无图时请改用普通图生图")
	}
	sourceMap, _ := images[0].(map[string]any)
	if sourceMap == nil {
		return nil, BadAuthRequest("扩图参考节点无效")
	}
	source := providerMedia{ID: stringValue(sourceMap["id"]), Name: stringValue(sourceMap["name"]), Type: "image", StorageKey: stringValue(sourceMap["storageKey"]), MimeType: stringValue(sourceMap["mimeType"]), Width: cloudAgentMediaInt(sourceMap["width"]), Height: cloudAgentMediaInt(sourceMap["height"])}
	if source.Width <= 0 || source.Height <= 0 {
		return nil, BadAuthRequest("扩图参考图缺少真实尺寸")
	}
	ratio, _, _ := cloudAgentOutpaintRatioValue(a.OutpaintRatio)
	if ratio <= 0 {
		return nil, BadAuthRequest("扩图画幅比例无效，请传如 16:9 / 3:2 / 1.5")
	}
	padding, err := cloudAgentOutpaintPlan(source.Width, source.Height, ratio)
	if err != nil {
		return nil, err
	}
	padded, mask, err := s.cloudAgentOutpaintMaterialize(userID, &source, padding)
	if err != nil {
		return nil, err
	}
	next := map[string]any{}
	for key, value := range refs {
		if key == "referenceImages" {
			continue
		}
		next[key] = value
	}
	next["referenceImages"] = []any{map[string]any{"id": padded.ID, "name": padded.Name, "storageKey": padded.StorageKey, "type": padded.Type, "mimeType": padded.MimeType, "bytes": padded.Bytes, "width": padded.Width, "height": padded.Height}}
	if mask != nil {
		next["mask"] = map[string]any{"id": mask.ID, "name": mask.Name, "storageKey": mask.StorageKey, "type": mask.Type, "mimeType": mask.MimeType, "bytes": mask.Bytes, "width": mask.Width, "height": mask.Height}
	}
	return next, nil
}

// cloudAgentMediaInt 宽容解析画布 JSON 里的数值尺寸（float64/int/string）。
func cloudAgentMediaInt(value any) int {
	switch v := value.(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(v))
		return n
	}
	return 0
}
