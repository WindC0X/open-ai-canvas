package app

import "infinite-canvas/backend/internal/model"

// 资源引用判定的共享谓词（C 组：AST-08 查询面与删除面同根不同源）。
//
// 背景：删除面（resource_delete.go）与查询面（resource_reference_query.go）都消费
// repository 的 ResourceReferenceSnapshot，但**各自实现了一套「这条引用算不算占用」的规则**，
// 导致三处分叉：C-2 自引用、C-3 已结束任务的日志/结果、C-4 裸 URL 标量文档。
// 用户可见后果是「预检说被引用不能删，实际删除成功」这类自相矛盾的结论。
//
// 本文件把判定规则收敛到单一实现，两面共用；后续任何规则调整只改这里。

// finishedTaskReferenceIsHistorical 判断「已结束任务的日志/结果」这类引用
// 是否只属于生成历史、不构成素材占用。
//
// 删除面的既定语义（resource_delete.go 原注释）：
//   - 已结束任务（succeeded/failed/cancelled）的输出和日志仅记录生成历史，不构成素材占用；
//   - 仅在素材删除时放行；孤儿清理仍保留尚未入库的任务产物。
//
// 查询面必须采用同一判定，否则会把「仅历史记录」的引用报成占用。
func finishedTaskReferenceIsHistorical(document taskStatusDocument) bool {
	switch document.TaskStatus() {
	case model.TaskStatusSucceeded, model.TaskStatusFailed, model.TaskStatusCancelled:
		kind := document.ReferenceKind()
		return kind == "任务日志" || kind == "任务结果"
	default:
		return false
	}
}

// finishedTaskResultIsHistorical 判断「已结束任务的 ResultJSON」是否不构成占用。
// 删除面遇到 Kind == "任务" 且任务已结束时会清空 SecondaryJSON（结果正文），
// 即认为结果部分不算占用；查询面对应地不得用 SecondaryJSON 计引用。
func finishedTaskResultIsHistorical(document taskStatusDocument) bool {
	switch document.TaskStatus() {
	case model.TaskStatusSucceeded, model.TaskStatusFailed, model.TaskStatusCancelled:
		return document.ReferenceKind() == "任务"
	default:
		return false
	}
}

// taskStatusDocument 让共享谓词同时适配 repository 快照条目与查询面的内部结构，
// 避免为对齐判定而让 repository 依赖 app 层类型。
type taskStatusDocument interface {
	// TaskStatus 返回该文档所属任务的终态（无关联任务时为空）。
	TaskStatus() model.TaskStatus
	// ReferenceKind 返回业务对象类型（素材 / 画布 / 任务 / 任务日志 / 任务结果 …）。
	ReferenceKind() string
}

// resourceReferenceDocument 让 repository 快照条目适配共享谓词。
// 注意：repository 的类型有 TaskStatus/Kind 字段，这里提供方法形式，
// 使谓词不直接依赖 repository（app 不反向依赖具体快照类型）。
type resourceReferenceDocument struct {
	Kind   string
	Status model.TaskStatus
}

func (d resourceReferenceDocument) TaskStatus() model.TaskStatus { return d.Status }

func (d resourceReferenceDocument) ReferenceKind() string { return d.Kind }
