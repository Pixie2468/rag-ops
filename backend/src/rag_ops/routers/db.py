"""
Database configuration and status endpoints.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, status

from rag_ops.db.session import (
    get_configured_db_url,
    get_db_status,
    init_engine,
    sanitize_db_url,
)
from rag_ops.models.evaluation import DbConfigPayload, DbStatusResponse

router = APIRouter(prefix="/db", tags=["database"])


@router.get("/status", response_model=DbStatusResponse)
async def check_db_status() -> DbStatusResponse:
    """
    Check the connection status to Supabase or PostgreSQL.
    """
    info = get_db_status()
    return DbStatusResponse(
        connected=bool(info.get("connected", False)),
        provider=str(info.get("provider", "none")),
        message=str(info.get("message", "")),
    )


@router.post("/config", response_model=DbStatusResponse)
async def configure_database(payload: DbConfigPayload) -> DbStatusResponse:
    """
    Dynamically configure or update the database connection string (e.g. Supabase)
    and initialize tables without needing to restart the server.
    """
    clean_url = sanitize_db_url(payload.db_url)
    if not clean_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database URL cannot be empty.",
        )

    # Attempt to initialize and connect
    engine = await init_engine(clean_url)
    info = get_db_status()

    if engine is not None and info.get("connected"):
        # Store in environment for persistence during process lifetime
        os.environ["DB_URL"] = clean_url
        return DbStatusResponse(
            connected=True,
            provider=str(info.get("provider", "postgresql")),
            message="Database connected successfully! Tables verified.",
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to database: {info.get('message')}",
        )

