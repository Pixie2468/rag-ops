export interface EvalRequest {
  query: string;
  context_chunks: string[];
  answer: string;
  api_key?: string;
  model?: string;
  project_name?: string;
}

export interface SentenceScore {
  sentence: string;
  label?: string;
  scores?: {
    contradiction: number;
    neutral: number;
    entailment: number;
  };
}

export interface EvalMetrics {
  // Stage 1
  matched_pattern?: string;

  // Stage 2
  max_chunk_score?: number;
  per_chunk_scores?: number[];

  // Stage 3
  numbers_grounded?: boolean;
  answer_numbers?: string[];
  ungrounded_numbers?: string[];
  entity_overlap_pct?: number;
  answer_entities?: string[];
  context_entities?: string[];

  // Stage 4
  entailment_ratio?: number;
  has_contradiction?: boolean;
  per_sentence_scores?: SentenceScore[];

  // Stage 5
  judge_model?: string;

  // Extensible
  [key: string]: unknown;
}

export interface EvalResponse {
  verdict: string;
  stage_failed: string | null;
  tags: string[];
  metrics: EvalMetrics;
  judge_reasoning: string | null;
  judge_score: number | null;
  trace_id?: string;
  latency_ms?: number;
}

export interface BatchEvalRequest {
  items: EvalRequest[];
  api_key?: string;
  project_name?: string;
  max_concurrency?: number;
}

export interface BatchEvalResponse {
  total: number;
  passed: number;
  failed: number;
  pass_rate_pct: number;
  stage_failures: Record<string, number>;
  avg_latency_ms: number;
  total_duration_seconds: number;
  results: EvalResponse[];
}

export interface CandidateAnswer {
  name: string;
  answer: string;
}

export interface CompareRequest {
  query: string;
  context_chunks: string[];
  candidate_a: CandidateAnswer;
  candidate_b: CandidateAnswer;
  api_key?: string;
}

export interface CompareResponse {
  query: string;
  result_a: EvalResponse;
  result_b: EvalResponse;
  winner: string | null;
  comparison_summary: string;
}

export interface TraceItem {
  id: string;
  project_name: string;
  user_query: string;
  context_chunks: string[];
  llm_response: string;
  verdict: string;
  stage_failed: string | null;
  tags: string[];
  metrics: EvalMetrics;
  judge_score: number | null;
  judge_reasoning: string | null;
  latency_ms: number;
  created_at: string | null;
}

export interface TraceListResponse {
  total: number;
  limit: number;
  offset: number;
  items: TraceItem[];
}

export interface TraceStatsResponse {
  total_traces: number;
  passed: number;
  failed: number;
  pass_rate_pct: number;
  avg_latency_ms: number;
  avg_relevance_score: number;
  avg_faithfulness_ratio: number;
  failure_stages: Record<string, number>;
  verdict_distribution: Record<string, number>;
}

export interface DbStatusResponse {
  connected: boolean;
  provider: string;
  message: string;
  supabase_quickstart?: {
    dashboard_url: string;
    connection_string_format: string;
    env_var_name: string;
  };
}

export interface JudgeRequest {
  query: string;
  answer: string;
  context?: string;
  context_chunks?: string[];
  api_key?: string;
  model?: string;
  entity_overlap_pct?: number;
  entailment_ratio?: number;
}

export interface JudgeResponse {
  verdict: string;
  score: number;
  reasoning: string;
  model: string;
  entity_overlap_pct: number;
  entailment_ratio: number;
}

export interface ApiKeyConfigResponse {
  status: "configured" | "invalid" | "error" | "unset";
  configured: boolean;
  masked_key: string | null;
  message: string;
}

export type StageKey =
  | "stage_1_refusal"
  | "stage_2_relevance"
  | "stage_3_groundedness"
  | "stage_4_faithfulness"
  | "stage_5_judge";

export type StageState = "idle" | "running" | "passed" | "failed" | "skipped";

export interface StageDefinition {
  id: StageKey;
  stepNumber: number;
  name: string;
  shortName: string;
  algorithm: string;
  description: string;
  speed: string;
}
