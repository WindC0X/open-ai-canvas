package app

// F-06 二期硬贴回（2026-09-27 控制线裁决）：
// 扩图任务结果落库前，把非生成区（原图区）按归一化 rect 映射贴回原图像素——生成区保留模型
// 输出、非生成区像素级保真（subject drift 归零）。结果图尺寸永不改变（裁决②：rect 直接映射
// 结果坐标系；贴回不 resize 画布）。所有失败/缺省路径 = 原样返回 + 日志，不阻断任务。
// 几何真源 = 任务 metadata.outpaint（前端合成函数 / Agent 链服务端同源写入）。

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"math"
	"os"
	"strings"

	"golang.org/x/image/draw"

	_ "image/jpeg"
	"infinite-canvas/backend/internal/model"
)

const (
	// 过渡带：提交画布坐标系 2px，随映射因子缩放（裁决②b，防偏差单硬接缝）。
	outpaintHardBlendFeatherBasePx = 2.0
	// 纵横比失真阈值（log 域，与前端画幅偏差角标同源同值 0.02，单一事实）：角标亮 = 不贴回
	// （裁决②a 语义修订 2026-09-29——[0.02,0.08) 盲区带内贴回会在偏差构图上制造新缺陷）。
	outpaintHardBlendMaxAspectDelta = 0.02
	// 原图解码像素上限（对齐 cloudAgentOutpaintMaxPixels，防解压炸弹）。
	outpaintHardBlendMaxSourcePixels = 40_000_000
)

// applyOutpaintHardBlend 在 persistGeneratedMediaResult 之前对扩图任务结果做硬贴回。
// 识别 = 任务 input.metadata.outpaint 块存在（工具链/Agent 链/重试链统一）；块缺失 = 非扩图
// 或存量任务 → 静默跳过。任何处理失败只记日志，返回原 result。
func (s *Service) applyOutpaintHardBlend(task *model.Task, result map[string]interface{}) map[string]interface{} {
	if task == nil || result == nil {
		return result
	}
	meta, err := s.outpaintHardBlendMetadata(task)
	if err != nil {
		// 块存在但不可解析/不可用：跳过 + 日志（边界条款：缺几何不报错不阻塞）。
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过："+err.Error())
		return result
	}
	if meta == nil {
		return result
	}
	if !meta.hardBlend {
		s.logOutpaintHardBlend(task, "info", "扩图硬贴回已关断（metadata.outpaint.hardBlend=false）")
		return result
	}
	images, err := normalizeOutpaintHardBlendImages(result["images"])
	if err != nil {
		// 形状失明必须留痕（2026-09-28 micro-rider，glm review：经典内置协议曾在此静默跳过）。
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过："+err.Error())
		return result
	}
	if len(images) == 0 {
		return result
	}
	result["images"] = images
	source, err := s.loadOutpaintHardBlendSource(task.UserID, meta.sourceStorageKey)
	if err != nil {
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过："+err.Error())
		return result
	}
	blended := 0
	for index, item := range images {
		entry, ok := item.(map[string]interface{})
		if !ok {
			s.logOutpaintHardBlend(task, "warn", fmt.Sprintf("扩图硬贴回第 %d 张跳过：结果项形状无法识别（%T）", index+1, item))
			continue
		}
		dataURL, _ := entry["dataUrl"].(string)
		if dataURL == "" {
			continue
		}
		next, err := s.hardBlendOutpaintEntry(dataURL, source, meta)
		if err != nil {
			s.logOutpaintHardBlend(task, "warn", fmt.Sprintf("扩图硬贴回第 %d 张跳过：%v", index+1, err))
			continue
		}
		entry["dataUrl"] = next
		blended++
	}
	if blended > 0 {
		s.logOutpaintHardBlend(task, "info", fmt.Sprintf("扩图硬贴回完成：%d 张结果已回贴原图区像素", blended))
	}
	return result
}

// normalizeOutpaintHardBlendImages 把结果 images 归一化为 []interface{}（元素 map[string]interface{}）：
// 声明式协议路径已经是 []interface{}，原样保留；经典内置协议（openai-image / gemini-image / grok /
// volcengine-ark，见 provider_image.go imageDataURLs）返回 []map[string]string，经 JSON 归一化统一
// （persist 侧最终同样走 JSON 序列化）；其余形状返回错误，由调用方记日志——形状失明不得静默
// （2026-09-28 micro-rider，glm review）。
func normalizeOutpaintHardBlendImages(value interface{}) ([]interface{}, error) {
	if value == nil {
		return nil, nil
	}
	if images, ok := value.([]interface{}); ok {
		return images, nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("结果 images 形状无法识别（%T）：%v", value, err)
	}
	var images []interface{}
	if err := json.Unmarshal(raw, &images); err != nil {
		return nil, fmt.Errorf("结果 images 形状无法识别（%T）", value)
	}
	return images, nil
}

// outpaintMediaBlend 媒体物化阶段的贴回上下文（元数据 + 原图，每任务加载一次）。
type outpaintMediaBlend struct {
	meta   *outpaintHardBlendMeta
	source image.Image
}

// prepareOutpaintHardBlend 为媒体物化路径准备贴回上下文；非扩图 / 关断 / 失败返回 nil（fail-open）。
// materializeTaskMedia 对 image 模式任务调用；无 outpaint 块的任务快速返回 nil。
func (s *Service) prepareOutpaintHardBlend(task *model.Task) *outpaintMediaBlend {
	if task == nil {
		return nil
	}
	meta, err := s.outpaintHardBlendMetadata(task)
	if err != nil {
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过："+err.Error())
		return nil
	}
	if meta == nil || !meta.hardBlend {
		return nil
	}
	source, err := s.loadOutpaintHardBlendSource(task.UserID, meta.sourceStorageKey)
	if err != nil {
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过："+err.Error())
		return nil
	}
	return &outpaintMediaBlend{meta: meta, source: source}
}

// applyOutpaintHardBlendToMediaFile 在媒体物化（下载完成、入库前）对单张结果临时文件
// 执行硬贴回；就地改写为 PNG 并返回新的 MIME 类型。任何失败 = 原样返回（fail-open，仅记日志）。
func (s *Service) applyOutpaintHardBlendToMediaFile(task *model.Task, blend *outpaintMediaBlend, path string, mimeType string) (string, string) {
	if blend == nil || path == "" {
		return path, mimeType
	}
	data, err := os.ReadFile(path)
	if err != nil {
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过：读取暂存结果失败")
		return path, mimeType
	}
	generated, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过：暂存结果解码失败")
		return path, mimeType
	}
	next, err := hardBlendOutpaintImage(generated, blend.source, hardBlendOutpaintParams{
		x0: blend.meta.x0, y0: blend.meta.y0, x1: blend.meta.x1, y1: blend.meta.y1,
		frameWidth: blend.meta.frameWidth, frameHeight: blend.meta.frameHeight,
	})
	if err != nil {
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过："+err.Error())
		return path, mimeType
	}
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, next); err != nil {
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过：结果编码失败")
		return path, mimeType
	}
	if err := os.WriteFile(path, buffer.Bytes(), 0o600); err != nil {
		s.logOutpaintHardBlend(task, "warn", "扩图硬贴回跳过：暂存文件回写失败")
		return path, mimeType
	}
	s.logOutpaintHardBlend(task, "info", "扩图硬贴回完成：结果已回贴原图区像素")
	return path, "image/png"
}

type outpaintHardBlendMeta struct {
	sourceStorageKey string
	x0, y0, x1, y1   float64
	frameWidth       int
	frameHeight      int
	hardBlend        bool
}

// outpaintHardBlendMetadata 解析任务 input 中的 outpaint 几何块。
// (nil, nil) = 非扩图任务（无块）；(nil, err) = 有块但不可用（跳过 + 日志）。
func (s *Service) outpaintHardBlendMetadata(task *model.Task) (*outpaintHardBlendMeta, error) {
	decrypted, err := s.decryptTaskInputJSON(task.InputJSON)
	if err != nil {
		return nil, fmt.Errorf("任务输入解密失败：%w", err)
	}
	var input canvasGenerationInput
	if err := json.Unmarshal([]byte(decrypted), &input); err != nil {
		return nil, fmt.Errorf("任务输入解析失败：%w", err)
	}
	if input.Metadata == nil {
		return nil, nil
	}
	raw, ok := input.Metadata["outpaint"].(map[string]interface{})
	if !ok || raw == nil {
		return nil, nil
	}
	meta := &outpaintHardBlendMeta{hardBlend: true}
	// 裁决①b：缺省 hardBlend 字段 = 开启（默认路径是被测事实）。
	if value, exists := raw["hardBlend"]; exists {
		if flag, ok := value.(bool); ok {
			meta.hardBlend = flag
		}
	}
	meta.sourceStorageKey, _ = raw["sourceStorageKey"].(string)
	if meta.sourceStorageKey == "" {
		return nil, errors.New("缺少 sourceStorageKey")
	}
	rect, _ := raw["rect"].(map[string]interface{})
	if rect == nil {
		return nil, errors.New("缺少 rect")
	}
	meta.x0 = numberValue(rect["x0"])
	meta.y0 = numberValue(rect["y0"])
	meta.x1 = numberValue(rect["x1"])
	meta.y1 = numberValue(rect["y1"])
	if !(meta.x0 >= 0 && meta.y0 >= 0 && meta.x1 <= 1 && meta.y1 <= 1 && meta.x1 > meta.x0 && meta.y1 > meta.y0) {
		return nil, fmt.Errorf("rect 非法（%v,%v,%v,%v）", meta.x0, meta.y0, meta.x1, meta.y1)
	}
	frame, _ := raw["frame"].(map[string]interface{})
	if frame == nil {
		return nil, errors.New("缺少 frame")
	}
	meta.frameWidth, meta.frameHeight = int(numberValue(frame["width"])), int(numberValue(frame["height"]))
	if meta.frameWidth <= 0 || meta.frameHeight <= 0 {
		return nil, errors.New("frame 非法")
	}
	return meta, nil
}

// loadOutpaintHardBlendSource 读取原图资源（归属校验走 OpenResource；像素上限预检防解压炸弹）。
func (s *Service) loadOutpaintHardBlendSource(userID string, storageKey string) (image.Image, error) {
	if !strings.HasPrefix(storageKey, "resource:") {
		return nil, errors.New("sourceStorageKey 非 resource 引用")
	}
	resourceID := strings.TrimPrefix(storageKey, "resource:")
	if resourceID == "" {
		return nil, errors.New("sourceStorageKey 缺少资源 ID")
	}
	_, body, err := s.OpenResource(userID, resourceID)
	if err != nil {
		return nil, fmt.Errorf("读取原图资源失败：%w", err)
	}
	defer body.Close()
	limit := s.outpaintHardBlendSourceByteLimit()
	data, err := io.ReadAll(io.LimitReader(body, limit+1))
	if err != nil {
		return nil, fmt.Errorf("读取原图数据失败：%w", err)
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("原图文件超过 %dMB", limit/(1<<20))
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("原图解码失败：%w", err)
	}
	if config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > outpaintHardBlendMaxSourcePixels {
		return nil, fmt.Errorf("原图像素规模超限（%dx%d）", config.Width, config.Height)
	}
	source, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("原图解码失败：%w", err)
	}
	return source, nil
}

func (s *Service) outpaintHardBlendSourceByteLimit() int64 {
	limit := int64(64 << 20)
	if policy, err := s.RuntimePolicy(); err == nil && policy.Resource.GeneratedFileMB > 0 {
		limit = megabytes(policy.Resource.GeneratedFileMB)
	}
	return limit
}

// hardBlendOutpaintEntry 对单张结果图执行贴回，返回新 dataURL（PNG）。
func (s *Service) hardBlendOutpaintEntry(dataURL string, source image.Image, meta *outpaintHardBlendMeta) (string, error) {
	_, data, err := s.decodeDataURL(dataURL)
	if err != nil {
		return "", err
	}
	generated, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("结果图解码失败：%w", err)
	}
	next, err := hardBlendOutpaintImage(generated, source, hardBlendOutpaintParams{
		x0: meta.x0, y0: meta.y0, x1: meta.x1, y1: meta.y1,
		frameWidth: meta.frameWidth, frameHeight: meta.frameHeight,
	})
	if err != nil {
		return "", err
	}
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, next); err != nil {
		return "", fmt.Errorf("贴回结果编码失败：%w", err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buffer.Bytes()), nil
}

type hardBlendOutpaintParams struct {
	x0, y0, x1, y1 float64
	frameWidth     int
	frameHeight    int
}

// hardBlendOutpaintImage（纯函数层，可单测）：把原图像素贴回结果图的非生成区。
// ① 结果尺寸不变（画布 = 生成图原尺寸）；② rect 映射结果坐标系（裁决②：直接映射）；
// ③ 纵横比失真 |log(ar_result/ar_frame)| > 0.02（与前端角标同阈，2026-09-29 裁决②a 修订）→ 放弃（调用方跳过+日志）；
// ④ 过渡带 = 提交画布坐标系 2px（随映射因子缩放），带内生成图→原图线性过渡防硬接缝。
func hardBlendOutpaintImage(generated image.Image, source image.Image, params hardBlendOutpaintParams) (*image.RGBA, error) {
	if generated == nil || source == nil {
		return nil, errors.New("图像为空")
	}
	bounds := generated.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width <= 0 || height <= 0 {
		return nil, errors.New("结果图尺寸非法")
	}
	if params.frameWidth <= 0 || params.frameHeight <= 0 {
		return nil, errors.New("frame 非法")
	}
	aspectResult := float64(width) / float64(height)
	aspectFrame := float64(params.frameWidth) / float64(params.frameHeight)
	if math.Abs(math.Log(aspectResult/aspectFrame)) > outpaintHardBlendMaxAspectDelta {
		// 裁决②a（2026-09-29 修订）：角标亮 = 不贴回——纵横比失真超阈放弃贴回，不用拉伸贴图制造新缺陷。
		return nil, fmt.Errorf("纵横比失真超阈（结果 %dx%d / 提交 %dx%d）", width, height, params.frameWidth, params.frameHeight)
	}
	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(canvas, canvas.Bounds(), generated, bounds.Min, draw.Src)

	dest := image.Rect(
		clampInt(int(math.Round(params.x0*float64(width))), 0, width-1),
		clampInt(int(math.Round(params.y0*float64(height))), 0, height-1),
		clampInt(int(math.Round(params.x1*float64(width))), 1, width),
		clampInt(int(math.Round(params.y1*float64(height))), 1, height),
	)
	if dest.Dx() <= 0 || dest.Dy() <= 0 {
		return nil, errors.New("rect 映射为空区域")
	}
	resized := image.NewRGBA(image.Rect(0, 0, dest.Dx(), dest.Dy()))
	draw.CatmullRom.Scale(resized, resized.Bounds(), source, source.Bounds(), draw.Src, nil)

	// 过渡带：提交画布坐标系 2px × 两轴映射因子均值（裁决②b），clamp [1,8] 防异常 rect。
	featherX := outpaintHardBlendFeatherBasePx * float64(width) / float64(params.frameWidth)
	featherY := outpaintHardBlendFeatherBasePx * float64(height) / float64(params.frameHeight)
	feather := clampInt(int(math.Round((featherX+featherY)/2)), 1, 8)

	for y := dest.Min.Y; y < dest.Max.Y; y++ {
		for x := dest.Min.X; x < dest.Max.X; x++ {
			edge := min(x-dest.Min.X, dest.Max.X-1-x, y-dest.Min.Y, dest.Max.Y-1-y)
			if edge >= feather {
				// 非生成区（过渡带外）：原图像素硬贴回，零混合零改动。
				canvas.Set(x, y, resized.At(x-dest.Min.X, y-dest.Min.Y))
				continue
			}
			alpha := float64(edge) / float64(feather)
			if alpha <= 0 {
				continue
			}
			canvas.SetRGBA(x, y, blendRGBA(canvas.RGBAAt(x, y), resized.RGBAAt(x-dest.Min.X, y-dest.Min.Y), alpha))
		}
	}
	return canvas, nil
}

func blendRGBA(base, overlay color.RGBA, alpha float64) color.RGBA {
	mix := func(a, b uint8) uint8 {
		return uint8(math.Round(float64(a)*(1-alpha) + float64(b)*alpha))
	}
	return color.RGBA{R: mix(base.R, overlay.R), G: mix(base.G, overlay.G), B: mix(base.B, overlay.B), A: 255}
}

func (s *Service) logOutpaintHardBlend(task *model.Task, level string, message string) {
	_ = s.log(task.UserID, task.ID, level, message, "")
}

func numberValue(value interface{}) float64 {
	switch number := value.(type) {
	case float64:
		return number
	case int:
		return float64(number)
	case int64:
		return float64(number)
	case json.Number:
		parsed, _ := number.Float64()
		return parsed
	default:
		return 0
	}
}

func clampInt(value, low, high int) int {
	if value < low {
		return low
	}
	if value > high {
		return high
	}
	return value
}
