# RAGOps — Backend

FastAPI REST API that ingests LLM traces and evaluation metrics, backed by PostgreSQL.

It features a 5-stage fail-fast RAG evaluation pipeline for automated answer grading. **See [../PIPELINE.md](../PIPELINE.md) for an in-depth breakdown of the evaluation stages and algorithms.**

## Stack

| Library | Purpose |
| ------- | ------- |
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
# Any of these commands will work:
./run.sh
# or: python run.py
# or: make backend-dev
# or: uv run uvicorn rag_ops.main:app --reload --port 8000
```

API docs are available at <http://localhost:8000/docs>.

---

## API Endpoints

### 1. Health Check

`GET /health`
Returns service status and whether Gemini LLM Judge is configured:

```json
{
  "status": "ok",
  "service": "rag-ops-api",
  "llm_judge_configured": true
}
```

### 2. Standalone LLM-as-a-Judge Endpoint

`POST /evaluate/judge` *(Alias: `POST /judge`)*

Runs Google Gemini directly as an evaluation judge to audit tone, helpfulness, completeness, and reasoning. Accepts an API key either in the JSON payload or via `X-API-Key` or `Authorization: Bearer <key>` header:

```bash
curl -X POST http://localhost:8000/evaluate/judge \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_GEMINI_API_KEY" \
  -d '{
    "query": "What is the capital of France?",
    "context": "Paris is the capital of France and its largest city.",
    "answer": "The capital of France is Paris."
  }'
```

Response:

```json
{
  "verdict": "Pass",
  "score": 1,
  "reasoning": "The answer directly and accurately answers the question based on the provided context.",
  "model": "gemini-2.5-flash",
  "entity_overlap_pct": 100.0,
  "entailment_ratio": 1.0
}
```

### 3. API Key Configuration Endpoints

`POST /evaluate/api-key` *(Alias: `POST /api-key`)*

Dynamically sets and tests the Gemini API key used by the judge model in the running backend:

```bash
curl -X POST http://localhost:8000/evaluate/api-key \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_GEMINI_API_KEY",
    "validate_key": true
  }'
```

`GET /evaluate/api-key` *(Alias: `GET /api-key`)*

Returns whether a key is configured and its masked representation:

```json
{
  "status": "configured",
  "configured": true,
  "masked_key": "AIza...9xyz",
  "message": "Gemini API key is configured."
}
```

### 4. Full 5-Stage Evaluation Pipeline

`POST /evaluate/`

Runs all 5 stages (Refusal Detection, Context Relevance, Lexical Groundedness, Semantic Faithfulness, and Stage 5 LLM Judge). Accepts `api_key` in the request body, via `X-API-Key` header, or server-configured `GEMINI_API_KEY`. Automatically persists each evaluation trace and metrics to Supabase / PostgreSQL.

### 5. Batch Evaluation & Golden Dataset Benchmark

`POST /evaluate/batch`

Evaluates a dataset of RAG test cases concurrently with controlled concurrency, logs all traces to the database, and computes aggregate pass rates and gate failure distributions:

```bash
curl -X POST http://localhost:8000/evaluate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "support-bot-eval",
    "max_concurrency": 4,
    "items": [
      {
        "query": "What is the return window?",
        "context_chunks": ["Items can be returned within 30 days of purchase."],
        "answer": "You can return items within 30 days."
      },
      {
        "query": "Is shipping free?",
        "context_chunks": ["Standard shipping is free on orders above $50."],
        "answer": "Shipping is completely free for all orders unconditionally."
      }
    ]
  }'
```

### 6. Model & Prompt A/B Comparison

`POST /evaluate/compare`

Evaluates two candidate responses (e.g. Prompt A vs Prompt B, or GPT-4o vs Claude vs Gemini) under identical query and context chunks side-by-side, determining a winner based on gate passage and semantic entailment:

```bash
curl -X POST http://localhost:8000/evaluate/compare \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the speed of sound?",
    "context_chunks": ["The speed of sound in air is approximately 343 meters per second at 20 degrees Celsius."],
    "candidate_a": {
      "name": "Prompt V1 (Concise)",
      "answer": "The speed of sound in air is roughly 343 m/s at 20°C."
    },
    "candidate_b": {
      "name": "Prompt V2 (Hallucinating)",
      "answer": "Sound travels at 1,500 meters per second in air."
    }
  }'
```

### 7. Observability & Trace History

- `GET /traces/`: List recent traces with filtering (`?verdict=Pass`, `?search=keyword`, `?limit=50`).
- `GET /traces/stats`: Aggregate telemetry (overall pass rate %, average latency, average relevance, average faithfulness ratio, gate failure breakdown).
- `GET /traces/report?format=markdown`: Generate and download an executive RAG audit report.
- `GET /traces/{trace_id}`: Inspect single trace telemetry.

### 8. Supabase & Database Configuration

- `GET /db/status`: Check database connection status.
- `POST /db/config`: Dynamically configure or update the database URL at runtime.

---

## Python SDK & Decorator

RAGOps includes a lightweight Python SDK (`rag_ops.sdk`) for zero-friction integration into any LangChain, LlamaIndex, or custom RAG codebase:

```python
from rag_ops.sdk import RAGOpsClient, observe

client = RAGOpsClient(base_url="http://localhost:8000")

# Simply decorate your RAG function:
@observe(client=client, project="customer-service")
def answer_user_question(query: str):
    chunks = my_retriever(query)
    answer = my_llm_chain(query, chunks)
    return {
        "query": query,
        "context_chunks": chunks,
        "answer": answer,
    }

# Function executes normally and sends telemetry & evaluation in the background!
response = answer_user_question("How do I reset my password?")
```

---

## Supabase Quickstart

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings &gt; Database &gt; Connection string &gt; URI**.
3. Copy the URI and set it in `.env`:

   ```bash

   DB_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
   ```

4. Start the backend (`./run.sh`). RAGOps automatically creates the `projects`, `traces`, and `evaluation_scores` tables!

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

```md
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
