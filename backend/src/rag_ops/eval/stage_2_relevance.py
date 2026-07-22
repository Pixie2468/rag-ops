"""
Stage 2: Context Relevance Scoring - Cross-encoder (Q <-> C) scoring.

This module provides functions to evaluate the relevance of the retrieved
context chunks to the user query using a cross-encoder model.
"""
from __future__ import annotations

from dataclasses import dataclass

try:
    from sentence_transformers import CrossEncoder
except ImportError:
    CrossEncoder = None


@dataclass
class RelevanceResult:
    """Result of the relevance check."""

    max_score: float
    per_chunk_scores: list[float]
    is_relevant: bool


_model: CrossEncoder | None = None


def _get_model() -> CrossEncoder:
    """
    Lazy load the cross-encoder model.

    Returns:
        The CrossEncoder instance.
    """
    global _model
    if _model is None:
        if CrossEncoder is None:
            raise ImportError(
                "sentence_transformers is not installed. "
                "Please install it to use this module."
            )
        _model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _model


def score_relevance(
    query: str, chunks: list[str], threshold: float = 0.15
) -> RelevanceResult:
    """
    Score the relevance of each chunk against the query.

    Args:
        query: The user query.
        chunks: A list of retrieved context chunks.
        threshold: The score threshold to determine if relevant.

    Returns:
        RelevanceResult containing scores and relevance boolean.
    """
    if not chunks:
        return RelevanceResult(
            max_score=0.0, per_chunk_scores=[], is_relevant=False
        )

    model = _get_model()

    # CrossEncoder expects pairs of (query, chunk)
    pairs = [(query, chunk) for chunk in chunks]

    # Returns a list/array of floats
    scores = model.predict(pairs)

    if isinstance(scores, float) or getattr(scores, "ndim", 0) == 0:
        scores = [float(scores)]
    else:
        scores = [float(s) for s in scores]

    max_score = max(scores)
    is_relevant = max_score >= threshold

    return RelevanceResult(
        max_score=max_score,
        per_chunk_scores=scores,
        is_relevant=is_relevant,
    )
