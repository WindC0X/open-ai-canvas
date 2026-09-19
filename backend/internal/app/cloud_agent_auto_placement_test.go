package app

import (
	"encoding/json"
	"testing"
)

func TestApplyCloudAgentCanvasPlanAutoPlacementIgnoresModelCoordinates(t *testing.T) {
	doc := map[string]any{
		"nodes": []any{
			map[string]any{"id": "a1", "type": "text", "position": map[string]any{"x": 1000.0, "y": 500.0}, "width": 340.0, "height": 240.0, "metadata": map[string]any{"content": "x"}},
		},
		"connections": []any{},
	}
	ops := []agentCanvasOp{
		{Type: "add_node", ID: "n1", NodeType: "text", X: 10, Y: 20},
		{Type: "add_node", ID: "n2", NodeType: "text", X: 10, Y: 20},
	}
	if _, err := applyCloudAgentCanvasPlan(doc, ops); err != nil {
		t.Fatal(err)
	}
	nodes := creationMaps(doc["nodes"])
	if len(nodes) != 3 {
		t.Fatalf("expected 3 nodes, got %d", len(nodes))
	}
	n1, n2 := nodes[1], nodes[2]
	p1, _ := n1["position"].(map[string]any)
	p2, _ := n2["position"].(map[string]any)
	// 落位=现有包围盒右缘+120, 逐个下移 340; 模型的 (10,20) 被忽略:
	if p1["x"].(float64) != 1460 || p1["y"].(float64) != 500 {
		t.Fatalf("n1 placement wrong: %+v", p1)
	}
	if p2["x"].(float64) != 1460 || p2["y"].(float64) != 840 {
		t.Fatalf("n2 stacking wrong: %+v", p2)
	}
	// hash 稳定可用(执行侧用同一函数, preview 一致):
	b, _ := json.Marshal(p1)
	if len(b) == 0 {
		t.Fatal("position not serializable")
	}
}
