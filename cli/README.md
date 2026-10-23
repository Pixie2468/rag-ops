# RAGOps — CLI

A terminal UI (TUI) and command-line interface for exploring RAG traces and evaluation results, built with Go.

## Stack

| Library | Purpose |
| ------- | ------- |
| [cobra](https://github.com/spf13/cobra) | CLI command framework |
| [lipgloss](https://github.com/charmbracelet/lipgloss) | TUI styling & layout |
| [bubbletea](https://github.com/charmbracelet/bubbletea) | TUI architecture & event loop |
| [bubbles](https://github.com/charmbracelet/bubbles) | Pre-built TUI components (spinner, progress) |

---

## Prerequisites

- **Go 1.22+**
- A running `rag-ops` backend (see [`backend/README.md`](../backend/README.md))

---

## Installation

**Homebrew (macOS / Linux)**
The easiest way to install the TUI is via Homebrew:

```bash
brew install Pixie2468/rag-ops/ragops
```

**Download Pre-compiled Binary**
You can download the latest pre-compiled executable for your operating system from the [Releases](https://github.com/Pixie2468/rag-ops/releases) page.

---

## Run from Source (development)

If you prefer to run the CLI yourself from the source code:

1. Clone the repository:
  
```bash
git clone https://github.com/Pixie2468/rag-ops.git
cd rag-ops/cli
```

2. Run the application:

```bash
go run . --help
```

---

## Build

```bash
cd cli

# Build for the current platform
go build -o ragops .

# Run the binary
./ragops --help
```

### Cross-compile

```bash
# Linux (amd64)
GOOS=linux GOARCH=amd64 go build -o ragops-linux-amd64 .

# macOS (arm64)
GOOS=darwin GOARCH=arm64 go build -o ragops-darwin-arm64 .

# Windows
GOOS=windows GOARCH=amd64 go build -o ragops.exe .
```

---

## Install system-wide

```bash
cd cli
go install .
# Binary is placed in $(go env GOPATH)/bin — ensure that's on your PATH
ragops --help
```

---

## Project structure

```md
cli/
├── main.go           # Entry point
├── data.json         # Mock data file for testing
├── cmd/
│   ├── root.go       # Root cobra command ("ragops")
│   └── run.go        # Command to execute RAG evaluation
├── internal/
│   ├── api/
│   │   └── client.go # HTTP client for backend
│   └── tui/
│       ├── messages.go  # Bubble Tea messages
│       ├── styles.go    # Lipgloss style definitions
│       └── tui.go       # Bubble Tea UI model and logic
├── go.mod
└── go.sum
```

---

## Usage

```bash
ragops [command] [flags]

Available Commands:
  help        Help about any command
  run         Run the evaluation pipeline with the provided JSON data

Flags:
  -h, --help   help for ragops
```

### Example: Running Evaluation

Execute a local pipeline test using a JSON input file (`data.json`) that contains `query`, `answer`, and `context_chunks`.

```bash
ragops run data.json
```

The CLI will start a TUI tracking the evaluation stages and will print the final JSON result once the pipeline completes.

> **Note**: The CLI is under active development. Additional sub-commands for listing projects, browsing traces, and viewing evaluation scores are coming soon.
