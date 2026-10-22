import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { runCompareApi } from "@/lib/api";
import type { CompareResponse } from "@/types/eval";
import {
  Scale,
  Play,
  CheckCircle2,
  Trophy,
  XCircle,
  ArrowRight,
} from "lucide-react";

interface ModelCompareViewProps {
  backendUrl: string;
  apiKey?: string;
}

export function ModelCompareView({ backendUrl, apiKey }: ModelCompareViewProps) {
  const [query, setQuery] = useState("What is the capital of France and what is its population?");
  const [context, setContext] = useState(
    "France is a country in Western Europe. Paris is the capital and largest city of France. Its official population is approximately 2.1 million people."
  );

  const [nameA, setNameA] = useState("Prompt A (Concise)");
  const [answerA, setAnswerA] = useState("The capital of France is Paris, with a population of about 2.1 million people.");

  const [nameB, setNameB] = useState("Prompt B (Verbose / Speculative)");
  const [answerB, setAnswerB] = useState(
    "Paris is France's capital city with over 15 million citizens living in its urban boundary."
  );

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCompare = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await runCompareApi(
        {
          query,
          context_chunks: [context],
          candidate_a: { name: nameA, answer: answerA },
          candidate_b: { name: nameB, answer: answerB },
          api_key: apiKey,
        },
        backendUrl
      );
      setResult(res);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Comparison failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            Model & Prompt A/B Comparison
          </h2>
          <p className="text-xs text-muted-foreground">
            Evaluate two candidate responses head-to-head under identical context and gates
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleCompare}
          disabled={isLoading}
          className="text-xs gap-1.5"
        >
          <Play className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Comparing..." : "Run Head-to-Head Compare"}
        </Button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      {/* Winner Banner */}
      {result && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-primary">Winner:</span>
                <span className="text-base font-bold text-foreground">
                  {result.winner}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.comparison_summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Common Query & Context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border bg-card p-4 shadow-xs">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Common User Query (Q)
          </Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Common Ground Truth Context (C)
          </Label>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            className="text-xs"
          />
        </div>
      </div>

      {/* Side-by-side Candidates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Candidate A */}
        <div className={`rounded-xl border bg-card p-4 shadow-xs space-y-3 ${
          result?.winner === nameA ? "ring-2 ring-emerald-500/50" : ""
        }`}>
          <div className="flex items-center justify-between border-b pb-2">
            <Input
              value={nameA}
              onChange={(e) => setNameA(e.target.value)}
              className="text-xs font-semibold h-7 w-48"
            />
            {result?.result_a && (
              <Badge
                variant="outline"
                className={
                  result.result_a.verdict.toLowerCase() === "pass"
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    : "border-destructive/30 text-destructive bg-destructive/10"
                }
              >
                {result.result_a.verdict}
              </Badge>
            )}
          </div>

          <Textarea
            value={answerA}
            onChange={(e) => setAnswerA(e.target.value)}
            rows={4}
            className="text-xs font-sans"
            placeholder="Candidate A Answer"
          />

          {result?.result_a && (
            <div className="rounded-lg bg-muted/20 p-2.5 space-y-1.5 border text-xs">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Entailment Ratio:</span>
                <span className="font-semibold">{result.result_a.metrics.entailment_ratio ?? "N/A"}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Numbers Grounded:</span>
                <span>{result.result_a.metrics.numbers_grounded ? "✅ Yes" : "❌ No"}</span>
              </div>
              {result.result_a.judge_reasoning && (
                <p className="text-[11px] text-muted-foreground pt-1 border-t line-clamp-2">
                  {result.result_a.judge_reasoning}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Candidate B */}
        <div className={`rounded-xl border bg-card p-4 shadow-xs space-y-3 ${
          result?.winner === nameB ? "ring-2 ring-emerald-500/50" : ""
        }`}>
          <div className="flex items-center justify-between border-b pb-2">
            <Input
              value={nameB}
              onChange={(e) => setNameB(e.target.value)}
              className="text-xs font-semibold h-7 w-48"
            />
            {result?.result_b && (
              <Badge
                variant="outline"
                className={
                  result.result_b.verdict.toLowerCase() === "pass"
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    : "border-destructive/30 text-destructive bg-destructive/10"
                }
              >
                {result.result_b.verdict}
              </Badge>
            )}
          </div>

          <Textarea
            value={answerB}
            onChange={(e) => setAnswerB(e.target.value)}
            rows={4}
            className="text-xs font-sans"
            placeholder="Candidate B Answer"
          />

          {result?.result_b && (
            <div className="rounded-lg bg-muted/20 p-2.5 space-y-1.5 border text-xs">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Entailment Ratio:</span>
                <span className="font-semibold">{result.result_b.metrics.entailment_ratio ?? "N/A"}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Numbers Grounded:</span>
                <span>{result.result_b.metrics.numbers_grounded ? "✅ Yes" : "❌ No"}</span>
              </div>
              {result.result_b.judge_reasoning && (
                <p className="text-[11px] text-muted-foreground pt-1 border-t line-clamp-2">
                  {result.result_b.judge_reasoning}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

