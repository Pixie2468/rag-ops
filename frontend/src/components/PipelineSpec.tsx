import React from "react";
import { Badge } from "@/components/ui/badge";
import { STAGES } from "@/lib/pipeline-stages";
import { ShieldCheck, Zap, Layers, Cpu, Terminal, ArrowDown } from "lucide-react";

export function PipelineSpec() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs space-y-6">
      {/* Intro */}
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            5-Stage Fail-Fast Evaluation Architecture
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed text-pretty">
          RAGOps layers fast, deterministic checks before invoking heavier semantic models. If an early stage fails (e.g. a refusal pattern or irrelevant retrieved context), the evaluation halts immediately, saving precious latency and LLM inference cost.
        </p>
      </div>

      {/* Stage Breakdown Cards */}
      <div className="space-y-3">
        {STAGES.map((stage, idx) => (
          <div
            key={stage.id}
            className="rounded-lg border bg-muted/20 p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-bold">
                  {stage.stepNumber}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {stage.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px]">
                  {stage.algorithm}
                </Badge>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {stage.speed}
                </Badge>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {stage.description}
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-2 border-t border-border/40 font-mono">
              <div>
                <span className="text-muted-foreground">Fail Condition: </span>
                <span className="text-foreground">
                  {idx === 0
                    ? "Regex match on refusal template"
                    : idx === 1
                    ? "Max chunk score < 0.15"
                    : idx === 2
                    ? "Ungrounded number in answer"
                    : idx === 3
                    ? "NLI contradiction > 0.5"
                    : "Gemini Judge score == 0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Verdict Tag: </span>
                <span className="text-foreground">
                  {idx === 0
                    ? "Refusal"
                    : idx === 1
                    ? "Retrieval_Error"
                    : idx === 2
                    ? "Hard_Hallucination"
                    : idx === 3
                    ? "Logical_Contradiction"
                    : "Pass / Fail"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Execution: </span>
                <span className="text-foreground">
                  {idx < 4 ? "Synchronous Local CPU" : "Remote Gemini API"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Deployment & CLI instructions */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-primary" />
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Quick Start (Local Stack)
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
            <span className="font-semibold text-foreground block">
              1. Start Backend & Database
            </span>
            <pre className="font-mono text-[11px] text-muted-foreground bg-background p-2 rounded border">
              docker compose up --build -d
            </pre>
            <p className="text-[11px] text-muted-foreground">
              Runs FastAPI server on <code className="font-mono">http://localhost:8000</code> with Postgres.
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
            <span className="font-semibold text-foreground block">
              2. Explore Traces via Go CLI
            </span>
            <pre className="font-mono text-[11px] text-muted-foreground bg-background p-2 rounded border">
              ragops run data.json
            </pre>
            <p className="text-[11px] text-muted-foreground">
              Instant interactive terminal UI powered by Cobra and BubbleTea.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

