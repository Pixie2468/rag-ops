import type { EvalRequest, EvalResponse } from "@/types/eval";

export interface PresetItem {
  id: string;
  name: string;
  tag: string;
  description: string;
  data: EvalRequest;
  mockResponse: EvalResponse;
}

export const PRESETS: PresetItem[] = [
  {
    id: "clean-pass",
    name: "Clean Pass (Factual & Entailed)",
    tag: "Pass",
    description: "High context relevance, fully grounded numbers, 100% entailment ratio, verified by LLM Judge.",
    data: {
      query: "What is the capital of France and what is its population?",
      context_chunks: [
        "France is a country in Western Europe. Paris is the capital and most populous city of France.",
        "As of 2023, the city of Paris has an estimated municipal population of over 2.1 million residents.",
      ],
      answer: "The capital of France is Paris, which has a population of over 2.1 million residents.",
    },
    mockResponse: {
      verdict: "Pass",
      stage_failed: null,
      tags: ["Pass"],
      metrics: {
        max_chunk_score: 0.884,
        per_chunk_scores: [0.884, 0.742],
        numbers_grounded: true,
        answer_numbers: ["2.1"],
        ungrounded_numbers: [],
        entity_overlap_pct: 100,
        answer_entities: ["France", "Paris"],
        context_entities: ["France", "Western Europe", "Paris", "2023"],
        entailment_ratio: 1.0,
        has_contradiction: false,
        per_sentence_scores: [
          {
            sentence: "The capital of France is Paris, which has a population of over 2.1 million residents.",
            label: "entailment",
            scores: { contradiction: 0.002, neutral: 0.012, entailment: 0.986 },
          },
        ],
      },
      judge_score: 1,
      judge_reasoning:
        "The response directly answers the query with facts directly sourced from the provided contexts. Tone is concise and objective, with zero hallucinations or ungrounded assertions.",
    },
  },
  {
    id: "stage-1-refusal",
    name: "Stage 1: Refusal Detected",
    tag: "Refusal",
    description: "The model returns a canned refusal string. Pipeline halts in <1ms without calling heavy models.",
    data: {
      query: "How do I build a custom search engine for my docs?",
      context_chunks: [
        "Open-source vector search engines include Chroma, Qdrant, Milvus, and pgvector.",
        "To build a search engine, embed documents and store vectors in an index.",
      ],
      answer: "As an AI language model, I cannot provide technical instructions or personal recommendations on this topic.",
    },
    mockResponse: {
      verdict: "Refusal",
      stage_failed: "stage_1_refusal",
      tags: ["Refusal"],
      metrics: {
        matched_pattern: "as an ai (language )?model",
      },
      judge_score: null,
      judge_reasoning: null,
    },
  },
  {
    id: "stage-2-retrieval-error",
    name: "Stage 2: Context Irrelevant",
    tag: "Retrieval_Error",
    description: "The retriever retrieved irrelevant chunks. Cross-encoder scores below threshold (0.15).",
    data: {
      query: "What was Acme Corp's operating revenue for Q3 2024?",
      context_chunks: [
        "The annual Acme company picnic will be held on the third Saturday of September in Riverside Park.",
        "Please bring your employee badge and picnic blanket for lunch.",
      ],
      answer: "Acme Corp reported an operating revenue of $42.5 million in Q3 2024.",
    },
    mockResponse: {
      verdict: "Retrieval_Error",
      stage_failed: "stage_2_relevance",
      tags: ["Retrieval_Error"],
      metrics: {
        max_chunk_score: 0.048,
        per_chunk_scores: [0.048, 0.019],
      },
      judge_score: null,
      judge_reasoning: null,
    },
  },
  {
    id: "stage-3-hard-hallucination",
    name: "Stage 3: Lexical Hallucination",
    tag: "Hard_Hallucination",
    description: "Answer contains specific numbers or entities that never appeared in the retrieved contexts.",
    data: {
      query: "When was Python released and how many developers use it?",
      context_chunks: [
        "Python was conceived in the late 1980s by Guido van Rossum at CWI in the Netherlands.",
        "Implementation began in December 1989. Guido van Rossum is its primary designer.",
      ],
      answer: "Python was officially launched in 1991 and is currently used by 8,500,000 developers worldwide.",
    },
    mockResponse: {
      verdict: "Hard_Hallucination",
      stage_failed: "stage_3_groundedness",
      tags: ["Hard_Hallucination"],
      metrics: {
        max_chunk_score: 0.761,
        per_chunk_scores: [0.761, 0.695],
        numbers_grounded: false,
        answer_numbers: ["1991", "8,500,000"],
        ungrounded_numbers: ["1991", "8,500,000"],
        entity_overlap_pct: 66.7,
        answer_entities: ["Python", "Guido van Rossum"],
        context_entities: ["Python", "1980s", "Guido van Rossum", "CWI", "Netherlands", "December 1989"],
      },
      judge_score: null,
      judge_reasoning: null,
    },
  },
  {
    id: "stage-4-contradiction",
    name: "Stage 4: Semantic Contradiction",
    tag: "Logical_Contradiction",
    description: "The sentence directly contradicts the premise context, caught by DeBERTa-v3 NLI.",
    data: {
      query: "Did the company's gross margin improve last quarter?",
      context_chunks: [
        "Due to increased supply chain tariffs and manufacturing delays, gross margins contracted by 4.2% in the second quarter.",
      ],
      answer: "Yes, the company's gross margins improved significantly by 4.2% during the second quarter.",
    },
    mockResponse: {
      verdict: "Logical_Contradiction",
      stage_failed: "stage_4_faithfulness",
      tags: ["Logical_Contradiction"],
      metrics: {
        max_chunk_score: 0.812,
        per_chunk_scores: [0.812],
        numbers_grounded: true,
        answer_numbers: ["4.2%"],
        ungrounded_numbers: [],
        entity_overlap_pct: 100,
        answer_entities: ["second quarter"],
        context_entities: ["second quarter"],
        entailment_ratio: 0.0,
        has_contradiction: true,
        per_sentence_scores: [
          {
            sentence: "Yes, the company's gross margins improved significantly by 4.2% during the second quarter.",
            label: "contradiction",
            scores: { contradiction: 0.942, neutral: 0.038, entailment: 0.02 },
          },
        ],
      },
      judge_score: null,
      judge_reasoning: null,
    },
  },
  {
    id: "stage-5-judge-fail",
    name: "Stage 5: LLM Judge Reject",
    tag: "Fail",
    description: "Nuanced failure (unhelpful tone, evasive reasoning, subtle multi-hop hallucination) caught by Gemini Flash.",
    data: {
      query: "Can you provide the CEO's contact email based on the company directory?",
      context_chunks: [
        "Company Directory: Engineering team can be reached at eng@example.com. For executive inquiries, please submit a form at example.com/contact.",
      ],
      answer: "The CEO can probably be reached at ceo@example.com or john.doe@example.com based on general naming conventions.",
    },
    mockResponse: {
      verdict: "Fail",
      stage_failed: "stage_5_judge",
      tags: ["Fail"],
      metrics: {
        max_chunk_score: 0.62,
        per_chunk_scores: [0.62],
        numbers_grounded: true,
        answer_numbers: [],
        ungrounded_numbers: [],
        entity_overlap_pct: 100,
        answer_entities: [],
        context_entities: ["Engineering", "example.com/contact"],
        entailment_ratio: 0.5,
        has_contradiction: false,
      },
      judge_score: 0,
      judge_reasoning:
        "The model fabricated email addresses ('ceo@example.com', 'john.doe@example.com') based on assumptions rather than directing the user to the verified contact form specified in the source context.",
    },
  },
];

