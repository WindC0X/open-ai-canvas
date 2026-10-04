package app

import (
	"sort"
	"strings"

	"infinite-canvas/backend/internal/assets"
)

// ResourceReferenceQuery 是资源引用的只读查询面（AST-08）。
//
// 背景：删除保护已经采集引用数据（resource_delete.go），但只用于「删除被拒时的提示文案」。
// 本方法把同一套引用扫描**只读地**暴露出来，用于：
//   - 删除前的主动预检（UI 可在用户点删除前显示「被 N 处引用」）
//   - 素材库的引用可见性（双向：资源 → 谁引用；素材 → 占用哪些资源）
//
// ★ 与删除路径的关系：本方法**不做任何写操作**，不进入删除事务，
// 不触发物理对象清理。它复用同一套 repository 扫描与 assets 引用解释器，
// 保证「查询结果」与「删除判定」不会漂移。
//
// ★ 权限：调用方必须已校验 userID 归属（service 层按 user_id 过滤）。
type ResourceReferenceQuery struct {
	// ResourceID 被查询的资源 ID。
	ResourceID string `json:"resourceId"`
	// References 引用该资源的业务对象（去重后按 kind+id 排序）。
	References []ResourceReferenceEntry `json:"references"`
	// Truncated 表示扫描结果被截断（超过上限），UI 应提示「还有更多」。
	Truncated bool `json:"truncated,omitempty"`
}

// ResourceReferenceEntry 是一条业务引用。
type ResourceReferenceEntry struct {
	// Kind 业务对象类型：素材 / 画布 / 任务 / 项目 / 风格 / 工具 / 创作会话 / 任务日志 / 任务结果 …
	Kind string `json:"kind"`
	// ID 业务对象 ID。
	ID string `json:"id"`
	// Title 可读标题（可能为空，UI 需回退到 ID）。
	Title string `json:"title,omitempty"`
	// Path 引用在文档中的 JSON 路径（仅文档类引用有值，如 "$.nodes[3].data.url"）。
	Path string `json:"path,omitempty"`
	// NodeID 画布节点 ID（仅画布类引用有值）。
	NodeID string `json:"nodeId,omitempty"`
	// ReferenceType 引用形态（value / 等，来自 assets 引用解释器）。
	ReferenceType string `json:"referenceType,omitempty"`
}

// maxResourceReferenceEntries 限制单次查询返回的引用条数，防止超大画布拖垮响应。
const maxResourceReferenceEntries = 200

// ResourceReferences 返回指定资源被哪些业务对象引用（只读，AST-08）。
//
// ★ 方向一（资源 → 引用者）：本方法。
// ★ 方向二（素材 → 占用资源）：AssetResourceOccupancy（见下）。
//
// 实现要点：
//  1. 先用 repository 的资源引用快照扫描全用户业务文档（与删除路径同源）；
//  2. 再用 assets 引用解释器逐文档定位到目标资源的具体引用点（含 path/nodeId）；
//  3. 去重（同 kind+id+path 只留一条）并按 kind+id 排序，保证输出稳定。
func (s *Service) ResourceReferences(userID string, resourceID string) (*ResourceReferenceQuery, error) {
	resourceID = strings.TrimSpace(resourceID)
	if strings.TrimSpace(userID) == "" || resourceID == "" {
		return nil, BadAuthRequest("查询资源引用需要有效的用户和资源 ID")
	}
	// 归属校验：非本人资源一律按不存在处理（不泄露存在性）。
	if _, err := s.repo.ResourceForUser(userID, resourceID); err != nil {
		return nil, NotFound("资源不存在或无权访问")
	}

	ownedIDs := map[string]struct{}{resourceID: {}}
	snapshot, err := s.repo.ResourceReferenceSnapshotExcludingAssets(userID, nil, []string{resourceID})
	if err != nil {
		return nil, err
	}

	entries := make([]ResourceReferenceEntry, 0, len(snapshot.Direct))
	for _, direct := range snapshot.Direct {
		if direct.ResourceID != resourceID {
			continue
		}
		entries = append(entries, ResourceReferenceEntry{Kind: direct.Kind, ID: direct.ID, Title: direct.Title})
	}
	for _, document := range snapshot.Documents {
		references, referenceErr := assets.CollectDocumentResourceReferences(document.PrimaryJSON)
		if referenceErr != nil {
			// 单个业务文档解析失败不阻断整体查询；该文档计入 unknown 由 UI 提示。
			continue
		}
		matched := matchDocumentReferences(references, ownedIDs)
		for _, reference := range matched {
			entries = append(entries, ResourceReferenceEntry{
				Kind: document.Kind, ID: document.ID, Title: document.Title,
				Path: reference.Path, NodeID: reference.NodeID, ReferenceType: reference.ReferenceType,
			})
		}
		if document.SecondaryJSON != "" {
			secondary, secondaryErr := assets.CollectDocumentResourceReferences(document.SecondaryJSON)
			if secondaryErr == nil {
				for _, reference := range matchDocumentReferences(secondary, ownedIDs) {
					entries = append(entries, ResourceReferenceEntry{
						Kind: document.Kind, ID: document.ID, Title: document.Title,
						Path: reference.Path, NodeID: reference.NodeID, ReferenceType: reference.ReferenceType,
					})
				}
			}
		}
	}

	result := dedupeResourceReferenceEntries(entries)
	query := &ResourceReferenceQuery{ResourceID: resourceID, References: result}
	if len(result) > maxResourceReferenceEntries {
		query.References = result[:maxResourceReferenceEntries]
		query.Truncated = true
	}
	return query, nil
}

// AssetResourceOccupancy 返回素材占用了哪些资源（方向二，只读）。
//
// 与方向一互补：方向一答「这个资源被谁引用」，本方法答「这个素材挂着哪些资源」。
// 删除前的预检通常两个方向都要看（既要知道素材占了什么，也要知道那些资源是否被别人共享）。
func (s *Service) AssetResourceOccupancy(userID string, assetID string) (*AssetResourceOccupancyResult, error) {
	assetID = strings.TrimSpace(assetID)
	if strings.TrimSpace(userID) == "" || assetID == "" {
		return nil, BadAuthRequest("查询素材占用需要有效的用户和素材 ID")
	}

	versions, representations, err := s.repo.AssetsResourceRecords([]string{assetID})
	if err != nil {
		return nil, err
	}

	resourceIDs := map[string]struct{}{}
	for _, version := range versions {
		if err := collectOwnedAssetDocumentReferences(version.DefinitionJSON, resourceIDs); err != nil {
			return nil, BadAuthRequest("素材版本数据无法解析，已停止查询以避免误报")
		}
	}
	for _, representation := range representations {
		if resourceID := validCanvasResourceID(representation.ResourceID); resourceID != "" {
			resourceIDs[resourceID] = struct{}{}
		}
		if err := collectOwnedAssetDocumentReferences(representation.MetadataJSON, resourceIDs); err != nil {
			return nil, BadAuthRequest("素材表现数据无法解析，已停止查询以避免误报")
		}
	}

	// 素材本体（payload）也计入。
	assets, err := s.repo.AssetsForUserIDs(userID, []string{assetID})
	if err != nil {
		return nil, err
	}
	if len(assets) != 1 {
		return nil, NotFound("素材不存在或无权访问")
	}
	if err := collectOwnedAssetDocumentReferences(assets[0].PayloadJSON, resourceIDs); err != nil {
		return nil, BadAuthRequest("素材数据无法解析，已停止查询以避免误报")
	}

	ids := sortedReferenceIDs(resourceIDs)
	resources, err := s.repo.ResourcesForUserIDs(userID, ids)
	if err != nil {
		return nil, err
	}
	owned := make([]string, 0, len(resources))
	for _, resource := range resources {
		owned = append(owned, resource.ID)
	}
	return &AssetResourceOccupancyResult{AssetID: assetID, ResourceIDs: owned}, nil
}

// AssetResourceOccupancyResult 是素材占用资源的查询结果。
type AssetResourceOccupancyResult struct {
	AssetID string `json:"assetId"`
	// ResourceIDs 该素材引用且属于当前用户的资源 ID（已排序）。
	ResourceIDs []string `json:"resourceIds"`
}

// matchDocumentReferences 从文档引用明细中筛出目标资源，并做路径级去重。
func matchDocumentReferences(references []assets.DocumentResourceReference, resourceIDs map[string]struct{}) []assets.DocumentResourceReference {
	matched := make([]assets.DocumentResourceReference, 0, len(references))
	seen := make(map[string]struct{}, len(references))
	for _, reference := range references {
		if _, ok := resourceIDs[reference.ResourceID]; !ok {
			continue
		}
		key := reference.Path + "\x00" + reference.NodeID
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		matched = append(matched, reference)
	}
	return matched
}

// dedupeResourceReferenceEntries 按 kind+id+path+nodeId 去重并按 kind+id+path 排序。
func dedupeResourceReferenceEntries(entries []ResourceReferenceEntry) []ResourceReferenceEntry {
	seen := make(map[string]struct{}, len(entries))
	result := make([]ResourceReferenceEntry, 0, len(entries))
	for _, entry := range entries {
		key := strings.Join([]string{entry.Kind, entry.ID, entry.Path, entry.NodeID}, "\x00")
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, entry)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Kind != result[j].Kind {
			return result[i].Kind < result[j].Kind
		}
		if result[i].ID != result[j].ID {
			return result[i].ID < result[j].ID
		}
		return result[i].Path < result[j].Path
	})
	return result
}
