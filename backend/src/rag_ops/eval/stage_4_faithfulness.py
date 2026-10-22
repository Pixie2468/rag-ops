"""
Stage 4: Semantic Faithfulness Check.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import numpy as np

CrossEncoder: Any = None


@dataclass
class FaithfulnessResult:
    """Result of the semantic faithfulness check."""
    has_contradiction: bool
    entailment_ratio: float
    per_sentence_scores: list[dict[str, Any]]


_model = None

def _get_model() -> Any:
    """Lazy initialization of the cross-encoder model to save memory."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import CrossEncoder as _CE
            _model = _CE("cross-encoder/nli-deberta-v3-small")
        except Exception as e:
            raise ImportError(
                f"Failed to load sentence_transformers for faithfulness check: {e}"
            )
    return _model


def _softmax(x: np.ndarray) -> np.ndarray:
    """Compute softmax values for each sets of scores in x."""
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum(axis=-1, keepdims=True)


def check_faithfulness(context: str, answer: str) -> FaithfulnessResult:
    """
    Check if the answer is semantically faithful to the context.

    Uses an NLI model to check for contradiction and entailment.

    Args:
        context: The retrieved context.
        answer: The generated answer.

    Returns:
        FaithfulnessResult containing the scores.
    """
    model = _get_model()

    # Split answer into sentences
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', answer) if s.strip()]
    
    if not sentences:
        return FaithfulnessResult(
            has_contradiction=False,
            entailment_ratio=0.0,
            per_sentence_scores=[],
        )

    # Prepare inputs for the NLI model
    model_inputs = [(context, sentence) for sentence in sentences]

    # Predict
    logits = model.predict(model_inputs)
    
    # Ensure logits is 2D even if there's only one sentence
    if logits.ndim == 1:
        logits = np.expand_dims(logits, axis=0)
        
    has_contradiction = False
    entailment_count = 0
    per_sentence_scores = []
    
    for i, sentence_logits in enumerate(logits):
        probs = _softmax(sentence_logits)
        
        # Based on instruction: logits for [contradiction, neutral, entailment]
        prob_contradiction = float(probs[0])
        prob_neutral = float(probs[1])
        prob_entailment = float(probs[2])
        
        is_contradiction = prob_contradiction > 0.5
        is_entailment = prob_entailment > 0.5
        
        if is_contradiction:
            has_contradiction = True
        
        if is_entailment:
            entailment_count += 1
            
        per_sentence_scores.append({
            'sentence': sentences[i],
            'contradiction': prob_contradiction,
            'neutral': prob_neutral,
            'entailment': prob_entailment,
        })
        
    entailment_ratio = entailment_count / len(sentences)
    
    return FaithfulnessResult(
        has_contradiction=has_contradiction,
        entailment_ratio=entailment_ratio,
        per_sentence_scores=per_sentence_scores,
    )
