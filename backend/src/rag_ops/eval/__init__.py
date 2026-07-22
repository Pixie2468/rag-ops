"""
RAG evaluation pipeline.

Provides a multi-stage, fail-fast evaluation pipeline for
(Query, Context, Answer) triads.
"""
from __future__ import annotations

from rag_ops.eval.pipeline import EvalResult, run_pipeline

__all__ = ["EvalResult", "run_pipeline"]
