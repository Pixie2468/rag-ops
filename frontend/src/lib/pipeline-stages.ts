import type { StageDefinition, StageKey, StageState, EvalResponse } from "@/types/eval";

export const STAGES: StageDefinition[] = [
  {
    id: "stage_1_refusal",
    stepNumber: 1,
    name: "Sanity & Refusal Gate",
    shortName: "Refusal Gate",
    algorithm: "Regex Patterns",
    description: "Detects canned refusal templates (e.g. 'I cannot answer', 'As an AI model').",
    speed: "< 1ms",
  },
  {
    id: "stage_2_relevance",
    stepNumber: 2,
    name: "Context Relevance",
    shortName: "Relevance",
    algorithm: "Cross-Encoder (ms-marco-MiniLM)",
    description: "Pairs Query with each Context Chunk to ensure retrieved data answers the prompt.",
    speed: "~40ms",
  },
  {
    id: "stage_3_groundedness",
    stepNumber: 3,
    name: "Lexical Groundedness",
    shortName: "Groundedness",
    algorithm: "spaCy NER + Regex",
    description: "Verifies numbers and named entities in the answer exist in source context chunks.",
    speed: "~15ms",
  },
  {
    id: "stage_4_faithfulness",
    stepNumber: 4,
    name: "Semantic Faithfulness",
    shortName: "Faithfulness",
    algorithm: "NLI Cross-Encoder (DeBERTa-v3)",
    description: "Splits answer into sentences to detect logical contradictions and compute entailment ratio.",
    speed: "~80ms",
  },
  {
    id: "stage_5_judge",
    stepNumber: 5,
    name: "LLM-as-a-Judge",
    shortName: "LLM Judge",
    algorithm: "Google Gemini Flash",
    description: "Evaluates multi-hop reasoning, nuance, and qualitative depth with structured reasoning.",
    speed: "~400ms",
  },
];

export function getStageStates(
  isLoading: boolean,
  currentRunningIndex: number,
  response: EvalResponse | null
): Record<StageKey, StageState> {
  const result: Record<StageKey, StageState> = {
    stage_1_refusal: "idle",
    stage_2_relevance: "idle",
    stage_3_groundedness: "idle",
    stage_4_faithfulness: "idle",
    stage_5_judge: "idle",
  };

  if (isLoading) {
    STAGES.forEach((stage, idx) => {
      if (idx < currentRunningIndex) {
        result[stage.id] = "passed";
      } else if (idx === currentRunningIndex) {
        result[stage.id] = "running";
      } else {
        result[stage.id] = "idle";
      }
    });
    return result;
  }

  if (!response) {
    return result;
  }

  const stageKeys: StageKey[] = [
    "stage_1_refusal",
    "stage_2_relevance",
    "stage_3_groundedness",
    "stage_4_faithfulness",
    "stage_5_judge",
  ];

  if (!response.stage_failed) {
    // If verdict is Pass or no stage failed
    if (response.verdict.toLowerCase() === "fail") {
      stageKeys.forEach((key) => {
        if (key === "stage_5_judge") {
          result[key] = "failed";
        } else {
          result[key] = "passed";
        }
      });
    } else {
      stageKeys.forEach((key) => {
        result[key] = "passed";
      });
    }
    return result;
  }

  const failedIdx = stageKeys.indexOf(response.stage_failed as StageKey);

  stageKeys.forEach((key, idx) => {
    if (failedIdx === -1) {
      result[key] = "passed";
    } else if (idx < failedIdx) {
      result[key] = "passed";
    } else if (idx === failedIdx) {
      result[key] = "failed";
    } else {
      result[key] = "skipped";
    }
  });

  return result;
}

