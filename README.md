# RAGOps

**RAGOps** is an observability and evaluation platform for Retrieval-Augmented Generation (RAG) pipelines. It captures LLM traces, stores evaluation metrics, and surfaces them through a terminal UI.

```md
rag-ops/
├── backend/        # FastAPI REST API + PostgreSQL (SQLAlchemy / Alembic)
├── cli/            # Go TUI/CLI for exploring traces (cobra + lipgloss)
├── docker-compose.yml
└── .env.example
```

---

## Evaluation Pipeline

RAGOps employs a 5-stage **fail-fast evaluation pipeline** to thoroughly grade the quality of RAG outputs (Query, Context, and Answer).
By layering lightweight deterministic checks before heavier models, the pipeline is both fast and accurate.

1. **Sanity & Refusal Gate** (Regex)
2. **Context Relevance** (Cross-Encoder: `ms-marco-MiniLM`)
3. **Lexical Groundedness** (spaCy NER & Regex)
4. **Semantic Faithfulness** (NLI: `deberta-v3`)
5. **LLM-as-a-Judge** (Google Gemini)

> **Read the full breakdown in [PIPELINE.md](PIPELINE.md).**

---

## Requirements

| Tool | Version |
| --- | --- |
| Docker & Docker Compose | v2.20+ |
| Python + [uv](https://github.com/astral-sh/uv) | 3.12+ (local dev only) |
| Go | 1.22+ (local dev only) |

---

## Installation (TUI)

**Option 1: Homebrew (macOS / Linux)**
The easiest way to install the TUI is via Homebrew:

```bash
brew install Pixie2468/rag-ops/ragops
```

**Option 2: Download Pre-compiled Binary**
You can download the latest pre-compiled executable for your operating system from the [Releases](https://github.com/Pixie2468/rag-ops/releases) page.

**Option 3: Run from source**
If you want to run the CLI directly from source:

```bash
git clone https://github.com/Pixie2468/rag-ops.git
cd rag-ops/cli
go run . --help
```

---

## Quick start (Docker)

```bash
# 1. Copy and configure environment variables
cp .env.example .env

# 2. Start PostgreSQL + backend API
docker compose up --build -d

# 3. Check logs
docker compose logs -f backend

# 4. Open the API
open http://localhost:8000/docs
```

The first startup automatically runs all Alembic migrations before the server starts.

---

## Local development

### Backend

See [`backend/README.md`](backend/README.md) for detailed setup instructions.

```bash
cd backend
uv sync
uv run uvicorn rag_ops.main:app --reload
```

### CLI

See [`cli/README.md`](cli/README.md) for detailed setup instructions.

If you have already cloned the repository:

```bash
cd cli
go run . --help
```

---

## Environment variables

Copy `.env.example` → `.env` and adjust as needed.

| Variable | Default | Description |
| --- | --- | --- |
| `ENV` | `development` | App environment |
| `DB_URL` | — | Full DSN (local dev / overrides compose) |
| `DB_USER` | `ragops` | Postgres username (compose) |
| `DB_PASSWORD` | `ragops` | Postgres password (compose) |
| `DB_NAME` | `eval_results` | Postgres database name (compose) |
| `BACKEND_PORT` | `8000` | Host port for the API |

---

## Docker Compose services

| Service | Image / Build | Port |
| --- | --- | --- |
| `db` | `postgres:17-alpine` | internal |
| `backend` | `./backend/Dockerfile` | `8000` |

---

## License

See [LICENSE](LICENSE).
