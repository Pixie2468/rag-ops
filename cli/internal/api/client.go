package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type EvalRequest struct {
	Query         string   `json:"query"`
	ContextChunks []string `json:"context_chunks"`
	Answer        string   `json:"answer"`
}

type EvalResponse struct {
	Verdict        string                 `json:"verdict"`
	StageFailed    *string                `json:"stage_failed,omitempty"`
	Tags           []string               `json:"tags"`
	Metrics        map[string]interface{} `json:"metrics"`
	JudgeReasoning *string                `json:"judge_reasoning,omitempty"`
	JudgeScore     *int                   `json:"judge_score,omitempty"`
}

func RunEvaluation(req EvalRequest) (*EvalResponse, error) {
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := "http://localhost:8000/evaluate/"
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 300 * time.Second, // Evaluator can be slow (LLM calls)
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned non-200 status: %d", resp.StatusCode)
	}

	var evalResp EvalResponse
	if err := json.NewDecoder(resp.Body).Decode(&evalResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &evalResp, nil
}
