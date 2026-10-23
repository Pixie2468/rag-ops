package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

var defaultBaseURL = "http://localhost:8000"
var configuredBaseURL = ""

func GetBaseURL() string {
	if configuredBaseURL != "" {
		return strings.TrimRight(configuredBaseURL, "/")
	}
	if envURL := os.Getenv("RAGOPS_API_URL"); envURL != "" {
		return strings.TrimRight(envURL, "/")
	}
	return defaultBaseURL
}

func SetBaseURL(url string) {
	configuredBaseURL = strings.TrimRight(url, "/")
}

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

type HealthResponse struct {
	Status             string `json:"status"`
	Service            string `json:"service"`
	LLMJudgeConfigured bool   `json:"llm_judge_configured"`
	DatabaseConnected  bool   `json:"database_connected"`
	DatabaseProvider   string `json:"database_provider"`
}

func CheckHealth() (*HealthResponse, error) {
	baseURL := GetBaseURL()
	url := fmt.Sprintf("%s/health", baseURL)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("RAGOps backend unreachable at %s: %w", baseURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backend returned non-200 status: %d", resp.StatusCode)
	}

	var health HealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, fmt.Errorf("failed to decode health status: %w", err)
	}

	return &health, nil
}

func RunEvaluation(req EvalRequest) (*EvalResponse, error) {
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	baseURL := GetBaseURL()
	url := fmt.Sprintf("%s/evaluate/", baseURL)
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
		return nil, fmt.Errorf("could not connect to RAGOps backend at %s\n\n💡 To start the local backend & GUI, run:\n   docker compose up -d\n   # or\n   ./dev.sh", baseURL)
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
