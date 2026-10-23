#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Select Python / UV executable
if [ -f "$DIR/.venv/bin/python" ]; then
    PYTHON="$DIR/.venv/bin/python"
elif command -v uv >/dev/null 2>&1; then
    exec uv run uvicorn rag_ops.main:app --reload --host 0.0.0.0 --port "${PORT:-8000}" "$@"
elif [ -f "$HOME/.local/bin/uv" ]; then
    exec "$HOME/.local/bin/uv" run uvicorn rag_ops.main:app --reload --host 0.0.0.0 --port "${PORT:-8000}" "$@"
else
    PYTHON="python3"
fi

export PYTHONPATH="$DIR/src:${PYTHONPATH:-}"
echo "Starting RAG-Ops FastAPI backend via $PYTHON..."
exec "$PYTHON" -m uvicorn rag_ops.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload "$@"

