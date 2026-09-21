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

	_ "image/jpeg"
	"infinite-canvas/backend/internal/model"
)

// cloudAgentOutpaintMaxLongEdge 限制提交给上游的 pad 图/mask 长边，避免大图 base64 撑爆中转请求体。
const cloudAgentOutpaintMaxLongEdge = 1536

// cloudAgentOutpaintMinPadding 目标画幅大于参考图时的最小外扩基准，保证非等比方向仍有可见扩展带。
const cloudAgentOutpaintMinPadding = 48

// cloudAgentOutpaintMaxPixels 源图解码像素上限：防 PNG 解压炸弹把服务端内存打爆。
const cloudAgentOutpaintMaxPixels = 40_000_000

// cloudAgentOutpaintRatioBounds 目标画幅比值的合理区间：超出即拒绝。极端比例（如 1e9:1）
// 会退化成"纯白底图+全透明 mask"，上游实际执行与源图无关的全新生成，用户按扩图语义付费
// 却得不到扩图（review 2026-09-21 P2）。
const cloudAgentOutpaintMinRatio = 0.2
const cloudAgentOutpaintMaxRatio = 5.0

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
// 目标总画幅对齐到 16 的倍数（gpt-image 系自定义尺寸校验要求；对其它模型无害）。
func cloudAgentOutpaintPlan(srcWidth, srcHeight int, ratio float64) (map[string]int, error) {
	if srcWidth <= 0 || srcHeight <= 0 || ratio <= 0 {
		return nil, errors.New("扩图参考图无效")
	}
	sourceRatio := float64(srcWidth) / float64(srcHeight)
	spaceWidth := math.Round(math.Max(float64(srcWidth)*0.25, cloudAgentOutpaintMinPadding*2))
	spaceHeight := math.Round(math.Max(float64(srcHeight)*0.25, cloudAgentOutpaintMinPadding*2))
	round16 := func(v int) int { return ((v + 8) / 16) * 16 }
	floor16 := func(v int) int { return (v / 16) * 16 }
	pickAligned := func(wTotal, hTotal int) (int, int) {
		// 在 floor16/round16 的 2x2 组合里选比例最接近目标的一组；候选必须全部对齐 16，
		// 原始未对齐值不能进入候选（否则取整永远落选，返回值回到未对齐尺寸）。
		bestW, bestH, bestDelta := round16(wTotal), round16(hTotal), math.MaxFloat64
		for _, w := range [2]int{floor16(wTotal), round16(wTotal)} {
			for _, h := range [2]int{floor16(hTotal), round16(hTotal)} {
				if w < srcWidth || h < srcHeight || w == 0 || h == 0 {
					continue
				}
				delta := math.Abs(float64(w)/float64(h) - ratio)
				if delta < bestDelta {
					bestW, bestH, bestDelta = w, h, delta
				}
			}
		}
		if bestW < srcWidth {
			bestW = round16(srcWidth)
		}
		if bestH < srcHeight {
			bestH = round16(srcHeight)
		}
		return bestW, bestH
	}

	switch {
	case math.Abs(sourceRatio-ratio) < 0.005:
		// 同比例：四边均匀外扩。
		wTotal, hTotal := pickAligned(srcWidth+int(spaceWidth), srcHeight+int(spaceHeight))
		return map[string]int{"left": (wTotal - srcWidth) / 2, "right": (wTotal - srcWidth) - (wTotal-srcWidth)/2, "top": (hTotal - srcHeight) / 2, "bottom": (hTotal - srcHeight) - (hTotal-srcHeight)/2}, nil
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
		horizontal, vertical = pickAligned(srcWidth+horizontal, srcHeight+vertical)
		horizontal -= srcWidth
		vertical -= srcHeight
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
		if needHorizontal := int(math.Round(ratio*float64(srcHeight+vertical))) - srcWidth; needHorizontal > horizontal {
			horizontal = needHorizontal
		}
		horizontal, vertical = pickAligned(srcWidth+horizontal, srcHeight+vertical)
		horizontal -= srcWidth
		vertical -= srcHeight
		return map[string]int{"left": horizontal / 2, "right": horizontal - horizontal/2, "top": vertical / 2, "bottom": vertical - vertical/2}, nil
	}
}

// cloudAgentOutpaintScale 让 pad 图与 mask 共用同一长边上限（扩展量按内容等比缩放，保持两者对齐）。
// paddingByAxis 把四边 padding 按调用方给的轴归属拆分（horizontal=左+右，vertical=上+下）。
func cloudAgentOutpaintScale(width, height, horizontal, vertical int) float64 {
	// 真实长边 = max(宽+左右pad, 高+上下pad)。旧实现对单轴加四边总和，系统性高估长边、
	// 过度收缩输出分辨率（2000² 源图 + 四边 200 实测损失约 15%，review 2026-09-21 P3）。
	longEdge := width + horizontal
	if height+vertical > longEdge {
		longEdge = height + vertical
	}
	if longEdge <= cloudAgentOutpaintMaxLongEdge {
		return 1
	}
	return float64(cloudAgentOutpaintMaxLongEdge) / float64(longEdge)
}

func cloudAgentOutpaintPaint(src image.Image, padding map[string]int, scale float64, mask bool) ([]byte, int, int, error) {
	srcW := src.Bounds().Dx()
	srcH := src.Bounds().Dy()
	// snap16 就近对齐 16 的倍数（gpt-image 系自定义尺寸校验要求）；小尺寸（<16）不参与对齐。
	snap16 := func(v int) int {
		if v < 16 {
			return v
		}
		if d := v % 16; d > 8 {
			return v + 16 - d
		} else {
			return v - d
		}
	}
	padLeft := int(math.Round(float64(padding["left"]) * scale))
	padTop := int(math.Round(float64(padding["top"]) * scale))
	padRight := int(math.Round(float64(padding["right"]) * scale))
	padBottom := int(math.Round(float64(padding["bottom"]) * scale))
	targetW := snap16(int(math.Round(float64(srcW)*scale)) + padLeft + padRight)
	targetH := snap16(int(math.Round(float64(srcH)*scale)) + padTop + padBottom)
	// 取整差全部吸收进右/下 padding，左/上 padding 保持不变（锚定语义）。
	// 极大源图（scale ≲0.15）时 snap16 下移吸收可让右/下差为负：负 padding 会让 image.Rect
	// 坐标翻转、mask 边缘留不透明发丝线（review 2026-09-21 P3）。负值钳 0、差额改收 target。
	padRight = targetW - int(math.Round(float64(srcW)*scale)) - padLeft
	padBottom = targetH - int(math.Round(float64(srcH)*scale)) - padTop
	if padRight < 0 {
		targetW -= padRight
		padRight = 0
	}
	if padBottom < 0 {
		targetH -= padBottom
		padBottom = 0
	}
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
	// 像素预检：image/png 无内建解压炸弹防护，一张合法 16384² PNG 解码即产生 ~1GiB NRGBA
	// 缓冲（review 2026-09-21 P1）。先 DecodeConfig 读声明尺寸，超 40MP 拒绝，不做全量解码。
	if config, _, configErr := image.DecodeConfig(bytes.NewReader(raw.Bytes())); configErr == nil {
		if int64(config.Width)*int64(config.Height) > cloudAgentOutpaintMaxPixels {
			return padded, nil, fmt.Errorf("扩图源图尺寸过大（%dx%d），上限 %d 百万像素", config.Width, config.Height, cloudAgentOutpaintMaxPixels/1_000_000)
		}
	}
	src, _, err := image.Decode(bytes.NewReader(raw.Bytes()))
	if err != nil {
		return padded, nil, fmt.Errorf("扩图源图解码失败：%w", err)
	}
	srcW, srcH := src.Bounds().Dx(), src.Bounds().Dy()
	scale := cloudAgentOutpaintScale(srcW, srcH, padding["left"]+padding["right"], padding["top"]+padding["bottom"])

	baseBytes, targetW, targetH, err := cloudAgentOutpaintPaint(src, padding, scale, false)
	if err != nil {
		return padded, nil, fmt.Errorf("合成扩图底图失败：%w", err)
	}
	// 幂等 key 必须含目标画幅：合成算法迭代（snap16 对齐等）会改变同一源图的目标尺寸，
	// 否则命中旧尺寸的陈旧资源，底图/蒙版与提交 size 失配。
	sizeTag := fmt.Sprintf("%dx%d", targetW, targetH)
	baseResource, err := s.storeResourceFromBytes(userID, "image", "agent-outpaint-base.png", "image/png", baseBytes, targetW, targetH, "agent:outpaint:base:"+resourceID+":"+sizeTag)
	if err != nil {
		return padded, nil, fmt.Errorf("保存扩图底图失败：%w", err)
	}
	padded = providerMedia{ID: source.ID, Name: "扩图底图", Type: "image", StorageKey: "resource:" + baseResource.ID, MimeType: "image/png", Bytes: int64(len(baseBytes)), Width: targetW, Height: targetH}

	maskBytes, maskW, maskH, err := cloudAgentOutpaintPaint(src, padding, scale, true)
	if err != nil {
		return padded, nil, fmt.Errorf("合成扩图蒙版失败：%w", err)
	}
	maskResource, err := s.storeResourceFromBytes(userID, "image", "agent-outpaint-mask.png", "image/png", maskBytes, maskW, maskH, "agent:outpaint:mask:"+resourceID+":"+sizeTag)
	if err != nil {
		return padded, nil, fmt.Errorf("保存扩图蒙版失败：%w", err)
	}
	mask = &providerMedia{ID: source.ID + "-mask", Name: "扩图蒙版", Type: "image", StorageKey: "resource:" + maskResource.ID, MimeType: "image/png", Bytes: int64(len(maskBytes)), Width: maskW, Height: maskH}
	return padded, mask, nil
}

// storeResourceFromBytes 把内存字节存为账号资源（Agent 合成产物专用）：幂等 uploadIdentity
// 与状态流转同 storeResource，并走与 UploadResourceFile 相同的配额预留/提交/释放三段式
// （此前直调 storeResource 绕过配额，Agent 产物无配额约束累积 — review 2026-09-21 P2）。
// 幂等命中已就绪资源时同样不重复计配额。
func (s *Service) storeResourceFromBytes(userID, kind, fileName, mimeType string, data []byte, width, height int, uploadIdentity string) (*model.Resource, error) {
	size := int64(len(data))
	existing, err := s.resourceForUploadKey(userID, normalizedResourceUploadKey([]string{uploadIdentity}))
	if err != nil {
		return nil, err
	}
	if existing != nil {
		switch existing.Status {
		case model.ResourceStatusReady:
			return existing, nil
		case model.ResourceStatusPending:
			return nil, resourceUploadInProgress()
		default:
			// Failed：与 UploadResourceFile 对齐走重传。此前直接落到 storeResource，而它对
			// 非 Ready 现有记录统一返回 409「正在上传」——首次写盘失败后同一 uploadIdentity
			// （同一源图 + 同一目标尺寸，含 Agent 重试）永久卡死，报错文案还误导
			// （review 2026-09-21 P2）。重传内自管配额。
			return s.retryStoredResource(userID, existing, kind, mimeType, size, bytes.NewReader(data))
		}
	}
	day, err := s.reserveUserUploadQuota(userID, size)
	if err != nil {
		return nil, err
	}
	resource, stored, err := s.storeResource(userID, kind, fileName, mimeType, size, width, height, 0, bytes.NewReader(data), normalizedResourceUploadKey([]string{uploadIdentity}), true)
	if err != nil {
		s.releaseUserUploadQuota(userID, day, size)
	} else if stored {
		s.commitUserUploadQuota(userID, size)
	} else {
		s.releaseUserUploadQuota(userID, day, size)
	}
	if err != nil {
		return nil, err
	}
	return resource, nil
}

// applyCloudAgentOutpaint 把扩图请求的参考字段就地替换为合成产物：
// 恰好 1 张图片参考 → pad 底图 + mask（都已是账号资源）；mode/prompt/config 等其余键原样保留。
// 返回 pad 后目标画幅（像素），调用方用它显式提交 config.size。
func (s *Service) applyCloudAgentOutpaint(userID string, refs map[string]any, a cloudAgentMediaArgs) (int, int, error) {
	images, _ := refs["referenceImages"].([]any)
	if len(images) != 1 {
		return 0, 0, BadAuthRequest("扩图必须恰好引用 1 张图片节点；多图或无图时请改用普通图生图")
	}
	sourceMap, _ := images[0].(map[string]any)
	if sourceMap == nil {
		return 0, 0, BadAuthRequest("扩图参考节点无效")
	}
	source := providerMedia{ID: stringValue(sourceMap["id"]), Name: stringValue(sourceMap["name"]), Type: "image", StorageKey: stringValue(sourceMap["storageKey"]), MimeType: stringValue(sourceMap["mimeType"]), Width: cloudAgentMediaInt(sourceMap["width"]), Height: cloudAgentMediaInt(sourceMap["height"])}
	if source.Width <= 0 || source.Height <= 0 {
		return 0, 0, BadAuthRequest("扩图参考图缺少真实尺寸")
	}
	ratio, _, _ := cloudAgentOutpaintRatioValue(a.OutpaintRatio)
	if ratio <= 0 {
		return 0, 0, BadAuthRequest("扩图画幅比例无效，请传如 16:9 / 3:2 / 1.5")
	}
	if ratio < cloudAgentOutpaintMinRatio || ratio > cloudAgentOutpaintMaxRatio {
		return 0, 0, BadAuthRequest("扩图画幅比例超出合理范围（0.2 ~ 5.0），请调整后重试")
	}
	padding, err := cloudAgentOutpaintPlan(source.Width, source.Height, ratio)
	if err != nil {
		return 0, 0, err
	}
	padded, mask, err := s.cloudAgentOutpaintMaterialize(userID, &source, padding)
	if err != nil {
		return 0, 0, err
	}
	refs["referenceImages"] = []any{map[string]any{"id": padded.ID, "name": padded.Name, "storageKey": padded.StorageKey, "type": padded.Type, "mimeType": padded.MimeType, "bytes": padded.Bytes, "width": padded.Width, "height": padded.Height}}
	if mask != nil {
		refs["mask"] = map[string]any{"id": mask.ID, "name": mask.Name, "storageKey": mask.StorageKey, "type": mask.Type, "mimeType": mask.MimeType, "bytes": mask.Bytes, "width": mask.Width, "height": mask.Height}
	}
	return padded.Width, padded.Height, nil
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

// cloudAgentOutpaintCapabilityCheck 在 prepare（审批前）校验所选模型是否满足扩图隐含能力：
// mask 输入（合成 mask 无条件写入 refs）与自定义 size（pad 后精确像素 WxH 下发）。
// 此前缺失该预检时，LLM 选中固定档/非 mask 模型会在审批计费后才于 admission 爆破
// （review 2026-09-21 P2）。
func cloudAgentOutpaintCapabilityCheck(spec CapabilitySpec) error {
	if spec.Inputs["mask"].Max < 1 {
		return BadAuthRequest("当前模型不支持蒙版输入，不能执行扩图；请选择支持蒙版编辑的图片模型")
	}
	if spec.ImageSize == nil {
		return BadAuthRequest("当前模型未声明画幅能力，不能执行扩图；请选择支持自定义尺寸的图片模型")
	}
	if !spec.ImageSize.AllowCustom && spec.ImageSize.Parameter != "size" {
		// aspect_ratio 制模型可按枚举比值提交，size 制固定档无法容纳 pad 后任意像素 → 拒。
		return BadAuthRequest("当前模型仅支持固定画幅档位，不能按扩图目标画幅提交；请选择支持自定义尺寸的图片模型")
	}
	return nil
}
