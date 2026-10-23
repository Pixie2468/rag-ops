# Build stage
FROM python:3.12-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency specification
COPY pyproject.toml ./

# 1. Pre-install lightweight CPU PyTorch directly from official wheel index
#    This prevents downloading ~3.5GB of unused CUDA/NVIDIA libraries.
RUN uv venv /app/.venv && \
    uv pip install --no-cache --python /app/.venv/bin/python torch --index-url https://download.pytorch.org/whl/cpu

# 2. Install project dependencies into the virtual environment
RUN uv pip install --no-cache --python /app/.venv/bin/python -r <(uv pip compile pyproject.toml) && \
    /app/.venv/bin/python -m spacy download en_core_web_sm

# 3. Copy source and install rag_ops package
COPY . .
RUN uv pip install --no-cache --no-deps --python /app/.venv/bin/python -e .


# Runtime stage
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy the virtual env and application files from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/alembic /app/alembic
COPY --from=builder /app/alembic.ini /app/alembic.ini

# Set environment variables for CPU-only lightweight execution
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MALLOC_ARENA_MAX=2 \
    TORCH_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

EXPOSE 8000

# Start API server on port 8000 (overridden by $PORT if set)
CMD ["sh", "-c", "exec uvicorn rag_ops.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
