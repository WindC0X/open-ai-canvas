package app

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"infinite-canvas/backend/internal/canvas/capability"
	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"
)

// cloudAgentApprovalPreview is server-authored explanatory data. It never
// grants capabilities: execution still validates the original call, snapshot,
// ownership, node registry, locks and budget after approval.
type cloudAgentApprovalPreview struct {
	Kind        string                          `json:"kind"`
	Title       string                          `json:"title"`
	Description string                          `json:"description"`
	Items       []cloudAgentApprovalPreviewItem `json:"items"`
}

type cloudAgentApprovalPreviewItem struct {
	Operation       string   `json:"operation"`
	NodeID          string   `json:"nodeId,omitempty"`
	NodeTitle       string   `json:"nodeTitle,omitempty"`
	ResultTitle     string   `json:"resultTitle,omitempty"`
	NodeType        string   `json:"nodeType,omitempty"`
	NodeTypeLabel   string   `json:"nodeTypeLabel,omitempty"`
	TargetNodeID    string   `json:"targetNodeId,omitempty"`
	TargetNodeTitle string   `json:"targetNodeTitle,omitempty"`
	TargetNodeType  string   `json:"targetNodeType,omitempty"`
	Fields          []string `json:"fields,omitempty"`
	Details         []string `json:"details,omitempty"`
	Summary         string   `json:"summary"`
}

type cloudAgentCanvasMutationPlan struct {
	Args               agentCanvasArgs
	Canvas             *model.CanvasProject
	Document           map[string]any
	BeforeJSON         string
	BeforeSnapshotHash string
	Preview            cloudAgentApprovalPreview
}

// prepareCloudAgentCanvasMutation is the single dry-run and execution planner.
// Approval previews and the eventual write therefore share the exact same
// parser, snapshot check and capability validation instead of drifting apart.
func prepareCloudAgentCanvasMutation(repo *repository.Repository, userID, canvasID string, call cloudAgentCall) (*cloudAgentCanvasMutationPlan, error) {
	var args agentCanvasArgs
	if err := decodeCloudAgentJSONObject(call.Function.Arguments, &args); err != nil {
		return nil, canvasArgumentError()
	}
	if len(args.Ops) < 1 || len(args.Ops) > 20 || args.SnapshotHash == "" {
		return nil, BadAuthRequest("画布操作数量或快照无效")
	}
	canvas, err := repo.CanvasProjectForUser(userID, canvasID)
	if err != nil {
		return nil, err
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		return nil, err
	}
	// 账本口径(完整含 position)与模型可见口径(内容, 剔 position)分离: 用户拖动节点不改内容语义,
	// 不应使 Agent 写入失效; 撤销链(A5)仍用完整口径, 用户拖动会阻断撤销保护其改动。
	beforeHash := cloudAgentCanvasHash(doc)
	if cloudAgentContentHash(doc) != args.SnapshotHash {
		return nil, creationConflict("画布内容已变化，本次未写入；请重新读取并重新申请审批")
	}
	items, err := applyCloudAgentCanvasPlan(doc, args.Ops)
	if err != nil {
		return nil, err
	}
	return &cloudAgentCanvasMutationPlan{
		Args:               args,
		Canvas:             canvas,
		Document:           doc,
		BeforeJSON:         canvas.PayloadJSON,
		BeforeSnapshotHash: beforeHash,
		Preview:            cloudAgentCanvasApprovalPreview(items),
	}, nil
}

func applyCloudAgentCanvasPlan(doc map[string]any, ops []agentCanvasOp) ([]cloudAgentApprovalPreviewItem, error) {
	nodes := creationMaps(doc["nodes"])
	edges := creationMaps(doc["connections"])
	// Agent 新增节点由服务端统一落位(2026-09-19 用户实测: 模型自报 x/y 落在画布原点角落且不带尺寸语义)。
	// 位置是排版决策不是内容决策: 与其让模型猜坐标, 不如按现有画布包围盒放到右侧空列, 逐个向下排。
	// 只改写 ops 的 X/Y, preview 与执行共用 creationAddedNode, 两处天然一致; 模型显式 position 语义不再保留。
	bounds := cloudAgentNodesBounds(nodes)
	nextX := bounds.maxX + 120.0
	// 起始 y 取目标列（新列 x 范围内）已有节点的 max(bottom)，而不是全局 minY（review 2026-09-21 P3：
	// 目标列附近已有更早放置的节点时，从全局 minY 起会与新节点列横向重叠）。
	// 无同列节点时回退全局 minY（与原行为一致）。
	nextY := cloudAgentColumnStartY(nodes, nextX)
	for i := range ops {
		if ops[i].Type != "add_node" {
			continue
		}
		ops[i].X, ops[i].Y = nextX, nextY
		// 步长=该类型默认高度+100 间距(2026-09-19 review P1): 文本节点默认高度已 384,
		// 固定 340 步长会让多节点纵向压叠 44px。未知类型回退 384。
		nextY += cloudAgentNodeDefaultHeight(string(ops[i].NodeType)) + 100.0
	}
	items := make([]cloudAgentApprovalPreviewItem, 0, len(ops))
	for _, op := range ops {
		title, content := "", ""
		if op.Title != nil {
			title = *op.Title
		}
		if op.Content != nil {
			content = *op.Content
		}
		if err := validateCloudAgentID(op.ID, "节点或连线 ID", 80); err != nil {
			return nil, err
		}
		if op.Type == "add_node" && (utf8.RuneCountInString(content) > 16000 || utf8.RuneCountInString(title) > 240) {
			return nil, BadAuthRequest("节点标题或正文超出限制")
		}
		index := cloudAgentNodeIndex(nodes, op.ID)
		switch op.Type {
		case "add_node":
			if index >= 0 {
				return nil, BadAuthRequest("新增节点ID重复")
			}
			capability, ok := cloudAgentNodeCapabilityForType(op.NodeType)
			if strings.TrimSpace(op.NodeType) == "" {
				return nil, BadAuthRequest("新增节点缺少 nodeType")
			}
			if !ok {
				return nil, BadAuthRequest("不支持的节点类型")
			}
			node := creationAddedNode(CreationCanvasOp{Type: op.Type, ID: op.ID, NodeType: op.NodeType, Title: title, X: &op.X, Y: &op.Y, Metadata: capability.Metadata(content)})
			nodes = append(nodes, node)
			nodeTitle := cloudAgentApprovalNodeTitle(node, capability.Label)
			items = append(items, cloudAgentApprovalPreviewItem{
				Operation: "add_node", NodeID: op.ID, NodeTitle: nodeTitle,
				NodeType: capability.Type, NodeTypeLabel: capability.Label,
				Summary: fmt.Sprintf("新增%s《%s》", capability.Label, nodeTitle),
			})
		case "connect_nodes":
			if err := validateCloudAgentID(op.FromNodeID, "来源节点 ID", 80); err != nil {
				return nil, err
			}
			if err := validateCloudAgentID(op.ToNodeID, "目标节点 ID", 80); err != nil {
				return nil, err
			}
			fromIndex, toIndex := cloudAgentNodeIndex(nodes, op.FromNodeID), cloudAgentNodeIndex(nodes, op.ToNodeID)
			if fromIndex < 0 || toIndex < 0 || op.FromNodeID == op.ToNodeID {
				return nil, BadAuthRequest("连线端点不存在或指向自身")
			}
			if err := validateCloudAgentConnection(nodes, op.FromNodeID, op.ToNodeID, edges); err != nil {
				return nil, err
			}
			for _, edge := range edges {
				if stringValue(edge["id"]) == op.ID || (stringValue(edge["fromNodeId"]) == op.FromNodeID && stringValue(edge["toNodeId"]) == op.ToNodeID) {
					return nil, BadAuthRequest("连线重复")
				}
			}
			fromCapability, _ := cloudAgentNodeCapabilityForType(stringValue(nodes[fromIndex]["type"]))
			toCapability, _ := cloudAgentNodeCapabilityForType(stringValue(nodes[toIndex]["type"]))
			fromTitle := cloudAgentApprovalNodeTitle(nodes[fromIndex], fromCapability.Label)
			toTitle := cloudAgentApprovalNodeTitle(nodes[toIndex], toCapability.Label)
			edges = append(edges, map[string]any{"id": op.ID, "fromNodeId": op.FromNodeID, "toNodeId": op.ToNodeID})
			items = append(items, cloudAgentApprovalPreviewItem{
				Operation: "connect_nodes", NodeID: op.FromNodeID, NodeTitle: fromTitle,
				NodeType: fromCapability.Type, NodeTypeLabel: fromCapability.Label,
				TargetNodeID: op.ToNodeID, TargetNodeTitle: toTitle, TargetNodeType: toCapability.Type,
				Summary: fmt.Sprintf("建立《%s》→《%s》的引用连线", fromTitle, toTitle),
			})
		case "update_node":
			if len(op.Patch) == 0 {
				return nil, BadAuthRequest("更新节点必须提供 patch")
			}
			if index < 0 {
				return nil, BadAuthRequest("只能更新现有且受 Agent 支持的节点")
			}
			capability, ok := cloudAgentNodeCapabilityForType(stringValue(nodes[index]["type"]))
			if !ok || !capability.CanUpdate {
				return nil, BadAuthRequest("该节点类型不支持 Agent 更新")
			}
			metadata, _ := nodes[index]["metadata"].(map[string]any)
			if metadata["locked"] == true {
				return nil, BadAuthRequest("不能修改锁定节点")
			}
			beforeTitle := cloudAgentApprovalNodeTitle(nodes[index], capability.Label)
			fields := cloudAgentApprovalPatchLabels(capability.PatchFields, op.Patch)
			if err := capability.ApplyPatch(nodes[index], op.Patch); err != nil {
				return nil, BadAuthRequest(err.Error())
			}
			afterTitle := cloudAgentApprovalNodeTitle(nodes[index], capability.Label)
			resultTitle := ""
			if afterTitle != beforeTitle {
				resultTitle = afterTitle
			}
			items = append(items, cloudAgentApprovalPreviewItem{
				Operation: "update_node", NodeID: op.ID, NodeTitle: beforeTitle, ResultTitle: resultTitle,
				NodeType: capability.Type, NodeTypeLabel: capability.Label, Fields: fields,
				Summary: fmt.Sprintf("修改%s《%s》的%s", capability.Label, beforeTitle, strings.Join(fields, "、")),
			})
		default:
			return nil, BadAuthRequest("不支持的画布写操作")
		}
	}
	doc["nodes"] = nodes
	doc["connections"] = edges
	return items, nil
}

func cloudAgentCanvasApprovalPreview(items []cloudAgentApprovalPreviewItem) cloudAgentApprovalPreview {
	counts := map[string]int{}
	for _, item := range items {
		counts[item.Operation]++
	}
	parts := make([]string, 0, 3)
	if counts["add_node"] > 0 {
		parts = append(parts, fmt.Sprintf("新增 %d 个节点", counts["add_node"]))
	}
	if counts["update_node"] > 0 {
		parts = append(parts, fmt.Sprintf("修改 %d 个节点", counts["update_node"]))
	}
	if counts["connect_nodes"] > 0 {
		parts = append(parts, fmt.Sprintf("建立 %d 条引用连线", counts["connect_nodes"]))
	}
	return cloudAgentApprovalPreview{
		Kind: "canvas_mutation", Title: "确认画布修改",
		Description: fmt.Sprintf("Agent 准备%s。请确认目标节点和修改字段；批准后才会写入画布。", strings.Join(parts, "，")),
		Items:       items,
	}
}

func cloudAgentMediaApprovalPreview(plan *cloudAgentMediaPlan, modelName string) cloudAgentApprovalPreview {
	args := plan.Args
	descriptor, _ := cloudAgentNodeCapabilityForGenerationMode(args.Mode)
	nodeTitle := truncateRunes(strings.TrimSpace(args.Title), 120)
	if nodeTitle == "" {
		nodeTitle = "未命名" + descriptor.Label
	}
	details := make([]string, 0, 6)
	if modelName != "" {
		details = append(details, "模型："+truncateRunes(modelName, 120))
	}
	if len(args.ReferenceNodeIDs) > 0 {
		details = append(details, fmt.Sprintf("引用 %d 个画布资产并建立连线", len(args.ReferenceNodeIDs)))
	} else {
		details = append(details, "不引用画布媒体资产")
	}
	if args.Duration > 0 {
		details = append(details, fmt.Sprintf("时长：%d 秒", args.Duration))
	}
	// 扩图时 size 会被服务端按 ratio 计算的 pad 像素覆盖（执行链 cfg["size"] = 目标画幅），
	// 预览不能再展示一个不会生效的 args.Size（review 2026-09-21 P3）。
	if args.Size != "" && strings.TrimSpace(args.OutpaintRatio) == "" {
		details = append(details, "画幅："+truncateRunes(args.Size, 40))
	}
	if args.Quality != "" {
		details = append(details, "质量："+truncateRunes(args.Quality, 40))
	}
	if strings.TrimSpace(args.OutpaintRatio) != "" {
		details = append(details, "扩图目标画幅："+truncateRunes(args.OutpaintRatio, 40))
	}
	if args.VideoGenerateAudio != nil {
		value := "关闭"
		if *args.VideoGenerateAudio {
			value = "开启"
		}
		details = append(details, "音频："+value)
	}
	return cloudAgentApprovalPreview{
		Kind: "media_generation", Title: "确认生成" + descriptor.Label,
		Description: descriptor.Label + "草稿节点和引用连线已创建，尚未提交生成。确认规格后批准才会提交收费任务；拒绝则保留草稿，结果自动回写画布。",
		Items: []cloudAgentApprovalPreviewItem{{
			Operation: "generate_media", NodeID: args.NodeID, NodeTitle: nodeTitle,
			NodeType: descriptor.Type, NodeTypeLabel: descriptor.Label, Details: details,
			Summary: "生成" + descriptor.Label + "《" + nodeTitle + "》",
		}},
	}
}

func cloudAgentApprovalPatchLabels(fields map[string]capability.PatchField, patch map[string]any) []string {
	keys := make([]string, 0, len(patch))
	for key := range patch {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		left, right := fields[keys[i]], fields[keys[j]]
		if left.Order != right.Order {
			return left.Order < right.Order
		}
		return keys[i] < keys[j]
	})
	labels := make([]string, 0, len(keys))
	for _, key := range keys {
		if field, ok := fields[key]; ok {
			labels = append(labels, field.Label)
		}
	}
	return labels
}

func cloudAgentNodeIndex(nodes []map[string]any, id string) int {
	for index, node := range nodes {
		if stringValue(node["id"]) == id {
			return index
		}
	}
	return -1
}

func cloudAgentApprovalNodeTitle(node map[string]any, typeLabel string) string {
	title := truncateRunes(strings.TrimSpace(stringValue(node["title"])), 120)
	if title != "" {
		return title
	}
	return "未命名" + typeLabel
}

func cloudAgentApprovalCallHash(call cloudAgentCall) string {
	raw, _ := json.Marshal(call)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

// cloudAgentNodesBounds 计算节点集合的包围盒; 空画布回退到原点附近的第一落位。
type cloudAgentBounds struct{ minX, minY, maxX float64 }

func cloudAgentNodesBounds(nodes []map[string]any) cloudAgentBounds {
	result := cloudAgentBounds{minX: 0, minY: 0, maxX: 0}
	first := true
	for _, node := range nodes {
		pos, _ := node["position"].(map[string]any)
		x, _ := pos["x"].(float64)
		y, _ := pos["y"].(float64)
		width, _ := node["width"].(float64)
		if width <= 0 {
			width = 384
		}
		if first {
			result.minX, result.minY, result.maxX = x, y, x+width
			first = false
			continue
		}
		if x < result.minX {
			result.minX = x
		}
		if y < result.minY {
			result.minY = y
		}
		if x+width > result.maxX {
			result.maxX = x + width
		}
	}
	return result
}

// cloudAgentNodeDefaultHeight 返回节点类型的默认高度(落位步长用), 未知/未注册类型回退 384。
func cloudAgentNodeDefaultHeight(nodeType string) float64 {
	if d, ok := capability.BuiltinRegistry().Resolve(nodeType); ok && d.DefaultHeight > 0 {
		return d.DefaultHeight
	}
	return 384.0
}

// cloudAgentColumnStartY 计算新列（x = nextX）放置节点的起始 y：取与目标列水平重叠
// （或 120px 内邻列）的存量节点的 max(y+height)，避免 Agent 新节点列压住目标列已有节点
// （review 2026-09-21 P3）；无同列节点时回退全局最小 y（与原行为一致）。
func cloudAgentColumnStartY(nodes []map[string]any, nextX float64) float64 {
	columnStart, columnFound := 0.0, false
	globalMinY, anyFound := 0.0, false
	for _, node := range nodes {
		pos, _ := node["position"].(map[string]any)
		x, _ := pos["x"].(float64)
		y, _ := pos["y"].(float64)
		width, _ := node["width"].(float64)
		height, _ := node["height"].(float64)
		if width <= 0 {
			width = 384
		}
		if height <= 0 {
			height = 384
		}
		if !anyFound || y < globalMinY {
			globalMinY = y
		}
		anyFound = true
		// 与目标列无水平重叠（含 120px 邻列缓冲区）→ 不参与列内底部计算。
		if x+width+120 <= nextX || x >= nextX+384+120 {
			continue
		}
		if bottom := y + height; !columnFound || bottom > columnStart {
			columnStart = bottom
			columnFound = true
		}
	}
	if columnFound {
		return columnStart
	}
	if anyFound {
		return globalMinY
	}
	return 0
}
