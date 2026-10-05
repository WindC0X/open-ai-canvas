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
	// Unreadable 是无法解析因而**未能参与扫描**的业务文档数。
	// ★ 非零时引用列表是**不完整**的：UI 必须提示「有 N 处记录无法读取」而不是
	// 显示「无引用」。删除面遇到不可解析文档直接拒删（resource_delete.go），
	// 查询面若静默跳过就会给出「可以删」的错误结论 —— 两个面的结论必须同源。
	Unreadable int `json:"unreadable,omitempty"`
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
	// SelfReference 表示该引用来自**拥有本资源的素材自身**（C-2）。
	// 删除该素材时资源会一并删除，故它不构成删除障碍；UI 不应把它
	// 显示成「被占用」而与删除结果相矛盾。
	SelfReference bool `json:"selfReference,omitempty"`
}

// maxResourceReferenceEntries 限制单次查询返回的引用条数，防止超大画布拖垮响应。
const maxResourceReferenceEntries = 200

// owningAssetIDsForResource 返回「拥有该资源的素材 ID 集合」——
// 即哪些素材的 representation.ResourceID 或素材文档引用指向了该资源。
//
// ★ C-2 共享判定（查询面与删除面同源）：删除面用 `excludingAssetIDs` 排除被删素材，
// 使「素材自引用」不构成删除障碍；查询面若不知道宿主是谁，就会把自引用当成
// 「被别人占用」报告给用户，出现「预检说不能删、实际能删」的矛盾。
// 两面共用本函数，保证同一资源在两面得到同一结论。
//
// ★ 返回值含**两类标识**：素材 ID（Asset.ID）与表现 ID（AssetRepresentation.ID）——
// 因为快照的 Direct 里「素材」类引用的 ID 是 representation.ID（见
// ResourceReferenceSnapshotExcludingAssets），而删除面的排除集是 Asset.ID。
// 两者都收进同一集合，调用方按 kind+id 直接查即可。
func (s *Service) owningAssetIDsForResource(userID string, resourceID string) (map[string]struct{}, error) {
	owners := map[string]struct{}{}
	// 注意：AssetsForUserIDs 对空 id 列表返回 nil（不返回全部），
	// 故用 Assets(userID) 取该用户全部素材。
	assets, err := s.repo.Assets(userID)
	if err != nil {
		return nil, err
	}
	if len(assets) == 0 {
		return owners, nil
	}
	assetIDs := make([]string, 0, len(assets))
	for _, asset := range assets {
		assetIDs = append(assetIDs, asset.ID)
	}
	versions, representations, err := s.repo.AssetsResourceRecords(assetIDs)
	if err != nil {
		return nil, err
	}
	versionOwner := make(map[string]string, len(versions))
	for _, version := range versions {
		versionOwner[version.ID] = version.AssetID
	}
	for _, representation := range representations {
		if validCanvasResourceID(representation.ResourceID) != resourceID {
			continue
		}
		if owner := versionOwner[representation.AssetVersionID]; owner != "" {
			owners[owner] = struct{}{}
		}
		// Direct 里的「素材」引用用 representation.ID 作标识，一并收录。
		owners[representation.ID] = struct{}{}
	}
	return owners, nil
}

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

	// ★ C-2：先算出哪些素材是「宿主」（其 representation.ResourceID 指向本资源），
	// 删除这些素材时资源会一并删除 ⇒ 它们的引用不构成删除障碍，
	// 查询面必须标为 selfReference，否则会出现「预检说被引用、实际能删」的矛盾。
	owners, err := s.owningAssetIDsForResource(userID, resourceID)
	if err != nil {
		return nil, err
	}
	isSelfReference := func(kind string, id string) bool {
		if kind != "素材" {
			return false
		}
		_, owner := owners[id]
		return owner
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
		entries = append(entries, ResourceReferenceEntry{Kind: direct.Kind, ID: direct.ID, Title: direct.Title, SelfReference: isSelfReference(direct.Kind, direct.ID)})
	}
	// 解析失败计数（C-5）：删除面对不可解析文档直接拒删，查询面若静默跳过
	// 就会给出「无引用、可以删」的错误结论 —— 必须显式暴露为 unreadable。
	unreadable := 0
	for _, document := range snapshot.Documents {
		// ★ C-3：已结束任务的日志/结果只是生成历史，不构成占用（与删除面同源，
		// 见 resource_reference_rules.go）。不跳过就会报出「被任务日志引用」而实际能删。
		if finishedTaskReferenceIsHistorical(resourceReferenceDocument{Kind: document.Kind, Status: document.TaskStatus}) {
			continue
		}
		references, referenceErr := assets.CollectDocumentResourceReferencesWithFallback(document.PrimaryJSON)
		if referenceErr != nil {
			unreadable++
			continue
		}
		matched := matchDocumentReferences(references, ownedIDs)
		for _, reference := range matched {
			entries = append(entries, ResourceReferenceEntry{
				Kind: document.Kind, ID: document.ID, Title: document.Title,
				Path: reference.Path, NodeID: reference.NodeID, ReferenceType: reference.ReferenceType,
				SelfReference: isSelfReference(document.Kind, document.ID),
			})
		}
		// ★ C-3：已结束任务的 ResultJSON 同样是历史记录（删除面会清空它）。
		if document.SecondaryJSON != "" && !finishedTaskResultIsHistorical(resourceReferenceDocument{Kind: document.Kind, Status: document.TaskStatus}) {
			secondary, secondaryErr := assets.CollectDocumentResourceReferencesWithFallback(document.SecondaryJSON)
			if secondaryErr != nil {
				unreadable++
			} else {
				for _, reference := range matchDocumentReferences(secondary, ownedIDs) {
					entries = append(entries, ResourceReferenceEntry{
						Kind: document.Kind, ID: document.ID, Title: document.Title,
						Path: reference.Path, NodeID: reference.NodeID, ReferenceType: reference.ReferenceType,
						SelfReference: isSelfReference(document.Kind, document.ID),
					})
				}
			}
		}
	}

	result := dedupeResourceReferenceEntries(entries)
	query := &ResourceReferenceQuery{ResourceID: resourceID, References: result, Unreadable: unreadable}
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

	// ★ 归属校验必须**先于**任何记录读取（C-1）：
	// AssetsResourceRecords 只按 asset_id 查（无 user 过滤），若先读再校验，
	// 他人素材的版本/表现数据会被读入并解析；解析失败时返回 BadAuthRequest
	// 「素材版本数据无法解析」而 NotFound 则永不触发 —— 错误码差异泄露了
	// 「该 ID 存在且损坏」这一非本人信息。先校验后读，非本人一律 NotFound。
	assets, err := s.repo.AssetsForUserIDs(userID, []string{assetID})
	if err != nil {
		return nil, err
	}
	if len(assets) != 1 {
		return nil, NotFound("素材不存在或无权访问")
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

	// 素材本体（payload）也计入（归属已在上方校验）。
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
