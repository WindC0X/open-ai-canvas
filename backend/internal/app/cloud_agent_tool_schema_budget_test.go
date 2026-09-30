package app

import (
	"encoding/json"
	"reflect"
	"testing"
)

// 工具 schema 是每一步都要发出去（并且是前缀缓存的第一段）的固定开销，因此值得钉住体积：
// 平台工具全集按 auto + canvas + 技能构造（覆盖条件暴露的工具）。
func platformToolSchema(t *testing.T) ([]map[string]any, []byte) {
	t.Helper()
	req := CloudAgentRequest{PermissionMode: "auto", ContextScope: []string{"canvas"}, SkillIDs: []string{"capability-list"}}
	req.Budget.MaxGenerationTasks = 1
	tools := cloudAgentTools(req)
	raw, err := json.Marshal(tools)
	if err != nil {
		t.Fatal(err)
	}
	return tools, raw
}

func TestCloudAgentToolSchemaStaysCompact(t *testing.T) {
	tools, raw := platformToolSchema(t)
	t.Logf("platform tool schema: %d tools, %d bytes", len(tools), len(raw))

	// 条件必填不是 type 枚举能表达的约束，压缩描述不能删掉协议语义。
	found := false
	for _, tool := range tools {
		function, _ := tool["function"].(map[string]any)
		if function["name"] != "canvas_apply_ops" {
			continue
		}
		found = true
		parameters, _ := function["parameters"].(map[string]any)
		ops, _ := parameters["properties"].(map[string]any)
		items, _ := ops["ops"].(map[string]any)
		opItem, _ := items["items"].(map[string]any)
		want := []map[string]any{
			{"properties": map[string]any{"type": map[string]any{"const": "add_node"}}, "required": []string{"nodeType"}},
			{"properties": map[string]any{"type": map[string]any{"const": "update_node"}}, "required": []string{"patch"}},
			{"properties": map[string]any{"type": map[string]any{"const": "connect_nodes"}}, "required": []string{"fromNodeId", "toNodeId"}},
		}
		if !reflect.DeepEqual(opItem["oneOf"], want) {
			t.Fatalf("操作类型条件必填约束丢失: %#v", opItem["oneOf"])
		}
		if props, ok := opItem["properties"].(map[string]any); !ok || len(props) == 0 {
			t.Fatal("canvas_apply_ops 的 ops.items 必须保留 properties")
		}
	}
	if !found {
		t.Fatal("canvas_apply_ops 未暴露")
	}

	// 体积预算：导演台、技能检索和上下文读取工具合入后，当前平台工具为 24 个，实测
	// 27,812 字节，因此把预算显式上调到 29,000（约 4.3% 余量）。新增工具或字段时请
	// 重新测量并有意识地调整这个数字，而不是让 schema 悄悄膨胀（它每一步都要发、还在
	// 前缀最前面）。
	// 合并口径（2026-09-30，merge-v1.6.0 上游同步）：并集后实测 29,660 字节（24 工具）。
	// 超出 29,000 的 +660 字节全部来自 fork 侧扩图（outpaint）能力描述——`outpaintRatio`
	// 参数定义、generate_media 的扩图文案、size 的目标像素说明——均属 B 线必须保留的
	// 业务语义，非无意识膨胀（压缩这些描述会删掉协议语义，与本测试上一段的约束相悖）。
	// 因此按与上游相同的余量口径重算：29,660 × 1.043 ≈ 30,935，取整 31,000。
	if len(raw) > 31000 {
		t.Fatalf("平台工具 schema 体积 %d 字节超出预算 31000：请压缩描述或显式调整预算", len(raw))
	}
}
