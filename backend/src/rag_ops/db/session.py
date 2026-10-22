"""
Database session and connection management for Supabase / PostgreSQL.
"""
from __future__ import annotations

import logging
import os
import re
from typing import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from rag_ops.schemas.base import Base

logger = logging.getLogger(__name__)

_engine: AsyncEngine | None = None
_session_maker: async_sessionmaker[AsyncSession] | None = None
_db_status: dict[str, str | bool] = {
    "connected": False,
    "provider": "none",
    "message": "Database not initialized",
}


def sanitize_db_url(url: str) -> str:
    """
    Format standard postgresql URLs for asyncpg compatibility,
    especially Supabase connection strings.
    """
    clean = url.strip()
    if not clean:
        return ""

    # Replace prefix with postgresql+asyncpg://
    if clean.startswith("postgres://"):
        clean = "postgresql+asyncpg://" + clean[len("postgres://"):]
    elif clean.startswith("postgresql://"):
        clean = "postgresql+asyncpg://" + clean[len("postgresql://"):]

    # Parse and clean query parameters for asyncpg
    try:
        parsed = urlparse(clean)
        query_params = parse_qs(parsed.query)

        # asyncpg does not support sslmode=require, change to ssl=require or handle via connect_args
        if "sslmode" in query_params:
            mode = query_params.pop("sslmode")[0]
            if mode in ("require", "verify-ca", "verify-full"):
                query_params["ssl"] = ["require"]

        # asyncpg doesn't support pgbouncer parameter in URL
        query_params.pop("pgbouncer", None)

        new_query = urlencode(query_params, doseq=True)
        clean = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment,
        ))
    except Exception as e:
        logger.warning("Failed to parse query params in DB URL: %s", e)

    return clean


def get_configured_db_url() -> str:
    """Get the database URL from environment."""
    raw_url = os.environ.get("DB_URL") or os.environ.get("SUPABASE_DB_URL") or ""
    return sanitize_db_url(raw_url)


async def init_engine(db_url: str | None = None) -> AsyncEngine | None:
    """Initialize or re-initialize the Async SQLAlchemy engine."""
    global _engine, _session_maker, _db_status

    target_url = sanitize_db_url(db_url or get_configured_db_url())

    if not target_url:
        _db_status = {
            "connected": False,
            "provider": "in-memory-fallback",
            "message": "No DB_URL configured. Using fast in-memory trace storage.",
        }
        return None

    try:
        # Supabase and cloud providers require SSL
        connect_args = {}
        if "supabase.co" in target_url or "supabase.com" in target_url or "ssl=require" in target_url:
            connect_args["ssl"] = "require"

        _engine = create_async_engine(
            target_url,
            echo=False,
            pool_pre_ping=True,
            connect_args=connect_args,
        )

        _session_maker = async_sessionmaker(
            bind=_engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )

        # Test connection & ensure tables exist
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        is_supabase = "supabase" in target_url
        _db_status = {
            "connected": True,
            "provider": "supabase" if is_supabase else "postgresql",
            "message": f"Successfully connected to {'Supabase' if is_supabase else 'PostgreSQL'}.",
        }
        logger.info("Database connection established (%s)", _db_status["provider"])
        return _engine

    except Exception as e:
        err_str = str(e)
        logger.error("Failed to connect to database: %s", e)
        if "Network is unreachable" in err_str or "Errno 101" in err_str:
            hint = " (Hint: Supabase Direct Connection uses IPv6. Use the Connection Pooler URL 'aws-0-[region].pooler.supabase.com:5432' for IPv4 compatibility)."
            err_str += hint

        _db_status = {
            "connected": False,
            "provider": "in-memory-fallback",
            "message": f"Connection failed ({err_str}). Using in-memory fallback.",
        }
        _engine = None
        _session_maker = None
        return None


def get_db_status() -> dict[str, str | bool]:
    """Return the current database connection status."""
    return _db_status


def get_session_maker() -> async_sessionmaker[AsyncSession] | None:
    """Return the active session maker if available."""
    return _session_maker


async def get_db_session() -> AsyncGenerator[AsyncSession | None, None]:
    """Dependency for endpoints needing a database session."""
    if _session_maker is None:
        yield None
        return

    async with _session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

