"""
Stage 5: LLM-as-a-Judge check using Google Gemini.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class JudgeVerdict(BaseModel):
    """Result of the LLM-as-a-Judge evaluation."""

    reasoning: str
    score: int
    model: str = "gemini-2.5-flash"


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
        # Verify key authentication with a lightweight metadata list call
        _ = list(client.models.list(config={"page_size": 1}))
        return True, "API key verified successfully with Google Gemini."
    except Exception as e:
        err_msg = str(e)
        if "API_KEY_INVALID" in err_msg or "API key not valid" in err_msg:
            return False, "Invalid API key: Google Gemini rejected the provided key."
        return False, f"API key verification failed: {err_msg}"


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
    Run LLM-as-a-Judge evaluation on the RAG output.

    Args:
        query: The user query.
        answer: The generated answer.
        context: The retrieved context.
        entity_overlap_pct: Pre-computed entity overlap percentage.
        entailment_ratio: Pre-computed entailment ratio.
        api_key: Optional Gemini API key. If not provided, it will be read from GEMINI_API_KEY.
        model: Optional model name to use (defaults to gemini-2.5-flash with fallbacks).

    Returns:
        JudgeVerdict with reasoning, score, and model name.
    """
    resolved_key = (api_key or "").strip() or os.environ.get("GEMINI_API_KEY", "").strip()

    if not resolved_key:
        return JudgeVerdict(
            reasoning=(
                "No Gemini API key provided. Please supply an API key in the request "
                "(body `api_key` or `X-API-Key` header), configure it via `/api-key`, "
                "or set the GEMINI_API_KEY environment variable."
            ),
            score=0,
            model=model or "unknown",
        )

    judge_model = model or os.environ.get("GEMINI_JUDGE_MODEL", "gemini-2.5-flash")

    try:
        client = genai.Client(api_key=resolved_key)
    except Exception as e:
        return JudgeVerdict(
            reasoning=f"Error initializing Gemini client: {str(e)}",
            score=0,
            model=judge_model,
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

    candidate_models = [judge_model]
    for fallback in ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]:
        if fallback not in candidate_models:
            candidate_models.append(fallback)

    last_error: Exception | None = None
    for candidate in candidate_models:
        try:
            response = client.models.generate_content(
                model=candidate,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=JudgeVerdict,
                ),
            )
            if not response.text:
                raise ValueError("Empty response from the model.")
            verdict = JudgeVerdict.model_validate_json(response.text)
            verdict.model = candidate
            return verdict
        except Exception as e:
            last_error = e
            err_str = str(e)
            # Try next model candidate if model was not found
            if "NOT_FOUND" in err_str or "not found" in err_str or "404" in err_str:
                logger.warning("Model %s not found, attempting fallback...", candidate)
                continue
            # For auth or rate limit errors, don't keep looping
            break

    return JudgeVerdict(
        reasoning=f"Error calling Gemini API: {str(last_error)}",
        score=0,
        model=judge_model,
    )
