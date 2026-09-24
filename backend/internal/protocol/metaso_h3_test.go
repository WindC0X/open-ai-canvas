package protocol

import (
	"context"
	"encoding/json"
	"testing"
)

// G6/B5（2026-09-24 P3）：metaso-h3 创建期响应可能把任务 ID 嵌在 task.id（同族 minimax 结构），
// 旧 $coalesce 只有扁平分枝 → 嵌套结构建不出任务。锁定扁平 / 嵌套 / 驼峰三条映射。
func TestOfficialMetasoH3TaskIDMapping(t *testing.T) {
	adapter := officialPackageAdapter(t, "metaso-h3.yingce-plugin", "metaso-h3")
	for _, tc := range []struct {
		name    string
		payload map[string]any
	}{
		{"flat_task_id", map[string]any{"task_id": "424010985738629"}},
		{"nested_task_id", map[string]any{"task": map[string]any{"id": "424010985738629"}}},
		{"camel_task_id", map[string]any{"taskId": "424010985738629"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body, err := json.Marshal(tc.payload)
			if err != nil {
				t.Fatal(err)
			}
			created, err := adapter.ParseCreate(context.Background(), body)
			if err != nil {
				t.Fatal(err)
			}
			if created.TaskID != "424010985738629" {
				t.Fatalf("taskId mapping = %q, payload=%v", created.TaskID, tc.payload)
			}
		})
	}
}
