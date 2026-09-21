package repository

import (
	"fmt"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"infinite-canvas/backend/internal/model"
)

// 账本有界清理（review 2026-09-21 P3 零测试补锚）：只删终态、只删保护窗口之外的旧记录，
// applied 永不动（链式撤销依赖），其它画布不受影响。
func TestPruneCloudAgentCanvasMutationsKeepsNewestTerminalAndAllApplied(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:prune-canvas-%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.CloudAgentCanvasMutation{}); err != nil {
		t.Fatal(err)
	}
	repo := New(db)
	base := time.Now().UTC()
	for i := 0; i < 30; i++ {
		status := "undone"
		if i%2 == 1 {
			status = "not_undoable"
		}
		if err := repo.CreateCloudAgentCanvasMutation(&model.CloudAgentCanvasMutation{
			ID: fmt.Sprintf("term-%02d", i), CanvasID: "c1", UserID: "u", RunID: "r", Status: status,
			CreatedAt: base.Add(time.Duration(i) * time.Second),
		}); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 3; i++ {
		if err := repo.CreateCloudAgentCanvasMutation(&model.CloudAgentCanvasMutation{
			ID: fmt.Sprintf("app-%02d", i), CanvasID: "c1", UserID: "u", RunID: "r", Status: "applied",
			CreatedAt: base.Add(time.Duration(i) * time.Second),
		}); err != nil {
			t.Fatal(err)
		}
	}
	if err := repo.CreateCloudAgentCanvasMutation(&model.CloudAgentCanvasMutation{
		ID: "other-1", CanvasID: "c2", UserID: "u", RunID: "r", Status: "undone", CreatedAt: base,
	}); err != nil {
		t.Fatal(err)
	}

	count := func(query string, args ...any) int64 {
		var total int64
		db.Model(&model.CloudAgentCanvasMutation{}).Where(query, args...).Count(&total)
		return total
	}

	// keep=5 的保护窗口按 created_at DESC 取最新 5 条（此处即 term-29..25），
	// 其余终态（term-00..24）删除。
	if err := repo.PruneCloudAgentCanvasMutations("c1", 5); err != nil {
		t.Fatal(err)
	}
	terminal := []string{"undone", "not_undoable"}
	if got := count("canvas_id = ? AND status IN ?", "c1", terminal); got != 5 {
		t.Fatalf("保护窗口内应只剩最新 5 条终态记录，got %d", got)
	}
	if got := count("canvas_id = ? AND status = ?", "c1", "applied"); got != 3 {
		t.Fatalf("applied 记录必须全保留（链式撤销依赖），got %d", got)
	}
	for _, id := range []string{"term-25", "term-26", "term-27", "term-28", "term-29"} {
		if got := count("id = ?", id); got != 1 {
			t.Fatalf("保护窗口内最新终态记录 %s 不应被删", id)
		}
	}
	if got := count("id = ?", "term-24"); got != 0 {
		t.Fatalf("保护窗口外的旧终态记录 term-24 应被清理")
	}
	if got := count("canvas_id = ?", "c2"); got != 1 {
		t.Fatalf("其它画布不受清理影响，got %d", got)
	}

	// keep<=0 走默认 200：记录数不足时不删除任何东西。
	if err := repo.PruneCloudAgentCanvasMutations("c1", 0); err != nil {
		t.Fatal(err)
	}
	if got := count("canvas_id = ? AND status = ?", "c1", "applied"); got != 3 {
		t.Fatalf("默认 keep 不得误删：applied=%d", got)
	}
	if got := count("canvas_id = ? AND status IN ?", "c1", terminal); got != 5 {
		t.Fatalf("默认 keep 不得误删：terminal=%d", got)
	}
}
