import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchTracesApi,
  fetchTraceStatsApi,
} from "@/lib/api";
import type { TraceItem, TraceStatsResponse } from "@/types/eval";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  RefreshCw,
  Search,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Trash2,
  TrendingUp,
  Sparkles,
} from "lucide-react";

interface ObservabilityViewProps {
  backendUrl: string;
  onOpenDbModal: () => void;
  isDbConnected: boolean;
}

export function ObservabilityView({
  backendUrl,
  onOpenDbModal,
  isDbConnected,
}: ObservabilityViewProps) {
  const [stats, setStats] = useState<TraceStatsResponse | null>(null);
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const statsRes = await fetchTraceStatsApi(backendUrl);
      setStats(statsRes);

      const verdict = verdictFilter === "all" ? undefined : verdictFilter;
      const search = searchQuery.trim() ? searchQuery.trim() : undefined;
      const tracesRes = await fetchTracesApi(50, 0, verdict, search, backendUrl);
      setTraces(tracesRes.items);
      setTotalCount(tracesRes.total);
    } catch (err) {
      console.error("Failed to load traces:", err);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, verdictFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownloadReport = (format: "markdown" | "json") => {
    const url = `${backendUrl.replace(/\/+$/, "")}/traces/report?format=${format}`;
    window.open(url, "_blank");
  };

  const handleClearTraces = async () => {
    if (!window.confirm("Are you sure you want to clear all recorded traces?")) return;
    try {
      await fetch(`${backendUrl.replace(/\/+$/, "")}/traces/`, { method: "DELETE" });
      loadData();
    } catch (e) {
      console.error("Failed to clear traces:", e);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    const v = verdict.toLowerCase();
    if (v === "pass") {
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 gap-1 text-[11px]">
          <CheckCircle2 className="size-3" /> Pass
        </Badge>
      );
    }
    if (v.includes("refusal")) {
      return (
        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 gap-1 text-[11px]">
          <AlertTriangle className="size-3" /> Refusal
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive gap-1 text-[11px]">
        <XCircle className="size-3" /> {verdict}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Database Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            RAG Observability & Trace History
          </h2>
          <p className="text-xs text-muted-foreground">
            Real-time telemetry and gate evaluation history across all interactions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDbModal}
            className="text-xs gap-1.5"
          >
            <span
              className={`size-2 rounded-full ${
                isDbConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            {isDbConnected ? "Supabase Active" : "Connect Supabase"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadReport("markdown")}
            className="text-xs gap-1.5"
            title="Download full Markdown audit report"
          >
            <FileDown className="size-3.5" />
            Audit Report
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={loadData}
            disabled={isLoading}
            className="size-8"
            title="Refresh traces"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Pass Rate</span>
            <TrendingUp className="size-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-foreground">
            {stats ? `${stats.pass_rate_pct}%` : "0%"}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {stats ? `${stats.passed} passed / ${stats.failed} failed` : "No data"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Total Evaluated</span>
            <Layers className="size-3.5 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-foreground">
            {stats?.total_traces || 0}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Stored in {isDbConnected ? "Supabase" : "Memory Buffer"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Avg Pipeline Latency</span>
            <Clock className="size-3.5 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-foreground">
            {stats?.avg_latency_ms || 0} <span className="text-xs font-normal">ms</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Fail-fast pipeline overhead
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Semantic Entailment</span>
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-foreground">
            {stats?.avg_faithfulness_ratio || 0.0}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Avg DeBERTa faithfulness ratio
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search queries or answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8 font-sans"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            {["all", "Pass", "Hard_Hallucination", "Retrieval_Error", "Refusal"].map((v) => (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  verdictFilter === v
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {traces.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearTraces}
            className="text-xs text-muted-foreground hover:text-destructive gap-1 h-8"
          >
            <Trash2 className="size-3" /> Clear Traces
          </Button>
        )}
      </div>

      {/* Trace Log Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        {traces.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Activity className="size-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">No traces recorded yet</p>
            <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm mx-auto">
              Run an evaluation from the "Single Run" or "Batch Benchmark" tab to generate and inspect traces.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {traces.map((trace) => {
              const isExpanded = expandedTraceId === trace.id;
              return (
                <div key={trace.id} className="transition-colors hover:bg-muted/20">
                  <div
                    onClick={() => setExpandedTraceId(isExpanded ? null : trace.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer gap-2"
                  >
                    <div className="space-y-1 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        {getVerdictBadge(trace.verdict)}
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {trace.latency_ms}ms
                        </span>
                        {trace.stage_failed && (
                          <span className="text-[10px] font-mono rounded bg-destructive/10 text-destructive px-1.5 py-0.5">
                            Failed at {trace.stage_failed}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {trace.created_at ? new Date(trace.created_at).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {trace.user_query}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1 font-sans">
                        {trace.llm_response}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {trace.judge_score !== null && (
                        <span
                          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                            trace.judge_score === 1
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          Judge: {trace.judge_score === 1 ? "1 (Pass)" : "0 (Fail)"}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div className="border-t bg-muted/10 p-4 space-y-4 text-xs animate-in fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                            Query (Q)
                          </span>
                          <p className="mt-1 rounded bg-background p-2.5 font-sans border">
                            {trace.user_query}
                          </p>
                        </div>

                        <div>
                          <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                            Generated Answer (A)
                          </span>
                          <p className="mt-1 rounded bg-background p-2.5 font-sans border">
                            {trace.llm_response}
                          </p>
                        </div>
                      </div>

                      {trace.context_chunks && trace.context_chunks.length > 0 && (
                        <div>
                          <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                            Retrieved Context Chunks ({trace.context_chunks.length})
                          </span>
                          <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto">
                            {trace.context_chunks.map((chunk, idx) => (
                              <div key={idx} className="rounded bg-background p-2 border font-mono text-[11px] text-muted-foreground">
                                <span className="font-semibold text-primary">Chunk {idx + 1}: </span>
                                {chunk}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metrics & Judge reasoning */}
                      <div className="rounded-lg border bg-background p-3 space-y-2">
                        <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                          Evaluator Metrics & Reasoning
                        </span>
                        {trace.judge_reasoning && (
                          <div className="rounded bg-muted/20 p-2 text-[11px] border">
                            <span className="font-semibold text-primary">Stage 5 Judge Reasoning: </span>
                            {trace.judge_reasoning}
                          </div>
                        )}
                        <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto p-2 bg-muted/10 rounded">
                          {JSON.stringify(trace.metrics, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

