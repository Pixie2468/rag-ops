"""
Trace persistence and analytics service for RAG evaluations.
Supports Supabase / PostgreSQL with seamless in-memory fallback.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from rag_ops.db.session import get_session_maker
from rag_ops.schemas.project import Project
from rag_ops.schemas.trace import EvaluationScore, Trace

logger = logging.getLogger(__name__)

# Fast in-memory buffer (retains recent 500 traces if DB is offline)
_IN_MEMORY_TRACES: list[dict[str, Any]] = []
_MAX_IN_MEMORY = 500


def _build_trace_dict(
    trace_id: str,
    project_name: str,
    user_query: str,
    context_chunks: list[str],
    llm_response: str,
    verdict: str,
    stage_failed: str | None,
    tags: list[str],
    metrics: dict[str, Any],
    judge_score: int | None,
    judge_reasoning: str | None,
    latency_ms: int = 0,
    created_at: datetime | None = None,
) -> dict[str, Any]:
    """Format trace record dictionary."""
    return {
        "id": trace_id,
        "project_name": project_name,
        "user_query": user_query,
        "context_chunks": context_chunks,
        "llm_response": llm_response,
        "verdict": verdict,
        "stage_failed": stage_failed,
        "tags": tags,
        "metrics": metrics,
        "judge_score": judge_score,
        "judge_reasoning": judge_reasoning,
        "latency_ms": latency_ms,
        "created_at": (created_at or datetime.now(timezone.utc)).isoformat(),
    }


async def save_evaluation_trace(
    user_query: str,
    context_chunks: list[str],
    llm_response: str,
    evaluation_result: dict[str, Any],
    project_name: str = "default-project",
    latency_ms: int = 0,
) -> dict[str, Any]:
    """
    Save an evaluation result as a Trace and EvaluationScores.
    Persists to Supabase/PostgreSQL if connected, and mirrors in memory.
    """
    trace_uuid = uuid.uuid4()
    trace_id_str = str(trace_uuid)

    verdict = evaluation_result.get("verdict", "Unknown")
    stage_failed = evaluation_result.get("stage_failed")
    tags = evaluation_result.get("tags", [])
    metrics = evaluation_result.get("metrics", {})
    judge_score = evaluation_result.get("judge_score")
    judge_reasoning = evaluation_result.get("judge_reasoning")

    now = datetime.now(timezone.utc)

    trace_data = _build_trace_dict(
        trace_id=trace_id_str,
        project_name=project_name,
        user_query=user_query,
        context_chunks=context_chunks,
        llm_response=llm_response,
        verdict=verdict,
        stage_failed=stage_failed,
        tags=tags,
        metrics=metrics,
        judge_score=judge_score,
        judge_reasoning=judge_reasoning,
        latency_ms=latency_ms,
        created_at=now,
    )

    # In-memory record
    _IN_MEMORY_TRACES.insert(0, trace_data)
    if len(_IN_MEMORY_TRACES) > _MAX_IN_MEMORY:
        _IN_MEMORY_TRACES.pop()

    # Try saving to database if connected
    session_maker = get_session_maker()
    if session_maker is not None:
        try:
            async with session_maker() as session:
                # Find or create project
                stmt = select(Project).where(Project.name == project_name)
                result = await session.execute(stmt)
                project = result.scalar_one_or_none()

                if project is None:
                    project = Project(id=uuid.uuid4(), name=project_name)
                    session.add(project)
                    await session.flush()

                # Create Trace
                trace = Trace(
                    id=trace_uuid,
                    project_id=project.id,
                    user_query=user_query,
                    llm_prompt=user_query,
                    llm_response=llm_response,
                    retrieved_contexts={"chunks": context_chunks},
                    latency_ms=latency_ms,
                    usage_metadata={
                        "verdict": verdict,
                        "stage_failed": stage_failed,
                        "tags": tags,
                        "metrics": metrics,
                    },
                    created_at=now,
                )
                session.add(trace)

                # Add evaluation scores
                eval_records = []
                # Record overall verdict score
                eval_records.append(
                    EvaluationScore(
                        id=uuid.uuid4(),
                        trace_id=trace_uuid,
                        metric_name="verdict",
                        score=1.0 if verdict.lower() == "pass" else 0.0,
                        reasoning=f"Final pipeline verdict: {verdict}",
                        evaluator_model="ragops-pipeline",
                        created_at=now,
                    )
                )

                if "max_chunk_score" in metrics:
                    eval_records.append(
                        EvaluationScore(
                            id=uuid.uuid4(),
                            trace_id=trace_uuid,
                            metric_name="context_relevance",
                            score=float(metrics["max_chunk_score"]),
                            reasoning="Cross-encoder Q<->C score",
                            evaluator_model="ms-marco-MiniLM",
                            created_at=now,
                        )
                    )

                if "entity_overlap_pct" in metrics:
                    eval_records.append(
                        EvaluationScore(
                            id=uuid.uuid4(),
                            trace_id=trace_uuid,
                            metric_name="entity_overlap_pct",
                            score=float(metrics["entity_overlap_pct"]),
                            reasoning="spaCy NER overlap percentage",
                            evaluator_model="spacy-ner",
                            created_at=now,
                        )
                    )

                if "entailment_ratio" in metrics:
                    eval_records.append(
                        EvaluationScore(
                            id=uuid.uuid4(),
                            trace_id=trace_uuid,
                            metric_name="semantic_faithfulness",
                            score=float(metrics["entailment_ratio"]),
                            reasoning="NLI DeBERTa entailment ratio",
                            evaluator_model="deberta-v3-nli",
                            created_at=now,
                        )
                    )

                if judge_score is not None:
                    eval_records.append(
                        EvaluationScore(
                            id=uuid.uuid4(),
                            trace_id=trace_uuid,
                            metric_name="llm_judge",
                            score=float(judge_score),
                            reasoning=judge_reasoning,
                            evaluator_model=metrics.get("judge_model", "gemini-2.5-flash"),
                            created_at=now,
                        )
                    )

                session.add_all(eval_records)
                await session.commit()
                logger.info("Saved trace %s to database", trace_id_str)
        except Exception as e:
            logger.warning("Could not persist trace to DB, saved to in-memory fallback: %s", e)

    return trace_data


async def list_traces(
    limit: int = 50,
    offset: int = 0,
    verdict: str | None = None,
    project_name: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    """List recent traces with filtering and pagination."""
    session_maker = get_session_maker()

    # If database is available, read from database
    if session_maker is not None:
        try:
            async with session_maker() as session:
                query = select(Trace).options(selectinload(Trace.project), selectinload(Trace.evaluations))

                if project_name:
                    query = query.join(Project).where(Project.name == project_name)

                if search:
                    pattern = f"%{search}%"
                    query = query.where(Trace.user_query.ilike(pattern) | Trace.llm_response.ilike(pattern))

                query = query.order_by(Trace.created_at.desc())

                total_stmt = select(func.count(Trace.id))
                total_res = await session.execute(total_stmt)
                total_count = total_res.scalar() or 0

                paginated_query = query.limit(limit).offset(offset)
                result = await session.execute(paginated_query)
                traces = result.scalars().all()

                items = []
                for t in traces:
                    meta = t.usage_metadata or {}
                    t_verdict = meta.get("verdict", "Unknown")
                    if verdict and t_verdict.lower() != verdict.lower():
                        continue

                    judge_eval = next((e for e in t.evaluations if e.metric_name == "llm_judge"), None)
                    chunks = (t.retrieved_contexts or {}).get("chunks", [])

                    items.append({
                        "id": str(t.id),
                        "project_name": t.project.name if t.project else "default",
                        "user_query": t.user_query,
                        "context_chunks": chunks,
                        "llm_response": t.llm_response or "",
                        "verdict": t_verdict,
                        "stage_failed": meta.get("stage_failed"),
                        "tags": meta.get("tags", []),
                        "metrics": meta.get("metrics", {}),
                        "judge_score": int(judge_eval.score) if judge_eval else None,
                        "judge_reasoning": judge_eval.reasoning if judge_eval else None,
                        "latency_ms": t.latency_ms or 0,
                        "created_at": t.created_at.isoformat() if t.created_at else None,
                    })

                return {
                    "total": total_count,
                    "limit": limit,
                    "offset": offset,
                    "items": items,
                }
        except Exception as e:
            logger.warning("Error reading traces from DB, falling back to memory: %s", e)

    # In-memory fallback
    filtered = _IN_MEMORY_TRACES
    if verdict:
        filtered = [t for t in filtered if t.get("verdict", "").lower() == verdict.lower()]
    if project_name:
        filtered = [t for t in filtered if t.get("project_name") == project_name]
    if search:
        s = search.lower()
        filtered = [
            t for t in filtered
            if s in t.get("user_query", "").lower() or s in t.get("llm_response", "").lower()
        ]

    paginated = filtered[offset : offset + limit]
    return {
        "total": len(filtered),
        "limit": limit,
        "offset": offset,
        "items": paginated,
    }


async def get_trace_by_id(trace_id: str) -> dict[str, Any] | None:
    """Retrieve full detail for a single trace."""
    session_maker = get_session_maker()

    if session_maker is not None:
        try:
            async with session_maker() as session:
                query = (
                    select(Trace)
                    .options(selectinload(Trace.project), selectinload(Trace.evaluations))
                    .where(Trace.id == uuid.UUID(trace_id))
                )
                res = await session.execute(query)
                t = res.scalar_one_or_none()
                if t is not None:
                    meta = t.usage_metadata or {}
                    judge_eval = next((e for e in t.evaluations if e.metric_name == "llm_judge"), None)
                    return {
                        "id": str(t.id),
                        "project_name": t.project.name if t.project else "default",
                        "user_query": t.user_query,
                        "context_chunks": (t.retrieved_contexts or {}).get("chunks", []),
                        "llm_response": t.llm_response or "",
                        "verdict": meta.get("verdict", "Unknown"),
                        "stage_failed": meta.get("stage_failed"),
                        "tags": meta.get("tags", []),
                        "metrics": meta.get("metrics", {}),
                        "judge_score": int(judge_eval.score) if judge_eval else None,
                        "judge_reasoning": judge_eval.reasoning if judge_eval else None,
                        "latency_ms": t.latency_ms or 0,
                        "created_at": t.created_at.isoformat() if t.created_at else None,
                    }
        except Exception as e:
            logger.warning("Error fetching trace from DB: %s", e)

    for item in _IN_MEMORY_TRACES:
        if item.get("id") == trace_id:
            return item
    return None


async def get_observability_stats(project_name: str | None = None) -> dict[str, Any]:
    """Compute aggregate observability statistics across evaluation traces."""
    traces_data = await list_traces(limit=500, project_name=project_name)
    items = traces_data.get("items", [])

    total = len(items)
    if total == 0:
        return {
            "total_traces": 0,
            "passed": 0,
            "failed": 0,
            "pass_rate_pct": 0.0,
            "avg_latency_ms": 0.0,
            "avg_relevance_score": 0.0,
            "avg_faithfulness_ratio": 0.0,
            "failure_stages": {},
            "verdict_distribution": {},
        }

    passed = sum(1 for t in items if t.get("verdict", "").lower() == "pass")
    failed = total - passed
    pass_rate_pct = round((passed / total) * 100, 1)

    latencies = [t.get("latency_ms", 0) for t in items if t.get("latency_ms")]
    avg_latency_ms = round(sum(latencies) / len(latencies), 1) if latencies else 0.0

    relevances = [
        t["metrics"]["max_chunk_score"]
        for t in items
        if "metrics" in t and "max_chunk_score" in t["metrics"]
    ]
    avg_relevance = round(sum(relevances) / len(relevances), 3) if relevances else 0.0

    faithfulness = [
        t["metrics"]["entailment_ratio"]
        for t in items
        if "metrics" in t and "entailment_ratio" in t["metrics"]
    ]
    avg_faithfulness = round(sum(faithfulness) / len(faithfulness), 3) if faithfulness else 0.0

    failure_stages: dict[str, int] = {}
    verdict_distribution: dict[str, int] = {}

    for t in items:
        v = t.get("verdict", "Unknown")
        verdict_distribution[v] = verdict_distribution.get(v, 0) + 1

        sf = t.get("stage_failed")
        if sf:
            failure_stages[sf] = failure_stages.get(sf, 0) + 1

    return {
        "total_traces": total,
        "passed": passed,
        "failed": failed,
        "pass_rate_pct": pass_rate_pct,
        "avg_latency_ms": avg_latency_ms,
        "avg_relevance_score": avg_relevance,
        "avg_faithfulness_ratio": avg_faithfulness,
        "failure_stages": failure_stages,
        "verdict_distribution": verdict_distribution,
    }


async def clear_traces() -> None:
    """Clear in-memory and database traces."""
    global _IN_MEMORY_TRACES
    _IN_MEMORY_TRACES = []

    session_maker = get_session_maker()
    if session_maker is not None:
        try:
            async with session_maker() as session:
                await session.execute(delete(Trace))
                await session.commit()
        except Exception as e:
            logger.warning("Error clearing database traces: %s", e)

