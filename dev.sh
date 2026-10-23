#!/usr/bin/env bash
# ==============================================================================
# RAGOps Local Development Launcher (Backend API + Web Dashboard)
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Colors for terminal output
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
NC="\033[0m" # No Color

echo -e "${BOLD}${CYAN}======================================================${NC}"
echo -e "${BOLD}${CYAN}          Starting RAGOps Local Development           ${NC}"
echo -e "${BOLD}${CYAN}======================================================${NC}"

# Check for .env file
if [ ! -f "$DIR/.env" ] && [ -f "$DIR/.env.example" ]; then
    echo -e "${YELLOW}ℹ️  No .env found. Creating .env from .env.example...${NC}"
    cp "$DIR/.env.example" "$DIR/.env"
fi

# 1. Determine Backend runner
BACKEND_CMD=""
if [ -f "$DIR/backend/.venv/bin/uvicorn" ]; then
    BACKEND_CMD="$DIR/backend/.venv/bin/uvicorn rag_ops.main:app --reload --host 0.0.0.0 --port 8000"
elif command -v uv >/dev/null 2>&1; then
    BACKEND_CMD="uv run --directory backend uvicorn rag_ops.main:app --reload --host 0.0.0.0 --port 8000"
elif [ -f "$HOME/.local/bin/uv" ]; then
    BACKEND_CMD="$HOME/.local/bin/uv run --directory backend uvicorn rag_ops.main:app --reload --host 0.0.0.0 --port 8000"
elif command -v python3 >/dev/null 2>&1; then
    BACKEND_CMD="python3 backend/run.py --port 8000"
else
    echo -e "${YELLOW}⚠️  Python 3 or uv not found. Please install Python 3.12+ or uv.${NC}"
    exit 1
fi

# 2. Determine Frontend runner
FRONTEND_CMD=""
if command -v bun >/dev/null 2>&1; then
    FRONTEND_CMD="bun --hot src/index.ts"
elif [ -f "$HOME/.bun/bin/bun" ]; then
    FRONTEND_CMD="$HOME/.bun/bin/bun --hot src/index.ts"
else
    echo -e "${YELLOW}⚠️  Bun is not installed. To run the frontend, install Bun (curl -fsSL https://bun.sh/install | bash)${NC}"
    echo -e "${YELLOW}    Only the backend API will be started.${NC}"
fi

# Cleanup on exit
PIDS=()
cleanup() {
    echo ""
    echo -e "${BOLD}${YELLOW}Shutting down RAGOps services...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    wait 2>/dev/null || true
    echo -e "${GREEN}✓ All services stopped.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start Backend
echo -e "${BLUE}▶ Starting Backend API (port 8000)...${NC}"
export PYTHONPATH="$DIR/backend/src:${PYTHONPATH:-}"
(cd "$DIR/backend" && $BACKEND_CMD) &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)

# Start Frontend (if bun available)
if [ -n "$FRONTEND_CMD" ]; then
    echo -e "${GREEN}▶ Starting Web Dashboard (port 3000)...${NC}"
    (cd "$DIR/frontend" && $FRONTEND_CMD) &
    FRONTEND_PID=$!
    PIDS+=($FRONTEND_PID)
fi

echo ""
echo -e "${BOLD}${GREEN}✓ RAGOps is running!${NC}"
echo -e "  • ${BOLD}Web Dashboard:${NC}   ${CYAN}http://localhost:3000${NC}"
echo -e "  • ${BOLD}REST API:${NC}        ${CYAN}http://localhost:8000${NC}"
echo -e "  • ${BOLD}Swagger Docs:${NC}    ${CYAN}http://localhost:8000/docs${NC}"
echo -e "  • ${BOLD}CLI TUI Tool:${NC}    ${CYAN}ragops run <file.json>${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"
echo ""

# Wait for processes
wait

