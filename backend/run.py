#!/usr/bin/env python3
"""
Simple runner script for RAG-Ops FastAPI backend.

Usage:
    python run.py
    python run.py --port 8000
"""
import os
import sys
from pathlib import Path

# Ensure backend/src is on sys.path
backend_dir = Path(__file__).parent.resolve()
src_dir = backend_dir / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", os.environ.get("BACKEND_PORT", 8000)))
    print(f"Starting RAG-Ops FastAPI server on http://{host}:{port} ...")
    uvicorn.run("rag_ops.main:app", host=host, port=port, reload=True)

