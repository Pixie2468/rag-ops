# RAGOps — CLI

A terminal UI (TUI) and command-line interface for exploring RAG traces and evaluation results, built with Go.

## Stack

| Library | Purpose |
|---------|---------|
| [cobra](https://github.com/spf13/cobra) | CLI command framework |
| [lipgloss](https://github.com/charmbracelet/lipgloss) | TUI styling & layout |

---

## Prerequisites

- **Go 1.26+**
- A running `rag-ops` backend (see [`backend/README.md`](../backend/README.md))

---

## Run (development)

```bash
# From repo root
cd cli

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

```
cli/
├── main.go           # Entry point
├── cmd/
│   └── root.go       # Root cobra command ("ragops")
├── internal/
│   └── tui/
│       ├── messages.go  # Bubble Tea messages
│       └── styles.go    # Lipgloss style definitions
├── go.mod
└── go.sum
```

---

## Usage

```
ragops [command] [flags]

Available Commands:
  help        Help about any command

Flags:
  -h, --help   help for ragops
```

> **Note**: The CLI is under active development. Additional sub-commands for listing projects, browsing traces, and viewing evaluation scores are coming soon.
