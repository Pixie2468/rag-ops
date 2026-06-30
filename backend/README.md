# RAGOps — Backend

FastAPI REST API that ingests LLM traces and evaluation metrics, backed by PostgreSQL.

## Stack

| Library | Purpose |
|---------|---------|
| FastAPI | HTTP API framework |
| SQLAlchemy (async) | ORM |
| Alembic | Database migrations |
| asyncpg | Async PostgreSQL driver |
| uvicorn | ASGI server |
| scikit-learn / torch | Evaluation utilities |
| uv | Dependency & environment management |

---

## Prerequisites

- Python **3.14+**
- [uv](https://github.com/astral-sh/uv) — `pip install uv` or see official install docs
- A running **PostgreSQL** instance

---

## Local setup

```bash
# From the repo root
cd backend

# Install all dependencies (creates .venv automatically)
uv sync

# Copy environment config
cp ../.env.example ../.env
# Edit DB_URL in .env to point at your local Postgres instance

# Run database migrations
uv run alembic upgrade head

# Start the development server (auto-reload)
uv run uvicorn rag_ops.main:app --reload --port 8000
```

API docs are available at <http://localhost:8000/docs>.

---

## Database migrations (Alembic)

```bash
# Generate a new migration after changing models
uv run alembic revision --autogenerate -m "describe change"

# Apply all pending migrations
uv run alembic upgrade head

# Roll back one migration
uv run alembic downgrade -1

# Show migration history
uv run alembic history --verbose
```

---

## Project structure

```
backend/
├── src/
│   └── rag_ops/
│       ├── schemas/       # SQLAlchemy ORM models
│       │   ├── base.py    # Declarative base
│       │   ├── project.py # Project model
│       │   └── trace.py   # Trace + EvaluationScore models
│       └── core/          # Business logic (WIP)
├── alembic/               # Migration scripts
│   ├── env.py
│   └── versions/
├── alembic.ini
└── pyproject.toml
```

---

## Docker

The backend is containerised with a two-stage Dockerfile (builder + runtime) to keep the image lean. Run it via the root `docker-compose.yml`:

```bash
# From repo root
docker compose up --build backend
```

Or build the image standalone:

```bash
docker build -t rag-ops-backend ./backend
docker run --rm -p 8000:8000 \
  -e DB_URL="postgresql+asyncpg://user:pass@host/eval_results" \
  rag-ops-backend
```
