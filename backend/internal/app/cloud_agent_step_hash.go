package app

import (
	"encoding/json"
	"log"

	"infinite-canvas/backend/internal/model"
)

func cloudAgentCallSnapshotHash(call cloudAgentCall) string {
	var args struct {
		SnapshotHash string `json:"snapshotHash"`
	}
	if err := json.Unmarshal([]byte(call.Function.Arguments), &args); err != nil {
		return ""
	}
	return args.SnapshotHash
}

func cloudAgentCaptureStepSnapshotHash(calls []cloudAgentCall) string {
	for _, call := range calls {
		if hash := cloudAgentCallSnapshotHash(call); hash != "" {
			return hash
		}
	}
	return ""
}

// cloudAgentCaptureStepFullSnapshotHash 与 cloudAgentCaptureStepSnapshotHash 同点调用，
// 捕获链衔接所需的 fullHash 口径基线（mutation 账本 Before/After 均为 cloudAgentCanvasHash）。
// W5 复核（卡 02）：本函数为「上游链证明 + 我方截断修复」融合体的定点实现，
// 执行序 1/2/3 均已完整落地，双口径字段见 state.StepFullSnapshotHash。
func cloudAgentCaptureStepFullSnapshotHash(s *Service, run *model.CloudAgentExecution, state *cloudAgentRuntime) string {
	if s == nil || run == nil || state == nil {
		return ""
	}
	canvas, err := s.repo.CanvasProjectForUser(run.UserID, state.Request.CanvasID)
	if err != nil {
		return ""
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		return ""
	}
	return cloudAgentCanvasHash(doc)
}

func cloudAgentRewriteCallSnapshotHash(call cloudAgentCall, hash string) cloudAgentCall {
	args := map[string]any{}
	if err := json.Unmarshal([]byte(call.Function.Arguments), &args); err != nil {
		return call
	}
	args["snapshotHash"] = hash
	raw, err := json.Marshal(args)
	if err != nil {
		return call
	}
	call.Function.Arguments = string(raw)
	return call
}

// cloudAgentRepairSnapshotHashAgainst 是截断修复的核心判定: 仅当模型 hash 恰为 latest 的
// (len-1) 前缀时补全末字符, 其余任何取值原样返回, 不放宽任何真实并发保护。
func cloudAgentRepairSnapshotHashAgainst(call cloudAgentCall, runID, modelHash, latest string) cloudAgentCall {
	if latest == "" || modelHash == "" || len(modelHash) != len(latest)-1 || latest[:len(modelHash)] != modelHash {
		return call
	}
	log.Printf("agent snapshot hash repaired: run=%s tool=%s", runID, call.Function.Name)
	return cloudAgentRewriteCallSnapshotHash(call, latest)
}

// cloudAgentRepairTruncatedSnapshotHash 修复模型抄写 snapshotHash 时丢末字符的笔误
// (2026-09-20 真机实测: 同一 run 5 连败全是 63 位前缀, 模型从未意识到自己截断)。
// 供无已加载画布文档的调用路径使用; 已有 doc 的路径直接用 cloudAgentRepairSnapshotHashAgainst。
func cloudAgentRepairTruncatedSnapshotHash(s *Service, run *model.CloudAgentExecution, call cloudAgentCall) cloudAgentCall {
	var current struct {
		SnapshotHash string `json:"snapshotHash"`
	}
	if err := json.Unmarshal([]byte(call.Function.Arguments), &current); err != nil || current.SnapshotHash == "" {
		return call
	}
	canvas, err := s.repo.CanvasProjectForUser(run.UserID, run.CanvasID)
	if err != nil {
		return call
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		return call
	}
	return cloudAgentRepairSnapshotHashAgainst(call, run.ID, current.SnapshotHash, cloudAgentContentHash(doc))
}

// cloudAgentRefreshStepSnapshotHash 把同一轮里后续写操作的 snapshotHash 接到当前画布上。
// 只放宽同一轮内、且哈希仍等于本轮读时基线的调用；基线不匹配(含模型抄断截断)落到前缀修复
// 检查; 其余情况仍走原校验。generate_media 漏传快照时补当前媒体内容哈希。
func (s *Service) cloudAgentRefreshStepSnapshotHash(run *model.CloudAgentExecution, state *cloudAgentRuntime, call cloudAgentCall) cloudAgentCall {
	if state == nil || state.CallIndex <= 0 || len(state.Calls) == 0 || !cloudAgentWrite(call.Function.Name) {
		return cloudAgentRepairTruncatedSnapshotHash(s, run, call)
	}
	var current struct {
		SnapshotHash string `json:"snapshotHash"`
	}
	if err := json.Unmarshal([]byte(call.Function.Arguments), &current); err != nil {
		return call
	}
	canvas, err := s.repo.CanvasProjectForUser(run.UserID, state.Request.CanvasID)
	if err != nil {
		return call
	}
	doc, err := creationDocument(canvas.PayloadJSON)
	if err != nil {
		return call
	}
	if current.SnapshotHash == "" {
		if call.Function.Name != "generate_media" {
			return call
		}
		latest := cloudAgentMediaContentHash(doc)
		if latest == "" {
			return call
		}
		call = cloudAgentRewriteCallSnapshotHash(call, latest)
		log.Printf("agent step hash filled: run=%s step=%d index=%d tool=%s", run.ID, state.Step, state.CallIndex, call.Function.Name)
		return call
	}
	baseline := state.StepSnapshotHash
	if baseline == "" || current.SnapshotHash != baseline {
		// 互斥分支一（我方，优先）: 截断/换哈希笔误的前缀修复（卡 02 B3：与链证明互斥，不串联）。
		if repaired := cloudAgentRepairSnapshotHashAgainst(call, run.ID, current.SnapshotHash, cloudAgentContentHash(doc)); repaired.Function.Arguments != call.Function.Arguments {
			return repaired
		}
		return call
	}
	latest := cloudAgentContentHash(doc)
	if latest == "" || latest == current.SnapshotHash {
		return call
	}
	if repaired := cloudAgentRepairSnapshotHashAgainst(call, run.ID, current.SnapshotHash, latest); repaired.Function.Arguments != call.Function.Arguments {
		return repaired
	}
	// 上游链证明结构（卡 02 执行序 1）：链内以 fullHash 校验（与 mutation 账本同口径），
	// 最终重写值取我方 contentHash（卡 01 模型可见口径）。
	latestCanvas := cloudAgentCanvasHash(doc)
	if latestCanvas == "" {
		return call
	}
	if latest == "" || latest == current.SnapshotHash {
		return call
	}
	latestMutation, err := s.repo.LatestCloudAgentCanvasMutationForCanvas(run.UserID, state.Request.CanvasID)
	if err != nil || latestMutation.RunID != run.ID || latestMutation.AfterSnapshotHash != latestCanvas {
		return call
	}
	chain, err := s.repo.CloudAgentCanvasMutationChain(run.UserID, run.ID, state.Request.CanvasID)
	if err != nil {
		return call
	}
	stepIDs := map[string]bool{}
	for _, candidate := range state.Calls {
		if candidate.ID != "" {
			stepIDs[candidate.ID] = true
		}
	}
	// 本轮步骤基线（我方文件无上游的 baseline 变量，取 state.StepSnapshotHash）
	// 链衔接基线（fullHash 口径，与 mutation 账本同口径）；空值即拒绝（安全方向）。
	baselineFull := state.StepFullSnapshotHash
	if baselineFull == "" {
		return call
	}
	expected := baselineFull
	advanced := false
	for _, mutation := range chain {
		if !stepIDs[mutation.StepID] {
			continue
		}
		if !advanced {
			if mutation.BeforeSnapshotHash != expected {
				continue
			}
			advanced = true
		} else if mutation.BeforeSnapshotHash != expected {
			return call
		}
		expected = mutation.AfterSnapshotHash
		if expected == latestCanvas {
			break
		}
	}
	if !advanced || expected != latestCanvas {
		return call
	}
	call = cloudAgentRewriteCallSnapshotHash(call, latest)
	log.Printf("agent step hash refreshed: run=%s step=%d index=%d tool=%s", run.ID, state.Step, state.CallIndex, call.Function.Name)
	return call
}
