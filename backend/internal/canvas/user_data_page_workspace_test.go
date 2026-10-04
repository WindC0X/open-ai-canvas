package canvas

import (
	"encoding/json"
	"testing"

	"infinite-canvas/backend/internal/model"
)

// W5 统一任务面（设计卡 §4.2 / 验收 7）：headless_task 容器不进画布列表顶层。
//
// ★ 这是**接线级**测试：前端 `filterVisibleCanvasProjects` 依赖 summary 里的
// `workspaceType`，若后端不透出该字段，过滤恒为 false ⇒ 功能静默失效。
// 纯函数测试（web/test/task-face-workspace-type.test.ts）测不到这一层。
func TestCanvasLibraryPageExposesWorkspaceType(t *testing.T) {
	svc := newCanvasHistoryTestService(t)
	actor := &model.User{ID: "owner"}

	// headless 容器：直线流程隐式创建
	headless := json.RawMessage(`{"id":"headless","revision":0,"title":"白底主图任务","workspaceType":"headless_task","nodes":[{"id":"n1","type":"image"}],"viewport":{"x":0,"y":0,"k":1}}`)
	if _, err := svc.UpsertUserCanvasProject(actor.ID, headless); err != nil {
		t.Fatal(err)
	}
	// 常规画布：无该字段（存量数据形态）
	standard := json.RawMessage(`{"id":"standard","revision":0,"title":"自由画布","nodes":[{"id":"n2","type":"image"}],"viewport":{"x":0,"y":0,"k":1}}`)
	if _, err := svc.UpsertUserCanvasProject(actor.ID, standard); err != nil {
		t.Fatal(err)
	}

	page, err := svc.UserCanvasProjectsPage(actor.ID, 1, 40, "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Projects) != 2 {
		t.Fatalf("projects = %d, want 2", len(page.Projects))
	}

	byID := map[string]CanvasLibrarySummary{}
	for _, project := range page.Projects {
		byID[project.ID] = project
	}
	if got := byID["headless"].WorkspaceType; got != "headless_task" {
		t.Fatalf("headless workspaceType = %q, want headless_task", got)
	}
	// ★ 存量画布（payload 无该字段）必须是空字符串 —— 前端据此判 standard（零迁移纪律）。
	if got := byID["standard"].WorkspaceType; got != "" {
		t.Fatalf("standard workspaceType = %q, want empty", got)
	}
}
