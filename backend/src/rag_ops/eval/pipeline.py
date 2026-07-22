"""
Pipeline orchestrator for 5-stage RAG evaluation.

Runs each stage sequentially, short-circuiting on the first failure.
The pipeline processes a (Query, Context, Answer) triad through:

    Stage 1 → Refusal detection        (regex, <1ms)
    Stage 2 → Context relevance        (cross-encoder Q↔C)
    Stage 3 → Lexical groundedness     (regex + NER, C↔A)
    Stage 4 → Semantic faithfulness    (NLI entailment, C↔A)
    Stage 5 → LLM-as-a-Judge          (structured output)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from rag_ops.eval.stage_1_refusal import check_refusal
from rag_ops.eval.stage_2_relevance import score_relevance
from rag_ops.eval.stage_3_groundedness import check_groundedness
from rag_ops.eval.stage_4_faithfulness import check_faithfulness
from rag_ops.eval.stage_5_judge import run_judge

logger = logging.getLogger(__name__)


@dataclass
class EvalResult:
    """Complete evaluation result from the pipeline."""

    verdict: str
    stage_failed: str | None = None
    tags: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    judge_reasoning: str | None = None
    judge_score: int | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to a dictionary for API serialization."""
        return {
            "verdict": self.verdict,
            "stage_failed": self.stage_failed,
            "tags": self.tags,
            "metrics": self.metrics,
            "judge_reasoning": self.judge_reasoning,
            "judge_score": self.judge_score,
        }


def run_pipeline(
    query: str,
    context_chunks: list[str],
    answer: str,
) -> dict[str, Any]:
    """
    Run the full 5-stage evaluation pipeline.

    Each stage acts as a gate — if it detects a problem, the pipeline
    short-circuits and returns immediately without running later stages.

    Args:
        query: The user's original question (Q).
        context_chunks: List of retrieved context chunk strings (C).
        answer: The LLM-generated answer (A).

    Returns:
        A dictionary matching the EvalResponse schema.
    """
    metrics: dict[str, Any] = {}

    # ── Stage 1: Refusal Detection ──────────────────────────────────
    logger.info("Stage 1: Checking for refusal patterns")
    refusal = check_refusal(answer)

    if refusal.is_refusal:
        logger.info(
            "Stage 1 FAILED: Refusal detected (%s)",
            refusal.matched_pattern,
        )
        return EvalResult(
            verdict="Refusal",
            stage_failed="stage_1_refusal",
            tags=["Refusal"],
            metrics={"matched_pattern": refusal.matched_pattern},
        ).to_dict()

    # ── Stage 2: Context Relevance ──────────────────────────────────
    logger.info("Stage 2: Scoring context relevance (Q ↔ C)")
    relevance = score_relevance(query, context_chunks)

    metrics["max_chunk_score"] = relevance.max_score
    metrics["per_chunk_scores"] = relevance.per_chunk_scores

    if not relevance.is_relevant:
        logger.info(
            "Stage 2 FAILED: Max chunk score %.4f below threshold",
            relevance.max_score,
        )
        return EvalResult(
            verdict="Retrieval_Error",
            stage_failed="stage_2_relevance",
            tags=["Retrieval_Error"],
            metrics=metrics,
        ).to_dict()

    # ── Stage 3: Lexical Groundedness ───────────────────────────────
    full_context = "\n".join(context_chunks)

    logger.info("Stage 3: Checking lexical groundedness (C ↔ A)")
    groundedness = check_groundedness(full_context, answer)

    metrics["numbers_grounded"] = groundedness.numbers_grounded
    metrics["answer_numbers"] = groundedness.answer_numbers
    metrics["ungrounded_numbers"] = groundedness.ungrounded_numbers
    metrics["entity_overlap_pct"] = groundedness.entity_overlap_pct
    metrics["answer_entities"] = groundedness.answer_entities
    metrics["context_entities"] = groundedness.context_entities

    if not groundedness.numbers_grounded:
        logger.info(
            "Stage 3 FAILED: Ungrounded numbers found: %s",
            groundedness.ungrounded_numbers,
        )
        return EvalResult(
            verdict="Hard_Hallucination",
            stage_failed="stage_3_groundedness",
            tags=["Hard_Hallucination"],
            metrics=metrics,
        ).to_dict()

    # ── Stage 4: Semantic Faithfulness ──────────────────────────────
    logger.info("Stage 4: Checking semantic faithfulness (C ↔ A)")
    faithfulness = check_faithfulness(full_context, answer)

    metrics["entailment_ratio"] = faithfulness.entailment_ratio
    metrics["has_contradiction"] = faithfulness.has_contradiction
    metrics["per_sentence_scores"] = faithfulness.per_sentence_scores

    if faithfulness.has_contradiction:
        logger.info("Stage 4 FAILED: Logical contradiction detected")
        return EvalResult(
            verdict="Logical_Contradiction",
            stage_failed="stage_4_faithfulness",
            tags=["Logical_Contradiction"],
            metrics=metrics,
        ).to_dict()

    # ── Stage 5: LLM-as-a-Judge ─────────────────────────────────────
    logger.info("Stage 5: Running LLM judge")
    judge_result = run_judge(
        query=query,
        answer=answer,
        context=full_context,
        entity_overlap_pct=groundedness.entity_overlap_pct,
        entailment_ratio=faithfulness.entailment_ratio,
    )

    verdict = "Pass" if judge_result.score == 1 else "Fail"
    logger.info(
        "Stage 5 complete: verdict=%s, score=%d",
        verdict,
        judge_result.score,
    )

    return EvalResult(
        verdict=verdict,
        stage_failed=None,
        tags=[verdict],
        metrics=metrics,
        judge_reasoning=judge_result.reasoning,
        judge_score=judge_result.score,
    ).to_dict()
