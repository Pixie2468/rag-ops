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

## Requirements

| Tool | Version |
| --- | --- |
| Docker & Docker Compose | v2.20+ |
| Python + [uv](https://github.com/astral-sh/uv) | 3.14+ (local dev only) |
| Go | 1.26+ (local dev only) |

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
