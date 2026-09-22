package app

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func stringPtr(value string) *string { return &value }

func TestCloudAgentCanvasApprovalPreviewDescribesUpdateTargetAndFields(t *testing.T) {
	doc, err := creationDocument(`{"nodes":[{"id":"video-1","type":"video","title":"满月庆祝视频草稿","metadata":{"content":"已提交结果","prompt":"private prompt","status":"succeeded"}}],"connections":[]}`)
	if err != nil {
		t.Fatal(err)
	}
	newTitle := "满月庆祝视频草稿（舒缓呼吸感）"
	newPrompt := "private next prompt"
	items, err := applyCloudAgentCanvasPlan(doc, []agentCanvasOp{{
		Type: "update_node", ID: "video-1", Patch: map[string]any{"title": newTitle, "content": newPrompt},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one preview item, got %d", len(items))
	}
	item := items[0]
	if item.NodeTitle != "满月庆祝视频草稿" || item.NodeType != "video" || item.NodeTypeLabel != "视频" {
		t.Fatalf("preview lost target identity: %+v", item)
	}
	if item.ResultTitle != newTitle || strings.Join(item.Fields, "、") != "节点名称、下一版提示词" {
		t.Fatalf("preview lost changed fields: %+v", item)
	}
	raw, _ := json.Marshal(item)
	if strings.Contains(string(raw), "private") {
		t.Fatalf("preview exposed private content or internal id: %s", raw)
	}
	metadata := doc["nodes"].([]map[string]any)[0]["metadata"].(map[string]any)
	if metadata["content"] != "已提交结果" || metadata["prompt"] != "private prompt" || metadata["composerContent"] != newPrompt {
		t.Fatalf("preview mutated media result incorrectly: %+v", metadata)
	}
}

func TestCloudAgentCanvasApprovalPreviewDescribesConnectionsAndMixedOperations(t *testing.T) {
	doc, err := creationDocument(`{"nodes":[{"id":"image-1","type":"image","title":"参考图"},{"id":"video-1","type":"video","title":"视频镜头"}],"connections":[]}`)
	if err != nil {
		t.Fatal(err)
	}
	items, err := applyCloudAgentCanvasPlan(doc, []agentCanvasOp{
		{Type: "add_node", ID: "text-1", NodeType: "text", Title: stringPtr("镜头备注"), Content: stringPtr("private body")},
		{Type: "update_node", ID: "video-1", Patch: map[string]any{"title": "视频镜头新版"}},
		{Type: "connect_nodes", ID: "edge-1", FromNodeID: "image-1", ToNodeID: "video-1"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 3 {
		t.Fatalf("expected mixed preview items, got %d", len(items))
	}
	if !strings.Contains(items[0].Summary, "新增文本") || !strings.Contains(items[1].Summary, "节点名称") {
		t.Fatalf("mixed preview summaries are incomplete: %+v", items)
	}
	if !strings.Contains(items[2].Summary, "参考图") || !strings.Contains(items[2].Summary, "视频镜头") {
		t.Fatalf("connection preview omitted endpoints: %+v", items[2])
	}
	preview := cloudAgentCanvasApprovalPreview(items)
	if !strings.Contains(preview.Description, "新增 1 个节点") || !strings.Contains(preview.Description, "修改 1 个节点") || !strings.Contains(preview.Description, "建立 1 条引用连线") {
		t.Fatalf("preview description omitted operation counts: %s", preview.Description)
	}
}

func TestCloudAgentCanvasApprovalPreviewRejectsUnknownTargetInsteadOfFallingBack(t *testing.T) {
	doc, err := creationDocument(`{"nodes":[],"connections":[]}`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = applyCloudAgentCanvasPlan(doc, []agentCanvasOp{{
		Type: "update_node", ID: "missing", Patch: map[string]any{"title": "不能静默写入"},
	}})
	if err == nil || !strings.Contains(err.Error(), "只能更新现有") {
		t.Fatalf("unknown target was not rejected: %v", err)
	}
}

// 扩图预览必须展示真正生效的画幅：审批卡选了像素档 → 显示该像素（服务端按它 pad 合成）；
// 未选像素档 → 显示 outpaintRatio 推导的目标画幅（不能展示不生效的 args.Size）。
func TestCloudAgentMediaApprovalPreviewOutpaintFrame(t *testing.T) {
	base := cloudAgentMediaArgs{Mode: "image", Prompt: "extend", Title: "扩图结果 16:9", OutpaintRatio: "16:9"}
	text := strings.Join(cloudAgentMediaApprovalPreview(&cloudAgentMediaPlan{Args: base}, "gpt-image-2").Items[0].Details, " | ")
	if !strings.Contains(text, "扩图目标画幅：16:9") || strings.Contains(text, "扩图画幅：") {
		t.Fatalf("未选像素档时应展示 ratio 推导的扩图目标画幅：%s", text)
	}
	pixel := base
	pixel.Size = "1024x1024"
	text = strings.Join(cloudAgentMediaApprovalPreview(&cloudAgentMediaPlan{Args: pixel}, "gpt-image-2").Items[0].Details, " | ")
	if !strings.Contains(text, "扩图画幅：1024x1024") {
		t.Fatalf("选定像素档时应展示该像素为提交画幅：%s", text)
	}
	if strings.Contains(text, "16:9") {
		t.Fatalf("选定像素档后不应再展示会被覆盖的 ratio：%s", text)
	}
	// 非扩图仍展示 size。
	plain := cloudAgentMediaArgs{Mode: "image", Prompt: "x", Title: "图", Size: "1024x1024"}
	text = strings.Join(cloudAgentMediaApprovalPreview(&cloudAgentMediaPlan{Args: plain}, "gpt-image-2").Items[0].Details, " | ")
	if !strings.Contains(text, "画幅：1024x1024") {
		t.Fatalf("非扩图应展示画幅：%s", text)
	}
}

// 漏 patch 必须是**可恢复的参数错误**：运行期会把它当工具结果回给模型重试，
// 而不是把整轮判死；未知操作类型（例如删除）仍按准入失败终止。
func TestCloudAgentCanvasApprovalPreviewTreatsMissingPatchAsArgumentError(t *testing.T) {
	doc, err := creationDocument(`{"nodes":[{"id":"image-1","type":"image","title":"参考图"}],"connections":[]}`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = applyCloudAgentCanvasPlan(doc, []agentCanvasOp{{Type: "update_node", ID: "image-1"}})
	var argumentErr *cloudAgentArgumentError
	if !errors.As(err, &argumentErr) {
		t.Fatalf("漏 patch 应当是可恢复的参数错误，实际：%v", err)
	}

	_, err = applyCloudAgentCanvasPlan(doc, []agentCanvasOp{{Type: "delete_node", ID: "image-1"}})
	if err == nil {
		t.Fatal("未知画布写操作必须仍然报错")
	}
	if errors.As(err, &argumentErr) {
		t.Fatalf("未知画布写操作不能被当成可恢复的参数错误：%v", err)
	}
}
