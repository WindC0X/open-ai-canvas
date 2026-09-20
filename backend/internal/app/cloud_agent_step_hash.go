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
	latest := cloudAgentContentHash(doc)
	if current.SnapshotHash == state.StepSnapshotHash {
		// 同轮接力: 模型 hash 仍等于本轮读时基线, 直接接到当前画布。
		if latest == "" || latest == current.SnapshotHash {
			return call
		}
		call = cloudAgentRewriteCallSnapshotHash(call, latest)
		log.Printf("agent step hash refreshed: run=%s step=%d index=%d tool=%s", run.ID, state.Step, state.CallIndex, call.Function.Name)
		return call
	}
	// 基线不匹配(模型换过哈希或抄断截断): 落到前缀修复, 复用已加载文档不增加 DB 读。
	return cloudAgentRepairSnapshotHashAgainst(call, run.ID, current.SnapshotHash, latest)
}
