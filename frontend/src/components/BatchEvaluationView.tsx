import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { runBatchEvaluationApi } from "@/lib/api";
import type { BatchEvalResponse, EvalRequest } from "@/types/eval";
import {
  Sparkles,
  Upload,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface BatchEvaluationViewProps {
  backendUrl: string;
  apiKey?: string;
}

const SAMPLE_DATASET: EvalRequest[] = [
  {
    query: "What is the capital of France and what is its population?",
    context_chunks: [
      "France is a country in Western Europe. Paris is the capital and most populous city of France.",
      "The official estimated population of Paris is over 2.1 million residents as of recent censuses.",
    ],
    answer: "The capital of France is Paris, which has a population of over 2.1 million residents.",
  },
  {
    query: "What are the requirements to open a bank account?",
    context_chunks: [
      "To open a standard account, applicants must provide a government-issued photo ID and proof of address.",
    ],
    answer: "I am unable to answer this question. Please contact our support team.",
  },
  {
    query: "How many active satellites are orbiting Earth?",
    context_chunks: [
      "As of 2024, there are roughly 9,000 active satellites orbiting Earth according to satellite trackers.",
    ],
    answer: "There are approximately 45,000 active satellites currently in low Earth orbit.",
  },
  {
    query: "Is Python a compiled or interpreted language?",
    context_chunks: [
      "Python is an interpreted, high-level, general-purpose programming language.",
    ],
    answer: "Python is strictly a compiled language like C++ and cannot be run through an interpreter.",
  },
  {
    query: "What is the speed of light in vacuum?",
    context_chunks: [
      "The speed of light in vacuum is defined to be exactly 299,792,458 meters per second.",
    ],
    answer: "The speed of light in vacuum is exactly 299,792,458 m/s.",
  },
];

export function BatchEvaluationView({ backendUrl, apiKey }: BatchEvaluationViewProps) {
  const [dataset, setDataset] = useState<EvalRequest[]>(SAMPLE_DATASET);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchResult, setBatchResult] = useState<BatchEvalResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDataset(parsed as EvalRequest[]);
          setBatchResult(null);
          setErrorMsg(null);
        } else {
          setErrorMsg("JSON file must be an array of test cases.");
        }
      } catch (err) {
        setErrorMsg("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRunBatch = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    setProgress(15);

    try {
      // Fake progressive tick for smooth UX
      const timer = setInterval(() => {
        setProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 400);

      const res = await runBatchEvaluationApi(
        {
          items: dataset,
          api_key: apiKey,
          project_name: "batch-benchmark",
          max_concurrency: 4,
        },
        backendUrl
      );

      clearInterval(timer);
      setProgress(100);
      setBatchResult(res);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Batch evaluation failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Batch Evaluation & Golden Dataset Benchmark
          </h2>
          <p className="text-xs text-muted-foreground">
            Grade dozens or hundreds of test queries in parallel with gate breakdown
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button variant="outline" size="sm" type="button" className="text-xs gap-1.5 pointer-events-none">
              <Upload className="size-3.5" />
              Upload JSON
            </Button>
          </label>

          <Button
            size="sm"
            onClick={handleRunBatch}
            disabled={isRunning || dataset.length === 0}
            className="text-xs gap-1.5"
          >
            <Play className={`size-3.5 ${isRunning ? "animate-spin" : ""}`} />
            {isRunning ? "Running Batch..." : `Run Benchmark (${dataset.length} items)`}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      {/* Progress Bar when running */}
      {isRunning && (
        <div className="rounded-xl border bg-card p-4 shadow-xs space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Evaluating dataset through 5-stage pipeline gates...</span>
            <span className="font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Summary Scorecard if run completed */}
      {batchResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Batch Accuracy</span>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">
              {batchResult.pass_rate_pct}%
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {batchResult.passed} passed / {batchResult.failed} failed
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Test Cases</span>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">
              {batchResult.total}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Total items evaluated
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Execution Time</span>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">
              {batchResult.total_duration_seconds}s
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Avg {batchResult.avg_latency_ms}ms per item
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Failure Breakdown</span>
            <div className="mt-1 text-xs space-y-1">
              {Object.keys(batchResult.stage_failures).length === 0 ? (
                <span className="text-emerald-500 font-medium">Zero failures!</span>
              ) : (
                Object.entries(batchResult.stage_failures).map(([stage, count]) => (
                  <div key={stage} className="flex justify-between font-mono text-[11px]">
                    <span className="text-muted-foreground">{stage.replace("stage_", "S")}:</span>
                    <span className="text-destructive font-semibold">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dataset / Itemized Results List */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="p-3 border-b bg-muted/20 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>{batchResult ? "Itemized Results" : `Loaded Test Dataset (${dataset.length} cases)`}</span>
          <span className="text-[11px] font-mono">Parallel Execution</span>
        </div>

        <div className="divide-y">
          {(batchResult ? batchResult.results : dataset).map((item, idx) => {
            const resultItem = batchResult?.results[idx];
            const isExpanded = expandedIndex === idx;
            const query = "query" in item ? item.query : "";
            const answer = "answer" in item ? item.answer : "";

            return (
              <div key={idx} className="p-3.5 hover:bg-muted/10 transition-colors">
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="flex items-center justify-between cursor-pointer gap-3"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="size-5 rounded-full bg-muted flex items-center justify-center font-mono text-[10px] text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {query}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {answer}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {resultItem && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          resultItem.verdict.toLowerCase() === "pass"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {resultItem.verdict}
                      </Badge>
                    )}
                    {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t text-xs space-y-2 bg-muted/10 p-3 rounded-lg">
                    <div>
                      <span className="font-semibold text-foreground text-[10px] uppercase">Query:</span>
                      <p className="font-sans text-muted-foreground">{query}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground text-[10px] uppercase">Answer:</span>
                      <p className="font-sans text-muted-foreground">{answer}</p>
                    </div>
                    {resultItem?.judge_reasoning && (
                      <div>
                        <span className="font-semibold text-primary text-[10px] uppercase">Judge Feedback:</span>
                        <p className="font-sans text-muted-foreground">{resultItem.judge_reasoning}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

