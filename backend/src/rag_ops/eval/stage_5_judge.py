"""
Stage 5: LLM-as-a-Judge check.
"""
from __future__ import annotations

import os
from typing import Literal

from pydantic import BaseModel
from google import genai
from google.genai import types


class JudgeVerdict(BaseModel):
    """Result of the LLM-as-a-Judge evaluation."""
    reasoning: str
    score: Literal[0, 1]


def run_judge(
    query: str, 
    answer: str, 
    context: str, 
    entity_overlap_pct: float, 
    entailment_ratio: float,
    api_key: str | None = None
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
        
    Returns:
        JudgeVerdict with reasoning and score.
    """
    if api_key is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        
    try:
        client = genai.Client(api_key=api_key) if api_key else genai.Client()
    except Exception as e:
        return JudgeVerdict(
            reasoning=f"Error initializing Gemini client: {str(e)}",
            score=0,
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

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=JudgeVerdict,
            ),
        )
        if not response.text:
            raise ValueError("Empty response from the model.")
        return JudgeVerdict.model_validate_json(response.text)
    except Exception as e:
        return JudgeVerdict(
            reasoning=f"Error calling Gemini API: {str(e)}",
            score=0,
        )
