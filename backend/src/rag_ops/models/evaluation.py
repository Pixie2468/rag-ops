"""
Evaluation API models.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EvalRequest(BaseModel):
    """Request model for evaluation."""

    query: str = Field(description="The user query to evaluate.")
    context_chunks: list[str] = Field(description="The context chunks retrieved by the RAG system.")
    answer: str = Field(description="The generated answer to evaluate.")
    api_key: str | None = Field(default=None, description="Optional Gemini API key for Stage 5 LLM judge.")
    model: str | None = Field(default=None, description="Optional Gemini model override for Stage 5.")
    project_name: str = Field(default="default-project", description="Project namespace to associate the trace.")


class EvalResponse(BaseModel):
    """Response model for evaluation."""

    verdict: str = Field(description="The final verdict of the evaluation (e.g., pass, fail).")
    stage_failed: str | None = Field(default=None, description="The stage where the evaluation failed, if any.")
    tags: list[str] = Field(default_factory=list, description="Tags associated with the evaluation.")
    metrics: dict[str, Any] = Field(default_factory=dict, description="Metrics collected during evaluation.")
    judge_reasoning: str | None = Field(default=None, description="Reasoning provided by the LLM judge.")
    judge_score: int | None = Field(default=None, description="Score provided by the LLM judge.")
    trace_id: str | None = Field(default=None, description="Persistent trace UUID in database.")
    latency_ms: int = Field(default=0, description="Pipeline execution duration in milliseconds.")


class JudgeRequest(BaseModel):
    """Request model for dedicated LLM-as-a-Judge evaluation."""

    query: str = Field(description="The user query to evaluate.")
    answer: str = Field(description="The generated answer to evaluate.")
    context: str | None = Field(default=None, description="Retrieved context string. If omitted, context_chunks will be joined.")
    context_chunks: list[str] = Field(default_factory=list, description="Optional list of retrieved context chunks.")
    api_key: str | None = Field(default=None, description="Gemini API key. Falls back to server GEMINI_API_KEY if not provided.")
    model: str = Field(default="gemini-3.5-flash", description="Gemini model name to use as judge (falls back automatically across model pool).")
    entity_overlap_pct: float | None = Field(default=None, description="Optional pre-computed entity overlap percentage.")
    entailment_ratio: float | None = Field(default=None, description="Optional pre-computed entailment ratio.")


class JudgeResponse(BaseModel):
    """Response model for dedicated LLM-as-a-Judge evaluation."""

    verdict: str = Field(description="Verdict: Pass or Fail")
    score: int = Field(description="Judge score: 1 (Pass) or 0 (Fail)")
    reasoning: str = Field(description="Reasoning provided by the LLM judge.")
    model: str = Field(description="Model used for judging.")
    entity_overlap_pct: float = Field(description="Entity overlap percentage used.")
    entailment_ratio: float = Field(description="Entailment ratio used.")


class BatchEvalRequest(BaseModel):
    """Request model for evaluating a batch/dataset of RAG triads."""

    items: list[EvalRequest] = Field(description="List of RAG test cases to evaluate.")
    api_key: str | None = Field(default=None, description="Optional Gemini API key for Stage 5 LLM judge.")
    project_name: str = Field(default="benchmark-dataset", description="Project name to tag batch evaluations.")
    max_concurrency: int = Field(default=4, description="Maximum concurrent evaluations to run in parallel.")


class BatchEvalResponse(BaseModel):
    """Summary and itemized results for a batch evaluation run."""

    total: int = Field(description="Total number of items evaluated.")
    passed: int = Field(description="Number of items passing all gates.")
    failed: int = Field(description="Number of items failing at least one gate.")
    pass_rate_pct: float = Field(description="Percentage of items passing all gates.")
    stage_failures: dict[str, int] = Field(default_factory=dict, description="Count of failures per gate.")
    avg_latency_ms: float = Field(description="Average latency per item in milliseconds.")
    total_duration_seconds: float = Field(description="Wall-clock time to run the batch in seconds.")
    results: list[EvalResponse] = Field(default_factory=list, description="Per-item evaluation results.")


class CandidateAnswer(BaseModel):
    """Candidate answer for model comparison."""

    name: str = Field(default="Candidate", description="Label for candidate model/prompt.")
    answer: str = Field(description="Generated answer from this candidate.")


class CompareRequest(BaseModel):
    """Request model to compare two candidate answers side-by-side."""

    query: str = Field(description="The user query.")
    context_chunks: list[str] = Field(description="Retrieved context chunks.")
    candidate_a: CandidateAnswer = Field(description="First candidate answer.")
    candidate_b: CandidateAnswer = Field(description="Second candidate answer.")
    api_key: str | None = Field(default=None, description="Optional Gemini API key for judge.")


class CompareResponse(BaseModel):
    """Side-by-side comparison response."""

    query: str
    result_a: EvalResponse
    result_b: EvalResponse
    winner: str | None = Field(description="Candidate name that scored higher, or 'Tie'.")
    comparison_summary: str = Field(description="Key differences and decision factors.")


class TraceItem(BaseModel):
    """Individual trace summary schema."""

    id: str
    project_name: str
    user_query: str
    context_chunks: list[str] = Field(default_factory=list)
    llm_response: str
    verdict: str
    stage_failed: str | None = None
    tags: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    judge_score: int | None = None
    judge_reasoning: str | None = None
    latency_ms: int = 0
    created_at: str | None = None


class TraceListResponse(BaseModel):
    """Paginated list of traces."""

    total: int
    limit: int
    offset: int
    items: list[TraceItem]


class TraceStatsResponse(BaseModel):
    """Aggregate metrics and statistics across traces."""

    total_traces: int
    passed: int
    failed: int
    pass_rate_pct: float
    avg_latency_ms: float
    avg_relevance_score: float
    avg_faithfulness_ratio: float
    failure_stages: dict[str, int]
    verdict_distribution: dict[str, int]


class ApiKeyConfigRequest(BaseModel):
    """Request model to configure or update the Gemini API key."""

    api_key: str = Field(description="The Gemini API key to configure.")
    validate_key: bool = Field(default=True, description="Whether to validate the key against Gemini before saving.")


class ApiKeyConfigResponse(BaseModel):
    """Response model for API key configuration status."""

    status: str = Field(description="Configuration status ('configured', 'invalid', 'error', 'unset').")
    configured: bool = Field(description="Whether a valid API key is currently configured.")
    masked_key: str | None = Field(default=None, description="Masked representation of the current key.")
    message: str = Field(description="Human-readable status or error message.")


class DbConfigPayload(BaseModel):
    """Payload to configure or update the Supabase / PostgreSQL database connection URL."""

    db_url: str = Field(description="PostgreSQL or Supabase connection string.")


class DbStatusResponse(BaseModel):
    """Response detailing current database connection status."""

    connected: bool
    provider: str
    message: str
    supabase_quickstart: dict[str, str] = Field(
        default_factory=lambda: {
            "dashboard_url": "https://supabase.com/dashboard",
            "connection_string_format": "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres",
            "env_var_name": "DB_URL",
        }
    )
