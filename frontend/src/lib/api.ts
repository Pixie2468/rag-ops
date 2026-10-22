import type {
  ApiKeyConfigResponse,
  BatchEvalRequest,
  BatchEvalResponse,
  CompareRequest,
  CompareResponse,
  DbStatusResponse,
  EvalRequest,
  EvalResponse,
  JudgeRequest,
  JudgeResponse,
  TraceListResponse,
  TraceStatsResponse,
} from "@/types/eval";
import { PRESETS } from "./presets";

export const DEFAULT_BACKEND_URL: string =
  (typeof window !== "undefined" && localStorage.getItem("ragops-backend-url")) ||
  (typeof process !== "undefined" && (process.env.BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
  "http://localhost:8000";

export interface HealthCheckResult {
  ok: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  durationMs?: number;
}

export async function checkBackendHealth(
  baseUrl: string = DEFAULT_BACKEND_URL,
  timeoutMs: number = 30000
): Promise<HealthCheckResult> {
  const start = Date.now();
  const cleanUrl = baseUrl.replace(/\/+$/, "");
  // Query param to bypass any intermediate caching
  const healthUrl = `${cleanUrl}/health?_t=${Date.now()}`;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(healthUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(id);

    const durationMs = Date.now() - start;

    if (res.ok) {
      try {
        const data = await res.json();
        return { ok: true, data, statusCode: res.status, durationMs };
      } catch {
        return { ok: true, statusCode: res.status, durationMs };
      }
    } else {
      return {
        ok: false,
        statusCode: res.status,
        error: `Server responded with HTTP ${res.status}: ${res.statusText}`,
        durationMs,
      };
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    let message = err?.message || String(err);
    if (err?.name === "AbortError" || message.includes("aborted")) {
      message = `Probe timed out after ${(timeoutMs / 1000).toFixed(0)}s (cold start in progress)`;
    } else if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      message = `Network error: Could not reach ${cleanUrl}. Check connectivity or CORS.`;
    }
    return {
      ok: false,
      error: message,
      durationMs,
    };
  }
}

export async function wakeUpAndPollBackend(
  baseUrl: string = DEFAULT_BACKEND_URL,
  onProgress?: (info: { elapsedSec: number; attempt: number }) => void,
  maxWaitSec: number = 90
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < maxWaitSec * 1000) {
    attempt++;
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    onProgress?.({ elapsedSec, attempt });

    // Each probe has a 7s timeout
    const result = await checkBackendHealth(baseUrl, 7000);
    if (result.ok) {
      return result;
    }

    // Wait 2 seconds before next probe
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Final check
  return checkBackendHealth(baseUrl, 10000);
}

export async function runEvaluationApi(
  req: EvalRequest,
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<EvalResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/evaluate/`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(req.api_key ? { "X-API-Key": req.api_key } : {}),
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`API responded with status ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as EvalResponse;
}

export async function runBatchEvaluationApi(
  req: BatchEvalRequest,
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<BatchEvalResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/evaluate/batch`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(req.api_key ? { "X-API-Key": req.api_key } : {}),
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Batch API responded with status ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as BatchEvalResponse;
}

export async function runCompareApi(
  req: CompareRequest,
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<CompareResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/evaluate/compare`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(req.api_key ? { "X-API-Key": req.api_key } : {}),
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Comparison API responded with status ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as CompareResponse;
}

export async function runJudgeApi(
  req: JudgeRequest,
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<JudgeResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/evaluate/judge`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(req.api_key ? { "X-API-Key": req.api_key } : {}),
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Judge API responded with status ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as JudgeResponse;
}

export async function fetchTracesApi(
  limit: number = 50,
  offset: number = 0,
  verdict?: string,
  search?: string,
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<TraceListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (verdict) params.append("verdict", verdict);
  if (search) params.append("search", search);

  const url = `${backendUrl.replace(/\/+$/, "")}/traces/?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Traces API error ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as TraceListResponse;
}

export async function fetchTraceStatsApi(
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<TraceStatsResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/traces/stats`;
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Trace Stats API error ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as TraceStatsResponse;
}

export async function fetchDbStatusApi(
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<DbStatusResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/db/status`;
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DB Status API error ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as DbStatusResponse;
}

export async function configureDbApi(
  dbUrl: string,
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<DbStatusResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/db/config`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ db_url: dbUrl }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DB Config error ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as DbStatusResponse;
}

export async function configureApiKeyApi(
  apiKey: string,
  validateKey: boolean = true,
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<ApiKeyConfigResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/evaluate/api-key`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_key: apiKey, validate_key: validateKey }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`API Key config responded with status ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as ApiKeyConfigResponse;
}

export async function getApiKeyStatusApi(
  backendUrl: string = DEFAULT_BACKEND_URL
): Promise<ApiKeyConfigResponse> {
  const url = `${backendUrl.replace(/\/+$/, "")}/evaluate/api-key`;
  const res = await fetch(url, {
    method: "GET",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`API Key status responded with status ${res.status}: ${errText || res.statusText}`);
  }

  return (await res.json()) as ApiKeyConfigResponse;
}

export async function simulateEvaluation(
  req: EvalRequest,
  onStageTick?: (stageIdx: number) => void
): Promise<EvalResponse> {
  const matchingPreset = PRESETS.find(
    (p) =>
      p.data.query.trim().toLowerCase() === req.query.trim().toLowerCase() ||
      p.data.answer.trim().toLowerCase() === req.answer.trim().toLowerCase()
  );

  const targetResponse = matchingPreset
    ? matchingPreset.mockResponse
    : generateDynamicMock(req);

  const stageKeys = [
    "stage_1_refusal",
    "stage_2_relevance",
    "stage_3_groundedness",
    "stage_4_faithfulness",
    "stage_5_judge",
  ];

  const failedIdx = targetResponse.stage_failed
    ? stageKeys.indexOf(targetResponse.stage_failed)
    : 4;

  for (let i = 0; i <= (failedIdx === -1 ? 4 : failedIdx); i++) {
    onStageTick?.(i);
    await new Promise((r) => setTimeout(r, 220));
  }

  return targetResponse;
}

function generateDynamicMock(req: EvalRequest): EvalResponse {
  const refusalPatterns = [
    /as an ai/i,
    /i cannot answer/i,
    /i do not have information/i,
    /i am unable to/i,
  ];

  for (const pat of refusalPatterns) {
    if (pat.test(req.answer)) {
      return {
        verdict: "Refusal",
        stage_failed: "stage_1_refusal",
        tags: ["Refusal"],
        metrics: { matched_pattern: pat.source },
        judge_score: null,
        judge_reasoning: null,
      };
    }
  }

  const numberPattern = /\b\d[\d,]*\.?\d*%?\b/g;
  const answerNumbers = req.answer.match(numberPattern) || [];
  const contextNumbers = new Set(
    req.context_chunks.join(" ").match(numberPattern) || []
  );
  const ungrounded = answerNumbers.filter((n) => !contextNumbers.has(n));

  if (ungrounded.length > 0) {
    return {
      verdict: "Hard_Hallucination",
      stage_failed: "stage_3_groundedness",
      tags: ["Hard_Hallucination"],
      metrics: {
        numbers_grounded: false,
        answer_numbers: answerNumbers,
        ungrounded_numbers: ungrounded,
        entity_overlap_pct: 75.0,
        answer_entities: [],
        context_entities: [],
      },
      judge_score: null,
      judge_reasoning: null,
    };
  }

  return {
    verdict: "Pass",
    stage_failed: null,
    tags: ["Pass"],
    metrics: {
      max_chunk_score: 0.85,
      per_chunk_scores: req.context_chunks.map((_, i) => 0.85 - i * 0.1),
      numbers_grounded: true,
      answer_numbers: answerNumbers,
      ungrounded_numbers: [],
      entity_overlap_pct: 100,
      answer_entities: [],
      context_entities: [],
      entailment_ratio: 1.0,
      has_contradiction: false,
      per_sentence_scores: [
        {
          sentence: req.answer,
          label: "entailment",
          scores: { contradiction: 0.01, neutral: 0.04, entailment: 0.95 },
        },
      ],
    },
    judge_score: 1,
    judge_reasoning:
      "All assertions in the answer are supported by the provided context chunks. No logical contradictions or ungrounded statistics were identified.",
  };
}
