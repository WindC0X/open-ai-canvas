package app

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"infinite-canvas/backend/internal/model"
	"infinite-canvas/backend/internal/repository"
)

// UndoCloudAgentCanvas restores only the latest Agent canvas mutation. It is
// deliberately optimistic: the caller must prove that the canvas still has
// the snapshot produced by that mutation. Submitted generation tasks are never
// undone, cancelled, or refunded by this method.
func (s *Service) UndoCloudAgentCanvas(userID, runID, stepID, expectedSnapshotHash, reason string) (map[string]any, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(runID) == "" {
		return nil, Unauthorized("请先登录")
	}
	expectedSnapshotHash = strings.TrimSpace(expectedSnapshotHash)
	if len(expectedSnapshotHash) != 64 {
		return nil, BadAuthRequest("需要有效的画布快照哈希")
	}
	if _, err := hex.DecodeString(expectedSnapshotHash); err != nil {
		return nil, BadAuthRequest("需要有效的画布快照哈希")
	}
	stepID = strings.TrimSpace(stepID)
	if len(stepID) > 160 {
		return nil, BadAuthRequest("Agent 操作 ID 过长")
	}
	if len([]rune(reason)) > 2000 {
		return nil, BadAuthRequest("撤销理由过长")
	}

	s.storageMu.Lock()
	defer s.storageMu.Unlock()

	run, err := s.repo.CloudAgent(userID, runID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, NotFound("Agent 运行不存在")
		}
		return nil, err
	}
	// 非终态 run 拒绝撤销（review 2026-09-21 P3）：UI 用 !running 挡了按钮，但直调 API 会
	// 回滚正在运行的 Agent 已写入内容，形成"撤销又被运行中 Agent 复活"的混乱状态。
	if !cloudAgentRunTerminal(run.Status) {
		return nil, creationConflict("Agent 运行尚未结束，暂不能撤销画布变更")
	}
	result := map[string]any{"accepted": false}
	err = s.repo.MutateCloudAgent(userID, runID, run.Revision, func(current *model.CloudAgentExecution, repo *repository.Repository) error {
		mutation, err := repo.LatestCloudAgentCanvasMutation(userID, runID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return NotFound("当前 Agent 运行没有可撤销的画布变更")
			}
			return err
		}
		if stepID != "" && mutation.StepID != stepID {
			return creationConflict("待撤销的 Agent 操作已不是当前运行的最新变更")
		}

		canvas, err := repo.CanvasProjectForUser(userID, mutation.CanvasID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return NotFound("画布不存在或无权访问")
			}
			return err
		}
		currentDoc, err := creationDocument(canvas.PayloadJSON)
		if err != nil {
			return err
		}
		currentHash := cloudAgentCanvasHash(currentDoc)
		// undone 分支保留作防御：LatestCloudAgentCanvasMutation 已是 applied-only 查询，正常
		// 流程取不到 undone 状态（重复撤销命中 404/409，测试锚定该语义）；若未来查询口径
		// 放宽，这里仍能把"已撤销但画布又变"的场景拒绝掉，不会静默重放。
		if mutation.Status == "undone" {
			if currentHash == mutation.BeforeSnapshotHash && expectedSnapshotHash == currentHash {
				result = map[string]any{"accepted": true, "snapshotHash": currentHash}
				return nil
			}
			return creationConflict("该 Agent 变更已经撤销，但画布之后又发生了变化")
		}
		if mutation.Status == "not_undoable" {
			return BadAuthRequest("该 Agent 画布变更未保留完整快照，无法撤销")
		}
		if mutation.Status != "applied" {
			return creationConflict("该 Agent 变更当前不可撤销")
		}
		if mutation.HasSubmittedTask {
			return BadAuthRequest("已提交的生成任务不能撤销；任务不会取消或退款")
		}
		if expectedSnapshotHash != currentHash || mutation.AfterSnapshotHash != currentHash {
			return creationConflict("画布已发生后续变化，未执行撤销")
		}
		if mutation.BeforeJSON == "" {
			return BadAuthRequest("该 Agent 画布变更未保留可撤销快照")
		}
		beforeDoc, err := creationDocument(mutation.BeforeJSON)
		if err != nil {
			return BadAuthRequest("该 Agent 画布变更的撤销快照无效")
		}
		if cloudAgentCanvasHash(beforeDoc) != mutation.BeforeSnapshotHash {
			return BadAuthRequest("该 Agent 画布变更的撤销快照校验失败")
		}
		// 恢复粒度与哈希口径对齐（review 2026-09-21 P1）：hash 刻意排除对话/外观字段，撤销
		// 校验因此被它们的变化放行；但 BeforeJSON 是整文档快照，直接落库会把用户在 Agent
		// 写入之后改的 chatSessions/背景偏好等静默回滚（多标签页/刷新场景永久丢失）。
		// 恢复前把当前文档的排除字段移植进快照：内容语义回滚，用户态数据保持当前值。
		// 任务守卫（review 2026-09-21 P2）：撤销会删除 current 有但 before 没有的节点，若这些
		// 节点已绑定运行中的生成任务（用户 UI 直发，账本 HasSubmittedTask 不覆盖），回写链会
		// 静默丢弃付费产出——命中时拒绝撤销而不是静默删除。
		blocked, guardErr := s.cloudAgentUndoBlockedByRunningTask(userID, beforeDoc, currentDoc)
		if guardErr != nil {
			return guardErr
		}
		if blocked != "" {
			return creationConflict(blocked)
		}
		restoreExcludedCanvasFields(beforeDoc, currentDoc)
		restored, err := json.Marshal(beforeDoc)
		if err != nil {
			return BadAuthRequest("该 Agent 画布变更的撤销快照无效")
		}
		previous := canvas.PayloadJSON
		canvas.PayloadJSON = string(restored)
		if err := saveCreationCanvasWithHistory(repo, canvas, previous); err != nil {
			if errors.Is(err, repository.ErrCreationConflict) {
				return creationConflict("画布已发生后续变化，未执行撤销")
			}
			return err
		}
		if err := repo.MarkCloudAgentCanvasMutationUndone(userID, runID, mutation.ID, time.Now().UTC()); err != nil {
			if errors.Is(err, repository.ErrCreationConflict) {
				return creationConflict("该 Agent 变更已经被处理，请重新读取画布")
			}
			return err
		}
		state, err := cloudAgentDecode(current)
		if err != nil {
			return err
		}
		state.event(runID, "canvas_undone", map[string]any{
			"canvasId":     mutation.CanvasID,
			"stepId":       mutation.StepID,
			"snapshotHash": mutation.BeforeSnapshotHash,
			"reason":       strings.TrimSpace(reason),
		})
		if err := cloudAgentSave(current, &state); err != nil {
			return err
		}
		result = map[string]any{"accepted": true, "snapshotHash": mutation.BeforeSnapshotHash}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// UndoCanvasPreview 描述最近一次 Agent 画布 mutation 的可撤销状态。面板用它决定
// 撤销按钮的可用性与禁用原因, 并取 currentSnapshotHash 作为 undo 的 expectedSnapshotHash。
func (s *Service) UndoCanvasPreview(userID, runID string) (map[string]any, error) {
	preview := map[string]any{"found": false, "canUndo": false, "blockReason": ""}
	setBlock := func(reason string) { preview["canUndo"] = false; preview["blockReason"] = reason }
	// 只读预检: 不走 MutateCloudAgent 写事务(避免递增 revision); 与 undo 的竞态由
	// undo 主流程的 expectedSnapshotHash 校验兜底(preview 结果仅作 UI 状态, 不作授权)。
	s.storageMu.Lock()
	defer s.storageMu.Unlock()
	execution, err := s.repo.CloudAgent(userID, runID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			setBlock("Agent 运行不存在或无权访问")
			return preview, nil
		}
		// 瞬态存储错误必须上抛 5xx（review 2026-09-21 P3）：吞成 found=false 会让
		// "没有可撤销变更"与"DB 故障"不可区分，监控不可见。
		return nil, err
	}
	// 与 undo 主流程同守卫（review 2026-09-21 P3）：运行中 run 的预检不授权撤销，
	// 避免 UI 依赖被绕过时预览与执行语义分叉。
	// 但 found 必须如实回答“有没有可撤销的变更”（2026-09-21 用户实测：运行中面板整条撤销
	// 消失，用户以为没有撤销功能）：found=true 仅作 UI 提示，授权仍由主流程把守。
	if !cloudAgentRunTerminal(execution.Status) {
		if mutation, mutationErr := s.repo.LatestCloudAgentCanvasMutation(userID, runID); mutationErr == nil && mutation != nil {
			preview["found"] = true
			setBlock("Agent 运行中，暂不能撤销；停止运行后可撤销该变更")
		} else {
			setBlock("Agent 运行尚未结束，暂不能撤销")
		}
		return preview, nil
	}
	mutation, err := s.repo.LatestCloudAgentCanvasMutation(userID, runID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			setBlock("当前 Agent 运行没有可撤销的画布变更")
			return preview, nil
		}
		return nil, err
	}
	canvas, err := s.repo.CanvasProjectForUser(userID, mutation.CanvasID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			setBlock("画布不存在或无权访问")
			return preview, nil
		}
		return nil, err
	}
	currentDoc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		setBlock("画布内容读取失败")
		return preview, nil
	}
	currentHash := cloudAgentCanvasHash(currentDoc)
	preview["found"] = true
	preview["stepId"] = mutation.StepID
	preview["status"] = mutation.Status
	preview["currentSnapshotHash"] = currentHash
	preview["hasSubmittedTask"] = mutation.HasSubmittedTask
	switch {
	case mutation.Status == "undone":
		setBlock("该变更已撤销")
	case mutation.Status == "not_undoable":
		setBlock("该变更未保留完整快照，无法撤销")
	case mutation.Status != "applied":
		setBlock("该变更当前不可撤销")
	case mutation.HasSubmittedTask:
		setBlock("已提交的生成任务不能撤销")
	case mutation.AfterSnapshotHash != currentHash:
		setBlock("画布已发生后续变化，不可撤销")
	default:
		preview["canUndo"] = true
	}
	return preview, nil
}

// cloudAgentUndoBlockedByRunningTask 检查撤销将删除的节点是否绑定运行中/排队中的生成任务。
// 返回非空字符串即拒绝原因（fail-closed）；账本 HasSubmittedTask 只覆盖 Agent 自提任务，
// 用户 UI 直发的任务只能从节点 metadata.taskId 反查（review 2026-09-21 P2）。
// 任务反查自身出错时上抛：只有「任务不存在/无权访问」可放过（历史节点、已清理任务），
// DB 故障等错误必须让撤销失败而不是静默跳过守卫（review 2026-09-21 P3 fail-open）。
func (s *Service) cloudAgentUndoBlockedByRunningTask(userID string, beforeDoc, currentDoc map[string]any) (string, error) {
	beforeNodes, err := creationObjects(beforeDoc["nodes"])
	if err != nil {
		return "", nil
	}
	currentNodes, err := creationObjects(currentDoc["nodes"])
	if err != nil {
		return "", nil
	}
	for id, node := range currentNodes {
		if beforeNodes[id] != nil {
			continue
		}
		metadata, _ := node["metadata"].(map[string]any)
		taskID := stringValue(metadata["taskId"])
		if taskID == "" {
			continue
		}
		task, taskErr := s.repo.TaskForUser(userID, taskID)
		if taskErr != nil {
			if errors.Is(taskErr, gorm.ErrRecordNotFound) {
				continue
			}
			return "", taskErr
		}
		if task.Status == model.TaskStatusQueued || task.Status == model.TaskStatusRunning {
			return "待撤销节点上有进行中的任务，请等任务完成或取消后再撤销", nil
		}
	}
	return "", nil
}

// restoreExcludedCanvasFields 把 current 文档中哈希排除口径的字段移植进 before 快照。
// 移植字段必须与 cloudAgentCanvasHash 的排除集合严格同步：viewport（前端 adopt 保留本地）、
// updatedAt（落库时间戳）、chatSessions/activeChatId（画布助手对话）、backgroundMode/
// showImageInfo/appearance（外观偏好）。
func restoreExcludedCanvasFields(beforeDoc, currentDoc map[string]any) {
	// 直接引用云画布哈希的排除集合（单一源）：双字面量漂移会让"不参与哈希的字段"被撤销回滚
	// （review 2026-09-21 P3）。
	for _, key := range cloudAgentCanvasHashExcludedKeys {
		if value, ok := currentDoc[key]; ok {
			beforeDoc[key] = value
		} else {
			delete(beforeDoc, key)
		}
	}
}
