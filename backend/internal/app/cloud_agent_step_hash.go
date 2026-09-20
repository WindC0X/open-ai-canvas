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

// cloudAgentRepairTruncatedSnapshotHash 修复模型抄写 snapshotHash 时丢末字符的笔误
// (2026-09-20 真机实测: 同一 run 5 连败全是 63 位前缀, 模型从未意识到自己截断)。
// 仅当模型 hash 恰为当前内容 hash 的 (len-1) 前缀时补全, 不放宽任何真实并发保护。
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
	latest := cloudAgentContentHash(doc)
	if len(current.SnapshotHash) != len(latest)-1 || latest[:len(current.SnapshotHash)] != current.SnapshotHash {
		return call
	}
	log.Printf("agent snapshot hash repaired: run=%s tool=%s", run.ID, call.Function.Name)
	return cloudAgentRewriteCallSnapshotHash(call, latest)
}

// cloudAgentRefreshStepSnapshotHash 把同一轮里后续写操作的 snapshotHash 接到当前画布上。
// 只放宽同一轮内、且哈希仍等于本轮读时基线的调用；跨轮和模型自己换过哈希的调用仍走原校验。
// generate_media 漏传快照时补当前媒体内容哈希，避免写画布后还要再读一轮。
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
		return call
	}
	latest := cloudAgentContentHash(doc)
	if latest == "" || latest == current.SnapshotHash {
		return call
	}
	call = cloudAgentRewriteCallSnapshotHash(call, latest)
	log.Printf("agent step hash refreshed: run=%s step=%d index=%d tool=%s", run.ID, state.Step, state.CallIndex, call.Function.Name)
	return call
}
