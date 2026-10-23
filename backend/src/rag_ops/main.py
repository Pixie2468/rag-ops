"""
FastAPI application entry point.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, Header, Response
from fastapi.middleware.cors import CORSMiddleware

# Automatically load .env from current directory, backend root, or project root
_curr = Path(__file__).resolve()
for env_candidate in [_curr.parent / ".env", _curr.parents[2] / ".env", _curr.parents[3] / ".env"]:
    if env_candidate.exists():
        load_dotenv(dotenv_path=env_candidate)
        break
else:
    load_dotenv()

from rag_ops.db.session import get_db_status, init_engine
from rag_ops.models.evaluation import (
    ApiKeyConfigRequest,
    ApiKeyConfigResponse,
    JudgeRequest,
    JudgeResponse,
)
from rag_ops.routers.db import router as db_router
from rag_ops.routers.evaluate import (
    get_api_key_status,
    judge_endpoint,
    router as evaluate_router,
    set_api_key,
)
from rag_ops.routers.traces import router as traces_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup & shutdown events."""
    # Attempt to initialize database engine (Supabase / Postgres / in-memory fallback)
    await init_engine()
    yield


app = FastAPI(
    title="RAG-Ops API",
    description="Observability, trace persistence, and evaluation metrics for RAG applications with LLM-as-a-Judge and Supabase.",
    version="0.2.0",
    lifespan=lifespan,
)

# Enable CORS for local development & frontend (allow any web origin including Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Routers
app.include_router(evaluate_router)
app.include_router(traces_router)
app.include_router(db_router)


# Root information
@app.get("/", tags=["system"])
async def root_info() -> dict:
    """System overview and available endpoints."""
    db_info = get_db_status()
    return {
        "name": "RAG-Ops API",
        "version": "0.2.0",
        "status": "healthy",
        "database": db_info,
        "endpoints": {
            "health": "GET /health",
            "full_evaluation": "POST /evaluate/",
            "batch_evaluation": "POST /evaluate/batch",
            "model_comparison": "POST /evaluate/compare",
            "llm_judge": "POST /evaluate/judge (alias: POST /judge)",
            "traces_history": "GET /traces/",
            "traces_stats": "GET /traces/stats",
            "audit_report": "GET /traces/report?format=markdown",
            "database_status": "GET /db/status",
            "api_key_config": "POST /evaluate/api-key (alias: POST /api-key)",
            "api_key_status": "GET /evaluate/api-key (alias: GET /api-key)",
            "docs": "GET /docs",
        },
    }


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check(response: Response) -> dict:
    """Health check endpoint used by monitoring, frontend, and readiness probes."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    has_llm_key = bool(
        os.environ.get("LLM_API_KEY", "").strip()
        or os.environ.get("GEMINI_API_KEY", "").strip()
        or os.environ.get("OPENAI_API_KEY", "").strip()
    )
    db_info = get_db_status()
    return {
        "status": "ok",
        "service": "rag-ops-api",
        "llm_judge_configured": has_llm_key,
        "database_connected": db_info.get("connected", False),
        "database_provider": db_info.get("provider", "in-memory-fallback"),
    }


# Root-level aliases for convenience
@app.post("/judge", response_model=JudgeResponse, tags=["evaluation"], summary="Alias for /evaluate/judge")
async def root_judge_alias(
    request: JudgeRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
) -> JudgeResponse:
    """Convenience alias for /evaluate/judge to run LLM-as-a-Judge directly."""
    return await judge_endpoint(request=request, x_api_key=x_api_key, authorization=authorization)


@app.post("/api-key", response_model=ApiKeyConfigResponse, tags=["configuration"], summary="Alias for /evaluate/api-key")
async def root_set_api_key_alias(payload: ApiKeyConfigRequest) -> ApiKeyConfigResponse:
    """Convenience alias for /evaluate/api-key to configure the Gemini API key."""
    return await set_api_key(payload)


@app.get("/api-key", response_model=ApiKeyConfigResponse, tags=["configuration"], summary="Alias for /evaluate/api-key")
async def root_get_api_key_alias() -> ApiKeyConfigResponse:
    """Convenience alias for /evaluate/api-key to inspect the Gemini API key status."""
    return await get_api_key_status()


# Optional: Mount frontend static build if available for single-port full-stack serving
_frontend_dist = _curr.parents[3] / "frontend" / "dist"
if _frontend_dist.exists() and (_frontend_dist / "index.html").exists():
    from fastapi.staticfiles import StaticFiles
    app.mount("/dashboard", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend_dashboard")



if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", os.environ.get("BACKEND_PORT", 8000)))
    print(f"Starting RAG-Ops FastAPI server on http://{host}:{port} ...")
    uvicorn.run("rag_ops.main:app", host=host, port=port, reload=True)
