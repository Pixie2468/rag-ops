import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { EvalResponse, EvalRequest } from "@/types/eval";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Terminal,
  Activity,
  FileJson,
  Brain,
  Scale,
  Hash,
  Binary,
  MessageSquare,
} from "lucide-react";

interface MetricsInspectorProps {
  response: EvalResponse | null;
  request: EvalRequest;
  isLoading: boolean;
  backendUrl: string;
}

export function MetricsInspector({
  response,
  request,
  isLoading,
  backendUrl,
}: MetricsInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const handleCopyJson = () => {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const curlCommand = `curl -X POST "${backendUrl.replace(/\/+$/, "")}/evaluate/" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(request, null, 2)}'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!response) return;
    const blob = new Blob([JSON.stringify(response, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eval-result-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-10 text-center shadow-xs">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
          <Activity className="size-6" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">
          No Evaluation Run Yet
        </h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Select a preset above or input a (Query, Context, Answer) triad, then click &ldquo;Run Evaluation Pipeline&rdquo; to view real-time stage metrics.
        </p>
      </div>
    );
  }

  const m = response.metrics;

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs">
      <Tabs defaultValue="metrics">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <TabsList>
            <TabsTrigger value="metrics" className="gap-1.5 text-xs">
              <Activity className="size-3.5" />
              Stage Metrics
            </TabsTrigger>
            <TabsTrigger value="json" className="gap-1.5 text-xs">
              <FileJson className="size-3.5" />
              Raw JSON
            </TabsTrigger>
            <TabsTrigger value="curl" className="gap-1.5 text-xs">
              <Terminal className="size-3.5" />
              CLI & cURL
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              className="h-8 text-xs gap-1.5"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy JSON"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadJson}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="size-3" />
              Download
            </Button>
          </div>
        </div>

        {/* Tab 1: Stage Metrics */}
        <TabsContent value="metrics" className="space-y-4 pt-2">
          {/* Stage 1: Refusal Detection */}
          <div className="rounded-lg border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-bold">
                  1
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Sanity & Refusal Gate
                </span>
              </div>
              {m.matched_pattern ? (
                <Badge variant="destructive" className="text-xs">
                  Refusal Matched
                </Badge>
              ) : (
                <Badge variant="success" className="text-xs">
                  Clean Answer
                </Badge>
              )}
            </div>
            {m.matched_pattern ? (
              <div className="text-xs text-destructive font-mono bg-destructive/10 p-2 rounded">
                Matched Pattern: {m.matched_pattern}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No canned refusal templates or evasions detected in the answer.
              </p>
            )}
          </div>

          {/* Stage 2: Context Relevance */}
          <div className="rounded-lg border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-bold">
                  2
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Context Relevance (Cross-Encoder: MiniLM)
                </span>
              </div>
              {m.max_chunk_score !== undefined && (
                <Badge
                  variant={m.max_chunk_score >= 0.15 ? "success" : "destructive"}
                  className="font-mono text-xs"
                >
                  Max Score: {m.max_chunk_score.toFixed(3)} (Threshold: 0.15)
                </Badge>
              )}
            </div>

            {m.max_chunk_score !== undefined ? (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Relevance Confidence</span>
                  <span className="font-mono tabular-nums">
                    {(m.max_chunk_score * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={Math.max(0, m.max_chunk_score * 100)}
                  max={100}
                  indicatorClassName={
                    m.max_chunk_score >= 0.15 ? "bg-emerald-500" : "bg-destructive"
                  }
                />

                {m.per_chunk_scores && m.per_chunk_scores.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Per-Chunk Scores:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {m.per_chunk_scores.map((score, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded border bg-card px-2 py-1 text-xs"
                        >
                          <span className="text-muted-foreground font-mono">Chunk #{i + 1}</span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              score >= 0.15 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                            }`}
                          >
                            {score.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Stage bypassed due to upstream failure.
              </p>
            )}
          </div>

          {/* Stage 3: Lexical Groundedness */}
          <div className="rounded-lg border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-bold">
                  3
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Lexical Groundedness (Numbers & Named Entities)
                </span>
              </div>
              {m.numbers_grounded !== undefined && (
                <Badge
                  variant={m.numbers_grounded ? "success" : "destructive"}
                  className="text-xs"
                >
                  {m.numbers_grounded ? "All Numbers Grounded" : "Hallucinated Numbers"}
                </Badge>
              )}
            </div>

            {m.numbers_grounded !== undefined ? (
              <div className="space-y-3 mt-2 text-xs">
                {/* Numbers */}
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Number Grounding Check:
                  </div>
                  {m.ungrounded_numbers && m.ungrounded_numbers.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-destructive font-medium">Ungrounded:</span>
                      {m.ungrounded_numbers.map((num, i) => (
                        <Badge key={i} variant="destructive" className="font-mono text-xs">
                          {num}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="size-3.5" />
                      All numerical claims exist in the retrieved context.
                    </div>
                  )}
                </div>

                {/* Entity Overlap */}
                {m.entity_overlap_pct !== undefined && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Named Entity Overlap (spaCy NER)</span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {m.entity_overlap_pct.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={m.entity_overlap_pct} max={100} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Stage bypassed due to upstream failure.
              </p>
            )}
          </div>

          {/* Stage 4: Semantic Faithfulness */}
          <div className="rounded-lg border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-bold">
                  4
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Semantic Faithfulness (NLI: DeBERTa-v3)
                </span>
              </div>
              {m.has_contradiction !== undefined && (
                <Badge
                  variant={!m.has_contradiction ? "success" : "destructive"}
                  className="text-xs"
                >
                  {m.has_contradiction ? "Contradiction Detected" : "No Contradictions"}
                </Badge>
              )}
            </div>

            {m.entailment_ratio !== undefined ? (
              <div className="space-y-3 mt-2 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Entailment Ratio</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {(m.entailment_ratio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={m.entailment_ratio * 100}
                    max={100}
                    indicatorClassName={
                      m.entailment_ratio >= 0.7 ? "bg-emerald-500" : "bg-amber-500"
                    }
                  />
                </div>

                {m.per_sentence_scores && m.per_sentence_scores.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Sentence Classification:
                    </span>
                    {m.per_sentence_scores.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded border bg-card p-2 text-xs flex items-start justify-between gap-3"
                      >
                        <p className="text-foreground leading-relaxed text-pretty">
                          &ldquo;{item.sentence}&rdquo;
                        </p>
                        <Badge
                          variant={
                            item.label === "contradiction"
                              ? "destructive"
                              : item.label === "entailment"
                              ? "success"
                              : "neutral"
                          }
                          className="shrink-0 font-mono text-[11px]"
                        >
                          {item.label || "evaluated"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Stage bypassed due to upstream failure.
              </p>
            )}
          </div>

          {/* Stage 5: LLM-as-a-Judge */}
          <div className="rounded-lg border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-bold">
                  5
                </span>
                <span className="text-xs font-semibold text-foreground">
                  LLM-as-a-Judge (Gemini Flash Audit)
                </span>
              </div>
              {response.judge_score !== null && response.judge_score !== undefined && (
                <Badge
                  variant={response.judge_score === 1 ? "success" : "destructive"}
                  className="font-mono text-xs"
                >
                  Score: {response.judge_score} / 1
                </Badge>
              )}
            </div>

            {response.judge_reasoning ? (
              <div className="rounded-md border bg-card p-3 mt-2 text-xs">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MessageSquare className="size-3 text-primary" />
                  Judge Reasoning:
                </div>
                <p className="text-foreground leading-relaxed text-pretty italic">
                  &ldquo;{response.judge_reasoning}&rdquo;
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {response.stage_failed
                  ? "Stage skipped because an earlier stage gate failed (cost & latency saved)."
                  : "No judge reasoning provided."}
              </p>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Raw JSON */}
        <TabsContent value="json" className="pt-2">
          <pre className="max-h-[500px] overflow-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground">
            {JSON.stringify(response, null, 2)}
          </pre>
        </TabsContent>

        {/* Tab 3: CLI & cURL */}
        <TabsContent value="curl" className="space-y-4 pt-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">
                Reproduce via cURL
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCurl}
                className="h-7 text-xs gap-1"
              >
                {copiedCurl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                {copiedCurl ? "Copied" : "Copy cURL"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground">
              {curlCommand}
            </pre>
          </div>

          <div>
            <span className="text-xs font-semibold text-foreground block mb-1.5">
              Run via Go TUI / CLI
            </span>
            <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground">
              {`# Save payload to file\ncat << 'EOF' > eval.json\n${JSON.stringify(request, null, 2)}\nEOF\n\n# Run with RAGOps CLI\nragops run eval.json`}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

