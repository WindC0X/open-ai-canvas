package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"
)

// The Agent uses the same public catalog as the composer, never a second routing policy.
func (s *Service) cloudAgentModelList(intent *ModelRequestIntent) (any, error) {
	catalog, err := s.ModelCatalog(intent)
	if err != nil {
		return nil, err
	}
	logicalModels, err := s.PublicLogicalModels(intent)
	if err != nil {
		return nil, err
	}
	items := []map[string]any{}
	for _, m := range logicalModels {
		if m.Available && cloudAgentGenerationModeSupported(normalizeCapability(m.Capability)) {
			items = append(items, map[string]any{"name": m.Name, "capability": m.Capability, "selection": map[string]any{"logicalModelId": m.ID}, "priceLabel": m.PriceLabel, "priceTiers": m.PriceTiers, "options": m.CapabilitySpec, "profiles": m.CapabilityProfiles, "defaults": m.DefaultOptions})
		}
	}
	for _, channel := range catalog.Channels {
		for _, m := range channel.Models {
			if m.Available && cloudAgentGenerationModeSupported(normalizeCapability(m.Capability)) {
				items = append(items, map[string]any{"name": m.DisplayName, "capability": m.Capability, "selection": map[string]any{"channelId": channel.ID, "channelModelKey": m.ModelKey}, "priceLabel": m.PriceLabel, "priceTiers": m.PriceTiers, "options": m.CapabilityConfig, "defaults": m.DefaultOptions})
			}
		}
	}
	return map[string]any{"source": catalog.Source, "models": items, "intent": intent}, nil
}

// Resolve actual canvas resources before filtering the shared catalog. Counts
// supplied by the model must not replace resource ownership/readiness checks.
func (s *Service) cloudAgentModelIntent(userID, canvasID, arguments string) (*ModelRequestIntent, error) {
	var a struct {
		Mode             string   `json:"mode"`
		ReferenceNodeIDs []string `json:"referenceNodeIds"`
	}
	if err := decodeCloudAgentJSONObject(arguments, &a); err != nil {
		return nil, BadAuthRequest("模型查询参数无效")
	}
	if a.Mode == "" && len(a.ReferenceNodeIDs) == 0 {
		return nil, nil
	}
	if !cloudAgentGenerationModeSupported(a.Mode) || len(a.ReferenceNodeIDs) > 16 {
		return nil, BadAuthRequest("请指定支持的生成模式，参考节点最多16个")
	}
	canvas, err := s.repo.CanvasProjectForUser(userID, canvasID)
	if err != nil {
		return nil, err
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		return nil, err
	}
	nodes, err := creationObjects(doc["nodes"])
	if err != nil {
		return nil, err
	}
	refs := map[string]any{}
	seen := map[string]bool{}
	for _, id := range a.ReferenceNodeIDs {
		if id == "" || seen[id] || nodes[id] == nil {
			return nil, BadAuthRequest("参考节点不存在或重复")
		}
		seen[id] = true
		ref, field, err := cloudAgentMediaReference(s.repo, userID, canvas.ProjectID, nodes[id])
		if err != nil {
			return nil, err
		}
		list, _ := refs[field].([]any)
		refs[field] = append(list, ref)
	}
	if err := validateCloudAgentMediaReferences(a.Mode, refs); err != nil {
		return nil, err
	}
	refs["mode"] = a.Mode
	intent := ModelRequestIntentFromTaskInput(refs, "canvas_"+a.Mode, cloudAgentMediaOperation(a.Mode, refs))
	return &intent, nil
}

type cloudAgentMediaArgs struct {
	Prepared              *cloudAgentPreparedMedia `json:"-"`
	DraftRunID            string                   `json:"-"`
	CharacterVersions     map[string]string        `json:"-"`
	CharacterLabels       []string                 `json:"-"`
	Mode                  string                   `json:"mode"`
	Prompt                string                   `json:"prompt"`
	LogicalModelID        string                   `json:"logicalModelId"`
	ChannelID             string                   `json:"channelId"`
	ChannelModelKey       string                   `json:"channelModelKey"`
	Duration              int                      `json:"durationSeconds"`
	Size                  string                   `json:"size"`
	Quality               string                   `json:"quality"`
	VideoGenerateAudio    *bool                    `json:"videoGenerateAudio"`
	SnapshotHash          string                   `json:"snapshotHash"`
	NodeID                string                   `json:"nodeId"`
	Title                 string                   `json:"title"`
	SourceNodeID          string                   `json:"sourceNodeId"`
	ReferenceNodeIDs      []string                 `json:"referenceNodeIds"`
	ReferenceTransientIDs []string                 `json:"referenceTransientIds"`
	// OutpaintRatio 非空时本次图片生成按扩图语义执行：恰好 1 张图片参考被
	// 服务端 pad 成目标画幅并合成 mask，走 image_outpaint 操作计价与执行。
	OutpaintRatio string `json:"outpaintRatio,omitempty"`
}

type cloudAgentMediaPlan struct {
	Args                cloudAgentMediaArgs
	CallID              string
	TransientReferences map[string]cloudAgentTransientReference
	// 扩图提交画幅（pad 合成后的精确像素，prepare 阶段解出）。扩图节点标题与 metadata.size
	// 必须写这个真值：Agent 传的 ratio、用户在审批卡选的原始档位都可能在服务端被对齐/收缩。
	OutpaintFrameW int
	OutpaintFrameH int
	// Prepared is populated by the auto path after its dry admission. Approval
	// mode keeps the same admission in state.Approval.Prepared.
	Prepared *cloudAgentPreparedMedia `json:"-"`
}

// A resumed draft's incoming edges must describe the new approved inputs,
// rather than retaining references removed from the generation request.
func cloudAgentMediaConnections(edges []map[string]any, a cloudAgentMediaArgs) []map[string]any {
	incoming := map[string]map[string]any{}
	result := make([]map[string]any, 0, len(edges))
	for _, edge := range edges {
		if stringValue(edge["toNodeId"]) != a.NodeID {
			result = append(result, edge)
		} else {
			incoming[stringValue(edge["fromNodeId"])] = edge
		}
	}
	for _, id := range append(append([]string{}, a.ReferenceNodeIDs...), a.SourceNodeID) {
		if edge := incoming[id]; edge != nil {
			result = append(result, edge)
			delete(incoming, id)
		}
	}
	return result
}

type cloudAgentReferenceAdapter struct {
	PayloadField string
	MIMEMajor    string
}

// Provider payload fields are an adapter concern, not a canvas node-type
// allow-list. A new reference kind must register both a canvas capability and
// an upstream media adapter before it can cross this boundary.
var cloudAgentReferenceAdapters = map[string]cloudAgentReferenceAdapter{
	"image": {PayloadField: "referenceImages", MIMEMajor: "image"},
	"video": {PayloadField: "referenceVideos", MIMEMajor: "video"},
	"audio": {PayloadField: "referenceAudios", MIMEMajor: "audio"},
}

// This is the provider/task boundary, not a node allow-list. A canvas
// descriptor alone cannot activate a billing or provider operation: that
// operation must have an implemented adapter before it is exposed to Agent.
var cloudAgentGenerationAdapters = map[string]struct{}{
	"image": {}, "video": {}, "audio": {},
}

func (s *Service) cloudAgentMediaModelName(a cloudAgentMediaArgs) (string, error) {
	if !cloudAgentGenerationModeSupported(a.Mode) {
		return "", BadAuthRequest("生成模式当前不受 Agent 支持")
	}
	catalog, err := s.ModelCatalog(nil)
	if err != nil {
		return "", err
	}
	logicalModels, err := s.PublicLogicalModels(nil)
	if err != nil {
		return "", err
	}
	for _, m := range logicalModels {
		if a.LogicalModelID != "" && m.ID == a.LogicalModelID && m.Available && normalizeCapability(m.Capability) == normalizeCapability(a.Mode) {
			return m.Name, nil
		}
	}
	for _, channel := range catalog.Channels {
		if channel.ID != a.ChannelID {
			continue
		}
		for _, m := range channel.Models {
			if m.ModelKey == a.ChannelModelKey && m.Available && normalizeCapability(m.Capability) == normalizeCapability(a.Mode) {
				return m.DisplayName, nil
			}
		}
	}
	return "", BadAuthRequest("模型目录已变化，请重新读取目录并询问用户选择模型")
}

func cloudAgentReferenceDescriptor(node map[string]any) (cloudAgentNodeCapability, cloudAgentReferenceAdapter, error) {
	descriptor, known := cloudAgentNodeCapabilityForNode(node)
	if !known || !descriptor.Connection.CanReference || descriptor.InputKind == "" {
		return cloudAgentNodeCapability{}, cloudAgentReferenceAdapter{}, BadAuthRequest("该节点不能作为媒体参考资产")
	}
	adapter, supported := cloudAgentReferenceAdapters[descriptor.InputKind]
	if !supported {
		return cloudAgentNodeCapability{}, cloudAgentReferenceAdapter{}, BadAuthRequest("该节点的参考输入类型尚未接入媒体生成")
	}
	return descriptor, adapter, nil
}

func cloudAgentReference(repo *repository.Repository, userID string, node map[string]any) (map[string]any, string, error) {
	descriptor, adapter, err := cloudAgentReferenceDescriptor(node)
	if err != nil {
		return nil, "", err
	}
	meta, _ := node["metadata"].(map[string]any)
	key := stringValue(meta["storageKey"])
	if !strings.HasPrefix(key, "resource:") {
		return nil, "", BadAuthRequest("参考资产尚未保存到账号资源库，请先上传；不能用外部地址代替")
	}
	resource, err := repo.ResourceForUser(userID, strings.TrimPrefix(key, "resource:"))
	if err != nil {
		return nil, "", BadAuthRequest("参考资产不存在或不属于当前用户")
	}
	if resource.Status != "ready" || !strings.HasPrefix(strings.ToLower(resource.MimeType), adapter.MIMEMajor+"/") {
		return nil, "", BadAuthRequest("参考资产尚未就绪或媒体类型不匹配")
	}
	return map[string]any{"id": node["id"], "name": node["title"], "storageKey": key, "type": resource.MimeType, "mimeType": resource.MimeType, "bytes": resource.Size, "width": resource.Width, "height": resource.Height, "durationMs": resource.DurationMs, "inputKind": descriptor.InputKind}, adapter.PayloadField, nil
}

// Shared by the read projection and generation admission. Ownership of an
// otherwise eligible draft remains a separate, transactional admission check.
func cloudAgentMediaTargetIssue(node map[string]any, nodeType string) (string, string) {
	meta, _ := node["metadata"].(map[string]any)
	switch {
	case meta["locked"] == true:
		return "target_locked", "目标节点已锁定，不能提交生成"
	case stringValue(meta["taskId"]) != "" || stringValue(meta["generationTaskId"]) != "":
		return "task_bound", "目标节点已关联任务，不能覆盖；可读取 generation 或 task_get 查询原任务状态和错误"
	case stringValue(node["type"]) != nodeType:
		return "target_type_mismatch", "目标节点类型与生成模式不匹配"
	case stringValue(meta["storageKey"]) != "" || stringValue(meta["content"]) != "":
		return "output_exists", "目标节点已有媒体产物，不能作为未提交草稿覆盖"
	case stringValue(meta["status"]) != "idle":
		return "target_not_idle", "目标节点不是空闲的未提交草稿，请读取节点及任务状态"
	}
	return "", ""
}

func cloudAgentMediaAdmissionRetryable(err error) bool {
	if err == nil {
		return false
	}
	var appErr *AppError
	if errors.As(err, &appErr) && appErr.Retryable {
		return true
	}
	var httpErr providerHTTPError
	if errors.As(err, &httpErr) {
		return httpErr.StatusCode >= 500 || httpErr.StatusCode == 429 || httpErr.StatusCode == 408
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var circuitErr providerCircuitOpenError
	return errors.As(err, &circuitErr)
}

type cloudAgentMediaAdmissionError struct {
	error
	Reason         string
	NodeID         string
	ErrorClass     string
	Retryable      bool
	RequiredAction string
}

func (e *cloudAgentMediaAdmissionError) Unwrap() error { return e.error }

// cloudAgentWrapMediaAdmissionError turns an untyped failure from the media
// admission boundary into an explicit failure classification. Only errors that
// are independently known to be transient may continue automatically; model,
// parameter, permission and budget errors remain terminal before submission.
func cloudAgentWrapMediaAdmissionError(err error) error {
	if err == nil {
		return nil
	}
	var argumentErr *cloudAgentArgumentError
	if errors.As(err, &argumentErr) {
		return err
	}
	var admissionErr *cloudAgentMediaAdmissionError
	if errors.As(err, &admissionErr) {
		return err
	}
	retryable := cloudAgentMediaAdmissionRetryable(err)
	action := "report_to_user"
	if retryable {
		action = "retry"
	}
	return &cloudAgentMediaAdmissionError{
		error:          err,
		Reason:         "media_admission_failed",
		ErrorClass:     cloudAgentToolErrorAdmission,
		Retryable:      retryable,
		RequiredAction: action,
	}
}

func cloudAgentMediaDocument(repo *repository.Repository, userID, canvasID string, args cloudAgentMediaArgs, transient ...map[string]cloudAgentTransientReference) (*model.CanvasProject, map[string]any, map[string]any, error) {
	canvas, err := repo.CanvasProjectForUser(userID, canvasID)
	if err != nil {
		return nil, nil, nil, err
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		return nil, nil, nil, err
	}
	unchanged := args.SnapshotHash != "" && (cloudAgentCanvasHash(doc) == args.SnapshotHash || cloudAgentMediaContentHash(doc) == args.SnapshotHash || cloudAgentContentHash(doc) == args.SnapshotHash)
	if args.Prepared != nil {
		dependency, err := cloudAgentMediaDependencyHash(doc, args)
		if err != nil {
			return nil, nil, nil, err
		}
		unchanged = dependency == args.Prepared.DependencyHash
	}
	if !unchanged {
		return nil, nil, nil, &cloudAgentMediaAdmissionError{
			error:  creationConflict("画布内容已变化，请重新读取画布并重新审批；未提交生成任务"),
			Reason: "snapshot_conflict",
			NodeID: args.NodeID,
		}
	}
	nodes, err := creationObjects(doc["nodes"])
	if err != nil {
		return nil, nil, nil, err
	}
	existing := nodes[args.NodeID]
	existingMeta, _ := existing["metadata"].(map[string]any)
	targetDescriptor, supported := cloudAgentNodeCapabilityForGenerationMode(args.Mode)
	if !supported {
		return nil, nil, nil, cloudAgentFieldError("mode", "invalid_value", "生成模式当前不受 Agent 支持；请使用工具 schema 中列出的模式")
	}
	if err := validateCloudAgentID(args.NodeID, "生成节点 ID", 80); err != nil {
		return nil, nil, nil, cloudAgentFieldError("nodeId", "invalid_value", cloudAgentSafeToolError(err))
	}
	if existing != nil {
		if reason, issue := cloudAgentMediaTargetIssue(existing, targetDescriptor.Type); reason != "" {
			return nil, nil, nil, &cloudAgentMediaAdmissionError{
				error:  BadAuthRequest(issue),
				Reason: reason,
				NodeID: args.NodeID,
			}
		}
		if args.DraftRunID == "" {
			return nil, nil, nil, BadAuthRequest("续用草稿缺少当前运行身份")
		}
		ownerID := stringValue(existingMeta["agentDraftRunId"])
		if ownerID != "" && ownerID != args.DraftRunID {
			owner, err := repo.CloudAgent(userID, ownerID)
			if err != nil {
				return nil, nil, nil, BadAuthRequest("无法确认草稿所属运行，请停止重试并检查原草稿")
			}
			if owner.CanvasID != canvasID || !cloudAgentRunTerminal(owner.Status) || owner.CleanupPending {
				return nil, nil, nil, BadAuthRequest("草稿仍由另一运行处理，请先完成或取消原运行；不要另建节点绕过审批")
			}
		}
	}
	if args.SourceNodeID != "" && nodes[args.SourceNodeID] == nil {
		return nil, nil, nil, cloudAgentFieldError("sourceNodeId", "not_found", "来源节点不在当前画布；请重新读取画布并使用真实文本节点 ID，或留空")
	}
	if source := nodes[args.SourceNodeID]; source != nil {
		descriptor, known := cloudAgentNodeCapabilityForNode(source)
		// 角色卡作为文本来源时只取其角色设定（由 cloudAgentMediaCharacters 校验非空）。
		if !known || !descriptor.Connection.CanSource || (descriptor.InputKind != "text" && descriptor.InputKind != "character") {
			return nil, nil, nil, cloudAgentFieldError("sourceNodeId", "invalid_value", "sourceNodeId 仅接受可作为文本输入的节点；媒体资产请放入 referenceNodeIds，并将 sourceNodeId 留空")
		}
	}
	// Keep the media entry point subject to the same graph admission policy as
	// canvas_apply_ops. The old implementation only checked that references
	// existed, which allowed invalid edges (for example frame -> image) to be
	// smuggled in through generate_media.
	prospectiveConnections := cloudAgentMediaConnections(creationMaps(doc["connections"]), args)
	target := existing
	if target == nil {
		target = map[string]any{"id": args.NodeID, "type": targetDescriptor.Type}
	}
	prospectiveNodes := make([]map[string]any, 0, len(nodes)+1)
	for _, node := range nodes {
		prospectiveNodes = append(prospectiveNodes, node)
	}
	if existing == nil {
		prospectiveNodes = append(prospectiveNodes, target)
	}
	type prospectiveSource struct {
		id    string
		field string
	}
	prospectiveSources := make([]prospectiveSource, 0, len(args.ReferenceNodeIDs)+1)
	for i, id := range args.ReferenceNodeIDs {
		prospectiveSources = append(prospectiveSources, prospectiveSource{id: id, field: fmt.Sprintf("referenceNodeIds[%d]", i)})
	}
	if args.SourceNodeID != "" {
		prospectiveSources = append(prospectiveSources, prospectiveSource{id: args.SourceNodeID, field: "sourceNodeId"})
	}
	prospectiveSeen := map[string]bool{}
	for _, source := range prospectiveSources {
		sourceID := source.id
		if sourceID == "" || prospectiveSeen[sourceID] {
			continue
		}
		prospectiveSeen[sourceID] = true
		alreadyConnected := false
		for _, edge := range prospectiveConnections {
			if stringValue(edge["fromNodeId"]) == sourceID && stringValue(edge["toNodeId"]) == args.NodeID {
				alreadyConnected = true
				break
			}
		}
		if alreadyConnected {
			continue
		}
		if err := validateCloudAgentConnection(prospectiveNodes, sourceID, args.NodeID, prospectiveConnections); err != nil {
			return nil, nil, nil, cloudAgentFieldError(source.field, "invalid_connection", cloudAgentSafeToolError(err))
		}
		prospectiveConnections = append(prospectiveConnections, map[string]any{"fromNodeId": sourceID, "toNodeId": args.NodeID})
	}
	if args.Prepared != nil {
		refs, err := cloudAgentPreparedReferences(repo, userID, args.Prepared)
		return canvas, doc, refs, err
	}
	refs := map[string]any{}
	seen := map[string]bool{}
	for i, id := range args.ReferenceNodeIDs {
		if id == "" || seen[id] || nodes[id] == nil {
			return nil, nil, nil, cloudAgentFieldError(fmt.Sprintf("referenceNodeIds[%d]", i), "invalid_value", "参考节点不存在或重复；请重新读取画布并只使用真实、唯一的媒体节点 ID")
		}
		seen[id] = true
		if !cloudAgentCharacterNode(nodes[id]) {
			if _, _, err := cloudAgentReferenceDescriptor(nodes[id]); err != nil {
				return nil, nil, nil, cloudAgentFieldError(fmt.Sprintf("referenceNodeIds[%d]", i), "invalid_value", "referenceNodeIds 仅接受受支持的媒体参考节点；文本来源请改用 sourceNodeId")
			}
		}
		ref, payloadField, e := cloudAgentMediaReference(repo, userID, canvas.ProjectID, nodes[id])
		if e != nil {
			return nil, nil, nil, e
		}
		list, _ := refs[payloadField].([]any)
		refs[payloadField] = append(list, ref)
	}
	if len(args.ReferenceTransientIDs) > 0 && len(transient) > 0 {
		available := map[string]cloudAgentTransientReference{}
		if len(transient) > 0 && transient[0] != nil {
			available = transient[0]
		}
		for i, id := range args.ReferenceTransientIDs {
			ref, ok := available[id]
			if !ok {
				return nil, nil, nil, BadAuthRequest("临时参考图不存在或已不可用，请重新渲染标注")
			}
			if !strings.HasPrefix(ref.MIMEType, "image/") {
				return nil, nil, nil, cloudAgentFieldError(fmt.Sprintf("referenceTransientIDs[%d]", i), "invalid_value", "临时参考图必须是图片；请使用图片参考或移除该 ID")
			}
			if ref.ResourceID == "" || time.Now().After(ref.ExpiresAt) {
				return nil, nil, nil, BadAuthRequest("临时参考图资源未就绪或已过期，请重新渲染标注")
			}
			resolved, _, err := cloudAgentReference(repo, userID, map[string]any{"id": ref.ID, "type": "image", "title": ref.Name, "metadata": map[string]any{"storageKey": "resource:" + ref.ResourceID}})
			if err != nil {
				return nil, nil, nil, err
			}
			list, _ := refs["referenceImages"].([]any)
			refs["referenceImages"] = append(list, resolved)
		}
	}
	return canvas, doc, refs, nil
}

func validateCloudAgentMediaArgs(a cloudAgentMediaArgs, state *cloudAgentRuntime) error {
	mode := strings.ToLower(strings.TrimSpace(a.Mode))
	if !cloudAgentGenerationModeSupported(mode) {
		return cloudAgentFieldError("mode", "invalid_value", "生成模式当前不受 Agent 支持；请使用工具 schema 中列出的模式")
	}
	a.Mode = mode
	if a.SnapshotHash == "" {
		return cloudAgentFieldError("snapshotHash", "required", "缺少画布快照，请先读取当前画布后重试")
	}
	if len(a.SnapshotHash) != 64 {
		return cloudAgentFieldError("snapshotHash", "invalid_value", "画布快照无效，请重新读取当前画布")
	}
	for _, r := range a.SnapshotHash {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return cloudAgentFieldError("snapshotHash", "invalid_value", "画布快照无效，请重新读取当前画布")
		}
	}
	if err := validateCloudAgentID(a.NodeID, "生成节点 ID", 80); err != nil {
		return cloudAgentFieldError("nodeId", "invalid_value", cloudAgentSafeToolError(err))
	}
	if a.SourceNodeID != "" {
		if err := validateCloudAgentID(a.SourceNodeID, "来源节点 ID", 80); err != nil {
			return cloudAgentFieldError("sourceNodeId", "invalid_value", cloudAgentSafeToolError(err))
		}
	}
	for i, id := range a.ReferenceNodeIDs {
		if err := validateCloudAgentID(id, "参考节点 ID", 80); err != nil {
			return cloudAgentFieldError(fmt.Sprintf("referenceNodeIds[%d]", i), "invalid_value", cloudAgentSafeToolError(err))
		}
	}
	if len(a.ReferenceTransientIDs) > 4 {
		return cloudAgentFieldError("referenceTransientIds", "item_count", "临时参考图最多 4 个，请减少引用数量")
	}
	for i, id := range a.ReferenceTransientIDs {
		if err := validateCloudAgentID(id, "临时参考图 ID", 120); err != nil {
			return cloudAgentFieldError(fmt.Sprintf("referenceTransientIds[%d]", i), "invalid_value", cloudAgentSafeToolError(err))
		}
	}
	if strings.TrimSpace(a.Prompt) == "" {
		return cloudAgentFieldError("prompt", "required", "生成提示词不能为空，请补充完整提示词")
	}
	if strings.TrimSpace(a.Title) == "" || utf8.RuneCountInString(a.Title) > 240 {
		return cloudAgentFieldError("title", "invalid_value", "生成节点标题不能为空且不能超过 240 个字符")
	}
	if utf8.RuneCountInString(a.Prompt) > 16000 {
		return cloudAgentFieldError("prompt", "length_exceeded", fmt.Sprintf("提示词共%d字符，超过16000字符上限；请先告知用户，不要擅自删改关键内容", utf8.RuneCountInString(a.Prompt)))
	}
	// 合并口径（2026-09-30）：fork 侧原「size/outpaintRatio 必须显式给出」校验由上游准入自动解析取代
	// （applyCloudAgentResolvedMediaDefaults 从准入结果回填 size/quality/duration），语义仍满足 fork 原始意图
	// （不向用户重复询问画幅），故随上游删除。
	if a.Duration < 0 {
		return cloudAgentFieldError("durationSeconds", "invalid_value", "生成时长不能为负数，请传入非负整数")
	}
	switch mode {
	case "video":
		// 0 means omitted. The selected model's capability defaults are resolved
		// during task admission; an explicit unsupported value still fails there.
	case "image", "audio":
		// 防御层: prepareCloudAgentMedia 已在非视频模式清零这两个错位参数(2026-09-20), 此处正常不可达;
		// 保留以防未来调用方绕过 prepare 直达本函数。
		if a.Duration != 0 {
			return cloudAgentFieldError("durationSeconds", "invalid_value", "只有视频生成允许设置 durationSeconds；图片或音频生成请省略该字段")
		}
		// 合并口径（2026-10-04 sync #2）：fork 的容错判定（仅 *true 才拦，容忍 LLM 携带
		// videoGenerateAudio:false 的训练惯性，e30f8472）与上游的错误类型升级（cloudAgentFieldError，
		// f170649e）正交，两者合并保留 —— 行为按 fork，错误呈现按上游。
		if a.VideoGenerateAudio != nil && *a.VideoGenerateAudio {
			return cloudAgentFieldError("videoGenerateAudio", "invalid_value", "只有视频生成支持同步音频；图片或音频生成请省略该字段")
		}
	}
	if len(a.ReferenceNodeIDs) > 16 {
		return cloudAgentFieldError("referenceNodeIds", "item_count", "参考节点最多 16 个，请减少引用数量")
	}
	if strings.TrimSpace(a.OutpaintRatio) != "" {
		if mode != "image" {
			return BadAuthRequest("outpaintRatio 仅适用于图片生成")
		}
		if ratio, _, _ := cloudAgentOutpaintRatioValue(a.OutpaintRatio); ratio <= 0 {
			return BadAuthRequest("扩图画幅比例无效，请传如 16:9 / 3:2 / 1.5")
		}
	}
	if a.SourceNodeID != "" {
		for i, id := range a.ReferenceNodeIDs {
			if id == a.SourceNodeID {
				return cloudAgentFieldError(fmt.Sprintf("referenceNodeIds[%d]", i), "duplicate", "sourceNodeId 与 referenceNodeIds 不能重复；媒体资产仅放入 referenceNodeIds，文本来源仅放入 sourceNodeId")
			}
		}
	}
	if state == nil {
		return BadAuthRequest("Agent 状态无效")
	}
	if state.Request.Budget.MaxGenerationTasks > 0 && state.Generations >= state.Request.Budget.MaxGenerationTasks {
		return BadAuthRequest("已达到本轮媒体生成次数上限")
	}
	if mode == "video" && state.Request.Budget.MaxVideoSeconds > 0 && state.VideoSeconds > state.Request.Budget.MaxVideoSeconds-a.Duration {
		return BadAuthRequest("已超过本轮视频时长预算")
	}
	return nil
}

func validateCloudAgentMediaReferences(mode string, refs map[string]any) error {
	imageCount := lenAnySlice(refs["referenceImages"])
	videoCount := lenAnySlice(refs["referenceVideos"])
	audioCount := lenAnySlice(refs["referenceAudios"])
	switch mode {
	case "image":
		if videoCount > 0 || audioCount > 0 {
			return cloudAgentFieldError("referenceNodeIds", "invalid_combination", "图片生成仅支持图片参考资产；请移除视频或音频引用")
		}
	case "audio":
		if videoCount > 0 {
			return cloudAgentFieldError("referenceNodeIds", "invalid_combination", "音频生成不能使用参考视频；请移除视频引用")
		}
		if imageCount > 0 && audioCount > 0 {
			return cloudAgentFieldError("referenceNodeIds", "invalid_combination", "参考图片和参考音频不能同时使用；请只保留一种媒体类型")
		}
		if imageCount > 1 {
			return cloudAgentFieldError("referenceNodeIds", "item_count", "音频生成最多使用 1 张参考图片，请减少图片引用")
		}
		if audioCount > 3 {
			return cloudAgentFieldError("referenceNodeIds", "item_count", "音频生成最多使用 3 段参考音频，请减少音频引用")
		}
	case "video":
		// Video reference admission is completed against the selected model's
		// capability contract by CreateTask. Do not guess a provider operation here.
	default:
		return cloudAgentFieldError("mode", "invalid_value", "生成模式尚未实现媒体任务适配器；请使用工具 schema 中列出的模式")
	}
	return nil
}

func lenAnySlice(value any) int {
	switch items := value.(type) {
	case []any:
		return len(items)
	case []map[string]any:
		return len(items)
	default:
		return 0
	}
}

func cloudAgentMediaOperation(mode string, refs map[string]any) string {
	switch mode {
	case "video":
		if lenAnySlice(refs["referenceVideos"]) > 0 {
			return "reference_to_video"
		}
		if lenAnySlice(refs["referenceAudios"]) > 0 {
			return "audio_to_video"
		}
		if lenAnySlice(refs["referenceImages"]) > 0 {
			return "image_to_video"
		}
	case "image":
		if lenAnySlice(refs["referenceImages"]) > 0 {
			return "image_to_image"
		}
	}
	if mode == "image" || mode == "video" || mode == "audio" {
		return "text_to_" + mode
	}
	return ""
}

func (s *Service) fillCloudAgentMediaSnapshotHash(userID, canvasID string, a *cloudAgentMediaArgs) error {
	if a == nil || strings.TrimSpace(a.SnapshotHash) != "" {
		return nil
	}
	canvas, err := s.repo.CanvasProjectForUser(userID, canvasID)
	if err != nil {
		return err
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		return err
	}
	a.SnapshotHash = cloudAgentMediaContentHash(doc)
	return nil
}

// cloudAgentMediaDraftSize 返回媒体草稿节点的标准占位尺寸（2026-09-25 用户实测「Agent 创建的
// 节点比手动链路小」修正：9:16 曾硬编码 360×640，比媒体标准盒小一圈；同类修正在 2026-09-19
// 已对文本节点做过一轮 384×384）。与 web 端 nodeSizeFromRatio + fitNodeSize 同口径：
// 比例串（"9:16" / "1024x1824"）先填入基准盒，再按 420×236 下限上浮、基准盒上限收缩；
// 图片链基准盒 = MEDIA_NODE_MAX_SIZE 720×520（2026-09-21 收敛值），视频链 = 类型默认 720×405；
// 空 / auto / 不可解析回退类型默认尺寸，越界比例（<0.25 或 >4）回退基准盒（与 web 对齐）。非媒体类型不换算。
func cloudAgentMediaDraftSize(nodeType string, size string) (float64, float64) {
	defaultWidth, defaultHeight := cloudAgentNodeDefaultWidth(nodeType), cloudAgentNodeDefaultHeight(nodeType)
	if nodeType != "image" && nodeType != "video" {
		return defaultWidth, defaultHeight
	}
	raw := strings.TrimSpace(strings.ToLower(size))
	if raw == "" || raw == "auto" {
		return defaultWidth, defaultHeight
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool { return r == 'x' || r == ':' })
	if len(parts) != 2 {
		return defaultWidth, defaultHeight
	}
	widthRatio, widthErr := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	heightRatio, heightErr := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if widthErr != nil || heightErr != nil || widthRatio <= 0 || heightRatio <= 0 {
		return defaultWidth, defaultHeight
	}
	baseWidth, baseHeight := defaultWidth, defaultHeight
	if nodeType == "image" {
		baseWidth, baseHeight = cloudAgentMediaBoxMaxWidth, cloudAgentMediaBoxMaxHeight
	}
	ratio := widthRatio / heightRatio
	if ratio < 0.25 || ratio > 4 {
		// [review 2026-09-26 P3②] 越界比例回退「基准盒」而非类型默认：与 web nodeSizeFromRatio 的
		// return { baseWidth, baseHeight } 逐字对齐（图链 720×520 / 视频链 720×405）。
		return baseWidth, baseHeight
	}
	candidateWidth, candidateHeight := baseHeight*ratio, baseHeight
	if ratio >= baseWidth/baseHeight {
		candidateWidth, candidateHeight = baseWidth, baseWidth/ratio
	}
	preferredScale := math.Min(1, math.Min(baseWidth/candidateWidth, baseHeight/candidateHeight))
	minimumScale := math.Max(cloudAgentMediaBoxMinWidth/candidateWidth, cloudAgentMediaBoxMinHeight/candidateHeight)
	scale := math.Max(preferredScale, minimumScale)
	return candidateWidth * scale, candidateHeight * scale
}

// 媒体标准盒常量（与 web shared/canvas-node-size.ts 同源；改一处必须对表）。
const (
	cloudAgentMediaBoxMaxWidth  = 720.0 // MEDIA_NODE_MAX_SIZE.width
	cloudAgentMediaBoxMaxHeight = 520.0 // MEDIA_NODE_MAX_SIZE.height
	cloudAgentMediaBoxMinWidth  = 420.0 // MEDIA_NODE_MIN_SIZE.width
	cloudAgentMediaBoxMinHeight = 236.0 // MEDIA_NODE_MIN_SIZE.height
)

// cloudAgentOutpaintTitle 扩图节点标题：按最终提交画幅生成（用户裁定 2026-09-21）。
// 单一源——prepare 写 args.Title，节点创建/审批预览都消费同一个字符串。
func cloudAgentOutpaintTitle(width, height int) string {
	return fmt.Sprintf("扩图 %d×%d", width, height)
}

func (s *Service) prepareCloudAgentMedia(run *model.CloudAgentExecution, state *cloudAgentRuntime, call cloudAgentCall) (CreateTaskRequest, *cloudAgentMediaPlan, error) {
	var a cloudAgentMediaArgs
	if err := decodeCloudAgentJSONObject(call.Function.Arguments, &a); err != nil {
		return CreateTaskRequest{}, nil, cloudAgentJSONArgumentError(err)
	}
	a.Mode = strings.ToLower(strings.TrimSpace(a.Mode))
	if err := validateCloudAgentModelSelection(call.Function.Arguments, a); err != nil {
		return CreateTaskRequest{}, nil, err
	}
	a.DraftRunID = run.ID
	// 模型常把视频专属参数带进图片/音频请求(2026-09-20 真机实测: 图片生成被"videoGenerateAudio 仅适用于
	// 视频生成"反复拒绝, 模型坚信该参数必填, 重试循环无法自愈)。这类错位参数没有安全语义, 静默忽略;
	// 真正的约束(时长必填/参考数量/画幅)仍严格校验。
	if a.Mode != "video" {
		if a.Duration != 0 {
			a.Duration = 0
		}
		a.VideoGenerateAudio = nil
	}
	// [W1 铁律域裁决 2026-09-26] 审批底稿复用改上游 CallHash 口径（点状并入，替代 Call.ID 比对）：
	// Prepared 非空且调用内容哈希一致才复用（CallHash 在审批创建点赋值，见 runtime.go）。
	if state.Approval != nil && state.Approval.Prepared != nil &&
		state.Approval.CallHash == cloudAgentApprovalCallHash(call) {
		a.Prepared = state.Approval.Prepared
	} else if state.AutoPreparedMedia != nil &&
		state.AutoPreparedCallHash == cloudAgentApprovalCallHash(call) &&
		time.Now().Before(state.AutoPreparedMedia.Quote.ExpiresAt) {
		a.Prepared = state.AutoPreparedMedia
	}
	if err := s.fillCloudAgentMediaSnapshotHash(run.UserID, state.Request.CanvasID, &a); err != nil {
		return CreateTaskRequest{}, nil, err
	}
	if err := validateCloudAgentMediaArgs(a, state); err != nil {
		return CreateTaskRequest{}, nil, err
	}
	canvas, doc, refs, err := cloudAgentMediaDocument(s.repo, run.UserID, state.Request.CanvasID, a, state.TransientReferences)
	if err != nil {
		return CreateTaskRequest{}, nil, err
	}
	characters, err := cloudAgentMediaCharacters(s.repo, run.UserID, canvas.ProjectID, doc, a)
	if err != nil {
		return CreateTaskRequest{}, nil, err
	}
	a.CharacterVersions = map[string]string{}
	for _, id := range append(append([]string{}, a.ReferenceNodeIDs...), a.SourceNodeID) {
		if character := characters[id]; character != nil {
			a.CharacterVersions[id] = character.Card.VersionID
			a.CharacterLabels = append(a.CharacterLabels, fmt.Sprintf("%s（第%d版）", character.Name, character.Card.Version))
		}
	}
	if a.Prepared != nil {
		a.Prompt = stringValue(a.Prepared.Input["prompt"])
	} else {
		for _, id := range append(append([]string{}, a.ReferenceNodeIDs...), a.SourceNodeID) {
			if character := characters[id]; character != nil {
				if text := character.prompt(); text != "" {
					a.Prompt += "\n\n" + text
				}
			}
		}
		if utf8.RuneCountInString(a.Prompt) > 16000 {
			return CreateTaskRequest{}, nil, BadAuthRequest("角色卡设定与生成提示词合计超过16000字符，请精简后重新提交")
		}
		a.Prompt, err = cloudAgentMediaReferencePrompt(a.Prompt, refs)
		if err != nil {
			return CreateTaskRequest{}, nil, err
		}
	}
	spec, err := cloudAgentGenerationSpec(a, refs, nil)
	if err != nil {
		return CreateTaskRequest{}, nil, err
	}
	config := spec.Options.TaskConfig()
	if a.ChannelID != "" {
		config["channelId"], config["channelModelKey"], config["model"] = a.ChannelID, a.ChannelModelKey, a.ChannelModelKey
	}
	metadata := map[string]any{"nodeId": a.NodeID, "source": "cloud_agent"}
	if len(a.CharacterVersions) > 0 {
		resolvedVersions := make([]string, 0, len(a.CharacterVersions))
		for id, versionID := range a.CharacterVersions {
			resolvedVersions = append(resolvedVersions, id+":"+versionID)
		}
		metadata["resolvedCharacterVersions"] = resolvedVersions
	}
	if a.Mode == "audio" {
		for _, id := range append(append([]string{}, a.ReferenceNodeIDs...), a.SourceNodeID) {
			character := characters[id]
			if character == nil || character.Card.Voice == nil {
				continue
			}
			voice := character.Card.Voice
			voiceKey := strings.TrimSpace(voice.Profile.VoiceKey)
			if voiceKey == "" {
				continue
			}
			if strings.TrimSpace(stringValue(config["audioVoice"])) == "" {
				config["audioVoice"] = voiceKey
			}
			if strings.TrimSpace(stringValue(config["audioInstructions"])) == "" && strings.TrimSpace(voice.Instructions) != "" {
				config["audioInstructions"] = truncateRunes(voice.Instructions, 2000)
			}
			metadata["resolvedCharacterVoiceKey"] = voiceKey
			break
		}
	}
	input := refs
	input["mode"], input["prompt"], input["config"] = a.Mode, a.Prompt, config
	if err := validateCloudAgentMediaReferences(a.Mode, refs); err != nil {
		return CreateTaskRequest{}, nil, err
	}
	// 扩图提交画幅（prepare 解出后写进 plan，节点标题/metadata 用真值）。
	outpaintFrameW, outpaintFrameH := 0, 0
	// 硬贴回几何（F-06 二期 2026-09-27）：扩图任务写入 metadata.outpaint，执行链据此回贴原图像素。
	var outpaintHardBlendMeta map[string]any
	// 扩图：恰好 1 张图片参考时，服务端合成 pad 底图 + mask 并物化为资源后替换参考，
	// 后续路由/校验/计价/执行与 image_to_image 完全同构（输入只有 resource 引用）。
	if a.Mode == "image" && strings.TrimSpace(a.OutpaintRatio) != "" {
		// 能力预检前置到 prepare（合成/上传之前）：画幅能力是扩图隐含硬要求；mask 按模型能力
		// 可选——不支持蒙版的模型跳过合成、白底直扩（2026-09-28 micro-rider，与手动链同语义）。
		// 真实增量是省掉不可用模型的 pad/mask 合成与上传白耗，并把错误直接还给 LLM 便于换模型；
		// admission 在审批前已会拦（不是「审批后爆」——review 2026-09-21 P3 纠正了此前的表述）。
		spec, capErr := s.cloudAgentOutpaintModelCapability(a)
		if capErr != nil {
			return CreateTaskRequest{}, nil, capErr
		}
		if capErr := cloudAgentOutpaintCapabilityCheck(spec); capErr != nil {
			return CreateTaskRequest{}, nil, capErr
		}
		// mask 通道按模型能力启用（2026-09-28 micro-rider）：spec 有 mask 输入约束 = 支持蒙版。
		frame, err := s.applyCloudAgentOutpaint(run.UserID, input, a, spec.Inputs["mask"].Max >= 1)
		if err != nil {
			return CreateTaskRequest{}, nil, err
		}
		// 扩图目标画幅 = pad 后精确像素（16 倍数对齐），显式覆盖渠道默认 size ——
		// 上游 edits 端点要 WxH 格式，ratio 形式或渠道默认值都会被拒。
		if cfg, ok := input["config"].(map[string]any); ok {
			cfg["size"] = fmt.Sprintf("%dx%d", frame.Width, frame.Height)
		}
		outpaintFrameW, outpaintFrameH = frame.Width, frame.Height
		// 标题按最终画幅生成（用户裁定 2026-09-21）：扩图节点一眼可辨画幅，用户在审批卡改档位
		// 后标题随 prepare 重新求值而更新；此前沿用 Agent 写的 "扩图结果 16:9"，与真实画幅脱节。
		a.Title = cloudAgentOutpaintTitle(frame.Width, frame.Height)
		// 硬贴回几何：源图 resource 引用 + 原图区归一化 rect + 提交画布尺寸（合成处同源产出）。
		outpaintHardBlendMeta = map[string]any{
			"sourceStorageKey": frame.SourceStorageKey,
			"rect":             map[string]any{"x0": frame.RectX0, "y0": frame.RectY0, "x1": frame.RectX1, "y1": frame.RectY1},
			"frame":            map[string]any{"width": frame.Width, "height": frame.Height},
		}
	}
	operation := cloudAgentMediaOperation(a.Mode, input)
	if a.Mode == "image" && strings.TrimSpace(a.OutpaintRatio) != "" {
		operation = "image_outpaint"
	}
	if operation == "" {
		return CreateTaskRequest{}, nil, BadAuthRequest("生成模式尚未实现媒体任务适配器")
	}
	if a.Mode == "video" {
		metadata["videoEditOperation"] = operation
	}
	// 硬贴回（F-06 二期）：仅扩图任务带几何块；缺省即开启，关断仅限 metadata 直写（裁决①）。
	if outpaintHardBlendMeta != nil {
		metadata["outpaint"] = outpaintHardBlendMeta
	}
	input["metadata"] = metadata
	transientSnapshot := map[string]cloudAgentTransientReference{}
	for id, ref := range state.TransientReferences {
		transientSnapshot[id] = ref
	}
	return CreateTaskRequest{ProjectID: state.Request.CanvasID, Type: "canvas_" + a.Mode, Operation: operation, Prompt: a.Prompt, LogicalModelID: a.LogicalModelID, Model: a.ChannelModelKey, Input: input}, &cloudAgentMediaPlan{Args: a, CallID: call.ID, TransientReferences: transientSnapshot, OutpaintFrameW: outpaintFrameW, OutpaintFrameH: outpaintFrameH, Prepared: a.Prepared}, nil
}

// applyCloudAgentResolvedMediaDefaults makes the result of the dry admission
// explicit in both the plan and the request that will be submitted. The
// regular task admission already owns default resolution; this helper only
// mirrors that resolved contract back to the Agent state so auto execution does
// not need to fail once for size/duration and then ask the model to repair it.
func applyCloudAgentResolvedMediaDefaults(req *CreateTaskRequest, plan *cloudAgentMediaPlan, task *model.Task) error {
	if req == nil || plan == nil || task == nil {
		return BadAuthRequest("媒体生成准入结果无效，未提交生成任务")
	}
	var input map[string]any
	if err := json.Unmarshal([]byte(task.InputJSON), &input); err != nil {
		return err
	}
	config, ok := input["config"].(map[string]any)
	if !ok {
		return BadAuthRequest("媒体生成未解析出模型配置，未提交生成任务")
	}

	plan.Args.Size = stringValue(config["size"])
	if plan.Args.Mode == "image" {
		plan.Args.Quality = stringValue(config["quality"])
	}
	if plan.Args.Mode == "video" {
		plan.Args.Quality = stringValue(config["vquality"])
		if raw := stringValue(config["videoSeconds"]); raw != "" {
			seconds, err := strconv.Atoi(raw)
			if err != nil || seconds < 0 {
				return BadAuthRequest("模型目录返回的默认视频时长无效，未提交生成任务")
			}
			plan.Args.Duration = seconds
		}
		if raw := stringValue(config["videoGenerateAudio"]); raw != "" {
			audio, err := strconv.ParseBool(raw)
			if err != nil {
				return BadAuthRequest("模型目录返回的默认音频参数无效，未提交生成任务")
			}
			plan.Args.VideoGenerateAudio = &audio
		}
	}
	plan.Args.Prepared = nil
	req.Input = input
	req.Prompt = stringValue(input["prompt"])
	return nil
}

func saveCloudAgentDocument(repo *repository.Repository, canvas *model.CanvasProject, doc map[string]any, policy RuntimePolicySetting) error {
	doc["updatedAt"] = time.Now().UTC().Format(time.RFC3339Nano)
	raw, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	if len(raw) > 8<<20 {
		return BadAuthRequest("画布大小超限")
	}
	usage, err := repo.UserStorageUsage(canvas.UserID)
	if err != nil {
		return err
	}
	if err = validateStructuredStorageQuotaWithPolicy(usage, "canvas", false, int64(len(raw)-len(canvas.PayloadJSON)), policy.Resource); err != nil {
		return err
	}
	before := canvas.PayloadJSON
	canvas.PayloadJSON = string(raw)
	return saveCreationCanvasWithHistory(repo, canvas, before)
}

// Called inside the same transaction as the task, charge reservation and Agent checkpoint.
func createCloudAgentMediaNode(repo *repository.Repository, userID, canvasID string, plan *cloudAgentMediaPlan, task *model.Task, policy RuntimePolicySetting, recorder ...cloudAgentMutationRecorder) error {
	a := plan.Args
	canvas, doc, refs, err := cloudAgentMediaDocument(repo, userID, canvasID, a, plan.TransientReferences)
	if err != nil {
		return err
	}
	beforeJSON := canvas.PayloadJSON
	beforeHash := cloudAgentCanvasHash(doc)
	descriptor, supported := cloudAgentNodeCapabilityForGenerationMode(a.Mode)
	if !supported || !cloudAgentGenerationModeSupported(a.Mode) {
		return BadAuthRequest("生成模式当前不受 Agent 支持")
	}
	nodes := creationMaps(doc["nodes"])
	// 媒体节点必须贴住引用源节点（真机 2026-09-21 用户实测「隔了八百里」）：媒体调用按语义把源节点
	// 放在 referenceNodeIds、sourceNodeId 留空，旧逻辑只认 SourceNodeID 取 y → 锚点永不命中，草稿落到
	// 默认 (80,80)；源节点在世界坐标 (-7740,15644) 时参考连线跨 1.5 万 px，画布被迫缩到 5%。
	// 这里与审批预览的落位同口径（锚点右侧 +96、与锚点顶部对齐、目标位被占时向下让位），
	// 保证「预览一处、落位一处」；只有完全没有引用对端时才回退包围盒右侧新列。
	peers := append(append([]string{}, a.ReferenceNodeIDs...), a.SourceNodeID)
	x, y := 0.0, 0.0
	width, height := cloudAgentNodeDefaultWidth(descriptor.Type), cloudAgentNodeDefaultHeight(descriptor.Type)
	if anchor, ok := cloudAgentPlacementAnchor(peers, cloudAgentPlacementNodes(nodes), nil); ok {
		x = anchor.x + anchor.width + 96.0
		y = anchor.y
	} else if viewX, viewY, ok := cloudAgentViewportAnchor(doc); ok {
		// 完全没有引用对端时落在用户当前视野内（真机 2026-09-22「Agent 的节点总在天边」），
		// 视野未知才回退包围盒右侧新列。
		x, y = viewX, viewY
	} else {
		x = cloudAgentNodesBounds(nodes).maxX + 120.0
		y = cloudAgentColumnStartY(nodes, x)
	}
	// 目标位被占则向下让位（与审批预览同口径）；被复用的草稿节点自身不参与判定，防回写下移。
	y = cloudAgentPlacementFreeSlot(nodes, a.NodeID, x, y, width, height)
	meta := map[string]any{"status": "idle", "agentDraftRunId": a.DraftRunID, "prompt": a.Prompt, "composerContent": a.Prompt, "referenceNodeIds": a.ReferenceNodeIDs}
	// 扩图任务封装语义（用户反馈 2026-09-19）：LLM 生成的扩图提示词只留 prompt 供重试/审计，
	// composerContent 置空避免结果节点 composer 直接展示内部提示词。
	// edit:"outpaint" 与手动扩图占位同契约，前端 hover composer 门控据此隐藏（此前写的
	// meta["outpaint"] 无任何前端消费方，门控从未命中 — review 2026-09-21 P2）。
	if a.Mode == "image" && strings.TrimSpace(a.OutpaintRatio) != "" {
		meta["composerContent"] = ""
		meta["edit"] = "outpaint"
		// 画幅写服务端解出的提交像素（草稿路径 task==nil 时 config 还没有 size，只有这里能写对）。
		if plan.OutpaintFrameW > 0 && plan.OutpaintFrameH > 0 {
			meta["size"] = fmt.Sprintf("%dx%d", plan.OutpaintFrameW, plan.OutpaintFrameH)
		}
	}
	if a.Size != "" && (a.Mode == "image" || a.Mode == "video") && meta["size"] == nil {
		meta["size"] = a.Size
	}
	if a.Mode == "video" {
		meta["videoSeconds"] = fmt.Sprint(a.Duration)
	}
	if a.Quality != "" {
		key := "quality"
		if a.Mode == "video" {
			key = "vquality"
		}
		meta[key] = a.Quality
	}
	if a.VideoGenerateAudio != nil {
		meta["videoGenerateAudio"] = fmt.Sprint(*a.VideoGenerateAudio)
	}
	var input struct {
		Config map[string]any `json:"config"`
	}
	if task != nil {
		if err := json.Unmarshal([]byte(task.InputJSON), &input); err != nil {
			return err
		}
	}
	spec, err := cloudAgentGenerationSpec(a, refs, input.Config)
	if err != nil {
		return err
	}
	meta, err = spec.NodeMetadata()
	if err != nil {
		return err
	}
	meta["status"], meta["agentDraftRunId"], meta["referenceNodeIds"] = "idle", a.DraftRunID, a.ReferenceNodeIDs
	// 上游 d328a257 新增：草稿节点写入 prompt/composerContent（媒体草稿内容基线）。
	meta["prompt"] = cloudAgentMediaComposerPrompt(a.Prompt, refs)
	meta["composerContent"] = meta["prompt"]
	// fork 增量（W4 融合修复，F 系列登记）：扩图画幅真值回填。spec.NodeMetadata() 整体覆盖 meta 后，
	// 扩图画幅需再回填；搬运 plan 已解析的 OutpaintFrameW/H（不在此重解析）；仅当 specs 未给出 size 时
	// 填充，直给 size 不覆盖。位置在 meta["composerContent"] 赋值之后，保证扩图语义覆盖草稿基线。
	if plan.OutpaintFrameW > 0 && plan.OutpaintFrameH > 0 {
		// 画面真值 + 扩图语义（size/edit/composerContent）与下方 pre-spec 写入同源；
		// 仅当 spec 未给出 size 时回填画幅，直给 size 不覆盖。
		if strings.TrimSpace(stringValue(meta["size"])) == "" {
			meta["size"] = fmt.Sprintf("%dx%d", plan.OutpaintFrameW, plan.OutpaintFrameH)
		}
		meta["composerContent"] = ""
		meta["edit"] = "outpaint"
	}
	if task != nil {
		meta["status"], meta["taskId"], meta["taskStatus"] = "loading", task.ID, "queued"
		delete(meta, "agentDraftRunId")
	}
	node := creationAddedNode(CreationCanvasOp{Type: "add_node", ID: a.NodeID, NodeType: descriptor.Type, Title: a.Title, X: &x, Y: &y, Metadata: meta})
	// 标准占位尺寸（2026-09-25 用户实测「Agent 创建的节点比手动链路小」）：9:16 曾硬编码
	// 360×640，比媒体标准盒小一圈；改为与 web 端 nodeSizeFromRatio 同口径换算。
	nodeWidth, nodeHeight := cloudAgentMediaDraftSize(descriptor.Type, a.Size)
	node["width"], node["height"] = nodeWidth, nodeHeight
	replaced := false
	for _, existing := range nodes {
		if stringValue(existing["id"]) == a.NodeID {
			existing["metadata"], existing["title"] = meta, a.Title
			// 落位纠正（真机 2026-09-22）：LLM 常先用 canvas_apply_ops 自己建草稿节点，那一批 ops 里
			// 没有连线操作 → 落位解析器找不到锚点 → 回退到包围盒右上角（离引用源可达上万像素）；媒体
			// 路径随后按同一 id 复用该节点，旧实现只改 metadata/标题、保留原位置，于是“手动扩图都紧贴
			// 源节点、Agent 的在天边”。只在**草稿阶段**（task==nil）重定位：那时节点刚由本轮生成，
			// 用户没机会挪它；结果回写（task!=nil）保留位置，否则会覆盖用户在审批期间手动摆好的位置
			// （契约见 agentMediaApprovalAllowsMovesButRejectsContentChanges 的 move 用例）。
			if task == nil {
				existing["position"] = map[string]any{"x": x, "y": y}
				// 尺寸同步（2026-09-25）：与新建路径同口径——ops 骨架默认 720×405，若不复用标准盒，
				// 结果回写按宽重算高会把 9:16 撑成 720×1290，与手动链路不一致。
				existing["width"], existing["height"] = nodeWidth, nodeHeight
			}
			replaced = true
			break
		}
	}
	if !replaced {
		nodes = append(nodes, node)
	}
	doc["nodes"] = nodes
	edges := cloudAgentMediaConnections(creationMaps(doc["connections"]), a)
	seen := map[string]bool{}
	for _, edge := range edges {
		if stringValue(edge["toNodeId"]) == a.NodeID {
			seen[stringValue(edge["fromNodeId"])] = true
		}
	}
	for _, id := range append(append([]string{}, a.ReferenceNodeIDs...), a.SourceNodeID) {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		edges = append(edges, map[string]any{"id": "agent-" + newID(), "fromNodeId": id, "toNodeId": a.NodeID})
	}
	// Reused drafts may already contain only a subset of the new references.
	// Reorder after adding missing edges so chip numbers match submitted arrays.
	doc["connections"] = cloudAgentMediaConnections(edges, a)
	if err := saveCloudAgentDocument(repo, canvas, doc, policy); err != nil {
		return err
	}
	if len(recorder) > 0 && recorder[0] != nil {
		stepID := plan.CallID
		if stepID == "" {
			stepID = a.NodeID
		}
		operation := "generate_media_draft"
		if task != nil {
			operation = "generate_media_submit"
		}
		preview := cloudAgentMediaApprovalPreview(plan, "")
		return recorder[0](repo, cloudAgentMutationInput{
			RunID:              a.DraftRunID,
			UserID:             userID,
			CanvasID:           canvasID,
			StepID:             stepID,
			Operation:          operation,
			BeforeSnapshotHash: beforeHash,
			AfterSnapshotHash:  cloudAgentCanvasHash(doc),
			BeforeJSON:         beforeJSON,
			HasSubmittedTask:   task != nil,
			Preview:            &preview,
		})
	}
	return nil
}

type cloudAgentMediaWritebackError struct {
	error
	reason string
}

func (e *cloudAgentMediaWritebackError) Unwrap() error { return e.error }

func completeCloudAgentMediaNode(repo *repository.Repository, userID, canvasID, targetNodeID string, task *model.Task, policy RuntimePolicySetting) (string, error) {
	if validateCloudAgentID(targetNodeID, "生成节点ID", 80) != nil {
		return "", &cloudAgentMediaWritebackError{error: creationConflict("任务缺少有效的目标节点记录，未回写画布"), reason: "target_node_unknown"}
	}
	canvas, err := repo.CanvasProjectForUser(userID, canvasID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", &cloudAgentMediaWritebackError{error: creationConflict("目标画布不存在或已不可访问，未回写任务状态"), reason: "canvas_unavailable"}
		}
		return "", err
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		return "", err
	}
	for _, node := range creationMaps(doc["nodes"]) {
		if stringValue(node["id"]) != targetNodeID {
			continue
		}
		meta, _ := node["metadata"].(map[string]any)
		if stringValue(meta["taskId"]) != task.ID {
			return "", &cloudAgentMediaWritebackError{error: creationConflict("目标节点的任务绑定已变化，未覆盖现有内容"), reason: "task_binding_changed"}
		}
		meta["taskStatus"] = string(task.Status)
		meta["status"] = "error"
		meta["errorDetails"] = cloudAgentSafeMediaTaskError(task)
		if task.Status == model.TaskStatusSucceeded {
			id, _ := taskOutputResource(task.ResultJSON, task.Type)
			resource, e := repo.ResourceForUser(userID, id)
			if e != nil || resource.Status != "ready" || !strings.HasPrefix(resource.MimeType, stringValue(node["type"])+"/") {
				meta["status"] = "error"
				meta["errorDetails"] = "生成结果没有可用的账号资源，未写入媒体地址"
				if saveErr := saveCloudAgentDocument(repo, canvas, doc, policy); saveErr != nil {
					return stringValue(node["id"]), saveErr
				}
				return stringValue(node["id"]), &cloudAgentMediaWritebackError{error: BadAuthRequest("生成结果没有可用的账号资源，未写入媒体地址"), reason: "result_resource_unavailable"}
			}
			meta["content"], meta["storageKey"], meta["status"] = resourceFileURL(id), "resource:"+id, "success"
			meta["naturalWidth"], meta["naturalHeight"] = resource.Width, resource.Height
			// 文件大小与手动链路（前端任务同步写入 metadata.bytes）保持同字段，供 HUD「大小」等事实面板消费。
			if resource.Size > 0 {
				meta["bytes"] = resource.Size
			}
			if resource.Width > 0 && resource.Height > 0 {
				if width, ok := node["width"].(float64); ok && width > 0 {
					node["height"] = width * float64(resource.Height) / float64(resource.Width)
				}
			}
			delete(meta, "errorDetails")
		}
		return stringValue(node["id"]), saveCloudAgentDocument(repo, canvas, doc, policy)
	}
	return "", &cloudAgentMediaWritebackError{error: creationConflict("目标生成节点不存在，未重建节点；任务记录仍保留在任务中心"), reason: "target_node_missing"}
}

// cloudAgentOutpaintModelCapability 返回扩图请求所选模型的能力 spec，供 prepare 阶段预检。
// 模型定位逻辑与 cloudAgentMediaModelName 一致；logical 路径直接带 spec，渠道路径从
// 脱敏 capabilityConfig map 反解。
func (s *Service) cloudAgentOutpaintModelCapability(a cloudAgentMediaArgs) (CapabilitySpec, error) {
	catalog, err := s.ModelCatalog(nil)
	if err != nil {
		return CapabilitySpec{}, err
	}
	for _, m := range catalog.Models {
		if a.LogicalModelID != "" && m.ID == a.LogicalModelID && m.Available && normalizeCapability(m.Capability) == normalizeCapability(a.Mode) {
			return m.CapabilitySpec, nil
		}
	}
	for _, channel := range catalog.Channels {
		if channel.ID != a.ChannelID {
			continue
		}
		for _, m := range channel.Models {
			if m.ModelKey == a.ChannelModelKey && m.Available && normalizeCapability(m.Capability) == normalizeCapability(a.Mode) {
				// 脱敏 map → 结构化配置 → spec：catalog 的 CapabilityConfig 是 normalized
				// 配置经 modelCapabilityConfigToMap 的产物，Marshal/Unmarshal 往返无损。
				raw, marshalErr := json.Marshal(m.CapabilityConfig)
				if marshalErr != nil {
					return CapabilitySpec{}, fmt.Errorf("解析渠道模型能力配置失败：%w", marshalErr)
				}
				var normalized ModelCapabilityConfig
				if unmarshalErr := json.Unmarshal(raw, &normalized); unmarshalErr != nil {
					return CapabilitySpec{}, fmt.Errorf("解析渠道模型能力配置失败：%w", unmarshalErr)
				}
				return CapabilitySpecFromModelCapabilityConfig(&normalized, normalizeCapability(m.Capability))
			}
		}
	}
	return CapabilitySpec{}, BadAuthRequest("模型目录已变化，请重新读取目录并询问用户选择模型")
}
