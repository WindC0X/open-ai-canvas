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
