import asyncio
import os
from logging.config import fileConfig
from typing import cast

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    async_engine_from_config,
)

# Alembic Config object
config = context.config

# Configure logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with DB_URL env var (set by docker-compose)
# Falls back to the value in alembic.ini for local development
from rag_ops.db.session import sanitize_db_url

if os.environ.get("DB_URL"):
    raw_url = sanitize_db_url(os.environ["DB_URL"].strip())
    config.set_main_option("sqlalchemy.url", raw_url)

import rag_ops.schemas
from rag_ops.schemas.base import Base

target_metadata = Base.metadata


def process_revision_directives(context, revision, directives):
    """
    Prevent Alembic from generating empty migration files.
    """
    if getattr(config.cmd_opts, "autogenerate", False):
        script = directives[0]
        if script.upgrade_ops.is_empty():
            directives[:] = []
            print("No schema changes detected.")


# OFFLINE MIGRATIONS
def run_migrations_offline() -> None:
    """
    Run migrations without a live database connection.
    """

    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        process_revision_directives=process_revision_directives,
    )

    with context.begin_transaction():
        context.run_migrations()


# SYNCHRONOUS MIGRATION LOGIC
def do_run_migrations(connection: Connection) -> None:
    """
    Execute migrations using a synchronous SQLAlchemy Connection.
    """

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        process_revision_directives=process_revision_directives,
    )

    with context.begin_transaction():
        context.run_migrations()


# ASYNC MIGRATIONS
async def run_async_migrations(connectable: AsyncEngine) -> None:
    """
    Execute migrations using an AsyncEngine.
    """

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


# ONLINE MIGRATIONS
def run_migrations_online() -> None:
    """
    Run migrations against a live database.
    """

    connectable = config.attributes.get("connection")

    if connectable is None:
        section = cast(
            dict[str, str],
            config.get_section(config.config_ini_section),
        )

        url = config.get_main_option("sqlalchemy.url") or ""
        connect_args = {}
        if "supabase" in url or "ssl=require" in url:
            connect_args["ssl"] = "require"

        connectable = async_engine_from_config(
            section,
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
            connect_args=connect_args,
        )

    if isinstance(connectable, AsyncEngine):
        asyncio.run(run_async_migrations(connectable))

    elif isinstance(connectable, Engine):
        with connectable.connect() as connection:
            do_run_migrations(connection)

    elif isinstance(connectable, Connection):
        do_run_migrations(connectable)

    else:
        raise TypeError(f"Unsupported connection type: {type(connectable)!r}")


# ENTRY POINT
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
