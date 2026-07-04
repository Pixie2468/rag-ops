"""
FastAPI application entry point.
"""

from fastapi import FastAPI

app = FastAPI(
    title="RAG-Ops API",
    description="Observability and evaluation metrics for RAG applications.",
    version="0.1.0",
)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Health check endpoint used by monitoring and readiness probes."""
    return {"status": "ok"}
