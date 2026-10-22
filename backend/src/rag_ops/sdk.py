"""
RAGOps Python SDK & Decorator.

Use this SDK to integrate RAGOps evaluation and observability directly into
any Python RAG application (e.g. LangChain, LlamaIndex, Haystack, or custom code).

Example usage:
    from rag_ops.sdk import RAGOpsClient, observe

    client = RAGOpsClient(base_url="http://localhost:8000")

    @observe(client=client, project="customer-support")
    def run_rag(question: str):
        # Your custom RAG code here:
        chunks = retrieve_chunks(question)
        answer = generate_llm_answer(question, chunks)
        return {
            "query": question,
            "context_chunks": chunks,
            "answer": answer,
        }

    # Automatically evaluated and logged to Supabase / PostgreSQL!
    result = run_rag("What is your refund policy?")
"""
from __future__ import annotations

import functools
import inspect
import json
import logging
import urllib.error
import urllib.request
from typing import Any, Callable

logger = logging.getLogger(__name__)


class RAGOpsClient:
    """Client for communicating with the RAGOps REST API."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: str | None = None,
        timeout: int = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"RAGOps API error {e.code}: {err_body}") from e
        except Exception as e:
            raise RuntimeError(f"Failed to connect to RAGOps API at {url}: {e}") from e

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {}
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            raise RuntimeError(f"Failed to connect to RAGOps API at {url}: {e}") from e

    def evaluate(
        self,
        query: str,
        context_chunks: list[str],
        answer: str,
        project_name: str = "default-project",
        model: str | None = None,
    ) -> dict[str, Any]:
        """Run 5-stage evaluation and persist trace."""
        return self._post(
            "/evaluate/",
            {
                "query": query,
                "context_chunks": context_chunks,
                "answer": answer,
                "api_key": self.api_key,
                "model": model,
                "project_name": project_name,
            },
        )

    def evaluate_batch(
        self,
        items: list[dict[str, Any]],
        project_name: str = "batch-eval",
        max_concurrency: int = 4,
    ) -> dict[str, Any]:
        """Run batch evaluation over a list of {query, context_chunks, answer} dicts."""
        return self._post(
            "/evaluate/batch",
            {
                "items": items,
                "api_key": self.api_key,
                "project_name": project_name,
                "max_concurrency": max_concurrency,
            },
        )

    def judge(
        self,
        query: str,
        answer: str,
        context: str | None = None,
        context_chunks: list[str] | None = None,
        model: str = "gemini-2.5-flash",
    ) -> dict[str, Any]:
        """Run standalone LLM-as-a-Judge."""
        return self._post(
            "/evaluate/judge",
            {
                "query": query,
                "answer": answer,
                "context": context,
                "context_chunks": context_chunks or [],
                "api_key": self.api_key,
                "model": model,
            },
        )

    def get_stats(self, project_name: str | None = None) -> dict[str, Any]:
        """Retrieve system observability metrics."""
        path = f"/traces/stats?project_name={project_name}" if project_name else "/traces/stats"
        return self._get(path)

    def list_traces(self, limit: int = 50, verdict: str | None = None) -> dict[str, Any]:
        """List historical evaluation traces."""
        query_params = [f"limit={limit}"]
        if verdict:
            query_params.append(f"verdict={verdict}")
        path = f"/traces/?{'&'.join(query_params)}"
        return self._get(path)


def observe(
    client: RAGOpsClient | None = None,
    project: str = "default-project",
    async_eval: bool = True,
) -> Callable:
    """
    Decorator to automatically monitor, evaluate, and trace RAG functions.

    The decorated function should return either:
        - A dict with keys {"query", "context_chunks", "answer"} (or {"query", "context", "answer"}), or
        - A tuple of (answer, context_chunks)
    """
    rag_client = client or RAGOpsClient()

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            result = fn(*args, **kwargs)
            try:
                # Extract Q, C, A
                query, context_chunks, answer = _extract_qca(args, kwargs, result)
                if query and answer:
                    rag_client.evaluate(
                        query=query,
                        context_chunks=context_chunks,
                        answer=answer,
                        project_name=project,
                    )
            except Exception as e:
                logger.warning("RAGOps observe failed to record trace: %s", e)
            return result

        @functools.wraps(fn)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            result = await fn(*args, **kwargs)
            try:
                query, context_chunks, answer = _extract_qca(args, kwargs, result)
                if query and answer:
                    rag_client.evaluate(
                        query=query,
                        context_chunks=context_chunks,
                        answer=answer,
                        project_name=project,
                    )
            except Exception as e:
                logger.warning("RAGOps observe failed to record trace: %s", e)
            return result

        return async_wrapper if inspect.iscoroutinefunction(fn) else sync_wrapper

    return decorator


def _extract_qca(args: tuple, kwargs: dict, result: Any) -> tuple[str, list[str], str]:
    """Helper to extract query, context chunks, and answer."""
    query = kwargs.get("query") or (args[0] if args and isinstance(args[0], str) else "")
    chunks: list[str] = []
    answer = ""

    if isinstance(result, dict):
        query = result.get("query", query)
        answer = result.get("answer", "")
        raw_chunks = result.get("context_chunks") or result.get("context") or []
        if isinstance(raw_chunks, list):
            chunks = [str(c) for c in raw_chunks]
        elif isinstance(raw_chunks, str):
            chunks = [raw_chunks]
    elif isinstance(result, tuple) and len(result) >= 2:
        answer = str(result[0])
        if isinstance(result[1], list):
            chunks = [str(c) for c in result[1]]
        elif isinstance(result[1], str):
            chunks = [result[1]]
    elif isinstance(result, str):
        answer = result

    return str(query), chunks, str(answer)

