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

// 2026-09-21 用户实测：64 节点、13k×33k 的画布里，Agent 新建节点被放到全局包围盒右侧空列
// （右缘 +120、顶部对齐），距用户视野数万像素，连线横跨全图（「偏到姥姥家」）。
// 现规则：优先贴住本批连线的对端节点（源节点右侧 +96、与源顶部对齐）；无引用可依才回退空列。
func TestApplyCloudAgentCanvasPlanAnchorsNewNodeToReference(t *testing.T) {
	newDoc := func() map[string]any {
		return map[string]any{
			"nodes": []any{
				map[string]any{"id": "src", "type": "image", "position": map[string]any{"x": 5000.0, "y": 2000.0}, "width": 720.0, "height": 405.0, "metadata": map[string]any{}},
				map[string]any{"id": "far", "type": "image", "position": map[string]any{"x": 100000.0, "y": 0.0}, "width": 720.0, "height": 405.0, "metadata": map[string]any{}},
			},
			"connections": []any{},
		}
	}

	// ① 有引用：贴住源图右侧（5000+720+96），纵向与源图顶部对齐
	doc := newDoc()
	ops := []agentCanvasOp{
		{Type: "add_node", ID: "draft", NodeType: "image"},
		{Type: "connect_nodes", ID: "c1", FromNodeID: "src", ToNodeID: "draft"},
	}
	if _, err := applyCloudAgentCanvasPlan(doc, ops); err != nil {
		t.Fatal(err)
	}
	nodes := creationMaps(doc["nodes"])
	draft := nodes[cloudAgentNodeIndex(nodes, "draft")]
	pos, _ := draft["position"].(map[string]any)
	if pos["x"].(float64) != 5816 || pos["y"].(float64) != 2000 {
		t.Fatalf("新节点未贴住源图落位：%+v", pos)
	}

	// ② 同锚点多个新节点：首个对齐源顶部，后续按默认高度 + 100 步长下移，且不与首个重叠
	doc = newDoc()
	ops = []agentCanvasOp{
		{Type: "add_node", ID: "draft-a", NodeType: "image"},
		{Type: "add_node", ID: "draft-b", NodeType: "image"},
		{Type: "connect_nodes", ID: "c1", FromNodeID: "src", ToNodeID: "draft-a"},
		{Type: "connect_nodes", ID: "c2", FromNodeID: "src", ToNodeID: "draft-b"},
	}
	if _, err := applyCloudAgentCanvasPlan(doc, ops); err != nil {
		t.Fatal(err)
	}
	nodes = creationMaps(doc["nodes"])
	first, _ := nodes[cloudAgentNodeIndex(nodes, "draft-a")]["position"].(map[string]any)
	second, _ := nodes[cloudAgentNodeIndex(nodes, "draft-b")]["position"].(map[string]any)
	firstHeight, _ := nodes[cloudAgentNodeIndex(nodes, "draft-a")]["height"].(float64)
	if first["x"].(float64) != second["x"].(float64) || first["y"].(float64) != 2000 {
		t.Fatalf("同锚点未同列对齐：first=%v second=%v", first, second)
	}
	if second["y"].(float64)-first["y"].(float64) < firstHeight {
		t.Fatalf("同锚点纵向压叠：first=%v second=%v h=%v", first, second, firstHeight)
	}

	// ③ 无引用：回退全局包围盒右侧空列（far 右缘 100720 + 120），保持既有行为
	doc = newDoc()
	ops = []agentCanvasOp{{Type: "add_node", ID: "lone", NodeType: "image"}}
	if _, err := applyCloudAgentCanvasPlan(doc, ops); err != nil {
		t.Fatal(err)
	}
	nodes = creationMaps(doc["nodes"])
	lone, _ := nodes[cloudAgentNodeIndex(nodes, "lone")]["position"].(map[string]any)
	if lone["x"].(float64) != 100840 {
		t.Fatalf("无引用节点应回退包围盒右侧空列：%+v", lone)
	}
}

// 无引用对端的新节点优先落在「用户当前视野」内（真机 2026-09-22：包围盒右上角在视野之外，
// 用户看到的是「Agent 的节点总在天边」）。画布 viewport 以屏幕位移表示（世界→屏幕 = world*k + (x,y)），
// 可见世界左上角 = (-x/k, -y/k)，落位再内缩 80px 并避开视野内已有节点。
func TestApplyCloudAgentCanvasPlanFallsBackToViewport(t *testing.T) {
	doc := map[string]any{
		"viewport": map[string]any{"x": -1000.0, "y": -500.0, "k": 0.5},
		"nodes": []any{
			map[string]any{"id": "far", "type": "image", "position": map[string]any{"x": -7740.0, "y": 15644.0}, "width": 420.0, "height": 560.0},
		},
		"connections": []any{},
	}
	ops := []agentCanvasOp{{Type: "add_node", ID: "t1", NodeType: "text"}}
	if _, err := applyCloudAgentCanvasPlan(doc, ops); err != nil {
		t.Fatal(err)
	}
	// 可见世界左上角 = (1000/0.5, 500/0.5) = (2000, 1000)，内缩 80 → (2080, 1080)
	if ops[0].X != 2080 || ops[0].Y != 1080 {
		t.Fatalf("无引用节点应落在当前视野内：x=%v y=%v", ops[0].X, ops[0].Y)
	}
	// 视野内已有节点占据该位时向下让位（该节点 h=560 → 1080+560+100）
	occupied := map[string]any{
		"viewport": map[string]any{"x": -1000.0, "y": -500.0, "k": 0.5},
		"nodes": []any{
			map[string]any{"id": "far", "type": "image", "position": map[string]any{"x": -7740.0, "y": 15644.0}, "width": 420.0, "height": 560.0},
			map[string]any{"id": "near", "type": "text", "position": map[string]any{"x": 2080.0, "y": 1080.0}, "width": 340.0, "height": 560.0},
		},
		"connections": []any{},
	}
	ops = []agentCanvasOp{{Type: "add_node", ID: "t2", NodeType: "text"}}
	if _, err := applyCloudAgentCanvasPlan(occupied, ops); err != nil {
		t.Fatal(err)
	}
	if ops[0].X != 2080 || ops[0].Y != 1740 {
		t.Fatalf("视野内占位应向下让位：x=%v y=%v", ops[0].X, ops[0].Y)
	}
	// 旧文档没有 viewport 时保持包围盒回退（既有行为不变）
	legacy := map[string]any{"nodes": []any{map[string]any{"id": "a1", "type": "text", "position": map[string]any{"x": 1000.0, "y": 500.0}, "width": 340.0, "height": 240.0}}, "connections": []any{}}
	legacyOps := []agentCanvasOp{{Type: "add_node", ID: "l1", NodeType: "text"}}
	if _, err := applyCloudAgentCanvasPlan(legacy, legacyOps); err != nil {
		t.Fatal(err)
	}
	if legacyOps[0].X != 1460 {
		t.Fatalf("无 viewport 应回退包围盒右侧空列：x=%v", legacyOps[0].X)
	}
}
