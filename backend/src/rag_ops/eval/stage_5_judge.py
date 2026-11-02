"""
Stage 5: LLM-as-a-Judge check using Google Gemini with Tiered Fallback Pool,
cascading down to a local Ollama model as the ultimate fallback.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Ordered from most capable to cheapest/highest throughput
MODEL_FALLBACK_POOL = [
    "gemini-3.8-flash",  # Tier 1: Highest intelligence & complex multi-hop reasoning
    "gemini-3.5-flash",  # Tier 2: Battle-tested, balanced performance & cost
    "gemini-3.5-flash-lite",  # Tier 3: 50% cheaper, high rate limit & lower latency
    "gemini-flash-lite-latest",  # Tier 4: Ultra-cheap emergency fallback
    # Final Tier: Local Ollama model (first model from `ollama list`)
]

# Local Ollama configuration
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_CMD = os.environ.get("OLLAMA_CMD", "ollama")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "90.0"))


class JudgeVerdict(BaseModel):
    """Result of the LLM-as-a-Judge evaluation."""

    reasoning: str
    score: int
    model: str = "gemini-3.5-flash"


def mask_api_key(api_key: str | None) -> str | None:
    """Return a masked representation of an API key for safe display."""
    if not api_key:
        return None
    trimmed = api_key.strip()
    if len(trimmed) <= 8:
        return "********"
    return f"{trimmed[:4]}...{trimmed[-4:]}"


def verify_gemini_api_key(api_key: str) -> tuple[bool, str]:
    """
    Test if a Gemini API key is valid by querying the Gemini API.

    Returns:
        (is_valid, message)
    """
    clean_key = api_key.strip()
    if not clean_key:
        return False, "API key cannot be empty."

    try:
        client = genai.Client(api_key=clean_key)
        _ = list(client.models.list(config={"page_size": 1}))
        return True, "API key verified successfully with Google Gemini."
    except Exception as e:
        err_msg = str(e)
        if "API_KEY_INVALID" in err_msg or "API key not valid" in err_msg:
            return False, "Invalid API key: Google Gemini rejected the provided key."
        return False, f"API key verification failed: {err_msg}"


def is_ollama_server_running(host: str = OLLAMA_HOST) -> bool:
    """Check if the Ollama server is responding to HTTP requests."""
    try:
        req = urllib.request.Request(
            f"{host}/api/tags", headers={"User-Agent": "rag-ops"}
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False


def start_ollama_server(host: str = OLLAMA_HOST, wait_timeout: float = 8.0) -> bool:
    """
    Ensure the Ollama server is running. If not already active, start it via `ollama serve`.

    Returns:
        True if the server is accessible, False otherwise.
    """
    if is_ollama_server_running(host):
        return True

    ollama_bin = (
        shutil.which(OLLAMA_CMD)
        or shutil.which("ollama")
        or "/usr/local/sbin/ollama"
        or "/usr/local/bin/ollama"
    )
    if not (ollama_bin and os.path.exists(ollama_bin)):
        logger.warning("Ollama executable '%s' not found on system PATH.", OLLAMA_CMD)
        return False

    try:
        logger.info("Starting local Ollama server with '%s serve'...", ollama_bin)
        subprocess.Popen(
            [ollama_bin, "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except Exception as e:
        logger.warning("Failed to launch 'ollama serve': %s", e)
        return False

    start_time = time.monotonic()
    while time.monotonic() - start_time < wait_timeout:
        if is_ollama_server_running(host):
            logger.info("Local Ollama server successfully started and responding.")
            return True
        time.sleep(0.5)

    logger.warning(
        "Ollama server did not become responsive within %.1fs.", wait_timeout
    )
    return is_ollama_server_running(host)


def get_first_ollama_model(host: str = OLLAMA_HOST) -> str | None:
    """
    Detect the first model that `ollama list` shows, and select that model.
    Falls back to querying the Ollama /api/tags endpoint if CLI execution fails.

    Returns:
        The model name (e.g. 'qwen3.5:2b', 'llama3:latest'), or None if none found.
    """
    # Ensure server is running so `ollama list` can communicate with daemon
    start_ollama_server(host)

    ollama_bin = (
        shutil.which(OLLAMA_CMD)
        or shutil.which("ollama")
        or "/usr/local/sbin/ollama"
        or "/usr/local/bin/ollama"
    )
    if ollama_bin and os.path.exists(ollama_bin):
        try:
            res = subprocess.run(
                [ollama_bin, "list"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if res.returncode == 0 and res.stdout:
                lines = [
                    line.strip()
                    for line in res.stdout.strip().splitlines()
                    if line.strip()
                ]
                for line in lines:
                    parts = line.split()
                    if not parts:
                        continue
                    # Skip the table header row: "NAME ID SIZE MODIFIED"
                    if parts[0].upper() == "NAME":
                        continue
                    first_model = parts[0]
                    logger.info(
                        "Detected first model from 'ollama list': %s", first_model
                    )
                    return first_model
        except Exception as e:
            logger.warning(
                "Failed running 'ollama list' CLI: %s. Trying /api/tags fallback.", e
            )

    # Fallback to Ollama HTTP API /api/tags
    try:
        req = urllib.request.Request(
            f"{host}/api/tags", headers={"User-Agent": "rag-ops"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                models = data.get("models", [])
                if models and isinstance(models, list):
                    first_model = models[0].get("name") or models[0].get("model")
                    if first_model:
                        logger.info(
                            "Detected first model from Ollama /api/tags: %s",
                            first_model,
                        )
                        return first_model
    except Exception as e:
        logger.warning("Failed querying Ollama /api/tags: %s", e)

    return None


def _parse_ollama_json_verdict(raw_text: str) -> tuple[str, int]:
    """Parse reasoning and score from Ollama's response."""
    text = raw_text.strip()
    if not text:
        return "Empty response received from Ollama model.", 0

    # Strip markdown code blocks if wrapped
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    # Try direct JSON parse
    data: dict[str, Any] = {}
    try:
        data = json.loads(text)
    except Exception:
        # Fallback: search for first JSON object
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except Exception:
                data = {}

    reasoning = str(data.get("reasoning") or "").strip()
    if not reasoning:
        reasoning = text if len(text) < 500 else text[:500] + "..."

    score_val = data.get("score")
    if isinstance(score_val, bool):
        score = 1 if score_val else 0
    elif isinstance(score_val, (int, float)):
        score = 1 if score_val >= 1 else 0
    elif isinstance(score_val, str):
        cleaned = score_val.strip().lower()
        score = 1 if cleaned in ("1", "pass", "true", "yes") else 0
    else:
        # Heuristic fallback based on reasoning keywords
        reasoning_lower = reasoning.lower()
        if "pass" in reasoning_lower and "fail" not in reasoning_lower:
            score = 1
        else:
            score = 0

    return reasoning, score


def run_ollama_judge(
    query: str,
    answer: str,
    context: str,
    entity_overlap_pct: float = 100.0,
    entailment_ratio: float = 1.0,
    model_name: str | None = None,
    host: str = OLLAMA_HOST,
    timeout: float = OLLAMA_TIMEOUT,
) -> JudgeVerdict:
    """
    Run LLM-as-a-Judge evaluation using a local Ollama model.

    If model_name is omitted, it auto-detects the first model returned by `ollama list`.
    """
    # Ensure local server is alive
    server_alive = start_ollama_server(host)
    if not server_alive:
        return JudgeVerdict(
            reasoning=f"Local Ollama server could not be started or is not reachable at {host}.",
            score=0,
            model="ollama",
        )

    # Detect the first model that `ollama list` shows if not specified
    target_model = (
        model_name or os.environ.get("OLLAMA_MODEL") or get_first_ollama_model(host)
    )
    if not target_model:
        return JudgeVerdict(
            reasoning=(
                "No local models found in Ollama. 'ollama list' returned no models. "
                "Please run 'ollama pull <model>' to download a local model."
            ),
            score=0,
            model="ollama",
        )

    logger.info("Running local Ollama judge evaluation with model: %s", target_model)

    prompt = f"""You are an expert RAG evaluation auditor.
Your task is to evaluate a generated answer based on the given query and context.
Raw factual checking has already been done algorithmically. You must focus on evaluating tone, helpfulness, completeness, and subtle multi-hop reasoning.

Query (Q): {query}
Context (C): {context}
Answer (A): {answer}

Pre-computed Metrics:
- Entity Overlap Percentage: {entity_overlap_pct:.2f}%
- Entailment Ratio: {entailment_ratio:.2f}

Score Criteria:
Evaluate the nuanced aspects of the answer (tone, helpfulness, completeness, and multi-hop reasoning). 
A score of 1 means Pass, and 0 means Fail.
You MUST provide your reasoning BEFORE giving the score.
Respond in valid JSON format with keys "reasoning" (string) and "score" (integer: 1 or 0).
"""

    chat_payload = {
        "model": target_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an expert RAG evaluation auditor. You must respond ONLY with a "
                    "valid JSON object with keys 'reasoning' (string) and 'score' (1 for Pass, 0 for Fail)."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.0,
        },
    }

    raw_response_text = ""
    endpoint = f"{host}/api/chat"

    try:
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(chat_payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "rag-ops"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw_response_text = (
                data.get("message", {}).get("content", "")
                or data.get("response", "")
                or data.get("message", {}).get("thinking", "")
                or data.get("thinking", "")
            )
    except Exception as chat_err:
        logger.warning(
            "Ollama /api/chat failed on '%s': %s. Attempting fallback to /api/generate...",
            target_model,
            chat_err,
        )
        # Fallback to /api/generate
        try:
            gen_payload = {
                "model": target_model,
                "prompt": prompt,
                "format": "json",
                "stream": False,
                "options": {
                    "temperature": 0.0,
                },
            }
            req = urllib.request.Request(
                f"{host}/api/generate",
                data=json.dumps(gen_payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "rag-ops"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_response_text = (
                    data.get("response", "") or data.get("thinking", "") or ""
                )
        except Exception as gen_err:
            return JudgeVerdict(
                reasoning=f"Ollama inference failed on model '{target_model}': {str(gen_err)}",
                score=0,
                model=f"ollama/{target_model}",
            )

    # Parse JSON from Ollama response
    reasoning, score = _parse_ollama_json_verdict(raw_response_text)

    return JudgeVerdict(
        reasoning=reasoning,
        score=score,
        model=f"ollama/{target_model}",
    )


def run_judge(
    query: str,
    answer: str,
    context: str,
    entity_overlap_pct: float = 100.0,
    entailment_ratio: float = 1.0,
    api_key: str | None = None,
    model: str | None = None,
) -> JudgeVerdict:
    """
    Run LLM-as-a-Judge evaluation on the RAG output with tiered fallback.

    Cascades through Google Gemini models from highest capability down to cheapest.
    If all Gemini models cannot answer (or if no Gemini key is provided, or on quota/rate-limits/errors),
    it cascades to the local Ollama model, automatically detecting and selecting the first model
    from `ollama list`.

    Args:
        query: The user query.
        answer: The generated answer.
        context: The retrieved context.
        entity_overlap_pct: Pre-computed entity overlap percentage.
        entailment_ratio: Pre-computed entailment ratio.
        api_key: Optional Gemini API key. If not provided, it will be read from GEMINI_API_KEY.
        model: Optional model name to try first (defaults to gemini-3.8-flash with fallbacks).

    Returns:
        JudgeVerdict with reasoning, score, and the exact model that provided the verdict.
    """
    # Check if Ollama model was explicitly requested
    is_explicit_ollama = model is not None and (
        model.lower() == "ollama"
        or model.lower().startswith("ollama/")
        or model.lower().startswith("ollama:")
    )
    if is_explicit_ollama:
        requested_model = model or ""
        ollama_model_override = None
        if "/" in requested_model:
            ollama_model_override = requested_model.split("/", 1)[1].strip() or None
        elif ":" in requested_model and requested_model.lower() != "ollama":
            ollama_model_override = requested_model.split(":", 1)[1].strip() or None
        return run_ollama_judge(
            query=query,
            answer=answer,
            context=context,
            entity_overlap_pct=entity_overlap_pct,
            entailment_ratio=entailment_ratio,
            model_name=ollama_model_override,
        )

    resolved_key = (
        (api_key or "").strip()
        or os.environ.get("LLM_API_KEY", "").strip()
        or os.environ.get("GEMINI_API_KEY", "").strip()
    )

    # If no Gemini API key is configured, cascade directly to local Ollama fallback
    if not resolved_key:
        logger.warning(
            "No Gemini API key provided. Cascading directly to local Ollama fallback model..."
        )
        ollama_verdict = run_ollama_judge(
            query=query,
            answer=answer,
            context=context,
            entity_overlap_pct=entity_overlap_pct,
            entailment_ratio=entailment_ratio,
        )
        if not ollama_verdict.reasoning.startswith(
            "No local models found"
        ) and not ollama_verdict.reasoning.startswith("Local Ollama server"):
            return ollama_verdict

        return JudgeVerdict(
            reasoning=(
                "No LLM API key provided for Google Gemini, and local Ollama fallback was unavailable "
                f"({ollama_verdict.reasoning}). Please supply a Gemini API key or ensure Ollama has a local model."
            ),
            score=0,
            model=ollama_verdict.model or (model or "unknown"),
        )

    initial_model = model or os.environ.get(
        "GEMINI_JUDGE_MODEL", MODEL_FALLBACK_POOL[0]
    )

    try:
        client = genai.Client(api_key=resolved_key)
    except Exception as e:
        logger.warning(
            "Error initializing Gemini client (%s). Cascading to local Ollama fallback model...",
            e,
        )
        return run_ollama_judge(
            query=query,
            answer=answer,
            context=context,
            entity_overlap_pct=entity_overlap_pct,
            entailment_ratio=entailment_ratio,
        )

    prompt = f"""You are an expert RAG evaluation auditor.
Your task is to evaluate a generated answer based on the given query and context.
Raw factual checking has already been done algorithmically. You must focus on evaluating tone, helpfulness, completeness, and subtle multi-hop reasoning.

Query (Q): {query}
Context (C): {context}
Answer (A): {answer}

Pre-computed Metrics:
- Entity Overlap Percentage: {entity_overlap_pct:.2f}%
- Entailment Ratio: {entailment_ratio:.2f}

Score Criteria:
Evaluate the nuanced aspects of the answer (tone, helpfulness, completeness, and multi-hop reasoning). 
A score of 1 means Pass, and 0 means Fail.
You MUST provide your reasoning BEFORE giving the score.
"""

    # Build Gemini fallback ladder
    candidate_models = [initial_model]
    for fallback in MODEL_FALLBACK_POOL:
        if fallback not in candidate_models and fallback.startswith("gemini"):
            candidate_models.append(fallback)

    last_error: Exception | None = None
    for candidate in candidate_models:
        try:
            logger.info("Attempting LLM judge evaluation with model: %s", candidate)
            response = client.models.generate_content(
                model=candidate,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=JudgeVerdict,
                ),
            )
            if not response.text:
                raise ValueError("Empty response received from the model.")

            verdict = JudgeVerdict.model_validate_json(response.text)
            verdict.model = candidate
            return verdict

        except Exception as e:
            last_error = e
            err_str = str(e)

            # If authentication fails, trying other Gemini models won't help
            if (
                "API_KEY_INVALID" in err_str
                or "API key not valid" in err_str
                or "PERMISSION_DENIED" in err_str
            ):
                logger.error("Authentication error on %s: %s", candidate, e)
                break

            # Rate limit (429), High demand (503), Model not found (404), or Server error (500)
            logger.warning(
                "Model '%s' failed (%s). Cascading to next cheaper fallback model...",
                candidate,
                err_str[:120],
            )
            continue

    # All Gemini models failed — cascade to local Ollama model as the final fallback
    logger.warning(
        "All Gemini models in fallback pool %s failed. Cascading to local Ollama model as final fallback...",
        candidate_models,
    )
    try:
        ollama_verdict = run_ollama_judge(
            query=query,
            answer=answer,
            context=context,
            entity_overlap_pct=entity_overlap_pct,
            entailment_ratio=entailment_ratio,
        )
        if not ollama_verdict.reasoning.startswith(
            "No local models found"
        ) and not ollama_verdict.reasoning.startswith("Local Ollama server"):
            return ollama_verdict

        return JudgeVerdict(
            reasoning=(
                f"All Gemini models failed ({str(last_error)}). "
                f"Local Ollama fallback also failed: {ollama_verdict.reasoning}"
            ),
            score=0,
            model=initial_model,
        )
    except Exception as ollama_err:
        logger.error("Local Ollama fallback error: %s", ollama_err)
        return JudgeVerdict(
            reasoning=(
                f"All Gemini models failed ({str(last_error)}). "
                f"Local Ollama fallback also failed: {str(ollama_err)}"
            ),
            score=0,
            model=initial_model,
        )
