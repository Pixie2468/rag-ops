# Build stage
FROM python:3.12-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first (cache-friendly layer)
COPY pyproject.toml uv.lock ./

# Install dependencies into a virtual environment, no project install yet
RUN uv sync --frozen --no-install-project --no-dev

# Copy the rest of the source
COPY . .

# Install the project itself
RUN uv sync --frozen --no-dev


# Runtime stage
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy the virtual env and project files from the builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/alembic /app/alembic
COPY --from=builder /app/alembic.ini /app/alembic.ini

# Make the venv's binaries available on PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Run DB migrations then start the API server
CMD ["sh", "-c", "alembic upgrade head && uvicorn rag_ops.main:app --host 0.0.0.0 --port 8000"]
