"""
Stage 1: Ingestion & Sanity Gate - Refusal Checking.

This module provides functions to perform string matching against the Answer
to quickly identify common LLM refusal templates.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class RefusalResult:
    """Result of the refusal check."""

    is_refusal: bool
    matched_pattern: str | None


# Precompile regex patterns (case-insensitive) for common LLM refusal templates
_REFUSAL_PATTERNS = [
    re.compile(r"I cannot answer", re.IGNORECASE),
    re.compile(r"I can't answer", re.IGNORECASE),
    re.compile(r"I'm unable to", re.IGNORECASE),
    re.compile(r"I am unable to", re.IGNORECASE),
    re.compile(r"As an AI", re.IGNORECASE),
    re.compile(r"As a language model", re.IGNORECASE),
    re.compile(r"I don't have .* information", re.IGNORECASE),
    re.compile(r"I do not have .* information", re.IGNORECASE),
    re.compile(r"I'm sorry, but I", re.IGNORECASE),
    re.compile(r"I cannot provide", re.IGNORECASE),
    re.compile(r"I can't provide", re.IGNORECASE),
    re.compile(r"I'm not able to", re.IGNORECASE),
    re.compile(r"I am not able to", re.IGNORECASE),
    re.compile(r"my training data", re.IGNORECASE),
    re.compile(r"I cannot assist", re.IGNORECASE),
    re.compile(r"I can't assist", re.IGNORECASE),
    re.compile(r"outside my capabilities", re.IGNORECASE),
]


def check_refusal(answer: str) -> RefusalResult:
    """
    Check if the answer contains any common refusal patterns.

    Args:
        answer: The generated answer from the LLM.

    Returns:
        RefusalResult indicating if it's a refusal and the matched pattern.
    """
    for pattern in _REFUSAL_PATTERNS:
        match = pattern.search(answer)
        if match:
            return RefusalResult(is_refusal=True, matched_pattern=pattern.pattern)

    return RefusalResult(is_refusal=False, matched_pattern=None)
