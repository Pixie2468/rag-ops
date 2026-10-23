"""
Router for RAG evaluation endpoints.
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any

from fastapi import APIRouter, Header, HTTPException, status

from rag_ops.db.trace_service import save_evaluation_trace
from rag_ops.eval.pipeline import run_pipeline
from rag_ops.eval.stage_5_judge import (
    mask_api_key,
    run_judge,
    verify_gemini_api_key,
)
from rag_ops.models.evaluation import (
    ApiKeyConfigRequest,
    ApiKeyConfigResponse,
    BatchEvalRequest,
    BatchEvalResponse,
    CompareRequest,
    CompareResponse,
    EvalRequest,
    EvalResponse,
    JudgeRequest,
    JudgeResponse,
)

router = APIRouter(prefix="/evaluate", tags=["evaluation"])


def _resolve_api_key(
    request_key: str | None = None,
    header_key: str | None = None,
    auth_header: str | None = None,
) -> str | None:
    """Resolve API key in order of precedence: request body -> header -> auth bearer -> env."""
    if request_key and request_key.strip():
        return request_key.strip()
    if header_key and header_key.strip():
        return header_key.strip()
    if auth_header and auth_header.strip():
        stripped = auth_header.strip()
        if stripped.lower().startswith("bearer "):
            token = stripped[7:].strip()
            if token:
                return token
        return stripped
    env_key = (
        os.environ.get("LLM_API_KEY", "").strip()
        or os.environ.get("GEMINI_API_KEY", "").strip()
        or os.environ.get("OPENAI_API_KEY", "").strip()
    )
    return env_key if env_key else None


@router.post("/", response_model=EvalResponse)
async def evaluate_endpoint(
    request: EvalRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
) -> EvalResponse:
    """
    Run the 5-stage RAG evaluation pipeline.

    Accepts a (query, context_chunks, answer) triad, runs the gate checks,
    persists the trace and metrics to Supabase / PostgreSQL, and returns the verdict.
    """
    effective_api_key = _resolve_api_key(request.api_key, x_api_key, authorization)

    start_time = time.perf_counter()

    result = await asyncio.to_thread(
        run_pipeline,
        request.query,
        request.context_chunks,
        request.answer,
        effective_api_key,
        request.model,
    )

    latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))

    # Persist trace to database (Supabase / Postgres / in-memory fallback)
    saved_trace = await save_evaluation_trace(
        user_query=request.query,
        context_chunks=request.context_chunks,
        llm_response=request.answer,
        evaluation_result=result,
        project_name=request.project_name,
        latency_ms=latency_ms,
    )

    return EvalResponse(
        **result,
        trace_id=saved_trace.get("id"),
        latency_ms=latency_ms,
    )


@router.post("/batch", response_model=BatchEvalResponse)
async def batch_evaluate_endpoint(
    batch: BatchEvalRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
) -> BatchEvalResponse:
    """
    Run batch evaluation over a dataset of RAG triads.

    Executes concurrently with controlled concurrency, logs all traces
    to Supabase / PostgreSQL, and aggregates accuracy, pass rate, and gate failures.
    """
    if not batch.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch list cannot be empty.",
        )

    effective_api_key = _resolve_api_key(batch.api_key, x_api_key, authorization)
    concurrency_limit = max(1, min(batch.max_concurrency, 10))
    semaphore = asyncio.Semaphore(concurrency_limit)

    start_wall_clock = time.perf_counter()

    async def _evaluate_single(item: EvalRequest) -> EvalResponse:
        async with semaphore:
            item_start = time.perf_counter()
            item_api_key = item.api_key or effective_api_key

            res_dict = await asyncio.to_thread(
                run_pipeline,
                item.query,
                item.context_chunks,
                item.answer,
                item_api_key,
                item.model,
            )

            latency_ms = max(1, int((time.perf_counter() - item_start) * 1000))

            saved = await save_evaluation_trace(
                user_query=item.query,
                context_chunks=item.context_chunks,
                llm_response=item.answer,
                evaluation_result=res_dict,
                project_name=batch.project_name or item.project_name,
                latency_ms=latency_ms,
            )

            return EvalResponse(
                **res_dict,
                trace_id=saved.get("id"),
                latency_ms=latency_ms,
            )

    results: list[EvalResponse] = await asyncio.gather(*[_evaluate_single(item) for item in batch.items])

    total_duration = time.perf_counter() - start_wall_clock

    total = len(results)
    passed = sum(1 for r in results if r.verdict.lower() == "pass")
    failed = total - passed
    pass_rate_pct = round((passed / total) * 100, 1) if total > 0 else 0.0

    stage_failures: dict[str, int] = {}
    for r in results:
        if r.stage_failed:
            stage_failures[r.stage_failed] = stage_failures.get(r.stage_failed, 0) + 1

    avg_latency = round(sum(r.latency_ms for r in results) / total, 1) if total > 0 else 0.0

    return BatchEvalResponse(
        total=total,
        passed=passed,
        failed=failed,
        pass_rate_pct=pass_rate_pct,
        stage_failures=stage_failures,
        avg_latency_ms=avg_latency,
        total_duration_seconds=round(total_duration, 2),
        results=results,
    )


@router.post("/compare", response_model=CompareResponse)
async def compare_endpoint(
    req: CompareRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
) -> CompareResponse:
    """
    Compare two candidate answers (e.g. Prompt A vs Prompt B, or Model A vs Model B)
    side-by-side using the same context chunks and query.
    """
    effective_api_key = _resolve_api_key(req.api_key, x_api_key, authorization)

    req_a = EvalRequest(
        query=req.query,
        context_chunks=req.context_chunks,
        answer=req.candidate_a.answer,
        api_key=effective_api_key,
        project_name="model-ab-comparison",
    )
    req_b = EvalRequest(
        query=req.query,
        context_chunks=req.context_chunks,
        answer=req.candidate_b.answer,
        api_key=effective_api_key,
        project_name="model-ab-comparison",
    )

    result_a, result_b = await asyncio.gather(
        evaluate_endpoint(req_a, x_api_key=effective_api_key),
        evaluate_endpoint(req_b, x_api_key=effective_api_key),
    )

    # Determine winner
    # Logic: Pass beats Fail. If both pass or both fail, check stage reached, then entailment ratio, then judge score
    score_a = (10 if result_a.verdict.lower() == "pass" else 0) + (result_a.judge_score or 0)
    score_b = (10 if result_b.verdict.lower() == "pass" else 0) + (result_b.judge_score or 0)

    # Compare entailment ratios if available
    ratio_a = float(result_a.metrics.get("entailment_ratio", 0.0))
    ratio_b = float(result_b.metrics.get("entailment_ratio", 0.0))
    score_a += ratio_a
    score_b += ratio_b

    if score_a > score_b + 0.05:
        winner = req.candidate_a.name
        summary = f"{req.candidate_a.name} won with higher verdict and semantic faithfulness."
    elif score_b > score_a + 0.05:
        winner = req.candidate_b.name
        summary = f"{req.candidate_b.name} won with higher verdict and semantic faithfulness."
    else:
        winner = "Tie"
        summary = "Both candidates performed equivalently across the evaluation gates."

    return CompareResponse(
        query=req.query,
        result_a=result_a,
        result_b=result_b,
        winner=winner,
        comparison_summary=summary,
    )


@router.post("/judge", response_model=JudgeResponse)
async def judge_endpoint(
    request: JudgeRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
) -> JudgeResponse:
    """
    Run LLM-as-a-Judge directly on a query, context, and answer.

    Evaluates tone, helpfulness, completeness, and reasoning using Gemini.
    API key can be passed directly in the payload, via `X-API-Key` or `Authorization` header,
    or configured globally via `/evaluate/api-key`.
    """
    effective_api_key = _resolve_api_key(request.api_key, x_api_key, authorization)

    if request.context is not None:
        full_context = request.context
    elif request.context_chunks:
        full_context = "\n".join(request.context_chunks)
    else:
        full_context = ""

    entity_overlap = 100.0 if request.entity_overlap_pct is None else request.entity_overlap_pct
    entailment_ratio = 1.0 if request.entailment_ratio is None else request.entailment_ratio

    verdict = await asyncio.to_thread(
        run_judge,
        query=request.query,
        answer=request.answer,
        context=full_context,
        entity_overlap_pct=entity_overlap,
        entailment_ratio=entailment_ratio,
        api_key=effective_api_key,
        model=request.model,
    )

    return JudgeResponse(
        verdict="Pass" if verdict.score == 1 else "Fail",
        score=verdict.score,
        reasoning=verdict.reasoning,
        model=verdict.model,
        entity_overlap_pct=entity_overlap,
        entailment_ratio=entailment_ratio,
    )


@router.post("/api-key", response_model=ApiKeyConfigResponse)
async def set_api_key(payload: ApiKeyConfigRequest) -> ApiKeyConfigResponse:
    """
    Configure or update the server's Gemini API key used by LLM-as-a-Judge.
    Optionally validates the key with Google Gemini before setting it in the runtime environment.
    """
    clean_key = payload.api_key.strip()
    if not clean_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key cannot be empty.",
        )

    if payload.validate_key:
        is_valid, msg = await asyncio.to_thread(verify_gemini_api_key, clean_key)
        if not is_valid:
            return ApiKeyConfigResponse(
                status="invalid",
                configured=False,
                masked_key=mask_api_key(clean_key),
                message=msg,
            )

    os.environ["GEMINI_API_KEY"] = clean_key

    return ApiKeyConfigResponse(
        status="configured",
        configured=True,
        masked_key=mask_api_key(clean_key),
        message="Gemini API key configured successfully.",
    )


@router.get("/api-key", response_model=ApiKeyConfigResponse)
async def get_api_key_status() -> ApiKeyConfigResponse:
    """
    Check if a Gemini API key is currently configured for LLM-as-a-Judge.
    Does not expose the full key secret.
    """
    current_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not current_key:
        return ApiKeyConfigResponse(
            status="unset",
            configured=False,
            masked_key=None,
            message="No Gemini API key configured. Provide one via POST /evaluate/api-key or GEMINI_API_KEY.",
        )

    return ApiKeyConfigResponse(
        status="configured",
        configured=True,
        masked_key=mask_api_key(current_key),
        message="Gemini API key is configured.",
    )
