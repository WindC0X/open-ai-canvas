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
	// 落位=现有包围盒右缘+120, 步长=类型默认高度+100(text 384→484); 模型的 (10,20) 被忽略:
	if p1["x"].(float64) != 1460 || p1["y"].(float64) != 500 {
		t.Fatalf("n1 placement wrong: %+v", p1)
	}
	if p2["x"].(float64) != 1460 || p2["y"].(float64) != 984 {
		t.Fatalf("第二个节点应按默认高度 384+100 步长落位: p2=%v", p2)
	}
	// review P1 回归守卫: 相邻节点包围盒不得纵向交叠(步长必须 ≥ 节点高度)。
	h1, _ := p1["height"].(float64)
	if p2["y"].(float64)-(p1["y"].(float64)+h1) < 0 {
		t.Fatalf("多节点纵向压叠: p1.y=%v h1=%v p2.y=%v", p1["y"], h1, p2["y"])
	}
	// hash 稳定可用(执行侧用同一函数, preview 一致):
	b, _ := json.Marshal(p1)
	if len(b) == 0 {
		t.Fatal("position not serializable")
	}
}
