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

# Replace heavy CUDA PyTorch with lightweight CPU-only PyTorch for low-memory cloud hosts
RUN uv pip install --no-cache --reinstall torch --index-url https://download.pytorch.org/whl/cpu && \
    uv pip uninstall -y cuda-bindings cuda-toolkit nvidia-cuda-runtime-cu12 nvidia-cuda-cupti-cu12 nvidia-cudnn-cu12 nvidia-cublas-cu12 nvidia-cufft-cu12 nvidia-curand-cu12 nvidia-cusolver-cu12 nvidia-cusparse-cu12 nvidia-nvjitlink-cu12 nvidia-nvtx-cu12 || true

# Download spaCy model
RUN uv pip install pip && uv run python -m spacy download en_core_web_sm


# Runtime stage
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy the virtual env and project files from the builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/alembic /app/alembic
COPY --from=builder /app/alembic.ini /app/alembic.ini

# Make the venv's binaries available on PATH and enforce low memory allocations
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

EXPOSE 10000

# Start the API server directly on Render's port 10000 (tables are auto-created by lifespan)
CMD ["sh", "-c", "exec uvicorn rag_ops.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
