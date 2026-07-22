"""
Router for RAG evaluation endpoints.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter

from rag_ops.eval.pipeline import run_pipeline
from rag_ops.models.evaluation import EvalRequest, EvalResponse

router = APIRouter(prefix="/evaluate", tags=["evaluation"])


@router.post("/", response_model=EvalResponse)
async def evaluate_endpoint(request: EvalRequest) -> EvalResponse:
    """
    Run the 5-stage RAG evaluation pipeline.

    Accepts a (query, context_chunks, answer) triad and returns
    the evaluation verdict along with detailed metrics.

    The pipeline is CPU-bound (ML inference), so it is offloaded
    to a thread pool to avoid blocking the async event loop.
    """
    result = await asyncio.to_thread(
        run_pipeline,
        request.query,
        request.context_chunks,
        request.answer,
    )

    return EvalResponse(**result)
