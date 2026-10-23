"""
Router for trace history and observability metrics.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Response, status

from rag_ops.db.trace_service import (
    clear_traces,
    get_observability_stats,
    get_trace_by_id,
    list_traces,
)
from rag_ops.models.evaluation import (
    TraceItem,
    TraceListResponse,
    TraceStatsResponse,
)

router = APIRouter(prefix="/traces", tags=["observability"])


@router.get("/", response_model=TraceListResponse)
async def get_traces_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    verdict: str | None = Query(default=None, description="Filter by verdict (e.g. Pass, Fail, Refusal)"),
    project_name: str | None = Query(default=None, description="Filter by project name"),
    search: str | None = Query(default=None, description="Search query or answer text"),
) -> TraceListResponse:
    """List historical evaluation traces stored in Supabase / PostgreSQL."""
    data = await list_traces(
        limit=limit,
        offset=offset,
        verdict=verdict,
        project_name=project_name,
        search=search,
    )
    return TraceListResponse(
        total=data["total"],
        limit=data["limit"],
        offset=data["offset"],
        items=[TraceItem(**item) for item in data["items"]],
    )


@router.get("/stats", response_model=TraceStatsResponse)
async def get_stats_endpoint(
    project_name: str | None = Query(default=None, description="Filter stats by project"),
) -> TraceStatsResponse:
    """Retrieve aggregate observability stats, pass rate, and gate failure distributions."""
    stats = await get_observability_stats(project_name=project_name)
    return TraceStatsResponse(**stats)


@router.get("/report")
async def generate_audit_report(
    format: Literal["markdown", "json"] = Query(default="markdown", description="Report format: markdown or json"),
    project_name: str | None = Query(default=None),
) -> Response:
    """
    Generate an executive RAG audit report summarizing system reliability,
    hallucination rates, and gate failures.
    """
    stats = await get_observability_stats(project_name=project_name)
    traces_data = await list_traces(limit=100, project_name=project_name)
    items = traces_data.get("items", [])

    if format == "json":
        report_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "project_name": project_name or "All Projects",
            "summary": stats,
            "recent_traces_sample": items[:10],
        }
        return Response(
            content=json.dumps(report_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="ragops-audit-report.json"'},
        )

    # Markdown format
    lines = [
        f"# RAGOps System Evaluation & Audit Report",
        f"**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}  ",
        f"**Project:** {project_name or 'All Projects'}",
        "",
        "---",
        "",
        "## 1. Executive Summary",
        "",
        f"- **Total Traces Evaluated:** {stats['total_traces']}",
        f"- **Overall Pass Rate:** **{stats['pass_rate_pct']}%** ({stats['passed']} Passed / {stats['failed']} Failed)",
        f"- **Average Model Latency:** {stats['avg_latency_ms']} ms",
        f"- **Average Context Relevance (Q ↔ C):** {stats['avg_relevance_score']}",
        f"- **Average Semantic Faithfulness (C ↔ A):** {stats['avg_faithfulness_ratio']}",
        "",
        "## 2. Gate Failure Breakdown",
        "",
        "| Gate / Stage | Failures | Risk Classification |",
        "|---|---|---|",
    ]

    gate_risks = {
        "stage_1_refusal": "Model Refusal / Guardrail trigger",
        "stage_2_relevance": "Retrieval Error (Context irrelevant to query)",
        "stage_3_groundedness": "Hard Hallucination (Ungrounded facts / numbers)",
        "stage_4_faithfulness": "Logical Contradiction against context",
        "stage_5_judge": "Quality / Nuance / Reasoning Failure (LLM Judge)",
    }

    if stats["failure_stages"]:
        for stage, count in stats["failure_stages"].items():
            risk = gate_risks.get(stage, "Evaluation Gate Failure")
            lines.append(f"| `{stage}` | {count} | {risk} |")
    else:
        lines.append("| *None* | 0 | All evaluated traces passed! |")

    lines.extend([
        "",
        "## 3. Verdict Distribution",
        "",
    ])

    for verdict, count in stats["verdict_distribution"].items():
        pct = round((count / stats["total_traces"]) * 100, 1) if stats["total_traces"] > 0 else 0
        lines.append(f"- **{verdict}:** {count} ({pct}%)")

    lines.extend([
        "",
        "## 4. Key Recommendations",
        "",
    ])

    if stats.get("failure_stages", {}).get("stage_2_relevance", 0) > 0:
        lines.append("- ⚠️ **Improve Chunk Retrieval:** Stage 2 failures indicate retrieved chunks did not match user intent. Consider re-ranking or tuning top-k embedding retrieval.")
    if stats.get("failure_stages", {}).get("stage_3_groundedness", 0) > 0:
        lines.append("- ⚠️ **Address Hallucinated Numbers:** Stage 3 failures indicate numeric statistics in answers not present in retrieved context. Prompt model with strict grounding rules.")
    if stats.get("failure_stages", {}).get("stage_4_faithfulness", 0) > 0:
        lines.append("- ⚠️ **Fix Contradictions:** Stage 4 failures indicate semantic contradictions between context and answer.")
    if not stats.get("failure_stages"):
        lines.append("- ✅ **System Healthy:** All evaluation gates are passing within acceptable thresholds.")

    lines.append("\n---\n*Report generated automatically by RAGOps Observability Engine.*")

    content = "\n".join(lines)
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="ragops-audit-report.md"'},
    )


@router.get("/{trace_id}", response_model=TraceItem)
async def get_single_trace_endpoint(trace_id: str) -> TraceItem:
    """Retrieve full details of a specific evaluation trace."""
    item = await get_trace_by_id(trace_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trace with ID '{trace_id}' not found.",
        )
    return TraceItem(**item)


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_all_traces_endpoint() -> None:
    """Prune all recorded traces from memory and database."""
    await clear_traces()

