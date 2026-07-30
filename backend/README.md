# RAGOps — Backend

FastAPI REST API that ingests LLM traces and evaluation metrics, backed by PostgreSQL. 

It features a 5-stage fail-fast RAG evaluation pipeline for automated answer grading. **See [../PIPELINE.md](../PIPELINE.md) for an in-depth breakdown of the evaluation stages and algorithms.**

## Stack

| Library | Purpose |
|---------|---------|
| FastAPI | HTTP API framework |
| SQLAlchemy (async) | ORM |
| Alembic | Database migrations |
| asyncpg | Async PostgreSQL driver |
| uvicorn | ASGI server |
| sentence-transformers | Cross-encoder relevance / NLI faithfulness scoring |
| spacy | Lexical groundedness and NER overlap |
| google-genai | LLM-as-a-Judge for multi-hop evaluation |
| uv | Dependency & environment management |

---

## Prerequisites

- Python **3.12+**
- [uv](https://github.com/astral-sh/uv) — `pip install uv` or see official install docs
- A running **PostgreSQL** instance

---

## Local setup

```bash
# From the repo root
cd backend

# Install all dependencies (creates .venv automatically)
uv sync

# Install spaCy English language model for NER (required for Stage 3 evaluation)
uv pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl

# Copy environment config
cp ../.env.example ../.env
# Edit DB_URL in .env to point at your local Postgres instance
# Ensure GEMINI_API_KEY is set in .env for Stage 5 LLM-as-a-Judge evaluation

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
│       ├── core/          # Business logic
│       ├── eval/          # 5-Stage Evaluation Pipeline
│       │   ├── pipeline.py
│       │   ├── stage_1_refusal.py
│       │   ├── stage_2_relevance.py
│       │   ├── stage_3_groundedness.py
│       │   ├── stage_4_faithfulness.py
│       │   └── stage_5_judge.py
│       ├── models/        # Pydantic schemas for API requests
│       │   └── evaluation.py
│       ├── routers/       # FastAPI endpoints
│       │   └── evaluate.py
│       └── schemas/       # SQLAlchemy ORM models
│           ├── base.py    # Declarative base
│           ├── project.py # Project model
│           └── trace.py   # Trace + EvaluationScore models
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
  -e GEMINI_API_KEY="your_api_key_here" \
  rag-ops-backend
```
