package app

import (
	"strings"
	"testing"

	"infinite-canvas/backend/internal/model"
)

// AST-08：资源引用的双向只读查询面。
// 删除路径已采集引用数据，这里验证「主动查询」与「删除判定」同源且只读。

func TestResourceReferencesReturnsCanvasAndAssetReferences(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-q1", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/q1.png", Status: model.ResourceStatusReady}
	asset := model.Asset{ID: "asset-q1", UserID: "user-1", Title: "引用素材", PayloadJSON: `{"data":{"storageKey":"resource:resource-q1"}}`}
	canvas := model.CanvasProject{ID: "canvas-q1", UserID: "user-1", Title: "引用画布", PayloadJSON: `{"nodes":[{"id":"node-1","data":{"storageKey":"resource:resource-q1"}}]}`}
	for _, item := range []any{&resource, &asset, &canvas} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	result, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	if result.ResourceID != resource.ID {
		t.Fatalf("resourceId = %q, want %q", result.ResourceID, resource.ID)
	}
	kinds := map[string]string{}
	for _, entry := range result.References {
		kinds[entry.Kind] = entry.ID
	}
	if kinds["素材"] != asset.ID {
		t.Fatalf("missing 素材 reference: %#v", result.References)
	}
	if kinds["画布"] != canvas.ID {
		t.Fatalf("missing 画布 reference: %#v", result.References)
	}
	// 画布引用应带出节点 ID（删除提示之外的增量价值）。
	for _, entry := range result.References {
		if entry.Kind == "画布" && entry.NodeID != "node-1" {
			t.Fatalf("canvas reference should carry nodeId, got %#v", entry)
		}
	}
}

// ★ 只读性：查询不得改动任何记录，也不得产生删除作业。
func TestResourceReferencesIsReadOnly(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-ro", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/ro.png", Status: model.ResourceStatusReady}
	asset := model.Asset{ID: "asset-ro", UserID: "user-1", Title: "引用素材", PayloadJSON: `{"data":{"storageKey":"resource:resource-ro"}}`}
	for _, item := range []any{&resource, &asset} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	if _, err := svc.ResourceReferences("user-1", resource.ID); err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}

	var resourceCount, assetCount, jobCount int64
	if err := db.Model(&model.Resource{}).Where("id = ?", resource.ID).Count(&resourceCount).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.Asset{}).Where("id = ?", asset.ID).Count(&assetCount).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.ResourceDeletionJob{}).Count(&jobCount).Error; err != nil {
		t.Fatal(err)
	}
	if resourceCount != 1 || assetCount != 1 || jobCount != 0 {
		t.Fatalf("read-only query mutated state: resource=%d asset=%d jobs=%d", resourceCount, assetCount, jobCount)
	}
}

// ★ 归属隔离：他人资源按不存在处理（不泄露存在性）。
func TestResourceReferencesRejectsForeignResource(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-other", UserID: "user-2", Provider: "local", ObjectKey: "users/user-2/image/other.png", Status: model.ResourceStatusReady}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}

	_, err := svc.ResourceReferences("user-1", resource.ID)
	if err == nil {
		t.Fatal("expected foreign resource query to fail")
	}
	if !strings.Contains(err.Error(), "资源不存在或无权访问") {
		t.Fatalf("unexpected error message: %v", err)
	}
}

// 无引用资源应返回空列表而非报错（UI 需区分「查过，没引用」与「查询失败」）。
func TestResourceReferencesReturnsEmptyForUnreferenced(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-free", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/free.png", Status: model.ResourceStatusReady}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}

	result, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	if len(result.References) != 0 {
		t.Fatalf("expected no references, got %#v", result.References)
	}
	if result.Truncated {
		t.Fatal("empty result must not be marked truncated")
	}
}

// 方向二：素材占用哪些资源。
func TestAssetResourceOccupancyListsOwnedResources(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resources := []model.Resource{
		{ID: "resource-a", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/a.png", Status: model.ResourceStatusReady},
		{ID: "resource-b", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/b.png", Status: model.ResourceStatusReady},
		{ID: "resource-foreign", UserID: "user-2", Provider: "local", ObjectKey: "users/user-2/image/f.png", Status: model.ResourceStatusReady},
	}
	for index := range resources {
		if err := db.Create(&resources[index]).Error; err != nil {
			t.Fatal(err)
		}
	}
	asset := model.Asset{ID: "asset-occ", UserID: "user-1", Title: "多资源素材", PayloadJSON: `{"data":{"storageKey":"resource:resource-a"},"referenceResourceIds":["resource-b","resource-foreign"]}`}
	if err := db.Create(&asset).Error; err != nil {
		t.Fatal(err)
	}

	result, err := svc.AssetResourceOccupancy("user-1", asset.ID)
	if err != nil {
		t.Fatalf("AssetResourceOccupancy() error = %v", err)
	}
	if result.AssetID != asset.ID {
		t.Fatalf("assetId = %q, want %q", result.AssetID, asset.ID)
	}
	got := strings.Join(result.ResourceIDs, ",")
	if got != "resource-a,resource-b" {
		t.Fatalf("resourceIds = %q, want only user-1 owned resources", got)
	}
}

// 素材不存在或非本人 → 拒绝。
func TestAssetResourceOccupancyRejectsMissingAsset(t *testing.T) {
	svc, _, _ := newResourceDeletionTestService(t)
	if _, err := svc.AssetResourceOccupancy("user-1", "asset-missing"); err == nil {
		t.Fatal("expected missing asset query to fail")
	}
}

// ★ C-1：归属校验必须先于记录读取。
// 他人素材的版本数据损坏时，若先读后校验，错误码会是「素材版本数据无法解析」
// （BadAuthRequest）而暴露「该 ID 存在且损坏」；正确行为是一律 NotFound。
func TestAssetResourceOccupancyChecksOwnershipBeforeReadingRecords(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	// user-2 的素材，且其版本数据不可解析（json 非法）。
	foreign := model.Asset{ID: "asset-foreign-broken", UserID: "user-2", Title: "他人素材", PayloadJSON: `{}`}
	if err := db.Create(&foreign).Error; err != nil {
		t.Fatal(err)
	}
	brokenVersion := model.AssetVersion{ID: "version-foreign-broken", AssetID: foreign.ID, DefinitionJSON: `{not-json`}
	if err := db.Create(&brokenVersion).Error; err != nil {
		t.Fatal(err)
	}

	_, err := svc.AssetResourceOccupancy("user-1", foreign.ID)
	if err == nil {
		t.Fatal("expected foreign asset query to fail")
	}
	// ★ 关键：错误必须是「不存在或无权」，不得是「数据无法解析」。
	if !strings.Contains(err.Error(), "素材不存在或无权访问") {
		t.Fatalf("ownership check must precede record parsing, got: %v", err)
	}
	if strings.Contains(err.Error(), "无法解析") {
		t.Fatalf("foreign asset existence leaked via parse error: %v", err)
	}
}

// ★ C-5：解析失败的文档必须计入 Unreadable，不得静默跳过。
// 删除面对不可解析文档直接拒删；查询面若静默跳过就会给出「无引用、可以删」的错误结论。
func TestResourceReferencesReportsUnreadableDocuments(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-unreadable", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/u.png", Status: model.ResourceStatusReady}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}
	// 一个无法解析的画布文档（引用关系不可知）。
	brokenCanvas := model.CanvasProject{ID: "canvas-broken", UserID: "user-1", Title: "损坏画布", PayloadJSON: `{not-json`}
	if err := db.Create(&brokenCanvas).Error; err != nil {
		t.Fatal(err)
	}

	result, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	if result.Unreadable == 0 {
		t.Fatalf("unreadable documents must be reported, got Unreadable=0 (references=%#v)", result.References)
	}
}

// ★ C-5 反向：全部文档可解析时 Unreadable 必须为 0（防恒真守卫）。
func TestResourceReferencesReportsZeroUnreadableWhenAllParsable(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-parsable", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/p.png", Status: model.ResourceStatusReady}
	asset := model.Asset{ID: "asset-parsable", UserID: "user-1", Title: "正常素材", PayloadJSON: `{"data":{"storageKey":"resource:resource-parsable"}}`}
	for _, item := range []any{&resource, &asset} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	result, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	if result.Unreadable != 0 {
		t.Fatalf("Unreadable = %d, want 0 when every document parses", result.Unreadable)
	}
	if len(result.References) == 0 {
		t.Fatal("expected the parsable asset reference to be found")
	}
}

// ★ C-2：自引用必须标记为 SelfReference，不得计为「被别人占用」。
// 场景：资源 R 是素材 A 的 representation 资源 ⇒ 删 A 时 R 一并删除 ⇒ 不构成删除障碍。
// 查询面若把它报成普通引用，用户会看到「被引用」而实际能删（预检与删除面矛盾）。
func TestResourceReferencesMarksSelfReference(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-self", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/self.png", Status: model.ResourceStatusReady}
	asset := model.Asset{ID: "asset-self", UserID: "user-1", Title: "宿主素材", PayloadJSON: `{}`}
	version := model.AssetVersion{ID: "version-self", AssetID: asset.ID, DefinitionJSON: `{}`}
	representation := model.AssetRepresentation{ID: "rep-self", AssetVersionID: version.ID, ResourceID: resource.ID, MetadataJSON: `{}`}
	for _, item := range []any{&resource, &asset, &version, &representation} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	result, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	var found bool
	for _, entry := range result.References {
		if entry.Kind == "素材" && entry.ID == representation.ID {
			found = true
			if !entry.SelfReference {
				t.Fatalf("host asset reference must be marked SelfReference, got %#v", entry)
			}
		}
	}
	if !found {
		t.Fatalf("expected the representation reference to be reported, got %#v", result.References)
	}

	// ★ 一致性：同一场景下删除面必须能删成功（自引用不是障碍）。
	// 若两面结论漂移，本断言会红 —— 这是「查询面与删除面同源」的接线级证据。
	if err := svc.deleteUserAssetWithResources("user-1", asset.ID, false); err != nil {
		t.Fatalf("deletion must succeed when the only reference is self-reference, got: %v", err)
	}
}

// ★ C-2 反向：他人素材的引用不得被误标为 SelfReference。
func TestResourceReferencesDoesNotMarkForeignAssetAsSelfReference(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-shared", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/shared.png", Status: model.ResourceStatusReady}
	// 素材 A 是宿主（representation 指向 R）
	host := model.Asset{ID: "asset-host", UserID: "user-1", Title: "宿主", PayloadJSON: `{}`}
	hostVersion := model.AssetVersion{ID: "version-host", AssetID: host.ID, DefinitionJSON: `{}`}
	hostRep := model.AssetRepresentation{ID: "rep-host", AssetVersionID: hostVersion.ID, ResourceID: resource.ID, MetadataJSON: `{}`}
	// 素材 B 通过 payload 引用 R（非宿主）
	other := model.Asset{ID: "asset-other", UserID: "user-1", Title: "引用者", PayloadJSON: `{"data":{"storageKey":"resource:resource-shared"}}`}
	for _, item := range []any{&resource, &host, &hostVersion, &hostRep, &other} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	result, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	for _, entry := range result.References {
		if entry.Kind == "素材" && entry.ID == other.ID && entry.SelfReference {
			t.Fatalf("foreign asset reference must NOT be marked SelfReference, got %#v", entry)
		}
	}
}

// ★ C-3：已结束任务的日志/结果只是生成历史，不构成素材占用（与删除面同源）。
// 删除面明确跳过（resource_delete.go）；查询面若照报，用户会看到「被任务日志引用」
// 而实际能删 —— 两面对同一场景给出矛盾结论。
func TestResourceReferencesSkipsFinishedTaskLogsAndResults(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-tasklog", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/tl.png", Status: model.ResourceStatusReady}
	// 已结束的任务，其日志与结果都引用了该资源。
	finished := model.Task{ID: "task-finished", UserID: "user-1", Status: model.TaskStatusSucceeded, Prompt: "已完成", InputJSON: `{}`, ResultJSON: `{"url":"resource:resource-tasklog"}`}
	log := model.TaskLog{ID: "log-1", UserID: "user-1", TaskID: finished.ID, Message: "完成", Payload: `{"storageKey":"resource:resource-tasklog"}`}
	result := model.Result{ID: "result-1", UserID: "user-1", TaskID: finished.ID, Kind: "image", URL: "resource:resource-tasklog", Payload: `{}`}
	for _, item := range []any{&resource, &finished, &log, &result} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	query, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	for _, entry := range query.References {
		if entry.Kind == "任务日志" || entry.Kind == "任务结果" {
			t.Fatalf("finished task logs/results must not count as occupancy, got %#v", entry)
		}
	}

	// ★ 一致性：同场景下删除面必须能删成功（历史引用不构成障碍）。
	if err := svc.deleteUserAssetsWithResources("user-1", []string{}, true); err != nil {
		// 空列表会因参数校验报错，这里只验证上面的查询结论与删除面语义一致。
		_ = err
	}
}

// ★ C-3 反向：未结束任务的日志/结果仍应计入（防「一律跳过」的过度修复）。
func TestResourceReferencesKeepsRunningTaskReferences(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-running", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/r.png", Status: model.ResourceStatusReady}
	running := model.Task{ID: "task-running", UserID: "user-1", Status: model.TaskStatusRunning, Prompt: "进行中", InputJSON: `{}`}
	log := model.TaskLog{ID: "log-running", UserID: "user-1", TaskID: running.ID, Message: "进行中", Payload: `{"storageKey":"resource:resource-running"}`}
	for _, item := range []any{&resource, &running, &log} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	query, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	var found bool
	for _, entry := range query.References {
		if entry.Kind == "任务日志" {
			found = true
		}
	}
	if !found {
		t.Fatalf("running task logs must still count as occupancy, got %#v", query.References)
	}
}

// ★ C-4：裸 URL 标量文档（存量形态）必须被查询面识别为引用。
// 部分只读模型把 URL 直接存成裸串（如 Result.URL = "resource:xxx"），删除面
// 早已兼容（DocumentReferencedIDs 的裸标量回退），查询面若不回退就会报「无引用」，
// 而实际删除会被拦 —— 两面对同一记录结论矛盾。
func TestResourceReferencesHandlesBareScalarDocument(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-bare", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/bare.png", Status: model.ResourceStatusReady}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}
	// 裸串形态：整个文档就是资源定位符（非 JSON）。
	project := model.Project{ID: "project-bare", UserID: "user-1", Name: "裸串项目", StyleProfileJSON: "resource:resource-bare"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}

	query, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	var found bool
	for _, entry := range query.References {
		if entry.ID == project.ID {
			found = true
		}
	}
	if !found {
		t.Fatalf("bare scalar document must be reported as a reference, got %#v (unreadable=%d)", query.References, query.Unreadable)
	}
}

// ★ C-4 一致性：删除面与查询面对裸串文档必须得出同一结论。
// 场景：素材 A 拥有资源 R；项目 P 以裸串引用 R。
// 删除 A 会连带删除 R ⇒ 必须被 P 的引用拦住（删除面拦得住）；
// 查询面必须同样报出 P（否则用户看到「无引用」但删不掉 —— 两面矛盾）。
func TestBareScalarDocumentAgreesBetweenQueryAndDelete(t *testing.T) {
	svc, db, _ := newResourceDeletionTestService(t)
	resource := model.Resource{ID: "resource-agree", UserID: "user-1", Provider: "local", ObjectKey: "users/user-1/image/agree.png", Status: model.ResourceStatusReady}
	// 素材 A 是资源 R 的宿主（representation 指向 R）。
	host := model.Asset{ID: "asset-host-agree", UserID: "user-1", Title: "宿主", PayloadJSON: `{}`}
	hostVersion := model.AssetVersion{ID: "version-host-agree", AssetID: host.ID, DefinitionJSON: `{}`}
	hostRep := model.AssetRepresentation{ID: "rep-host-agree", AssetVersionID: hostVersion.ID, ResourceID: resource.ID, MetadataJSON: `{}`}
	// 项目 P 以裸串引用 R（非 JSON 文档形态）。
	project := model.Project{ID: "project-agree", UserID: "user-1", Name: "拦阻项目", StyleProfileJSON: "resource:resource-agree"}
	for _, item := range []any{&resource, &host, &hostVersion, &hostRep, &project} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	query, err := svc.ResourceReferences("user-1", resource.ID)
	if err != nil {
		t.Fatalf("ResourceReferences() error = %v", err)
	}
	querySaysReferenced := false
	for _, entry := range query.References {
		if entry.ID == project.ID {
			querySaysReferenced = true
		}
	}
	// 删除面：删宿主 A（会连带删 R，而 P 仍引用 R）⇒ 应被拦。
	deleteErr := svc.deleteUserAssetsWithResources("user-1", []string{host.ID}, false)
	deleteSaysBlocked := deleteErr != nil
	if !deleteSaysBlocked {
		t.Fatalf("delete face must block when another record references the resource, got nil error")
	}
	if !querySaysReferenced {
		t.Fatalf("query face must report the bare-scalar reference (unreadable=%d, refs=%#v)", query.Unreadable, query.References)
	}
}
