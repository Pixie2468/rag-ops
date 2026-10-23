# RAGOps

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docs.docker.com/compose/)

**RAGOps** is a 100% free and open-source (MIT licensed) observability and evaluation platform for Retrieval-Augmented Generation (RAG) pipelines. It captures LLM traces, executes an automated 5-stage evaluation pipeline, and surfaces metrics through a terminal UI (CLI) and an interactive web dashboard.

> **Local & Self-Hosted First**: Run completely on your own machine or private infrastructure with zero external telemetry and complete data privacy.

```md
rag-ops/
├── backend/        # FastAPI REST API + PostgreSQL (SQLAlchemy / Alembic)
├── cli/            # Go TUI/CLI for exploring traces (cobra + lipgloss)
├── frontend/       # React 19 + Bun + Tailwind evaluation dashboard
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

## Quick Start (Single-Command)

### Option 1: Docker Compose (Web Dashboard + API + Database)

Run the entire platform with one command:

```bash
docker compose up -d
```

That's it!

* **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
* **REST API Server**: [http://localhost:8000](http://localhost:8000)
* **Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

To stop: `docker compose down`

---

### Option 2: Native Development (`./dev.sh`)

If you are developing locally without Docker:

```bash
# Start both backend and frontend hot-reloading together:
./dev.sh
# (or: make dev)
```

---

## Homebrew CLI (`ragops`)

Install the terminal tool:

```bash
brew install Pixie2468/rag-ops/ragops
```

### CLI Commands

```bash
# Start the local Docker stack and launch the web UI in your browser:
ragops up

# Evaluate a RAG interaction from a JSON file:
ragops run data.json

# Check backend, database, and LLM judge health:
ragops status

# Open the Web Dashboard in your default browser:
ragops ui

# Stop the background Docker stack:
ragops down
```

```md
Open `http://localhost:3000` to launch the interactive evaluation playground.

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

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details. Free for both commercial and personal use.
