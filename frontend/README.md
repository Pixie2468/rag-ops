# RAGOps Frontend

Modern observability and evaluation dashboard for RAG pipelines built with **Bun**, **React 19**, **Tailwind CSS v4**, and **Radix UI**.

Surfaces the 5-stage fail-fast evaluation pipeline in real time with interactive triad testing (Query, Context chunks, Answer), detailed metrics breakdown, and offline simulation support.

---

## Features

- **5-Stage Fail-Fast Visualizer**: Live stepper showing status (`Passed`, `Failed`, `Skipped`, `Running`) across all 5 evaluation gates:
  1. *Sanity & Refusal Gate* (Regex)
  2. *Context Relevance* (Cross-Encoder: `ms-marco-MiniLM`)
  3. *Lexical Groundedness* (Regex numbers + spaCy NER)
  4. *Semantic Faithfulness* (NLI: `deberta-v3`)
  5. *LLM-as-a-Judge* (Google Gemini Flash)
- **Interactive Evaluation Playground**:
  - Triad form editor with dynamic context chunk management
  - Raw JSON mode with validation and formatting
  - JSON file drag-and-drop / upload (supports `data.json`)
  - Keyboard shortcut (`⌘ + Enter` / `Ctrl + Enter`) to run evaluations
- **Built-in Presets**: 1-click test cases for every stage failure and clean pass:
  - Clean Pass (Factual & Entailed)
  - Stage 1: Refusal Detected
  - Stage 2: Context Irrelevant
  - Stage 3: Lexical Hallucination
  - Stage 4: Semantic Contradiction
  - Stage 5: LLM Judge Reject
- **Offline Demo Simulator**: Seamless fallback that models the pipeline latency and stage metrics when the backend is offline.
- **Deep Metrics Inspector**:
  - Max chunk relevance score with 0.15 threshold bar
  - Grounded vs ungrounded number badges
  - Named entity overlap percentage
  - Sentence-level NLI classification (Entailment / Neutral / Contradiction)
  - Full judge reasoning quote card
- **Developer Reproducibility**:
  - 1-click cURL command generator
  - Go TUI / CLI command generation (`ragops run eval.json`)
  - Raw JSON output copy and download
- **Design Baseline**:
  - Fully compliant with `baseline-ui` (no purple gradients, accessible Radix components, `tabular-nums` for metrics, `text-balance` on headings, dark/light theme support).

---

## Getting Started

### Development

```bash
cd frontend
bun install
bun dev
```

The frontend server starts at `http://localhost:3000`.

### Production Build

```bash
cd frontend
bun run build
bun start
```

---

## Backend Integration

By default, the frontend attempts to connect to the FastAPI backend at `http://localhost:8000`.
Requests to `/api/evaluate` and `/api/health` are automatically proxied to the backend.

To point to a custom backend URL:
```bash
BACKEND_URL=http://my-backend:8000 bun dev
```
