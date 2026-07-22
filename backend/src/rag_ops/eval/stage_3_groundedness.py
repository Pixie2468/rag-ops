"""
Stage 3: Lexical Groundedness Filters - Regex + spaCy NER overlap (C <-> A).

This module checks if the entities and numbers present in the answer are grounded
in the provided context.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

try:
    import spacy
except ImportError:
    spacy = None


@dataclass
class GroundednessResult:
    """Result of the lexical groundedness check."""

    numbers_grounded: bool
    answer_numbers: list[str]
    context_numbers: list[str]
    ungrounded_numbers: list[str]
    entity_overlap_pct: float
    answer_entities: list[str]
    context_entities: list[str]


# Regex for numbers: \b\d[\d,]*\.?\d*%?\b
_NUMBER_PATTERN = re.compile(r"\b\d[\d,]*\.?\d*%?\b")

_nlp = None


def _get_nlp():
    """Lazy load the spaCy model."""
    global _nlp
    if _nlp is None:
        if spacy is None:
            raise ImportError(
                "spacy is not installed. Please install it to use this module."
            )
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            raise OSError(
                "spaCy model 'en_core_web_sm' not found. "
                "Run `python -m spacy download en_core_web_sm`"
            )
    return _nlp


_TARGET_ENT_TYPES = {
    "ORG", "GPE", "LOC", "PERSON", "NORP", "FAC", "PRODUCT", "EVENT", "DATE"
}


def check_groundedness(context: str, answer: str) -> GroundednessResult:
    """
    Check if numbers and entities in the answer exist in the context.

    Args:
        context: The concatenated text of all context chunks.
        answer: The generated answer.

    Returns:
        GroundednessResult with groundedness metrics.
    """
    # 1. Number extraction
    ans_nums_raw = _NUMBER_PATTERN.findall(answer)
    ctx_nums_raw = _NUMBER_PATTERN.findall(context)

    ans_nums_set = set(ans_nums_raw)
    ctx_nums_set = set(ctx_nums_raw)

    ungrounded_numbers = list(ans_nums_set - ctx_nums_set)
    numbers_grounded = len(ungrounded_numbers) == 0

    # 2. Entity extraction
    nlp = _get_nlp()

    ans_doc = nlp(answer)
    ctx_doc = nlp(context)

    ans_ents = [
        ent.text for ent in ans_doc.ents if ent.label_ in _TARGET_ENT_TYPES
    ]
    ctx_ents = [
        ent.text for ent in ctx_doc.ents if ent.label_ in _TARGET_ENT_TYPES
    ]

    ans_ents_set = set(ans_ents)
    ctx_ents_set = set(ctx_ents)

    union = ans_ents_set | ctx_ents_set
    intersection = ans_ents_set & ctx_ents_set

    if len(union) == 0:
        entity_overlap_pct = 1.0
    else:
        entity_overlap_pct = len(intersection) / len(union)

    return GroundednessResult(
        numbers_grounded=numbers_grounded,
        answer_numbers=ans_nums_raw,
        context_numbers=ctx_nums_raw,
        ungrounded_numbers=ungrounded_numbers,
        entity_overlap_pct=entity_overlap_pct,
        answer_entities=ans_ents,
        context_entities=ctx_ents,
    )
