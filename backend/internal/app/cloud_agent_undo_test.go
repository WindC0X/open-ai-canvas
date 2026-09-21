package app

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"
)

func TestUndoCloudAgentCanvasRestoresLatestMutationAndIsIdempotent(t *testing.T) {
	s, db, _, _ := creationTestService(t)
	canvas := model.CanvasProject{ID: "agent-canvas", UserID: "user", PayloadJSON: `{"nodes":[]}`}
	if err := db.Create(&canvas).Error; err != nil {
		t.Fatal(err)
	}
	run, err := s.CreateCloudAgentRun("user", agentTestRequest(), "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CloudAgentRun("user", run.ID); err != nil {
		t.Fatal(err)
	}
	execution, err := s.repo.CloudAgent("user", run.ID)
	if err != nil {
		t.Fatal(err)
	}
	policy, err := s.RuntimePolicy()
	if err != nil {
		t.Fatal(err)
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		t.Fatal(err)
	}
	beforeHash := cloudAgentCanvasHash(doc)
	call := cloudAgentCall{ID: "canvas-call-1"}
	args, _ := json.Marshal(map[string]any{
		"snapshotHash": beforeHash,
		"ops":          []map[string]any{{"type": "add_node", "id": "note-1", "nodeType": "text", "title": "临时节点", "content": "待撤销", "x": 10, "y": 20}},
	})
	call.Function.Arguments = string(args)
	if err := s.repo.MutateCloudAgent("user", run.ID, execution.Revision, func(current *model.CloudAgentExecution, repo *repository.Repository) error {
		_, err := applyCloudAgentCanvas(repo, "user", "agent-canvas", call, policy, cloudAgentMutationRecorderForRun(run.ID))
		return err
	}); err != nil {
		t.Fatal(err)
	}
	mutated, _ := s.repo.CanvasProjectForUser("user", "agent-canvas")
	mutatedDoc, _ := creationDocument(mutated.PayloadJSON)
	afterHash := cloudAgentCanvasHash(mutatedDoc)
	if afterHash == beforeHash {
		t.Fatal("canvas mutation did not change snapshot")
	}
	// 运行中不可撤销（service 守卫），按真实流程先置终态：
	if _, err := s.UndoCloudAgentCanvas("user", run.ID, call.ID, afterHash, "运行中撤销"); err == nil {
		t.Fatal("undo must be rejected while run is still running")
	}
	finalizeRunForUndo(t, s, run.ID)
	result, err := s.UndoCloudAgentCanvas("user", run.ID, call.ID, afterHash, "用户撤销")
	if err != nil {
		t.Fatal(err)
	}
	if result["accepted"] != true || result["snapshotHash"] != beforeHash {
		t.Fatalf("unexpected undo result: %+v", result)
	}
	restored, _ := s.repo.CanvasProjectForUser("user", "agent-canvas")
	// 恢复粒度（review 2026-09-21 P1）：内容语义回到 before，哈希排除的字段（updatedAt/
	// viewport/chatSessions 等）保留 current 值。重建期望文档对比，而不是逐字节等于原始串。
	expectedDoc, _ := creationDocument(canvas.PayloadJSON)
	restoreExcludedCanvasFields(expectedDoc, mutatedDoc)
	expectedJSON, _ := json.Marshal(expectedDoc)
	restoredDoc, _ := creationDocument(restored.PayloadJSON)
	assertJSONEqual(t, string(expectedJSON), restoredDoc, "undo restored payload mismatch")
	// 内容键必须严格回到 before：nodes 与原始快照一致。
	beforeNodes, _ := json.Marshal(expectedDoc["nodes"])
	restoredNodes, _ := json.Marshal(restoredDoc["nodes"])
	if string(beforeNodes) != string(restoredNodes) {
		t.Fatal("undo did not restore the exact before content snapshot")
	}
	// 链式语义(review P2-4, PRD A3): applied-only 查询下单 mutation 撤销后, 重复请求
	// 命中"无可撤销的画布变更", 不再返回 accepted 幂等成功。
	result, err = s.UndoCloudAgentCanvas("user", run.ID, call.ID, beforeHash, "重复请求")
	if err == nil {
		t.Fatalf("repeat undo should be rejected under chain semantics: result=%+v", result)
	}
	mutation, err := s.repo.LatestCloudAgentCanvasMutationAllStatuses("user", run.ID)
	if err != nil || mutation.Status != "undone" {
		t.Fatalf("mutation was not marked undone: %+v %v", mutation, err)
	}
}

func TestUndoCloudAgentCanvasRejectsChangedCanvasAndSubmittedTask(t *testing.T) {
	s, db, _, _ := creationTestService(t)
	canvas := model.CanvasProject{ID: "agent-canvas", UserID: "user", PayloadJSON: `{"nodes":[]}`}
	if err := db.Create(&canvas).Error; err != nil {
		t.Fatal(err)
	}
	run, err := s.CreateCloudAgentRun("user", agentTestRequest(), "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CloudAgentRun("user", run.ID); err != nil {
		t.Fatal(err)
	}
	execution, err := s.repo.CloudAgent("user", run.ID)
	if err != nil {
		t.Fatal(err)
	}
	policy, err := s.RuntimePolicy()
	if err != nil {
		t.Fatal(err)
	}
	doc, _ := creationDocument(canvas.PayloadJSON)
	beforeHash := cloudAgentCanvasHash(doc)
	call := cloudAgentCall{ID: "canvas-call-2"}
	args, _ := json.Marshal(map[string]any{"snapshotHash": beforeHash, "ops": []map[string]any{{"type": "add_node", "id": "note-2", "nodeType": "text", "title": "节点", "content": "内容"}}})
	call.Function.Arguments = string(args)
	if err := s.repo.MutateCloudAgent("user", run.ID, execution.Revision, func(current *model.CloudAgentExecution, repo *repository.Repository) error {
		_, err := applyCloudAgentCanvas(repo, "user", "agent-canvas", call, policy, cloudAgentMutationRecorderForRun(run.ID))
		return err
	}); err != nil {
		t.Fatal(err)
	}
	changed, _ := s.repo.CanvasProjectForUser("user", "agent-canvas")
	changedDoc, _ := creationDocument(changed.PayloadJSON)
	afterHash := cloudAgentCanvasHash(changedDoc)
	// A user edit after the Agent mutation must make the compare-and-restore fail.
	changed.PayloadJSON = `{"nodes":[{"id":"user-node","type":"text","title":"用户编辑","metadata":{"content":"后来修改"}}]}`
	if err := s.repo.CompareSaveCreationCanvas(changed, changed.PayloadJSON); err == nil {
		t.Fatal("test setup unexpectedly saved with the new value as previous snapshot")
	}
	latest, _ := s.repo.CanvasProjectForUser("user", "agent-canvas")
	previous := latest.PayloadJSON
	latest.PayloadJSON = `{"nodes":[{"id":"user-node","type":"text","title":"用户编辑","metadata":{"content":"后来修改"}}]}`
	if err := s.repo.CompareSaveCreationCanvas(latest, previous); err != nil {
		t.Fatal(err)
	}
	_, err = s.UndoCloudAgentCanvas("user", run.ID, call.ID, afterHash, "冲突")
	var appErr *AppError
	if !errors.As(err, &appErr) || appErr.Status != 409 {
		t.Fatalf("changed canvas should return conflict, got %v", err)
	}
}

func TestUndoCanvasPreviewReflectsMutationState(t *testing.T) {
	s, db, _, _ := creationTestService(t)
	canvas := model.CanvasProject{ID: "agent-canvas", UserID: "user", PayloadJSON: `{"nodes":[]}`}
	if err := db.Create(&canvas).Error; err != nil {
		t.Fatal(err)
	}
	run, err := s.CreateCloudAgentRun("user", agentTestRequest(), "")
	if err != nil {
		t.Fatal(err)
	}
	execution, err := s.repo.CloudAgent("user", run.ID)
	if err != nil {
		t.Fatal(err)
	}
	// 无任何画布变更: found=false 且不可撤销:
	empty, err := s.UndoCanvasPreview("user", run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if empty["found"] != false || empty["canUndo"] != false {
		t.Fatalf("empty preview should be not-found and not undoable: %+v", empty)
	}
	policy, err := s.RuntimePolicy()
	if err != nil {
		t.Fatal(err)
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		t.Fatal(err)
	}
	beforeHash := cloudAgentCanvasHash(doc)
	call := cloudAgentCall{ID: "canvas-call-preview"}
	args, _ := json.Marshal(map[string]any{
		"snapshotHash": beforeHash,
		"ops":          []map[string]any{{"type": "add_node", "id": "note-p", "nodeType": "text", "title": "预检", "content": "x", "x": 1, "y": 2}},
	})
	call.Function.Arguments = string(args)
	if err := s.repo.MutateCloudAgent("user", run.ID, execution.Revision, func(current *model.CloudAgentExecution, repo *repository.Repository) error {
		_, err := applyCloudAgentCanvas(repo, "user", "agent-canvas", call, policy, cloudAgentMutationRecorderForRun(run.ID))
		return err
	}); err != nil {
		t.Fatal(err)
	}
	// 运行中预检与执行同守卫（canUndo=false），置终态后才可撤销：
	runningPreview, previewErr := s.UndoCanvasPreview("user", run.ID)
	if previewErr != nil {
		t.Fatal(previewErr)
	}
	if runningPreview["canUndo"] != false {
		t.Fatalf("preview must not offer undo while run is running: %+v", runningPreview)
	}
	// 运行中必须如实回报「有可撤销内容」（2026-09-21 用户实测：运行中面板整条撤销消失，
	// 用户以为没有撤销功能）。found 仅作 UI 提示，授权仍由 undo 主流程把守。
	if runningPreview["found"] != true || !strings.Contains(stringValue(runningPreview["blockReason"]), "运行中") {
		t.Fatalf("running preview should report found + block reason: %+v", runningPreview)
	}
	finalizeRunForUndo(t, s, run.ID)
	preview, err := s.UndoCanvasPreview("user", run.ID)
	if err != nil {
		t.Fatal(err)
	}
	if preview["found"] != true || preview["canUndo"] != true {
		t.Fatalf("fresh mutation should be undoable: %+v", preview)
	}
	if preview["stepId"] != call.ID || preview["status"] != "applied" {
		t.Fatalf("preview metadata mismatch: %+v", preview)
	}
	if hash, _ := preview["currentSnapshotHash"].(string); len(hash) != 64 {
		t.Fatalf("currentSnapshotHash should be a 64-hex hash: %+v", preview)
	}
	// revision 不应被只读预检递增(基准取写操作 applyCloudAgentCanvas 之后的值):
	beforePreview, _ := s.repo.CloudAgent("user", run.ID)
	_, _ = s.UndoCanvasPreview("user", run.ID)
	_, _ = s.UndoCanvasPreview("user", run.ID)
	after, _ := s.repo.CloudAgent("user", run.ID)
	if after.Revision != beforePreview.Revision {
		t.Fatalf("preview must not mutate run revision: %d -> %d", beforePreview.Revision, after.Revision)
	}
	// 撤销后: canUndo=false + blockReason 提示已撤销:
	mutated, _ := s.repo.CanvasProjectForUser("user", "agent-canvas")
	mutatedDoc, _ := creationDocument(mutated.PayloadJSON)
	if _, err := s.UndoCloudAgentCanvas("user", run.ID, call.ID, cloudAgentCanvasHash(mutatedDoc), "test"); err != nil {
		t.Fatal(err)
	}
	// 链式语义: 撤销后 applied-only 预检找不到 mutation → found=false(无下一条可撤销)。
	undone, undisErr := s.UndoCanvasPreview("user", run.ID)
	if undisErr != nil {
		t.Fatal(undisErr)
	}
	if undone["canUndo"] != false || undone["found"] != false {
		t.Fatalf("after undo, preview should report no undoable mutation: %+v", undone)
	}
}

// finalizeRunForUndo 把 run 置为终态：撤销语义只对已结束的 run 开放（service 守卫），
// 测试按真实流程走（UI 也仅在终态展示撤销条）。
func finalizeRunForUndo(t *testing.T, s *Service, runID string) {
	t.Helper()
	execution, err := s.repo.CloudAgent("user", runID)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.repo.MutateCloudAgent("user", runID, execution.Revision, func(current *model.CloudAgentExecution, repo *repository.Repository) error {
		current.Status = "completed"
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

// assertJSONEqual 递归比较两个 JSON 值（map/slice 的 Go 表示不同来源可能类型不同）。
func assertJSONEqual(t *testing.T, expected string, actual any, message string) {
	t.Helper()
	var expectedValue any
	if err := json.Unmarshal([]byte(expected), &expectedValue); err != nil {
		t.Fatal(err)
	}
	expectedNorm, _ := json.Marshal(expectedValue)
	actualNorm, _ := json.Marshal(actual)
	if string(expectedNorm) != string(actualNorm) {
		t.Fatalf("%s\nexpected: %s\nactual:   %s", message, expectedNorm, actualNorm)
	}
}

// 任务守卫（review 2026-09-21 P2 零测试补锚 / P3 fail-closed）：撤销将删除的节点若绑定
// 运行中/排队中的生成任务必须阻断；终态任务与「任务不存在」（历史节点/已清理）放过。
func TestUndoBlockedByRunningTaskGuard(t *testing.T) {
	s, db, _, _ := creationTestService(t)
	for _, task := range []model.Task{
		{ID: "task-running", UserID: "user", Status: model.TaskStatusRunning},
		{ID: "task-queued", UserID: "user", Status: model.TaskStatusQueued},
		{ID: "task-done", UserID: "user", Status: model.TaskStatusSucceeded},
	} {
		if err := db.Create(&task).Error; err != nil {
			t.Fatal(err)
		}
	}
	nodeWithTask := func(id, taskID string) map[string]any {
		return map[string]any{"id": id, "type": "image", "metadata": map[string]any{"taskId": taskID}}
	}
	before := map[string]any{"nodes": []any{}}

	blocked, err := s.cloudAgentUndoBlockedByRunningTask("user", before, map[string]any{"nodes": []any{nodeWithTask("n-running", "task-running")}})
	if err != nil || blocked == "" {
		t.Fatalf("运行中任务绑定的待删节点必须阻断撤销: blocked=%q err=%v", blocked, err)
	}
	blocked, err = s.cloudAgentUndoBlockedByRunningTask("user", before, map[string]any{"nodes": []any{nodeWithTask("n-queued", "task-queued")}})
	if err != nil || blocked == "" {
		t.Fatalf("排队中任务绑定的待删节点必须阻断撤销: blocked=%q err=%v", blocked, err)
	}
	if blocked, err = s.cloudAgentUndoBlockedByRunningTask("user", before, map[string]any{"nodes": []any{nodeWithTask("n-done", "task-done")}}); err != nil || blocked != "" {
		t.Fatalf("终态任务不应阻断: blocked=%q err=%v", blocked, err)
	}
	if blocked, err = s.cloudAgentUndoBlockedByRunningTask("user", before, map[string]any{"nodes": []any{nodeWithTask("n-ghost", "task-missing")}}); err != nil || blocked != "" {
		t.Fatalf("任务不存在（历史节点/已清理）应放过: blocked=%q err=%v", blocked, err)
	}
	// before 已有的节点不会被撤销删除，不参与守卫。
	existing := map[string]any{"nodes": []any{nodeWithTask("n-running", "task-running")}}
	if blocked, err = s.cloudAgentUndoBlockedByRunningTask("user", existing, existing); err != nil || blocked != "" {
		t.Fatalf("撤销不删除的节点不应阻断: blocked=%q err=%v", blocked, err)
	}
}
