# RAGOps Evaluation Pipeline

RAGOps features a 5-stage "fail-fast" evaluation pipeline designed to efficiently assess the quality of Retrieval-Augmented Generation (RAG) outputs. The pipeline is designed to catch simple errors early using lightweight algorithms before falling back to more complex, resource-intensive semantic models.

## Pipeline Architecture

The pipeline consists of the following 5 stages, executed sequentially:

### Stage 1: Ingestion & Sanity Gate (Refusal Checking)

**Goal:** Quickly identify if the LLM generated a refusal rather than a helpful answer.
**Algorithm:** Regular Expressions (Regex).
**How it works:**
The system uses case-insensitive regex patterns to scan the generated answer for common refusal templates, such as *"I cannot answer"*, *"As an AI model"*, and *"I don't have information"*.
**Why:**
This is extremely fast. If the LLM has already refused to answer the prompt, there is no need to run expensive NLP models or LLM judges to evaluate its factual correctness.

### Stage 2: Context Relevance Scoring

**Goal:** Ensure the context retrieved by the RAG system is actually relevant to the user's query.
**Algorithm:** Cross-Encoder Model (`cross-encoder/ms-marco-MiniLM-L-6-v2`).
**How it works:**
The user's query (Q) is paired with each individual context chunk (C) and fed into the MS-MARCO trained MiniLM cross-encoder. The model predicts a relevance score for each pair. If the highest score across all chunks falls below a designated threshold (0.15), the context is deemed irrelevant.
**Why:**
A cross-encoder provides much higher accuracy for sentence pair scoring than standard bi-encoder embeddings, making it excellent for strictly verifying if the retrieved chunks actually answer the question.

### Stage 3: Lexical Groundedness Filters

**Goal:** Verify that specific factual data points (numbers and named entities) in the generated answer appear in the retrieved context.
**Algorithm:** Regex & spaCy Named Entity Recognition (NER).
**How it works:**

1. **Numbers:** Regex `\b\d[\d,]*\.?\d*%?\b` is used to extract all numbers, percentages, and decimals from both the context and the answer.
2. **Entities:** The `en_core_web_sm` spaCy model extracts named entities (e.g., ORG, GPE, LOC, PERSON, DATE) from both the context and the answer.
The system computes an intersection of these extractions to ensure that the factual data in the answer was physically present in the source context.
**Why:**
Lexical overlap is a cheap and deterministic way to catch blatant hallucinations. If the LLM introduces a specific date or person that does not exist anywhere in the context, it is instantly caught.

### Stage 4: Semantic Faithfulness Check

**Goal:** Verify that the meaning of the generated answer is strictly entailed by the context and contains no contradictions.
**Algorithm:** Natural Language Inference (NLI) Cross-Encoder (`cross-encoder/nli-deberta-v3-small`).
**How it works:**
The generated answer is split into individual sentences. Each sentence is paired with the full retrieved context and fed into the DeBERTa-v3 NLI model. The model outputs a probability distribution across three classes: `Contradiction`, `Neutral`, and `Entailment`. If any sentence scores > 0.5 for contradiction, the pipeline flags it. It also tracks the overall ratio of entailed sentences.
**Why:**
While Stage 3 checks for specific entity overlap, it cannot understand semantic meaning. NLI models natively understand if a statement is supported by, or contradicts, a premise text. By splitting the answer into sentences, we achieve granular faithfulness checking.

### Stage 5: LLM-as-a-Judge

**Goal:** Evaluate nuanced, subjective qualities that smaller NLP models struggle with (e.g., tone, helpfulness, completeness, multi-hop reasoning).
**Algorithm:** Generative LLM via Gemini API (`gemini-flash-latest`).
**How it works:**
If the RAG output passes (or is scored by) the preceding algorithmic checks, a final prompt is constructed. This prompt includes the Query, Context, Answer, and the pre-computed metrics from earlier stages (like Entity Overlap Percentage and Entailment Ratio). The Gemini model acts as an expert auditor, returning a boolean Pass/Fail verdict and a detailed reasoning string in a strictly typed JSON schema.
**Why:**
Generative LLMs are powerful but slow and expensive. By placing this stage last, we only use the LLM to judge complex heuristics that require deep contextual reasoning, saving time and money on blatantly bad RAG responses caught in Stages 1-4.
