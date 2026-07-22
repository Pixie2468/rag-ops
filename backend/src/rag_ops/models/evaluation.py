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


class EvalResponse(BaseModel):
    """Response model for evaluation."""

    verdict: str = Field(description="The final verdict of the evaluation (e.g., pass, fail).")
    stage_failed: str | None = Field(default=None, description="The stage where the evaluation failed, if any.")
    tags: list[str] = Field(default_factory=list, description="Tags associated with the evaluation.")
    metrics: dict[str, Any] = Field(default_factory=dict, description="Metrics collected during evaluation.")
    judge_reasoning: str | None = Field(default=None, description="Reasoning provided by the LLM judge.")
    judge_score: int | None = Field(default=None, description="Score provided by the LLM judge.")
