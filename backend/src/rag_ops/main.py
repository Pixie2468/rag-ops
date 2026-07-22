"""
FastAPI application entry point.
"""
from __future__ import annotations

from fastapi import FastAPI

from rag_ops.routers.evaluate import router as evaluate_router

app = FastAPI(
    title="RAG-Ops API",
    description="Observability and evaluation metrics for RAG applications.",
    version="0.1.0",
)

app.include_router(evaluate_router)

@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Health check endpoint used by monitoring and readiness probes."""
    return {"status": "ok"}
